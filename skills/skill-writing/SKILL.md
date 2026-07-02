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

## Entry Routing

Determine the work mode before entering the flow. Three paths:

| Signal | Mode | Entry point |
|---|---|---|
| "create a skill", "turn this into a skill", new skill from scratch | **Create** | Step 0 → Phase 1-8 (full flow) |
| "improve this skill", "edit SKILL.md", modify existing skill body | **Edit** | Step 0 → Phase 3-6 (baseline the current skill, then iterate) |
| "optimize skill description", "fix trigger accuracy", "improve when it triggers" | **Description-only** | Phase 7 directly (own Enter Gate below) |

**Description-only Enter Gate** (replaces normal Phase 7 Enter Gate):
- [ ] Existing SKILL.md loaded and reviewed
- [ ] Trigger query set defined (≥10 should-trigger + ≥10 should-not-trigger)
- [ ] Baseline trigger accuracy measured (current hit/miss rate)

Edit mode skips Phase 1-2 (intent and research already exist) but still requires Phase 3 baseline against the current skill version — otherwise you're editing blind.

## Eight-Phase Flow (Create mode — full)

```
Step 0: TaskCreate (create all tasks + gates upfront)
    ↓
Phase 1: Capture Intent
    ↓
Phase 2: Interview & Research
    ↓
Phase 3: RED — Baseline (mandatory, all modes except description-only)
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

**First thing on entry** — create all tasks at once:

```
Task 1: Capture Intent (Phase 1)
  Sub-steps: 4 core questions + skill type determination
  Gate: intent, trigger conditions, output format, and skill type are all defined

Task 2: Interview & Research (Phase 2)
  Sub-steps: edge cases + success criteria + dependencies + fill Scenario Discovery Matrix
  Gate: boundaries clear, matrix filled, ready for baseline

Task 3: RED — Baseline (Phase 3)
  Sub-steps: select scenarios from matrix + run subagent baseline + codex cross-model baseline
  Gate: ≥N scenarios executed, ≥1 reproducible failure identified, failure modes labeled with matrix cells

Task 4: GREEN — Write SKILL.md (Phase 4)
  Sub-steps: write minimal SKILL.md + self-review + self-verification guideline check
  Gate: SKILL.md produced, covers baseline failures, self-review completed, self-verification steps have independent review guidance

Task 5: Eval — Run & Review (Phase 5)
  Sub-steps: create eval set + train/validation split + run evaluation
  Gate: benchmark produced, pass_rate has numbers

Task 6: REFACTOR — Iterate (Phase 6)
  Sub-steps: aggregate reflect → bounded edits → validation gate (含 codex cross-model) → convergence
  Gate: converged or user satisfied

Task 7: Description Optimization (Phase 7)
  Sub-steps: 20 trigger queries + optimize description
  Gate: trigger accuracy meets threshold

Task 8: Package (Phase 8)
  Sub-steps: package .skill file
  Gate: artifact ready for distribution
```

Mark each task done as it completes.

## Phase 1: Capture Intent

**Enter Gate:**
- [ ] User has explicitly requested to create/edit/optimize a skill (or conversation contains a capturable workflow)

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
- [ ] Intent, trigger conditions, output format, and skill type are all defined
- [ ] User confirmed

## Phase 2: Interview & Research

**Enter Gate:**
- [ ] Phase 1 Exit Gate passed

Dig into edge cases, input/output formats, success criteria, dependencies. Check available MCPs for research.

**Tool-wrapping skills** (the skill wraps an external CLI / API / library / service / workflow): follow `absorbed/target-analysis.md` — scope before analyzing, use the real target, extract capabilities in a uniform structure, plan the Failure Modes table.

**Fill the Scenario Discovery Matrix** (`writing-skills/scenario-discovery-matrix.md`): scan all 7 axes, mark applicable cells, skip cells only with a reason. The filled matrix is the input for Phase 3 scenario selection.

**Exit Gate:**
- [ ] Edge cases documented
- [ ] Success criteria defined
- [ ] Dependencies identified
- [ ] Tool-wrapping skills: target-analysis.md checklist passed (scope cut + uniform capabilities + Failure Modes plan)
- [ ] Scenario Discovery Matrix filled (all axes scanned)
- [ ] Ready to design baseline scenarios

## Phase 3: RED — Baseline

**Enter Gate:**
- [ ] Phase 2 Exit Gate passed

**Mandatory for ALL skill types.** Run pressure scenarios with a subagent WITHOUT the skill.

**Select scenarios from the filled matrix** using the Phase 3 Selection Rules in `writing-skills/scenario-discovery-matrix.md`. Don't free-associate — pick the minimal orthogonal set that covers the matrix axes.

For each scenario:
1. Spawn a subagent with the scenario prompt and NO skill loaded
2. Record verbatim: what choices did it make? What rationalizations did it use? Which pressures triggered violations?
3. Label each failure with the matrix cell it exposed (e.g. "Axis 3: Rationalization + Axis 4: Sunk cost")
4. Save results to workspace

**Codex 跨模型 baseline**：至少 1 个场景同时用 codex 跑，发现跨模型差异性的失败模式。

```
codex 可用？（setup --json）
     │
     ├─ 可用 ──→ 跑 ≥1 scenario → 与 subagent 失败模式对比
     │              - 两者都失败 = 高置信失败模式
     │              - 仅一方失败 = 模型特有盲区，仍是有效 baseline failure
     │
     └─ 不可用 ──→ 仅 subagent（明说「codex 不可用，跨模型 baseline 跳过」）
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task \
  "<scenario prompt, same as subagent, NO skill loaded>"
```

**Iron Law reminder:** You must see the agent fail before writing the skill. Skip this and you're guessing what to teach.

For detailed pressure scenario design, read `writing-skills/testing-skills-with-subagents.md`.

**Exit Gate:**
- [ ] Scenarios selected from matrix (each covers ≥1 task type + ≥1 failure mode + ≥1 context/boundary cell)
- [ ] ≥N scenarios executed (Discipline/Technique/Pattern ≥3, Reference ≥2)
- [ ] **At least one reproducible baseline failure identified** — if zero failures found after all scenarios, either redesign scenarios (different angles, harder pressure) or stop with "skill not justified yet". Running scenarios is not enough; the Iron Law requires observed failure. Inferred gaps from schema/code analysis are hypotheses for new scenarios, not observed failures — run them as scenarios before counting them.
- [ ] Failure modes recorded with matrix labels (specific behaviors + rationalizations)
- [ ] Results saved to workspace

## Phase 4: GREEN — Write SKILL.md

**Enter Gate:**
- [ ] Phase 3 Exit Gate passed
- [ ] Clear list of failure modes to address

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

**Criteria**: Multi-step sequential execution with ordering-critical or side-effecting operations → workflow skill, regardless of skill type — ordering risk is orthogonal to type classification. Examples: a Discipline skill with phased compliance checks, a Reference skill for a transactional API (finalize_plan → write_files), a Technique skill with destructive setup steps.

Workflow skill SKILL.md must include: **Step 0 TaskCreate** (all tasks created upfront, each with Sub-steps + Gate), **Enter Gate + Exit Gate for every Step**, and a **Global Exit Gate**. Gates must be objectively verifiable (yes/no, pass/fail, threshold) — no subjective words.

**Read `writing-skills/workflow-skill-template.md` for the full templates and gate-writing principles.**

### General Guidelines

- Keep SKILL.md under 500 lines; overflow goes to references/
- Only address failures observed in baseline — no speculative additions
- **SKILL.md for agents, README.md for humans** — SKILL.md contains only what the agent needs to execute. Attribution, changelogs, design rationale, and methodology context go in the skill's README.md for human readers
- **Fallback paths use ASCII decision trees.** When a skill has a preferred path + fallback (CLI vs subagent, API vs scraping, etc.), write it as an ASCII decision tree — not parallel bullet points. Parallel bullets let the agent pick the easy path; a decision tree forces it to try the preferred path first and only fall back on concrete failure. Pattern:

```
[probe command]
     │
     ├─ success ──→ preferred path
     │
     └─ fail (specific error) ──→ fallback path + report reason
```

- For Anthropic's official skill authoring best practices, read `writing-skills/anthropic-best-practices.md`

### Self-Verification Guideline（产出 skill 的独立审查引导）

如果你写出来的 skill 包含**agent 验证自己产出**的步骤（review / verify / check / validate / 确认 / 评审），该步骤应引入合适的 review 方法论 + 独立审查引导。适用于所有 skill 类型，不限 workflow skill。

判断规则：skill 的某个步骤里，agent 在检查自己刚做出来的东西（代码 / 设计 / 方案 / 文档 / 配置）→ 该步骤加引导。引导分两层：

**第一层 · 结构化 review 引入 `reviewing` 框架（review 方法论底座）**：若该 review 步骤是**多维度评审**（多个评审维度 + 分档 + findings 分级 + 收口，例如新 skill 自带一个代码 / 设计 / 方案评审阶段），引导它引入 `reviewing` 框架、别在新 skill 里重造一套 review 流程——新 skill 的该步骤写成先 `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md`（7 步流程 + 方法库选择表 + 公共能力）+ `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md`（统一 findings/verdict 契约），在框架第 3 步注入本领域评审维度、第 4 步从方法库选打法。

**第二层 · 独立交叉那一步选谁**（reviewing 框架第 5 步的载体；轻量单点自查则跳过第一层直接选）：
- **评估/拍板类**（"这个方案行不行"）→ 指向 `Skill(nocode:red-blue-deep)`
- **产出审查类**（"这段代码/文档有没有问题"）→ 推荐 subagent + codex 并行独立 review（参照 `rule-codex-review` 场景四）
- **合规检查类**（"是否遵守了规则"）→ 推荐 subagent 独立检查（不需要跨模型）

不加引导的步骤：纯机械验证（跑测试 / lint / 类型检查）、有客观标准的 pattern 匹配——这些不需要独立视角。

### Self-Review

After writing SKILL.md, self-review it — author's own pass, no subagent, no codex (method card: `{NOCODE_SKILL_REF}/reviewing/methods/self-review.md`). Check at minimum:

- Does it actually address every baseline failure recorded in Phase 3?
- Are there loopholes, missing edge cases, or instructions an agent could misinterpret?
- Method-card items: placeholder/TODO 残留、内部矛盾、歧义模糊、scope 漂移、空壳未兑现、完整性

Fix issues inline before passing the Exit Gate; unfixed items must be recorded explicitly. Self-review 是最低门槛不是充分条件——发现真硬伤（critical）或对象明显高风险时，升档调 `Skill(nocode:red-blue-deep)` 补独立审查。

**Exit Gate:**
- [ ] SKILL.md produced
- [ ] Covers every failure mode recorded in Phase 3
- [ ] Self-review completed, findings addressed
- [ ] Workflow skills include Step 0 TaskCreate + Enter/Exit Gate per step
- [ ] Self-verification steps include review methodology (reviewing framework for structured review) + independent review guidance (or confirmed no self-verification steps exist)
- [ ] Line count ≤ 500 (overflow moved to references/)

## Phase 5: Eval — Run & Review

**Enter Gate:**
- [ ] Phase 4 Exit Gate passed
- [ ] SKILL.md ready

### 5a. Create Eval Set + Train/Validation Split

Create realistic test prompts. **Minimum 8 prompts** (after split: train ≥5, validation ≥3).

Split 60/40 into train and validation sets. Save to `evals/evals.json` with split markers.

Why ≥3 validation items: with fewer, pass_rate granularity is too coarse (33%/67%/100%) and the validation gate in Phase 6 becomes noise.

### 5b. Run With-Skill + Baseline

```
claude -p "hello" --output-format json
         │
         ├─ success ──→ run_eval.py (skill-creator/scripts/)
         │
         └─ fail (command not found / error)
                  │
                  └──→ subagent fallback
                       one with-skill + one without per prompt
                       save to workspace/iteration-N/eval-ID/
                       report "CLI unavailable (reason: …), using subagent fallback"
```

**Always try CLI first.** Nested `claude -p` inside a Claude Code session is supported. Only fall back to subagents after a concrete failure — "might not work" is not a reason to skip.

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
- [ ] Eval set ≥ 8 prompts, train/validation split done
- [ ] With-skill + baseline runs both completed
- [ ] Assertions drafted (except subjective outputs)
- [ ] Benchmark produced with numeric pass_rate
- [ ] Viewer generated (training set only)

## Phase 6: REFACTOR — Iterate (SkillOpt Discipline)

**Enter Gate:**
- [ ] Phase 5 Exit Gate passed
- [ ] Benchmark data available

Four hard constraints, none optional:

### 6a. Aggregate Reflect

Read feedback + benchmark data. Generalize across test cases into patterns — don't overfit to individual cases. For discipline skills, also extract new rationalizations from transcripts.

**Classify each failure** as `SKILL_DEFECT` (skill text is wrong/incomplete — fix the skill) or `EXECUTION_LAPSE` (agent flubbed despite clear instructions — don't change the skill). Only `SKILL_DEFECT` failures drive edits in 6b. Writing EXECUTION_LAPSE fixes into the skill bloats it with noise.

### 6b. Bounded Edits

Each iteration: at most 3 changes (add/delete/replace) to SKILL.md. No full rewrites. Remove content that isn't pulling its weight.

### 6c. Validation Gate

Re-run the validation set (held-out 40%) after edits. Compare `new_score` against `previous_score`.

**Codex cross-model validation**：validation set 中至少 1 case 用 codex 执行（同 Phase 3 的跨模型 baseline 逻辑）。codex 执行失败而 subagent 成功 → 可能是 SKILL_DEFECT（指令依赖模型特有推理，不够显式），计入 6a 下一轮 Aggregate Reflect。codex 不可用则跳过，明说。

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
- [ ] Converged (validation pass_rate change ≤ threshold for 2 consecutive rounds) or user satisfied
- [ ] No regression (validation score ≥ score at entry)

## Phase 7: Description Optimization

**Enter Gate (create/edit mode):**
- [ ] Phase 6 Exit Gate passed

**Enter Gate (description-only mode):**
- [ ] Existing SKILL.md loaded and reviewed
- [ ] Trigger query set defined (≥10 should-trigger + ≥10 should-not-trigger)
- [ ] Baseline trigger accuracy measured

Generate 20 trigger eval queries (8-10 should-trigger + 8-10 should-not-trigger). Present for user review using `skill-creator/assets/eval_review.html`.

**With CLI:** run `skill-creator/scripts/run_loop.py` for automated optimization (60/40 split, 3 runs per query, max 5 iterations).

**Without CLI:** manual testing rounds — modify description, test 5+5 queries, count trigger rate.

Update frontmatter description with the best result.

**Exit Gate:**
- [ ] 20 trigger queries tested (8-10 should + 8-10 should-not)
- [ ] Description updated to best-performing version
- [ ] Trigger accuracy meets threshold

## Phase 8: Package

**Enter Gate:**
- [ ] Phase 7 Exit Gate passed

Run `skill-creator/scripts/package_skill.py` to create a `.skill` file. Requires Python 3. Without Python: tell the user to zip the skill directory manually.

**Exit Gate:**
- [ ] .skill file generated (or user zipped manually)
- [ ] Artifact ready for distribution

## Exit Gate (Global)

- [ ] Skill intent + type confirmed (Phase 1)
- [ ] Scenario Discovery Matrix filled, baseline failures recorded with matrix labels, codex cross-model baseline done (Phase 2-3)
- [ ] SKILL.md produced, covers failure modes, self-reviewed, self-verification steps have independent review guidance (Phase 4)
- [ ] Eval benchmark has numeric pass_rate (Phase 5)
- [ ] Iteration converged, no regression (Phase 6)
- [ ] Description trigger accuracy meets threshold (Phase 7)
- [ ] Artifact packaged (Phase 8)

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
