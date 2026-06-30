# 方法卡：self-review（作者自评，轻档）

> reviewing 框架方法库 · 评审方法之一。**适合**：轻档 / 低风险产出、提交前自查、brainstorming spec 自审——作者在交付前自己过一遍。**不适合**：需要独立性的高风险评审（自评天然有盲区，独立性 = 无——重档要叠 red-blue / 异源交叉）。
>
> ⚠️ 本质局限：self-review 是**作者自查**，独立性档位 = **无**（§4.3 选择表标「轻档/低风险 → self-review，独立性=无」）。它的价值是低成本兜底，不是替代独立审查。重档对象**不能只用** self-review。

## 一、维度 / 思路

self-review 是作者交付前的**轻量自查清单**——不分蓝红、不派外援，自己对着产出过一遍高频自我疏漏点：

| 自查项 | 找什么 |
|---|---|
| **placeholder / TODO 残留** | `TODO`、`FIXME`、`待补`、`xxx`、占位文案、写死的临时值 |
| **内部矛盾** | 前后说法冲突、同一概念两个名字、表格与正文不一致 |
| **歧义 / 模糊** | 「适当」「合理」「尽量」这类无判据词、指代不清 |
| **scope 漂移** | 做的东西还在服务原始目标？有没有顺手加了目标外的内容？ |
| **空壳 / 未兑现** | 标题/章节在但内容空、承诺了 X 没写 X、引用了不存在的文件 |
| **完整性** | 该有的部分齐吗？（按产出类型的固定骨架对照） |

自查项**按产出类型裁剪**——spec 重点查 placeholder/矛盾/歧义/scope（brainstorming 用），代码重点查 TODO/写死值，文档重点查空壳/完整性。

**纪律**：① 自查是**最低门槛**不是充分条件——过了 self-review 只代表没低级疏漏，不代表方案对；② 发现的就地标注或修掉，改不动的显式记为遗留；③ **不要用 self-review 冒充独立 review**——若对象需要独立性（重档/代码/设计），self-review 之后必须再走 red-blue / checklist 异源交叉。

## 二、输出契约

产出 `findings[]`（通常轻量），映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- 每条 finding：`axis` = 自查项名（`placeholder` / `内部矛盾` / `scope`……）；`kind` = `self-audit`（承载「作者自评」语义，正交于 severity）；`severity` = 多为 warning/suggestion（自查多是疏漏非阻塞，发现真硬伤可标 critical）；`source` = 方法名 `self-review`。
- `kind=self-audit` 对应 findings-contract 的 SA 档（来自 reviewer-template Q/SA 定义）——**自评发现不丢「这是作者自查不是独立确认」的语义**，下游知道这条没经独立验证。
- 多数 self-review 结果可直接就地修复，不必都进正式 findings 表；进表的是「记录但本轮不修」的遗留项。

## 三、派发策略

| 派 subagent | 调 codex | 档位 | 独立性 |
|---|---|---|---|
| **否** | **否** | 仅 light | **无** |

self-review 定义上是**自评**——不派 subagent、不调 codex、不走异源交叉（那就不是 self-review 了）。

档位约束：**只服务轻档**。框架分档（skeleton 步骤 1）判为重档的对象，self-review 只能作为**前置低成本兜底**，后面必须接独立方法。引入细则若发现「self-review 之后没有任何独立审查」且对象是重档 → 这是漏配，补 red-blue / checklist 异源交叉。
