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

### Per-group sections

Group structural outcomes by change group: one coherent structural move = one group. Each group has:

1. 背景 — motivation; reference the Before half, do not restate it
2. 目标 — target structure and stopping condition (reference the Before target quality)
3. 迁移流程 — Before-to-After interaction (ASCII)
4. blocks — one `N.x` per structural outcome, each with 接口 / 伪代码 / 影响文件; see `references/writing.md`. A block carries its own 流程图 when its migration has control flow the group view cannot show
5. 问题 — remaining migration or deletion risks
6. 影响文件汇总 — one tree consolidating this group’s blocks

Then: consolidated verification objectives.

Architecture and DDD are optional lenses. Use DDD when language, ownership, aggregates, or consistency boundaries actually change. End the half with the Closing overview (`总览 / 架构 / 文件`) as defined in `references/writing.md`.

## DES granularity

Assign DES IDs to each independent invariant, boundary change, dependency reversal, ownership migration, compatibility step, cleanup Gate, and verification obligation. Mere moves or renames receive an ID only when they carry one of those results.

Finish with the shared DEC / DES coverage table from `references/writing.md`.
