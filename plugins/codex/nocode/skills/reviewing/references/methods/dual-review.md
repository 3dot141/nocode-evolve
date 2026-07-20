# 方法卡：dual-review（subagent+codex 双审档默认双路合并机制）

> reviewing 框架 · **subagent+codex 双审档默认执行形态**（不是 §3 场景表里可选的方法）。**适用**：工件缺陷发现——设计文档 / PRD / restate / 代码 diff 的「这份东西有什么问题」类评审，命中 skeleton §1 双审档信号时的默认双路跑法。**不适用**：拍板 / 选型 / 「该不该 / 选哪个」类评判（用 `red-blue-adversarial`——那是有防守方的对抗，走它自己独立的轻/重两档，不套本机制）。
>
> 本卡是「主路 + 异源独立路各自**中立**评审、场景内归一收口」这一**执行结构**的单源——四件套细则（define / prd / design / vis-review）与 dev-review 的双审档交叉均指向本卡。**场景内 Verify 的具体三态判定规则（confirmed/plausible/refuted 及其到 severity/kind 的映射）单源在 skeleton §4.7，本卡不重复定义，只引用**，避免同一规则出现两处不完全一致的表述。
>
> **何时启用**：对象命中 skeleton §1 双审档信号，或自审/Codex 单审档执行中命中 §1a 升档信号升到双审档——两个执行位（subagent + codex）**直接同时派发**，不是"先跑主路等结果再决定要不要拉第二路"。

## 与 red-blue-adversarial 的分界（选错卡 = 结构错位）

| | red-blue-adversarial | dual-review（本卡） |
|---|---|---|
| 有没有防守方 | 有——蓝军防守提议、红军攻击 | 没有——两路都中立挑错 |
| 回答的问题 | 「该不该 / 选哪个 / 行不行」 | 「这份工件有什么问题」 |
| 主产物 | `verdict.recommendation`（倾向 + 缓解） | `findings[]`（缺陷清单） |
| 典型对象 | 方案 / 选型 / 架构决策 / 多方案僵持 | 设计文档 / PRD / restate / 代码 diff |

误用症状：文档审里让主路去「防守」文档 = 护短（作者立场污染评审）；拍板题里两路都中立挑错 = 没人做立场论证，结论悬空。

## 一、执行结构（三个位置固定）

1. **主路 = 隔离执行**（执行者 / 派发 / 降级见 skeleton §4.0）：按打包任务里各场景的领域维度表，逐场景 checklist 遍历产 findings。会话内已确立的事实（拍板 / 约束 / 历史）打包成 Context Capsule（§4.1）补给主路，不靠「留在主会话」换上下文。
2. **独立路 = 隔离上下文执行**：默认单路 Codex（经 `rule-codex-review` 单一通道，`spawn_agent()` 包 Bash 执行）；调用报错才 fallback 改派 general-purpose subagent 单跑（标「同模型（降级）」），非并行双跑。传给独立路的内容 = 打包任务原文（评审对象 + 全部场景清单）+ **Context Capsule**（skeleton §4.1：剥结论、留事实）——不传主路 findings / 倾向。
3. **场景内归一 + Verify**：按场景分组，场景内按 `[location, axis]` 去重——交集 = 高置信，直接进 findings；对称差（仅单路命中）→ **不由主会话自己拍板**，走 skeleton §4.7 Verify（confirmed/plausible/refuted 三态判定及其到 severity/kind 的完整映射规则见该节，本卡不复述）。**注意不对称性**：Verify 只能滤掉独立路的误报，补不回它因缺上下文漏掉的发现——所以 Capsule 打包尽量全，胜过事后 Verify。

## 二、输出契约

产出 `findings[] + verdict`，映射 `references/findings-contract.md`：

- `axis` = 细则领域维度名（按场景归属）；`location` / `evidence` 受 Evidence Gate 约束（代码事实类缺 location 降 open-question）
- `source` = `主路` / `独立路(Codex)` / `独立路(subagent, 降级)`；同一 finding 双路命中 → 合并保留全部 source（高置信）；仅单路命中且经 Verify 判 confirmed → 保留原 source 并标注"已过 Verify"
- `verdict.approved` 由未处置 Critical 决定；`recommendation` = 一句收口（如「2 Critical 必修后放行」）

## 三、Delta review（重跑判据 — 防流程税）

同一工件同一轮 review 循环内，**修完 findings 不重跑全量独立路**——主会话逐条核对 fix 落实、追加 Review Log 即可。重跑独立路仅当（任一）：

- **结构性变更**：新增 / 删除章节、方案改向、接口重定义（不是按 findings 修补）
- **用户显式要求**再来一轮完整交叉
- 上一轮独立路是降级单跑（同模型），本轮 Codex 恢复可用且对象足够重

> ❌ 反例：每修 3 条 findings 重跑一次 Codex——分钟级时延 × N 轮 = 流程税，用户开始绕流程。
> ❌ 反例（另一头）：「方案从轮询改成事件驱动」当普通 fix 不重审——独立路从没见过新方案。

## 四、执行三位置（派发见 skeleton）

- **主路** = 隔离执行，按打包任务里各场景的领域维度 checklist 遍历。
- **独立路** = 隔离异源，同样拿到全部场景打包任务。
- **场景内归一 + Verify** = 当前会话按场景分组去重，对称差交给 skeleton §4.7 独立验证者，不自己拍板。

派发方式 / codex 报错 fallback / 降级链 / 独立性档位声明全见 skeleton §4.0、§4.2，Verify 具体机制见 skeleton §4.7，本卡不复述。
