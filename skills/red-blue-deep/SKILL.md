---
name: red-blue-deep
description: 评估/拍板类提问的红蓝军辩论框架。Use this skill whenever the user asks evaluative questions like 「X 怎么样 / 行不行 / 合适吗 / 值得吗 / 会不会有问题 / 选 A 还是 B / 哪个方案更好 / 靠谱吗」, "what do you think about X / should we use Y / is X a good idea / which is better", or hesitates between options——even if they don't explicitly ask for a "debate" or "evaluation". 不要用于纯事实查询「X 是什么 / 在哪里」、纯执行「把 X 改成 Y」、纯检索。
---

# 红蓝军辩论

评估/拍板类提问的红蓝军对抗框架。**本 skill 是独立入口**——用户直接问评估/拍板问题（「X 行不行 / 选 A 还是 B / 值得吗」）时直触；也可被任意 workflow skill 直接调用：

<!-- nocode:platform claude -->
调用 `Skill(nocode:red-blue-deep)`。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
调用 `$red-blue-deep`。
<!-- /nocode:platform -->

传入当前 request、stage、restate、artifacts、constraints、计划文件路径和用户 decision（调用方声明的强制档位原样保留）。

**必做**：

<!-- nocode:platform claude -->
调用 `Skill(nocode:reviewing)`。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
调用 `$reviewing`。
<!-- /nocode:platform -->

传入完整方案/选型/决策上下文、调用方决策维度、`red-blue-adversarial` 方法、facts/decisions/rejected alternatives/constraints/non-goals 组成的 Context Capsule，以及 `self / medium / heavy` 深度。默认自查档由主会话做第一性原理 + 红蓝自查，不派 subagent、不调 codex；升档仅用户显式要求或敏感面建议后点头。主产物是 `verdict.recommendation`（倾向 + 关键缓解 + 独立性标注），不被 C/W/S 列表压扁。
