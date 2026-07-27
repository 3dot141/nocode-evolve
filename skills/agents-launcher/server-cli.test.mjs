import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepare, infra, start, killCommands } from './server-cli.mjs';

function fakeServerRepo({ withAntlrOutput = true } = {}) {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(serverDir, 'gradlew'), '#!/bin/sh');
  const moduleDir = join(serverDir, 'fx-agent-workspace');
  mkdirSync(moduleDir, { recursive: true });
  if (withAntlrOutput) {
    const outDir = join(moduleDir, 'src/main/antlr-generated/com/fanruan/x');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'WorkspaceDslParser.java'), 'class WorkspaceDslParser {}');
  }
  return serverDir;
}

test('killCommands 返回 gradlew --stop + 容器清理 + 端口清理三段', () => {
  const cmds = killCommands({ ports: { server: 8081 }, serverDir: '/tmp/srv' });
  assert.equal(cmds.length, 3);
  assert.deepEqual(cmds[0], ['sh', ['-c', 'cd /tmp/srv && ./gradlew --stop || true']]);
  assert.deepEqual(cmds[1], ['sh', ['-c', 'docker rm -f dev-backend 2>/dev/null || true']]);
  assert.deepEqual(cmds[2], ['sh', ['-c', 'lsof -ti tcp:8081 | xargs kill -9 2>/dev/null || true']]);
});

test('prepare: 模块目录不存在时抛清晰错误，不静默跳过', async () => {
  const serverDir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(serverDir, 'gradlew'), '#!/bin/sh');
  await assert.rejects(
    prepare({ serverDir, exec: () => '' }),
    /fx-agent-workspace 模块缺失或路径不对/,
  );
});

test('prepare: 跑 gradlew 生成 task，产物目录非空则成功', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  const calls = [];
  const mockExec = (cmd, args, opts) => { calls.push([cmd, args, opts]); return ''; };
  const result = await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.ok(calls.some(([cmd, args]) => cmd === './gradlew' && args.includes(':fx-agent-workspace:generateGrammarSource')));
  assert.equal(result.antlrOutputDir, 'src/main/antlr-generated');
});

test('prepare: gradlew 跑完但两个候选目录都空，报错提示新 worktree 首次必跑', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: false });
  const mockExec = () => '';
  await assert.rejects(
    prepare({ serverDir, exec: mockExec, log: () => {} }),
    /未检出产物/,
  );
});

test('prepare: 无 GraalVM 时向 gradle 传 java_home -v 21 解析出的 JAVA_HOME', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  let gradleEnv = null;
  const mockExec = (cmd, args, opts) => {
    if (cmd === '/usr/libexec/java_home') return '/jdk/ms-21\n';
    if (cmd === './gradlew') { gradleEnv = opts.env; return ''; }
    throw new Error('java not found');   // isGraalvm 全 miss
  };
  await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.equal(gradleEnv.JAVA_HOME, '/jdk/ms-21');
  assert.ok(gradleEnv.PATH.startsWith('/jdk/ms-21/bin:'));
});

test('prepare: 返回 graalvm 检测结果（容器降级场景）', async () => {
  const serverDir = fakeServerRepo({ withAntlrOutput: true });
  const mockExec = (cmd) => {
    if (cmd === './gradlew') return '';
    throw new Error('java not found');   // isGraalvm 检测全 miss
  };
  const result = await prepare({ serverDir, exec: mockExec, log: () => {} });
  assert.equal(result.graalvm.mode, 'container');
});

test('infra: 将显式 serverDir 交给基础设施入口', async () => {
  const calls = [];
  const result = await infra({
    serverDir: '/srv/worktree',
    dockerScriptPath: '/tmp/agents-launcher-docker-example.sh',
    env: { TEST_ENV: '1' },
    log: () => {},
    startInfraFn: async (opts) => {
      calls.push(opts);
      return { portsReady: true, esReady: true };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].serverDir, '/srv/worktree');
  assert.equal(calls[0].dockerScriptPath, '/tmp/agents-launcher-docker-example.sh');
  assert.equal(calls[0].env.TEST_ENV, '1');
  assert.equal(result.esReady, true);
});

test('start: ensureInfra=false 时不重复启动 Docker', async () => {
  let infraRuns = 0;
  let appOptions;
  const result = await start({
    serverDir: '/srv/worktree',
    ports: { server: 18081 },
    ensureInfra: false,
    infraFn: async () => { infraRuns++; },
    detectGraalvmFn: () => ({ mode: 'local', javaHome: '/graalvm' }),
    startAppFn: (opts) => {
      appOptions = opts;
      return { pid: 123 };
    },
    log: () => {},
  });
  assert.equal(infraRuns, 0);
  assert.equal(appOptions.serverDir, '/srv/worktree');
  assert.equal(appOptions.appPort, 18081);
  assert.deepEqual(result, { pid: 123 });
});

test('start: 每次显式关闭 fx-data-server 的自动打开浏览器行为', async () => {
  let appOptions;
  await start({
    serverDir: '/srv/worktree',
    ensureInfra: false,
    baseEnv: { OPENPROJECT_ISOPEN: 'true' },
    detectGraalvmFn: () => ({ mode: 'local', javaHome: '/graalvm' }),
    startAppFn: (opts) => {
      appOptions = opts;
      return { pid: 123 };
    },
    log: () => {},
  });
  assert.equal(appOptions.env.OPENPROJECT_ISOPEN, 'false');
});
