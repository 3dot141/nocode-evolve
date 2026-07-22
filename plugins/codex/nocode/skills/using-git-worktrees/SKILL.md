---
name: using-git-worktrees
description: "Use when feature work or an implementation plan needs an isolated Git worktree."
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Resolve the branch and absolute target directory in the business flow, then let the selected Workspace provider create and enter it.

**Core principle:** Detect existing isolation first. The caller chooses the directory; Workspace capabilities own platform-specific Git and session behavior.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Step 0: Detect Existing Isolation

**Before creating anything, check if you are already in an isolated workspace.**

Call `Capability(workspace.worktree.current, {})` and inspect its receipt for the current root, branch and linked-worktree status.

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git submodules. Before concluding "already in a worktree," verify you are not in a submodule:

The provider must distinguish a linked worktree from a submodule before returning `linked=true`; a submodule is treated as a normal checkout.

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

**Always create through `workspace.worktree.create` with an explicit branch and absolute path.** When Step 0 selected a default base worktree, also pass its confirmed branch as `startPoint`. The provider may use Git internally, but it cannot choose a different directory or silently enter creation mode.

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

```text
Capability(workspace.worktree.create, {"branch":"<BRANCH_NAME>","path":"<absolute-worktree-path>","startPoint":"<confirmed-base-branch>"})
```

Omit `startPoint` only when no explicit base was selected. A dirty base worktree contributes its committed branch tip only; never imply that uncommitted changes were copied.

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell the user the sandbox blocked worktree creation and you're working in the current directory instead. Then run setup and baseline tests in place.

## Step 2: Enter the Worktree

Creation does not implicitly change the active workspace. Enter it before doing anything else.

### 2a. Enter through the Workspace provider

```
Capability(workspace.worktree.enter, {"path":"<absolute-worktree-path>"})
```

The provider either persists the session workspace or binds subsequent workspace operations to that explicit workdir. Enter never creates or removes a worktree.

- **Claude:** may use its native worktree session switch.
- **Codex:** does not change a process-wide or session-wide cwd. The provider returns the target as `workdir` plus a `git -C <target>` command prefix. Every subsequent file and command operation must therefore use the target's absolute path/workdir. If a later call omits that binding, treat entry as incomplete and stop rather than operating in the old workspace.

- Never omit `path` or pass `.`; the contract requires the absolute existing worktree path.
- To leave later, enter the absolute main-worktree path. Entering does not remove the feature worktree.

### 2b. Provider fallback

There is no business-layer `cd` fallback. Codex uses explicit per-operation workdir binding; Claude may use its native session switch. Both expose the same receipt.

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
| Creating from a confirmed base | `Capability(workspace.worktree.create, {"branch":"<branch>","path":"<absolute-path>","startPoint":"<base>"})` |
| Entering the worktree | `Capability(workspace.worktree.enter, {"path":"<absolute-path>"})` |
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

### Letting the provider choose a path

- **Problem:** a missing or relative path makes workspace identity ambiguous
- **Fix:** calculate the destination first, create with explicit branch + absolute path, then enter that exact path

### Forgetting to enter after creating

- **Problem:** `git worktree add` doesn't change cwd; commands keep running in the main checkout
- **Fix:** Step 2 immediately after creation — Claude native entry or Codex explicit workdir binding

### Skipping detection

- **Problem:** Reusing a task worktree as an unintended base, or missing an allowed default base worktree
- **Fix:** Always run Step 0 and classify the exact current branch before creating anything

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
- Create from a linked worktree unless its branch is exactly `release`, `feature`, `main`, `master`, or `persist` and the user confirmed it as the base
- Continue from an existing linked worktree without explicit user confirmation
- Call enter as if it could create a worktree. Creation and entry are separate capabilities.
- Run Codex operations without the entered worktree's explicit workdir after `git worktree add`
- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking

**Always:**
- Run Step 0 detection first
- Create with `workspace.worktree.create` using the chosen absolute path
- Enter with `workspace.worktree.enter`; let the provider implement platform-specific workdir behavior
- Follow directory priority: existing > global legacy > instruction file > default
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline
