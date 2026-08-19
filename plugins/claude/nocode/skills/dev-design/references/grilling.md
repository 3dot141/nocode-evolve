# Grilling and Log protocol

Read this reference when creating, resuming, or advancing `design.log.md`. The interview method (design tree, frontier rounds, fact-finding, done condition) is not restated here — invoke the `grill-me` skill and follow it:

Use `Skill(nocode:grill-me)`.

This file owns only the Log persistence protocol.

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

The active dev-design coordinator is the only writer of design Decisions. Repository research, competitor research, Debug, other Skills, and agents return evidence; dev-design records that evidence in ROUND 背景 and converts only formed decision points into Decisions. devflow may write the classification Decision and its classification ROUND / Event, plus later process Events, but it cannot write any other design Decision. Re-read the file immediately before every write.

Old logs that still use six sections and eight-part Rounds are valid history. Do not migrate them. New logs follow this file.

## Fixed sections

```markdown
# Header
- task:
- status: active | landed | cancelled | terminated
- type: bug | feat | refactor
- phase: 产品 | 开发 | 问题 | 修复 | Before | After
- current: 功能 1.1
- predecessor: <repository-relative path of the Log this round continues, or 无>
- createdAt:
- artifacts:
  - log: ./design.log.md
  - design: ./design.md
  - render: ./design.html # only when it exists

# Decisions

## DEC-001
- 描述:
- 内容:
- 后果:
- 过程:
- 引用: [ROUND-001]

# ROUND

## ROUND-001 — waiting | closed
### 背景
### 问题
### 方案
### 回答

# Handoff
```

An assigned DEC ID is never removed or given a new meaning. Semantic change creates a new ID and records the succession in `过程`. `引用` lists the ROUND IDs that formed or changed the Decision.

Header.`phase` and Header.`current` name the active half and the active block. At most one block is active.

Header.`predecessor` links to the Log of a completed previous round when devflow opened this Log for new input after closure; otherwise it is `无`. A terminal-status Log is never reopened — its Header, Decisions, and ROUNDs receive no new design content; only the `successor` pointer Event may be appended.

## DEC / ROUND separation

- `DEC-###` is the current semantic result. `描述` is a one-line index. `内容` is the standalone conclusion `design.md` may cite. `后果` records the accepted cost or follow-up obligation the choice creates; write `无` when there is none. `过程` records proposed / revised / confirmed and any succession. Details stay in ROUND.
- `ROUND-###` is the chronological decision process. Do not reduce `回答` to “用户已确认” when it contains material content.
- One ROUND may form several Decisions. One Decision may cite several ROUNDs. Split results into related DEC IDs whenever they can be accepted, changed, or superseded independently.

Write `无` rather than deleting an empty ROUND part. Persist 背景, 问题, and a concrete 方案 as `waiting` before asking. After the answer, fill 回答, update every affected Decision, and only then mark the ROUND `closed` and ask the next question. Missing decision content keeps the ROUND `waiting`.

## Process Events

Non-decision workflow history may use a compact event instead of a DEC ID:

```markdown
## Event N — stage-transition | returned-evidence | task-end | successor
- source:
- detail:
- decisionImpact: none | [DEC-...]
```

An Event records movement or returned evidence. If it changes a design meaning, dev-design opens a ROUND and creates or supersedes a Decision. The Event itself never receives `designDisposition` and never maps to a DES ID.

## Selecting the next question

Invoke the `grill-me` skill for the interview method (design tree, frontier, fact-finding, done condition) — same invocation as at the top of this file. Type `questions.md` files are coverage checks after a half is empty. They do not generate the next question.

## Evidence

Bind every material claim in ROUND 背景:

- Repository: scanBase commit, path, symbol / config key / heading, read-time line, supported claim.
- Command: command, workdir / environment, execution time, relevant output, exit code, supported claim.
- Internal document: path, heading, commit or known update time, supported claim.
- User decision: ROUND ID and resulting DEC ID.
- Online source: URL, page publish / update time when available, access time, supported claim.
- Internal knowledge: label `internal data source`, its data time or `runtime did not provide`, online-verification status, supported candidate.

Default competitor handling is an internal-knowledge candidate. Browse only when the user explicitly asks. Never invent a source time.

Terms belong in the relevant DEC `内容` or ROUND `背景`. Do not keep a Terms chapter. Do not maintain ADR by default.
