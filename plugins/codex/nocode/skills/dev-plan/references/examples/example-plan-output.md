# Example Plan output

```markdown
# Search result highlighting implementation plan

**Design Log**: docs/dev/alice/260806-01-search-highlight/design.log.md
**Design Doc**: docs/dev/alice/260806-01-search-highlight/design.md
**Design Confirmation**: Round 18
**Execution**: executing

## Dependency graph

Task 1 contract test -> Task 2 implementation -> Task 3 integration proof

## Task 1 — Lock highlight response contract

**Depends on**: none
**designCovers**: DES-004
**Purpose**: prove matching ranges are returned without changing existing result order

**Files / bounded search area**
- Modify: `src/search/types.ts` — `SearchResult`
- Test: `src/search/search.test.ts` — response contract

### Test first
- Add range assertions for ASCII and CJK queries.
- Expected failure: response has no `highlights` field.
- Command: `npm test -- search.test.ts`

### Implement
- Add the confirmed optional range contract.
- Preserve DES-002 result ordering.

### Verify
- Command: `npm test -- search.test.ts`
- Expected: contract cases pass.

### Rollback / checkpoint
n/a — additive in-process contract before consumers exist

## DES coverage

| DES ID | Task / Verify | Reason |
|---|---|---|
| DES-002 | Task 1, Task 2 | preserve order while implementing |
| DES-004 | Task 1 | response contract |
| DES-006 | Task 3 | integration evidence |
```
