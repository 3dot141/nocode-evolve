# statusline 第二行 usage 配速条 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 nocode-evolve 插件加一个 statusline 脚本——第一行原样移植 context-bar.sh,第二行新增日/周 usage pacing 配速条(读原生 stdin rate_limits,缺失降级隐藏),并提供一键接线命令。

**Architecture:** 脚本 `scripts/statusline.sh` 自包含:复制 context-bar.sh 全部 line1 逻辑,在其 printf 之后追加 line2 构建逻辑;line2 读 `$input`(已 `cat` 的 stdin)中的 `rate_limits`。`/statusline-setup` 命令把 `~/.claude/settings.json` 的 statusLine.command 指向该脚本绝对路径。

**Tech Stack:** bash + jq(context-bar.sh 已依赖),ANSI 256-color,CC 原生 statusline stdin。

设计见 `docs/superpowers/specs/3dot141/260528-statusline-usage-line2-design.md`。

---

## File Structure

- Create: `scripts/statusline.sh` —— statusline 主脚本(line1 移植 + line2 新增)
- Create: `commands/statusline-setup.md` —— `/statusline-setup` 接线命令
- Modify: `.claude-plugin/plugin.json:4` —— version 2.7.0 → 2.8.0
- Modify(运行时,非 repo): `~/.claude/settings.json` —— statusLine.command 指向脚本

---

### Task 1: statusline.sh —— line1 移植 + line2 配速条

**Files:**
- Create: `scripts/statusline.sh`
- 参考: `~/.claude/scripts/context-bar.sh`(line1 逻辑来源)

- [ ] **Step 1: 复制 context-bar.sh 全文作为基底**

把 `~/.claude/scripts/context-bar.sh` 1-176 行原样复制到 `scripts/statusline.sh`。这部分产出 line1,逻辑/配色一字不改。

- [ ] **Step 2: 在 palette 段补两个颜色**

在 `C_DIRTY` 那行之后(约第 15 行)追加:

```bash
C_WHITE='\033[38;5;253m'   # pacing marker
C_LABEL='\033[38;5;245m'   # 日/周 labels
```

- [ ] **Step 3: 在 line1 的 `printf '%b\n' "${output}${C_RESET}"` 之后追加 line2 逻辑**

```bash
# ====================== Line 2: usage rate limits (日/周) ======================
now=$(date +%s)

# threshold color by used pct (int)
tcolor() {
    local p=$1
    if [[ $p -lt 50 ]]; then printf '%b' "$C_GREEN"
    elif [[ $p -lt 80 ]]; then printf '%b' "$C_YELLOW"
    else printf '%b' "$C_RED"; fi
}

# countdown: seconds -> "42m" / "4h42m" / "5d8h"
fmt_countdown() {
    local s=$1
    [[ $s -lt 0 ]] && s=0
    if [[ $s -lt 3600 ]]; then printf '%dm' $((s / 60))
    elif [[ $s -lt 86400 ]]; then printf '%dh%dm' $((s / 3600)) $(((s % 3600) / 60))
    else printf '%dd%dh' $((s / 86400)) $(((s % 86400) / 3600)); fi
}

# pacing bar: used_pct pace_pct width -> colored 8-cell bar with white | marker
pbar() {
    local used=$1 pace=$2 width=$3 col
    col=$(tcolor "$used")
    local full=$((used * width / 100)); [[ $full -gt $width ]] && full=$width
    local pidx=$((pace * width / 100))
    [[ $pidx -ge $width ]] && pidx=$((width - 1)); [[ $pidx -lt 0 ]] && pidx=0
    local out="" i
    for ((i = 0; i < width; i++)); do
        if [[ $i -eq $pidx ]]; then out+="${C_WHITE}│"
        elif [[ $i -lt $full ]]; then out+="${col}█"
        else out+="${C_EMPTY}░"; fi
    done
    printf '%b' "$out"
}

# build one segment (label window_seconds used_pct resets_at) -> string or empty
build_seg() {
    local label=$1 window=$2 pct_raw=$3 reset=$4
    [[ -z "$pct_raw" || -z "$reset" ]] && return
    local pct remain pace col
    pct=$(printf '%.0f' "$pct_raw")
    remain=$((reset - now)); [[ $remain -lt 0 ]] && remain=0
    pace=$(((window - remain) * 100 / window)); [[ $pace -lt 0 ]] && pace=0; [[ $pace -gt 100 ]] && pace=100
    col=$(tcolor "$pct")
    printf '%b' "${C_LABEL}${label} $(pbar "$pct" "$pace" 8) ${col}${pct}%%${C_DIM} ${C_TEXT}$(fmt_countdown "$remain")"
}

five_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
seven_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

seg_five=$(build_seg "日" 18000 "$five_pct" "$five_reset")
seg_seven=$(build_seg "周" 604800 "$seven_pct" "$seven_reset")

line2=""
if [[ -n "$seg_five" && -n "$seg_seven" ]]; then
    line2="${seg_five}${C_DIM}   ${seg_seven}"
elif [[ -n "$seg_five" ]]; then line2="$seg_five"
elif [[ -n "$seg_seven" ]]; then line2="$seg_seven"
fi
[[ -n "$line2" ]] && printf '%b\n' "${line2}${C_RESET}"
```

- [ ] **Step 4: 测试——双窗口齐全输出 2 行**

```bash
cd /Users/yes365/AI/nocode-evolve
NOW=$(date +%s)
echo '{"cwd":"'$PWD'","context_window":{"context_window_size":1000000,"used_percentage":40},"rate_limits":{"five_hour":{"used_percentage":3,"resets_at":'$((NOW+16920))'},"seven_day":{"used_percentage":29,"resets_at":'$((NOW+460800))'}}}' | sh scripts/statusline.sh | sed 's/\x1b\[[0-9;]*m//g'
```

Expected: 2 行;第二行含 `日`、`3%`、`4h42m`、`周`、`29%`、`5d8h`。

- [ ] **Step 5: 测试——无 rate_limits 退回单行**

```bash
echo '{"cwd":"'$PWD'","context_window":{"context_window_size":1000000,"used_percentage":40}}' | sh scripts/statusline.sh | sed 's/\x1b\[[0-9;]*m//g' | wc -l
```

Expected: `1`(只有 line1)。

- [ ] **Step 6: 测试——仅 five_hour / 跨阈值红色**

```bash
NOW=$(date +%s)
echo '{"cwd":"'$PWD'","rate_limits":{"five_hour":{"used_percentage":85,"resets_at":'$((NOW+600))'}}}' | sh scripts/statusline.sh | sed 's/\x1b\[[0-9;]*m//g'
```

Expected: 第二行只有 `日`,含 `85%`、`10m`,无 `周`。(原始未 strip 时 85% 段应是红色 `38;5;167`。)

---

### Task 2: /statusline-setup 命令

**Files:**
- Create: `commands/statusline-setup.md`

- [ ] **Step 1: 写命令文件**

```markdown
---
description: 把 Claude Code 的 statusLine 接到 nocode-evolve 的 scripts/statusline.sh（日/周 usage 配速条），写入 ~/.claude/settings.json
---

# /statusline-setup — 接线 statusline

把 `~/.claude/settings.json` 的 `statusLine.command` 指向本插件的 `scripts/statusline.sh`（第一行 context-bar 风 + 第二行日/周 usage 配速条）。

## 你要做的

### 1. 解析脚本绝对路径
- 优先用插件根：若环境有 `${CLAUDE_PLUGIN_ROOT}`，路径 = `${CLAUDE_PLUGIN_ROOT}/scripts/statusline.sh`。
- 否则用本仓库 dev 路径：`/Users/yes365/AI/nocode-evolve/scripts/statusline.sh`。
- 用 Bash 确认该文件存在（`test -f`），不存在则报错停止。

### 2. 更新 settings.json（保留其余字段、幂等）
读 `~/.claude/settings.json`，把 `statusLine` 设为：

\`\`\`json
{ "type": "command", "command": "sh <上一步解析的绝对路径>" }
\`\`\`

用 jq 原子更新，保留所有其他 key：

\`\`\`bash
SCRIPT="<绝对路径>"
TMP=$(mktemp)
jq --arg cmd "sh $SCRIPT" '.statusLine = {type:"command", command:$cmd}' ~/.claude/settings.json > "$TMP" && mv "$TMP" ~/.claude/settings.json
\`\`\`

### 3. 确认
打印新的 statusLine 配置；提示用户旧的 context-bar.sh 仍保留作回退，重启 / 新会话即生效。
```

- [ ] **Step 2: 校验 frontmatter 可被解析(无语法错)**

```bash
head -3 commands/statusline-setup.md
```

Expected: 见到 `---` / `description:` / `---`。

---

### Task 3: 接线 settings.json + bump 版本

**Files:**
- Modify: `~/.claude/settings.json`(运行时)
- Modify: `.claude-plugin/plugin.json:4`

- [ ] **Step 1: 备份并接线 settings.json**

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.bak.$(date +%s)
SCRIPT=/Users/yes365/AI/nocode-evolve/scripts/statusline.sh
TMP=$(mktemp)
jq --arg cmd "sh $SCRIPT" '.statusLine = {type:"command", command:$cmd}' ~/.claude/settings.json > "$TMP" && mv "$TMP" ~/.claude/settings.json
jq '.statusLine' ~/.claude/settings.json
```

Expected: `{ "type": "command", "command": "sh /Users/yes365/AI/nocode-evolve/scripts/statusline.sh" }`

- [ ] **Step 2: bump plugin.json version 2.7.0 → 2.8.0**

Edit `.claude-plugin/plugin.json`:`"version": "2.7.0"` → `"version": "2.8.0"`。

- [ ] **Step 3: commit**

```bash
git add scripts/statusline.sh commands/statusline-setup.md .claude-plugin/plugin.json docs/superpowers/plans/3dot141/260528-statusline-usage-line2.md
git commit -m "feat(statusline): 新增日/周 usage 配速条第二行 + statusline-setup 命令, bump 2.8.0"
```

(若 1Password 签名失败 → 保持 staged,报告用户,不绕签名。)

---

## Self-Review

- **Spec 覆盖**:line1 移植(T1S1)、line2 pacing(T1S3)、降级隐藏(T1S3 line2 拼装 + T1S5 测试)、native 数据源(T1S3 jq)、setup 命令(T2)、接线(T3S1)、版本(T3S2)——全覆盖。
- **Placeholder**:无 TBD;命令文件 `<绝对路径>` 是运行时解析,已给 jq 实现。
- **类型/命名一致**:`tcolor`/`pbar`/`fmt_countdown`/`build_seg` 定义与调用一致;窗口常量 18000/604800 与 spec 一致。
- **风险**:`%%` 在 printf 内转义出字面 `%`(已用 `${pct}%%`);used_percentage 浮点用 `printf '%.0f'` 取整。
