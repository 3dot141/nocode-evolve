# Confirmation and Handoff

Read this reference after `design.md` passes the four minimum checks.

## One confirmation

Show the complete `design.md`, its opening panorama, active DES IDs, accepted non-blocking Open items, and recommended next Skill. One explicit user confirmation approves both the baseline and the named next target.

If the user changes content, complete the current ROUND, reopen affected blocks, update DEC / DES coverage, rerun closure and the four checks, then ask again. Do not create a second confirmation object.

Upper-half confirmation is a ROUND that unlocks the lower half. It is not a Handoff.

## Persist confirmation

Complete the confirmation ROUND with the user's full 回答. Confirmation authorizes the baseline but does not create a Decision or DES source. Then record that ROUND in the Handoff:

```yaml
ConfirmedBy: ROUND-N
```

Set `design.md` status to `confirmed`. Do not create a `kind: design-confirmation` Decision, receipt, manifest, revision, digest, or per-DES approval state.

## Same-Log Handoff

```yaml
From: dev-design
To: Debug | Plan | Env
ConfirmedBy: ROUND-N
Reason: string
Read:
  design: ./design.md
  designIds: [DES-...]
Preserve: [DES-...]
Open: []
```

`Open` contains only explicitly accepted non-blocking items, each with an owner and the point where it resolves; an open item nobody owns is dead weight, not an accepted unknown. A blocking item prevents Handoff. Handoff is navigation, not a place to add design facts.

Routes:

- Bug problem baseline -> Debug.
- Bug repair baseline -> Env when one independently verifiable repair slice has no ordered dependencies, migration, coexistence, public-contract change, rollout, or multiple checkpoints; otherwise Plan. Env prepares the workspace and then routes to Build without changing DES meaning.
- Feat -> Plan.
- Refactor -> Plan.

Pass the exact Log path with the Handoff. Handoff does not close the Log. Design-changing evidence returns to the same dev-design Log; Land, cancellation, or termination closes it.
