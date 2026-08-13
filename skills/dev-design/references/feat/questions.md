# Feat dynamic decision tree

The stable nodes are decision domains, not a fixed questionnaire. Investigate repository facts first and ask one unresolved decision at a time.

### F0 — Real outcome and type Gate

Identify the observable result behind the requested feature form. Existing authoritative behavior violated -> bug. Behavior preserved with only structural change -> refactor.

### F1 — Actors and permissions

Cover direct users, indirect participants, administrators, and external systems. For each: visible, actionable, authorized, and forbidden behavior.

### F2 — Current flow and problem evidence

Reconstruct the current way, workarounds, cost, and evidence. Investigate code / docs instead of asking the user for repository facts.

### F3 — Competitor and comparable solutions

Provide a default internal-knowledge competitor solution, labeled with internal data-source time or `runtime did not provide`. Browse only when explicitly requested; online claims require URL, page time when available, and access time. State what the comparison changes in later nodes.

### F4 — Scope, non-scope, preserve, constraints

Fix what is in, out, preserved, and constrained by platform, time, regulation, compatibility, or other hard limits.

### F5 — Domain language, model, and ownership

Define ambiguous terms, entities, identity, relationships, lifecycle, and authoritative data owner. Do not carry unresolved vocabulary into the solution.

### F6 — End-to-end user-flow tree

For every entry and actor cover happy path, alternatives, empty / first-use state, repeat action, interruption recovery, and role differences.

### F7 — Rules, state, and boundary conditions

Make calculations, conditions, state transitions, concurrency, idempotency, time, limits, and conflict rules explicit.

### F8 — System flows and failure recovery

Map frontend, backend, jobs, callbacks, external dependencies, data, and control flow. Every failure point has an experience, recovery, or explicitly accepted outcome.

### F9 — Conditional qualities and sensitive risks

Expand applicable security, privacy, reliability, performance, accessibility, compliance, AI eval, and observability. Evidence-backed n/a is allowed.

### F10 — Existing system fit and conflicts

Read implementation, tests, internal docs, and confirmed decisions. Record reuse points, technical constraints, and conflicts.

### F11 — Real alternatives and trade-offs

Compare mechanism-level alternatives. If constraints leave one feasible solution, prove that instead of manufacturing choices.

### F12 — Selected boundaries, contracts, and data flow

Fix responsibilities, interfaces, ownership, state changes, failure semantics, enforcement points, and cross-domain collaboration; map them back to F6–F9.

### F13 — Release, migration, compatibility, observation, rollback

Close old data / client compatibility, flags, rollout, observation, rollback, and cleanup Gates.

### F14 — Bidirectional closure

Every user / system flow has rules, solution support, acceptance, and evidence. Every solution component has a source need or constraint.

## Conditional branches

- roles / permissions -> permission matrix and unauthorized paths;
- model conflict -> language and ownership decision;
- external system -> contract, timeout, retry, degradation, compensation;
- persistent state -> lifecycle, migration, compatibility, rollback;
- concurrency / repetition -> idempotency, ordering, conflict resolution;
- production behavior -> rollout, observation, loss limit;
- AI -> eval cases, failure tolerance, human fallback;
- security, money, sensitive data, irreversible action -> explicit sensitive-risk decision.
