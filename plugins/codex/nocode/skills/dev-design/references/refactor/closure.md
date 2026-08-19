# Refactor closure

Reopen the responsible Before or After block. Do not refer to R-numbers as the next question.

## Before Gate

- [ ] The primary outcome is structural and behavior-preserving.
- [ ] Motivation names a concrete structural problem, desired quality, and stopping condition.
- [ ] Before scope, owners, and structure are fully bound.
- [ ] Every preserve obligation has an objective proof method.

## After Gate

- [ ] Target qualities can be judged without relying on taste alone.
- [ ] Real structural alternatives exist, or only one is proven feasible.
- [ ] After architecture and migration flow exist.
- [ ] Every change group has 背景, 目标, 迁移流程, 问题, and a consolidated impacted-files tree; every structural block has 接口, 伪代码, and 影响文件.
- [ ] Every old element maps to preserve, migrate, adapt, or delete.
- [ ] Intermediate risk has detection and recovery.
- [ ] Deletion waits for caller / data / traffic evidence.

Bidirectional checks:

```text
motivation -> After change -> migration step -> invariant proof
After element -> source motivation / constraint
old element -> destination
risk -> detection -> recovery
```

A file move, rename, extraction, or new abstraction is not automatically an independent design obligation.
