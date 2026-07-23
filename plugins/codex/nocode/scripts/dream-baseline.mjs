#!/usr/bin/env node
// dream-baseline.mjs — 通用 git baseline 增量 diff 模块.
// 供 personal-dream (固定 ref, 整树 diff, prepareFn=SnapshotWriter.snapshot) 与
// project-dream (按目标路径参数化 ref, 可能是子目录 pathspec, 不传 prepareFn) 共用.
// 不硬编码调用任何特定 snapshot 函数, 不强制整树 diff — 通过 options.prepareFn / options.pathspec 收窄.
//
// 设计: docs/dev/3dot141/260701-01-dream-incremental/dream-incremental-design.md #BaselineTracker 模块
// 依赖: scripts/repo-lock.mjs (Task 1, acquire/release)、scripts/git-exec.mjs (共享安全 git 调用)
//
// Review 复审修复：git 子进程调用改用 git-exec.mjs 的 execFileSync 参数数组，不再自己维护
// quote() 手工转义（与其余三个消费者统一到同一份实现，避免转义策略走散）。
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { acquire, release } from './repo-lock.mjs';
import { git, parsePorcelain } from './git-exec.mjs';

const LOCK_TIMEOUT_MS = 2000;

// 'missing'  = ref 不存在 (首次, 静默走全量分支, 不 warn)
// 'broken'   = ref 存在但指向的对象不可达 (仓库损坏/history 被裁剪), 调用方需要 warn 后降级
// 'valid'    = ref 存在且指向有效对象
function refStatus(gitDir, refName) {
  try {
    execFileSync('git', [`--git-dir=${gitDir}`, 'show-ref', '--verify', '--quiet', refName], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return 'valid';
  } catch (e) {
    if (e.status === 1) return 'missing';
    return 'broken';
  }
}

/**
 * diffSinceBaseline — 计算 refName 到 HEAD 之间的变更文件列表.
 *
 * @param {string} gitDir   - 目标仓库的 --git-dir (如 <personalDir>/.git 或 <projectRoot>/.git)
 * @param {string} workTree - 目标仓库的 --work-tree
 * @param {string} refName  - baseline ref 名 (如 refs/dream/last-baseline 或参数化后的变体)
 * @param {object} [options]
 * @param {() => void} [options.prepareFn]     - diff 前调用的回调 (如 SnapshotWriter.snapshot); 不传则跳过, 不硬编码任何特定函数
 * @param {string[]} [options.excludePaths]     - 需要从 diff 结果排除的相对路径 (转成 git pathspec `:!<path>`)
 * @param {string} [options.pathspec]           - 限定 diff 范围的 pathspec (如子目录路径); 不传则默认整树 '.'
 * @param {boolean} [options.includeDirty]      - 额外用 `git status --porcelain` 检测 working tree 未提交改动并入结果
 *   (Round 2 复审 W1 修正：project-dream 场景不传 prepareFn，没有任何组件保证 working tree 干净——
 *    用户在目标目录里编辑了文件但没 commit，纯 commit 层 diff 看不到这些改动，会被误判"无变化"。
 *    personal-dream 场景 prepareFn=snapshot 已经把 working tree 提交干净，默认 false 不受影响)。
 * @returns {string[]|null} 变更文件相对路径列表; ref 不存在或不可达时返回 null (调用方走全量分支)
 */
export function diffSinceBaseline(gitDir, workTree, refName, options = {}) {
  const { prepareFn, excludePaths = [], pathspec, includeDirty = false } = options;

  if (typeof prepareFn === 'function') {
    prepareFn();
  }

  const status = refStatus(gitDir, refName);
  if (status === 'missing') {
    return null; // 首次运行, 调用方走全量分支, 无需 warn
  }
  if (status === 'broken') {
    process.stderr.write(
      `[dream-baseline] WARN: baseline ref ${refName} 存在但不可达 (可能已损坏), 降级为全量扫描\n`
    );
    return null;
  }

  try {
    const pathspecArgs = [pathspec || '.', ...excludePaths.map((p) => `:!${p}`)];
    const out = git({ gitDir, workTree }, ['diff', '--name-only', refName, 'HEAD', '--', ...pathspecArgs]);
    const changed = new Set(out ? out.split('\n').filter(Boolean) : []);

    if (includeDirty) {
      const dirtyOut = git({ gitDir, workTree }, ['status', '--porcelain', '--', ...pathspecArgs]);
      for (const p of parsePorcelain(dirtyOut)) changed.add(p);
    }

    return Array.from(changed);
  } catch (e) {
    process.stderr.write(
      `[dream-baseline] WARN: diff 失败 (${(e.message || '').split('\n')[0]}), 降级为全量扫描\n`
    );
    return null;
  }
}

/**
 * advanceBaseline — 处理完成后把 refName 前移到当前 HEAD.
 *
 * @param {string} gitDir      - 目标仓库的 --git-dir
 * @param {string} refName     - baseline ref 名
 * @param {boolean} hadFailures - Phase 3 执行阶段是否有系统性失败 (用户主动跳过不算); true 则不前移
 * @param {object} [options]
 * @param {string} [options.lockDir] - 锁文件所在目录; 不传则默认 dirname(gitDir)（personal-dream
 *   场景：.agents-personal/ 本身是插件私有目录，用它的根即可）。project-dream 场景应显式传
 *   `join(gitRoot, '.git')`——落在 .git 内部而不是用户项目根目录，天然不出现在 `git status`
 *   里、不会被误提交（Review 复审 W3 修复：此前统一用 dirname(gitDir)，project-dream 场景
 *   会把锁文件放进用户自己的工作区）。
 */
export function advanceBaseline(gitDir, refName, hadFailures, options = {}) {
  if (hadFailures) {
    return; // 有系统性失败时不前移, 下次 diff 仍能看到这些文件重新处理 (C6)
  }
  const lockDir = options.lockDir || dirname(gitDir);
  const handle = acquire(lockDir, LOCK_TIMEOUT_MS);
  if (!handle) {
    process.stderr.write('[dream-baseline] WARN: 拿不到锁, 跳过本次 baseline 前移\n');
    return; // 不阻塞; 下次运行 diff 范围略大, 不会漏检
  }
  try {
    execFileSync('git', [`--git-dir=${gitDir}`, 'update-ref', refName, 'HEAD'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    process.stderr.write(`[dream-baseline] WARN: update-ref 失败: ${e.message}\n`);
  } finally {
    release(handle);
  }
}

// project-dream 场景的推荐锁目录：<gitRoot>/.git（而非仓库根），配 advanceBaseline 的
// options.lockDir 使用。导出成命名函数方便调用方（commands/project-dream.md 的 node -e
// 片段）不需要自己拼路径细节。
export function projectLockDir(gitRoot) {
  return join(gitRoot, '.git');
}
