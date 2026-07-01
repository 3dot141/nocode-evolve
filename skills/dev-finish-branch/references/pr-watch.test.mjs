import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGh, normalizeBkt, decide, parseArgs, resultLine, loop, queryStatus,
} from './pr-watch.mjs';

// ═══ normalizeGh — gh pr view --json state,mergeStateStatus,mergeable ═══
test('normalizeGh — MERGED 透传 state', () => {
  const r = normalizeGh({ state: 'MERGED', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE' });
  assert.equal(r.state, 'MERGED');
});
test('normalizeGh — OPEN+CLEAN+MERGEABLE → mergeable true', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE' });
  assert.equal(r.state, 'OPEN');
  assert.equal(r.mergeable, true);
});
test('normalizeGh — OPEN+BLOCKED → mergeable false (CI 没过)', () => {
  const r = normalizeGh({ state: 'OPEN', mergeStateStatus: 'BLOCKED', mergeable: 'MERGEABLE' });
  assert.equal(r.mergeable, false);
});

// ═══ normalizeBkt — bkt api .../pull-requests/<id> (.state) + /merge (.canMerge) ═══
test('normalizeBkt — DECLINED 映射到 CLOSED', () => {
  assert.equal(normalizeBkt({ state: 'DECLINED' }, null).state, 'CLOSED');
});
test('normalizeBkt — MERGED 映射到 MERGED', () => {
  assert.equal(normalizeBkt({ state: 'MERGED' }, null).state, 'MERGED');
});
test('normalizeBkt — canMerge true → mergeable true', () => {
  assert.equal(normalizeBkt({ state: 'OPEN' }, { canMerge: true }).mergeable, true);
});

// ═══ decide — 状态机 5 分支 ═══
test('decide — MERGED → cleanup', () => {
  assert.deepEqual(decide({ state: 'MERGED' }, false), { type: 'cleanup' });
});
test('decide — CLOSED → closed', () => {
  assert.deepEqual(decide({ state: 'CLOSED' }, false), { type: 'closed' });
});
test('decide — OPEN+mergeable+未通知 → notify(keep)', () => {
  assert.deepEqual(decide({ state: 'OPEN', mergeable: true }, false), { type: 'notify', keep: true });
});
test('decide — OPEN+mergeable+已通知 → continue (不重复骚扰)', () => {
  assert.deepEqual(decide({ state: 'OPEN', mergeable: true }, true), { type: 'continue' });
});
test('decide — OPEN+不可合 → continue', () => {
  assert.deepEqual(decide({ state: 'OPEN', mergeable: false }, false), { type: 'continue' });
});

// ═══ parseArgs ═══
test('parseArgs — --key value 与 flag', () => {
  const a = parseArgs(['--toolchain', 'gh', '--pr', '123', '--flag']);
  assert.equal(a.toolchain, 'gh');
  assert.equal(a.pr, '123');
  assert.equal(a.flag, true);
});

// ═══ resultLine — re-invoke 识别契约 ═══
test('resultLine — merged 含 worktree + tasks', () => {
  assert.equal(
    resultLine({ type: 'cleanup' }, { worktree: '/w', tasks: 'f-1' }),
    'PR_WATCH_RESULT merged worktree=/w tasks=f-1',
  );
});
test('resultLine — closed 含 worktree', () => {
  assert.equal(
    resultLine({ type: 'closed' }, { worktree: '/w' }),
    'PR_WATCH_RESULT closed worktree=/w',
  );
});
test('resultLine — cleanup 失败带 cleanup=failed 后缀 (C1)', () => {
  assert.equal(
    resultLine({ type: 'cleanup' }, { worktree: '/w', tasks: 'f-1' }, true),
    'PR_WATCH_RESULT merged worktree=/w tasks=f-1 cleanup=failed',
  );
});

// ═══ queryStatus — bkt 终态短路 (C2) ═══
test('queryStatus — bkt state=MERGED 不再查 /merge (C2 短路)', () => {
  const calls = [];
  const run = (argv) => { calls.push(argv.join(' ')); return JSON.stringify({ state: 'MERGED' }); };
  const s = queryStatus({ toolchain: 'bkt', pr: 5, targetProject: 'P', repoSlug: 'r' }, run);
  assert.equal(s.state, 'MERGED');
  assert.ok(!calls.some((c) => c.includes('/merge')), 'MERGED 时不应查 /merge');
});

// ═══ loop — 集成 (注入 run + sleep + out, 不真跑 IO) ═══
test('loop — 查到 MERGED: 清 worktree + 输出信号 + 返回 merged', async () => {
  const calls = [];
  const run = (argv) => {
    calls.push(argv);
    if (argv[0] === 'gh' && argv[2] === 'view') {
      return JSON.stringify({ state: 'MERGED', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE' });
    }
    return '';
  };
  const outLines = [];
  const r = await loop(
    { toolchain: 'gh', pr: 1, worktree: '/w', mainRoot: '/m', interval: 0, tasks: 'f-9' },
    { run, sleep: async () => {}, out: (s) => outLines.push(s) },
  );
  assert.equal(r, 'merged');
  assert.ok(calls.some(c => c[0] === 'git' && c.includes('remove')), '应清理 worktree');
  assert.ok(outLines.some(l => l.startsWith('PR_WATCH_RESULT merged')), '应输出流转信号');
});
test('loop — 查到 CLOSED: 不清 worktree + 返回 closed', async () => {
  const calls = [];
  const run = (argv) => {
    calls.push(argv);
    if (argv[0] === 'gh') return JSON.stringify({ state: 'CLOSED', mergeStateStatus: 'DIRTY', mergeable: 'UNKNOWN' });
    return '';
  };
  const r = await loop(
    { toolchain: 'gh', pr: 1, worktree: '/w', mainRoot: '/m', interval: 0 },
    { run, sleep: async () => {}, out: () => {} },
  );
  assert.equal(r, 'closed');
  assert.ok(!calls.some(c => c.includes('remove')), 'worktree 应保留');
});
test('loop — cleanup 失败: 仍输出 cleanup=failed 信号 + 返回 merged (C1)', async () => {
  const run = (argv) => {
    if (argv[0] === 'gh' && argv[2] === 'view') {
      return JSON.stringify({ state: 'MERGED', mergeStateStatus: 'CLEAN', mergeable: 'MERGEABLE' });
    }
    if (argv[0] === 'git' && argv.includes('remove')) throw new Error('worktree has uncommitted changes');
    return '';
  };
  const outLines = [];
  const r = await loop(
    { toolchain: 'gh', pr: 1, worktree: '/w', mainRoot: '/m', interval: 0, tasks: 'f-9' },
    { run, sleep: async () => {}, out: (s) => outLines.push(s) },
  );
  assert.equal(r, 'merged');
  assert.ok(outLines.some(l => l.includes('cleanup=failed')), '清理失败应输出 cleanup=failed 信号');
});
