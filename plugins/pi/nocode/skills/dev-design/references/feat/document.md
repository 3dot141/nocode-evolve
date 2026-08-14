# Feat design document

Write the upper half after 产品 confirmation. Append each 开发 function only after that function’s ROUND is closed.

## 产品

### Opening panorama

One ASCII screen shows the outcome, who it is for, what is in and out, and the function tree. Annotate confirmed DEC IDs. No implementation flowchart here.

### Function tree

List 功能 1 / 1.1 / 2 as user-understandable capabilities, not files. Record explicit non-scope and preserve obligations.

## 开发

Write this chapter only after the 产品 confirmation ROUND is closed.

### Opening panorama

One ASCII screen shows architecture, the system flow, active DES IDs, and the Plan Handoff.

### Architecture and flow

Boundaries, responsibilities, dependency direction, and the main system path. Failures and recovery belong on the flow.

### Per-function sections

Each product function becomes one development section with all four parts:

1. 流程图 — implementation / control flow
2. 接口 — verified external and internal contracts; see `references/writing.md`
3. 伪代码 — the load-bearing control flow
4. 问题 — open items, user decisions, ungrillable look-and-feel

Do not invent a path, symbol, signature, or schema. Missing facts become an investigation DES.

After all functions, include one consolidated impacted-files index: each repository-relative `NEW / MODIFY / DELETE / PRESERVE` file appears once with every function, DES ID, and numbered change point.

## Conditional lenses

Architecture detail, tactical DDD, and cross-cutting quality expand only when a DEC makes them load-bearing. Multi-domain collaboration is mandatory when more than one domain or data owner participates.

## DES granularity

Assign DES IDs to independently implementable / verifiable behavior, rule, contract, data, migration, observation, or verification obligations. Do not assign IDs to explanatory background or every field / function.

Finish with the shared coverage table from `references/writing.md`.
