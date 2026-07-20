---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates an isolated workspace with git worktree add, then switches the session in via native tools when available
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Create the worktree with `git worktree add` so directory placement stays under your control, then switch the session into it — preferring your platform's native session-switch tool.

**Core principle:** Detect existing isolation first. Create with git (you choose the directory). Enter with the native tool. Never fight the harness.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Step 0: Detect Existing Isolation

**Before creating anything, check if you are already in an isolated workspace.**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

```bash
# If this returns a path, you're in a submodule, not a worktree — treat as normal repo
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Skip to Step 3 (Project Setup). Do NOT create another worktree.

Report with branch state:
- On a branch: "Already in isolated workspace at `<path>` on branch `<name>`."
- Detached HEAD: "Already in isolated workspace at `<path>` (detached HEAD, externally managed). Branch creation needed at finish time."

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, work in place and skip to Step 3.

## Step 1: Create the Worktree

**Always create with `git worktree add` — even when a native worktree tool exists.**

Native creation modes (e.g. `EnterWorktree` with `name` or no arguments) place the worktree in a fixed harness-chosen location (such as `.claude/worktrees/`). Creating with git keeps directory selection under your control; Step 2 then hands the session over to the native tool.

### Directory Selection

Follow this priority order. Explicit user preference always beats observed filesystem state.

1. **Check your instructions for a declared worktree directory preference.** If the user has already specified one, use it without asking.

2. **Check for an existing project-local worktree directory:**
   ```bash
   ls -d .worktrees 2>/dev/null     # Preferred (hidden)
   ls -d worktrees 2>/dev/null      # Alternative
   ```
   If found, use it. If both exist, `.worktrees` wins.

3. **Check for an existing global directory:**
   ```bash
   project=$(basename "$(git rev-parse --show-toplevel)")
   ls -d ~/.config/superpowers/worktrees/$project 2>/dev/null
   ```
   If found, use it (backward compatibility with legacy global path).

4. **If there is no other guidance available**, default to `.worktrees/` at the project root.

### Safety Verification (project-local directories only)

**MUST verify directory is ignored before creating worktree:**

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:** Add to .gitignore, commit the change, then proceed.

**Why critical:** Prevents accidentally committing worktree contents to repository.

Global directories (`~/.config/superpowers/worktrees/`) need no verification.

### Create the Worktree

```bash
project=$(basename "$(git rev-parse --show-toplevel)")

# Determine path based on chosen location
# For project-local: path="$LOCATION/$BRANCH_NAME"
# For global: path="~/.config/superpowers/worktrees/$project/$BRANCH_NAME"

git worktree add "$path" -b "$BRANCH_NAME"
```

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell the user the sandbox blocked worktree creation and you're working in the current directory instead. Then run setup and baseline tests in place.

## Step 2: Enter the Worktree

`git worktree add` does not change your working directory — persist the switch before doing anything else.

### 2a. Native Session-Switch Tool (preferred)

If you have a tool that can switch the session into an **existing** worktree — e.g. `EnterWorktree` with its `path` parameter — use it now:

```
EnterWorktree(path="$path")
```

The session's working directory persists across commands; no repeated `cd` prefixes.

- **Never use the tool's create mode** (`EnterWorktree()` with no arguments, or with `name`) — it creates the worktree itself in a harness-chosen directory, bypassing Step 1's directory selection.
- Leaving later: `ExitWorktree(action="keep")`. Worktrees entered via `path` are not auto-removed — clean up with `git worktree remove` when the work is done.

### 2b. cd Fallback

No native session-switch tool: `cd "$path"`. If your harness resets cwd between shell commands, re-`cd` at the start of each command.

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
| Already in linked worktree | Skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Creating the worktree | Always `git worktree add "$path" -b "$BRANCH_NAME"` (Step 1) |
| Native session-switch tool available | Enter via its path mode, e.g. `EnterWorktree(path=...)` (Step 2a) |
| No native tool | `cd "$path"` (Step 2b) |
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check instruction file, then default `.worktrees/` |
| Global path exists | Use it (backward compat) |
| Directory not ignored | Add to .gitignore + commit |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Creating via the native tool's create mode

- **Problem:** `EnterWorktree(name=...)` / no-arg creation drops the worktree in a harness-chosen directory, ignoring Step 1's directory selection
- **Fix:** Create with `git worktree add`; the native tool only enters via `path` (Step 2a)

### Forgetting to enter after creating

- **Problem:** `git worktree add` doesn't change cwd; commands keep running in the main checkout
- **Fix:** Step 2 immediately after creation — native path mode, or cd

### Skipping detection

- **Problem:** Creating a nested worktree inside an existing one
- **Fix:** Always run Step 0 before creating anything

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: existing > global legacy > instruction file > default

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

## Red Flags

**Never:**
- Create a worktree when Step 0 detects existing isolation
- Create via the native tool (`EnterWorktree()` / `EnterWorktree(name=...)`). This is the #1 mistake — create with `git worktree add`, enter with `path` mode.
- Stay in the main checkout after `git worktree add` (skipping Step 2)
- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking

**Always:**
- Run Step 0 detection first
- Create with `git worktree add "$path" -b "$BRANCH_NAME"`
- Enter via the native session-switch tool (`path` mode) when available; cd otherwise
- Follow directory priority: existing > global legacy > instruction file > default
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline
