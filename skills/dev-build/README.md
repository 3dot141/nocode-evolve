# dev-build

执行 confirmed Plan，或执行 Bug repair Handoff 允许的单一闭环 slice。Build 只消费当前 `design.md` 与 DES IDs，不通过 revision / digest 复制设计基线。

支持三种执行方式：主会话顺序执行、逐 task 隔离实现 + 风险 task 审查、逐 task 隔离实现 + 完整审查。隔离 implementer 仍共享工作树，因此一律顺序派发。

每个结果回报 `completedDesignCovers`、`changedFiles` 和新鲜 `evidence`。设计语义冲突回原 dev-design Log，任务图问题回 Plan，实现失败留在 Build。
