---
name: codex-review
description: >-
  独立 review 路由规则。仅在 reviewing 引擎或上游流程明确要求独立审查时触发，
  使用当前平台的原生 agent 请求隔离 reviewer，并如实记录实际独立性。
  默认自审、普通代码检查、未获用户授权的升审不触发。
skip: false
---

# 独立 review 路由（兼容名：codex-review）

这个 rule 的历史名字保留为 `codex-review`，但业务层不绑定 Codex CLI 或本地脚本。它只声明需要“独立 review”，并由各平台直接使用自己的原生 agent。

## 触发边界

仅在以下情况触发：

1. `reviewing` 引擎已判定需要独立交叉审查；
2. 用户显式要求“独立审 / 深审 / 找 codex / 红蓝军”；
3. 敏感面升审建议已得到用户确认；
4. 主执行者卡住，上游明确要求隔离 reviewer 做诊断救援。

默认主会话自审、轻档 checklist、普通事实核对不触发。不得因为 rule 名里有 `codex` 就自动启动外部进程。

## 唯一派发契约

先做 CLAIM 剥离：给 reviewer 的 Context Capsule 只包含对象、事实、已确认约束、非目标、证据位置和审查维度；不带作者结论、期望 verdict 或“应该通过”的暗示。

构造一个只读、可独立执行的 objective：

```text
独立审查 <对象>；按 <维度> 输出带证据的 findings 与 verdict；只读，不修改工作树；Context Capsule: <事实与约束>
```

使用原生 `Agent` 派发 reviewer，保存原生句柄并等待终态结果。若平台无法提供独立 agent，则由主会话自审，并明确标注“不具备独立性”。

不得把“已派发”当作审查结果。只有原生工具明确报告 reviewer 使用了不同模型或实现族时，才可声称“跨模型独立审查”；通常的原生 subagent 应表述为“同模型隔离审查”。

约束：

- 一个 review 对象对应一个 agent；需要两条真正独立的审查路时，派发两个互不共享上下文的只读 reviewer，并明确不同视角。
- reviewer 只读；修复由主会话或后续 Build task 完成。
- 不启动 Bash、Codex CLI，不引用 plugin root 或 vendor 路径。
- 原生 agent 不可用时只做一次主会话自审，不重复启动私有实现。

## 回执与独立性

| 实际执行方式 | 对外表述 |
|---|---|
| 原生工具明确报告不同模型/实现族 | “已完成跨模型独立审查” |
| 独立上下文，但未证明模型不同 | “已完成同模型隔离审查；不是跨模型” |
| 主会话自审 | “已降级为主会话自审；不具备独立性” |

agent 失败、超时或被取消时逐条报告；不得包装成“Codex 已审”。

## 四类对象

- 红蓝对抗：`objective` 放入候选方案、反方维度和决策约束；verdict 必须给倾向、关键反证和缓解条件。
- 代码 / diff：放入 diff 范围、验收标准、测试证据和五轴维度；findings 必须带文件位置与可执行修复。
- 设计文档：放入文档全文或稳定路径、已拍板决策、被否决方案及原因、非目标和 design-doc-review 维度。
- 委派救援：放入失败任务、已尝试动作、原始错误和允许修改范围；reviewer 只诊断并给下一步，不直接接管写操作。

所有结果回到 `reviewing` 引擎统一做 Evidence Gate、分级、去重和收口；本 rule 不复制 findings schema。
