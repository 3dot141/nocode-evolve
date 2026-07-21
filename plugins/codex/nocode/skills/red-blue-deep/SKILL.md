---
name: red-blue-deep
description: "评估/拍板类提问的红蓝军辩论框架。Use this skill whenever the user asks evaluative questions like 「X 怎么样 / 行不行 /…"
---

# 红蓝军辩论

评估/拍板类提问的红蓝军对抗框架。**本 skill 是独立入口**——用户直接问评估/拍板问题（「X 行不行 / 选 A 还是 B / 值得吗」）时直触；也可被任意 workflow skill 经 `Capability(workflow.skill.invoke, {"skill":"red-blue-deep","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` 调起（调用方如声明强制档位则原样透传给引擎，协议随方法细则单源在引擎内）。

**必做**：`Capability(workflow.skill.invoke, {"skill":"reviewing","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"red-blue-deep","restate":"<confirmed-restate-or-omit>","artifacts":["<complete-options-and-decision-context>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"},"payload":{"object":{"type":"decision","ref":"<complete-options-and-decision-context>"},"dimensions":["<caller-decision-axes>"],"method":"red-blue-adversarial","contextCapsule":{"facts":["<verified-fact>"],"decisions":["<confirmed-decision>"],"rejectedAlternatives":["<alternative-and-reason>"],"constraints":["<constraint>"],"nonGoals":["<non-goal>"]},"depth":"<self|medium|heavy>"}}})`，声明：**对象** = 方案 / 选型 / 决策；**方法** = red-blue-adversarial；**档位** = 自查（默认）/ 中档 / 重档（档位判定是该方法第一步，判据单源在引擎；**默认自查档**——主会话第一性原理 + 红蓝自查，不派 subagent、不调 codex；升档仅用户显式要求或敏感面建议后点头）。引擎按红蓝对抗整套流程执行、产出 findings + verdict——red-blue 的主产物是 `verdict.recommendation`（倾向 + 关键缓解 + 独立性标注），不被 C/W/S 列表压扁。流程 / 派发 / 分级全由引擎承载。

