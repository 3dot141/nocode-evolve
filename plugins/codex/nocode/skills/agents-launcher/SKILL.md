---
name: agents-launcher
description: "Use when starting, stopping, restarting, or checking the local fx-data-agents web/agents/server…"
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

**决策按可逆性分级**, 不是一律 askUser:

| 级别 | 动作 | 处理 |
|---|---|---|
| 无损 (幂等 / worktree 局部 / 随 worktree 销毁) | 复用已有同名或 base worktree / Step 1 cp (已存在则跳过) / 改 **worktree 内** `.env.local` / pkgmgr patch worktree `package.json` | **自动做**, 逐项列入完成汇报 (3.4), 不问 |
| 不可逆 / 碰共享状态 | `git reset` / 改**主仓**文件 (混搭时的 `.env.local` 等) / 重启已在跑服务 / 升档全栈 / 替换主仓 agents / 同名和 base worktree 全无时的 建/混搭/跳过 | **askUser gate**, 模糊信号别替用户判断 |

用户已经建好 worktree 就是「用它」的显式信号——为无损的准备动作再逐个确认是决策噪音, 用户只能机械点推荐项.

## 脚本与命令

主入口: `${PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs` (Node ESM).

> **launcher 随 nocode 插件分发, 不在任何 fx 仓内** (fx-data-agents 主仓的 `.claude/skills/` 是空的). `${PLUGIN_ROOT}` 占位插件根, 但 **Bash 工具不展开它** (它只在 hooks.json 里被 harness 替换). 构造 Bash 命令前, agent 必须把它换成插件真实安装目录的绝对路径 (本机 dev 部署 = `/Users/yes365/AI/nocode-evolve`). 下文命令模板均按此处理.

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

**升档需 askUser**: 默认 ui 没 Spring (慢且需 GraalVM, server-cli 自动检测), 用户说"全栈"再升 `full`. 模糊信号 → askUser "起 ui 还是 full (含 Spring 后端)?", 别擅自升档.

### per-service CLI（skill gate 通过后的执行单元）

| CLI | 动词 | 用途 |
|---|---|---|
| `server-cli.mjs` | `prepare` / `infra` / `start` / `stop` / `status` | prepare = ANTLR 生成类预热 + GraalVM 检测缓存（新建 server worktree 后必跑一次, 否则 IDE 报红）; infra = 从目标 server 仓 `dockerstart.sh` 每次生成临时派生脚本并执行; start = 本地 infra + Spring app（orchestrator 已跑 infra 时跳过重复执行） |
| `web-cli.mjs` | `prepare` / `env` / `pkgmgr` / `align` / `start` / `stop` / `status` | prepare = cp .env.local（`FX_WEB_FROM=<源仓>`）; env = 写 AGENTS_LOCAL_SRC 等四键; pkgmgr = corepack 缓存检查+packageManager patch（`--patch=<version>`）; align = fork 对齐检查（`--reset` 显式才 reset）; start = 清 Vite 预构建缓存后起 vite dev（orchestrator 与独立 CLI 两条路径共享, 防切 worktree 后缓存路径失效） |
| `agents-cli.mjs` | `prepare` / `start` / `stop` / `status` | prepare = cp config.yaml（`FX_AGENTS_FROM=<源仓>`） |

调用模板（`${PLUGIN_ROOT}` 先换插件真实绝对路径; repo 路径用 FX_*_DIR env 传）:

```bash
FX_SERVER_DIR=<server 仓根> node ${PLUGIN_ROOT}/skills/agents-launcher/server-cli.mjs prepare
FX_WEB_DIR=<web 仓根> FX_AGENTS_DIR=<agents 仓根> node ${PLUGIN_ROOT}/skills/agents-launcher/web-cli.mjs env
FX_AGENTS_DIR=<agents 仓根> FX_AGENTS_FROM=<主仓根> node ${PLUGIN_ROOT}/skills/agents-launcher/agents-cli.mjs prepare
```

CLI 全部非交互, 只认显式 flag。不可逆动作（align --reset / 改**主仓**文件）由本 skill 的 Gate 问过用户后才调; worktree 内的 prepare cp / env upsert 无损, 按 launch plan 自动调。

### server 与 Docker 由 server-cli 承载

orchestrator 只负责选择并显式传入目标 `FX_SERVER_DIR`, 调用 `serverCli.infra/start`, 不实现 Compose 服务筛选、`IMAGE_PREFIX`、Harbor 登录等 server 规则。

每次 `infra` 都读取目标 server 主仓/worktree 的 `dockerstart.sh`, 在系统临时目录生成一次严格模式派生脚本并从目标仓根执行。派生只做两项定向变化: 在 `up` 前拉取当前 Compose 中所有最新镜像, 并从 pull/up 服务集合排除 `fx-data-agents`（本地 agents 由 `agents-cli` 启动）。其余模板复制、分支映射、`IMAGE_PREFIX`、Harbor 登录及前后处理原样继承目标脚本。上游脚本结构不再匹配唯一活动 `docker compose up -d` 时 fail loud, 不猜测转换；执行成功或失败都会删除临时脚本，不在 plugin/server 仓留生成物。

launcher 不裸跑 `gradlew bootRun`. `full` 档起 server 时 orchestrator 直调 `server-cli`; Docker 已在该轮显式启动时不重复执行, standalone `server-cli start` 则默认补齐 infra。Spring 启动自动获得: GraalVM 检测(候选路径 + `.java-home` 缓存写在 server 仓根, 无 GraalVM 时容器方案降级) / ZGC→G1GC+EnableJVMCI patch(GraalJS 沙箱必需) / macOS 代理清除(防 localhost gRPC 被系统代理劫持 502) / `-Drpc.host` Polars 回连注入 / wait_for_es / 增量编译(`bootRun --no-build-cache`, 非 clean).

- 手动只起 Docker: `FX_SERVER_DIR=<server仓根> node <插件根>/skills/agents-launcher/server-cli.mjs infra`
- 手动跑: `FX_SERVER_DIR=<server仓根> node <插件根>/skills/agents-launcher/server-cli.mjs start [--kill-old]`（端口占用默认 fail loud, `--kill-old` 显式杀旧）
- `server-cli start` 固定向 Spring 注入 `OPENPROJECT_ISOPEN=false`（本地 GraalVM / 容器降级两条路径一致），覆盖 server `dev` profile 默认的 `openProject.isOpen: true`，避免每次后台启动都执行 `open http://localhost/decision`
- **server 日志不进 launcher stdout**, 在 `<FX_SERVER_DIR>/dev-start.log`; bootRun 进程后台脱管(PID 记 server 仓根 `.dev-start.pid`), 停服由 `--stop`（gradlew --stop + 容器清理 + 端口 kill）或 `server-cli stop` 覆盖
- **副作用**: 会 patch server 仓 `build.gradle.kts`(ZGC→G1GC, 幂等)且**不还原**——server 仓 `git status` 会脏, **勿把该改动误提交**

**server worktree 首次准备（ANTLR 坑）**: fx-agent-workspace 的 ANTLR 生成类落在 gitignored 目录（新接线 `src/main/antlr-generated` / 旧接线 `src/main/generated`）, 新建 worktree 后为空——命令行 gradle 会自愈（生成 task 挂 compileJava.dependsOn）, 但 IDE (IDEA JPS) 不跑 gradle task, 直接打开报红. 新建 server worktree 后跑一次:

```bash
FX_SERVER_DIR=<server worktree> node <插件根>/skills/agents-launcher/server-cli.mjs prepare
```

内部执行 `./gradlew :fx-agent-workspace:generateGrammarSource`（两代接线通用聚合入口）, 并自动解析 JAVA_HOME（GraalVM → `java_home -v 21`; 本机默认 JDK 过新会 build 失败, prepare 已处理）.

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

### base 分支推断 (目录命名剥离)

worktree 目录命名惯例 `<repo>-<base>-<branch-slug>` (slug = 分支名的 `/` 全换 `_`) 编码了 base. 从当前 worktree 推断:

```
rest = 当前 worktree 目录名去掉 "<repo>-" 前缀
slug = <branch> 的 "/" 全部换 "_"
rest 以 slug 结尾 → base = rest 剥掉尾部 slug 再剥尾部 "-"
```

例: 目录 `fx-data-agents-release-design_scene-agent-restructure-method3` + 分支 `design/scene-agent-restructure-method3` → base = `release`.

- **校验**: 剥出的 base 必须在目标仓真实存在 (`git branch --list <base>` 非空或 worktree list 里可见), 否则视为推断失败.
- **推断失败** (目录没编码 base / 校验不过): 不猜——配套仓解析跳过下表第 2/3 层, 直接落 Gate 0, 提问时顺带让用户确认 base, 答案记入 launch plan.

盘点范围按 workspace 档: `ui` 盘 fx-data-agents + fx-data-web; `full` 加 fx-data-server. 对**每个目标仓**执行同一组只读命令 (可 && 串成一次调用):

```bash
git -C <repo 主仓> worktree list --porcelain            # 有没有挂 <branch> 或 <base> 的 worktree
git -C <repo 主仓> branch --list <branch> <base>        # 本地分支存在性
git -C <repo 主仓> branch -r --list "origin/<branch>"   # 远端分支存在性
```

每个目标仓按下列顺序解析 `FX_*_DIR`, **先命中即用, 第 1–3 层命中都不问**:

| 层 | 条件 | 处理 |
|---|---|---|
| 1. 同名 worktree | 挂 `<branch>` 的 worktree 已存在 | 复用, `FX_*_DIR` 指向它 (无歧义) |
| 2. base worktree | 挂 `<base>` 的 worktree 已存在 (该仓无本分支改动时的天然对齐目标) | 复用, 来源类型 = base worktree, 完成汇报标注 |
| 3. 主仓在 base | 主仓 `git branch --show-current` = `<base>` | 混搭主仓 (不切分支), 按「来源类型 = 主仓」限制处理 |
| 4. 全落空 | 以上皆无 (或 base 推断失败) | **Gate 0 askUser** |

第 2 层的前提是**该仓没有本分支的改动**——改动所在仓 (通常就是当前所在 worktree 的仓) 永远走第 1 层; 若某配套仓也需要本分支改动却只有 base worktree, 属于「分支存在但没挂 worktree」的 Gate 0 情形, 推荐「挂现有分支」(移交 using-git-worktrees 复用该分支, 不新开).

确定每个 `FX_*_DIR` 后, 核对该目录 `git branch --show-current` = 目标 `<branch>` (base worktree 核对 = `<base>`; 混搭主仓的仓除外)——launcher 的 validateRepos 只认标志文件不认分支, `FX_*_DIR` 指到错误分支的 worktree 它**不会报错**.

### Gate 0 — 解析四层全落空时 askUser

**只在第 1–3 层全落空 (或 base 推断失败) 时触发**——同名或 base worktree 存在时直接复用, 不进本 gate. 提问必须带推断上下文 (目标分支 / 推断出的 base / 各层为何落空), 不让用户自己回忆仓况:

```
"fx 仓况盘点 (目标分支 <branch>, base 推断 = <base 或 推断失败>):
  fx-data-agents: worktree <路径>@<branch> ✓
  fx-data-web:    无 <branch> worktree, 无 <base> worktree, 主仓在 <主仓分支> ≠ <base>
  [fx-data-server: ... — 仅 full 档列出]
<缺仓> 怎么处理?"
选项:
  - 建/挂同名 worktree (停本 skill, 移交 using-git-worktrees; 分支已存在则挂现有分支不新开; launcher 不直接跑 git worktree add) — 该仓有改动时必选
  - 混搭主仓 (仅该仓无改动可行; 会弄脏主仓: web = 改主仓 .env.local + 可能改 package.json, server = patch 主仓 build.gradle.kts + .java-home / .dev-start.pid / dev-start.log)
  - 跳过该服务 (--no-<svc>)
  - 我自己处理后再继续
```

**不要为凑对齐让主仓切分支**——主仓不在 base 上时, 正确出路是给该仓挂一个 base worktree (纯增量, 不动主仓现场 / 未提交改动 / 在跑进程), 而不是问「主仓切到 <base>?」. 该选项可并入 Gate 0 作推荐项.

- 用户选「建/挂 worktree」→ 移交 `using-git-worktrees` skill 建 (fetch + 基于 base 最新 + worktree-setup.mjs 补齐), 建完回到 Step 1. **建 worktree 不是 launcher 的活**, 本 skill 只盘点 + 路由.
- 混搭的适用判断同 Gate 3.2: 改 `packages/desktop` 可混搭主仓 agents; 改 `packages/server` / `packages/shared` 的仓**必须**有自己的 worktree. 无改动仓混搭主仓合理——主仓已在 base 时走 Step 0 第 3 层不问, 但 launch plan 必须把「来源类型 = 主仓」及连带弄脏项 (web: `.env.local` / `package.json`; server: `build.gradle.kts` patch) 前置标出, 不许只在 3.4 事后标注.

解析完成 (多数场景不经过 Gate 0), 先产出 **launch plan** 再进 Step 1——后续 Step 1/2/3 全按此表条件化执行, 不再逐步临时判断:

| 仓 | 来源路径 | 来源类型 | branch | 后续动作 |
|---|---|---|---|---|
| fx-data-agents | <路径> | worktree / base worktree / 主仓 / 跳过 | <branch> | cp config.yaml / 起服务 / --no-agents |
| fx-data-web | <路径> | worktree / base worktree / 主仓 / 跳过 | <branch 或 base> | cp .env.local / 改 AGENTS_LOCAL_SRC / reset 对齐 / --no-web |
| fx-data-server (仅 full) | <路径> | worktree / base worktree / 主仓 / 跳过 | <branch 或 base> | 传 FX_SERVER_DIR / --no-server |

**来源类型 = base worktree 的仓**: Step 1 cp / Step 2.1 env upsert 照常自动做 (worktree 内文件, 无损); 但它是**长期共享**的 worktree——Gate 2.2 **禁止对它 reset --hard** (同主仓待遇, 以其 HEAD 参与对齐判断); `.env.local` 的 `AGENTS_LOCAL_SRC` 指向本次联调目标后会残留到下次, 接受残留不做还原, 由每次启动的幂等 upsert 覆盖, 完成汇报标注当前指向.

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

**cp 自动执行, 不 askUser**——目标是 worktree 内 gitignored 文件, CLI 幂等 (已存在则跳过不覆盖), 随 worktree 销毁, 无损. 按 launch plan 对来源类型 = worktree / base worktree 的仓执行, 完成汇报 (3.4) 逐项列出 cp 了什么. 来源类型 = 主仓 的仓跳过本步.

cp 命令:

```bash
FX_AGENTS_DIR=<agents-worktree> FX_AGENTS_FROM=<agents-main> node <插件根>/skills/agents-launcher/agents-cli.mjs prepare
FX_WEB_DIR=<web-worktree> FX_WEB_FROM=<web-main> node <插件根>/skills/agents-launcher/web-cli.mjs prepare
```

### Gate 1.5 — corepack cache 不全时 patch package.json (worktree 自动 / 主仓 askUser)

fx-data-web `package.json` 的 `packageManager` 字段若锁着 corepack cache 没有的版本 (e.g. `pnpm@10.10.0` 但本机只缓存 `10.33.0`), launcher 起 vite 时 corepack 试着下 → `EHOSTUNREACH` (墙 / 离线). **仅在 cache 不全时触发**:

- web 来源类型 = worktree / base worktree → **自动 patch**, 完成汇报点名「packageManager 已改成 pnpm@<Y>, 勿把该改动误提交」
- web 来源类型 = 主仓 → askUser (改的是主仓文件, 测完需还原):

```
"本机 corepack 没缓存 web 仓需要的 `pnpm@<X>`. 改**主仓** `package.json`
packageManager 字段成本机已缓存的版本 `pnpm@<Y>`? (测完需还原)"
选项:
  - 改成 pnpm@<已缓存版本>
  - 我自己装 pnpm@<X> 后重试
  - 跳过 (会启动失败)
```

检测与执行都用 web-cli（检测不带 flag 只报告; 带 `--patch` 执行）:

```bash
FX_WEB_DIR=<web-worktree> node <插件根>/skills/agents-launcher/web-cli.mjs pkgmgr                    # 检测: 输出 locked/cached/needsPatch
FX_WEB_DIR=<web-worktree> node <插件根>/skills/agents-launcher/web-cli.mjs pkgmgr --patch=<Y>       # 定向替换 packageManager 字段
```

## Step 2 — 联调对齐 (worktree 专属)

> 主仓启动跳过本节直接 Step 3.

worktree 启动测前端 / 联调前必须保证两件事: `.env.local` 指向 worktree, 两仓 fork 时间窗口对齐.

### 2.1 改 `.env.local` 指向 agents worktree

web vite 通过 `AGENTS_LOCAL_SRC` 决定加载哪份 fx-data-agents (详见 `LOCAL-DEBUG-WITH-FX-DATA-WEB.md`). worktree 联调必改成 agents **worktree** 绝对路径——不改 → 加载主仓 → worktree 改动对浏览器**不可见**.

### Gate 2.1 — 改 .env.local (worktree 自动 / 主仓 askUser)

目标文件永远是 `<FX_WEB_DIR>/packages/jsy-web/server/.env.local`:

- web 来源类型 = worktree / base worktree → **自动 upsert**, 不问——worktree 内文件, `web-cli env` 幂等, `AGENTS_LOCAL_SRC` 语义就是「最近一次联调的目标」; 完成汇报标注当前指向 (base worktree 会残留到下次, 见 Step 0「来源类型 = base worktree」段)
- web 来源类型 = 主仓 (Gate 0 混搭) → askUser (改的是主仓文件, 测完需还原):

```
"把 web **主仓** `.env.local` 的 `AGENTS_LOCAL_SRC` 改成 `<agents-worktree-path>`?
当前值: `<existing-value>`
不改 → vite 加载主仓 desktop, worktree 改动浏览器看不到. 改的是主仓文件, 测完需还原."
选项:
  - 改成 worktree 路径 (推荐, 测前端联调必选)
  - 保留主仓 (只测后端 / 不测 desktop 改动)
  - 跳过
```

执行命令（写 AGENTS_LOCAL_SRC 等四键, 幂等 upsert）:

```bash
FX_WEB_DIR=<web 仓> FX_AGENTS_DIR=<agents-worktree> node <插件根>/skills/agents-launcher/web-cli.mjs env
```

### 2.2 base 时间对齐 (避免跨仓 API 漂移)

rule-git-worktree 默认 "fetch + 静默基于 upstream 最新" 建分支. 两仓 (fx-data-web + fx-data-agents) 各自 fork 时间不同步 → 跨仓 import 撞 API 漂移:

| 反例 | 现象 |
|---|---|
| web worktree = `origin/release` 最新 (主仓领先 N commit) + agents worktree = persist HEAD (落后 release 209 commit) | web 引用 release 新加 export `fileTypeToResourceType`, agents shared 没这个 export → 浏览器 `Uncaught SyntaxError` |

策略: web worktree 创建后立刻 reset 到主仓 HEAD, 跟 agents worktree 时间窗口对齐.

### Gate 2.2 — fork 时间不对齐时 askUser reset

**仅在两仓 fork 时间不一致时触发**. reset 是不可逆动作, **无论目标是谁都 askUser**. 混搭主仓 / base worktree 的仓以各自 HEAD 参与对齐判断; reset 选项只适用于**本分支专属 worktree**, **禁止对主仓和 base worktree reset --hard** (base worktree 长期共享, 冲掉别人 / 下次要用的状态)——不齐时选项只剩「不 reset 接受漂移」或「我自己处理」. 下面模板预设 web worktree 是刚建的空分支——若它挂的是**已有分支且自带配套 commit** (Gate 0 挂现有分支路径), reset 会把分支自身 commit 一起冲掉 (可能正是要联调的改动): 文案必须披露该后果, 此情形默认推荐改为「不 reset」:

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

检查与 reset 都用 web-cli（检查不带 flag; gate 确认后带 `--reset`, 仅限本分支专属 worktree, **禁止对主仓 / base worktree 用**）:

```bash
FX_WEB_DIR=<web-worktree> node <插件根>/skills/agents-launcher/web-cli.mjs align <web-main-HEAD-sha>            # 检查对齐状态
FX_WEB_DIR=<web-worktree> node <插件根>/skills/agents-launcher/web-cli.mjs align <web-main-HEAD-sha> --reset    # gate 确认后 reset
# 若 Gate 1.5 改过 package.json packageManager → 重做 pkgmgr --patch
```

## Step 3 — 执行脚本启动 (主仓 / worktree 共用)

### 3.1 启动前预检

**中间件预检已内置**: ui 档(无 docker)启动 agents 前, launcher 自动 tcp 预检 pg5432 + minio9000, 未就绪 fail loud 退出(报错给出 `--workspace=agents` / 手动启动两条路), 不需要手工 lsof. `agents/full` 档由 `server-cli infra` 执行目标仓派生脚本后等待 pg/minio/ES 健康；脚本非零退出或健康超时都直接失败。

**幂等检查用 `--status`**(一次调用替代手工 lsof/curl, 命令里 `${PLUGIN_ROOT}` 先换插件真实绝对路径):

```bash
node ${PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs --status
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

launcher 在插件目录, **主仓 / worktree 启动都必须显式传 `FX_*_DIR`** (见「仓路径 env」节). 区别只在 env 指向主仓还是 worktree 路径. 命令里的 `${PLUGIN_ROOT}` 要先换成插件真实绝对路径.

**主仓启动** (FX_*_DIR 指向主仓 fx 仓根):

```bash
FX_AGENTS_DIR=<fx-data-agents 主仓绝对路径> \
FX_WEB_DIR=<fx-data-web 主仓绝对路径> \
  node ${PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs \
  --workspace=<X> [--no-<svc>] --yes
```

**worktree 启动** (FX_*_DIR 按 Step 0 launch plan 填, 混搭的仓填主仓路径):

```bash
FX_AGENTS_DIR=<fx-data-agents 路径 (按 launch plan)> \
FX_WEB_DIR=<fx-data-web 路径 (按 launch plan)> \
  node ${PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs \
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
   node ${PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs --status
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
6. 有仓混搭主仓时 (经由 Step 0 第 3 层或 Gate 0): 列「主仓被改文件还原 / 勿提交」清单 (web: `.env.local` / `package.json`; server: `build.gradle.kts` patch 等)
7. Step 1/2 自动做过的无损动作逐项列出: cp 了哪些文件 / `AGENTS_LOCAL_SRC` 当前指向 / pkgmgr patch 与否; 来源含 base worktree 时标注「`.env.local` 指向会残留到下次, 由下次启动幂等覆盖」

## 停止动作

### 首选: `TaskStop` 已知 task

启动时拿到的后台 task ID 是 launcher 进程本身. `TaskStop` 它后, launcher 收 SIGTERM 按 `dev-orchestrator.mjs` 的 `teardown()` 有序杀子进程 (agents tsx watch + web vite). 比手工 `pkill` 干净 — launcher 知道自己起了哪些子进程, 手工 pkill 容易漏 / 误伤.

### Fallback: task ID 未知 / 服务外部起的

```bash
node ${PLUGIN_ROOT}/skills/agents-launcher/dev-orchestrator.mjs --stop --workspace=<范围>
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
- launcher 自身完整执行目标仓 `dockerstart.sh` 的既有流程，并让同一轮 compose up 覆盖全部非 agents 服务；目标脚本包含全量重建时 sidecar 会一起重建。只有脱离脚本单独重启 sync 容器才踩
- compose 已有 `depends_on: - sync`, 但短语法只管启动顺序**不传播 restart**; 长期修法是在 fx-data-server compose 改 depends_on 长语法加 `restart: true` (compose 命令重建 sync 时连带重启 sidecar; 裸 `docker restart` 不经过 compose, 仍需手动两个一起)

## 必踩坑速查

1. 状态 / 健康一律 `--status`, 别手写 curl/nc/lsof 轮询 (历史坑: 手写 `nc -z` 加 `2>&1` 会 stderr 污染 break 变量, 循环跑满超时)
2. `--workspace=ui` 默认含 web, 用户没说"只 agents"别加 `--no-web`, :10001 起不来
3. pg5432 / minio9000 未就绪时 launcher 的 ui 档会预检 fail loud (报错给出解法), 不再 silent 卡住
4. 杀 `tsx watch` 要杀父进程 (`telemetry/preload.ts` 关键词), 不是杀子 node — `--stop` 已内置
5. 后台 task ID 必须记录告知用户; 丢了用 `--stop --workspace=<范围>` 兜底
6. launcher 内置 `buildKillCommands` — 启动会先 kill 旧, 别在 skill 里又叠一层手工清理
7. worktree 启动必须按 Step 0 → 1 → 2 → 3 顺序, 不能跳过 仓况盘点 / cp / 联调对齐; 缺同名 worktree 先找 base worktree (Step 0 第 2 层), 四层全落空才 Gate 0——不臆造路径、不主仓 checkout / 切分支、不擅自混搭
8. worktree `reset` / `git pull` 后, Gate 1.5 改的 `package.json` packageManager 改动会被冲掉, **需要重做**
9. askUser 只留给不可逆 / 碰共享状态的动作 (reset / 改主仓文件 / 重启已在跑 / 升档全栈 / 替换主仓 agents / Gate 0 处置); 无损动作 (复用已有 worktree / cp / worktree 内 env upsert / pkgmgr patch) **自动做但必须逐项列入完成汇报**——静默做了不报等于没做
10. launcher 在插件目录不在 fx 仓 → `FX_*_DIR` 主仓 / worktree 启动都强制, 漏了必报 validateRepos 错; `${PLUGIN_ROOT}` Bash 不展开, 先换绝对路径
11. 单独重启 sync 容器 (如 `test-sync`) 必须连带重启 `sync-polars-localhost` — socat sidecar 共享 sync 网络栈, 主容器重启后绑定失效, Excel 导入静默写空表 (表还标 valid, 无报错)
12. server-cli 有副作用: 会 patch server 仓 `build.gradle.kts` (ZGC→G1GC, 幂等) 且不还原, **勿把该改动误提交**; server 日志在 `<FX_SERVER_DIR>/dev-start.log` 不在 launcher stdout
13. 新建 server worktree 后先跑 `server-cli prepare`, 否则 IDE 对 ANTLR 生成类报红 (dev 启动不受影响, gradle 自愈); prepare 已自动解析 JAVA_HOME (本机默认 JDK 过新会 build 失败)
14. Docker 每次都由 `server-cli` 读取目标仓 `dockerstart.sh` 重新生成临时派生脚本；服务列表来自 `docker compose config --services`, `fx-data-agents` 不存在也能正常工作。派生脚本固定先 pull 最新非 agents 镜像再 up；上游脚本锚点漂移、脚本非零退出或健康检查失败都会 fail loud

## 不要做

- 不要把 agents-launcher 抽象成"任意服务管理器" — scope 只本仓三服务
- 不要在 skill 里硬编码端口 — 端口在 `lib/ports.mjs`, 让 launcher 自己读
- 不要绕过 launcher 直接 `pnpm dev:server` — 失去 kill 旧 + healthy 等待 + teardown
- 不要绕过 `server-cli` 手拼 `gradlew bootRun` 起 server — 丢 GraalVM/ZGC patch/代理清除/rpc.host 修补, GraalJS 沙箱和 Polars 联调会挂
- 不要在 orchestrator/skill 里重写 Compose 服务筛选、`IMAGE_PREFIX`、Harbor 登录或 `fx-data-agents` 排除规则 — 只传明确 `FX_SERVER_DIR` 给 `server-cli infra`, 其余继承目标仓 `dockerstart.sh`
- 不要手写 lsof/curl/nc 查状态或 pkill 停服 — 用 `--status` / `--stop`, 杀法和坑都固化在脚本里
- 不要默认 `--workspace=full` — Spring 慢且需 GraalVM, 模糊信号下 askUser
- 不要因"停 docker"擅自 `docker compose down` — 影响其他容器
- 不要 worktree 改了 `packages/server` / `packages/shared` 还复用主仓 agents — agents 后端代码不生效, 用户测的不是 worktree 行为
- 不要去 fx 仓 (主仓 / worktree) 里找 launcher — 它随插件分发, 真实路径在 `${PLUGIN_ROOT}/skills/agents-launcher/`, fx 仓的 `.claude/skills/` 是空的
- 不要把 `${PLUGIN_ROOT}` 原样塞进 Bash 命令 — Bash 工具不展开它, 先换成插件真实绝对路径再跑
- 不要漏 `FX_*_DIR` env (主仓 / worktree 启动都要) — launcher 在插件目录, 不传则 auto-resolve 落到插件父目录非 fx 仓, validateRepos 直接报错
- 不要在主仓 checkout / 切分支来凑 `FX_*_DIR` 或凑 base 对齐, 也不要臆造不存在的 worktree 路径 — 缺 worktree 按 Step 0 四层解析, 全落空走 Gate 0 (建 / 混搭 / 跳过), 建 worktree 移交 using-git-worktrees
- 不要把决策分级两头做反 — 无损动作 (复用已有 worktree / cp / worktree env upsert) 拿去 askUser 是决策噪音; 不可逆动作 (reset / 改主仓文件 / 替换在跑 agents) 自动做是事故

## 范例

| 用户说 | 动作 |
|---|---|
| "重启服务" (主仓) | Step 3: 预检 + 后台启 + 轮询, Gate 3.1 幂等 / Gate 3.2 worktree 替换不触发 |
| "起 dev 全栈" | Step 3: `--workspace=full --yes` |
| "只起 agents" | Step 3: `--workspace=ui --no-web --yes` |
| "在 worktree 内起 dev 测前端改动" | Step 0 (盘点+解析) → Step 1 (自动 cp) → Step 2 (自动 upsert AGENTS_LOCAL_SRC; Gate 2.2 不齐才问) → Step 3 (Gate 3.2 复用主仓 agents) |
| "在 worktree 内起 dev 测后端改动" | Step 0 → Step 1 → Step 2 → Step 3 (Gate 3.2 替换主仓 agents 成 worktree agents) |
| "在 worktree 起 dev" 但 web 仓没有同名 worktree | Step 0 剥目录名推 base → web 有 base worktree (如 fx-data-web-release) → 直接用, 不问; base worktree 也没有才 Gate 0 (建 / 混搭 / --no-web), 不臆造路径不主仓 checkout |
| 配套仓主仓停在别的分支 (如 persist-ai) | 不问「主仓切到 <base>?」——有 base worktree 直接用; 没有则 Gate 0 推荐挂 base worktree, 主仓现场 (未提交改动 / 在跑进程) 一概不动 |
| "停服" | `TaskStop <已知 task ID>`; 未知则 fallback `--stop --workspace=<范围>` |
| "看服务状态" | `--status` (web/agents/server/pg/minio 端口 + PID, 一次调用) |
| "重启 docker" | 显式确认目标 server 主仓/worktree 后调用 `server-cli infra`；每次拉最新非 agents 镜像并执行目标仓脚本 |
| "重启 test-sync / sync 容器" | `docker restart <IMAGE_PREFIX>-sync sync-polars-localhost` — sidecar 必须连带重启, 见「docker 中间件」节 |
| "看 agents 日志" | **不进 skill** — Read 后台 task 的 output 文件 |
| "重启 mac" | **不进 skill** |
