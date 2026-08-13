# Refactor design document

## Opening panorama

One screen shows the motivation, scope, Before architecture, After architecture, preserved behavior, migration path, cleanup Gate, material risks, active DES IDs, and Plan Handoff.

```text
Before                              After
<boundaries / dependencies>  --->  <new boundaries / dependencies>
          \                              /
           +---- preserve DES IDs ------+
```

Use separate detailed diagrams when the overview cannot show dependency direction, ownership, or migration safely.

## Required structure

1. Source, motivation, scope, non-scope, and affected owners
2. Before: responsibilities, dependencies, calls, ownership, failure propagation, test seams
3. Preserve obligations / invariants and their baselines
4. Comparable architectures and real alternatives
5. Target quality and selected After structure
6. Before / After comparison with every structural change explained
7. Structural realization views: one view per structural outcome, grouping its joint DES set with Before / After interaction, DES collaboration, verified interfaces, per-view impacted files, and integrated preservation proof
8. Consolidated impacted-files index: each repository-relative `NEW / MODIFY / DELETE / PRESERVE` file appears once with every structural view, DES ID, and numbered change point that touches it
9. Multi-domain collaboration if boundaries or owners change
10. Before-to-After migration, coexistence, compatibility, rollout, rollback, and data recovery
11. Cleanup, deprecation, and deletion Gate
12. Verification objectives
13. DEC / DES coverage

Architecture and DDD are optional lenses. Use DDD when language, ownership, aggregates, or consistency boundaries actually change. Do not require it for a single-domain internal rearrangement.

## DES granularity

Assign DES IDs to each independent invariant, boundary / responsibility change, dependency reversal, ownership migration, compatibility step, cleanup Gate, and verification obligation. Mere moves, renames, extraction, or formatting receive an ID only when they carry one of those results.

Finish with the shared coverage table from `references/writing.md`.
