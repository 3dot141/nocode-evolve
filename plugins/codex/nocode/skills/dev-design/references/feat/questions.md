# Feat coverage

Use this file after a half’s task tree is empty. It does not generate the next question.

## 产品 — upper half

- [ ] Observable outcome and why it is a feat, not a bug or independent refactor.
- [ ] Actors and forbidden behavior when roles actually fork the result.
- [ ] In-scope functions, explicit non-scope, and preserve obligations.
- [ ] Domain language that the function tree depends on.
- [ ] One panorama plus a function tree (功能 1 / 1.1 / 2). No implementation flowcharts here.
- [ ] Competitor insight, if any, has provenance and a named effect on the tree.

## 开发 — lower half

Investigate the current implementation of the active function before designing it.

- [ ] Development panorama, architecture, and system flow exist.
- [ ] Every product function has a development section with flowchart, 接口, 伪代码, and 问题.
- [ ] Interfaces name verified symbols or an investigation DES.
- [ ] Failure, recovery, and applicable sensitive risks have an enforceable design.
- [ ] Release, migration, compatibility, rollback, and cleanup are closed when they apply.

## Conditional branches

Open a new task-tree node only after its trigger exists: permissions, external systems, persistent state, concurrency, production rollout, AI eval, money, or irreversible action.
