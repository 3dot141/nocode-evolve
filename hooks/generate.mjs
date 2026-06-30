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
// 与 hooks.json SessionStart 预留的 catalog-1..5 段对齐. 生成片数超此值 throw, 防静默漏注入.
// 加新片要先在 hooks/hooks.json 和 hooks/inject-rules.sh 加对应 catalog-N segment, 然后调高这个值.
export const MAX_CATALOG_SHARDS = 5;

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
      if (r.read && !r.read.startsWith('(')) out += `**摘要**: ${r.summary}\n`;
      if (r.guard) out += `**关键约束(上浮)**: ${r.guard}\n`;
      if ((r.also_buckets || []).length) out += `**也属**: ${r.also_buckets.join(', ')}\n`;
      if (r.lifecycle_stage) out += `**生命周期**: ${r.lifecycle_stage}\n`;
      out += '\n';
    }
    const crossRules = m.rules.filter((r) => (r.also_buckets || []).includes(b.id));
    for (const r of crossRules) {
      out += `#### ${r.id} (跨桶)\n`;
      out += `**触发**: ${r.trigger_desc}\n`;
      out += `**读**: \`${r.read}\`\n`;
      if (r.read && !r.read.startsWith('(')) out += `**摘要**: ${r.summary}\n`;
      out += `**主桶**: ${r.bucket} (完整定义见该桶)\n\n`;
    }
  }
  return out;
}

const CATALOG_HEADER_FIRST = `# agent-catalog — nocode-evolve 插件级规则路由 (常驻完整路由)

> 本文件由 \`hooks/generate.mjs\` 从 \`rules/manifest.json\` 生成. **禁手改**——改 rule 改 manifest 后重新生成.
> 完整路由常驻 context (不再用 route skill 中转). 超 SHARD_LIMIT 自动切片 agent-catalog-2.md 等.

## 触发协议 (强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 在动手前先扫下方 4 个粗桶的 trigger_summary 一次**:

- 命中桶 → 在桶内子规则按 \`触发\` 选具体 rule → \`Read\` 对应 \`rules/rule-*.md\` (同一规则会话只 Read 一次)
- 命中桶但落「负例」描述 → 不触发
- 全不命中 → 直接动作 (无 rule 约束)

**这是工序, 不是自觉**——不论任务大小、context 深度、是否 mid-task, Step 0 都先扫. 跳过 = 软触发漏, 这正是 catalog 常驻设计要解决的.

**Fork/subagent 触发降级**: fork/subagent 的 Step 0 扫桶只按其 **prompt 意图** 匹配, 不按执行中读到的内容匹配. 读到 UI 内容 ≠ 用户要求做 UI 设计; 读到测试代码 ≠ 用户要求跑 TDD. 执行中遇到与 prompt 无关的 skill 命中 → 跳过, 不触发. 同理, 不在 prompt 范围外 TaskCreate / 调 workflow skill (devflow/pdflow/pd-ui 等).

## 何时主动调用 /devflow

agent 视角: 用户任务命中以下任一条件时, **主动调起 devflow skill** 进入流程导航 (devflow 给阶段判断 + 下一步建议, 用户拍板, 不替执行):

- 跨文件 + 状态未知 (不知道当前在生命周期哪一步)
- 需要 commit / PR / 设计文档 / 评审等多阶段动作
- 用户描述含「整个 / 整体 / 全流程 / 从头 / 完整跑通」等多步信号

不触发 (直接动手, 不建议 /devflow): 单文件修改、纯查询、单步明确动作.

> 项目本地资源 (\`.agents-personal/\`) 检索约定见 \`model/agent-personal.md\`. /devflow 可被 model 主动调起, 也可用户 \`/调\`; 命中上述复杂多步条件时直接进 devflow, 由 devflow 给流程建议、用户拍板.

## 何时主动建议 /distill · /sow · /task (用户主动键入 command)

这 3 个是用户主动键入 \`/<name>\` 的**操作型 command** (有副作用: 写文件 / 改 vault / 改 task 状态), **不自动触发**. agent 在命中以下场景时**主动一句话建议**用户键入, **不替用户键**:

- **\`/distill\`** — 会话末沉淀分流 (五出口: 项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip). 命中: 用户说「沉淀一下 / 归档这个会话 / 把刚才讨论的保留下来」且会话已有可沉淀产出
- **\`/sow <意图>\`** — 归档到用户 vault (\`Inbox\` / \`Inputs\` / \`Outputs\` 三层). 命中: 用户说「sow 到 vault / 归档到外部 / 写到 vault / 保存这个想法」+ 有明确意图
- **\`/task <意图>\`** — 任务管理 (8 sub-action: add / update / done / cancel / wrap-day / carry-over / breakdown / start-week). 命中: 用户说「加 task / 改 task / task 完成 / 列今天 task / 拆解 task / 周开始」等任务动作

不触发 (纯讨论 / 元讨论, 不命中): 用户说「要不要 sow 这个」「task 这块要不要重构」「distill 设计怎么改」等讨论性表达——是元讨论不是动作.

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
