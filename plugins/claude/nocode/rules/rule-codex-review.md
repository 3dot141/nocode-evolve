---
name: codex-review
description: >-
  独立 review 路由规则。仅在 reviewing 引擎或上游流程明确要求独立审查时触发，
  通过 workflow capability 请求跨模型优先的隔离 reviewer，并如实记录实际独立性。
  默认自审、普通代码检查、未获用户授权的升审不触发。
skip: false
---

# 独立 review 路由（兼容名：codex-review）

这个 rule 的历史名字保留为 `codex-review`，但业务层不再绑定 Codex CLI、某个本地脚本或特定 agent 工具。它只声明需要“独立 review”；当前平台的 Workflow provider 决定如何实现。

## 触发边界

仅在以下情况触发：

1. `reviewing` 引擎已判定需要独立交叉审查；
2. 用户显式要求“独立审 / 深审 / 找 codex / 红蓝军”；
3. 敏感面升审建议已得到用户确认；
4. 主执行者卡住，上游明确要求隔离 reviewer 做诊断救援。

默认主会话自审、轻档 checklist、普通事实核对不触发。不得因为 rule 名里有 `codex` 就自动启动外部进程。

## 唯一派发契约

先做 CLAIM 剥离：给 reviewer 的 Context Capsule 只包含对象、事实、已确认约束、非目标、证据位置和审查维度；不带作者结论、期望 verdict 或“应该通过”的暗示。

然后提交一个只读 review task：

```text
Capability(workflow.execute, {"tasks":[{"id":"independent-review","objective":"独立审查 <对象>；按 <维度> 输出带证据的 findings 与 verdict；只读，不修改工作树；Context Capsule: <事实与约束>","profile":"review.cross-model-preferred","dependsOn":[],"writeScope":"none","timeoutMs":600000,"continueOnError":false}],"maxParallel":1,"fallbackPolicy":"inline"})
```

保存返回的 `executionId`。若回执 `status=running`，反复执行 `Capability(workflow.wait, {"executionId":"<execution-id>","timeoutMs":600000})`，直到进入 `completed|partial|failed|cancelled` 终态；随后执行 `Capability(workflow.collect, {"executionId":"<execution-id>"})`，只从 collect 回执的 `tasks[].result` 读取 findings/verdict，并读取同一 task 的 `resultRef` 与 `reviewMode` 作为追踪元数据。不得把初始 `running` 回执当审查结果。

约束：

- 一个 review 对象对应一个 task；需要两条真正独立的审查路时，使用两个无依赖、无写范围的 task，并明确不同视角。
- `writeScope` 固定为 `none`，reviewer 只读；修复由主会话或后续 Build task 完成。
- 不在业务 rule 中写平台 agent 调用、Bash、Codex CLI、plugin root 或 vendor 路径。
- provider 失败后的 fallback 只由 `fallbackPolicy` 和 selection receipt 决定；业务层不探活、不重复启动第二套私有实现。

## 回执与独立性

逐项读取 execution receipt 的 `tasks[].reviewMode`：

| `reviewMode` | 含义 | 对外表述 |
|---|---|---|
| `cross-model` | 实际使用了不同模型/实现族 | “已完成跨模型独立审查” |
| `isolated-same-model` | 独立上下文，但模型同源 | “已完成同模型隔离审查；不是跨模型” |
| `inline-self-review` | provider 不可用后由主会话降级自审 | “已降级为主会话自审；不具备独立性” |
| `null` | 非 review task 或 provider 未声明 | 对 review task 视为回执不完整，不得声称独立审查完成 |

`status=failed|partial` 时逐条报告失败；不得把 fallback、超时或无 `reviewMode` 包装成“Codex 已审”。

## 四类对象

- 红蓝对抗：`objective` 放入候选方案、反方维度和决策约束；verdict 必须给倾向、关键反证和缓解条件。
- 代码 / diff：放入 diff 范围、验收标准、测试证据和五轴维度；findings 必须带文件位置与可执行修复。
- 设计文档：放入文档全文或稳定路径、已拍板决策、被否决方案及原因、非目标和 design-doc-review 维度。
- 委派救援：放入失败任务、已尝试动作、原始错误和允许修改范围；reviewer 只诊断并给下一步，不直接接管写操作。

所有结果回到 `reviewing` 引擎统一做 Evidence Gate、分级、去重和收口；本 rule 不复制 findings schema。
