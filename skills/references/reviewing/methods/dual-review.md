# 方法卡：dual-review（双重评判 + 总结）

> reviewing 框架方法库 · 评审方法之一。**适合**：工件缺陷发现——设计文档 / PRD / restate / 代码 diff 的「这份东西有什么问题」类评审。**不适合**：拍板 / 选型 / 「该不该 / 选哪个」类评判（用 `red-blue-adversarial`——那是有防守方的对抗）。
>
> 本卡是「主路 + 异源独立路各自**中立**评审、主会话合并总结」这一模式的**单源**。四件套细则（define / prd / design / vis-review）与 dev-review 的独立交叉均指向本卡。
>
> **何时启用**：本卡是**升档预案**——各细则默认只跑主路自审（checklist），命中 skeleton §1a 升档判据（自审出无法自行裁决的 finding / 结论有争议 / 用户显式要求深审 / Doubt Theater）才启用本卡派独立路。

## 与 red-blue-adversarial 的分界（选错卡 = 结构错位）

| | red-blue-adversarial | dual-review（本卡） |
|---|---|---|
| 有没有防守方 | 有——蓝军防守提议、红军攻击 | 没有——两路都中立挑错 |
| 回答的问题 | 「该不该 / 选哪个 / 行不行」 | 「这份工件有什么问题」 |
| 主产物 | `verdict.recommendation`（倾向 + 缓解） | `findings[]`（缺陷清单） |
| 典型对象 | 方案 / 选型 / 架构决策 / 多方案僵持 | 设计文档 / PRD / restate / 代码 diff |

误用症状：文档审里让主路去「防守」文档 = 护短（作者立场污染评审）；拍板题里两路都中立挑错 = 没人做立场论证，结论悬空。

## 一、执行结构（三个位置固定）

1. **主路 = 当前会话**（主 agent）：按领域维度表（细则注入的 `domainAxes[]`）checklist 逐项遍历产 findings。**不外派**——主路的价值恰恰在完整会话上下文（拍板 / 约束 / 历史都在会话里），外派 = 上下文残缺的评审。
2. **独立路 = 隔离上下文执行**：默认单路 Codex（经 `rule-codex-review` 单一通道，`Agent()` 包 Bash 执行）；调用报错才 fallback 改派 general-purpose subagent 单跑（标「同模型（降级）」），非并行双跑。传给独立路的内容 = 工件原文 + 同一张维度表 + **Context Capsule**（skeleton §4.1：剥结论、留事实）——不传主路 findings / 倾向。
3. **合并 + 判决 = 当前会话**：按 `[location, axis]` 去重——交集 = 高置信；对称差 = 各自盲区，主会话拿完整上下文逐条判成立性。**注意不对称性**：triage 只能滤掉独立路的误报，补不回它因缺上下文漏掉的发现——所以 Capsule 打包尽量全，胜过事后 triage。

## 二、输出契约

产出 `findings[] + verdict`，映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- `axis` = 细则领域维度名；`location` / `evidence` 受 Evidence Gate 约束（代码事实类缺 location 降 open-question）
- `source` = `主路` / `独立路(Codex)` / `独立路(subagent, 降级)`；同一 finding 双路命中 → 合并保留全部 source（高置信）
- `verdict.approved` 由未处置 Critical 决定；`recommendation` = 一句收口（如「2 Critical 必修后放行」）

## 三、Delta review（重跑判据 — 防流程税）

同一工件同一轮 review 循环内，**修完 findings 不重跑全量独立路**——主会话逐条核对 fix 落实、追加 Review Log 即可。重跑独立路仅当（任一）：

- **结构性变更**：新增 / 删除章节、方案改向、接口重定义（不是按 findings 修补）
- **用户显式要求**再来一轮完整交叉
- 上一轮独立路是降级单跑（同模型），本轮 Codex 恢复可用且对象足够重

> ❌ 反例：每修 3 条 findings 重跑一次 Codex——分钟级时延 × N 轮 = 流程税，用户开始绕流程。
> ❌ 反例（另一头）：「方案从轮询改成事件驱动」当普通 fix 不重审——独立路从没见过新方案。

## 四、派发策略

| 路 | 在哪执行 | 派发 |
|---|---|---|
| 主路 | 当前会话 | 不派发，checklist 直接遍历 |
| 独立路 | 隔离 | 默认 Codex（`rule-codex-review`，文档审稿走场景 4 / 其余对象 task verb）；报错 fallback general-purpose subagent 单跑 |
| 合并判决 | 当前会话 | 不派发 |

**降级链**：Codex 报错 → subagent 单跑（同模型（降级））→ subagent 也不可用（极端）→ 仅主路 + 独立性声明「无」+ 明说。任何降级都在 verdict 里如实标独立性档位。
