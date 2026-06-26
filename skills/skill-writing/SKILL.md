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

## Phase 1: Capture Intent

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

## Phase 2: Interview & Research

Dig into edge cases, input/output formats, success criteria, dependencies. Check available MCPs for research. Wait until boundaries are clear before proceeding to Phase 3.

## Phase 3: RED — Baseline

**Mandatory for ALL skill types.** Run pressure scenarios with a subagent WITHOUT the skill.

For each scenario:
1. Spawn a subagent with the scenario prompt and NO skill loaded
2. Record verbatim: what choices did it make? What rationalizations did it use? Which pressures triggered violations?
3. Save results to workspace

**Iron Law reminder:** You must see the agent fail before writing the skill. Skip this and you're guessing what to teach.

For detailed pressure scenario design, read `writing-skills/testing-skills-with-subagents.md`.

## Phase 4: GREEN — Write SKILL.md

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

### General Guidelines

- Keep SKILL.md under 500 lines; overflow goes to references/
- Only address failures observed in baseline — no speculative additions
- **SKILL.md for agents, README.md for humans** — SKILL.md contains only what the agent needs to execute. Attribution, changelogs, design rationale, and methodology context go in the skill's README.md for human readers
- For Anthropic's official skill authoring best practices, read `writing-skills/anthropic-best-practices.md`

## Phase 5: Eval — Run & Review

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

## Phase 6: REFACTOR — Iterate (SkillOpt Discipline)

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

## Phase 7: Description Optimization

Generate 20 trigger eval queries (8-10 should-trigger + 8-10 should-not-trigger). Present for user review using `skill-creator/assets/eval_review.html`.

**With CLI:** run `skill-creator/scripts/run_loop.py` for automated optimization (60/40 split, 3 runs per query, max 5 iterations).

**Without CLI:** manual testing rounds — modify description, test 5+5 queries, count trigger rate.

Update frontmatter description with the best result.

## Phase 8: Package

Run `skill-creator/scripts/package_skill.py` to create a `.skill` file. Requires Python 3. Without Python: tell the user to zip the skill directory manually.

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
