# Vendor: ego-lite

| 字段 | 值 |
|---|---|
| 上游仓库 | https://github.com/citrolabs/ego-lite |
| commit | 5ca3c36cba2240b8df2e22ba32127747029039d5 |
| skill 版本 | 1.2.6（2026-07-20） |
| 拉取日期 | 2026-09-02 |
| 协议 | MIT（仓库内容；ego lite 浏览器本体为独立免费下载） |
| 快照范围 | 仅 `skills/ego-browser/` 子树（SKILL.md / references / learnings / scripts / agents / assets）；`package/` runtime 源码未纳入，按需再取 |

## 内容概览

| 类型 | 说明 |
|---|---|
| skill | `ego-browser` — ego lite 浏览器的 agent 自动化 runtime 接口 |

## fork 改造记录

| 日期 | 改动 |
|---|---|
| 2026-09-02 | 首次 vendor（上游 1.2.6）。`skills/ego-browser/SKILL.md` 为本仓增强版：补 `cdp()` 第三参 sessionId、`js(expr, targetId)` 按 target 执行、OOPIF（跨域 iframe）attach 完整示例与导航失效提醒——上游 runtime 已支持但官方文档未写（实测 0.4.7.4 可用）。本地另保留 `learnings/github/` 与 `references/profile-import.md`。 |
