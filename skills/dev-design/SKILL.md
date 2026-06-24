---
name: dev-design
description: Use when Define is complete and the task needs architecture or approach decisions. Use when devflow routes to Design stage, or when the user says "设计方案/怎么做/选什么技术/架构设计/方案对比/重构方案/技术spec/出方案/怎么实现". For Full-scene tasks. Not for writing code comments, README, or commit messages.
---

# design — 从问题到解法

**Iron Law: 方案未对比的设计是假设不是设计。只提一个方案就让用户确认 = 假共识。**

Define 回答"做什么"，Design 回答"怎么做"。核心动作是探索 **approach**——多个差异化方案对比后选一个。brainstorming 在这里用于发散解法空间。

> Leading word: **approach**。没有对比过的 approach 就没有设计，只有假设。

输入：Define 的 restate（问题边界 + 验收标准）。
输出：确认方案 + 测试目标 + 设计文档。

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
6. **测试目标** — 从 restate + 方案推导
7. **写设计文档** — 调 design-doc-writing

> 端到端示例（restate → 方案对比 → 选定 → 测试目标）见 `references/examples/example-design-session.md`

## 领域指南（按需 Read）

方案探索时，检查以下领域是否与本次设计相关。相关的 Read 对应指南，做出设计决策写入设计文档：

| 领域 | 何时 Read | 在设计文档里写什么 |
|---|---|---|
| `references/architecture-principles.md` | 始终 | 模块边界 / Deep vs Shallow / Seam 位置 |
| `references/api-design-guide.md` | 涉及 API 或模块接口 | 契约定义 / 错误语义 / 命名约定 |
| `references/security-guide.md` | 涉及用户输入/认证/数据 | 威胁模型 / 认证方案 / 数据保护决策 |
| `references/performance-guide.md` | 有性能需求或高负载 | 负载目标 / 缓存策略 / SLO |
| `references/frontend-guide.md` | 涉及 UI | 渲染策略 / 组件架构 / 状态管理 / 设计系统 |
| `references/observability-guide.md` | 需要生产可观测 | "正常"定义 / 监控信号 / 告警策略 |
| `references/testing-guide.md` | 始终（测试目标推导用） | 测试分层 / Seam 选择 / 测试基础设施 |
| `references/migration-guide.md` | 替换已有系统 | 过渡方案 / 兼容策略 / 灰度计划 |

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

### Step 5: 方案←→目标对齐

选定方案后回检 restate：没冲突 → 继续。发现冲突（新约束/验收标准不可行）→ 告知用户，建议回 Define 修正。最多 2 轮。

### Step 6: 测试目标

从 restate Success Criteria + 选定方案推导测试目标：
- 每条 Success Criteria → 至少一条测试目标
- 标出可测性约束（需 mock 的外部依赖、需特定环境的行为）
- 指定测试层级分布（单测 / 集成 / E2E）

测试目标传递给后续 Plan（指导切片）、Build（驱动 TDD）、Verify（验收核对）。

### Step 7: 写设计文档

调 `Skill(nocode-evolve:design-doc-writing)`，输入：选定方案 + restate + 测试目标。

design-doc-writing 接管：doc-type 选择 → 写 → review → render。

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

## Exit Gate

- [ ] 方案已选定，用户显式确认
- [ ] 测试目标已产出，覆盖每条 Success Criteria
- [ ] 设计文档评审通过（六轴 review）
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
- Step 1 跳过了外部搜索就直接提方案——可能遗漏更好的现成方案
- 方案论据没有 `[Read]` 或 `[SOURCE]` 引用——凭直觉不是凭事实
