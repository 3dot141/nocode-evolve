#!/usr/bin/env bash
# check-preflight.sh — design-doc HTML Pre-Flight 自动检查
#
# 用法：
#   bash check-preflight.sh <path-to-rendered.html>
#
# 检查项（来自 SKILL.md「Pre-Flight Check」节里能机器验证的部分）：
#   1. 字体黑名单（Inter / Roboto / Arial / Space Grotesk）
#   2. 文件大小 ≤ 200KB
#   3. 5 必有交互的关键标识
#   4. prefers-color-scheme 不作 primary 切换源
#   5. AI slop 文案黑名单
#
# 输出：每项 PASS / WARN / FAIL，最后给 summary。非 0 退出 = 有 FAIL。

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <path-to-rendered.html>" >&2
  exit 2
fi

HTML="$1"

if [[ ! -f "$HTML" ]]; then
  echo "error: file not found: $HTML" >&2
  exit 2
fi

# ANSI colors
RED='\033[0;31m'
YEL='\033[0;33m'
GRN='\033[0;32m'
DIM='\033[0;90m'
NC='\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() { printf "${GRN}✓ PASS${NC}  %s\n" "$1"; PASS_COUNT=$((PASS_COUNT+1)); }
warn() { printf "${YEL}⚠ WARN${NC}  %s\n" "$1"; WARN_COUNT=$((WARN_COUNT+1)); }
fail() { printf "${RED}✗ FAIL${NC}  %s\n" "$1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
dim()  { printf "${DIM}        %s${NC}\n" "$1"; }

echo "Pre-Flight Check: $HTML"
echo "──────────────────────────────────────────────"

# ─── 1. 字体黑名单 ──────────────────────────────────
echo ""
echo "[1] 字体黑名单（NEVER: Inter / Roboto / Arial / Space Grotesk）"

NEVER_FONTS=("Inter" "Roboto" "Arial" "Space Grotesk")
FONT_HIT=0
for f in "${NEVER_FONTS[@]}"; do
  # 只在 font-family / Google Fonts URL 上下文检查，避免误伤正文出现 "Inter"
  if grep -E -q "font-family:[^;]*['\"]${f}['\"]|family=${f}[:&+]" "$HTML"; then
    fail "命中 NEVER 字体: $f"
    dim "  在 font-family 或 Google Fonts URL 出现"
    FONT_HIT=1
  fi
done
[[ $FONT_HIT -eq 0 ]] && pass "字体黑名单清白"

# ─── 2. 文件大小 ≤ 200KB ───────────────────────────
echo ""
echo "[2] 文件大小（≤ 200KB）"

SIZE_BYTES=$(wc -c < "$HTML" | tr -d ' ')
SIZE_KB=$((SIZE_BYTES / 1024))

if [[ $SIZE_BYTES -le 204800 ]]; then
  pass "文件 ${SIZE_KB} KB（${SIZE_BYTES} bytes）"
elif [[ $SIZE_BYTES -le 307200 ]]; then
  warn "文件 ${SIZE_KB} KB 超过 200KB 软上限"
  dim "  考虑章节折叠 / SVG 压缩 / 移除内嵌大字体"
else
  fail "文件 ${SIZE_KB} KB 严重超标（> 300KB）"
fi

# ─── 3. 5 必有交互 ─────────────────────────────────
echo ""
echo "[3] 5 必有交互"

# 3.1 TOC 侧栏
if grep -E -q 'class="[^"]*\btoc\b' "$HTML" || grep -E -q '<nav[^>]+toc' "$HTML"; then
  pass "TOC 侧栏（找到 .toc 标识）"
else
  fail "TOC 侧栏缺失（未找到 class=\"...toc...\"）"
fi

# 3.2 章节折叠
DETAILS_COUNT=$(grep -E -c '<details\b' "$HTML" || true)
if [[ $DETAILS_COUNT -gt 0 ]]; then
  pass "章节折叠（找到 $DETAILS_COUNT 个 <details>）"
else
  warn "未找到 <details> —— 短文档可省，长文档应有"
fi

# 3.3 light/dark toggle
THEME_TOGGLE_HIT=0
if grep -E -q 'class="[^"]*theme-toggle\b' "$HTML"; then
  THEME_TOGGLE_HIT=1
fi
if grep -E -q "id=['\"]themeToggle['\"]" "$HTML"; then
  THEME_TOGGLE_HIT=1
fi
if [[ $THEME_TOGGLE_HIT -eq 1 ]] && grep -q "localStorage" "$HTML" && grep -q 'data-theme' "$HTML"; then
  pass "light/dark toggle（含 localStorage + data-theme）"
elif [[ $THEME_TOGGLE_HIT -eq 1 ]]; then
  warn "找到 theme-toggle 但 localStorage / data-theme 不完整"
else
  fail "light/dark toggle 缺失"
fi

# 3.4 代码高亮
if grep -E -q 'class="[^"]*\bhljs\b' "$HTML" || \
   grep -E -q 'class="[^"]*\blanguage-' "$HTML" || \
   grep -q 'highlight\.js' "$HTML" || \
   grep -q 'prism' "$HTML"; then
  pass "代码高亮（找到 hljs / language- / highlight.js / prism 标识）"
else
  warn "未找到代码高亮标识 —— 若文档无代码块可忽略"
fi

# 3.5 回到顶部
if grep -E -q 'class="[^"]*back-to-top\b' "$HTML" || \
   grep -E -q "id=['\"]backToTop['\"]" "$HTML"; then
  pass "回到顶部按钮"
else
  fail "回到顶部按钮缺失"
fi

# ─── 4. prefers-color-scheme 不作 primary ─────────
echo ""
echo "[4] prefers-color-scheme 不作 primary 切换源"

if grep -q "prefers-color-scheme" "$HTML"; then
  # 进一步检查是否在 media query 内
  if grep -E -q '@media[^{]*prefers-color-scheme' "$HTML"; then
    warn "出现 @media (prefers-color-scheme) —— SKILL 要求按时间不按 system 偏好"
    dim "  允许作为 secondary fallback，但 primary 必须是 localStorage + getHours()"
  else
    pass "prefers-color-scheme 不在 @media 内（OK）"
  fi
else
  pass "未出现 prefers-color-scheme"
fi

# ─── 5. AI slop 文案黑名单 ─────────────────────────
echo ""
echo "[5] AI slop 文案黑名单"

# 限定在 body 文本内大概率出现的 slop（避免误伤 css/js 关键字）
SLOP_PATTERNS=(
  "Elevate your"
  "Seamlessly"
  "Unleash"
  "Next-Gen"
  "Cutting-edge"
  "深入探讨"
  "核心要素"
  "John Doe"
  "Jane Doe"
  "Acme Corp"
  "SmartFlow"
)
SLOP_HIT=0
for p in "${SLOP_PATTERNS[@]}"; do
  if grep -F -q "$p" "$HTML"; then
    warn "命中 AI slop: \"$p\""
    SLOP_HIT=1
  fi
done
[[ $SLOP_HIT -eq 0 ]] && pass "未命中 AI slop 黑名单"

# ─── 6. 整数百分比假数据（轻量检查） ─────────────
echo ""
echo "[6] 整数百分比假数据"

# 在文本节点内（不在 CSS 内）查找 "99.99%" / "100%" 这种可疑数字
# 简单启发：在 <p>/<li>/<td> 上下文出现的连续整数 %
FAKE_PCT=$(grep -E -o '>[^<]*\b(99\.99|99\.9|100|50)%[^<]*<' "$HTML" | head -5 || true)
if [[ -n "$FAKE_PCT" ]]; then
  warn "可能命中整数百分比假数据："
  echo "$FAKE_PCT" | sed 's/^/        /'
else
  pass "未发现整数百分比假数据"
fi

# ─── Summary ─────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────"
printf "Summary: ${GRN}%d PASS${NC}  ${YEL}%d WARN${NC}  ${RED}%d FAIL${NC}\n" \
  "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "→ 有 FAIL 项，请修复后再 ship。"
  exit 1
fi
if [[ $WARN_COUNT -gt 0 ]]; then
  echo "→ 有 WARN 项，确认是预期行为后可放行。"
  exit 0
fi
echo "→ 全部 PASS。"
exit 0
