# define-review — 需求定义评审

**评审对象**: dev-define 的 restate 产出
**评审模式**: red-blue 双模型交叉审（不是自审）

## 流程

1. **蓝军（Claude）**：按维度表逐项审查 restate，列出通过项 + 疑点
2. **红军（Codex）**：把 restate 原文 + 维度表交给 Codex 独立攻击（`rule-codex-review` 场景）。**CLAIM 剥离**——不传蓝军的审查结论，只传 restate 原文 + "请按这些维度攻击这份需求定义"
3. **合并 findings**：蓝军疑点 + 红军攻击点去重合并，按 Critical / Warning / Suggestion 分级
4. **Critical 必须修复**再放行到下一阶段

Codex 不可用 → 降级为 Claude 自己演红军（显式标注"Codex 不可用，降级自审"），但要用 red-blue-deep 的对抗框架，不是走过场。

## 审查维度

| 维度 | 检查什么 |
|---|---|
| 问题清晰度 | 问题定义有没有歧义？"做什么"和"不做什么"边界清楚吗？ |
| SC 可测性 | 每条 SC 能直接变成测试吗？有没有"更好/更快"这种不可测的描述？关键 SC 有 Given/When/Then 具体例子吗？ |
| 路径完整性 | 使用路径覆盖了所有业务面吗？跨域路径和系统路径有没有遗漏？ |
| SC↔路径绑定 | 每条路径至少一条 SC？有裸路径或裸 SC 吗？ |
| 假设显式化 | 隐含假设摊开了吗？标了 `[ASSUMED]` 的项用户知道吗？ |
| scope 边界 | Out of Scope 明确吗？会不会在 Build 阶段膨胀？ |
| 简化检查 | restate 有没有过度复杂？路径之间有没有重叠可合并？SC 有没有冗余？ |

## findings 格式

```
| # | 维度 | 级别 | 发现 | 建议 | 来源 |
|---|---|---|---|---|---|
| 1 | SC 可测性 | Critical | SC-3 "体验更好" 不可测 | 改为可量化指标 | 红军(Codex) |
| 2 | scope 边界 | Warning | Out of Scope 未提数据迁移 | 补充 | 蓝军 |
```
