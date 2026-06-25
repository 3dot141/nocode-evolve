---
name: dev-design
description: Use when Define is complete and the task needs architecture or approach decisions. Use when devflow routes to Design stage, or when the user says "设计方案/怎么做/选什么技术/架构设计/方案对比/重构方案/技术spec/出方案/怎么实现". For Full-scene tasks. Not for writing code comments, README, or commit messages.
---

# design — 从问题到解法

**Iron Law: 方案未对比的设计是假设不是设计。只提一个方案就让用户确认 = 假共识。**

Define 回答"做什么"，Design 回答"怎么做"。核心动作是探索 **approach**——多个差异化方案对比后选一个。brainstorming 在这里用于发散解法空间。

> Leading word: **approach**。没有对比过的 approach 就没有设计，只有假设。

输入：Define 的 restate（问题边界 + 验收标准 + 路径清单 + 路径↔SC 绑定）。
输出：确认方案 + 测试目标(TO，覆盖每条路径) + verify 策略 + 设计文档。

> 路径 / ID / 约束格式见 `{NOCODE_SKILL_REF}/path-conventions.md`。

## 非本 skill 请求

改 README / 写 commit message / 纯执行不需设计 / Define 未完成（无 restate）→ 不进 Design。Define 未完成回 Define；Mini/Standard 场景跳 Design 直接进 Plan。

## Entry Gate

- [ ] Define restate 存在且用户已确认
- [ ] 场景分类 = Full

## Checklist (TaskCreate)

1. **探索解法空间** — 代码 pattern 分析 + 外部方案搜索 + 已有决策对齐
2. **提出 2-3 方案** — 核心思路差异化，附推荐 + 权衡
3. **Prototype 验证**（可选）— 高不确定性方案先跑原型
4. **用户选方案** — AskUserQuestion Gate
5. **方案←→目标对齐** — 回检 restate 是否冲突
6. **测试目标** — 以路径为骨架，每条路径/约束 → 至少一条 TO
7. **Verify 策略 + 自审** — 按层级分组 + 不测项 + 风险排序 + 5 维自审 + 用户确认
8. **路径覆盖审核** — 方案/TO/策略三层对齐，产出覆盖状态表
9. **写设计文档** — 调 design-doc-writing，verify 策略落盘「验证策略」章节

> 端到端示例（restate → 方案对比 → 选定 → 测试目标）见 `references/examples/example-design-session.md`

## 领域指南（按需 Read）

方案探索时，检查以下领域是否与本次设计相关。相关的 Read 对应指南，做出设计决策写入设计文档：

| 领域 | 何时 Read | 在设计文档里写什么 |
|---|---|---|
| `{NOCODE_SKILL_REF}/architecture-principles.md` | 始终 | 模块边界 / Deep vs Shallow / Seam 位置 |
| `{NOCODE_SKILL_REF}/api-design-guide.md` | 涉及 API 或模块接口 | 契约定义 / 错误语义 / 命名约定 |
| `{NOCODE_SKILL_REF}/security-guide.md` | 涉及用户输入/认证/数据 | 威胁模型 / 认证方案 / 数据保护决策 |
| `{NOCODE_SKILL_REF}/performance-guide.md` | 有性能需求或高负载 | 负载目标 / 缓存策略 / SLO |
| `{NOCODE_SKILL_REF}/frontend-guide.md` | 涉及 UI | 渲染策略 / 组件架构 / 状态管理 / 设计系统 |
| `{NOCODE_SKILL_REF}/observability-guide.md` | 需要生产可观测 | "正常"定义 / 监控信号 / 告警策略 |
| `{NOCODE_SKILL_REF}/testing-guide.md` | 始终（测试目标推导用） | 测试分层 / Seam 选择 / 测试基础设施 |
| `{NOCODE_SKILL_REF}/migration-guide.md` | 替换已有系统 | 过渡方案 / 兼容策略 / 灰度计划 |

不是每份设计文档都覆盖全部领域——加个 API 字段不需要写可观测性节。但逐项检查"跟我的设计有没有关系"。

## 协议

### Step 1: 探索解法空间

探索分三层——代码内部、外部方案、已有决策，全部在提方案之前完成。不凭记忆，每个判断标注来源。

**三层并行执行**：1a、1b、1c 互不依赖，**在一条消息里同时发出三个 Agent 调用**，结果全部回来后再综合。

#### 1a. 代码 pattern 深度分析（subagent）

`Agent(subagent_type: "semble-search")`，prompt 包含 restate 关键词 + 要找什么：

- **已有实现**：找当前代码库里解决过类似问题的实现。不只是找"有没有"，要理解"怎么做的、为什么这么做"
- **可复用 pattern**：现有代码的架构 pattern、抽象层次、模块边界。新方案应跟随已有 pattern，除非有充分理由偏离
- **影响面**：这次改动会触及哪些模块、哪些调用链、哪些 contract
- 标注 `[Read path:line]` 来源

#### 1b. 外部技术方案搜索（subagent）

`Agent(subagent_type: "fork")`，prompt 用 Exa/WebSearch + deepwiki 搜索：

- **开源库/框架**：有没有现成的库可以用？成熟度、维护状态、社区活跃度
- **最佳实践**：业界怎么解决这类问题？有没有公认的架构模式？
- **技术博客/案例**：别人踩过什么坑、有什么经验教训
- 标注 `[SOURCE: url]` 来源
- **不把搜索结果当事实**：网上方案需要对照本项目实际情况评估适用性

#### 1c. 对齐已有决策（subagent 或内联）

`Agent(subagent_type: "fork")` 或直接内联 Read（文件少时不必开 agent）：

- 读 `.agents-personal/wiki/`（已有设计决策/术语/踩坑）+ `docs/` 下已有 ADR
- 新方案与旧决策冲突不是不能做，但要在设计文档里说明为什么推翻
- **Domain 词汇对齐**：方案里的术语必须和项目的 domain 语言一致

**工具降级**：semble-search 不可用 → 降级 Bash grep + Explore agent。Exa/WebSearch 不可用 → 跳过外部搜索，标注"网络不可用，方案基于代码内部分析"。

#### 探索综合

三路结果回来后，输出一段探索总结：
- 代码里已有什么（可复用的 / 要改的 / 会受影响的）
- 外部有什么方案（库 / 模式 / 经验）
- 已有决策里有什么约束

这段总结是 Step 2 提方案的事实基础。

**探索结果落盘**：这段总结必须写进设计文档的「前置调研」章节（Step 10 写设计文档时作为固定节），不只活在对话里。下游的 Plan/Build/Review 看不到这段对话，只看设计文档。每条发现保留 `[Read path:line]` 或 `[SOURCE: url]` 来源标注。

### Step 2: 提出 2-3 方案

**基于 Step 1 的探索结论提方案**——每个方案要能说清"为什么选这条路"，理由来自探索发现的事实，不是凭空想象。

**方案必须在核心架构思路上不同**，不是同一方案的参数变体。判断标准：如果两个方案的数据流图长得一样，只是某个组件换了实现——那是一个方案的两个变体，不算两个方案。

每个方案：一句话概括 + 优势 + 代价 + 适用条件。推荐要落到 restate 的约束和验收标准上。只有一条合理路径时，说明为什么其他路径不可行，不硬凑。

**引用探索结论**：方案里提到用某个库/pattern/已有实现时，引用 Step 1 的 `[SOURCE]` 或 `[Read]` 来源。没有来源的方案论据是直觉不是设计。

**YAGNI ruthlessly**：每个方案砍掉不必要功能。不为假设的未来需求设计。

**Seam 判据**：只有一个实现时不引入抽象/接口。等真有第二个实现再抽。

**权衡必须显式条目化**——逐维度对比表（成本/复杂度/可维护性/可测性/对 restate 约束的满足度）。方案 ≥ 2 个时用表格对比。

### Step 3: Prototype（可选）

某个方案不确定能不能跑通？先判断在回答哪类问题：

- **Logic branch**（"这个状态机/算法/数据流跑得通吗？"）：写最小可运行脚本或测试，终端跑通
- **UI branch**（"这个交互/布局对不对？"）：出 2-3 个 UI 变体放同一路由，URL 参数切换

原型是 throwaway 的——验证完就扔，答案才是产物。

**隔离大型原型**：如果原型需要大量上下文，用独立 subagent 或新会话跑，只把结论带回。

跳过条件：所有方案成熟 / 用户说"不需要原型"。

### Step 4: 用户选方案（AskUserQuestion）

推荐选项放第一个，其余备选。用户选 Other → 听完后确认。
用户附带修改（"选 A 但把 X 换成 Y"）→ 记录修改，确认最终方案。
用户全部否决 → 回 Step 2，问否决原因。

### Step 5: 方案←→目标对齐 + Pre-mortem

选定方案后两件事：

1. **回检 restate**：没冲突 → 继续。发现冲突（新约束/验收标准不可行）→ 告知用户，建议回 Define 修正。最多 2 轮。
2. **轻量 pre-mortem**："假设这个方案上线 3 个月后彻底失败了，最可能的 top 3 死因是什么？"列出来，反过来检验方案——死因如果在方案里没有应对措施，要么补措施要么接受风险并标注。不是问"可能出什么错"（forward-looking），而是假设"已经死了"再回头看（backward-from-failure）——视角切换能抓到 forward-looking 漏掉的盲区。

### Step 6: 测试目标（以路径为骨架）

从 restate 路径清单 + SC 绑定 + 选定方案推导测试目标(TO)：

1. 从 restate 取路径清单 + 路径↔SC 绑定
2. **每条路径 → 至少一条 TO**（使用路径 / 跨领域路径 / 系统路径都要覆盖）
3. **每条约束 → 至少一条 TO**
4. 标出可测性约束（需 mock 的外部依赖、需特定环境的行为）
5. 指定测试层级分布（单测 / 集成 / E2E）
6. **跨域 TO 和领域 TO 关系明确**：跨域 TO 测端到端串联，领域 TO 测单段逻辑，不重复也不遗漏

产出格式：

```
## 测试目标

| TO | 覆盖路径 | 覆盖约束 | 测试层级 | 说明 |
|---|---|---|---|---|
| TO-1 | 订单.P1 | — | E2E | 下单全流程 |
| TO-2 | 订单.P2 | 约束.1 | 集成 | 取消退款不超实付 |
| TO-3 | 跨域.1 | — | E2E | 下单到签收端到端 |
| TO-4 | 系统.1 | — | 集成 | 支付回调签名校验 |
```

TO 传递给后续 Plan（指导切片 + task covers）、Build（驱动 TDD）、Review（路径覆盖检查）、Verify（验收核对）。

### Step 7: Verify 策略 + 自审

选定方案 + 测试目标后，产出 verify 策略：

1. **按测试层级分组**，逐层说明：
   - E2E：覆盖哪些路径？怎么跑（dev server / browser / CLI）？
   - 集成测试：覆盖哪些跨领域交界？mock 什么、不 mock 什么？
   - 单测：覆盖哪些路径的核心逻辑？
   - 手动验证：哪些路径需要人工确认？为什么不能自动化？
2. **显式列出不测的内容 + 原因**——不能笼统写"测不了"，要说具体限制（无测试环境 / 第三方沙箱不支持 / 成本不合理），附风险评估
3. **风险排序**：高风险路径优先测试

**自审（产出后立即检查 5 维）**：

| 维度 | 检查什么 |
|---|---|
| 路径覆盖 | 每条路径都有对应 TO 吗？有没有路径没出现在 TO 表里？ |
| 约束覆盖 | 每条约束都有对应 TO 吗？约束测试需要多条路径组合验证吗？ |
| 层级合理 | E2E/集成/单测分布合理吗？是不是全标了 E2E（太重）或全标了单测（太弱）？ |
| 不测项风险 | 标"不测"的路径风险评估充分吗？高风险路径标"不测"需要额外说明 |
| 跨域不重复 | 跨域 TO 和领域 TO 有没有重复测同一件事？ |

自审通过后，**AskUserQuestion 确认**：整份策略（TO 表 + verify 策略 + 不测项）一次展示，用户确认/修改。

### Step 8: 路径覆盖审核

写设计文档前，默认执行三层对齐检查：

1. **方案 ↔ 路径对齐**：选定方案覆盖了 restate 每条路径吗？有没有路径在方案里完全没提到？
2. **TO ↔ 路径对齐**：TO 表覆盖了每条路径和约束吗？（独立复核，和 Step 7 自审互为兜底）
3. **verify 策略 ↔ TO 对齐**：每条 TO 都有对应的测试方案吗？

产出路径覆盖状态表：

```
| 路径 | 方案覆盖 | TO 覆盖 | verify 策略 | 状态 |
|---|---|---|---|---|
| 订单.P1 | ✅ | TO-1 | E2E | ✅ 完整 |
| 订单.P2 | ✅ | TO-2 | 集成 | ✅ 完整 |
| 系统.1 | ✅ | TO-4 | 集成 | ✅ 完整 |
| 约束.1 | ✅ | TO-2 | 集成 | ✅ 完整 |
```

任一路径状态非 ✅ → 回补后再进 Step 9。

### Step 9: UI 设计方案（涉及前端 UI 时）

如果选定方案涉及前端 UI（新页面 / UI 改造 / 交互变更），在写设计文档前明确 UI 怎么做：

1. **有 pd-vis 产出（`.ui.md`）**→ 读它，把 IA / wireframe / 视觉方向作为 UI 设计输入，设计文档的 `## UI 设计` 节引用并补充技术实现细节（组件拆分 / 状态管理 / 渲染策略）
2. **无 pd-vis 产出但有 UI 需求** → 在设计文档里补 `## UI 设计` 节，内容包括：
   - **页面/组件清单**：要新建或改哪些页面/组件
   - **布局结构**：关键页的区块划分（文字描述或 ASCII wireframe）
   - **交互行为**：核心操作的状态流转（正常 / loading / error / empty）
   - **视觉方向引用**：指向具体的 design skill 作为 Build 阶段的设计指南

**Design taste skills 引用**（Build 阶段实现 UI 时 Read）：

| Skill | 适用场景 |
|---|---|
| `superpowers:design-taste-frontend` | 落地页 / 作品集 / 改版——防模板化 |
| `superpowers:high-end-visual-design` | 高端质感（精确字号/间距/阴影/动效） |
| `superpowers:minimalist-ui` | 干净编辑风，暖单色调，平面网格 |
| `superpowers:industrial-brutalist-ui` | 数据密集型仪表盘 / 机械美学 |
| `superpowers:redesign-existing-projects` | 改造已有项目 UI 到高端水准 |

在 `## UI 设计` 节末尾标注推荐的 skill："Build 阶段实现 UI 时，`Skill(<name>)` 加载对应设计指南。" 不替 Build 选——给建议，Build 按实际情况决定。

**纯后端 / 无 UI → 跳过此步。**

### Step 10: 写设计文档

调 `Skill(nocode-evolve:design-doc-writing)`，输入：选定方案 + restate + 测试目标 + verify 策略 + UI 设计方案（如有）。

design-doc-writing 接管：doc-type 选择 → 写 → review → render。

**前置调研作为设计文档固定章节落盘**，章节名 `## 前置调研`，含 Step 1 三路探索结果（代码 pattern / 外部方案 / 已有决策），每条保留 `[Read]` 或 `[SOURCE]` 来源标注。

**verify 策略作为设计文档固定章节落盘**（不只存在于会话文本），章节名 `## 验证策略`，含 TO 表 + 按层级分组的测试方案 + 不测项 + 路径覆盖状态表。Verify 阶段直接从设计文档读取此章节作为执行依据。

**UI 设计作为设计文档固定章节落盘**（涉及前端时），章节名 `## UI 设计`，含页面/组件清单 + 布局结构 + 交互行为 + 视觉方向引用 + 推荐的 design taste skill。Build 阶段直接从设计文档读取此章节作为 UI 实现依据。

**设计 Review 六轴**（design-doc-writing review 时使用，参考 [agent-skills](https://github.com/addyosmani/agent-skills) 代码五轴在设计层的对应）：

| 维度 | 检查什么 |
|---|---|
| 可行性 | 能按描述实现吗？依赖项就位了吗？ |
| 清晰度 | 读者能看懂吗？歧义/遗漏？ |
| 架构合理性 | 模块边界/职责划分/依赖方向合理吗？与现有 pattern 一致还是有理由偏离？是减少复杂度还是搬运复杂度？ |
| 安全影响 | 引入新攻击面吗？轻量 STRIDE |
| 性能 | 数据量级/响应时间/资源消耗预估合理吗？同步异步、轮询推送、全量增量等选型有性能考量吗？ |
| 可扩展性 | 10x 规模会成为瓶颈吗？水平/垂直扩展路径清晰吗？ |

涉及外部输入/认证/数据时做轻量 Threat Model（画信任边界 → 命名资产 → 跑 STRIDE 6 问）。

### Step 10a: design-review（交叉审）

设计文档写完后，按 `{NOCODE_SKILL_REF}/design-review.md` 做 red-blue 双模型交叉评审——Claude 做蓝军、Codex 做红军（CLAIM 剥离不传蓝军结论）。findings 合并报告，Critical 必须修复。这和六轴 review 互补——六轴是 design-doc-writing 做的文档结构审查，design-review 是方案质量审查。

## Exit Gate

- [ ] 方案已选定，用户显式确认
- [ ] 测试目标(TO)已产出，覆盖每条路径和约束
- [ ] verify 策略已产出，5 维自审通过，用户确认
- [ ] 路径覆盖审核通过（覆盖状态表全 ✅）
- [ ] verify 策略已落盘到设计文档的「验证策略」章节
- [ ] 设计文档评审通过（六轴 review + design-review，无 Critical findings）
- [ ] 后续 Plan 输入齐全：restate + 设计文档 + 测试目标

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "方案很明显，不用对比" | 你觉得明显可能是因为只想到了一种。花 2 分钟列替代 |
| "先写着看，边写边设计" | 那叫 spike，不叫设计。spike 完回来走 Design |
| "用户说了用 X" | 用户指定方案 ≠ 跳过 Design。验证可行性 + 补设计细节仍是 Design 的活 |
| "这个改动太小不需要设计" | 小改动走 Standard 跳 Design。进了 Design 就是因为它需要 |
| "不用搜外部方案，我知道怎么做" | 你可能不知道有更好的库/模式。30 秒搜一下成本极低 |

## Red Flags

- 方案对比只说优势不说代价（在做推销）
- 用户否决方案后不问原因（浪费最有价值的信息）
- 新方案与已有 ADR/wiki 决策冲突但没说明
- 测试目标缺失，Verify 阶段无验收依据
- TO 表漏了 restate 里的某条路径——路径覆盖审核没做或没拦住
- verify 策略只存在于会话文本，没落盘设计文档——Verify 阶段读不到
- 高风险路径被标"不测"但没说明原因——逃生口
- Step 1 跳过了外部搜索就直接提方案——可能遗漏更好的现成方案
- 方案论据没有 `[Read]` 或 `[SOURCE]` 引用——凭直觉不是凭事实
