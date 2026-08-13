# Grilling and Log protocol

Read this reference when creating, resuming, or advancing `design.log.md`.

## Task path

Explicit existing directory or exact Log path wins. Otherwise create:

```text
docs/dev/{username}/{yymmdd}-{serial}-{topic}/
```

- `username`: explicit user or project configuration; ask once only if it cannot be resolved uniquely.
- `yymmdd`: directory creation date.
- `serial`: next two-digit sequence among that username's directories for the day.
- `topic`: short kebab-case phrase derived from the primary acceptable outcome.

Once created, never rename the directory for reclassification, resume, or design return.

## Single writer

The active dev-design coordinator is the only writer of design Decisions. Repository research, competitor research, Debug, other Skills, and agents return evidence; dev-design records that evidence in the process Log and converts only formed decision points into Decisions. devflow may write the classification Decision and its classification Round / Event, plus later process Events, but it cannot write any other design Decision. Re-read the file immediately before every write.

## Six fixed sections

```markdown
# Header
- task:
- status: active | landed | cancelled | terminated
- type: bug | feat | refactor
- currentNode:
- createdAt:
- artifacts:
  - log: ./design.log.md
  - design: ./design.md
  - render: ./design.html # only when it exists

# Decisions
## DEC-001
- kind:
- status: proposed | confirmed | rejected | superseded
- statement:
- sourceEntries: [Round N | Event N]
- evidence:
- designDisposition: required | n/a
- relations:

### 正文
<!-- Use `### Body` when the Log is written in English. Omit only when the metadata is lossless by itself. -->

# Decision Tree
| node | status | sourceDecisionIds | dependsOn | note |

# Terms

# Handoff

# Log
```

An assigned DEC ID is never removed or given a new meaning. Semantic change creates a new ID and connects `supersedes / supersededBy`. `designDisposition: n/a` requires a reason. Split tasks use `splitFrom / splitTo`.

Decision-tree statuses are `open / active / blocked / confirmed / n/a / superseded`. At most one node is active, and Header.currentNode must match it. Only confirmed, evidence-backed n/a, and superseded are closed. Add dynamic branches only after their trigger exists.

## Decision / Log separation

Decisions and Log entries have different jobs:

- `DEC-###` is the current semantic result: one formed, independently judgeable decision point. Its `statement` is a compact index. Add `### 正文` (`### Body` in English) when the decision contains a structured artifact, specification, matrix, contract, or multiple concrete facts that the statement cannot carry losslessly.
- `Round N` is the chronological decision process: evidence available at that time, the exact question, recommendation and reasons, the user's full decision-bearing answer, and the resulting Decision changes. Do not reduce `User Answer` to “用户已确认” when it contains material content.
- Decision `sourceEntries` names the Round / Event entries that formed or changed it. Decision `evidence` binds each material claim to its authoritative source. Neither field replaces the Decision body or the Round content.

For dense content, preserve named objects, sections, mappings, boundaries, exceptions, negative rules, relationships, and verification basis. If a Round confirms four asset cards plus how such cards should be written, the Round retains the full decision-bearing answer. Put the complete writing rule in its Decision body whenever the statement cannot carry it losslessly, and preserve every approved card in the body of its resulting Decision.

Verify source-backed details against the authoritative definition required by the decision. Preserve the resulting facts and distinctions; do not paste conversational filler or dump DSL / source code when the confirmed result is an edited specification.

Split results into related DEC IDs whenever they can be accepted, changed, superseded, or consumed independently, even when their current status, `designDisposition`, and relations happen to match. One Round may form several Decisions; a shared policy and independently evolving asset cards are separate decision points. When resuming a Decision whose body omitted already-confirmed content, restore the body under the same DEC ID only when this fills the omission without changing its meaning, and record the repair in the current Round's `Decision Changes`. A semantic change creates a new DEC ID and supersedes the old one.

## Eight-part Round

```markdown
## Round N — <node> — waiting | closed

### Background / Evidence
### Question
### Agent Recommendation + Reason
### User Answer
### Decision Changes
### Term Changes
### Flow Impact
### Next Node
```

Write `无` rather than deleting an empty part. Before asking, persist Background, one Question, and a concrete Recommendation with reasons as `waiting`. After the answer, preserve all decision-bearing content in `User Answer`, fill every part, synchronize Decisions and the other current views, and compare each changed Decision with the answer. Missing decision content keeps the Round `waiting`; only then mark it `closed` and ask the next question.

## Process Events

Non-decision workflow history uses a compact Log event rather than a DEC ID:

```markdown
## Event N — stage-transition | returned-evidence | task-end
- source:
- detail:
- decisionImpact: none | [DEC-...]
```

An Event records movement or returned evidence. If it changes a design meaning, dev-design opens a Round and creates or supersedes a Decision; the Event itself never receives `designDisposition` and never maps to a DES ID.

## Selecting the next question

1. Re-read the current tree.
2. Close facts the environment already proves and bind evidence.
3. Find the earliest open node whose dependencies are closed.
4. If several branches are ready, choose the one that can invalidate the most downstream work.
5. Ask one decision only. Include the recommended answer first and explain the trade-off.

Do not use a fixed questionnaire. The node domains and dependencies are stable; the path is dynamic.

## Evidence binding

Every source says which Decision or Round claim it supports.

- Repository: scanBase commit, path, symbol / config key / heading, read-time line, supported claim.
- Command: command, workdir / environment, execution time, relevant output, exit code, supported claim.
- Internal document: path, heading, commit or known update time, supported claim.
- User decision: Round number and resulting DEC ID.
- Online source: URL, page publish / update time when available, access time, supported claim.
- Internal knowledge: label `internal data source`, its data time or `runtime did not provide`, online-verification status, supported candidate.
- Screenshot / log / attachment: artifact path or stable ID, capture time, environment / scenario, supported claim.

Default competitor handling is an internal-knowledge candidate, not automatic web search. Browse only when the user explicitly asks. Never invent a source time; when unavailable, say so. Internal candidates without a source time are not current competitor facts.

## Terms

Record new domain terms and ambiguous words when they appear. Each current definition carries status, definition, included / excluded boundary, aliases or forbidden wording, source, impact, and supersession link. Existing authoritative project language may be `confirmed by source`; conflicting or new business meaning requires user confirmation.

Do not maintain ADR by default. Create one only when the user explicitly asks or the repository has an explicit mandatory ADR rule; derived ADRs cite the source DEC IDs.
