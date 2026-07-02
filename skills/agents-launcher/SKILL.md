---
name: agents-launcher
disable-model-invocation: true
description: 本仓 fx-data-agents 三服务 (web :10001 / agents Hono :8070 / server Spring :8081) 的本地 dev 启停编排. 逻辑全在脚本 (dev-orchestrator.mjs + scripts/dev-start.sh), skill 只做路由与 askUser gate. 主仓启动直接执行脚本; worktree 启动按 仓况盘点 → cp gitignored 文件 → 联调对齐 → 执行脚本四步走. server (Spring) 委派 scripts/dev-start.sh (GraalVM 检测/ZGC patch/代理清除/增量编译). 查状态 --status, 停服 --stop. 关键决策点 (缺 worktree 时建/混搭/跳过 / cp 文件 / 改 .env.local / reset worktree / 重启已在跑的服务 / 升档全栈 / 替换主仓 agents) 用 askUser 显式 gate, 不擅自动.
---

# agents-launcher — 本地 dev 服务启停

## 工作流

```
用户请求 (起 dev / 重启 / 停服)
    │
    ├── 主仓启动 ──────────────────────────────────────────► Step 3 (执行脚本)
    │
    └── worktree 启动 ──► Step 0 (仓况盘点) ──► Step 1 (cp) ──► Step 2 (联调对齐) ──► Step 3 (执行脚本)

停服 ─────────────────────────► TaskStop 已知 task / pkill fallback (末尾「停止动作」节)
```

主仓启动直接跳到 Step 3. **worktree 内启动必须按 0 → 1 → 2 → 3 顺序**, 不能乱:
- 跳过 Step 0 → 缺 worktree 的仓没有合法路径可填, agent 被迫临场兜底 (臆造路径 / 主仓 checkout feature 分支 / 不问就混搭主仓) — 三种都是事故
- 跳过 Step 1 → launcher 报 "config.yaml 不存在" 失败
- 跳过 Step 2 → 浏览器加载主仓代码, worktree 改动不可见, 或跨仓 API 漂移浏览器报错
- 跳过 Step 3 预检 → 跑空轮询超时浪费 60-120s

**关键决策点用 askUser 显式 gate**, 不擅自动. 涉及 缺 worktree 时建/混搭/跳过 / cp 多个文件 / 改用户 `.env.local` / 改 `package.json` / `git reset` / 重启已在跑服务 / 升档全栈 / 替换主仓 agents 等动作前先问. 模糊信号 (用户没明说) → askUser, 别替用户判断.

## 脚本与命令

主入口: `${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs` (Node ESM).

> **launcher 随 nocode 插件分发, 不在任何 fx 仓内** (fx-data-agents 主仓的 `.claude/skills/` 是空的). `${CLAUDE_PLUGIN_ROOT}` 占位插件根, 但 **Bash 工具不展开它** (它只在 hooks.json 里被 harness 替换). 构造 Bash 命令前, agent 必须把它换成插件真实安装目录的绝对路径 (本机 dev 部署 = `/Users/yes365/AI/nocode-evolve`). 下文命令模板均按此处理.

### 仓路径 env (主仓 / worktree 启动都强制)

launcher 在插件目录, **无法从自身位置自动推出 fx 仓根**——`lib/paths.mjs` 的 auto-resolve `resolve(toolDir, '../../..')` 会落到插件父目录 (非 fx 仓), `validateRepos` 必抛「目录不像有效仓」. 所以下面三个 env **每次启动 (主仓 + worktree) 都要显式传**, launcher 用标志文件校验, 指错路径 fail loud 不会静默起错仓:

| env | 指向 | 校验标志文件 |
|---|---|---|
| `FX_AGENTS_DIR` | fx-data-agents 仓根 | `packages/server/conf/config.example.yaml` |
| `FX_WEB_DIR` | fx-data-web 仓根 (不传则按 `AGENTS_DIR/../fx-data-web` 推) | `packages/jsy-web/server/config.ts` |
| `FX_SERVER_DIR` | fx-data-server 仓根 (不传则按 `AGENTS_DIR/../fx-data-server` 推) | `gradlew` |

`--yes` 只跳过 auto 路径的 y/N 确认, **救不了缺 env**——`validateRepos` 在确认逻辑之前无条件跑.

| 参数 | 含义 |
|---|---|
| `--workspace=<X>` | `ui`(默认, web+agents) / `agents`(+docker) / `full`(+docker+Spring) |
| `--no-<svc>` | 子集减法: `--no-web` / `--no-agents` / `--no-server` |
| `--yes` | 跳过 launcher 内自动路径解析的 y/N 确认 (worktree / cross-repo 必加) |
| `--status` | 只查状态不起服务: web/agents/server/pg/minio 各端口 UP/DOWN + 监听 PID (不校验仓路径, 不需要 FX_*_DIR) |
| `--stop` | 按 `--workspace` 范围杀进程后退出, docker 一律不动; 停 server 需 `--workspace=full --stop` |

Workspace 三档按用户表述路由 (**默认 `ui`**, 不擅自升级):

| 用户表述 | 命令 |
|---|---|
| "重启服务" / "起 dev", 无范围 | `--workspace=ui` |
| "全栈" / "含 Spring" / "含后端" | `--workspace=full` |
| "含 docker" / "起中间件" | `--workspace=agents` |
| "只 agents" / "只起 agents" | `--workspace=ui --no-web` |
| "只 web" / "只起 web" | `--workspace=ui --no-agents` |

**升档需 askUser**: 默认 ui 没 Spring (慢且需 GraalVM, 委派脚本自动检测), 用户说"全栈"再升 `full`. 模糊信号 → askUser "起 ui 还是 full (含 Spring 后端)?", 别擅自升档.

### server (Spring) 委派 scripts/dev-start.sh

launcher 不裸跑 `gradlew bootRun`. `full` 档起 server 时委派 `${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/scripts/dev-start.sh app`(源自 fx-data-server 团队的本地启动脚本, 随插件分发), 自动获得: GraalVM 检测(候选路径 + `.java-home` 缓存写在 server 仓根) / ZGC→G1GC+EnableJVMCI patch(GraalJS 沙箱必需) / macOS 代理清除(防 localhost gRPC 被系统代理劫持 502) / `-Drpc.host` Polars 回连注入 / wait_for_es / 增量编译(`bootRun --no-build-cache`, 非 clean).

- 脚本要求 env `FX_SERVER_DIR`(launcher 自动传); 手动跑: `FX_SERVER_DIR=<server仓根> bash <插件根>/skills/agents-launcher/scripts/dev-start.sh app`
- **server 日志不进 launcher stdout**, 在 `<FX_SERVER_DIR>/dev-start.log`; bootRun 进程由脚本后台脱管(PID 记 server 仓根 `.dev-start.pid`), 停服由 `--stop` 的 `gradlew --stop` + 端口 kill 覆盖
- **副作用**: 脚本会 patch server 仓 `build.gradle.kts`(ZGC→G1GC, 幂等)且**不还原**——server 仓 `git status` 会脏, **勿把该改动误提交**
- launcher 只用它的 `app` 子命令; 脚本的 sync 子命令是 2026-06-25 修复前的旧版(本地 Gradle 模式), **不要用它起 sync**

服务端口表 (写死, launcher 自己读 `lib/ports.mjs`, **skill 内不硬编码**, 此表仅速查):

| 服务 | 端口 | 类型 |
|---|---|---|
| web (vite dev) | `:10001` | TCP LISTEN |
| agents (Hono) | `:8070` | 有 `/health` |
| server (Spring) | `:8081` | TCP LISTEN |

工具入口**绝不绕过** (e.g. 直接 `pnpm dev:server`) — launcher 内置 kill 旧进程 + healthy 等待 + 子进程 teardown, 绕过会失去这些保障.

## Step 0 — 仓况盘点 (worktree 专属)

> 主仓启动跳过本节直接 Step 3.

Step 1 的 cp 模板和 Step 2.2 的对齐检查都预设「目标仓的 worktree 已存在」. 这个前提**不自动成立**——launcher 和 skill 后续步骤都不会替你发现"某个仓根本没有对应 worktree". 所以 worktree 启动第一件事: 盘点各目标仓的分支/worktree 状态, 拿到每个 `FX_*_DIR` 的合法值再往下走.

目标 `<branch>` 来自用户指定或当前所在 worktree 的 `git branch --show-current`——**不得按目录名或相似分支名猜**, 拿不到先问.

盘点范围按 workspace 档: `ui` 盘 fx-data-agents + fx-data-web; `full` 加 fx-data-server. 对**每个目标仓**执行同一组只读命令 (可 && 串成一次调用):

```bash
git -C <repo 主仓> worktree list --porcelain            # 有没有挂 <branch> 的 worktree
git -C <repo 主仓> branch --list <branch>               # 本地分支存在性
git -C <repo 主仓> branch -r --list "origin/<branch>"   # 远端分支存在性
```

每个目标仓按盘点结果三态路由:

| 该仓状态 | 处理 |
|---|---|
| 同名分支 worktree 已存在 | 复用, `FX_*_DIR` 指向它, 不问 (无歧义) |
| 分支存在 (本地/远端) 但没挂 worktree | **Gate 0 askUser**, 推荐「挂现有分支」(移交 using-git-worktrees 复用该分支, 不新开) |
| 分支和 worktree 都没有 | **Gate 0 askUser**, 推荐按改动位置判断 (该仓有改动 → 建 worktree; 无改动 → 混搭主仓) |

确定每个 `FX_*_DIR` 后, 核对该目录 `git branch --show-current` = 目标 `<branch>` (混搭主仓的仓除外)——launcher 的 validateRepos 只认标志文件不认分支, `FX_*_DIR` 指到错误分支的 worktree 它**不会报错**.

### Gate 0 — 有仓缺 worktree 时 askUser

```
"fx 仓况盘点:
  fx-data-agents: worktree <路径>@<branch> ✓
  fx-data-web:    无 <branch> worktree (本地分支: <有/无>)
  [fx-data-server: ... — 仅 full 档列出]
<缺仓> 没有 <branch> 的 worktree, 怎么处理?"
选项:
  - 建/挂同名 worktree (停本 skill, 移交 using-git-worktrees; 分支已存在则挂现有分支不新开; launcher 不直接跑 git worktree add) — 该仓有改动时必选
  - 混搭主仓 (仅该仓无改动可行; 会弄脏主仓: web = 改主仓 .env.local + 可能改 package.json, server = patch 主仓 build.gradle.kts + .java-home / .dev-start.pid / dev-start.log)
  - 跳过该服务 (--no-<svc>)
  - 我自己处理后再继续
```

- 用户选「建/挂 worktree」→ 移交 `using-git-worktrees` skill 建 (fetch + 基于 base 最新 + worktree-setup.mjs 补齐), 建完回到 Step 1. **建 worktree 不是 launcher 的活**, 本 skill 只盘点 + 路由.
- 混搭的适用判断同 Gate 3.2: 改 `packages/desktop` 可混搭主仓 agents; 改 `packages/server` / `packages/shared` 的仓**必须**有自己的 worktree. fx-data-server 无改动时混搭主仓 server 合理, 但仍走 Gate 0 前置披露, 不许拍板后只在 3.4 事后标注.

Gate 0 走完, 先产出 **launch plan** 再进 Step 1——后续 Step 1/2/3 全按此表条件化执行, 不再逐步临时判断:

| 仓 | 来源路径 | 来源类型 | branch | 后续动作 |
|---|---|---|---|---|
| fx-data-agents | <路径> | worktree / 主仓 / 跳过 | <branch> | cp config.yaml / 起服务 / --no-agents |
| fx-data-web | <路径> | worktree / 主仓 / 跳过 | <branch> | cp .env.local / 改 AGENTS_LOCAL_SRC / reset 对齐 / --no-web |
| fx-data-server (仅 full) | <路径> | worktree / 主仓 / 跳过 | <branch> | 传 FX_SERVER_DIR / --no-server |

**来源类型 = 主仓 的仓**: 跳过 Step 1 cp (禁止往 `<*-worktree>` 占位路径 cp); Gate 1.5 / Gate 2.1 涉及它时提问文案必须点明「改的是主仓文件, 测完需还原」; Gate 2.2 以主仓 HEAD 参与对齐判断, **禁止对主仓 reset --hard**; 完成汇报 (3.4) 必须列「主仓被改文件还原 / 勿提交」清单.

**三个禁手 (baseline 实测事故形态)**:
- ❌ 在主仓 checkout feature 分支来凑 `FX_*_DIR` — 违反 rule-git-worktree「所有分支都走 worktree, 不在主仓裸开 branch」, 主仓要留在 release/main
- ❌ 臆造一个不存在的 worktree 路径填 `FX_*_DIR` — validateRepos 报错是最好结局, 最坏静默指错仓
- ❌ 缺 worktree 不问用户, 自己拍板混搭主仓 — 混搭是 Gate 0 的选项之一, 不是默认值

## Step 1 — cp 必备 gitignored 文件 (worktree 专属)

> 主仓启动跳过本节直接 Step 3.

worktree-setup.mjs 自动补齐 IDE / node_modules / symlink personal, 但下列文件 envCandidates 扫不到 (子目录深 / catalog 协议), 必须手动 cp:

| 仓 | 文件 | 用途 | 不补的后果 |
|---|---|---|---|
| fx-data-agents | `packages/server/conf/config.yaml` | agents 配置 (pg/minio/LLM) | launcher 报 "agents config.yaml 不存在" 启动失败 |
| fx-data-web | `packages/jsy-web/server/.env.local` | web 联调入口 + AGENTS_LOCAL_SRC | vite 起得来但跑 registry 版 desktop, worktree 改动不可见 |

### Gate 1 — cp 前 askUser

```
"Worktree 启动需要从主仓 cp 以下 gitignored 文件 (worktree-setup 扫不到):
  1. <agents-main>/packages/server/conf/config.yaml      → <agents-worktree>/packages/server/conf/config.yaml
  2. <web-main>/packages/jsy-web/server/.env.local       → <web-worktree>/packages/jsy-web/server/.env.local
确认 cp 吗?"
选项:
  - 全部 cp (推荐)
  - 只 cp agents config (仅起 agents 不起 web)
  - 只 cp web .env.local (仅起 web 复用主仓 agents)
  - 我自己 cp / 跳过
```

cp 模板:

```bash
cp <agents-main>/packages/server/conf/config.yaml      <agents-worktree>/packages/server/conf/config.yaml
cp <web-main>/packages/jsy-web/server/.env.local       <web-worktree>/packages/jsy-web/server/.env.local
```

### Gate 1.5 — corepack cache 不全时 askUser 改 package.json

fx-data-web `package.json` 的 `packageManager` 字段若锁着 corepack cache 没有的版本 (e.g. `pnpm@10.10.0` 但本机只缓存 `10.33.0`), launcher 起 vite 时 corepack 试着下 → `EHOSTUNREACH` (墙 / 离线). **仅在 cache 不全时触发**:

```
"本机 corepack 没缓存 web 仓需要的 `pnpm@<X>`. 在 worktree (不动主仓) 改 `package.json`
packageManager 字段成本机已缓存的版本 `pnpm@<Y>`?
(worktree 销毁时改动一起没)"
选项:
  - 改成 pnpm@<已缓存版本>
  - 我自己装 pnpm@<X> 后重试
  - 跳过 (会启动失败)
```

## Step 2 — 联调对齐 (worktree 专属)

> 主仓启动跳过本节直接 Step 3.

worktree 启动测前端 / 联调前必须保证两件事: `.env.local` 指向 worktree, 两仓 fork 时间窗口对齐.

### 2.1 改 `.env.local` 指向 agents worktree

web vite 通过 `AGENTS_LOCAL_SRC` 决定加载哪份 fx-data-agents (详见 `LOCAL-DEBUG-WITH-FX-DATA-WEB.md`). worktree 联调必改成 agents **worktree** 绝对路径——不改 → 加载主仓 → worktree 改动对浏览器**不可见**.

### Gate 2.1 — 改 .env.local 前 askUser

目标文件永远是 `<FX_WEB_DIR>/packages/jsy-web/server/.env.local`. web 来源类型 = 主仓 (Gate 0 混搭) 时, 下面文案里的「web worktree」换成「web **主仓**」并点明测完需还原.

```
"把 web worktree `.env.local` 的 `AGENTS_LOCAL_SRC` 改成 `<agents-worktree-path>`?
当前值: `<existing-value>`
不改 → vite 加载主仓 desktop, worktree 改动浏览器看不到."
选项:
  - 改成 worktree 路径 (推荐, 测前端联调必选)
  - 保留主仓 (只测后端 / 不测 desktop 改动)
  - 跳过
```

### 2.2 base 时间对齐 (避免跨仓 API 漂移)

rule-git-worktree 默认 "fetch + 静默基于 upstream 最新" 建分支. 两仓 (fx-data-web + fx-data-agents) 各自 fork 时间不同步 → 跨仓 import 撞 API 漂移:

| 反例 | 现象 |
|---|---|
| web worktree = `origin/release` 最新 (主仓领先 N commit) + agents worktree = persist HEAD (落后 release 209 commit) | web 引用 release 新加 export `fileTypeToResourceType`, agents shared 没这个 export → 浏览器 `Uncaught SyntaxError` |

策略: web worktree 创建后立刻 reset 到主仓 HEAD, 跟 agents worktree 时间窗口对齐.

### Gate 2.2 — fork 时间不对齐时 askUser reset

**仅在两仓 fork 时间不一致时触发**. 混搭主仓的仓以主仓 HEAD 参与对齐判断; reset 选项只适用于 worktree, **禁止对主仓 reset --hard**. 下面模板预设 web worktree 是刚建的空分支——若它挂的是**已有分支且自带配套 commit** (Gate 0 挂现有分支路径), reset 会把分支自身 commit 一起冲掉 (可能正是要联调的改动): 文案必须披露该后果, 此情形默认推荐改为「不 reset」:

```
"web worktree HEAD = `<web-worktree-sha>` (来自 origin/release 最新)
fx-data-agents worktree base = `<agents-worktree-base-sha>` (跟 web 主仓时间窗口对齐)
两仓 fork 时间不对齐, 跨仓 import 可能撞 API 漂移. 把 web worktree reset --hard
到 web 主仓 HEAD `<web-main-sha>` 对齐?
注意: reset 会冲掉 Gate 1.5 改的 `package.json` packageManager 字段, **需要重做**."
选项:
  - reset 对齐 (推荐, 跟 agents worktree 同时间窗口)
  - 不 reset (接受可能的 API 漂移风险, 跨仓 import 失败再处理)
  - 跳过
```

reset 命令:

```bash
git -C <web-worktree> reset --hard <web-main-HEAD-sha>
# 若 Gate 1.5 改过 package.json packageManager → 重做 Edit
```

## Step 3 — 执行脚本启动 (主仓 / worktree 共用)

### 3.1 启动前预检

**中间件预检已内置**: ui 档(无 docker)启动 agents 前, launcher 自动 tcp 预检 pg5432 + minio9000, 未就绪 fail loud 退出(报错给出 `--workspace=agents` / 手动 compose up 两条路), 不需要手工 lsof.

**幂等检查用 `--status`**(一次调用替代手工 lsof/curl, 命令里 `${CLAUDE_PLUGIN_ROOT}` 先换插件真实绝对路径):

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs --status
```

输出 web/agents/server/pg/minio 各端口 UP/DOWN + 监听 PID. 目标 workspace 端口全 UP → 触发 Gate 3.1.

### Gate 3.1 — 已在跑且用户没明说"重启"时 askUser

```
"<服务列表 + 端口> 已在跑. 仍要重启吗?
  - web 重启 ~10s (vite dev)
  - agents 重启 ~1s (Hono tsx watch)
  - server 重启 ~30-60s (Spring)"
选项:
  - 重启 (杀旧起新)
  - 保留现状, 不动
  - 升档 full (含 Spring) — 仅当目标含 server 时出现此选项
```

用户**明确说"重启"** → 直接启动, 跳过 Gate 3.1. launcher 内置 `buildKillCommands` 会先清旧端口, 不用手工 kill.

### 3.2 后台启动命令

launcher 在插件目录, **主仓 / worktree 启动都必须显式传 `FX_*_DIR`** (见「仓路径 env」节). 区别只在 env 指向主仓还是 worktree 路径. 命令里的 `${CLAUDE_PLUGIN_ROOT}` 要先换成插件真实绝对路径.

**主仓启动** (FX_*_DIR 指向主仓 fx 仓根):

```bash
FX_AGENTS_DIR=<fx-data-agents 主仓绝对路径> \
FX_WEB_DIR=<fx-data-web 主仓绝对路径> \
  node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs \
  --workspace=<X> [--no-<svc>] --yes
```

**worktree 启动** (FX_*_DIR 按 Step 0 launch plan 填, 混搭的仓填主仓路径):

```bash
FX_AGENTS_DIR=<fx-data-agents 路径 (按 launch plan)> \
FX_WEB_DIR=<fx-data-web 路径 (按 launch plan)> \
  node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs \
  --workspace=<X> --yes
```

起 server (`--workspace=full`) 再加一行 `FX_SERVER_DIR=<fx-data-server 路径>`.

**为什么必须 `FX_*_DIR`**: launcher 内 `toolDir = path.dirname(import.meta.url)` 是**插件**目录, `lib/paths.mjs` 的 `resolve(toolDir, '../../..')` 推到插件父目录 (非任何 fx 仓), validateRepos 必然报错. 必须显式 `FX_*_DIR` 才能指到正确 fx 仓 (主仓 or worktree). 起 server 时再加 `FX_SERVER_DIR`.

**Bash 工具调用必须 `run_in_background: true`** — 长驻进程, 前台跑阻塞整个会话.

`--yes` 跳过 launcher 内自动路径解析的 y/N 确认.

**记录返回的后台 task ID**, 汇报给用户. 后续停服需要它.

### Gate 3.2 — worktree 改了 server/shared 时 askUser 是否替换主仓 agents

**复用主仓 agents 的判断**: 改 `packages/desktop` (前端 React, fx-data-web vite 加载) **可以**复用主仓 agents (agents 后端不依赖 desktop). 改 `packages/server` / `packages/shared` **必须**起 worktree agents.

**仅在 worktree 改动包含 server/shared 且主仓 agents 在跑时触发**:

```
"worktree 改动包含 `packages/server` / `packages/shared`. 主仓 agents 还在跑 (PID <X>).
是否停主仓 agents, 起 worktree agents 替换?
不替换 → 用户测的是主仓 agents 行为, 改动不生效."
选项:
  - 替换 (停主仓 agents + 起 worktree agents) — 推荐
  - 保留主仓 agents (仅测前端 / 改动暂不需后端验证)
  - 跳过
```

### 3.3 Healthy 确认

launcher 内部已按服务等健康(agents `/health`、web/server 端口), 全部就绪打印 `✅ 就绪 → http://localhost:10001/decision/home`. **agent 不要手写 curl/nc 轮询**——等后台 task 输出该行, 或跑一次 `--status` 确认全 UP.

超时(launcher 抛「健康检查超时」): 看后台 task 输出定位卡在哪个服务; server 卡住先看 `<FX_SERVER_DIR>/dev-start.log`.

### 3.4 完成汇报

启动成功后告诉用户:

1. 每个目标服务的监听 PID(跑 `--status` 取, 不手写 lsof):
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs --status
   ```
2. 访问入口: `http://localhost:10001/decision/home`
3. 后台 task ID (停服用)
4. **来源标注** (主仓 vs worktree, 多 worktree 时标 branch 名), 例如:
   ```
   | 服务 | 端口 | PID | 来源 |
   |---|---|---|---|
   | web | :10001 | 61063 | worktree fx-data-web-debug_xxx@<sha> |
   | agents | :8070 | 46239 | 主仓 fx-data-agents |
   ```
5. 提示: `tsx watch` 已开热重载, 改 TS 文件**不用再重启**
6. Gate 0 有仓混搭主仓时: 列「主仓被改文件还原 / 勿提交」清单 (web: `.env.local` / `package.json`; server: `build.gradle.kts` patch 等)

## 停止动作

### 首选: `TaskStop` 已知 task

启动时拿到的后台 task ID 是 launcher 进程本身. `TaskStop` 它后, launcher 收 SIGTERM 按 `dev-orchestrator.mjs` 的 `teardown()` 有序杀子进程 (agents tsx watch + web vite). 比手工 `pkill` 干净 — launcher 知道自己起了哪些子进程, 手工 pkill 容易漏 / 误伤.

### Fallback: task ID 未知 / 服务外部起的

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs --stop --workspace=<范围>
```

`--stop` 内置正确杀法, **不要再手写 pkill/lsof**: agents 杀 tsx watch **父进程**(`pkill -f telemetry/preload.ts`——tsx watch 是父子结构, 只杀子 node 会被父 watch 自动重启, 端口立刻重占)+ 端口清理; web 清 :10001; server 走 `gradlew --stop` + :8081 kill(需 `--workspace=full`).

### docker 中间件: 默认不停

本机往往有其他服务也在用 pg/minio. 盲目 `docker compose down` 影响面太大. 用户**显式说"停 docker"** 才做:

```bash
cd ../fx-data-server && docker compose down
```

### docker 中间件: 单独重启 sync 容器必须连带重启 sync-polars-localhost

`sync-polars-localhost` 是共享 sync 网络栈的 socat sidecar (`network_mode: "service:sync"`, 见 fx-data-server `docker-compose.template.yml`). 主容器 `<IMAGE_PREFIX>-sync` (如 `test-sync`) 重启 / 重建后, sidecar 还挂在旧网络命名空间上, socat 转发绑定失效——**Excel 导入会静默写出空表, 表还标 valid, 无任何报错, 极具迷惑性**.

- 重启 sync 时两个一起重启: `docker restart <IMAGE_PREFIX>-sync sync-polars-localhost` (sidecar 在后)
- launcher 自身的 docker 步骤是 `compose down → up -d` 全量重建, sidecar 一起重建, **不受此坑影响**; 只有单独重启 sync 容器才踩
- compose 已有 `depends_on: - sync`, 但短语法只管启动顺序**不传播 restart**; 长期修法是在 fx-data-server compose 改 depends_on 长语法加 `restart: true` (compose 命令重建 sync 时连带重启 sidecar; 裸 `docker restart` 不经过 compose, 仍需手动两个一起)

## 必踩坑速查

1. 状态 / 健康一律 `--status`, 别手写 curl/nc/lsof 轮询 (历史坑: 手写 `nc -z` 加 `2>&1` 会 stderr 污染 break 变量, 循环跑满超时)
2. `--workspace=ui` 默认含 web, 用户没说"只 agents"别加 `--no-web`, :10001 起不来
3. pg5432 / minio9000 未就绪时 launcher 的 ui 档会预检 fail loud (报错给出解法), 不再 silent 卡住
4. 杀 `tsx watch` 要杀父进程 (`telemetry/preload.ts` 关键词), 不是杀子 node — `--stop` 已内置
5. 后台 task ID 必须记录告知用户; 丢了用 `--stop --workspace=<范围>` 兜底
6. launcher 内置 `buildKillCommands` — 启动会先 kill 旧, 别在 skill 里又叠一层手工清理
7. worktree 启动必须按 Step 0 → 1 → 2 → 3 顺序, 不能跳过 仓况盘点 / cp / 联调对齐; 有仓缺 worktree 走 Gate 0, 不臆造路径、不主仓 checkout、不擅自混搭
8. worktree `reset` / `git pull` 后, Gate 1.5 改的 `package.json` packageManager 改动会被冲掉, **需要重做**
9. 关键决策点 (缺 worktree 处置 / cp / 改 .env.local / reset / 重启已在跑 / 升档全栈 / 替换主仓 agents) **必须 askUser**, 不擅自动
10. launcher 在插件目录不在 fx 仓 → `FX_*_DIR` 主仓 / worktree 启动都强制, 漏了必报 validateRepos 错; `${CLAUDE_PLUGIN_ROOT}` Bash 不展开, 先换绝对路径
11. 单独重启 sync 容器 (如 `test-sync`) 必须连带重启 `sync-polars-localhost` — socat sidecar 共享 sync 网络栈, 主容器重启后绑定失效, Excel 导入静默写空表 (表还标 valid, 无报错)
12. server 委派 `scripts/dev-start.sh` 有副作用: 会 patch server 仓 `build.gradle.kts` (ZGC→G1GC) 且不还原, **勿把该改动误提交**; server 日志在 `<FX_SERVER_DIR>/dev-start.log` 不在 launcher stdout

## 不要做

- 不要把 agents-launcher 抽象成"任意服务管理器" — scope 只本仓三服务
- 不要在 skill 里硬编码端口 — 端口在 `lib/ports.mjs`, 让 launcher 自己读
- 不要绕过 launcher 直接 `pnpm dev:server` — 失去 kill 旧 + healthy 等待 + teardown
- 不要绕过 `scripts/dev-start.sh` 手拼 `gradlew bootRun` 起 server — 丢 GraalVM/ZGC patch/代理清除/rpc.host 修补, GraalJS 沙箱和 Polars 联调会挂
- 不要手写 lsof/curl/nc 查状态或 pkill 停服 — 用 `--status` / `--stop`, 杀法和坑都固化在脚本里
- 不要默认 `--workspace=full` — Spring 慢且需 GraalVM, 模糊信号下 askUser
- 不要因"停 docker"擅自 `docker compose down` — 影响其他容器
- 不要 worktree 改了 `packages/server` / `packages/shared` 还复用主仓 agents — agents 后端代码不生效, 用户测的不是 worktree 行为
- 不要去 fx 仓 (主仓 / worktree) 里找 launcher — 它随插件分发, 真实路径在 `${CLAUDE_PLUGIN_ROOT}/skills/agents-launcher/`, fx 仓的 `.claude/skills/` 是空的
- 不要把 `${CLAUDE_PLUGIN_ROOT}` 原样塞进 Bash 命令 — Bash 工具不展开它, 先换成插件真实绝对路径再跑
- 不要漏 `FX_*_DIR` env (主仓 / worktree 启动都要) — launcher 在插件目录, 不传则 auto-resolve 落到插件父目录非 fx 仓, validateRepos 直接报错
- 不要在主仓 checkout feature 分支来凑 `FX_*_DIR`, 也不要臆造不存在的 worktree 路径 — 缺 worktree 走 Gate 0 (建 / 混搭 / 跳过), 建 worktree 移交 using-git-worktrees
- 不要绕过 askUser gate 自己做关键决策 — 缺 worktree 处置 / cp / 改 env / reset / 替换 agents 都先问

## 范例

| 用户说 | 动作 |
|---|---|
| "重启服务" (主仓) | Step 3: 预检 + 后台启 + 轮询, Gate 3.1 幂等 / Gate 3.2 worktree 替换不触发 |
| "起 dev 全栈" | Step 3: `--workspace=full --yes` |
| "只起 agents" | Step 3: `--workspace=ui --no-web --yes` |
| "在 worktree 内起 dev 测前端改动" | Step 0 (盘点) → Step 1 (Gate 1 cp) → Step 2 (Gate 2.1 改 AGENTS_LOCAL_SRC, Gate 2.2 reset 对齐) → Step 3 (Gate 3.2 复用主仓 agents) |
| "在 worktree 内起 dev 测后端改动" | Step 0 → Step 1 → Step 2 → Step 3 (Gate 3.2 替换主仓 agents 成 worktree agents) |
| "在 worktree 起 dev" 但 web 仓没有同名 worktree | Step 0 盘点发现缺 → Gate 0 (建 worktree / 混搭主仓 / --no-web), 不臆造路径不主仓 checkout |
| "停服" | `TaskStop <已知 task ID>`; 未知则 fallback `--stop --workspace=<范围>` |
| "看服务状态" | `--status` (web/agents/server/pg/minio 端口 + PID, 一次调用) |
| "重启 docker" | **不进 skill** — 是 docker compose 的事 |
| "重启 test-sync / sync 容器" | `docker restart <IMAGE_PREFIX>-sync sync-polars-localhost` — sidecar 必须连带重启, 见「docker 中间件」节 |
| "看 agents 日志" | **不进 skill** — Read 后台 task 的 output 文件 |
| "重启 mac" | **不进 skill** |
