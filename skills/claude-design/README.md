# claude-design

Claude Design 终端操作 skill——从 Claude Code 里操作 claude.ai/design 项目。

## 做什么

统一包装两套底层工具：

- **`claude_design` MCP**（18 个工具）：项目 CRUD、预览、对话、成员管理、设计系统
- **DesignSync 内置工具**：大文件从磁盘上传（`localPath`）、register/unregister assets

核心职责是工具路由——根据文件大小和操作类型选择正确的工具，避免大文件撑爆 context。

## 与 `/design` 内置命令的关系

`/design` 是 Claude Code 产品内置的 slash command，硬编码在二进制里，用户手动 `/design <args>` 触发。它是个路由器，按第一个词分发：`sync`/`login` 转发到独立内置命令，`import`/`export`/`status` 直接用 MCP，其他文字走 `get_claude_design_prompt` 当 brief 生成设计。

`disableModelInvocation: true`——agent 不能自己调 `/design`，只有用户手动键入。

本 skill（`claude-design`）是 agent 可主动调用的操作手册，覆盖工具路由、并发安全、etag 防覆盖、跨 skill 集成等 `/design` 不管的编排细节。两者操作同一套底层 API。

## 历史备注

`skills/design/` 曾是 `design` skill 的目录，在统一 `dev-` 前缀命名时 rename 为 `dev-design`（commit `ab77398`）。残留的空目录已清理。与 `/design` 内置命令无关，纯同名巧合。

## 使用方式

agent 通过 `Skill(nocode-evolve:claude-design)` 调用，或被 pd-vd / dev-design-render 在流程中调用。用户直接操作 Claude Design 项目走 `/design` 内置命令。
