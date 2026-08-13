---
name: dev-verify
description: Use after Build to collect fresh evidence for the current design obligations before completion or Review. Not for code-reading inference or implementing fixes.
---

# dev-verify — prove the current DES obligations

No fresh evidence, no completion claim. Verify re-runs checks against the current code and environment; it never treats Build self-report as proof.

Read `{NOCODE_PLUGIN_ROOT}/skills/references/design-traceability.md` and `references/evidence-template.md`.

## Enter Gate

- [ ] The exact `design.log.md` and confirmed `design.md` paths are known.
- [ ] Build reported current changed files, commands, results, and `completedDesignCovers`.
- [ ] Every DES ID selected for this stage resolves to its full statement.
- [ ] The current Handoff and design semantics still match the repository evidence.

## Step 0 — Create Verify milestones

Create five stable milestones:

1. Load the current DES scope and choose evidence methods.
2. Run tests, build, integration, and applicable domain checks.
3. Produce the DES evidence matrix.
4. Resolve failures or design contradictions.
5. Report evidence and hand off Review.

Use a text milestone list with at most one in-progress item. Verify-to-Review handoff uses `/skill:dev-review`.

## Step 1 — Build the evidence plan

Re-read the exact Log, current Handoff, `design.md`, named DES definitions, Plan when present, and Build results. Start with the current DES scope rather than an old scenario, Registry, revision, or digest.

For each implementation, preserve, and verification DES ID, choose one or more evidence methods:

- focused and complete automated tests;
- build, typecheck, lint, or static analysis;
- integration / contract execution across real seams;
- browser / E2E checks for UI flows;
- performance measurement when the DES statement sets a target;
- failure / recovery execution for external dependencies;
- inspection only when the obligation cannot be executed, with exact file / configuration evidence.

Read shared testing, security, performance, observability, or frontend guides only when the current DES scope requires them. Read `references/e2e-guide.md` for UI work and `references/performance-guide.md` for performance work.

## Step 2 — Collect fresh evidence

For every claim: identify the proving command or observation, run it after the current changes, read the complete relevant output and exit status, then state only what that output proves.

At minimum:

1. Inspect the actual diff and current working tree.
2. Run focused regression tests and the relevant complete suite / build checks.
3. Exercise integration seams and error paths named by the design.
4. For UI changes, execute the designed paths and capture current screenshots / browser evidence.
5. For performance or resilience obligations, measure the named target or failure behavior in a controlled environment.

Flaky, stale, inferred, or implementer-reported evidence does not pass.

## Step 3 — Produce DES evidence

Create a current matrix from the DES IDs selected by the Handoff and retained by Plan / Build:

```markdown
| DES ID | Result | Evidence type | Evidence |
|---|---|---|---|
| DES-001 | pass | test | `<command>` — <key current output> |
| DES-004 | fail | integration | `<command>` — <failure> |
```

Each row points to the full DES statement and contains reproducible evidence. A DES ID may need several evidence rows. Accepted non-blocking Open items remain explicit and are not counted as passed obligations.

## Step 4 — Route failures precisely

- Current evidence fails an obligation without changing the design → return the exact DES ID and evidence to Build.
- Evidence changes goal, scope, solution, contract, Preserve, acceptance, or DES meaning → return it to the same dev-design Log for a new LOG item and, when needed, a superseding DES ID.
- A purely incomplete task mapping → return to Plan.
- Tool or environment unavailable → report the exact unverified DES IDs; do not convert them to pass.

After any implementation change, recollect affected evidence. Do not reuse a previously green row.

## Step 5 — Hand off Review

Report commands, key outputs, artifacts, passed / failed / unverified DES IDs, and any accepted Open items. When every required obligation passes, hand off the exact Log path, design path, Plan path when present, DES scope, Build diff range, and Verify evidence to Review.

## Exit Gate

- [ ] Evidence is current and reproducible.
- [ ] Every required DES ID has sufficient passing evidence.
- [ ] No failed or unverified required obligation is hidden by aggregate test success.
- [ ] Current Handoff and DES semantics still match observed reality.
- [ ] Performance, UI, security, observability, and recovery checks ran when required.
- [ ] Review received exact artifact paths, DES context, diff range, and evidence.

## Red flags

- “The code looks correct” used as runtime evidence
- A green slice test substituted for the relevant full suite
- Comparing revision or digest fields instead of reading the current design
- Reporting “mostly passed” while one required DES ID failed
- Reusing evidence collected before the latest code change
