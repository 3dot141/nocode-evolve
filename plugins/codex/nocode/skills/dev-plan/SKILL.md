---
name: dev-plan
description: "Use when you have defined goals and need to break work into tasks."
---

# plan — 把目标拆成任务序列

**Iron Law: 计划里贴的是真实代码和命令，不是占位符。写不出真实代码 = 还没想清楚。**

计划的价值不在"列出步骤"，在让执行变成机械动作。每个任务是一根 **tracer bullet**——穿透所有层的端到端垂直切片。好计划拿到就能照做，不需要边做边想"这里该怎么写"。

> Leading word: **tracer bullet**。每个 task 切一条窄但完整的端到端路径，不按层横切。

输入：Define 的 restate + dev-design 的设计文档（含领域划分、模块设计、接口、业务流、测试目标）（Full 场景）。
输出：用户确认的任务序列。

## 非本 skill 请求

知识问答 / 目标不明确（缺 restate）→ 回 Define。单步太小不需拆 → 直接给验收标准走 Build，不硬拆。写代码 → 走 Build。用户在问"你准备怎么做 / 让我先确认"（元提问，要的是陈述打算）→ 用回合末尾文本陈述打算并等用户拍板，不进本协议；拍板后确需拆任务再进。

## Enter Gate

- [ ] Define restate 存在且已确认
- [ ] Full 场景：Design 设计文档 + 测试目标已产出
- [ ] Standard 场景：restate 足够指导任务拆分

**Plan 的两种合法产出**：
- **完整计划**（Standard/Full）：依赖图 + 任务序列 + checkpoint
- **验收标准只**（Mini/太小不拆）：一句话说清"怎么算做完了" + 指出前置确认项（如 i18n/定位）。不拆 ≠ 不定义完成标准。两者都是 Plan 的正当输出。

> 端到端示例（header + 依赖图 + task + checkpoint + Plan Validation）见 `references/examples/example-plan-output.md`

## 协议

### Step 0: update_plan

**进入后第一件事**，创建以下全部 task：

```
═══ Round 1: 编排（定依赖和顺序）═══

Task 1: 只读模式 — 加载上下文
  Sub-steps: 读 restate + 设计文档（BF 伪代码 + 接口 + 单测设计）+ 测试目标 → 按「前置调研」path:line 清单定向读相关代码及测试 + 类似 pattern（清单没覆盖再补探索）
  Gate: 上下文加载完成，未碰任何代码（开始改文件 = 跳过 Plan）

Task 2: 画依赖图
  Sub-steps: 列所有块 → 标依赖方向 → 底层排前
  Gate: 依赖图产出，无环

Task 3: 垂直切片 — risk-first
  Sub-steps: 选 slicing 形态（Vertical/Contract-First）→ risk-first 排序 → TO 分配到 slice
  Gate: 端到端可交付的切片序列，最不确定的排最前

Task 4: 写 task 骨架
  Sub-steps: 每 task 标 Files + covers + HITL/AFK + UI 设计源（代码留空，Round 2 填）
  Gate: 每 task 过粒度三重约束（≤5 文件 + 一个逻辑动作 + 2-5 分钟节奏），骨架完整

Task 5: 插 checkpoint（风险驱动 + fallback）
  Sub-steps: 风险 task 后必插 + 连续 3 task 无 checkpoint 时 fallback 插入
  Gate: checkpoint 边界已插，风险 task 后均有 checkpoint

Task 6: Round 1 骨架自查
  Sub-steps: 主会话按骨架自查清单过一遍（切片/依赖/排序/粒度/覆盖）→ 成立的质疑修正到骨架
  Gate: 骨架自查完成，成立的质疑已修正

═══ Round 2: 填充代码（读设计文档 + 代码库 → 写真实代码）═══

Task 7: 逐 task 填充真实代码
  Sub-steps: 读设计文档对应 BF 伪代码 + 读最新代码库 → 写测试代码 + 实现代码 + 验证命令
  Gate: 零占位符，每 task 有真实测试 + 实现 + 命令
  注: 无依赖的 task 可并行填充

═══ 收尾 ═══

Task 8: Round 2 Checklist 核查 + 跨 task 一致性自查 + Plan Validation
  Sub-steps: checklist 逐项核查（API签名/测试覆盖/设计一致/废弃接口）→ 跨 task 一致性自查（接口衔接/隐含假设/执行顺序）→ 修正 → 四项自检（需求覆盖 + 路径覆盖 + 可验证 + 无环）
  Gate: checklist + 一致性自查完成 + 修正完成 + 四项自检全过（任一不过回 Task 7 补）

Task 9: 用户确认计划
  Sub-steps: 完整呈现计划 → request_user_input 确认
  Gate: 用户确认计划

Task 10: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Plan 完成（task 数 + 首个 slice）→ 建议进 Build → 等用户拍板后调 $dev-build
  Gate: 用户拍板进入 Build（这一步不勾，Plan 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: 只读模式

读，不写。按以下顺序加载上下文：
1. restate（成果物/验收标准/约束/Out of Scope）
2. dev-design 产出的设计文档（含领域划分、模块设计、接口、业务流、测试目标）
3. **定向加载**：设计文档「前置调研」章节的 `path:line` 引用就是加载清单——要改的文件、关键 caller、pattern 参照、类型/接口定义大多已被 Design 探索过并引用，逐条定向 Read（含对应测试文件），不重新自由探索。Standard 场景（无设计文档）用 restate 附录探索胶囊的 findings sources 作加载清单，同样定向 Read
4. 清单没覆盖、本次拆解又需要的文件，再补搜（精确匹配走 rg，语义找走 `spawn_agent(nocode:semble-search)`）——补缺，不是重扫

发现自己开始改文件 → 停——你在跳过 Plan 直接 Build。

### Step 2: 依赖图

列出所有块，标谁依赖谁。底层先建——下游任务依赖的东西必须先就位。

### Step 3: 垂直切片

优先**端到端可交付**，不按层横切。每个切片做完有能跑、能 demo、能回滚的东西。

**Slicing 形态**（怎么切）：
- **Vertical**（默认）：端到端穿透所有层，做完可验证
- **Contract-First**：前后端并行时选用——API 契约 + mock 作为两条子序列的共同依赖排最前，之后前后端各出子序列，**各按自己的自然单元拆**，不共用同一套拆分维度（用后端领域逻辑拆前端任务，计划会被前端执行者抛弃）：
  - **后端子序列**：跨 task 共享物（领域接口 / DTO / 类型定义）作为底层 task 先行，闭环标准 = 编译通过 + 契约测试绿——**不是把全量测试先写完爆红再补实现**（爆红期 checkpoint 失效、接口在拿到实现反馈前被锁死）；之后按领域/模块拆切片，每个切片自带红绿循环
  - **前端子序列**：组件层先行——对照 IA 页面清单 + pd-vd 冻结的 components/样张（`styleguide.html`）做组件 gap analysis，gap 清单 = 组件库 task（依赖图底层，排页面 task 前；**gap 为空则此 task 自然不存在**，不设页数阈值）；页面 task 按「一个 IA 页面 ≈ 一个前端 task」（Step 7 同一约定）拆，页面只引用组件、不各自定样式

**排序原则**：**Risk-first**——最不确定的 slice 排最前，可能不可行的路径早点撞墙。

测试目标分配到对应 slice——每个 slice 知道自己要验证什么。

### Step 4: 写 task 骨架（Round 1）

每个 task 用 `references/task-template.md` 格式。路径/约束 ID 约定见 `${PLUGIN_ROOT}/shared/references/path-conventions.md`。

Round 1 写骨架——定清楚**改什么、覆盖什么、谁做**，代码留空给 Round 2 填：

- **Files**：Create / Modify / Test 精确路径
- **covers（必填）**：覆盖 restate 哪些路径/约束 ID
- **设计文档段落**：指向 dev-design 的哪个域/模块/BF（Round 2 读这里写代码）
- **HITL / AFK**
- **UI 设计源**（涉及 UI 时）
- **粒度三重约束**（三条同时守，任一违反就拆）：
  - **≤5 文件**（爆炸半径硬 gate）——超了必拆
  - **一个 task 一个逻辑动作**（原子化）——标题出现 "and" 或描述含两个独立动词 → 拆
  - **2-5 分钟一个 action**（节奏参照）——task 拆到一个 TDD 红绿循环能做完的粒度
- **Rollback-friendly**：每 task 独立可回滚
- **描述 durable 化**：用行为意图（"用户创建记录时验证必填字段"），不用易腐行号

### Step 5: 插 checkpoint（风险驱动 + fallback）

checkpoint = 全测试通过 + build 通过 + 用户 review。checkpoint 是 rollback 边界。

**插入规则**（两条同时满足取更早的）：
- **风险 task 后 → 必插**：task 命中以下任一风险信号，完成后立即插 checkpoint
- **fallback → 连续 3 个 task 无 checkpoint 时插入**：保证不会长段无检查

**风险信号清单**（单源，判定"这个 task 是否风险 task"只看此表）：

| # | 风险信号 |
|---|---|
| 1 | 外部输入（用户输入 / API 请求体 / 文件上传） |
| 2 | 认证 / 授权 |
| 3 | 敏感数据（PII / 密钥 / token） |
| 4 | schema migration / 数据迁移 |
| 5 | 并发 / 竞态 |
| 6 | 资金 / 计费 |
| 7 | 跨模块接口（改的接口有 ≥2 个调用方） |
| 8 | 不可逆操作（删除 / 发送 / 发布） |

### Step 6: Round 1 骨架自查

Round 1 骨架完成，在填充代码前对计划骨架做一遍自查。骨架阶段发现的问题修正成本低，填充完再改代价翻倍。

**主会话就地自问自答**（不调 red-blue-deep、不派 subagent/Codex），逐条过：

> 「这份计划的骨架合理吗？切片策略（垂直还是横切？每片独立可验证吗？）、依赖图（有没有隐式耦合遗漏？）、risk-first 排序（最不确定的真的排前面了吗？）、task 粒度（sizing 准吗？有 and 该拆的吗？）、restate 覆盖（有遗漏路径吗？）」

自查纪律：放下"当时为什么这么排"的推理，只看骨架本身现在站不站得住；每条给一句判断 + 依据，不是走过场打勾。用户显式要求对抗审视（「红蓝军 / 深审」）才调 `$red-blue-deep`。

**结论落地**：自查中成立的质疑修正到骨架中（回 Step 3/4/5 对应调整）。

**Exit Gate:**
- [ ] 骨架自查清单逐条过完（每条有判断 + 依据）
- [ ] 成立的质疑已落实到骨架修正

### Step 7: 填充真实代码（Round 2）

Round 1 的骨架定了"改什么"，Round 2 填"怎么改"——每个 task 补上 TDD steps 真实代码。

**每个 task 必读 3 份**：
1. **设计文档**（dev-design 产出）— BF 伪代码 + 类接口 + 单测设计 Given/When/Then（业务规则已被蒸馏在这里）
2. **Plan Round 1 骨架** — 本 task 改哪些文件、covers 哪些路径
3. **最新代码库** — 现有代码长什么样、import 怎么写、风格怎么跟

**条件读**（伪代码没覆盖某条业务规则时才回溯，读完要回填设计文档）：
- **PRD**（`.prd.md`）— 伪代码未覆盖的业务边界 / 验收标准细节
- **UI / 原型**（`.ix.md` + `.vd.md` / prototype）— 伪代码未描述的交互细节。有 `.ix.md` 时：IA 页面结构作为前端任务拆分参照（一个 IA 页面 ≈ 一个前端 task），`data-testid` 命名写进 task 的接口约束，`interactions.json` 路径记入 task 备注供 dev-verify 复用
- **restate** — 伪代码未映射的验收标准（SC）

设计文档是上游蒸馏的终点——PRD / UI / restate 的业务规则应已进入伪代码和 Given/When/Then。写码时回读原始文档说明设计文档蒸馏不够，正确做法是**补设计文档**再继续，不是把重读 PRD 当常驻义务。

**领域指南消费（判断类，写代码前按场景 Read）**：这里写的是最终真实代码，判断该用什么模式/怎么防护/怎么分层，要在这一刻做，不是留给 Build 阶段：

| 场景 | Read | 用来做什么 |
|---|---|---|
| 涉及文件结构/模块边界 | `${PLUGIN_ROOT}/shared/references/architecture-principles.md` | Deep Module / 依赖分类 / seam 纪律，指导怎么拆文件、定接口 |
| 碰用户输入/认证/数据 | `${PLUGIN_ROOT}/shared/references/security-guide.md` | 威胁模型 / OWASP 防护模式，决定这段代码该用什么防注入写法 |
| 碰数据库查询/前端渲染 | `${PLUGIN_ROOT}/shared/references/performance-guide.md` | N+1 / 缓存 / 懒加载模式选型 |
| 碰 UI 组件 | `${PLUGIN_ROOT}/shared/references/frontend-guide.md` | 组件模式 / 设计系统遵循 |
| 写测试代码前 | `${PLUGIN_ROOT}/shared/references/testing-guide.md` | 测试替身怎么选 / 测试金字塔怎么分层 / DAMP 原则 |

**技术栈配方（落地可粘贴代码要用）**：

| 场景 | Read |
|---|---|
| TS/JS 测试代码 | `references/ts-test-patterns.md` |
| Go 代码 | `references/go-patterns.md` |

**每个 task 填充为 TDD steps**：

```
- [ ] Step 1: 写失败测试
  （基于设计文档的 Given/When/Then → 翻译成真实测试代码）

- [ ] Step 2: 跑测试确认失败
  Run: <具体命令>
  Expected: FAIL with "<原因>"

- [ ] Step 3: 写最小实现
  （基于设计文档的 BF 伪代码 → 翻译成真实实现代码）

- [ ] Step 4: 跑测试确认通过
  Run: <具体命令>
  Expected: PASS
```

**UI task 的验证方式**：涉及 UI 样式且存在设计基线（样张 / 原型截图 / 设计稿）的 task，Step 8d 声明的验证方式写「设计值对齐 + 截图对比基线」（方法与词表见 `${PLUGIN_ROOT}/shared/references/frontend-guide.md`「设计基线对齐」节），不硬套测试命令；无基线则标注跳过。

**不按 task 拆 commit**：commit 挪到 Build 阶段任务循环结束后统一处理一次（见 devflow Build sub-flow 5d），dev-plan 的 task 模板不再包含 commit 步骤。

**禁占位符**：`<your code here>` / `TODO` / `...` / "类似这样" / "参考 Task N"（重复写，执行者可能乱序读）。写不出真实代码 = 没想清楚，回 Step 1 重新读代码。

**并行填充**：无依赖的 task 可并行填充（spawn subagent 各自读设计文档 + 代码库 → 写代码）。

### Step 8: Round 2 自查 + Plan Validation

填充完成，代码和测试都写好了，在交用户确认前做最后一轮自查 + 清单自检。

#### 8a. Checklist 核查 + 跨 task 一致性自查

**Checklist 核查**（逐项过，不派 codex）：
- API 签名 / import 路径是否与当前代码库一致（读最新代码库核实，不凭记忆）
- 测试是否只测 happy path，有没有漏边界/异常分支
- 实现是否和设计文档的 BF 伪代码 / 接口一致
- 有没有引用已废弃接口

**跨 task 一致性自查**（只审跨 task 一致性 / 执行顺序，主会话就地自问自答）：

> 「前置 task 的产出（接口/数据结构/约定）够后续 task 用吗？多个 task 之间有没有隐含冲突的假设？执行顺序对吗？」

对着依赖图 + 接口约定 + 假设清单逐条核，每条给判断 + 依据。**升审只在两种情况**：① 用户显式要求（「红蓝军 / 深审 / 找 codex」）→ 调 `$red-blue-deep` 重档，喂依赖图 + 接口约定 + 假设清单（不喂完整实现代码）；② 计划命中敏感面（认证 / 敏感数据 / schema·migration / 资金 / 跨模块接口 / 不可逆动作）→ 向用户**一句话建议**升审，用户点头才调，不自动派发。

**结论落地**：checklist 发现的问题 + 自查中成立的质疑，都修正到计划中（回 Step 7 修正对应 task）。

#### 8b. 需求覆盖

restate 的每条 Success Criteria 至少被一个 task 覆盖。逐条核对，缺覆盖的标出来。

#### 8c. 路径覆盖

汇总所有 task 的 `covers` 字段，对照 restate 路径清单——**每条路径/约束至少被一个 task 覆盖**。有路径没被任何 task 覆盖 → 补 task，或显式说明该路径在当前迭代不实现（标注原因）。产出路径→task 映射表。

#### 8d. 任务可验证

每个 task 声明了怎么验证完成（测试命令/预期输出/人工确认项）。"写完就算完"不算验证——验证命令不存在的 task 在 Build 阶段会卡住。

#### 8e. 依赖无环

task 间依赖不成环，底层 task 排前面。循环依赖说明切片方式有问题。

**Exit Gate:**
- [ ] 跨 task 一致性自查完成（用户显式要求时为 red-blue-deep 流程完成）
- [ ] 成立的质疑已修正到计划中
- [ ] 8b 需求覆盖：每条 SC 被 ≥1 task 覆盖
- [ ] 8c 路径覆盖：路径→task 映射表产出，无漏路径
- [ ] 8d 可验证：每 task 有验证命令
- [ ] 8e 无环：依赖图无环

任一不过回 Step 7 补。

### Step 9: 用户确认计划 + 选执行方式

拆两回合，**计划内容禁塞 request_user_input**（塞 `question` 挤成密集段落、塞 `preview` 被终端折叠 `N lines hidden`，用户什么都没看清就被要求确认）：

- **展示回合**：计划全景作为**回合末尾文本**完整输出——plan 文件路径 + per-task 清单（有序列表，一行一个：编号 / 标题 / 一句验证方式）+ 对抗审视结论一行；末尾问两件事：「计划确认吗？Build 执行方式选哪种？」并给出两种方式一行说明。**结束回合，不接任何工具调用**。
- **确认回合**：用户回应通常已是决策（确认 + 执行方式 / 具体修改意见）→ 直接采纳；要改 → 改后重走展示回合；回应只确认了计划没选执行方式 → request_user_input 只补问执行方式（question 写 plan 路径 + task 数一行摘要，不复述计划）。

执行方式三选一：

- **`subagent-lite`**（推荐默认）——主 agent 顺序派发独立 implementer subagent；仅**风险 task**（外部输入/认证/敏感数据/schema·migration/并发/资金/跨模块接口/不可逆）派 spec + quality review，其余 task 只实现不派审查
- **`subagent-full`**——per-task spec review + checkpoint 批量 quality review（每个 plan checkpoint 批审一次），留给跨模块 / 高风险 / 数据敏感的计划
- **`executing`**——主 agent 自己顺序执行 plan 已写好的代码，不派 subagent、无独立 review，靠后续 dev-verify/dev-review 兜底

选定后写入 Plan Document Header 的 `Execution` 字段，Build 阶段读这个字段决定走哪条协议。

### Plan Document Header

每份计划文档以标准 header 开头：

```markdown
# [Feature Name] Implementation Plan

**Goal**: [一句话]
**Architecture**: [2-3 句]
**Tech Stack**: [关键技术/库]
**Design Doc**: [路径（Full 场景）]
**Test Objectives**: [测试目标摘要]
**Execution**: [subagent-lite | subagent-full | executing]
```

## Exit Gate

- [ ] 计划已产出（依赖图 + 任务序列 + checkpoint）
- [ ] 所有 task 过粒度三重约束（≤5 文件 + 一个逻辑动作 + 2-5 分钟节奏），零占位符
- [ ] 每个 task 标了 HITL/AFK
- [ ] 每个 task 标了 `covers`，所有 task 汇总覆盖 restate 每条路径（路径→task 映射表已产出）
- [ ] 测试目标已分配到 slice
- [ ] Round 1 骨架自查通过 + 骨架已修正（Step 6）
- [ ] Round 2 checklist 核查 + 跨 task 一致性自查 + Plan Validation 通过（Step 8）
- [ ] 用户显式确认计划（两回合：末尾文本完整展示 → 用户回应决策）
- [ ] 执行方式已选定（`Execution: subagent-lite | subagent-full | executing`），写入 Plan Document Header
- [ ] 后续 Build 输入齐全：任务序列 + 测试目标 + Execution 字段
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Plan 完成（含 task 数量 + 首个 slice 概要），建议下一阶段：Build（`nocode:dev-build`）。列出 Build 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

## 核心规则（when X → do Y）

- **When** 某 task 违反粒度三重约束任一条（>5 文件 / 多个逻辑动作 / 超出一个 TDD 红绿循环）→ **必须再拆**
- **When** task 标题里出现 "and" 或描述含两个独立动词 → 拆成两个 task
- **When** 冒出跨切片的整体验证（全链路 E2E、既有功能回归、冒烟）→ **不拆成 task**。它不是一根 tracer bullet（Iron Law），不满足 task 定义；这类验证属于设计文档「汇总」节的验证策略总表，原样留给 dev-verify 读取执行（`skills/dev-verify/SKILL.md` Enter Gate），不进 plan 任务序列

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "先写框架，代码执行时再填" | 写不出真实代码 = 没想清楚。占位符藏的是设计决策 |
| "横着按层做更整齐" | 整齐但不可验证。垂直每片做完都能跑能回滚 |
| "简单的先做，难的留后面" | risk-first：不确定性留到投入最大时暴露更贵 |
| "checkpoint 太频繁拖节奏" | 风险驱动 + fallback 3 已经降频了。省掉它出问题只能回退整个计划 |
| "自查走个形式就行" | 骨架改一行 vs 填充完改十行。前置自查省的是后面的返工——每条要有判断 + 依据，不是打勾 |
| "这个改动简单，跳过某 Step 或不建 update_plan" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权 |

## Red Flags

- 计划里出现 `<...>` / `TODO` / "调用相关方法"
- 某 task 写不出具体改哪几个文件
- 风险 task 后没有 checkpoint（对照风险信号清单 8 项）
- 连续 4+ task 没有 checkpoint（fallback 上限 3，超过就是漏了）
- 最不确定的部分排到了最后
- 没读相关代码就开始写 task
- task 缺 `covers` 字段，或汇总后有路径没被任何 task 覆盖（漏实现的早期信号）
- Round 2 的 checklist 核查 / 跨 task 一致性自查被跳过（这是 plan → build 前最后一道审视；自查是默认档不可省，升审派独立路仅用户显式要求）
- 自查（或升审）结论中成立的质疑没有落实到骨架/代码修正
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 update_plan、或漏掉最后的交接 task
- 计划里出现"E2E 全链路验证""既有功能回归"这类整体确认性 task —— 不是 tracer bullet，违反 task 定义。应删除该 task，改为核对设计文档「汇总」节的验证策略总表是否已覆盖，交给 dev-verify 执行
