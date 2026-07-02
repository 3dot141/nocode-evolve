# define-review — 需求定义评审（restate 领域细则）

**评审对象**：dev-define 的 restate 产出
**定位**：本细则只提供 restate 的**领域维度**（reviewing 框架 skeleton 第 3 步注入点）。流程骨架（分档 / 对象界定 gate / 独立交叉 / findings 归一分级 / 收口拍板）与 findings 结构全部走框架，不在本文重写。

## 引框架

1. **Read `{NOCODE_SKILL_REF}/reviewing/skeleton.md`** 套通用 7 步流程。restate 属"需求 / PRD / restate"类对象，按 skeleton §3 方法选择表取 **`checklist`（领域维度）+ `dual-review`（异源双评 + 总结）**，独立性 = 异源。
2. **Read `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`** 套 findings 契约（finding schema + 5→3 分级映射 + Evidence Gate + verdict）。

> 流程走框架后，本细则只负责下面这张**7 维度表**——它就是 skeleton 第 3 步的 `domainAxes[]`，每个维度名 = finding 的 `axis`。

## 怎么走（全部引框架，本文不复述细节）

- **分档**（skeleton §1）：restate 评审默认重档（需求定义的偏差不可逆、影响整个下游），走异源交叉。
- **选方法 + 执行**（skeleton §3/步骤 4）：`checklist` 逐项遍历下面 7 维度产 finding（**主路 = 当前会话，不外派**）。
- **独立交叉**（skeleton 步骤 5 + §4.1/§4.2）：`dual-review` 派 **Codex 独立路**经 `rule-codex-review` 单一通道隔离评审——**CLAIM 剥离 + Context Capsule**（只传 restate 原文 + 7 维度清单 + 中立事实包（已拍板决策 / 被否决方案及原因 / 非目标），不传主路已得结论）。Codex 调用报错 → 按框架 §4.2 fallback 改派 general-purpose subagent 单跑，标"同模型（降级）"，不自演。
- **归一分级 + 收口**（skeleton 步骤 6/7）：findings 套 contract schema，按 `[location, axis]` 去重（双路交集 = 高置信），分 Critical / Warning / Suggestion；**Critical 必修**再放行到下一阶段。修完 findings 的重跑判据走 skeleton §4.6（delta review，纯修复不重跑独立路）。

## 领域维度（restate 七维 — 本细则唯一职责）

| 维度 | 检查什么 |
|---|---|
| 问题清晰度 | 问题定义有没有歧义？"做什么"和"不做什么"边界清楚吗？ |
| SC 可测性 | 每条 SC 能直接变成测试吗？有没有"更好/更快"这种不可测的描述？关键 SC 有 Given/When/Then 具体例子吗？ |
| 路径完整性 | 使用路径覆盖了所有业务面吗？跨域路径和系统路径有没有遗漏？ |
| SC↔路径绑定 | 每条路径至少一条 SC？有裸路径或裸 SC 吗？ |
| 假设显式化 | 隐含假设摊开了吗？标了 `[ASSUMED]` 的项用户知道吗？ |
| scope 边界 | Out of Scope 明确吗？会不会在 Build 阶段膨胀？ |
| 简化检查 | restate 有没有过度复杂？路径之间有没有重叠可合并？SC 有没有冗余？ |

> 这 7 维度同时供主路（checklist 遍历）和独立路（Codex 评审的维度清单）使用——独立路拿到的就是这张表 + restate 原文 + Context Capsule，自己独立判断。
