#!/usr/bin/env node
// PostToolUse hook (matcher: Read): 拦截对 .agents-personal/wiki/(pages|draft)/ 下页面的 Read 调用，
// 在 status.md 聚合表里给对应 key 计数+1、刷新最后引用时间。
// cwd 约定: CLAUDE_PROJECT_DIR || process.cwd()（与 scripts/personal-snapshot.mjs 一致）。
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md § UsageTracking 域
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve as pathResolve, join, dirname } from 'node:path';
import { resolvePersonalDir } from '../scripts/personal-snapshot.mjs';
import { RepoLock } from '../scripts/repo-lock.mjs';

// status.md 首次生成时的骨架（无表格数据行，含说明性 preamble）。
export const DEFAULT_PREAMBLE = `# Wiki Usage Status

> 由 PostToolUse hook 自动维护，记录每个 wiki 页被 Read 的次数与最后引用时间。
> 与 log.md（追加式操作日志）不同——本文件是聚合表，同一 key 只有一行，更新计数而非追加。

| key | 引用次数 | 最后引用时间 |
|---|---|---|`;

const SEPARATOR_RE = /^\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*$/;
const ROW_RE = /^\s*\|(.*)\|(.*)\|(.*)\|\s*$/;

export function todayDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function parseStatusMd(content) {
  const lines = String(content ?? '').split('\n');
  let sepIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SEPARATOR_RE.test(lines[i])) {
      sepIdx = i;
      break;
    }
  }
  if (sepIdx === -1) {
    return { preamble: DEFAULT_PREAMBLE, rows: [] };
  }
  const preamble = lines.slice(0, sepIdx + 1).join('\n');
  const rows = [];
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = ROW_RE.exec(line);
    if (!m) continue;
    const key = m[1].trim();
    const count = parseInt(m[2].trim(), 10);
    const lastReferenced = m[3].trim();
    if (!key || Number.isNaN(count)) continue;
    rows.push({ key, count, lastReferenced });
  }
  return { preamble, rows };
}

export function renderStatusMd({ preamble, rows }) {
  const body = rows.map((r) => `| ${r.key} | ${r.count} | ${r.lastReferenced} |`).join('\n');
  return body ? `${preamble}\n${body}\n` : `${preamble}\n`;
}

// key = 相对 wiki/ 的路径（含 draft/ 或 pages/ 前缀，不带 .md），如 "draft/260701-foo" / "pages/foo"
export function resolveKey(event, projectDir) {
  if (!event || event.tool_name !== 'Read') return null; // 非 Read 调用直接跳过，零开销
  const rawPath = event.tool_input?.file_path;
  if (typeof rawPath !== 'string' || !rawPath.includes('wiki')) return null; // 廉价子串预筛，无 fs 调用
  const personalDir = resolvePersonalDir(projectDir); // 内部 realpathSync，worktree symlink 场景解析回主仓真实路径
  if (!personalDir) return null;
  let filePath;
  try {
    // 相对路径以传入的 projectDir 为基准解析（Round 2 复审 W8 修正：原先用 pathResolve(rawPath)
    // 隐式以 process.cwd() 为基准，hook 子进程的 cwd 不一定等于 CLAUDE_PROJECT_DIR，会解析错目录；
    // rawPath 本身是绝对路径时 path.resolve 的 base 参数不生效，行为不变）。
    filePath = realpathSync(pathResolve(projectDir, rawPath));
  } catch {
    return null; // 文件已不存在 / 权限问题等，跳过不抛出
  }
  const personalWikiPrefix = personalDir.endsWith('/') ? `${personalDir}wiki/` : `${personalDir}/wiki/`;
  if (!filePath.startsWith(personalWikiPrefix)) return null; // 非 wiki 路径跳过
  if (!(filePath.includes('/pages/') || filePath.includes('/draft/'))) return null; // 只关心 pages/draft 下的页面
  return filePath.slice(personalWikiPrefix.length).replace(/\.md$/, '');
}

export function recordUsage(personalDir, key, { repoLock = RepoLock, now = todayDate, timeoutMs = 2000 } = {}) {
  const handle = repoLock.acquire(personalDir, timeoutMs);
  if (!handle) return { status: 'skipped_locked' }; // 拿不到锁就跳过，不阻塞用户的 Read
  try {
    const statusPath = join(personalDir, 'wiki', 'status.md');
    let content;
    try {
      content = readFileSync(statusPath, 'utf8');
    } catch {
      content = `${DEFAULT_PREAMBLE}\n`;
    }
    const parsed = parseStatusMd(content);
    const today = typeof now === 'function' ? now() : now;
    const row = parsed.rows.find((r) => r.key === key);
    if (row) {
      row.count += 1;
      row.lastReferenced = today;
    } else {
      parsed.rows.push({ key, count: 1, lastReferenced: today });
    }
    mkdirSync(dirname(statusPath), { recursive: true });
    writeFileSync(statusPath, renderStatusMd(parsed));
    return { status: 'recorded', key, count: row ? row.count : 1 };
  } finally {
    repoLock.release(handle);
  }
}

function main() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  let key;
  try {
    key = resolveKey(event, projectDir);
  } catch (e) {
    process.stderr.write(`[usage-tracker] WARN: resolveKey failed: ${e.message}\n`);
    process.exit(0);
  }
  if (!key) process.exit(0);

  const personalDir = resolvePersonalDir(projectDir);
  if (!personalDir) process.exit(0); // 理论上 resolveKey 已保证非空，双重防御

  try {
    // timeoutMs 用远小于默认 2000ms 的短超时（Review 复审 W6 修复）：本 hook 挂在每次
    // Read 工具调用的 PostToolUse 上，锁被占用时用默认超时会让用户读一次 wiki 页就被
    // 拖慢到 2 秒——真实可感知的交互延迟。漏记一次引用计数是低代价的（只是统计偏差一点），
    // 远比阻塞用户的 Read 调用代价小，所以短超时后放弃比等满 2 秒更合理。
    recordUsage(personalDir, key, { timeoutMs: 150 });
  } catch (e) {
    process.stderr.write(`[usage-tracker] WARN: recordUsage failed: ${e.message}\n`);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
