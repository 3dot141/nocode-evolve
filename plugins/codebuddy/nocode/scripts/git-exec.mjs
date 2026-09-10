#!/usr/bin/env node
// git-exec.mjs — 共享安全 git 子进程调用工具.
// 统一用 execFileSync（参数数组，不经过 shell），从根源消除 shell 注入/引号转义类问题——
// 分支名/路径/commit sha 等动态值无论包含什么字符（空格/$()/反引号/分号）都作为单个 argv
// 元素传递，永远不被 shell 解释，也就不需要任何转义逻辑。
//
// Review 复审 C1/W1 修复：此前 scripts/dream-baseline.mjs、scripts/plugin-dream-baseline.mjs、
// scripts/personal-snapshot.mjs、scripts/personal-migrate.mjs 各自手写字符串拼接 + execSync 的
// git() helper，转义策略互不一致（有的完全不转义分支名，有的只加引号不转义、有的连引号都没加）——
// 这是 plugin-dream-baseline.mjs 分支名命令注入（已用 PoC 复现）和 personal-snapshot.mjs 路径
// 含空格时 100% 失败（已复现）两个问题的共同根因。本文件是唯一实现，四个消费者统一改用它。
import { execFileSync } from 'node:child_process';

// gitArgs — 组装 --git-dir/--work-tree/-C/-c config 前缀参数（不含子命令本身）。
export function gitArgs({ gitDir, workTree, cwd, config = {} } = {}) {
  const args = [];
  for (const [k, v] of Object.entries(config)) args.push('-c', `${k}=${v}`);
  if (cwd) args.push('-C', cwd);
  if (gitDir) args.push(`--git-dir=${gitDir}`);
  if (workTree) args.push(`--work-tree=${workTree}`);
  return args;
}

// git — 执行 git 子命令. subArgs 是"子命令 + 其余参数"的数组，每个动态值各占一个数组
// 元素（不要自己拼接成一个字符串再塞进数组）。allowFail=true 时命令失败返回空字符串
// 而不抛异常；否则异常原样抛出，携带 execFileSync 原生的 e.status（退出码）供调用方判断。
export function git(prefixOpts, subArgs, { allowFail = false, trim = true } = {}) {
  try {
    const out = execFileSync('git', [...gitArgs(prefixOpts), ...subArgs], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // 只掐掉末尾换行/空白, 不能用 .trim() —— `git status --porcelain` 首行形如 " M path",
    // 前导空格是状态码的一部分, 全量 trim() 会把它吃掉导致 parsePorcelain 按固定偏移
    // slice(3) 解析路径时错位.
    return trim ? out.replace(/\s+$/, '') : out;
  } catch (e) {
    if (allowFail) return '';
    throw e;
  }
}

// gitQuiet — 执行 git 命令只关心成功/失败, 不关心输出内容（如 `diff --cached --quiet`）。
export function gitQuiet(prefixOpts, subArgs) {
  try {
    execFileSync('git', [...gitArgs(prefixOpts), ...subArgs], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

// parsePorcelain — git status --porcelain 输出解析成路径列表. rename/copy 行
// ("old_path -> new_path") 取箭头后的新路径（对增量检测而言"文件现在在哪"才有意义）。
export function parsePorcelain(output) {
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
