# Target Analysis for Tool-Wrapping Skills

Structured research method for Phase 2 (Interview & Research) when the skill **wraps an external target** — a CLI tool, REST API, library, hosted service, or multi-tool workflow. The skill's job is teaching an agent to use that target correctly; this method's job is making sure the research produces something Phase 4 can actually build from.

**When this applies:** the skill's core content is "how to operate X" where X exists outside the skill (jq, GitHub API, lark, signoz, figma...).
**When it doesn't:** discipline/technique skills (TDD, debugging, verification) — there is no external target to analyze; use the standard Phase 2 flow.

Baseline testing showed that without this method, agents research thoroughly but fail in three consistent ways: they cover the target's entire surface with no scope cut, they produce narrative bullets instead of a uniform capability structure, and they leave no bridge from research to skill structure. Each step below exists to counter one of those failures.

## Step 1: Scope before you analyze

**Set the boundary first — analyzing an uncut target produces an uncuttable skill.**

Large targets (aws, GitHub API, jq's full language) cannot and should not be fully covered. Before extracting anything:

- If the user named a subset, that's the scope. Otherwise default to **one operational slice drawn from the target's first-party quickstart/tutorial workflows** — cap it at 8-12 capabilities and record what you excluded. Don't try to determine "the most common operations" by scanning the whole surface; the quickstart path IS the target authors' answer to that question.
- If scope is genuinely unclear, ask the user **before** researching — one targeted question beats a wrong full-surface analysis. Ask "which user outcome should this skill serve first?" — do **not** offer "everything" as an option for a broad target. Ask about credentials only once the chosen slice actually needs them.
- Tiering the full surface (Tier 1 core → Tier N advanced) is not scoping — a tiered everything-list is still an everything-list. Cut, don't rank.

## Step 2: Classify the target and use the real thing

Never approximate from memory. Each target type has a concrete analysis method:

| Type | Signals | Analysis method |
|---|---|---|
| CLI | executable in PATH, `--help` works, man page | Run `<tool> --help`, `<tool> <subcommand> --help`, `man <tool>`. Parse subcommands, flags, output formats |
| API | OpenAPI/Swagger spec, REST/GraphQL endpoints | Fetch the real spec or reference docs. Extract endpoints, methods, auth patterns, error codes, pagination, rate limits. Verify live where credentials allow |
| Library | package registry presence, import path | Read the registry page, README, public API docs, type hints. Identify init patterns and common workflows |
| Workflow | multi-step description, multiple tools | Parse steps, map state-before → state-after per step, mark handoff points, rollback options, error-prone steps |
| Service | hosted platform, dashboard, auth wall | Read getting-started + API reference. Map user journey → calls → outcomes. Note roles/permission boundaries, account setup, webhooks/events |

**Decide the version policy up front**: the skill targets the user's stated version if given, else the latest stable documented version — the locally installed version is *evidence*, not the target. Feature sets skew across versions (check `--version`); where local behavior differs from current docs, record both as a compatibility note instead of silently writing the skill to your machine's install.

Verify surprising behavior **empirically** (run the command, call the endpoint) — docs lag reality. Record what you observe, not what you assume: if docs say a parameter is optional, mark it optional; if you couldn't verify a claim, label it unverified.

## Step 3: Extract capabilities in a uniform structure

Narrative bullets don't survive the trip to Phase 4. Record every in-scope capability in the same shape:

```
- name: verb-noun slug (e.g. merge-pr, filter-stream)
  what: one sentence
  invocation: exact command / endpoint / call — syntax Phase 4 must not paraphrase
  inputs: required/optional, with types (workflow/service: state before)
  outputs: what comes back, in what shape (workflow/service: state after)
  auth: token / scope / role needed, or none
  safety: read-only | write | destructive
  complexity: simple (one command/call) | moderate (2-5 steps) | complex (branching)
  evidence: ran | fetched-docs | unverified — plus the command/URL it came from
  destination: (filled in Step 4)
```

Alongside capabilities, collect **error patterns** as a separate list — auth failures, rate limits, version gaps, environment differences, destructive traps. Capture the trigger and the observed (or documented) message with the same `evidence` labels; these become the Failure Modes table in Step 5.

Keep the target's original terminology. If the API calls it a "workspace", don't rename it to "project" — the agent using the skill will be reading the target's own docs and errors.

If you hit an auth wall, rate limit, or dead link during analysis, record it in a notes list rather than silently skipping — those gaps are themselves findings about what the skill must handle.

## Step 4: Group capabilities and map them to skill structure

Bridge research to structure before writing. First group:

- CRUD operations on the same resource
- Read-only vs write/destructive operations
- Setup/teardown pairs
- Progressive complexity chains (basic → advanced usage)

Then fill each capability's `destination` field:

| Destination | Criteria |
|---|---|
| SKILL.md body | The common ~80% of requests; core invocation patterns; anything ordering-critical |
| references/ file | Deep detail for one command group; advanced/situational capabilities; loaded on demand |
| script | Exact syntax that must not be paraphrased; fixed multi-step sequences; data transforms; anything needing >5 lines of prose to explain one command |

Destination says *where* content lives; form is orthogonal — wherever it lands, exact syntax stays verbatim (never paraphrased into prose), while judgment calls and WHY-explanations belong in prose. An agent reading only SKILL.md should handle most requests; the rest must be reachable through explicit references — see `anthropic-best-practices.md` (Progressive disclosure patterns) for the loading mechanics.

## Step 5: Turn error patterns into a Failure Modes table

The error patterns collected in Step 3 become a troubleshooting table in the produced skill — per operation group or as a dedicated section (move to references/ if long):

```markdown
| Problem | Cause | Fix |
|---------|-------|-----|
| 404 on a repo you know exists | Token lacks scope — GitHub returns 404, not 403, for invisible private resources | Check auth/scope first; don't trust "not found" |
| `jq ... f.json > f.json` empties the file | Shell truncates the destination before jq reads it | Write to a temp file, then `mv` |
```

Every row carries a source: `observed` (you triggered it) / `docs` (documented failure) / `sandbox` (reproduced in an isolated environment) / `unverified` (label it as such in the produced skill). **Destructive or costly failures — deletes, quota exhaustion, prod-only auth states — must not be live-tested to fill the table**; cite docs or reproduce in a sandbox only.

What belongs in the table: failures a user will actually hit against the target — auth/permission surprises, rate limits, version skew, environment differences, destructive traps, misleading error messages. What doesn't: the skill's own step-by-step instructions (that's the body's job), and generic advice ("check your input") with no sourced failure behind it.

**Don't confuse these with baseline failures.** Failure Modes are *target* failures — the tool misbehaving at the user — and they populate the produced skill's troubleshooting content. Phase 3 baseline failures are *agent* failures — the agent doing the wrong thing without the skill. A finished target analysis does not exempt you from Phase 3: you still must watch an agent fail without the skill before writing it (the Iron Law).

## Exit checklist

- [ ] Scope = named subset or quickstart-derived slice (8-12 capabilities), exclusions recorded
- [ ] Every in-scope capability in the uniform structure, with `evidence` and `safety` filled
- [ ] Error patterns collected with triggers, messages, and source labels
- [ ] Every capability has a `destination` (SKILL.md / reference / script)
- [ ] Failure Modes table planned; destructive rows sourced from docs/sandbox, not live-tested
- [ ] Capability groups + error patterns fed into the Scenario Discovery Matrix as scenario inputs (label scenarios with the capability/error they exercise)
- [ ] All facts traced to the real target (ran / fetched / read) — no from-memory entries, unverified claims labeled

---

*Adapted from [SkillAnything](https://github.com/AgentSkillOS/SkillAnything) (MIT) — `agents/analyzer.md`, `agents/designer.md`, `METHODOLOGY.md` — whose pipeline methodology derives from [CLI-Anything](https://github.com/HKUDS/CLI-Anything) (MIT). Reworked against baseline failures observed in this repo (scope creep, unstructured extraction, missing research→structure bridge), then hardened by adversarial review (scope-slice defaulting, evidence-graded failure rows, target-vs-baseline failure distinction).*
