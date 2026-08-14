# Devflow Build 前 Env Implementation Plan

**Design Log**: `docs/dev/3dot141/260813-01-devflow-env-before-build/design.log.md`
**Design Doc**: `docs/dev/3dot141/260813-01-devflow-env-before-build/design.md`
**Design Confirmation**: `Round 2`
**Execution**: `verified`

## Dependency graph

```text
Task 1 — Env Handoff contract and devflow route
  ├──> Task 2 — Plan/direct-Bug producers and Build gate
  └──> Task 3 — task-directory transfer contract
             |
             v
Task 4 — benchmark, packaging, and complete verification
```

Task 1 establishes the routing vocabulary consumed by Tasks 2 and 3. Tasks 2 and 3 are otherwise independent but stay sequential under `executing` mode because they share workflow contract tests. Task 4 packages only after all source contracts pass.

## Task 1 — Add Env to the Handoff protocol and devflow router

**Depends on**: none
**designCovers**: DES-001, DES-002, DES-004
**Purpose**: Make Env an explicit, thin navigation target whose only implementation owner is devflow plus `using-git-worktrees`, while preserving current type/DES/platform contracts.

**Files / bounded search area**
- Modify: `skills/references/design-traceability.md` — add Env to the shared Handoff target schema.
- Modify: `skills/devflow/SKILL.md` — route Env through `nocode:using-git-worktrees`, update the copied target Log to Build only after success, then invoke dev-build.
- Test: `hooks/workflow-consumers.test.mjs` — assert Env exists and is not an eight-stage dashboard.

### Test first

- Add assertions that the shared Handoff schema includes Env and devflow contains `Env -> using-git-worktrees -> Build`, exact task-directory input, failure stop, and platform-native invocations.
- Expected failure before implementation: Env/Handoff and worktree route patterns are absent.
- Command: `node --test hooks/workflow-consumers.test.mjs`

### Implement

- Extend only the navigation enum; keep classification exactly `bug | feat | refactor`.
- Define Env success/failure and source-to-target Log path semantics without copying the internals of the worktree Skill.
- Preserve plan-free devflow and existing process Event rules.

### Verify

- Command: `node --test hooks/workflow-consumers.test.mjs`
- Command: `node --test hooks/design-traceability.test.mjs`
- Expected: Env target and thin-router assertions pass; all existing Handoff authority checks remain green.

### Rollback / checkpoint

Revert the shared enum and devflow route together; they are one contract boundary.

## Task 2 — Route Plan and direct Bug repair through Env; guard Build

**Depends on**: Task 1
**designCovers**: DES-001, DES-004
**Purpose**: Ensure every first Build entry is produced only by a completed Env transition.

**Files / bounded search area**
- Modify: `skills/dev-design/references/handoff.md` — direct Bug repair targets Env; planned work still targets Plan.
- Modify: `skills/dev-plan/SKILL.md` — confirmed Plan persists Env Handoff and invokes devflow instead of dev-build.
- Modify: `skills/dev-build/SKILL.md` — Enter Gate requires Env-to-Build transition evidence for first entry and permits existing task-worktree reuse on later returns.
- Test: `hooks/workflow-consumers.test.mjs` — assert producer/consumer chain and native platform syntax.

### Test first

- Replace direct-Build assertions with `Plan -> Env -> devflow`; assert direct Bug route is Env and Build names the Env completion Gate.
- Expected failure before implementation: dev-plan still directly invokes dev-build, Bug Handoff still says Build, and Build lacks Env evidence.
- Command: `node --test hooks/workflow-consumers.test.mjs hooks/dev-design-contract.test.mjs`

### Implement

- Keep Plan confirmation intact, then update navigation Handoff to Env with the same artifact paths and DES scope.
- Add Claude/Codex/Pi native calls back to devflow.
- Require Build to re-read the target-worktree Log and latest Env transition; do not rerun Env for Verify/Review returns already in that workspace.

### Verify

- Command: `node --test hooks/workflow-consumers.test.mjs hooks/dev-design-contract.test.mjs hooks/design-traceability.test.mjs`
- Expected: both initial Build producers point to Env; Build accepts only successful Env evidence; stage Skills keep valid platform blocks.

### Rollback / checkpoint

Revert all three source contracts together so no producer emits an unconsumable Env target.

## Task 3 — Carry the complete task directory into the target worktree

**Depends on**: Task 1
**designCovers**: DES-002, DES-003, DES-004
**Purpose**: Preserve Design/Plan context across the Build workspace boundary without overwriting divergent documents.

**Files / bounded search area**
- Modify: `skills/using-git-worktrees/SKILL.md` — accept source checkout plus repository-relative task directory; validate containment; copy/reuse/stop after target entry and before project setup.
- Test: `hooks/workflow-consumers.test.mjs` — assert whole-directory transfer and absent/identical/divergent behavior.

### Test first

- Add source-contract assertions for `task directory`, same repository-relative destination, whole-directory `cp`, identical no-op, divergent stop, and target exact Log handoff.
- Expected failure before implementation: the Skill only carries root `mise.toml`/`.envrc` and has no task-artifact input.
- Command: `node --test hooks/workflow-consumers.test.mjs`

### Implement

- Add an optional caller-supplied task-artifact contract, used by Env and ignored for standalone worktree requests.
- Validate source task directory is inside the source repository and contains the exact Log.
- If source and target checkout differ: absent destination -> copy whole directory; byte-identical tree -> reuse; divergent tree -> report and stop without Build.
- Declare the target absolute Log path authoritative after success; never delete or update the source copy.

### Verify

- Command: `node --test hooks/workflow-consumers.test.mjs hooks/check-skills.test.mjs`
- Expected: transfer contract is explicit, platform syntax remains valid, and legacy flat sibling worktree rules still pass.

### Rollback / checkpoint

The transfer block is additive and can be removed independently only if devflow stops passing task artifacts at the same time.

## Task 4 — Add evaluation coverage, regenerate platforms, and verify preservation

**Depends on**: Task 2, Task 3
**designCovers**: DES-001, DES-003, DES-004
**Purpose**: Prove the new route under adversarial cases and ship synchronized platform outputs.

**Files / bounded search area**
- Modify: `benchmark/cases/devflow/devflow-ext-cases.json` — add Plan/direct-Bug Env and divergent-doc cases.
- Generated: `plugins/claude/nocode/`, `plugins/codex/nocode/`, `plugins/qoder/nocode/`, `plugins/pi/nocode/` — regenerate from source only.
- Verify: `hooks/*.test.mjs`, vendor sync, platform packaging, git diff/status.

### Test first

- Add benchmark expected signals that reject direct Build, require task-directory transfer, and stop on divergence.
- Expected failure before implementation: workflow source does not contain the expected route signals.
- Command: `node --test hooks/workflow-consumers.test.mjs`

### Implement

- Run `node scripts/package.platform.mjs` after all runtime source changes.
- Do not edit generated plugin trees or `plugin/metadata.json` manually.

### Verify

- Command: `node --test 'hooks/*.test.mjs'`
- Command: `node scripts/vendor-sync.mjs --check`
- Command: `node scripts/package.platform.mjs --check`
- Command: `git diff --check`
- Expected: all commands exit 0; source and four platform outputs are synchronized; version remains unchanged.

### Rollback / checkpoint

Generated trees must be reverted/regenerated with their source changes as one unit; no partial platform state.

## DES coverage

| DES ID | Task / Verify | Reason |
|---|---|---|
| DES-001 | Tasks 1, 2, 4 | Env route, all Build producers, and end-to-end contract evidence |
| DES-002 | Tasks 1, 3 | existing worktree owner receives the Env/task-artifact contract |
| DES-003 | Tasks 3, 4 | whole-directory carry and conflict-stop evidence |
| DES-004 | Tasks 1–4 | preservation enforced in every slice and complete verification |

## Checkpoints and rollback

1. Task 1 checkpoint: shared protocol and devflow recognize Env.
2. Task 2 checkpoint: no first-entry producer calls Build directly.
3. Task 3 checkpoint: destination task artifacts are safe and authoritative.
4. Task 4 checkpoint: generated outputs match source and all suites pass.

Rollback is commit-level because source Skills, shared references, tests, benchmark data, and generated platform trees form one runtime contract. No version change or persistent-data migration is involved.
