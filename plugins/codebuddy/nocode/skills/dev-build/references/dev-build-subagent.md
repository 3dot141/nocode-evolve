# Sequential isolated implementation

Use for `subagent-lite` and `subagent-full`. Dispatch implementation slices sequentially because isolated agents still share the working tree and may touch common files.

## Review density

| Mode | Implementer | Spec review | Quality review |
|---|---|---|---|
| `subagent-lite` | every slice | risk slices | risk slices |
| `subagent-full` | every slice | every slice | each checkpoint, or every 2–3 slices |

A risk slice touches external input, authorization, sensitive data, schema / migration, concurrency, money, a cross-module shared contract, or an irreversible operation.

## Protocol

1. Topologically order all slices. Never dispatch multiple implementers into the shared working tree at once.
2. Build the implementer objective from `implementer-prompt.md`. Include the exact Log and design paths, full task, named DES definitions, `designCovers`, bounded files, verification commands, and expected result schema.
3. Wait for a terminal implementer result, then inspect the real diff. Dispatch is not evidence of completion.
4. Require `status`, `summary`, `changedFiles`, `concerns`, `testResults`, and `completedDesignCovers`. The completed DES set must exactly equal the task set before review.
5. Apply the mode's review density. Spec review uses `spec-reviewer-prompt.md`; quality review uses `quality-reviewer-prompt.md`. Reviewer and implementer must be separate contexts.
6. Send actionable issues back to the same implementer, wait for a new terminal result, then re-review. Finish required review before starting the next slice; checkpoint quality review must cover the final partial batch.

## Implementer statuses

- `DONE`: inspect and continue to required review.
- `DONE_WITH_CONCERNS`: resolve correctness or scope concerns before review; retain observations.
- `NEEDS_CONTEXT`: add the missing evidence and resume the same implementer.
- `BLOCKED`: identify whether the cause belongs to Build, Plan, or dev-design; do not retry unchanged conditions.

Report each slice as spec / quality reviewed or explicitly `lite skipped`. A skipped review is never presented as approval.

## Design boundary

An implementer or reviewer may report design-changing evidence but may not resolve it. Stop, preserve the evidence, and return it to the exact dev-design Log. Numeric revisions, digests, receipts, or local reinterpretation are not substitutes for that return path.
