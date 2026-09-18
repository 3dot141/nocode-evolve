#!/usr/bin/env bash
set -euo pipefail

# Docker 服务按变更频率拆成三层：有状态基础设施长期复用，polars 引擎与分支镜像按启动时更新。
readonly SHARED_SERVICES=(postgresql redis mongodb rabbitmq minio elasticsearch)
readonly BRANCH_SERVICES=(jsy-webui sync image-exporter)
readonly BRANCH_PREFIXES=(dev test prod)

profile="${1:?docker profile is required}"
compose_file="${COMPOSE_FILE:-docker-compose.yml}"

if [[ ! -f "$compose_file" ]]; then
  if [[ ! -f docker-compose.template.yml ]]; then
    echo "docker compose file not found: $compose_file" >&2
    exit 1
  fi
  cp docker-compose.template.yml "$compose_file"
fi

if [[ -n "${HARBOR_PASSWORD:-}" ]]; then
  printf '%s' "$HARBOR_PASSWORD" | docker login \
    -u "${HARBOR_USERNAME:-develop}" \
    --password-stdin harbor.jsydevelop.com
fi

remove_branch_containers() {
  local prefix service container_id
  for prefix in "${BRANCH_PREFIXES[@]}"; do
    [[ "$prefix" == "$profile" ]] && continue
    for service in "${BRANCH_SERVICES[@]}"; do
      container_id="$(docker ps -aq --filter "name=^/${prefix}-${service}$")"
      if [[ -n "$container_id" ]]; then
        docker rm -f "$container_id"
      fi
    done
  done
}

compose=(docker compose -f "$compose_file")

# 只启动公用层；pull_policy=missing 加上显式 service 列表，切分支不会触碰这些容器。
"${compose[@]}" up -d "${SHARED_SERVICES[@]}"

# polars 层：镜像定义在单独的 docker-compose-polars-{arm,x86}.yml（口径对齐 fx-data-server 的
# dockerstart-polars.sh）。必须与主文件合并 up，polars-local 才算同一 compose 项目成员；只跑单
# 文件时 compose 会把它当 orphan 只警告不管理，镜像永远不更新——会出现「新 sync + 旧 polars」
# 组合，表更新全挂（2026-09-18 实证）。x86 文件取 ${POLARS_VERSION}，arm 文件里钉死具体镜像。
case "$(uname -m)" in
  arm64 | aarch64) polars_suffix=arm ;;
  amd64 | x86_64) polars_suffix=x86 ;;
  *) polars_suffix='' ;;
esac
polars_file="docker-compose-polars-${polars_suffix}.yml"
if [[ -n "$polars_suffix" && -f "$polars_file" ]]; then
  POLARS_VERSION="harbor.jsydevelop.com/develop/${profile}-polars:latest" \
    docker compose -f "$compose_file" -f "$polars_file" up -d --pull always polars-local
else
  echo "[warn] ${polars_file} 不存在或宿主架构未知，跳过 polars-local；polars 引擎版本可能落后于 sync" >&2
fi

# 分支层镜像始终检查远端 latest，切换 prod/test/dev 时先移除旧前缀容器，避免端口冲突。
remove_branch_containers
IMAGE_PREFIX="$profile" "${compose[@]}" pull "${BRANCH_SERVICES[@]}"
IMAGE_PREFIX="$profile" "${compose[@]}" up -d --no-deps "${BRANCH_SERVICES[@]}"

# sync 的 netns sidecar（network_mode:"service:sync"）不在 --no-deps 的连带范围内：
# recreate sync 后旧 sidecar 仍挂在已删容器的幽灵 netns 上运行（表面 running，sync 内
# localhost:12708 实际不通）。显式连带重建，并校验 12708（hex 31A4）已回到 sync netns。
IMAGE_PREFIX="$profile" "${compose[@]}" up -d sync-polars-localhost
sync_id="$("${compose[@]}" ps -q sync)"
sidecar_ready=""
for _ in 1 2 3 4 5; do
  if docker exec "$sync_id" sh -c 'cat /proc/net/tcp /proc/net/tcp6 2>/dev/null' \
    | awk '$4 == "0A" { split($2, a, ":"); if (a[2] == "31A4") ok = 1 } END { exit !ok }'; then
    sidecar_ready="1"
    break
  fi
  sleep 2
done
if [[ -z "$sidecar_ready" ]]; then
  echo "sync-polars-localhost sidecar 未在 sync netns 内监听 12708；保留 Docker 现场，排查后重跑本脚本" >&2
  exit 1
fi

# sync 是 amd64 镜像跑在 arm64 宿主（QEMU 模拟，内存开销大），compose 默认 1.5g 在多表
# 并发导入时会 OOM；OOM 自动重启会重建 netns 使 sidecar 掉队（见 server.md）。每次启动
# 统一放宽到 6g，同时抵消 compose recreate 对内存限制的重置。
docker update --memory 6g --memory-swap 12g "$sync_id" >/dev/null
