#!/usr/bin/env bash
# SessionStart hook：先注入插件全局规则，再叠加项目自定义规则。
# - 全局：${CLAUDE_PLUGIN_ROOT}/rules/global-rules.md
# - 项目：<project_root>/.nocode/AGENTS.md（存在则追加，用于每个工程的定制）
set -euo pipefail

GLOBAL_RULES="${CLAUDE_PLUGIN_ROOT}/rules/global-rules.md"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
PROJECT_RULES="${PROJECT_DIR}/.nocode/AGENTS.md"

content=""

if [ -f "$GLOBAL_RULES" ]; then
  content+="<!-- source: nocode-toolkit/rules/global-rules.md -->"$'\n'
  content+="$(cat "$GLOBAL_RULES")"
fi

if [ -f "$PROJECT_RULES" ]; then
  [ -n "$content" ] && content+=$'\n\n---\n\n'
  content+="<!-- source: ${PROJECT_RULES} (project override) -->"$'\n'
  content+="$(cat "$PROJECT_RULES")"
fi

# 两个文件都没有就静默退出，不污染上下文
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
