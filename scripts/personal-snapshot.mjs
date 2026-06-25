#!/usr/bin/env node
// .agents-personal/ 版本快照 — SessionStart 时自动 commit 到外部 bare repo.
// 用法: node personal-snapshot.mjs [--dry-run] [--json]
// Exit 0 always — errors warn to stderr, never block session.
//
// 环境变量:
//   CLAUDE_PROJECT_DIR  — 当前项目目录 (Claude Code 注入)
//   NOCODE_HISTORY_ROOT — bare repo 根目录 (默认 ~/.nocode/personal-history, 测试用)
import { execSync } from 'node:child_process';
import { existsSync, realpathSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUTPUT = process.argv.includes('--json');

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

function git(bareDir, workTree, cmd, config = {}) {
  const parts = ['git'];
  for (const [k, v] of Object.entries(config)) parts.push(`-c`, `${k}=${v}`);
  parts.push(`--git-dir=${bareDir}`);
  if (workTree) parts.push(`--work-tree=${workTree}`);
  parts.push(cmd);
  return execSync(parts.join(' '), {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function gitQuiet(bareDir, workTree, cmd) {
  try {
    git(bareDir, workTree, cmd);
    return true;
  } catch {
    return false;
  }
}

export function ensureBareRepo(bareDir) {
  if (existsSync(bareDir)) return false;
  mkdirSync(bareDir, { recursive: true });
  execSync(`git init --bare -b main "${bareDir}"`, {
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

export function snapshot(bareDir, workTree, dryRun = false) {
  const commitConfig = { 'user.name': 'snapshot', 'user.email': 'snapshot@local' };
  git(bareDir, workTree, 'add -A -f');
  const hasChanges = !gitQuiet(bareDir, workTree, 'diff --cached --quiet');
  if (!hasChanges) return { status: 'no_changes' };
  if (dryRun) return { status: 'dry_run', changes: true };
  const ts = formatTimestamp();
  git(bareDir, workTree, `commit -m "auto: ${ts}"`, commitConfig);
  return { status: 'committed', timestamp: ts };
}

function output(result) {
  if (JSON_OUTPUT) console.log(JSON.stringify(result, null, 2));
}

export function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const historyRoot = process.env.NOCODE_HISTORY_ROOT || join(homedir(), '.nocode', 'personal-history');

  const physicalDir = resolvePersonalDir(projectDir);
  if (!physicalDir) {
    output({ status: 'skipped', reason: 'no .agents-personal/' });
    return;
  }

  const id = projectId(physicalDir);
  const bareDir = bareRepoPath(historyRoot, id);

  try {
    ensureBareRepo(bareDir);
  } catch (e) {
    process.stderr.write(`[personal-snapshot] WARN: cannot init bare repo: ${e.message}\n`);
    output({ status: 'error', reason: 'init_failed' });
    return;
  }

  try {
    const result = snapshot(bareDir, physicalDir, DRY_RUN);
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
