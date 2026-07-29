#!/usr/bin/env node
// .agents-personal/ 版本快照 — SessionStart 时自动 commit 到内嵌 git 仓库 (.agents-personal/.git).
// 用法: node personal-snapshot.mjs [--dry-run] [--json]
// Exit 0 always — errors warn to stderr, never block session.
//
// 环境变量:
//   CLAUDE_PROJECT_DIR  — 当前项目目录 (Claude Code 注入)
//   NOCODE_HISTORY_ROOT — 仅供显式运行 personal-migrate.mjs 时定位旧历史；本脚本不读取。
//
// 架构变更 (dream-incremental 设计, 260701): 原"外部 bare repo + --work-tree 指向目标目录"
// 模式已废弃, 改为 .agents-personal/ 目录自身内嵌 .git (贴近 Codex `morpheus` 原版, 自包含).
// 旧 bare repo 不会被 SessionStart 自动读取或迁移；需要时显式运行 personal-migrate.mjs。
//
// 设计: docs/dev/3dot141/260701-01-dream-incremental/dream-incremental-design.md
//   § PersonalHistory 域 / SnapshotWriter 模块
//
// Review 复审修复：
//   W1 — git 子进程调用改用 git-exec.mjs 的 execFileSync 参数数组，不再手写字符串拼接 +
//        execSync（此前 --git-dir=/--work-tree= 完全不加引号，项目路径含空格时 100% 失败，
//        已用真实复现验证）。
//   W4 — ensureNestedRepo() 的 git init 使用锁 + 双重检查，避免两个 SessionStart 并发建仓。
//   双运行时迁移 — SessionStart 不再探测或迁移旧外部 bare repo，避免隐式读取和改名历史数据。
import { existsSync, realpathSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { acquire, release } from './repo-lock.mjs';
import { git, gitQuiet } from './git-exec.mjs';

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

function projectIdFromRoot(projectRoot) {
  const resolved = realpathSync(projectRoot);
  const name = basename(resolved);
  const hash = createHash('md5').update(resolved).digest('hex').slice(0, 8);
  return `${name}-${hash}`;
}

export function projectId(physicalPersonalDir) {
  return projectIdFromRoot(dirname(physicalPersonalDir));
}

export function bareRepoPath(historyRoot, id) {
  return join(historyRoot, id);
}

export function historyRootDir() {
  return process.env.NOCODE_HISTORY_ROOT || join(homedir(), '.nocode', 'personal-history');
}

// ensureNestedRepo — 幂等建仓。只初始化当前 .agents-personal/，从不探测或迁移旧历史。
export function ensureNestedRepo(personalDir) {
  const gitDir = join(personalDir, '.git');
  if (existsSync(gitDir)) return false;

  const handle = acquire(personalDir, LOCK_TIMEOUT_MS);
  if (!handle) {
    process.stderr.write('[personal-snapshot] WARN: 拿不到锁, 跳过本次建仓, 下次重试\n');
    return false;
  }
  try {
    if (existsSync(gitDir)) return false; // 双重检查：等锁期间别的进程可能已经建好了
    mkdirSync(personalDir, { recursive: true });
    execFileSync('git', ['init', '-b', 'main', personalDir], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } finally {
    release(handle);
  }
}

export function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// snapshot — 对 personalDir 当前磁盘状态做一次 add -A -f + commit (若有变化).
// 内部接入 RepoLock: 拿不到锁直接返回 skipped_locked, 不阻塞调用方.
export function snapshot(personalDir, dryRun = false, commitMessage = null) {
  const handle = acquire(personalDir, LOCK_TIMEOUT_MS);
  if (!handle) return { status: 'skipped_locked' };

  try {
    const gitDir = join(personalDir, '.git');
    if (!existsSync(gitDir)) {
      return { status: 'error', reason: 'no_repo' };
    }
    const prefix = { gitDir, workTree: personalDir };
    // git-dir 恰好等于 work-tree 内的 .git 时, git 本身会自动跳过顶层 .git 目录,
    // 不需要额外 pathspec 排除 (设计文档 S1, 已实测验证).
    // 但 RepoLock 的 .dream.lock 文件 (C1 修正后) 就放在 personalDir 根下, 不在 .git
    // 内部, 不会被上面那条自动跳过规则覆盖 —— 必须显式 pathspec 排除, 否则每次
    // acquire 锁产生的 pid 内容变化都会被当成"有变化"提交进历史 (实测验证过).
    git(prefix, ['add', '-A', '-f', '--', '.', ':!.dream.lock']);
    const hasChanges = !gitQuiet(prefix, ['diff', '--cached', '--quiet']);
    if (!hasChanges) return { status: 'no_changes' };
    if (dryRun) return { status: 'dry_run', changes: true };
    const ts = formatTimestamp();
    const message = typeof commitMessage === 'string' && commitMessage.trim()
      ? commitMessage.trim() : `auto: ${ts}`;
    git({ ...prefix, config: { 'user.name': 'snapshot', 'user.email': 'snapshot@local' } }, ['commit', '-m', message]);
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
