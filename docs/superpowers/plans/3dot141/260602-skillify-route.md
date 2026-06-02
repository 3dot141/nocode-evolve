# skillify-route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把插件的 rule 路由与 4 个 command 统一成 skill 体系——新增 `nocode-evolve:route` 路由 skill 作单一入口，catalog 精简常驻做第 1 重触发，UserPromptSubmit 正则退役，PreToolUse 硬拦截保留。

**Architecture:** `rules/manifest.json` 仍是单源；`generate.mjs` 改为生成「精简 catalog + route 正文生成区 + pretooluse」三件（不再生成 triggers.json）。route SKILL.md = 生成区（rule 路由表，marker 圈定）+ 手写区（项目本地约定 §1/§2 + behavior 型规则内联）。4 个 command 迁成 `skills/<x>/SKILL.md` + `disable-model-invocation: true`。

**Tech Stack:** Node.js ESM (`hooks/*.mjs`)、`node --test`、bash hook、Claude Code plugin（commands/skills/hooks）。

依赖序：Task 1-4（generate.mjs 单源，TDD）→ Task 5（route 骨架）→ Task 6（model 改造）→ Task 7（hooks）→ Task 8-11（command 迁移）→ Task 12（退役清理）→ Task 13（版本 + 全 verify）→ Task 14（go/no-go）。

参考 spec：`docs/superpowers/specs/3dot141/260602-skillify-route-design.md`。所有路径相对 worktree 根 `/Users/yes365/AI/nocode-evolve-design_skillify-route/`。

---

## File Structure

- `hooks/generate.mjs` — 单源生成器。新增 `patchGeneratedRegion` / `genCatalogSlim` / `genRouteTable`，删 `genTriggers`，改 `targets()` / `check()` / `renderAll()`。
- `hooks/generate.test.mjs` — 对应单测。删 triggers 断言，加新函数断言。
- `skills/route/SKILL.md` — 新建。frontmatter + 生成区 marker + 手写区②③。
- `model/agent-catalog.md` — 由 generate 生成（精简版）。
- `model/agent-about.md` — 吸收原 agent-personal §3 删除护栏。
- `model/agent-personal.md` — 删除（§1/§2 入 route，§3 入 about）。
- `hooks/inject-rules.sh` — 删 model-personal segment，grep 目标改 route。
- `hooks/hooks.json` — 删 model-personal command + 整个 UserPromptSubmit 块。
- `hooks/trigger-resurface.mjs` / `hooks/triggers.json` — 删除。
- `skills/{distill,sow,task,rule-eval}/SKILL.md` — 由 `commands/*.md` 迁入。
- `skills/sow/sow-reference/` — 由 `commands/sow-reference/` 挪入。
- `commands/` — 整目录删除。
- `.claude-plugin/plugin.json` — version → 3.0.0。

---

## Task 1: generate.mjs 新增 patchGeneratedRegion（marker 区间替换）

**Files:**
- Modify: `hooks/generate.mjs`
- Test: `hooks/generate.test.mjs`

- [ ] **Step 1: 写失败测试**

在 `hooks/generate.test.mjs` 末尾追加（先确认顶部已有 `import { ... } from './generate.mjs'`，把 `patchGeneratedRegion` 加进 import 列表）：

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { patchGeneratedRegion } from './generate.mjs';

test('patchGeneratedRegion 只替换 marker 区间，手写区保留', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
  const f = path.join(dir, 'SKILL.md');
  fs.writeFileSync(f,
    '手写头\n<!-- BEGIN generated: rule-routes (from manifest, 禁手改) -->\nOLD\n<!-- END generated: rule-routes -->\n手写尾\n');
  const out = patchGeneratedRegion(f, 'rule-routes', 'NEW BODY');
  assert.match(out, /手写头/);
  assert.match(out, /手写尾/);
  assert.match(out, /NEW BODY/);
  assert.doesNotMatch(out, /OLD/);
});

test('patchGeneratedRegion marker 缺失则抛错（不整文件覆盖）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
  const f = path.join(dir, 'SKILL.md');
  fs.writeFileSync(f, '没有 marker 的文件\n');
  assert.throws(() => patchGeneratedRegion(f, 'rule-routes', 'X'), /缺 marker/);
});

test('patchGeneratedRegion 文件不存在则抛错', () => {
  assert.throws(() => patchGeneratedRegion('/nonexistent/SKILL.md', 'rule-routes', 'X'), /不存在/);
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: FAIL —— `patchGeneratedRegion is not a function` / import 报错。

- [ ] **Step 3: 实现 patchGeneratedRegion**

在 `hooks/generate.mjs` 的 `genPretooluse` 之后插入：

```javascript
// route SKILL.md 生成区: 只替换 marker 之间内容, marker 外手写区不动
export function patchGeneratedRegion(file, regionName, body) {
  const begin = `<!-- BEGIN generated: ${regionName} (from manifest, 禁手改) -->`;
  const end = `<!-- END generated: ${regionName} -->`;
  if (!fs.existsSync(file)) throw new Error(`patchGeneratedRegion: ${file} 不存在`);
  const cur = fs.readFileSync(file, 'utf8');
  const bi = cur.indexOf(begin);
  const ei = cur.indexOf(end);
  if (bi < 0 || ei < 0) throw new Error(`patchGeneratedRegion: ${file} 缺 marker '${regionName}'`);
  if (cur.indexOf(begin, bi + begin.length) >= 0 || cur.indexOf(end, ei + end.length) >= 0)
    throw new Error(`patchGeneratedRegion: ${file} marker '${regionName}' 重复`);
  const before = cur.slice(0, bi + begin.length);
  const after = cur.slice(ei);
  return `${before}\n${body}\n${after}`;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: PASS（3 个新 test 通过；旧 test 暂可能因后续 task 才改而仍引用 genTriggers——若旧 test 全绿则更好）。

- [ ] **Step 5: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add hooks/generate.mjs hooks/generate.test.mjs
git commit -m "feat(generate): 新增 patchGeneratedRegion marker 区间替换 (skillify-route Task 1)"
```

---

## Task 2: generate.mjs genCatalogSlim（精简 catalog）

**Files:**
- Modify: `hooks/generate.mjs`
- Test: `hooks/generate.test.mjs`

- [ ] **Step 1: 写失败测试**

追加到 `hooks/generate.test.mjs`：

```javascript
import { genCatalogSlim, loadManifest } from './generate.mjs';

test('genCatalogSlim 含 4 粗桶 + 调 route，不含单 rule 细节', () => {
  const m = loadManifest();
  const out = genCatalogSlim(m);
  for (const b of m.buckets) assert.ok(out.includes(b.title), `缺桶 ${b.title}`);
  assert.match(out, /Skill\(nocode-evolve:route\)/);
  // 不含单条 rule 的「读」路径（那是 route 正文的事）
  assert.doesNotMatch(out, /rules\/rule-finishing-branch\.md/);
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: FAIL —— `genCatalogSlim is not a function`。

- [ ] **Step 3: 实现 genCatalogSlim**

在 `hooks/generate.mjs` 中，保留现有 `genCatalog`（Task 4 再删其调用），新增：

```javascript
export function genCatalogSlim(m) {
  let out = '# agent-catalog — nocode-evolve 插件级粗桶路由\n\n';
  out += '> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成。**禁手改**——改 rule 改 manifest 后重新生成。\n\n';
  out += '## 读取时机\n\n会话开局本文件已在 context。响应任何工程任务前扫下方**粗桶**: 命中任一桶 → 调 `Skill(nocode-evolve:route)` 拿完整路由表(各 rule 触发 / 读哪个文件 / guard)与项目本地资源(.agents-personal wiki/rules)检索约定。纯只读查询 / 纯事实问答不触发。\n\n';
  out += '## 粗桶\n\n';
  for (const b of m.buckets) {
    out += `- **${b.title} (${b.id})**: ${b.trigger_summary}\n`;
    out += `  - 不含(负例): ${b.negatives.join('; ')}\n`;
  }
  out += '\n命中任一桶 → `Skill(nocode-evolve:route)`。同一会话 route 加载一次即可。\n';
  return out;
}
```

- [ ] **Step 4: 运行验证通过**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add hooks/generate.mjs hooks/generate.test.mjs
git commit -m "feat(generate): 新增 genCatalogSlim 精简桶路由 (skillify-route Task 2)"
```

---

## Task 3: generate.mjs genRouteTable（route 正文完整路由）

**Files:**
- Modify: `hooks/generate.mjs`
- Test: `hooks/generate.test.mjs`

- [ ] **Step 1: 写失败测试**

```javascript
import { genRouteTable } from './generate.mjs';

test('genRouteTable 含每条 rule 的触发/读/摘要', () => {
  const m = loadManifest();
  const out = genRouteTable(m);
  for (const r of m.rules) {
    assert.ok(out.includes(r.id), `缺 rule ${r.id}`);
  }
  assert.match(out, /\*\*触发\*\*/);
  assert.match(out, /\*\*读\*\*/);
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: FAIL —— `genRouteTable is not a function`。

- [ ] **Step 3: 实现 genRouteTable**

在 `hooks/generate.mjs` 新增（复用现 genCatalog 的 rule 渲染逻辑，但输出无文件头、供嵌入 route 生成区）：

```javascript
export function genRouteTable(m) {
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
```

- [ ] **Step 4: 运行验证通过**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add hooks/generate.mjs hooks/generate.test.mjs
git commit -m "feat(generate): 新增 genRouteTable 渲染完整 rule 路由 (skillify-route Task 3)"
```

---

## Task 4: generate.mjs 接线（targets/check/renderAll 改，删 genTriggers）

**前置**：Task 5 会先建好 `skills/route/SKILL.md`（含 marker）。本 task 的 renderAll 写 route 区间依赖该文件存在——**执行顺序上 Task 5 的「建骨架」可在本 task 的 Step 3 之前做**。为保持 TDD，本 task 的 test 用临时文件，不依赖真实 route 文件。

**Files:**
- Modify: `hooks/generate.mjs`
- Test: `hooks/generate.test.mjs`

- [ ] **Step 1: 写失败测试**

```javascript
import { renderAll, check } from './generate.mjs';

test('targets 不再含 triggers.json', () => {
  // renderAll(false) 返回 targets 数组（{file,text}），不写盘
  const t = renderAll(false);
  assert.ok(!t.some((x) => x.file.endsWith('triggers.json')), 'triggers.json 不该在 targets');
  assert.ok(t.some((x) => x.file.endsWith('agent-catalog.md')), 'catalog 应在 targets');
  assert.ok(t.some((x) => x.file.endsWith('pretooluse-rules.json')), 'pretooluse 应在 targets');
});

test('catalog target 用 slim 内容', () => {
  const t = renderAll(false);
  const cat = t.find((x) => x.file.endsWith('agent-catalog.md'));
  assert.match(cat.text, /Skill\(nocode-evolve:route\)/);
});
```

- [ ] **Step 2: 运行验证失败**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: FAIL —— 当前 targets 含 triggers.json 且 catalog 用全表。

- [ ] **Step 3: 改 targets / renderAll / check，删 genTriggers**

在 `hooks/generate.mjs`：

(a) 删除 `genTriggers` 函数整段。

(b) 删除文件顶部对 `triggers.json` 路径的依赖；新增 route 路径常量（与 ROOT 并列）：

```javascript
const ROUTE_SKILL = path.join(ROOT, 'skills/route/SKILL.md');
```

(c) 改 `targets`（整文件比对的产物，**不含 route**——route 走区间）：

```javascript
function targets(m) {
  return [
    { file: path.join(ROOT, 'hooks/pretooluse-rules.json'), text: JSON.stringify(genPretooluse(m), null, 2) + '\n' },
    { file: path.join(ROOT, 'model/agent-catalog.md'), text: genCatalogSlim(m) },
  ];
}
```

(d) 改 `renderAll`（写整文件产物 + patch route 区间）：

```javascript
export function renderAll(write) {
  const m = loadManifest();
  const t = targets(m);
  if (write) {
    for (const { file, text } of t) fs.writeFileSync(file, text);
    const routeText = patchGeneratedRegion(ROUTE_SKILL, 'rule-routes', genRouteTable(m));
    fs.writeFileSync(ROUTE_SKILL, routeText);
  }
  return t;
}
```

(e) 改 `check`（整文件产物 + route 区间比对——route 只比对区间，手写区改不算漂移）：

```javascript
export function check() {
  const m = loadManifest();
  const drift = [];
  for (const { file, text } of targets(m)) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur !== text) drift.push(path.relative(ROOT, file));
  }
  if (fs.existsSync(ROUTE_SKILL)) {
    const want = patchGeneratedRegion(ROUTE_SKILL, 'rule-routes', genRouteTable(m));
    const cur = fs.readFileSync(ROUTE_SKILL, 'utf8');
    if (cur !== want) drift.push(path.relative(ROOT, ROUTE_SKILL));
  } else {
    drift.push(path.relative(ROOT, ROUTE_SKILL) + ' (缺失)');
  }
  return drift;
}
```

> 说明：`check` 里 `patchGeneratedRegion(ROUTE_SKILL, ...)` 以**当前** route 文件为基础替换区间，得到「期望全文 = 当前手写区 + 新生成区」，与当前全文比——只有生成区与 manifest 不一致才 drift，手写区改动不误报。

- [ ] **Step 4: 运行验证通过**

Run: `cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node --test hooks/generate.test.mjs`
Expected: PASS（`renderAll(false)` 不写盘，仅返回 targets，故不依赖 route 文件存在）。

- [ ] **Step 5: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add hooks/generate.mjs hooks/generate.test.mjs
git commit -m "refactor(generate): targets/check/renderAll 接线 route+slim, 删 genTriggers (skillify-route Task 4)"
```

---

## Task 5: 建 skills/route/SKILL.md 骨架并生成路由区

**Files:**
- Create: `skills/route/SKILL.md`

- [ ] **Step 1: 建 route SKILL.md（frontmatter + marker + 手写区②③）**

Create `skills/route/SKILL.md`，内容如下（②段取自原 `model/agent-personal.md` §1/§2，③段取自 `rules/manifest.json` 里 git-inspection/git-freshness 摘要）：

```markdown
---
name: route
description: 工程任务规则路由入口。开始任何 git 生命周期(提 PR/push/合并/收尾/worktree)、代码评审/独立验证、设计文档/PRD/RFC/方案选型、会话沉淀类任务前加载，给出插件级规则路由表 + 项目本地资源(.agents-personal wiki/rules)检索约定。不用于：纯只读查询、纯事实问答、与工程规则无关的对话。
---

# nocode-evolve 工程规则路由

会话内首次命中工程任务时加载一次。按下方三段决定动作：① 查插件 rule 路由表 `Read` 对应文件；② 按需检索项目本地资源；③ behavior 型规则直接遵守（已在本文）。

## ① 插件 rule 路由（生成区，禁手改）

<!-- BEGIN generated: rule-routes (from manifest, 禁手改) -->
（由 `node hooks/generate.mjs` 填充，勿手改）
<!-- END generated: rule-routes -->

## ② 项目本地资源 `.agents-personal/`（手写区）

`<project>/.agents-personal/` 是项目本地放给 agent 的资源目录，含：

- `wiki/` — 历史记忆（设计决策 / 术语 / 踩坑）。被动检索，可被新决策 superseded。
- `AGENTS.md` + `rules/` — 当前指令（触发条件 + 操作细节）。主动按触发匹配读。

wiki 是事实记录，rules 是工作指令——不把 wiki 当指令执行，不把 rules 当可质疑历史。

**wiki/**：会话开局只做存在性检查（`ls`），实际 Read `INDEX.md` 推迟到：即将调 `superpowers:brainstorming` / `nocode-evolve:design-doc-writing`，或用户消息含「设计/选型/方案/架构/重构/RFC/提案」，或当前任务升级为以上。INDEX 同一会话只 Read 一次；读了必引用。进一步 Read `pages/<file>` 按需。不要：读了不引用 / 无脑拉所有 pages / 把 wiki 当绝对真理 / 自己写 wiki（沉淀走 `/distill`）。

**AGENTS.md + rules/**：`AGENTS.md` 是路由表只列触发条件；`rules/<topic>.md` 放具体指令，一个 topic 一文件。新会话首次响应实质问题前 Read `AGENTS.md` 一次，`rules/<topic>.md` 按触发命中再 Read，命中即引用。不要：在 AGENTS.md 写命令模板 / 把 rule 当历史质疑 / 自己往 `.agents-personal/` 写（沉淀走 `/distill`）。

> 删除护栏（rm/mv/覆盖 `.agents-personal/` 前二次确认）见常驻 `model/agent-about.md`，本文不重复。

## ③ behavior 型规则（手写区，无关键词触发，随本 skill 加载即生效）

- **git-inspection**：连续跑 ≥2 个 git 只读命令（status / diff / log / show / branch / ls-files / remote -v）时，默认用 `&&` 串成一个 Bash call，各段间插 `echo "---<label>"` 分隔，减少 turn 浪费。
- **git-freshness**：即将开始就地设计性动作（写设计文档/PRD/RFC/ADR、方案对比、技术选型、重构方案）且不走 worktree 时，先 `fetch` + 当前分支拉到最新（behind 则 `pull --rebase`，ahead>0 弹问）。走 worktree 的场景已由 git-worktree fetch 覆盖，本条管就地设计。
```

- [ ] **Step 2: 生成路由区**

Run:
```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route && node hooks/generate.mjs
```
Expected: stderr 打印「已从 manifest 重新生成 ...」；`skills/route/SKILL.md` 的 marker 区间被填入完整路由表。

- [ ] **Step 3: 验证生成 + --check 零漂移**

Run:
```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
grep -c "finishing-branch" skills/route/SKILL.md   # 应 ≥1（路由区已填）
node hooks/generate.mjs --check && echo "CHECK OK"
```
Expected: grep ≥1；`--check` exit 0 + "CHECK OK"。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add skills/route/SKILL.md model/agent-catalog.md
git commit -m "feat(route): 新增 route 路由 skill, catalog 生成为精简版 (skillify-route Task 5)"
```

---

## Task 6: model 改造（about 吸收 §3，删 agent-personal.md）

**Files:**
- Modify: `model/agent-about.md`
- Delete: `model/agent-personal.md`

- [ ] **Step 1: 把 agent-personal §3 整段（含 vault 护栏）追加到 agent-about.md**

打开 `model/agent-personal.md`，复制从 `## §3 删除护栏` 到文件末尾（含末尾 `> $USER_VAULT_PATH:...` 那段）的全部内容。追加到 `model/agent-about.md` 末尾（新起一节），把标题 `## §3 删除护栏 — ...` 改为 `## 删除护栏 — \`.agents-personal/\` + \`$USER_VAULT_PATH\` 删除前必须二次确认`（去掉 §3 序号，因脱离 personal 上下文）。

- [ ] **Step 2: 删 agent-personal.md**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git rm model/agent-personal.md
```

- [ ] **Step 3: 验证护栏已在 about、personal 已删**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
grep -c "USER_VAULT_PATH" model/agent-about.md     # 应 ≥1
test ! -f model/agent-personal.md && echo "personal removed"
```
Expected: grep ≥1；"personal removed"。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add model/agent-about.md
git commit -m "refactor(model): about 吸收删除护栏, 删 agent-personal (§1/§2 已入 route) (skillify-route Task 6)"
```

---

## Task 7: inject-rules.sh + hooks.json（删 personal 段、UserPromptSubmit，grep 改 route）

**Files:**
- Modify: `hooks/inject-rules.sh`
- Modify: `hooks/hooks.json`

- [ ] **Step 1: inject-rules.sh 删 model-personal 分支**

在 `hooks/inject-rules.sh` 的 `seg_file()` 中删除这一行：
```bash
    model-personal) printf '%s' "${PLUGIN_ROOT}/model/agent-personal.md" ;;
```
并把 `MODEL_SEGMENTS` 改为：
```bash
MODEL_SEGMENTS="model-about model-karpathy model-catalog"
```

- [ ] **Step 2: inject-rules.sh 孤儿检查 grep 目标改 route**

在 sanity check 块里，把对 `$catalog` 做 grep 的孤儿检查改为对 route SKILL.md（rules 现在被 route 生成区引用，不再被 catalog 引用）：

```bash
  route_skill="${PLUGIN_ROOT}/skills/route/SKILL.md"
  if [ -d "${PLUGIN_ROOT}/rules" ] && [ -f "$route_skill" ]; then
    for f in "${PLUGIN_ROOT}/rules"/*.md; do
      [ -f "$f" ] || continue
      base=$(basename "$f")
      if ! grep -qF "$base" "$route_skill"; then
        echo "inject-rules.sh WARN: rules/${base} 没被 skills/route/SKILL.md 引用, agent 触发不到. 改 manifest 重新生成或删文件." >&2
      fi
    done
  fi
```
（删除原先对 `$catalog` 的同段 grep 循环。）

- [ ] **Step 3: hooks.json 删 model-personal command + 整个 UserPromptSubmit 块**

在 `hooks/hooks.json`：删除 SessionStart 数组里 `inject-rules.sh model-personal` 那个 command 对象；删除整个 `"UserPromptSubmit": [ ... ]` 键。保留 PreToolUse 不动。改后 SessionStart 只剩 model-about / model-karpathy / model-catalog / project 四个 command。

- [ ] **Step 4: 验证**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
CLAUDE_PLUGIN_ROOT="$PWD" CLAUDE_PROJECT_DIR="$PWD" bash hooks/inject-rules.sh model-personal; echo "exit=$?"   # 期望 exit=1 unknown segment
node -e "const h=require('./hooks/hooks.json'); if(h.hooks.UserPromptSubmit) throw 'UserPromptSubmit 仍在'; if(!h.hooks.PreToolUse) throw 'PreToolUse 不见了'; console.log('hooks.json OK')"
CLAUDE_PLUGIN_ROOT="$PWD" CLAUDE_PROJECT_DIR="$PWD" bash hooks/inject-rules.sh model-catalog | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const n=[...j.hookSpecificOutput.additionalContext].length;if(n>=10000)throw 'catalog 段超 10000';console.log('catalog 段 '+n+' chars OK')})"
```
Expected: `exit=1`；"hooks.json OK"；"catalog 段 NNNN chars OK"（NNNN < 10000）。

- [ ] **Step 5: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add hooks/inject-rules.sh hooks/hooks.json
git commit -m "refactor(hook): 删 model-personal 段 + UserPromptSubmit 退役, grep 改 route (skillify-route Task 7)"
```

---

## Task 8: 迁移 commands/task.md → skills/task/SKILL.md

**Files:**
- Create: `skills/task/SKILL.md`
- Delete: `commands/task.md`（Task 12 统一删 commands/，本 task 先建 skill）

- [ ] **Step 1: 建 skills/task/SKILL.md**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
mkdir -p skills/task
cp commands/task.md skills/task/SKILL.md
```

- [ ] **Step 2: frontmatter 加 disable-model-invocation + 补 name**

编辑 `skills/task/SKILL.md` 的 frontmatter，改为（保留原 description / argument-hint）：
```yaml
---
name: task
description: 任务管理子系统单一入口, AI 解析意图分发到 8 个 sub-action (add / update / done / cancel / wrap-day / carry-over / breakdown / start-week)
argument-hint: <自然语言意图>
disable-model-invocation: true
---
```

- [ ] **Step 3: 核对正文无旧引用 + $ARGUMENTS 保留**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
grep -nE "commands/|agent-catalog" skills/task/SKILL.md || echo "无旧引用"
grep -c '\$ARGUMENTS' skills/task/SKILL.md   # 原样保留, 不改索引（task 用 $ARGUMENTS）
```
Expected: "无旧引用"（若有命中则改为对应 skills/ 路径）；$ARGUMENTS 计数与原 command 一致。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add skills/task/SKILL.md
git commit -m "feat(skill): 迁移 task command → skill + disable-model-invocation (skillify-route Task 8)"
```

---

## Task 9: 迁移 commands/distill.md → skills/distill/SKILL.md（含旧引用 rewrite）

**Files:**
- Create: `skills/distill/SKILL.md`

- [ ] **Step 1: 建文件 + frontmatter**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
mkdir -p skills/distill
cp commands/distill.md skills/distill/SKILL.md
```
编辑 frontmatter 加 `name: distill` 与 `disable-model-invocation: true`（保留 description / argument-hint）。

- [ ] **Step 2: rewrite 旧引用（distill 的 rules:plugin 出口指向旧 catalog 全表机制）**

编辑 `skills/distill/SKILL.md`，按下列改（对照 spec BF3）：
- 把 `rules:plugin` 出口落地描述里「改 `model/agent-catalog.md`」改为「改 `rules/manifest.json` 后 `node hooks/generate.mjs` 重新生成 catalog slim + route 生成区」。
- 把引用 `commands/sow.md` 的链接改为 `skills/sow/SKILL.md`。
- 把「报告 catalog 更新」类文案改为「报告 route 生成区 / catalog slim 更新」。

- [ ] **Step 3: 验证无残留旧引用**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
grep -nE "commands/sow|agent-catalog\.md" skills/distill/SKILL.md || echo "旧引用已清"
```
Expected: "旧引用已清"（catalog 若仅出现在「改 manifest 重新生成 catalog」语境的新文案里可接受，但不应再有「手改 catalog 全表」语义）。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add skills/distill/SKILL.md
git commit -m "feat(skill): 迁移 distill command → skill + rewrite 旧 catalog/sow 引用 (skillify-route Task 9)"
```

---

## Task 10: 迁移 commands/sow.md → skills/sow/SKILL.md（含 sow-reference 挪位 + 脚本路径锚定）

**Files:**
- Create: `skills/sow/SKILL.md`
- Move: `commands/sow-reference/` → `skills/sow/sow-reference/`

- [ ] **Step 1: 建 skill 目录 + 挪 sow-reference**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
mkdir -p skills/sow
cp commands/sow.md skills/sow/SKILL.md
git mv commands/sow-reference skills/sow/sow-reference
```

- [ ] **Step 2: frontmatter + 脚本调用路径锚定插件根**

编辑 `skills/sow/SKILL.md`：
- frontmatter 加 `name: sow` 与 `disable-model-invocation: true`。
- 把正文里所有 `commands/sow-reference/` 路径改为 `${CLAUDE_PLUGIN_ROOT}/skills/sow/sow-reference/`（spec C2：原 `commands/sow.md:107` 用硬编码相对路径，在用户 cwd 跑不通）。

- [ ] **Step 3: 验证路径已锚定、sow-reference 已挪**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
test -d skills/sow/sow-reference && echo "sow-reference moved"
grep -nE "commands/sow-reference" skills/sow/SKILL.md || echo "无旧相对路径"
grep -c 'CLAUDE_PLUGIN_ROOT}/skills/sow/sow-reference' skills/sow/SKILL.md   # 应 ≥1（若原文调用脚本）
```
Expected: "sow-reference moved"；"无旧相对路径"。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add skills/sow/SKILL.md skills/sow/sow-reference
git commit -m "feat(skill): 迁移 sow command → skill, sow-reference 挪位 + 脚本路径锚定插件根 (skillify-route Task 10)"
```

---

## Task 11: 迁移 commands/rule-eval.md → skills/rule-eval/SKILL.md（含 eval 对象改 route）

**Files:**
- Create: `skills/rule-eval/SKILL.md`

- [ ] **Step 1: 建文件 + frontmatter（先迁，再改 eval 对象——spec BF5 顺序）**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
mkdir -p skills/rule-eval
cp commands/rule-eval.md skills/rule-eval/SKILL.md
```
编辑 frontmatter 加 `name: rule-eval` 与 `disable-model-invocation: true`。

- [ ] **Step 2: eval 对象从 catalog 改 route 生成区**

编辑 `skills/rule-eval/SKILL.md`：把「读 `agent-catalog` 规则路由表跑 route-recall」改为「读 `skills/route/SKILL.md` 的 `rule-routes` 生成区取路由定义跑 route-recall」；description 里「agent-catalog 规则」改为「route 路由规则」。route-recall / 混淆矩阵 / intent-signal 算法与 case 集（`eval/cases/*.md`）不变。补一句异常处理：若 route 生成区 marker 缺失，提示先跑 `node hooks/generate.mjs`。

- [ ] **Step 3: 验证**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
grep -nE "agent-catalog" skills/rule-eval/SKILL.md || echo "catalog 引用已改 route"
grep -c "skills/route/SKILL.md" skills/rule-eval/SKILL.md   # 应 ≥1
```
Expected: "catalog 引用已改 route"；route 引用 ≥1。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add skills/rule-eval/SKILL.md
git commit -m "feat(skill): 迁移 rule-eval command → skill, eval 对象 catalog→route (skillify-route Task 11)"
```

---

## Task 12: 退役清理（删 commands/、trigger-resurface、triggers.json，改 generate.test）

**Files:**
- Delete: `commands/`（整目录）、`hooks/trigger-resurface.mjs`、`hooks/triggers.json`
- Modify: `hooks/generate.test.mjs`（删 triggers 相关旧断言）

- [ ] **Step 1: 删旧 command 文件 + 退役 hook 文件**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git rm -r commands/
git rm hooks/trigger-resurface.mjs hooks/triggers.json
```

- [ ] **Step 2: generate.test.mjs 删 triggers 旧断言**

在 `hooks/generate.test.mjs` 中删除所有引用 `genTriggers` / `triggers.json` 的旧 test（Task 1-4 新增的 test 保留）。若顶部 import 了 `genTriggers`，移除该 import。

- [ ] **Step 3: 验证测试全绿 + 无残留引用**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
node --test 'hooks/*.test.mjs' 2>&1 | tail -5
grep -rnE "commands/|trigger-resurface|triggers\.json|genTriggers" hooks/ skills/ model/ --include="*.mjs" --include="*.md" --include="*.sh" --include="*.json" | grep -v "node_modules" || echo "无残留引用"
```
Expected: 测试 `# fail 0`；"无残留引用"（或仅在本 plan / spec 文档里出现，可忽略 docs/）。

- [ ] **Step 4: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add -A hooks/generate.test.mjs commands hooks/trigger-resurface.mjs hooks/triggers.json
git commit -m "chore: 删 commands/ + 退役 UserPromptSubmit(trigger-resurface/triggers.json) (skillify-route Task 12)"
```

---

## Task 13: version 3.0.0 + 全量 verify（BF6）

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: 升 version 到 3.0.0**

编辑 `.claude-plugin/plugin.json`，把 `"version"` 改为 `"3.0.0"`。

> 注：主仓可能已有更高的 2.x（并行改动），合并时以「在当时主仓最新基础上升 major」为准；若主仓已 ≥3.0.0 则顺延下一个未用 major/minor，由执行者落地时核对。

- [ ] **Step 2: 全量 verify（对照 spec BF6）**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
echo "--- 1 commands 已删 ---"; test ! -d commands && echo OK
echo "--- 2 UserPromptSubmit 退役 ---"; test ! -f hooks/trigger-resurface.mjs && test ! -f hooks/triggers.json && echo OK
echo "--- 3 hooks.json ---"; node -e "const h=require('./hooks/hooks.json');if(h.hooks.UserPromptSubmit)throw'UPS仍在';if(!h.hooks.PreToolUse)throw'PreToolUse丢';console.log('OK')"
echo "--- 4 四个 skill + disable-model-invocation ---"; for c in distill sow task rule-eval; do test -f "skills/$c/SKILL.md" && grep -q "disable-model-invocation: true" "skills/$c/SKILL.md" && echo "$c OK" || echo "$c FAIL"; done
echo "--- 5 旧引用残留 ---"; grep -rnE "commands/sow-reference|commands/sow\.md|commands/distill" skills/ || echo "无残留"
echo "--- 6 node test ---"; node --test 'hooks/*.test.mjs' 2>&1 | tail -3
echo "--- 7 generate --check 零漂移 ---"; node hooks/generate.mjs --check && echo "CHECK OK"
```
Expected: 1-4 全 OK；5 "无残留"；6 `# fail 0`；7 "CHECK OK"。

- [ ] **Step 3: Commit**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
git add .claude-plugin/plugin.json
git commit -m "chore(plugin): bump 3.0.0 — skillify-route 完成 (rule/command 统一 skill + route 入口)"
```

---

## Task 14: go/no-go — rule-eval route-recall 量化（对照 spec 部署节）

**Files:** 无文件改动，验证性 task。

- [ ] **Step 1: 跑改造后 route-recall**

```bash
cd /Users/yes365/AI/nocode-evolve-design_skillify-route
ls eval/cases/ 2>/dev/null && echo "case 集存在" || echo "无 eval/cases, 跳过量化(记录跳过原因)"
```
若 case 集存在：手动调 `/nocode-evolve:rule-eval --all`（skill 已迁移），记录 route-recall 数值。

- [ ] **Step 2: 对照基线判 go/no-go**

- 基线 = 改造前 catalog 触发率（如有历史 eval 报告则取，否则在主仓 ce80aa9 上跑一次留底）。
- **go**：改造后 route-recall ≥ 基线 - 2%。
- **no-go**：低于基线 → 调 `skills/route/SKILL.md` 的 `description` 触发词覆盖，重测。

- [ ] **Step 3: 记录结论**

把 route-recall 数值 + go/no-go 结论追加到 spec 的 Review Log 或单独 eval 报告；若 no-go，回到 Task 5 调 description 后重跑 Task 13 Step 2 + 本 task。

---

## Self-Review

- **Spec 覆盖**：背景/目标（Task 全程）；route skill（T5）；catalog 精简（T2/T5）；generate 改造（T1-4）；model 拆分（T6）；hooks 退役（T7/T12）；command 迁移（T8-11）；预算（T7 Step4 验字符数）；go/no-go（T14）；version（T13）。BF1-BF6 均有对应 task。✅
- **Placeholder 扫描**：各 step 给了完整代码 / 命令 / 期望输出，无 TBD。route ②③ 手写区给了完整文本。✅
- **类型一致**：`patchGeneratedRegion(file, regionName, body)` 在 T1 定义、T4 check/renderAll 调用签名一致；`genCatalogSlim`/`genRouteTable` 命名跨 task 一致；marker 串 `<!-- BEGIN/END generated: rule-routes -->` 在 T1/T4/T5 一致。✅
- **已知风险**：T4 与 T5 有循环依赖（renderAll 写 route 需 route 文件存在；route 生成区需 generate 填）——已用「T4 test 走临时文件、T5 负责建骨架后跑 generate」解耦，执行时 T5 Step1 建骨架须在首次 `node hooks/generate.mjs`（T5 Step2）前完成。
```
