#!/usr/bin/env node
// 检查当前分支与 base 分支 (upstream / origin/HEAD) 的 freshness, 输出 JSON + exit code.
// 用法: node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" [--max-behind=5] [--ttl=7200]
//   --max-behind: behind 阈值 >= 此值 gate (默认 5)
//   --ttl:       cache TTL 秒数 (默认 7200 = 2h)
// 输出 stdout JSON: { branch, base, behind, ahead, age_seconds, cache_hit, cold_start, gate, message }
// exit 0 = ok / exit 2 = gate (agent 应停手 + 三选). 离线 / fetch 失败: WARN + ok (不阻塞), 但冷启动除外 (见下).
// cache 文件: git rev-parse --git-path nocode-freshness.json (worktree 独立, .git/ 内不会被 commit).
//
// 冷启动拦截: 当前 branch+base 在 cache 里【从来没有过记录】(机器首次 / 该分支首次 / 升级后旧格式作废) →
//   coldStart=true, 无条件 gate 一次 (不论 fetch 成功与否、behind 多少), 让用户首次显式确认基线.
//   fetch 成功后写入该 branch+base 的 entry, 下次同组合即转常规 (只 behind >= MAX_BEHIND 才 gate).
//   离线冷启动 (无 entry + fetch 失败) 不写 entry, 仍反复拦, 直到联网成功建立基线.
//
// base 推断优先级:
//   1) git config branch.<branch>.nocode-base             (worktree 创建时写入, 不随 push -u 漂移)
//   2) git rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}  (当前分支 upstream)
//      → eg. "origin/release/x" 或 "origin/main"
//   3) git rev-parse --abbrev-ref origin/HEAD                    (远端 default branch)
//      → eg. "origin/main"
//   4) 兜底 "origin/main"
//
// cache 结构 (v2): { entries: { "<branch>\0<base>": { last_fetch_ms, behind, ahead } } }
//   旧 v1 格式 (顶层 branch/base) 读到即作废 → 视为无记录, 触发一次冷启动后写入新格式.
//
// 设计: rules/rule-git-freshness.md, docs/dev/3dot141/260603-02-strategic-review-v3.4.0/strategic-review-v3.4.0.md (Batch 1 follow-up)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const MAX_BEHIND = parseInt(argFlag('--max-behind') || '5', 10);
const TTL_SECONDS = parseInt(argFlag('--ttl') || '7200', 10);

function argFlag(name) {
  const a = process.argv.find((x) => x.startsWith(name + '='));
  return a ? a.split('=', 2)[1] : null;
}

function git(cmd, allowFail = false) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    if (allowFail) return '';
    throw e;
  }
}

function pickBase(branch) {
  const configured = git(`config branch.${branch}.nocode-base`, true);
  if (configured) return configured;
  const upstream = git('rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}', true);
  if (upstream) return upstream;
  const head = git('rev-parse --abbrev-ref origin/HEAD', true);
  if (head) return head;
  return 'origin/main';
}

function cachePath() {
  return git('rev-parse --git-path nocode-freshness.json', true) || '.git/nocode-freshness.json';
}

function cacheKey(branch, base) {
  return `${branch}\0${base}`;
}

// 返回 { entries: {...} }. 旧 v1 格式 (无 entries) 或损坏 → 空 entries (触发冷启动).
function readCache(cp) {
  try {
    const raw = JSON.parse(fs.readFileSync(cp, 'utf8'));
    if (raw && raw.entries && typeof raw.entries === 'object') return raw;
  } catch { /* ignore */ }
  return { entries: {} };
}

function writeCache(cp, store) {
  try { fs.writeFileSync(cp, JSON.stringify(store, null, 2) + '\n'); } catch { /* ignore */ }
}

const branch = git('rev-parse --abbrev-ref HEAD', true) || 'HEAD';
const base = pickBase(branch);
const cp = cachePath();
const now = Date.now();
const store = readCache(cp);
const key = cacheKey(branch, base);
const entry = store.entries[key] || null;
const everChecked = !!entry; // 该 branch+base 是否曾建立过基线 (含过期); false = 冷启动

let cacheHit = false;
let ageSeconds = TTL_SECONDS + 1;
let behind = 0;
let ahead = 0;

if (entry) {
  ageSeconds = Math.max(0, Math.floor((now - entry.last_fetch_ms) / 1000));
  if (ageSeconds < TTL_SECONDS) {
    cacheHit = true;
    behind = entry.behind;
    ahead = entry.ahead;
  }
}

let fetchWarn = '';
if (!cacheHit) {
  const remoteBranch = base.startsWith('origin/') ? base.slice(7) : base;
  let fetched = true;
  try {
    git(`fetch origin ${remoteBranch} --quiet`);
  } catch (e) {
    fetched = false;
    fetchWarn = `fetch 失败 (${(e.message || '').split('\n')[0].slice(0, 120)}); freshness 视为 unknown`;
    process.stderr.write(`[freshness-check] WARN: ${fetchWarn}\n`);
  }

  if (fetched) {
    behind = parseInt(git(`rev-list --count HEAD..${base}`, true) || '0', 10);
    ahead = parseInt(git(`rev-list --count ${base}..HEAD`, true) || '0', 10);
    ageSeconds = 0;
    store.entries[key] = { last_fetch_ms: now, behind, ahead };
    writeCache(cp, store);
  } else if (entry) {
    // 离线: 用旧 entry (即使过期), 不阻塞
    behind = entry.behind;
    ahead = entry.ahead;
    ageSeconds = Math.max(0, Math.floor((now - entry.last_fetch_ms) / 1000));
  }
  // 否则 (无 entry + fetch 失败): behind=0, ahead=0; coldStart 仍会 gate (见下)
}

const coldStart = !everChecked;
const gate = coldStart || behind >= MAX_BEHIND ? 'gate' : 'ok';

const choices = '三选: a) pull --rebase 后继续 (推荐, 防过时方案; ahead>0 可能冲突) b) 接受当前状态继续 (你签 off 落后可能影响判断) c) 跳过 (取消本次动作)';
let reason;
if (coldStart) {
  reason = fetchWarn
    ? `${branch} 对 ${base} 首次检查 (无 cache 基线) 且 fetch 失败, freshness 未知`
    : `${branch} 首次检查 (无 cache 基线), behind ${base} ${behind} commits, ahead=${ahead}`;
} else {
  reason = `${branch} behind ${base} ${behind} commits (>= ${MAX_BEHIND}, ahead=${ahead})`;
}
const message = gate === 'gate'
  ? `${reason}. ${choices}`
  : `freshness ok (behind=${behind}, ahead=${ahead}, age=${ageSeconds}s, cache=${cacheHit ? 'hit' : 'miss'}${fetchWarn ? `, ${fetchWarn}` : ''})`;

console.log(JSON.stringify({ branch, base, behind, ahead, age_seconds: ageSeconds, cache_hit: cacheHit, cold_start: coldStart, gate, message }, null, 2));
process.exit(gate === 'gate' ? 2 : 0);
