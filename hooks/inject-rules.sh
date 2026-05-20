#!/usr/bin/env bash
# SessionStart hook (渐进式加载版): 只把 model/ 下的常驻基线 + 路由表注入 session,
# rules/ 下的触发式规则由 agent 看 model/agent-catalog.md 命中触发后自行 Read.
#
# hooks/hooks.json 声明 2 个 SessionStart command, 分别带 arg:
#   inject-rules.sh project   -- 项目本地路由 (${PROJECT_DIR}/.agents-personal/AGENTS.md, 项目无此文件则空)
#   inject-rules.sh model     -- 行为基线 + 路由表 (model/agent-{about,karpathy,personal,catalog}.md)
#
# 新增 model/*.md: 必须显式加到下方 MODEL_FILES 桶, 否则脚本会在 stderr 警告
# 新增 rules/rule-*.md: 必须在 model/agent-catalog.md 里加一段, 否则脚本会在 stderr 警告
# (sanity check 阻止"加了文件但 agent 看不见 / 触发不到"的孤儿状态)
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
GROUP="${1:-}"

# 桶定义 (单一来源, 改这里即可; sanity check 自动覆盖)
PROJECT_FILES=(
  "${PROJECT_DIR}/.agents-personal/AGENTS.md"
)
MODEL_FILES=(
  "${PLUGIN_ROOT}/model/agent-about.md"
  "${PLUGIN_ROOT}/model/agent-karpathy.md"
  "${PLUGIN_ROOT}/model/agent-personal.md"
  "${PLUGIN_ROOT}/model/agent-catalog.md"
)

case "$GROUP" in
  project) files=("${PROJECT_FILES[@]}") ;;
  model)   files=("${MODEL_FILES[@]}") ;;
  *)
    echo "inject-rules.sh: unknown group '$GROUP' (expected: project|model)" >&2
    exit 1
    ;;
esac

# Sanity check (model 桶启动时跑一次足够, 避免每个 group 重复输出):
#   - model/*.md 未在 MODEL_FILES 桶 → 不会进 session context, 警告
#   - rules/rule-*.md 未在 model/agent-catalog.md 引用 → agent 触发不到, 警告
if [ "$GROUP" = "model" ] && [ -n "$PLUGIN_ROOT" ]; then
  if [ -d "${PLUGIN_ROOT}/model" ]; then
    for f in "${PLUGIN_ROOT}/model"/*.md; do
      [ -f "$f" ] || continue
      covered=0
      for d in "${MODEL_FILES[@]}"; do
        [ "$f" = "$d" ] && covered=1 && break
      done
      if [ "$covered" = "0" ]; then
        echo "inject-rules.sh WARN: ${f#${PLUGIN_ROOT}/} 在 model/ 但没分桶 MODEL_FILES, 不会注入 session." >&2
      fi
    done
  fi
  catalog="${PLUGIN_ROOT}/model/agent-catalog.md"
  if [ -d "${PLUGIN_ROOT}/rules" ] && [ -f "$catalog" ]; then
    for f in "${PLUGIN_ROOT}/rules"/*.md; do
      [ -f "$f" ] || continue
      base=$(basename "$f")
      if ! grep -qF "$base" "$catalog"; then
        echo "inject-rules.sh WARN: rules/${base} 没被 model/agent-catalog.md 引用, agent 触发不到. 改 catalog 或删文件." >&2
      fi
    done
  fi
fi

content=""
for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  [ -n "$content" ] && content+=$'\n\n---\n\n'
  if [[ "$f" == "$PLUGIN_ROOT"/* ]]; then
    rel="${f#${PLUGIN_ROOT}/}"
    content+="<!-- source: nocode-evolve/${rel} -->"$'\n'
  else
    content+="<!-- source: ${f} (project override) -->"$'\n'
  fi
  content+="$(sed "s|\${CLAUDE_PLUGIN_ROOT}|${PLUGIN_ROOT}|g" "$f")"
done

# 空桶 (project 桶在没 .agents-personal/AGENTS.md 的项目) → 静默退出
[ -n "$content" ] || exit 0

if command -v jq >/dev/null 2>&1; then
  printf '%s' "$content" \
    | jq -Rs '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:.}}'
else
  CONTENT="$content" python3 - <<'PY'
import json, os
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": os.environ["CONTENT"],
    }
}, ensure_ascii=False))
PY
fi
