# Bug design document

Use one `design.md` for both passes. Problem and repair DES IDs remain stable in the same sequence.

## 问题

### Opening panorama

Show, in one ASCII screen:

- authoritative expectation and observable fault;
- actual versus expected flow with fault location / unknown interval;
- impact boundary and containment;
- active investigation DES IDs;
- current Handoff target Debug.

### Problem baseline

1. Source, goal, scope, and authoritative expectation
2. Expected / actual and reproduction contract
3. Actual / expected flow, including failure and recovery
4. Impact, risk, precedent, and evidence conflicts
5. Repair acceptance and unaffected invariants
6. Known interface / file surface and unresolved locations
7. Debug investigation contract and investigation DES IDs

Do not guess root cause or write repair 伪代码 in this half.

## 修复

Append only after Debug returns and the 问题 half stays in the same file.

### Opening panorama

Extend the problem panorama with the fault mechanism and before / after repair path. Do not delete the problem view.

### Per-mechanism groups

Group repairs by fault mechanism: one mechanism = one group carrying every repair it needs. Each group has:

1. 背景 — the fault mechanism, linking the Debug evidence that proves it
2. 目标 — repair acceptance (judgeable)
3. 机制流程 — fault-before / repair-after (ASCII)
4. blocks — one `N.x` per independently judgeable repair outcome, each with 接口 / 伪代码 / 影响文件; see `references/writing.md`. A block carries its own 流程图 when its repair has control flow the group view cannot show
5. 问题 — remaining risks and user decisions
6. 影响文件汇总 — one tree consolidating this group’s blocks

Then: compatibility / rollback, regression objectives, and Env versus Plan with the single-slice rule.

Architecture or DDD detail is conditional. Multi-domain collaboration is mandatory when the repair crosses domain or data-owner boundaries. End the half with the Closing overview (`总览 / 架构 / 文件`) as defined in `references/writing.md`.

## DES granularity

Assign DES IDs to each independent investigation, preserve invariant, completion condition, repair outcome, regression, observation, and compatibility / rollback obligation. A patch step, log line, or config tweak receives an ID only when it carries one of those judgeable results.

Finish with the shared DEC / DES coverage table from `references/writing.md`.
