# Writing and DEC-to-DES protocol

Read this reference only after the current type closure passes.

## Source fidelity

Within `design.log.md`, Decisions are the current semantic source and the Log is the chronological source for how they formed. `design.md` is the normative downstream baseline derived from confirmed DEC IDs. Writing consumes each Decision's statement and body together; it may organize and explain confirmed content but cannot create a decision. A missing decision reopens its tree node.

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

The opening section is the type-specific one-screen panorama. It is not a separate `panorama.md`.

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

At the end of `design.md`, add one light coverage table:

| Decision ID | Design disposition | DES IDs / n/a reason |
|---|---|---|

Checks:

1. Every Decision with `designDisposition: required` has at least one DES ID.
2. Every design n/a has a reason.
3. Every DES ID has at least one real sourceDecisionId.
4. One-to-many and many-to-one mappings are allowed.

This table is a view, not a Registry, version, or state machine.

## Diagram-first writing

The normative diagram source is ASCII in `design.md`:

- flow and branching -> flow diagram;
- boundaries, responsibilities, dependencies, data ownership -> architecture diagram;
- participant order, return, timeout, retry, concurrency -> sequence diagram;
- state, data flow, or entity relationships -> only when those relationships carry the design.

Start with a one-screen overview, then add scenario sub-diagrams. Annotate relevant DES IDs. Cover applicable failures and recovery, not only happy paths. If a flow / structure DES ID is not visualizable, state why. Split large diagrams instead of shrinking text.

## Content depth

Always explain the global relationship before local detail. Do not render all interfaces and all files as two detached inventories. Organize the main body into **realization views**: each view is one user-visible feature, repair outcome, or structural outcome and groups every DES ID that must work together to realize it.

A realization view is a presentation and reasoning boundary, not a third identity namespace:

- title it with the human-readable outcome; do not create `FEAT-###`, another registry, or mutable membership state;
- name its source Decision IDs and complete joint DES set;
- explain the integrated behavior that only exists when those DES IDs work together;
- annotate the end-to-end flow, interfaces, file change points, and integrated proof with the relevant DES IDs;
- keep each DES independently traceable and verifiable even when several DES IDs share one interface, symbol, file, transaction, or proof scenario;
- when several views share enabling work, add one clearly named shared-enabler view and show which outcome views depend on it.

Open with a compact relationship index:

| Realization outcome | Source Decisions | Joint DES set | Entry / interface | Impacted files | Integrated proof |
|---|---|---|---|---|---|
| `<human-readable outcome>` | `DEC-...` | `DES-..., DES-...` | `<verified entry>` | `<paths or count + links>` | `<scenario / test objective>` |

Every design baseline must identify the implementation surface at repository-verifiable depth. Expand every relationship-index row as one realization view:

### Interface implementation

- Define the external API / command / event and the internal entry point that realizes each material contract.
- Name real repository symbols and include the load-bearing method signature, input / output shape, error semantics, authorization, idempotency, transaction, timeout, or compatibility behavior that implementation must preserve.
- Do not invent a path, symbol, signature, or schema. If repository evidence cannot resolve it yet, create an investigation DES with the bounded search area and the fact it must determine.

### Impacted files

- Include a repository-relative tree of files to add, modify, delete, or explicitly preserve. Annotate each file with `NEW / MODIFY / DELETE / PRESERVE`, relevant DES IDs, and numbered change points.
- For every listed file, state the responsibility or contract that changes; do not list speculative files. If the exact file cannot yet be proven, name the narrowest verified directory / symbol boundary and create an investigation DES.
- This section defines design impact, not implementation order. Plan owns task sequencing and slices.

Use this concrete baseline and adapt labels to the user's language. Repeat it for each outcome view:

~~~markdown
## Realization view — `<human-readable feature / repair / structural outcome>`

- Source Decisions: `DEC-###`
- Joint DES set: `DES-###`, `DES-###`, `DES-###`
- Joint outcome: `<observable behavior that requires the DES set to work together>`
- Depends on / enables: `<other realization view title, or none>`

### End-to-end interaction

```text
<actor / caller>
  -> <entry interface>                    [DES-001]
  -> <validation / policy>                [DES-002]
  -> <state change + emitted side effect> [DES-001, DES-003]
  -> <observable result / recovery>       [DES-003]
```

### DES collaboration

| DES | Responsibility in this outcome | Requires from sibling DES | Provides to sibling DES | Independent proof |
|---|---|---|---|---|
| `DES-001` | `<entry / orchestration>` | `<rule from DES-002>` | `<validated command for DES-003>` | `<contract test>` |
| `DES-002` | `<policy / invariant>` | `<input from DES-001>` | `<decision / normalized value>` | `<unit or property test>` |
| `DES-003` | `<state / side effect / recovery>` | `<accepted command>` | `<observable result>` | `<integration test>` |

### Interface implementation

#### External API / command / event — `<contract name>` `[DES-001, DES-002]`

- Kind and identity: `<HTTP METHOD + path | command | event topic + name>`
- Defined at: `<repository-relative file and verified symbol>`
- Input: `<request / command / event fields and validation>`
- Output: `<response / result / emitted event>`
- Errors: `<stable error codes, mapping, and retryability>`
- Guards: `<authorization, idempotency, transaction, timeout, compatibility>`

#### Internal entry point — `<verified symbol>` `[DES-001, DES-003]`

- File: `<repository-relative path>`
- Current signature: `<exact signature, or n/a for NEW>`
- Target signature:

```text
<exact target signature grounded in repository conventions>
```

- Implementation flow: `<caller -> entry point -> collaborators -> persistence / side effect>`
- Behavior change: `<what changes and what must remain invariant>`
- Failure and recovery: `<error propagation, retry, rollback, compensation, observability>`
- Evidence: `<file:symbol, test, schema, or other authoritative repository source>`

#### Unresolved implementation surface `[DES-### investigation]`

- Verified boundary: `<narrowest known directory / symbol / caller>`
- Must determine: `<path, symbol, signature, schema, or owner>`
- Search / proof stop condition: `<bounded evidence that closes this DES>`

### Impacted files in this realization view

```text
<repository root>/
├── path/to/existing-file.ext  (MODIFY)   [DES-001, DES-002]  ① [DES-001] <change point>  ② [DES-001, DES-002] <joint change point>
├── path/to/new-file.ext       (NEW)      [DES-003]           ① [DES-003] <responsibility / contract>
├── path/to/obsolete-file.ext  (DELETE)   [DES-###]  ① <removal gate / replacement>
└── path/to/invariant-file.ext (PRESERVE) [DES-###]  ① <behavior that must not change>
```

1. `path/to/existing-file.ext` — `<current responsibility>`; change `<contract / behavior>`; preserve `<invariant>`.
2. `path/to/new-file.ext` — owns `<new responsibility>` and is called by `<verified caller>`.
3. `path/to/obsolete-file.ext` — delete only after `<migration / compatibility / usage gate>`.
4. `path/to/invariant-file.ext` — no code change expected; its `<test / contract>` proves preservation.

Unresolved file placement is not a guessed path. Record the narrowest verified boundary here and link it to an investigation DES.

### Integrated proof

- Joint scenario: `<one end-to-end scenario that exercises the complete DES set>`
- Expected observation: `<user-visible result, state, emitted event, and failure behavior>`
- Independent DES proofs: `<links to the DES collaboration rows>`
~~~

After all views, include one consolidated impacted-files index. A file shared by several views appears once with every relevant view title, DES ID, and numbered change point. This index exposes collisions; the realization views explain behavior.

Expand additional schemas, class diagrams, tactical DDD, deployment, or observability detail when a DEC ID, system shape, or risk makes it load-bearing.

- Architecture and DDD are optional lenses, not mandatory phases.
- Multi-domain or multi-data-owner collaboration is mandatory when present: trigger, direction, contract, ownership, consistency, authorization, failure / retry / compensation, observability, verification.
- Security, privacy, reliability, performance, accessibility, compliance, and observability are separate conditional cross-cutting concerns.
- Plan owns implementation order. Design owns why, boundaries, contracts, flows, implementation surface, migration, and proof objectives.

## Minimum self-check

Before requesting confirmation, mechanically check:

- [ ] current type decision tree is closed;
- [ ] required DEC IDs have DES coverage or explicit n/a;
- [ ] every DES ID has sourceDecisionIds;
- [ ] every implementation / preservation / verification DES appears in at least one realization view;
- [ ] every realization view shows why its joint DES set must work together, not only a list of IDs;
- [ ] interface implementation names verified symbols / signatures or an explicit investigation DES;
- [ ] impacted files are evidence-backed and annotated with change type plus DES IDs;
- [ ] key ASCII diagrams and prose have no relationship conflict.

Any failure returns to grilling. Do not mask a gap with user approval, a review score, a verdict, revision, digest, Packet, or receipt.
