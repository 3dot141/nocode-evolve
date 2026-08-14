# DEC-to-DES Traceability Protocol

Shared reference for engineering Skills that consume a confirmed `design.md`. It defines only the cross-stage contract; design facts remain in the task's `design.log.md` and `design.md`.

## 1. Two ID namespaces and one process Log

### DEC IDs

`DEC-###` lives in the Decisions section of `design.log.md` and states one formed decision point: classification, goal, scope, behavior, constraint, structure, contract, acceptance, or another independently judgeable design meaning.

DEC IDs are task-local, never deleted, reused, renumbered, or silently redefined. Semantic change creates a new ID and records succession in DEC `过程`. Evidence, rejected alternatives, recommendations, user answers, stage movement, and returned findings remain in `ROUND-N` or `Event N` entries in the same file's Log; they do not receive DEC IDs unless they form a design decision.

### DES IDs

`DES-###` lives at its first full definition in `design.md` and states what must be investigated, implemented, preserved, migrated, observed, or verified:

```markdown
### DES-001 — <title>

- kind: investigation | behavior | structure | contract | data | migration | preserve | observability | verification
- statement: <one independently judgeable obligation>
- sourceDecisionIds: DEC-...
- supersedes: DES-... # optional
```

DES IDs follow the same immutability rule. Background, rationale, alternatives, and examples do not receive IDs unless they create an independently judgeable obligation.

## 2. Design coverage

`design.md` ends with one light coverage view:

| Decision ID | Design disposition | DES IDs / n/a reason |
|---|---|---|

- Every Decision the coverage table marks `required` maps to at least one DES ID.
- Explicit design n/a includes a reason.
- Every DES ID cites at least one real sourceDecisionId.
- One-to-many and many-to-one mappings are valid.

This is not an Implementation Item Registry and has no revision, digest, four-state lifecycle, sourceAnchor, or approval record.

## 3. Handoff selects stage scope

The current same-Log Handoff is the routing authority:

```yaml
From: dev-design
To: Plan | Env | Build | Debug | Verify | Review | Land
ConfirmedBy: ROUND-N
Read:
  design: ./design.md
  designIds: [DES-...]
Preserve: [DES-...]
Open: []
```

Every consumer re-reads the exact Log path, current Handoff, `design.md`, and referenced DES definitions before work. It uses Decisions for current meaning and does not reinterpret the chronological Log unless it needs origin evidence.

If the current Handoff or a DES statement no longer matches repository evidence, stop and return the finding to dev-design. dev-design appends the evidence to the Log, reopens affected nodes, creates or supersedes DEC and DES IDs when semantics change, reconfirms, and issues a new Handoff. There is no numeric baseline comparison.

## 4. Stage-local mappings

### Debug

Receives investigation / preserve / verification DES IDs. Returns each investigated DES ID with result, evidence, unresolved contradictions, and newly discovered impact. It does not write design facts.

### Plan

Every task lists the DES IDs it carries:

```markdown
**designCovers**: DES-001, DES-004
```

Plan starts from Handoff.designIds and maps each ID to one or more tasks, or to Verify when it is purely evidentiary. Unknown IDs or an unmapped implementation / preserve obligation block confirmation.

### Env

Env is the navigation boundary immediately before the first Build entry. It receives the exact task artifact paths and DES scope, delegates workspace preparation to `nocode:using-git-worktrees`, and preserves the repository-relative task directory in the active workspace. Only a successful isolated or explicitly authorized in-place result may update the same-Log Handoff from Env to Build. Env failure leaves the Handoff at Env and must not invoke Build.

### Build

Task scope includes `designCovers`. Each result reports:

```yaml
completedDesignCovers: [DES-...]
changedFiles: []
evidence: []
```

Missing or extra DES IDs keep the task incomplete. Direct Bug Build uses the repair Handoff's DES IDs as the single slice scope.

### Verify

Verify records current evidence per relevant DES ID:

| DES ID | Result | Evidence type | Evidence |
|---|---|---|---|

Evidence is produced from the current code / environment. A failed or missing obligation returns to Build; evidence that changes the design returns to dev-design.

### Review and Land

Review receives the same design path and DES scope for context but owns code-quality findings, not design interpretation. Land preserves the design path and DES references in final delivery / PR context and records task completion as a process Event in the active Log.

## 5. Return rules

| Finding | Return target |
|---|---|
| design-required DEC missing DES coverage; DES missing source; diagram / prose conflict | dev-design |
| implementation plan leaves a Handoff DES obligation unmapped | Plan |
| task misses or claims extra designCovers | Build task |
| current evidence fails a DES obligation without changing the design | Build |
| evidence changes goal, scope, solution, contract, Preserve, acceptance, or DES meaning | dev-design |

Always name the DES IDs and concrete evidence. “Coverage incomplete” without IDs is not actionable.
