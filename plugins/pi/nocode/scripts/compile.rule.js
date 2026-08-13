#!/usr/bin/env node
// 单源生成器: rules/rule-*.md frontmatter → model/agent-rule-catalog-N.md (扁平完整路由, 常驻)
// 用法: node scripts/compile.rule.js          写出生成物 (并删残留旧分片)
//       node scripts/compile.rule.js --check   只校验生成物与源一致, 不一致 exit 1
//
// 设计要点:
// - 无 manifest.json 中转——每条 rule 的路由信息(name/description/skip)直接写在
//   对应 rules/rule-*.md 顶部 frontmatter 里, 单文件即单源。
// - 不分桶。扁平表格, 一条 rule 一行(文件相对地址 + description), 仿 skill 的
//   name+description 密度自筛, 不再需要"桶级粗触发摘要"这层中间抽象。
// - 按行切分, 超 SHARD_LIMIT 自动开新片 (agent-rule-catalog-2.md 等)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_DIR = path.join(ROOT, 'rules');
const MODEL_DIR = path.join(ROOT, 'model');

export const SHARD_LIMIT = 9000;
// 与 hooks.json SessionStart 预留的 model-rule-catalog-1..5 段对齐. 生成片数超此值 throw,
// 防静默漏注入. 加新片要先在 hooks/hooks.json 和 hooks/inject-rules.sh 加对应 segment,
// 然后调高这个值.
export const MAX_CATALOG_SHARDS = 5;

// 极简 frontmatter 解析器——只认本仓库 rule 文件实际用到的子集, 不引入 YAML 依赖:
//   name: <单行 scalar>
//   description: >- (折叠标量, 后续缩进行拼一行, 单换行折成空格, 貼合 YAML 折叠语义)
//   skip: true|false
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return null;
  const lines = m[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    const [, key, rest] = kv;
    if (rest === '>-' || rest === '>') {
      const buf = [];
      i++;
      while (i < lines.length && /^\s+\S/.test(lines[i])) {
        buf.push(lines[i].trim());
        i++;
      }
      i--;
      data[key] = buf.join(' ');
    } else if (rest === 'true' || rest === 'false') {
      data[key] = rest === 'true';
    } else {
      data[key] = rest.trim();
    }
  }
  return data;
}

export function loadRules() {
  const files = fs
    .readdirSync(RULES_DIR)
    .filter((f) => /^rule-.*\.md$/.test(f))
    .sort();
  return files.map((f) => {
    const full = path.join(RULES_DIR, f);
    const data = parseFrontmatter(fs.readFileSync(full, 'utf8'));
    if (!data) throw new Error(`compile.rule.js: rules/${f} 缺 frontmatter (name/description/skip)`);
    if (!data.name) throw new Error(`compile.rule.js: rules/${f} frontmatter 缺 name`);
    if (!data.description) throw new Error(`compile.rule.js: rules/${f} frontmatter 缺 description`);
    return { id: data.name, description: data.description, skip: data.skip === true, relPath: `rules/${f}` };
  });
}

function header(n, platform) {
  const pluginRoot = platform === 'codex' ? '{PLUGIN_ROOT}' : '{CLAUDE_PLUGIN_ROOT}';
  return `# agent-rule-catalog-${n}

> 当前章节为 规则目录
> 当前是第 ${n} 页

> 下面的文件是相对目录，相对于 ${pluginRoot}

`;
}

const TABLE_HEAD = '| 文件相对地址 | 描述 |\n|---|---|\n';

function renderRow(r) {
  const desc = r.description.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return `| ${r.relPath} | ${desc} |`;
}

// 按行切分成分片. 一行(一条 rule)为最小切分粒度, 不切断单行.
export function genCatalogSharded(rules, platform = process.env.NOCODE_PLATFORM || 'claude') {
  const rows = rules.filter((r) => !r.skip).map(renderRow);
  const groups = [[]];
  for (const row of rows) {
    const gi = groups.length - 1;
    const n = gi + 1;
    const prospective = header(n, platform) + TABLE_HEAD + [...groups[gi], row].join('\n') + '\n';
    if (groups[gi].length && prospective.length > SHARD_LIMIT) {
      groups.push([row]);
    } else {
      groups[gi].push(row);
    }
  }
  if (groups.length > MAX_CATALOG_SHARDS) {
    throw new Error(
      `compile.rule.js: 生成 ${groups.length} 片 > MAX_CATALOG_SHARDS=${MAX_CATALOG_SHARDS}; ` +
        `hooks.json 只预留 ${MAX_CATALOG_SHARDS} 个 model-rule-catalog segment, 第 ${MAX_CATALOG_SHARDS + 1} 片起会静默漏注入. ` +
        `先在 hooks/hooks.json + hooks/inject-rules.sh 加 model-rule-catalog-${MAX_CATALOG_SHARDS + 1} segment, 然后调高 MAX_CATALOG_SHARDS.`,
    );
  }
  return groups.map((rowsInShard, i) => {
    const n = i + 1;
    return {
      file: path.join(MODEL_DIR, `agent-rule-catalog-${n}.md`),
      text: header(n, platform) + TABLE_HEAD + rowsInShard.join('\n') + '\n',
    };
  });
}

// 检测残留旧分片 (改名前的 agent-catalog-N.md, 或分片数变少后的多余 agent-rule-catalog-N.md).
// 不碰 agent-catalog-using.md (后缀非纯数字, 手工文件).
function findStaleCatalogShards(wantedFiles) {
  const stale = [];
  if (!fs.existsSync(MODEL_DIR)) return stale;
  const wantedSet = new Set(wantedFiles);
  for (const f of fs.readdirSync(MODEL_DIR)) {
    if (/^agent-(rule-)?catalog(-\d+)?\.md$/.test(f)) {
      const full = path.join(MODEL_DIR, f);
      if (!wantedSet.has(full)) stale.push(full);
    }
  }
  return stale;
}

export function renderAll(write) {
  const rules = loadRules();
  const shards = genCatalogSharded(rules);
  if (write) {
    for (const { file, text } of shards) fs.writeFileSync(file, text);
    const wanted = shards.map((s) => s.file);
    for (const s of findStaleCatalogShards(wanted)) {
      fs.unlinkSync(s);
      process.stderr.write(`compile.rule.js: 删残留 ${path.relative(ROOT, s)}\n`);
    }
  }
  return shards;
}

export function check() {
  const rules = loadRules();
  const shards = genCatalogSharded(rules);
  const drift = [];
  for (const { file, text } of shards) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur !== text) drift.push(path.relative(ROOT, file) + (fs.existsSync(file) ? '' : ' (缺失)'));
  }
  for (const s of findStaleCatalogShards(shards.map((s) => s.file))) {
    drift.push(path.relative(ROOT, s) + ' (残留, 应删)');
  }
  return drift;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const checkMode = process.argv.includes('--check');
  if (checkMode) {
    const drift = check();
    if (drift.length) {
      console.error('compile.rule.js --check: 生成物与源漂移: ' + drift.join(', ') + '\n  修法: node scripts/compile.rule.js 重新生成并提交.');
      process.exit(1);
    }
    process.exit(0);
  } else {
    const shards = renderAll(true);
    console.error('compile.rule.js: 已生成 ' + shards.map((s) => path.relative(ROOT, s.file)).join(', '));
  }
}
