#!/usr/bin/env node
// pr-watch.mjs — 后台盯 PR 合并状态，合并后清 worktree + 输出流转信号
//
// 由 dev-finish-branch 的 PR 决策线经 `Bash(run_in_background=true)` 起。脚本每
// --interval 秒查一次 PR 状态；合并 → 清 worktree（确定性）+ 输出 PR_WATCH_RESULT
// 信号（脚本退出触发 agent re-invoke，agent 读信号接飞书任务流转）；PR 被关 → 通知 +
// worktree 保留退出。无超时上限，盯到终态（merged/closed）。
//
// 用法:
//   node pr-watch.mjs --toolchain gh  --pr 123 --worktree <path> --main-root <path> \
//        [--interval 300] [--tasks f-xxx,g-yyy]
//   node pr-watch.mjs --toolchain bkt --pr 45  --worktree <path> --main-root <path> \
//        --target-project <KEY> --repo-slug <slug> [--interval 300] [--tasks ...]
//
// 设计: 纯决策逻辑(normalizeGh/normalizeBkt/decide/resultLine)与副作用(queryStatus/
// cleanupWorktree/notify/loop)分离——纯函数单测，副作用经注入的 run/sleep 在集成测试里驱动。

import { execFileSync } from 'node:child_process';

// ═══ 纯决策逻辑（可测，无副作用）═══

// gh pr view <n> --json state,mergeStateStatus,mergeable → 统一 { state, mergeable }
export function normalizeGh(j) {
  return {
    state: j.state, // OPEN | MERGED | CLOSED
    mergeable: j.mergeable === 'MERGEABLE' && j.mergeStateStatus === 'CLEAN',
  };
}

// bkt api .../pull-requests/<id> --json (.state) + .../merge --json (.canMerge)
export function normalizeBkt(pr, merge) {
  const stateMap = { OPEN: 'OPEN', MERGED: 'MERGED', DECLINED: 'CLOSED' };
  return {
    state: stateMap[pr.state] ?? 'OPEN',
    mergeable: merge?.canMerge === true,
  };
}

// 状态机: 当前状态 + 是否已提醒过可合 → 下一步动作
export function decide(status, notifiedMergeable) {
  if (status.state === 'MERGED') return { type: 'cleanup' };
  if (status.state === 'CLOSED') return { type: 'closed' };
  if (status.mergeable && !notifiedMergeable) return { type: 'notify', keep: true };
  return { type: 'continue' };
}

// re-invoke 识别契约: 脚本退出后 agent 读 stdout 这一行，接续流转/收尾
export function resultLine(action, cfg) {
  if (action.type === 'cleanup') return `PR_WATCH_RESULT merged worktree=${cfg.worktree} tasks=${cfg.tasks ?? ''}`;
  if (action.type === 'closed') return `PR_WATCH_RESULT closed worktree=${cfg.worktree}`;
  return '';
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

// ═══ 副作用（注入 run/sleep，便于测试与降级）═══

const defaultRun = (argv) => execFileSync(argv[0], argv.slice(1), { encoding: 'utf8' });
const defaultSleep = (sec) => new Promise((r) => setTimeout(r, sec * 1000));

export function queryStatus(cfg, run) {
  if (cfg.toolchain === 'gh') {
    const out = run(['gh', 'pr', 'view', String(cfg.pr), '--json', 'state,mergeStateStatus,mergeable']);
    return normalizeGh(JSON.parse(out));
  }
  // bkt: cross-fork 别用 `bkt pr view`(author/reviewers 解析不可靠)，走 raw GET
  const base = `/rest/api/1.0/projects/${cfg.targetProject}/repos/${cfg.repoSlug}/pull-requests/${cfg.pr}`;
  const pr = JSON.parse(run(['bkt', 'api', base, '--json']));
  let merge = null;
  try { merge = JSON.parse(run(['bkt', 'api', `${base}/merge`, '--json'])); }
  catch { /* /merge 查不到 → 当不可合，继续盯 */ }
  return normalizeBkt(pr, merge);
}

export function cleanupWorktree(cfg, run) {
  // 先 cd 主仓根（-C），在 worktree 内跑 remove 会静默失败
  run(['git', '-C', cfg.mainRoot, 'worktree', 'remove', cfg.worktree]);
  run(['git', '-C', cfg.mainRoot, 'worktree', 'prune']);
}

export function notify(title, msg, platform = process.platform, run = defaultRun) {
  if (platform === 'darwin') {
    run(['osascript', '-e', `display notification "${msg}" with title "${title}"`]);
  } else {
    // 非 macOS 降级: 打到 stdout，不阻塞（Out of Scope: 不做 PushNotification）
    console.log(`[pr-watch] ${title}: ${msg}`);
  }
}

// ═══ 主循环 ═══

export async function loop(cfg, deps = {}) {
  const { run = defaultRun, sleep = defaultSleep, out = console.log } = deps;
  let notified = false;
  for (;;) {
    let status;
    try {
      status = queryStatus(cfg, run);
    } catch (e) {
      out(`[pr-watch] query failed: ${e.message}`); // 网络抖动/鉴权临时失败不退出，继续盯
      await sleep(cfg.interval);
      continue;
    }

    const action = decide(status, notified);
    if (action.type === 'cleanup') {
      cleanupWorktree(cfg, run);
      notify('PR 已合并', 'worktree 已清理，可流转任务', process.platform, run);
      out(resultLine(action, cfg));
      return 'merged';
    }
    if (action.type === 'closed') {
      notify('PR 已关闭', '未合并，worktree 保留', process.platform, run);
      out(resultLine(action, cfg));
      return 'closed';
    }
    if (action.type === 'notify') {
      notify('PR 可以合并了', `#${cfg.pr} 满足合并条件`, process.platform, run);
      notified = true;
    }
    await sleep(cfg.interval);
  }
}

// ═══ CLI 入口（仅直接执行时跑；import 测试不触发）═══

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  const cfg = {
    toolchain: a.toolchain,
    pr: a.pr,
    worktree: a.worktree,
    mainRoot: a['main-root'],
    interval: Number(a.interval) || 300,
    tasks: a.tasks,
    targetProject: a['target-project'],
    repoSlug: a['repo-slug'],
  };
  loop(cfg)
    .then(() => process.exit(0))
    .catch((e) => { console.error(`[pr-watch] fatal: ${e.message}`); process.exit(1); });
}
