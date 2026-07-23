#!/usr/bin/env node
// plugin-dream 的增量 baseline 判断 —— 复用 freshness-check.mjs 的 git config 隔离模式（branch.<branch>.xxx）.
// 供 commands/plugin-dream.md 的 Layer2 调用（library），也可独立跑 CLI 自检:
//   node scripts/plugin-dream-baseline.mjs [pluginRoot]           查看当前 diff 判断
//   node scripts/plugin-dream-baseline.mjs --set [pluginRoot]     写入/推进 baseline 到当前 HEAD
//
// baseline 存储: git config branch.<branch>.nocode-plugin-dream-baseline
//   key 按分支隔离，不用全局 key —— 避免多 worktree/分支同时跑 /plugin-dream 时互相覆盖 baseline（红军 C7 修复，
//   与 rule-git-worktree.md 已验证的 branch.<branch>.nocode-base 模式一致）.
//
// 监控共享源、adapter、metadata、packager 与双 marketplace；plugins/ 是生成物，不作源变化判断。
//
// Review 复审 C1 修复：分支名允许包含 `$`/`;` 等 shell 元字符（git check-ref-format 只禁空格/
// 控制字符等），此前这里用字符串拼接 `branch.${branch}...` 塞进 execSync 的 shell 命令，
// 精心构造的分支名（如 `pwn;touch${IFS}/tmp/x`）会在 currentBranch/diffSinceBaseline/
// setBaseline 里触发任意命令执行（已用 PoC 复现）。改用 git-exec.mjs 的 execFileSync 参数
// 数组调用——分支名无论含什么字符都只是一个 argv 元素，不会被 shell 解释。
//
// 设计: docs/dev/3dot141/260701-01-dream-incremental/dream-incremental-design.md（PluginRepo 域）
import { fileURLToPath } from 'node:url';
import { git, parsePorcelain } from './git-exec.mjs';

const CONFIG_KEY_SUFFIX = 'nocode-plugin-dream-baseline';

export const MONITORED_PATHS = [
  'rules/',
  'skills/',
  'commands/',
  'hooks/',
  'scripts/',
  'core/',
  'adapters/',
  'plugin/metadata.json',
  '.claude-plugin/marketplace.json',
  '.agents/plugins/marketplace.json',
];

export function currentBranch(pluginRoot) {
  return git({ cwd: pluginRoot }, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }) || 'HEAD';
}

function configKey(branch) {
  return `branch.${branch}.${CONFIG_KEY_SUFFIX}`;
}

function parseNameOnly(output) {
  if (!output) return [];
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// 读取当前分支的 baseline，判断自 baseline 以来 rules/skills/commands/hooks/scripts 等受监控路径是否有变化。
// 返回:
//   null                                     — 首次运行（无 baseline）或 baseline 不可达（降级），调用方应走全量分支
//   { commitDiff: string[], dirtyFiles: string[] } — 已提交的变更文件列表 + 未提交的 working tree 变更文件列表
export function diffSinceBaseline(pluginRoot) {
  const branch = currentBranch(pluginRoot);
  const baseline = git({ cwd: pluginRoot }, ['config', configKey(branch)], { allowFail: true });
  if (!baseline) {
    return null; // 首次，走全量分支
  }

  try {
    const commitDiffRaw = git({ cwd: pluginRoot }, ['diff', '--name-only', `${baseline}..HEAD`, '--', ...MONITORED_PATHS]);
    const dirtyRaw = git({ cwd: pluginRoot }, ['status', '--porcelain', '--', ...MONITORED_PATHS]);
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
  const headSha = git({ cwd: pluginRoot }, ['rev-parse', 'HEAD']);
  git({ cwd: pluginRoot }, ['config', configKey(branch), headSha]);
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
