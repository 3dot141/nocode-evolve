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

## Enter Gate

- [ ] Define restate 存在且用户已确认
- [ ] 场景分类 = Full

> 端到端示例（restate → 方案对比 → 选定 → 测试目标）见 `references/examples/example-design-session.md`

> Step 0 TaskCreate 见「协议」开头。
> 领域指南清单（安全 / API / 性能 / 前端 / 可观测 / 测试 / 迁移 / 架构）在 Step 6 的领域覆盖检查里逐项过。

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
Task 1: 探索 — 三层并行
  Sub-steps: 并行 spawn 代码 pattern(research-workflow:code) + 外部方案(research-workflow:mixed) + 已有决策对齐 → 综合
  Gate: 三路结果回来并综合，探索总结产出

Task 2: UI 设计（涉及前端时）
  Sub-steps: 有 .ui.md 读它理解 UI 需求 / 无则 AskUserQuestion 选（pd-ui / taste model）
  Gate: UI 需求已明确（纯后端 skip）

Task 3: 提出 2-3 方案 — 差异化对比
  Sub-steps: 基于探索 + UI 理解提方案 → 逐维度权衡表 → 附推荐
  Gate: ≥2 个核心思路差异化方案（仅一条路径时说明其他不可行）

Task 4: spike 验证（可选）
  Sub-steps: 高不确定方案先跑原型 → 验证完即扔
  Gate: 不确定性已验证（方案成熟则 skip）

Task 5: 用户选方案 — AskUserQuestion
  Sub-steps: 推荐放第一 → 用户选 → 附带修改记录
  Gate: 用户显式选定（全否决回 Task 3）

Task 6: 对齐 + Pre-mortem + 领域覆盖检查
  Sub-steps: 回检 restate 冲突 → pre-mortem(top 3 死因) → 8 领域逐项过 → 涉及的 Read 指南产出决策
  Gate: 无冲突 + 领域清单逐项标 ✅/跳过

Task 7: 测试与验证计划
  Sub-steps: TO 表(含 UI Browser TO) → Verify 策略(按层级 + 不测项) → 5 维自审 → 覆盖状态表 → AskUserQuestion 确认
  Gate: 覆盖状态表全 ✅ + 用户确认

Task 8: 写设计文档
  Sub-steps: 输入清单核对 → 调 dev-design-refine → 六轴 review → design-review 交叉审
  Gate: 输入清单无缺失 + 文档评审通过，无 Critical findings
```

每完成一个标 done。

---

### Step 1: 探索

**Enter Gate:**
- [ ] Define restate 存在且已确认
- [ ] 场景分类 = Full

**Core Actions:**

探索分三层——代码内部、外部方案、已有决策，全部在提方案之前完成。不凭记忆，每个判断标注来源。

**三层并行执行**：1a、1b、1c 互不依赖，**在一条消息里同时发出三个调用**，结果全部回来后再综合。

#### 1a. 代码 pattern 深度分析

委派 `research-workflow` skill（调用方式见 `skills/research-workflow/SKILL.md`），传入：
- `question`: `<restate 关键词> 在当前代码库的已有实现、可复用 pattern、影响面`
- `type`: `code`
- `depth`: `shallow`
- `systemPrompt`（追加）: `不只找"有没有"，要理解"怎么做的、为什么这么做"，并标出影响面（触及哪些模块/调用链/contract）。`

从返回值的 `findings` 提取：
- **已有实现**：解决过类似问题的代码，怎么做的、为什么
- **可复用 pattern**：现有架构 pattern、抽象层次、模块边界
- **影响面**：这次改动触及哪些模块、调用链、contract

#### 1b. 外部技术方案搜索

委派 `research-workflow` skill，传入：
- `question`: `<restate 关键词 + 要解决的技术问题>`
- `type`: `mixed`
- `depth`: `shallow`（探索阶段默认；用户说"深入调研"时改 `deep`）
- `systemPrompt`（追加）: `关注开源库/框架的成熟度和维护状态、业界架构模式和最佳实践、与现有架构的兼容性。不把搜索结果当事实——需对照本项目实际情况评估适用性。`

从返回值的 `findings` 提取：
- **开源库/框架**：成熟度、维护状态、社区活跃度
- **最佳实践**：架构模式、公认做法
- **经验教训**：别人踩过的坑

#### 1c. 对齐已有决策（subagent 或内联）

`Agent(subagent_type: "fork")` 或直接内联 Read（文件少时不必开 agent）：

- 读 `.agents-personal/wiki/`（已有设计决策/术语/踩坑）+ `docs/` 下已有 ADR
- 新方案与旧决策冲突不是不能做，但要在设计文档里说明为什么推翻
- **Domain 词汇对齐**：方案里的术语必须和项目的 domain 语言一致

**工具降级**：semble-search 不可用 → 降级 Bash grep + Explore agent。research-workflow 内部处理网络工具不可用的降级（跳过 + 标注）。

#### 探索综合

三路结果回来后，输出一段探索总结：代码里已有什么（可复用的 / 要改的 / 会受影响的）+ 外部有什么方案（库 / 模式 / 经验）+ 已有决策里有什么约束。这段是后续提方案的事实基础。

**Exit Gate:**
- [ ] 三路探索结果已回来并综合
- [ ] 探索总结产出，每条带 `[Read path:line]` 或 `[SOURCE: url]` 来源
- [ ] 探索总结将落盘到设计文档「前置调研」章节（Step 8 写文档时）

---

### Step 2: UI 设计（涉及前端时）

> UI 需求必须在提方案之前明确——UI 的交互方式直接影响技术选型（实时更新需求、状态管理方案、渲染策略）。不知道 UI 长什么样就提技术方案 = 空中楼阁。

**Enter Gate:**
- [ ] Step 1 Exit Gate 全部满足
- [ ] 判断本次是否涉及前端 UI（新页面 / UI 改造 / 交互变更）

**Core Actions:**

**纯后端 / 无 UI → 跳过本步，Task 2 标 skip。**

本步只搞清楚"UI 长什么样"（交互流、IA、视觉方向），不做 UI 技术方案——组件拆分、状态管理、渲染策略这些技术决策在方案选定后（Step 6 领域覆盖检查的前端项 + 设计文档 UI 节）才做。

1. **有 pd-ui 产出（`.ui.md`）**→ 读它，理解 UI 需求（交互流、IA、视觉方向）。设计源标识从 `.ui.md` 继承（`claude-design` / `prototype`），后续写进设计文档 `## UI 设计` 节
2. **无 pd-ui 产出但有 UI 需求** → AskUserQuestion 让用户选：
   - **跑 pd-ui**（推荐）→ 调 `Skill(nocode-evolve:pd-ui)` 走完整交互视觉设计，产出 `.ui.md` 后回来继续
   - **直接选视觉方向** → 按 `{NOCODE_SKILL_REF}/ui-taste-model.md` 选一个 taste model，直接在设计文档里做视觉决策（不产出单独标识——taste model 被消化成具体值写进文档）

**Exit Gate:**
- [ ] UI 需求已明确（交互流 / IA / 视觉方向），或纯后端已 skip
- [ ] 有 `.ui.md` 时设计源标识已记录

---

### Step 3: 提出 2-3 方案

**Enter Gate:**
- [ ] Step 2 Exit Gate 满足（UI 需求已明确或已 skip）

**Core Actions:**

**基于 Step 1 探索 + Step 2 UI 理解提方案**——每个方案要能说清"为什么选这条路"，理由来自探索发现的事实，不是凭空想象。

**方案必须在核心架构思路上不同**，不是同一方案的参数变体。判断标准：如果两个方案的数据流图长得一样，只是某个组件换了实现——那是一个方案的两个变体，不算两个方案。

每个方案：一句话概括 + 优势 + 代价 + 适用条件。推荐要落到 restate 的约束和验收标准上。只有一条合理路径时，说明为什么其他路径不可行，不硬凑。

**引用探索结论**：方案里提到用某个库/pattern/已有实现时，引用 Step 1 的 `[SOURCE]` 或 `[Read]` 来源。没有来源的方案论据是直觉不是设计。

**YAGNI ruthlessly**：每个方案砍掉不必要功能。不为假设的未来需求设计。

**Seam 判据**：只有一个实现时不引入抽象/接口。等真有第二个实现再抽。

**权衡必须显式条目化**——逐维度对比表（成本/复杂度/可维护性/可测性/对 restate 约束的满足度）。方案 ≥ 2 个时用表格对比。

**Exit Gate:**
- [ ] ≥2 个核心思路差异化方案（仅一条路径时说明其他不可行）
- [ ] 逐维度权衡表产出
- [ ] 每个方案论据有 `[Read]` / `[SOURCE]` 来源

---

### Step 4: spike 验证（可选）

**Enter Gate:**
- [ ] Step 3 Exit Gate 满足

**Core Actions:**

某个方案不确定能不能跑通？先判断在回答哪类问题：

- **Logic branch**（"这个状态机/算法/数据流跑得通吗？"）：写最小可运行脚本或测试，终端跑通
- **UI branch**（"这个交互/布局对不对？"）：出 2-3 个 UI 变体放同一路由，URL 参数切换

原型是 throwaway 的——验证完就扔，答案才是产物。

**隔离大型原型**：如果原型需要大量上下文，用独立 subagent 或新会话跑，只把结论带回。

跳过条件：所有方案成熟 / 用户说"不需要原型"。

**Exit Gate:**
- [ ] 不确定性已验证，或已判定 skip（方案成熟）

---

### Step 5: 用户选方案

**Enter Gate:**
- [ ] Step 4 完成（验证或 skip）

**Core Actions:**

AskUserQuestion 推荐选项放第一个，其余备选。
- 用户选 Other → 听完后确认
- 用户附带修改（"选 A 但把 X 换成 Y"）→ 记录修改，确认最终方案
- 用户全部否决 → 回 Step 3，问否决原因

**Exit Gate:**
- [ ] 用户显式选定方案（含附带修改已记录）

---

### Step 6: 对齐 + Pre-mortem + 领域覆盖检查

**Enter Gate:**
- [ ] Step 5 满足（方案已选定）

**Core Actions:**

**6a. 回检 restate**：没冲突 → 继续。发现冲突（新约束/验收标准不可行）→ 告知用户，建议回 Define 修正。最多 2 轮。

**6b. 轻量 pre-mortem**："假设这个方案上线 3 个月后彻底失败了，最可能的 top 3 死因是什么？"列出来，反过来检验方案——死因如果在方案里没有应对措施，要么补措施要么接受风险并标注。不是问"可能出什么错"（forward-looking），而是假设"已经死了"再回头看（backward-from-failure）——视角切换能抓到 forward-looking 漏掉的盲区。

**6c. 领域覆盖检查（逐项过，不漏）**：选定方案后，逐项检查 8 个领域。涉及的 Read 对应指南 → 产出设计决策写入设计文档；不涉及的标"跳过"。

```
- [ ] 架构：始终 → Read architecture-principles.md → 模块边界 / Deep vs Shallow / Seam 位置
- [ ] 测试：始终（TO 推导用）→ Read testing-guide.md → 测试分层 / Seam 选择 / 测试基础设施
- [ ] 安全：有外部输入/认证/敏感数据？→ Read security-guide.md → 威胁模型 / 认证方案 / 数据保护
- [ ] API：有模块接口/跨服务调用？→ Read api-design-guide.md → 契约定义 / 错误语义 / 命名约定
- [ ] 性能：有高负载/实时性要求？→ Read performance-guide.md → 负载目标 / 缓存策略 / SLO
- [ ] 前端：有 UI？（Step 2 已确定）→ Read frontend-guide.md → 渲染策略 / 组件架构 / 状态管理
- [ ] 可观测：需要生产可观测？→ Read observability-guide.md → "正常"定义 / 监控信号 / 告警策略
- [ ] 迁移：替换已有系统？→ Read migration-guide.md → 过渡方案 / 兼容策略 / 灰度计划
```

`{NOCODE_SKILL_REF}/` 是各指南前缀。逐项检查"跟我的设计有没有关系"——不是每份设计都覆盖全部领域，但每项都要显式标 ✅/跳过，不能默默漏掉。

**数据库场景速查**（方案涉及时 Read）：

| 场景 | 触发特征 | Read |
|---|---|---|
| PostgreSQL | 有 `.sql` / migrations，或连 PG / Supabase | `references/postgres-patterns.md` |
| ClickHouse | 项目用 ClickHouse 做分析 | `references/clickhouse-patterns.md` |

**Exit Gate:**
- [ ] 方案↔restate 无冲突（有冲突已回 Define）
- [ ] Pre-mortem top 3 死因已列，各有应对或已标风险
- [ ] 8 领域逐项标 ✅/跳过，涉及的已 Read 并产出设计决策

---

### Step 7: 测试与验证计划

> TO + Verify 策略 + 路径覆盖审核合并成一步——它们回答的是同一个问题："怎么证明做对了"。

**Enter Gate:**
- [ ] Step 6 Exit Gate 满足（领域决策已定，测试领域已 Read）

**Core Actions:**

**7a. 测试目标（TO，以路径为骨架）**：从 restate 路径清单 + SC 绑定 + 选定方案 + UI 设计（如有）推导：

1. 从 restate 取路径清单 + 路径↔SC 绑定
2. **每条路径 → 至少一条 TO**（使用路径 / 跨领域路径 / 系统路径都要覆盖）
3. **每条约束 → 至少一条 TO**
4. **UI 路径 → 浏览器/E2E TO**（有 UI 设计时：空状态渲染、导航流程、交互态、响应式）
5. 标出可测性约束（需 mock 的外部依赖、需特定环境的行为）
6. 指定测试层级分布（单测 / 集成 / E2E）
7. **跨域 TO 和领域 TO 关系明确**：跨域 TO 测端到端串联，领域 TO 测单段逻辑，不重复也不遗漏

```
## 测试目标

| TO | 覆盖路径 | 覆盖约束 | 测试层级 | 说明 |
|---|---|---|---|---|
| TO-1 | 订单.P1 | — | E2E | 下单全流程 |
| TO-2 | 订单.P2 | 约束.1 | 集成 | 取消退款不超实付 |
| TO-3 | 跨域.1 | — | E2E | 下单到签收端到端 |
| TO-4 | 系统.1 | — | 集成 | 支付回调签名校验 |
| TO-5 | 订单.P1 | — | E2E/Browser | 下单页空状态+表单校验+提交成功态 |
```

**7b. Verify 策略**：按测试层级分组，逐层说明：
- E2E：覆盖哪些路径？怎么跑（dev server / browser / CLI）？
- E2E/Browser（有 UI 时）：覆盖哪些 UI 路径？怎么跑（Playwright / 截图对比）？
- 集成测试：覆盖哪些跨领域交界？mock 什么、不 mock 什么？
- 单测：覆盖哪些路径的核心逻辑？
- 手动验证：哪些路径需要人工确认？为什么不能自动化？

**显式列出不测的内容 + 原因**——不能笼统写"测不了"，要说具体限制（无测试环境 / 第三方沙箱不支持 / 成本不合理），附风险评估。高风险路径优先测试。

**7c. 5 维自审**：

| 维度 | 检查什么 |
|---|---|
| 路径覆盖 | 每条路径都有对应 TO 吗？有没有路径没出现在 TO 表里？ |
| 约束覆盖 | 每条约束都有对应 TO 吗？约束测试需要多条路径组合验证吗？ |
| 层级合理 | E2E/集成/单测分布合理吗？是不是全标了 E2E（太重）或全标了单测（太弱）？ |
| 不测项风险 | 标"不测"的路径风险评估充分吗？高风险路径标"不测"需要额外说明 |
| 跨域不重复 | 跨域 TO 和领域 TO 有没有重复测同一件事？ |

**7d. 路径覆盖状态表**（三层对齐：方案 ↔ TO ↔ verify 策略）：

```
| 路径 | 方案覆盖 | TO 覆盖 | verify 策略 | 状态 |
|---|---|---|---|---|
| 订单.P1 | ✅ | TO-1, TO-5 | E2E + Browser | ✅ 完整 |
| 订单.P2 | ✅ | TO-2 | 集成 | ✅ 完整 |
| 系统.1 | ✅ | TO-4 | 集成 | ✅ 完整 |
| 约束.1 | ✅ | TO-2 | 集成 | ✅ 完整 |
```

任一路径状态非 ✅ → 回补 TO 或方案。

**7e. AskUserQuestion 确认**：整份计划（TO 表 + verify 策略 + 不测项 + 覆盖状态表）一次展示，用户确认/修改。

TO 传递给后续 Plan（指导切片 + task covers）、Build（驱动 TDD）、Review（路径覆盖检查）、Verify（验收核对）。

**Exit Gate:**
- [ ] TO 表覆盖每条路径和约束（含 UI 路径的 Browser TO）
- [ ] Verify 策略按层级分组，不测项已列原因 + 风险
- [ ] 5 维自审通过
- [ ] 路径覆盖状态表全 ✅
- [ ] 用户确认整份测试与验证计划

---

### Step 8: 写设计文档

**Enter Gate（设计文档输入清单——逐项核对来源，缺一项回对应 Step 补）:**
- [ ] 前置调研（← Step 1 探索综合，含来源标注）
- [ ] UI 设计方案（← Step 2，涉及前端时）
- [ ] 方案对比 + 选定方案（← Step 3-5）
- [ ] Pre-mortem 发现（← Step 6b）
- [ ] 领域覆盖检查结果（← Step 6c，每个涉及领域的设计决策）
- [ ] 测试目标 TO 表 + Verify 策略 + 路径覆盖状态表（← Step 7）

**Core Actions:**

调 `Skill(nocode-evolve:dev-design-refine)`，输入上方清单全部内容。dev-design-refine 接管：doc-type 选择 → 写 → review → render。

各输入作为设计文档固定章节落盘（下游 Plan/Build/Review 看不到本次对话，只看文档）：

- **`## 前置调研`**：Step 1 三路探索结果，每条保留 `[Read]` / `[SOURCE]` 来源
- **`## UI 设计`**（涉及前端时）：页面/组件清单 + 布局结构 + 交互行为 + UI 架构（组件拆分/状态管理/渲染策略）+ UI 技术选型。有 pd-ui 产出时附设计源标识 `[design-source: claude-design <projectId>]` 或 `[design-source: prototype <路径>]`，Build 去外部产物照做；无外部产物时设计文档本身就是全部视觉依据
- **`## 验证策略`**：TO 表 + 按层级分组的测试方案 + 不测项 + 路径覆盖状态表。Verify 阶段直接读此章节执行

**设计 Review 六轴**（dev-design-refine 做的文档结构审查）：

| 维度 | 检查什么 |
|---|---|
| 可行性 | 能按描述实现吗？依赖项就位了吗？ |
| 清晰度 | 读者能看懂吗？歧义/遗漏？ |
| 架构合理性 | 模块边界/职责划分/依赖方向合理吗？与现有 pattern 一致还是有理由偏离？是减少复杂度还是搬运复杂度？ |
| 安全影响 | 引入新攻击面吗？轻量 STRIDE |
| 性能 | 数据量级/响应时间/资源消耗预估合理吗？同步异步、轮询推送、全量增量等选型有性能考量吗？ |
| 可扩展性 | 10x 规模会成为瓶颈吗？水平/垂直扩展路径清晰吗？ |

涉及外部输入/认证/数据时做轻量 Threat Model（画信任边界 → 命名资产 → 跑 STRIDE 6 问）。

**design-review 交叉审**：设计文档写完后，按 `{NOCODE_SKILL_REF}/design-review.md` 做 red-blue 双模型交叉评审——Claude 做蓝军、Codex 做红军（CLAIM 剥离不传蓝军结论）。findings 合并报告，Critical 必须修复。这和六轴互补——六轴是文档结构审查，design-review 是方案质量审查。

**Exit Gate:**
- [ ] 输入清单 6 项无缺失
- [ ] 设计文档评审通过（六轴 review + design-review，无 Critical findings）
- [ ] 后续 Plan 输入齐全：restate + 设计文档 + 测试目标

## Exit Gate

- [ ] 方案已选定，用户显式确认
- [ ] UI 需求已明确（涉及前端时）
- [ ] 领域覆盖检查 8 项逐项标 ✅/跳过
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
