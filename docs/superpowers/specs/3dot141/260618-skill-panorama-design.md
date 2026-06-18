# Skill 全景设计文档 — 边界·预期·优化目标

> **doc-type**: Design Doc
> **状态**: draft
> **日期**: 260618
> **来源**: superpowers (14) + mattpocock/skills (33) + agent-skills (24) + SkillOpt 方法论

## 背景

深读 4 套来源共 71 个 skill + SkillOpt 优化方法论后，本文档为 nocode-evolve 每个 skill 定义：边界（做什么/不做什么）、对标来源、差距分析、优化目标。作为后续 SkillOpt 循环的 spec。

## 跨 skill 设计原则（从 4 套来源提炼）

### P1: Description 只写触发条件，不概括流程

superpowers writing-skills 实测证明：description 里概括 workflow 会让 agent 照 description 走捷径跳过正文。全套 skill 的 description 都只写「何时用」。

**现状差距**：我们的 description 混合了触发条件 + 流程概括（如 design 的 "explores approaches via brainstorming, selects solution, then delegates to design-doc-writing"）。

### P2: Leading Word 锚定行为

mattpocock 核心方法论：用一个模型预训练中已存在的词（`tracer bullet` / `tight loop` / `grill` / `fog of war`）锚定整片行为，最少 token 换最强行为钩子。

**现状差距**：我们的 skill 缺少 leading word。每个 skill 应该有一个核心锚词。

### P3: 统一收尾三件套

agent-skills 24 个 skill 几乎全部以 Common Rationalizations + Red Flags + Verification 结尾。这是经过大规模验证的有效骨架。

**现状差距**：我们合并后部分 skill 的反模式表不够完整。

### P4: 硬门前置

superpowers 所有纪律类 skill 的 Iron Law / HARD-GATE 都在文档极靠前位置，且配一段「堵死所有 workaround」。

**现状差距**：我们的硬约束分散在各 Step 中，没有集中前置。

### P5: 原子 skill + 薄包装组合

mattpocock 的 `grilling`（9 行）被 5 个 skill 复用。同一核心通过薄包装暴露不同 leading word。

**现状差距**：我们每个 skill 自包含，没有可复用的原子 skill 层。

### P6: 完成判据可机检

mattpocock diagnosing-bugs「没有已运行过、能变红的命令就禁止进 Phase 2」、scaffold-exercises 用 lint 当判据、edit-article 用 240 字符硬门。

**现状差距**：我们的完成判据部分是「用户确认」（可检），部分是「置信度 ≥ 95%」（不可机检）。

### P7: SkillOpt 验证门

每次改动都过 held-out gate，没有可度量改进就不接受。我们的 rule-eval 可以充当 gate。

---

## 各 Skill 全景

### 1. Define

| 维度 | 内容 |
|---|---|
| **边界** | 从模糊任务到明确问题边界。只回答"做什么 + 为什么 + 怎么算成了"。不选解法。 |
| **Leading Word** | `restate`（产出物即锚词）|
| **对标来源** | superpowers `brainstorming` Step 3 (clarify) + agent-skills `interview-me` + `spec-driven-development` + mattpocock `grill-me`/`grilling` |
| **已吸收** | interview-me 一问一答+猜测+置信度、spec-driven 可量化成功标准+Boundaries、AskUserQuestion、代码自答(grill-me) |
| **差距** | ① description 含流程概括 ② 缺 Iron Law 前置 ③ 反模式表可以更精炼 |
| **优化目标** | description 只写触发条件；加 Iron Law「问题没定义清就动手 = 赌」前置；leading word = `restate` |

### 2. Design

| 维度 | 内容 |
|---|---|
| **边界** | 从确认的问题定义到具体解法。brainstorming 发散解法空间。产出方案 + 测试目标 + 设计文档。 |
| **Leading Word** | `approach`（方案探索即锚词）|
| **对标来源** | superpowers `brainstorming` Step 4-5 + mattpocock `prototype`/`design-it-twice`/`grill-with-docs`/`improve-codebase-architecture` + agent-skills `api-and-interface-design`/`doubt-driven-development` |
| **已吸收** | design-it-twice 差异化方案、grill-with-docs 对齐已有决策、prototype Step 3.5、五轴 review、STRIDE、source-driven |
| **差距** | ① description 含流程概括 ② 缺 Iron Law ③ 缺 leading word ④ prototype 分支可更具体（logic vs UI 两种模式） |
| **优化目标** | description 只写触发条件；Iron Law「方案未对比的设计是假设不是设计」；leading word = `approach`；prototype 细化 logic/UI 两分支 |

### 3. Plan

| 维度 | 内容 |
|---|---|
| **边界** | 把确认的目标拆成可执行的任务序列。每步贴真实代码，禁占位符。 |
| **Leading Word** | `tracer bullet`（垂直切片即锚词，与 mattpocock tdd + to-issues 共享）|
| **对标来源** | superpowers `writing-plans` + agent-skills `planning-and-task-breakdown` + mattpocock `to-issues`/`to-prd` |
| **已吸收** | writing-plans 硬约束（贴代码/禁占位符）、垂直切片/sizing/checkpoint、HITL/AFK、Plan Header、Execution Handoff |
| **差距** | ① description 含流程概括 ② leading word `tracer bullet` 未显式用 ③ 可加 mattpocock to-issues 的「issue body 避免文件路径」原则 |
| **优化目标** | description 只写触发条件；显式引入 `tracer bullet` leading word；task 描述 durable 化（避免硬编码行号） |

### 4. Build

| 维度 | 内容 |
|---|---|
| **边界** | 按计划增量实现，每个 slice 闭环（失败测试 → 最小实现 → 绿 → commit）。 |
| **Leading Word** | `red-green`（TDD 循环即锚词）|
| **对标来源** | superpowers `test-driven-development`/`executing-plans`/`subagent-driven-development` + agent-skills `incremental-implementation`/`test-driven-development`/`source-driven-development` + mattpocock `tdd`(含 6 子 skill)/`implement`/`diagnosing-bugs` |
| **已吸收** | Iron Law (test-first)、slice 循环、source-driven 标注、Debug 横切假设排序、HITL/AFK |
| **差距** | ① description 含流程概括 ② mattpocock tdd 的「horizontal slicing 头号反模式」可显式化 ③ mattpocock `NOTICED BUT NOT TOUCHING` 模式比我们的「记下来」更结构化 ④ 缺 agent-skills 的 `DAMP over DRY` 测试原则 |
| **优化目标** | description 只写触发条件；显式列 horizontal slicing 为头号反模式；`NOTICED BUT NOT TOUCHING` 结构化；leading word = `red-green` |

### 5. Verify

| 维度 | 内容 |
|---|---|
| **边界** | 证明功能真的能用。无新鲜证据不得宣称完成。 |
| **Leading Word** | `evidence`（证据即锚词）|
| **对标来源** | superpowers `verification-before-completion` + agent-skills `browser-testing-with-devtools` |
| **已吸收** | Iron Law (无证据不宣称完成)、Gate Function、证据三元组、E2E/Browser/Performance |
| **差距** | ① description 含流程概括 ② superpowers 原版把「未验证就宣称完成」定性为 dishonesty——我们的语气偏弱 ③ 缺 agent-skills browser-testing 的 prompt-injection 安全边界 |
| **优化目标** | description 只写触发条件；强化 dishonesty 框架；补 browser-testing 安全边界；leading word = `evidence` |

### 6. Code-Review

| 维度 | 内容 |
|---|---|
| **边界** | 五轴代码评审 + 简化 + 安全 + 统一 findings 分级。Critical 不可 override。 |
| **Leading Word** | `findings`（统一 schema 即锚词）|
| **对标来源** | superpowers `requesting-code-review`/`receiving-code-review` + agent-skills `code-review-and-quality`/`code-simplification`/`security-and-hardening`/`performance-optimization` + mattpocock `review`(in-progress) |
| **已吸收** | 五轴、severity 分级前缀、Chesterton's Fence、codex 交叉评、禁语表、push-back、dependency 5 问 |
| **差距** | ① description 含流程概括 ② mattpocock review 的「双轴正交（Standards vs Spec）显式不合并」是个好模式 ③ 缺 agent-skills 的「先读测试再读实现」原则 |
| **优化目标** | description 只写触发条件；补「先读测试」原则；考虑 Standards/Spec 双轴；leading word = `findings` |

### 7. Devflow（路由）

| 维度 | 内容 |
|---|---|
| **边界** | 8 阶段路由 + 4 场景。给建议不替执行。 |
| **Leading Word** | `stage`（阶段即锚词）|
| **对标来源** | mattpocock `ask-matt`（主流程+on-ramp+standalone 三态分类）+ agent-skills `using-agent-skills`（16 步生命周期 + 6 条非协商行为）|
| **已吸收** | 8 阶段总览、场景差异速查、横切能力、回流路径 |
| **差距** | ① mattpocock ask-matt 的「context hygiene」（步骤 1-3 不 compact）缺失 ② agent-skills 的 6 条非协商行为（STOP-and-ask / 别当 yes-machine / 范围外手术刀精度）未显式化 ③ 缺 mattpocock 的 smart-zone 上下文预算概念 |
| **优化目标** | 补 context hygiene 指引；从 agent-skills 提取非协商行为层；leading word = `stage` |

### 8. Handoff

| 维度 | 内容 |
|---|---|
| **边界** | 压缩当前会话状态给下一会话。临时传递不永久归档。 |
| **Leading Word** | `handoff`（已是锚词）|
| **对标来源** | mattpocock `handoff`（写 temp dir、含 suggested-skills、引用不复制、脱敏）|
| **已吸收** | 基本结构 |
| **差距** | ① mattpocock 的 suggested-skills 段（告诉下游 agent 该用什么 skill）未加 ② 缺 「引用而非复制」原则 ③ 缺「写 temp dir 不写 repo」约束 |
| **优化目标** | 加 suggested-skills 段；加引用不复制原则；明确写 temp 不写 repo |

### 9. Caveman

| 维度 | 内容 |
|---|---|
| **边界** | Token 压缩模式。去填充词保技术实质。 |
| **Leading Word** | `caveman`（已是锚词）|
| **对标来源** | mattpocock `caveman`（~75% 压缩、持续到退出）|
| **已吸收** | 基本规则 |
| **差距** | ① 可量化压缩目标（~75%）未写 ② 缺「工具调用不受影响」的显式声明 |
| **优化目标** | 加量化压缩目标；声明工具调用不受影响 |

### 10. Design-doc-writing

| 维度 | 内容 |
|---|---|
| **边界** | 接收确认方案后写设计文档。doc-type 选择 + 写 + review + render。 |
| **Leading Word** | `skeleton`（骨架即锚词）|
| **对标来源** | superpowers `brainstorming` Step 6-8 (write spec → self-review → user review) + superpowers `writing-plans` (no placeholders) |
| **已吸收** | 4 类 doc-type、线性骨架、双路 reviewer、Review Log、写作准则 9 条 |
| **差距** | ① description 含流程概括 ② 已足够成熟，差距小 |
| **优化目标** | description 只写触发条件；leading word = `skeleton` |

---

## SkillOpt 优化计划

### 方法论适配

SkillOpt 的训练循环映射到我们的场景：

| SkillOpt | nocode-evolve 等价 |
|---|---|
| Skill document | SKILL.md |
| Rollout | rule-eval probe（eval/cases/*.md） |
| Reflect | 分析 probe 失败原因 → 提出 edit patch |
| Gate | 改后跑 eval，route-recall 必须 ≥ 改前 |
| Learning rate | 每轮最多 3 条 bounded edit |
| Slow update | 跨 commit 对比，防遗忘 |

### 优化循环

对每个 skill：

1. **Baseline**: 跑 eval（如有 fixture）或人工审读当前 SKILL.md
2. **Reflect**: 按上方差距分析，列出 bounded edits（≤ 3 条/轮）
3. **Update**: 应用 edits
4. **Gate**: 跑 eval 验证改进（或人工确认）
5. **Commit**: 每个 skill 一个 commit

### 优先级

按影响面排序：

1. **P0 — description 修正（全部 skill）** — 影响所有 skill 的触发准确率
2. **P1 — Iron Law 前置（Define/Design/Build/Verify）** — 影响纪律执行
3. **P2 — Leading Word 引入（全部）** — 影响行为锚定
4. **P3 — 内容补全（各 skill 差距项）** — 逐 skill 精调

---

## 预期效果（R8 更新：对照实际达成）

| 指标 | 优化前 | 目标 | R8 实际 | 状态 |
|---|---|---|---|---|
| description 只含触发条件 | 0/10 | 10/10 | **10/10** | ✅ 达成 |
| Iron Law 前置 | 2/10 | 6/10 | **6/6**（devflow 阶段 skill） | ✅ 达成 |
| leading word | 0/10 | 10/10 | **6/6** devflow + 共享词汇表 | ✅ 达成 |
| eval route-recall (design) | 66% (2/3) | ≥ 90% | **100%** (6/6) | ✅ 超预期 |
| eval route-recall (define) | 100% (3/3) | ≥ 90% | **100%** (6/6) | ✅ 保持 |
| eval 全量回归 | — | 零回归 | **35/35 + 压力 12/12** | ✅ 零回归 |
| SKILL.md 平均行数 | ~200 | ≤ 120 | **~104** (82-120) | ✅ 达成 |
| when-do 规则格式 | 0/6 | 6/6 | **6/6** | ✅ 达成 |
| Gate 链完整性 | 5/6 断裂 | 6/6 | **6/6** | ✅ 达成 |
| eval fixture 覆盖 | 1 rule | 5 rules | **5 rules** (47 条 probe) | ✅ 达成 |
