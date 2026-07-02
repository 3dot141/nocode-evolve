---
name: red-blue-deep
description: 评估/拍板类提问的红蓝军辩论框架。先判档位：轻档一句表态、重档完整四步（sequential-thinking 强制 gate → 第一性原理 → 蓝军 → 独立审查 → 结论）。Use this skill whenever the user asks evaluative questions like 「X 怎么样 / 行不行 / 合适吗 / 值得吗 / 会不会有问题 / 选 A 还是 B / 哪个方案更好 / 靠谱吗」, "what do you think about X / should we use Y / is X a good idea / which is better", or hesitates between options——even if they don't explicitly ask for a "debate" or "evaluation". 不要用于纯事实查询「X 是什么 / 在哪里」、纯执行「把 X 改成 Y」、纯检索。
---

# 红蓝军辩论

评估/拍板类提问的红蓝军对抗框架。**本 skill 是独立入口**——用户直接问评估/拍板问题（「X 行不行 / 选 A 还是 B / 值得吗」）时直触；同时被 dev-plan（计划两轮审视）、pd-vd、devflow 经 `Skill(nocode:red-blue-deep)` 调起。

本 skill 的**方法实现已抽到 reviewing 框架的方法 card，card 是单源**。本壳只保留「档位判定入口 + 调用约定」，不复述方法细则（避免双源漂移）。

## 方法实现见 card（单源）

红蓝对抗的完整方法——档位判定表与边界示例、light/heavy 两档、sequential-thinking 硬 gate、第一性原理 → 蓝军 → 独立审查 → 结论四步、CLAIM 剥离、独立审查不预先探活默认单跑 Codex + 调用报错 fallback subagent、Doubt Theater 检测、三轮收敛上限、findings/verdict 输出契约——**单源在方法 card**：

**必做**：`Read {NOCODE_SKILL_REF}/reviewing/methods/red-blue-adversarial.md`，按其执行整套流程。

输出契约（findings schema + verdict 层 + 5→3 分级映射）见 `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md`——red-blue 的主产物是 `verdict.recommendation`（倾向 + 关键缓解），不被 C/W/S 列表压扁。

## 档位判定入口（先判这一步）

进 card 前先一句话定档，再按 card 执行对应档的完整打法：

- **轻档**：决策可逆 + 影响单文件 + 易回滚（命名、文案、单点小改、风格偏好）→ 走 card 的 **light** 档：一句表态 + 一句关键理由，不派 subagent、不调 codex。
- **重档**：不可逆 / 跨模块 / 涉及选型 / 架构 / 重构 / 多方案僵持 / 用户（或调用方）显式要求「深度评估 / 红蓝军 / 第一性原理 / 强制重档」→ 走 card 的 **heavy** 档：sequential-thinking 硬 gate → 四步。

模糊时默认轻档（拿不准 ≠ 命中重档信号）。**完整判据表 + 边界示例 + 「多方案僵持」定义在 card**，定不准时回 card 对表。

> 调用方可强制档位（重 / 轻皆可）：dev-plan Round 1 骨架审视强制**轻档**；plan → build 收尾审视（dev-plan Round 2 窄化审、devflow Plan 阶段覆盖验证）强制**重档**——尊重调用方的强制档，改档只认用户显式否定词。其余调用方（pd-vd / pd-prd / dev-define 等）不强制，按判据自动判档、拿不准默认轻档。

## 调用约定（行为不变保证）

- **入口不变**：`Skill(nocode:red-blue-deep)` 仍是本 skill，frontmatter `name` / `description` 未改——现有调用方（dev-plan 两轮、pd-vd Step、devflow Red-Blue 派发）的 `Skill()` 调用全部不断。
- **行为不变**：light/heavy 档位判定、sequential-thinking 硬 gate、第一性原理四步——全部经 card 落地。独立审查派发已从「subagent + codex 并行双跑」改为「不预先探活，默认单跑 Codex，调用报错才 fallback subagent」（见 card Step 3 / 派发策略）。
- **单源不双轨**：方法细则只在 card 维护，本壳不再内嵌，改方法去 card。
