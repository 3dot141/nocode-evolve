---
name: using-git-worktrees
description: Use when feature work or an implementation plan needs an isolated Git worktree. Not for an already-isolated workspace, read-only Git inspection, or branchless single-file edits.
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Resolve the branch and absolute target directory in the business flow, then use the current platform's native worktree behavior.

**Core principle:** Detect existing isolation first. The caller chooses the directory; the platform must use that exact absolute path.

Inspect Git state with read-only commands. Create the worktree with `git worktree add "<absolute-worktree-path>" -b "<branch>" "<confirmed-base>"`, then use `EnterWorktree` with the returned absolute path.


**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Step 0: Detect Existing Isolation

**Before creating anything, check if you are already in an isolated workspace.**

Use `git rev-parse --show-toplevel`, `git rev-parse --git-dir`, `git rev-parse --git-common-dir`, `git branch --show-current`, and `git status --short` to inspect the current root, branch and linked-worktree status.

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

Distinguish a linked worktree from a submodule before treating it as isolated; a submodule is treated as a normal checkout.

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Before deciding whether to reuse it or create another worktree, inspect the current branch and `git status --short`.

Report with branch and working-tree state:
- On a branch: "Already in isolated workspace at `<path>` on branch `<name>`."
- Detached HEAD: "Already in isolated workspace at `<path>` (detached HEAD, externally managed). Branch creation needed at finish time."

Then classify the current branch:

- **Default base worktree:** the branch name is exactly `release`, `feature`, `main`, `master`, or `persist`. This linked worktree is allowed to be the start point for a new task worktree. Report the proposed start point and ask, "Create a new task worktree from `<branch>`?" If the working tree is dirty, list the changed paths and warn that uncommitted changes are not included in the new worktree. Wait for explicit confirmation, then continue to Step 1 with `startPoint` set to the confirmed branch. If the user declines or does not confirm, stop Env.
- **Any other linked worktree:** treat it as an existing task workspace; do not create another worktree from it. If clean, ask, "Continue in this existing worktree and run setup/baseline checks?" If dirty, list the changed paths, state that they will be treated as pre-existing baseline and kept outside the task's changes, then ask, "Continue with these existing changes as the baseline?" Wait for explicit confirmation, then skip to Step 3. If the user declines or does not confirm, stop Env and ask which workspace they want to use.
- **Detached HEAD:** do not use it as a default base. Ask whether to continue in place as an externally managed workspace; on confirmation skip to Step 3, otherwise stop Env.

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, work in place and skip to Step 3.

## Step 1: Create the Worktree

**Always create with an explicit branch, confirmed base and absolute path.** The platform cannot choose a different directory or silently reuse another workspace.

### Directory Selection

Use one flat sibling template for every repository:

```text
<project-parent>/<project-name>-<branch-flat>/
```

Derive it deterministically:

```bash
project_root="$(git rev-parse --show-toplevel)"
project_parent="$(dirname "$project_root")"
project_name="$(basename "$project_root")"
branch_flat="${BRANCH_NAME//\//_}"
worktree_path="${project_parent}/${project_name}-${branch_flat}"
```

Do not inspect or reuse project-local or user-level worktree container directories. The sibling path is outside
the repository, so it cannot pollute the main checkout and does not require a `.gitignore` change.

If the derived path already exists, inspect `git worktree list --porcelain` and the directory before acting:

- registered worktree for the intended branch → ask whether to reuse it;
- empty or clearly stale unregistered directory → ask before removing it;
- any other content → report the conflict and stop.

### Create the Worktree

```bash
git worktree add "<absolute-worktree-path>" -b "<BRANCH_NAME>" "<confirmed-base-branch>"
```

Omit `startPoint` only when no explicit base was selected. A dirty base worktree contributes its committed branch tip only; never imply that uncommitted changes were copied.

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell the user the sandbox blocked worktree creation and you're working in the current directory instead. Then run setup and baseline tests in place.

## Step 2: Enter the Worktree

Creation does not implicitly change the active workspace. Enter it before doing anything else.

### 2a. Enter using the platform block above

- **Claude:** use the platform-native entry operation with the absolute existing path.
- **Codex:** bind every subsequent file and command operation to the target's absolute `workdir`. If a later call omits that binding, stop rather than operating in the old workspace.

- Never omit `path` or pass `.`; the contract requires the absolute existing worktree path.
- To leave later, enter the absolute main-worktree path. Entering does not remove the feature worktree.

### 2b. Failure handling

There is no implicit path fallback. If native entry or explicit workdir binding fails, report it and stop before editing the old workspace.

## Step 3: Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

## Step 4: Verify Clean Baseline

Run tests to ensure workspace starts clean:

```bash
# Use project-appropriate command
npm test / cargo test / pytest / go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### Report

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| Linked worktree on `release`/`feature`/`main`/`master`/`persist` | Confirm it as `startPoint`, then create a new task worktree (Step 0) |
| Other linked worktree | Confirm reuse, then skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Creating from a confirmed base | `git worktree add "<absolute-path>" -b "<branch>" "<base>"` |
| Entering the worktree | Claude: native session entry; Codex: bind absolute `workdir` |
| Worktree location | `<project-parent>/<project-name>-<branch-flat>/` |
| Derived path exists | Classify registered reuse, stale directory, or real conflict before acting |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Leaving the path implicit

- **Problem:** a missing or relative path makes workspace identity ambiguous
- **Fix:** calculate the destination first, create with explicit branch + absolute path, then enter that exact path

### Forgetting to enter after creating

- **Problem:** `git worktree add` doesn't change cwd; commands keep running in the main checkout
- **Fix:** Step 2 immediately after creation — Claude native entry or Codex explicit workdir binding

### Skipping detection

- **Problem:** Reusing a task worktree as an unintended base, or missing an allowed default base worktree
- **Fix:** Always run Step 0 and classify the exact current branch before creating anything

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Always derive the flat sibling path from project root and flattened branch name

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

## Red Flags

**Never:**
- Create from a linked worktree unless its branch is exactly `release`, `feature`, `main`, `master`, or `persist` and the user confirmed it as the base
- Continue from an existing linked worktree without explicit user confirmation
- Call the platform entry operation as if it could create a worktree. Creation and entry are separate steps.
- Run Codex operations without the entered worktree's explicit workdir after `git worktree add`
- Create a worktree inside a repository or a user-level container instead of the flat sibling path
- Skip baseline test verification
- Proceed with failing tests without asking

**Always:**
- Run Step 0 detection first
- Derive `<project-parent>/<project-name>-<branch-flat>/` before creation
- Create with `git worktree add` using the chosen absolute path
- Enter with Claude's native worktree entry; on Codex bind every later command to the absolute `workdir`
- Auto-detect and run project setup
- Verify clean test baseline
