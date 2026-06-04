import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKillCommands, waitHealthy } from './proc.mjs';

const PORTS = { agents: 8070, server: 8081, web: 10001 };

test('ui workspace 杀 web + agents（含 tsx watch 父进程），不碰 docker/server', () => {
  const cmds = buildKillCommands({ ports: PORTS, serverDir: '/srv', services: { web: true, agents: true } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('telemetry/preload.ts')), 'kill tsx watch 父进程');
  assert.ok(flat.some((s) => s.includes('tcp:8070')));
  assert.ok(flat.some((s) => s.includes('tcp:10001')));
  assert.ok(!flat.some((s) => s.includes('gradlew')), 'ui 不停 gradle');
  assert.ok(!flat.some((s) => s.includes('docker compose down')), 'ui 不停 docker');
});

test('full workspace 还包含 gradle stop + 8081（docker 生命周期不在 buildKillCommands）', () => {
  const cmds = buildKillCommands({ ports: PORTS, serverDir: '/srv', services: { web: true, agents: true, server: true, docker: true } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('gradlew --stop')));
  assert.ok(flat.some((s) => s.includes('tcp:8081')));
  assert.ok(!flat.some((s) => s.includes('docker compose')), 'docker 不混进 kill 命令');
});

test('waitHealthy 第三次通过则成功，可注入 sleep 与 check', async () => {
  let n = 0;
  const ok = await waitHealthy('x', async () => ++n >= 3, { tries: 5, intervalMs: 0, sleep: async () => {} });
  assert.equal(ok, true);
  assert.equal(n, 3);
});

test('waitHealthy 超时抛错', async () => {
  await assert.rejects(
    waitHealthy('x', async () => false, { tries: 2, intervalMs: 0, sleep: async () => {} }),
    /健康检查超时/,
  );
});
