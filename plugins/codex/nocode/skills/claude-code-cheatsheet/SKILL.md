---
name: claude-code-cheatsheet
description: "Use for Claude Code configuration, CLI flags, built-in commands/tools, agent/task behavior, per…"
---

# Claude Code Cheatsheet — 默认能力速查表

## Overview

Claude Code 自己提供的东西分两层，别混着记：

- **纯配置**：会话开始前/外部定好的静态旋钮——CLI 参数、`settings.json`、环境变量。改了才变，一次定长期有效。
- **运行时**：会话进行中你实际会触发或调用的东西——你键入的 **commands**，以及 agent 调用的 **内置功能/工具**（CronCreate、Workflow、Monitor、ScheduleWakeup、Agent、ToolSearch…）。加上引擎在执行过程中自己会跑的**机制**（并行/串行、权限、压缩、缓存），和调这些功能时该有的**判断**。

**核心原则：先分清问的是"配置"还是"运行时能力"，再查对应 Part。** 配置去 Part 1，要调用某个内置功能去 Part 2.2，想知道引擎自动会怎么做去 Part 2.3。内容截至 v2.1.198，来自 `code.claude.com` 官方文档 + 本地 CLI 实测 + 内置工具 schema + 无 skill 基线测试。

这是关于 **Claude Code 产品本身** 的能力，不是本插件（nocode）的规则——本仓库其它规则建立在这之上。

---

## Part 1 · 纯配置（静态旋钮）

### 1.1 CLI 启动参数（速查）

| 参数 | 作用 |
|---|---|
| `--permission-mode <mode>` | 本次会话权限模式（`default/acceptEdits/plan/auto/dontAsk/bypassPermissions`） |
| `--model <model>` / `--effort <level>` | 模型 / 推理强度 |
| `-w, --worktree [name]` / `--tmux` | 新建 worktree（可配 tmux） |
| `--bg, --background` | 以后台 agent 启动，立即返回 |
| `--bare` / `--safe-mode` | 最小模式 / 禁用全部自定义项（排障） |
| `--add-dir` / `--allowedTools` / `--disallowedTools` | 授权目录 / 工具白黑名单 |
| `--exclude-dynamic-system-prompt-sections` | 易变段移出系统提示词，提高跨用户 cache 复用 |
| `--fallback-model` | 主模型过载时按序切备用 |

完整清单见 `references/cli-flags.md`。

### 1.2 settings.json + 环境变量（速查）

| 想调什么 | 用什么 |
|---|---|
| 关自动压缩 | `autoCompactEnabled: false` 或 `DISABLE_AUTO_COMPACT=1` |
| 压缩触发点 | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`（1–100） |
| 禁用后台任务 | `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` |
| Bash 超时/输出上限 | `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` / `BASH_MAX_OUTPUT_LENGTH` |
| prompt cache TTL | `ENABLE_PROMPT_CACHING_1H=1` / `FORCE_PROMPT_CACHING_5M=1` |
| 默认权限模式 | `permissions.defaultMode`（`auto` 只在用户级 `~/.claude/settings.json` 生效） |
| 子代理统一模型 | `CLAUDE_CODE_SUBAGENT_MODEL` |
| Glob 遵守 `.gitignore` | `CLAUDE_CODE_GLOB_NO_IGNORE=false` |
| `!` 命令后不自动回复 | `respondToBashCommands: false` |

完整字段/变量清单见 `references/env-and-settings.md`。

---

## Part 2 · 运行时（会话进行中触发/调用的东西）

### 2.1 Commands（你键入的 slash commands）

只在消息开头才被识别为命令。点名的几个：

| 命令 | 一句话 |
|---|---|
| `/clear`（`/reset` `/new`）| 清空上下文开新会话，旧对话仍可 `/resume` |
| `/compact [instructions]` | 总结现有对话释放上下文，可带聚焦指令 |
| `/model` / `/effort` / `/fast` | 切模型 / 推理强度 / 快速模式（都会打掉 cache，见 2.3） |
| `/agents` / `/mcp` / `/permissions` | 管理子代理 / MCP / 权限规则 |
| `/config [key=value]` | 改设置；带参数直接改（非交互模式也能用） |
| `/tasks`（`/bashes`）| 查看/管理全部后台任务 |
| `/btw` | 侧向提问：不进历史、无工具权限，纯从已有上下文回答，几乎零成本 |
| `/loop` / `/schedule` / `/workflows` | 循环任务 / 云端定时 routine / 多 agent 工作流（对应 2.2 的 ScheduleWakeup / RemoteTrigger / Workflow） |

完整分类清单 + 版本新增/废弃时间线见 `references/slash-commands.md`。

### 2.2 内置功能/工具（agent 调用的能力）

Claude Code 内置的"功能型"工具，按用途分组。基础文件工具（`Read`/`Edit`/`Write`/`Bash`/`Glob`/`Grep`）不赘述，行为差异见 2.3。

**A. 定时与唤醒（未来某时点触发）**

| 工具 | 干嘛 | 关键点 / 坑 |
|---|---|---|
| `CronCreate` / `CronList` / `CronDelete` | 本会话内按 5 段 cron 定时重跑一段 prompt；`recurring:false` 做一次性"到点提醒" | **只活在本会话内存里，会话退出就没**；只在 REPL 空闲时触发；recurring 任务 7 天后自动过期；别都挑 :00/:30（全球同一时刻撞 API），近似时间挑奇数分钟 |
| `ScheduleWakeup` | `/loop` 动态自定步时，安排下次几秒后回来继续同一任务 | **5 分钟 cache TTL 是分水岭**：<270s 保温、1200s+ 才值得付一次 cache miss，别挑正好 300s；轮询 harness 能追踪的后台工作是浪费（完成会自动重唤） |
| `RemoteTrigger` | claude.ai 云端 routine（`/schedule` 背后），按 cron 在云上跑，**跨会话持久** | 与 `CronCreate` 的分界：这个持久、跑云端；CronCreate 只在本地本会话。别用裸 curl，token 自动注入 |

**B. 编排与派发（把活分出去）**

| 工具 | 干嘛 | 关键点 / 坑 |
|---|---|---|
| `Agent` | 派一个 subagent 干活，后台跑、完成后通知 | `subagent_type:"fork"` 继承你的完整上下文 + 复用父 cache（省钱）；其它类型是全新独立 context；隔离细节见 2.3 |
| `Workflow` | 用 JS 脚本**确定性**编排多 agent（`pipeline`/`parallel`/fan-out），后台跑返回 task id | **要用户显式 opt-in（ultracode 等）才该调**，能烧很多 token；`pipeline` 是默认（无 barrier）、`parallel` 是 barrier；一般任务用 `Agent` 就够，别动辄上 Workflow |

**C. 监听与等待（盯着某件事）**

| 工具 | 干嘛 | 关键点 / 坑 |
|---|---|---|
| `Monitor` | 后台流式盯一个脚本/日志/WebSocket，每行 stdout 变一条通知 | **一次性"等到就绪"别用它**（用后台 Bash 的 `until` 循环，一条通知就结束）；无界命令（`tail -f`）才用 Monitor；filter 必须覆盖失败信号，不能只 grep 成功——静默 ≠ 成功 |
| 后台 Bash（`run_in_background`）| 一次性长任务转后台，跑完给一条完成通知 | **启动 ≠ 完成**，见 2.4 收口纪律 |

**D. 任务追踪**

| 工具 | 干嘛 | 关键点 |
|---|---|---|
| `workflow.plan.create` / `workflow plan item` / `workflow plan snapshot` / `workflow.plan.update` | 会话内结构化任务清单，跟踪多步进度 | v2.1.142 起取代 `TodoWrite`；进 workflow skill 要求 Step 0 先把全部 task 建出来 |
| `TaskStop` / `TaskOutput` | 停 / 读后台 agent 的产出 | 管后台 `Agent`/`Monitor`/`Workflow` 的生命周期 |

**E. 通信与通知**

| 工具 | 干嘛 | 关键点 |
|---|---|---|
| `SendMessage` | 给已派的 agent（或 `main`）发消息 | 你的纯文本输出别的 agent **看不到**，要通信必须用这个；按 agentId 可恢复已完成的后台 agent |
| `PushNotification` | 拉用户注意（桌面 + 手机） | **宁可少发**：只在用户可能走开、且有值得回来的事时发；例行进度别发 |

**F. 工作区与模式**

| 工具 | 干嘛 | 关键点 |
|---|---|---|
| worktree entry / `ExitWorktree` | 建隔离 git worktree 并把会话切进去 | **只在用户或 CLAUDE.md 明确要 worktree 时才用**；`path` 进已存在的 worktree、`name` 建新的 |
| `EnterPlanMode` / `ExitPlanMode` | 进/出计划模式（只读探索 → 拿批准再执行） | `ExitPlanMode` 把计划提交给用户批 |

**G. 工具加载与产出**

| 工具 | 干嘛 | 关键点 |
|---|---|---|
| `ToolSearch` | 按需加载 deferred 工具的完整 schema（否则只有名字，不能调） | 批量用 keyword 一次拉一组（如 `"computer-use"`），别一个个 `select:` 往返 |
| `Artifact` | 把 HTML/MD 渲染成 claude.ai 托管网页 | 严格 CSP：所有 CSS/JS/图片必须内联；同 `file_path` 重发覆盖同一 URL |
| `Skill` | 加载并执行一个 skill | 进了刚性 skill 要走完每个 Step |
| `workflow.decision.request` | 结构化选项问用户 | 待确认内容要写进 payload 自足，别指代前文 |

### 2.3 引擎机制（不是你调的，是它自动发生的）

这一层每条都是"不管你怎么想，它就这么执行"，认识到即可，不是可调项。

**并行/串行调度**：同一轮多个工具调用，**只读工具**（`Read` `Glob` `Grep` + 标 `readOnlyHint` 的 MCP 工具）**并发**；**改状态的**（`Edit` `Write` `Bash`）**自动串行**避免冲突。混进一个写操作那一轮就不会真并行——要真并行的写只能拆给不同 subagent。

**权限分类器 + protected paths**：`.git` `.claude` `.vscode` `.npmrc` `.mcp.json` 等路径的写入，除 `bypassPermissions` 外**永远要提示**——哪怕 `settings.json` 写了 `Edit(.claude/**)` 也不生效（安全检查在 allow 规则之前评估）。`auto` 模式的分类器连续拒 3 次或累计拒 20 次自动回退人工确认；子代理若父会话是 `auto`，会忽略自己 frontmatter 的 `permissionMode`。实际拦截清单跑 `claude auto-mode defaults`/`config` 看权威结果，别背。

**Context 自动压缩存活表**（Sonnet 5 默认约 96.7% 窗口触发，thrashing 会停而非死循环）：

| 内容 | 压缩后 |
|---|---|
| 系统提示词 / output style / hooks | 不受影响 |
| 项目根 CLAUDE.md、无 `paths:` 的 rules、auto memory | 从磁盘重新注入 |
| 带 `paths:` 限定的 rules、子目录嵌套 CLAUDE.md | **丢失**，直到再次读到匹配文件 |
| 已调用的 skill 正文 | 重新注入，但单 skill ≤5000 token、总 ≤25000 token，最老先丢 |

想让规则长会话压缩后仍生效，别用路径限定 scope。

**子代理隔离 + prompt cache 失效**：子代理拿全新 context（看不到主对话/已调 skill/已读文件），`Explore`/`Plan` 连 CLAUDE.md 都跳过；**fork 例外**（继承完整对话 + 复用父 cache）。子代理 cache 固定 5 分钟 TTL；嵌套深度**固定 5 层不可配**（第 5 层没有 `Agent` 工具）。缓存按整个请求前缀完全匹配——**切模型/切 effort/首开 fast/装卸 MCP/`/compact`/升级版本/resume 跨版本旧会话**会打掉缓存；**编辑文件/切权限模式/调 skill/`/rewind`/生成 fork** 不会。

### 2.4 使用纪律（调 2.2 那些功能时的判断）

**后台任务收口：启动成功 ≠ 任务完成**。实测翻车（本 skill 编写中复现）：agent 收到"启动长任务 + 等待期做别的 + 确认完成"，前两步都对，第三步却只说"现在等待通知，完成后我会核对"就结束回合——把"安排了核实"当"已核实"报了出去。**红线**：调 `run_in_background` 或派 `Agent` 后，凡要求"确认结果/等它跑完"，必须真观察到完成信号（收到 notification、`Read` 到标志性输出、文件/进程状态被证实）才能收口。没等到就报"已完成"是头号错误。

**等待/定时怎么选**：

```
要"等一个终点"（就绪/跑完）        → 后台 Bash run_in_background（一条完成通知）
要"盯过程中反复出现的变化"（日志报错/CI 状态流）→ Monitor（每次一条通知，filter 覆盖失败）
要"未来定点/周期重跑一段 prompt"   → 本会话内 CronCreate；要跨会话持久用 RemoteTrigger（/schedule）
要"/loop 自定步、下次几秒后回来"   → ScheduleWakeup（认准 5 分钟 cache 窗口，别挑 300s）
```

**何时拆 agent**：多个独立**只读**操作不用拆，同一条消息一次性发出靠 2.3 并发规则自动并行；含写操作或需独立视角判断才拆 subagent；一次性研究/多角度调查用 **fork**（省钱），需屏蔽当前对话噪音的独立判断用**命名 subagent**。拆之前先确认几件事之间没有依赖/共享状态——有依赖就顺序做，这是正确性前提不是技巧。

---

## 参考

- `references/cli-flags.md` — CLI 启动参数完整清单
- `references/slash-commands.md` — 内置 slash commands 完整分类 + 版本变更时间线
- `references/env-and-settings.md` — settings.json 全字段 + 环境变量完整清单
