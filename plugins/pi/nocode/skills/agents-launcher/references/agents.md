# agents 域

仅在目标包含本地 fx-data-agents 服务时读取。本文件负责 agents 仓路径、配置、启动、健康检查与停止。

## 仓与标志文件

`FX_AGENTS_DIR` 必须指向包含以下文件的主仓或 worktree：

```text
packages/server/conf/config.example.yaml
```

worktree 使用当前目标分支的 worktree；主仓启动使用用户指定的主仓现场。不要在主仓切分支。

## 配置准备

agents 依赖：

```text
packages/server/conf/config.yaml
```

worktree 内缺失时，从 agents 主仓复制：

```bash
FX_AGENTS_DIR=<agents-worktree> \
FX_AGENTS_FROM=<agents-main> \
node <插件根>/skills/agents-launcher/agents-cli.mjs prepare
```

这是 gitignored 的 worktree 局部文件，已存在则不覆盖，可自动执行。主仓缺失时不自动复制和填写敏感配置，报告缺失并让用户处理。

web 域启用时，launcher 会检查 agents CSS 产物；缺失时自动运行 `pnpm build:css`。

## 启动边界

- agents Hono 监听 `:8070`。
- 健康入口是 `/health`。
- 本地启动使用 `tsx watch`，修改 TS 文件通常不需要重启。
- agents 依赖 PostgreSQL `:5432` 和 MinIO `:9000`。

只起 agents 且依赖未就绪时，先加载 `server.md`，由 server 域准备 Docker；不要让 agents 静默等待到健康超时。

## worktree 与主仓 agents

worktree 改动只涉及 `packages/desktop` 时，可以复用已经运行的主仓 agents，因为后端不消费 desktop 源码。

worktree 改动包含以下任一目录时，必须使用 worktree agents：

```text
packages/server
packages/shared
```

如果主仓 agents 已在运行，替换它属于共享状态变更，先告知 PID 和影响，再让用户确认。

## 状态与停止

状态统一由 orchestrator `--status` 查询。

停止时必须杀 `tsx watch` 父进程，而不是只杀子 node；具体杀法已经内聚在 `agents-cli.mjs`，不要手写 `pkill`。

## 汇报

至少汇报：

- `FX_AGENTS_DIR` 的路径、branch 和来源类型。
- `config.yaml` 是既有还是从主仓复制。
- 是否替换了主仓 agents。
- `:8070` 的健康状态与 PID。
