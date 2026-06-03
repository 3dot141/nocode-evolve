#!/usr/bin/env node
// 检查当前分支与 base 分支 (upstream / origin/HEAD) 的 freshness, 输出 JSON + exit code.
// 用法: node scripts/freshness-check.mjs [--max-behind=5] [--ttl=7200]
//   --max-behind: behind 阈值 >= 此值 gate (默认 5)
//   --ttl:       cache TTL 秒数 (默认 7200 = 2h)
// 输出 stdout JSON: { branch, base, behind, ahead, age_seconds, cache_hit, gate, message }
// exit 0 = ok / exit 2 = gate (agent 应停手 + 三选). 离线 / fetch 失败: WARN + ok (不阻塞).
// cache 文件: git rev-parse --git-path nocode-evolve-freshness.json (worktree 独立, .git/ 内不会被 commit).
//
// base 推断优先级:
//   1) git rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}  (当前分支 upstream)
//      → eg. "origin/release/x" 或 "origin/main"
//   2) git rev-parse --abbrev-ref origin/HEAD                    (远端 default branch)
//      → eg. "origin/main"
//   3) 兜底 "origin/main"
//
// 设计: rules/rule-git-freshness.md, docs/superpowers/specs/3dot141/260603-strategic-review-v3.4.0.md (Batch 1 follow-up)
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

function pickBase() {
  const upstream = git('rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}', true);
  if (upstream) return upstream;
  const head = git('rev-parse --abbrev-ref origin/HEAD', true);
  if (head) return head;
  return 'origin/main';
}

function cachePath() {
  return git('rev-parse --git-path nocode-evolve-freshness.json', true) || '.git/nocode-evolve-freshness.json';
}

function readCache(cp) {
  try { return JSON.parse(fs.readFileSync(cp, 'utf8')); } catch { return null; }
}

function writeCache(cp, data) {
  try { fs.writeFileSync(cp, JSON.stringify(data, null, 2) + '\n'); } catch { /* ignore */ }
}

const branch = git('rev-parse --abbrev-ref HEAD', true) || 'HEAD';
const base = pickBase();
const cp = cachePath();
const now = Date.now();
const cache = readCache(cp);

let cacheHit = false;
let ageSeconds = TTL_SECONDS + 1;
let behind = 0;
let ahead = 0;

if (cache && cache.branch === branch && cache.base === base) {
  ageSeconds = Math.max(0, Math.floor((now - cache.last_fetch_ms) / 1000));
  if (ageSeconds < TTL_SECONDS) {
    cacheHit = true;
    behind = cache.behind;
    ahead = cache.ahead;
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
    writeCache(cp, { last_fetch_ms: now, branch, base, behind, ahead });
  } else if (cache) {
    // 离线: 用旧 cache (即使过期), 不阻塞
    behind = cache.behind;
    ahead = cache.ahead;
    ageSeconds = Math.max(0, Math.floor((now - cache.last_fetch_ms) / 1000));
  }
  // 否则 (无 cache + fetch 失败): behind=0, ahead=0, gate=ok (freshness unknown, 不阻塞)
}

const gate = behind >= MAX_BEHIND ? 'gate' : 'ok';
const message = gate === 'gate'
  ? `${branch} behind ${base} ${behind} commits (>= ${MAX_BEHIND}, ahead=${ahead}). 三选: a) pull --rebase 后继续 (推荐, 防过时方案; ahead>0 可能冲突) b) 接受当前状态继续 (你签 off 落后可能影响判断) c) 跳过 (取消本次动作)`
  : `freshness ok (behind=${behind}, ahead=${ahead}, age=${ageSeconds}s, cache=${cacheHit ? 'hit' : 'miss'}${fetchWarn ? `, ${fetchWarn}` : ''})`;

console.log(JSON.stringify({ branch, base, behind, ahead, age_seconds: ageSeconds, cache_hit: cacheHit, gate, message }, null, 2));
process.exit(gate === 'gate' ? 2 : 0);
