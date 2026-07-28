import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGh, normalizeBkt, statusLine, stopReason, parseArgs, queryStatus, watchStatus,
} from './pr-check.mjs';

// ═══ normalizeGh — gh pr view --json state,mergeStateStatus,mergeable,reviewDecision ═══
test('normalizeGh — MERGED 透传 state', () => {
  const r = normalizeGh({ state: 'MERGED', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: 'APPROVED' });
  assert.equal(r.state, 'MERGED');
});
test('normalizeGh — OPEN+CLEAN+MERGEABLE → mergeable true', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: '' });
  assert.equal(r.state, 'OPEN');
  assert.equal(r.mergeable, true);
});
test('normalizeGh — OPEN+BLOCKED → mergeable false (CI 没过)', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'BLOCKED', mergeable: 'MERGEABLE', reviewDecision: '' });
  assert.equal(r.mergeable, false);
});
test('normalizeGh — reviewDecision APPROVED → approved true', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: 'APPROVED' });
  assert.equal(r.approved, true);
});
test('normalizeGh — reviewDecision 空 (无 required review 且无人 review) → approved false, 防误自动合并', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: '' });
  assert.equal(r.approved, false);
});
test('normalizeGh — CHANGES_REQUESTED → approved false', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: 'CHANGES_REQUESTED' });
  assert.equal(r.approved, false);
});

// ═══ normalizeBkt — bkt api .../pull-requests/<id> (.state/.reviewers) + /merge (.canMerge) ═══
test('normalizeBkt — DECLINED 映射到 CLOSED', () => {
  assert.equal(normalizeBkt({ state: 'DECLINED' }, null).state, 'CLOSED');
});
test('normalizeBkt — MERGED 映射到 MERGED', () => {
  assert.equal(normalizeBkt({ state: 'MERGED' }, null).state, 'MERGED');
});
test('normalizeBkt — canMerge true → mergeable true', () => {
  assert.equal(normalizeBkt({ state: 'OPEN' }, { canMerge: true }).mergeable, true);
});
test('normalizeBkt — 任一 reviewer approved → approved true', () => {
  const pr = { state: 'OPEN', reviewers: [{ approved: false }, { approved: true }] };
  assert.equal(normalizeBkt(pr, { canMerge: true }).approved, true);
});
test('normalizeBkt — 全部未 approve → approved false', () => {
  const pr = { state: 'OPEN', reviewers: [{ approved: false }] };
  assert.equal(normalizeBkt(pr, { canMerge: true }).approved, false);
});
test('normalizeBkt — 无 reviewers 字段 → approved false', () => {
  assert.equal(normalizeBkt({ state: 'OPEN' }, { canMerge: true }).approved, false);
});

// ═══ statusLine — 调用方识别契约 ═══
test('statusLine — 三元组格式', () => {
  assert.equal(
    statusLine({ state: 'OPEN', mergeable: true, approved: false }),
    'PR_CHECK state=OPEN mergeable=true approved=false',
  );
});
test('statusLine — MERGED 形态', () => {
  assert.equal(
    statusLine({ state: 'MERGED', mergeable: false, approved: true }),
    'PR_CHECK state=MERGED mergeable=false approved=true',
  );
});

// ═══ stopReason — watch 停止条件 ═══
test('stopReason — OPEN 且可合并、已批准才 READY', () => {
  assert.equal(stopReason({ state: 'OPEN', mergeable: true, approved: true }), 'READY');
  assert.equal(stopReason({ state: 'OPEN', mergeable: true, approved: false }), null);
  assert.equal(stopReason({ state: 'OPEN', mergeable: false, approved: true }), null);
});
test('stopReason — MERGED/CLOSED 为终态', () => {
  assert.equal(stopReason({ state: 'MERGED', mergeable: false, approved: false }), 'MERGED');
  assert.equal(stopReason({ state: 'CLOSED', mergeable: false, approved: false }), 'CLOSED');
});

// ═══ parseArgs ═══
test('parseArgs — --key value 与 flag', () => {
  const a = parseArgs(['--toolchain', 'gh', '--pr', '123', '--flag']);
  assert.equal(a.toolchain, 'gh');
  assert.equal(a.pr, '123');
  assert.equal(a.flag, true);
});

// ═══ queryStatus（注入 run，不真跑 IO）═══
test('queryStatus — gh 查询含 reviewDecision 字段', () => {
  const calls = [];
  const run = (argv) => {
    calls.push(argv.join(' '));
    return JSON.stringify({ state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE', reviewDecision: 'APPROVED' });
  };
  const s = queryStatus({ toolchain: 'gh', pr: 142 }, run);
  assert.equal(s.approved, true);
  assert.ok(calls[0].includes('reviewDecision'), 'gh 查询必须带 reviewDecision');
});
test('queryStatus — bkt state=MERGED 不再查 /merge (终态短路)', () => {
  const calls = [];
  const run = (argv) => { calls.push(argv.join(' ')); return JSON.stringify({ state: 'MERGED' }); };
  const s = queryStatus({ toolchain: 'bkt', pr: 5, targetProject: 'P', repoSlug: 'r' }, run);
  assert.equal(s.state, 'MERGED');
  assert.ok(!calls.some((c) => c.includes('/merge')), 'MERGED 时不应查 /merge');
});
test('queryStatus — bkt /merge 查询失败 → mergeable false, 不抛错', () => {
  const run = (argv) => {
    if (argv.some((x) => String(x).includes('/merge'))) throw new Error('409');
    return JSON.stringify({ state: 'OPEN', reviewers: [{ approved: true }] });
  };
  const s = queryStatus({ toolchain: 'bkt', pr: 5, targetProject: 'P', repoSlug: 'r' }, run);
  assert.equal(s.state, 'OPEN');
  assert.equal(s.mergeable, false);
  assert.equal(s.approved, true);
});

// ═══ watchStatus（注入 timer/run，不真等待）═══
test('watchStatus — 定时查询直到 READY', async () => {
  const statuses = [
    { state: 'OPEN', reviewers: [{ approved: false }] },
    { state: 'OPEN', reviewers: [{ approved: true }] },
  ];
  const sleeps = [];
  const lines = [];
  const run = (argv) => {
    if (argv.some((x) => String(x).endsWith('/merge'))) {
      return JSON.stringify({ canMerge: true });
    }
    return JSON.stringify(statuses.shift());
  };

  const result = await watchStatus(
    { toolchain: 'bkt', pr: 5, targetProject: 'P', repoSlug: 'r' },
    {
      intervalMs: 5000,
      run,
      sleep: async (ms) => sleeps.push(ms),
      onStatus: (status) => lines.push(statusLine(status)),
    },
  );

  assert.equal(result.stopReason, 'READY');
  assert.equal(result.runs, 2);
  assert.deepEqual(sleeps, [5000]);
  assert.equal(lines.length, 2);
});

test('watchStatus — 查询失败后重试，成功时清零错误计数', async () => {
  let calls = 0;
  const errors = [];
  const result = await watchStatus(
    { toolchain: 'gh', pr: 12 },
    {
      intervalMs: 0,
      run: () => {
        calls += 1;
        if (calls === 1) throw new Error('temporary');
        return JSON.stringify({
          state: 'MERGED',
          mergeStateStatus: 'UNKNOWN',
          mergeable: 'UNKNOWN',
          reviewDecision: 'APPROVED',
        });
      },
      sleep: async () => {},
      onError: (error, meta) => errors.push([error.message, meta.consecutiveErrors]),
    },
  );

  assert.equal(result.stopReason, 'MERGED');
  assert.deepEqual(errors, [['temporary', 1]]);
});

test('watchStatus — 连续失败达到上限后抛错', async () => {
  await assert.rejects(
    watchStatus(
      { toolchain: 'gh', pr: 12 },
      {
        intervalMs: 0,
        maxErrors: 2,
        run: () => { throw new Error('offline'); },
        sleep: async () => {},
      },
    ),
    /offline/,
  );
});
