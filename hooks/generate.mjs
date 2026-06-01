#!/usr/bin/env node
// 单源生成器: rules/manifest.json → model/agent-catalog.md + hooks/triggers.json + hooks/pretooluse-rules.json
// 用法: node hooks/generate.mjs          写出生成物
//       node hooks/generate.mjs --check   只校验生成物与源一致, 不一致 exit 1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'rules/manifest.json');

export function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

export function genTriggers(m) {
  // 复现现有 hooks/triggers.json 格式: [{rule, action, patterns, note}]
  return m.rules
    .filter((r) => r.triggers && r.triggers.length)
    .map((r) => ({ rule: r.id, action: r.action, patterns: r.triggers, note: r.guard || '' }));
}

export function genCatalog(m) {
  const byBucket = new Map(m.buckets.map((b) => [b.id, []]));
  for (const r of m.rules) byBucket.get(r.bucket)?.push(r);

  let out = '# agent-catalog — nocode-evolve 插件级规则路由表\n\n';
  out += '> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成。**禁手改**——改 rule 改 manifest 后重新生成。\n\n';
  out += '## 读取时机\n\n会话开局本文件已在 context。响应任何任务前扫一眼下方**粗桶**匹配触发: 先命中桶(粗触发宽, 易命中), 再在桶内子规则里按 `触发` 选具体 rule → `Read` 对应文件。同一规则会话内只 Read 一次。命中桶但落在「负例」描述里 → 不触发。\n\n---\n\n## 规则清单（按粗桶分组）\n\n';

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
  }
  return out;
}

export function genPretooluse(m) {
  // 扁平化: [{rule, pattern, decision, reason}]; decision = "inject" | "block"
  return m.rules.flatMap((r) =>
    (r.pretooluse || []).map((p) => ({ rule: r.id, pattern: p.pattern, decision: p.action, reason: p.note })),
  );
}

// 生成物路径与渲染内容的单一映射
function targets(m) {
  return [
    { file: path.join(ROOT, 'hooks/triggers.json'), text: JSON.stringify(genTriggers(m), null, 2) + '\n' },
    { file: path.join(ROOT, 'hooks/pretooluse-rules.json'), text: JSON.stringify(genPretooluse(m), null, 2) + '\n' },
    { file: path.join(ROOT, 'model/agent-catalog.md'), text: genCatalog(m) },
  ];
}

export function renderAll(write) {
  const m = loadManifest();
  const t = targets(m);
  if (write) for (const { file, text } of t) fs.writeFileSync(file, text);
  return t;
}

export function check() {
  // 返回不一致的文件名数组; 空 = 一致
  const drift = [];
  for (const { file, text } of targets(loadManifest())) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur !== text) drift.push(path.relative(ROOT, file));
  }
  return drift;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const checkMode = process.argv.includes('--check');
  if (checkMode) {
    const drift = check();
    if (drift.length) {
      console.error('generate.mjs --check: 生成物与 manifest 漂移: ' + drift.join(', ') + '\n  修法: node hooks/generate.mjs 重新生成并提交。');
      process.exit(1);
    }
    process.exit(0);
  } else {
    renderAll(true);
    console.error('generate.mjs: 已从 manifest 重新生成 ' + targets(loadManifest()).map((t) => path.relative(ROOT, t.file)).join(', '));
  }
}
