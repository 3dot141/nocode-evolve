# server 域

仅在目标包含 Docker 基础设施或 Spring 服务时读取。本文件负责 server 仓路径、固定 Docker 启动、ANTLR、GraalVM、Spring、健康检查与停止。

## 仓与固定脚本

FX_SERVER_DIR 必须指向包含 gradlew 的主仓或 worktree。server 域有代码改动时使用同分支 worktree；没有 server 改动时可复用 base worktree。

Docker 启动脚本随 agents-launcher 发布：

- 分支名包含 persist：使用 docker/persist.sh，镜像前缀 prod。
- 分支名包含 release：使用 docker/release.sh，镜像前缀 test。
- 其它分支：使用 docker/dev.sh，镜像前缀 dev。

launcher 根据 FX_SERVER_DIR 执行 git branch --show-current 选择脚本，不读取或改写目标仓的 dockerstart.sh，也不生成临时脚本。需要显式覆盖时可设置 FX_DOCKER_PROFILE=persist|release|dev。

脚本将容器分为两层：

- 公用层：Postgres、Redis、Mongo、RabbitMQ、MinIO、Elasticsearch。只执行 compose up，不 pull，已有容器和数据卷直接复用。
- 分支层：jsy-webui、sync、image-exporter。每次启动只 pull 这三类镜像，并按当前 profile 重建；切换 profile 时清理旧前缀容器。

Compose 中的 fx-data-agents 不由 Docker 层启动，由 agents 域单独管理，避免抢占 :8070。

私有仓认证使用执行环境中的 HARBOR_PASSWORD / HARBOR_USERNAME；未提供密码时复用本机已有 Docker 登录态。禁止把凭证写入脚本或日志。

## Docker 后置检查

固定脚本执行后，server 域等待 PostgreSQL :5432、MinIO :9000、Elasticsearch :9200（yellow/green），随后补 RabbitMQ queue、数据库权限和 ES 本地磁盘阈值设置。健康失败时保留 Docker 现场，不继续启动 Spring。

## Spring 准备

新 server worktree 首次使用时执行：

    FX_SERVER_DIR=<server-worktree> node <插件根>/skills/agents-launcher/server-cli.mjs prepare

它会生成 gitignored 的 ANTLR 类、检测 GraalVM，并解析兼容的 JDK 21。server-cli 启动 Spring 时负责 GraalVM 容器降级、GC/JVMCI 兼容 patch、localhost gRPC 代理清理、Polars 回连地址和 OPENPROJECT_ISOPEN=false。

Spring 日志位于 <FX_SERVER_DIR>/dev-start.log。server worktree 可能出现 .java-home、.dev-start.pid、日志文件和 build.gradle.kts patch，不要误提交。

## 状态与停止

- Spring 监听 :8081，状态统一由 orchestrator --status 查询。
- 停 Spring 使用 server-cli，覆盖 Gradle daemon、容器降级和端口残留。
- Docker 默认不停；只有用户明确要求停 Docker 时才执行 docker compose down。
- 单独重启 sync 时必须连带重启 sync-polars-localhost，它们共享网络命名空间。

## 汇报

至少汇报 server 路径、branch、来源类型、固定 Docker profile、Docker/Spring 健康结果、ANTLR prepare 状态和本地副作用。
