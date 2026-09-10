# Feat design document

Write the upper half after 产品 confirmation. Append each 开发 function group skeleton when the group opens, then each block as its ROUND closes.

## 产品

### Opening panorama

One ASCII screen shows the outcome, who it is for, what is in and out, and the function tree. Annotate confirmed DEC IDs. No implementation flowchart here.

### Function tree

List 功能 1 / 1.1 / 2 as user-understandable capabilities, not files. Record explicit non-scope and preserve obligations.

## 开发

Write this chapter only after the 产品 confirmation ROUND is closed.

### Opening panorama

One ASCII screen shows the function chains, the dependency direction between chains, active DES IDs, and the Plan Handoff. A chain runs end to end — frontend, backend, and data of one capability stay in one chain; an external collaboration prerequisite (another system, service, or repo that must change first) is a chain of its own.

### Function groups

Organize by function chain, never by tier or repo side: one chain = one group carrying all its parts together. Splitting one chain into backend and frontend sections hides the end-to-end flow the reader needs.

Each group carries the full skeleton regardless of size — a single-group task keeps every part:

1. 背景 — why this chain exists (2–3 lines, problem motivation)
2. 目标 — the judgeable outcome (2–3 lines)
3. 全景 — one ASCII view of this chain’s structure
4. 流程 — this chain’s end-to-end control flow (ASCII), with failure and recovery
5. blocks — one `N.x` per sub-function, each with 接口 / 伪代码 / 影响文件; see `references/writing.md`
6. 问题 — this group’s non-blocking opens, user decisions, and collaboration points
7. 影响文件汇总 — one tree consolidating this group’s blocks

A block carries its own 流程图 only when it has control flow the group flow cannot show. Do not invent a path, symbol, signature, or schema. Missing facts become an investigation DES.

### Closing overview

End the half with `总览 / 架构 / 文件` as defined in `references/writing.md`.

## Conditional lenses

Architecture detail, tactical DDD, and cross-cutting quality expand only when a DEC makes them load-bearing. Multi-domain collaboration is mandatory when more than one domain or data owner participates.

## DES granularity

Assign DES IDs to independently implementable / verifiable behavior, rule, contract, data, migration, observation, or verification obligations. Do not assign IDs to explanatory background or every field / function.

Finish with the shared coverage table from `references/writing.md`.
