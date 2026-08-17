# Header

- task: :10001 同源联调 web + portal（launcher 起 web 默认携带 portal）
- status: active
- type: feat
- phase: 开发
- current: 全量确认
- createdAt: 2026-08-17
- artifacts:
  - log: ./design.log.md
  - design: ./design.md

# Decisions

## DEC-001

- 描述: 任务分类 feat。
- 内容: 「web+portal 同源本地联调」作为新能力交付，跨 fx-data-web 仓（vite 配置）与 nocode-evolve 仓（agents-launcher）。
- 过程: 见 Event 1。404 根因是 portal 应用未启动，非既有行为违背预期（排除 bug）；有新增可观察行为（排除 refactor）。
- 引用: [Event 1]

## DEC-002

- 描述: 产品范围——单入口同源 + launcher 默认携带，含非范围与 preserve。
- 内容: 功能 1：`:10001` 单一入口同时可访问 `/decision/home` 与 `/decision/portal/home/`（1.1 jsy-web 反代 portal 路径；1.2 portal 页面 HMR 在该入口下正常）。功能 2：agents-launcher 起 web 时默认同起 portal（2.1 各 workspace 默认包含 portal 服务，监听 :10002；2.2 web 启动自动获得反代目标）。非范围：生产部署形态、portal 并入 jsy-web 构建、portal 独立入口（:10002 直连）形态变更。Preserve：未注入 PORTAL_DEV_TARGET 时 jsy-web 行为与现行完全一致；portal 直连 :10002 行为不变。
- 过程: 会话两轮讨论（404 根因定位 → 方案 A → local env 机制）后，用户拍板「请你去处理吧，默认在起 web 的时候也启动 portal」。
- 引用: [ROUND-002, ROUND-003]

## DEC-003

- 描述: jsy-web 以 PORTAL_DEV_TARGET 环境变量驱动的条件反代条目。
- 内容: `createServerProxy()`（packages/jsy-web/vite.home.config.ts:1057）的 proxy 表在 `process.env.PORTAL_DEV_TARGET` 存在时追加条目 `${serverPrefix}/portal` → `{ target, secure:false, changeOrigin:true, ws:true }`；不存在时表结构与现行完全一致。可行性依据：`@jsy/web-dev-server` 入口（lib/config.js:4）模块加载即把 `.env.local` 全量写入 `process.env`，vite.home.config.ts:2 已 import 该包；同模式先例 `DEV_SERVER_PORT`（lib/env.js:13）与 `AGENTS_LOCAL_SRC`（vite.home.config.ts:41）。
- 过程: 用户在「local xxx 方案」讨论中确认走 `.env.local`/env 注入模式，个人配置不入 git。
- 引用: [ROUND-004]

## DEC-004

- 描述: portal dev server HMR 客户端直连自身端口。
- 内容: `packages/jsy-portal-react/vite.config.ts` 的 `server` 增加 `hmr: { clientPort: devServerPort }`。`devServerPort` 仍由 `VITE_DEV_SERVER_PORT` 驱动（vite.config.ts:53，默认 10001，launcher 注入 10002）。直连 :10002 时 clientPort 等于页面端口、为无操作；经 :10001 反代访问时 HMR ws 直连 :10002，避免与 jsy-web 自身 HMR 争抢 :10001 路径。
- 过程: 方案 A 讨论中确认，依据为 Vite HMR 客户端默认连接页面所在端口的行为。
- 引用: [ROUND-005]

## DEC-005

- 描述: agents-launcher 注册 portal 服务并默认纳入各 workspace，web 启动注入反代目标。
- 内容: ① `lib/ports.mjs:1` PORTS 增加 `portal: 10002`；② `lib/service-adapters.mjs` ADAPTER_CAPABILITIES 与 registry 增加 portal（lifecycle service、supportsIdentity，镜像 web adapter 的 start/stop/status）；③ 新增 `portal-cli.mjs`：start 以 `pnpm --filter @jsy/portal-react dev`（cwd=WEB_DIR）拉起，env 注入 `VITE_DEV_SERVER_PORT=10002` / `USER_CLIENT=localDebugger`（与 web 仓现行 .env.local 一致）/ `BROWSER=none`；④ `web-cli.mjs` start 的 spawn env 追加 `PORTAL_DEV_TARGET=http://127.0.0.1:10002`；⑤ `agents-launcher.yml` workspaces ui/agents/full 末尾追加 portal，services 增加 portal（adapter: portal，lifecycle: service，无 depends_on）。
- 过程: 用户明确「默认在起 web 的时候，也启动 portal」。
- 引用: [ROUND-006]

## DEC-006

- 描述: 验证标准与发布约束。
- 内容: 验证：`curl :10001/decision/portal/home/` 200、`curl :10001/decision/home/` 200、`curl :10002/decision/portal/home/` 200、launcher 单测（node --test）全绿。约束：不动 `plugin/metadata.json` 版本号；插件源码改动后跑 `node scripts/package.platform.mjs` 并与源码同 commit；commit 后询问用户再 push；fx-data-web 改动在基于 release 分支的新 worktree 实施，nocode-evolve 改动在独立 worktree 实施。
- 过程: 仓库 CLAUDE.md 规则 1/2 与用户全局 worktree 约定。
- 引用: [ROUND-006]

# ROUND

## Event 1 — classification

- source: devflow Step 2
- detail: 证据=请求新增外部可观察行为（launcher 多一个常驻服务；:10001 多一条可用路由）；rejected=bug（无被违背的先前预期）、refactor（行为有新增）；result=feat
- decisionImpact: [DEC-001]

## ROUND-002 — closed

### 背景

用户截图反馈 `localhost:10001/decision/portal/home/` 404。代码证据：`rewriteHomeHtml`（vite.home.config.ts:209-246）只覆盖 home/application/complex-report/corp/shared/agent/mcp，无 portal 分支；proxy 表（vite.home.config.ts:1077-1164）亦无 `/decision/portal` 条目。portal 是独立 vite 应用（packages/jsy-portal-react），dev base=`${serverPrefix}/portal/home/`（其 vite.config.ts:56）。

### 问题

:10001 同源入口的功能边界是什么？

### 方案

功能 1（单入口同源：反代 + HMR 可用）+ 功能 2（launcher 默认携带 portal）；非范围：生产部署、构建合并、portal 独立入口变更。

### 回答

用户两轮讨论后确认方案 A，并明确「默认在起 web 的时候也启动 portal」→ DEC-002。

## ROUND-003 — closed

### 背景

产品上半（范围、功能树、非范围、preserve）已在 ROUND-002 收敛。

### 问题

产品上半是否确认，可以进入开发下半？

### 方案

确认，进入开发下半（jsy-web 反代 / portal HMR / launcher 服务三个挂点）。

### 回答

用户确认（「请你去处理吧」）→ 产品上半锁定，DEC-002 生效。

## ROUND-004 — closed

### 背景

jsy-web proxy 表为硬编码（vite.home.config.ts:1077-1164），无扩展点；`@jsy/web-dev-server` 入口模块加载即执行 `loadDevServerEnvFiles()`（lib/config.js:4 → lib/loadDevEnv.js:21-45）把 `.env.example`+`.env.local` 写入 process.env；`.env.local` 被根 .gitignore `*.local` 忽略；`fd-biz.local.json` 实为 git 跟踪文件（git ls-files 验证），不是 local 模式。

### 问题

jsy-web 的反代挂点以什么形式开放，个人配置如何不进 git？

### 方案

proxy 表加 `process.env.PORTAL_DEV_TARGET` 条件条目（committed 通用 hook），值由 launcher env 或 `.env.local` 注入（gitignored）。

### 回答

用户确认走 env/`.env.local` 模式 → DEC-003。

## ROUND-005 — closed

### 背景

portal dev 端口由 `VITE_DEV_SERVER_PORT` 驱动（vite.config.ts:53，默认 10001 与 jsy-web 冲突）；页面经 :10001 打开时 Vite HMR 客户端默认连页面端口，会撞上 jsy-web 的 HMR ws。

### 问题

portal 的端口与 HMR 如何适配双入口（:10001 反代 / :10002 直连）？

### 方案

launcher 注入 `VITE_DEV_SERVER_PORT=10002`；portal config 加 `hmr: { clientPort: devServerPort }`，两种入口下 HMR 均直连 portal 自身端口。

### 回答

用户确认 → DEC-004。

## ROUND-006 — closed

### 背景

launcher 证据：PORTS 单源（lib/ports.mjs:1）；adapter registry 形状（lib/service-adapters.mjs:8-13, 107-124）；web-cli start 已有 spawn env 注入先例 `BROWSER=none`（web-cli.mjs:111-118）；topology 校验 workspace 引用的 service 必须存在（lib/topology.mjs validateTopology）；portal package 有 `dev: vite` script，web 根 dev 为 `pnpm --filter @jsy/web dev`；web 仓现行 .env.local `USER_CLIENT=localDebugger`。

### 问题

launcher 以什么拓扑携带 portal，env 注入哪些值？

### 方案

新 portal-cli + registry 注册 + 三 workspace 默认包含；portal 注入 VITE_DEV_SERVER_PORT/USER_CLIENT/BROWSER，web 注入 PORTAL_DEV_TARGET。

### 回答

用户确认「默认在起 web 的时候，也启动 portal」→ DEC-005、DEC-006。

## ROUND-007 — closed

### 背景

design.md 全量基线已按 DEC-002~006 写出（功能树、开发下半两功能块、impacted files、DES-001~006、覆盖表）。

### 问题

确认整个设计基线并 Handoff 到 Plan（dev-plan）？

### 方案

确认基线：DES-001~006 全量生效，Open=[]，路线 Feat → Plan → Env（双 worktree）→ Build → Verify。

### 回答

用户经结构化确认选择「确认，开始实施」：DES-001~006 全量生效，Open=[]，worktree 默认（web 仓基于 release 新建 / 插件仓独立），Handoff 到 Plan。
## Event 2 — stage-transition

- source: current Handoff
- detail: dev-design -> Plan
- decisionImpact: none

## Event 3 — plan-confirmed

- source: 用户结构化确认（AskUserQuestion）
- detail: 5 个 Task（Task 1 portal 服务注册 → Task 2 web 注入反代目标 → Task 5 文档与发布物同步；Task 3/4 web 仓并行独立）+ 执行模式 executing 获确认；Plan 路径 docs/dev/3dot141/260817-01-portal-same-origin-dev/portal-same-origin-dev-plan.md
- decisionImpact: none

## Event 4 — stage-transition

- source: current Handoff
- detail: Plan -> Env
- decisionImpact: none

## Event 5 — stage-transition

- source: current Handoff
- detail: Env -> Build。工作区 A（nocode-evolve）=/Users/yes365/AI/nocode-evolve-feat_portal-same-origin-dev（base=本地 main HEAD a055b9e，用户确认；任务目录已转移并 diff 校验一致，本副本为权威 Log；.agents-personal 已 symlink；基线 159 pass / 0 fail）。工作区 B（fx-data-web）=/Users/yes365/Work/Source/fx-data-web-feat_portal-same-origin-dev（同名分支，base=origin/release dfb07a1e72，纯落后静默取远程最新；.env.local 已经 web-cli prepare 复制；pnpm 10.10.0 缓存命中；install 后台进行中）。base 选择过程：nocode 仓 ahead=1 经用户确认保留本地领先（ROUND 外结构化确认）。
- decisionImpact: none
## Event 6 — returned-evidence

- source: Build（5 个切片全部完成，executing）
- detail: |
  Task 1 completedDesignCovers=[DES-003]，changedFiles=[lib/ports.mjs, portal-cli.mjs(新), lib/service-adapters.mjs, agents-launcher.yml, lib/ports.test.mjs, lib/service-adapters.test.mjs, portal-cli.test.mjs(新), lib/topology.test.mjs, dev-orchestrator.test.mjs]，evidence=red(3 文件失败)→green 12/12→全量 165/0。中偏差：topology.test/dev-orchestrator.test 两个文件断言更新属 DES-003 直接蕴含，plan 文件清单遗漏，已记录。
  Task 2 completedDesignCovers=[DES-004]，changedFiles=[web-cli.mjs, web-cli.test.mjs]，evidence=red(1 fail)→green 17/17。
  Task 3 completedDesignCovers=[DES-001, DES-006]，changedFiles=[fx-data-web packages/jsy-web/vite.home.config.ts]，evidence=改动前 rg 无 portal 条目(exit 1)+esbuild parse OK；行为 curl 按 plan 留 Verify。
  Task 4 completedDesignCovers=[DES-002, DES-006]，changedFiles=[fx-data-web packages/jsy-portal-react/vite.config.ts]，evidence=改动前 rg 无 hmr+esbuild parse OK+portal-cli 起服 curl :10002/decision/portal/home/=200+stop 后端口释放。
  Task 5 completedDesignCovers=[DES-003 文档]，changedFiles=[references/web.md + 四平台生成物]，evidence=package.platform.mjs --check OK。
  Build 独立验证：双仓真实 diff 已读（范围无溢出）、占位符扫描无命中、plugin/metadata.json 未触碰、web 仓 status 仅预期 2 文件。NOTICED BUT NOT TOUCHING：worktree B 的 IDE TS 模块解析噪声（workspace 链接未索引 + 文件原有 implicit any，与改动无关）；web worktree setup 首次 install 未完成链接（pnpm install 重跑 8.2s 修复）；service-adapters.mjs options 参数 unused 为存量。
- decisionImpact: none
## Event 7 — returned-evidence

- source: Verify（fresh evidence，2026-08-17，工作区 B @ feat/portal-same-origin-dev）
- detail: |
  端口替代说明：:10001 被用户 release 实例占用（不动），本任务实例用 DEV_SERVER_PORT=10003（worktree B 的 gitignored .env.local），机制等价，DES 文本 :10001 为默认端口语义。
  | DES ID | Result | Evidence type | Evidence |
  |---|---|---|---|
  | DES-001 | pass | integration | web-cli 起服后 `curl :10003/decision/portal/home/`=200、`.../src/main.tsx`=200（HTTP 反代与模块加载均通；ws 透传为配置级 ws:true，portal 在 /portal 前缀下无 ws 端点无可测流量） |
  | DES-002 | pass | integration | 直连 `curl :10002/decision/portal/home/`=200；经反代取 `@vite/client` 含 10002（clientPort 生效）；页面 base 引用 `/decision/portal/home/...` 完整 |
  | DES-003 | pass | test+integration | launcher 全量 165 pass/0 fail（dry-run startOrder 含 portal）；portal-cli start→:10002 200、stop→端口释放 |
  | DES-004 | pass | test+integration | web-cli.test 17/17（env 断言）；对照实验唯一变量=PORTAL_DEV_TARGET 注入（无 env 404 / 有 env 200） |
  | DES-005 | pass | test+integration+build | 三 URL 200（:10003 替代）；165/0；`package.platform.mjs --check` OK |
  | DES-006 | pass | integration+inspection | 无 env 裸 pnpm dev（改动后代码）`:10003/decision/portal/home/`=404、home=200；阴性对照：用户未改动 :10001 实例同路径=404；portal 直连 200 不变；git status 无 plugin/metadata.json |
  事故与恢复：Verify 收尾时 `web-cli.mjs stop` 按 PORTS.web=10001 杀端口，误杀用户在 :10001 的 release 实例（本任务实例在 10003 未被停）——已按原方式（fx-data-web-release, JSY_DEV_MODE=vite pnpm dev）重启恢复，`:10001/decision/home`=200；ego Helper 网络进程同被波及，浏览器进程自愈（pgrep 仍在）。NOTICED BUT NOT TOUCHING：web 域 stop 按固定端口杀法在实例端口被 DEV_SERVER_PORT 挪开后会误杀占用该端口的他人进程，web-cli stop 端口参数化留作后续候选。
- decisionImpact: none
## Event 8 — returned-evidence

- source: Land（用户拍板：nocode 直接 push；fx-data-web 经 bkt 建 PR）
- detail: |
  A 仓（nocode-evolve）：commit 3f46b93（39 项：skills/ 源码+测试+文档 + 四平台生成物 + docs/dev 任务文档），push -u origin feat/portal-same-origin-dev ✓，worktree 与分支保留。
  B 仓（fx-data-web）：commit f278c49ea7（仅 2 个 vite config；commitlint 要求 #none 占位符，首次 message 被拒后按规则重提）；push -u origin（~harrison fork）✓；PR #8237（~harrison/fx-data-web → FXDATA/fx-data-web，target release）已建，12 个默认 reviewer 全部加上（raw GET 验证），pr-check 定时监控已启动（task bnoiteaii，每 5min，宿主存活期间有效）。
  未决：PR #8237 待评审合并；合并后需三件套清理（双 worktree + 本地分支 + 远程分支）——届时走补清/land。后续候选（NOTICED）：web-cli stop 端口参数化（Event 7 事故根因）；portal-cli vite 缓存清理（Review S1）；四 CLI 骨架收敛（Review S2）。
- decisionImpact: none


# Handoff

```yaml
From: Env
To: Build
ConfirmedBy: ROUND-007
Reason: 双 worktree 就绪（Event 5），进入实现
Read:
  design: ./design.md
  plan: ./portal-same-origin-dev-plan.md
  designIds: [DES-001, DES-002, DES-003, DES-004, DES-005, DES-006]
Preserve: [DES-006]
Open: []
```
