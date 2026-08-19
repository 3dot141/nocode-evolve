# Refactor coverage

Use this file after a half’s task tree is empty. It does not generate the next question.

Code elegance is a valid motivation only when the disliked structure, desired quality, and stopping condition are concrete.

## Before — upper half

- [ ] Primary outcome is internal structure with preserved behavior. New external behavior → feat. Violated authority → bug.
- [ ] Motivation names the structure, the quality harm, and when cleanup is enough.
- [ ] Scope, non-scope, and affected owners are bounded.
- [ ] Before structure covers responsibilities, dependencies, ownership, failure, and test seams.
- [ ] Every preserve obligation has a verification method.

Do not put After flowcharts in this half.

## After — lower half

Read the Before implementation first. Recommend the best structure, not the smallest move.

- [ ] Target quality can be judged without taste alone.
- [ ] Real After alternatives, or proof that only one structure is feasible.
- [ ] After architecture and migration flow exist.
- [ ] Every structural block has flowchart, 接口, 伪代码, and 问题.
- [ ] Every old element maps to preserve, migrate, adapt, or delete.
- [ ] Coexistence, rollback, cleanup Gate, and characterization proof are closed.

## Conditional branches

Open extra nodes only when triggered: public API, persistent data, zero downtime, performance budget, or multiple owners.
