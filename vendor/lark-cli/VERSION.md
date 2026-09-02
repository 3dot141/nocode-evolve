# Vendor: lark-cli

| 字段 | 值 |
|---|---|
| 上游仓库 | https://github.com/larksuite/cli |
| commit | 59dcdf5（2026-09-02 上游最新） |
| 拉取日期 | 2026-09-02 |
| 协议 | 见上游仓库 |
| 快照范围 | 仅本仓在用的 5 个 skill 子树（lark-doc / lark-markdown / lark-shared / lark-whiteboard / lark-wiki）；官方共 26 个 skill，其余未引入 |

## fork 改造记录

| 日期 | 改动 |
|---|---|
| 2026-09-02 | 首次 vendor。5 个 skill 本地版均已与官方分叉（本地为早期拷贝 + 后续本地维护，官方持续更新——如 lark-doc 新增 genres/ 与 create-workflow、lark-shared 新增 config-init/high-risk-approval 等），统一按 fork 登记；上游更新的合并另行人工 diff 处理 |
| 2026-09-02 | **全量更新到官方 59dcdf5**：diff 判定本地 5 个均为旧版官方拷贝、无本地增强，直接全量取官方（含新命令形态 `wiki +node-get`、`--as user/bot` 身份协议、frontmatter version/requires 等）；仅保留 lark-doc 本地扩展（`references/lark-doc-word-stat.md`、`references/style/`、`scripts/`）。分发副本已同步 |
