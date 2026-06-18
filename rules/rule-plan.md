# nocode-evolve:plan 独立触发

devflow 外部独立触发 plan skill 的约束。

## 触发条件

用户说「写计划 / 拆任务 / 怎么实现 / plan it out / 拆解一下 / 实现方案」，或已有明确目标需要拆分为可执行任务。

## 做法

1. 确认 Define 已完成（有 restate 或用户明确了目标）
2. `Skill(nocode-evolve:plan)` — 走完整 Plan 流程
3. 产出任务列表 + checkpoint

## 不要

- 不在目标不明确时就开始拆任务——先走 Define
- 不写占位符计划（`<TODO>` / `...`）——每步贴真实代码和命令
