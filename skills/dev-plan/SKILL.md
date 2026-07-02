---
name: dev-plan
description: Use when you have defined goals and need to break work into tasks. Use when devflow routes to Plan stage, or when the user says "写计划/拆任务/怎么实现/plan it out". Use when a task feels too large to start or when parallel work is possible. Not for writing code (use dev-build), clarifying unclear requirements (use dev-define), or interaction breakdown/交互拆解 (use pd-ix).
---

# plan — 把目标拆成任务序列

**Iron Law: 计划里贴的是真实代码和命令，不是占位符。写不出真实代码 = 还没想清楚。**

计划的价值不在"列出步骤"，在让执行变成机械动作。每个任务是一根 **tracer bullet**——穿透所有层的端到端垂直切片。好计划拿到就能照做，不需要边做边想"这里该怎么写"。

> Leading word: **tracer bullet**。每个 task 切一条窄但完整的端到端路径，不按层横切。

输入：Define 的 restate + dev-design-refine 的设计文档（含领域划分、模块设计、接口、业务流、测试目标）（Full 场景）。
输出：用户确认的任务序列。

## 非本 skill 请求

知识问答 / 目标不明确（缺 restate）→ 回 Define。单步太小不需拆 → 直接给验收标准走 Build，不硬拆。写代码 → 走 Build。

## Enter Gate

- [ ] Define restate 存在且已确认
- [ ] Full 场景：Design 设计文档 + 测试目标已产出
- [ ] Standard 场景：restate 足够指导任务拆分

**Plan 的两种合法产出**：
- **完整计划**（Standard/Full）：依赖图 + 任务序列 + checkpoint
- **验收标准只**（Mini/太小不拆）：一句话说清"怎么算做完了" + 指出前置确认项（如 i18n/定位）。不拆 ≠ 不定义完成标准。两者都是 Plan 的正当输出。

> 端到端示例（header + 依赖图 + task + checkpoint + Plan Validation）见 `references/examples/example-plan-output.md`

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
═══ Round 1: 编排（定依赖和顺序）═══

Task 1: 只读模式 — 加载上下文
  Sub-steps: 读 restate + 设计文档（BF 伪代码 + 接口 + 单测设计）+ 测试目标 + 相关代码及测试 + 类似 pattern
  Gate: 上下文加载完成，未碰任何代码（开始改文件 = 跳过 Plan）

Task 2: 画依赖图
  Sub-steps: 列所有块 → 标依赖方向 → 底层排前
  Gate: 依赖图产出，无环

Task 3: 垂直切片 — risk-first
  Sub-steps: 选 slicing 形态（Vertical/Contract-First）→ risk-first 排序 → TO 分配到 slice
  Gate: 端到端可交付的切片序列，最不确定的排最前

Task 4: 写 task 骨架
  Sub-steps: 每 task 标 Files + covers + HITL/AFK + UI 设计源（代码留空，Round 2 填）
  Gate: 每 task ≤5 文件，骨架完整

Task 5: 插 checkpoint
  Sub-steps: 每 2-3 task 一个 checkpoint
  Gate: checkpoint 边界已插

Task 6: Round 1 Red-Blue Review — 骨架对抗审视（轻档）
  Sub-steps: 调 Skill(nocode:red-blue-deep)（声明轻档）评估骨架 → 结论中成立的质疑修正到骨架
  Gate: red-blue-deep 流程完成，成立的质疑已修正

═══ Round 2: 填充代码（读设计文档 + 代码库 → 写真实代码）═══

Task 7: 逐 task 填充真实代码
  Sub-steps: 读设计文档对应 BF 伪代码 + 读最新代码库 → 写测试代码 + 实现代码 + 验证命令
  Gate: 零占位符，每 task 有真实测试 + 实现 + 命令
  注: 无依赖的 task 可并行填充

═══ 收尾 ═══

Task 8: Round 2 Checklist 核查 + 窄化 Red-Blue + Plan Validation
  Sub-steps: checklist 逐项核查（API签名/测试覆盖/设计一致/废弃接口）→ 窄化 Skill(nocode:red-blue-deep)（强制重档）只评跨task一致性 → 裁决修正 → 四项自检（需求覆盖 + 路径覆盖 + 可验证 + 无环）
  Gate: checklist + red-blue-deep 流程完成 + 裁决修正完成 + 四项自检全过（任一不过回 Task 7 补）

Task 9: 用户确认计划
  Sub-steps: 完整呈现计划 → AskUserQuestion 确认
  Gate: 用户确认计划

Task 10: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Plan 完成（task 数 + 首个 slice）→ 建议进 Build → 等用户拍板后调 Skill(nocode:dev-build)
  Gate: 用户拍板进入 Build（这一步不勾，Plan 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: 只读模式

读，不写。按以下顺序加载上下文：
1. restate（成果物/验收标准/约束/Out of Scope）
2. dev-design-refine 产出的设计文档（含领域划分、模块设计、接口、业务流、测试目标）
3. 要改的文件 + 它们的测试
4. 找一个已存在的类似 pattern 做参照
5. 涉及的类型/接口定义

发现自己开始改文件 → 停——你在跳过 Plan 直接 Build。

### Step 2: 依赖图

列出所有块，标谁依赖谁。底层先建——下游任务依赖的东西必须先就位。

### Step 3: 垂直切片

优先**端到端可交付**，不按层横切。每个切片做完有能跑、能 demo、能回滚的东西。

**Slicing 形态**（怎么切）：
- **Vertical**（默认）：端到端穿透所有层，做完可验证
- **Contract-First**：前后端并行时先定 API 契约 + mock，各自独立开发

**排序原则**：**Risk-first**——最不确定的 slice 排最前，可能不可行的路径早点撞墙。

测试目标分配到对应 slice——每个 slice 知道自己要验证什么。

### Step 4: 写 task 骨架（Round 1）

每个 task 用 `references/task-template.md` 格式。路径/约束 ID 约定见 `{NOCODE_SKILL_REF}/path-conventions.md`。

Round 1 写骨架——定清楚**改什么、覆盖什么、谁做**，代码留空给 Round 2 填：

- **Files**：Create / Modify / Test 精确路径
- **covers（必填）**：覆盖 restate 哪些路径/约束 ID
- **设计文档段落**：指向 dev-design-refine 的哪个域/模块/BF（Round 2 读这里写代码）
- **HITL / AFK**
- **UI 设计源**（涉及 UI 时）
- **Sizing ≤ M**（≤5 文件），超了拆
- **Rollback-friendly**：每 task 独立可回滚
- **描述 durable 化**：用行为意图（"用户创建记录时验证必填字段"），不用易腐行号

### Step 5: 插 checkpoint

每 2-3 个 task 一个 checkpoint = 全测试通过 + build 通过 + 用户 review。checkpoint 是 rollback 边界。

### Step 6: Round 1 Red-Blue Review

Round 1 骨架完成，在填充代码前对计划骨架做对抗审视。骨架阶段发现的问题修正成本低，填充完再改代价翻倍。

调用 `Skill(nocode:red-blue-deep)`，评估问题：

> 「这份计划的骨架合理吗？切片策略（垂直还是横切？每片独立可验证吗？）、依赖图（有没有隐式耦合遗漏？）、risk-first 排序（最不确定的真的排前面了吗？）、task 粒度（sizing 准吗？有 and 该拆的吗？）、restate 覆盖（有遗漏路径吗？）」

附上完整骨架（依赖图 + task 列表含 covers/sizing/HITL-AFK + checkpoint）作为被评估对象。Round 1 走**轻档**——调用时声明「轻档」，red-blue-deep 给一句表态 + 关键理由（不派 subagent、不调 codex），骨架层的粗问题快速暴露即可；深审留给 Round 2 收尾（Step 8 强制重档）。

**结论落地**：red-blue-deep 结论中成立的质疑修正到骨架中（回 Step 3/4/5 对应调整）。

**Exit Gate:**
- [ ] red-blue-deep 流程完成
- [ ] 结论中成立的质疑已落实到骨架修正

### Step 7: 填充真实代码（Round 2）

Round 1 的骨架定了"改什么"，Round 2 填"怎么改"——每个 task 补上 TDD steps 真实代码。

**每个 task 完整读 5 份上游文档 + 代码库**：
1. **PRD**（`.prd.md`）— 业务是什么，这条路径的业务规则
2. **UI / 原型**（`.ix.md` + `.vd.md` / prototype）— 界面长什么样，交互怎么走。有 `.ix.md` 时：IA 页面结构作为前端任务拆分参照（一个 IA 页面 ≈ 一个前端 task），`data-testid` 命名写进 task 的接口约束，`interactions.json` 路径记入 task 备注供 dev-verify 复用
3. **restate** — 验收标准（SC），怎么算做完
4. **设计文档**（dev-design-refine 产出）— BF 伪代码 + 类接口 + 单测设计 Given/When/Then
5. **Plan Round 1 骨架** — 本 task 改哪些文件、covers 哪些路径
6. **最新代码库** — 现有代码长什么样、import 怎么写、风格怎么跟

5 份文档提供"做什么 + 长什么样 + 怎么验收 + 怎么做"，代码库提供"代码风格 + 现有 API"。缺任何一份都可能写出不准确的代码。

**领域指南消费（判断类，写代码前按场景 Read）**：这里写的是最终真实代码，判断该用什么模式/怎么防护/怎么分层，要在这一刻做，不是留给 Build 阶段：

| 场景 | Read | 用来做什么 |
|---|---|---|
| 涉及文件结构/模块边界 | `{NOCODE_SKILL_REF}/architecture-principles.md` | Deep Module / 依赖分类 / seam 纪律，指导怎么拆文件、定接口 |
| 碰用户输入/认证/数据 | `{NOCODE_SKILL_REF}/security-guide.md` | 威胁模型 / OWASP 防护模式，决定这段代码该用什么防注入写法 |
| 碰数据库查询/前端渲染 | `{NOCODE_SKILL_REF}/performance-guide.md` | N+1 / 缓存 / 懒加载模式选型 |
| 碰 UI 组件 | `{NOCODE_SKILL_REF}/frontend-guide.md` | 组件模式 / 设计系统遵循 |
| 写测试代码前 | `{NOCODE_SKILL_REF}/testing-guide.md` | 测试替身怎么选 / 测试金字塔怎么分层 / DAMP 原则 |

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

- [ ] Step 5: Commit
  git add <files> && git commit -m "<message>"
```

**禁占位符**：`<your code here>` / `TODO` / `...` / "类似这样" / "参考 Task N"（重复写，执行者可能乱序读）。写不出真实代码 = 没想清楚，回 Step 1 重新读代码。

**并行填充**：无依赖的 task 可并行填充（spawn subagent 各自读设计文档 + 代码库 → 写代码）。

### Step 8: Round 2 Red-Blue Review + Plan Validation

填充完成，代码和测试都写好了，在交用户确认前做最后一轮对抗审视 + 清单自检。

#### 8a. Checklist 核查 + 窄化 Red-Blue

**Checklist 核查**（逐项过，不派 codex）：
- API 签名 / import 路径是否与当前代码库一致（读最新代码库核实，不凭记忆）
- 测试是否只测 happy path，有没有漏边界/异常分支
- 实现是否和设计文档的 BF 伪代码 / 接口一致
- 有没有引用已废弃接口

**窄化 Red-Blue**（只审跨 task 一致性 / 执行顺序）：调用 `Skill(nocode:red-blue-deep)` 并声明「强制重档」——这是 plan → build 前最后一道审视，走 heavy 流程（第一性原理 → 蓝军 → 独立审查 → 结论），降档只认用户显式否定词。评估：

> 「前置 task 的产出（接口/数据结构/约定）够后续 task 用吗？多个 task 之间有没有隐含冲突的假设？执行顺序对吗？」

重档范围仍是窄化的——喂依赖图 + 接口约定 + 假设清单，不把完整实现代码整段喂给 codex。

**结论落地**：checklist 发现的问题 + red-blue 结论中成立的质疑，都修正到计划中（回 Step 7 修正对应 task）。

#### 8b. 需求覆盖

restate 的每条 Success Criteria 至少被一个 task 覆盖。逐条核对，缺覆盖的标出来。

#### 8c. 路径覆盖

汇总所有 task 的 `covers` 字段，对照 restate 路径清单——**每条路径/约束至少被一个 task 覆盖**。有路径没被任何 task 覆盖 → 补 task，或显式说明该路径在当前迭代不实现（标注原因）。产出路径→task 映射表。

#### 8d. 任务可验证

每个 task 声明了怎么验证完成（测试命令/预期输出/人工确认项）。"写完就算完"不算验证——验证命令不存在的 task 在 Build 阶段会卡住。

#### 8e. 依赖无环

task 间依赖不成环，底层 task 排前面。循环依赖说明切片方式有问题。

**Exit Gate:**
- [ ] red-blue-deep 流程完成
- [ ] 结论中成立的质疑已修正到计划中
- [ ] 8b 需求覆盖：每条 SC 被 ≥1 task 覆盖
- [ ] 8c 路径覆盖：路径→task 映射表产出，无漏路径
- [ ] 8d 可验证：每 task 有验证命令
- [ ] 8e 无环：依赖图无环

任一不过回 Step 7 补。

### Step 9: 用户确认计划 + 选执行方式

计划完整呈现后用 AskUserQuestion 让用户确认，同时选执行方式：

- **`subagent`**（推荐）——主 agent 顺序派发独立 subagent，per-task 走 implement → spec review → quality review 三阶段独立审查
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
**Execution**: [subagent | executing]
```

## Exit Gate

- [ ] 计划已产出（依赖图 + 任务序列 + checkpoint）
- [ ] 所有 task ≤ M，零占位符
- [ ] 每个 task 标了 HITL/AFK
- [ ] 每个 task 标了 `covers`，所有 task 汇总覆盖 restate 每条路径（路径→task 映射表已产出）
- [ ] 测试目标已分配到 slice
- [ ] Round 1 red-blue-deep 通过 + 骨架已修正（Step 6）
- [ ] Round 2 checklist 核查 + 窄化 red-blue-deep + Plan Validation 通过（Step 8）
- [ ] 用户显式确认计划（AskUserQuestion）
- [ ] 执行方式已选定（`Execution: subagent | executing`），写入 Plan Document Header
- [ ] 后续 Build 输入齐全：任务序列 + 测试目标 + Execution 字段
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Plan 完成（含 task 数量 + 首个 slice 概要），建议下一阶段：Build（`nocode:dev-build`）。列出 Build 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

## 核心规则（when X → do Y）

- **When** 某 task 涉及 > 5 文件 → **必须再拆**。L 任务把多个设计决策压成一句话
- **When** task 标题里出现 "and" → 大概率该拆成两个 task
- **When** 冒出跨切片的整体验证（全链路 E2E、既有功能回归、冒烟）→ **不拆成 task**。它不是一根 tracer bullet（Iron Law），不满足 task 定义；这类验证属于设计文档「汇总」节的验证策略总表，原样留给 dev-verify 读取执行（`skills/dev-verify/SKILL.md` Enter Gate），不进 plan 任务序列

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "先写框架，代码执行时再填" | 写不出真实代码 = 没想清楚。占位符藏的是设计决策 |
| "横着按层做更整齐" | 整齐但不可验证。垂直每片做完都能跑能回滚 |
| "简单的先做，难的留后面" | risk-first：不确定性留到投入最大时暴露更贵 |
| "checkpoint 太频繁拖节奏" | checkpoint 是 rollback 边界。省掉它出问题只能回退整个计划 |
| "red-blue-deep 太重了" | 骨架改一行 vs 填充完改十行。前置审视省的是后面的返工 |
| "这个改动简单，跳过某 Step 或不建 TaskCreate" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权（详见 agent-catalog-using.md「进了 skill 就走完」） |

## Red Flags

- 计划里出现 `<...>` / `TODO` / "调用相关方法"
- 某 task 写不出具体改哪几个文件
- 连续 4+ task 没有 checkpoint
- 最不确定的部分排到了最后
- 没读相关代码就开始写 task
- task 缺 `covers` 字段，或汇总后有路径没被任何 task 覆盖（漏实现的早期信号）
- Round 2 red-blue-deep 被跳过或降档（收尾审视是 plan → build 前最后一道强制重档，降档只认用户显式否定词；Round 1 轻档是设计如此，不算降档）
- red-blue-deep 结论中成立的质疑没有落实到骨架/代码修正
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
- 计划里出现"E2E 全链路验证""既有功能回归"这类整体确认性 task —— 不是 tracer bullet，违反 task 定义。应删除该 task，改为核对设计文档「汇总」节的验证策略总表是否已覆盖，交给 dev-verify 执行
