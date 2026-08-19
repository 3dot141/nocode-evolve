# Writing Styles — 按类型写 SKILL.md

## Frontmatter 结构

```yaml
---
name: skill-name
description: Use when [具体触发条件] — 不概括工作流
---
```

- **description 只写触发条件，永不概括工作流**。实测教训：description 里带工作流摘要，agent 会照着 description 干活、跳过正文。
- **Overview**：核心原则 1-2 句
- **正文**：只治 baseline 里观察到的失败

## 四类型写法

| 类型 | 例子 | 写作风格 |
|---|---|---|
| **纪律型** | TDD、debugging、verification | 反合理化 |
| **技巧型** | condition-based-waiting、root-cause-tracing | 讲清 why |
| **模式型** | flatten-with-flags、information-hiding | 讲清 why |
| **参考型** | API 文档、命令参考 | 讲清 why |

**纪律型——反合理化写法**：
- baseline 里记录的每个合理化借口，写一条显式反驳
- 建合理化对照表（借口 → 现实）
- 建 red flags 自查清单
- 显式封死每个漏洞（不只陈述规则——点名禁止具体的绕路方式）
- 参考 `../writing-skills/persuasion-principles.md`

**技巧/模式/参考型——讲清 why 写法**：
- 解释为什么重要，不只说做什么
- 用 theory of mind——模型聪明，讲理比硬性 MUST 有效
- 一个出色的例子胜过一堆平庸的

## Workflow skill 判据与模板

**判据**：多步顺序执行 + 顺序敏感或有副作用的操作 → workflow skill，与四类型正交（顺序风险和知识类型是两码事）。例：带阶段合规检查的纪律型、事务性 API 的参考型（finalize_plan → write_files）、有破坏性准备步骤的技巧型。

Workflow skill 的 SKILL.md 必须包含：**Step 0 workflow.plan.create**（所有任务开局建齐，各带 Sub-steps + Gate）、**每步 Enter/Exit Gate**、**Global Exit Gate**。Gate 必须客观可验（yes/no、pass/fail、阈值）——不用主观词。

完整模板与 gate 写法原则见 `../writing-skills/workflow-skill-template.md`。

> 注意先过那把尺：只有顺序风险真实存在时才上 workflow 结构；答不出"删了这个 gate 会退回哪个坏行为"的 gate，降级为 checklist 或删除。

## 通用准则

- SKILL.md ≤500 行；溢出下沉 references/
- 只治 baseline 观察到的失败——不做推测性添加
- **SKILL.md 给 agent，README.md 给人**——署名、changelog、设计缘由、方法论背景进 README.md
- **兜底路径用 ASCII 决策树**，不用并列 bullet。并列 bullet 让 agent 挑轻松的路走；决策树逼它先走首选路径、拿到具体失败才降级：

```
[探测命令]
     │
     ├─ 成功 ──→ 首选路径
     │
     └─ 失败（具体报错）──→ 兜底路径 + 报告原因
```

- **不做弱交叉引用**。只在硬执行依赖时点名其它 skill/command（handoff、必需框架、"Not for X — use Y" 路由）；永不引用其它 skill 的内部结构（Step N、小节标题）当"参考模式"。
- **自闭环边界**：SKILL.md 正文与私有 references/ 只能指向两类东西——其它 Skill（点名 handoff 或 `平台原生 Skill 调用` 调用）和参考材料（自己的 `references/` 或共享 `skills/references/`）。不得直指 `rules/rule-*.md`、`model/agent-*.md`、`hooks/`、他 skill 的非 reference `scripts/`——那是 SessionStart/PreToolUse 自动注入的路由护栏层，skill 运行时没有理由点名。确有依赖 → 把内容摘进自己的 references/，或改成 handoff。
- **引用路径**：自己的 references/ 用相对路径（`references/xxx.md`），不写 `{DSH_NOCODE_ROOT}/skills/<skill-name>/references/xxx.md`——相对路径在 skill 目录搬家时零改动。归属他 skill 领域的材料（如 `reviewing`）→ `平台原生 Skill 调用` 调用，即使知道确切路径也不直指。无单一归属的材料才放共享 `skills/references/`，用 `{DSH_NOCODE_SKILL_REF}/xxx.md` 直引。
- Anthropic 官方最佳实践见 `../writing-skills/anthropic-best-practices.md`

## 自验证步骤的独立评审指引

产出的 skill 若含 **agent 验证自己产出**的步骤（review / verify / check / validate / confirm / assess），该步骤要带评审方法论 + 独立评审指引。所有类型适用。

判定：agent 检查自己刚产出的东西（代码/设计/计划/文档/配置）→ 给该步骤加指引。两层：

**Layer 1 · 结构化评审走 reviewing 引擎**：若是多维评审（多评审维度 + 分档 + findings 分级 + 收尾），引导它调 `平台原生 Skill 调用` 而不是在新 skill 里重造评审流程——该步骤写成：调引擎，传评审对象 + 本 skill 自己的领域评审维度（inline 或指向新 skill 自己的 `references/xxx-review.md`）+ 可选方法。引擎自闭环处理分档、方法选择、升档、findings/verdict 格式——新 skill 永不直读 reviewing 的内部文件、永不硬编码指向它的路径。

**Layer 2 · 谁跑独立交叉**（轻量单点自查跳过 Layer 1 直接选）：
- **评估/决策**（"这方案靠谱吗？"）→ 指向 `平台原生 Skill 调用`
- **产出评审**（"这代码/文档有没有问题？"）→ 先自审，分歧时升级单次 codex 独立评审（经 `平台原生 Skill 调用` 达成）
- **合规检查**（"规矩守没守？"）→ 先自查，拿不准派独立 subagent（无需跨模型）

不需要指引的步骤：纯机械验证（测试/lint/类型检查）、对客观判据的模式匹配。

## 写完后的自审

作者自己过一遍，不派 subagent、不调 codex（同 reviewing 引擎的 self-review 轻量模式）。至少检查：

- 是否治了 baseline 记录的每一个失败？
- 有没有漏洞、缺失边界、可被曲解的指令？
- 残留占位符/TODO、内部矛盾、语义含糊、范围漂移、许诺没兑现、完整性
- 自闭环边界：有没有直指 `rules/*.md`、`model/agent-*.md`、`hooks/`、他 skill 非 reference 文件？自己的 references/ 是不是相对路径？

问题当场修；修不了的显式记录。自审是底线不是天花板——发现真正的关键缺陷、或对象明显高风险时，升级 `平台原生 Skill 调用` 独立评审。
