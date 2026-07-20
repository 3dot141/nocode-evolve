#!/usr/bin/env node
// PreToolUse 硬拦截规则源 → hooks/pretooluse-rules.json
// 用法: node scripts/compile.hooks.js          写出 hooks/pretooluse-rules.json
//       node scripts/compile.hooks.js --check   只校验生成物与源一致, 不一致 exit 1
//
// 设计要点: 规则直接硬编码在本文件内, 不读 rules/rule-*.md frontmatter——
// 触发路由(compile.rule.js 那条链)与命令层硬拦截(本链)是两件独立的事,
// 各自单源, 互不耦合。hooks/pretooluse-guard.mjs 消费端字段不变
// (rule/pattern/decision/reason)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'hooks/pretooluse-rules.json');

export const RULES = [
  {
    rule: 'git-worktree',
    pattern: '(?:^|[;&|])\\s*git\\s+worktree\\s+add\\b',
    decision: 'inject',
    reason:
      '建 worktree 前先 Read rule-git-worktree.md: 落 <project>-<branch>/, 建后调 worktree-setup.mjs setup 补齐(cp env/IDE + 从零 install + symlink). 前置 (?:^|[;&|])\\s* 限定命令位置, 不命中 quote/heredoc 内字面文本',
  },
  {
    rule: 'git-worktree',
    pattern: 'git\\s+(checkout\\s+-[bB]|switch\\s+-[cC]|branch\\s+[^-\\s|]\\S*)',
    decision: 'inject',
    reason:
      '原则: 每个分支都要 worktree。别在主仓裸开 branch, 先 Read rule-git-worktree.md 走 git worktree add 落 <project>-<branch>/. branch 段 [^-\\s|] 排除 -flag 和 pipe 查询, 只命中新建 git branch <name>',
  },
  {
    rule: 'git-freshness',
    pattern: '\\b(grep\\s+(-[a-zA-Z]*r|-[a-zA-Z]*\\s+-r|--recursive)|rg\\s+)\\b',
    decision: 'inject',
    reason: '代码搜索 (grep -r / rg) 前先跑 freshness-check.mjs 确认分支不过时',
  },
  {
    rule: 'git-freshness',
    pattern: '\\bfind\\s+.*\\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|rb|vue|svelte)\\b',
    decision: 'inject',
    reason: 'find 搜代码文件前先跑 freshness-check.mjs 确认分支不过时',
  },
  {
    rule: 'personal-deletion-guard',
    pattern: '\\b(rm|mv)\\s+.*(\\.agents-personal/|\\$USER_VAULT_PATH/|\\$\\{USER_VAULT_PATH\\})',
    decision: 'inject',
    reason:
      'rm/mv 命中 .agents-personal/ 或 $USER_VAULT_PATH/ 下路径 — 这些是 gitignored 用户沉淀, 不可恢复. 停手, 描述将删什么 + 原因 + 影响, 等用户明确确认 (model/agent-personal.md 删除护栏)',
  },
  {
    rule: 'personal-deletion-guard',
    pattern: 'find\\s+.*(\\.agents-personal|\\$USER_VAULT_PATH|\\$\\{USER_VAULT_PATH\\}).*-delete\\b',
    decision: 'inject',
    reason: 'find -delete 命中 .agents-personal/ 或 $USER_VAULT_PATH/ — 批量删除等同 rm, 停手二次确认 (model/agent-personal.md 删除护栏)',
  },
];

export function render() {
  return JSON.stringify(RULES, null, 2) + '\n';
}

export function check() {
  const want = render();
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  return cur === want ? [] : [path.relative(ROOT, OUT) + (fs.existsSync(OUT) ? '' : ' (缺失)')];
}

export function writeOut() {
  fs.writeFileSync(OUT, render());
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const checkMode = process.argv.includes('--check');
  if (checkMode) {
    const drift = check();
    if (drift.length) {
      console.error('compile.hooks.js --check: 生成物与源漂移: ' + drift.join(', ') + '\n  修法: node scripts/compile.hooks.js 重新生成并提交.');
      process.exit(1);
    }
    process.exit(0);
  } else {
    writeOut();
    console.error('compile.hooks.js: 已生成 hooks/pretooluse-rules.json');
  }
}
