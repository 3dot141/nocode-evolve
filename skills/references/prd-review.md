# prd-review — PRD 评审

**评审对象**: pd-prd 的 `.prd.md` 产出
**评审模式**: dual-review 双重评判 + 总结（异源双评，无防守方——两路中立挑错后合并）

## 引入框架

本细则套用 `reviewing` 框架，只保留 PRD 领域维度，流程/分级/独立交叉/收口全部走框架：

1. **Read `{NOCODE_SKILL_REF}/reviewing/skeleton.md`** —— 套通用流程骨架（分档 → 对象界定 → 评审维度 → 选方法 → 独立交叉 → findings 分级 → 收口拍板）。
2. **Read `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`** —— 套 findings 统一契约（finding/verdict schema + 5→3 分级映射 + Evidence Gate）。

**对象定位**：PRD 文档 → 命中骨架方法选择表「需求 / PRD / restate」行 → 默认方法 `checklist`（下方 8 维度）+ `dual-review`（异源双评 + 总结），独立性=异源。

**档位**（skeleton §1 自动判，拿不准默认轻档）：PRD 含架构性产品决策 / 跨多领域路径 / 不可逆承诺（对外接口、计费、数据模型）→ **重档**（完整 7 步含独立交叉）；小改（增补单条 US / 文案澄清 / 局部路径修订）→ **轻档**（主路 checklist 自审，跳过独立交叉）。用户显式要求深审 → 重档。

**独立交叉**（骨架步骤 5，重档必走）：Claude 主路（当前会话 checklist 遍历，不外派）、Codex 独立路（隔离执行），经 `rule-codex-review` 单一通道派发。**CLAIM 剥离 + Context Capsule**——只传 PRD 原文 + 维度表 + 中立事实包（已拍板决策 / 被否决方案及原因 / 非目标），不传主路结论。Codex 调用报错 → fallback 改派 general-purpose subagent 独立路单跑（标注降级、独立性"同模型"），不自演、不走过场。

**收口**（骨架步骤 7）：findings 按契约归一到 C/W/S，**Critical 必须修复**再让用户确认。修完 findings 的重跑判据走 skeleton §4.6（delta review，纯修复不重跑独立路）。

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
