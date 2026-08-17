import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  installSignalHandlers,
  runLauncher,
} from './dev-orchestrator.mjs';

function touch(path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
}

test('--dry-run 输出 topology plan 且不写 web env', () => {
  const root = mkdtempSync(join(tmpdir(), 'agents-launcher-dry-run-'));
  const agentsDir = join(root, 'agents');
  const webDir = join(root, 'web');
  touch(join(agentsDir, 'packages/server/conf/config.example.yaml'));
  touch(join(agentsDir, 'packages/server/conf/config.yaml'));
  touch(join(agentsDir, 'packages/desktop/dist/style.css'));
  touch(join(agentsDir, 'packages/ui/dist/agent-ui.css'));
  touch(join(webDir, 'packages/jsy-web/src/entry/config.ts'));

  const script = fileURLToPath(new URL('./dev-orchestrator.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [
    script,
    '--workspace=ui',
    '--dry-run',
    '--yes',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FX_AGENTS_DIR: agentsDir,
      FX_WEB_DIR: webDir,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[topology\.loaded\].*"schemaVersion":1/);
  assert.match(result.stdout, /"startOrder":\["agents","web","portal"\]/);
  assert.match(result.stdout, /"stopOrder":\["portal","web","agents"\]/);
  assert.match(result.stdout, /"propagationEdges":\[\{"upstream":"agents","downstream":"web"\}\]/);
  assert.equal(existsSync(join(webDir, 'packages/jsy-web/server/.env.local')), false);
});

const config = {
  schema_version: 1,
  supervision: {
    interval_ms: 1000,
    stable_successes: 2,
    failure_threshold: 2,
  },
  workspaces: { ui: ['agents', 'web'] },
  services: {
    agents: {
      adapter: 'agents',
      lifecycle: 'service',
      depends_on: {},
    },
    web: {
      adapter: 'web',
      lifecycle: 'service',
      depends_on: {
        agents: {
          condition: 'service_healthy',
          required: false,
          propagate_restart: true,
        },
      },
    },
  },
};

function injectedRun({ argv = ['--workspace=ui', '--yes'] } = {}) {
  const calls = [];
  const runtime = {
    phase: 'idle',
    registerAuxiliaryHandle: (handle) => calls.push(['aux', handle]),
    stopSelected: async (options) => calls.push(['stopSelected', options]),
    startSelected: async () => { runtime.phase = 'running'; calls.push(['startSelected']); },
    startSupervisor: async () => calls.push(['startSupervisor']),
    close: async (options) => calls.push(['close', options]),
  };
  const deps = {
    loadLauncherConfig: () => {
      calls.push(['loadConfig']);
      return { config, sourcePath: '/plugin/agents-launcher.yml' };
    },
    resolveRepos: () => ({
      AGENTS_DIR: '/agents',
      WEB_DIR: '/web',
      SERVER_DIR: '/server',
      sources: {
        AGENTS_DIR: 'env',
        WEB_DIR: 'env',
        SERVER_DIR: 'env',
      },
    }),
    validateRepos: () => calls.push(['validateRepos']),
    existsSync: () => true,
    createServiceAdapters: () => {
      calls.push(['createAdapters']);
      return {};
    },
    createRuntime: () => runtime,
    agentsApi: {
      configPath: () => '/agents/config.yaml',
      ensureCss: async () => calls.push(['ensureCss']),
    },
    webApi: {
      writeEnv: () => calls.push(['writeEnv']),
    },
    tcpOpen: async () => true,
    httpOk: async () => true,
    pidOnPort: () => '1',
    spawnPrefixed: () => ({ pid: 88 }),
    confirm: async () => true,
    installSignals: () => calls.push(['installSignals']),
    log: () => {},
  };
  return {
    calls,
    runtime,
    result: runLauncher({
      argv,
      env: {},
      toolDir: '/plugin',
      deps,
    }),
  };
}

test('合法 topology 在所有 imperative preflight 前加载', async () => {
  const run = injectedRun();
  await run.result;
  assert.deepEqual(run.calls.slice(0, 4), [
    ['loadConfig'],
    ['validateRepos'],
    ['writeEnv'],
    ['ensureCss'],
  ]);
  assert.deepEqual(run.calls.slice(-3), [
    ['installSignals'],
    ['startSelected'],
    ['startSupervisor'],
  ]);
});

test('topology 失败时不进入 repo/preflight/runtime', async () => {
  const calls = [];
  await assert.rejects(
    () => runLauncher({
      argv: ['--workspace=ui', '--yes'],
      toolDir: '/plugin',
      deps: {
        loadLauncherConfig: () => {
          calls.push(['loadConfig']);
          throw new Error('[topology] dependency cycle detected');
        },
        resolveRepos: () => {
          calls.push(['resolveRepos']);
          return {};
        },
        createServiceAdapters: () => {
          calls.push(['createAdapters']);
          return {};
        },
        log: () => {},
      },
    }),
    /\[topology\] dependency cycle/,
  );
  assert.deepEqual(calls, [['loadConfig']]);
});

test('--dry-run 在任何 preflight/adapter/runtime 副作用前返回', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--dry-run', '--yes'],
  });
  await run.result;
  assert.deepEqual(run.calls, [['loadConfig']]);
});

test('--stop 只按 plan stop，不 down Docker、不起 supervisor', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--stop', '--yes'],
  });
  await run.result;
  assert.deepEqual(run.calls, [
    ['loadConfig'],
    ['createAdapters'],
    ['stopSelected', { includeDocker: false }],
  ]);
});

test('--status 保留五行固定视图且不创建 runtime', async () => {
  const lines = [];
  await runLauncher({
    argv: ['--workspace=ui', '--status'],
    toolDir: '/plugin',
    deps: {
      loadLauncherConfig: () => ({
        config,
        sourcePath: '/plugin/agents-launcher.yml',
      }),
      tcpOpen: async () => true,
      httpOk: async () => true,
      pidOnPort: () => '42',
      createServiceAdapters: () => {
        throw new Error('status 不应创建 adapters');
      },
      log: (line) => lines.push(line),
    },
  });
  const statusLines = lines.filter((line) => line.startsWith('[status]'));
  assert.equal(lines.length, 5);
  assert.equal(statusLines.length, 5);
  assert.deepEqual(
    statusLines.map((line) => line.match(/^\[status\] (\w+)/)[1]),
    ['web', 'agents', 'server', 'pg', 'minio'],
  );
});

test('--css-watch 只登记一个 auxiliary handle', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--css-watch', '--yes'],
  });
  await run.result;
  assert.equal(run.calls.filter(([name]) => name === 'aux').length, 1);
});

test('--no-web 时 css-watch 不创建 auxiliary', async () => {
  const run = injectedRun({
    argv: ['--workspace=ui', '--no-web', '--css-watch', '--yes'],
  });
  await run.result;
  assert.equal(run.calls.filter(([name]) => name === 'aux').length, 0);
});

test('重复 signal 复用同一个 runtime.close promise', async () => {
  let resolveClose;
  let closeCalls = 0;
  const closePromise = new Promise((resolve) => { resolveClose = resolve; });
  const exits = [];
  const handlers = {};
  const shutdown = installSignalHandlers({
    runtime: {
      close: async () => {
        closeCalls += 1;
        await closePromise;
      },
    },
    downDocker: false,
    processLike: {
      once: (signal, handler) => { handlers[signal] = handler; },
      exit: (code) => exits.push(code),
    },
    log: () => {},
  });
  assert.equal(typeof handlers.SIGINT, 'function');
  assert.equal(typeof handlers.SIGTERM, 'function');
  const first = shutdown('SIGINT');
  const second = shutdown('SIGTERM');
  assert.equal(first, second);
  resolveClose();
  await first;
  assert.equal(closeCalls, 1);
  assert.deepEqual(exits, [0]);
});
