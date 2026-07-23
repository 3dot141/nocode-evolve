# rule 体系触发率改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 nocode-evolve 的 rule 体系改造成「单一 policy manifest 派生多通道 + 粗桶分层 catalog + PreToolUse 机制化拦截」，提高触发率并根治双源漂移。

**Architecture:** 一份 `rules/manifest.json` 作唯一真值源；`hooks/generate.mjs` 从它生成 `model/agent-catalog.md`（粗桶结构）、`hooks/triggers.json`、`hooks/pretooluse-rules.json`；新增 `hooks/pretooluse-guard.mjs` 在 Bash 工具调用前匹配真实绕过点，注入提醒或阻断；`--check` 模式做生成物与源的一致性回归。

**Tech Stack:** 纯 Node.js（v22，零依赖——仓库无 `package.json`，用原生 `JSON.parse` + `node --test`）；bash hook 胶水；Claude Code hooks（SessionStart / UserPromptSubmit / PreToolUse）。

---

## 假定决策（plan 阶段为未决开放问题 Q2-Q4 拍的默认值，执行中验证后可调）

> RFC-001 把这三件事标为 open question。全量 plan 要可执行（No Placeholders），必须现在拍具体值。每条标依据 + 可调点。

- **D1（对应 Q2，阻断 vs 注入）**：PreToolUse 默认 **`inject`**（exit0 + `additionalContext` + `permissionDecision:"allow"`，放行并注入提醒），**仅高危不可逆靶用 `block`**（`permissionDecision:"deny"`，如 `bkt api --method PUT` / 裸 `curl` 改 PR）。依据：RFC 影响评估担心阻断打断合法操作，误拦代价 inject < block。**可调**：每条 pretooluse 靶在 manifest 里单独标 `action`，验证后可把更多靶升 `block`。
- **D2（manifest 格式）**：用 **JSON**（`rules/manifest.json`），不用 YAML。依据：仓库零 node 依赖（无 `package.json`），`JSON.parse` 原生；现有 `triggers.json`/`hooks.json` 已是 JSON，一致。代价：多行文本可读性差 → 用字符串数组 + `\n` join 缓解。**可调**：后续若引 YAML 依赖可换，生成器接口不变。
- **D3（对应 Q4 粗桶切法 + Q3 FP 预算）**：四桶 **`git-lifecycle` / `review` / `design` / `memory`**；跨桶 rule 用 `bucket`（主桶）+ `also_buckets`（多挂）。FP/FN 不设硬阈值，首版接受「宁可多触发」（inject 噪音低），用 `rule-eval` route-recall + 新增 bypass 观测做经验校准。**可调**：桶划分与多挂关系都在 manifest，改 manifest 重生成即可。

## 文件结构

```
rules/manifest.json              (NEW) 单一真值源: buckets[] + rules[]
hooks/generate.mjs               (NEW) 生成器: manifest → catalog/triggers/pretooluse; 含 --check
hooks/generate.test.mjs          (NEW) 生成器单测 (node --test)
hooks/manifest.test.mjs          (NEW) manifest 结构校验单测
hooks/pretooluse-guard.mjs       (NEW) PreToolUse hook: 匹配 Bash 命令 → inject/block + bypass 观测
hooks/pretooluse-guard.test.mjs  (NEW) PreToolUse hook 单测
hooks/pretooluse-rules.json      (生成物) 从 manifest 派生, 禁手改
model/agent-catalog.md           (改→生成物) 从 manifest 派生粗桶结构, 禁手改
hooks/triggers.json              (改→生成物) 从 manifest 派生, 禁手改
hooks/hooks.json                 (改) 注册 PreToolUse + generate --check 进 SessionStart
hooks/inject-rules.sh            (改) sanity check 改为调 generate.mjs --check
.claude-plugin/plugin.json       (改) version 2.7.0 → 2.8.0
CLAUDE.md                        (改) 补"改 rule 改 manifest 重生成"约定
```

**生成物边界**：`agent-catalog.md` / `triggers.json` / `pretooluse-rules.json` 改为生成物后**禁手改**——改 rule 一律改 `manifest.json` 再 `node hooks/generate.mjs`。`--check` 在 SessionStart 兜底报漂移。

---

## Phase 1 — 单源地基（manifest → 生成 triggers/catalog + 一致性回归）

### Task 1: 建 manifest schema + 两条样板 rule + 结构校验

**Files:**
- Create: `rules/manifest.json`
- Create: `hooks/generate.mjs`（先只放 `loadManifest`）
- Test: `hooks/manifest.test.mjs`

- [ ] **Step 1: 写 manifest.json（buckets 全 4 桶 + finishing-branch / push-summary 两条样板）**

```json
{
  "$comment": "单一真值源。改 rule 改这里, 跑 node hooks/generate.mjs 重新生成 catalog/triggers/pretooluse-rules。禁手改生成物。",
  "buckets": [
    { "id": "git-lifecycle", "title": "Git 生命周期", "trigger_summary": "任何把本地改动推进到分支 / 远端协作状态的请求 (提 PR / push / 合并 / 收尾 / worktree)", "negatives": ["纯只读查询: 列 PR / 看分支 / 看 status / 看 log"] },
    { "id": "review", "title": "评审", "trigger_summary": "对已有改动或设计求评审 / 挑错 / 独立验证 / 第二实现", "negatives": ["纯执行: 直接改代码而未求评审"] },
    { "id": "design", "title": "设计与文档", "trigger_summary": "写设计文档 / PRD / RFC / ADR / 重构方案 / 技术 spec", "negatives": ["写代码注释 / commit message / README / changelog"] },
    { "id": "memory", "title": "记忆与沉淀", "trigger_summary": "总结 / 沉淀 / 归档会话产出 / push 内容", "negatives": ["一次性事实查询"] }
  ],
  "rules": [
    {
      "id": "finishing-branch",
      "bucket": "git-lifecycle",
      "also_buckets": [],
      "trigger_type": "regex+skill",
      "trigger_desc": "即将执行 superpowers:finishing-a-development-branch skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 删 branch / discard worktree」",
      "triggers": ["提\\s*个?\\s*pr", "创建\\s*pr", "建\\s*个?\\s*pr", "pull\\s*request", "提.*?PR", "合并到\\s*(release|main|master|主干)", "收尾", "完成\\s*worktree", "删\\s*(branch|分支)", "discard\\s*worktree"],
      "action": "Read rules/rule-finishing-branch.md 并走 Gate TB/PR",
      "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-finishing-branch.md",
      "summary": "覆盖+扩展 superpowers skill, 4 选项 (merge/PR/keep/discard); Gate 体系 M/TB/PR/D/RD; gh 主, Bitbucket DC 读 bkt 附录",
      "guard": "Bitbucket 用 bkt 不裸 curl; reviewer 用 bkt pr edit 不 PUT。",
      "pretooluse": [
        { "pattern": "gh\\s+pr\\s+create", "action": "inject", "note": "提 PR 前先 Read rule-finishing-branch.md 走 Gate TB/PR" },
        { "pattern": "bkt\\s+api\\s+.*--method\\s+PUT", "action": "block", "note": "禁 bkt api PUT 改 PR 元数据, 用 bkt pr edit" },
        { "pattern": "curl\\s+.*pull-?request", "action": "block", "note": "禁裸 curl 改 PR, 用 bkt" }
      ]
    },
    {
      "id": "push-summary",
      "bucket": "memory",
      "also_buckets": ["git-lifecycle"],
      "trigger_type": "regex",
      "trigger_desc": "用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」",
      "triggers": ["总结.{0,4}push", "push.{0,6}(总结|包含|改了|是什么)", "pr\\s*描述", "pr\\s*description", "给.{0,4}(标题|描述)", "沉淀", "这次\\s*push"],
      "action": "Read rules/rule-push-summary.md",
      "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md",
      "summary": "输出 标题 + 描述, 描述 ≤200字, 含基础内容(覆盖 push range 全 commit) + 重点评测(亮点 / 风险 / 未验证项)",
      "guard": "",
      "pretooluse": []
    }
  ]
}
```

- [ ] **Step 2: 写 generate.mjs 的 loadManifest（其余函数后续 task 加）**

```javascript
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
```

- [ ] **Step 3: 写 manifest.test.mjs（结构校验，先看它失败）**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest } from './generate.mjs';

test('manifest: rule id 唯一', () => {
  const m = loadManifest();
  const ids = m.rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'rule id 有重复');
});

test('manifest: 每条 rule 的 bucket / also_buckets 都在 buckets 里存在', () => {
  const m = loadManifest();
  const bids = new Set(m.buckets.map((b) => b.id));
  for (const r of m.rules) {
    assert.ok(bids.has(r.bucket), `rule ${r.id} 的 bucket ${r.bucket} 不存在`);
    for (const ab of r.also_buckets || []) assert.ok(bids.has(ab), `rule ${r.id} 的 also_bucket ${ab} 不存在`);
  }
});

test('manifest: 必填字段齐全', () => {
  const m = loadManifest();
  for (const r of m.rules) {
    for (const f of ['id', 'bucket', 'trigger_type', 'action', 'read', 'summary']) {
      assert.ok(r[f] !== undefined, `rule ${r.id} 缺字段 ${f}`);
    }
  }
});

test('manifest: 每个 bucket 有 trigger_summary + negatives', () => {
  const m = loadManifest();
  for (const b of m.buckets) {
    assert.ok(b.trigger_summary, `bucket ${b.id} 缺 trigger_summary`);
    assert.ok(Array.isArray(b.negatives), `bucket ${b.id} 缺 negatives`);
  }
});
```

- [ ] **Step 4: 跑测试验证通过**

Run: `node --test hooks/manifest.test.mjs`
Expected: PASS（4 tests，0 fail）

- [ ] **Step 5: Commit**

```bash
git add rules/manifest.json hooks/generate.mjs hooks/manifest.test.mjs
git commit -m "feat(rule): 建 manifest.json 单源 schema + 两条样板 rule + 结构校验"
```

---

### Task 2: 生成器派生 triggers.json（格式回归）

**Files:**
- Modify: `hooks/generate.mjs`（加 `genTriggers`）
- Test: `hooks/generate.test.mjs`

- [ ] **Step 1: 写 genTriggers 的失败测试**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest, genTriggers } from './generate.mjs';

test('genTriggers: 复现 triggers.json 格式 [{rule, action, patterns, note}]', () => {
  const t = genTriggers(loadManifest());
  const fb = t.find((x) => x.rule === 'finishing-branch');
  assert.ok(fb, '应含 finishing-branch');
  assert.equal(fb.action, 'Read rules/rule-finishing-branch.md 并走 Gate TB/PR');
  assert.ok(fb.patterns.includes('提.*?PR'), 'patterns 应来自 manifest.triggers');
  assert.equal(fb.note, 'Bitbucket 用 bkt 不裸 curl; reviewer 用 bkt pr edit 不 PUT。');
});

test('genTriggers: 跳过无 triggers 的 rule', () => {
  const m = loadManifest();
  m.rules.push({ id: 'no-regex', bucket: 'review', trigger_type: 'behavior', triggers: [], action: 'x', read: 'y', summary: 'z' });
  const t = genTriggers(m);
  assert.ok(!t.find((x) => x.rule === 'no-regex'), '无 triggers 的 rule 不该进 triggers.json');
});
```

- [ ] **Step 2: 跑测试验证它失败**

Run: `node --test hooks/generate.test.mjs`
Expected: FAIL（`genTriggers is not a function`）

- [ ] **Step 3: 在 generate.mjs 加 genTriggers**

```javascript
export function genTriggers(m) {
  // 复现现有 hooks/triggers.json 格式: [{rule, action, patterns, note}]
  return m.rules
    .filter((r) => r.triggers && r.triggers.length)
    .map((r) => ({ rule: r.id, action: r.action, patterns: r.triggers, note: r.guard || '' }));
}
```

- [ ] **Step 4: 跑测试验证通过**

Run: `node --test hooks/generate.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/generate.mjs hooks/generate.test.mjs
git commit -m "feat(rule): 生成器派生 triggers.json (格式回归测试)"
```

---

### Task 3: 生成器派生粗桶 catalog

**Files:**
- Modify: `hooks/generate.mjs`（加 `genCatalog`）
- Test: `hooks/generate.test.mjs`（追加）

- [ ] **Step 1: 写 genCatalog 的失败测试**

```javascript
import { genCatalog } from './generate.mjs';

test('genCatalog: 按粗桶分组, 含桶触发 + 负例 + 子规则三件套', () => {
  const md = genCatalog(loadManifest());
  assert.match(md, /禁手改/, '应有"生成物禁手改"提示');
  assert.match(md, /### 桶: Git 生命周期 \(git-lifecycle\)/);
  assert.match(md, /\*\*粗触发\*\*:/);
  assert.match(md, /\*\*不含 \(负例\)\*\*:/);
  assert.match(md, /#### finishing-branch/);
  assert.match(md, /\*\*读\*\*: `\$\{CLAUDE_PLUGIN_ROOT\}\/rules\/rule-finishing-branch\.md`/);
  assert.match(md, /\*\*关键约束\(上浮\)\*\*: Bitbucket 用 bkt/, '有 guard 的 rule 应上浮 guard');
});

test('genCatalog: 跨桶 rule 标注 also_buckets', () => {
  const md = genCatalog(loadManifest());
  assert.match(md, /#### push-summary[\s\S]*?\*\*也属\*\*: git-lifecycle/);
});
```

- [ ] **Step 2: 跑测试验证它失败**

Run: `node --test hooks/generate.test.mjs`
Expected: FAIL（`genCatalog is not a function`）

- [ ] **Step 3: 在 generate.mjs 加 genCatalog**

```javascript
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
```

- [ ] **Step 4: 跑测试验证通过**

Run: `node --test hooks/generate.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/generate.mjs hooks/generate.test.mjs
git commit -m "feat(rule): 生成器派生粗桶 catalog (桶触发+负例+guard 上浮)"
```

---

### Task 4: 写出生成物 + `--check` 一致性回归 + 接 SessionStart

**Files:**
- Modify: `hooks/generate.mjs`（加 `genPretooluse` / `writeAll` / `check` / `main`）
- Modify: `hooks/inject-rules.sh`（sanity 改调 `--check`）
- Test: `hooks/generate.test.mjs`（追加 check 用例）

- [ ] **Step 1: 写 genPretooluse + check 的失败测试**

```javascript
import { genPretooluse, renderAll, check } from './generate.mjs';

test('genPretooluse: 扁平化所有 rule 的 pretooluse 靶', () => {
  const p = genPretooluse(loadManifest());
  const block = p.find((x) => x.decision === 'block' && /PUT/.test(x.pattern));
  assert.ok(block, '应含 bkt PUT 的 block 靶');
  assert.equal(block.rule, 'finishing-branch');
  assert.ok(p.some((x) => x.decision === 'inject'), '应含 inject 靶');
});

test('check: 生成物与源一致时返回 []', () => {
  // 先写出最新生成物, 再 check 应无 diff
  renderAll(true);
  assert.deepEqual(check(), []);
});
```

- [ ] **Step 2: 跑测试验证它失败**

Run: `node --test hooks/generate.test.mjs`
Expected: FAIL（`genPretooluse / renderAll / check is not a function`）

- [ ] **Step 3: 在 generate.mjs 加 genPretooluse / renderAll / check / main**

```javascript
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
```

- [ ] **Step 4: 跑测试验证通过 + 实际生成一次**

Run: `node --test hooks/generate.test.mjs && node hooks/generate.mjs`
Expected: 测试 PASS；生成 stderr 打印「已从 manifest 重新生成 hooks/triggers.json, hooks/pretooluse-rules.json, model/agent-catalog.md」

- [ ] **Step 5: 把 `--check` 接进 inject-rules.sh 的 sanity（替换旧的孤儿扫描）**

在 `hooks/inject-rules.sh` 的 sanity check 段（`if [ "$GROUP" = "model" ] ...`）开头追加：

```bash
  # 单源漂移兜底: 生成物与 manifest 不一致则警告 (不阻断 session)
  if command -v node >/dev/null 2>&1 && [ -f "${PLUGIN_ROOT}/hooks/generate.mjs" ]; then
    node "${PLUGIN_ROOT}/hooks/generate.mjs" --check 2>&1 | while read -r line; do
      echo "inject-rules.sh WARN: $line" >&2
    done
  fi
```

- [ ] **Step 6: 验证漂移能被抓到**

Run: `printf '[]' > hooks/triggers.json && node hooks/generate.mjs --check; echo "exit=$?"; node hooks/generate.mjs`
Expected: `--check` 打印漂移并 `exit=1`；末尾 `node hooks/generate.mjs` 把 triggers.json 修回。

- [ ] **Step 7: Commit**

```bash
git add hooks/generate.mjs hooks/generate.test.mjs hooks/inject-rules.sh hooks/triggers.json hooks/pretooluse-rules.json model/agent-catalog.md
git commit -m "feat(rule): 生成物 writeAll + --check 一致性回归 + 接 SessionStart sanity"
```

> ⚠️ 此 commit 后 `triggers.json` / `agent-catalog.md` 正式变为生成物。Phase 2 全量迁移前，二者只含 finishing-branch / push-summary 两条——**Phase 2 Task 5 补齐其余 rule 后才与改造前等价**。中途不要单独发布。

---

## Phase 2 — 全量迁移 + 粗桶 IA 完整化

### Task 5: 迁入其余 5 条 rule + 集合错位消除回归

> 改造前 catalog 6 条（含 `git-inspection`、无 `red-blue-deep`），triggers.json 6 条（含 `red-blue-deep`、无 `git-inspection`）——RFC 辅因二的「集合错位」。迁入 manifest 后两边都从单源派生，错位消除：catalog = 全 7 条，triggers = 有 regex 的 6 条（`git-inspection` 是 behavior 触发，无 regex，只进 catalog）。

**Files:**
- Modify: `rules/manifest.json`（`rules[]` 追加 5 条）
- Test: `hooks/generate.test.mjs`（追加回归用例）

- [ ] **Step 1: 在 manifest.json 的 `rules` 数组追加这 5 条**

```json
    {
      "id": "superpowers-brainstorming",
      "bucket": "design",
      "also_buckets": [],
      "trigger_type": "regex+skill",
      "trigger_desc": "即将执行 superpowers:brainstorming skill, 或用户要求写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec, 或 brainstorming 走到 step 5",
      "triggers": ["设计文档", "design\\s*doc", "\\bprd\\b", "\\brfc\\b", "\\badr\\b", "重构方案", "技术\\s*spec", "技术方案"],
      "action": "Read rules/rule-superpowers-brainstorming.md (或先 Skill brainstorming)",
      "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md",
      "summary": "写设计文档统一 worktree → write → review → render 四步, 落 docs/plans/{username}/ (按 doc-type 分 specs/plans/sketches); 两条入口 (brainstorming step5 / 用户直接要求) 一致",
      "guard": "",
      "pretooluse": []
    },
    {
      "id": "git-worktree",
      "bucket": "git-lifecycle",
      "also_buckets": [],
      "trigger_type": "regex+skill",
      "trigger_desc": "即将执行 superpowers:using-git-worktrees skill, 或用户要求创建 worktree, 或在 worktree 内跑命令报「env var missing / config 不存在」需从主仓 cp gitignored 文件, 或 agent 在 worktree 找不到项目本地 .agents-personal/ 路由",
      "triggers": ["(创建|建|新建|开|搞).{0,3}worktree", "worktree.{0,3}(创建|新建)"],
      "action": "Read rules/rule-git-worktree.md",
      "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-git-worktree.md",
      "summary": "worktree 落项目同级 <project>-<branch_flat>/; 建前静默 fetch + 基于 upstream 最新; 建后 cp env/config + symlink .agents-personal/ 共享主仓; 销毁前先拆 symlink",
      "guard": "",
      "pretooluse": [
        { "pattern": "git\\s+worktree\\s+add", "action": "inject", "note": "建 worktree 前先 Read rule-git-worktree.md: 落 <project>-<branch>/, 建后 cp env + symlink .agents-personal" }
      ]
    },
    {
      "id": "git-inspection",
      "bucket": "git-lifecycle",
      "also_buckets": [],
      "trigger_type": "behavior",
      "trigger_desc": "即将连续跑 ≥2 个 git read-only 命令 (status / diff / log / show / branch / ls-files / remote -v 等)",
      "triggers": [],
      "action": "Read rules/rule-git-inspection.md",
      "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-git-inspection.md",
      "summary": "read-only inspection 命令默认用 && 串成一个 Bash call, 各段间插 echo \"---<label>\" 分隔, 减少 turn 浪费",
      "guard": "",
      "pretooluse": []
    },
    {
      "id": "codex-review",
      "bucket": "review",
      "also_buckets": ["design"],
      "trigger_type": "regex+skill",
      "trigger_desc": "red-blue-deep 判重档走到红军环节; 或完成分支 / 显式 review 请求; 或我卡住 / 想要第二实现 / 独立诊断 / 委派; 或 design-doc-writing 走到 review 环节",
      "triggers": ["review\\s*一下", "帮我?\\s*审", "审一遍", "看.{0,6}(改动|代码|实现).{0,4}(问题|有没有|对不对)", "codex\\s*review", "adversarial"],
      "action": "Read rules/rule-codex-review.md",
      "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md",
      "summary": "本机 Codex 当独立模型接四场景 (红蓝红军 / 代码 review 收尾 / 委派救援 / 设计文档审稿); 直接 Bash 调 codex-companion.mjs; 先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendored 文件",
      "guard": "先 setup --json 探, 不可用降级自做 + 明说; 禁改 vendor/codex/ 文件。",
      "pretooluse": []
    },
    {
      "id": "red-blue-deep",
      "bucket": "review",
      "also_buckets": [],
      "trigger_type": "skill",
      "trigger_desc": "用户问「X 怎么样 / 行不行 / 合适吗 / 值得吗 / 选 A 还是 B / 哪个更好」等评估 / 拍板类, 或显式说红蓝军 / 第一性原理",
      "triggers": ["行不行", "值得吗", "合适吗", "该不该", "选.{0,10}还是", "哪个(更好|好|合适)", "红蓝军", "第一性原理"],
      "action": "调 Skill(nocode-evolve:red-blue-deep) (别先自己给结论)",
      "read": "(skill, 无 rule 文件)",
      "summary": "评估 / 拍板类提问的红蓝军框架; skill 内判轻档 (一句表态) / 重档 (第一性原理→蓝军→红军→结论, 重档红军默认交 Codex)",
      "guard": "",
      "pretooluse": []
    }
```

- [ ] **Step 2: 写集合错位消除 + 回归的失败测试**

```javascript
// 改造前 triggers.json 的原始 patterns 快照 (写死作回归基线, 防迁移丢/改 pattern)
const ORIGINAL_TRIGGERS = {
  'finishing-branch': ['提\\s*个?\\s*pr', '创建\\s*pr', '建\\s*个?\\s*pr', 'pull\\s*request', '提.*?PR', '合并到\\s*(release|main|master|主干)', '收尾', '完成\\s*worktree', '删\\s*(branch|分支)', 'discard\\s*worktree'],
  'push-summary': ['总结.{0,4}push', 'push.{0,6}(总结|包含|改了|是什么)', 'pr\\s*描述', 'pr\\s*description', '给.{0,4}(标题|描述)', '沉淀', '这次\\s*push'],
  'superpowers-brainstorming': ['设计文档', 'design\\s*doc', '\\bprd\\b', '\\brfc\\b', '\\badr\\b', '重构方案', '技术\\s*spec', '技术方案'],
  'git-worktree': ['(创建|建|新建|开|搞).{0,3}worktree', 'worktree.{0,3}(创建|新建)'],
  'codex-review': ['review\\s*一下', '帮我?\\s*审', '审一遍', '看.{0,6}(改动|代码|实现).{0,4}(问题|有没有|对不对)', 'codex\\s*review', 'adversarial'],
  'red-blue-deep': ['行不行', '值得吗', '合适吗', '该不该', '选.{0,10}还是', '哪个(更好|好|合适)', '红蓝军', '第一性原理'],
};

test('回归: genTriggers 的每条 rule patterns 与改造前 triggers.json 完全一致', () => {
  const t = genTriggers(loadManifest());
  for (const [rule, patterns] of Object.entries(ORIGINAL_TRIGGERS)) {
    const got = t.find((x) => x.rule === rule);
    assert.ok(got, `triggers 应含 ${rule}`);
    assert.deepEqual(got.patterns, patterns, `${rule} patterns 与改造前不一致 (迁移丢/改了 pattern)`);
  }
});

test('集合错位消除: catalog 集合 ⊇ triggers 集合; git-inspection 只在 catalog', () => {
  const m = loadManifest();
  const catalogIds = new Set(m.rules.map((r) => r.id));
  const triggerIds = new Set(genTriggers(m).map((x) => x.rule));
  assert.ok(catalogIds.has('git-inspection'), 'git-inspection 应在 catalog');
  assert.ok(!triggerIds.has('git-inspection'), 'git-inspection 无 regex, 不该在 triggers');
  assert.ok(catalogIds.has('red-blue-deep') && triggerIds.has('red-blue-deep'), 'red-blue-deep 两边都应有 (错位修复)');
  for (const id of triggerIds) assert.ok(catalogIds.has(id), `triggers 里的 ${id} 必须也在 catalog (单源保证)`);
});
```

- [ ] **Step 3: 跑测试验证它失败 → 通过**

Run: `node --test hooks/generate.test.mjs`
Expected: 加这 5 条前回归 test FAIL（缺 rule）；Step 1 加完后 PASS

- [ ] **Step 4: 重新生成生成物 + 跑全部测试**

Run: `node hooks/generate.mjs && node --test hooks/`
Expected: 生成成功；全部 test PASS。此时 `triggers.json` 与改造前等价（6 条），`agent-catalog.md` 含全 7 条粗桶结构。

- [ ] **Step 5: 人工核对 triggers.json 与改造前 diff（only 顺序/格式，无语义变化）**

Run: `git diff hooks/triggers.json`
Expected: 仅条目顺序可能变（按 manifest 顺序），patterns 内容逐条对得上改造前。若有 pattern 内容差异 → 回 Step 1 修 manifest。

- [ ] **Step 6: Commit**

```bash
git add rules/manifest.json hooks/generate.test.mjs hooks/triggers.json hooks/pretooluse-rules.json model/agent-catalog.md
git commit -m "feat(rule): 全量迁移 7 条 rule 进 manifest + 集合错位消除回归"
```

---

### Task 6: 粗桶 IA 完整化（二级分类提示 + 删手写维护章节）

**Files:**
- Modify: `hooks/generate.mjs`（`genCatalog` 补桶内分类提示 + 维护说明）
- Test: `hooks/generate.test.mjs`（追加）

- [ ] **Step 1: 写失败测试（catalog 含二级分类提示 + 4 桶都非空）**

```javascript
test('genCatalog: 4 桶全部填充 (无空桶)', () => {
  const m = loadManifest();
  const md = genCatalog(m);
  for (const b of m.buckets) {
    assert.match(md, new RegExp(`### 桶: ${b.title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`), `桶 ${b.id} 应在 catalog 出现`);
  }
});

test('genCatalog: 含二级分类指引 (命中桶后如何选具体 rule)', () => {
  const md = genCatalog(loadManifest());
  assert.match(md, /先命中桶.*再在桶内子规则/, '应有桶→子规则二级分类指引');
});
```

- [ ] **Step 2: 跑测试验证它失败**

Run: `node --test hooks/generate.test.mjs`
Expected: 「4 桶全部填充」PASS（Task 5 已迁全），「二级分类指引」依赖 Task 3 已写的「先命中桶...再在桶内子规则」文本——若已 PASS 则本 step 仅确认；若 genCatalog 改动破坏了该文本则 FAIL。

- [ ] **Step 3: 确认 genCatalog 的读取时机文本已含二级分类指引**

Task 3 写的 `genCatalog` 头部已有「先命中桶(粗触发宽, 易命中), 再在桶内子规则里按 触发 选具体 rule」——满足。若 review 认为分类指引不够，可在此 step 强化（如加一句「同一信号命中多桶时按 also_buckets 交叉引用」）。本 step 不强制改代码。

- [ ] **Step 4: 跑全部测试 + 重新生成**

Run: `node --test hooks/ && node hooks/generate.mjs`
Expected: 全 PASS；生成物刷新。

- [ ] **Step 5: Commit**

```bash
git add hooks/generate.mjs hooks/generate.test.mjs model/agent-catalog.md
git commit -m "feat(rule): 粗桶 IA 完整化 (4 桶填充 + 二级分类指引校验)"
```

---

## Phase 3 — PreToolUse 机制化拦截 + bypass 验证（验主因假设）

### Task 7: PreToolUse hook（inject/block + bypass 观测埋点）+ 注册

**Files:**
- Create: `hooks/pretooluse-guard.mjs`
- Create: `hooks/pretooluse-guard.test.mjs`
- Modify: `hooks/hooks.json`（注册 PreToolUse matcher Bash）

- [ ] **Step 1: 写 pretooluse-guard 的失败测试（纯函数 matchRules / decide）**

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRules, decide } from './pretooluse-guard.mjs';

const RULES = [
  { rule: 'finishing-branch', pattern: 'gh\\s+pr\\s+create', decision: 'inject', reason: '提 PR 前先 Read rule-finishing-branch.md 走 Gate TB/PR' },
  { rule: 'finishing-branch', pattern: 'bkt\\s+api\\s+.*--method\\s+PUT', decision: 'block', reason: '禁 bkt api PUT 改 PR 元数据, 用 bkt pr edit' },
];

test('matchRules: gh pr create 命中 inject 靶', () => {
  const hits = matchRules('gh pr create --fill', RULES);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].decision, 'inject');
});

test('matchRules: 无关命令不命中', () => {
  assert.equal(matchRules('git status -sb', RULES).length, 0);
});

test('decide: inject → allow + additionalContext', () => {
  const out = decide([RULES[0]]);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.match(out.hookSpecificOutput.additionalContext, /finishing-branch/);
});

test('decide: block 优先于 inject → deny', () => {
  const out = decide([RULES[0], RULES[1]]);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /禁 bkt api PUT/);
});

test('decide: 无命中 → null', () => {
  assert.equal(decide([]), null);
});
```

- [ ] **Step 2: 跑测试验证它失败**

Run: `node --test hooks/pretooluse-guard.test.mjs`
Expected: FAIL（`matchRules / decide is not a function`）

- [ ] **Step 3: 写 pretooluse-guard.mjs**

> schema 依据 claude-code-guide 对 https://code.claude.com/docs/en/hooks.md 的核实：PreToolUse 输出 `hookSpecificOutput.{hookEventName, permissionDecision, permissionDecisionReason, additionalContext}`；`deny` 的 reason 回给 Claude；`allow + additionalContext` 放行并注入；优先级 `deny > allow`。

```javascript
#!/usr/bin/env node
// PreToolUse hook (matcher: Bash): 匹配真实绕过点 → inject 提醒(默认放行) 或 block(高危靶 deny)。
// 命中即记一条 bypass 观测 (.bypass-observations.jsonl), 供 eval / 人工复核——验主因假设:
// "深度负载下 agent 真的会走绕过点而没先加载 rule" 的发生率。
// 靶来自 hooks/pretooluse-rules.json (由 manifest 生成, 禁手改)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_FILE = path.join(ROOT, 'hooks/pretooluse-rules.json');
const BYPASS_LOG = path.join(ROOT, '.bypass-observations.jsonl');

export function matchRules(command, rules) {
  return rules.filter((r) => {
    try { return new RegExp(r.pattern, 'i').test(command); } catch { return false; }
  });
}

export function decide(hits) {
  if (!hits.length) return null;
  const block = hits.find((h) => h.decision === 'block');
  if (block) {
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[rule:${block.rule}] ${block.reason}` } };
  }
  const lines = hits.map((h) => `⚠️ [rule:${h.rule}] ${h.reason}`).join('\n');
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', additionalContext: `[PreToolUse 规则提醒] 你即将跑的命令命中真实绕过点, 动手前先确认:\n${lines}` } };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
  if (payload.tool_name !== 'Bash') process.exit(0);
  const command = payload.tool_input?.command || '';
  if (!command) process.exit(0);

  let rules = [];
  try { rules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')); } catch { process.exit(0); }

  const hits = matchRules(command, rules);
  if (!hits.length) process.exit(0);

  // bypass 观测 (失败不阻断主流程)
  try {
    const rec = { ts: new Date().toISOString(), session: payload.session_id || '', cmd: command.slice(0, 200), hits: hits.map((h) => h.rule), decision: hits.some((h) => h.decision === 'block') ? 'block' : 'inject' };
    fs.appendFileSync(BYPASS_LOG, JSON.stringify(rec) + '\n');
  } catch { /* ignore */ }

  const out = decide(hits);
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
```

- [ ] **Step 4: 跑单测验证通过**

Run: `node --test hooks/pretooluse-guard.test.mjs`
Expected: PASS（5 tests）

- [ ] **Step 5: 端到端验证 CLI（模拟 PreToolUse stdin）**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"gh pr create --fill"},"session_id":"t1"}' | node hooks/pretooluse-guard.mjs
echo '{"tool_name":"Bash","tool_input":{"command":"bkt api x --method PUT"},"session_id":"t1"}' | node hooks/pretooluse-guard.mjs
echo '{"tool_name":"Bash","tool_input":{"command":"git status"},"session_id":"t1"}' | node hooks/pretooluse-guard.mjs
```
Expected: 第 1 条输出含 `"permissionDecision":"allow"` + `additionalContext`；第 2 条含 `"permissionDecision":"deny"`；第 3 条无输出（exit 0 静默）。`.bypass-observations.jsonl` 多两行记录。

- [ ] **Step 6: 注册进 hooks.json（在 `hooks` 对象里加 PreToolUse）**

```json
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/pretooluse-guard.mjs"
          }
        ]
      }
    ]
```

- [ ] **Step 7: Commit**

```bash
git add hooks/pretooluse-guard.mjs hooks/pretooluse-guard.test.mjs hooks/hooks.json
git commit -m "feat(hooks): PreToolUse 机制化拦截 (inject/block) + bypass 观测埋点"
```

---

### Task 8: bypass 观测消费 + route-recall 回归基线（C2 验收闭环）

**Files:**
- Create: `.gitignore`（或追加 `.bypass-observations.jsonl`）
- Test: 现有 `rule-eval` command（非 node 单测——LLM 触发率 eval）

- [ ] **Step 1: bypass 观测数据不入库**

把 `.bypass-observations.jsonl` 加进 `.gitignore`（无则创建）：

```
.bypass-observations.jsonl
```

- [ ] **Step 2: 跑 route-recall 回归基线（对照 260526 的 finishing-branch 6/6）**

Run（用现有 rule-eval skill/command 对两条关键 rule）:
```
/rule-eval finishing-branch
/rule-eval git-worktree
```
Expected: `finishing-branch` route-recall 不低于改造前基线（`docs/dev/3dot141/260526-02-rule-trigger-eval/rule-trigger-eval-design.md:183` 记的 6/6）；`git-worktree` 召回不退步。若粗桶改造导致退步 → 回 Task 6 调桶触发/负例文案。

- [ ] **Step 3: 记录 bypass 观测的消费方式（写进 RFC 验收，非代码）**

在真实/仿真深度负载会话跑一段后，分析 `.bypass-observations.jsonl`：

```bash
wc -l .bypass-observations.jsonl
node -e "const l=require('fs').readFileSync('.bypass-observations.jsonl','utf8').trim().split('\n').map(JSON.parse); const by={}; for(const r of l){by[r.hits.join(',')]=(by[r.hits.join(',')]||0)+1} console.log(by)"
```
判读：每条记录 = agent 真的要跑某绕过点。**结合 transcript 看命中前是否已 Read 对应 rule** —— 命中却未加载的比例，就是 RFC C2 要的「真实遵守失败率」，用来证伪/证实背景的主因假设。**注意**：hook 本身只记命中事件，「是否已加载 rule」需对照 transcript 人工/脚本判定（hook 在 PreToolUse 时机看不到加载历史）——这是本期简化，trace eval 的完整自动化留 v2（对齐 260526 自己的 v2 计划）。

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(rule): bypass 观测数据不入库 + route-recall 回归基线记录"
```

---

## Phase 4 — 收尾（版本 + 约定文档）

### Task 9: 升 plugin 版本 + 补 manifest 维护约定

**Files:**
- Modify: `.claude-plugin/plugin.json`（version）
- Modify: `CLAUDE.md`（补"改 rule 改 manifest"约定）

- [ ] **Step 1: 升版本 2.7.0 → 2.8.0**

`.claude-plugin/plugin.json` 的 `"version": "2.7.0"` → `"version": "2.8.0"`。
依据：新增 manifest 单源机制 + 生成器 + PreToolUse hook = 兼容性增强（minor），无破坏性路径改名（catalog/triggers 路径不变，只是改为生成物）。

- [ ] **Step 2: CLAUDE.md 补约定**

在 `## 工作流约束` 节追加：

```markdown
### 3. rule 改动走 manifest 单源

`model/agent-catalog.md`、`hooks/triggers.json`、`hooks/pretooluse-rules.json` 已是**生成物，禁手改**。增删改 rule：

- 改 `rules/manifest.json`（唯一真值源）
- 跑 `node hooks/generate.mjs` 重新生成
- 三个生成物与 manifest 的一致性由 SessionStart 的 `generate.mjs --check` 兜底报警
```

- [ ] **Step 3: 验证全链路 + 全测试**

Run: `node hooks/generate.mjs && node hooks/generate.mjs --check; echo "check=$?" && node --test hooks/`
Expected: 生成成功；`check=0`（无漂移）；全部 node test PASS。

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json CLAUDE.md
git commit -m "chore(rule): bump 2.8.0 + CLAUDE.md 补 manifest 单源维护约定"
```

---

## Self-Review（writing-plans skill 自检）

**1. Spec coverage（对 RFC-001 四环 + C1/C2）：**
- ✅ 单源 manifest（地基）→ Task 1-5
- ✅ 粗桶 IA（入口召回 + 精度负例）→ Task 3, 6
- ✅ guard 上浮 → manifest `guard` 字段 + genCatalog「关键约束(上浮)」(Task 3)
- ✅ PreToolUse 机制化（深度遵守）→ Task 7
- ✅ C2 tool bypass 验收 → Task 7 埋点 + Task 8 消费
- ✅ 集合错位（RFC W3）→ Task 5 回归
- ⚠️ 主因假设（C1）本 plan **不证实只搭验证手段**——符合 RFC「先验证再扩张」，但 Phase 1-3 的扩张其实先于验证完成。**已知张力**：若 Task 8 观测反证主因假设（绕过率很低），Phase 3 PreToolUse 的投入回报需重估。这是用户选「全量」而非「Phase1 only」的已知代价，执行到 Task 8 时回看。

**2. Placeholder scan：** 无 TBD/TODO；Q2-Q4 都由 D1-D3 拍了具体默认值并标可调点。`git-inspection` 无 regex 是真实属性（behavior 触发）非 placeholder。

**3. Type consistency：** 生成器导出名贯穿一致——`loadManifest / genTriggers / genCatalog / genPretooluse / renderAll / check`；hook 导出 `matchRules / decide`；`pretooluse-rules.json` 字段 `{rule, pattern, decision, reason}` 在 genPretooluse（产）与 pretooluse-guard（消）两侧一致。

---

## 执行 Handoff

Plan 已保存到 `docs/dev/3dot141/260601-01-rule-trigger-rework/rule-trigger-rework-plan.md`，9 个 task / 4 phase。两种执行方式：

1. **Subagent-Driven（推荐）** — 每个 task 派 fresh subagent，task 间我 review，迭代快。配 superpowers:subagent-driven-development。
2. **Inline Execution** — 本会话内按 superpowers:executing-plans 批量执行，带 checkpoint。

无论哪种，因改 `hooks/` + `model/`，建议先用 `superpowers:using-git-worktrees` 开隔离 worktree 再执行。
