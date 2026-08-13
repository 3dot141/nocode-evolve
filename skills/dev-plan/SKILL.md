---
name: dev-plan
description: Use when a confirmed engineering design needs decomposition into dependency-ordered implementation slices before Build. Not for clarifying goals, changing design decisions, or writing code.
---

# dev-plan — map DES obligations to executable slices

Plan turns the current Handoff's DES IDs into dependency-ordered tasks. It cannot change the design baseline; a design conflict returns to the exact dev-design Log.

Read `{NOCODE_SKILL_REF}/design-traceability.md` and `references/task-template.md` before writing tasks.

## Enter Gate

- [ ] Exact `design.log.md` path is known.
- [ ] Current Handoff target is Plan.
- [ ] `design.md` status is confirmed and every Handoff DES ID resolves to one definition.
- [ ] No blocking Open item exists.

## Step 0 — Create the Plan workflow

Create these stable milestones; do not mirror every implementation task in the platform plan:

1. Load design and repository evidence.
2. Build dependencies and implementation slices.
3. Write and validate the Plan document.
4. Confirm and hand off Build.

<!-- nocode:platform claude -->
Use `TaskCreate` for all milestones and `TaskUpdate` for status changes. Use `AskUserQuestion` only for a real plan decision that evidence cannot resolve.
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
Use `update_plan` with the full stable milestone list and at most one `in_progress`. Use `request_user_input` only for a real plan decision when available; otherwise ask at the end of the turn.
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
Keep a text milestone list with at most one in-progress item. Ask only for a real plan decision that evidence cannot resolve, at the end of the turn, with the full question and 2–3 mutually exclusive options.
<!-- /nocode:platform -->

## Step 1 — Load the current baseline

Enter Gate: the Plan workflow exists.

1. Re-read the exact Log, current Handoff, `design.md`, and all named DES definitions.
2. Use design evidence anchors to read the affected implementation and tests. Search only for gaps the design did not locate.
3. Record repository facts that affect task boundaries. If a fact changes goal, scope, contract, Preserve, acceptance, solution, or DES meaning, stop and return it to dev-design.
4. Identify pure verification DES IDs that need no implementation task; retain them for Verify.

Exit Gate: every Handoff DES ID is understood as implement, preserve, or verify-only work without a design conflict.

## Step 2 — Build the dependency graph

List the smallest implementation units and directed dependencies:

- contract or test seam before its consumers;
- data / migration preparation before cutover;
- producer before dependent consumer unless contract-first stubs make them independent;
- characterization tests before behavior-preserving refactor;
- observability before risky rollout when it is needed to detect failure.

Reject cycles or expose the design conflict that causes them. Choose a vertical slice when one narrow user / system path can cross all needed layers. Choose contract-first when several consumers need a stable boundary before implementation can proceed.

Exit Gate: the graph is acyclic and each node has an observable completion condition.

## Step 3 — Write tasks

Each task follows `references/task-template.md` and includes:

- purpose and dependency;
- `designCovers` DES IDs;
- exact files or bounded search area;
- test-first action and expected failing behavior;
- implementation action;
- verification command and expected result;
- rollback / checkpoint when applicable.

Prefer one independently verifiable slice touching no more than five files. If a task needs a large unknown search, split investigation from implementation or return a design gap. Do not paste placeholder code or invent APIs absent from the design / repository evidence.

Choose one execution mode for the Plan header:

- `executing`: main agent executes tasks sequentially;
- `subagent-lite`: isolated implementer per task, independent review only for risk tasks;
- `subagent-full`: isolated implementer plus per-task spec review and checkpoint quality review.

Exit Gate: all implementation / preserve Handoff DES IDs appear in at least one task; every task has at least one DES source.

## Step 4 — Write the Plan document

Write the repository's configured Plan path. Include:

```markdown
# <Task> Implementation Plan

**Design Log**: <exact path>
**Design Doc**: <design.md path>
**Design Confirmation**: <Handoff.ConfirmedBy Round N>
**Execution**: executing | subagent-lite | subagent-full

## Dependency graph
## Tasks
## DES coverage
| DES ID | Task / Verify | Reason |
## Checkpoints and rollback
```

The DES coverage view starts from Handoff.designIds, not from task self-report. Unknown IDs or an unmapped implementation / preserve obligation block confirmation.

Exit Gate: the Plan document maps every Handoff DES ID exactly and contains an acyclic execution order.

## Step 5 — Validate, confirm, hand off

Self-check the task graph, slice boundaries, risk-first order, exact file evidence, testability, and DES coverage. This is a focused compliance check, not a second design review.

Show the complete Plan, first slice, execution mode, and DES coverage to the user. On confirmation, hand off the exact Log path, `design.md`, Plan path, DES scope, Preserve, and Open to Build.

<!-- nocode:platform claude -->
Use `Skill(nocode:dev-build)` after explicit confirmation.
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
Use `$dev-build` after explicit confirmation.
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
Use `/skill:dev-build` after explicit confirmation.
<!-- /nocode:platform -->

Exit Gate: user confirmed the Plan and Build received the complete context.

## Global Exit Gate

- [ ] Current design confirmation and Handoff were re-read.
- [ ] Dependency graph is acyclic.
- [ ] Every task has designCovers and a fresh verification action.
- [ ] Every implementation / preserve Handoff DES ID is mapped; pure verification IDs are retained.
- [ ] User confirmed the Plan and execution mode.
- [ ] Build Handoff contains exact artifact paths and DES IDs.

## Red flags

- Reinterpreting a LOG item instead of reading its DES obligation
- Leaving a DES ID unmapped because “the task obviously covers it”
- Adding a solution element not present in design or repository evidence
- Using revision, digest, Registry, Full / Standard, or N/A scenario placeholders
- Beginning implementation before Plan confirmation
