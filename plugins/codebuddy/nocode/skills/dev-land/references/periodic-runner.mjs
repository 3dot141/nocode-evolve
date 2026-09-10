/**
 * 以固定间隔重复执行任务，直到条件命中或达到运行次数上限。
 *
 * 定时机制只负责“何时再跑一次”，不理解 PR、合并或清理语义。
 */

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assertOptions = ({ task, shouldStop, intervalMs, maxRuns }) => {
  if (typeof task !== 'function') throw new TypeError('task must be a function');
  if (typeof shouldStop !== 'function') throw new TypeError('shouldStop must be a function');
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new RangeError('intervalMs must be a non-negative finite number');
  }
  if (maxRuns !== Infinity && (!Number.isInteger(maxRuns) || maxRuns < 1)) {
    throw new RangeError('maxRuns must be a positive integer or Infinity');
  }
};

export async function runPeriodically(options) {
  const {
    task,
    shouldStop,
    intervalMs,
    maxRuns = Infinity,
    onResult = () => {},
    sleep = defaultSleep,
  } = options;

  assertOptions({ task, shouldStop, intervalMs, maxRuns });

  let lastValue;
  for (let run = 1; run <= maxRuns; run += 1) {
    lastValue = await task({ run });
    await onResult(lastValue, { run });

    if (await shouldStop(lastValue, { run })) {
      return { reason: 'condition', runs: run, value: lastValue };
    }
    if (run < maxRuns) await sleep(intervalMs);
  }

  return { reason: 'max-runs', runs: maxRuns, value: lastValue };
}
