#!/usr/bin/env bash
#
# 对照组（baseline）一键启动
#   端口自动避让冲突 → 起依赖容器 → 预建 RabbitMQ 队列 → 起服务 → 等就绪 → 报告端口表
#
# 用法：
#   ./start-baseline.sh                 # 起（或补齐）对照组，端口冲突自动避让（不含 webui）
#   ./start-baseline.sh --image <tag>   # 指定 fx-data-agents 镜像（默认 fx-data-agents-baseline:persist）
#   ./start-baseline.sh --with-webui    # 额外起前端入口（人工浏览用，不参与 benchmark）
#   ./start-baseline.sh --down          # 停掉容器（保留数据卷）
#   ./start-baseline.sh --reset         # 停掉并删除数据卷，干净重来（会二次确认）
#
# 数据卷与端口分配落在 $BASELINE_STATE_DIR（默认 ~/.cache/agents-benchmark-baseline），
# 不进 skill 仓。想固定端口就手改该目录下的 env 文件。
# webui 默认不起；也可在该 env 文件里设 BASELINE_WEBUI=1 长期开启。

set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.baseline.yml"
# 数据卷与端口分配放仓外，避免 skill 仓被数据污染
STATE_DIR="${BASELINE_STATE_DIR:-$HOME/.cache/agents-benchmark-baseline}"
ENV_FILE="$STATE_DIR/env"
export BASELINE_STATE_DIR="$STATE_DIR"
mkdir -p "$STATE_DIR"
ACTION="up"
WITH_WEBUI="${BASELINE_WEBUI:-0}"

AGENTS_IMAGE=""
while [ $# -gt 0 ]; do
    case "$1" in
        --down) ACTION="down" ;;
        --reset) ACTION="reset" ;;
        --with-webui) WITH_WEBUI="1" ;;
        --image) AGENTS_IMAGE="${2:-}"; shift ;;
        "") ;;
        *) echo "未知参数：$1（可用：--image <tag> / --with-webui / --down / --reset）" >&2; exit 1 ;;
    esac
    shift
done

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ── 停 ────────────────────────────────────────────────────────
if [ "$ACTION" = "down" ] || [ "$ACTION" = "reset" ]; then
    compose down
    if [ "$ACTION" = "reset" ]; then
        echo
        echo "将删除对照组全部数据卷：$STATE_DIR"
        printf "确认删除？输入 yes 继续："
        read -r answer
        if [ "$answer" = "yes" ]; then
            rm -rf "$STATE_DIR"
            echo "[reset] 数据卷与端口分配已清除"
        else
            echo "[reset] 已取消删除（容器已停）"
        fi
    fi
    exit 0
fi

# ── 端口定义（变量名:默认值）──────────────────────────────────
PORT_SPECS=(
    "BASELINE_PG_PORT:5433"
    "BASELINE_REDIS_PORT:6381"
    "BASELINE_MONGO_PORT:27018"
    "BASELINE_RABBIT_PORT:5673"
    "BASELINE_RABBIT_UI_PORT:15673"
    "BASELINE_MINIO_PORT:9002"
    "BASELINE_MINIO_UI_PORT:9003"
    "BASELINE_ES_PORT:9201"
    "BASELINE_POLARS_PORT:18000"
    "BASELINE_POLARS_META_PORT:18090"
    "BASELINE_POLARS_RPC_PORT:17081"
    "BASELINE_SERVER_PORT:8082"
    "BASELINE_SERVER_GRPC_PORT:9092"
    "BASELINE_AGENTS_PORT:8071"
    "BASELINE_WEBUI_PORT:81"
)

# 沿用上次分配
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
fi

port_in_use() {
    local p="$1"
    # 对照组自己的容器占着这个端口 → 不算冲突（否则每次重跑都会往上漂）
    if docker ps --filter "name=baseline-" --format '{{.Ports}}' 2>/dev/null | grep -qE ":${p}->"; then
        return 1
    fi
    lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
}

find_free_port() {
    local p=$1
    while port_in_use "$p"; do
        p=$((p + 1))
    done
    echo "$p"
}

# ── 端口避让：被占用就往上找空闲端口 ──────────────────────────
declare -a ASSIGNED=()
for spec in "${PORT_SPECS[@]}"; do
    var="${spec%%:*}"
    default="${spec##*:}"
    current="${!var:-$default}"
    free="$(find_free_port "$current")"
    if [ "$free" != "$current" ]; then
        echo "[port] $var: $current 被占用 → 改用 $free"
    fi
    ASSIGNED+=("$var=$free")
    export "$var=$free"
done

{
    echo "# 对照组端口分配（start-baseline.sh 自动生成，手改可固定端口）"
    for kv in "${ASSIGNED[@]}"; do echo "$kv"; done
    [ -n "$AGENTS_IMAGE" ] && echo "BASELINE_AGENTS_IMAGE=$AGENTS_IMAGE"
} > "$ENV_FILE"

# --image 未传时沿用 .env.baseline 里的值，都没有则用 compose 默认
AGENTS_IMAGE="${AGENTS_IMAGE:-${BASELINE_AGENTS_IMAGE:-fx-data-agents-baseline:persist}}"
export BASELINE_AGENTS_IMAGE="$AGENTS_IMAGE"
if ! docker image inspect "$AGENTS_IMAGE" >/dev/null 2>&1; then
    echo "镜像不存在：$AGENTS_IMAGE" >&2
    echo "先构建（git ref 模式）或 docker pull（image tag 模式），再重跑本脚本。" >&2
    exit 1
fi
echo "[image] fx-data-agents 使用 $AGENTS_IMAGE"

wait_for() {
    local name="$1" check="$2" timeout="${3:-180}" waited=0
    printf "[wait] %s" "$name"
    until eval "$check" >/dev/null 2>&1; do
        sleep 3
        waited=$((waited + 3))
        if [ "$waited" -ge "$timeout" ]; then
            echo " 超时（${timeout}s）"
            return 1
        fi
        printf "."
    done
    echo " 就绪"
}

# ── 1. 起依赖 ─────────────────────────────────────────────────
echo "[1/5] 启动依赖容器…"
compose up -d baseline-postgres baseline-redis baseline-mongodb \
    baseline-rabbitmq baseline-minio baseline-elasticsearch baseline-polars

wait_for "PostgreSQL" "docker exec baseline-postgres pg_isready -U postgres" 120
wait_for "RabbitMQ"   "docker exec baseline-rabbitmq rabbitmqctl status" 180
wait_for "MinIO"      "curl -sf --max-time 3 http://127.0.0.1:${BASELINE_MINIO_PORT}/minio/health/live" 120

# ── 2. 预建队列 ───────────────────────────────────────────────
# 空 broker 上 listener 会因缺队列 fatal；队列名从主环境 RabbitMQ 导入。
echo "[2/5] 预建 RabbitMQ 队列…"
if docker ps --format '{{.Names}}' | grep -qx "rabbitmq"; then
    main_queues="$(docker exec rabbitmq rabbitmqctl list_queues -p local name 2>/dev/null | tail -n +3 | sed 's/[[:space:]]*$//' | grep -v '^$' || true)"
else
    main_queues=""
fi

if [ -n "$main_queues" ]; then
    created=0
    while read -r q; do
        [ -z "$q" ] && continue
        code="$(curl -s -o /dev/null -w '%{http_code}' -u test:test -X PUT \
            -H 'content-type: application/json' \
            "http://127.0.0.1:${BASELINE_RABBIT_UI_PORT}/api/queues/local/${q}" \
            -d '{"durable":true}' || true)"
        [ "$code" = "201" ] && created=$((created + 1))
    done <<< "$main_queues"
    echo "[2/5] 从主环境导入队列，新建 $created 个"
else
    echo "[2/5] 主环境 RabbitMQ 不可达，跳过队列导入（首次启动 fx-data-server 可能失败，届时重跑本脚本）"
fi

# ── 3. 起服务 ─────────────────────────────────────────────────
echo "[3/5] 启动 fx-data-server 与 fx-data-agents…"
compose up -d baseline-fx-data-server baseline-fx-data-agents
if [ "$WITH_WEBUI" = "1" ]; then
    echo "[3/5] 额外启动 webui（人工浏览用）…"
    compose up -d baseline-jsy-webui
else
    # 默认不起 webui；若上次用 --with-webui 起过，这里停掉，避免悄悄常驻
    compose stop baseline-jsy-webui >/dev/null 2>&1 || true
fi

# ── 4. 等服务就绪 ─────────────────────────────────────────────
echo "[4/5] 等待 fx-data-server 就绪（冷启动约 2 分钟，amd64 模拟）…"
wait_for "fx-data-server" "curl -s -o /dev/null --max-time 5 http://127.0.0.1:${BASELINE_SERVER_PORT}/decision/" 300
wait_for "fx-data-agents" "curl -s -o /dev/null --max-time 5 http://127.0.0.1:${BASELINE_AGENTS_PORT}/ai/assistant/session/__probe__/trace-events" 180

# ── 5. 报告 ───────────────────────────────────────────────────
echo "[5/5] 完成。对照组端口："
echo
printf "  %-22s %s\n" "fx-data-agents"   "http://127.0.0.1:${BASELINE_AGENTS_PORT}"
printf "  %-22s %s\n" "fx-data-server"   "http://127.0.0.1:${BASELINE_SERVER_PORT}"
printf "  %-22s %s\n" "postgres"         "127.0.0.1:${BASELINE_PG_PORT}  (postgres/jiushuyun)"
printf "  %-22s %s\n" "minio"            "http://127.0.0.1:${BASELINE_MINIO_PORT}  (jiushuyun/jiushuyun)"
printf "  %-22s %s\n" "redis"            "127.0.0.1:${BASELINE_REDIS_PORT}"
printf "  %-22s %s\n" "mongodb"          "127.0.0.1:${BASELINE_MONGO_PORT}"
printf "  %-22s %s\n" "rabbitmq"         "127.0.0.1:${BASELINE_RABBIT_PORT} / UI ${BASELINE_RABBIT_UI_PORT}"
printf "  %-22s %s\n" "elasticsearch"    "127.0.0.1:${BASELINE_ES_PORT}"
printf "  %-22s %s\n" "polars"           "127.0.0.1:${BASELINE_POLARS_PORT}"
if [ "$WITH_WEBUI" = "1" ]; then
    printf "  %-22s %s\n" "webui"        "http://127.0.0.1:${BASELINE_WEBUI_PORT}/decision/home"
else
    printf "  %-22s %s\n" "webui"        "未启动（需要时加 --with-webui）"
fi
echo
echo "benchmark 接入："
echo "  QG_BASE_URL=http://127.0.0.1:${BASELINE_AGENTS_PORT} …"
