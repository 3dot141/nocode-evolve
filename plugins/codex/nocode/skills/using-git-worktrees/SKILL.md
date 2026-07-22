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

**If `GIT_DIR != GIT_COMMON` (and not a submodule):** You are already in a linked worktree. Skip to Step 3 (Project Setup). Do NOT create another worktree.

Report with branch state:
- On a branch: "Already in isolated workspace at `<path>` on branch `<name>`."
- Detached HEAD: "Already in isolated workspace at `<path>` (detached HEAD, externally managed). Branch creation needed at finish time."

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, work in place and skip to Step 3.

## Step 1: Create the Worktree

**Always create through `workspace.worktree.create` with an explicit branch and absolute path.** The provider may use Git internally, but it cannot choose a different directory or silently enter creation mode.

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
Capability(workspace.worktree.create, {"branch":"<BRANCH_NAME>","path":"<absolute-worktree-path>"})
```

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), tell the user the sandbox blocked worktree creation and you're working in the current directory instead. Then run setup and baseline tests in place.

## Step 2: Enter the Worktree

Creation does not implicitly change the active workspace. Enter it before doing anything else.

### 2a. Enter through the Workspace provider

```
Capability(workspace.worktree.enter, {"path":"<absolute-worktree-path>"})
```

The provider either persists the session workspace or binds subsequent workspace operations to that explicit workdir. Enter never creates or removes a worktree.

- Never omit `path` or pass `.`; the contract requires the absolute existing worktree path.
- To leave later, enter the absolute main-worktree path. Entering does not remove the feature worktree.

### 2b. Provider fallback

There is no business-layer `cd` fallback. The Codex provider uses explicit workdir execution and the Claude provider may use its native session switch; both expose the same receipt.

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
| Creating the worktree | `Capability(workspace.worktree.create, {"branch":"<branch>","path":"<absolute-path>"})` |
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
- Call enter as if it could create a worktree. Creation and entry are separate capabilities.
- Stay in the main checkout after `git worktree add` (skipping Step 2)
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
