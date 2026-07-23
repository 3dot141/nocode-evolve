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
import { createHash } from 'node:crypto';

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
//   一路到文件系统根都没有 .git → 退化为 dirPath 本身（两个用户候选在这种情况下等价）。
export function findUpperProjectRoot(dirPath) {
  const toplevel = gitToplevel(dirPath);
  if (toplevel) return toplevel;
  return safeRealpath(dirPath);
}

// refName(dirPath, gitRoot) —— baseline ref 命名，扁平化避免 D/F 冲突。
//
// Review 复审 C3 修复：原实现只是把 '/' 替换成 '_'，不是单射映射——已用直接调用复现两组
// 真实碰撞：① 嵌套子目录 'a/b' 与字面量一级子目录 'a_b' 都会替换成 'a_b'；② 仓库根（哨兵值
// 'root'）与字面量名为 'root' 的一级子目录也会撞在一起。碰撞后果：两个不同目录共享同一条
// baseline ref，其中一个的 diff 判断会被另一个的历史污染（漏检或误报"无变化"）。
//
// 修法：唯一性来源改成对"相对路径的原始字符串"取 hash——path.relative(gitRoot, dirPath)
// 对固定 gitRoot 而言，不同的 dirPath 必然产生不同的字符串（可以从 gitRoot+rel 唯一还原出
// dirPath），包括根目录场景（rel === ''，这个空字符串不可能是任何真实子目录的相对路径）。
// 可读前缀仍然保留（帮助人工排查时一眼看出对应哪个目录），但不参与唯一性判断，允许非单射。
export function refName(dirPath, gitRoot) {
  const resolvedDirPath = safeRealpath(dirPath);
  const resolvedGitRoot = safeRealpath(gitRoot);
  const rel = path.relative(resolvedGitRoot, resolvedDirPath); // '' 表示根目录, 对任何真实子目录都不可能是这个值
  const hash = createHash('sha256').update(rel).digest('hex').slice(0, 12); // 12 位 hex, 碰撞概率可忽略
  const readable = (rel === '' ? 'root' : rel.replace(/[\\/]/g, '_'))
    .replace(/[^a-zA-Z0-9._-]/g, '_') // git ref 组件字符白名单以外的一律替换
    .replace(/\.\.+/g, '_'); // 折叠连续的点, 避免出现 git 禁止的 ".."
  return `refs/dream/last-baseline__${readable}-${hash}`;
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
