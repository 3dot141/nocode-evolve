---
name: skill-writing
description: Use when creating, restructuring, simplifying, testing, or optimizing a reusable Skill or its trigger description. Not for one-off task instructions, repository rules, commands, or ordinary documentation.
---

# Skill Writing

需要隔离 baseline 时使用原生 `Agent`，保存句柄并等待终态；平台未明确报告不同模型时，标记“未证明跨模型”。


把模糊的 skill 诉求，先聊成清晰骨架，再逐块填成一个想清楚了的 skill；重型验证（baseline / eval / 打包）按需取用。

**核心原则**：需求没聊清、骨架没浮现，不许动手写。一个解错问题的 skill，写得再漂亮也是负资产。

## 一把尺（贯穿全程）

每加一块内容（步骤 / gate / 表格 / 约束）问一句：

> **删了它，agent 会退回哪个「具体的、可观察的」坏行为？**

- 答得出 → 加（必要时降载体：gate → checklist + 一条 why）
- 答不出 → 别加（那是仪式复杂度）

**Iron Law 是这把尺的实证版**：拿不准答案时不许猜——跑 baseline 去*观察*那个坏行为（`references/baseline.md`）。行为纪律型内容必须实测答尺；轻量事实型内容可以推理答尺。

需要隔离 baseline 时，按上方平台语法派发一个只读 agent。objective 必须包含完整场景 prompt、与主路相同的输入、失败判据和输出格式，并明确不加载待测 skill。只消费 agent 的终态结果；只有平台明确证明使用不同模型时才称“跨模型 baseline”，否则标记“同模型隔离，未证明跨模型”。

## Entry Routing

| 信号 | 入口 |
|---|---|
| 模糊诉求 / 新建 skill / 简化现有 skill | 阶段一起步 |
| 骨架已清晰（要什么已确认） | 直接进阶段二 |
| 只优化 description / 只跑 eval / 只打包 | 直取对应 reference 单步 |

## 两拍 + 一关卡

```
输入：模糊诉求
  │
 ① 对齐 ── 反复讨论，直到骨架清晰 ────────┐
  │        骨架 = 解决什么问题 + 主干结构   │
  ├──────────★ 关卡：骨架确认 ─────────────┘
  │
 ② 完善 ── 拿骨架，一块一块填 ────────────┐
  │        每块：写 → 证必要 → 验证         │
  │        小步 · 可停 · 可回头改骨架       │
  └────────────────────────────────────────┘
  │
输出：想清楚了的 skill
```

### 阶段一 · 对齐

反复讨论，直到骨架清晰。骨架 = 解决什么问题 + 主干结构。

- 先问值不值得做：一次性方案 / 通用常识 / 项目私有约定（进 CLAUDE.md）/ 可用正则硬约束的——都不做 skill
- 不限步数，聊透为止；手段按需：对标外部实现 / 红蓝军对撞 / 真实样本
- 包外部工具/CLI 的 skill → 先过 `absorbed/target-analysis.md`（拿真实目标分析能力面，不凭记忆编）
- ⚠ 别急着上重型工具——先把问题 REFRAME 清楚

★ 关卡：用户点头「骨架对了」，才进阶段二。

### 阶段二 · 完善

拿骨架，一块一块填。每块走「写 → 证必要 → 验证」：

- **写**：按类型选写法（纪律型反合理化 / 其它讲清 why），见 `references/writing-styles.md`
- **证必要**：过那把尺；行为纪律型 → baseline 实测（`references/baseline.md`）
- **验证**：改动大 / 关键 skill → eval 定量（`references/eval.md`）；轻改 → 自审即可（自审清单在 `references/writing-styles.md` 尾部）

需要隔离 baseline 时，把 reference 里选定场景组成一个自足 objective：`Run this complete baseline scenario without loading the skill; return structured observations and failed criteria: <scenario-prompt-input-failure-criteria-output-format>`。按上方平台语法派发并等待终态，只消费终态正文。不得直接启动平台 CLI；派发确认不是结果。

写作硬约束（始终生效）：

- description 只写触发条件，不概括工作流（概括会让 agent 跳过正文照 description 干活——实测教训）
- SKILL.md 只放 agent 执行所需；给人看的（署名 / changelog / 设计缘由）进 README.md
- 自己的 references/ 用相对路径；他 skill 领域的内容用 `Skill()` handoff，不直指其内部文件

收尾：description 触发优化（`references/description.md`）→ 需要分发则打包（`references/packaging.md`）。

## Red Flags — STOP

| 想法 | 现实 |
|---|---|
| "需求大概懂了，直接写" | 没浮现骨架就写 = 解错问题。回阶段一。 |
| "多加个 gate/step 更稳" | 答不出"防哪个真失败"就是仪式。删。 |
| "太简单不用 baseline" | 拿不准 = 答不出尺 = 去实测。15 分钟省几小时。 |
| "一次大改修到位" | 有界小步（一轮 ≤3 处），可回滚。 |
| "先上红蓝军/eval 重型流程" | 先 REFRAME。工具是手段，不是开场。 |
