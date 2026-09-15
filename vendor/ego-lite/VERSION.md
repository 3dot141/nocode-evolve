# Vendor: ego-lite

| 字段 | 值 |
|---|---|
| 上游仓库 | https://github.com/citrolabs/ego-lite |
| commit | d01be93325c7ea59d41c2ca9f4c59b58b4be4046 |
| skill 版本 | 2.0.0（2026-09-09） |
| 拉取日期 | 2026-09-15 |
| 协议 | MIT（仓库内容；ego lite 浏览器本体为独立免费下载） |
| 快照范围 | 仅 `skills/ego-browser/` 子树（SKILL.md / references / learnings / scripts）；上游 2.0.0 起已删除 `agents/` 与 `assets/`；`package/` runtime 源码未纳入，按需再取 |

## 内容概览

| 类型 | 说明 |
|---|---|
| skill | `ego-browser` — ego lite 浏览器的 agent 自动化 runtime 接口 |

## fork 改造记录

| 日期 | 改动 |
|---|---|
| 2026-09-02 | 首次 vendor（上游 1.2.6）。`skills/ego-browser/SKILL.md` 为本仓增强版：补 `cdp()` 第三参 sessionId、`js(expr, targetId)` 按 target 执行、OOPIF（跨域 iframe）attach 完整示例与导航失效提醒——上游 runtime 已支持但官方文档未写（实测 0.4.7.4 可用）。本地另保留 `learnings/github/` 与 `references/profile-import.md`。 |
| 2026-09-15 | 升级到上游 2.0.0（`d01be93`），SKILL.md 为 v2 API 全量重写。原增强按 v2 重写并保留全部能力：v2 的 `page.cdp()` / `task.cdp()` 只接受 `{ timeout }`、不接受 session 参数，但运行时仍保留 legacy 全局 `cdp(method, params, sessionId)` / `js(expr, targetId)` / `drainEvents()`（help 默认隐藏），OOPIF attach、按 session `Network.enable`、事件带 sessionId 回流实测在 0.5.0.32 全部可用（`lark-project/worklog` 的 OOPIF 抓 key SOP 不受影响）。跟随上游删除 `agents/openai.yaml`、`assets/`、`references/video.md`；上游已收编 `learnings/github/`，本地 extra 仅剩 `references/profile-import.md`。 |
