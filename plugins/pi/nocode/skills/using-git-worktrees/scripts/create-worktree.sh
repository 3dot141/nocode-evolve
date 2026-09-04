#!/usr/bin/env bash
# Orca-first worktree creation with silent git fallback.
#
# Contract:
#   create-worktree.sh --branch <name> --base <ref> [--main-root <path>]
#
# Success (exit 0): one JSON line on stdout —
#   {"mode":"orca","path":"...","branch":"...","base":"..."}
#   {"mode":"git-fallback","path":"...","branch":"...","base":"...","note":"..."}
# Failure (exit != 0): human-readable reason on stderr. Conflicts that need a
# user decision (existing path, existing branch) always fail here instead of
# guessing; the skill asks.
#
# Why orca-first: `orca worktree create` persists the base ref in Orca
# metadata, so Orca's diff comparison targets the right branch from birth.
# Why silent fallback: the Orca desktop runtime is not always running; the
# task must still get an isolated worktree. The fallback is disclosed through
# the JSON "mode" field, never by blocking on a question.
set -euo pipefail

usage() { echo "usage: $0 --branch <name> --base <ref> [--main-root <path>]" >&2; exit 2; }

BRANCH="" BASE="" MAIN_ROOT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="${2:?missing value}"; shift 2 ;;
    --base) BASE="${2:?missing value}"; shift 2 ;;
    --main-root) MAIN_ROOT="${2:?missing value}"; shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$BRANCH" ] && [ -n "$BASE" ] || usage

# Extract a dotted field from a JSON document on stdin; empty string when absent.
json_field() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],JSON.parse(s));process.stdout.write(v==null?"":String(v))}catch(e){}})' "$1"
}

fail() { echo "create-worktree: $1" >&2; exit 1; }

# --- resolve repo roots ------------------------------------------------------
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git repository"
if [ -z "$MAIN_ROOT" ]; then
  MAIN_ROOT="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
fi
[ -n "$MAIN_ROOT" ] || fail "could not resolve the main worktree root"

emit() { # mode path note
  printf '{"mode":"%s","path":"%s","branch":"%s","base":"%s"%s}\n' \
    "$1" "$2" "$BRANCH" "$BASE" "${3:+,\"note\":\"$3\"}"
}

# --- 1a. probe the orca CLI ---------------------------------------------------
# Candidates: plugin bin first (if the host exposes one), then PATH, then the
# macOS app bundle directly — a /usr/local/bin shim can be a broken symlink,
# in which case the bundled CLI is the only working entry point. A candidate
# is usable only when `repo list --json` exits 0 AND answers ok:true — that
# proves CLI + running runtime together.
ORCA_CLI=""
REPOS_JSON=""
for candidate in "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/bin/orca" "$(command -v orca 2>/dev/null || true)" "/Applications/Orca.app/Contents/Resources/bin/orca"; do
  [ -n "$candidate" ] && [ -x "$candidate" ] || continue
  if out="$("$candidate" repo list --json 2>/dev/null)" && \
     [ "$(printf '%s' "$out" | json_field ok)" = "true" ]; then
    ORCA_CLI="$candidate" REPOS_JSON="$out"
    break
  fi
done

# Identify a checkout's repository family by its absolute git common dir.
# One family = one repo: the main worktree, linked worktrees and separate
# checkouts of the same clone all share it.
family_id() {
  local p="$1" d
  d="$(git -C "$p" rev-parse --git-common-dir 2>/dev/null)" || return 1
  case "$d" in /*) printf '%s\n' "$d" ;; *) printf '%s/%s\n' "$p" "$d" ;; esac
}

ORCA_NOTE=""
if [ -n "$ORCA_CLI" ]; then
  # --- 1b. resolve the Orca repo for this repository family ----------------
  # Reuse a registered repo whose checkout belongs to the same family (the
  # registered path may be any checkout of the clone, not only the main
  # worktree). Register the main worktree root only when nothing matches.
  REPO_REF=""
  THIS_FAMILY="$(family_id "$PROJECT_ROOT" 2>/dev/null || true)"
  if [ -n "$THIS_FAMILY" ]; then
    while IFS= read -r rp; do
      [ -n "$rp" ] || continue
      if [ "$(family_id "$rp" 2>/dev/null || true)" = "$THIS_FAMILY" ]; then
        REPO_REF="$rp"; break
      fi
    done <<EOF
$(printf '%s' "$REPOS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{(JSON.parse(s).result.repos||[]).forEach(r=>console.log(r.path))}catch(e){}})')
EOF
  fi
  if [ -z "$REPO_REF" ]; then
    REPO_REF="$MAIN_ROOT"
    "$ORCA_CLI" repo add --path "$MAIN_ROOT" --json >/dev/null 2>&1 \
      || fail "orca repo add failed for $MAIN_ROOT"
  fi

  # --- 1c. create through orca ----------------------------------------------
  # --no-parent: this skill creates independent task worktrees; without it
  #   Orca infers parent lineage from the caller context.
  # --base-branch: always explicit; never trust the repo default to resolve
  #   to the team's actual PR target line.
  # --setup skip: the skill's own setup step owns installs; no double run.
  if create_json="$("$ORCA_CLI" worktree create \
        --repo "path:$REPO_REF" \
        --name "$BRANCH" \
        --no-parent \
        --base-branch "$BASE" \
        --setup skip \
        --json 2>/dev/null)" && \
     [ "$(printf '%s' "$create_json" | json_field ok)" = "true" ]; then
    # --- 1d. restore the exact branch name ---------------------------------
    # Orca derives the branch from --name but flattens "/" to "-"
    # (feat/agent-task -> branch feat-agent-task; display name keeps slashes).
    wt_path="$(printf '%s' "$create_json" | json_field result.worktree.path)"
    wt_branch="$(printf '%s' "$create_json" | json_field result.worktree.branch)"
    [ -n "$wt_path" ] || fail "orca create succeeded but response had no result.worktree.path"
    derived="${wt_branch#refs/heads/}"
    if [ "$derived" != "$BRANCH" ]; then
      [ -z "$(git branch --list "$BRANCH")" ] \
        || fail "local branch '$BRANCH' already exists; resolve it before creating"
      git -C "$wt_path" branch -m "$derived" "$BRANCH"
    fi
    emit orca "$wt_path" ""
    exit 0
  fi
  # Orca creation failed on a live runtime — fall through, but keep the trail.
  ORCA_NOTE="orca create failed on a reachable runtime; check ~/orca/workspaces for partial state"
fi

# --- 1e. fallback: plain git worktree add at the flat sibling path -----------
# Sibling of the checkout the caller is working in (PROJECT_ROOT), matching
# the pre-Orca convention; not the family's main worktree.
project_parent="$(dirname "$PROJECT_ROOT")"
project_name="$(basename "$PROJECT_ROOT")"
branch_flat="${BRANCH//\//_}"
worktree_path="${project_parent}/${project_name}-${branch_flat}"
if [ -e "$worktree_path" ]; then
  fail "path already exists: $worktree_path — classify (registered reuse / stale / conflict) and ask the user; do not remove it automatically"
fi
[ -z "$(git branch --list "$BRANCH")" ] \
  || fail "local branch '$BRANCH' already exists; resolve it before creating"
git worktree add "$worktree_path" -b "$BRANCH" "$BASE" >/dev/null 2>&1 \
  || fail "git worktree add failed for base '$BASE'"
emit git-fallback "$worktree_path" "base ref NOT persisted in Orca metadata${ORCA_NOTE:+ ($ORCA_NOTE)}"
exit 0
