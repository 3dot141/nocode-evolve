#!/bin/bash
# 本地开发环境快速启动脚本
# 用法:
#   ./dev-start.sh                           启动基础设施 + 后端服务
#   ./dev-start.sh all --with-sync --with-ui 全流程（基础设施 + 后端 + 同步 + 前端）
#   ./dev-start.sh infra        仅启动基础设施（Docker 容器）
#   ./dev-start.sh app          仅启动后端服务
#   ./dev-start.sh restart      快速重启后端（跳过基础设施检查，增量编译）
#   ./dev-start.sh ui           仅启动前端 (jsy-webui 容器)
#   ./dev-start.sh sync         仅启动数据源同步服务 (Docker 容器)
#   ./dev-start.sh stop         停止后端服务
#   ./dev-start.sh stop-ui      停止前端
#   ./dev-start.sh stop-sync    停止数据源同步服务
#   ./dev-start.sh stop-all     停止后端服务 + Docker 容器 + 前端
#   ./dev-start.sh status       查看所有服务状态

set -euo pipefail

# 本脚本随 nocode 插件分发（skills/agents-launcher/scripts/），不在 fx 仓内。
# 必须通过 FX_SERVER_DIR 指定目标 fx-data-server 仓根，所有相对路径基于该仓根。
if [ -z "${FX_SERVER_DIR:-}" ] || [ ! -f "${FX_SERVER_DIR}/gradlew" ]; then
    echo "[✗] FX_SERVER_DIR 未设置或不是有效 server 仓（缺 gradlew）: ${FX_SERVER_DIR:-<empty>}" >&2
    echo "    用法: FX_SERVER_DIR=/path/to/fx-data-server bash $0 <command>" >&2
    exit 1
fi
cd "$FX_SERVER_DIR"

# ── 颜色 ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

CONTAINER="docker"

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; }
step()  { echo -e "${CYAN}[→]${NC} $*"; }

# ── 跨平台 sed -i 包装 ──
# GNU sed (Linux / Git Bash on Windows):  sed -i 'pattern' file
# BSD sed (macOS):                         sed -i '' 'pattern' file
if sed --version >/dev/null 2>&1; then
    sedi() { sed -i "$@"; }
else
    sedi() { sed -i '' "$@"; }
fi

# ── OS 检测 ──
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) OS_KIND="windows" ;;
    Darwin)               OS_KIND="macos" ;;
    Linux)                OS_KIND="linux" ;;
    *)                    OS_KIND="unknown" ;;
esac

# ── 加载 .env 文件（不覆盖已有环境变量） ──
if [ -f .env ]; then
    set -a
    source <(grep -v '^\s*#' .env | grep -v '^\s*$')
    set +a
fi

# ── 本地模式：强制基础设施指向 localhost ──
# all 模式启动本地 Docker 容器，必须覆盖 .env 中可能存在的远端地址
# remote 模式使用 .env 中的远端地址，不走这里
force_local_infra() {
    info "本地模式：基础设施地址 → 127.0.0.1"
    export DB_URL="jdbc:postgresql://127.0.0.1:5432/jiushuyun?reWriteBatchedInserts=true"
    export DB_USERNAME="${DB_USERNAME:-jiushuyun}"
    export DB_PASSWORD="${DB_PASSWORD:-jiushuyun}"
    export REDIS_HOST="127.0.0.1"
    export CACHE_MONGO_URI="127.0.0.1:27017/jiushuyun?authSource=admin"
    export CACHE_MONGO_USERNAME="${CACHE_MONGO_USERNAME:-admin}"
    export CACHE_MONGO_PASSWORD="${CACHE_MONGO_PASSWORD:-jiushuyun}"
    export DATASOURCE_MONGO_URI="127.0.0.1:27017/jiushuyun?authSource=admin"
    export DATASOURCE_MONGO_USERNAME="${DATASOURCE_MONGO_USERNAME:-admin}"
    export DATASOURCE_MONGO_PASSWORD="${DATASOURCE_MONGO_PASSWORD:-jiushuyun}"
    export NEO4J_URL="bolt://127.0.0.1:7687"
    export ES_HOST="127.0.0.1"
    export S3_ENDPOINT="http://127.0.0.1:9000"
    export S3_INTERNAL_ENDPOINT="http://127.0.0.1:9000"
    export CDN_ENDPOINT="http://127.0.0.1:9000"
    export CDN_INTERNAL_ENDPOINT="http://127.0.0.1:9000"
    export POLARS_HOST="127.0.0.1"
    export INFRA_HOST="127.0.0.1"
    # application.yml 默认 polars.master.config-str=polars-local:8000（容器间 DNS），
    # 宿主机解析不了，改走 127.0.0.1:8000（容器已映射）
    export POLARS_MASTER_CONFIG_STR="${POLARS_MASTER_CONFIG_STR:-127.0.0.1:8000}"
}

# ── 端口配置（与 application-dev.yml 一致，可通过环境变量覆盖） ──
APP_PORT="${APP_PORT:-8081}"
GRPC_PORT="${GRPC_PORT:-9090}"
MGMT_PORT="${MGMT_PORT:-8075}"
UI_PORT="${UI_PORT:-8888}"

# ── Synchronizer 项目路径（本地 Gradle 启动模式） ──
SYNC_PROJECT_DIR="${SYNC_PROJECT_DIR:-$(cd "$FX_SERVER_DIR/../fx-data-synchronizer" 2>/dev/null && pwd || echo "")}"
SYNC_PID_FILE=".sync.pid"
SYNC_LOG="embed/sync/logs/sync.log"

# ── 基础设施服务列表（排除 jsy-webui / image-exporter / sync，避免私有镜像拉取和容器名冲突） ──
INFRA_SERVICES="postgresql redis mongodb rabbitmq neo4j minio elasticsearch"

# ── GraalVM JDK 发现 ──
# bootRun 需要 GraalVM（EnableJVMCI），自动查找并设置 JAVA_HOME
GRAALVM_IMAGE="eclipse-temurin:21-jdk"
detect_graalvm() {
    # 已设置且是 GraalVM 则直接使用
    if [ -n "${JAVA_HOME:-}" ] && "$JAVA_HOME/bin/java" -version 2>&1 | grep -qi "graalvm\|Oracle GraalVM"; then
        _cache_java_home "$JAVA_HOME"
        return 0
    fi

    # 从缓存文件快速恢复（避免每次重新搜索）
    if [ -f .java-home ]; then
        local cached
        cached=$(cat .java-home)
        if [ -f "$cached/bin/java" ] && "$cached/bin/java" -version 2>&1 | grep -qi "graalvm\|Oracle GraalVM"; then
            export JAVA_HOME="$cached"
            export PATH="$JAVA_HOME/bin:$PATH"
            return 0
        fi
    fi

    # 按优先级查找 GraalVM 安装（macOS bundle 结构：Contents/Home；Windows 常见路径）
    local candidates=(
        "$HOME/.jdks/graalvm-21/Contents/Home"
        "$HOME/.jdks/graalvm-21"
        "$HOME/.jdks/graalvm-ce-21"
        "/usr/lib/jvm/graalvm-21"
        "$HOME/.sdkman/candidates/java/current"
        "/c/Program Files/Java/graalvm-21"
        "/c/Program Files/Java/graalvm-ce-21"
        "/c/Java/graalvm-21"
        "${USERPROFILE:-}/.jdks/graalvm-21"
        "${USERPROFILE:-}/.jdks/graalvm-ce-21"
    )
    for candidate in "${candidates[@]}"; do
        if [ -f "$candidate/bin/java" ] && "$candidate/bin/java" -version 2>&1 | grep -qi "graalvm\|Oracle GraalVM"; then
            export JAVA_HOME="$candidate"
            export PATH="$JAVA_HOME/bin:$PATH"
            _cache_java_home "$JAVA_HOME"
            info "检测到 GraalVM: $JAVA_HOME"
            return 0
        fi
    done

    # 本地没有 GraalVM，检查 Podman 中是否有 GraalVM 镜像
    if command -v docker >/dev/null 2>&1; then
        step "本地未安装 GraalVM，尝试使用 Podman 容器运行..."
        if ! $CONTAINER image inspect "$GRAALVM_IMAGE" >/dev/null 2>&1; then
            step "拉取 GraalVM 镜像 ($GRAALVM_IMAGE)..."
            $CONTAINER pull "$GRAALVM_IMAGE" || {
                error "无法拉取 GraalVM 镜像"
                return 1
            }
        fi
        info "将使用容器 $GRAALVM_IMAGE 运行 bootRun"
        return 0
    fi

    error "未找到 GraalVM JDK 21。bootRun 需要 GraalVM（EnableJVMCI）。"
    echo "  安装方式：sudo ./install-graalvm.sh"
    echo "  或手动设置：export JAVA_HOME=/path/to/graalvm-21"
    return 1
}

# 将已确认的 GraalVM 路径写入缓存文件，供脚本和 Skill 直接读取
_cache_java_home() {
    echo "$1" > .java-home
}

# ── 主机 IP（前端容器通过此 IP 访问后端和 MinIO） ──
host_ip() {
    local ip=""
    if [ "$OS_KIND" = "windows" ] && command -v ipconfig >/dev/null 2>&1; then
        # Git Bash on Windows: 调 Windows 的 ipconfig
        ip=$(ipconfig 2>/dev/null | grep -E "IPv4" | head -1 | awk -F: '{print $2}' | tr -d ' \r')
    elif command -v ifconfig >/dev/null 2>&1; then
        ip=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}')
    elif command -v ip >/dev/null 2>&1; then
        ip=$(ip -4 addr 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d/ -f1)
    fi
    echo "${ip:-127.0.0.1}"
}

# ── Polars 引擎配置 ──
polars_compose_file() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        amd64|x86_64)  echo "docker-compose-polars-x86.yml" ;;
        arm64|aarch64) echo "docker-compose-polars-arm.yml" ;;
        *) error "不支持的架构: $arch"; exit 1 ;;
    esac
}

polars_image_version() {
    local branch
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "dev")
    local prefix="dev"
    [[ "$branch" == *release* ]] && prefix="test"
    [[ "$branch" == *persist* ]] && prefix="prod"
    echo "harbor.jsydevelop.com/develop/${prefix}-polars:latest"
}

# ── 修复 Polars 本地 S3 配置（避免 ETL 卡在“数据加载中”） ──
ensure_polars_s3_local_config() {
    local files=(
        "embed/docker_polars/worker/.polars_meta/polars.properties"
        "embed/docker_polars/worker1/.polars_meta/polars.properties"
        "embed/docker_polars/worker2/.polars_meta/polars.properties"
        "embed/docker_polars/worker3/.polars_meta/polars.properties"
        "embed/docker_polars/master/.polars_meta/polars.properties"
    )

    for file in "${files[@]}"; do
        [ -f "$file" ] || continue
        sedi 's#^polars.cluster.ubs.s3.endpoint=.*#polars.cluster.ubs.s3.endpoint=http://minio:9000#' "$file"
        sedi 's#^polars.cluster.ubs.s3.bucketName=.*#polars.cluster.ubs.s3.bucketName=lake#' "$file"
        sedi 's#^polars.cluster.ubs.s3.accessKey=.*#polars.cluster.ubs.s3.accessKey=jiushuyun#' "$file"
        sedi 's#^polars.cluster.ubs.s3.secretKey=.*#polars.cluster.ubs.s3.secretKey=jiushuyun#' "$file"
        sedi 's#^polars.cluster.ubs.s3.pathstyle.access=.*#polars.cluster.ubs.s3.pathstyle.access=true#' "$file"
    done
}

# ── GraalJS 兼容：ZGC 与 JVMCI 不兼容，本地开发需要临时切换为 G1GC ──
# build.gradle.kts 中配置了 -XX:+UseZGC，但 GraalVM 21 的 ZGC 会关闭 JVMCI，
# 导致 GraalAgentSandbox 初始化失败。启动前临时 patch，启动后还原。
patch_gc_for_graaljs() {
    if grep -q '+UseZGC' build.gradle.kts 2>/dev/null; then
        # Temurin HotSpot 下 EnableJVMCI 是实验选项，需先 UnlockExperimentalVMOptions；
        # GraalVM 下 UnlockExperimentalVMOptions 也是合法 no-op，两边兼容。
        sedi -e 's/"-XX:+UseZGC"/"-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:+EnableJVMCI"/' -e '/ZGenerational/d' build.gradle.kts
        info "已切换 GC: ZGC → G1GC（兼容 GraalJS/JVMCI）"
    fi
}

# ── 工具函数 ──
pid_on_port() {
    # macOS 用 lsof，Linux 用 ss，Windows (Git Bash) 用 netstat
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti :"${1}" -sTCP:LISTEN 2>/dev/null | head -1 || true
    elif command -v ss >/dev/null 2>&1; then
        ss -tlnp 2>/dev/null | grep ":${1} " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true
    elif [ "$OS_KIND" = "windows" ] && command -v netstat >/dev/null 2>&1; then
        # Windows netstat -ano: 最后一列是 PID; 只取 LISTENING 且本地端口匹配的
        netstat -ano 2>/dev/null | awk -v port=":${1}$" '
            /LISTENING/ {
                split($2, a, ":"); lp = a[length(a)];
                if (lp == "'"${1}"'") { print $NF; exit }
            }' | tr -d '\r' | head -1 || true
    else
        true
    fi
}

# ── 代理清除 ──
# macOS 系统代理（java.net.useSystemProxies）会被 JVM 自动拾取，
# 将 localhost gRPC 连接路由到 HTTP 代理，代理不支持 HTTP/2 返回 502，
# 表现为 Polars "UNAVAILABLE: Network closed for unknown reason"。
# 2026-04-11 排查确认：必须同时做三件事才能彻底禁用：
#   1. unset 所有代理环境变量（all_proxy/http_proxy 等）
#   2. -Djava.net.useSystemProxies=false（禁止 JVM 读 macOS 系统代理）
#   3. -Dhttp.nonProxyHosts='*'（兜底：即使有代理也全部绕过）
# 注意：Sync 项目 build.gradle.kts 也硬编码了 nonProxyHosts，需同步修改。
purge_proxy_env() {
    unset all_proxy ALL_PROXY http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY 2>/dev/null || true
}

# 返回禁用代理的 JVM 参数（供 JAVA_TOOL_OPTIONS 拼接）
proxy_jvm_flags() {
    echo "-Djava.net.useSystemProxies=false -Dhttp.nonProxyHosts='*' -Dhttps.nonProxyHosts='*'"
}

resolve_polars_rpc_host() {
    local fallback_ip="192.168.65.254"

    # 优先：从 Polars 容器内解析 host.docker.internal，这是容器回连宿主机的真实地址
    # 注意：0.250.250.254 等 0.x.x.x 地址在 Docker Desktop 内部是合法可路由的，不要过滤
    if $CONTAINER ps --format '{{.Names}}' | grep -qx "polars-local"; then
        local container_ip
        container_ip=$($CONTAINER exec polars-local getent ahosts host.docker.internal 2>/dev/null | awk 'NR==1 {print $1}')
        if [ -n "$container_ip" ]; then
            echo "$container_ip"
            return 0
        fi
    fi

    # 回退：从宿主机解析（可能与容器视角不一致，但聊胜于无）
    local host_ip
    host_ip=$(python3 -c 'import socket; print(socket.gethostbyname("host.docker.internal"))' 2>/dev/null || true)
    if [ -n "$host_ip" ] && [[ "$host_ip" != 0.* ]]; then
        echo "$host_ip"
        return 0
    fi
    echo "$fallback_ip"
}

container_name_of() {
    case "$1" in
        postgresql) echo "postgres" ;;
        *)          echo "$1" ;;
    esac
}

# ── 检查依赖 ──
check_prerequisites() {
    local missing=()
    command -v java   >/dev/null 2>&1 || missing+=("java")
    command -v docker >/dev/null 2>&1 || missing+=("docker")

    if [ ${#missing[@]} -gt 0 ]; then
        error "缺少依赖: ${missing[*]}"
        exit 1
    fi

    # Java 版本检查（macOS stub java 会返回非零退出码，用子shell隔离）
    local java_version
    java_version=$(set +o pipefail; java -version 2>&1 | head -1 | sed -n 's/[^0-9]*\([0-9]*\).*/\1/p' | head -1) || true
    if [ -n "$java_version" ] && [ "$java_version" -lt 21 ] 2>/dev/null; then
        error "需要 Java 21+，当前: $(set +o pipefail; java -version 2>&1 | head -1)"
        exit 1
    fi
}

# ── 确保 RabbitMQ 中被动声明的队列存在 ──
# @RabbitListener(queues=...) 使用被动声明，要求队列在应用启动前已存在
ensure_rabbitmq_queues() {
    local passive_queues=(
        "hihidata-web-socket-honeypot-queue"
        "hihidata-web-socket-refresh-jsy-token-queue"
        "hihidata-web-socket-jsy-refresh-token-fanout-message-queue"
    )
    for q in "${passive_queues[@]}"; do
        if $CONTAINER exec rabbitmq rabbitmqadmin -u test -p test -V local list queues name 2>/dev/null | grep -qx "| $q |"; then
            true  # 已存在
        else
            $CONTAINER exec rabbitmq rabbitmqadmin -u test -p test -V local declare queue \
                name="$q" durable=true 2>/dev/null && info "创建 RabbitMQ 队列: $q" || true
        fi
    done
}

# ── 修复 PostgreSQL 权限 ──
# flyway_history_post_startup 由 postgres 用户建表，但应用以 jiushuyun 连接。
# 每次重建容器后需重新授权，此函数幂等可安全重复调用。
fix_db_permissions() {
    local db_user="${DB_USERNAME:-jiushuyun}"
    if $CONTAINER exec postgres psql -U postgres -d jiushuyun \
        -c "GRANT ALL ON TABLE flyway_history_post_startup TO ${db_user};" \
        >/dev/null 2>&1; then
        info "已授权 ${db_user} 访问 flyway_history_post_startup"
    fi
}

# ── 等待 Elasticsearch 就绪（可独立调用） ──
wait_for_es() {
    local retries=0
    while [ $retries -lt 30 ]; do
        local es_status
        es_status=$(curl --noproxy localhost -sf -u elastic:jiushuyun \
            "http://localhost:9200/_cluster/health" 2>/dev/null \
            | sed -n 's/.*"status"\s*:\s*"\([^"]*\)".*/\1/p' || true)
        if [ "$es_status" = "green" ] || [ "$es_status" = "yellow" ]; then
            info "Elasticsearch 就绪 ($es_status)"
            return 0
        fi
        if [ $((retries % 5)) -eq 0 ] && [ $retries -gt 0 ]; then
            printf "\r  等待 Elasticsearch... (%ds)" $((retries * 2))
        fi
        retries=$((retries + 1))
        sleep 2
    done
    warn "Elasticsearch 可能尚未就绪"
}

# ── 启动基础设施 ──
start_infra() {
    step "检查 Docker 容器状态..."

    local need_start=()
    local need_wait_es=false
    for svc in $INFRA_SERVICES; do
        local cname
        cname=$(container_name_of "$svc")

        if $CONTAINER ps --format '{{.Names}}' | grep -qx "$cname"; then
            info "$cname 已运行"
        else
            need_start+=("$svc")
            [ "$svc" = "elasticsearch" ] && need_wait_es=true
        fi
    done

    if [ ${#need_start[@]} -eq 0 ]; then
        info "所有基础设施容器已就绪"
        return 0
    fi

    # ES 数据目录需要对容器内 elasticsearch 用户可写
    mkdir -p embed/es && chmod 777 embed/es

    step "启动容器: ${need_start[*]}"
    $CONTAINER compose up -d "${need_start[@]}" 2>&1 | grep -v "is already in use" || true

    step "等待关键服务就绪..."
    local retries=0
    local pg_ok=false es_ok=false
    while [ $retries -lt 60 ]; do
        if ! $pg_ok && $CONTAINER exec postgres pg_isready -q 2>/dev/null; then
            pg_ok=true
            info "PostgreSQL 就绪"
        fi
        if ! $es_ok; then
            local es_status
            es_status=$(curl --noproxy localhost -sf -u elastic:jiushuyun \
                "http://localhost:9200/_cluster/health" 2>/dev/null \
                | sed -n 's/.*"status"\s*:\s*"\([^"]*\)".*/\1/p' || true)
            if [ "$es_status" = "green" ] || [ "$es_status" = "yellow" ]; then
                es_ok=true
                info "Elasticsearch 就绪 ($es_status)"
            fi
        fi
        if $pg_ok && $es_ok; then
            # 确保 RabbitMQ vhost=local 中存在被动声明的队列（@RabbitListener(queues=...) 要求队列预先存在）
            ensure_rabbitmq_queues
            # 修复 flyway_history_post_startup 权限（owner=postgres，应用以 jiushuyun 连接）
            fix_db_permissions
            # 禁用 ES 磁盘水位检查（单节点开发环境磁盘可能较满）
            curl --noproxy localhost -s -X PUT "http://localhost:9200/_cluster/settings" \
                -u elastic:jiushuyun -H "Content-Type: application/json" \
                -d '{"transient":{"cluster.routing.allocation.disk.threshold_enabled":false}}' >/dev/null 2>&1 || true
            info "基础设施全部就绪"
            return 0
        fi
        if [ $((retries % 5)) -eq 0 ] && [ $retries -gt 0 ]; then
            printf "\r  等待中... PG=%s ES=%s (%ds)" \
                "$($pg_ok && echo '✓' || echo '…')" \
                "$($es_ok && echo '✓' || echo '…')" \
                $((retries * 2))
        fi
        retries=$((retries + 1))
        sleep 2
    done
    echo ""
    warn "部分服务可能尚未完全就绪，继续启动应用..."
}

# ── 启动 Polars 引擎 ──
start_polars() {
    ensure_polars_s3_local_config

    if $CONTAINER ps --format '{{.Names}}' | grep -qx "polars-local"; then
        # 运行中的实例如果还是空配置，直接重启一次让修复配置生效。
        if $CONTAINER exec polars-local grep -q '^polars.cluster.ubs.s3.endpoint=$' /mnt/polars/worker/.polars_meta/polars.properties 2>/dev/null; then
            warn "检测到 polars-local 的 S3 配置为空，正在自动重启修复..."
            $CONTAINER restart polars-local >/dev/null
        fi
        info "polars-local 已运行"
        return 0
    fi

    local compose_file
    compose_file=$(polars_compose_file)
    local polars_version
    polars_version=$(polars_image_version)

    step "启动 Polars 引擎 ($compose_file)..."
    mkdir -p embed/docker_polars
    # POLARS_BIND_HOST=127.0.0.1：让 workers 以宿主机可达的地址注册（Spring Boot 运行在宿主机）
    POLARS_VERSION="$polars_version" \
    POLARS_BIND_HOST="${POLARS_BIND_HOST:-127.0.0.1}" \
        $CONTAINER compose -f "$compose_file" up -d 2>&1 | grep -v "is already in use" || true

    step "等待 Polars 就绪..."
    local retries=0
    while [ $retries -lt 60 ]; do
        if curl --noproxy localhost -sf http://localhost:8000 >/dev/null 2>&1 ||
           [ -n "$(pid_on_port 8000)" ]; then
            info "Polars 引擎就绪"
            return 0
        fi
        if [ $((retries % 5)) -eq 0 ] && [ $retries -gt 0 ]; then
            printf "\r  等待 Polars... (%ds)" $((retries * 2))
        fi
        retries=$((retries + 1))
        sleep 2
    done
    echo ""
    warn "Polars 可能尚未就绪，继续启动应用..."
}

# ── 启动后端应用 ──
start_app() {
    # GraalVM 检测（bootRun 需要 EnableJVMCI）
    detect_graalvm || exit 1

    local existing_pid
    existing_pid=$(pid_on_port "$APP_PORT")

    if [ -n "$existing_pid" ]; then
        warn "端口 ${APP_PORT} 已被占用 (PID: $existing_pid)"
        echo -n "  是否要终止旧进程并重新启动？[y/N] "
        read -r answer
        if [[ "$answer" =~ ^[Yy]$ ]]; then
            kill "$existing_pid" 2>/dev/null || true
            sleep 2
            info "旧进程已终止"
        else
            warn "跳过启动，使用已有实例"
            return 0
        fi
    fi

    # 修复 PostgreSQL 权限（flyway_history_post_startup owner=postgres，应用用 jiushuyun 连接）
    fix_db_permissions

    # 确保 Elasticsearch 已就绪（ES 刚重启时 Spring 上下文初始化会失败）
    wait_for_es

    # MinIO endpoint 使用主机 IP（前端 Docker 容器通过此 URL 上传文件）
    local hip
    hip=$(host_ip)
    export S3_ENDPOINT="${S3_ENDPOINT:-http://${hip}:9000}"
    export CDN_ENDPOINT="${CDN_ENDPOINT:-http://${hip}:9000}"

    step "启动 Spring Boot 应用 (bootRun)..."
    echo "  日志: ./dev-start.log"
    echo "  S3_ENDPOINT: $S3_ENDPOINT"
    echo ""

    local app_pid=""
    local use_container=false

    # 如果本地没有 JAVA_HOME（说明要用容器），则用 Podman 容器运行
    if [ -z "${JAVA_HOME:-}" ]; then
        use_container=true
        step "使用容器编译并运行..."

        # 清理已停止的旧容器
        $CONTAINER rm -f dev-backend 2>/dev/null || true

        # 构建完整的环境变量列表，传递给容器（用数组避免引号被当作值的一部分）
        local env_args=(
            -e "DB_URL=$DB_URL"
            -e "DB_USERNAME=$DB_USERNAME"
            -e "DB_PASSWORD=$DB_PASSWORD"
            -e "REDIS_HOST=$REDIS_HOST"
            -e "CACHE_MONGO_URI=$CACHE_MONGO_URI"
            -e "CACHE_MONGO_USERNAME=$CACHE_MONGO_USERNAME"
            -e "CACHE_MONGO_PASSWORD=$CACHE_MONGO_PASSWORD"
            -e "DATASOURCE_MONGO_URI=$DATASOURCE_MONGO_URI"
            -e "DATASOURCE_MONGO_USERNAME=$DATASOURCE_MONGO_USERNAME"
            -e "DATASOURCE_MONGO_PASSWORD=$DATASOURCE_MONGO_PASSWORD"
            -e "NEO4J_URL=$NEO4J_URL"
            -e "ES_HOST=$ES_HOST"
            -e "S3_ENDPOINT=$S3_ENDPOINT"
            -e "S3_INTERNAL_ENDPOINT=$S3_INTERNAL_ENDPOINT"
            -e "CDN_ENDPOINT=$CDN_ENDPOINT"
            -e "CDN_INTERNAL_ENDPOINT=$CDN_INTERNAL_ENDPOINT"
            -e "POLARS_HOST=$POLARS_HOST"
            -e "INFRA_HOST=$INFRA_HOST"
            -e "APP_PORT=$APP_PORT"
            -e "GRPC_PORT=$GRPC_PORT"
            -e "MGMT_PORT=$MGMT_PORT"
            -e "SPRING_PROFILES_ACTIVE=dev"
        )

        # 直接调用 Gradle launcher 而不通过 daemon，避免 Podman fork 问题
        $CONTAINER run -d --name dev-backend \
            --privileged \
            --network=host \
            -v "$(pwd):/app" \
            -w /app \
            "${env_args[@]}" \
            -e GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=1" \
            "$GRAALVM_IMAGE" \
            bash -c '
                apt-get update -qq && apt-get install -y -qq git procps iproute2 unzip curl >/dev/null 2>&1
                GRADLE_HOME=/opt/gradle
                if [ ! -d "$GRADLE_HOME" ]; then
                    curl -sL https://services.gradle.org/distributions/gradle-8.5-bin.zip -o /tmp/gradle.zip
                    unzip -q /tmp/gradle.zip -d /opt
                    mv /opt/gradle-8.5 $GRADLE_HOME
                fi
                export PATH=$GRADLE_HOME/bin:$PATH
                # 使用 --no-daemon 和 --no-parallel 确保不使用 daemon 模式
                gradle bootJar --no-daemon --no-parallel --max-workers=1 > /app/dev-start.log 2>&1
                java -jar build/libs/*.jar > /app/dev-start-run.log 2>&1
            ' 2>&1 || {
                error "容器启动失败"
                return 1
            }

        app_pid="container"
        echo "$app_pid" > .dev-start.pid
    else
        echo "  JAVA_HOME: $JAVA_HOME"
        echo "  按 Ctrl+C 可安全退出（服务继续后台运行）"
        echo ""

        # 后台运行 bootRun（macOS 无 setsid，直接后台启动）
        patch_gc_for_graaljs
        # JAVA_TOOL_OPTIONS 会被所有子 JVM 进程（包括 bootRun fork）自动继承：
        # - 代理：确保本地基础设施（MinIO/ES/Redis/Postgres）不走系统代理
        # - rpc.host：Polars gRPC 反向连接地址，以 polars-local 容器内解析为准
        # --no-build-cache：避免 Gradle 从缓存恢复已删除/移包的旧 .class 文件导致 ConflictingBeanDefinitionException
        purge_proxy_env
        JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} $(proxy_jvm_flags) -Drpc.host=$(resolve_polars_rpc_host)" \
        ./gradlew bootRun --no-build-cache > dev-start.log 2>&1 &
        app_pid=$!
        echo "$app_pid" > .dev-start.pid
    fi

    step "等待应用启动（编译 + Spring 初始化）..."
    local retries=0
    local max_retries=180  # 最多等待 6 分钟
    while [ $retries -lt $max_retries ]; do
        if [ "$use_container" = true ]; then
            # 检查容器是否还在运行
            if ! $CONTAINER ps --format '{{.Names}}' | grep -qx "dev-backend"; then
                error "容器已退出，查看日志: tail -50 dev-start.log"
                return 1
            fi
        else
            if ! kill -0 "$app_pid" 2>/dev/null; then
                error "应用启动失败，查看日志: tail -50 dev-start.log"
                return 1
            fi
        fi

        if [ -n "$(pid_on_port "$APP_PORT")" ]; then
            if curl --noproxy localhost -sf "http://localhost:${APP_PORT}/" >/dev/null 2>&1; then
                echo ""
                info "应用启动成功！"
                echo ""
                echo -e "  ${GREEN}HTTP${NC}  http://localhost:${APP_PORT}"
                echo -e "  ${GREEN}gRPC${NC}  localhost:${GRPC_PORT}"
                echo -e "  ${GREEN}管理${NC}  http://localhost:${MGMT_PORT}"
                if [ "$use_container" = true ]; then
                    echo -e "  ${GREEN}模式${NC}  Podman 容器"
                else
                    echo -e "  ${GREEN}PID${NC}   $app_pid"
                fi
                echo -e "  ${GREEN}日志${NC}  tail -f dev-start.log"
                echo ""
                return 0
            fi
        fi

        if [ $((retries % 5)) -eq 0 ] && [ $retries -gt 0 ]; then
            printf "\r  已等待 %ds..." $((retries * 2))
        fi
        retries=$((retries + 1))
        sleep 2
    done

    echo ""
    warn "等待超时，应用可能仍在启动中"
    if [ "$use_container" = true ]; then
        echo "  查看日志: tail -f dev-start.log"
        echo "  查看容器: docker logs dev-backend"
    else
        echo "  PID: $app_pid"
        echo "  查看日志: tail -f dev-start.log"
    fi
    echo "  检查状态: ./dev-start.sh status"
}

# ── 启动前端（jsy-webui 容器） ──
start_ui() {
    local cname="dev-jsy-webui"
    if $CONTAINER ps --format '{{.Names}}' | grep -qx "$cname"; then
        info "$cname 已运行 (http://localhost:${UI_PORT})"
        return 0
    fi

    step "启动前端 ($cname)..."

    # 清理已停止的旧容器
    $CONTAINER rm -f "$cname" 2>/dev/null || true

    local hip
    hip=$(host_ip)

    # 端口映射模式：前端通过主机 IP 访问后端和 MinIO
    # --add-host 确保容器内 host.docker.internal 可用
    # sed 将 nginx 监听端口从 80 改为 UI_PORT（rootless Docker 不支持特权端口）
    $CONTAINER run -d --name "$cname" \
        -e JSY_SERVER_URL="http://${hip}:${APP_PORT}" \
        -e COMPLEX_REPORT_SERVER_URL="http://${hip}:8089" \
        -e IAM_SERVER_URL="http://${hip}:81" \
        -e AI_ASSISTANT_SERVER_URL="http://${hip}:8070" \
        -e CONTAINER_ENV=dev \
        --add-host=host.docker.internal:host-gateway \
        -p "${UI_PORT}:80" \
        harbor.jsydevelop.com/develop/dev-jsy-webui:latest 2>&1 || {
            error "前端容器启动失败"
            return 1
        }

    # 修复 nginx Host header：$host 会丢掉端口号，导致后端重定向到 80
    # 改为 $http_host 保留原始的 localhost:8888
    $CONTAINER exec "$cname" sed -i 's/proxy_set_header Host \$host;/proxy_set_header Host \$http_host;/' \
        /usr/local/openresty/nginx/conf/nginx.conf 2>/dev/null || true
    $CONTAINER exec "$cname" openresty -s reload 2>/dev/null || true

    local retries=0
    while [ $retries -lt 15 ]; do
        if $CONTAINER ps --format '{{.Names}}' | grep -qx "$cname"; then
            info "前端就绪 (http://localhost:${UI_PORT})"
            return 0
        fi
        retries=$((retries + 1))
        sleep 2
    done

    # 检查是否退出了
    local status
    status=$($CONTAINER ps -a --filter "name=$cname" --format '{{.Status}}')
    if echo "$status" | grep -q "Exited"; then
        error "前端容器退出了:"
        $CONTAINER logs "$cname" 2>&1 | tail -3
        return 1
    fi
    warn "前端可能尚未就绪"
}

# ── 停止前端 ──
stop_ui() {
    step "停止前端..."
    $CONTAINER stop dev-jsy-webui 2>/dev/null && info "前端已停止" || warn "前端未运行"
}

# ── 启动 Synchronizer（本地 Gradle 模式，绕过 Docker 网络限制） ──
# Docker 容器内 127.0.0.1 = 容器自身回环，无法连到 Polars Worker（Worker 广播 127.0.0.1）
# 因此改用宿主机 Gradle bootRun，走 gvproxy 直连 Worker
start_sync() {
    local sync_port=9091
    local existing_pid
    existing_pid=$(pid_on_port "$sync_port")
    if [ -n "$existing_pid" ]; then
        info "Synchronizer 已运行 (PID: $existing_pid, gRPC :$sync_port)"
        return 0
    fi

    if [ -z "$SYNC_PROJECT_DIR" ] || [ ! -f "$SYNC_PROJECT_DIR/gradlew" ]; then
        error "Synchronizer 项目未找到: ${SYNC_PROJECT_DIR:-未配置}"
        error "请设置环境变量 SYNC_PROJECT_DIR 指向 fx-data-synchronizer 目录"
        return 1
    fi

    # 停掉旧的 Docker sync 容器（占用 9091 端口会冲突）
    local cname="${IMAGE_PREFIX:-dev}-sync"
    $CONTAINER rm -f "$cname" 2>/dev/null || true

    # 确保 sync 数据库和 Quartz 表已初始化
    local pg_host="${DB_HOST:-127.0.0.1}"
    local pg_port="${DB_PORT:-5432}"
    local pg_user="${DB_USER:-jiushuyun}"
    local pg_pass="${DB_PASSWORD:-jiushuyun}"
    local psql_cmd="$CONTAINER exec postgres psql -U $pg_user"
    if $psql_cmd -c "\q" sync >/dev/null 2>&1; then
        : # sync 数据库已存在
    else
        step "创建 sync 数据库..."
        $psql_cmd postgres -c "CREATE DATABASE sync OWNER $pg_user ENCODING 'UTF8';" 2>&1 || true
    fi
    # 检查 Quartz 表是否存在，不存在则初始化
    local qrtz_exists
    qrtz_exists=$($psql_cmd -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='qrtz_job_details';" sync 2>/dev/null | tr -d ' ' || echo 0)
    if [ "${qrtz_exists:-0}" = "0" ] && [ -f "$SYNC_PROJECT_DIR/synchronizer/src/main/resources/db/qrtz-init.sql" ]; then
        step "初始化 Quartz 表结构..."
        $CONTAINER exec -i postgres psql -U "$pg_user" sync < "$SYNC_PROJECT_DIR/synchronizer/src/main/resources/db/qrtz-init.sql" >/dev/null 2>&1 || true
    fi

    # 确保 JAVA_HOME 已设置，优先 GraalVM，fallback .java-home 缓存，再 /usr/libexec/java_home (仅 macOS)
    detect_graalvm || true
    if [ -z "${JAVA_HOME:-}" ]; then
        if [ -f ".java-home" ]; then
            export JAVA_HOME
            JAVA_HOME=$(cat .java-home)
        elif [ "$OS_KIND" = "macos" ] && /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
            export JAVA_HOME
            JAVA_HOME=$(/usr/libexec/java_home -v 21)
        fi
    fi
    local sync_java_home="${JAVA_HOME:-}"

    step "启动 Synchronizer (Gradle, 项目: $SYNC_PROJECT_DIR)..."
    mkdir -p "$(dirname "$SYNC_LOG")"
    echo "  日志: $SYNC_LOG"

    purge_proxy_env
    JAVA_HOME="$sync_java_home" \
    JAVA_TOOL_OPTIONS="$(proxy_jvm_flags)" \
        bash -c "cd '$SYNC_PROJECT_DIR' && ./gradlew --no-daemon :synchronizer:bootRun" \
        > "$SYNC_LOG" 2>&1 &
    local sync_pid=$!
    echo "$sync_pid" > "$SYNC_PID_FILE"

    step "等待 Synchronizer 就绪..."
    local retries=0
    while [ $retries -lt 90 ]; do
        if ! kill -0 "$sync_pid" 2>/dev/null; then
            error "Synchronizer 启动失败，查看日志: tail -50 $SYNC_LOG"
            return 1
        fi
        if [ -n "$(pid_on_port $sync_port)" ]; then
            echo ""
            info "Synchronizer 就绪 (PID: $sync_pid, gRPC :$sync_port)"
            echo "  日志: tail -f $SYNC_LOG"
            return 0
        fi
        if [ $((retries % 10)) -eq 0 ] && [ $retries -gt 0 ]; then
            printf "\r  已等待 %ds..." $((retries * 2))
        fi
        retries=$((retries + 1))
        sleep 2
    done
    echo ""
    warn "等待超时，Synchronizer 可能仍在启动中，查看日志: tail -f $SYNC_LOG"
}

# ── 停止 Synchronizer ──
stop_sync() {
    step "停止 Synchronizer..."
    local stopped=false

    # 停本地进程
    local pid
    pid=$(pid_on_port 9091)
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null && info "Synchronizer (PID: $pid) 已停止" && stopped=true
    fi
    if [ -f "$SYNC_PID_FILE" ]; then
        local saved_pid
        saved_pid=$(cat "$SYNC_PID_FILE" 2>/dev/null || true)
        if [ -n "$saved_pid" ] && kill -0 "$saved_pid" 2>/dev/null; then
            kill "$saved_pid" 2>/dev/null && stopped=true
        fi
        rm -f "$SYNC_PID_FILE"
    fi

    # 也停 Docker 容器（如果有）
    local cname="${IMAGE_PREFIX:-dev}-sync"
    $CONTAINER stop "$cname" 2>/dev/null && stopped=true || true
    $CONTAINER rm -f "$cname" 2>/dev/null || true

    $stopped && true || warn "Synchronizer 未运行"
}

# ── 停止应用 ──
stop_app() {
    step "停止后端服务..."
    local killed=false

    # 如果是容器模式
    if $CONTAINER ps --format '{{.Names}}' 2>/dev/null | grep -qx "dev-backend"; then
        $CONTAINER stop dev-backend 2>/dev/null || true
        $CONTAINER rm -f dev-backend 2>/dev/null || true
        killed=true
        info "已停止容器 dev-backend"
    fi

    if [ -f .dev-start.pid ]; then
        local pid
        pid=$(cat .dev-start.pid)
        if [ "$pid" != "container" ] && kill -0 "$pid" 2>/dev/null; then
            kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
            killed=true
            info "已终止进程组 (PID: $pid)"
        fi
        rm -f .dev-start.pid
    fi

    sleep 1
    local port_pid
    port_pid=$(pid_on_port "$APP_PORT")
    if [ -n "$port_pid" ]; then
        kill "$port_pid" 2>/dev/null || true
        killed=true
        info "已终止 :${APP_PORT} 残留进程 (PID: $port_pid)"
    fi

    if ! $killed; then
        warn "未找到运行中的后端服务"
        return 0
    fi

    local wait=0
    while [ $wait -lt 10 ] && [ -n "$(pid_on_port "$APP_PORT")" ]; do
        sleep 1
        wait=$((wait + 1))
    done
    if [ -n "$(pid_on_port "$APP_PORT")" ]; then
        warn "端口 ${APP_PORT} 仍被占用，强制终止..."
        kill -9 "$(pid_on_port "$APP_PORT")" 2>/dev/null || true
        sleep 1
    fi
    info "后端服务已完全停止"
}

# ── 快速重启后端（跳过基础设施检查，增量编译） ──
restart_app() {
    stop_app
    detect_graalvm || exit 1
    force_local_infra

    local hip
    hip=$(host_ip)
    export S3_ENDPOINT="${S3_ENDPOINT:-http://${hip}:9000}"
    export CDN_ENDPOINT="${CDN_ENDPOINT:-http://${hip}:9000}"

    step "快速重启 Spring Boot（增量编译）..."
    echo "  日志: ./dev-start.log"
    echo ""

    patch_gc_for_graaljs
    purge_proxy_env
    JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} $(proxy_jvm_flags) -Drpc.host=$(resolve_polars_rpc_host)" \
    ./gradlew bootRun --no-build-cache > dev-start.log 2>&1 &
    local app_pid=$!
    echo "$app_pid" > .dev-start.pid

    step "等待应用启动..."
    local retries=0
    local max_retries=180
    while [ $retries -lt $max_retries ]; do
        if ! kill -0 "$app_pid" 2>/dev/null; then
            error "应用启动失败，查看日志: tail -50 dev-start.log"
            return 1
        fi
        if curl -s -o /dev/null -w '%{http_code}' "http://localhost:${APP_PORT}/decision/login" 2>/dev/null | grep -qE "200|302"; then
            echo ""
            info "应用重启成功！"
            echo ""
            echo "  ${GREEN}HTTP${NC}  http://localhost:${APP_PORT}"
            echo "  ${GREEN}PID${NC}   $app_pid"
            echo "  ${GREEN}日志${NC}  tail -f dev-start.log"
            echo ""
            return 0
        fi
        retries=$((retries + 1))
        if [ $((retries % 5)) -eq 0 ]; then
            printf "\r  已等待 %ds..." $((retries * 2))
        fi
        sleep 2
    done
    echo ""
    warn "等待超时，应用可能仍在启动中。检查日志: tail -f dev-start.log"
}

# ── 停止全部（应用 + 基础设施） ──
stop_all() {
    stop_app
    stop_sync
    stop_ui
    step "停止 Docker 容器..."
    local compose_file
    compose_file=$(polars_compose_file)
    POLARS_VERSION="unused" $CONTAINER compose -f "$compose_file" down 2>&1 || true
    $CONTAINER compose down 2>&1 || true
    info "Docker 容器已停止"
}

# ── 查看状态 ──
show_status() {
    echo -e "${CYAN}═══ 基础设施容器 ═══${NC}"
    for svc in $INFRA_SERVICES; do
        local cname
        cname=$(container_name_of "$svc")

        local status
        status=$($CONTAINER ps --filter "name=^${cname}$" --format '{{.Status}}' 2>/dev/null || true)
        if [ -n "$status" ]; then
            info "$cname — $status"
        else
            error "$cname — 未运行"
        fi
    done

    local polars_status
    polars_status=$($CONTAINER ps --filter "name=^polars-local$" --format '{{.Status}}' 2>/dev/null || true)
    if [ -n "$polars_status" ]; then
        info "polars-local — $polars_status"
    else
        error "polars-local — 未运行"
    fi

    echo ""
    echo -e "${CYAN}═══ 后端服务 ═══${NC}"

    local pid
    pid=$(pid_on_port "$APP_PORT")
    if [ -n "$pid" ]; then
        info "HTTP :${APP_PORT} (PID: $pid)"
    else
        error "HTTP :${APP_PORT} — 未运行"
    fi

    pid=$(pid_on_port "$GRPC_PORT")
    if [ -n "$pid" ]; then
        info "gRPC :${GRPC_PORT} (PID: $pid)"
    else
        error "gRPC :${GRPC_PORT} — 未运行"
    fi

    pid=$(pid_on_port "$MGMT_PORT")
    if [ -n "$pid" ]; then
        info "管理 :${MGMT_PORT} (PID: $pid)"
    else
        error "管理 :${MGMT_PORT} — 未运行"
    fi

    local sync_cname="${IMAGE_PREFIX:-dev}-sync"
    local sync_status
    sync_status=$($CONTAINER ps --filter "name=^${sync_cname}$" --format '{{.Status}}' 2>/dev/null || true)
    local sync_pid
    sync_pid=$(pid_on_port 9091)
    if [ -n "$sync_status" ]; then
        info "Sync ($sync_cname) — $sync_status"
    elif [ -n "$sync_pid" ]; then
        info "Sync (Gradle PID: $sync_pid) — 运行中 :9091"
    else
        error "Sync — 未运行"
    fi

    local ui_status
    ui_status=$($CONTAINER ps --filter "name=^dev-jsy-webui$" --format '{{.Status}}' 2>/dev/null || true)
    if [ -n "$ui_status" ]; then
        info "前端 :${UI_PORT} — $ui_status"
    else
        error "前端 :${UI_PORT} — 未运行"
    fi
}

# ── 全量重置并初始化（用于全新环境或 embed 被删除后重建） ──
# 流程：停止一切 → 清空 embed → 启动基础设施 → 初始化 DB → 启动 Polars → 启动应用 → 写入测试数据
fresh_init() {
    check_prerequisites
    force_local_infra

    # 1. 停止所有容器
    step "停止所有容器..."
    stop_app 2>/dev/null || true
    stop_sync 2>/dev/null || true
    local compose_file
    compose_file=$(polars_compose_file)
    POLARS_VERSION="unused" POLARS_BIND_HOST=127.0.0.1 $CONTAINER compose -f "$compose_file" down 2>&1 || true
    $CONTAINER compose down 2>&1 || true
    $CONTAINER network prune -f >/dev/null 2>&1 || true

    # 2. 清空 embed 数据目录（保留目录本身）
    if [ -d embed ]; then
        step "清空 embed 数据目录..."
        rm -rf embed/postgres17 embed/redis embed/mongo embed/rabbitmq \
               embed/neo4j embed/minio embed/es embed/docker_polars embed/sync
        info "embed 已清空"
    fi

    # 3. 启动基础设施
    start_infra

    # 4. 初始化 DB：Quartz 建表（flyway_schema_history 由 Flyway 自动建，qrtz_* 不在 Flyway 中）
    step "初始化 PostgreSQL 附加表..."
    local qrtz_sql="hihidata-springboot/src/main/resources/db/qrtz-init.sql"
    if [ -f "$qrtz_sql" ]; then
        $CONTAINER exec postgres psql -U postgres -d jiushuyun \
            -c "SELECT 1 FROM qrtz_locks LIMIT 1" >/dev/null 2>&1 || \
            $CONTAINER exec -i postgres psql -U postgres -d jiushuyun < "$qrtz_sql" >/dev/null \
            && info "Quartz 表已就绪"
    else
        warn "未找到 $qrtz_sql，请手动执行"
    fi

    # 5. 启动 Polars（注入 POLARS_BIND_HOST 让 worker 以 127.0.0.1 注册）
    export POLARS_BIND_HOST=127.0.0.1
    start_polars

    # 6. 启动后端（Flyway 运行建表）
    start_app

    # 7. 写入测试数据（Flyway 已建好业务表后才能执行）
    local dev_sql="docker-init/init/dev-user-init.sql"
    if [ -f "$dev_sql" ]; then
        step "写入测试用户数据..."
        $CONTAINER exec -i postgres psql -U postgres -d jiushuyun < "$dev_sql" >/dev/null \
            && info "测试数据已写入（手机 13800000001 / 密码 1）"
    else
        warn "未找到 $dev_sql，跳过测试数据初始化"
    fi

    echo ""
    echo -e "${GREEN}✓ 全量初始化完成${NC}"
    echo -e "  HTTP  http://localhost:${APP_PORT}"
    echo -e "  账号  手机 13800000001 / 密码 1"
}

# ── 主流程 ──
main() {
    local cmd="${1:-all}"

    case "$cmd" in
        fresh)
            fresh_init
            ;;
        infra)
            check_prerequisites
            start_infra
            ;;
        app)
            check_prerequisites
            force_local_infra
            start_infra
            start_app
            ;;
        ui)
            start_ui
            ;;
        sync)
            check_prerequisites
            force_local_infra
            start_sync
            ;;
        restart)
            restart_app
            ;;
        stop)
            stop_app
            ;;
        stop-ui)
            stop_ui
            ;;
        stop-sync)
            stop_sync
            ;;
        stop-all)
            stop_all
            ;;
        status)
            show_status
            ;;
        remote)
            # 远程模式：基础设施使用公共机器，本地只启动 RabbitMQ + 应用
            check_prerequisites
            info "远程模式 — 基础设施指向 ${INFRA_HOST:-未配置（请检查 .env）}"
            step "启动本地 RabbitMQ（远程模式唯一需要的本地容器）..."
            if $CONTAINER ps --format '{{.Names}}' | grep -qx "rabbitmq"; then
                info "rabbitmq 已运行"
            else
                $CONTAINER compose up -d rabbitmq 2>&1 | grep -v "is already in use" || true
                info "rabbitmq 已启动"
            fi
            start_app
            for flag in "${@:2}"; do
                case "$flag" in
                    --with-sync) start_sync ;;
                    --with-ui)   start_ui ;;
                esac
            done
            ;;
        all)
            check_prerequisites
            force_local_infra
            start_infra
            start_polars
            start_app
            # 可选标志：--with-sync 启动 Synchronizer，--with-ui 启动前端
            for flag in "${@:2}"; do
                case "$flag" in
                    --with-sync) start_sync ;;
                    --with-ui)   start_ui ;;
                esac
            done
            ;;
        *)
            echo "用法: $0 {fresh|remote|all|infra|app|restart|ui|sync|stop|stop-ui|stop-sync|stop-all|status}"
            echo ""
            echo "  ── 完整启动 ──"
            echo "  fresh                       全量重置：清空数据 + 初始化 + 写入测试数据（首次/重建时用）"
            echo "  (无参数)                    本地模式：基础设施 + Polars + 后端"
            echo "  all --with-sync --with-ui   本地模式 + 同步服务 + 前端（全流程）"
            echo "  remote --with-sync --with-ui  远程模式 + 同步服务 + 前端"
            echo ""
            echo "  ── 单独启动 ──"
            echo "  infra             仅启动 Docker 基础设施"
            echo "  app               仅启动后端服务"
            echo "  ui                仅启动前端 (jsy-webui 容器)"
            echo "  sync              仅启动数据源同步服务 (Gradle 本地进程)"
            echo ""
            echo "  ── 停止 ──"
            echo "  stop              停止后端服务"
            echo "  stop-ui           停止前端"
            echo "  stop-sync         停止数据源同步服务"
            echo "  stop-all          停止所有服务 + Docker 容器"
            echo ""
            echo "  ── 查看 ──"
            echo "  status            查看所有服务状态"
            echo ""
            echo "环境变量（可在 .env 中配置）:"
            echo "  INFRA_HOST        公共基础设施机器 IP（remote 模式自动读取 .env）"
            echo "  JAVA_HOME         GraalVM JDK 路径（自动检测 ~/.jdks/graalvm-21）"
            echo "  S3_ENDPOINT       MinIO 地址（默认 http://<主机IP>:9000）"
            echo "  APP_PORT          后端端口（默认 8081）"
            echo "  UI_PORT           前端端口（默认 8888）"
            exit 1
            ;;
    esac
}

main "$@"
