import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAPTER_CAPABILITIES,
  ADAPTER_NAMES,
  createServiceAdapters,
} from './service-adapters.mjs';

function fixture({ runCode = 0 } = {}) {
  const calls = [];
  const child = { pid: 41 };
  const services = {
    agents: {
      start: (options) => { calls.push(['agents.start', options]); return child; },
      killCommands: () => [['pkill', ['-f', 'telemetry/preload.ts']]],
      status: async () => ({ up: true, pid: '80701' }),
    },
    web: {
      start: (options) => { calls.push(['web.start', options]); return child; },
      killCommands: () => [['sh', ['-c', 'kill-web']]],
      status: async () => ({ up: true, pid: '100011' }),
    },
    server: {
      infra: async (options) => { calls.push(['docker.start', options]); },
      start: async (options) => { calls.push(['server.start', options]); return child; },
      killCommands: () => [['sh', ['-c', 'kill-server']]],
    },
  };
  const io = {
    runToEnd: async (label, command, args, options) => {
      calls.push(['run', label, command, args, options]);
      return runCode;
    },
    httpOk: async () => true,
    pidOnPort: () => '80811',
  };
  const adapters = createServiceAdapters({
    repos: { AGENTS_DIR: '/agents', WEB_DIR: '/web', SERVER_DIR: '/server' },
    ports: { agents: 8070, server: 8081, web: 10001 },
    options: {},
    services,
    io,
  });
  return { adapters, calls, child };
}

test('adapter allowlist 与 identity capability 固定且冻结', () => {
  assert.deepEqual(ADAPTER_NAMES, ['docker', 'agents', 'server', 'web']);
  assert.equal(ADAPTER_CAPABILITIES.docker.supportsIdentity, false);
  assert.equal(ADAPTER_CAPABILITIES.agents.supportsIdentity, true);
  assert.equal(Object.isFrozen(ADAPTER_CAPABILITIES), true);
});

test('web start 委托 webCli.start（带 ports 供归属预检）并返回 handle；复用实例返回 null 时 handles 为空', async () => {
  const { adapters, calls, child } = fixture();
  assert.deepEqual(await adapters.web.start({}), { handles: [child] });
  assert.deepEqual(calls[0], ['web.start', { webDir: '/web', ports: { agents: 8070, server: 8081, web: 10001 } }]);

  // 复用路径：webCli.start 返回 null（端口已被本 webDir 实例持有）→ 无 handle，stop 走端口杀法不依赖 handle
  const reuseAdapters = createServiceAdapters({
    repos: { AGENTS_DIR: '/agents', WEB_DIR: '/web', SERVER_DIR: '/server' },
    ports: { agents: 8070, server: 8081, web: 10001 },
    services: {
      agents: { start: () => ({}), killCommands: () => [], status: async () => ({ up: true, pid: '1' }) },
      server: { infra: async () => {}, start: async () => ({}), killCommands: () => [] },
      web: {
        start: () => null,
        killCommands: () => [['sh', ['-c', 'kill-web']]],
        status: async () => ({ up: true, pid: '100011' }),
      },
    },
    io: { runToEnd: async () => 0, httpOk: async () => true, pidOnPort: () => '1' },
  });
  assert.deepEqual(await reuseAdapters.web.start({}), { handles: [] });
});

test('agents/web status 被规范化为 healthy + listener identity', async () => {
  const { adapters } = fixture();
  assert.deepEqual(await adapters.agents.status({}), {
    healthy: true,
    identity: '80701',
  });
  assert.deepEqual(await adapters.web.status({}), {
    healthy: true,
    identity: '100011',
  });
});

test('server start 根据 selected docker 决定是否重复起 infra', async () => {
  const { adapters, calls } = fixture();
  await adapters.server.start({ plan: { selected: ['docker', 'server'] } });
  assert.equal(calls[0][0], 'server.start');
  assert.equal(calls[0][1].ensureInfra, false);
  assert.equal(calls[0][1].killOld, true);
});

test('docker normal stop no-op，显式 down 才执行 compose down', async () => {
  const { adapters, calls } = fixture();
  await adapters.docker.stop({ downDocker: false });
  assert.deepEqual(calls, []);
  await adapters.docker.stop({ downDocker: true });
  assert.deepEqual(calls[0], [
    'run',
    'docker-down',
    'docker',
    ['compose', 'down'],
    { cwd: '/server' },
  ]);
});

test('per-service stop 在进程已不存在时保持幂等', async () => {
  const { adapters } = fixture({ runCode: 1 });
  await assert.doesNotReject(() => adapters.agents.stop({}));
});
