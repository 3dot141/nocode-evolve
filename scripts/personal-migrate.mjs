#!/usr/bin/env node
// PersonalHistory 域 — MigrationRunner: 从旧外部 bare repo 迁移到 .agents-personal/ 内嵌 git 仓库.
//
// 用法(CLI, 手动 demo 用): node personal-migrate.mjs [--json]
//   自动定位 CLAUDE_PROJECT_DIR 下的 .agents-personal/ 与对应的旧 bare repo
//   (~/.nocode/personal-history/<projectId>/).
//
// 编程接口: migrateIfNeeded(projectDir, oldBareDir) — 由 personal-snapshot.mjs 的
//   ensureNestedRepo() 调用, 调用方不需要自行判断"要不要迁移", 本函数内部是幂等的:
//     - .git 已存在 + 旧 repo 还在   → 只补做旧 repo 改名 (上次改名步骤失败的补偿路径),
//                                      不重复导入历史
//     - .git 已存在 + 旧 repo 不在   → 视为已完成迁移, 无操作
//     - .git 不存在 + 旧 repo 不存在 → 无需迁移
//     - .git 不存在 + 旧 repo 存在   → 完整迁移流程
//
// 迁移流程 (设计文档 C4 修正): 只导入历史 (git fetch + update-ref), 不做"内容必须匹配"
// 校验; 导入完立即对当前磁盘真实状态做一次新的 snapshot commit, 吸收迁移前的正常漂移.
// 应用步骤先在临时目录完整构建好 (git init + fetch + update-ref), 再一次性原子 rename
// 替换, 避免"替换到一半"的中间态. 临时目录建在 projectDir 下 (与 personalDir 同一
// 文件系统/卷), 保证 rename 是同卷操作、真正原子 (跨卷 rename 会报 EXDEV).
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md
//   § PersonalHistory 域 / MigrationRunner 模块
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire, release } from './repo-lock.mjs';
import { snapshot, resolvePersonalDir, projectId, bareRepoPath, historyRootDir } from './personal-snapshot.mjs';
import { git as gitExec } from './git-exec.mjs';

const JSON_OUTPUT = process.argv.includes('--json');
const LOCK_TIMEOUT_MS = 2000;

// 薄封装：本文件历史上传的是 (gitDir, cmd 字符串)，改成 execFileSync 参数数组风格后
// 调用点不用大改——仍传 subArgs 数组即可（Review 复审 W1 一致性修复：与其余三个
// git 消费者统一到 git-exec.mjs，不再自己维护字符串拼接的 git() helper）。
function git(gitDir, subArgs) {
  return gitExec({ gitDir }, subArgs);
}

// migrateIfNeeded — 幂等迁移入口. 不要求调用方预先判断"要不要迁移".
export function migrateIfNeeded(projectDir, oldBareDir) {
  const personalDir = join(projectDir, '.agents-personal');
  const gitDir = join(personalDir, '.git');

  if (existsSync(gitDir)) {
    if (!existsSync(oldBareDir)) {
      return { status: 'already_migrated' };
    }
    // .git 已就绪但旧 repo 还在 — 上次改名步骤失败, 这里只补做改名, 不重新导入历史.
    try {
      renameSync(oldBareDir, `${oldBareDir}.migrated`);
    } catch (e) {
      process.stderr.write(`[personal-migrate] WARN: 补做旧 repo 改名失败: ${e.message}\n`);
      return { status: 'rename_retry_failed' };
    }
    return { status: 'migrated_rename_completed' };
  }

  if (!existsSync(oldBareDir)) {
    return { status: 'no_old_repo' };
  }

  const handle = acquire(personalDir, LOCK_TIMEOUT_MS);
  if (!handle) {
    return { status: 'skipped_locked' }; // 拿不到锁, 下次调用再试, 不阻塞本次会话
  }

  let tmpDir;
  let handleReleased = false; // snapshot() 内部会自己再 acquire 同一把锁, 必须先释放外层持有,
  // 否则同一进程对同一锁重入会自锁到超时 (release 只做一次, 避免释放到别的进程新持有的锁)
  try {
    mkdirSync(personalDir, { recursive: true });
    tmpDir = mkdtempSync(join(projectDir, '.personal-migrate-tmp-')); // 建在 projectDir 下, 与 personalDir 同卷,
                                                                       // 保证下面的 renameSync 是同设备原子操作 (不触发 EXDEV)
    const tmpGitDir = join(tmpDir, '.git');

    execFileSync('git', ['init', '-b', 'main', tmpDir], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    git(tmpGitDir, ['fetch', oldBareDir]); // 旧 bare repo 本身就是合法的 git remote
    git(tmpGitDir, ['update-ref', 'refs/heads/main', 'FETCH_HEAD']);
    // 只导入历史指针, 不 reset 工作区、不要求内容匹配.

    renameSync(tmpGitDir, gitDir); // 单次 rename, 同卷内原子操作, 不会出现半迁移状态

    // 关键写操作 (.git 替换) 已完成, 释放外层锁再调用 snapshot() —— snapshot() 自己会
    // 重新 acquire/release 同一把锁保护 add/commit, 嵌套持锁只会导致自锁到超时.
    release(handle);
    handleReleased = true;

    snapshot(personalDir); // 用当前真实磁盘状态提交一次新 commit, 吸收迁移前的漂移

    try {
      renameSync(oldBareDir, `${oldBareDir}.migrated`);
    } catch (e) {
      // .git 已迁移完成, 这一步失败不影响正确性; 下次调用会走上面的补做改名分支
      process.stderr.write(`[personal-migrate] WARN: 旧 repo 改名失败, 下次调用会补做: ${e.message}\n`);
    }

    return { status: 'migrated' };
  } catch (e) {
    process.stderr.write(`[personal-migrate] WARN: 迁移失败: ${e.message}\n`); // fetch 失败等场景; 不阻断 session
    return { status: 'failed', reason: e.message };
  } finally {
    if (!handleReleased) release(handle);
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

function output(result) {
  if (JSON_OUTPUT) console.log(JSON.stringify(result, null, 2));
}

export function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const personalDir = resolvePersonalDir(projectDir);
  if (!personalDir) {
    output({ status: 'skipped', reason: 'no .agents-personal/' });
    return;
  }
  const id = projectId(personalDir);
  const oldBareDir = bareRepoPath(historyRootDir(), id);
  const result = migrateIfNeeded(dirname(personalDir), oldBareDir);
  output(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
  process.exit(0);
}
