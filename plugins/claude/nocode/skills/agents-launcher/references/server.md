# server 域

仅在目标包含 Docker 基础设施或 Spring 服务时读取。本文件负责 fx-data-server 仓路径、Docker 临时脚本、ANTLR、GraalVM、Spring、健康检查与停止。

## 仓与标志文件

`FX_SERVER_DIR` 必须指向包含以下文件的主仓或 worktree：

```text
gradlew
dockerstart.sh
```

server 域有代码改动时使用同分支 worktree。没有 server 改动时可复用 base worktree；使用 server 主仓会产生 `build.gradle.kts`、`.java-home`、PID 和日志等共享现场变化，必须在 launch plan 中明确。

## Agent 生成 Docker 临时脚本

Docker 启动规则来源是本轮目标仓当前的：

```text
<FX_SERVER_DIR>/dockerstart.sh
```

生成动作由 Agent 完成，不由 Node 程序做固定文本转换。

### Step 1 — 读取当前脚本

每次启动都重新完整读取目标脚本，不复用上一次生成物，不假设脚本结构与历史版本相同。

读取输出不得暴露凭证。遇到 `docker login` 时只保留“这里存在登录命令”的结构信息，隐藏用户名、密码、token 和 registry 参数。

### Step 2 — 理解并形成改写计划

先列出当前脚本的实际阶段，例如：

```text
准备 compose 文件
认证
计算 IMAGE_PREFIX
停止特定服务
pull
up
清理镜像
```

再按当前脚本形成临时版本，不从固定模板开始写。临时脚本必须以以下结构开头：

```bash
#!/usr/bin/env bash
set -euo pipefail
printf '%s' "${HARBOR_PASSWORD:?HARBOR_PASSWORD 未设置}" | docker login -u "${HARBOR_USERNAME:-develop}" --password-stdin harbor.jsydevelop.com
```

物理第一行保留 shebang；登录是严格模式启用后的第一条可执行命令。登录成功后，再继续按当前 `dockerstart.sh` 的原有顺序复刻。只有以下 launcher 规则允许改变：

1. 删除源脚本中完整的活动 `docker login` 命令；多行登录要整段删除，避免重复认证，也不把源凭证复制进临时脚本。
2. 保证启动前 pull 当前 Compose 中的最新镜像。
3. pull/up 的服务集合排除 `fx-data-agents`，本地 agents 由 agents 域启动。
4. 脚本任一关键命令失败必须停止。

除此之外，当前脚本的 compose 初始化、branch→`IMAGE_PREFIX` 映射、停止/删除服务、清理和其他前后处理必须保持原有顺序与语义。脚本结构不清楚时停止并向用户说明，不能猜测重写。

私有仓认证每次由临时脚本首条命令完成。`HARBOR_PASSWORD` 必须通过 launcher 的执行环境传入；`HARBOR_USERNAME` 可选，默认 `develop`。登录失败时脚本立即停止。禁止把密码、token 或带 `-p` 的明文登录命令写入 Skill、临时脚本或 Git，也禁止创建临时 credential helper、修改 Keychain 配置或保存凭证。

### Step 3 — 写临时脚本

先分配系统临时路径：

```bash
mktemp "${TMPDIR:-/tmp}/agents-launcher-docker-XXXXXX"
```

使用当前平台的文件编辑工具把理解后的完整脚本写入该路径；不要用 `cat`、heredoc、Python、Node、sed 或另一个生成脚本来制造它。

临时文件必须满足：

- 位于系统临时目录。
- 文件名以 `agents-launcher-docker-` 开头。
- UTF-8，无 BOM。
- 第一条可执行命令是上述 `docker login --password-stdin` 管道。
- 只包含 `HARBOR_PASSWORD` / `HARBOR_USERNAME` 变量引用，不包含任何明文凭证。
- 能通过 `bash -n <临时脚本>`。

### Step 4 — 交给 launcher

把路径和 Harbor 凭证环境变量一起传入 orchestrator：

```bash
HARBOR_PASSWORD=<从安全来源读取的密码> \
HARBOR_USERNAME=develop \
FX_DOCKER_START_SCRIPT=<临时脚本> \
node <插件根>/skills/agents-launcher/dev-orchestrator.mjs ...
```

不要把真实密码写进命令模板、日志或完成汇报；调用时使用当前执行环境中的安全值。

launcher 只做四件事：

1. 校验路径位于系统临时目录且命名正确。
2. 执行 `bash -n`。
3. 从 `FX_SERVER_DIR` 作为工作目录执行脚本。
4. 无论成功失败都删除临时脚本。

缺少 `FX_DOCKER_START_SCRIPT` 时必须在清理旧服务前 fail loud。

## Docker 后置检查

临时脚本执行后，server 域等待：

- PostgreSQL `:5432`
- MinIO `:9000`
- Elasticsearch `:9200` 为 yellow/green

随后补 RabbitMQ queue、数据库权限和 ES 本地磁盘阈值设置。健康失败时保留 Docker 现场供排查，但不继续启动 Spring。

## Spring 准备

新 server worktree 首次使用时执行：

```bash
FX_SERVER_DIR=<server-worktree> \
node <插件根>/skills/agents-launcher/server-cli.mjs prepare
```

它会：

- 生成 gitignored 的 ANTLR 类，避免 IDE 报红。
- 检测 GraalVM。
- 必要时解析兼容的 JDK 21。

`server-cli` 启动 Spring 时负责：

- GraalVM 本地模式或容器降级。
- ZGC→G1GC/JVMCI 兼容 patch。
- 清除 macOS 代理对 localhost gRPC 的影响。
- 注入 Polars 回连地址。
- 设置 `OPENPROJECT_ISOPEN=false`，不自动打开浏览器。
- 使用增量 `bootRun --no-build-cache`。

Spring 日志位于：

```text
<FX_SERVER_DIR>/dev-start.log
```

server worktree 可能出现 `.java-home`、`.dev-start.pid`、日志文件和 `build.gradle.kts` patch；汇报时明确不要误提交。

## 状态与停止

- Spring 监听 `:8081`。
- 状态统一由 orchestrator `--status` 查询。
- 停 Spring 使用 `server-cli`，覆盖 Gradle daemon、容器降级和端口残留。
- Docker 默认不停。用户明确要求停 Docker 时才从目标 server 仓执行 `docker compose down`。

单独重启 sync 容器时，必须连带重启 `sync-polars-localhost`；它与 sync 共享网络命名空间，只重启主容器会让 Polars 转发失效。

## 汇报

至少汇报：

- `FX_SERVER_DIR` 的路径、branch 和来源类型。
- Docker 临时脚本已执行并删除。
- 是否运行 ANTLR prepare。
- GraalVM 使用本地还是容器降级。
- Docker 与 Spring 健康结果。
- server 仓产生的本地副作用和待还原项。
