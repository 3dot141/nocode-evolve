#!/usr/bin/env node
// pr-check.mjs — 查 PR 状态；默认单轮，--watch 时按固定间隔查到可处置状态
//
// 定时能力来自 periodic-runner.mjs；本脚本只定义 PR 的查询、归一化与停止条件，
// 合并/清理/流转仍由调用方执行。
//
// 用法:
//   node pr-check.mjs --toolchain gh  --pr 123
//   node pr-check.mjs --toolchain bkt --pr 45 --target-project <KEY> --repo-slug <slug>
//   node pr-check.mjs --watch --interval-seconds 300 --toolchain gh --pr 123
//
// 每次成功查询输出:
//   PR_CHECK state=OPEN|MERGED|CLOSED mergeable=true|false approved=true|false
// watch 命中可处置状态后再输出:
//   PR_WATCH reason=READY|MERGED|CLOSED runs=<N>
// 单轮查询失败 → stderr + exit 1；watch 连续失败达到 --max-errors（默认 3）→ exit 1。
//
// 设计: 纯判定(normalizeGh/normalizeBkt/statusLine)与副作用(queryStatus)分离——纯函数单测。

import { execFileSync } from 'node:child_process';
import { runPeriodically } from './periodic-runner.mjs';

// ═══ 纯判定逻辑（可测，无副作用）═══

// gh pr view <n> --json state,mergeStateStatus,mergeable,reviewDecision → 统一三元组
export function normalizeGh(j) {
  return {
    state: j.state, // OPEN | MERGED | CLOSED
    mergeable: j.mergeable === 'MERGEABLE' && j.mergeStateStatus === 'CLEAN',
    // reviewDecision: APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED / ''(无 review)
    // 只认 APPROVED——防"仓库没配 required review 时 PR 一建就被自动合掉"
    approved: j.reviewDecision === 'APPROVED',
  };
}

// bkt api .../pull-requests/<id> (.state/.reviewers) + /merge (.canMerge)
export function normalizeBkt(pr, merge) {
  const stateMap = { OPEN: 'OPEN', MERGED: 'MERGED', DECLINED: 'CLOSED' };
  return {
    state: stateMap[pr.state] ?? 'OPEN',
    mergeable: merge?.canMerge === true,
    approved: Array.isArray(pr.reviewers) && pr.reviewers.some((r) => r.approved === true),
  };
}

// 识别契约: 调用方读取这一行分支处置
export function statusLine(s) {
  return `PR_CHECK state=${s.state} mergeable=${s.mergeable} approved=${s.approved}`;
}

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
    const out = run(['gh', 'pr', 'view', String(cfg.pr), '--json', 'state,mergeStateStatus,mergeable,reviewDecision']);
    return normalizeGh(JSON.parse(out));
  }
  // bkt: cross-fork 别用 `bkt pr view`(author/reviewers 解析不可靠)，走 raw GET
  const base = `/rest/api/1.0/projects/${cfg.targetProject}/repos/${cfg.repoSlug}/pull-requests/${cfg.pr}`;
  const pr = JSON.parse(run(['bkt', 'api', base, '--json']));
  // state 已终态(MERGED/DECLINED)无需查 /merge — 省一次请求 + 避免 merged 后 /merge 报错噪音
  if (pr.state === 'MERGED' || pr.state === 'DECLINED') return normalizeBkt(pr, null);
  let merge = null;
  try { merge = JSON.parse(run(['bkt', 'api', `${base}/merge`, '--json'])); }
  catch { /* /merge 查不到 → 当不可合，下轮再查 */ }
  return normalizeBkt(pr, merge);
}

export async function watchStatus(cfg, options = {}) {
  const {
    intervalMs = 300_000,
    maxRuns = Infinity,
    maxErrors = 3,
    run = defaultRun,
    sleep,
    onStatus = () => {},
    onError = () => {},
  } = options;

  if (maxErrors !== Infinity && (!Number.isInteger(maxErrors) || maxErrors < 1)) {
    throw new RangeError('maxErrors must be a positive integer or Infinity');
  }

  let consecutiveErrors = 0;
  const periodicOptions = {
    intervalMs,
    maxRuns,
    sleep,
    task: () => {
      try {
        const status = queryStatus(cfg, run);
        consecutiveErrors = 0;
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
    shouldStop: ({ status }) => status !== null && stopReason(status) !== null,
  };

  const result = await runPeriodically(periodicOptions);
  const status = result.value?.status ?? null;
  return { ...result, status, stopReason: status ? stopReason(status) : null };
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
      const intervalSeconds = parsePositiveInteger(a['interval-seconds'], '--interval-seconds', 300);
      const maxRuns = parsePositiveInteger(a['max-runs'], '--max-runs', Infinity);
      const maxErrors = parsePositiveInteger(a['max-errors'], '--max-errors', 3);
      const result = await watchStatus(cfg, {
        intervalMs: intervalSeconds * 1000,
        maxRuns,
        maxErrors,
        onStatus: (status) => console.log(statusLine(status)),
        onError: (error, meta) => {
          console.error(`[pr-check] query failed (${meta.consecutiveErrors}/${maxErrors}): ${error.message}`);
        },
      });
      if (result.reason === 'max-runs') {
        console.error(`[pr-check] watch stopped after ${result.runs} runs without actionable state`);
        process.exitCode = 3;
      } else {
        console.log(`PR_WATCH reason=${result.stopReason} runs=${result.runs}`);
      }
    }
  } catch (e) {
    console.error(`[pr-check] query failed: ${e.message}`);
    process.exit(1);
  }
}
