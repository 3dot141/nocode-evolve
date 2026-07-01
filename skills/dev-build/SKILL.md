---
name: dev-build
description: Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it/动手/实现这个功能/把X加上/继续写/implement". Also use when resuming implementation work after a break or switching back from debugging.
---

# build — subagent 顺序派发，per-task 三阶段验证

Build 作为编排者，用 `Agent()` 逐个派发独立 subagent 执行 plan 中的每个 task，**默认顺序、不并行**。每个 task 走三阶段验证：实现 → spec 合规审查 → 代码质量审查。Build skill 本身是编排者，不执行实现代码。

## 非本 skill 请求

解释代码 / 知识问答 → 直接回答不进 Build。无计划无目标（"帮我做个东西"）→ 回 Define。"整个项目重构" → scope 过大回 Plan 拆。

## Enter Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）

## 领域指南（注入到 implementer prompt 中按需 Read）

| 领域 | 何时 Read | 用来做什么 |
|---|---|---|
| `{NOCODE_SKILL_REF}/testing-guide.md` | 写测试时 | TDD 循环 / 替身选择 / DAMP 原则 |
| `{NOCODE_SKILL_REF}/security-guide.md` | 碰用户输入/认证/数据时 | 防注入写法 / 输入校验 / 密钥管理 |
| `{NOCODE_SKILL_REF}/performance-guide.md` | 碰数据库查询/前端渲染时 | N+1 / 缓存 / 懒加载模式 |
| `{NOCODE_SKILL_REF}/frontend-guide.md` | 碰 UI 组件时 | 组件模式 / 无障碍 / 设计系统 |
| `{NOCODE_SKILL_REF}/ui-taste-model.md` | 实现 UI 视觉层时 | 有 `[design-source: ...]` → 照外部产物实现不发挥：`claude-design <projectId>` 用 `/design import` 拉回、`prototype <路径>` 直接读 HTML；无标识 → 读设计文档 `## UI 设计` 节照做；设计文档也没有 → 按 `ui-taste-model.md` 选方向自行发挥 |
| `{NOCODE_SKILL_REF}/architecture-principles.md` | 拿不准模块边界时 | Deep Module / Seam / 依赖分类 |

**技术栈配方**：当项目技术栈命中以下场景时，注入到 implementer prompt 让 subagent Read 对应 reference：

| 场景 | 触发特征 | Read |
|---|---|---|
| TS/JS 测试 | package.json 含 jest/vitest/@playwright | `references/ts-test-patterns.md` |
| Go 开发 | 有 go.mod | `references/go-patterns.md`（惯用法/测试/审查/构建排错） |
| TS 构建排错 | tsconfig.json 且 tsc/build 失败 | `references/ts-build-fix.md` |

## 协议

### Step 0: 建编排里程碑

Build 固定由主 agent 顺序派发 subagent，无执行模式可选——不读 Plan 的 `Execution` 字段、不生成 Workflow 脚本、不并行。

**进 Step 1 前立即 TaskCreate**，建 3 个编排里程碑（**不镜像 plan 的每个 task**——per-task 由主 agent 逐个派发/重派/修复，镜像出来会和这些内部循环打架、谎报进度；这里只跟踪编排者自己的 3 步）：

```
Task 1: 顺序派发 subagent（Step 1-2）
  Sub-steps: 加载计划 + 按依赖排定线性顺序 + 组装 implementer prompt + 逐个 task 走三阶段派发
  Gate: 所有 task 跑完三阶段，拿到每个 task 的结构化结果

Task 2: 编排者验证（Step 3）
  Sub-steps: 独立查 diff + 独立跑测试 + spec 抽查 + 空壳扫描
  Gate: 全部 task 通过编排者独立验证（不信 subagent 自报）

Task 3: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Build 完成（完成 task 数 + 测试 + build 状态）→ 建议进 Verify → 等用户拍板后调 Skill(nocode-evolve:dev-verify)
  Gate: 用户拍板进入 Verify（这一步不勾，Build 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: 加载计划 + 排定顺序

1. 读 Plan 文档：任务序列 + 依赖图 + Design 测试目标
2. 按依赖图拓扑把 task 排成一条**线性执行顺序**（被依赖的先跑；无依赖的 task 也排进这条线，不并行）
3. 为每个 task 组装 implementer prompt（见下方「Implementer Prompt 组装」）
4. 按顺序逐个派发（见 Step 2），不生成 Workflow 脚本

### Step 2: 逐 task 顺序派发协议

按 Step 1 排定的线性顺序遍历 task，每个 task 用主 agent 的 `Agent()` 工具**依次**派发独立 subagent，前一阶段 gate 通过才进下一阶段。**逐个 task 完成整条三阶段链，再进下一个 task——不并行。**

**每个 task 的三阶段：**

1. **Implement** — 派 implementer subagent（`Agent(subagent_type: "general-purpose")`，prompt 见「Implementer Prompt 组装」）。要求它按下面格式结构化报告，主 agent 读取后决定下一步：
   - `status`：`DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`
   - `summary` / `filesChanged` / `concerns` / `testResults`
2. **Spec Review** — 仅当 `status ∈ {DONE, DONE_WITH_CONCERNS}` 时派发；`BLOCKED` / `NEEDS_CONTEXT` → 不进 review，按「异常路径」处理。specReviewPrompt 必须含：task 文本 + implementer 报告 + 设计文档相关段落 + plan 全局视图（依赖图 + task 列表）+ 前置 task 产出摘要。reviewer 报 `{approved, issues[]}`。
3. **Quality Review** — 仅当 spec `approved === true` 时派发。qualityReviewPrompt。reviewer 报 `{approved, issues[]}`。

**gate**：任一 review `approved:false` → 进 fix 循环（见「异常路径」），修完重审，通过才进下一 task。

**为什么顺序不并行**：并行派发的 subagent 共享同一个工作目录，「依赖图无依赖」≠「文件不冲突」——两个 task 改到同一个 lockfile / 快照 / 共享类型就会互相覆盖，这正是 superpowers 禁止并行 implementer 的原因。顺序执行天然规避，用少量 wall-clock 换可靠性 +「出问题能二分定位」。

**报告契约**（subagent 结构化返回，主 agent 读取）：

| 角色 | 字段 |
|---|---|
| implementer | `status`（四值同上）+ `summary` + `filesChanged` + `concerns` + `testResults` |
| reviewer（spec / quality） | `approved`（bool）+ `issues[]`（每条带 tag，见下方「per-task review 引入 reviewing 框架」） |

### per-task review 引入 reviewing 框架

per-task 的 **Spec Review + Quality Review** 两阶段不自造一套 review 范式，是 `reviewing` 框架的一次实例化。组装这两段 review prompt 时引入框架：

- **套通用流程**：`Read {NOCODE_SKILL_REF}/reviewing/skeleton.md`——分档（实现是不可逆产出，per-task 默认重档）、对象界定 + 进入 gate（评审对象 = 单 task 的实现 diff；gate = implementer status ∈ DONE/DONE_WITH_CONCERNS）、独立交叉（spec/quality reviewer 是与 implementer 分离的独立 subagent，独立性档位 = 同模型独立）、收口（approved gate）都走框架，不在本 skill 重写流程。
- **套 findings 契约**：`Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md`——reviewer 报告的 `{approved, issues}` 是契约 **verdict 层**在 dev-build 的落地：`approved` 直接喂 verdict 的 `approved`（有未处置阻塞类 issue → false），`issues[]` 每条按 tag/级别经映射表压到 `severity`。
- **领域维度（框架第 3 步注入点）= 本 skill 自己的两套维度**，框架不抹平、原样保留在两份 prompt 模板里：
  - **Spec Review 维度**（`references/spec-reviewer-prompt.md`）：Missing requirements / Design alignment / Cross-task consistency / Empty shells / Extra / Misunderstandings——每条 issue 带 tag `[missing]` / `[empty-shell]` / `[design-mismatch]` / `[cross-task]` / `[extra]`。
  - **Quality Review 维度**（`references/quality-reviewer-prompt.md`）：Structure / Quality / Testing / Conventions——Issues 分 Critical / Important / Minor。

**Quality Review 范围**：只看这一个 task 自己的 diff——抓 linter 能抓的 Conventions、缺测试、明显坏味道，不做跨 task 架构判断（Review 阶段 Five-Axis 负责，会读各 task 的 Quality Review verdict 补增量）。

**tag / 级别 → 统一 severity 映射**（findings-contract §3 的 dev-build 列，本 skill 不另立分级体系）：

| tag / 级别 | 统一 severity | 处置 |
|---|---|---|
| `[missing]` / `[empty-shell]` / `[design-mismatch]`（+ `approved:false`） | **Critical**（阻塞） | spec 不达标，重新派发 implementer 修复 |
| `[cross-task]` + Quality `Important` | **Warning**（应修） | 跨 task 一致性 / 质量应修 |
| `[extra]` + Quality `Minor` | **Suggestion**（记录） | 多余产出 / 小问题 |

**两阶段 gate 不变**（框架步骤 7 收口语义）：Spec Review 仅在 implementer status ∈ DONE/DONE_WITH_CONCERNS 时跑；Quality Review 仅在 `specResult.approved === true` 时跑；任一 `approved:false` → 进 fix 循环（见「异常路径」），不放行。`approved:false` 等价于框架"存在未处置 Critical → 不放行"，是 Critical 不可 override 在 per-task 层的体现。

### Review Tier（轻档出口）

不是每个 task 都要走完整三阶段 pipeline。按 Plan 阶段标的 Review Tier（`light`/`heavy`，见 dev-plan Step 4）分流：

- **heavy**（默认，多文件 / 碰共享接口·契约 / 涉及安全鉴权支付 / 标 HITL）→ 走完整 pipeline：implement → spec review → quality review，不降档。
- **light**（单文件 + 无 HITL + 不碰共享接口）→ 只走 implement，spec/quality review 不单独起 subagent——implement 结果先收集，等到下一个 checkpoint 边界，把该 checkpoint 区间内所有 light task 的 diff **合并送一次** spec+quality review（复用同一套 `{approved, issues[]}` 报告契约，评审对象从"单 task diff"变成"该 checkpoint 区间内全部 light task 合并 diff"）。

### Step 3: 处理派发结果

所有 task 派发完成后，Build 作为编排者验证结果：

1. **BLOCKED / NEEDS_CONTEXT task**：汇总报告给用户，提供上下文后可重跑
2. **Spec review 未通过的 task**：汇总 issues，决定是否重新派发 implementer 修复
3. **全部通过**：进 Exit Gate

**编排者验证（不信 subagent 自报）**：

1. **独立查 diff**：Read subagent 改动的文件，确认 scope 未越界
2. **独立跑测试**：跑完整测试套件，不只依赖 subagent 的测试输出
3. **spec 核对（抽查）**：抽查 1-2 个 task 的 spec reviewer 判断是否站得住，不逐条重查
4. **空壳扫描（确定性脚本，非 LLM 判断）**：用 grep/AST 模式匹配扫全量 diff——空函数体、placeholder 注释（`// TODO`、`// implement`）、`throw new Error('not implemented')`、只有类型签名没有逻辑的方法。lint + typecheck 通过不代表功能完整，空函数合法但无用。发现空壳 → 视为 task 未完成，重新派发 implementer 补齐

## Implementer Prompt 组装

Build 为每个 task 组装 implementer prompt，内容来自三个来源：

1. **task 描述**（来自 Plan）：完整 task 文本、代码、验证命令
2. **执行纪律**（来自 `references/implementer-disciplines.md`）：Iron Law TDD、Scope Lock、偏差分级、NOTICED BUT NOT TOUCHING、异常路径
3. **上下文注入**（按条件）：有 pd-vd 原型时注入视觉清点纪律；技术栈配方按项目特征注入

Prompt 模板见 `references/implementer-prompt.md`。

## 异常路径（编排者层面）

| 触发 | 处理 |
|---|---|
| task BLOCKED | 收集 blocker 信息，提供更多 context 重新派发；或升级到更强 model 重试；或回 Plan 拆分 |
| spec review 不过 | 派发 fix subagent 修复 spec issues → 重新 spec review → 循环直到通过 |
| quality review 不过 | 派发 fix subagent 修复 quality issues → 重新 quality review → 循环直到通过 |
| 多个 task 互相冲突 | 停手报告，可能需要回 Plan 调整依赖图 |

## Exit Gate

- [ ] 所有 plan task 完成（每个 task 三阶段结果确认）
- [ ] 编排者独立验证通过（diff + 测试 + spec 核对 + 空壳扫描）
- [ ] 零空壳：无空函数体、无 TODO/implement placeholder、无 `throw not implemented`
- [ ] 全部测试通过（整个相关套件，不只新写的）
- [ ] build 通过
- [ ] 后续 Verify 可开始
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Build 完成（含完成 task 数 + 测试通过状态 + build 状态），建议下一阶段：Verify（`nocode-evolve:dev-verify`）。列出 Verify 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

**"lint + typecheck 通过" ≠ 完成。** 空函数体、未填充的方法、placeholder 注释都能过 lint 和 typecheck。Exit Gate 必须独立确认每个 task 的功能已实现，不只是语法合法。

## 核心规则（when X → do Y）

- **When** bug 不稳定复现 → 目标不是干净 repro，是**更高复现率**。循环 100×、并行、加压、收窄时序。50% flake 可调试，1% 不可调——先拉高再 debug

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "太简单不用测" | 简单改动写测试只要一分钟。"简单"的改动出回归才最隐蔽 |
| "先把代码写出来，测试后面补" | 后补的测试为已有代码背书，不是在驱动设计。删掉重来 |
| "我先验证下思路，测试稍后" | "稍后"= 永不。验证思路本身就该用测试表达 |
| "事后测试达到同样目的" | tests-after 回答"代码做什么"，tests-first 回答"代码应该做什么"。前者被实现带偏 |
| "一次多做几个 task 更快" | 批量的速度是假的——出问题时无法二分定位 |
| "这个改动简单，跳过某 Step 或不建 TaskCreate" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权（详见 agent-catalog-using.md「进了 skill 就走完」） |

## Red Flags

- 有 BLOCKED task 未处理就继续派发下一个
- spec review 不过强行跳过
- 编排者没有独立跑测试就报完成
- commit message 是 "fix" / "update" / "wip"
- subagent 越界改了计划外文件
- 报"Build 完成"但留有空壳函数/未实现方法/TODO placeholder（lint+typecheck 通过 ≠ 功能完整）
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
