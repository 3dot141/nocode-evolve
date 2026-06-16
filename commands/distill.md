---
description: 把当前会话沉淀分流到 wiki/rules 五个出口（项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip）
argument-hint: [optional-topic]
---

# /distill：会话沉淀分流命令

把当前会话里值得跨会话保留的内容沉淀到合适出口——AI 识别候选 + 自动贴分类标签 → 用户表格短码勾选/调整 → 五出口分发。

**设计文档**：`docs/plans/3dot141/260519-sediment-design.md`

**姊妹命令 / 关联**：
- `/sow`（必填意图、围绕主题浓缩并归档到 `$USER_VAULT_PATH/Memory/<layer>/`，v2 支持 Inbox/Inputs/Outputs 三层）—— `/distill` 在 cross-project 出口仅作 advisor，建议用户跑 `/sow`，不替执行、不替判层

---

## 入参（$ARGUMENTS）

- 无参：扫整个会话 context，自由识别 0~N 个值得沉淀的主题
- 带 `$ARGUMENTS`：聚焦该主题做沉淀，忽略其他内容

---

## 五个出口

| 出口标签 | 落地路径 | 动作 |
|---|---|---|
| `wiki:project` | `<proj>/.agents-personal/wiki/draft/` 或 `wiki/pages/` | 项目知识（架构/决策/调试/约定），两层目录 + 控制文件；走整合判断 |
| `wiki:cross-project` | （不写文件）| **advisor**：输出"建议跑 `/sow <intent>`" |
| `rules:project` | 融进现有 rule，或新建 `<proj>/.agents-personal/rules/<slug>.md` + 改 `AGENTS.md` 触发条件 | 当前指令，项目专属；**先整合判断**（融合优先），否则双写新建 |
| `rules:plugin` | 融进现有 rule（含 `rule-references/` 子文件），或新建 `$NOCODE_EVOLVE_REPO/rules/rule-<slug>.md` + 改 `rules/manifest.json` 后 `node hooks/generate.mjs` 重新生成 catalog 分片 + 升 `plugin.json` | 当前指令，跨项目通用；**先整合判断**（融合优先），否则三步联动建新 |
| `skip` | （不写）| 列出原因供用户最后反悔 |

---

## sessionHistory 怎么取

`/distill` 是 markdown slash command，**没有官方"会话历史"入参**。沿用 `/sow` 模式：**AI 直接看当前 context window 里的对话内容**，不读任何外部历史文件。

- 短会话（context 未压缩）：AI 能完整扫到从会话起点到现在的所有轮次
- 长会话（context 已被自动压缩）：AI 只看得到 summary + 未滚出窗口的轮次

不为长会话特殊补救。若 context 高水位时跑命令导致沉淀质量降低，由用户感知"早点跑"或"带 topic 聚焦"。

---

## 执行流程

### 0. 静默 Lint（wiki:project 出口存在时）

若 `<proj>/.agents-personal/wiki/` 已存在，在生成候选前先跑 lint 检查（见「Lint 检查」节）。问题不阻断，附在 Step 2 表格底部。wiki/ 不存在则跳过。

`/distill --dream` 模式：跳过 Step 0-5 的正常沉淀流程，直接进 dream 操作（见「Dream 操作」节）。

### 1. 扫会话 + 生成候选

按主题聚类（同主题合并），每个候选 AI 自动贴标签 + 生成完整 body：

```
候选 = { summary, label, slug, disposition, target_layer, path, body }
  summary      ≤40 字摘要
  label        ∈ {wiki:project, wiki:cross-project, rules:project, rules:plugin, skip}
  slug         kebab-case 3-5 词
  disposition  新建 | 融合→<现有文件路径> | supersede→<现有文件路径> | promote→<draft 文件路径>（仅 wiki:project / rules:* 有意义；见下「整合判断」）
  target_layer draft | pages（仅 wiki:project；首次出现→draft, 与 pages/ 强相关→pages, 与 draft/ 强相关→draft）
  path         disposition=新建 时按 label+target_layer 算落盘路径；融合/supersede 时=目标现有文件路径
  body         disposition=新建 时=完整文件正文（分发直接 write）；融合 时=要融进目标的内容片段
```

**整合判断（候选阶段就做，让表格诚实）**：对 `wiki:project` / `rules:project` / `rules:plugin` 候选，先读对应索引判与现有内容关系，设 `disposition`：

| 出口 | 读的索引 | 强相关 → 融合目标 |
|---|---|---|
| `wiki:project` | `wiki/index.md`（全局索引） | 现有 `pages/<x>.md` 或 `draft/<x>.md` |
| `rules:project` | `AGENTS.md` 触发表 | 现有 `rules/<x>.md` |
| `rules:plugin` | `rules/manifest.json` 规则清单（单源） | 现有 `rules/rule-<x>.md`，**或其 `rule-references/<x>/<子文件>.md`** |

```
┌─ 强相关 + 补充（不推翻原有决策）       → disposition=融合→<现有文件>
├─ 强相关 + 矛盾（推翻原有决策/架构）    → disposition=supersede→<现有文件>（仅 wiki:project）
├─ draft/ 已丰富（2+ sources）           → disposition=promote→<draft 文件>（仅 wiki:project）
├─ 弱相关：提到但主题不同                → disposition=新建（+ 现有处加 see also，仅 wiki）
└─ 无关                                  → disposition=新建
```

> **融合优先**：rules 出口默认倾向融进现有 rule，避免 catalog / AGENTS.md 触发条目碎片化。判不准时宁可标融合让用户在表格里看到目标文件，再用 `N new` 翻成新建——比默认新建后 catalog 膨胀更易纠。各出口融合的落地细节见下方分发节。

**标签启发式**（仅作 AI 初始建议，用户可改）：

| 内容性质 | 默认标签 |
|---|---|
| 决策回溯 / 演进 / 术语定义 / 踩坑 | `wiki:*` |
| 命令模板 / 触发条件 / 工作流约定 | `rules:*` |
| 项目特有业务术语 / 具体代码路径 | `*:project` |
| 跨项目通用 AI 行为 / skill 覆盖 | `*:plugin` (cwd 是 nocode-evolve 仓) 或 `wiki:cross-project` (cwd 不是) |
| 一次性进度 / 通用 best practice | `skip` |

**0 候选**：报"本次无可沉淀内容"，停。
**全 skip**：报"识别 N 项均建议跳过 + 原因"，停。

### 2. 表格呈现 + 编号选择

输出 Markdown 表格（列固定：`# / 摘要 / 存到 / 层 / 操作`），标签是 AI 内部路由，不暴露给用户：

```
| #  | 主题摘要                       | 存到           | 层     | 操作                                          |
|----|--------------------------------|----------------|--------|-----------------------------------------------|
| 1  | distill 命令分流机制设计      | 项目 wiki      | draft  | 新建 draft/260519-sediment-...md (stub)       |
| 2  | 存储架构补充                   | 项目 wiki      | pages  | 整合进 pages/storage-backend-...md            |
| 3  | 旧模型接入流程 v2              | 项目 wiki      | pages  | 取代 pages/old-onboarding.md，新建替代页      |
| 4  | fork-PR / cross-fork 教训      | 插件 rule      | —      | 融进 pr-flow-bkt-appendix.md                  |
| 5  | 一次性 bug 修复进度            | —              | —      | 跳过                                          |
```

「层」列仅 wiki:project 出口有意义（draft / pages），其他出口显示 `—`。

「存到」列的中文映射（AI 内部 label → 用户看到的）：

| AI 内部 label | 用户看到 |
|---|---|
| `wiki:project` | 项目 wiki |
| `wiki:cross-project` | 用户 vault (建议 /sow) |
| `rules:project` | 项目 rule |
| `rules:plugin` | 插件 rule |
| `skip` | — |

表格下方用 `AskUserQuestion` 多选组件让用户勾选要执行的编号：

```
选要执行的编号（可多选）:
□ 1. distill 分流设计 → 项目 wiki (新建)
□ 2. fork-PR 教训 → 插件 rule (融进)
□ 3. catalog 联动 → 插件 rule (新建)
□ 4. bug 进度 → 跳过
```

用户勾选后直接执行选中项。未选 = 跳过。

**全 skip**：报"识别 N 项均建议跳过 + 原因"，停。

### 3. 跨仓写入二次确认（仅当 rules:plugin 且 cwd ≠ nocode-evolve 仓时）

```
项 #N (rules:plugin) 将写入 ~/AI/nocode-evolve/，确认？(yes/no)
```

no → 整次 distill 终止；yes → 进入分发。

### 4. 五出口分发

按 label 分发：

#### `wiki:project` 出口

按下方「内嵌的 wiki:project 规则」执行——两层目录 / 整合判断 / frontmatter / TLDR / index 重建 / log 追加。

#### `wiki:cross-project` 出口（advisor）

不写文件。输出：

```
建议跑: /sow <ai 反推的意图候选>
原因: <这条为何跨项目>
```

**不替 `/sow` 校验 `$USER_VAULT_PATH`**——env 检查是 `/sow` 自己的责任，见 `skills/sow/SKILL.md` env 依赖节。（v1 env 名 `USER_WIKI_PATH` 已弃用，sow v2 改读 `USER_VAULT_PATH`）

**不替 `/sow` 判层**——sow v2 已支持三层（Inbox / Inputs / Outputs），advisor 仅推 `/sow <intent>`，由 sow 自判层 + 用户 NL 确认 loop。distill 不预估层、不绑层、不在 advisor 输出里附加层建议，职责保单一。

#### `rules:project` 出口

**disposition=融合**（强相关，目标=现有 `rules/<x>.md`）：

1. Read 目标 rule 全文 → 把 `body` 片段**融进合适章节**（必要时改章节结构；**不是末尾 paste**）
2. `AGENTS.md` 该 rule 的触发条目**已存在 → 不重复加**；仅当本次融合扩了触发范围才 `edit` 改那一条
3. 报告"融进 rules/<x>.md，AGENTS.md [未动 / 已更新触发]"

**disposition=新建** → 双写：

1. `write(<proj>/.agents-personal/rules/<slug>.md, body)`——文件名只用 slug，不带日期（rules 是当前指令不是历史记录）
2. `edit(<proj>/.agents-personal/AGENTS.md)` 在合适分组下加触发条目：

```markdown
## <topic 标题>
**触发**：<具体到能自识别的触发条件——遵循 overlay-agents-personal.md §2 写法>
**读**：rules/<slug>.md
```

**AGENTS.md 不存在时**：询问用户：

```
项 #N (rules:project) 需要 .agents-personal/AGENTS.md，文件不存在。怎么办？
  (1) 由 distill 创建骨架（含路由表说明 + 该项触发条目）
  (2) 跳过这一项（不写 rules 文件，让我先手建 AGENTS.md）
  (3) 终止整次 distill
```

骨架模板：

```markdown
# AGENTS.md

> 项目本地针对 agent 的指令路由表。触发条件在这里，详细指令在 rules/<topic>.md。

## <第一条触发条件标题>
**触发**：<具体到能自识别>
**读**：rules/<slug>.md
```

#### `rules:plugin` 出口（融合优先，否则三步联动）

按 `disposition` 走下方「rules:plugin 分发：融合路径 + 三步联动」节。

#### `skip` 出口

不写文件。报告里列出"被跳过的 N 项 + 原因"，给用户最后一次反悔机会。

### 5. 总报告

```
沉淀完成：
  ✓ 新建 wiki draft: draft/260616-new-model-onboarding.md (stub)
  ✓ 整合 wiki pages: pages/storage-backend-architecture.md (active, +交互卡片段)
  ✓ supersede wiki: pages/old-onboarding.md → pages/new-model-onboarding-checklist.md
  ✓ 改 rules:project: .agents-personal/rules/distill-shortcode.md + AGENTS.md
  ✓ advisor: /sow 沉淀今天讨论的 prompt 优化经验
  ✓ skip: 一次性 bug 修复（原因：无沉淀价值）
  📋 wiki/index.md 已更新, wiki/log.md 已追加 3 条

⚠ 融进 plugin rule（子文件）: rules/rule-references/rule-finishing-branch/pr-flow-bkt-appendix.md
  manifest: 未动（门面 rule-finishing-branch 已在 manifest 路由）  版本: 1.3.1 → 1.4.0 (minor)
⚠ 跨仓新建 plugin rule: ~/AI/nocode-evolve/rules/rule-distill-extension.md
  manifest+generate: rules/manifest.json 已加条目, generate 重新生成 catalog 分片  版本: 1.4.0 → 1.5.0 (minor)
  请到 nocode-evolve 仓 review + commit + 询问是否 push。

ℹ Wiki 健康检查：0 error / 1 warn / 1 info
  ⚠ 孤立页: draft/260512-local-dev-beta-feature-toggle.md
  ℹ draft/ 有 >30 天 stub，建议跑 /distill --dream
```

---

## 内嵌的 wiki:project 规则

借鉴 [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 三层架构 + [OKF](https://okfn.org/) 元数据标准，适配 `.agents-personal/wiki/` 的项目本地 AI 知识库场景。

### 目录结构

```
<project>/.agents-personal/
├── wiki/
│   ├── index.md              全局索引（OKF §6，按 topic 分组，可从 page frontmatter 重建）
│   ├── log.md                操作日志（OKF §7，按日期分组，新在前）
│   ├── draft/                草稿层（单次 distill 首产，maturity=stub）
│   │   └── yymmdd-<slug>.md
│   └── pages/                发布层（经整合/promote 的成熟知识）
│       └── <slug>.md
├── rules/
└── AGENTS.md
```

**首次使用**：wiki/ 目录或 index.md/log.md 不存在时，distill 自动创建骨架（空 index + 空 log + draft/ + pages/ 目录）。

### 两层职责

| 层 | 位置 | 写入时机 | 文件名 | Maturity |
|---|---|---|---|---|
| Draft | `wiki/draft/` | distill 新建首次出现的主题 | `yymmdd-<slug>.md`（带日期便于清理） | stub |
| Pages | `wiki/pages/` | 整合已有 / promote / supersede 替代页 | `<slug>.md`（无日期，主题标识） | draft / active / superseded |

### Page types

| Type | 用途 | 举例 |
|---|---|---|
| overview | 主题入口，链接子页 | 三仓架构总览 |
| concept | 机制/模式/抽象概念 | DDD domain-repo-adapter |
| guide | 操作步骤/配置/setup | 三套服务本地联调 |
| practice | 最佳实践/约定 | 本地 dev feature toggle |
| comparison | A vs B 分析/权衡 | — |
| reference | 查阅材料/速查表 | SigNoz event catalog |
| troubleshooting | 问题/方案配对 | TOKEN_POINTS 排查 |

### Page frontmatter

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
type: overview | concept | guide | practice | comparison | reference | troubleshooting
description: <一句话，与 body TLDR 同步>
maturity: draft | active | superseded
superseded_by: <slug>          # 仅 maturity=superseded
topic: <topic-group-key>       # index 分组用
created: <yymmdd>
last_updated: <yymmdd>         # 整合时更新；首次创建不写
sources:
  - <来源会话/PR/文件>
related:                       # 相关代码路径（dream 用来核对代码存在性）
  - <代码路径>
tags: []
---
```

### Maturity 规则

| Maturity | 条件 | 层 |
|---|---|---|
| stub | 单次 distill 提取 | draft/ only |
| draft | 2+ 次整合丰富，有交叉引用 | pages/ |
| active | 经确认仍适用的知识 | pages/ |
| superseded | 决策/架构已被替代 | pages/（保留供考古） |

### Page body 结构

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

### 文件命名

- **draft/**：`yymmdd-<slug>.md`（带日期，便于 dream 按年龄清理）
- **pages/**：`<slug>.md`（无日期，主题标识；成熟页不按时间排）
- `<slug>`：kebab-case，3-5 词，全 wiki 唯一
- Sub-topics 用 parent 前缀：`editor-agent.md` + `editor-agent-dsl-preload.md`

### 整合判断决策树

对每个 wiki:project 候选，先 Read `wiki/index.md`，判断与已有页关系：

```
┌─ 强相关 + 补充（不推翻原有决策）       → 融合进该页
├─ 强相关 + 矛盾（推翻原有决策/架构）    → supersede（见下方「Supersede 操作」）
├─ draft/ 已丰富（2+ sources）           → promote（见下方「Promote 操作」）
├─ 弱相关：提到但主题不同                → 建新页 + 已有页加 see also
└─ 无关                                  → 建新页
```

**target_layer 启发式**（仅 disposition=新建 时）：

| 条件 | target_layer |
|---|---|
| 首次出现的主题 | draft（maturity=stub） |
| 与 pages/ 已有页强相关 | pages（整合） |
| 与 draft/ 已有页强相关 | draft（整合，丰富后考虑 promote） |

整合 examples：

| 已有页 | 本次主题 | 决策 |
|---|---|---|
| pages/rules-injection-overlay | inject-rules.sh 扩展新 rule 类型 | ✅ 融合（同一系统延伸） |
| pages/rules-injection-overlay | design-doc-writing skill 架构 | ✅ 建新页 draft/（不同系统） |
| pages/auth-token-storage（选 JWT） | 改用 session-based | ✅ supersede（决策推翻） |
| draft/260514-editor-agent（2 sources） | — | ✅ promote → pages/ |

### 融合操作

- Read 已有页全文
- 把新内容**融合**到合适章节，**不是末尾 append paste**
- 必要时改章节结构（如「决策」拆为「v1 决策 + v2 修订」）
- frontmatter 加 `last_updated: <today_yymmdd>`
- 文件名保持不变
- 更新 index.md + 追加 log.md

### Supersede 操作

当融合发现新内容**推翻**（而非补充）原有决策/架构时：

1. **旧页**：`maturity` → `superseded`，加 `superseded_by: <new-slug>`，body 顶部加：
   ```
   > ⚠ 本页已被 [<new-title>](<new-path>) 取代。保留供考古。
   ```
2. **新页**：正常新建到 pages/，背景段引用旧页作为决策演进脉络
3. 更新 index.md（旧页移到 Superseded 区）+ 追加 log.md

### Promote 操作

当 draft/ 页经多次整合丰富（2+ sources、有交叉引用），建议提升到 pages/：

1. 从 draft/ 页内容生成 pages/ 页（去掉日期前缀，文件名变为 `<slug>.md`）
2. frontmatter：`maturity` → `draft` 或 `active`，加 `topic`
3. draft/ 原文件**删除**（内容已迁移，不保留重复）
4. 更新 index.md + 追加 log.md

### Dream 操作（`/distill --dream`）

自主维护，检查 wiki 与代码实际状态的偏差，提议清理动作。借鉴 [Codex Memory](https://developers.openai.com/codex/memories) 的 extract→consolidate 模式。

**触发**：用户调 `/distill --dream`（主动），或 `/schedule` 定期。distill 正常流程开头若发现 draft/ 有 >30 天 stub，提示"建议跑 `--dream`"。

**阶段 1: Scan**（提取候选动作）

对 draft/ + pages/ 每一页：
- 读 frontmatter (`created`, `last_updated`, `maturity`, `related`)
- 读 `related` 里的代码路径 → 检查路径是否仍存在
- 比对 page 描述 vs 代码现状（抽样 Read 关键文件）
- 生成动作候选：

| 动作 | 条件 |
|---|---|
| prune | draft/ 中 >30 天的 stub，从未被整合 |
| stale | related 代码路径已大幅变化或部分不存在 |
| merge | 两个 page 主题高度重叠 |
| promote | draft/ 中已丰富（2+ sources）但未提升 |
| archive | related 代码路径全部不存在（重构已删除） |
| ok | 无需动作 |

**阶段 2: Propose**（呈现 + 用户确认）

输出动作表格，用 `AskUserQuestion` 多选让用户勾选：

```
| # | 页面 | 动作 | 理由 |
|---|---|---|---|
| 1 | draft/260512-old-toggle.md | prune | stub, 35 天未整合 |
| 2 | pages/ddd-domain-repo.md | stale | related 路径 3/5 已不存在 |
| 3 | draft/260518-prompt-injection.md | promote | 已有 2 sources |
```

**阶段 3: Execute**（执行选中动作）

- **prune**：删除 draft 文件（`.agents-personal` 删除护栏生效，需二次确认）
- **stale**：在 page 顶部加 `⚠ stale` 标记 + 列出失效的 related 路径，maturity 不改
- **merge**：两页合一（融合内容 + 更新引用）
- **archive**：`maturity` → `superseded`，或删除（用户选）
- **promote**：draft → pages（同正常 promote 流程）
- 全部完成后更新 index.md + 追加 log.md

### Lint 检查（distill 开头静默跑）

distill 执行流程 Step 0 静默跑 lint，问题附在候选表格底部。

| 类别 | 检查 | 严重度 |
|---|---|---|
| 结构 | index.md 与实际 pages 不一致 | error |
| 结构 | 孤立页（无 Related Pages 引用） | warn |
| 结构 | 过大页（>800 词） | info（建议 split） |
| 结构 | 缺 TLDR 或 TLDR ≠ description | warn |
| 结构 | draft/ 中 >30 天未 promote 的 stub | info |
| 内容 | pages/ 中 >90 天未 last_updated | info（可能 stale） |
| 内容 | superseded_by 目标不存在 | error |
| 引用 | pages/ 页 body 引用 draft/ 页（违规） | warn |
| 索引 | index.md 可重建性验证 | warn |

输出格式（附在候选表格底部）：
```
ℹ Wiki 健康检查：2 warn / 1 info
  ⚠ INDEX 多余条目: 260511-old-page.md（文件已不存在）
  ⚠ 孤立页: 260512-local-dev-beta-feature-toggle.md
  ℹ 过大页: 260609-storage-backend-architecture.md（1200 词，建议拆分）
```

### index.md 重建算法（OKF §6）

index.md 可从 draft/ + pages/ 的 frontmatter + TLDR 完全重建：

```
1. 扫 pages/*.md + draft/*.md frontmatter
2. 读 body 首个 **TLDR**: 行 → 作为 description（fallback 到 frontmatter description）
3. 按 topic 分组（无 topic → "Uncategorized"）
4. active/draft 页按 topic 分组展示，组内 maturity 降序 → date 降序
5. superseded 页归底部 "Superseded" 组
6. draft/ 页作为 pages/ 同名条目的 subordinate 展示
7. 写 index.md
```

index.md 模板：

```markdown
# Wiki Index

## <Topic Group>
- [<title>](pages/<slug>.md) -- <TLDR> [<type>, <maturity>]
  - Draft: [<title>](draft/yymmdd-<slug>.md) [<type>, stub]

## Uncategorized
- [<title>](draft/yymmdd-<slug>.md) -- <TLDR> [<type>, stub]

## Superseded
- ~~[<title>](pages/<slug>.md)~~ → `<superseded_by>` [superseded]

<!-- 由 /distill 自动维护，可从 draft/ + pages/ frontmatter 完全重建 -->
```

### log.md 格式（OKF §7）

按日期分组，新条目在前。每条：`**<operation>**: <slug> — <动作描述>`。

```markdown
# Wiki Log

## <yymmdd>
* **distill**: <slug> — 新建 draft/yymmdd-<slug>.md (stub)
* **promote**: <slug> — draft → pages (active)
* **supersede**: <old-slug> → <new-slug>
* **dream**: prune draft/yymmdd-<slug>.md (stub, N天未整合)
* **dream**: stale pages/<slug>.md (related N/M 路径失效)
* **lint**: N warn / M info
```

### 跨层引用规则

- draft/ 页可引用 pages/ 页（参考成熟知识）
- pages/ 页**不**引用 draft/ 页（不向下依赖不稳定内容）
- 所有引用用相对路径

### 向后兼容（已有 wiki 迁移）

| 已有状态 | 处理 |
|---|---|
| 有 `wiki/pages/` + `INDEX.md`（旧格式） | `INDEX.md` 重命名为 `index.md`；pages/ 不动 |
| 已有页无 `maturity` | 默认视为 `active` |
| 已有页无 `topic` | 归 `Uncategorized` |
| 已有页无 TLDR | 用 frontmatter `description` 作 fallback |
| 无 `wiki/draft/` | distill 首次检测到缺失时自动创建 |
| 无 `wiki/index.md` / `wiki/log.md` | distill 首次自动创建骨架 |
| 已有页文件名 `yymmdd-<slug>.md` 在 pages/ | 保留不改名（pages/ 新页不带日期，但老页兼容） |

### wiki 消费模型（AI 日常怎么用 wiki）

wiki 不只是 distill 的"存放处"，是 AI 的**项目知识第一站**。三条使用路径：

**路径 A: 被动查阅**（现有行为，maturity 感知增强）

触发时机不变（设计/选型/方案/项目历史背景/brainstorming/design-doc-writing）。读 wiki/index.md → 按 topic 定位 → 读 page。maturity 感知：
- `active`/`draft` (pages/) → 直接引用
- `stub` (draft/) → 参考 + 注明"单源待验证"
- `superseded` → 跳过（除非用户问历史决策演进）
- 有 `⚠ stale` 标记 → 引用 + 注明"可能过时"

**路径 B: 主动查询 + 回写**（新增，飞轮机制）

AI 工作中遇到项目特有知识（子系统机制/配置约定/联调/架构）→ **先查 wiki/index.md 再走代码探索**。如果代码探索产出了可复用的项目知识 → 写入 draft/ 作 stub → 追加 log.md（`**query-write**`）。不回写的：一次性事实查询、与项目架构/设计/约定无关。

**路径 C: 做梦维护**

`/distill --dream` → scan wiki vs 代码 → 修剪/标 stale/合并/promote。

### 反模式

- ❌ **末尾 paste**：整合时把新内容堆到 `## YYMMDD Update` 节——融进合适章节
- ❌ **过度整合**：把弱相关内容塞进同一页 → 杂物间页面
- ❌ **永远新建**：每次都建新页绕过整合判断
- ❌ **写空文件**：会话没值得沉淀的内容时也建页凑数
- ❌ **slug 用日期**：slug 是主题标识，pages/ 不带日期
- ❌ **draft 永不 promote**：draft/ 页丰富后应 promote 到 pages/，不要让 stub 永驻
- ❌ **supersede 不标旧页**：新建替代页但忘了标旧页 `superseded`
- ❌ **pages 引用 draft**：pages/ 页 body 引用 draft/ 页 = 向下依赖不稳定内容
- ❌ **dream 不确认就删**：`.agents-personal` 是 gitignored 不可恢复，dream 的 prune/archive 必须用户确认

---

## rules:plugin 分发：融合路径 + 三步联动

新架构下 `rules/` 不再分 axis（`overlay-` / `agent-` / `tool-` 命名前缀已废弃），所有触发式规则统一命名为 `rule-<slug>.md`，由 `rules/manifest.json`（单源）登记、`node hooks/generate.mjs` 生成进 `model/agent-catalog-*.md`（catalog 分片，完整路由常驻 context），agent 命中粗桶后按触发条件按需 Read。

按候选的 `disposition` 分两条路：**融合**（强相关，融进现有 rule）走下方「融合路径」；**新建**走「三步联动」。

### 融合路径（disposition=融合）

目标可能是顶层 `rules/rule-<x>.md`，**也可能是门面的子文件** `rules/rule-references/<x>/<子文件>.md`（如 fork-PR 知识融进 `pr-flow-bkt-appendix.md`）。

1. **Read 目标文件全文** → 把 `body` 片段**融进合适章节**（必要时改章节结构，如新增 Workflow / Step 分支；**不是末尾 paste**）
2. **manifest 处理**（关键差异——不无脑新增条目；改的是单源 `rules/manifest.json`，不手改生成物 catalog 分片）：
   | 融合目标 | manifest 动作 |
   |---|---|
   | 顶层 `rule-<x>.md`，触发/摘要仍准确 | **不动** |
   | 顶层 `rule-<x>.md`，本次融合扩了 scope（触发范围变大） | **改 manifest 里那条** rule 的 triggers/summary，**不新增条目**；改后 `node hooks/generate.mjs` 重新生成 catalog 分片 |
   | `rule-references/` 子文件（门面 `rule-<x>.md` 已路由） | **不动**（门面 rule 已在 manifest 路由） |
3. **升 `plugin.json` 版本**：融合通常 `minor`（补充现有 rule 能力 = 兼容增强）或 `patch`（纯文案补充）；不默认像新建那样跳 minor
4. 报告："融进 `<目标路径>`，manifest [未动 / 已更新条目 `<slug>` 并 generate 重新生成 catalog 分片]，版本 `x → y`"

> 融合路径**不新增 manifest 条目、不新建文件**——这正是「融合优先」要省下的路由表面。

### 三步联动（disposition=新建）

#### Step 1: 写 rule 文件

文件路径：`${NOCODE_EVOLVE_REPO}/rules/rule-<slug>.md`。

slug 冲突 → **不直接 abort，转整合判断**：slug 已存在往往说明这就是融合目标。报"slug `rule-<slug>.md` 已存在——疑似融合目标，建议 `N fuse rules/rule-<slug>.md`（融进它）或 `N /<new-slug>`（确实是新主题，改名建新）"，回表格等用户。

`write(filePath, body)`。

### Step 2: 改 `rules/manifest.json`（单源）登记新 rule + 重新生成

新架构下 `rules/manifest.json` 是唯一真值源；`model/agent-catalog-*.md`（catalog 分片，完整路由常驻）是 `node hooks/generate.mjs` 的**生成物**——**禁手改生成物**，只改 manifest 再重新生成。manifest 没登记就等于 agent 触发不到（sanity check 会 stderr 警告）。

**实施策略（具体到 Edit 工具调用）**：

1. Read `${NOCODE_EVOLVE_REPO}/rules/manifest.json`，定位 `rules` 数组
2. 在数组末尾新增一条 rule 对象，挑合适的 `bucket`（必要时看 `buckets` 段），含 `id` / `bucket` / `trigger_desc`（触发）/ `read`（`${CLAUDE_PLUGIN_ROOT}/rules/rule-<slug>.md`）/ `summary`（摘要）/ 可选 `guard` / `pretooluse`：

```json
{
  "id": "<slug>",
  "bucket": "<bucket-id>",
  "trigger_desc": "<具体到能自识别的触发条件，不写\"看情况 / 需要时\">",
  "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-<slug>.md",
  "summary": "<一句话核心动作，让 agent 看了就知道这条 rule 干什么>"
}
```

3. 跑 `node hooks/generate.mjs` 重新生成 catalog 分片（`node hooks/generate.mjs --check` 验零漂移）

**触发条件写法约束**：必须具体到 agent 自己能判断命中——参考 manifest 里已有条目（如 push-summary 的 `trigger_desc`，不是"需要时读"）。

**不用 sed/awk**——JSON 多行匹配脆弱；Edit 工具的精确字符串匹配 + `generate.mjs` 重生成更可靠。

### Step 3: 升 `plugin.json` 版本

```
新增 rule        → minor   (默认；类比 CLAUDE.md:21-25 「新增 hook/skill/兼容性增强 = minor」)
改既有规则语义反转 → major
文案修订          → patch  (rarely)
```

`major` 需要会话里明确出现"反转既有规则"、"删除已部署规则"等破坏性信号。

Read `.claude-plugin/plugin.json` → bump version → Write 回去。

### 三步契约

- 三步**必须按顺序**：先写 rule 文件 → 再改 manifest 并 generate 重新生成 → 再升版本；任一步失败后续不执行
- **本逻辑内三步不回滚已成功步**（避免半成品状态更难恢复——文件保留比删了让用户从头来更易恢复）
- **但本项失败不影响其他候选项的分发**——与整体"非 transactional" 一致
- commit/push 不进本逻辑——CLAUDE.md 工作流约定 commit 由主交互完成

### 报告

```
已写入 plugin rule: rule-<slug>.md
manifest+generate: rules/manifest.json 已加条目, node hooks/generate.mjs 重新生成 catalog 分片
版本: <oldVersion> → <newVersion> (<bumpLevel>)
请到 nocode-evolve 仓 review + commit + 询问是否 push。
```

### 孤儿 rule 划界

如果发现 `nocode-evolve/rules/` 下有未被 `rules/manifest.json` 登记（故未进 catalog 分片）的孤儿文件——**不主动补**。归用户手动处理（inject-rules.sh sanity check 每 session stderr 警告，足够提示）。

理由：scope 控制——`/distill` 是沉淀命令，不是 manifest 整理工具。

在报告末尾仅做提示：

```
ℹ 发现孤儿 rule N 个：[rule-foo.md, ...]
   sanity check 已警告，请手动登记进 rules/manifest.json 后跑 generate, 或评估是否删除。
```

---

## 反模式

- ❌ **AI 自判直接写**——必须经过候选呈现 + 用户勾选
- ❌ **rules 永远新建**：明明是现有 rule 的延伸还新建 `rule-<slug>.md` + 加 catalog 条目 → catalog 膨胀 + 触发条件碎片化。强相关先融合（含融进 `rule-references/` 子文件）
- ❌ **融合还新增 catalog 条目**：融进现有 rule 时门面条目已覆盖，无脑再加一条 = 重复路由
- ❌ **末尾 paste**：整合 wiki 已有页 / 融进现有 rule 时不把新内容堆到 `## YYMMDD Update` 节——融进合适章节
- ❌ **跨仓写入不二次确认**：cwd ≠ nocode-evolve 仓而要写 plugin rule 时，不弹二次确认就动手
- ❌ **写 plugin rule 但忘了登记进 rules/manifest.json 并 generate 重新生成**——sanity check 警告等于白沉淀
- ❌ **写 plugin rule 但忘升 version**——CLAUDE.md 硬约束
- ❌ **AGENTS.md 加触发条件含糊**："需要时读 rules/foo.md" 等于没触发
- ❌ **rules 文件名带日期**：rules 是当前指令不是历史记录，文件名只用 slug
- ❌ **在 distill 内部 commit / push**：只写文件，commit/push 由用户在主交互流程里处理
- ❌ **替 /sow 校验 env**：cross-project advisor 不检查 `$USER_VAULT_PATH`——是 /sow 自己的责任

---

## 边界情况

| 场景 | 处理 |
|---|---|
| 0 候选 | 报"本次无可沉淀内容"，停 |
| 全 skip | 报"识别 N 项均建议跳过 + 原因"，停 |
| `optionalTopicArg` 在会话里无对应内容 | 报"未找到 topic 相关内容"，停 |
| context 已被压缩到只剩 summary | 仍按可见内容尽力生成候选；表格脚注加 "⚠ context 部分被压缩，沉淀可能不完整" |
| `<proj>/.agents-personal/AGENTS.md` 不存在 | 三选一：(1)创建骨架 (2)跳过本项 (3)终止 distill |
| slug 冲突 (rules / wiki) | **转整合判断**（疑似融合目标）：在 AskUserQuestion 里加选项"融进已有 <path>" 和 "改名新建" |
| 融合目标是 `rule-references/` 子文件 | catalog 不动（门面已路由）；仅升版本 |
| `$NOCODE_EVOLVE_REPO` 路径不存在 | 插件 rule 项在表格里标灰 + 不可选 |
| Step 1 写文件后 Step 2 改 manifest / generate 失败 | 不回滚 Step 1，报"写入了 rule 文件但 manifest 未登记，请手动改 manifest 后跑 generate" |
| Step 2 后 Step 3 改 plugin.json 失败 | 不回滚前两步，报"前两步完成但版本未升，请手动改 plugin.json" |
| nocode-evolve 仓有未提交改动 | 不阻断，报告里加一行"两边都要 commit" |
| `nocode-evolve/rules/` 下有孤儿文件 | 不主动补路由；报告末尾仅提示 |
| wiki/ 目录不存在（首次使用） | distill 自动创建骨架：`wiki/index.md` + `wiki/log.md` + `wiki/draft/` + `wiki/pages/` |
| 已有 `wiki/INDEX.md`（旧格式大写） | 重命名为 `index.md`（OKF §6） |
| 已有 pages/ 页无 maturity/topic/TLDR | 向后兼容 fallback：默认 active / Uncategorized / 用 description |
| `/distill --dream` 但 wiki/ 为空 | 报"wiki 无内容，dream 无需执行"，停 |
| dream scan 发现 related 路径全不存在 | 建议 archive（用户确认是否删除或标 superseded） |
| dream prune draft/ stub | `.agents-personal` 删除护栏生效，需二次确认 |
| promote 时 pages/ 已有同名文件 | 转融合判断（draft 内容融进已有 pages 页） |

---

## 写完后

不要主动 push 或 commit——按 CLAUDE.md 工作流，commit 由主交互流程在你完成所有沉淀后单独执行。

如本次涉及 `rules:plugin` 出口，提醒用户：
- `nocode-evolve` 仓有新文件（rule + manifest 改 + generate 生成物 catalog 分片 + plugin.json）
- 主仓如有 rules:project 改动也需要 commit
- 两边的 commit / push 由用户自己决定
