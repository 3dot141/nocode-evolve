# 内置 Slash Commands 完整清单

> 来源：`code.claude.com/docs/en/commands.md`（官方权威表格，约 100 条）。命令只在消息开头才被识别为命令。截至 v2.1.198。

## 按工作流阶段分组

**会话/上下文管理**：`/clear`（别名 `/reset` `/new`）、`/compact [instructions]`、`/context [all]`、`/rewind`（别名 `/checkpoint` `/undo`）、`/rename`、`/branch`、`/fork`、`/resume`（别名 `/continue`）、`/export`、`/recap`、`/btw`

**权限与模式**：`/permissions`（别名 `/allowed-tools`）、`/plan`、`/sandbox`、`/config`（v2.1.181+ 支持 `key=value` 直接改设置）

**模型/推理**：`/model`、`/effort`、`/fast`、`/advisor`（v2.1.98+）

**子代理/并行/后台**：`/agents`、`/tasks`（别名 `/bashes`）、`/background`（别名 `/bg`）、`/batch`、`/goal`、`/loop`（别名 `/proactive`）、`/schedule`（别名 `/routines`）、`/workflows`

**审查/质量**：`/code-review`、`/simplify`（v2.1.154+ 从 `/code-review` 拆分独立，专注清理不找 bug）、`/security-review`、`/diff`、`/ultrareview`（现推荐用 `/code-review ultra`）、`/ultraplan`

**Skills 型内置命令**（本质是 bundled skill，会自动触发也可手动调）：`/batch`、`/claude-api`、`/code-review`、`/debug`、`/design-sync`、`/fewer-permission-prompts`、`/loop`、`/run`、`/run-skill-generator`、`/simplify`、`/verify`

**跨端/协作**：`/desktop`（别名 `/app`）、`/teleport`（别名 `/tp`）、`/remote-control`（别名 `/rc`）、`/cd`（v2.1.169+）、`/add-dir`、`/ide`

**账号/系统**：`/login`、`/logout`、`/upgrade`、`/usage`（别名 `/stats` `/cost`）、`/usage-credits`、`/status`、`/privacy-settings`

**开发者体验**：`/statusline`、`/keybindings`、`/theme`、`/tui`、`/color`、`/focus`、`/scroll-speed`、`/terminal-setup`、`/voice`、`/heapdump`

**其他**：`/hooks`、`/skills`、`/plugin`、`/insights`、`/team-onboarding`、`/install-github-app`、`/install-slack-app`、`/web-setup`、`/autofix-pr`、`/powerup`、`/mobile`、`/radio`、`/stickers`、`/passes`

MCP 服务器可暴露 prompt 作为命令，格式 `/mcp__<server>__<prompt>`。

## 已移除

| 命令 | 移除版本 | 替代 |
|---|---|---|
| `/vim` | v2.1.92 | `/config` → Editor mode |
| `/pr-comments` | v2.1.91 | 直接让 Claude 去看 PR 评论 |

## 近期版本变更时间线

| 版本 | 变化 |
|---|---|
| v2.1.83 | `auto` 权限模式引入 |
| v2.1.91 / v2.1.92 | `/pr-comments`、`/vim` 分别被移除 |
| v2.1.98 | `/advisor` 命令 + `Monitor` 工具引入 |
| v2.1.117 | fork subagent 能力引入（当时需设 `CLAUDE_CODE_FORK_SUBAGENT=1`） |
| v2.1.142 | `TodoWrite` 默认禁用改用 `TaskCreate/TaskGet/TaskList/TaskUpdate`；`permissions.defaultMode: "auto"` 写在项目/本地 settings 会被忽略，必须写用户级 |
| v2.1.145 | `/run`、`/run-skill-generator`、`/verify` 引入 |
| v2.1.152 | `/reload-skills` 引入 |
| v2.1.154 | `/code-review` 与 `/simplify` 拆分 |
| v2.1.161 | `/fork` 命令默认启用（不再需要环境变量） |
| v2.1.169 | `/cd` 命令引入 |
| v2.1.172 | 子代理可派生自己的嵌套子代理 |
| v2.1.181 | `/config key=value` 直接改设置引入 |
| v2.1.186 | Shell mode `!` 命令输出落地后 Claude 自动回应一次；后台子代理权限提示浮现到主会话（此前是自动拒绝） |
| v2.1.187 | `/btw` 支持左右键切换历史答案；后台子代理嵌套深度在首次生成时固定 |
| v2.1.193 | 后台 Bash 在系统内存压力 + 空闲 30 分钟时会被系统 kill；Monitor 支持 WebSocket source |
| v2.1.195 | auto 模式默认拦截清单大幅扩充（写 secret manager、改 DNS、合并未经人审 PR 等） |
| v2.1.196 | `/doctor` 检测重复 agent 名；`ReportFindings` 工具引入；大图片按 JPEG 重编码而非简单缩小 |
