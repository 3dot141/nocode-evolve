#!/usr/bin/env node
// dream-baseline.mjs — 通用 git baseline 增量 diff 模块.
// 供 personal-dream (固定 ref, 整树 diff, prepareFn=SnapshotWriter.snapshot) 与
// project-dream (按目标路径参数化 ref, 可能是子目录 pathspec, 不传 prepareFn) 共用.
// 不硬编码调用任何特定 snapshot 函数, 不强制整树 diff — 通过 options.prepareFn / options.pathspec 收窄.
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md #BaselineTracker 模块
// 依赖: scripts/repo-lock.mjs (Task 1, acquire/release)
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { acquire, release } from './repo-lock.mjs';

const LOCK_TIMEOUT_MS = 2000;

function quote(value) {
  return `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;
}

function git(gitDir, workTree, tokens, config = {}) {
  const parts = ['git'];
  for (const [k, v] of Object.entries(config)) parts.push('-c', `${k}=${v}`);
  parts.push(`--git-dir=${quote(gitDir)}`);
  if (workTree) parts.push(`--work-tree=${quote(workTree)}`);
  parts.push(...tokens);
  // 只掐掉末尾换行/空白，不能用 .trim() —— `git status --porcelain` 首行形如
  // " M path"，前导空格是状态码的一部分，全量 trim() 会把它吃掉，导致
  // parsePorcelainPaths 按固定偏移 slice(3) 解析时错位（与 plugin-dream-baseline.mjs
  // 的 git() helper 同一处理，此处补齐，跑测试时发现的真实 bug）。
  return execSync(parts.join(' '), {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).replace(/\s+$/, '');
}

// 'missing'  = ref 不存在 (首次, 静默走全量分支, 不 warn)
// 'broken'   = ref 存在但指向的对象不可达 (仓库损坏/history 被裁剪), 调用方需要 warn 后降级
// 'valid'    = ref 存在且指向有效对象
function refStatus(gitDir, refName) {
  try {
    execSync(`git --git-dir=${quote(gitDir)} show-ref --verify --quiet ${quote(refName)}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return 'valid';
  } catch (e) {
    if (e.status === 1) return 'missing';
    return 'broken';
  }
}

// git status --porcelain 输出解析成路径列表. rename/copy 行 ("old -> new") 取箭头后的新路径
// (与 scripts/plugin-dream-baseline.mjs 的 parsePorcelain 同一处理, Round 2 复审 W4 一并对齐)。
function parsePorcelainPaths(output) {
  if (!output) return [];
  return output
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.slice(3).trimEnd())
    .map((p) => {
      const arrowIdx = p.indexOf(' -> ');
      return arrowIdx === -1 ? p : p.slice(arrowIdx + 4);
    });
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
    const pathspecTokens = [quote(pathspec || '.'), ...excludePaths.map((p) => quote(`:!${p}`))];
    const diffTokens = ['diff', '--name-only', quote(refName), 'HEAD', '--', ...pathspecTokens];
    const out = git(gitDir, workTree, diffTokens);
    const changed = new Set(out ? out.split('\n').filter(Boolean) : []);

    if (includeDirty) {
      const statusTokens = ['status', '--porcelain', '--', ...pathspecTokens];
      const dirtyOut = git(gitDir, workTree, statusTokens);
      for (const p of parsePorcelainPaths(dirtyOut)) changed.add(p);
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
 */
export function advanceBaseline(gitDir, refName, hadFailures) {
  if (hadFailures) {
    return; // 有系统性失败时不前移, 下次 diff 仍能看到这些文件重新处理 (C6)
  }
  const lockDir = dirname(gitDir); // gitDir 形如 <root>/.git, 锁文件放 <root> 根, 不依赖 .git 已存在
  const handle = acquire(lockDir, LOCK_TIMEOUT_MS);
  if (!handle) {
    process.stderr.write('[dream-baseline] WARN: 拿不到锁, 跳过本次 baseline 前移\n');
    return; // 不阻塞; 下次运行 diff 范围略大, 不会漏检
  }
  try {
    execSync(`git --git-dir=${quote(gitDir)} update-ref ${quote(refName)} HEAD`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    process.stderr.write(`[dream-baseline] WARN: update-ref 失败: ${e.message}\n`);
  } finally {
    release(handle);
  }
}
