# Bug closure

## Problem baseline Gate

- [ ] B0 proves an authoritative pre-request expectation.
- [ ] B1 expected and actual share the same preconditions and have an observable difference.
- [ ] B2 has either repeatable failure evidence or a bounded non-reproduction contract with an observation plan.
- [ ] B3 maps actual and expected flow to a divergence point or bounded interval.
- [ ] B4 covers applicable impact and containment.
- [ ] B5 records benchmark / precedent provenance or an explicit unavailable internal-data time.
- [ ] B6 binds evidence and leaves no silent contradiction.
- [ ] B7 maps every affected path to acceptance / regression evidence.
- [ ] B8 gives Debug independent investigation, preserve, and completion obligations as DES IDs.

Do not include root cause or repair in the problem baseline unless evidence already proves it. Handoff target is Debug.

## Repair baseline Gate

- [ ] B9 explains every material symptom and reproduction condition with returned evidence.
- [ ] B10 compares real repair mechanisms or proves why only one is feasible.
- [ ] B11 propagates repair effects through every affected caller, flow, contract, data owner, state, and failure path.
- [ ] B12 maps every repair / preserve obligation to regression, observation, compatibility, rollback, or cleanup proof.
- [ ] B13 has objective evidence for Build versus Plan.

Bidirectional checks:

- every original symptom / affected flow is explained by the root cause and covered by the repair;
- every repair element has a symptom, root cause, constraint, or preserve source;
- every invariant has a verification method;
- every migration / rollback risk has detection and recovery.

Any failure reopens its B node. Do not patch the gap in the document writer.
