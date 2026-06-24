---
type: design-doc
topic: three-systems-panorama
date: 2026-06-24
author: 3dot141
status: draft
---

# 三体系全景对标 — GSD · superpowers · agent-skills × devflow

## 背景

nocode-evolve devflow 的工程流水线（Define → Design → Plan → Build → Verify → Review → Land）最初融合了 superpowers（14 skill）和 agent-skills（24 skill）两套体系（见 `rfc-skill-fusion-pipeline.md`）。GSD（Get Shit Done，64k+ stars）是第三个重量级 Claude Code 工作流系统，此前未做过系统对标。

核心问题：三套体系各自沉淀了哪些模式？devflow 当前有哪些盲区可以补？

## 三体系概览

| 维度 | GSD (get-shit-done) | superpowers (obra) | agent-skills (addyosmani) |
|---|---|---|---|
| 规模 | 86 command · 33 agent · 61 reference | 14 skill · 1 agent | 24 skill · 4 agent · 7 reference |
| 阶段数 | 6 (discuss→plan→execute→verify→review→ship) | 隐式 7 (brainstorming→worktree→plan→impl→test→review→finish) | 6 (define→plan→build→verify→review→ship) |
| 编排方式 | 中央 `/gsd-workflow` router + `.planning/` 状态落盘 | 无中央调度，每 skill 末尾硬编码下一个 | 无编排器，用户驱动顺序 slash command |
| token 策略 | 6 namespace 路由(≈120 token) + per-plan fresh 200k context | 1% 即触发全扫 | 用户按需触发 |
| 独有能力 | Nyquist 验证层 · 状态持久化 · wave 并行 | 两段评审(spec→quality) · TDD for skills · 反 rationalization | 6 条非协商行为 · Definition of Done · CLAIM 剥离 · context 预算 |

## 阶段映射矩阵

```
devflow         GSD                    superpowers              agent-skills
────────────    ─────────────────      ──────────────────       ────────────────────
Define          discuss-phase          brainstorming (1-3)      interview-me
                                                                idea-refine
                                                                spec-driven (SPECIFY)
────────────    ─────────────────      ──────────────────       ────────────────────
Env             (隐含在 execute)       using-git-worktrees      git-workflow-and-versioning
────────────    ─────────────────      ──────────────────       ────────────────────
Design          (discuss 含偏好)       brainstorming (4-5)      api-and-interface-design
                spec-phase                                      documentation-and-adrs
────────────    ─────────────────      ──────────────────       ────────────────────
Plan            plan-phase             writing-plans            planning-and-task-breakdown
                + plan-checker                                  spec-driven (PLAN+TASKS)
────────────    ─────────────────      ──────────────────       ────────────────────
Build           execute-phase          subagent-driven-dev      incremental-implementation
                                       executing-plans          test-driven-development
                                       test-driven-dev          source-driven-development
                                                                context-engineering
────────────    ─────────────────      ──────────────────       ────────────────────
Verify          verify-work            verification-before-     debugging-and-error-recovery
                                       completion               browser-testing-with-devtools
────────────    ─────────────────      ──────────────────       ────────────────────
Review          code-review            requesting-code-review   code-review-and-quality
                                       receiving-code-review    code-simplification
                                                                security-and-hardening
                                                                performance-optimization
────────────    ─────────────────      ──────────────────       ────────────────────
Land            ship                   finishing-a-dev-branch   shipping-and-launch
                complete-milestone                              ci-cd-and-automation
                                                                deprecation-and-migration
────────────    ─────────────────      ──────────────────       ────────────────────
横切            debug (科学方法)       systematic-debugging     doubt-driven-development
                ui-phase               dispatching-parallel     context-engineering
                secure-phase                                    observability-and-instrumentation
```

## 维度对比

### 1. 需求澄清 (Define)

| 模式 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| 一次一问 | ✅ interview 模式 | ✅ brainstorming 苏格拉底式 | ✅ interview-me | ✅ dev-define |
| 置信度 + 停止条件 | ❌ | ❌ | ✅ 95% 停止测试 | ✅ 已吸收 |
| want vs should want | ❌ | ❌ | ✅ | ✅ 已吸收 |
| 假设列出 | ✅ assumptions 模式 | ❌ | ✅ 假设+置信度 | ✅ 已吸收 |
| 可量化成功标准 | ❌ | ❌ | ✅ "LCP < 2.5s" | ✅ 已吸收(Quality Bar) |
| 实现偏好收集 | ✅ `CONTEXT.md` | ❌ | ❌ | ❌ **缺失** |

**缺失分析**：GSD 的 discuss-phase 在澄清需求之外还收集"实现偏好"（用什么库、什么风格、什么架构偏好），产出 `CONTEXT.md` 传给后续阶段。devflow 的 Define 只收敛"做什么"不收"怎么做的偏好"——这些偏好目前散在 Design 阶段的用户交互里，没有结构化。

### 2. 计划验证 (Plan)

| 模式 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| plan review 循环 | ❌ | ✅ writing-plans ≤5 轮 | ❌ | ✅ 已吸收 |
| 计划层 gate | ✅ plan-checker 8 维度 | ❌ | ❌ | ❌ **缺失** |
| 需求覆盖检查 | ✅ requirement ID 必须出现 | ❌ | ❌ | ❌ **缺失** |
| Nyquist (测试先行契约) | ✅ 编码前确认秒级反馈存在 | ❌ | ❌ | ❌ **缺失** |
| 垂直切片 | ❌ | ❌ | ✅ "标题含 and 即拆" | ✅ 已吸收 |
| sizing gate | ❌ | ❌ | ✅ XL 必须再拆 | ✅ 已吸收(≤M) |

**缺失分析**：GSD 的 plan-checker 在计划写完、执行开始前做 8 维度验证（需求覆盖/任务完整性/依赖正确性/范围合理性等），这是 devflow Plan 阶段没有的。Nyquist 层更独特——它要求每个实现任务在编码前就有配套的自动化验证命令存在，等于把"测试基础设施"从 Build 阶段前移到 Plan 阶段。

### 3. 状态持久化与续接

| 模式 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| 状态落盘 | ✅ `.planning/` 全目录 | ❌ 靠会话记忆 | ❌ 靠会话记忆 | 部分（设计文档/计划文档落盘，阶段状态靠 TaskCreate） |
| 跨会话续接 | ✅ PreCompact → HANDOFF.json → SessionStart 自动 resume | ❌ | ❌ | ❌ **缺失** |
| compact 保护 | ✅ hook 写 handoff 再 compact | ✅ Define→Design→Plan 不 compact | ✅ <2000 行预算 | ✅ Context Hygiene 节 |

**缺失分析**：GSD 的 `.planning/` + `HANDOFF.json` 实现了跨会话零干预续接——PreCompact hook 自动把当前阶段/任务/状态写入，下次 SessionStart 自动 `/gsd-resume-work`。devflow 的 TaskCreate 只在会话内有效，跨会话需要用户手动告知"上次到哪了"。

### 4. 执行模型 (Build)

| 模式 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| wave 并行 | ✅ 独立任务并行，依赖串行 | ❌ | ❌ | 部分（Plan 标 HITL/AFK，Subagent 并行） |
| per-task fresh context | ✅ 每 plan spawn 200k executor | ✅ 每 task 新 subagent | ❌ | ✅ 已吸收 |
| scope lock | ❌ | ❌ | ✅ "touch only what task requires" | ✅ 已吸收(≤5 文件) |
| TDD iron law | ❌ | ✅ "delete means delete" | ✅ RED→GREEN→REFACTOR | ✅ 已吸收 |
| 原子 commit | ✅ executor 每任务 commit | ✅ 每 slice commit | ✅ 每增量 commit | ✅ 已吸收 |
| deviation handling | ✅ 偏差检测 + 处置协议 | ❌ | ❌ | ❌ **缺失** |

**缺失分析**：GSD 的 executor 在执行偏离计划时有显式的偏差处置协议（记录偏差原因、评估影响、决定继续/回退/修改计划）。devflow 的 Build 在发现计划有问题时只有回流路径（Build → Design → Plan），没有轻量级的"计划内偏差"处置。

### 5. 评审维度 (Review)

| 维度 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| **代码评审** | | | | |
| 正确性 | ✅ | ✅ (code quality) | ✅ | ✅ 五轴 |
| 可读性 | ✅ | ✅ | ✅ | ✅ 五轴 |
| 架构 | ✅ | ✅ (architecture) | ✅ | ✅ 五轴 |
| 安全 | ✅ | ✅ | ✅ OWASP+STRIDE | ✅ 五轴 |
| 性能 | ✅ | ✅ (performance impact) | ✅ N+1/unbounded | ✅ 五轴 |
| **设计评审** | | | | |
| 可行性 | ❌ | ✅ (completeness) | ❌ | ✅ 六轴 |
| 清晰度 | ❌ | ✅ (clarity) | ❌ | ✅ 六轴 |
| 架构合理性 | ❌ | ✅ (architecture) | ❌ | ✅ 六轴(刚加) |
| 安全影响 | ❌ | ❌ | ❌ | ✅ 六轴 |
| 性能 | ❌ | ❌ | ❌ | ✅ 六轴(刚加) |
| 可扩展性 | ❌ | ✅ (scope) | ❌ | ✅ 六轴 |
| **两段评审** | ❌ | ✅ spec→quality 强制顺序 | ❌ | ✅ 双轴(Standards+Spec) |
| **UI 评审** | ✅ 6 支柱 | ❌ | ❌ | ❌ |
| **计划评审** | ✅ 8 维度 | ✅ plan review loop | ❌ | ✅ 用户确认 |
| **交叉评审** | ❌ | ✅ reviewer 不继承会话 | ✅ Multi-Model | ✅ Codex 交叉 |
| **severity** | 3 级 | 3 级 | 5 级前缀 | 5 级(C/W/S/Q/SA) |
| **Structural Remedies** | ❌ | ❌ | ✅ "propose the move" | 部分(finding 含 fix) |

### 6. 反借口 / 纪律执行

| 模式 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| Rationalization Table | ❌ | ✅ 每个纪律 skill 统一格式 | ✅ 统一 Red Flags | ✅ 每 skill 有 |
| Red Flags 自检 | ❌ | ✅ STOP 信号词 | ✅ | ✅ |
| Doubt Theater 检测 | ❌ | ❌ | ✅ "连续 2+ 轮有发现但 0 actionable" | ✅ 已吸收 |
| 非协商行为 | ❌ | ❌ | ✅ 6 条 | ✅ 8 条(扩展版) |
| Persuasion principles | ❌ | ✅ Cialdini 说服原理 | ❌ | ❌ |

### 7. 上下文工程

| 模式 | GSD | superpowers | agent-skills | devflow 现状 |
|---|---|---|---|---|
| context 预算 | ✅ per-plan 200k | ❌ | ✅ <2000 行 | ✅ <2000 行 |
| 何时新会话 | ✅ auto-resume | ❌ | ✅ 显式信号 | ✅ 建议 /distill |
| 加载策略 | ❌ | ❌ | ✅ Brain Dump/Selective/Hierarchical | 部分(Context Hygiene) |
| 状态序列化 | ✅ HANDOFF.json | ❌ | ❌ | ❌ **缺失** |

## 优化建议

基于三体系对标，以下是 devflow 可吸收的模式，按价值/成本排序。

### 高价值 · 低成本

#### O1. Plan Gate — 计划层验证（来源: GSD plan-checker）

**现状**: Plan 阶段用户确认后直接进 Build，计划质量全靠 writing-plans 的格式约束。

**建议**: 在 Plan sub-flow 4f（用户确认）之前插入一步 `4f'. Plan Validation`，检查：
- **需求覆盖**: restate 的每条 Success Criteria 至少被一个 task 覆盖
- **任务完整性**: 每个 task 有验证命令（即 GSD 的 Nyquist 原则的轻量版——不要求 Wave 0 先建测试，但要求 task 声明"怎么验证完成"）
- **依赖一致性**: task 间依赖不成环，底层 task 排前面

可作为 dev-plan skill 内的 self-check 步骤，不需要新 agent。

#### O2. 执行偏差处置（来源: GSD executor deviation handling）

**现状**: Build 阶段发现计划有问题时，回流路径是 Build → Design → Plan，粒度太粗。

**建议**: 在 dev-build 的 slice 循环内加"偏差检测"：
- **小偏差**（实现路径略不同但目标不变）：记录偏差理由，继续
- **中偏差**（task 拆分需调整）：暂停，调整当前 task 的 scope，不回 Plan
- **大偏差**（发现设计有问题）：停手，走回流路径

现有回流路径只覆盖"大偏差"，缺"小偏差"的处置——导致要么硬做要么走完整回退，缺中间档。

### 高价值 · 中成本

#### O3. 实现偏好收集（来源: GSD discuss-phase CONTEXT.md）

**现状**: Define 收敛"做什么"但不收"怎么做的偏好"。用户的技术偏好（用什么库、什么风格）散在 Design 交互里。

**建议**: Define 的 1d. 产出 restate 时，可选追加 "Preferences" 节——用户有明确技术偏好时记录（库 / 风格 / 约束），无偏好则留空。传给 Design 作为方案探索的输入约束，不用硬 gate。

#### O4. 跨会话续接协议（来源: GSD .planning/ + HANDOFF.json）

**现状**: TaskCreate 只在会话内有效。长任务跨会话时，用户需手动告知进度。

**建议**: 设计一个轻量版——不像 GSD 那样做 `.planning/` 全目录，而是在 `/distill` 或 `/compact` 触发时，把当前 devflow 状态（阶段 / task 完成度 / 关键决策 / 分支名）写入 `.agents-personal/` 下的 `devflow-state.md`。下次会话命中 devflow 时先检查这个文件。

### 中价值 · 低成本

#### O5. Definition of Done 横切 checklist（来源: agent-skills）

**现状**: Land 阶段的 Gate 是 "PR merged + 任务流转 + worktree 清理"，偏流程不偏质量。

**建议**: 参考 agent-skills 的 Definition of Done（5 组: Correctness / Quality / Integration / Documentation / Ship-readiness），在 Land 之前加一个轻量 checklist。不是新阶段——是 Review → Land 之间的隐式检查。Ship-readiness 显式含 security + observability + rollback，防止"代码评审过了但没想部署"。

#### O6. severity 前缀细化（来源: agent-skills）

**现状**: findings 分 5 级 (C/W/S/Q/SA)，但 Warning 和 Suggestion 之间缺一个"Nit"级别。

**建议**: 考虑采用 agent-skills 的前缀系统——`Critical:` / 无前缀(=Required) / `Nit:` / `Optional:` / `FYI`——让作者更精确地知道哪些必改。当前 5 级已经够用，这个改动优先级低。

### 值得关注但不急于吸收

#### O7. Nyquist 完整版（来源: GSD）

GSD 的 Nyquist 层要求每个实现任务在编码前就有自动化验证命令存在，包括 Wave 0 先建测试基础设施、反馈延迟评估（>30s 的测试标 WARNING）、采样连续性（3 连续无验证 = BLOCKING）。

这个理念很好，但完整实施成本高（需要 plan-checker agent + VALIDATION.md 文档 + wave 排序逻辑）。O1 的"任务声明验证命令"是它的轻量版本，先做 O1 看效果。

#### O8. UI 评审 6 支柱（来源: GSD）

GSD 有独立的 UI 评审维度（Copywriting / Visuals / Color / Typography / Spacing / Experience Design）。devflow 当前没有 UI 专项评审——代码评审的五轴里 Architecture 能覆盖部分组件结构，但视觉/排版/交互体验不在其中。

如果项目有 UI 重度需求可以考虑。当前 nocode-evolve 是 CLI 插件项目，优先级低。

#### O9. TDD for Skills（来源: superpowers writing-skills）

superpowers 的 writing-skills 用 TDD 方法论写 skill——先用压力场景让 agent 在无 skill 时失败（RED），记录逐字 rationalization，再写 skill 消除（GREEN）。这是一种 skill 质量保证方法论。

nocode-evolve 有 `rule-eval` 跑触发率，但没有对 skill 本身做"agent 会不会绕过它"的压力测试。可以作为 skill-creator 的增强。

## 三体系独特模式速查

| 模式 | 来源 | 一句话 | devflow 状态 |
|---|---|---|---|
| 状态落盘 + 自动续接 | GSD | PreCompact → HANDOFF.json → SessionStart 自动 resume | ❌ 见 O4 |
| Nyquist 验证层 | GSD | 编码前确认秒级反馈存在 | ❌ 见 O1(轻量版) |
| plan-checker 8 维度 | GSD | 执行前 gate 验"计划 WILL 达成 goal" | ❌ 见 O1 |
| 执行偏差处置 | GSD | 小/中/大偏差分级处置 | ❌ 见 O2 |
| wave 化并行执行 | GSD | 独立任务并行 + 依赖串行 | 部分(Subagent 并行) |
| 6 namespace 路由 | GSD | 86 command 压成 6 router (≈120 token) | ✅ 类似(catalog 粗桶) |
| 两段评审强制顺序 | superpowers | spec 合规 → 代码质量，第一段没过禁进第二段 | ✅ 双轴(Standards+Spec) |
| reviewer 不继承会话 | superpowers | "precisely crafted context, never your session's history" | ✅ Codex 交叉 |
| TDD for skills | superpowers | 写 skill 前先让 agent 在无 skill 时失败 | ❌ 见 O9 |
| Rationalization + Cialdini | superpowers | 借口表 + 说服心理学原理封堵绕过 | 部分(有借口表) |
| 模型分级派活 | superpowers | 按复杂度选模型(便宜→标准→最强) | ❌ |
| 6 条非协商行为 | agent-skills | Surface Assumptions / STOP / Push Back / Simplicity / Scope / Verify | ✅ 扩展为 8 条 |
| Definition of Done | agent-skills | 5 组横切收尾 checklist | ❌ 见 O5 |
| CLAIM 剥离 | agent-skills | 对抗 review 只传 ARTIFACT+CONTRACT 不传 CLAIM | ✅ Codex 场景 |
| Doubt Theater 检测 | agent-skills | 连续 2+ 轮有发现但 0 actionable = 在验证不在质疑 | ✅ 已吸收 |
| context 预算 + 新会话信号 | agent-skills | <2000 行 + 显式切换信号 | ✅ 已吸收 |
| severity 前缀系统 | agent-skills | Critical/Required/Nit/Optional/FYI | 部分(5级 C/W/S/Q/SA) |
| Structural Remedies | agent-skills | review 不只指问题，要给具体重构动作 | 部分(finding 含 fix) |
| 可量化 spec | agent-skills | "Make dashboard faster" → "LCP < 2.5s on 4G" | ✅ Quality Bar |
| 反编排立场 | agent-skills | 拒绝 router persona / persona-calls-persona | ✅ devflow 不替执行 |

## 优化优先级排序

```
                高价值
                  │
    O1 Plan Gate ─┤─── O4 跨会话续接
    O2 偏差处置  ─┤─── O3 偏好收集
                  │
                低成本 ──────────────── 高成本
                  │
    O5 DoD 横切  ─┤─── O7 Nyquist 完整版
    O6 severity  ─┤─── O8 UI 评审
                  │─── O9 TDD for Skills
                低价值
```

建议路径：O1 → O2 → O5 → O3 → O4 → 其余按需。
