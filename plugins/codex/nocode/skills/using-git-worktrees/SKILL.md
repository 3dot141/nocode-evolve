---
name: using-git-worktrees
description: "Use when feature work or an implementation plan needs an isolated Git worktree."
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Resolve the branch and absolute target directory in the business flow, then use the current platform's native worktree behavior.

**Core principle:** Detect existing isolation first. The caller chooses the directory; the platform must use that exact absolute path.

Env callers may also provide this optional artifact envelope:

```yaml
taskArtifacts:
  sourceProjectRoot: <absolute source checkout root>
  sourceTaskDirectory: <repository-relative task directory>
  exactLog: <absolute source design.log.md path>
```

When present, keep the whole task directory at the same repository-relative path across the workspace boundary. Standalone worktree requests without `taskArtifacts` skip that transfer.

Inspect Git state with read-only commands. Create the worktree with `git worktree add "<absolute-worktree-path>" -b "<branch>" "<confirmed-base>"`; continue every subsequent file and command operation with that absolute path as `workdir`. Do not simulate a session-wide directory switch.

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

**In-place continuation rule:** after the user explicitly authorizes the current workspace, an Env caller with `taskArtifacts` continues at Step 2c so the active task directory and exact Log are validated before Step 3. A standalone caller without `taskArtifacts` skips directly to Step 3.

- **Default base worktree:** the branch name is exactly `release`, `feature`, `main`, `master`, or `persist`. This linked worktree is allowed to be the start point for a new task worktree. Report the proposed start point and ask, "Create a new task worktree from `<branch>`?" If the working tree is dirty, list the changed paths and warn that uncommitted changes are not included in the new worktree. Wait for explicit confirmation, then continue to Step 1 with `startPoint` set to the confirmed branch. If the user declines or does not confirm, stop Env.
- **Any other linked worktree:** treat it as an existing task workspace; do not create another worktree from it. If clean, ask, "Continue in this existing worktree and run setup/baseline checks?" If dirty, list the changed paths, state that they will be treated as pre-existing baseline and kept outside the task's changes, then ask, "Continue with these existing changes as the baseline?" Wait for explicit confirmation, then follow the in-place continuation rule. If the user declines or does not confirm, stop Env and ask which workspace they want to use.
- **Detached HEAD:** do not use it as a default base. Ask whether to continue in place as an externally managed workspace; on confirmation follow the in-place continuation rule, otherwise stop Env.

**If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repo checkout.

Has the user already indicated their worktree preference in your instructions? If not, ask for consent before creating a worktree:

> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor any existing declared preference without asking. If the user declines consent, that decline explicitly authorizes working in place; follow the in-place continuation rule.

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

### Carry Project-Local Environment Configuration

Tracked configuration files are already materialized by `git worktree add`. After creation, copy the source checkout's root `mise.toml` and `.envrc` only when they exist there but are absent from the new worktree, such as when they are untracked local configuration:

```bash
for config_file in mise.toml .envrc; do
  if [ -f "$project_root/$config_file" ] && [ ! -e "$worktree_path/$config_file" ]; then
    cp "$project_root/$config_file" "$worktree_path/$config_file"
  fi
done
```

Never overwrite either file when present in the target worktree; the version from the confirmed base is authoritative. Report copied configuration as inherited baseline state and do not stage or commit it unless the task explicitly includes that file.

**Sandbox fallback:** If `git worktree add` fails with a permission error (sandbox denial), report it. For an Env caller, do not automatically fall back: wait for explicit confirmation to continue in the current workspace, then follow the in-place continuation rule through Step 2c; without confirmation, stop Env. For a standalone caller without `taskArtifacts`, run setup and baseline tests in place as before.

## Step 2: Enter the Worktree

Creation does not implicitly change the active workspace. Enter it before doing anything else.

### 2a. Enter using the platform block above

- **Claude:** use the platform-native entry operation with the absolute existing path.
- **Codex:** bind every subsequent file and command operation to the target's absolute `workdir`. If a later call omits that binding, stop rather than operating in the old workspace.

- Never omit `path` or pass `.`; the contract requires the absolute existing worktree path.
- To leave later, enter the absolute main-worktree path. Entering does not remove the feature worktree.

### 2b. Failure handling

There is no implicit path fallback. If native entry or explicit workdir binding fails, report it and stop before editing the old workspace.

### 2c. Carry task artifacts when Env supplied them

If the caller supplied `taskArtifacts`, validate before copying:

- `sourceProjectRoot` is the inspected source repository root;
- `sourceTaskDirectory` resolves inside that root and contains `exactLog`;
- the destination is the same repository-relative path under the active worktree root.

If the source and active checkout are the same, reuse the already-active directory without copying. Otherwise apply exactly one outcome:

- the destination does not exist -> create its parent and copy the whole task directory;
- both directory trees are byte-for-byte identical -> reuse the destination without writing;
- the trees diverge in file set, type, or content -> stop, report the differing paths, and do not overwrite, merge, or continue to Build.

Use a recursive comparison such as `diff -qr` for the identical/divergent decision. For an absent destination, copy the directory itself rather than a fixed list of filenames so `design.log.md`, `design.md`, the Plan, optional render, and other same-task artifacts stay together.

After a copy or identical reuse, verify the destination exact Log exists. Return that destination exact Log as authoritative for every later handoff; never update or delete the source copy as part of Env.

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
| Source-only root `mise.toml` / `.envrc` | Copy only when the target worktree lacks that file; never overwrite |
| Env supplied `taskArtifacts` | Copy/reuse the whole task directory at the same repository-relative path; stop on divergence |
| Entering the worktree | Claude: native session entry; Codex: bind absolute `workdir` |
| Worktree location | `<project-parent>/<project-name>-<branch-flat>/` |
| Derived path exists | Classify registered reuse, stale directory, or real conflict before acting |
| Permission error on create | Env: require explicit in-place confirmation and run Step 2c; standalone: work in place |
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
    - Fall back from an Env worktree creation failure to in-place Build without explicit confirmation
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
