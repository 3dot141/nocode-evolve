---
name: devflow
description: Use when an engineering task needs routing across design, implementation, verification, review, or landing, or when the user explicitly asks for devflow. Not for product discovery or explanation-only requests.
---

# devflow — thin engineering router

devflow has one job: preserve one task identity while routing it through the Skill that owns the current work. It does not reproduce another Skill's method, Gate, checklist, or plan.

## Invariants

- Every task has one exact repository-relative `design.log.md` identity. Pass its active absolute path unchanged within a workspace; when Env changes checkout, the transfer moves the task directory to the same repository-relative path in the destination and leaves no duplicate in the source — that destination becomes the exact path for every later handoff.
- Classify only `bug | feat | refactor`; never restore Full / Standard / Fix / Mini.
- One primary independently acceptable outcome gets one type. Split only independently acceptable outcomes that can hand off separately.
- `dev-design` owns design Decisions. devflow may write only the classification Decision and append classification / stage process entries to the Log; it cannot interpret or rewrite any other Decision.
- The current Log Handoff chooses the next Skill. devflow never guesses around it.
- A Log whose Header `status` is terminal (`landed | cancelled | terminated`) is closed forever: it is never resumed and never receives new design content. New input after a completed round starts a new Log (a full new devflow round) linked back through `predecessor`; only a process pointer Event may be appended to the closed Log.

## Step 1 — Resolve the active Log

Enter Gate: an engineering request or an exact existing Log path is available.

1. If the caller provides an exact `design.log.md`, read it and keep that path. Check Header `status` first:
   - `active` with a current Handoff and no new evidence changing classification or design meaning -> resume at Step 4 instead of re-entering dev-design.
   - terminal (`landed | cancelled | terminated`) -> the previous round is complete. Do not resume: create a new Log per step 2 for the new input and run a full new devflow round. Record the old Log's repository-relative path in the new Log Header `predecessor`, and append `Event N — successor` (detail: new Log path, `decisionImpact: none`) to the old Log.
   - `active` but the new input is a genuinely new outcome and the previous round is effectively finished (e.g., built but not landed) -> close the old Log first (task-end Event plus Header `status`), then create the new Log as above.
2. Otherwise create `docs/dev/{username}/{yymmdd}-{serial}-{topic}/design.log.md` using the path rules carried by `dev-design`, with Header `predecessor: 无`.
3. If an existing task could match but no exact path can be proven, ask for the path instead of fuzzy-resuming another Log.

Exit Gate: one exact Log path is known.

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

## Step 3 — Enter dev-design

Pass the request, classification, exact Log path, known artifacts, constraints, and return evidence to `dev-design`.

Use `/dev-design`.

Exit Gate: `dev-design` has written a current Handoff or explicitly returned to grilling.

## Step 4 — Follow the current Handoff

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

### Env boundary before Build

When the current Handoff target is Env, pass `taskArtifacts` containing the source project root, the repository-relative directory that contains the exact Log, and the exact Log path to `nocode:using-git-worktrees`. That Skill owns workspace detection, creation or authorized in-place use, entry, project setup, baseline verification, and task-directory transfer; devflow does not duplicate those steps.

Use `/using-git-worktrees`. After its successful result, use `/dev-build` with the complete Handoff context.

On success, re-read the destination exact Log returned by the workspace Skill. In that destination Log, change only the navigation Handoff from Env to Build, preserving the Plan path when present, `design.md`, DES scope, Preserve, Open, and confirmation evidence. Append the stage-transition Event with the active workspace path and task-artifact result, then invoke Build.

If Env or task-artifact transfer fails, keep the Handoff target at Env, report the concrete evidence, and do not invoke Build. An explicitly authorized in-place workspace is a successful Env result; because its task directory is already active, it needs no transfer.

Exit Gate: the target Skill received the exact Log path and DES scope.

## Step 5 — Handle return or end

- Evidence that changes `design.md`, a Preserve obligation, acceptance, or the selected solution returns to the same `dev-design` Log.
- Local implementation choices that preserve the design remain in the current Skill.
- Bug problem design returns from Debug to the same Log for repair design.
- Verify or Review failures that do not change design return to Build; design conflicts return to dev-design.
- Land success, explicit cancellation, or explicit termination closes the active Log. A closed Log is never reopened: new input after closure starts a new Log linked back through `predecessor` (see Step 1); genuinely new outcomes likewise create new Logs.
- After a target returns, append its result and evidence location as `Event N — returned-evidence` before choosing the next route. Set `decisionImpact` to `none` until dev-design forms or supersedes a Decision from it; no other Skill writes that Decision.

## Exit Gate

- [ ] The task has one exact Log path.
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
