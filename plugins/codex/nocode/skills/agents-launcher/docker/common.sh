#!/usr/bin/env bash
set -euo pipefail

# Docker 服务按变更频率拆成两层：有状态基础设施长期复用，分支镜像按启动时更新。
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

# 分支层镜像始终检查远端 latest，切换 prod/test/dev 时先移除旧前缀容器，避免端口冲突。
remove_branch_containers
IMAGE_PREFIX="$profile" "${compose[@]}" pull "${BRANCH_SERVICES[@]}"
IMAGE_PREFIX="$profile" "${compose[@]}" up -d --no-deps "${BRANCH_SERVICES[@]}"
