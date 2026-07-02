---
name: claude-code-defaults
description: Use when you need to know how Claude Code's own built-in execution mechanics actually work — parallel vs serial tool calls, Bash background tasks + Monitor, permission modes, context auto-compact survival rules, subagent/fork isolation, prompt cache invalidation, or other native CLI behaviors. Also use when unsure whether something "just happens automatically" or needs an explicit action, or before declaring a background task/subagent done. Not for this plugin's own rules (see the agent-catalog routing) and not for general coding tasks unrelated to the harness's own mechanics.
---

# Claude Code 默认执行技巧合集

## Overview

Claude Code 本身自带一整套"看不见"的默认执行机制——工具怎么并行、后台任务怎么收尾、上下文怎么压缩、子代理怎么隔离、缓存怎么失效。这些机制大多有官方文档撑腰，但不主动查就等于白送的正确性和效率都用不上。

**核心原则：不确定"Claude Code 默认会怎么做"时来查这里核对，不要凭印象猜，也不要每次重新翻文档。** 本文内容截至 v2.1.198，来自 `code.claude.com` 官方文档 + 本地 CLI 实测（`claude auto-mode defaults/config`、`claude --help` 等），按"忽略了会犯什么错 / 漏什么便宜"组织，不是操作手册。

这是关于 **Claude Code 产品本身** 的默认行为，不是本插件（nocode）自己的规则——本仓库其它规则（git-inspection、git-freshness 等）建立在这些默认行为之上，不重复。

## 1. 并行工具调用：只读并发，写操作自动串行

同一轮请求多个工具调用时：**只读工具**（`Read` `Glob` `Grep`，以及 MCP 工具里标了 `readOnlyHint` 的）**并发执行**；**会改状态的工具**（`Edit` `Write` `Bash`）**自动串行**，避免互相冲突。这是运行时规则，**settings.json 里没有对应开关**，不是你能关掉或打开的东西。

- 多个独立只读检查（跑测试、查 git log、数文件数）可以放进同一条消息一次性发出，总耗时约等于其中最慢的一个，而不是相加。
- 混进一个 `Write`/`Edit`/`Bash` 就不会真并行——那个操作会等其它工具跑完后单独排队执行。想要真正并行的写操作，只能拆给不同的 subagent（各自独立 context，互不冲突），不能指望单个 agent 一轮内并行写文件。

## 2. 后台任务：启动成功 ≠ 任务完成

Bash 工具 `run_in_background: true` 立即转后台执行并返回任务 ID，交互模式下也能对正在跑的调用按 `Ctrl+B` 转后台；输出落盘，用 `Read` 增量取；`/tasks`（别名 `/bashes`）能看到全部后台任务。派生 `Agent` 同理是异步的，完成后才收到通知。

**真实翻车模式（实测复现）**：一个 agent 收到"启动长任务 + 等待期间做别的事 + 确认任务已完成"的指令。前两步都做对了——正确用了后台执行，也正确利用等待时间做了别的工作。到了第三步却直接结束回合，只说"现在等待完成通知，完成后我会核对"——把**"我安排了核实"**当成**"已完成核实"**汇报了出去，指令要求的确认结果这一步实际没做。

**红线**：调用 `run_in_background` 或派生 `Agent` 之后，只要任务要求"确认结果 / 等它跑完"，就必须真正观察到完成信号（收到 notification、`Read` 到标志性输出、文件或进程状态被证实）才能收口。没等到就报告"已完成"是本节要防的头号错误——本质是 Fail loud 原则在异步场景下最容易被绕过的一个缺口。

**配套技巧**：真要一直盯着某个信号变化（日志出现报错关键字、CI/PR 状态变化、文件被修改）用 **Monitor 工具**（v2.1.98 引入），不要手写 `sleep` 轮询循环——Monitor 专门做"后台盯着，出事才插话，不打断当前对话"这件事，v2.1.195+ 还能直接开 WebSocket 逐条把消息当事件推送。一次性的"等到跑完"用 `run_in_background` 本身的完成通知就够，不需要 Monitor。

## 3. 权限模式：6 种，protected paths 是硬边界

| 模式 | 免确认范围 | 适用场景 |
|---|---|---|
| `default` | 只读 | 入门 / 敏感工作 |
| `acceptEdits` | 读 + 文件编辑 + 常见文件系统命令（`mkdir/touch/rm/mv/cp/sed` 等） | 会复查的迭代开发 |
| `plan` | 只读 | 改动前先探索出计划 |
| `auto`（研究预览） | 几乎一切，后台分类器拦截越权/危险动作 | 长任务、少打断 |
| `dontAsk` | 仅预设 allow 规则 + 只读 Bash | 锁死的 CI/脚本场景 |
| `bypassPermissions` | 一切 | 仅限隔离容器/VM，不防 prompt injection |

**Protected paths 是跨模式硬边界**：`.git` `.claude` `.vscode` `.npmrc` `.mcp.json` 等路径的写入，除 `bypassPermissions` 外**永远要提示**——哪怕 `settings.json` 里显式写了 `Edit(.claude/**)` 也不生效，这条安全检查在 allow 规则之前评估。

**`auto` 模式的分类器**会在连续拒绝 3 次或累计拒绝 20 次后自动回退到人工确认；进入 auto 时会临时丢弃 `Bash(*)` 这类宽泛 allow 规则，退出后恢复。子代理若父会话是 `auto`，会忽略自己 frontmatter 里设的 `permissionMode`，统一用父会话的分类器规则跑——不要指望给子代理单独设权限模式能覆盖 auto 父会话。

`auto` 模式实际拦截什么、放行什么，是一份会随版本更新的规则集（分 allow / soft_deny / hard_deny 三层），别凭印象背——本地跑 `claude auto-mode defaults`（出厂默认）或 `claude auto-mode config`（叠加你自己 settings 后的有效规则）直接看当前版本的权威结果。

## 4. Context 自动压缩：什么会丢、什么会活

`autoCompactEnabled`（默认 `true`）控制开关；触发窗口由 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`（token 数）和 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`（1–100 的百分比阈值）决定，Sonnet 5 默认约在 96.7% 窗口时触发。压缩策略先清理旧工具输出，不够再总结对话；如果单个文件/工具输出太大导致压缩后立刻又填满，会在尝试几次后报 "thrashing" 错误而不是死循环。

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

实际影响：想让一条规则在长会话压缩后依然生效，别用路径限定 scope；如果确实要按路径限定，接受它会在压缩后失效、要靠再次触碰对应文件才恢复。子代理用同一套压缩逻辑，`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 对子代理同样生效。

## 5. 子代理 / fork：隔离粒度与深度上限

每个子代理拿到**全新独立** context window——看不到主对话历史、已调用的 skill、已读过的文件；内置的 `Explore`、`Plan` 子代理甚至跳过 CLAUDE.md 和 git status 加载以换取速度。**Fork** 是唯一例外：继承完整对话 + 复用父会话 prompt cache，且始终跑在后台，比新开子代理更省钱——一次性研究/多角度调查用 fork，真正需要屏蔽当前对话噪音、独立视角判断的用命名 subagent。

关键限制，容易被忽略：

- **子代理的 prompt cache 固定 5 分钟 TTL**，即便主会话在订阅计划下能拿到 1 小时——长时间挂起的子代理重新唤醒时大概率要吃一次全量重算。
- **嵌套深度上限固定 5 层，不可配置**：第 5 层子代理不会拿到 `Agent` 工具，无法再往下派生。规划多层委派链时要留这个余量。
- 子代理 transcript 独立存放，主对话 `/compact` 不影响它；可用 `SendMessage` 按 agent ID 继续跑，stopped 的子代理收到消息会自动在后台恢复。

## 6. Prompt Cache：什么会打掉缓存，什么不会

缓存按**整个请求前缀完全匹配**，前缀里任何一处变化都会导致其后全部重新计算——没有按文件/片段级别的局部缓存。Claude 订阅计划默认 1 小时 TTL（超额计费时降到 5 分钟）；API key/Bedrock/Vertex 默认 5 分钟。

| 会打掉缓存 | 不会打掉缓存 |
|---|---|
| 切模型、切 effort level | 编辑仓库文件 |
| 首次开 fast mode | 切换权限模式（`opusplan` 因涉及切模型除外） |
| MCP server 连接/断开（工具 schema 加载进 prefix 时） | 调用 skill / command |
| deny 整个工具（裸工具名或 `Bash(*)`） | `/rewind`（回退到已缓存的更早前缀） |
| `/compact`（对话层失效，但省时因为总结请求本身复用旧前缀） | 生成 fork（复用父会话缓存） |
| 升级 Claude Code 版本 / resume 跨版本旧会话 | CLAUDE.md / output style 中途编辑（不失效但也不生效，要等 `/clear`/`/compact`/重启） |

性能意义最大的场景：长会话中途切模型/切 effort 就是在主动付一次全量重算的代价；resume 一个跨版本升级过的旧会话，第一轮响应会显著变慢变贵，做重要 resume 前有心理预期。可用 `cache_creation_input_tokens`（写入价计费）和 `cache_read_input_tokens`（约标准输入价 10%）监控命中率，最直接是写进 statusline。

## 7. 零散但好用的隐藏技巧

- **`/btw`**：侧向提问，不进入对话历史、无工具访问权限，答案完全由已有上下文生成，复用父会话缓存所以几乎零成本；是子代理的反面——子代理"有工具无历史"，`/btw` 是"有历史无工具"。
- **Shell mode `!` 前缀**：命令输出落地后 Claude 会自动响应一次（等同发了一条消息，会计费）；只想把输出加入上下文不要自动回复，把 `respondToBashCommands` 设为 `false`。
- **Read-before-edit 不是只能用 `Read` 工具满足**：用 Bash 跑 `cat`/`head`/`tail`/`sed -n 'X,Yp'`/`grep`（对单个文件、无管道无重定向）也算"已读取"，能满足编辑前置检查——但这只影响能否编辑，不影响 `Read`/`Edit` 各自的 deny 权限判定，两者覆盖的命令集合不完全一致。
- **`Grep` 用 ripgrep 语法且遵守 `.gitignore`；`Glob` 默认不遵守 `.gitignore`**——两者行为不对称，是个常见坑：用 `Glob` 找文件时可能意外扫到 `node_modules/`、构建产物等本该被忽略的路径。
- **`Ctrl+X Ctrl+K`**：3 秒内按两次，一键停掉当前会话里所有后台子代理。
- **`/config key=value`**（v2.1.181+）：不打开交互界面直接改设置，非交互模式（`-p`）和 Remote Control 也能用；`/config --help` 列出全部可设 key。

## 8. 可调的默认值速查

只列直接影响上面 7 节行为的旋钮，完整清单见 `references/env-and-settings.md`。

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

## 参考

- `references/slash-commands.md` — 内置 slash commands 完整分类清单 + 近期版本变更（何时新增/废弃）
- `references/env-and-settings.md` — settings.json 全字段 + 环境变量完整清单
