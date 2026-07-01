#!/usr/bin/env node
// .agents-personal/ 版本快照 — SessionStart 时自动 commit 到内嵌 git 仓库 (.agents-personal/.git).
// 用法: node personal-snapshot.mjs [--dry-run] [--json]
// Exit 0 always — errors warn to stderr, never block session.
//
// 环境变量:
//   CLAUDE_PROJECT_DIR  — 当前项目目录 (Claude Code 注入)
//   NOCODE_HISTORY_ROOT — 旧版外部 bare repo 根目录 (默认 ~/.nocode/personal-history,
//                          仅用于迁移检测, 测试用)
//
// 架构变更 (dream-incremental 设计, 260701): 原"外部 bare repo + --work-tree 指向目标目录"
// 模式已废弃, 改为 .agents-personal/ 目录自身内嵌 .git (贴近 Codex `morpheus` 原版, 自包含).
// 检测到旧 bare repo 时, ensureNestedRepo() 委托 personal-migrate.mjs 的 migrateIfNeeded() 迁移历史.
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md
//   § PersonalHistory 域 / SnapshotWriter 模块
import { execSync } from 'node:child_process';
import { existsSync, realpathSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { acquire, release } from './repo-lock.mjs';
import { migrateIfNeeded } from './personal-migrate.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUTPUT = process.argv.includes('--json');
const LOCK_TIMEOUT_MS = 2000;

export function resolvePersonalDir(projectDir) {
  const dir = join(projectDir, '.agents-personal');
  if (!existsSync(dir)) return null;
  try {
    return realpathSync(dir);
  } catch {
    return null;
  }
}

export function projectId(physicalPersonalDir) {
  const projectRoot = realpathSync(dirname(physicalPersonalDir));
  const name = basename(projectRoot);
  const hash = createHash('md5').update(projectRoot).digest('hex').slice(0, 8);
  return `${name}-${hash}`;
}

export function bareRepoPath(historyRoot, id) {
  return join(historyRoot, id);
}

export function historyRootDir() {
  return process.env.NOCODE_HISTORY_ROOT || join(homedir(), '.nocode', 'personal-history');
}

function git(personalDir, cmd, config = {}) {
  const parts = ['git'];
  for (const [k, v] of Object.entries(config)) parts.push(`-c`, `${k}=${v}`);
  parts.push(`--git-dir=${join(personalDir, '.git')}`, `--work-tree=${personalDir}`);
  parts.push(cmd);
  return execSync(parts.join(' '), {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function gitQuiet(personalDir, cmd) {
  try {
    git(personalDir, cmd);
    return true;
  } catch {
    return false;
  }
}

// ensureNestedRepo — 幂等建仓, 返回是否新建 (true) / 已存在或迁移未完成 (false).
//   .git 不存在 + 检测到旧 bare repo → 委托 migrateIfNeeded() 迁移历史 (personal-migrate.mjs).
//   .git 不存在 + 无旧 bare repo       → 直接 git init.
//   .git 已存在                       → 幂等跳过, 不调用迁移也不重新 init.
export function ensureNestedRepo(personalDir) {
  const gitDir = join(personalDir, '.git');
  if (existsSync(gitDir)) return false;

  const id = projectId(personalDir);
  const oldBareDir = bareRepoPath(historyRootDir(), id);

  if (existsSync(oldBareDir)) {
    const projectDir = dirname(personalDir);
    const result = migrateIfNeeded(projectDir, oldBareDir);
    if (result.status !== 'migrated') {
      process.stderr.write(`[personal-snapshot] WARN: 迁移未完成 (${result.status}), .git 暂不可用, 下次重试\n`);
    }
    return existsSync(gitDir);
  }

  mkdirSync(personalDir, { recursive: true });
  execSync(`git init -b main "${personalDir}"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return true;
}

export function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// snapshot — 对 personalDir 当前磁盘状态做一次 add -A -f + commit (若有变化).
// 内部接入 RepoLock: 拿不到锁直接返回 skipped_locked, 不阻塞调用方.
export function snapshot(personalDir, dryRun = false) {
  const handle = acquire(personalDir, LOCK_TIMEOUT_MS);
  if (!handle) return { status: 'skipped_locked' };

  try {
    if (!existsSync(join(personalDir, '.git'))) {
      return { status: 'error', reason: 'no_repo' };
    }
    const commitConfig = { 'user.name': 'snapshot', 'user.email': 'snapshot@local' };
    // git-dir 恰好等于 work-tree 内的 .git 时, git 本身会自动跳过顶层 .git 目录,
    // 不需要额外 pathspec 排除 (设计文档 S1, 已实测验证).
    // 但 RepoLock 的 .dream.lock 文件 (C1 修正后) 就放在 personalDir 根下, 不在 .git
    // 内部, 不会被上面那条自动跳过规则覆盖 —— 必须显式 pathspec 排除, 否则每次
    // acquire 锁产生的 pid 内容变化都会被当成"有变化"提交进历史 (实测验证过).
    git(personalDir, 'add -A -f -- . ":!.dream.lock"');
    const hasChanges = !gitQuiet(personalDir, 'diff --cached --quiet');
    if (!hasChanges) return { status: 'no_changes' };
    if (dryRun) return { status: 'dry_run', changes: true };
    const ts = formatTimestamp();
    git(personalDir, `commit -m "auto: ${ts}"`, commitConfig);
    return { status: 'committed', timestamp: ts };
  } finally {
    release(handle);
  }
}

function output(result) {
  if (JSON_OUTPUT) console.log(JSON.stringify(result, null, 2));
}

export function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const physicalDir = resolvePersonalDir(projectDir);
  if (!physicalDir) {
    output({ status: 'skipped', reason: 'no .agents-personal/' });
    return;
  }

  try {
    ensureNestedRepo(physicalDir);
  } catch (e) {
    process.stderr.write(`[personal-snapshot] WARN: cannot init nested repo: ${e.message}\n`);
    output({ status: 'error', reason: 'init_failed' });
    return;
  }

  try {
    const result = snapshot(physicalDir, DRY_RUN);
    output(result);
  } catch (e) {
    process.stderr.write(`[personal-snapshot] WARN: snapshot failed: ${e.message}\n`);
    output({ status: 'error', reason: 'snapshot_failed' });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
  process.exit(0);
}
