---
name: personal-distill
description: ".agents-personal/ 的统一写入层（wiki + rules + AGENTS.md），被 /distill 调用，也可独立使用"
argument-hint: "[wiki|rules|agents] [optional-content-description]"
---

本文所说“调用 `<skill>` Skill”使用 `Skill(nocode:<skill>)`；“结构化决策”使用 `AskUserQuestion`。


# /personal-distill：.agents-personal/ 写入

统一管理 `.agents-personal/` 的所有写入操作——wiki 知识沉淀、rules 指令写入、AGENTS.md 变量/分节更新。

**被 `/distill` 调用**时，严格从 `arguments.payload.candidates[]` 读取候选；不得回退读取顶层 `arguments.disposition` 或从 ambient context 猜候选。也可用户直接 `/personal-distill` 独立写入。

## 入参

### 被 distill 调用时

distill 传入 `arguments.payload.candidates` 结构化候选列表，每个候选含：
```
{ id, disposition, target_layer, path, body, target, section_type, slug }
  target ∈ {wiki, rules, agents}
  disposition ∈ {create, merge, supersede, promote, skip}
  section_type ∈ {var, style, naming, convention, rules-trigger}  # 仅 target=agents
```

`merge` / `supersede` / `promote` 的目标路径只从 `path` 读取；`skip` 不写入。不得把展示层的中文“新建/融合→…”当作机器枚举。

### 独立调用时

`/personal-distill wiki <描述>` — 写入 wiki
`/personal-distill rules <描述>` — 写入 rules
`/personal-distill agents <描述>` — 写入 AGENTS.md

无参数时提示用法。

## 执行流程

### Step 0: 写入前检查

调用 `personal-lint` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}` 做健康检查。结果附在最终报告底部。error 不阻断写入（用户可选先修复或继续），但结论必须明确指出。

`.agents-personal/` 不存在 → 报 "未初始化" + 建议 `/personal-init`，停。

### Step 1: wiki 写入

#### 目录结构

```
.agents-personal/wiki/
├── index.md              主索引
├── index/                子索引目录（≥30 页时按 topic 分组）
├── log.md                操作日志
├── draft/                草稿层（首次出现，maturity=stub）
│   └── yymmdd-<slug>.md
└── pages/                发布层（经整合/promote 的成熟知识）
    └── <slug>.md
```

首次使用 wiki/ 目录或 index.md/log.md 不存在时，自动创建骨架。

#### 两层职责

| 层 | 位置 | 写入时机 | 文件名 | Maturity |
|---|---|---|---|---|
| Draft | `wiki/draft/` | 新建首次出现的主题 | `yymmdd-<slug>.md` | stub |
| Pages | `wiki/pages/` | 整合已有 / promote / supersede | `<slug>.md` | draft / active / superseded |

#### Page types

| Type | 用途 |
|---|---|
| overview | 主题入口，链接子页 |
| concept | 机制/模式/抽象概念 |
| guide | 操作步骤/配置/setup |
| practice | 最佳实践/约定 |
| comparison | A vs B 分析/权衡 |
| reference | 查阅材料/速查表 |
| troubleshooting | 问题/方案配对 |

#### Page frontmatter

**draft/ 页面**：
```yaml
---
slug: <kebab-case>
title: <标题>
type: overview | concept | guide | practice | comparison | reference | troubleshooting
description: <一句话，与 body TLDR 同步>
maturity: stub
created: <yymmdd>
sources:
  - <会话主题或触发上下文>
tags: []
---
```

**pages/ 页面**：
```yaml
---
slug: <kebab-case>
title: <标题>
type: <同上>
description: <一句话，与 body TLDR 同步>
maturity: draft | active | superseded
superseded_by: <slug>          # 仅 maturity=superseded
topic: <topic-group-key>       # index 分组用
created: <yymmdd>
last_updated: <yymmdd>
sources:
  - <来源>
related:
  - <代码路径>
tags: []
---
```

#### Page body 结构

```markdown
# <title>

**TLDR**: 一句话总结。必须与 frontmatter description 同步。

## Content

正文。一个概念一页。超 ~800 词考虑拆分。

## Related Pages (optional)

- [Related Page](relative-link.md) -- brief context

## Citations (optional)

[1] [Source](path) -- 来源说明
```

#### 文件命名

- draft/：`yymmdd-<slug>.md`（带日期便于 dream 按年龄清理）
- pages/：`<slug>.md`（无日期，主题标识）
- `<slug>`：kebab-case，3-5 词，全 wiki 唯一
- Sub-topics 用 parent 前缀：`editor-agent.md` + `editor-agent-dsl-preload.md`

#### 整合判断决策树

对每个 wiki 候选，先普通 Read 控制文件 `wiki/index.md`；需要核对已有 `pages/`/`draft/` 正文时用 `node "${QODER_PLUGIN_ROOT}/scripts/wiki-read.mjs" --project-root "$PWD" --path "<wiki-page-path>" --session-id "<current-session-id>"`，再判与已有页关系：

```
┌─ 强相关 + 补充（不推翻原有决策）       → 融合进该页
├─ 强相关 + 矛盾（推翻原有决策/架构）    → supersede
├─ draft/ 已丰富（2+ sources）           → promote
├─ 弱相关：提到但主题不同                → 建新页 + 已有页加 see also
└─ 无关                                  → 建新页
```

#### 融合操作

- Read 已有页全文
- 把新内容**融合**到合适章节，**不是末尾 paste**
- 必要时改章节结构
- frontmatter 加 `last_updated: <today_yymmdd>`
- 更新 index.md + 追加 log.md

#### Supersede 操作

1. **旧页**：maturity → superseded，加 superseded_by，body 顶部加 ⚠ 取代提示
2. **新页**：正常新建到 pages/，背景段引用旧页
3. 更新 index.md + 追加 log.md

#### Promote 操作

1. 从 draft/ 页内容生成 pages/ 页（去掉日期前缀）
2. frontmatter：maturity → draft 或 active，加 topic
3. draft/ 原文件删除（`.agents-personal` 删除护栏生效）
4. 更新 index.md + 追加 log.md

#### Maturity 规则

| Maturity | 条件 | 层 |
|---|---|---|
| stub | 单次提取 | draft/ only |
| draft | 2+ 次整合丰富 | pages/ |
| active | 经确认仍适用 | pages/ |
| superseded | 决策/架构已被替代 | pages/ |

### Step 2: rules 写入

**disposition=融合**（目标=现有 `rules/<x>.md`）：
1. Read 目标 rule 全文 → 融进合适章节（不是末尾 paste）
2. AGENTS.md 该 rule 触发条目已存在 → 不重复加；仅当本次扩了触发范围才 edit
3. 报告 "融进 rules/<x>.md，AGENTS.md [未动 / 已更新]"

**disposition=新建** → 双写：
1. Write `rules/<slug>.md`（文件名只用 slug，不带日期）
2. Edit AGENTS.md 在合适分组下加触发条目：
```markdown
### <topic 标题>
**触发**：<具体触发条件>
**读**：rules/<slug>.md
```

AGENTS.md 不存在时 → 询问用户：创建骨架 / 跳过 / 终止。

### Step 3: AGENTS.md 写入

被 distill `agents:project` 出口调用时，接收候选列表（含 `section_type` / `body`）。独立调用 `/personal-distill agents <描述>` 时 AI 自行判断 `section_type`。

AGENTS.md 不存在时 → 询问用户：创建骨架 / 跳过 / 终止。

#### 分节类型（section_type）

| section_type | 写入位置 | 说明 | 示例 |
|---|---|---|---|
| `var` | `## 变量覆盖` 或 `### 文档产出路径` 下 | 变量覆盖值 `{name} = value` | `{api_base_url} = https://...` |
| `style` | `## 语气风格` 分节（不存在则新建） | 输出语气/风格偏好 | 回复风格偏简洁、禁用某些表达 |
| `naming` | `## 命名惯例` 分节 | 命名约定（变量/文件/分支/skill 等） | 分支命名 `feat/<topic>` |
| `convention` | `## 协作约定` 分节（不存在则新建） | 项目级协作约定 | PR 必须 squash merge |
| `rules-trigger` | `## Rules` 分节下 | rules 写入联动的触发条目（见 Step 2） | `**触发**：... **读**：rules/...` |

#### 写入流程

1. **Read AGENTS.md** 全文，扫各分节标题
2. 按 `section_type` 路由：

**var（变量覆盖）**：
- 找 `{var_name} = ...` 行 → Edit 更新值
- 变量不存在 → 追加到 `## 变量覆盖` 节末尾（产出路径变量追加到 `### 文档产出路径` 下）
- 已有同名变量且值不同 → 展示新旧值对比，用户选保留哪个

**style（语气风格）**：
- `## 语气风格` 节已存在 → 融合进该节（不末尾 paste，按语义插入合适位置）
- 不存在 → 在 `## Rules` 之前新建 `## 语气风格` 节

**naming（命名惯例）**：
- `## 命名惯例` 节已存在 → 融合进该节
- 不存在 → 在 `## Rules` 之前新建 `## 命名惯例` 节

**convention（协作约定）**：
- `## 协作约定` 节已存在 → 融合进该节
- 不存在 → 在 `## Rules` 之前新建 `## 协作约定` 节

**rules-trigger（触发条目）**：联动 Step 2，不在此重复。

3. 报告每条写入操作："写入 AGENTS.md `## <节名>` [新增分节 / 融合 / 变量更新 {name}: old → new]"

#### 分节顺序约定

AGENTS.md 各节按以下顺序排列（新建分节插入对应位置）：

```
## 变量覆盖
### 文档产出路径
## 命名惯例
## 语气风格
## 协作约定
## Rules
```

### Step 4: 收尾

1. **index 重建**：扫 draft/ + pages/ 全部文件的 frontmatter，重建 index.md（≥30 页时拆分为两级索引）
2. **log 追加**：每条写入操作追加一行到 log.md（含 agents 写入：`agents | AGENTS.md ## <节名> | <摘要>`）
3. **报告**：列出本次所有操作 + personal-lint 结果

```
personal-distill 完成：
  ✓ 新建 wiki draft: draft/260626-xxx.md (stub)
  ✓ 融合 wiki pages: pages/xxx.md (+新内容)
  ✓ 新建 rules: rules/xxx.md + AGENTS.md 触发条目
  ✓ 写入 AGENTS.md ## 语气风格 (新增分节)
  ✓ 写入 AGENTS.md {api_base_url} = https://... (变量新增)
  📋 index.md 已更新, log.md 已追加 N 条

ℹ 健康检查：0 error / 1 warn
  ⚠ [W2] 孤立页: ...
  → 结论: 基本健康
```

## 索引架构

### 平铺模式（<30 页）

index.md 直接列所有条目。

### 两级索引（≥30 页）

```markdown
# Wiki Index

| Topic | 页数 | 说明 |
|---|---|---|
| [storage](index/storage.md) | 5 | 存储层架构、选型 |
| [agent-system](index/agent-system.md) | 8 | agent 装配 |
```

子索引 `index/<topic>.md` 列该 topic 下所有页面条目。
