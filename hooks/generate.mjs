#!/usr/bin/env node
// 单源生成器: rules/manifest.json → model/agent-catalog-N.md (分片完整路由, 常驻) + hooks/pretooluse-rules.json
// 用法: node hooks/generate.mjs          写出生成物 (并删残留旧分片)
//       node hooks/generate.mjs --check   只校验生成物与源一致, 不一致 exit 1
//
// 设计要点:
// - 完整路由 **常驻** (放 model/agent-catalog-N.md 系列), 不再用 skills/route 按需中转 ——
//   常驻 = 必在 context、无软触发漏; 代价是多占一点常驻 context, 但路由仅 ~5K 字符可控.
// - 按桶切分: 桶为最小切分粒度, 单条 rule 不会被切断.
// - SHARD_LIMIT=9000 留 JSON 包裹+中文余量, 安全低于 hook 截断阈值 10000.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'rules/manifest.json');
const MODEL_DIR = path.join(ROOT, 'model');

export const SHARD_LIMIT = 9000;
// 与 hooks.json SessionStart 预留的 catalog-1/2/3 段对齐. 生成片数超此值 throw, 防"生成第 4 片但 hooks 不注入"的静默漏注入.
// 加新片要先在 hooks/hooks.json 和 hooks/inject-rules.sh 加对应 catalog-N segment, 然后调高这个值.
export const MAX_CATALOG_SHARDS = 3;

export function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

// 桶渲染: 桶 + 子规则四件套(触发/读/摘要/guard/也属) + 跨桶 crossRules(also_buckets 反向可路由).
export function renderBucketBody(m) {
  const byBucket = new Map(m.buckets.map((b) => [b.id, []]));
  for (const r of m.rules) byBucket.get(r.bucket)?.push(r);
  let out = '';
  for (const b of m.buckets) {
    const rules = byBucket.get(b.id) || [];
    if (!rules.length) continue;
    out += `### 桶: ${b.title} (${b.id})\n`;
    out += `**粗触发**: ${b.trigger_summary}\n`;
    out += `**不含 (负例)**: ${b.negatives.join('; ')}\n\n`;
    for (const r of rules) {
      out += `#### ${r.id}\n`;
      out += `**触发**: ${r.trigger_desc}\n`;
      out += `**读**: \`${r.read}\`\n`;
      out += `**摘要**: ${r.summary}\n`;
      if (r.guard) out += `**关键约束(上浮)**: ${r.guard}\n`;
      if ((r.also_buckets || []).length) out += `**也属**: ${r.also_buckets.join(', ')}\n`;
      out += '\n';
    }
    const crossRules = m.rules.filter((r) => (r.also_buckets || []).includes(b.id));
    for (const r of crossRules) {
      out += `#### ${r.id} (跨桶)\n`;
      out += `**触发**: ${r.trigger_desc}\n`;
      out += `**读**: \`${r.read}\`\n`;
      out += `**摘要**: ${r.summary}\n`;
      out += `**主桶**: ${r.bucket} (完整定义见该桶)\n\n`;
    }
  }
  return out;
}

const CATALOG_HEADER_FIRST = `# agent-catalog — nocode-evolve 插件级规则路由 (常驻完整路由)

> 本文件由 \`hooks/generate.mjs\` 从 \`rules/manifest.json\` 生成. **禁手改**——改 rule 改 manifest 后重新生成.
> 完整路由常驻 context (不再用 route skill 中转). 超 SHARD_LIMIT 自动切片 agent-catalog-2.md 等.

## 读取时机

会话开局本文件已在 context. 任何工程任务前扫下方**粗桶**: 命中桶 → 在桶内子规则按 \`触发\` 选具体 rule → \`Read\` 对应 \`rules/rule-*.md\` (同一规则会话只 Read 一次). 命中桶但落「负例」描述 → 不触发.

项目本地资源 (\`.agents-personal/\`) 检索约定见 \`model/agent-personal.md\`. 工程任务流程导航 (生命周期 / 下一步) 主动调 \`Skill(nocode-evolve:pilot)\`.

---

## 规则清单 (按粗桶分组, 完整路由)

`;

const CATALOG_HEADER_CONT = `# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

`;

// 按桶切分完整路由, 超 SHARD_LIMIT 开新片. 桶为最小切分粒度, 不切断单 rule.
export function genCatalogSharded(m) {
  const body = renderBucketBody(m);
  const bucketSections = body.split(/(?=### 桶:)/).filter((s) => s.trim());
  const shards = [];
  let curr = CATALOG_HEADER_FIRST;
  for (const section of bucketSections) {
    if ((curr + section).length > SHARD_LIMIT && curr.length > CATALOG_HEADER_FIRST.length) {
      shards.push(curr);
      curr = CATALOG_HEADER_CONT + section;
    } else {
      curr += section;
    }
  }
  shards.push(curr);
  if (shards.length > MAX_CATALOG_SHARDS) {
    throw new Error(
      `genCatalogSharded: 生成 ${shards.length} 片 > MAX_CATALOG_SHARDS=${MAX_CATALOG_SHARDS}; ` +
      `hooks.json 只预留 ${MAX_CATALOG_SHARDS} 个 catalog segment, 第 ${MAX_CATALOG_SHARDS + 1} 片起会静默漏注入. ` +
      `先在 hooks/hooks.json + hooks/inject-rules.sh 加 catalog-${MAX_CATALOG_SHARDS + 1} segment, 然后调高 MAX_CATALOG_SHARDS.`,
    );
  }
  return shards.map((text, i) => ({
    file: path.join(MODEL_DIR, `agent-catalog-${i + 1}.md`),
    text,
  }));
}

export function genPretooluse(m) {
  return m.rules.flatMap((r) =>
    (r.pretooluse || []).map((p) => ({ rule: r.id, pattern: p.pattern, decision: p.action, reason: p.note })),
  );
}

function targets(m) {
  return [
    { file: path.join(ROOT, 'hooks/pretooluse-rules.json'), text: JSON.stringify(genPretooluse(m), null, 2) + '\n' },
    ...genCatalogSharded(m),
  ];
}

// 检测残留旧 catalog 分片 (分片数变少, 或旧的 agent-catalog.md 无 N).
function findStaleCatalogShards(wantedFiles) {
  const stale = [];
  if (!fs.existsSync(MODEL_DIR)) return stale;
  const wantedSet = new Set(wantedFiles);
  for (const f of fs.readdirSync(MODEL_DIR)) {
    if (/^agent-catalog(-\d+)?\.md$/.test(f)) {
      const full = path.join(MODEL_DIR, f);
      if (!wantedSet.has(full)) stale.push(full);
    }
  }
  return stale;
}

export function renderAll(write) {
  const m = loadManifest();
  const t = targets(m);
  if (write) {
    for (const { file, text } of t) fs.writeFileSync(file, text);
    const wantedCatalogs = t.filter((x) => /agent-catalog(-\d+)?\.md$/.test(x.file)).map((x) => x.file);
    for (const s of findStaleCatalogShards(wantedCatalogs)) {
      fs.unlinkSync(s);
      process.stderr.write(`generate.mjs: 删残留 ${path.relative(ROOT, s)}\n`);
    }
  }
  return t;
}

export function check() {
  const m = loadManifest();
  const drift = [];
  const t = targets(m);
  for (const { file, text } of t) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur !== text) drift.push(path.relative(ROOT, file) + (fs.existsSync(file) ? '' : ' (缺失)'));
  }
  const wantedCatalogs = t.filter((x) => /agent-catalog(-\d+)?\.md$/.test(x.file)).map((x) => x.file);
  for (const s of findStaleCatalogShards(wantedCatalogs)) {
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
      console.error('generate.mjs --check: 生成物与 manifest 漂移: ' + drift.join(', ') + '\n  修法: node hooks/generate.mjs 重新生成并提交.');
      process.exit(1);
    }
    process.exit(0);
  } else {
    renderAll(true);
    const files = targets(loadManifest()).map((t) => path.relative(ROOT, t.file));
    console.error('generate.mjs: 已生成 ' + files.join(', '));
  }
}
