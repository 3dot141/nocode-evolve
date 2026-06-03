#!/usr/bin/env bash
# extract-cheatsheet.sh — 从 preset / component md 抽 Class Cheatsheet CSS 片段
#
# 用法：
#   bash extract-cheatsheet.sh preset <preset-name>
#   bash extract-cheatsheet.sh component <name>[,<name>,...]
#   bash extract-cheatsheet.sh all-components
#
# 例：
#   bash extract-cheatsheet.sh preset vercel-geist
#   bash extract-cheatsheet.sh component problem-block,callout,timeline
#
# 输出（stdout）：合并的 CSS，按 preset 在前、components 在后的顺序。
# agent 可直接 paste 到 HTML 的 <style> 块内作为起点。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REFS_DIR="$SCRIPT_DIR/../references"
PRESETS_DIR="$REFS_DIR/presets"
COMPONENTS_DIR="$REFS_DIR/components"

if [[ $# -lt 1 ]]; then
  cat >&2 <<EOF
usage:
  $0 preset <preset-name>
  $0 component <name>[,<name>,...]
  $0 all-components

available presets:
$(ls "$PRESETS_DIR"/*.md 2>/dev/null | xargs -n1 basename | sed 's/\.md$//' | sed 's/^/  /')

available components:
$(ls "$COMPONENTS_DIR"/*.md 2>/dev/null | xargs -n1 basename | sed 's/\.md$//' | grep -v '^INDEX$' | sed 's/^/  /')
EOF
  exit 2
fi

MODE="$1"
shift

# ─── extract: 抽 markdown 文件里 ## Class Cheatsheet 或 ## CSS Cheatsheet 节后的 ```css ... ``` 全部 ───
# 思路：定位到 cheatsheet 节标题（## Class Cheatsheet / ## CSS Cheatsheet），
# 再读到下一个 ## 节为止，期间所有 ```css ... ``` 代码块拼起来。

extract_css_blocks() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "/* error: file not found: $file */" >&2
    return 1
  fi

  awk '
    BEGIN { in_section = 0; in_block = 0; }
    /^## (Class Cheatsheet|CSS Cheatsheet)/ { in_section = 1; next; }
    /^## / && in_section { in_section = 0; }
    in_section && /^```css/ { in_block = 1; next; }
    in_section && in_block && /^```/ { in_block = 0; print ""; next; }
    in_section && in_block { print; }
  ' "$file"
}

# ─── header banner ─────────────────────────────────
print_banner() {
  local title="$1"
  echo "/* ═══════════════════════════════════════════════"
  echo " * $title"
  echo " * ═══════════════════════════════════════════════ */"
  echo ""
}

# ─── modes ─────────────────────────────────────────

case "$MODE" in
  preset)
    if [[ $# -lt 1 ]]; then
      echo "usage: $0 preset <preset-name>" >&2
      exit 2
    fi
    PRESET="$1"
    FILE="$PRESETS_DIR/${PRESET}.md"
    if [[ ! -f "$FILE" ]]; then
      echo "error: preset not found: $PRESET" >&2
      echo "available: $(ls "$PRESETS_DIR"/*.md | xargs -n1 basename | sed 's/\.md$//' | tr '\n' ' ')" >&2
      exit 2
    fi
    print_banner "Preset: $PRESET"
    extract_css_blocks "$FILE"
    ;;

  component)
    if [[ $# -lt 1 ]]; then
      echo "usage: $0 component <name>[,<name>,...]" >&2
      exit 2
    fi
    IFS=',' read -r -a NAMES <<< "$1"
    for name in "${NAMES[@]}"; do
      name=$(echo "$name" | tr -d '[:space:]')
      FILE="$COMPONENTS_DIR/${name}.md"
      if [[ ! -f "$FILE" ]]; then
        echo "error: component not found: $name" >&2
        echo "available: $(ls "$COMPONENTS_DIR"/*.md | xargs -n1 basename | sed 's/\.md$//' | grep -v INDEX | tr '\n' ' ')" >&2
        exit 2
      fi
      print_banner "Component: $name"
      extract_css_blocks "$FILE"
    done
    ;;

  all-components)
    for FILE in "$COMPONENTS_DIR"/*.md; do
      name=$(basename "$FILE" .md)
      [[ "$name" == "INDEX" ]] && continue
      print_banner "Component: $name"
      extract_css_blocks "$FILE"
    done
    ;;

  *)
    echo "error: unknown mode: $MODE" >&2
    echo "usage: $0 {preset|component|all-components} ..." >&2
    exit 2
    ;;
esac
