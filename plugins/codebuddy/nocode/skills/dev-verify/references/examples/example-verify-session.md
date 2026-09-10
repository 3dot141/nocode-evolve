# Example — Verify a search change by DES ID

The confirmed design contains:

- `DES-003`: search p95 stays below 200 ms.
- `DES-004`: Chinese and English queries return relevant products.
- `DES-005`: invalid input returns the confirmed error contract.

Fresh evidence:

```text
$ npm test
Test Suites: 14 passed, 14 total
Tests:       127 passed, 127 total
```

```text
$ npm run bench:search
p50=88ms p95=142ms
```

```text
$ npm run test:integration -- search
POST /api/search {"q":"laptop"} → 200, 12 results
POST /api/search {"q":""} → 400, {"error":"query required"}
POST /api/search {"q":"笔记本"} → 200, 0 results
```

Matrix:

| DES ID | Result | Evidence type | Evidence |
|---|---|---|---|
| DES-003 | pass | benchmark | p95=142 ms |
| DES-004 | fail | integration | Chinese query returned 0 results |
| DES-005 | pass | integration | Empty query returned confirmed 400 contract |

Verify fails because `DES-004` failed. Return that ID and evidence to Build. After the implementation changes, rerun all affected search evidence, including performance.
