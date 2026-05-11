#!/usr/bin/env bash
# SessionStart hook：注入插件 agent rules 与项目自定义规则。
# - 插件：${CLAUDE_PLUGIN_ROOT}/rules/*.md（按文件名排序，全部追加）
# - 项目：<project_root>/.agents-personal/AGENTS.md（存在则追加）
# 注入前会把 rule 内容里字面量 ${CLAUDE_PLUGIN_ROOT} 替换为实际绝对路径，
# 这样 rule 内引用的资源（如 resources/*.md）AI 能直接 Read。
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
PROJECT_RULES="${PROJECT_DIR}/.agents-personal/AGENTS.md"

content=""

if [ -n "$PLUGIN_ROOT" ] && [ -d "${PLUGIN_ROOT}/rules" ]; then
  for f in "${PLUGIN_ROOT}/rules"/*.md; do
    [ -f "$f" ] || continue
    [ -n "$content" ] && content+=$'\n\n---\n\n'
    rel="${f#${PLUGIN_ROOT}/}"
    content+="<!-- source: nocode-evolve/${rel} -->"$'\n'
    content+="$(sed "s|\${CLAUDE_PLUGIN_ROOT}|${PLUGIN_ROOT}|g" "$f")"
  done
fi

if [ -f "$PROJECT_RULES" ]; then
  [ -n "$content" ] && content+=$'\n\n---\n\n'
  content+="<!-- source: ${PROJECT_RULES} (project override) -->"$'\n'
  content+="$(cat "$PROJECT_RULES")"
fi

# 都没有就静默退出，不污染上下文
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
