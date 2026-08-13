# Refactor closure

- [ ] R0 proves the primary outcome is structural and behavior-preserving.
- [ ] R1 names a concrete structural / elegance problem, desired quality, and stopping condition.
- [ ] R2 and R3 fully bound the affected Before system.
- [ ] Every R4 invariant has an objective R11 proof method.
- [ ] R5 provenance and applicability are explicit.
- [ ] R6 target qualities can be judged without relying on taste alone.
- [ ] R7 compares real structural alternatives or proves only one is feasible.
- [ ] R8 resolves each target quality without introducing an unexplained component.
- [ ] R9 maps every old element to preserve, migrate, adapt, or delete.
- [ ] R10 gives detection and recovery for every intermediate risk.
- [ ] R12 prevents deletion before caller / data / traffic evidence is ready.

Bidirectional checks:

```text
motivation -> After change -> migration step -> invariant proof
After element -> source motivation / constraint
old element -> destination
risk -> detection -> recovery
```

Any orphan reopens its R node. A file move, rename, extraction, or new abstraction is not automatically an independent design obligation.
