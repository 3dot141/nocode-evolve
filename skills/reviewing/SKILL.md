---
name: reviewing
description: 通用 review 引擎，被 `Skill(nocode:reviewing)` 调用。调用方传「评审对象 + 领域维度 + 可选方法」，引擎套通用流程（分档 → 对象界定 → 选方法 → 主路审 → 升档异源 → findings 分级 → 收口）+ 评审方法库（红蓝对抗 / 清单 / 视角分工 / 错误机制 / 自查 / 威胁建模）+ reviewer 纪律 + 统一 findings 契约，产出 findings + verdict。分两条线：缺陷发现（文档 / PRD / diff，问「有什么问题」，走清单 / 双评）、对抗决策（方案 / 选型，问「该不该 / 选哪个」，走红蓝对抗）。各专项 review（dev-review / 四件套 / 嵌入式自审）不再各抄一遍流程，直接调本引擎 + 只描述自己的领域维度。审代码 diff / 方案 / 设计文档 / 安全 / 数据库 / 架构 / 需求都用它。本引擎只统一「怎么审」，领域维度由调用方传入；不是用户直触入口（用户直接要 review 走 dev-review / red-blue-deep，它们内部调本引擎）。
---

# Reviewing — 通用 review 引擎

review 这件事在仓库里被重造了十几遍：每个 review 都重新发明一遍「维度清单 → 主路审 → 异源交叉 → findings → 分级 → 收口」。本引擎把那个反复出现的范式做成**一个自包含、可调用的 skill**——各专项 review 直接 `Skill(nocode:reviewing)` 调它、只描述自己的领域维度，不再各抄一份流程。

> 边界：`reviewing` 是**被调用的 review 引擎**，与 `dev-review`（开发流里的 review 阶段，调本引擎）、`red-blue-deep`（用户直触的对抗评估入口，也调本引擎）区分。引擎自包含——所有实现件在 `references/` 下：执行者 / 档位 / 升档 / 降级单源在 `skeleton.md`；reviewer 纪律 / Evidence Gate / Q-SA 判据单源在 `reviewer-discipline.md`；分级单源在 `findings-contract.md`。调用方不 Read 这些内部文件，只调本 skill。

## 调用契约（怎么用本引擎）

调用方在自己的 review step 里 `Skill(nocode:reviewing)`，并声明以下几项（随调用一起给引擎）：

| 传入 | 必填 | 说明 |
|---|---|---|
| **评审对象** | 是 | 设计文档 / 代码 diff / restate / 方案 / PRD……引擎据此选方法、定独立性档 |
| **领域维度** | 是 | 调用方自己的 axis 列表——内联，或指向调用方自己的 `references/xxx-review.md`（dev-review 五轴 / design-doc-review 7 维 / vis-review 9 维……）。这是 skeleton 第 3 步的 `domainAxes[]` |
| **方法** | 否 | 点名 `checklist` / `red-blue-adversarial` / …；**不指定则引擎按对象自选**（skeleton §3 方法选择表）。也可描述自定义评审思路 |
| **Context Capsule** | 建议 | 已拍板决策 / 硬约束 / 非目标——剥结论留事实（skeleton §4.1），随对象传给隔离 reviewer |

引擎返回 `findings[]` + `verdict`，套 `references/findings-contract.md` 的统一 schema。

> **自定义**：方法和维度都可自定义——调用方传自己领域的维度即可，不必用内置的；方法不点名时引擎自选，也可显式指定或描述一套自定义评审思路。引擎负责「怎么审」，调用方负责「审什么维度」。

## 引擎内部：四层结构

```
① 通用流程骨架（skeleton，7 步）   ② 评审方法库（methods/，method cards）
   1 分档（轻/中/重，起始档）          真方法（§3 按对象选）：
   2 对象界定 + gate                    red-blue-adversarial（对抗·有防守方）
   3 评审维度 ← 调用方传入              checklist / perspective-based (PBR)
   4 主路审（按档位执行）              error-mechanism (HECR) / threat-modeling
   5 升档重跑（仅轻/中档，§1a 触发）   档位默认执行形态（不入 §3，档位直派）：
   6 findings + 分级                    self-review（轻档）/ dual-review（重档双路合并）
   7 收口 / triage                    （+ 4 个领域 method card）

③ 公共能力（框架级横切，方法不各写一遍）        ④ reviewer 纪律（reviewer-discipline）
   主路派发（三档）· CLAIM 剥离 · codex 降级        Iron Law · Evidence Gate ·
   · Doubt Theater 检测 · 分档判定                  Q/SA 定义 · 编号规则

⑤ 统一 findings 契约（findings-contract）{ id, severity, kind, axis, location, evidence, finding, fix, source } + verdict
```

各层沿**变更边界**切开：改一个方法不动骨架；换一个调用方不动方法；纪律 / findings schema 是所有人共享的单源。

## 七步流程（引擎跑这个）

| # | 步骤 | 做什么 |
|---|---|---|
| 1 | **分档** | 轻档 / 中档 / 重档，按评审对象的风险定起始深度（skeleton §1）——只能往上升，不是判死 |
| 2 | **对象界定 + 进入 gate** | 评什么、范围多大、前置条件是否满足 |
| 3 | **评审维度**（调用方传入） | 引擎**不规定**具体维度——用调用方传进来的领域维度 |
| 4 | **主路审（按档位执行）** | 轻档主会话按 self-review 清单自查；中/重档从方法库按「对象类型 + 档位」选 1+ 种方法，按 skeleton §4.0 派执行（重档 subagent + codex 直接双路），带 reviewer-discipline 纪律 |
| 5 | **升档重跑**（仅轻/中档，skeleton §1a） | 执行中命中升档信号（含读到实际内容碰更高档红旗）就升，不是"审完才判断"：换到目标档位重新执行 |
| 6 | **findings 统一 schema + 分级** | 套 findings-contract 结构 + C/W/S 三档 severity + kind（normal / open-question / self-audit） |
| 7 | **收口 / triage / 拍板** | Critical 必修，按 verdict 呈现，交用户拍板 |

> 第 4 步从方法库选打法——红蓝对抗只是**一种**方法，适合方案 / 决策，不适合逐项缺陷核查；逐项核查走 checklist。方法选择表见 skeleton §3；self-review / dual-review 不在此表，是轻档 / 重档的默认执行形态，档位直派不用挑选。

## 引擎文件地图（全在 references/ 下，自包含）

- `references/skeleton.md` — **流程骨架单源**：分档判据表 + 7 步详解 + 方法选择表 + 公共能力 how-to（主路 subagent 派发 / CLAIM 剥离 / codex 经 `rule-codex-review` 派 / Evidence Gate / Doubt Theater / 分档）。
- `references/reviewer-discipline.md` — **reviewer 纪律单源**：Iron Law + Forbidden Language + Evidence Gate 判据 + Q/SA 定义 + 编号规则。派 reviewer 时随对象一起给。
- `references/findings-contract.md` — **findings 契约单源**：finding schema + verdict 层 + 5→3 分级映射表 + 三条关键约束（security High 上提 Critical / Q-SA 作 kind / Evidence Gate）。
- `references/methods/` — **评审方法库**：真方法 5 个（red-blue-adversarial / checklist / perspective-based / error-mechanism / threat-modeling，按 §3 对象选）+ 档位默认执行形态 2 个（self-review 轻档自查 / dual-review 重档双路合并，档位直派不入 §3）+ 领域方法 card（security-method / database-method / code-quality-method / architecture-method）。red-blue 与 dual-review 的分界（有无防守方）见 `methods/dual-review.md`。
