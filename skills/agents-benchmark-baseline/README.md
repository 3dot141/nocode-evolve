# agents-benchmark-baseline

本地起一套「指定版本」的隔离基准环境，用于对照测试。

## 为什么有这个 skill

scene benchmark 要做 baseline vs feat 的成对对照，但 baseline 数据此前只能跑在 work 远程环境（环境不同、任务分布不齐、无法归因）。本地起一套隔离的基准环境是更扎实的做法——代价是这套编排有 10 个容器、6 个只在容器形态下才暴露的坑。

2026-09-09 首次手工趟通（见 fx-data-agents 仓 `docs/work-logs/tasks/2026-09-09/harrison/03-baseline-container-group.md`），本 Skill 是那次经验的固化。

## 与 agents-launcher 的边界

| | agents-launcher | agents-benchmark-baseline |
|---|---|---|
| 目标 | 起主开发栈 | 起隔离的基准环境 |
| 底座 | 共享（现有 PG/MinIO 等） | 独立（`$BASELINE_STATE_DIR` 卷 + 独立端口） |
| fx-data-server | 宿主机 bootRun | 容器（harbor 镜像） |
| fx-data-agents | 宿主机 tsx watch | 容器（本地构建镜像） |
| 用途 | 日常开发 | 对照测试 / benchmark 基准 |

两者互不干扰：可以同时存在（开发栈 8070/8081，基准环境 8071/8082）。

## 资产自包含

编排资产全部在 `assets/` 下，**不依赖任何外部仓**：

| 资产 | 来源 |
|---|---|
| `docker-compose.baseline.yml`、`start-baseline.sh`、`Dockerfile.local`、`config/*` | 本 skill 原创 |
| `docker-init/*` | 复制自 fx-data-server 仓的 `docker-init/`（PG/MinIO/RabbitMQ/ES 初始化脚本） |

`docker-init/` 是复制而非引用——上游改了要手动同步。若上游有实质变更，比对 fx-data-server 仓的 `docker-init/` 后更新副本。

运行时数据（数据卷、端口分配）落在 `$BASELINE_STATE_DIR`（默认 `~/.cache/agents-benchmark-baseline`），**不进 skill 仓**。

## 设计取舍

- **单套而非多套**：容器名与端口写死单套，换版本 = 停旧的起新的。多套并存的参数化留到确有需要时再做。
- **不管观测面补丁**：`sessionTraceExport` 由代码发布流程负责。Skill 只管起环境。
- **不管 fixture**：场景 Agent / 知识卡 / 工作区数据由使用者自理，Skill 明确报告"当前是空库"。
- **不跑 benchmark**：到「环境可用 + 接入信息」为止。

## 踩过的坑

6 个坑的现象/根因/解法记录在 `references/troubleshooting.md`，编排侧已修复（见本 skill 的 `assets/docker-compose.baseline.yml` / `assets/start-baseline.sh`）。

## Changelog

- 2026-09-09：初版。从 260909 会话的实战经验提取。
