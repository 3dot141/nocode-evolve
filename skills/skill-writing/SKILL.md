---
name: skill-writing
description: Use when creating new skills, editing existing skills, testing skills with pressure scenarios, or optimizing skill triggering accuracy. Also use when the user says "write a skill", "create a skill", "improve this skill", "test this skill", "optimize skill description", or wants to turn a conversation workflow into a reusable skill. Replaces writing-skills and skill-creator.
---

# Skill Writing

Create, test, iterate, and publish agent skills through a TDD-driven workflow with quantitative evaluation.

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

This skill fuses three approaches:
- **TDD methodology** (writing-skills): RED baseline before writing → GREEN minimal skill → REFACTOR to close loopholes
- **Eval infrastructure** (skill-creator): quantitative benchmarks, eval viewer, description optimizer, packager
- **SkillOpt discipline** (Microsoft): train/validation split, validation gate, bounded edits, aggregate reflect

## Iron Law

```
NO SKILL WITHOUT A FAILING BASELINE FIRST — ALL SKILL TYPES, NO EXCEPTIONS.
```

This applies to discipline skills, technique skills, pattern skills, AND reference skills. "It's just a reference doc" is the #1 rationalization for skipping baseline — reference docs have gaps too, and baseline testing reveals them.

## Eight-Phase Flow

```
Step 0: TaskCreate (全量 task + gate 一次建好)
    ↓
Phase 1: Capture Intent
    ↓
Phase 2: Interview & Research
    ↓
Phase 3: RED — Baseline (mandatory, all types)
    ↓
Phase 4: GREEN — Write SKILL.md
    ↓
Phase 5: Eval — Run & Review
    ↓
Phase 6: REFACTOR — Iterate (SkillOpt discipline)
    ↓ (loop until converged)
Phase 7: Description Optimization
    ↓
Phase 8: Package
```

## Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
Task 1: Capture Intent (Phase 1)
  Sub-steps: 4 问题 + skill type 判定
  Gate: 意图、触发条件、输出格式、skill 类型四项明确

Task 2: Interview & Research (Phase 2)
  Sub-steps: 边界 case + 成功标准 + 依赖
  Gate: 边界清晰，可进 baseline

Task 3: RED — Baseline (Phase 3)
  Sub-steps: 设计 pressure scenarios + 跑 subagent baseline
  Gate: ≥N 个 scenario 跑完，失败模式已记录

Task 4: GREEN — Write SKILL.md (Phase 4)
  Sub-steps: 写 SKILL.md 最小版本
  Gate: SKILL.md 产出，覆盖 baseline 失败

Task 5: Eval — Run & Review (Phase 5)
  Sub-steps: eval set 创建 + train/validation split + 跑评测
  Gate: benchmark 产出，pass_rate 有数字

Task 6: REFACTOR — Iterate (Phase 6)
  Sub-steps: aggregate reflect → bounded edits → validation gate → convergence
  Gate: 收敛或用户满意

Task 7: Description Optimization (Phase 7)
  Sub-steps: 20 trigger queries + 优化 description
  Gate: trigger 准确率达标

Task 8: Package (Phase 8)
  Sub-steps: 打包 .skill 文件
  Gate: 产物就绪
```

每完成一个标 done。

## Phase 1: Capture Intent

**Enter Gate:**
- [ ] 用户明确要创建/编辑/优化 skill（或 conversation 中有可捕获的 workflow）

Understand what the user wants the skill to do.

If the conversation already contains a workflow the user wants to capture ("turn this into a skill"), extract: tools used, step sequence, corrections made, input/output formats. Confirm with the user before proceeding.

Four core questions:
1. What should this skill enable Claude to do?
2. When should this skill trigger? (user phrases, contexts)
3. What's the expected output format?
4. What type of skill is this? (determines Phase 3 test design and Phase 4 writing style)

### Skill Types

| Type | Examples | Phase 3 test design | Phase 4 writing style |
|---|---|---|---|
| **Discipline** | TDD, debugging, verification | Pressure scenarios (time + sunk cost + authority), ≥3 scenarios | Anti-rationalization: explicit counters, red flags table, loophole closers |
| **Technique** | condition-based-waiting, root-cause-tracing | Application + variation + missing info, ≥3 scenarios | Explain-why: reasoning over MUSTs, theory of mind |
| **Pattern** | flatten-with-flags, information-hiding | Recognition + application + counter-examples, ≥3 scenarios | Explain-why |
| **Reference** | API docs, command references | Retrieval + application + coverage, ≥2 scenarios | Explain-why |

**Exit Gate:**
- [ ] 意图、触发条件、输出格式、skill 类型四项明确
- [ ] 用户确认

## Phase 2: Interview & Research

**Enter Gate:**
- [ ] Phase 1 Exit Gate 已过

Dig into edge cases, input/output formats, success criteria, dependencies. Check available MCPs for research. Wait until boundaries are clear before proceeding to Phase 3.

**Exit Gate:**
- [ ] 边界 case 已梳理
- [ ] 成功标准已定义
- [ ] 依赖项已识别
- [ ] 可以设计 baseline scenarios

## Phase 3: RED — Baseline

**Enter Gate:**
- [ ] Phase 2 Exit Gate 已过

**Mandatory for ALL skill types.** Run pressure scenarios with a subagent WITHOUT the skill.

For each scenario:
1. Spawn a subagent with the scenario prompt and NO skill loaded
2. Record verbatim: what choices did it make? What rationalizations did it use? Which pressures triggered violations?
3. Save results to workspace

**Iron Law reminder:** You must see the agent fail before writing the skill. Skip this and you're guessing what to teach.

For detailed pressure scenario design, read `writing-skills/testing-skills-with-subagents.md`.

**Exit Gate:**
- [ ] ≥N 个 pressure scenario 已执行（Discipline/Technique/Pattern ≥3, Reference ≥2）
- [ ] 失败模式已记录（具体行为 + rationalizations）
- [ ] 结果已保存到 workspace

## Phase 4: GREEN — Write SKILL.md

**Enter Gate:**
- [ ] Phase 3 Exit Gate 已过
- [ ] 有明确的失败模式列表可对照

Write the minimal skill that addresses the specific failures observed in Phase 3.

### Structure

```yaml
---
name: skill-name
description: Use when [specific triggering conditions] — no workflow summary
---
```

- **Description**: triggers only, never summarize the workflow. Testing showed that workflow summaries in descriptions cause Claude to follow the description instead of reading the full skill.
- **Overview**: core principle in 1-2 sentences
- **Core content**: address the specific baseline failures

### Writing Style by Type

**Discipline skills** — anti-rationalization approach:
- For each rationalization recorded in Phase 3, write an explicit counter
- Build a rationalization table (excuse → reality)
- Create a red flags list for self-checking
- Close every loophole explicitly (don't just state the rule — forbid specific workarounds)
- Reference: `writing-skills/persuasion-principles.md`

**Technique/Pattern/Reference skills** — explain-why approach:
- Explain WHY things are important, not just WHAT to do
- Use theory of mind — the model is smart, reasoning works better than rigid MUSTs
- One excellent example beats many mediocre ones

### Workflow Skill Template

**判定**：skill 类型为 Discipline 且含多步骤顺序执行（阶段制 sequential）→ 工作流型 skill，必须用 TODO + Gate 模板。

工作流型 skill 的 SKILL.md 必须包含：

1. **Step 0: TaskCreate** — 进入后第一件事，一次性创建全部 task。每个 task 含 Sub-steps + Gate：

```markdown
## Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

Task 1: [步骤名] (Step 1)
  Sub-steps: [具体子步骤]
  Gate: [通过条件]

Task 2: [步骤名] (Step 2)
  Sub-steps: [具体子步骤]
  Gate: [通过条件]

...

每完成一个标 done。
```

2. **每个 Step 的 Enter Gate + Exit Gate**：

```markdown
### Step N: [步骤名]

**Enter Gate:**
- [ ] 前置 Step Exit Gate 已过
- [ ] [本步骤所需前置条件]

[步骤内容]

**Exit Gate:**
- [ ] [本步骤完成的客观标准]
- [ ] [可验证的产出物]
```

3. **全局 Exit Gate** — 所有 Step 的 Exit Gate 汇总：

```markdown
## Exit Gate（全局）

- [ ] [Step 1 关键产出]
- [ ] [Step 2 关键产出]
- [ ] ...
```

**Gate 写法原则**：
- Gate 条件必须可客观判定（有/无、通过/失败、数字达标），不用主观词（"足够好"、"差不多"）
- Enter Gate 防止跳步——前置步骤没过不允许进入
- Exit Gate 防止草率推进——没有产出证据不允许标 done
- 条件用 checkbox `- [ ]`，方便逐条核对

### General Guidelines

- Keep SKILL.md under 500 lines; overflow goes to references/
- Only address failures observed in baseline — no speculative additions
- **SKILL.md for agents, README.md for humans** — SKILL.md contains only what the agent needs to execute. Attribution, changelogs, design rationale, and methodology context go in the skill's README.md for human readers
- For Anthropic's official skill authoring best practices, read `writing-skills/anthropic-best-practices.md`

**Exit Gate:**
- [ ] SKILL.md 已产出
- [ ] 覆盖 Phase 3 记录的每个失败模式
- [ ] 工作流型 skill 已包含 Step 0 TaskCreate + 每步 Enter/Exit Gate
- [ ] 行数 ≤ 500（溢出部分移到 references/）

## Phase 5: Eval — Run & Review

**Enter Gate:**
- [ ] Phase 4 Exit Gate 已过
- [ ] SKILL.md 已就绪

### 5a. Create Eval Set + Train/Validation Split

Create realistic test prompts. **Minimum 8 prompts** (after split: train ≥5, validation ≥3).

Split 60/40 into train and validation sets. Save to `evals/evals.json` with split markers.

Why ≥3 validation items: with fewer, pass_rate granularity is too coarse (33%/67%/100%) and the validation gate in Phase 6 becomes noise.

### 5b. Run With-Skill + Baseline

**With `claude` CLI:** use `skill-creator/scripts/run_eval.py` for automation.

**Without CLI (fallback):** spawn subagents manually — one with-skill, one without, for each eval prompt. Save outputs to `workspace/iteration-N/eval-ID/{with_skill,without_skill}/`. Report "CLI not available, using subagent fallback."

### 5c. Draft Assertions While Runs Are In Progress

Don't wait — draft quantitative assertions for each test case. Good assertions are objectively verifiable.

Discipline skills: focus on "did the agent comply under pressure?"
Subjective outputs (writing style): skip assertions, rely on human review.

### 5d. Grade + Benchmark + Viewer

1. Grade each run using `skill-creator/agents/grader.md`
2. Aggregate with `skill-creator/scripts/aggregate_benchmark.py`
3. Launch viewer with `skill-creator/eval-viewer/generate_review.py`

**Important:** the viewer shows ONLY training set results. Validation set results stay hidden — they're used exclusively for the Phase 6 gate.

Score definition: `pass_rate = passed assertions / total assertions` per eval case. Aggregate = mean pass_rate across cases.

Read user feedback from `feedback.json` (training set only).

**Exit Gate:**
- [ ] Eval set ≥ 8 prompts，train/validation 已 split
- [ ] With-skill + baseline 均已跑完
- [ ] Assertions 已编写（subjective 类除外）
- [ ] Benchmark 已产出，pass_rate 有数字
- [ ] Viewer 已生成（仅展示 training set）

## Phase 6: REFACTOR — Iterate (SkillOpt Discipline)

**Enter Gate:**
- [ ] Phase 5 Exit Gate 已过
- [ ] Benchmark 数据可用

Four hard constraints, none optional:

### 6a. Aggregate Reflect

Read feedback + benchmark data. Generalize across test cases into patterns — don't overfit to individual cases. For discipline skills, also extract new rationalizations from transcripts.

### 6b. Bounded Edits

Each iteration: at most 3 changes (add/delete/replace) to SKILL.md. No full rewrites. Remove content that isn't pulling its weight.

### 6c. Validation Gate

Re-run the validation set (held-out 40%) after edits. Compare `new_score` against `previous_score`.

- `new_score < previous_score` → **reject** edits, revert, try different approach
- `new_score >= previous_score` → **accept**, update previous_score

After 3 consecutive rejections: stop and ask the user for constraints ("What matters more to you, X or Y?").

### 6d. Convergence

Convergence threshold adapts to sample size: `1 / len(validation_set)`.
- 4 validation items → 25% threshold
- 10 items → 10%
- 20 items → 5%

Stop when ANY of:
- User says satisfied
- All feedback is empty (everything looks good)
- Validation pass_rate change ≤ threshold for 2 consecutive rounds

If not converged → back to Phase 5 (re-run eval with new feedback).

**Exit Gate:**
- [ ] 收敛（validation pass_rate 变化 ≤ threshold 连续 2 轮）或用户满意
- [ ] 无回归（validation score ≥ 进入时 score）

## Phase 7: Description Optimization

**Enter Gate:**
- [ ] Phase 6 Exit Gate 已过

Generate 20 trigger eval queries (8-10 should-trigger + 8-10 should-not-trigger). Present for user review using `skill-creator/assets/eval_review.html`.

**With CLI:** run `skill-creator/scripts/run_loop.py` for automated optimization (60/40 split, 3 runs per query, max 5 iterations).

**Without CLI:** manual testing rounds — modify description, test 5+5 queries, count trigger rate.

Update frontmatter description with the best result.

**Exit Gate:**
- [ ] 20 trigger queries 已测试（8-10 should + 8-10 should-not）
- [ ] Description 已更新到最优版本
- [ ] Trigger 准确率达标

## Phase 8: Package

**Enter Gate:**
- [ ] Phase 7 Exit Gate 已过

Run `skill-creator/scripts/package_skill.py` to create a `.skill` file. Requires Python 3. Without Python: tell the user to zip the skill directory manually.

**Exit Gate:**
- [ ] .skill 文件已生成（或用户手动 zip）
- [ ] 产物可分发

## Exit Gate（全局）

- [ ] Skill 意图 + 类型已确认（Phase 1）
- [ ] Baseline 失败模式已记录（Phase 3）
- [ ] SKILL.md 已产出并覆盖失败模式（Phase 4）
- [ ] Eval benchmark pass_rate 有数字（Phase 5）
- [ ] 迭代收敛、无回归（Phase 6）
- [ ] Description trigger 准确率达标（Phase 7）
- [ ] 产物已打包（Phase 8）

## When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in CLAUDE.md)
- Mechanical constraints enforceable with regex/validation

## Red Flags — STOP

| Thought | Reality |
|---|---|
| "Too simple to need baseline" | Simple skills have gaps too. 15 min testing saves hours. |
| "It's just a reference doc" | References can have unclear sections. Test retrieval. |
| "I'll test after writing" | Tests-after prove nothing. Baseline first. |
| "I know what agents will do wrong" | You're guessing. Run the baseline. |
| "One big rewrite will fix it" | Bounded edits. 3 changes max per iteration. |
| "Validation gate is too strict" | It's the only thing preventing overfit regression. |
| "This is obviously clear" | Clear to you ≠ clear to other agents. |

## Common Mistakes

- Writing description that summarizes workflow → Claude follows description, skips skill body
- Skipping baseline for "simple" skills → skill addresses wrong problems
- Large rewrites per iteration → uncontrolled regression, no rollback point
- Showing validation set in viewer → contaminates held-out gate
- Forcing assertions on subjective output → noise in benchmark
- Putting human-facing context (attribution, changelog, design rationale) in SKILL.md → noise in agent context; put in README.md
