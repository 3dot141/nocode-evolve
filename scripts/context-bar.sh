#!/bin/bash
# Accent color for model name: gray, orange, blue, teal, green, lavender, rose, gold, slate, cyan
# (context bar + percentage are auto-colored by usage threshold, independent of this)
COLOR="teal"

# --- palette (256-color) ---
C_RESET='\033[0m'
C_TEXT='\033[38;5;250m'    # primary text
C_DIM='\033[38;5;240m'     # separators / secondary
C_EMPTY='\033[38;5;236m'   # empty context-bar cells (dim track)
C_GREEN='\033[38;5;108m'   # context < 50%
C_YELLOW='\033[38;5;179m'  # context 50-80%
C_RED='\033[38;5;167m'     # context > 80%
C_WARN='\033[38;5;173m'    # git ahead/behind warning (orange)
C_DIRTY='\033[38;5;178m'   # git uncommitted files (gold)
case "$COLOR" in
    orange)   C_ACCENT='\033[38;5;173m' ;;
    blue)     C_ACCENT='\033[38;5;74m' ;;
    teal)     C_ACCENT='\033[38;5;73m' ;;
    green)    C_ACCENT='\033[38;5;108m' ;;
    lavender) C_ACCENT='\033[38;5;139m' ;;
    rose)     C_ACCENT='\033[38;5;132m' ;;
    gold)     C_ACCENT='\033[38;5;136m' ;;
    slate)    C_ACCENT='\033[38;5;67m' ;;
    cyan)     C_ACCENT='\033[38;5;37m' ;;
    gray)     C_ACCENT='\033[38;5;245m' ;;
    *)        C_ACCENT="$C_TEXT" ;;
esac

input=$(cat)

# truncate a string to N visible chars with an ellipsis
trunc() {
    local s="$1" n="$2"
    if [[ ${#s} -gt $n ]]; then printf '%s…' "${s:0:$((n - 1))}"; else printf '%s' "$s"; fi
}

# --- directories ---
# Entry dir  = where the session launched (gray anchor); git-normalized to repo name
#              so worktrees show a short, stable name instead of the long branch dir.
# Current dir= cwd after any `cd`; shown as a subpath only when it differs from entry.
entry_cwd=$(echo "$input" | jq -r '.workspace.project_dir // .cwd // empty')
cwd=$(echo "$input" | jq -r '.cwd // .workspace.current_dir // empty')

anchor=$(basename "$entry_cwd" 2>/dev/null || echo "?")
if [[ -n "$entry_cwd" && -d "$entry_cwd" ]]; then
    ecommon=$(git -C "$entry_cwd" rev-parse --git-common-dir 2>/dev/null)
    if [[ -n "$ecommon" ]]; then
        case "$ecommon" in /*) ;; *) ecommon="$entry_cwd/$ecommon" ;; esac
        anchor=$(basename "$(dirname "$ecommon")")
    fi
fi

cur=""
if [[ -n "$cwd" && "$cwd" != "$entry_cwd" ]]; then
    case "$cwd" in
        "$entry_cwd"/*) cur="${cwd#"$entry_cwd"/}" ;;  # under entry -> relative subpath
        *)              cur=$(basename "$cwd") ;;        # elsewhere   -> basename
    esac
fi

# Get git branch + compact, color-coded status (files / sync), from the current dir
branch=""
git_info=""
if [[ -n "$cwd" && -d "$cwd" ]]; then
    branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
    if [[ -n "$branch" ]]; then
        file_count=$(git -C "$cwd" --no-optional-locks status --porcelain -uall 2>/dev/null | wc -l | tr -d ' ')

        sep=""
        # uncommitted files (omit when clean)
        if [[ "$file_count" -gt 0 ]]; then
            git_info+="${C_DIRTY}${file_count}±"
            sep=" "
        fi

        # sync status vs upstream
        upstream=$(git -C "$cwd" rev-parse --abbrev-ref @{upstream} 2>/dev/null)
        if [[ -n "$upstream" ]]; then
            # last sync time (FETCH_HEAD or remote ref mtime, whichever newer)
            now=$(date +%s)
            last_sync_time=""
            fetch_head="$cwd/.git/FETCH_HEAD"
            if [[ -f "$fetch_head" ]]; then
                fetch_time=$(stat -f %m "$fetch_head" 2>/dev/null || stat -c %Y "$fetch_head" 2>/dev/null)
                [[ -n "$fetch_time" ]] && last_sync_time=$fetch_time
            fi
            remote_ref="$cwd/.git/refs/remotes/${upstream}"
            if [[ -f "$remote_ref" ]]; then
                ref_time=$(stat -f %m "$remote_ref" 2>/dev/null || stat -c %Y "$remote_ref" 2>/dev/null)
                if [[ -n "$ref_time" && ( -z "$last_sync_time" || "$ref_time" -gt "$last_sync_time" ) ]]; then
                    last_sync_time=$ref_time
                fi
            fi
            sync_ago=""
            if [[ -n "$last_sync_time" ]]; then
                diff=$((now - last_sync_time))
                if [[ $diff -lt 60 ]]; then sync_ago="<1m"
                elif [[ $diff -lt 3600 ]]; then sync_ago="$((diff / 60))m"
                elif [[ $diff -lt 86400 ]]; then sync_ago="$((diff / 3600))h"
                else sync_ago="$((diff / 86400))d"
                fi
            fi

            counts=$(git -C "$cwd" rev-list --left-right --count HEAD...@{upstream} 2>/dev/null)
            ahead=$(echo "$counts" | cut -f1)
            behind=$(echo "$counts" | cut -f2)
            if [[ "$ahead" -eq 0 && "$behind" -eq 0 ]]; then
                tok="✓"; [[ -n "$sync_ago" ]] && tok="✓ ${sync_ago}"
                git_info+="${sep}${C_GREEN}${tok}"
            elif [[ "$ahead" -gt 0 && "$behind" -eq 0 ]]; then
                git_info+="${sep}${C_WARN}${ahead}↑"
            elif [[ "$ahead" -eq 0 && "$behind" -gt 0 ]]; then
                git_info+="${sep}${C_WARN}${behind}↓"
            else
                git_info+="${sep}${C_WARN}${ahead}↑${behind}↓"
            fi
        else
            git_info+="${sep}${C_DIM}no upstream"
        fi
    fi
fi

# Context window: size from JSON, occupancy computed from transcript
# (transcript usage is more accurate than total_input_tokens, which excludes
#  system prompt/tools/memory. See github.com/anthropics/claude-code/issues/13652)
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
max_context=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
max_k=$((max_context / 1000))
if [[ $max_k -ge 1000 ]]; then max_disp="$((max_k / 1000))M"; else max_disp="${max_k}k"; fi
baseline=20000
bar_width=10

context_length=0
if [[ -n "$transcript_path" && -f "$transcript_path" ]]; then
    context_length=$(jq -s '
        map(select(.message.usage and .isSidechain != true and .isApiErrorMessage != true)) |
        last |
        if . then
            (.message.usage.input_tokens // 0) +
            (.message.usage.cache_read_input_tokens // 0) +
            (.message.usage.cache_creation_input_tokens // 0)
        else 0 end
    ' < "$transcript_path")
fi

if [[ "$context_length" -gt 0 ]]; then
    pct=$((context_length * 100 / max_context))
    pct_prefix=""
else
    # conversation start: ~baseline already loaded
    pct=$((baseline * 100 / max_context))
    pct_prefix="~"
fi
[[ $pct -gt 100 ]] && pct=100

# pick threshold color for bar + percentage
if [[ $pct -lt 50 ]]; then C_CTX="$C_GREEN"
elif [[ $pct -lt 80 ]]; then C_CTX="$C_YELLOW"
else C_CTX="$C_RED"
fi

# sub-cell resolution: fill in 1/8 steps so low % still shows a colored sliver
parts=(" " "▏" "▎" "▍" "▌" "▋" "▊" "▉")
total_eighths=$((pct * bar_width * 8 / 100))
full=$((total_eighths / 8))
rem=$((total_eighths % 8))
[[ $full -gt $bar_width ]] && full=$bar_width
bar=""
for ((i=0; i<bar_width; i++)); do
    if [[ $i -lt $full ]]; then
        bar+="${C_CTX}█"
    elif [[ $i -eq $full && $rem -gt 0 ]]; then
        bar+="${C_CTX}${parts[$rem]}"
    else
        bar+="${C_EMPTY}░"
    fi
done
ctx="${bar} ${C_CTX}${pct_prefix}${pct}%${C_DIM}·${C_TEXT}${max_disp}"

# Line: [entry(gray) ·] cur · branch <changes> · context
# When cwd == entry (no cd), collapse to a single accent dir; otherwise prefix the
# gray entry anchor and show the current subpath in accent.
if [[ -n "$cur" ]]; then
    output="${C_DIM}${anchor}${C_DIM} · ${C_ACCENT}${cur}"
else
    output="${C_ACCENT}${anchor}"
fi
if [[ -n "$branch" ]]; then
    output+="${C_DIM} · ${C_TEXT}${branch}"
    [[ -n "$git_info" ]] && output+=" ${git_info}"
fi
output+="${C_DIM} · ${ctx}"
printf '%b\n' "${output}${C_RESET}"
