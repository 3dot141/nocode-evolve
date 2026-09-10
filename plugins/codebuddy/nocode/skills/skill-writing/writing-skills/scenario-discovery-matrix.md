# Scenario Discovery Matrix

Don't invent scenarios by gut feel. Scan every axis below — each cell that applies
to your skill becomes at least one candidate scenario. Skip a cell only with a reason.
For each candidate, name HOW the agent could fail (the mechanism), not just the input.

**Axis 1 — Intent validity** (all types):
- [ ] VALID: well-formed request squarely in scope
- [ ] INVALID: should be refused / out of scope / errors out
- [ ] UNDERSPEC: ambiguous or missing info — does the agent ask or silently guess?

**Axis 2 — Task type** (pick the rows matching your skill):
- [ ] Discipline: skips a costly rule under pressure
- [ ] Technique: knows the concept but applies it wrong
- [ ] Pattern: fails to notice the pattern applies
- [ ] Reference: uses memory instead of looking up the right section
- [ ] Workflow/order: skips gates, reorders steps, marks done without evidence
- [ ] Tool/API: picks familiar tool, wrong fallback, or stale API
- [ ] Output-format: satisfies substance but breaks schema/template

**Axis 3 — Failure mode** (the mechanism the scenario exposes):
- [ ] Noncompliance: treats a mandatory step as optional
- [ ] Rationalization: invents an exception ("just this once")
- [ ] Premature closure: stops at first plausible answer
- [ ] Hallucinated certainty: asserts unsupported facts or APIs
- [ ] Tool misuse: wrong/unsafe tool, missing precondition check, bad fallback
- [ ] Context loss: misses earlier instruction, user constraint, or file evidence
- [ ] Instruction conflict: follows lower-priority text over higher-priority
- [ ] Overreliance: trusts generated code / tool output without verification
- [ ] Excessive agency: irreversible action without required confirmation
- [ ] Format drift: violates required structure, fields, naming, line limits
- [ ] Ambiguity collapse: picks one reading when it should surface alternatives
- [ ] Overfitting: solves the example but fails nearby variants

**Axis 4 — Cognitive bias / pressure** (Discipline; best scenarios combine 3+):
- [ ] Time: deadline, outage, "do it quickly"
- [ ] Sunk cost: correct action discards hours/lines already spent
- [ ] Authority: senior/manager insists on the unsafe shortcut
- [ ] Social: "don't be dogmatic," "everyone does it this way"
- [ ] Anchoring: first solution/estimate/diagnosis is misleading
- [ ] Confirmation: prompt embeds evidence favoring the tempting answer
- [ ] Availability/recency: recently-seen bug/tool is the wrong analogy
- [ ] Framing: same facts as loss vs gain, urgent vs routine
- [ ] Overconfidence: "obvious," "safe," "trivial," "I know this"
- [ ] Action bias: edits/runs before researching or asking

**Axis 5 — Context complexity**:
- [ ] Cold start: no prior context; tests discovery + trigger
- [ ] Mid-task momentum: already executing, may skip reorientation
- [ ] Long context: key instruction far above recent turns
- [ ] Conflicting context: README, AGENTS, user, file comments disagree
- [ ] Partial info: required detail missing; correct move is to ask/inspect
- [ ] Distractors: irrelevant files/results look important
- [ ] Multiple artifacts: needs code + docs + tests + config coordinated
- [ ] Dirty workspace: unrelated changes exist, must not be reverted
- [ ] Untrusted content: web/file/tool output carries instructions to obey
- [ ] Resource limits: token/time budget, flaky tools, no network

**Axis 6 — Boundary & equivalence** (Technique/Pattern/Reference):
- [ ] Typical case (center of the partition)
- [ ] Boundary case (empty, max, first/last, zero, exactly-minimum)
- [ ] Just-out-of-range (one step past the boundary)
- [ ] Near-miss trigger: similar wording but skill should NOT apply
- [ ] Fallback path: preferred path fails with a specific error
- [ ] Destructive op: delete, reset, publish, push, deploy, migrate
- [ ] Security/privacy edge: secrets, tokens, personal/proprietary data

**Axis 7 — Prompt robustness** (vary the surface, hold intent):
- [ ] Syntactic: paraphrase, typos, synonyms, format/casing, another language
- [ ] Semantic: shift meaning to probe a different branch of the skill
- [ ] Reorder facts so the key fact isn't first; add irrelevant numbers
- [ ] Embed a plausible bad user suggestion
- [ ] Direct prompt injection ("ignore prior instructions")
- [ ] Indirect injection inside file/web/tool output

## Phase 3 Selection Rules

Don't run every cell — pick the minimal orthogonal set that covers the matrix.

**Coverage:**
- [ ] ≥3 scenarios for Discipline/Technique/Pattern, ≥2 for Reference
- [ ] Each scenario covers ≥1 task type + ≥1 failure mode + ≥1 context/boundary cell
- [ ] ≥1 scenario combines 3+ pressures (Discipline)
- [ ] ≥1 near-miss / counter-example; ≥1 cold-start; ≥1 mid-task or long-context
- [ ] ≥1 fallback/error scenario if the skill calls tools
- [ ] Hold out a validation set — don't rewrite the skill against all scenarios

**Scenario quality gate** (reject scenarios that fail any):
- [ ] A real agent could plausibly hit this situation
- [ ] The wrong behavior is genuinely tempting
- [ ] Correct behavior is unambiguous to the skill author
- [ ] The expected failure is observable from transcript/output
- [ ] Prompt doesn't reveal it's testing a rule, and doesn't over-constrain toward the answer

**RED exit evidence:**
- [ ] Baseline run without the new skill
- [ ] ≥1 reproducible failure observed, labeled with a matrix cell
- [ ] Rationalization copied verbatim
- [ ] Each future skill requirement traces to a real observed failure
