# Plan task template

```markdown
## Task N — <independently verifiable slice>

**Depends on**: Task ... | none
**designCovers**: DES-..., DES-...
**Purpose**: <observable result carried from those DES IDs>

**Files / bounded search area**
- Modify: `path/to/file` — <symbol / reason>
- Test: `path/to/test` — <behavior>

### Test first

- Add or update: <test>
- Expected failure before implementation: <specific assertion / behavior>
- Command: `<command>`

### Implement

- <bounded change with real symbol / contract>
- <preserve obligations that constrain the change>

### Verify

- Command: `<focused test>`
- Command: `<related suite / build when applicable>`
- Expected: <specific pass condition>

### Rollback / checkpoint

<required for migration, compatibility, rollout, or risky state change; otherwise `n/a — reason`>
```

Rules:

- `designCovers` is mandatory and contains only current Handoff DES IDs.
- Every task has a test-first failure or an explicit reason an objective pre-change check replaces it.
- Prefer at most five touched files; larger slices explain why they remain independently verifiable.
- No placeholders, guessed APIs, or hidden design decisions.
- Build result must report the same IDs as `completedDesignCovers` plus changed files and evidence.

## Plan header

```markdown
**Design Log**: <exact design.log.md>
**Design Doc**: <design.md>
**Design Confirmation**: <Handoff.ConfirmedBy Round N>
**Execution**: executing | subagent-lite | subagent-full
```

## DES coverage

```markdown
| DES ID | Task / Verify | Reason |
|---|---|---|
| DES-001 | Task 1 | implementation |
| DES-002 | Verify | evidence-only obligation |
```
