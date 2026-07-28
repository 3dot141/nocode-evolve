import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPeriodically } from './periodic-runner.mjs';

test('runPeriodically — 条件命中后停止且不再 sleep', async () => {
  const values = [];
  const sleeps = [];
  const result = await runPeriodically({
    task: ({ run }) => run,
    shouldStop: (value) => value === 3,
    intervalMs: 5000,
    onResult: (value) => values.push(value),
    sleep: async (ms) => sleeps.push(ms),
  });

  assert.deepEqual(values, [1, 2, 3]);
  assert.deepEqual(sleeps, [5000, 5000]);
  assert.deepEqual(result, { reason: 'condition', runs: 3, value: 3 });
});

test('runPeriodically — 达到 maxRuns 后返回最后结果', async () => {
  const result = await runPeriodically({
    task: ({ run }) => run,
    shouldStop: () => false,
    intervalMs: 0,
    maxRuns: 2,
    sleep: async () => {},
  });

  assert.deepEqual(result, { reason: 'max-runs', runs: 2, value: 2 });
});

test('runPeriodically — 拒绝非法间隔', async () => {
  await assert.rejects(
    runPeriodically({
      task: async () => null,
      shouldStop: () => false,
      intervalMs: -1,
    }),
    /intervalMs/,
  );
});
