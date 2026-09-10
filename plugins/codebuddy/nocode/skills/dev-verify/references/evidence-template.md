# Evidence template

Every Verify claim must be backed by evidence produced after the current change.

## One evidence record

```markdown
### <DES-ID> — <obligation title>

- Method: test | build | integration | e2e | benchmark | inspection
- Command / procedure: `<exact command or reproducible procedure>`
- Environment and time: <relevant environment>, <time>
- Output: <key stdout / stderr / artifact path; preserve errors and warnings>
- Result: pass | fail | unverified
- Proves: <the bounded part of the DES statement this evidence supports>
```

## Evidence matrix

```markdown
| DES ID | Result | Evidence type | Evidence |
|---|---|---|---|
| DES-001 | pass | test | `npm test` — 127 passed, 0 failed |
| DES-004 | fail | integration | `npm run test:integration -- search` — Chinese query returned 0 results |
```

Rules:

- Begin with the Handoff DES IDs; never invent a verification-only namespace.
- Preserve raw error / warning text needed to reproduce a failure.
- Flaky is not pass. Isolate it and report the uncertainty.
- A code change invalidates evidence for every affected obligation.
- One failing or unverified required DES ID blocks the Verify Gate.
