---
name: reviewing
description: 通用 review 引擎，供其它 skill 传入明确对象、维度、方法与 Context Capsule；审代码 diff、方案、设计文档、安全、数据库、架构和需求。不是用户直触入口，用户 review 走 dev-review 或 red-blue-deep。
---

# Reviewing — 通用 review 引擎

review 这件事在仓库里被重造了十几遍：每个 review 都重新发明一遍「维度清单 → 主路审 → 异源交叉 → findings → 分级 → 收口」。本引擎把那个反复出现的范式做成**一个自包含、可调用的 skill**；各专项 review 按下方调用契约传入自己的领域数据，不再各抄一份流程。

> 边界：`reviewing` 是**被调用的 review 引擎**，与 `dev-review`（开发流里的 review 阶段，调本引擎）、`red-blue-deep`（用户直触的对抗评估入口，也调本引擎）区分。引擎自包含——所有实现件在 `references/` 下：场景/视角/方法三层、执行者 / 档位 / 升档 / 降级 / Verify 单源在 `skeleton.md`；reviewer 纪律 / Evidence Gate / Q-SA 判据单源在 `reviewer-discipline.md`；分级单源在 `findings-contract.md`。调用方不 Read 这些内部文件，只调本 skill。

## 调用契约（怎么用本引擎）

调用方在自己的 review step 里执行：

调用方直接调用 `Skill(nocode:reviewing)`，并提供以下完整输入：

```text
request: 用户当前请求原文
context: stage / restate / artifacts / constraints / plan path / decision
object: type + 稳定的 path、diff range 或原生工具结果引用
dimensions: 调用方拥有的完整审查维度
method: 明确方法或 auto
contextCapsule: facts / decisions / rejected alternatives / constraints / non-goals
depth: self / independent / auto
```

`payload` 不是旁边 prose 的提示，而是实际传给引擎的数据；以下各项必须在 JSON 中物化：

| 传入 | 必填 | 说明 |
|---|---|---|
| **评审对象** | 是 | 设计文档 / 代码 diff / restate / 方案 / PRD……引擎据此识别场景、定独立性档 |
| **领域维度** | 是 | 调用方自己的 axis 列表——内联，或指向调用方自己的 `references/xxx-review.md`（dev-review 五轴 / design-doc-review 8 维 / vis-review 9 维……）。这是骨架场景识别步骤的输入，也可在此显式声明额外场景/视角（复用本参数，不新增字段，见 skeleton §2 步骤 1、§3） |
| **方法** | 否 | 点名 `checklist` / `red-blue-adversarial` / …；**不指定则引擎按场景表自选**（skeleton §3 场景表）。也可描述自定义评审思路 |
| **Context Capsule** | 建议 | 已拍板决策 / 硬约束 / 非目标——剥结论留事实（skeleton §4.1），随对象传给隔离 reviewer |

引擎返回 `findings[]` + `verdict`（若命中决策类场景，另有独立的 `verdict.recommendation` 并列返回），套 `references/findings-contract.md` 的统一 schema。**本次调用契约不变**——参数个数和名称与此前完全一致。

> **自定义**：方法和维度都可自定义——调用方传自己领域的维度即可，不必用内置的；方法不点名时引擎自选，也可显式指定或描述一套自定义评审思路。引擎负责「怎么审」，调用方负责「审什么维度」。

## 引擎内部：四层结构

```
① 通用流程骨架（skeleton）                      ② 评审方法库（methods/，method cards）
   0 对象界定 + gate（前置）                        真方法（§3 场景内视角选）：
   1 场景识别 ← 调用方领域维度 + 项目本地扩展            red-blue-adversarial（对抗·有防守方，独立体系）
   2 分档（自审 / Codex单审 / subagent+codex双审）      checklist / perspective-based (PBR)
   3 执行（按档位打包，所有场景喂给执行位）              error-mechanism (HECR) / threat-modeling
   3a 升档重跑（仅自审/Codex单审档，§1a 触发）           regression-check / cross-file-impact（新增）
   4 Verify（场景内独立验证，仅路径≥2时触发）           档位默认执行形态（不入 §3，档位/路径数直派）：
   5 findings + 分级                                    self-review（自审档默认自查）/
   6 收口 / triage                                      dual-review（双审档默认双路合并 + Verify 收口）
                                                       （+ 4 个领域 method card）

③ 公共能力（框架级横切，方法不各写一遍）        ④ reviewer 纪律（reviewer-discipline）
   主路派发（三档=执行位数量）· CLAIM 剥离          Iron Law · Evidence Gate ·
   · codex 降级 · Doubt Theater 检测 · 分档判定      Q/SA 定义 · 编号规则

⑤ 统一 findings 契约（findings-contract）{ id, severity, kind, axis, location, evidence, finding, fix, source } + verdict
```

各层沿**变更边界**切开：改一个方法不动骨架；换一个调用方不动方法；纪律 / findings schema 是所有人共享的单源。

## 流程（引擎跑这个）

| # | 步骤 | 做什么 |
|---|---|---|
| 0 | **对象界定 + 进入 gate**（前置） | 评什么、范围多大、前置条件是否满足 |
| 1 | **场景识别**（调用方领域维度是输入之一） | 按 skeleton §3 场景表 + 调用方声明 + 项目本地扩展，识别命中哪些场景；决策类场景（red-blue 命中）整体摘出，走独立流程 |
| 2 | **分档** | 自审 / Codex 单审 / subagent+codex 双审，按评审对象的风险定起始深度（skeleton §1）——只能往上升，不是判死。**分档决定"每个场景由几个执行位审"，不决定"审几个场景"**（§1 场景由步骤 1 决定） |
| 3 | **执行**（按档位打包） | 步骤 1 识别的全部场景打包成一份任务，喂给步骤 2 定出的执行位（0/1/2 个），执行位内部逐场景顺序过（skeleton §4.0），带 reviewer-discipline 纪律 |
| 3a | **升档重跑**（仅自审/Codex单审档，skeleton §1a） | 执行中命中升档信号（含读到实际内容碰更高档红旗）就升，不是"审完才判断"：换到目标档位重新执行步骤 3 |
| 4 | **Verify**（skeleton §4.7，新增独立步骤） | 仅当某场景内实际路径 ≥ 2 条（双审档的两个执行位各自完整审同一场景）才触发：场景内按 `[location,axis]` 去重，交集=高置信，仅单路命中的候选各起独立第三方验证者判 confirmed/plausible/refuted。PBR 展开的 K 个子视角每个只有 1 条路径，不触发 Verify，检出集按并集处理。**跨场景不验证** |
| 5 | **findings 统一 schema + 分级** | 套 findings-contract 结构 + C/W/S 三档 severity + kind（normal / open-question / self-audit） |
| 6 | **收口 / triage / 拍板** | Critical 必修，按 verdict 呈现（决策类场景的 `recommendation` 并列呈现），交用户拍板 |

> 步骤 3 从方法库选打法——红蓝对抗是**独立于本流程**的决策类方法，命中即在步骤 1 摘出，不进步骤 2-4；逐项缺陷核查走 checklist / error-mechanism 等。场景表（含哪个场景配哪些视角/方法）见 skeleton §3；self-review / dual-review 不在此表，是自审档 / 双审档的默认执行形态，档位直派不用挑选。

## 引擎文件地图（全在 references/ 下，自包含）

- `references/skeleton.md` — **流程骨架单源**：分档判据表（§1/§1a）+ 场景表（§3）+ 流程详解（§2）+ 公共能力 how-to（§4：主路派发 / CLAIM 剥离 / codex 经 `rule-codex-review` 派 / Evidence Gate / Doubt Theater / 分档判定 / Delta review / **Verify §4.7**）。
- `references/reviewer-discipline.md` — **reviewer 纪律单源**：Iron Law + Forbidden Language + Evidence Gate 判据 + Q/SA 定义 + 编号规则。
- `references/findings-contract.md` — **findings 契约单源**：finding schema + verdict 层 + 5→3 分级映射表 + 三条关键约束（security High 上提 Critical / Q-SA 作 kind / Evidence Gate）。
- `references/methods/` — **评审方法库**：真方法 7 个（red-blue-adversarial / checklist / perspective-based / error-mechanism / threat-modeling / regression-check / cross-file-impact，按 §3 场景内视角选）+ 档位默认执行形态 2 个（self-review 自审档自查 / dual-review 双审档双路合并 + Verify 收口，档位直派不入 §3）+ 领域方法 card（security-method / database-method / code-quality-method 正确性+清理两维度 / architecture-method）。red-blue 与 dual-review 的分界（有无防守方）见 `methods/dual-review.md`。
