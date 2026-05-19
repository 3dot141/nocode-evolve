#!/usr/bin/env bash
# SessionStart hook (拆桶版): 按 group 分批注入 rule 内容. 每个 group 一次 stdout,
# 各自独立成一个 additionalContext. 拆桶后单次 output 都 <6KB, 避开 Claude Code
# 单 hook output >~10KB 被截只剩 preview 的坑.
#
# hooks/hooks.json 应声明 3 个 SessionStart command, 分别带 arg:
#   inject-rules.sh project    -- 项目路由 (overlay-agents-personal + 项目 .agents-personal/AGENTS.md)
#   inject-rules.sh baseline   -- 行为基线 (agent-about + agent-karpathy)
#   inject-rules.sh overlays   -- skill 覆盖 (overlay-superpowers)
#
# 新增 plugin rule 文件: 必须显式加到下方三个桶变量之一, 否则脚本会在 stderr 警告
# 该文件没被注入 (sanity check), 同时该文件**不会**出现在任何 session context 里.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
GROUP="${1:-}"

# 桶定义 (单一来源, 改这里即可; sanity check 自动覆盖)
PROJECT_FILES=(
  "${PLUGIN_ROOT}/rules/overlay-agents-personal.md"
  "${PROJECT_DIR}/.agents-personal/AGENTS.md"
)
BASELINE_FILES=(
  "${PLUGIN_ROOT}/rules/agent-about.md"
  "${PLUGIN_ROOT}/rules/agent-karpathy.md"
)
OVERLAYS_FILES=(
  "${PLUGIN_ROOT}/rules/overlay-superpowers.md"
)

case "$GROUP" in
  project)  files=("${PROJECT_FILES[@]}") ;;
  baseline) files=("${BASELINE_FILES[@]}") ;;
  overlays) files=("${OVERLAYS_FILES[@]}") ;;
  *)
    echo "inject-rules.sh: unknown group '$GROUP' (expected: project|baseline|overlays)" >&2
    exit 1
    ;;
esac

# Sanity check: plugin rules/*.md 中没被任何桶覆盖的, stderr 警告 (不阻 session).
if [ -n "$PLUGIN_ROOT" ] && [ -d "${PLUGIN_ROOT}/rules" ]; then
  declared=("${PROJECT_FILES[@]}" "${BASELINE_FILES[@]}" "${OVERLAYS_FILES[@]}")
  for f in "${PLUGIN_ROOT}/rules"/*.md; do
    [ -f "$f" ] || continue
    covered=0
    for d in "${declared[@]}"; do
      [ "$f" = "$d" ] && covered=1 && break
    done
    if [ "$covered" = "0" ]; then
      echo "inject-rules.sh WARN: ${f#${PLUGIN_ROOT}/} 没分桶, 不会进 session context. 改本脚本的桶变量." >&2
    fi
  done
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

# 空桶 (比如 project 桶在没 .agents-personal/AGENTS.md 的项目) → 静默退出
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
