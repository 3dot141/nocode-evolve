#!/usr/bin/env bash
# SessionStart hook (渐进式加载 + 分 command 注入版):
# 把 model/ 下常驻基线 + 完整 rule 路由(catalog 分片)注入 session.
#
# 为什么每个文件一个 command (不再合并输出):
#   hook 的 additionalContext 按【字符】per-command 截断, 阈值 10000 (官方文档, 硬编码不可配).
#   旧版把多个 model 文件合并成一个 command 输出超 10000 → 整坨被截存盘.
#   拆成每文件一个 command 后各段独立判阈值, 全部安全注入.
#
# catalog 分片 (agent-rule-catalog-1.md / agent-rule-catalog-2.md / ...):
#   完整 rule 路由常驻 context (不再用 skills/route 中转, 常驻 = 必在 + 无软触发漏).
#   单片若 > SHARD_LIMIT(9000), scripts/compile.rule.js 自动切多片.
#   hooks.json 预留 5 片 segment, 后续片若不存在则 [ -f ] 静默退出. 超 MAX_CATALOG_SHARDS 由 compile.rule.js 报警.
#
# hooks/hooks.json 的 SessionStart 数组按下列 segment 顺序列 command:
#   model-about / model-personal / model-karpathy / model-rule-catalog-1 / model-rule-catalog-2 / model-rule-catalog-3 / project
#
# 新增 model/*.md (非 catalog 系列): 必须在 seg_file() 加 segment 并在 hooks.json 加对应 command, 否则 sanity 警告孤儿.
# 新增 rules/rule-*.md: frontmatter 加 name/description/skip, 必须被任一 model/agent-rule-catalog-*.md 引用
# (跑 scripts/compile.rule.js 重新生成), 否则 sanity 警告触发不到. PreToolUse 硬拦截规则单独源在
# scripts/compile.hooks.js, 与本链无关.
set -euo pipefail

PLUGIN_ROOT="${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
SEG="${1:-}"
CHUNK="${2:-1}"

# segment → 文件 映射 (单一来源)
seg_file() {
  case "$1" in
    model-about)      printf '%s' "${PLUGIN_ROOT}/model/agent-about.md" ;;
    model-personal)   printf '%s' "${PLUGIN_ROOT}/model/agent-personal.md" ;;
    model-karpathy)   printf '%s' "${PLUGIN_ROOT}/model/agent-karpathy.md" ;;
    model-rule-catalog-1)  printf '%s' "${PLUGIN_ROOT}/model/agent-rule-catalog-1.md" ;;
    model-rule-catalog-2)  printf '%s' "${PLUGIN_ROOT}/model/agent-rule-catalog-2.md" ;;
    model-rule-catalog-3)  printf '%s' "${PLUGIN_ROOT}/model/agent-rule-catalog-3.md" ;;
    model-rule-catalog-4)  printf '%s' "${PLUGIN_ROOT}/model/agent-rule-catalog-4.md" ;;
    model-rule-catalog-5)  printf '%s' "${PLUGIN_ROOT}/model/agent-rule-catalog-5.md" ;;
    project)          printf '%s' "${PROJECT_DIR}/.agents-personal/AGENTS.md" ;;
    *) return 1 ;;
  esac
}

# model segment 列表 (孤儿检查用; 改这里即同步 sanity)
MODEL_SEGMENTS="model-about model-personal model-karpathy model-rule-catalog-1 model-rule-catalog-2 model-rule-catalog-3 model-rule-catalog-4 model-rule-catalog-5"

file="$(seg_file "$SEG")" || {
  echo "inject-nocode.sh: unknown segment '$SEG' (expected: ${MODEL_SEGMENTS} project)" >&2
  exit 1
}

# 导出 CLAUDE_PLUGIN_ROOT 到 Bash 环境 (只在第一个 segment 写一次):
# CLAUDE_PLUGIN_ROOT 在 hook 进程内有, 但 Bash tool 拿不到.
# 写入 CLAUDE_ENV_FILE 后, 后续所有 Bash 调用都能用 ${CLAUDE_PLUGIN_ROOT}.
if [ "$SEG" = "model-about" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "CLAUDE_PLUGIN_ROOT=${PLUGIN_ROOT}" >> "$CLAUDE_ENV_FILE"
  _REF="${NOCODE_SKILL_REF:-${PLUGIN_ROOT}/skills/references}"
  echo "NOCODE_SKILL_REF=${_REF}" >> "$CLAUDE_ENV_FILE"
fi

# Sanity check 只在第一个 model segment 跑一次 (避免每 command 重复):
#   - 生成物与源 (rules/rule-*.md frontmatter / compile.hooks.js) 漂移 → warn
#   - model/*.md (排除 catalog 自动分片) 没对应 segment → warn (孤儿)
#   - rules/rule-*.md 没被任一 catalog 分片引用 → warn (agent 触发不到)
if [ "$SEG" = "model-about" ] && [ -n "$PLUGIN_ROOT" ]; then
  if command -v node >/dev/null 2>&1 && [ -f "${PLUGIN_ROOT}/scripts/compile.rule.js" ]; then
    node "${PLUGIN_ROOT}/scripts/compile.rule.js" --check 2>&1 | while read -r line; do
      echo "inject-nocode.sh WARN: $line" >&2
    done || true
  fi
  if command -v node >/dev/null 2>&1 && [ -f "${PLUGIN_ROOT}/scripts/compile.hooks.js" ]; then
    node "${PLUGIN_ROOT}/scripts/compile.hooks.js" --check 2>&1 | while read -r line; do
      echo "inject-nocode.sh WARN: $line" >&2
    done || true
  fi
  if [ -d "${PLUGIN_ROOT}/model" ]; then
    seg_files=""
    for s in $MODEL_SEGMENTS; do seg_files+=" $(seg_file "$s")"; done
    for f in "${PLUGIN_ROOT}/model"/*.md; do
      [ -f "$f" ] || continue
      case " $seg_files " in
        *" $f "*) ;;
        *) echo "inject-nocode.sh WARN: ${f#${PLUGIN_ROOT}/} 在 model/ 但没对应 segment, 不会注入 session. 加 seg_file() + hooks.json command." >&2 ;;
      esac
    done
  fi
  # upstream drift: skill-integration-map.md 的 last_verified 超 90 天 → warn
  _MAP="${PLUGIN_ROOT}/references/skill-integration-map.md"
  if [ -f "$_MAP" ]; then
    _VERIFIED=$(grep -oP 'last_verified:\s*\K\d{6}' "$_MAP" 2>/dev/null || true)
    if [ -n "$_VERIFIED" ]; then
      _TODAY=$(date +%y%m%d)
      _V_EPOCH=$(date -j -f "%y%m%d" "$_VERIFIED" +%s 2>/dev/null || date -d "20${_VERIFIED:0:2}-${_VERIFIED:2:2}-${_VERIFIED:4:2}" +%s 2>/dev/null || true)
      _T_EPOCH=$(date +%s)
      if [ -n "$_V_EPOCH" ]; then
        _DAYS_AGO=$(( (_T_EPOCH - _V_EPOCH) / 86400 ))
        if [ "$_DAYS_AGO" -gt 90 ]; then
          echo "inject-nocode.sh WARN: references/skill-integration-map.md 的 last_verified=$_VERIFIED 距今 ${_DAYS_AGO} 天, 上游 superpowers/agent-skills 可能已漂移. 请核验后更新 last_verified." >&2
        fi
      fi
    fi
  fi
  # rules/rule-*.md 必须被任一 catalog 分片引用 (catalog 是完整路由, agent 按 rule 名找)
  shopt -s nullglob
  catalog_files=("${PLUGIN_ROOT}"/model/agent-rule-catalog-*.md)
  shopt -u nullglob
  if [ -d "${PLUGIN_ROOT}/rules" ] && [ ${#catalog_files[@]} -gt 0 ]; then
    for f in "${PLUGIN_ROOT}/rules"/*.md; do
      [ -f "$f" ] || continue
      base=$(basename "$f")
      if ! grep -qF "$base" "${catalog_files[@]}" 2>/dev/null; then
        echo "inject-nocode.sh WARN: rules/${base} 没被任一 model/agent-rule-catalog-*.md 引用, agent 触发不到. 检查 frontmatter 是否 skip:true, 或跑 scripts/compile.rule.js 重新生成." >&2
      fi
    done
  fi
fi

# 空 segment (catalog-2/3 未生成时, project 桶在没 .agents-personal/AGENTS.md 时) → 静默退出
[ -f "$file" ] || exit 0

if [[ "$file" == "$PLUGIN_ROOT"/* ]]; then
  rel="${file#${PLUGIN_ROOT}/}"
  header="<!-- source: nocode/${rel} -->"
else
  header="<!-- source: ${file} (project override) -->"
fi
_REF="${NOCODE_SKILL_REF:-${PLUGIN_ROOT}/skills/references}"
content="${header}"$'\n'"$(sed "s|\${CLAUDE_PLUGIN_ROOT}|${PLUGIN_ROOT}|g; s|\${NOCODE_SKILL_REF}|${_REF}|g" "$file")"

budget="${NOCODE_CONTEXT_BUDGET_FILE:-${PLUGIN_ROOT}/skills/using-nocode/scripts/providers/claude-hooks/context-budget.json}"
if [ "$SEG" = "project" ]; then
  mode="dynamic"
  source_name="${file}"
else
  mode="static"
  source_name="nocode/${rel}"
fi

printf '%s' "$content" \
  | node "${PLUGIN_ROOT}/scripts/lib/context-budget.mjs" "$mode" "$budget" "$source_name" "$CHUNK" \
  | node "${PLUGIN_ROOT}/hooks/session-context.mjs"
