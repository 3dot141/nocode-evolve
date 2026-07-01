#!/usr/bin/env node
// plugin-dream 的增量 baseline 判断 —— 复用 freshness-check.mjs 的 git config 隔离模式（branch.<branch>.xxx）.
// 供 commands/plugin-dream.md 的 Layer2 调用（library），也可独立跑 CLI 自检:
//   node scripts/plugin-dream-baseline.mjs [pluginRoot]           查看当前 diff 判断
//   node scripts/plugin-dream-baseline.mjs --set [pluginRoot]     写入/推进 baseline 到当前 HEAD
//
// baseline 存储: git config branch.<branch>.nocode-evolve-plugin-dream-baseline
//   key 按分支隔离，不用全局 key —— 避免多 worktree/分支同时跑 /plugin-dream 时互相覆盖 baseline（红军 C7 修复，
//   与 rule-git-worktree.md 已验证的 branch.<branch>.nocode-evolve-base 模式一致）.
//
// 监控范围（红军 W7 修复，从"只列 generate.mjs/vendor-sync.mjs 两个文件"放宽到整个 hooks/ scripts/ 目录）:
//   rules/ skills/ commands/ hooks/ scripts/ rules/manifest.json .claude-plugin/plugin.json
//
// 设计: docs/superpowers/specs/3dot141/260701-dream-incremental-design.md（PluginRepo 域）
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CONFIG_KEY_SUFFIX = 'nocode-evolve-plugin-dream-baseline';

export const MONITORED_PATHS = [
  'rules/',
  'skills/',
  'commands/',
  'hooks/',
  'scripts/',
  'rules/manifest.json',
  '.claude-plugin/plugin.json',
];

function git(pluginRoot, cmd, allowFail = false) {
  try {
    // 只掐掉末尾换行/空白（trimEnd 语义），不能用 trim() —— `git status --porcelain` 首行形如
    // " M rules/rule-foo.md"（前导空格是状态码的一部分），全量 trim() 会把首行前导空格吃掉，
    // 导致按固定偏移 slice(3) 解析路径时错位（parsePorcelain 依赖这个固定偏移）。
    return execSync(`git -C "${pluginRoot}" ${cmd}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).replace(/\s+$/, '');
  } catch (e) {
    if (allowFail) return '';
    throw e;
  }
}

export function currentBranch(pluginRoot) {
  return git(pluginRoot, 'rev-parse --abbrev-ref HEAD', true) || 'HEAD';
}

function configKey(branch) {
  return `branch.${branch}.${CONFIG_KEY_SUFFIX}`;
}

function pathspecArgs() {
  return MONITORED_PATHS.map((p) => `"${p}"`).join(' ');
}

function parseNameOnly(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function parsePorcelain(output) {
  if (!output) return [];
  // 不能先对整行 trim() 再 slice(3) —— porcelain 每行前两个字符是状态码（未改动的一侧用空格占位，
  // 例如 " M path" 表示"已暂存无改动、working tree 有修改"），先 trim 会把这个有意义的前导空格吃掉，
  // 导致 slice(3) 少切一个字符，路径解析错位。
  return output
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => l.slice(3).trimEnd())
    .map((p) => {
      // rename/copy 行是 "old_path -> new_path" 组合成一个字符串（Round 2 复审 W4：原实现
      // 直接把这整段当路径返回，既不是有效路径也无法用于 pathspec 过滤匹配）——取箭头后的新路径，
      // 因为对增量检测而言"文件现在在哪"才是有意义的状态。
      const arrowIdx = p.indexOf(' -> ');
      return arrowIdx === -1 ? p : p.slice(arrowIdx + 4);
    });
}

// 读取当前分支的 baseline，判断自 baseline 以来 rules/skills/commands/hooks/scripts 等受监控路径是否有变化。
// 返回:
//   null                                     — 首次运行（无 baseline）或 baseline 不可达（降级），调用方应走全量分支
//   { commitDiff: string[], dirtyFiles: string[] } — 已提交的变更文件列表 + 未提交的 working tree 变更文件列表
export function diffSinceBaseline(pluginRoot) {
  const branch = currentBranch(pluginRoot);
  const baseline = git(pluginRoot, `config ${configKey(branch)}`, true);
  if (!baseline) {
    return null; // 首次，走全量分支
  }

  const paths = pathspecArgs();
  try {
    const commitDiffRaw = git(pluginRoot, `diff --name-only ${baseline}..HEAD -- ${paths}`);
    const dirtyRaw = git(pluginRoot, `status --porcelain -- ${paths}`);
    return {
      commitDiff: parseNameOnly(commitDiffRaw),
      dirtyFiles: parsePorcelain(dirtyRaw),
    };
  } catch (e) {
    const reason = (e.message || String(e)).split('\n')[0];
    process.stderr.write(`[plugin-dream-baseline] WARN: baseline 不可达（可能因 rebase 丢失）: ${reason}\n`);
    return null; // 降级为全量分支，不让异常冒泡中断命令（C3）
  }
}

// 判断 diffSinceBaseline() 的结果是否代表"有变化"（null 视为有变化，因为 null 意味着走全量分支）。
export function hasChanges(diffResult) {
  if (!diffResult) return true;
  return diffResult.commitDiff.length > 0 || diffResult.dirtyFiles.length > 0;
}

// 把当前分支的 baseline 推进到当前 HEAD（首次运行结束后 / 一轮 /plugin-dream 检查完成后调用）。
export function setBaseline(pluginRoot) {
  const branch = currentBranch(pluginRoot);
  const headSha = git(pluginRoot, 'rev-parse HEAD');
  git(pluginRoot, `config ${configKey(branch)} ${headSha}`);
  return { branch, baseline: headSha };
}

function main() {
  const args = process.argv.slice(2);
  const setFlag = args.includes('--set');
  const pluginRoot = args.find((a) => !a.startsWith('--')) || process.cwd();

  if (setFlag) {
    const result = setBaseline(pluginRoot);
    console.log(JSON.stringify({ action: 'set', ...result }, null, 2));
    return;
  }

  const diff = diffSinceBaseline(pluginRoot);
  console.log(JSON.stringify({ action: 'diff', diff, changed: hasChanges(diff) }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
