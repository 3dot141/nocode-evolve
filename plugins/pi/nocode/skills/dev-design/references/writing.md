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
- chain / mechanism / migration structure -> the group’s 全景;
- chain / mechanism / migration control flow -> the group’s 流程图; a block keeps its own flow only with independent control flow;
- boundaries, responsibilities, dependencies, data ownership -> architecture;
- participant order, return, timeout, retry, concurrency -> sequence when needed.

For forms beyond these four — runtime call trees, UI component trees with state and module boundaries, and diff-shaped views — read `{NOCODE_PLUGIN_ROOT}/skills/references/visual-forms.md`. Two standing rules from it apply here:

- When the point of a comparison or a Before -> After block is **what changes**, draw one diff-shaped tree or pseudocode block instead of two separate diagrams plus prose.
- Pick the smallest view that carries the current point and place it next to the prose it supports; a panorama belongs only in the overview.

Annotate relevant DES IDs. Cover applicable failures and recovery. If a flow / structure DES ID is not visualizable, state why. Split large diagrams instead of shrinking text.

## Per-block implementation surface

Every design baseline must identify the implementation surface at repository-verifiable depth. Each lower-half block (sub-function, repair outcome, or structural outcome) is a presentation boundary, not a third identity namespace. Do not create `FEAT-###`.

The block must contain 接口, 伪代码, and 影响文件. 流程图 and 问题 live one level up in the function group; a block carries its own 流程图 only when it has control flow the group flow cannot show. A block with no contract change states so explicitly under 接口 — its 伪代码 still spells out the concrete change; wording-only or prompt-only is not a reason to blur it.

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

Impacted files form three levels — block tree, group consolidation, repository-wide closing tree:

1. each block ends with its own tree;
2. each function group consolidates its blocks into one 影响文件汇总 tree;
3. the Closing overview `文件` section carries one repository-wide tree (below).

Each level is a repository-relative ASCII tree annotated with `NEW / MODIFY / DELETE / PRESERVE`, relevant DES IDs, numbered change points, and short `#` comments.

```text
<repository root>/
├── path/to/existing-file.ext  (MODIFY)   [DES-001]  # change point
├── path/to/new-file.ext       (NEW)      [DES-002]
├── path/to/obsolete-file.ext  (DELETE)   [DES-003]
└── path/to/invariant-file.ext (PRESERVE) [DES-004]
```

In the repository-wide tree a file shared by several groups appears once with every group, DES ID, and numbered change point, plus the list of new directories — collisions surface here.

These trees define design impact, not implementation order. Plan owns task sequencing.

### 伪代码 and 问题

伪代码 is the load-bearing control flow of the block — concrete enough to check against the code, even when the change is wording or prompt text. 问题 lives at the group level: accepted non-blocking opens, remaining user decisions, and ungrillable look-and-feel. A blocking problem prevents marking the group closed.

## Formatting rules

- Panoramas and flows are ASCII inside `design.md`.
- File lists are ASCII trees with change-type tags and short `#` comments — never bare path lists.
- 接口 and 伪代码 use fenced code blocks with a language tag (`ts` / `tsx` / `text`) and real structured formatting — actual signatures, control flow, aligned comments — never untagged prose pseudocode.
- Pick the smallest view that carries the point; see `{NOCODE_PLUGIN_ROOT}/skills/references/visual-forms.md`.

## Closing overview

Every lower half ends with three sections:

- `# 总览` — heading only.
- `## 架构` — one system-level ASCII panorama crossing every function group: boundaries and dependency direction no single chain view shows.
- `## 文件` — the repository-wide impacted-files tree with the new-directories list.

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
- [ ] every function group has 背景, 目标, 全景, 流程, 问题, and a consolidated impacted-files tree;
- [ ] every lower-half block has 接口, 伪代码, and 影响文件 (own 流程图 only with independent control flow);
- [ ] blocks without contract change state so explicitly, and their 伪代码 stays concrete;
- [ ] 接口 names verified symbols / signatures or an explicit investigation DES;
- [ ] 接口 and 伪代码 blocks carry a language tag and structured formatting;
- [ ] impacted files are evidence-backed, annotated with change type plus DES IDs, and appear at block, group, and repository-wide levels;
- [ ] the Closing overview has 架构 (system ASCII panorama) and 文件 (repository-wide tree with new directories);
- [ ] key ASCII diagrams and prose have no relationship conflict.

Any failure returns to grilling. Do not mask a gap with user approval, a review score, a verdict, revision, digest, Packet, or receipt.
