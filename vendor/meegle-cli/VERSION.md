# Vendor: meegle-cli

| 字段 | 值 |
|---|---|
| 上游仓库 | https://github.com/larksuite/meegle-cli |
| commit | 6d298ab（2026-08-27） |
| 拉取日期 | 2026-09-02 |
| 协议 | MIT |
| 快照范围 | 仅 `skills/meegle/` 子树；CLI 本体走 npm `@lark-project/meegle` 安装 |

## fork 改造记录

| 日期 | 改动 |
|---|---|
| 2026-09-02 | 首次 vendor。本地 meegle 为 260817 adopt 官方版后持续本地增强（流转 confirm_form 坑、来源字段四选一与静默失败、PR #2065 实测教训等，见 SKILL.md 与 sop-transition-state.md）；官方亦有更新（新增 references/ai-handoff.md 等）。fork 登记，合并另行人工 diff |
| 2026-09-02 | **全量更新到官方 6d298ab**：SKILL.md 与 references 全量取官方（大部分实测知识官方已回流，且新增 `workitem +batch-get`、`--name` 查询、脱敏占位、`ai-handoff.md`、`url-links.md`）；唯一保留本地版 `references/sop-transition-state.md`——其 4.4 节（来源字段四选一、静默失败、PR #2065 教训）为官方没有的本地增强。`lark-project` skill 对 4.4 的引用不受影响 |
