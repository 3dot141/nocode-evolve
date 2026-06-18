# Skill Absorption v2 — 三套来源融合设计

> **doc-type**: Design Doc
> **状态**: draft
> **日期**: 260618
> **前置**: rfc-skill-fusion-pipeline.md（v1 融合）、skill-integration-map.md（已完成映射）

## 背景

v1 融合（skill-fusion-pipeline）从 agent-skills (24) + superpowers (14) 提取核心能力融入 devflow 8 阶段。之后新发现两个来源值得吸收：

1. **mattpocock/skills** — Matt Pocock 的个人 skill 套件，独立于 superpowers，侧重工程纪律（grill-me 面试、diagnose 调试、prototype 验证、design-it-twice 差异化设计）
2. **superpowers v5.1.0** — 新版本增加的能力（AskUserQuestion 结构化交互、Visual Companion、Plan Header 模板、Execution Handoff）

部分改动已在本次 review 中先行落地（v3.25.0-3.27.0）：Define/Design 边界拆分、AskUserQuestion、TaskCreate checklist。本文档规划剩余吸收项。

## 目标

把三套来源中**尚未吸收但有价值**的能力融入 devflow，不增加新阶段，不破坏现有流程。

**Success Criteria**:
- [ ] 每个吸收项有明确的落地位置（哪个 skill / 哪个 step）
- [ ] 无新增阶段——所有吸收项融入现有 8 阶段 + 横切
- [ ] eval fixture 覆盖关键吸收项的触发路由
- [ ] 版本号升到 3.28.0

**Out of Scope**:
- 已在 v3.25.0-3.27.0 落地的改动（Define/Design 拆分、AskUserQuestion、TaskCreate checklist）
- 不改 superpowers 源码——只改 nocode-evolve 的 skill/rule
- mattpocock/skills 中不适用的：scaffold-exercises、manage-obsidian、writing-beats/fragments/shape、migrate-to-shoehorn、setup-pre-commit

## 吸收清单

### 已完成（v3.25.0-3.27.0，本文档不再覆盖）

| # | 来源 | 改动 | 版本 |
|---|---|---|---|
| A1 | superpowers brainstorming | Define/Design/Brainstorming 边界拆分 | 3.25.0-3.26.0 |
| A2 | superpowers brainstorming | AskUserQuestion 结构化交互（Define + Design + Plan） | 3.27.0 |
| A3 | superpowers writing-plans | Plan Execution Handoff（subagent vs inline） | 3.27.0 |
| A4 | — | 6 个阶段 skill 加 TaskCreate checklist | 3.26.0 |
| A5 | — | design↔red-blue-deep 路由竞争修复 | 3.26.0 |
| A6 | — | 测试目标传递链 Design→Plan→Build→Verify | 3.26.0 |

### 待吸收（本文档规划）

```
┌─ Define ──────────────────────────────────────────────────┐
│ B1  grill-me     能查代码就不问用户                         │
│ B2  to-prd       快速路径: 已聊清楚直接出 restate 不面试     │
└───────────────────────────────────────────────────────────┘
┌─ Design ──────────────────────────────────────────────────┐
│ B3  design-it-twice   方案必须在核心思路上差异化             │
│ B4  grill-with-docs   方案对齐现有 wiki/ADR/架构决策        │
│ B5  prototype         高不确定性方案先跑 throwaway 原型      │
└───────────────────────────────────────────────────────────┘
┌─ Plan ────────────────────────────────────────────────────┐
│ B6  to-issues    task 标 HITL/AFK（人决策 vs agent 独立）    │
│ B7  writing-plans  Plan Document Header 标准模板            │
└───────────────────────────────────────────────────────────┘
┌─ 横切能力 ────────────────────────────────────────────────┐
│ B8  diagnose     Debug 横切加假设排序（任何阶段可触发）      │
└───────────────────────────────────────────────────────────┘
┌─ 独立 skill ──────────────────────────────────────────────┐
│ B9   handoff       skills/handoff/ — 长会话压缩传递        │
│ B10  caveman       skills/caveman/ — token 压缩模式        │
└───────────────────────────────────────────────────────────┘
┌─ 行为基线 (agent-about.md) ───────────────────────────────┐
│ B11  zoom-out      陌生代码先拉高视角再细看                 │
└───────────────────────────────────────────────────────────┘
┌─ 全阶段通用 ──────────────────────────────────────────────┐
│ B12  entry/exit gate   每阶段 checklist 加 Entry + Exit    │
│      Entry = 前置条件检查（本阶段能否执行）                   │
│      Exit = 后置条件检查（后续阶段能否执行）                  │
└───────────────────────────────────────────────────────────┘
```

## 各项详细设计

### B1: Define — 能查代码就不问用户

**来源**: mattpocock/skills `grill-me` — "if a question can be answered by examining the codebase, do so instead of asking the user"

**落地位置**: `skills/define/SKILL.md` Step 2b

**改动**:
在 Step 2b 的 AskUserQuestion 指导前加一条前置规则：

```
提问前自查：这个问题的答案是不是在代码里？
- 能通过 Read / grep 确认的事实（用什么框架、有没有类似实现、现有接口长什么样）→ 先自答，不问用户
- 只有用户才能回答的问题（意图、优先级、约束、business context）→ 用 AskUserQuestion 问
```

**例**:
- ❌ "你们现在用什么数据库？" → 读 config / docker-compose 自答
- ✅ "搜索功能要支持模糊匹配还是精确匹配？" → 这是意图，必须问

### B2: Define — 快速路径

**来源**: mattpocock/skills `to-prd` — "synthesize existing knowledge without further interviewing"

**落地位置**: `skills/define/SKILL.md` Step 2a 后新增判断

**改动**:
置信度 ≥ 95% 且之前会话已充分讨论 → 跳过 2b 面试，直接出 restate 给用户确认。不是所有任务都需要 4-6 轮提问。

### B3: Design — 差异化方案

**来源**: mattpocock/skills `design-it-twice` — radically different designs

**落地位置**: `skills/design/SKILL.md` Step 3

**改动**:
在 Step 3a 加约束：

```
2-3 方案必须在**核心架构思路**上不同，不是同一方案的参数变体。
判断标准：如果两个方案的数据流图长得一样，只是某个组件换了实现——那是一个方案的两个变体，不算两个方案。
```

### B4: Design — 对齐现有决策

**来源**: mattpocock/skills `grill-with-docs` — challenge plan against CONTEXT.md + ADRs

**落地位置**: `skills/design/SKILL.md` Step 2（探索项目上下文）

**改动**:
在 Step 2 的 Read 清单末尾加：

```
- 读 .agents-personal/wiki/（已有设计决策 / 术语 / 踩坑记录）
- 读 docs/ 下已有 ADR（如有）
- 方案探索时检查：新方案是否与已有决策冲突？冲突了不是不能做，但要在设计文档里说明为什么推翻旧决策
```

### B5: Design — 可选 prototype

**来源**: mattpocock/skills `prototype` — logic branch / UI branch

**落地位置**: `skills/design/SKILL.md` Step 3 和 Step 4 之间插入 Step 3.5

**改动**:

```
### Step 3.5: Prototype（可选，选方案前验证）

某个方案不确定能不能跑通？选之前先花 10 分钟验证，别选完写了设计文档才发现不可行。

- **Logic 验证**：写个最小可运行的脚本/测试验证核心逻辑
- **UI 验证**：出 2-3 个 UI 变体让用户对比

原型是 throwaway 的——验证完就扔。验证结论带入 Step 4 帮用户做选择。

**跳过条件**：所有方案都成熟、用户说"不需要原型"。
```

### B6: Plan — HITL/AFK 分类

**来源**: mattpocock/skills `to-issues` — HITL (Human-in-the-loop) vs AFK (Away-from-keyboard)

**落地位置**: `skills/plan/SKILL.md` Step 4

**改动**:
在 task 模板里加 `mode: HITL | AFK` 字段：

```
- HITL: 需要人决策的 task（API 设计确认 / 数据迁移策略 / 安全敏感操作）→ Build 时停下等用户
- AFK: agent 可独立完成的 task（写测试 / 实现纯逻辑 / 格式化代码）→ Build 时连续推进
```

帮助 Build 阶段判断哪些 slice 可以批量推进、哪些必须暂停。

### B7: Plan — Header 模板

**来源**: superpowers `writing-plans`

**落地位置**: `skills/plan/SKILL.md` Step 4 前

**改动**:
每份计划文档以标准 header 开头：

```markdown
# [Feature Name] Implementation Plan

> **执行方式**: 用 nocode-evolve:build 或 superpowers:subagent-driven-development 按 task 执行

**Goal**: [一句话]
**Architecture**: [2-3 句概括方案]
**Tech Stack**: [关键技术/库]
**Design Doc**: [设计文档路径（Full 场景）]
**Test Objectives**: [从 Design 传递的测试目标摘要]
```

### B8: Build Debug 横切 — 假设排序

**来源**: mattpocock/skills `diagnose` — "generate 3-5 ranked hypotheses before instrumentation"

**落地位置**: `skills/build/SKILL.md` 异常路径表后

**改动**:

```
进入 Debug 横切前，先列假设再验证：

1. 列出 3-5 个可能的根因，按可能性排序（最可能 → 最不可能）
2. 从最可能的开始，每次只验证一个假设
3. 验证方式：加日志 / 断点 / 最小复现，不是直接改代码
4. 假设验证后才进 Phase 4（写失败测试 → 修）

不列假设就直接改代码 = 盲改。盲改第一次可能蒙对，第二次肯定踩坑。
```

### B9: 横切 — handoff

**来源**: mattpocock/skills `handoff`

**落地位置**: `model/agent-about.md` 的 context-engineering 节补充

**改动**:
长会话建议开新会话时，不只是说"建议 /distill"，加一个 handoff 选项：

```
- /distill → 沉淀到 wiki/rules（永久归档）
- handoff → 压缩当前状态成一段文字（临时传递，给下一会话开局用）
```

handoff 格式：当前阶段 + 已完成什么 + 未完成什么 + 关键决策 + 打开的文件路径。不写到文件，输出给用户粘贴到新会话。

### B10: 横切 — caveman mode

**来源**: mattpocock/skills `caveman`

**落地位置**: `model/agent-about.md` 新增行为模式节

**改动**:
用户说"caveman / 简洁模式 / 省 token"时进入压缩模式：

```
- 去掉填充词、冠词、客套话
- 保留全部技术实质
- 每条回复尽量 ≤ 3 句
- 持续到用户说"正常模式"
```

不改代码 / commit message / 配置输出——那些本来就该精确。

### B11: 横切 — zoom-out

**来源**: mattpocock/skills `zoom-out`

**落地位置**: `model/agent-about.md` 的推理外化节补充

**改动**:
碰到陌生代码时，先拉高视角再往下钻：

```
- 先说这个模块在整个系统里的角色（一句话）
- 再说它和上下游模块的关系（进什么出什么）
- 最后才进入内部细节
```

不要一上来就读函数实现——先知道它在系统里干嘛。

## 实现计划

按阶段分批，每批一个 commit：

| 批次 | 覆盖 | 改动文件 |
|---|---|---|
| Batch 1 | B1 + B2 (Define) | `skills/define/SKILL.md` |
| Batch 2 | B3 + B4 + B5 (Design) | `skills/design/SKILL.md` |
| Batch 3 | B6 + B7 (Plan) | `skills/plan/SKILL.md` |
| Batch 4 | B8 (Build Debug) | `skills/build/SKILL.md` |
| Batch 5 | B9 + B10 + B11 (横切) | `model/agent-about.md` |
| Batch 6 | generate + test + bump | `manifest.json` + catalog + `plugin.json` |

## 风险

1. **指令膨胀**：每个 skill 加的指令会增加 SessionStart token。控制方式：每条吸收项 ≤ 5 行，不写长段。
2. **触发竞争**：新加的行为可能和现有 rule 冲突。控制方式：每批改完跑 eval。
3. **用户习惯变化**：AskUserQuestion 改变了交互方式。缓解：保留纯文字回退路径。
