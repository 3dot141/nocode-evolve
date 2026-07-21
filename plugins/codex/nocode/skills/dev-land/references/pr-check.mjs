#!/usr/bin/env node
// pr-check.mjs — 单轮查 PR 状态，归一化输出一行；动作（合并/清理/流转）由调用方执行
//
// 由 dev-finish-branch PR 路径的 cron 监控每轮调用（注册与处置见 prflow.md Step 6）。
// 前身是常驻轮询的 pr-watch.mjs——cron 化后动作上移给每轮在场的 agent，本脚本只承担
// 确定性判定：查一次、归一化、打一行、退出。
//
// 用法:
//   node pr-check.mjs --toolchain gh  --pr 123
//   node pr-check.mjs --toolchain bkt --pr 45 --target-project <KEY> --repo-slug <slug>
//
// 输出（唯一 stdout 行，cron 轮 agent 的识别契约）:
//   PR_CHECK state=OPEN|MERGED|CLOSED mergeable=true|false approved=true|false
// 查询失败 → stderr + exit 1（agent 本轮不做任何动作，下轮再查）。
//
// 设计: 纯判定(normalizeGh/normalizeBkt/statusLine)与副作用(queryStatus)分离——纯函数单测。

import { execFileSync } from 'node:child_process';

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

// 识别契约: cron 轮 agent 读这一行分支处置
export function statusLine(s) {
  return `PR_CHECK state=${s.state} mergeable=${s.mergeable} approved=${s.approved}`;
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
    console.log(statusLine(queryStatus(cfg)));
  } catch (e) {
    console.error(`[pr-check] query failed: ${e.message}`);
    process.exit(1);
  }
}
