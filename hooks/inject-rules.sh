#!/usr/bin/env bash
# SessionStart hook: 把 rules/global-rules.md 的内容作为 additionalContext 注入会话。
# 这是 plugin 形式下挂载"伪 CLAUDE.md"的官方推荐方式。
set -euo pipefail

RULES_FILE="${CLAUDE_PLUGIN_ROOT}/rules/global-rules.md"
[ -f "$RULES_FILE" ] || exit 0

if command -v jq >/dev/null 2>&1; then
  jq -Rs '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:.}}' < "$RULES_FILE"
else
  RULES_FILE="$RULES_FILE" python3 - <<'PY'
import json, os
with open(os.environ["RULES_FILE"], "r", encoding="utf-8") as f:
    content = f.read()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": content,
    }
}, ensure_ascii=False))
PY
fi
