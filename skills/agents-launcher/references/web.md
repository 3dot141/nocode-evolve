# web 域

仅在目标包含 fx-data-web Vite 服务时读取。本文件负责 web 仓路径、联调环境、包管理器、对齐、启动与停止。

## 仓与标志文件

`FX_WEB_DIR` 必须指向包含以下文件的主仓或 worktree：

```text
packages/jsy-web/src/entry/config.ts
```

未显式设置时从 `FX_AGENTS_DIR` 同目录按同变体后缀推导（`fx-data-agents-release` → `fx-data-web-release`），须过上述标志文件校验；混搭变体时显式设置。

## `.env.local` 准备

web 依赖：

```text
packages/jsy-web/server/.env.local
```

worktree 内缺失时，从 web 主仓复制：

```bash
FX_WEB_DIR=<web-worktree> \
FX_WEB_FROM=<web-main> \
node <插件根>/skills/agents-launcher/web-cli.mjs prepare
```

这是 gitignored 的 worktree 局部文件，已存在则不覆盖，可自动执行。

随后让 web 指向本轮 agents 源码：

```bash
FX_WEB_DIR=<web 路径> \
FX_AGENTS_DIR=<agents 路径> \
node <插件根>/skills/agents-launcher/web-cli.mjs env
```

web worktree/base worktree 可自动更新；修改 web 主仓 `.env.local` 属于共享状态，先确认并在汇报中列出待还原项。

## pnpm 检查

检查 web 锁定的 pnpm 版本是否存在于本机 corepack 缓存：

```bash
FX_WEB_DIR=<web 路径> \
node <插件根>/skills/agents-launcher/web-cli.mjs pkgmgr
```

- worktree 缓存缺失：可将 worktree `packageManager` patch 到本机已有版本，并在汇报中标明不要提交。
- 主仓缓存缺失：修改主仓 `package.json` 前必须确认。

## 跨仓对齐

web worktree 与 agents worktree 不在同一开发时间窗口时，跨仓 import 可能漂移。用：

```bash
FX_WEB_DIR=<web-worktree> \
node <插件根>/skills/agents-launcher/web-cli.mjs align <目标-sha>
```

只有用户明确同意时才能追加 `--reset`。禁止 reset 主仓和长期共享的 base worktree；挂载已有 feature 分支时，reset 还会冲掉该分支自身提交，默认不推荐。

## 启动与健康

- web Vite 监听 `:10001`。
- launcher 启动前会清理该 web worktree 的 Vite 预构建缓存。
- 访问入口：`http://localhost:10001/decision/home`。

## portal（jsy-portal-react，运营后台）

- portal 是同仓 `packages/jsy-portal-react` 下的独立 vite 应用，由 portal-cli 起在 `:10002`，三个 workspace（ui/agents/full）默认携带。
- web 启动 env 注入 `PORTAL_DEV_TARGET=http://127.0.0.1:10002`；jsy-web 的 vite 配置在该 env 存在时把 `/decision/portal/**` 反代到 portal——入口 `http://localhost:10001/decision/portal/home/`（同源，登录态与 API 代理复用 web 链路）。
- portal 直连入口 `http://localhost:10002/decision/portal/home/` 同样可用；HMR 两种入口均直连 `:10002`。
- portal 启动 env：`VITE_DEV_SERVER_PORT=10002`、`USER_CLIENT=localDebugger`、`BROWSER=none`（portal-cli 注入，无需手改 `.env.local`）。
- 状态与停止同 web：orchestrator `--status` 查询，portal-cli 域内杀法处理 `:10002`。

## 状态与停止

状态统一由 orchestrator `--status` 查询。停止由 `web-cli.mjs` 的域内杀法处理，不手写端口 kill。

## 汇报

至少汇报：

- `FX_WEB_DIR` 的路径、branch 和来源类型。
- `.env.local` 是否复制。
- `AGENTS_LOCAL_SRC` 当前指向。
- pnpm 是否 patch。
- 是否执行过对齐/reset。
- `:10001` 的状态与 PID。
