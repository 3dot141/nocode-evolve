# dev-plan

把 confirmed `design.md` 中由当前 Handoff 选中的 DES obligations 映射为依赖有序、可独立验证的实施任务。

Plan 不修改设计语义。仓库证据若改变 goal、scope、contract、Preserve、acceptance 或 DES meaning，返回同一 `design.log.md` 的 dev-design；只有任务图和切片问题留在 Plan。

每个 task 必须声明 `designCovers`，最终 coverage 从 Handoff DES IDs 向任务或 Verify 反查，避免靠任务自报形成遗漏。
