# Bug dynamic decision tree

Use this tree in two passes. Ask only the earliest active node whose dependencies are closed. Add conditional branches only when triggered.

## Problem pass

### B0 — Authoritative expectation and type Gate

Prove that current behavior violates an expectation that existed before this request: approved requirement / design, interface contract, automated test, explicit acceptance, provable historical behavior, or confirmed existing business rule. No authority -> reclassify as feat. Conflicting authorities -> record evidence and ask which one governs.

### B1 — Expected versus actual

Describe both under the same preconditions. The difference must be observable, not “feels wrong.”

### B2 — Context and reproduction contract

Record environment, input, actor, state, frequency, and control case.

- Reproduced -> minimal repeatable steps and failing evidence.
- Not yet reproducible -> attempted conditions and results, reliable symptom / production evidence, and the next observation or experiment Debug must perform.

### B3 — Actual versus expected flow

Reconstruct both flows step by step. Mark the known divergence point or the smallest still-unknown divergence interval.

### B4 — Impact and risk branches

Cover affected users, business outcome, data, security, money, operations, and external dependencies. Trigger containment, loss prevention, or data protection when applicable.

### B5 — Benchmark and precedent

Provide the default internal-knowledge view of comparable behavior, upstream issues, known faults, release changes, or repair precedents. Label internal source and its data time; if unavailable, say so. Browse only when the user explicitly asks and then record URL and times.

### B6 — Evidence, contradictions, and exclusions

Bind every factual claim to code, test, log, command, document, attachment, or user evidence. Mark assumptions. Do not silently choose among conflicting sources. Record what has been ruled out and how.

### B7 — Repair acceptance and regression boundary

Cover the original reproduction path, boundary cases, failure recovery, and explicitly unaffected paths. Acceptance describes the correct result, not a guessed implementation.

### B8 — Debug investigation contract

Define what Debug must prove, where it should start, which evidence it must preserve, applicable constraints / invariants, and what counts as completed investigation. Do not guess root cause or repair.

Problem-pass exit: create investigation / preserve / verification DES IDs and Handoff to Debug.

## Repair pass

### B9 — Root-cause claim and evidence

The returned mechanism must explain the symptom, reproduction conditions, and all relevant evidence. Partial explanation returns to Debug.

### B10 — Repair constraints and real alternatives

Compare mechanism-level alternatives against constraints and invariants. If only one approach is feasible, record why rather than fabricating alternatives.

### B11 — Selected repair and impact propagation

Propagate the change through callers, data, state, contracts, error semantics, cross-domain flows, and failure recovery. New externally observable behavior may require reclassification or a split feat.

### B12 — Regression, observation, compatibility, rollback

Define regression tests, production observation when needed, compatibility, rollback, and cleanup conditions for temporary guards or patches.

### B13 — Build or Plan route

Direct Build requires one independently verifiable repair slice, no ordered implementation dependencies, no migration / coexistence / public-contract change / rollout, and one red-green loop that proves repair plus regression. Otherwise Handoff to Plan.

## Conditional branches

- not reproducible -> instrumentation / observation plan;
- expectation conflict -> authority decision;
- security, money, or data damage -> containment and sensitive-risk branch;
- external dependency -> contract, timeout, degradation, and evidence branch;
- timing, concurrency, replay -> state, ordering, and idempotency branch;
- data or public-contract change -> migration, compatibility, and Plan branch.
