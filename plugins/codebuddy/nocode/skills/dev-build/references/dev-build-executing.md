# Executing protocol

Use when `Execution: executing` or for a direct single-slice Bug repair. The main agent performs work sequentially; later Verify and Review remain independent gates.

For each slice:

1. Re-read its complete task text or direct Bug Handoff, `designCovers`, named DES definitions, files, and verification command.
2. Check current repository evidence. Return task-graph gaps to Plan and design-semantic contradictions to dev-design.
3. Follow all of `implementer-disciplines.md`. Observe a relevant failing test when practical, implement the smallest compliant change, and rerun focused verification.
4. Inspect the actual diff before declaring the slice complete.
5. Return `completedDesignCovers`, `changedFiles`, and command/result `evidence`. The completed DES set must exactly equal `designCovers`.

Stop when an instruction is ambiguous, required context is absent, repeated verification fails, or execution would cross the confirmed boundary. Do not guess around a blocker.

## Red flags

- Re-designing while coding
- Skipping an observable failure because the change looks simple
- Claiming a DES ID without inspecting its full statement
- Marking a slice complete without current verification output
