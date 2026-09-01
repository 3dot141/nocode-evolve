#!/usr/bin/env node
// 检查当前分支与 base 分支 (upstream / origin/HEAD) 的 freshness, 输出 JSON + exit code.
// 用法: node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" [--max-behind=5] [--ttl=7200] [--session=<id>]
//   --max-behind: behind 阈值 >= 此值 gate (默认 5)
//   --ttl:       缓存 TTL 秒数 (默认 7200 = 2h), 同时管两件事:
//                a) fetch 缓存 —— 距上次 fetch 超窗才重新 fetch (省网络);
//                b) 会话跳过 —— 同会话检查过一次 (无论 ok / gate), 窗口内后续调用直接跳过不执行.
//   --session:   会话 ID (缺省读 NOCODE_SESSION_ID env). 会话 = 一次完整的上下文生命周期
//                (同一 claude 实例的全部轮次, 含 compact 压缩延续; /clear、新窗口、重启 = 新会话).
//                会话级跳过只在 session 匹配时生效, 跨会话不共享 (各自完整检查一次).
// 输出 stdout JSON: { branch, base, behind, ahead, age_seconds, cache_hit, cold_start, gate, session_skipped, message }
// exit 0 = ok / exit 2 = gate (agent 应停手 + 三选). 离线 / fetch 失败: WARN + ok (不阻塞), 但冷启动除外 (见下).
// cache 文件: git rev-parse --git-path nocode-freshness.json (worktree 独立, .git/ 内不会被 commit).
//
// behind / ahead 每次**实时**本地 rev-list 计算, 不落缓存 —— fetch 缓存只表示"远端 ref 何时同步过",
// 分支被 pull/push 追平后 behind 立即归零, 不会把陈旧落后量冻结到 TTL 过期 (旧版病灶).
//
// 冷启动拦截: 当前 branch+base 在 cache 里【从来没有过记录】(机器首次 / 该分支首次 / 旧格式作废) →
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
// cache 结构 (v3): { v: 3, entries: { "<branch>\0<base>": { last_fetch_ms, last_check_ms, last_check_session } } }
//   v2 及更旧 (含 behind/ahead 冻结字段) 读到即作废 → 视为无记录, 触发一次冷启动后写入新格式.
//   last_fetch_ms:          上次成功 fetch 时刻 (fetch 缓存窗).
//   last_check_ms/_session: 上次完整检查的时刻与会话 (会话跳过窗; gate 也算检查过 —— 用户即将三选,
//                           同会话后续不再打扰; 跨会话不共享, 新会话各自完整检查).
//
// 设计: rules/rule-git-freshness.md, docs/dev/3dot141/260603-02-strategic-review-v3.4.0/strategic-review-v3.4.0.md (Batch 1 follow-up)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const MAX_BEHIND = parseInt(argFlag('--max-behind') || '5', 10);
const TTL_SECONDS = parseInt(argFlag('--ttl') || '7200', 10);
const SESSION_ID = argFlag('--session') || process.env.NOCODE_SESSION_ID || '';

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

// 返回 { v: 3, entries: {...} }. 非 v3 (旧 v2 含冻结 behind / v1 顶层字段) 或损坏 → 空 entries (触发冷启动).
function readCache(cp) {
  try {
    const raw = JSON.parse(fs.readFileSync(cp, 'utf8'));
    if (raw && raw.v === 3 && raw.entries && typeof raw.entries === 'object') return raw;
  } catch { /* ignore */ }
  return { v: 3, entries: {} };
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

// ── 会话跳过: 同会话窗口内检查过一次 (ok / gate 均算) → 本次不再执行 ──
// 无 SESSION_ID 时无法识别"同会话", 跳过不生效 (每次完整执行; behind 实时化后成本低).
if (
  entry && SESSION_ID &&
  entry.last_check_session === SESSION_ID &&
  (now - entry.last_check_ms) < TTL_SECONDS * 1000
) {
  const age = Math.max(0, Math.floor((now - entry.last_check_ms) / 1000));
  console.log(JSON.stringify({
    branch, base, behind: 0, ahead: 0, age_seconds: age, cache_hit: true, cold_start: false,
    gate: 'ok', session_skipped: true,
    message: `freshness ok (session skip: 本会话 ${TTL_SECONDS}s 窗口内已检查过, 距上次 ${age}s, 跳过执行)`,
  }, null, 2));
  process.exit(0);
}

// ── fetch 缓存: 距上次 fetch 超窗才重新同步远端 ref ──
let cacheHit = false;
let ageSeconds = entry ? Math.max(0, Math.floor((now - entry.last_fetch_ms) / 1000)) : TTL_SECONDS + 1;
let fetchWarn = '';
let fetched = true;

if (entry && ageSeconds < TTL_SECONDS) {
  cacheHit = true;
} else {
  const remoteBranch = base.startsWith('origin/') ? base.slice(7) : base;
  try {
    git(`fetch origin ${remoteBranch} --quiet`);
  } catch (e) {
    fetched = false;
    fetchWarn = `fetch 失败 (${(e.message || '').split('\n')[0].slice(0, 120)}); freshness 视为 unknown`;
    process.stderr.write(`[freshness-check] WARN: ${fetchWarn}\n`);
  }
  if (fetched) {
    ageSeconds = 0;
    store.entries[key] = { ...(entry || {}), last_fetch_ms: now };
  } else if (entry) {
    ageSeconds = Math.max(0, Math.floor((now - entry.last_fetch_ms) / 1000)); // 离线: 沿用旧 fetch 时刻
  }
}

// ── behind / ahead 实时本地计算 (毫秒级, 不吃网络); 分支追平后立即归零, 无冻结值 ──
const behind = parseInt(git(`rev-list --count HEAD..${base}`, true) || '0', 10);
const ahead = parseInt(git(`rev-list --count ${base}..HEAD`, true) || '0', 10);

const coldStart = !everChecked;
const gate = coldStart || behind >= MAX_BEHIND ? 'gate' : 'ok';

// 写回本次检查记录 (gate 也写: 用户即将三选, 同会话后续跳过).
// 离线冷启动 (fetch 失败 + 无 entry) 不写 → 维持「联网建立基线前每次拦」.
if (entry || fetched) {
  store.entries[key] = {
    ...(store.entries[key] || {}),
    last_check_ms: now,
    last_check_session: SESSION_ID,
  };
  writeCache(cp, store);
}

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
  : `freshness ok (behind=${behind}, ahead=${ahead}, fetch_age=${ageSeconds}s, cache=${cacheHit ? 'hit' : 'miss'}${fetchWarn ? `, ${fetchWarn}` : ''})`;

console.log(JSON.stringify({ branch, base, behind, ahead, age_seconds: ageSeconds, cache_hit: cacheHit, cold_start: coldStart, gate, session_skipped: false, message }, null, 2));
process.exit(gate === 'gate' ? 2 : 0);
