---
type: feat
status: confirmed
sourceLog: ./design.log.md
artifacts:
  design: ./design.md
---

# :10001 同源联调 web + portal — 设计基线

## 产品

### Opening panorama

```text
浏览器 :10001（唯一入口）
   │  /decision/home/**        → jsy-web 本地 MPA（现行，不变）
   │  /decision/portal/**      → 条件反代 → portal dev server :10002   [功能 1.1]
   │  /decision/v1|v2|platform → 反代 → Java 后端（现行，不变）
   └  portal HMR ws            → 浏览器直连 :10002（不经 :10001）       [功能 1.2]

agents-launcher（ui / agents / full 三个 workspace）
   ├─ web    :10001  现行服务，启动 env 追加 PORTAL_DEV_TARGET          [功能 2.2]
   └─ portal :10002  新服务，起 web 时默认携带                          [功能 2.1]

非范围：生产部署形态 / portal 并入 jsy-web 构建 / :10002 直连入口变更
```

### Function tree

- 功能 1 — `:10001` 单一入口同时访问 home 与 portal
  - 1.1 jsy-web 把 `${serverPrefix}/portal/**` 反代到 portal dev server（有 `PORTAL_DEV_TARGET` 才启用）
  - 1.2 portal 页面在 :10001 入口下 HMR 正常热更新
- 功能 2 — launcher 起 web 时默认带起 portal
  - 2.1 topology 的 ui / agents / full workspace 默认包含 portal 服务（:10002）
  - 2.2 web 启动自动获得 portal 反代目标（env 注入，无需手改 `.env.local`）

显式非范围：生产部署形态；portal 并入 jsy-web 构建体系；portal 独立入口（:10002 直连）的行为变更；非 launcher 手动启动场景的自动化（保留 `.env.local` 兜底约定）。

Preserve obligations：未注入 `PORTAL_DEV_TARGET` 时 jsy-web proxy 表与现行逐项一致（DES-006）；portal 直连 :10002 的 base、proxy、HMR 行为不变（DES-006）。

## 开发

### Opening panorama

```text
fx-data-web 仓（新 worktree，基于 release）
  packages/jsy-web/vite.home.config.ts      createServerProxy() +条件条目   [DES-001]
  packages/jsy-portal-react/vite.config.ts  server.hmr.clientPort           [DES-002]

nocode-evolve 仓（新 worktree）
  skills/agents-launcher/portal-cli.mjs     NEW  spawn/status/kill          [DES-003]
  skills/agents-launcher/lib/ports.mjs      PORTS.portal = 10002            [DES-003]
  skills/agents-launcher/lib/service-adapters.mjs  注册 portal adapter      [DES-003]
  skills/agents-launcher/web-cli.mjs        start env += PORTAL_DEV_TARGET  [DES-004]
  skills/agents-launcher/agents-launcher.yml     workspaces += portal       [DES-003]

验证：三 URL 200 + node --test 全绿 + package.platform.mjs 同步            [DES-005]
Handoff: Feat → Plan
```

### Architecture and flow

边界：fx-data-web 仓只持有「读 env 的能力」（通用 hook，无个人数据）；nocode-evolve 仓的 launcher 持有「env 的值与编排」。依赖方向：launcher →（spawn env）→ 两个 vite dev server；浏览器 → :10001 →（条件反代）→ :10002。失败与恢复：portal 未启动时访问 `/decision/portal/**` 得到 502（ECONNREFUSED），启动 portal 即恢复，不影响 home 域；portal 进程退出由 supervisor 按既有 service 生命周期处理。

### 功能 1 — :10001 同源入口

#### 流程图

```text
请求 :10001/decision/portal/home/
  → jsy-web middlewares（rewriteHomeHtml 不命中 portal，放行）
  → proxy 表匹配 `${serverPrefix}/portal` 前缀
      ├─ PORTAL_DEV_TARGET 存在 → 转发 http://127.0.0.1:10002（changeOrigin, ws）
      │     → portal vite 以 base=/decision/portal/home/ 正常 serve（无需 rewrite）
      └─ 不存在 → 无此条目，行为与现行一致（404）          [DES-006]
页面内 HMR client → ws://localhost:10002（clientPort）→ portal 自身 HMR   [DES-002]
```

#### 接口

##### External API / command / event — `GET /decision/portal/** via :10001` `[DES-001]`

- Kind and identity: HTTP 反代（页面 + 静态资源 + 源码模块 + ws upgrade）
- Defined at: `packages/jsy-web/vite.home.config.ts` `createServerProxy()`（vite.home.config.ts:1057）proxy 表新增条件条目
- Input: `${serverPrefix}/portal` 前缀的任意请求
- Output: 透传 portal dev server 响应
- Errors: portal 未启动 → 502；无 env → 条目不注册
- Guards: 仅 `process.env.PORTAL_DEV_TARGET` 非空时注册

##### Internal entry point — `createServerProxy` `[DES-001]`

- File: `packages/jsy-web/vite.home.config.ts`
- Current signature: `function createServerProxy(): UserConfig['server']`（vite.home.config.ts:1057）
- Target signature: 不变；函数体新增 `const portalDevTarget = process.env.PORTAL_DEV_TARGET;`，proxy 对象字面量尾部追加展开条件条目
- Implementation flow: 读 env → 存在则展开 `{ [\`${serverPrefix}/portal\`]: { target, secure:false, changeOrigin:true, ws:true } }`
- Behavior change: 仅 env 存在时多一条 proxy 前缀
- Failure and recovery: portal down → 单路径 502，home 域不受影响
- Evidence: vite.home.config.ts:1077-1164（现行 proxy 表）；lib/config.js:4 + lib/loadDevEnv.js:21-45（env 注入机制）；lib/env.js:13（DEV_SERVER_PORT 先例）

##### Internal entry point — portal `server.hmr` `[DES-002]`

- File: `packages/jsy-portal-react/vite.config.ts`
- Current signature: `server: { host, port: devServerPort, open, proxy }`（vite.config.ts:113-144）
- Target signature: `server` 增加 `hmr: { clientPort: devServerPort }`
- Implementation flow: 页面端口 ≠ devServerPort（经反代）时 HMR client 直连 devServerPort
- Behavior change: 直连 :10002 时 clientPort 等于页面端口，无操作
- Failure and recovery: 无新增失败面
- Evidence: vite.config.ts:53（devServerPort 来源）、:113（server 块）

#### 伪代码

```text
# jsy-web createServerProxy()
portalDevTarget = process.env.PORTAL_DEV_TARGET
proxy = { ...现行条目...,
          ...(portalDevTarget ? { [`${serverPrefix}/portal`]: {target: portalDevTarget, secure:false, changeOrigin:true, ws:true} } : {}) }

# portal defineConfig server
server = { host:'0.0.0.0', port: devServerPort, hmr: { clientPort: devServerPort }, open, proxy }
```

#### 问题

- （非阻塞）portal 未启动时 `/decision/portal/**` 返回 502 而非 404——语义上更准确（目标已配置但下游未就绪），不接受为阻断项。

### 功能 2 — launcher 默认携带 portal

#### 流程图

```text
orchestrator 解析 agents-launcher.yml（workspace 含 portal）
  → topology 校验 portal ∈ services ✓
  → registry.portal.start()
      → portal-cli.start({ webDir })
          spawn pnpm --filter @jsy/portal-react dev
          env: VITE_DEV_SERVER_PORT=10002, USER_CLIENT=localDebugger, BROWSER=none
  → registry.web.start()
      → web-cli.start({ webDir })
          spawn pnpm dev（jsy-web）
          env 追加 PORTAL_DEV_TARGET=http://127.0.0.1:10002      [DES-004]
  → status: tcpOpen(10002) / tcpOpen(10001)；stop: lsof kill 对应端口
```

#### 接口

##### Internal entry point — `PORTS` `[DES-003]`

- File: `skills/agents-launcher/lib/ports.mjs`
- Current signature: `export const PORTS = { agents: 8070, server: 8081, web: 10001 };`（ports.mjs:1）
- Target signature: 增加 `portal: 10002`
- Evidence: ports.mjs:1（端口单源注释见 web-cli.mjs:16）

##### Internal entry point — `createServiceAdapters` registry `[DES-003]`

- File: `skills/agents-launcher/lib/service-adapters.mjs`
- Current signature: `ADAPTER_CAPABILITIES`（service-adapters.mjs:8-13）+ registry web 条目（:107-124）
- Target signature: capabilities 增加 `portal: { lifecycle:'service', supportsIdentity:true }`；registry 增加 portal 条目（start → `portalCli.start({ webDir: repos.WEB_DIR })`；stop → `portalCli.killCommands({ ports })`；status → `normalizeStatus(portalCli.status({ ports, probes }))`）；`services` 默认参数增加 `portal: portalCli`
- Evidence: service-adapters.mjs:34-46（services 注入形状）、:107-124（web 镜像模板）

##### Internal entry point — `portal-cli.mjs`（NEW）`[DES-003]`

- File: `skills/agents-launcher/portal-cli.mjs`
- Target signature: `start({ webDir, spawn = spawnPrefixed, log }) → ChildProcess`（`spawn('portal','pnpm',['--filter','@jsy/portal-react','dev'], { cwd: webDir, env: { ...process.env, VITE_DEV_SERVER_PORT: String(PORTS.portal), USER_CLIENT: 'localDebugger', BROWSER: 'none' } })`）；`killCommands({ ports = PORTS })`（lsof tcp:ports.portal，镜像 web-cli.mjs:47-50）；`status({ ports = PORTS, probes })`（tcpOpen + pidOnPort，镜像 web-cli.mjs:120-125）
- Behavior change: 新文件，无存量行为变更
- Failure and recovery: start 不等待健康（契约同 web-cli.mjs:4-5），健康等待归 orchestrator
- Evidence: web-cli.mjs:111-125（start/status 模板）；portal package.json `"dev": "vite"`；web 根 package.json `"dev": "pnpm --filter @jsy/web dev"`（--filter 模式先例）

##### Internal entry point — `web-cli.start` `[DES-004]`

- File: `skills/agents-launcher/web-cli.mjs`
- Current signature: `start({ webDir, spawn, clean, log })`（web-cli.mjs:111-118），env 为 `{ ...process.env, JSY_DEV_MODE: 'vite', BROWSER: 'none' }`
- Target signature: env 追加 `PORTAL_DEV_TARGET: \`http://127.0.0.1:${PORTS.portal}\``
- Behavior change: jsy-web 在 launcher 启动下始终获得反代目标；手动 `pnpm dev`（无 env）行为不变
- Evidence: web-cli.mjs:111-118

##### Internal entry point — `agents-launcher.yml` `[DES-003]`

- File: `skills/agents-launcher/agents-launcher.yml`
- Current: workspaces `ui:[agents,web]` / `agents:[docker,agents,web]` / `full:[docker,agents,server,web]`；services 四个
- Target: 三 workspace 末尾追加 `portal`；services 增加 `portal: { adapter: portal, lifecycle: service }`（无 depends_on——portal 独立可起，API 经 :10001 反代链路）
- Evidence: agents-launcher.yml:8-44；lib/topology.mjs validateTopology（workspace 引用必须存在于 services）

#### 伪代码

```text
# portal-cli.start({webDir})
return spawn('portal', 'pnpm', ['--filter','@jsy/portal-react','dev'],
             { cwd: webDir,
               env: { ...process.env,
                      VITE_DEV_SERVER_PORT: String(PORTS.portal),
                      USER_CLIENT: 'localDebugger',
                      BROWSER: 'none' } })

# web-cli.start env
env = { ...process.env, JSY_DEV_MODE:'vite', BROWSER:'none',
        PORTAL_DEV_TARGET: `http://127.0.0.1:${PORTS.portal}` }
```

#### 问题

- （非阻塞）portal 直连 :10002 时其 API 代理指向 localDebugger 的 `http://127.0.0.1`，可用性取决于本地既有 80→Spring 约定，与本改动无关。
- （非阻塞）`USER_CLIENT=localDebugger` 为 launcher 注入的固定值，与 web 仓现行 `.env.local` 一致；未来若需跟随 web 侧 env，再单独立项。

### Impacted files（汇总索引）

```text
fx-data-web（新 worktree，基于 release）/
├── packages/jsy-web/vite.home.config.ts        (MODIFY)   [DES-001] ① createServerProxy 条件条目
└── packages/jsy-portal-react/vite.config.ts    (MODIFY)   [DES-002] ① server.hmr.clientPort

nocode-evolve（新 worktree）/
├── skills/agents-launcher/portal-cli.mjs            (NEW)      [DES-003] ① start ② killCommands ③ status
├── skills/agents-launcher/lib/ports.mjs             (MODIFY)   [DES-003] ① PORTS.portal
├── skills/agents-launcher/lib/service-adapters.mjs  (MODIFY)   [DES-003] ① capabilities ② registry ③ services 默认值
├── skills/agents-launcher/web-cli.mjs               (MODIFY)   [DES-004] ① start env 追加 PORTAL_DEV_TARGET
├── skills/agents-launcher/agents-launcher.yml       (MODIFY)   [DES-003] ① workspaces ② services.portal
├── skills/agents-launcher/references/web.md         (MODIFY)   [DES-003] ① portal 端口/入口文档
├── skills/agents-launcher/web-cli.test.mjs          (MODIFY)   [DES-005] ① PORTAL_DEV_TARGET 断言
├── skills/agents-launcher/portal-cli.test.mjs       (NEW)      [DES-005] ① start env ② kill/status
└── skills/agents-launcher/lib/service-adapters.test.mjs (MODIFY) [DES-005] ① portal 注册断言
```

### DES 清单

#### DES-001 — jsy-web 条件反代条目

- kind: behavior
- statement: `PORTAL_DEV_TARGET` 非空时，:10001 的 `${serverPrefix}/portal/**` 被反代到该目标（changeOrigin、ws 透传）；为空时 proxy 表与现行逐项一致。
- sourceDecisionIds: DEC-003

#### DES-002 — portal HMR 直连自身端口

- kind: behavior
- statement: portal 页面无论经 :10001 反代还是 :10002 直连打开，HMR client 均连接 portal 自身 devServerPort，热更新可用。
- sourceDecisionIds: DEC-004

#### DES-003 — launcher portal 服务

- kind: behavior
- statement: launcher 的 ui / agents / full workspace 默认启动 portal 服务于 :10002（env 注入 VITE_DEV_SERVER_PORT/USER_CLIENT=localDebugger/BROWSER=none），status/stop 与既有服务同构。
- sourceDecisionIds: DEC-005

#### DES-004 — web 启动注入反代目标

- kind: behavior
- statement: 经 launcher 启动的 web 进程 env 含 `PORTAL_DEV_TARGET=http://127.0.0.1:10002`；手动 `pnpm dev` 不含该值。
- sourceDecisionIds: DEC-005, DEC-003

#### DES-005 — 验证

- kind: verification
- statement: `curl :10001/decision/portal/home/`、`:10001/decision/home/`、`:10002/decision/portal/home/` 均 200；`node --test` launcher 相关测试全绿；`node scripts/package.platform.mjs --check` 通过。
- sourceDecisionIds: DEC-006

#### DES-006 — 零配置零变化

- kind: preserve
- statement: 未注入 `PORTAL_DEV_TARGET` 时 jsy-web 行为与现行一致；portal 直连 :10002 的 base/proxy/HMR 行为不变；不修改 `plugin/metadata.json` 版本号。
- sourceDecisionIds: DEC-002, DEC-003, DEC-004, DEC-006

### 覆盖表

| Decision ID | Design disposition | DES IDs / n/a reason |
|---|---|---|
| DEC-001 | n/a | 分类决策，不产生设计义务 |
| DEC-002 | required | DES-006（范围由 DEC-003/005 承载为 DES-001/003） |
| DEC-003 | required | DES-001, DES-004 |
| DEC-004 | required | DES-002 |
| DEC-005 | required | DES-003, DES-004 |
| DEC-006 | required | DES-005, DES-006 |
