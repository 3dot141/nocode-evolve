#!/usr/bin/env bash
# Plain git worktree creation for the using-git-worktrees skill.
#
# Contract:
#   create-worktree.sh --branch <name> --base <ref>
#
# Success (exit 0): one JSON line on stdout —
#   {"path":"...","branch":"...","base":"..."}
# Failure (exit != 0): human-readable reason on stderr. Conflicts that need a
# user decision (existing path, existing branch) always fail here instead of
# guessing; the skill asks.
set -euo pipefail

usage() { echo "usage: $0 --branch <name> --base <ref>" >&2; exit 2; }

BRANCH="" BASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="${2:?missing value}"; shift 2 ;;
    --base) BASE="${2:?missing value}"; shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$BRANCH" ] && [ -n "$BASE" ] || usage

fail() { echo "create-worktree: $1" >&2; exit 1; }

# --- resolve repo root --------------------------------------------------------
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git repository"

# --- create: plain git worktree add at the flat sibling path ------------------
# Sibling of the checkout the caller is working in (PROJECT_ROOT); not the
# repo's main worktree.
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
printf '{"path":"%s","branch":"%s","base":"%s"}\n' "$worktree_path" "$BRANCH" "$BASE"
exit 0
