#!/usr/bin/env node
import {
  closeSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolvePersonalDir } from './personal-snapshot.mjs';
import { RepoLock } from './repo-lock.mjs';

export const DEFAULT_PREAMBLE = `# Wiki Usage Status

> 由 personal-knowledge.page.read 显式维护，记录每个 wiki 页被业务流程引用的次数与最后引用时间。
> 直接文件读取不会计数；本文件是聚合表，同一 key 只有一行。

| key | 引用次数 | 最后引用时间 |
|---|---|---|`;

const SEPARATOR_RE = /^\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*$/;
const ROW_RE = /^\s*\|(.*)\|(.*)\|(.*)\|\s*$/;

export class WikiReadError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'WikiReadError';
    this.code = code;
  }
}

export function todayDate() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function parseStatusMd(content) {
  const lines = String(content ?? '').split('\n');
  const separator = lines.findIndex((line) => SEPARATOR_RE.test(line));
  if (separator < 0) return { preamble: DEFAULT_PREAMBLE, rows: [] };
  const rows = [];
  for (const line of lines.slice(separator + 1)) {
    if (!line.trim()) continue;
    const match = ROW_RE.exec(line);
    if (!match) continue;
    const key = match[1].trim();
    const count = Number.parseInt(match[2].trim(), 10);
    const lastReferenced = match[3].trim();
    if (key && Number.isInteger(count)) rows.push({ key, count, lastReferenced });
  }
  return { preamble: lines.slice(0, separator + 1).join('\n'), rows };
}

export function renderStatusMd({ preamble, rows }) {
  const body = rows.map(({ key, count, lastReferenced }) => `| ${key} | ${count} | ${lastReferenced} |`).join('\n');
  return `${preamble}\n${body}${body ? '\n' : ''}`;
}

const defaultAtomicOps = {
  open: openSync,
  write: (fd, content) => writeFileSync(fd, content, 'utf8'),
  fsync: fsyncSync,
  close: closeSync,
  rename: renameSync,
  unlink: unlinkSync,
};

export function writeStatusAtomic(statusPath, content, {
  ops = defaultAtomicOps, tempSuffix = `.${process.pid}.${randomUUID()}.tmp`,
} = {}) {
  const temporary = `${statusPath}${tempSuffix}`;
  let fd;
  let closed = false;
  try {
    fd = ops.open(temporary, 'wx', 0o600);
    ops.write(fd, content);
    ops.fsync(fd);
    ops.close(fd);
    closed = true;
    ops.rename(temporary, statusPath);
  } catch (error) {
    if (fd !== undefined && !closed) {
      try { ops.close(fd); } catch { /* preserve original failure */ }
    }
    try { ops.unlink(temporary); } catch { /* temporary may not exist */ }
    throw error;
  }
}

export function resolveWikiPage(projectRoot, requestedPath) {
  if (typeof projectRoot !== 'string' || !projectRoot || typeof requestedPath !== 'string' || !requestedPath) {
    throw new WikiReadError('WIKI_ARGUMENT_INVALID', 'projectRoot and path are required');
  }
  const personalDir = resolvePersonalDir(projectRoot);
  if (!personalDir) throw new WikiReadError('WIKI_NOT_CONFIGURED', '.agents-personal is unavailable');
  const wikiRoot = path.join(personalDir, 'wiki');
  // 依次尝试两种基准：projectRoot（完整相对路径）与 wikiRoot（index 链接的 pages/…、draft/… 形态）
  const candidates = [...new Set([
    path.resolve(projectRoot, requestedPath),
    path.resolve(wikiRoot, requestedPath),
  ])];
  let pagePath;
  for (const candidate of candidates) {
    try { pagePath = realpathSync(candidate); } catch { continue; }
    break;
  }
  if (!pagePath) {
    throw new WikiReadError(
      'WIKI_PAGE_UNAVAILABLE',
      `wiki page does not exist: ${requestedPath} (tried: ${candidates.join('; ')})`,
    );
  }
  const relative = path.relative(wikiRoot, pagePath).replaceAll('\\', '/');
  if (relative.startsWith('../') || path.isAbsolute(relative)
    || !/^(?:pages|draft)\/.+\.md$/.test(relative)) {
    throw new WikiReadError('WIKI_PATH_OUTSIDE', `path must be a markdown page under wiki/pages or wiki/draft, got: ${relative}`);
  }
  return { personalDir, pagePath, key: relative.slice(0, -3) };
}

export function recordWikiUsage({ personalDir, key }, {
  repoLock = RepoLock, lockTimeoutMs = 150, now = todayDate, atomicWrite = writeStatusAtomic,
} = {}) {
  const handle = repoLock.acquire(personalDir, lockTimeoutMs);
  if (!handle) return { recorded: false, count: null, warning: 'WIKI_USAGE_LOCKED' };
  try {
    const statusPath = path.join(personalDir, 'wiki', 'status.md');
    let current;
    try { current = readFileSync(statusPath, 'utf8'); } catch { current = `${DEFAULT_PREAMBLE}\n`; }
    const parsed = parseStatusMd(current);
    const date = typeof now === 'function' ? now() : now;
    let row = parsed.rows.find((candidate) => candidate.key === key);
    if (row) {
      row.count += 1;
      row.lastReferenced = date;
    } else {
      row = { key, count: 1, lastReferenced: date };
      parsed.rows.push(row);
    }
    mkdirSync(path.dirname(statusPath), { recursive: true });
    atomicWrite(statusPath, renderStatusMd(parsed));
    return { recorded: true, count: row.count, warning: null };
  } finally { repoLock.release(handle); }
}

export function readWikiPage(input, options = {}) {
  if (!input || typeof input.sessionId !== 'string' || !input.sessionId) {
    throw new WikiReadError('WIKI_ARGUMENT_INVALID', 'sessionId is required');
  }
  const resolved = resolveWikiPage(input.projectRoot, input.path);
  let content;
  try { content = (options.readPage || readFileSync)(resolved.pagePath, 'utf8'); } catch {
    throw new WikiReadError('WIKI_PAGE_READ_FAILED', 'wiki page could not be read');
  }
  try {
    const usage = recordWikiUsage(resolved, options);
    return {
      path: resolved.pagePath, content, usageRecorded: usage.recorded,
      warnings: usage.warning ? [usage.warning] : [],
    };
  } catch {
    return { path: resolved.pagePath, content, usageRecorded: false, warnings: ['WIKI_USAGE_RECORD_FAILED'] };
  }
}

export function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const match = /^--(project-root|path|session-id)=(.*)$/.exec(arg);
    if (match) result[match[1]] = match[2];
    else if (['--project-root', '--path', '--session-id'].includes(arg)) result[arg.slice(2)] = args[++index];
    else throw new WikiReadError('WIKI_ARGUMENT_INVALID', `unknown argument: ${arg}`);
  }
  return { projectRoot: result['project-root'], path: result.path, sessionId: result['session-id'] };
}

export function main(args = process.argv.slice(2), io = process) {
  try {
    const result = readWikiPage(parseArgs(args));
    io.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    io.stderr.write(`${JSON.stringify({ code: error.code || 'WIKI_READ_FAILED', message: error.message })}\n`);
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
