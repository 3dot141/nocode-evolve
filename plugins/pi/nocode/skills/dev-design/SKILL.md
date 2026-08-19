---
name: dev-design
description: Use when an engineering task needs goal clarification, first-principles grilling, solution design, a technical design document, or a return that may change an existing design baseline. Not for implementation, task planning, code review, or product discovery.
---

# dev-design — grill, close, design

**Iron Law:** do not write the lower half before the upper half is confirmed. Persist the current ROUND before asking the next question. Feat 产品 does not read implementation to learn what the system already does.

`dev-design` is the only writer of design facts in the task Log. Its `SKILL.md` is only the trunk; load one private reference at a time for the current type and step.

## Stable artifacts

```text
docs/dev/{username}/{yymmdd}-{serial}-{topic}/
├── design.log.md   DEC + ROUND
├── design.md       normative design and DES IDs
└── design.html     optional derived rendering
```

One task keeps the same paths through reclassification, Debug return, implementation return, and cross-day resume.

## Step 1 — Open the task

Enter Gate: request plus either an exact Log path or enough information to create one.

1. Resolve the task directory and initialize or re-read `design.log.md` using `references/grilling.md`. A Log with terminal Header `status` (`landed | cancelled | terminated`) is never reopened — return it to devflow, which starts a new Log for the new input.
2. Confirm its current `DEC-###` classification is `bug | feat | refactor`. If classification evidence changes, append a superseding Decision and preserve the process in a ROUND; do not overwrite history.
3. Re-read the Header, Decisions, latest ROUND, and Handoff before writing.

Exit Gate: one exact Log and one current type are available.

## Step 2 — Grill the current phase

Use the interview method of the `grill-me` skill, and read `references/grilling.md` for the Log protocol. Use the type file only as a coverage check, never as the next-question script:

Interview method: use `/skill:grill-me`.

- bug: `references/bug/questions.md`
- feat: `references/feat/questions.md`
- refactor: `references/refactor/questions.md`

Phases:

| type | upper | lower |
|---|---|---|
| feat | 产品 | 开发 |
| refactor | Before | After |
| bug | 问题 | 修复 |

For each turn:

1. Investigate only the facts this phase allows. Feat 产品 does not read implementation to learn what the system already does. Bug 问题 and refactor Before may read only to record current structure, actual, or repro. Lower half reads the active block first.
2. Select the earliest unclosed task-tree node whose dependencies are closed.
3. Persist a waiting ROUND with one question, a recommended 方案, and empty 过程.
4. Ask that one question and stop the turn.
5. On reply, write the full lossless 过程, update DEC `描述` / `内容` / `过程` / `引用`, and close the ROUND. For the next decision, persist a new waiting ROUND, ask that one question, and stop the turn.

Never ask the user for a fact the environment can prove. Never use a confidence percentage as a substitute for closing a required branch. Never recommend a design because it is smaller or faster.

When the upper tree is empty, write the upper half of `design.md` from confirmed DEC IDs, persist a confirmation ROUND, write a DEC whose `描述` is that the upper half is confirmed (no DES), and stop. Do not start the lower half until that ROUND is closed. A bug 问题 confirmation hands off to Debug.

When a lower-half block is closed, append that block to `design.md` (接口, 伪代码, 影响文件) inside its function group before the next question.

Exit Gate: every applicable coverage item for the current half is confirmed, evidence-backed n/a, or superseded.

## Step 3 — Run type closure

Read only the current closure protocol:

- bug: `references/bug/closure.md`
- feat: `references/feat/closure.md`
- refactor: `references/refactor/closure.md`

Run this step only after the current half’s tree is empty. After 产品 / Before / 问题 confirmation, use only that half’s Gate. After 开发 / After / 修复 is written, use the lower-half Gate. A gap reopens the responsible block and returns to Step 2.

Exit Gate: the type closure protocol passes with evidence.

## Step 4 — Finish the design baseline

Read `references/writing.md` plus the current type document protocol:

- bug: `references/bug/document.md`
- feat: `references/feat/document.md`
- refactor: `references/refactor/document.md`

Generate or update `design.md` from confirmed DEC IDs. Do not invent missing decisions while writing. Assign immutable `DES-###` only to independent investigation, implementation, preservation, migration, contract, observability, or verification obligations.

Before full confirmation, prove all four checks:

1. the current type’s upper and lower coverage items are closed;
2. every design-required DEC ID maps to a DES ID or an explicit n/a reason;
3. every DES ID cites at least one sourceDecisionId;
4. key ASCII diagrams and prose express the same relationships.

Any failure returns to Step 2. Do not add a score, verdict, revision, digest, Packet, Registry, or review state machine.

Exit Gate: `design.md` passes all four checks.

## Step 5 — Confirm and hand off

Read `references/handoff.md`. Show the complete design baseline, including its one-screen panorama, active DES IDs, accepted non-blocking Open items, and recommended target. One explicit user confirmation approves the entire baseline and its named next Skill.

After confirmation, close the confirmation ROUND and record it in the same-Log Handoff as `ConfirmedBy: ROUND-N`. Confirmation is process authorization, not a Decision and not a DES source. Downstream Skills consume `design.md` and DES IDs; they read Decisions for origin and the Log only when they need process history.

If the user explicitly requests HTML, read `references/render.md` after `design.md` exists. Rendering is never a confirmation or Handoff Gate.

Exit Gate: confirmation and Handoff are persisted before routing.

## Bug return

Bug uses one Log and one `design.md` in two passes:

```text
problem baseline -> Debug -> root-cause evidence -> repair baseline -> Env or Plan
```

Debug results enter the process Log as returned evidence. Any formed design meaning becomes a new or superseding DEC ID. Investigation DES IDs remain addressable; a disproven obligation is superseded by a new DES ID, never renumbered or deleted.

## Global Exit Gate

- [ ] One exact Log and one `design.md` are current.
- [ ] Every asked question was persisted before the next one.
- [ ] Type closure and the four writing checks pass.
- [ ] User confirmation and Handoff are in the same Log.
- [ ] Any requested HTML is derived and non-normative.

## Red flags

- Writing the lower half or a solution panorama before the upper half is confirmed
- Asking multiple decisions in one turn
- Updating `design.md` without first updating its source Decisions and ROUND
- Letting another Skill write design facts
- Creating ADR, Packet, Registry, receipt, revision, digest, or a second design file by default
- Walking F / B / R question numbers to pick the next question
- Recommending a design because it is compatible or fast
