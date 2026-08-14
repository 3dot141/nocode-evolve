# Writing and DEC-to-DES protocol

Read this reference when writing or appending `design.md`. Type `document.md` owns chapter titles.

## Source fidelity

Within `design.log.md`, Decisions are the current semantic source and ROUND entries are the chronological source for how they formed. `design.md` is the normative downstream baseline derived from confirmed DEC IDs. Writing consumes each Decision’s `描述` and `内容` together; it may organize and explain confirmed content but cannot create a decision. A missing decision reopens its block.

Use fixed frontmatter:

```yaml
---
type: bug | feat | refactor
status: proposed | confirmed
sourceLog: ./design.log.md
artifacts:
  design: ./design.md
  render: ./design.html # include only when the file exists
---
```

Write the upper half after that half is confirmed. The lower half must not appear before that confirmation. Append each lower-half block only after its ROUND is closed.

## DES IDs

Create a DES ID only when the statement can be independently investigated, planned, implemented, preserved, migrated, or verified:

```markdown
### DES-001 — <short title>

- kind: investigation | behavior | structure | contract | data | migration | preserve | observability | verification
- statement: <one independently judgeable obligation>
- sourceDecisionIds: DEC-...
- supersedes: DES-... # only when needed
```

Background, evidence summaries, alternatives, and design rationale do not receive DES IDs unless they create an obligation. Do not assign IDs to mere file moves, renames, fields, or individual functions unless that element carries an independently judgeable result.

DES IDs are task-local, monotonically assigned, never renumbered, reused, or silently redefined. Semantic change creates a new ID and supersedes the old one.

## Bidirectional coverage

At the end of `design.md`, add one light coverage view:

| Decision ID | Design disposition | DES IDs / n/a reason |
|---|---|---|

Checks:

1. Every Decision the coverage table marks `required` has at least one DES ID.
2. Every design n/a has a reason.
3. Every DES ID has at least one real sourceDecisionId.
4. One-to-many and many-to-one mappings are allowed.

Disposition lives in this table, not on the DEC record. This table is a view, not a Registry, version, or state machine.

## Diagram-first writing

The normative diagram source is ASCII in `design.md`:

- product / problem / Before overview -> one-screen panorama;
- function or repair control flow -> 流程图 in that block;
- boundaries, responsibilities, dependencies, data ownership -> architecture;
- participant order, return, timeout, retry, concurrency -> sequence when needed.

Annotate relevant DES IDs. Cover applicable failures and recovery. If a flow / structure DES ID is not visualizable, state why. Split large diagrams instead of shrinking text.

## Per-block implementation surface

Every design baseline must identify the implementation surface at repository-verifiable depth. Each lower-half block (function, repair outcome, or structural outcome) is a presentation boundary, not a third identity namespace. Do not create `FEAT-###`.

The block must contain 流程图, 接口, 伪代码, and 问题. 接口 carries the verified contracts and the impacted files for that block.

### 接口

- Define the external API / command / event and the internal entry point that realizes each material contract.
- Name real repository symbols and include the load-bearing method signature, input / output shape, error semantics, authorization, idempotency, transaction, timeout, or compatibility behavior that implementation must preserve.
- Do not invent a path, symbol, signature, or schema. If repository evidence cannot resolve it yet, create an investigation DES with the bounded search area and the fact it must determine.

```markdown
#### External API / command / event — `<contract name>` `[DES-001]`

- Kind and identity:
- Defined at:
- Input:
- Output:
- Errors:
- Guards:

#### Internal entry point — `<verified symbol>` `[DES-001]`

- File:
- Current signature:
- Target signature:
- Implementation flow:
- Behavior change:
- Failure and recovery:
- Evidence:
```

#### Unresolved implementation surface `[DES-### investigation]`

- Verified boundary:
- Must determine:
- Search / proof stop condition:

### Impacted files

Include a repository-relative tree of files to add, modify, delete, or explicitly preserve. Annotate each file with `NEW / MODIFY / DELETE / PRESERVE`, relevant DES IDs, and numbered change points.

```text
<repository root>/
├── path/to/existing-file.ext  (MODIFY)   [DES-001]
├── path/to/new-file.ext       (NEW)      [DES-002]
├── path/to/obsolete-file.ext  (DELETE)   [DES-003]
└── path/to/invariant-file.ext (PRESERVE) [DES-004]
```

This section defines design impact, not implementation order. Plan owns task sequencing.

After all blocks, include one consolidated impacted-files index. A file shared by several blocks appears once with every relevant block title, DES ID, and numbered change point. This index exposes collisions.

### 伪代码 and 问题

伪代码 is the load-bearing control flow of the block. 问题 lists accepted non-blocking opens, remaining user decisions, and ungrillable look-and-feel. A blocking problem prevents marking the block closed.

## Conditional depth

- Architecture and DDD are optional lenses, not mandatory phases.
- Multi-domain or multi-data-owner collaboration is mandatory when present.
- Security, privacy, reliability, performance, accessibility, compliance, and observability expand only when triggered.
- Plan owns implementation order. Design owns why, boundaries, contracts, flows, implementation surface, migration, and proof objectives.

## Minimum self-check

Before requesting full confirmation, mechanically check:

- [ ] current type upper and lower coverage items are closed;
- [ ] required DEC IDs have DES coverage or explicit n/a;
- [ ] every DES ID has sourceDecisionIds;
- [ ] every implementation / preservation / verification DES appears in at least one lower-half block;
- [ ] every lower-half block has 流程图, 接口, 伪代码, and 问题;
- [ ] 接口 names verified symbols / signatures or an explicit investigation DES;
- [ ] impacted files are evidence-backed and annotated with change type plus DES IDs;
- [ ] key ASCII diagrams and prose have no relationship conflict.

Any failure returns to grilling. Do not mask a gap with user approval, a review score, a verdict, revision, digest, Packet, or receipt.
