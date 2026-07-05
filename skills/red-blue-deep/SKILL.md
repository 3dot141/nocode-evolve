---
name: red-blue-deep
description: 评估/拍板类提问的红蓝军辩论框架。Use this skill whenever the user asks evaluative questions like 「X 怎么样 / 行不行 / 合适吗 / 值得吗 / 会不会有问题 / 选 A 还是 B / 哪个方案更好 / 靠谱吗」, "what do you think about X / should we use Y / is X a good idea / which is better", or hesitates between options——even if they don't explicitly ask for a "debate" or "evaluation". 不要用于纯事实查询「X 是什么 / 在哪里」、纯执行「把 X 改成 Y」、纯检索。
---

# 红蓝军辩论

评估/拍板类提问的红蓝军对抗框架。**本 skill 是独立入口**——用户直接问评估/拍板问题（「X 行不行 / 选 A 还是 B / 值得吗」）时直触；也可被任意 workflow skill 经 `Skill(nocode:red-blue-deep)` 调起（调用方档位声明见下方协议）。

本 skill 的**方法实现已抽到 reviewing 框架的方法 card，card 是单源**。本壳只保留「档位判定入口 + 调用约定」，不复述方法细则（避免双源漂移）。

## 方法实现走 reviewing 引擎（单源）

红蓝对抗的完整方法——档位判定、light/heavy 两档、sequential-thinking 硬 gate、第一性原理 → 蓝军 → 独立审查 → 结论四步、CLAIM 剥离、独立审查默认单跑 Codex + 报错 fallback、Doubt Theater、三轮收敛、findings/verdict 契约——**单源在 reviewing 引擎的 red-blue-adversarial 方法**。

**必做**：判档后 `Skill(nocode:reviewing)`，声明：**对象** = 方案 / 选型 / 决策；**方法** = red-blue-adversarial；**档位** = light / heavy（见下）。引擎按红蓝对抗整套流程执行、产出 findings + verdict——red-blue 的主产物是 `verdict.recommendation`（倾向 + 关键缓解），不被 C/W/S 列表压扁。流程 / 派发 / 分级全由引擎承载。

## 档位判定入口（先判这一步）

进 card 前先一句话定档，再按 card 执行对应档的完整打法：

- **轻档**：决策可逆 + 影响单文件 + 易回滚（命名、文案、单点小改、风格偏好）→ 走 card 的 **light** 档：一句表态 + 一句关键理由，不派 subagent、不调 codex。
- **重档**：不可逆 / 跨模块 / 涉及选型 / 架构 / 重构 / 多方案僵持 / 用户（或调用方）显式要求「深度评估 / 红蓝军 / 第一性原理 / 强制重档」→ 走 card 的 **heavy** 档：sequential-thinking 硬 gate → 四步。

模糊时默认轻档（拿不准 ≠ 命中重档信号）。**完整判据表 + 边界示例 + 「多方案僵持」定义在 card**，定不准时回 card 对表。

> 调用方强制档位协议：调用方可在调用时声明「强制重档 / 强制轻档」（在哪个环节强制什么档，由各 workflow skill 在自己的调用点声明，本 skill 不维护调用方清单）——声明了就尊重，不擅自改档；改档只认用户显式否定词。未声明 → 按判据自动判档，拿不准默认轻档。

## 调用约定（行为不变保证）

- **入口不变**：`Skill(nocode:red-blue-deep)` 仍是本 skill，frontmatter `name` / `description` 未改——现有调用方的 `Skill()` 调用全部不断。
- **行为不变**：light/heavy 档位判定、sequential-thinking 硬 gate、第一性原理四步——全部经 reviewing 引擎的 red-blue-adversarial 方法落地。独立审查派发（默认单跑 Codex、报错 fallback subagent）由引擎承载。
- **单源不双轨**：方法细则只在 card 维护，本壳不再内嵌，改方法去 card。
