---
name: dev-build
description: Use to implement a confirmed Plan or a confirmed single-slice Bug repair. Not for changing design decisions, decomposing unresolved work, or explanation-only requests.
---

# dev-build — execute the current DES scope

Build implements exactly the DES obligations selected by the current Handoff. It consumes design facts; it does not amend them.

Read `{NOCODE_SKILL_REF}/design-traceability.md`, `{NOCODE_SKILL_REF}/source-comment-contract.md`, and the execution reference selected in Step 1.

## Enter Gate

- [ ] The exact `design.log.md` and confirmed `design.md` paths are known.
- [ ] The current Handoff target is Build and every named DES ID resolves.
- [ ] The active task Log contains a successful `Env -> Build` stage-transition for this workspace, including an explicitly authorized in-place Env when applicable. A later Verify or Review return may reuse that existing Env evidence in the same task workspace; it does not create Env again.
- [ ] Either a confirmed Plan exists, or this is a Bug repair Handoff containing one independently verifiable slice with no ordered dependency, migration, coexistence, public-contract change, rollout, or multiple checkpoint.
- [ ] No blocking Open item exists.

If work is undefined, return to dev-design. If a confirmed design needs decomposition, return to Plan.

## Step 0 — Create Build milestones

Create four stable milestones; do not mirror every implementation task in the platform plan:

1. Load the current Handoff and choose the execution protocol.
2. Execute each slice and collect DES-scoped results.
3. Independently inspect the diff and run verification.
4. Report Build completion and hand off Verify.

<!-- nocode:platform claude -->
Use `TaskCreate` / `TaskUpdate`. Build-to-Verify handoff uses `Skill(nocode:dev-verify)`.
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
Use `update_plan` with the stable list and at most one `in_progress`. Build-to-Verify handoff uses `$dev-verify`.
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
Use a text milestone list with at most one in-progress item. Build-to-Verify handoff uses `/skill:dev-verify`.
<!-- /nocode:platform -->

## Step 1 — Load scope and choose execution

Re-read the exact Log, current Handoff, `design.md`, and named DES definitions.

- Confirmed Plan: use its tasks, dependencies, `designCovers`, and `Execution` value.
- Direct Bug Build: create one in-memory slice whose `designCovers` is exactly the repair Handoff's DES IDs; use `executing`.

Execution protocols:

- `executing` → read `references/dev-build-executing.md`.
- `subagent-lite` or `subagent-full` → read `references/dev-build-subagent.md`.
- Legacy `subagent` → treat as `subagent-full`.

Before each slice, compare repository evidence with the current Handoff and DES statements. A task-graph problem returns to Plan. Evidence that changes goal, scope, solution, contract, Preserve, acceptance, or DES meaning returns to dev-design with the exact Log path and evidence.

## Step 2 — Execute and record results

Execute slices in dependency order. Every completed result contains:

```yaml
completedDesignCovers: [DES-...]
changedFiles: []
evidence:
  - command: string
    result: string
```

`completedDesignCovers` must equal that slice's `designCovers`. Missing IDs, extra IDs, placeholder implementation, or absent current evidence keeps the slice incomplete.

Use test-first execution where behavior can be expressed by a test: observe the relevant failure, make the smallest implementation, then run the focused check. Follow `references/implementer-disciplines.md` for scope lock and repository-drift handling.

## Step 3 — Independent Build verification

Do not trust implementer self-report:

1. Read the actual diff and check scope, generated-file ownership, and source-comment quality.
2. Run focused tests and the relevant complete suite / build / typecheck.
3. Check implementation and preserve obligations against each DES statement.
4. Scan the changed surface for empty bodies, TODO / implement placeholders, and `not implemented` failures.
5. Start from the Handoff DES IDs and prove every implementation / preserve ID appears in exactly the expected completed results. Retain verify-only IDs for Verify.

Any implementation failure returns to its Build slice. Any design-semantic contradiction returns to dev-design.

Commit only when the repository's own instructions and the user's authorization require it. Build must never invent a universal commit policy.

## Step 4 — Hand off Verify

Report changed files, commands run, results, per-slice review coverage, `completedDesignCovers`, and verify-only DES IDs. Then hand off the exact Log path, design path, Plan path when present, current DES scope, Preserve, Open, and Build evidence to Verify.

## Exit Gate

- [ ] All confirmed Plan tasks, or the one direct Bug slice, are complete.
- [ ] Every implementation / preserve Handoff DES ID has exact Build coverage; no slice claimed extra IDs.
- [ ] Relevant tests and build checks pass with current output.
- [ ] No placeholder or empty-shell implementation remains.
- [ ] Source comments and generated files follow repository contracts.
- [ ] Current Handoff still targets Build with the same DES semantics.
- [ ] Verify received exact artifact paths, DES IDs, and current evidence.

## Red flags

- Comparing revision or digest fields instead of reading the current Log and Handoff
- Silently changing DES scope because implementation was inconvenient
- Treating a dispatched agent or a green typecheck as completed functionality
- Committing despite repository instructions requiring user confirmation
- Calling a design conflict a Plan or Build detail
