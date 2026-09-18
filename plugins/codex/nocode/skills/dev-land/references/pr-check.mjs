#!/usr/bin/env node
// pr-check.mjs — 查 PR 状态；默认单轮，--watch 时按固定间隔查到可处置状态
//
// 定时能力来自 periodic-runner.mjs；本脚本只定义 PR 的查询、归一化与停止条件，
// 合并/清理/流转仍由调用方执行。
//
// 用法:
//   node pr-check.mjs --toolchain gh  --pr 123
//   node pr-check.mjs --toolchain bkt --pr 45 --target-project <KEY> --repo-slug <slug>
//   node pr-check.mjs --watch --interval-seconds 120 --toolchain gh --pr 123
//
// 状态变化时输出（首轮总是输出；相同状态不重复打印——增量唤醒的宿主会因为每轮都打而持续被叫醒）:
//   PR_CHECK state=OPEN|MERGED|CLOSED mergeable=true|false approved=true|false
// watch 期间评论指纹增长时输出（不停止监控，交调用方即时处置）:
//   PR_COMMENTS total=<n> delta=<k>
// watch 命中可处置状态后再输出并退出:
//   PR_WATCH reason=READY|MERGED|CLOSED runs=<N> comments=<n> growth=<k>
//   growth>0 表示本轮监控期内出现过评论事件——合并前必须先处置（prflow Step 6 合并闸门）。
//   评论增长不再是停止条件：watch 只在 READY / MERGED / CLOSED / 连续失败时结束
//   （P1/P2 评审评论需要人处置，不能等 READY/MERGED 才被发现——实测 PR 挂着两条评审意见 40 分钟无人感知）。
// 单轮查询失败 → stderr + exit 1；watch 连续失败达到 --max-errors（默认 3）→ exit 1。
//
// 设计: 纯判定(normalizeGh/normalizeBkt/statusLine)与副作用(queryStatus)分离——纯函数单测。

import { execFileSync } from 'node:child_process';
import { runPeriodically } from './periodic-runner.mjs';

// ═══ 纯判定逻辑（可测，无副作用）═══

// gh pr view <n> --json state,mergeStateStatus,mergeable,reviewDecision,comments,reviews
// → 统一三元组 + 评论指纹（comments+reviews 合计；只用于 watch 基线对比，不是精确评论数）
export function normalizeGh(j) {
  return {
    state: j.state, // OPEN | MERGED | CLOSED
    mergeable: j.mergeable === 'MERGEABLE' && j.mergeStateStatus === 'CLEAN',
    // reviewDecision: APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED / ''(无 review)
    // 只认 APPROVED——防"仓库没配 required review 时 PR 一建就被自动合掉"
    approved: j.reviewDecision === 'APPROVED',
    commentCount: (j.comments?.length ?? 0) + (j.reviews?.length ?? 0),
  };
}

// bkt api .../pull-requests/<id> (.state/.reviewers) + /merge (.canMerge) + /activities
export function normalizeBkt(pr, merge, commentCount = 0) {
  const stateMap = { OPEN: 'OPEN', MERGED: 'MERGED', DECLINED: 'CLOSED' };
  return {
    state: stateMap[pr.state] ?? 'OPEN',
    mergeable: merge?.canMerge === true,
    approved: Array.isArray(pr.reviewers) && pr.reviewers.some((r) => r.approved === true),
    commentCount,
  };
}

// 识别契约: 调用方读取这一行分支处置
export function statusLine(s) {
  return `PR_CHECK state=${s.state} mergeable=${s.mergeable} approved=${s.approved}`;
}

// 状态去重门：首轮放行，之后只在三元组变化时放行（返回 null = 不打印）。
// 增量唤醒的宿主每行输出都会叫醒 agent，逐轮重复同一状态纯属噪音。
export const createStatusGate = () => {
  let last = null;
  return (status) => {
    const line = statusLine(status);
    if (line === last) return null;
    last = line;
    return line;
  };
};

export function stopReason(s) {
  if (s.state === 'MERGED') return 'MERGED';
  if (s.state === 'CLOSED') return 'CLOSED';
  if (s.state === 'OPEN' && s.mergeable && s.approved) return 'READY';
  return null;
}

// --key value / --flag 解析（照 worktree-setup.mjs 风格）
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; }
    else args[key] = true;
  }
  return args;
}

// ═══ 副作用（注入 run，便于测试）═══

const defaultRun = (argv) => execFileSync(argv[0], argv.slice(1), { encoding: 'utf8' });

export function queryStatus(cfg, run = defaultRun) {
  if (cfg.toolchain === 'gh') {
    const out = run(['gh', 'pr', 'view', String(cfg.pr), '--json', 'state,mergeStateStatus,mergeable,reviewDecision,comments,reviews']);
    return normalizeGh(JSON.parse(out));
  }
  // bkt: cross-fork 别用 `bkt pr view`(author/reviewers 解析不可靠)，走 raw GET
  const base = `/rest/api/1.0/projects/${cfg.targetProject}/repos/${cfg.repoSlug}/pull-requests/${cfg.pr}`;
  const pr = JSON.parse(run(['bkt', 'api', base, '--json']));
  // 评论指纹：activities 里 COMMENTED/REPLIED 条数。查询失败不影响状态判定（指纹记 0）。
  let commentCount = 0;
  try {
    const activities = JSON.parse(run(['bkt', 'api', `${base}/activities?limit=100`, '--json']));
    commentCount = (activities?.values ?? []).filter((v) => v.action === 'COMMENTED' || v.action === 'REPLIED').length;
  } catch { /* activities 查不到 → 指纹记 0，下轮再比 */ }
  // state 已终态(MERGED/DECLINED)无需查 /merge — 省一次请求 + 避免 merged 后 /merge 报错噪音
  if (pr.state === 'MERGED' || pr.state === 'DECLINED') return normalizeBkt(pr, null, commentCount);
  let merge = null;
  try { merge = JSON.parse(run(['bkt', 'api', `${base}/merge`, '--json'])); }
  catch { /* /merge 查不到 → 当不可合，下轮再查 */ }
  return normalizeBkt(pr, merge, commentCount);
}

export async function watchStatus(cfg, options = {}) {
  const {
    intervalMs = 120_000,
    maxRuns = Infinity,
    maxErrors = 3,
    run = defaultRun,
    sleep,
    onStatus = () => {},
    onComments = () => {},
    onError = () => {},
  } = options;

  if (maxErrors !== Infinity && (!Number.isInteger(maxErrors) || maxErrors < 1)) {
    throw new RangeError('maxErrors must be a positive integer or Infinity');
  }

  let consecutiveErrors = 0;
  // 评论基线从首轮快照起（PR 建立时 autotest/机器人首评已存在，从 0 起会立即误触发）
  let commentBaseline = null;
  let commentTotal = null;
  let commentEvents = 0;
  const periodicOptions = {
    intervalMs,
    maxRuns,
    sleep,
    task: () => {
      try {
        const status = queryStatus(cfg, run);
        consecutiveErrors = 0;
        commentTotal = status.commentCount;
        const delta = commentBaseline === null ? 0 : status.commentCount - commentBaseline;
        if (commentBaseline === null || delta > 0) commentBaseline = status.commentCount;
        if (delta > 0) {
          commentEvents += 1;
          onComments({ total: status.commentCount, delta });
        }
        return { status };
      } catch (error) {
        consecutiveErrors += 1;
        onError(error, { consecutiveErrors });
        if (consecutiveErrors >= maxErrors) throw error;
        return { status: null };
      }
    },
    onResult: ({ status }) => {
      if (status) onStatus(status);
    },
    // 评论增长只发事件、不停止监控：处置与轮询并行，退出行 growth 供合并闸门判定
    shouldStop: ({ status }) => status !== null && stopReason(status) !== null,
  };

  const result = await runPeriodically(periodicOptions);
  const status = result.value?.status ?? null;
  return {
    ...result,
    status,
    stopReason: status ? stopReason(status) : null,
    commentTotal,
    commentEvents,
  };
}

const parsePositiveInteger = (value, name, fallback) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return parsed;
};

// ═══ CLI 入口（仅直接执行时跑；import 测试不触发）═══

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  const required = ['toolchain', 'pr'];
  if (a.toolchain === 'bkt') required.push('target-project', 'repo-slug');
  const missing = required.filter((k) => a[k] === undefined || a[k] === true);
  if (missing.length) {
    console.error(`[pr-check] 缺必填参数: ${missing.map((k) => '--' + k).join(', ')}`);
    process.exit(2);
  }
  const cfg = {
    toolchain: a.toolchain,
    pr: a.pr,
    targetProject: a['target-project'],
    repoSlug: a['repo-slug'],
  };
  try {
    if (!a.watch) {
      console.log(statusLine(queryStatus(cfg)));
    } else {
      const intervalSeconds = parsePositiveInteger(a['interval-seconds'], '--interval-seconds', 120);
      const maxRuns = parsePositiveInteger(a['max-runs'], '--max-runs', Infinity);
      const maxErrors = parsePositiveInteger(a['max-errors'], '--max-errors', 3);
      const gate = createStatusGate();
      const result = await watchStatus(cfg, {
        intervalMs: intervalSeconds * 1000,
        maxRuns,
        maxErrors,
        onStatus: (status) => {
          const line = gate(status);
          if (line) console.log(line);
        },
        onComments: ({ total, delta }) => console.log(`PR_COMMENTS total=${total} delta=${delta}`),
        onError: (error, meta) => {
          console.error(`[pr-check] query failed (${meta.consecutiveErrors}/${maxErrors}): ${error.message}`);
        },
      });
      if (result.reason === 'max-runs') {
        console.error(
          `[pr-check] watch stopped after ${result.runs} runs without actionable state`
          + ` (comments=${result.commentTotal ?? 0} growth=${result.commentEvents})`,
        );
        process.exitCode = 3;
      } else {
        console.log(
          `PR_WATCH reason=${result.stopReason} runs=${result.runs}`
          + ` comments=${result.commentTotal ?? 0} growth=${result.commentEvents}`,
        );
      }
    }
  } catch (e) {
    console.error(`[pr-check] query failed: ${e.message}`);
    process.exit(1);
  }
}
