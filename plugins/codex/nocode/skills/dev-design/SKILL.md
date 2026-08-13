---
name: dev-design
description: "Use when an engineering task needs goal clarification, first-principles grilling, solution desi…"
---

# dev-design — grill, close, design

**Iron Law:** do not create a solution panorama before the relevant questions are closed. Persist the current round before asking the next question.

`dev-design` is the only writer of design facts in the task Log. Its `SKILL.md` is only the trunk; load one private reference at a time for the current type and step.

## Stable artifacts

```text
docs/dev/{username}/{yymmdd}-{serial}-{topic}/
├── design.log.md   process facts and history
├── design.md       normative design and DES IDs
└── design.html     optional derived rendering
```

One task keeps the same paths through reclassification, Debug return, implementation return, and cross-day resume.

## Step 1 — Open the task

Enter Gate: request plus either an exact Log path or enough information to create one.

1. Resolve the task directory and initialize or re-read `design.log.md` using `references/grilling.md`.
2. Confirm its current `DEC-### kind: classification` is `bug | feat | refactor`. If classification evidence changes, append a superseding Decision and preserve the process in the Log; do not overwrite history.
3. Re-read the Header, Decisions, Decision Tree, Terms, Handoff, and latest Log entry before writing.

Exit Gate: one exact Log and one current type are available.

## Step 2 — Grill one decision at a time

Read `references/grilling.md`, then only the current type's question tree:

- bug: `references/bug/questions.md`
- feat: `references/feat/questions.md`
- refactor: `references/refactor/questions.md`

For each turn:

1. Investigate facts available from code, tests, docs, logs, or supplied evidence.
2. Select the earliest unclosed node whose dependencies are closed.
3. Persist a waiting Round with one question, a recommended answer, and reasons.
4. Ask that one question and stop the turn.
5. On reply, persist the full decision-bearing answer, Decision / term / flow changes, and next node before asking anything else.

Never ask the user for a fact the environment can prove. Never use a confidence percentage as a substitute for closing a required branch.

Exit Gate: every applicable type node is confirmed, evidence-backed n/a, or superseded; no blocking dependency remains.

## Step 3 — Run type closure

Read only the current closure protocol:

- bug: `references/bug/closure.md`
- feat: `references/feat/closure.md`
- refactor: `references/refactor/closure.md`

Closure is bidirectional: every flow, rule, constraint, failure, solution element, acceptance condition, and evidence method must have its required counterpart. A gap reopens the responsible decision-tree node and returns to Step 2.

Exit Gate: the type closure protocol passes with evidence.

## Step 4 — Write the design baseline

Read `references/writing.md` plus the current type document protocol:

- bug: `references/bug/document.md`
- feat: `references/feat/document.md`
- refactor: `references/refactor/document.md`

Generate or update `design.md` from confirmed DEC IDs. Do not invent missing decisions while writing. Assign immutable `DES-###` only to independent investigation, implementation, preservation, migration, contract, observability, or verification obligations.

Before confirmation, prove all four checks:

1. the type decision tree is closed;
2. every design-required DEC ID maps to DES ID or an explicit n/a reason;
3. every DES ID cites at least one sourceDecisionId;
4. key ASCII diagrams and prose express the same relationships.

Any failure returns to Step 2. Do not add a score, verdict, revision, digest, Packet, Registry, or review state machine.

Exit Gate: `design.md` passes all four checks.

## Step 5 — Confirm and hand off

Read `references/handoff.md`. Show the complete design baseline, including its one-screen panorama, active DES IDs, accepted non-blocking Open items, and recommended target. One explicit user confirmation approves the entire baseline and its named next Skill.

After confirmation, close the confirmation Round and record it in the same-Log Handoff as `ConfirmedBy: Round N`. Confirmation is process authorization, not a Decision and not a DES source. Downstream Skills consume `design.md` and DES IDs; they read Decisions for origin and the Log only when they need process history.

If the user explicitly requests HTML, read `references/render.md` after `design.md` exists. Rendering is never a confirmation or Handoff Gate.

Exit Gate: confirmation and Handoff are persisted before routing.

## Bug return

Bug uses one Log and one `design.md` in two passes:

```text
problem baseline -> Debug -> root-cause evidence -> repair baseline -> Build or Plan
```

Debug results enter the process Log as returned evidence. Any formed design meaning becomes a new or superseding DEC ID. Investigation DES IDs remain addressable; a disproven obligation is superseded by a new DES ID, never renumbered or deleted.

## Global Exit Gate

- [ ] One exact Log and one `design.md` are current.
- [ ] Every asked question was persisted before the next one.
- [ ] Type closure and the four writing checks pass.
- [ ] User confirmation and Handoff are in the same Log.
- [ ] Any requested HTML is derived and non-normative.

## Red flags

- Writing a panorama or solution before closing its prerequisite questions
- Asking multiple decisions in one turn
- Updating `design.md` without first updating its source Decisions and process Log
- Letting another Skill write design facts
- Creating ADR, Packet, Registry, receipt, revision, digest, or a second design file by default
- Reading all type references at entry instead of loading only the current type and step
