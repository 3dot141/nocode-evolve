import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitHealthy } from './proc.mjs';

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
