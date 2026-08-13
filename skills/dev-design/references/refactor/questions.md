# Refactor dynamic decision tree

Refactor changes structure while preserving agreed behavior. Code elegance is a valid motivation only when the disliked structure, desired quality, and stopping condition are concrete.

### R0 — Type Gate and primary outcome

New externally observable behavior -> feat. Violation of authoritative expectation -> bug. Keep refactor only when the primary result is internal structure with preserved behavior.

### R1 — Motivation and concrete quality problem

Accept coupling, duplication, change diffusion, cycles, test difficulty, failure history, build / performance data, or specific inelegance. For aesthetic motivation, name the exact structure, why it harms comprehension / change, the desired quality, and when cleanup is enough.

### R2 — Scope, non-scope, affected parties

Identify modules, callers, data, contracts, teams / owners, and explicitly untouched regions.

### R3 — Before structure

Map responsibilities, dependency direction, data ownership, runtime calls, failure propagation, and test seams. Investigate unknown repository facts.

### R4 — Preserve obligations

Lock user-visible behavior, APIs, events, data formats, error semantics, performance baselines, compatibility, and operations. Each invariant needs a verification method.

### R5 — Comparable architecture and migration precedents

Provide internal-knowledge references by default with source-time labeling. Browse only on explicit request. Compare seams, dependency direction, ownership, testing, and migration applicability.

### R6 — Target quality and stopping conditions

Turn “cleaner” or “more decoupled” into a judgeable target: change surface, cycles, public area, responsibility clarity, test reachability, build / runtime performance, or a concrete readability boundary.

### R7 — Real target-structure alternatives

Compare mechanism-level alternatives across migration cost, cognitive cost, performance, reversibility, and likely future change.

### R8 — After structure

Fix boundaries, responsibilities, public interfaces, dependency direction, data ownership, failure isolation, and test seams. Do not turn this section into implementation ordering.

### R9 — Before-to-After mapping and migration

Every old module, interface, data path, and caller has a preserve, migrate, adapt, or delete destination.

### R10 — Coexistence, compatibility, rollout, rollback

Close intermediate states, adapters, flags, phased cutover, recovery, and data repair.

### R11 — Characterization and verification

Define characterization tests, contract tests, Before / After comparisons, performance baselines, and production observation needed to prove invariants.

### R12 — Cleanup and deletion Gate

Specify deprecation window, caller-migration evidence, dual-write / adapter exit, and the evidence required before deletion.

### R13 — Bidirectional closure

Every motivation maps to an After change; every new component has a motivation or constraint; every invariant has proof; every migration risk has detection and recovery.

## Conditional branches

- public API / event -> compatibility, versioning, caller migration;
- persistent data -> schema, dual write, backfill, validation, rollback;
- zero downtime -> coexistence, traffic cutover, production observation;
- performance-sensitive -> baseline, benchmark, regression budget;
- multiple repositories / owners -> ownership, release order, contract governance.
