---
name: design
description: Use when Define is complete and the task needs architecture or approach decisions. Use when devflow routes to Design stage, or when the user says "设计方案/怎么做/选什么技术/架构设计/方案对比". For Full-scene tasks.
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

1. **探索项目上下文** — Read 代码 + wiki + 已有 ADR，标注来源
2. **提出 2-3 方案** — 核心思路差异化，附推荐 + 权衡
3. **Prototype 验证**（可选）— 高不确定性方案先跑原型
4. **用户选方案** — AskUserQuestion Gate
5. **方案←→目标对齐** — 回检 restate 是否冲突
6. **测试目标** — 从 restate + 方案推导
7. **写设计文档** — 调 design-doc-writing

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

### Step 1: 探索项目上下文

**在已有代码库中设计**：先探索现有结构再提方案。跟随已有 pattern——已有代码用大文件你就不要硬拆，但如果你要改的文件已经太大，在方案里包含拆分是合理的。不提无关重构。

读相关代码 + 现有决策，不凭记忆。每个判断标注来源：
- `[Read path:line]` — 直接读到的事实
- `[Doc URL]` — 官方文档确认
- `[推断]` — 没有直接依据（必须显式标）

**对齐已有决策**：读 `.agents-personal/wiki/`（已有设计决策/术语/踩坑）+ `docs/` 下已有 ADR。新方案与旧决策冲突不是不能做，但要在设计文档里说明为什么推翻。

**Domain 词汇对齐**：方案里的术语必须和项目的 domain 语言一致。如果项目叫"Order"就不要方案里叫"Purchase"；如果 wiki 定义了"Task"就不要引入"Todo"。不一致的术语在 Build 期会造成命名混乱。

### Step 2: 提出 2-3 方案

**方案必须在核心架构思路上不同**，不是同一方案的参数变体。判断标准：如果两个方案的数据流图长得一样，只是某个组件换了实现——那是一个方案的两个变体，不算两个方案。

每个方案：一句话概括 + 优势 + 代价 + 适用条件。推荐要落到 restate 的约束和验收标准上。只有一条合理路径时，说明为什么其他路径不可行，不硬凑。

**YAGNI ruthlessly**：每个方案砍掉不必要功能。不为假设的未来需求设计——今天真需要的做，"万一以后要"的不做。

**Seam 判据**：只有一个实现（一个 adapter）时不引入抽象/接口——那是假设的 seam。等真有第二个实现（如 production + test）再抽。过早抽象比没有抽象更贵。

**权衡必须显式条目化**——不是"A 好 B 差"一句话，是逐维度对比表（成本/复杂度/可维护性/可测性/对 restate 约束的满足度）。即使 STOP 不出方案（如前提不成立），也要把每个选项的 trade-off 列清楚。

方案 ≥ 2 个时，用表格对比。

### Step 3: Prototype（可选，选方案前验证）

某个方案不确定能不能跑通？先判断在回答哪类问题，再选原型形态：

- **Logic branch**（"这个状态机/算法/数据流跑得通吗？"）：写最小可运行脚本或测试，用终端跑通，验证核心逻辑是否可行
- **UI branch**（"这个交互/布局对不对？"）：出 2-3 个 UI 变体放同一路由，用 URL 参数切换对比

选错分支会浪费整个原型——先逼自己回答"我在验证什么"。

原型是 throwaway 的——验证完就扔，答案才是产物。验证结论带入 Step 4 帮用户做选择。

**Handoff bridge**（大型原型）：如果原型需要大量上下文（跑真实环境 / 接真实 API），用 `/handoff` 传递到新会话跑原型，跑完再 `/handoff` 回结论——不让原型的实现细节污染设计讨论的上下文。

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

**设计 Review 五轴**（design-doc-writing review 时使用）：

| 维度 | 检查什么 |
|---|---|
| 可行性 | 能按描述实现吗？ |
| 清晰度 | 读者能看懂吗？歧义/遗漏？ |
| 一致性 | 与现有架构冲突吗？ |
| 安全影响 | 引入新攻击面吗？轻量 STRIDE |
| 可扩展性 | 会成为瓶颈吗？ |

涉及外部输入/认证/数据时做轻量 Threat Model（画信任边界 → 命名资产 → 跑 STRIDE 6 问）。

## Exit Gate

- [ ] 方案已选定，用户显式确认
- [ ] 测试目标已产出，覆盖每条 Success Criteria
- [ ] 设计文档评审通过（五轴 review）
- [ ] 后续 Plan 输入齐全：restate + 设计文档 + 测试目标

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "方案很明显，不用对比" | 你觉得明显可能是因为只想到了一种。花 2 分钟列替代 |
| "先写着看，边写边设计" | 那叫 spike，不叫设计。spike 完回来走 Design |
| "用户说了用 X" | 用户指定方案 ≠ 跳过 Design。验证可行性 + 补设计细节仍是 Design 的活 |
| "这个改动太小不需要设计" | 小改动走 Standard 跳 Design。进了 Design 就是因为它需要 |

## Red Flags

- 方案对比只说优势不说代价（在做推销）
- 用户否决方案后不问原因（浪费最有价值的信息）
- 新方案与已有 ADR/wiki 决策冲突但没说明
- 测试目标缺失，Verify 阶段无验收依据
