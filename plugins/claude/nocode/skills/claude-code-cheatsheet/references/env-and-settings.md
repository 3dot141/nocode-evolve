# settings.json 字段 + 环境变量完整清单

> 来源：`code.claude.com/docs/en/settings.md` + `env-vars.md`。截至 v2.1.198。只收与本 skill 主文相关、值得记住的项；穷举所有字段以官方文档为准。

## settings.json 关键字段

| 字段 | 作用 | 默认值 |
|---|---|---|
| `autoCompactEnabled` | 是否自动压缩上下文 | `true` |
| `permissions.defaultMode` | 打开会话时的默认权限模式 | 无（v2.1.142+ 起 `auto` 只在用户级 `~/.claude/settings.json` 生效，项目/本地级会被忽略） |
| `respondToBashCommands` | `!` shell 命令跑完后 Claude 是否自动回应（v2.1.186+） | `true` |
| `showClearContextOnPlanAccept` | 批准 plan 时是否显示"清空上下文"选项 | `false` |
| `viewMode` | 启动时的 transcript 视图（`default/verbose/focus`） | 无 |
| `statusLine` | 自定义状态栏命令/刷新间隔 | 无 |
| `cleanupPeriodDays` | 会话文件/孤立 worktree 保留天数 | `30` |
| `includeGitInstructions` | 系统提示词里是否包含 git 提交/PR 工作流指令和 git status 快照 | `true` |
| `agent` | 把整个主线程设为跑某个子代理定义（等价 `--agent`） | 无 |
| `skipDangerousModePermissionPrompt` | 跳过进入 `bypassPermissions` 前的二次确认 | 无 |
| `disableAllHooks` | 关闭所有 hooks 和自定义 status line | `false` |
| `effortLevel` | 默认 effort level | 视模型而定 |
| `fastModePerSessionOptIn` | fast mode 是否需要每会话手动开启 | 视模型而定 |
| `outputStyle` | 系统提示词层面的持久化行为风格 | 无 |
| `env` | 注入任意环境变量块，是配置下表大多数变量的主要入口 | — |

## 环境变量（写在 `settings.json` 的 `env` 块里生效）

| 变量 | 作用 |
|---|---|
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | 自动压缩计算所用的上下文容量（token 数） |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | 触发自动压缩的窗口百分比（1–100） |
| `DISABLE_AUTO_COMPACT` | 关闭自动压缩（等价 `autoCompactEnabled: false`） |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | 整体禁用后台任务能力（含 `run_in_background`、自动转后台、`Ctrl+B`） |
| `CLAUDE_AUTO_BACKGROUND_TASKS` | 强制长任务约 2 分钟后自动转后台 |
| `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP` | 关闭"系统内存压力下杀后台任务"的行为（v2.1.193+ 默认行为） |
| `BASH_DEFAULT_TIMEOUT_MS` | Bash 默认超时（默认 2 分钟） |
| `BASH_MAX_TIMEOUT_MS` | Bash 可申请的最大超时（默认 10 分钟） |
| `BASH_MAX_OUTPUT_LENGTH` | 单次输出截断阈值（默认 30,000 字符，硬上限 150,000） |
| `ENABLE_PROMPT_CACHING_1H` | 开启 1 小时 prompt cache TTL（API key/Bedrock/Vertex 默认 5 分钟） |
| `FORCE_PROMPT_CACHING_5M` | 强制 5 分钟 TTL（调试用，或覆盖组织托管的 1 小时配置） |
| `DISABLE_PROMPT_CACHING`（及 `_HAIKU`/`_SONNET`/`_OPUS`/`_FABLE` 变体） | 按模型禁用 prompt caching |
| `CLAUDE_CODE_ENABLE_AUTO_MODE` | 在 Bedrock/Vertex/Foundry/gateway 上解锁 `auto` 权限模式 |
| `CLAUDE_CODE_FORK_SUBAGENT` | 显式开/关 fork 子代理能力（v2.1.161+ 默认已开，一般不需要设） |
| `CLAUDE_CODE_SUBAGENT_MODEL` | 覆盖所有子代理使用的模型 |
| `CLAUDE_CODE_GLOB_NO_IGNORE` | 设为 `false` 让 `Glob` 也遵守 `.gitignore`（默认 `Glob` 不遵守，`Grep` 遵守——非对称） |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | 设为 `false` 关闭新会话开场的灰色提示命令 |
| `DISABLE_TELEMETRY` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 设了这两个之一，Monitor 工具不可用 |

## 与本机 `~/.claude/settings.json` 的对照（实测样本，仅作参考不代表默认值）

调研当时本机已配置：`effortLevel: "xhigh"`、`CLAUDE_CODE_SUBAGENT_MODEL: "sonnet"`、`autoCompactEnabled: true`、`permissions.defaultMode: "auto"`（写在用户级文件，符合 v2.1.142+ 要求）、`skipDangerousModePermissionPrompt: true`。这些是"真实可用配置"的例子，不是必须照抄的推荐值。
