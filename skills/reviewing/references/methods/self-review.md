# 方法卡：self-review（轻量自查维度集，轻档）

> reviewing 框架方法库 · 评审方法之一。**适合**：轻档 / 低风险产出、提交前自查、brainstorming spec 自审——交付前把高频疏漏点过一遍。**不适合**：需要异源独立性的高风险评审（重档要叠 red-blue / 异源交叉）。
>
> **执行者**：self-review 是**轻档**方法，按 skeleton §4.0「轻档 = 主会话就地」——作者对着产出扫低级疏漏，不派 subagent、不拉 codex。（重档不用本卡，走 checklist + subagent。）
>
> ⚠️ 本质局限：self-review 维度只查**低级疏漏**（placeholder / 矛盾 / 空壳），就地自查独立性 = 无。它的价值是低成本兜底，不是替代异源审查。重档对象**不能只用** self-review。

## 一、维度 / 思路

self-review 是交付前的**轻量自查清单**——不分蓝红、不拉 codex，对着产出过一遍高频自我疏漏点：

| 自查项 | 找什么 |
|---|---|
| **placeholder / TODO 残留** | `TODO`、`FIXME`、`待补`、`xxx`、占位文案、写死的临时值 |
| **内部矛盾** | 前后说法冲突、同一概念两个名字、表格与正文不一致 |
| **歧义 / 模糊** | 「适当」「合理」「尽量」这类无判据词、指代不清 |
| **scope 漂移** | 做的东西还在服务原始目标？有没有顺手加了目标外的内容？ |
| **空壳 / 未兑现** | 标题/章节在但内容空、承诺了 X 没写 X、引用了不存在的文件 |
| **完整性** | 该有的部分齐吗？（按产出类型的固定骨架对照） |

自查项**按产出类型裁剪**——spec 重点查 placeholder/矛盾/歧义/scope（brainstorming 用），代码重点查 TODO/写死值，文档重点查空壳/完整性。

**纪律**：① 自查是**最低门槛**不是充分条件——过了 self-review 只代表没低级疏漏，不代表方案对；② 发现的就地标注或修掉，改不动的显式记为遗留；③ **不要用 self-review 冒充异源 review**——若对象需要异源独立性（重档/代码/设计），self-review 之后必须再走 red-blue / checklist 异源交叉。

## 二、输出契约

产出 `findings[]`（通常轻量），映射 `references/findings-contract.md`：

- 每条 finding：`axis` = 自查项名（`placeholder` / `内部矛盾` / `scope`……）；`kind` = `self-audit`（承载「作者自评」语义，正交于 severity）；`severity` = 多为 warning/suggestion（自查多是疏漏非阻塞，发现真硬伤可标 critical）；`source` = 方法名 `self-review`。
- `kind=self-audit` 对应 findings-contract 的 SA 档（来自 reviewer-discipline Q/SA 定义）——**自查发现不丢「这是轻量自查不是异源确认」的语义**，下游知道这条没经异源验证。
- 多数 self-review 结果可直接就地修复，不必都进正式 findings 表；进表的是「记录但本轮不修」的遗留项。

> **派发 / 档位 / 升档 / CLAIM 剥离 / codex 降级见 skeleton §1、§1a、§4.0–§4.2，本卡不复述。** self-review **只服务轻档**（唯一适用档位 = light），主会话就地执行，独立性 = 无。框架分档判为重档的对象，self-review 只能当前置低成本兜底，后面必须接 `checklist` 全量（仍由主路 subagent 执行）——「self-review 之后没有任何深度审查」且对象是重档 = 漏配。
