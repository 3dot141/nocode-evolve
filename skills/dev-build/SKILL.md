---
name: dev-build
description: Use when executing implementation tasks from a plan, writing new code, or implementing features. Use when devflow routes to Build stage, or when the user says "开始实现/写代码/执行计划/build it/动手/实现这个功能/把X加上/继续写/implement". Also use when resuming implementation work after a break or switching back from debugging.
---

# build — Workflow 编排，per-task 三阶段验证

Build 通过 Workflow 派发独立 subagent 执行 plan 中的每个 task。每个 task 走三阶段验证：实现 → spec 合规审查 → 代码质量审查。Build skill 本身是编排者，不执行实现代码。

## 非本 skill 请求

解释代码 / 知识问答 → 直接回答不进 Build。无计划无目标（"帮我做个东西"）→ 回 Define。"整个项目重构" → scope 过大回 Plan 拆。

## Enter Gate

- [ ] Plan 任务序列已产出且用户确认
- [ ] Full 场景：Design 测试目标可用（指导 TDD 写什么测试）
- [ ] 执行模式已确定（见 Step 0）

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

### Step 0: 确定执行模式

读 Plan 文档 header 的 `Execution` 字段：

- **有值**（`workflow-parallel` 或 `workflow-sequential`）→ 直接使用
- **无值**（Plan 未记录，或跨会话恢复）→ AskUserQuestion 补问：

```
AskUserQuestion: "Plan 里没有记录执行模式，怎么跑？"
- Workflow 并行 (推荐) — 按依赖图拓扑，无依赖的 task 并行执行
- Workflow 顺序 — 逐 task 顺序执行
```

**确定执行模式后立即 TaskCreate**，建 3 个编排里程碑（**不镜像 plan 的每个 task**——per-task 在 Workflow 内部跑，镜像出来会和内部重派/修复循环打架、谎报进度；这里只跟踪编排者自己的 3 步）：

```
Task 1: 派发 Workflow（Step 1-2）
  Sub-steps: 加载计划 + 解析依赖图 + 组装 implementer prompt + 生成并调用 Workflow() 执行
  Gate: Workflow 跑完，拿到所有 task 的结构化结果

Task 2: 编排者验证（Step 3）
  Sub-steps: 独立查 diff + 独立跑测试 + spec 逐条核对 + 空壳扫描
  Gate: 全部 task 通过编排者独立验证（不信 subagent 自报）

Task 3: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Build 完成（完成 task 数 + 测试 + build 状态）→ 建议进 Verify → 等用户拍板后调 Skill(nocode-evolve:dev-verify)
  Gate: 用户拍板进入 Verify（这一步不勾，Build 不算收尾）
```

每完成一个标 done。

### Step 1: 加载计划 + 生成 Workflow

1. 读 Plan 文档：任务序列 + 依赖图 + Design 测试目标
2. 解析依赖图拓扑，识别哪些 task 可并行
3. 为每个 task 组装 implementer prompt（见下方「Implementer Prompt 组装」）
4. 生成 Workflow 脚本并调用 `Workflow()` 执行

### Step 2: Workflow 脚本结构

```js
export const meta = {
  name: 'dev-build',
  description: 'Execute plan tasks with per-task 3-stage verification',
  phases: [
    { title: 'Implement' },
    { title: 'Spec Review' },
    { title: 'Quality Review' },
    { title: 'Final Review' },
  ],
}

// --- workflow-parallel 模式 ---
// 按依赖图拓扑分层，同层 task 并行，跨层顺序
// 例: T1,T2 无依赖 → 并行; T3 依赖 T1+T2 → 等前两个完成
//
// --- workflow-sequential 模式 ---
// 所有 task 顺序执行，忽略并行机会
//
// 两种模式都走 pipeline 三阶段:
// implement → spec review → quality review

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'string' },
    testResults: { type: 'string' },
  },
  required: ['status', 'summary', 'filesChanged'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['approved'],
}

// 按拓扑层分组执行 (parallel 模式) 或逐个执行 (sequential 模式)
for (const layer of topoLayers) {
  const layerResults = await parallel(layer.map(task => () =>
    pipeline(
      [task],
      // Stage 1: Implement
      t => agent(implementerPrompt(t), {
        label: `impl:${t.id}`,
        phase: 'Implement',
        schema: IMPL_SCHEMA,
      }),
      // Stage 2: Spec Review (only if DONE/DONE_WITH_CONCERNS)
      // specReviewPrompt 必须包含: task 文本 + implResult + 设计文档相关段落
      //   + plan 全局视图(依赖图+task 列表) + 前置 task 产出摘要
      (implResult, t) => {
        if (implResult.status === 'BLOCKED' || implResult.status === 'NEEDS_CONTEXT') {
          log(`${t.id} blocked: ${implResult.concerns}`)
          return null
        }
        return agent(specReviewPrompt(t, implResult, designDoc, planOverview, depOutputs), {
          label: `spec:${t.id}`,
          phase: 'Spec Review',
          schema: REVIEW_SCHEMA,
        })
      },
      // Stage 3: Quality Review (only if spec approved)
      (specResult, t) => {
        if (!specResult?.approved) {
          log(`${t.id} spec review failed — needs fix`)
          return null
        }
        return agent(qualityReviewPrompt(t), {
          label: `quality:${t.id}`,
          phase: 'Quality Review',
          schema: REVIEW_SCHEMA,
        })
      },
    )
  ))
}

// Final: 整体 code review
phase('Final Review')
const finalReview = await agent(finalReviewPrompt, {
  label: 'final-review',
  phase: 'Final Review',
})
```

> 这是结构示意，Build 根据实际 plan 内容生成具体脚本。

### Step 3: 处理 Workflow 结果

Workflow 完成后，Build 作为编排者验证结果：

1. **BLOCKED / NEEDS_CONTEXT task**：汇总报告给用户，提供上下文后可重跑
2. **Spec review 未通过的 task**：汇总 issues，决定是否重新派发 implementer 修复
3. **全部通过**：进 Exit Gate

**编排者验证（不信 subagent 自报）**：

1. **独立查 diff**：Read subagent 改动的文件，确认 scope 未越界
2. **独立跑测试**：跑完整测试套件，不只依赖 subagent 的测试输出
3. **spec 核对**：subagent 交付的 vs task 验收标准逐条核对
4. **空壳扫描**：检查 subagent 产出的代码中是否有未实现的空壳——空函数体、placeholder 注释（`// TODO`、`// implement`）、`throw new Error('not implemented')`、只有类型签名没有逻辑的方法。lint + typecheck 通过不代表功能完整，空函数合法但无用。发现空壳 → 视为 task 未完成，重新派发 implementer 补齐

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

- [ ] 所有 plan task 完成（Workflow 结果确认）
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

- Workflow 结果中有 BLOCKED task 未处理就继续
- spec review 不过强行跳过
- 编排者没有独立跑测试就报完成
- commit message 是 "fix" / "update" / "wip"
- subagent 越界改了计划外文件
- 报"Build 完成"但留有空壳函数/未实现方法/TODO placeholder（lint+typecheck 通过 ≠ 功能完整）
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
