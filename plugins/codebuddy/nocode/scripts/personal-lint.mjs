#!/usr/bin/env node
// 扫描所有装了插件的项目，检查 .agents-personal/AGENTS.md 变量名是否和插件当前定义匹配。
//
// 发现路径: ~/.nocode/personal-history/ 里的 bare repo → git show HEAD:AGENTS.md
// 对比来源: model/agent-about.md 里的变量表
//
// 用法: node scripts/personal-lint.mjs [--json]
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const JSON_OUTPUT = process.argv.includes('--json');
const pluginRoot = join(dirname(new URL(import.meta.url).pathname), '..');

function parsePluginVariables() {
  const content = readFileSync(join(pluginRoot, 'model', 'agent-about.md'), 'utf8');
  const vars = new Set();
  for (const m of content.matchAll(/\|\s*`\{(\w+)\}`\s*\|/g)) vars.add(m[1]);
  return vars;
}

function extractUsedVariables(content) {
  const vars = [];
  for (const m of content.matchAll(/^\s*(?:<!--\s*)?\{(\w+)\}\s*=\s*(.+?)(?:\s*-->)?$/gm)) {
    vars.push({ name: m[1], value: m[2].trim() });
  }
  return vars;
}

function gitShow(bareDir, path) {
  return execSync(`git --git-dir="${bareDir}" show HEAD:${path}`, {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function projectIdFromPath(projectRoot) {
  const name = basename(projectRoot);
  const hash = createHash('md5').update(projectRoot).digest('hex').slice(0, 8);
  return `${name}-${hash}`;
}

function tryResolveProjectPath(repoId) {
  const projectName = repoId.replace(/-[a-f0-9]{8}$/, '');
  const candidates = [
    join(homedir(), 'AI', projectName),
    join(homedir(), 'code', projectName),
    join(homedir(), 'projects', projectName),
    join(homedir(), 'work', projectName),
    join(homedir(), projectName),
  ];
  for (const c of candidates) {
    const personalDir = join(c, '.agents-personal');
    if (!existsSync(personalDir)) continue;
    try {
      const realRoot = realpathSync(dirname(realpathSync(personalDir)));
      if (projectIdFromPath(realRoot) === repoId) return realRoot;
    } catch { /* skip */ }
  }
  return null;
}

// --- main ---
const knownVars = parsePluginVariables();
const historyRoot = process.env.NOCODE_HISTORY_ROOT || join(homedir(), '.nocode', 'personal-history');

if (!existsSync(historyRoot)) {
  console.log(JSON_OUTPUT
    ? JSON.stringify({ error: 'no_history_root', path: historyRoot })
    : `✗ 未找到 ${historyRoot}`);
  process.exit(0);
}

const entries = readdirSync(historyRoot).filter(n => {
  try { return statSync(join(historyRoot, n)).isDirectory(); } catch { return false; }
});

const results = [];

for (const repoId of entries) {
  const bareDir = join(historyRoot, repoId);
  const projectPath = tryResolveProjectPath(repoId);

  let content;
  let source;
  if (projectPath) {
    const livePath = join(projectPath, '.agents-personal', 'AGENTS.md');
    try { content = readFileSync(livePath, 'utf8'); source = 'live'; } catch { /* fall through */ }
  }
  if (!content) {
    try { content = gitShow(bareDir, 'AGENTS.md'); source = 'snapshot'; } catch { continue; }
  }

  const usedVars = extractUsedVariables(content);
  const stale = [];
  for (const v of usedVars) {
    if (!knownVars.has(v.name) && v.name !== 'username') {
      stale.push(v);
    }
  }

  results.push({
    repoId,
    projectPath,
    source,
    totalVars: usedVars.length,
    staleVars: stale,
  });
}

if (JSON_OUTPUT) {
  console.log(JSON.stringify({
    pluginVars: [...knownVars].sort(),
    scanned: results.length,
    withIssues: results.filter(r => r.staleVars.length > 0).length,
    results,
  }, null, 2));
  process.exit(0);
}

// human output
const issues = results.filter(r => r.staleVars.length > 0);
console.log(`扫描 ${results.length} 个项目 (from ${historyRoot})\n`);

if (issues.length === 0) {
  console.log(`✓ 全部匹配，无旧变量名`);
} else {
  console.log(`⚠ ${issues.length} 个项目有旧变量名:\n`);
  for (const r of issues) {
    const label = r.projectPath || r.repoId;
    console.log(`  ${label}`);
    for (const s of r.staleVars) {
      console.log(`    ✗ {${s.name}} — 不在插件当前变量列表`);
      console.log(`      ${s.name} = ${s.value}`);
    }
    console.log();
  }
}

console.log(`\n插件当前变量: ${[...knownVars].sort().join(', ')}`);
