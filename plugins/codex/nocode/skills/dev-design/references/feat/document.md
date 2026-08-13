# Feat design document

## Opening panorama

One screen shows the outcome, actors, scope, selected solution, end-to-end flow, domain / component boundaries, data owners, material risks, active DES IDs, and Plan Handoff.

Use ASCII and annotate relevant DES IDs. For multi-participant behavior include a separate sequence diagram after the overview.

## Required structure

1. Source, goal, scope, non-scope, constraints, and preserve obligations
2. Current flow, problem evidence, and competitor comparison
3. Selected solution and balanced alternatives
4. End-to-end user / business / system flows, including failure and recovery
5. Business rules and state model
6. System boundaries, responsibilities, APIs / events / data contracts, and ownership
7. Feature realization views: one view per user-visible outcome, grouping the complete joint DES set with its end-to-end flow, DES collaboration, verified interfaces, per-view impacted files, and integrated proof
8. Consolidated impacted-files index: each repository-relative `NEW / MODIFY / DELETE / PRESERVE` file appears once with every feature view, DES ID, and numbered change point that touches it
9. Multi-domain collaboration when more than one domain or data owner participates
10. Applicable cross-cutting concerns
11. Release, migration, compatibility, rollback, and cleanup
12. Acceptance and verification objectives
13. DEC / DES coverage

## Conditional lenses

Architecture detail is used when boundaries, dependencies, deployment, or ownership carry a decision. Tactical DDD is used when multiple candidate bounded contexts or a persistent domain model makes language / invariants load-bearing:

- identify contexts by business capability, language, and model ownership, not repository / service shape;
- one context may contain multiple aggregates;
- each aggregate defines invariant, consistency boundary, and root;
- cross-context interaction uses explicit API / command / event and stable identity;
- copied data declares owner, sync, staleness, conflict, and repair semantics.

Do not force architecture, DDD, class diagrams, tactical schemas, or deployment sections when they do not carry a DEC-derived obligation. Realization views, interface implementation, and impacted files are always required at the evidence level defined by `references/writing.md`; unresolved details become investigation DES IDs rather than guesses. A view groups cooperating DES IDs without replacing their independent identity or proof.

## DES granularity

Assign DES IDs to independently implementable / verifiable behavior, rule, contract, data, migration, observation, or verification obligations. Do not assign IDs to explanatory background, rejected options, or every field / function.

Finish with the shared coverage table from `references/writing.md`.
