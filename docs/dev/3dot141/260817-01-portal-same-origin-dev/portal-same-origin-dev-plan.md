# :10001 同源联调 web + portal Implementation Plan

**Design Log**: /Users/yes365/AI/nocode-evolve/docs/dev/3dot141/260817-01-portal-same-origin-dev/design.log.md
**Design Doc**: /Users/yes365/AI/nocode-evolve/docs/dev/3dot141/260817-01-portal-same-origin-dev/design.md
**Design Confirmation**: ROUND-007
**Execution**: executing

## Dependency graph

```text
nocode-evolve 仓（worktree A）          fx-data-web 仓（worktree B，基于 release）
┌─────────────────────────────┐        ┌─────────────────────────────┐
│ Task 1 portal 服务注册       │        │ Task 3 jsy-web 条件反代      │
│ (PORTS/portal-cli/adapter/  │        │ (DES-001)                   │
│  yml/单测)                   │        │ Task 4 portal hmr.clientPort │
│      ↓                      │        │ (DES-002)                   │
│ Task 2 web 注入反代目标      │        │  （3/4 相互独立）            │
│ (DES-004)                   │        └──────────────┬──────────────┘
│      ↓                      │                       │
│ Task 5 文档 + package 同步   │                       │
└──────────────┬──────────────┘                       │
               └──────────┬───────────────────────────┘
                          ↓
              Verify 阶段（DES-005 三 URL curl + 全量单测；
              需 worktree B pnpm install + .env.local prepare 后由
              launcher 起 web+portal 实测）
```

Task 1→2 依赖：`PORTAL_DEV_TARGET` 的值引用 `PORTS.portal`（单源）。两仓之间无代码依赖，可并行；Verify 依赖两仓全部就绪。

## Tasks

## Task 1 — launcher 注册 portal 服务（PORTS / portal-cli / adapter / yml / 单测）

**Depends on**: none
**designCovers**: DES-003, DES-005
**Purpose**: launcher 的 ui/agents/full workspace 默认启动 portal 服务于 :10002，status/stop 与既有服务同构。

**Files / bounded search area**
- Modify: `skills/agents-launcher/lib/ports.mjs` — PORTS 增加 `portal: 10002`
- New: `skills/agents-launcher/portal-cli.mjs` — start/killCommands/status（镜像 web-cli.mjs:111-125, 47-50）
- Modify: `skills/agents-launcher/lib/service-adapters.mjs` — capabilities + registry + services 默认值
- Modify: `skills/agents-launcher/agents-launcher.yml` — 三 workspace 末尾加 portal；services 增加 portal
- Test: `skills/agents-launcher/lib/ports.test.mjs:6`、`lib/service-adapters.test.mjs:48`
- Test: `skills/agents-launcher/portal-cli.test.mjs`（NEW）

### Test first

- Add or update: `ports.test.mjs` deepEqual 增加 `portal: 10002`；`service-adapters.test.mjs` ADAPTER_NAMES 增加 `'portal'`；新建 `portal-cli.test.mjs` 断言 start 的 spawn 参数（cmd/args/env 三键）与 kill/status
- Expected failure before implementation: `PORTS` 缺 portal 键 deepEqual 失败；ADAPTER_NAMES 缺 `'portal'` 失败；portal-cli 模块不存在 import 失败
- Command: `node --test skills/agents-launcher/lib/ports.test.mjs skills/agents-launcher/lib/service-adapters.test.mjs skills/agents-launcher/portal-cli.test.mjs`

### Implement

- `PORTS` 增加 `portal: 10002`
- `portal-cli.mjs`：`start({ webDir, spawn = spawnPrefixed, log })` → `spawn('portal','pnpm',['--filter','@jsy/portal-react','dev'], { cwd: webDir, env: { ...process.env, VITE_DEV_SERVER_PORT: String(PORTS.portal), USER_CLIENT: 'localDebugger', BROWSER: 'none' } })`；start 不等待健康（契约同 web-cli.mjs:4-5）；`killCommands`/`status` 镜像 web 域、端口取 `ports.portal`
- `service-adapters.mjs`：`ADAPTER_CAPABILITIES` 增加 `portal: { lifecycle:'service', supportsIdentity:true }`；registry 增加 portal（start/stop/status 镜像 web 条目）；`services` 默认参数增加 `portal: portalCli`
- `agents-launcher.yml`：`ui`/`agents`/`full` 末尾追加 `portal`；services 增加 `portal: { adapter: portal, lifecycle: service }`（无 depends_on）
- Preserve：不改动既有四服务的任何行为（DES-006）

### Verify

- Command: `node --test 'skills/agents-launcher/**/*.test.mjs'`
- Expected: 全绿，含新 portal 断言

### Rollback / checkpoint

n/a — 独立 worktree 内新文件为主，回滚=丢弃分支；无共享状态变更

## Task 2 — web 启动注入 PORTAL_DEV_TARGET

**Depends on**: Task 1
**designCovers**: DES-004, DES-005
**Purpose**: 经 launcher 启动的 web 进程 env 含 `PORTAL_DEV_TARGET=http://127.0.0.1:10002`；手动 `pnpm dev` 不含。

**Files / bounded search area**
- Modify: `skills/agents-launcher/web-cli.mjs` — start 的 spawn env（web-cli.mjs:111-118）
- Test: `skills/agents-launcher/web-cli.test.mjs` — 新增 env 断言

### Test first

- Add or update: `web-cli.test.mjs` 新增用例：注入 fake spawn 捕获 env，断言 `PORTAL_DEV_TARGET === 'http://127.0.0.1:10002'`
- Expected failure before implementation: env 中无该键，断言失败
- Command: `node --test skills/agents-launcher/web-cli.test.mjs`

### Implement

- start env 字面量追加 `PORTAL_DEV_TARGET: \`http://127.0.0.1:${PORTS.portal}\``（web-cli.mjs 已 import PORTS，:16）
- Preserve：`JSY_DEV_MODE`/`BROWSER` 行为不变；clean 顺序不变（web-cli.test.mjs:151 既有用例须保持绿）

### Verify

- Command: `node --test skills/agents-launcher/web-cli.test.mjs`
- Expected: 全绿

### Rollback / checkpoint

n/a — 单行 env 追加，回滚=revert

## Task 3 — jsy-web 条件反代条目

**Depends on**: none（与 Task 1/2 跨仓独立；联调验证在 Verify 阶段汇合）
**designCovers**: DES-001, DES-006, DES-005
**Purpose**: `PORTAL_DEV_TARGET` 非空时 :10001 反代 `${serverPrefix}/portal/**`；为空时 proxy 表与现行逐项一致。

**Files / bounded search area**
- Modify: `packages/jsy-web/vite.home.config.ts` — createServerProxy()（:1057-1166）

### Test first

- jsy-web 无 vite config 单测设施，以客观改动前检查替代：改动前 proxy 表无 portal 条目（`rg -n "portal" packages/jsy-web/vite.home.config.ts` 无命中）；worktree B 起 dev server 后 `curl -s -o /dev/null -w '%{http_code}' :10001/decision/portal/home/` = 404
- Expected failure before implementation: 404（条目不存在）

### Implement

- `createServerProxy()` 函数体新增 `const portalDevTarget = process.env.PORTAL_DEV_TARGET;`
- proxy 对象字面量尾部（jdyProxyEntries 展开之后）追加：
  `...(portalDevTarget ? { [\`${serverPrefix}/portal\`]: { target: portalDevTarget, secure: false, changeOrigin: true, ws: true } } : {})`
- Preserve：无 env 时展开为空对象，proxy 表逐项与现行一致（DES-006）；既有条目顺序与内容不触碰

### Verify

- Command: 注入 `PORTAL_DEV_TARGET=http://127.0.0.1:10002` 起 dev server，`curl :10001/decision/portal/home/`（portal 已起 → 200；未起 → 502，证明条目已注册）
- Command: 不注入 env 起 dev server，`curl :10001/decision/portal/home/` = 404（DES-006）
- Expected: 三种结果分别符合

### Rollback / checkpoint

n/a — 单文件条件展开，回滚=revert

## Task 4 — portal HMR 直连自身端口

**Depends on**: none
**designCovers**: DES-002, DES-006, DES-005
**Purpose**: portal 页面经 :10001 反代或 :10002 直连打开，HMR 均可用。

**Files / bounded search area**
- Modify: `packages/jsy-portal-react/vite.config.ts` — server 块（:113-144）

### Test first

- 无单测设施，以客观检查替代：改动前 `rg -n "hmr" packages/jsy-portal-react/vite.config.ts` 无命中
- Expected failure before implementation: 无 hmr 配置（经反代打开时 HMR client 会连 :10001）

### Implement

- server 块增加 `hmr: { clientPort: devServerPort }`（devServerPort 定义于 :53）
- Preserve：直连 :10002 时 clientPort 等于页面端口，行为不变（DES-006）；base/proxy/open 不触碰

### Verify

- Command: `VITE_DEV_SERVER_PORT=10002 pnpm --filter @jsy/portal-react dev`，`curl :10002/decision/portal/home/` = 200
- Expected: dev server 正常启动，页面可访问；hmr 配置不引发启动错误

### Rollback / checkpoint

n/a — 单行配置，回滚=revert

## Task 5 — launcher 文档与发布物同步

**Depends on**: Task 1, Task 2
**designCovers**: DES-003, DES-005
**Purpose**: skill 文档反映 portal 服务；双平台发布物与源码一致。

**Files / bounded search area**
- Modify: `skills/agents-launcher/references/web.md` — portal 端口/入口/停止说明
- Generated: `plugins/claude/nocode/`、`plugins/codex/nocode/` 等（脚本产出，禁手改）

### Test first

- Add or update: 无（文档与生成物同步，以脚本 --check 为客观检查）
- Expected failure before implementation: `node scripts/package.platform.mjs --check` 报漂移

### Implement

- web.md「启动与健康」节补充 portal :10002 与 :10001 同源入口说明
- `node scripts/package.platform.mjs` 重新生成发布物
- Preserve：不动 `plugin/metadata.json` 版本号（DES-006）

### Verify

- Command: `node scripts/package.platform.mjs --check`
- Expected: exit 0 无漂移

### Rollback / checkpoint

n/a — 生成物随源码同 commit，回滚=revert

## DES coverage

| DES ID | Task / Verify | Reason |
|---|---|---|
| DES-001 | Task 3 | implementation |
| DES-002 | Task 4 | implementation |
| DES-003 | Task 1, Task 5 | implementation（文档同步随 Task 5） |
| DES-004 | Task 2 | implementation |
| DES-005 | Task 1/2 单测 + Task 3/4/5 验证命令 + Verify 阶段三 URL curl | verification（跨仓汇合证据属 Verify） |
| DES-006 | Task 3/4 实现内 preserve + Task 3 无 env 验证命令 | preserve |

## Checkpoints and rollback

- 两仓各自独立 worktree + 独立 commit：worktree B（fx-data-web，Task 3/4）一个 commit；worktree A（nocode-evolve，Task 1/2/5 + 生成物）一个 commit。
- Verify 阶段前置条件：worktree B 完成 `pnpm install` 与 `web-cli prepare`（.env.local 从主仓复制），之后由 launcher 起 web+portal 实测三 URL。
- 全部回滚成本 = 丢弃两个 worktree；无共享状态、无版本号变更、无主仓写入。
