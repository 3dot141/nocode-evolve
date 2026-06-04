import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORTS, buildWriteTargets } from './ports.mjs';

test('PORTS 用现状默认值', () => {
  assert.deepEqual(PORTS, { agents: 8070, server: 8081, web: 10001 });
});

test('buildWriteTargets 扇出到 web .env.local + Spring env（不写 config.yaml）', () => {
  const t = buildWriteTargets({ agentsDir: '/abs/fx-data-agents' });
  assert.equal(t.webEnv.AGENTS_LOCAL_SERVER, 'http://127.0.0.1:8070');
  assert.equal(t.webEnv.USER_CLIENT, 'localDebugger');
  assert.equal(t.webEnv.AGENTS_LOCAL_SRC, '/abs/fx-data-agents');
  assert.equal(t.webEnv.DEV_SERVER_PORT, '10001');
  assert.equal(t.serverEnv.SERVER_PORT, '8081');
  assert.ok(!('agentsConfig' in t), '不再产出 config.yaml 写目标');
});

test('buildWriteTargets 接受自定义端口覆盖默认', () => {
  const t = buildWriteTargets({ agentsDir: '/x', ports: { agents: 1, server: 2, web: 3 } });
  assert.equal(t.webEnv.AGENTS_LOCAL_SERVER, 'http://127.0.0.1:1');
  assert.equal(t.serverEnv.SERVER_PORT, '2');
  assert.equal(t.webEnv.DEV_SERVER_PORT, '3');
});
