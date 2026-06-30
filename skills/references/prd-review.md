# prd-review — PRD 评审

**评审对象**: pd-prd 的 `.prd.md` 产出
**评审模式**: red-blue 双模型交叉审

## 引入框架

本细则套用 `reviewing` 框架，只保留 PRD 领域维度，流程/分级/独立交叉/收口全部走框架：

1. **Read `{NOCODE_SKILL_REF}/reviewing/skeleton.md`** —— 套通用流程骨架（分档 → 对象界定 → 评审维度 → 选方法 → 独立交叉 → findings 分级 → 收口拍板）。
2. **Read `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`** —— 套 findings 统一契约（finding/verdict schema + 5→3 分级映射 + Evidence Gate）。

**对象定位**：PRD 文档 → 命中骨架方法选择表「需求 / PRD / restate」行 → 默认方法 `checklist`（下方 8 维度）+ `red-blue-adversarial`（异源交叉），独立性=异源。

**档位**：PRD 是产品方案的真值源、下游 Define/Design 据此展开，属**重档**——走完整 7 步（含独立交叉）。

**独立交叉**（骨架步骤 5，重档必走）：Claude 做蓝军、Codex 做红军，经 `rule-codex-review` 单一通道派发。**CLAIM 剥离**——只传 PRD 原文 + 维度表 + "请按这些维度攻击这份 PRD"，不传蓝军结论。Codex 不可用 → 降级 Claude 自演红军（标注降级、独立性降为"同模型"）+ red-blue-deep 对抗框架，不走过场。

**收口**（骨架步骤 7）：findings 按契约归一到 C/W/S，**Critical 必须修复**再让用户确认。

## 审查维度（框架第 3 步注入点 · PRD 8 维度）

| 维度 | 检查什么 |
|---|---|
| 问题↔故事↔指标对齐 | 问题、用户故事、成功指标三者逻辑链通吗？故事有没有脱离问题自由发挥？ |
| 路径建模完整性 | 业务领域划分合理吗？使用路径覆盖了每条 US？跨域/系统路径有没有遗漏？ |
| 情境锚定 | 核心路径有 Job Story 情境补充吗？是谁在什么情境下触发的？ |
| 约束合理性 | 约束是真正的业务不变量，还是拍脑袋的限制？约束之间有矛盾吗？ |
| 标注完整性 | `[CONFIRMED]` / `[ASSUMED]` / `[TBD]` 标注到位吗？有没有未标注的推断？ |
| 差异化 | 和竞品相比差异化空间清楚吗？切换动力（Push/Anxiety）分析了吗？ |
| 可行性 | AI 能力边界标了吗？投入上限 / appetite 合理吗？ |
| 简化检查 | PRD 有没有过度膨胀？有没有可以砍掉的低价值 US 或路径？核心和边缘分清了吗？ |

维度 = finding 的 `axis`。每条 finding 套 findings-contract 的 schema（`id`/`severity`/`kind`/`axis`/`location`/`evidence`/`finding`/`fix`/`source`），顶上加 verdict。
