# Bug design document

Use one `design.md` for both passes. Problem and repair DES IDs remain stable in the same sequence.

## Opening panorama

Show, in one screen:

- authoritative expectation and observable fault;
- actual versus expected flow with fault location / unknown interval;
- impact boundary and containment;
- active investigation or repair DES IDs;
- current Handoff target.

Use ASCII. After Debug, extend the panorama with fault mechanism and before / after repair path; do not delete the problem view.

## Problem baseline

1. Source, goal, scope, and authoritative expectation
2. Expected / actual and reproduction contract
3. Actual / expected flow diagram, including failure and recovery
4. Impact, risk, benchmark / precedent, and evidence conflicts
5. Repair acceptance and unaffected invariants
6. Known interface / file surface and unresolved implementation locations
7. Debug investigation contract, including investigation DES IDs for unresolved symbols or files
8. Investigation / preserve / verification DES IDs

Do not guess root cause or solution in this section.

## Repair baseline

Append after Debug returns:

1. Root-cause claim and evidence chain
2. Real alternatives and selected repair
3. Fault-before / repair-after flow and architecture diagrams
4. Caller, data, state, contract, cross-domain, and error-semantics impact
5. Repair realization views: group the joint DES set for each repair outcome with fault-before / repair-after interaction, DES collaboration, verified interfaces, per-view impacted files, and integrated regression proof
6. Consolidated impacted-files index: each repository-relative `NEW / MODIFY / DELETE / PRESERVE` file appears once with every repair view, DES ID, and numbered change point that touches it
7. Compatibility, migration, observation, rollback, and cleanup
8. Regression / verification objectives
9. New repair / preserve / migration / verification DES IDs
10. Build / Plan route and reason

Architecture or DDD detail is conditional. Multi-domain collaboration is mandatory when the repair crosses domain or data-owner boundaries. Security, reliability, performance, privacy, and observability expand only when triggered.

Finish with the shared DEC / DES coverage table from `references/writing.md`.
