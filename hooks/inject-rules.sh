#!/usr/bin/env bash
# SessionStart hook (渐进式加载 + 分 command 注入版):
# 把 model/ 下常驻基线 + 路由表注入 session, rules/ 触发式规则由 agent 看 catalog 命中后自行 Read.
#
# 为什么每个文件一个 command (不再合并输出):
#   hook 的 additionalContext 按【字符】per-command 截断, 阈值 10000 (官方文档, 硬编码不可配).
#   旧版把 4 个 model 文件合并成一个 command 输出 = 12391 字符 > 10000 → 整坨被截存盘,
#   只 preview 前 2KB, 排在末尾的 agent-catalog.md (路由表) 实际没进 context, 第 1 层防御失效.
#   拆成每文件一个 command 后各段独立判阈值 (最大 catalog ~4568 字符), 全部安全注入.
#
# hooks/hooks.json 的 SessionStart 数组按下列 segment 顺序列 command:
#   model-about / model-karpathy / model-personal / model-catalog / project
# 注入顺序 model 先 (兜底基线), project 后 (可覆盖, 符合 agent-about.md 优先级 project > model).
#
# 新增 model/*.md: 必须在 seg_file() 加 segment 并在 hooks.json 加对应 command, 否则 sanity 警告孤儿.
# 新增 rules/rule-*.md: 必须在 model/agent-catalog.md 里加一段, 否则 sanity 警告触发不到.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
SEG="${1:-}"

# segment → 文件 映射 (单一来源)
seg_file() {
  case "$1" in
    model-about)    printf '%s' "${PLUGIN_ROOT}/model/agent-about.md" ;;
    model-karpathy) printf '%s' "${PLUGIN_ROOT}/model/agent-karpathy.md" ;;
    model-personal) printf '%s' "${PLUGIN_ROOT}/model/agent-personal.md" ;;
    model-catalog)  printf '%s' "${PLUGIN_ROOT}/model/agent-catalog.md" ;;
    project)        printf '%s' "${PROJECT_DIR}/.agents-personal/AGENTS.md" ;;
    *) return 1 ;;
  esac
}

# model segment 列表 (孤儿检查用; 改这里即同步 sanity)
MODEL_SEGMENTS="model-about model-karpathy model-personal model-catalog"

file="$(seg_file "$SEG")" || {
  echo "inject-rules.sh: unknown segment '$SEG' (expected: ${MODEL_SEGMENTS} project)" >&2
  exit 1
}

# Sanity check 只在第一个 model segment 跑一次 (避免每 command 重复):
#   - 生成物与 manifest 漂移 → warn
#   - model/*.md 没对应 segment → 不会注入 session, warn
#   - rules/rule-*.md 没被 catalog 引用 → agent 触发不到, warn
if [ "$SEG" = "model-about" ] && [ -n "$PLUGIN_ROOT" ]; then
  if command -v node >/dev/null 2>&1 && [ -f "${PLUGIN_ROOT}/hooks/generate.mjs" ]; then
    node "${PLUGIN_ROOT}/hooks/generate.mjs" --check 2>&1 | while read -r line; do
      echo "inject-rules.sh WARN: $line" >&2
    done || true
  fi
  if [ -d "${PLUGIN_ROOT}/model" ]; then
    seg_files=""
    for s in $MODEL_SEGMENTS; do seg_files+=" $(seg_file "$s")"; done
    for f in "${PLUGIN_ROOT}/model"/*.md; do
      [ -f "$f" ] || continue
      case " $seg_files " in
        *" $f "*) ;;
        *) echo "inject-rules.sh WARN: ${f#${PLUGIN_ROOT}/} 在 model/ 但没对应 segment, 不会注入 session. 加 seg_file() + hooks.json command." >&2 ;;
      esac
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

# 空 segment (project 桶在没 .agents-personal/AGENTS.md 的项目) → 静默退出
[ -f "$file" ] || exit 0

if [[ "$file" == "$PLUGIN_ROOT"/* ]]; then
  rel="${file#${PLUGIN_ROOT}/}"
  header="<!-- source: nocode-evolve/${rel} -->"
else
  header="<!-- source: ${file} (project override) -->"
fi
content="${header}"$'\n'"$(sed "s|\${CLAUDE_PLUGIN_ROOT}|${PLUGIN_ROOT}|g" "$file")"

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
