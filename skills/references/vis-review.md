# vis-review — 交互视觉设计评审

**评审对象**: pd-ix 的 `.ix.md` + pd-vd 的 `.vd.md` 产出
**评审模式**: dual-review 双重评判 + 总结（异源双评，无防守方——两路中立挑错后合并）
**调用方**: pd-vd Step 5e（视觉验证的独立交叉审）

## 引入框架

本细则套用 `reviewing` 框架，只保留视觉领域维度，流程/分级/独立交叉/收口全部走框架：

1. **Read `{NOCODE_SKILL_REF}/reviewing/skeleton.md`** —— 套通用流程骨架（分档 → 对象界定 → 评审维度 → 选方法 → 独立交叉 → findings 分级 → 收口拍板）。
2. **Read `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`** —— 套 findings 统一契约（finding/verdict schema + 5→3 分级映射 + Evidence Gate）。

**对象定位**：设计文档（`.ix.md` / `.vd.md`）→ 命中骨架方法选择表「设计文档」行 → 默认方法 `checklist`（下方视觉 9 维度）+ `dual-review`（异源双评 + 总结），独立性=异源。

**档位**（skeleton §1 自动判，拿不准默认轻档）：高保真 / 完整实现、跨页设计系统、涉及支付·权限·关键业务路径 → 命中「跨模块 / 不可逆」走**重档**（完整 7 步含独立交叉）；低保真线框、单页局部调整 → **轻档**（主路 checklist 自审，跳过独立交叉）。用户显式要求深审 → 重档。

**独立交叉**（骨架步骤 5，重档必走）：Claude 主路（当前会话 checklist 遍历，不外派）、Codex 独立路（隔离执行），经 `rule-codex-review` 单一通道派发。**CLAIM 剥离 + Context Capsule**——只传 `.ix.md` / `.vd.md` 原文 + 维度表 + 中立事实包（已拍板决策 / 被否决方案及原因 / 非目标），不传主路结论。Codex 调用报错 → fallback 改派 general-purpose subagent 独立路单跑（标注降级、独立性"同模型"），不自演、不走过场。

**收口**（骨架步骤 7）：findings 按契约归一到 C/W/S，**Critical 必须修复**再交付。

## 审查维度（框架第 3 步注入点 · 视觉 9 维度）

| 维度 | 检查什么 |
|---|---|
| 竞品参考充分度 | 竞品探索做了吗？文字说明/HTML/截图三块有吗？不是凭空画的？ |
| PRD 路径覆盖 | 每条使用路径都有对应的交互流吗？系统路径的用户可见反馈设计了吗？ |
| 状态完整性 | 每个关键页的 empty/loading/error 都设计了吗？不是只画了正常态？ |
| 信息层级 | 每屏最重要的东西最突出？视觉层级清楚？ |
| 一致性 | 同类元素处理一致？导航/按钮/交互模式统一？ |
| 交互流连贯 | 从入口到完成目标的路径顺畅吗？死胡同？回退方式？ |
| 可行性 | 这个设计开发能实现？没有依赖不存在的能力？ |
| 方向发散 | 给了 2-3 个视觉方向吗？不是赌单一方向？ |
| 简化检查 | 有没有过度设计？能不能用更简单的交互达到同样效果？信息密度合适吗？ |

维度 = finding 的 `axis`。每条 finding 套 findings-contract 的 schema（`id`/`severity`/`kind`/`axis`/`location`/`evidence`/`finding`/`fix`/`source`），顶上加 verdict。`location` 用 `.ix.md` / `.vd.md` 的章节锚点或原型 file:line。

示例：

```
| id | axis | severity | finding | fix | source |
|---|---|---|---|---|---|
| C1 | 状态完整性 | critical | 支付页缺 error 态 | 补支付失败/超时状态 | 独立路(Codex) |
| S1 | 简化检查 | suggestion | 设置页层级过深(3层) | 合并到 2 层 | 主路 |
```
