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

### Per-repair sections

Each independently judgeable repair outcome has:

1. 流程图 — fault-before / repair-after
2. 接口 — verified contracts and callers
3. 伪代码 — the selected repair mechanism
4. 问题 — remaining risks and user decisions

Then: consolidated impacted-files index (`NEW / MODIFY / DELETE / PRESERVE`), compatibility / rollback, regression objectives, and Env versus Plan with the single-slice rule.

Architecture or DDD detail is conditional. Multi-domain collaboration is mandatory when the repair crosses domain or data-owner boundaries.

Finish with the shared DEC / DES coverage table from `references/writing.md`.
