---
name: devflow
description: Use when an engineering task needs routing across design, implementation, verification, review, or landing, or when the user explicitly asks for devflow. Not for product discovery or explanation-only requests.
---

# devflow — thin engineering router

devflow has one job: preserve one task identity while routing it through the Skill that owns the current work. It does not reproduce another Skill's method, Gate, checklist, or plan.

## Invariants

- Every task has one exact `design.log.md` path. Pass it unchanged at every handoff.
- Classify only `bug | feat | refactor`; never restore Full / Standard / Fix / Mini.
- One primary independently acceptable outcome gets one type. Split only independently acceptable outcomes that can hand off separately.
- `dev-design` owns design Decisions. devflow may write only the classification Decision and append classification / stage process entries to the Log; it cannot interpret or rewrite any other Decision.
- The current Log Handoff chooses the next Skill. devflow never guesses around it.

## Step 1 — Resolve the active Log

Enter Gate: an engineering request or an exact existing Log path is available.

1. If the caller provides an exact `design.log.md`, read it and keep that path.
2. Otherwise create `docs/dev/{username}/{yymmdd}-{serial}-{topic}/design.log.md` using the path rules carried by `dev-design`.
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

Record the classification process first: use a `Round N` when user input resolved ambiguity, otherwise an `Event N — classification` with evidence and rejected alternatives. Then write `DEC-### kind: classification`, pointing `sourceEntries` to that Log entry and carrying any split relation. Reclassification creates a new Decision with `supersedes`; it never edits the old meaning. Keep the same Log while the primary outcome is unchanged.

Exit Gate: the active Log has one current classification.

## Step 3 — Enter dev-design

Pass the request, classification, exact Log path, known artifacts, constraints, and return evidence to `dev-design`.

<!-- nocode:platform claude -->
Use `Skill(nocode:dev-design)`.
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
Use `$dev-design`.
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
Use `/skill:dev-design`.
<!-- /nocode:platform -->

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
| Build | `nocode:dev-build` |
| Verify | `nocode:dev-verify` |
| Review | `nocode:dev-review` |
| Land | `nocode:dev-land` |
| dev-design | `nocode:dev-design` |

Use the platform-native Skill invocation for the named target. Do not unfold its internal steps in devflow.

Exit Gate: the target Skill received the exact Log path and DES scope.

## Step 5 — Handle return or end

- Evidence that changes `design.md`, a Preserve obligation, acceptance, or the selected solution returns to the same `dev-design` Log.
- Local implementation choices that preserve the design remain in the current Skill.
- Bug problem design returns from Debug to the same Log for repair design.
- Verify or Review failures that do not change design return to Build; design conflicts return to dev-design.
- Land success, explicit cancellation, or explicit termination closes the active Log. New outcomes create new Logs.
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
