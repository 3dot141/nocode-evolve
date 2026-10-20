---
name: devflow
description: "Use when an engineering task needs routing across design, implementation, verification, review,…"
---

# devflow — thin engineering router

devflow has one job: preserve one task identity while routing it through the Skill that owns the current work. It does not reproduce another Skill's method, Gate, checklist, or plan.

## Invariants

- Every task has one exact repository-relative `design.log.md` identity, created **inside the task's Env** (Step 3) — never in a source checkout that the work does not belong to. Pass its active absolute path unchanged for every handoff; when the Env changes checkout, the transfer moves the task directory to the same repository-relative path in the destination and leaves no duplicate in the source — that destination becomes the exact path for every later handoff.
- Env precedes design. Design decisions are checked against the task workspace's real baseline (branch, commit, dependencies), not an abstract or stale checkout. If the Env cannot be established, stop and report instead of designing in the wrong place.
- Classify only `bug | feat | refactor`; never restore Full / Standard / Fix / Mini.
- One primary independently acceptable outcome gets one type. Split only independently acceptable outcomes that can hand off separately.
- `dev-design` owns design Decisions. devflow may write only the classification Decision and append classification / stage process entries to the Log; it cannot interpret or rewrite any other Decision.
- The current Log Handoff chooses the next Skill. devflow never guesses around it.
- A Log whose Header `status` is terminal (`landed | cancelled | terminated`) is closed forever: it is never resumed and never receives new design content. New input after a completed round starts a new Log (a full new devflow round) linked back through `predecessor`; only a process pointer Event may be appended to the closed Log.

## Step 1 — Resolve the task repository and the Log

Enter Gate: an engineering request or an exact existing Log path is available.

1. Determine the task repository first. The work may belong to the current repository or to a linked physical repository; the task repository owns both the Env and the Log. If it cannot be determined from the request, artifacts, or repository state, ask once before creating anything.
2. If the caller provides an exact `design.log.md`, read it and keep that path. Check Header `status` first:
   - `active` with a current Handoff, an already-ready Env, and no new evidence changing classification or design meaning -> resume at Step 5 instead of re-entering dev-design.
   - terminal (`landed | cancelled | terminated`) -> the previous round is complete. Do not resume: plan a new Log per step 3 for the new input and run a full new devflow round. Record the old Log's repository-relative path in the new Log Header `predecessor`, and append `Event N — successor` (detail: new Log path, `decisionImpact: none`) to the old Log.
   - `active` but the new input is a genuinely new outcome and the previous round is effectively finished (e.g., built but not landed) -> close the old Log first (task-end Event plus Header `status`), then plan the new Log as above.
3. Otherwise plan the Log path `docs/dev/{username}/{yymmdd}-{serial}-{topic}/design.log.md` using the path rules carried by `dev-design`, with Header `predecessor: 无`. The file itself is created inside the Env in Step 3.
4. If an existing task could match but no exact path can be proven, ask for the path instead of fuzzy-resuming another Log.

Exit Gate: the task repository is known and one exact repository-relative Log path is planned.

## Step 2 — Classify the primary outcome

Use outcome evidence, not the user's label or implementation verbs:

```text
Does current behavior violate an authoritative expectation that predated this request?
  yes -> bug
  no  -> Does the requested result add externally observable behavior?
           yes -> feat
           no  -> Does it change internal structure while preserving agreed behavior?
                    yes -> refactor
                    no  -> ask one question that best separates the remaining types
```

If several requested results can be accepted and handed off independently, split them into separate task Logs and record the links. A refactor needed to deliver one feature remains part of the feat; a structural repair needed for one bug remains part of the bug.

Record the classification process first: use a `ROUND-N` when user input resolved ambiguity, otherwise an `Event N — classification` with evidence and rejected alternatives. Then write `DEC-###` with 描述 / 内容 / 过程 / 引用 pointing at that Log entry. Reclassification creates a new Decision and records succession in `过程`; it never edits the old meaning. Keep the same Log while the primary outcome is unchanged.

Exit Gate: the active Log has one current classification.

## Step 3 — Establish the Env before design

Enter Gate: the task repository is known and the classification is recorded.

1. Route to the workspace Skill with `taskArtifacts`: task repository root, branch name, base ref, and the planned repository-relative Log directory.

Use `$using-git-worktrees`.

2. That Skill owns workspace detection, creation or authorized in-place use, dependency provisioning, baseline verification, and task-directory transfer; devflow does not duplicate those steps.
3. Wait for a successful Env result before any design work. An explicitly authorized in-place workspace is a successful result.
4. Create the Log inside the Env at its planned repository-relative path, or move an existing Log into it without leaving a duplicate in the source checkout. Record Header `workspace` as absolute path, branch, base commit, and baseline result.

Exit Gate: the exact Log path exists inside a ready Env and the baseline is verified.

## Step 4 — Enter dev-design

Pass the request, classification, exact Log path (inside the Env), known artifacts, constraints, and return evidence to `dev-design`. Design work happens inside the Env so every Decision is checked against the real baseline.

Use `$dev-design`.

Exit Gate: `dev-design` has written a current Handoff or explicitly returned to grilling.

## Step 5 — Follow the current Handoff

Re-read the Log before routing. Pass its exact path, `design.md`, selected DES IDs, Preserve obligations, accepted Open items, and returned evidence.

Before invoking the target, append one minimal process entry:

```markdown
## Event N — stage-transition
- source: current Handoff
- detail: <From> -> <To>
- decisionImpact: none
```

Events are append-only history. The current Handoff, not supersession between Events, identifies the current stage. A stage Event never receives a DEC ID or `designDisposition`.

| Handoff target | Skill |
|---|---|
| Debug | `nocode:systematic-debugging` |
| Plan | `nocode:dev-plan` |
| Env | `nocode:using-git-worktrees` |
| Build | `nocode:dev-build` |
| Verify | `nocode:dev-verify` |
| Review | `nocode:dev-review` |
| Land | `nocode:dev-land` |
| dev-design | `nocode:dev-design` |

Use the platform-native Skill invocation for the named target. Do not unfold its internal steps in devflow.

### Env boundary

The Env normally already exists from Step 3, so a Build handoff proceeds directly. Route to Env only when design evidence requires an environment independent of the current workspace (for example, a different repository or a fresh baseline); in that case pass `taskArtifacts` containing the source project root, the repository-relative directory that contains the exact Log, and the exact Log path.

For an Env handoff use `$using-git-worktrees`. After its successful result, use `$dev-build` with the complete Handoff context.

After an Env handoff, re-read the destination exact Log. Change only the navigation Handoff from Env to Build, preserving the Plan path when present, `design.md`, DES scope, Preserve, Open, and confirmation evidence. Append the stage-transition Event with the active workspace path and task-artifact result, then invoke Build.

If an Env handoff or task-artifact transfer fails, keep the Handoff target at Env, report the concrete evidence, and do not invoke Build.

Exit Gate: the target Skill received the exact Log path and DES scope.

## Step 6 — Handle return or end

- Evidence that changes `design.md`, a Preserve obligation, acceptance, or the selected solution returns to the same `dev-design` Log.
- Local implementation choices that preserve the design remain in the current Skill.
- Bug problem design returns from Debug to the same Log for repair design.
- Verify or Review failures that do not change design return to Build; design conflicts return to dev-design.
- Land success, explicit cancellation, or explicit termination closes the active Log. A closed Log is never reopened: new input after closure starts a new Log linked back through `predecessor` (see Step 1); genuinely new outcomes likewise create new Logs.
- After a target returns, append its result and evidence location as `Event N — returned-evidence` before choosing the next route. Set `decisionImpact` to `none` until dev-design forms or supersedes a Decision from it; no other Skill writes that Decision.

## Exit Gate

- [ ] The task repository is known.
- [ ] The task Log lives inside a verified Env (workspace, dependencies, baseline) created before design.
- [ ] The current type is exactly bug, feat, or refactor and has a current classification Decision plus its process Log entry.
- [ ] Every handoff used the Log's current target and DES scope.
- [ ] Design-changing evidence returned to dev-design.
- [ ] Ended tasks record Land, cancellation, or termination.

## Never add back

- Eight-stage dashboards or global phase checklists
- Full / Standard / Fix / Mini routing
- A devflow-owned workflow plan
- Copies of another Skill's sub-steps or Gate
- Fuzzy Log discovery or ambient-context handoffs
