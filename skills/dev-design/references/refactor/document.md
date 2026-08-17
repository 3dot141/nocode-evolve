# Refactor design document

Write the upper half after Before confirmation. Append After blocks only after those ROUNDs close.

## Before

### Opening panorama

One ASCII screen shows the motivation, scope, Before structure, preserved behavior, and material risks. No After flowchart here.

```text
Before
<boundaries / dependencies / owners>
preserve DES IDs (named, not yet After)
```

### Required upper sections

1. Source, motivation, scope, non-scope, and affected owners
2. Before: responsibilities, dependencies, calls, ownership, failure, test seams
3. Preserve obligations / invariants and their baselines
4. Target quality and stopping condition (judgeable, not taste)

## After

### Opening panorama

```text
Before                              After
<boundaries / dependencies>  --->  <new boundaries / dependencies>
          \                              /
           +---- preserve DES IDs ------+
```

### Architecture and migration flow

Selected After structure, Before-to-After mapping, coexistence, rollback, and cleanup Gate.

### Per-block sections

Each structural outcome has:

1. 流程图 — Before-to-After interaction
2. 接口 — verified public and internal seams; see `references/writing.md`
3. 伪代码 — the structural change
4. 问题 — remaining migration or deletion risks

Then: consolidated impacted-files index (`NEW / MODIFY / DELETE / PRESERVE`) and verification objectives.

Architecture and DDD are optional lenses. Use DDD when language, ownership, aggregates, or consistency boundaries actually change.

## DES granularity

Assign DES IDs to each independent invariant, boundary change, dependency reversal, ownership migration, compatibility step, cleanup Gate, and verification obligation. Mere moves or renames receive an ID only when they carry one of those results.

Finish with the shared DEC / DES coverage table from `references/writing.md`.
