# Paths and engineering ID conventions

Shared reference for product paths and their consumption by dev-design, Plan, Build, Review, and Verify.

## Product path IDs

| Type | Format | Example | Owner |
|---|---|---|---|
| User story | `US-{N}` | US-1 | PRD |
| Domain path | `{domain}.P{N}` | Order.P1 | PRD |
| Cross-domain path | `cross-domain.{N}` | cross-domain.1 | PRD |
| System path | `system.{N}` | system.1 | PRD |
| Constraint | `constraint.{N}` | constraint.1 | PRD |

These IDs describe product-source paths. dev-design consumes confirmed path meanings into DEC IDs rather than creating a second acceptance-ID namespace.

## Engineering IDs

| Type | Format | Owner | Meaning |
|---|---|---|---|
| Design decision | `DEC-###` | `design.log.md` Decisions | the current formed design meaning |
| Design obligation | `DES-###` | `design.md` | what must be investigated, implemented, preserved, migrated, observed, or verified |

IDs are task-local and immutable. Semantic change creates a new ID with a supersession relation. `Round N` / `Event N` entries in the same file's Log preserve how Decisions formed but are not an engineering ID namespace. The full cross-stage contract is `{NOCODE_PLUGIN_ROOT}/skills/references/design-traceability.md`.

## Product path format

```text
- {domain}.P{N}: {observable outcome} [{actor}] [CONFIRMED|ASSUMED|TBD]
  source: US-{N}
  {trigger / precondition} -> {key steps} -> {result}
  failure: {failure path}
  boundary: {where this path ends or crosses a domain}
```

Cross-domain paths link existing domain paths; system paths have no user entry; constraints state cross-path invariants. `[ASSUMED]` and `[TBD]` must be closed or explicitly excluded by dev-design before Handoff.

## Downstream consumption

| Stage | Consumes | Produces | Gate |
|---|---|---|---|
| PRD | user evidence | product paths, domains, constraints | paths confirmed as a product baseline |
| dev-design | product paths plus engineering conversation / evidence | DEC IDs, process Log, `design.md`, DES IDs | type closure plus bidirectional DEC / DES coverage |
| Plan | Handoff DES IDs and product paths referenced by design | tasks with `designCovers` | every implementation / preserve obligation mapped |
| Build | task `designCovers` | code, tests, `completedDesignCovers` | no missing or extra DES claims |
| Review | diff plus design context | code-quality findings | findings do not reinterpret design facts |
| Verify | design proof objectives and DES IDs | current per-DES evidence | every relevant DES ID passes or returns explicitly |

Product paths are source context; downstream engineering routing is always through the exact task Log, current Handoff, `design.md`, and DES IDs.
