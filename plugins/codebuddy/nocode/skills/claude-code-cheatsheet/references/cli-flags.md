# CLI 启动参数完整清单

> 来源：本地 `claude --help` 实测（v2.1.198）。只收对日常使用/排障有实际意义的参数；`--help` 输出的全部参数以本地实测为准，版本升级可能增删。

## 会话身份 / 模型

| 参数 | 作用 |
|---|---|
| `--model <model>` | 模型别名（`fable`/`opus`/`sonnet`）或全名 |
| `--effort <level>` | 推理强度（`low/medium/high/xhigh/max`） |
| `--fallback-model <models...>` | 主模型过载/不可用时按序自动切换，仅 `--print` 模式生效 |
| `--agent <agent>` | 覆盖 `agent` 设置，指定本次会话用哪个子代理定义跑主线程 |
| `-n, --name <name>` | 会话显示名（prompt box / `/resume` 选择器 / 终端标题） |

## 权限 / 沙箱

| 参数 | 作用 |
|---|---|
| `--permission-mode <mode>` | `acceptEdits/auto/bypassPermissions/default/dontAsk/plan` |
| `--dangerously-skip-permissions` | 跳过全部权限检查 |
| `--allow-dangerously-skip-permissions` | 让 bypass 模式**可用**但不默认开启（区别于上一条直接跳过） |
| `--allowedTools` / `--disallowedTools <tools...>` | 会话级工具白/黑名单，如 `"Bash(git *) Edit"` |
| `--add-dir <dirs...>` | 额外授权工具访问的目录 |

## 上下文 / 系统提示词

| 参数 | 作用 |
|---|---|
| `--bare` | 最小模式：跳过 hooks/LSP/插件同步/attribution/auto-memory/后台预取/keychain 读取/CLAUDE.md 自动发现，设 `CLAUDE_CODE_SIMPLE=1` |
| `--safe-mode` | 禁用全部自定义项（CLAUDE.md/skills/插件/hooks/MCP/自定义 command 和 agent/output style/workflow/主题/键位等），管理员策略设置仍生效 |
| `--system-prompt <prompt>` / `--append-system-prompt <prompt>` | 替换/追加系统提示词 |
| `--exclude-dynamic-system-prompt-sections` | 把 cwd/env/memory 路径/git status 等易变段移出系统提示词到首条用户消息，提高跨用户 prompt cache 复用率；仅在用默认系统提示词时生效 |
| `--setting-sources <sources>` | 逗号分隔加载哪些来源的 settings（`user,project,local`） |
| `--settings <file-or-json>` | 额外加载一份 settings 文件/JSON 字符串 |

## 后台 / 隔离 / worktree

| 参数 | 作用 |
|---|---|
| `--bg, --background` | 以后台 agent 方式启动，立即返回，用 `claude agents` 管理 |
| `-w, --worktree [name]` | 为本次会话新建 git worktree |
| `--tmux` | 配合 `--worktree` 创建 tmux 会话（iTerm2 原生 pane 优先，`--tmux=classic` 用传统 tmux） |
| `--fork-session` | resume 时创建新 session ID 而不是复用原 ID |

## MCP / 插件

| 参数 | 作用 |
|---|---|
| `--mcp-config <configs...>` | 从 JSON 文件/字符串加载 MCP servers |
| `--strict-mcp-config` | 只用 `--mcp-config` 里的 MCP servers，忽略其它来源 |
| `--plugin-dir <path>` / `--plugin-url <url>` | 为本次会话临时加载插件（目录/zip/远程 zip），可重复传 |

## 非交互模式（`-p`/`--print`）

| 参数 | 作用 |
|---|---|
| `-p, --print` | 打印结果后退出；非 TTY 输出时自动跳过工作区信任对话框 |
| `--output-format <format>` | `text`（默认）/`json`/`stream-json` |
| `--input-format <format>` | `text`（默认）/`stream-json` |
| `--include-partial-messages` | 输出流式局部消息块（需配合 `stream-json`） |
| `--json-schema <schema>` | 结构化输出的 JSON Schema 校验 |
| `--max-budget-usd <amount>` | 本次调用最大花费上限 |
| `--no-session-persistence` | 不落盘会话文件，无法 resume |
| `--replay-user-messages` | stdin 的用户消息原样回显到 stdout（配合 stream-json in/out） |

## resume / 恢复

| 参数 | 作用 |
|---|---|
| `-r, --resume [value]` | 按 session ID 恢复，或打开交互选择器 |
| `-c, --continue` | 恢复当前目录下最近一次对话 |
| `--from-pr [value]` | 恢复关联某个 PR 的会话 |
| `--session-id <uuid>` | 指定本次会话用固定 UUID |

## 其它常用子命令（`claude <command> --help` 查详情）

`agents`（管理后台 agent）、`auto-mode`（查看/校验 auto 模式分类器配置）、`mcp`（管理 MCP servers）、`plugin`/`plugins`（管理插件，含 `eval`/`tag`/`validate`）、`project`（`purge` 清理项目状态）、`doctor`（诊断安装）、`auth`（`login/logout/status`）、`ultrareview`（云端多 agent 代码审查）、`update`/`upgrade`。
