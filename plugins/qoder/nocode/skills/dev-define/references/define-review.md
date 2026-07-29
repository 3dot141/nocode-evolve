# define-review — 需求定义评审（restate 领域细则）

**评审对象**：dev-define 的 restate 产出
**定位**：本细则只提供 restate 的**领域维度**（reviewing 框架 skeleton 第 3 步注入点）。流程骨架（分档 / 对象界定 gate / 独立交叉 / findings 归一分级 / 收口拍板）与 findings 结构全部走框架，不在本文重写。

## 怎么用

dev-define 的 define-review step Read 本文拿维度，**默认主会话就地逐维自查**（不调 reviewing 引擎、不派 subagent/Codex），Critical 级问题修复后再交用户确认。用户显式要求升审时才调 `平台原生 Skill 调用`，声明：对象 = restate；方法 = checklist；领域维度 = 下面 7 维度。

**敏感面提醒**：需求含多角色 / 权限 / 计费 / 数据迁移等不可逆面 → 向用户一句话建议升审（7 维度独立全量过），用户点头才调，不自动派发。

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

> 这 7 维度是 finding 的 `axis`，引擎按 checklist 逐项遍历（升档时独立路也用这张表）。
