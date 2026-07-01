#!/usr/bin/env node
// project-dream 目标目录树的 git 检测 + baseline ref 命名 —— ProjectTreeBaseline 域.
// 用法（CLI）:
//   node project-tree-detect.mjs detect <dir-path>
//   node project-tree-detect.mjs find-root <dir-path>
//   node project-tree-detect.mjs ref-name <dir-path> <git-root>
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md ProjectTreeBaseline 域
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// git -C <dirPath> rev-parse --show-toplevel 成功即返回 toplevel 绝对路径（git 已把它解析为物理路径，
// symlink 已展开）；不在任何 git 仓库内（或 dirPath 不存在）时返回 null，不抛异常——调用方按"非 git 目录"
// 处理，不让异常冒泡中断命令。
function gitToplevel(dirPath) {
  try {
    const out = execFileSync(
      'git',
      ['-C', dirPath, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

// realpath 失败（目标不存在等）时退化为 path.resolve，不抛异常。
function safeRealpath(p) {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

// detectGitRepo(dirPath) —— dirPath 是否在 git 仓库内（含子目录场景：git 自己逐级向上找 .git）。
export function detectGitRepo(dirPath) {
  return gitToplevel(dirPath) !== null;
}

// findUpperProjectRoot(dirPath) —— "上层项目根"推断算法：
//   从 dirPath 逐级向上找最近的 .git 目录，找到即为该仓库根；
//   一路到文件系统根都没有 .git → 退化为 dirPath 本身（AskUserQuestion 的两个候选在这种情况下等价）。
export function findUpperProjectRoot(dirPath) {
  const toplevel = gitToplevel(dirPath);
  if (toplevel) return toplevel;
  return safeRealpath(dirPath);
}

// refName(dirPath, gitRoot) —— baseline ref 命名，扁平化避免 D/F 冲突：
//   dirPath === gitRoot（realpath 对齐后比较，兼容 symlink/相对路径输入）→ 'refs/dream/last-baseline__root'
//   否则 → 'refs/dream/last-baseline__' + relative(gitRoot, dirPath)，把 '/' 和 '\' 都替换成 '_'
export function refName(dirPath, gitRoot) {
  const resolvedDirPath = safeRealpath(dirPath);
  const resolvedGitRoot = safeRealpath(gitRoot);
  const rel = path.relative(resolvedGitRoot, resolvedDirPath);
  const suffix = rel === '' ? 'root' : rel.replace(/[\\/]/g, '_');
  return `refs/dream/last-baseline__${suffix}`;
}

function output(result) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function usage() {
  process.stderr.write(
    'usage:\n' +
    '  project-tree-detect.mjs detect <dir-path>\n' +
    '  project-tree-detect.mjs find-root <dir-path>\n' +
    '  project-tree-detect.mjs ref-name <dir-path> <git-root>\n',
  );
}

export function main(argv) {
  const [cmd, ...rest] = argv;

  if (cmd === 'detect') {
    const dirPath = rest[0];
    if (!dirPath) { usage(); process.exit(2); return; }
    const gitRoot = gitToplevel(dirPath);
    output({ dirPath: safeRealpath(dirPath), isGitRepo: gitRoot !== null, gitRoot });
    return;
  }

  if (cmd === 'find-root') {
    const dirPath = rest[0];
    if (!dirPath) { usage(); process.exit(2); return; }
    const resolvedDirPath = safeRealpath(dirPath);
    const upperRoot = findUpperProjectRoot(dirPath);
    output({ dirPath: resolvedDirPath, upperRoot, sameAsDirPath: upperRoot === resolvedDirPath });
    return;
  }

  if (cmd === 'ref-name') {
    const [dirPath, gitRoot] = rest;
    if (!dirPath || !gitRoot) { usage(); process.exit(2); return; }
    output({
      dirPath: safeRealpath(dirPath),
      gitRoot: safeRealpath(gitRoot),
      refName: refName(dirPath, gitRoot),
    });
    return;
  }

  usage();
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
