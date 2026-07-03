---
name: claude-code-cheatsheet
description: Use when you need to know how Claude Code's own built-in execution mechanics actually work — parallel vs serial tool calls, Bash background tasks + Monitor, permission modes, context auto-compact survival rules, subagent/fork isolation, prompt cache invalidation, or other native CLI behaviors. Also use when unsure whether something "just happens automatically" or needs an explicit action, or before declaring a background task/subagent done. Not for this plugin's own rules (see the agent-catalog routing) and not for general coding tasks unrelated to the harness's own mechanics.
---

# Claude Code Cheatsheet — 默认执行速查表

## Overview

Claude Code 的"默认行为"其实分三层，容易被当成一坨混着记：

- **配置层**：你在会话开始前就定好的东西（CLI 参数、`settings.json`、环境变量、slash commands）——静态，改了才变。
- **运行时层**：不管你怎么配，引擎在执行过程中自己会做的确定性机制（工具怎么调度、权限怎么兜底、上下文怎么压缩、缓存怎么失效）——这层不是"你的选择"，是"它就这么跑"。
- **Agent 决策层**：运行时机制摆在那，但"你"（正在执行任务的 agent）该怎么判断、什么时候用哪个能力，是行为纪律问题，不是知识问题。

**核心原则：不确定"Claude Code 默认会怎么做"时来查这里核对，先分清楚问的是哪一层，再找对应小节**，不要凭印象猜，也不要每次重新翻文档。本文内容截至 v2.1.198，来自 `code.claude.com` 官方文档 + 本地 CLI 实测（`claude auto-mode defaults/config`、`claude --help` 等）+ 3 组无 skill 基线测试。

这是关于 **Claude Code 产品本身** 的默认行为，不是本插件（nocode）自己的规则——本仓库其它规则（git-inspection、git-freshness 等）建立在这些默认行为之上，不重复。

---

## Part 1 · 配置层（静态，会话开始前定好）

### 1.1 CLI 启动参数（速查）

| 参数 | 作用 |
|---|---|
| `--permission-mode <mode>` | 指定本次会话权限模式（见 Part 2.2 有哪几种） |
| `--model <model>` / `--effort <level>` | 指定模型 / 推理强度 |
| `-w, --worktree [name]` | 为本次会话新建 git worktree |
| `--bg, --background` | 以后台 agent 方式启动，立即返回 |
| `--bare` | 最小模式：跳过 hooks/LSP/插件同步/CLAUDE.md 自动发现等，仅保留显式传入的上下文 |
| `--safe-mode` | 禁用所有自定义项（CLAUDE.md/skills/插件/hooks/MCP 等），排障用 |
| `--add-dir <dirs...>` | 额外授权工具访问的目录 |
| `--allowedTools` / `--disallowedTools` | 会话级工具白名单/黑名单 |
| `--dangerously-skip-permissions` | 跳过全部权限检查（仅限隔离沙箱） |
| `--exclude-dynamic-system-prompt-sections` | 把 cwd/git status 等易变段移出系统提示词，提高跨用户 prompt cache 复用率 |
| `--fallback-model <models...>` | 主模型过载时按序自动切备用模型 |

完整参数清单（含 `--mcp-config`、`--plugin-dir`、`--from-pr`、`--json-schema` 等更少用但有用的）见 `references/cli-flags.md`。

### 1.2 settings.json + 环境变量（速查）

| 想调什么 | 用什么 |
|---|---|
| 关自动压缩 | `autoCompactEnabled: false` 或 `DISABLE_AUTO_COMPACT=1` |
| 提前/推迟自动压缩触发点 | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`（1–100） |
| 整体禁用后台任务 | `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` |
| Bash 超时/输出上限 | `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` / `BASH_MAX_OUTPUT_LENGTH` |
| 覆盖 prompt cache TTL | `ENABLE_PROMPT_CACHING_1H=1` / `FORCE_PROMPT_CACHING_5M=1` |
| 会话默认权限模式 | `permissions.defaultMode`（写用户级 `~/.claude/settings.json`；`auto` 写项目/本地级会被忽略） |
| 子代理统一用哪个模型 | `CLAUDE_CODE_SUBAGENT_MODEL` |
| Glob 也遵守 `.gitignore` | `CLAUDE_CODE_GLOB_NO_IGNORE=false` |
| `!` shell 命令后不自动回复 | `respondToBashCommands: false` |

完整字段/变量清单见 `references/env-and-settings.md`。

### 1.3 内置 slash commands（点名的几个）

| 命令 | 一句话 |
|---|---|
| `/clear`（别名 `/reset` `/new`） | 清空上下文开新会话，旧对话仍可 `/resume` |
| `/compact [instructions]` | 总结现有对话释放上下文，可带聚焦指令 |
| `/model` | 切模型并存为默认（会打掉 prompt cache，见 Part 2.6） |
| `/permissions`（别名 `/allowed-tools`） | 管理 allow/ask/deny 规则 |
| `/agents` | 管理子代理配置 |
| `/mcp` | 管理 MCP 连接与 OAuth |
| `/doctor` | 诊断安装/配置问题 |
| `/config [key=value]` | 改设置；不带参数打开交互界面，带参数直接改（非交互模式也能用） |
| `/tasks`（别名 `/bashes`） | 查看/管理全部后台任务 |
| `/btw` | 侧向提问：不进历史、无工具权限，纯从已有上下文回答，复用父会话 cache 几乎零成本 |

完整分类清单 + 近期版本新增/废弃时间线见 `references/slash-commands.md`。

---

## Part 2 · 引擎运行时层（确定性机制，不受模型决策影响）

这一层的每一条都是"不管你怎么想，它就这么执行"——不是可调项，是要认识到的物理规律。

### 2.1 工具调度：只读并发，写操作自动串行

同一轮请求多个工具调用时：**只读工具**（`Read` `Glob` `Grep`，以及标了 `readOnlyHint` 的 MCP 工具）**并发执行**；**会改状态的工具**（`Edit` `Write` `Bash`）**自动串行**，避免互相冲突。这是运行时规则，**settings.json 里没有对应开关**。

混进一个 `Write`/`Edit`/`Bash` 就不会真并行——那个操作会等其它工具跑完后单独排队执行，不是引擎的 bug，是设计如此。

### 2.2 权限模式的运行时执行：分类器判断 + protected paths 硬边界

**Protected paths 是跨模式硬边界**：`.git` `.claude` `.vscode` `.npmrc` `.mcp.json` 等路径的写入，除 `bypassPermissions` 外**永远要提示**——哪怕 `settings.json` 里显式写了 `Edit(.claude/**)` 也不生效，这条安全检查在 allow 规则**之前**评估，配置层管不到它。

**`auto` 模式的分类器**是独立于你选的模式跑的一层判断：连续拒绝 3 次或累计拒绝 20 次后自动回退到人工确认；进入 auto 时会临时丢弃 `Bash(*)` 这类宽泛 allow 规则，退出后恢复。子代理若父会话是 `auto`，会**忽略自己 frontmatter 里设的 `permissionMode`**，统一用父会话的分类器规则跑——给子代理单独配权限模式，父会话是 auto 时不生效。

`auto` 模式实际拦截什么、放行什么，是一份会随版本更新的规则集（分 allow / soft_deny / hard_deny 三层），别凭印象背——本地跑 `claude auto-mode defaults`（出厂默认）或 `claude auto-mode config`（叠加你自己 settings 后的有效规则）直接看当前版本的权威结果。

6 种权限模式各自解锁什么、怎么设置，属于配置层，见 Part 1.1（`--permission-mode`）+ `references/env-and-settings.md`。

### 2.3 后台任务的确定性行为

`run_in_background: true` 立即转后台执行返回任务 ID，输出落盘用 `Read` 增量取。确定性边界，跟你怎么用无关：

- 前台命令默认超时 2 分钟，可申请到 10 分钟；后台任务输出超 5GB 自动终止。
- v2.1.193+ 起：系统内存压力 + 会话空闲 ≥30 分钟时，后台任务会被系统直接 kill。
- 会话退出时后台任务会被清理（转入后台会话继续跑）。

### 2.4 Context 自动压缩：触发条件 + 存活表

触发窗口由 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`（token 数）和 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`（1–100 的百分比阈值）决定，Sonnet 5 默认约在 96.7% 窗口时触发。压缩策略先清理旧工具输出，不够再总结对话；如果单个文件/工具输出太大导致压缩后立刻又填满，会在尝试几次后报 "thrashing" 错误而不是死循环。

压缩后各类内容的存活情况，是写规则/文档时最容易忽略的一张表：

| 内容 | 压缩后 |
|---|---|
| 系统提示词 / output style | 不受影响（不属于消息历史） |
| 项目根 CLAUDE.md、未加 `paths:` 范围的 rules | 从磁盘重新注入 |
| Auto memory | 从磁盘重新注入 |
| 带 `paths:` frontmatter 限定路径的 rules | **丢失**，直到再次读到匹配文件 |
| 子目录嵌套 CLAUDE.md | **丢失**，直到再次读到该目录文件 |
| 已调用的 skill 正文 | 重新注入，但单 skill 上限 5000 token、总上限 25000 token，最老的先丢 |
| hooks | 不受影响（是代码不是上下文） |

实际影响：想让一条规则在长会话压缩后依然生效，别用路径限定 scope。子代理用同一套压缩逻辑，`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 对子代理同样生效。

### 2.5 子代理 / fork：隔离粒度与深度上限

每个子代理拿到**全新独立** context window——看不到主对话历史、已调用的 skill、已读过的文件；内置的 `Explore`、`Plan` 子代理甚至跳过 CLAUDE.md 和 git status 加载以换取速度。**Fork** 是唯一例外：继承完整对话 + 复用父会话 prompt cache，且始终跑在后台。

确定性限制，容易被忽略：

- **子代理的 prompt cache 固定 5 分钟 TTL**，即便主会话在订阅计划下能拿到 1 小时——长时间挂起的子代理重新唤醒大概率要吃一次全量重算。
- **嵌套深度上限固定 5 层，不可配置**：第 5 层子代理不会拿到 `Agent` 工具，无法再往下派生。
- 子代理 transcript 独立存放，主对话 `/compact` 不影响它；可用 `SendMessage` 按 agent ID 继续跑，stopped 的子代理收到消息会自动在后台恢复。

### 2.6 Prompt Cache：什么会打掉缓存，什么不会

缓存按**整个请求前缀完全匹配**，前缀里任何一处变化都会导致其后全部重新计算——没有按文件/片段级别的局部缓存。Claude 订阅计划默认 1 小时 TTL（超额计费时降到 5 分钟）；API key/Bedrock/Vertex 默认 5 分钟。

| 会打掉缓存 | 不会打掉缓存 |
|---|---|
| 切模型、切 effort level | 编辑仓库文件 |
| 首次开 fast mode | 切换权限模式（`opusplan` 因涉及切模型除外） |
| MCP server 连接/断开（工具 schema 加载进 prefix 时） | 调用 skill / command |
| deny 整个工具（裸工具名或 `Bash(*)`） | `/rewind`（回退到已缓存的更早前缀） |
| `/compact`（对话层失效，但省时因为总结请求本身复用旧前缀） | 生成 fork（复用父会话缓存） |
| 升级 Claude Code 版本 / resume 跨版本旧会话 | CLAUDE.md / output style 中途编辑（不失效但也不生效，要等 `/clear`/`/compact`/重启） |

性能意义最大的场景：长会话中途切模型/切 effort 就是在主动付一次全量重算的代价；resume 一个跨版本升级过的旧会话，第一轮响应会显著变慢变贵。可用 `cache_creation_input_tokens`（写入价计费）和 `cache_read_input_tokens`（约标准输入价 10%）监控命中率。

### 2.7 零散的确定性行为差异

- **Read-before-edit 不是只能用 `Read` 工具满足**：用 Bash 跑 `cat`/`head`/`tail`/`sed -n 'X,Yp'`/`grep`（对单个文件、无管道无重定向）也算"已读取"——但这只影响能否编辑，不影响 `Read`/`Edit` 各自的 deny 权限判定，两者覆盖的命令集合不完全一致。
- **`Grep` 用 ripgrep 语法且遵守 `.gitignore`；`Glob` 默认不遵守**——两者行为不对称，用 `Glob` 找文件可能意外扫到 `node_modules/` 等本该被忽略的路径。
- **Shell mode `!` 前缀**：命令输出落地后 Claude 会自动响应一次（等同发了一条消息，会计费），配置层可用 `respondToBashCommands: false` 关掉这个自动回复。

---

## Part 3 · Agent 决策层（Part 2 的机制摆在那，怎么用是你的判断）

### 3.1 后台任务收口纪律：启动成功 ≠ 任务完成

**真实翻车模式（本 skill 编写过程中实测复现）**：一个 agent 收到"启动长任务 + 等待期间做别的事 + 确认任务已完成"的指令。前两步都做对了——正确用了 Part 2.3 的后台执行机制，也正确利用等待时间做了别的工作。到了第三步却直接结束回合，只说"现在等待完成通知，完成后我会核对"——把**"我安排了核实"**当成**"已完成核实"**汇报了出去，指令要求的确认结果这一步实际没做。

**红线**：调用 `run_in_background` 或派生 `Agent` 之后，只要任务要求"确认结果 / 等它跑完"，就必须真正观察到完成信号（收到 notification、`Read` 到标志性输出、文件或进程状态被证实）才能收口。没等到就报告"已完成"是头号错误——本质是 Fail loud 原则在异步场景下最容易被绕过的一个缺口。

（同一场景补上本 skill 后重测：agent 主动跑了一条有界轮询 `until [ -f marker ]; do sleep 1; done`，等到文件真实出现 + 收到系统完成通知两个独立信号都到齐才收口——这是正确姿势。）

### 3.2 何时用 Monitor，何时用轮询，何时都不用

- **一次性"等到跑完"**：直接用 `run_in_background` 本身的完成通知即可，不需要额外工具——启动后去做别的事，通知到了再回来收口（3.1 讲的就是这个场景）。
- **长期"盯着某个信号变化"**：日志出现报错关键字、CI/PR 状态持续变化、文件被持续修改这类不知道什么时候会变、但变了要立刻反应的场景，用 **Monitor 工具**（v2.1.98 引入），不要手写 `sleep` 轮询循环——Monitor 专门做"后台盯着，出事才插话，不打断当前对话"这件事，v2.1.195+ 还能直接开 WebSocket 逐条推事件。
- 判断依据：需要的是"终点"还是"过程中的变化"？只要终点用后台任务通知/一次性轮询；要盯过程用 Monitor。

### 3.3 何时该拆给 fork/subagent 并行，何时不用拆

- **多个独立只读操作**（互不依赖、都不改状态）：不用拆 agent，直接在同一条消息里把工具调用一次性发出，靠 2.1 的并发规则自动并行，总耗时≈最慢的一个。
- **混了写操作 / 需要真正独立 context 判断**：Part 2.1 讲过写操作在单个 agent 内不会真并行——多个独立且包含写操作的任务，才需要拆给不同 subagent 各自跑。
- **一次性研究/多角度调查、不需要屏蔽当前对话**：用 **fork**——继承完整上下文 + 复用 prompt cache，比新开子代理省钱（Part 2.5）。
- **需要屏蔽当前对话噪音、要独立视角判断**（如红蓝对抗审查、避免带入当前任务的先入之见）：用**命名 subagent**，接受它是全新 context、走自己的 5 分钟 cache。
- 拆之前先判断"这几件事之间有没有依赖/共享状态"——有依赖就不能并行，先后顺序做；这条不是技巧，是正确性前提。

---

## 参考

- `references/cli-flags.md` — CLI 启动参数完整清单
- `references/slash-commands.md` — 内置 slash commands 完整分类清单 + 近期版本变更
- `references/env-and-settings.md` — settings.json 全字段 + 环境变量完整清单
