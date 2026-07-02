---
name: reviewing
description: 做 review 的通用方法论底座。各专项 review（dev-review / 四件套 / 嵌入式自审等）引入它，复用一套通用流程（分档→对象界定→评审维度→执行→独立交叉→findings分级→收口）+ 评审方法库（红蓝对抗 / 清单 / 视角分工 / 错误机制 / 自审 / 威胁建模）+ 统一 findings 契约。Use this when you need a methodology base for any kind of review——审代码 diff / 方案 / 设计文档 / 安全 / 数据库 / 架构 / 需求。本 skill 是被引入的框架底座，不是某个具体 review 阶段（具体阶段走 dev-review / pd-vd 等）；它只统一各 review 的「做法」，不取代其领域判断。
---

# Reviewing — 通用 review 框架

review 这件事在仓库里被重造了十几遍：每个 review 都重新发明一遍「维度清单 → 自评 → 独立交叉 → findings → 分级 → 收口」。本框架把那个反复出现的 review 范式抽成**通用流程骨架 + 评审方法库 + 统一 findings 契约**，各专项 review **引入**它即可，不必各抄一份。

> 边界：`reviewing` 是被各专项引入的**方法论底座**，与 `dev-review`（开发流里具体的 review 阶段）、`red-blue-deep`（用户直触的对抗评估入口）区分。本框架**不进 manifest**、不抢触发——它通过被细则 `Read` 来生效。

## 四层结构

```
① 通用流程骨架（7 步）        ② 评审方法库（method cards）
   1 分档                        red-blue-adversarial（对抗·有防守方）
   2 对象界定 + gate             dual-review（双评+总结·无防守方）
   3 评审维度 ← 细则注入点       checklist
   4 执行（从库选方法）          perspective-based (PBR)
   5 独立交叉                    error-mechanism (HECR)
   6 findings + 分级             self-review / threat-modeling
   7 收口 / triage               （+ 4 个领域 method card）

③ 公共能力（框架级横切，不让每个方法各写一遍）
   CLAIM 剥离 · codex 降级 · Evidence Gate · Doubt Theater 检测 · 分档判定

④ 统一 findings 契约 { id, severity, kind, axis, location, evidence, finding, fix, source } + verdict
```

四者沿**变更边界**切开：改一个方法不动骨架；加一个细则不动方法；findings schema 是所有人共享的单源。

## 七步流程（概述）

| # | 步骤 | 做什么 |
|---|---|---|
| 1 | **分档** | 轻档 / 重档，按评审对象的风险定 review 深度（框架公共前置） |
| 2 | **对象界定 + 进入 gate** | 评什么、范围多大、前置条件是否满足 |
| 3 | **评审维度**（细则注入点） | 框架**不规定**具体维度——细则在这里填自己领域的维度清单 |
| 4 | **执行（选方法）** | 从方法库按「对象类型 + 档位」选 1+ 种方法执行 |
| 5 | **独立交叉** | 框架公共能力：CLAIM 剥离 + 派 codex/subagent + 独立性档位声明 |
| 6 | **findings 统一 schema + 分级** | 套统一结构 + C/W/S 三档 severity + kind（normal/open-question/self-audit） |
| 7 | **收口 / triage / 拍板** | Critical 必修，按 verdict 呈现，交用户拍板 |

> 第 3 步是**细则的注入点**：框架给流程，领域维度由引入它的细则提供。第 4 步从方法库选打法——红蓝对抗只是**一种**方法，适合方案/决策，不适合逐项缺陷核查；逐项核查走 checklist。

## 如何引入这个框架（C1：Read 骨架套流程）

细则（如 `dev-review`、四件套 reference、各嵌入式自审 step）在自己的 SKILL.md / reference 里这样接：

1. **Read 骨架** — `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md`，拿到完整的 7 步流程详解 + 分档判据表 + 方法选择表 + 公共能力 how-to。
2. **照判据自己做** — skeleton 是 markdown，不是可执行函数。按里面的判据：分档（步骤 1）→ 对象界定+gate（步骤 2）→ 选方法（步骤 4，查方法选择表）。
3. **填领域维度** — 在步骤 3 注入点填本细则领域的维度清单（dev-review 的五轴、define-review 的 restate 七维等）。
4. **选 method card** — 按 skeleton 的方法选择表，`Read {NOCODE_SKILL_REF}/reviewing/methods/<method>.md` 拿到该方法的维度表 / 输出契约 / 派发策略。
5. **套 findings 契约** — 产出按 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md` 的统一 schema 落，severity 走 C/W/S，Q/SA 走 kind。

> 这是零新机制的引入方式：框架作为 reference 被 `Read`，不需要 manifest 路由、不需要新 hook。另一条引入路径 C2（dispatch template 派 subagent）用于需要独立交叉的重档场景，细节见 skeleton 的公共能力章。

## 框架文件地图

- `{NOCODE_SKILL_REF}/reviewing/skeleton.md` — **流程骨架单源**：分档判据表 + 7 步详解 + 方法选择表 + 公共能力 how-to（CLAIM 剥离 / codex 经 `rule-codex-review` 派 / Evidence Gate / Doubt Theater / 分档）。细则 C1 引入时 Read 它。
- `{NOCODE_SKILL_REF}/reviewing/findings-contract.md` — **findings 统一契约单源**：finding schema + verdict 层 + 5→3 分级映射表 + 三条关键约束（security High 上提 Critical / Q-SA 作 kind / Evidence Gate）。
- `{NOCODE_SKILL_REF}/reviewing/methods/` — **评审方法库**：每个方法一份 card（维度表/思路 + 输出契约 + 派发策略）。基础方法 7 个（red-blue-adversarial / dual-review / checklist / perspective-based / error-mechanism / self-review / threat-modeling）+ 领域方法 card（security-method / database-method / code-quality-method / architecture-method）。red-blue 与 dual-review 的分界（有无防守方）见 `methods/dual-review.md`。
