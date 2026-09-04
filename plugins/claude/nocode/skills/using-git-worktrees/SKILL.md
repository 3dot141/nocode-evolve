---
name: using-git-worktrees
description: Use when feature work or an implementation plan needs an isolated Git worktree. Not for an already-isolated workspace, read-only Git inspection, or branchless single-file edits.
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace. Resolve the branch and base in the business flow, then create the worktree by running this skill's `scripts/create-worktree.sh` and entering the path it returns.

**Core principle:** Detect existing isolation first. The caller confirms the branch and base; creation is Orca-first (base ref persisted in Orca metadata, worktree Orca-managed from birth) with a silent fallback to plain `git worktree add` when the Orca CLI or its runtime is unavailable. The platform must enter the exact absolute path the script reports.

Env callers may also provide this optional artifact envelope:

```yaml
taskArtifacts:
  sourceProjectRoot: <absolute source checkout root>
  sourceTaskDirectory: <repository-relative task directory>
  exactLog: <absolute source design.log.md path>
```

When present, keep the whole task directory at the same repository-relative path across the workspace boundary. Standalone worktree requests without `taskArtifacts` skip that transfer.

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

**Always create with an explicit branch and confirmed base.** Run the skill's script — never hand-roll the creation commands:

```bash
scripts/create-worktree.sh --branch "<BRANCH_NAME>" --base "<confirmed-base>"
```

(Resolve `scripts/create-worktree.sh` against this skill's base directory. Pass `--main-root <path>` only when the main checkout root differs from what `git worktree list` reports first.)

The script owns the whole creation sequence. Its decision tree, so you know what the output means:

```text
probe orca cli ("$CLAUDE_PLUGIN_ROOT/bin/orca" → PATH "orca"; usable =
`repo list --json` exits 0 with ok:true — proves CLI + running runtime)
     │
     ├─ usable ──→ register repo if needed (`repo add`), then
     │             `worktree create --no-parent --base-branch <base>
     │             --setup skip --json`; restore the exact branch name
     │             (orca flattens "/" to "-"; script renames back)
     │             → {"mode":"orca",...}
     │
     └─ unusable (cli missing / app-path error / runtime not running
                  / creation failed)
                  ──→ plain `git worktree add` at the flat sibling path
                       `<project-parent>/<project-name>-<branch-flat>/`
                       → {"mode":"git-fallback",...}
```

Why these flags are non-negotiable (the script enforces them; do not reimplement):

- `--no-parent` — this skill creates independent task worktrees; without it Orca infers parent lineage from the caller context and records a wrong relationship.
- `--base-branch` — always the confirmed base, explicit; never trust a repo default to resolve to the team's actual PR target line.
- `--setup skip` — Step 3 of this skill owns project setup; repo-defined Orca hooks must not run the same installs twice.

**Consume the output:**

- Exit 0 → parse the single JSON line: `mode` (report it verbatim later), `path` (the worktree root to enter), `branch`, `base`. On `mode":"git-fallback"`, the `note` explains why — carry that into the final report; never block mid-flow to ask about the fallback.
- Exit != 0 → the stderr reason is a conflict or failure needing a decision (existing path, existing branch, base not resolvable, sandbox denial). Report it and follow the user's answer; do not silently retry or auto-remove anything. On a sandbox/permission denial specifically: for an Env caller, wait for explicit confirmation to continue in the current workspace, then follow the in-place continuation rule through Step 2c — never auto-fall-back in place; for a standalone caller without `taskArtifacts`, run setup and baseline tests in place as before.

A dirty base worktree contributes its committed branch tip only; never imply that uncommitted changes were copied.

### Carry Project-Local Environment Configuration

Tracked configuration files are already materialized by creation (both modes check out the confirmed base). After creation, copy the source checkout's root `mise.toml` and `.envrc` only when they exist there but are absent from the new worktree, such as when they are untracked local configuration:

```bash
for config_file in mise.toml .envrc; do
  if [ -f "$project_root/$config_file" ] && [ ! -e "$worktree_path/$config_file" ]; then
    cp "$project_root/$config_file" "$worktree_path/$config_file"
  fi
done
```

Never overwrite either file when present in the target worktree; the version from the confirmed base is authoritative. Report copied configuration as inherited baseline state and do not stage or commit it unless the task explicitly includes that file.

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

If the caller supplied `taskArtifacts`, validate before transferring:

- `sourceProjectRoot` is the inspected source repository root;
- `sourceTaskDirectory` resolves inside that root and contains `exactLog`;
- the destination is the same repository-relative path under the active worktree root.

If the source and active checkout are the same, reuse the already-active directory without transferring. Otherwise classify the source first: `git -C <sourceProjectRoot> ls-files -- <sourceTaskDirectory>` empty means the directory is fully untracked; any output means tracked files are present. Then apply exactly one outcome:

- fully untracked, destination absent -> create its parent and `mv` the whole task directory so `design.log.md`, `design.md`, the Plan, optional render, and other same-task artifacts move together — the source copy disappears, leaving exactly one copy in the active workspace;
- fully untracked, byte-for-byte identical trees (`diff -qr`) -> reuse the destination and delete the source directory: the destination is the surviving copy;
- tracked files present, trees identical -> reuse the destination and leave the source untouched: both copies are git working copies of the same tracked content, and git — not the transfer — owns them;
- tracked files present, destination absent (rare: the worktree base predates those commits) -> stop and report instead of moving: moving tracked files would leave spurious deletion entries in the source checkout;
- the trees diverge in file set, type, or content -> stop, report the differing paths, and do not overwrite, merge, or continue to Build.

After the transfer, verify the destination exact Log exists and no untracked copy of the task directory remains in the source checkout. Return that destination exact Log as authoritative for every later handoff. Never move or delete tracked task files as part of Env — that corrupts the source checkout with deletion entries a later commit would silently include.

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
Worktree ready at <path>
Creation mode: orca-managed (base ref persisted) | git fallback — <note from script>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

A git-fallback worktree is invisible to Orca's managed list and its diff comparison will not know the intended base until the repo-level default or manual base selection covers it — say so when reporting that mode.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Linked worktree on `release`/`feature`/`main`/`master`/`persist` | Confirm it as `startPoint`, then create a new task worktree (Step 0) |
| Other linked worktree | Confirm reuse, then skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Creating | `scripts/create-worktree.sh --branch <name> --base <ref>` (Step 1) |
| Script exits 0 | Parse JSON line: mode / path / branch; enter `path` |
| Script exits != 0 | Report stderr reason, ask the user; never auto-remove or retry |
| Source-only root `mise.toml` / `.envrc` | Copy only when the target worktree lacks that file; never overwrite |
| Env supplied `taskArtifacts` | Move (untracked) or reuse the task directory at the same repository-relative path, leaving one copy; never move tracked files; stop on divergence |
| Entering the worktree | Claude: native session entry; Codex: bind absolute `workdir` |
| Worktree location | orca mode: Orca-managed (`~/orca/workspaces/<repo>/<name>`); fallback: `<project-parent>/<project-name>-<branch-flat>/` |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Mistakes

### Hand-rolling the creation commands

- **Problem:** re-typing the orca probe/create sequence or the fallback path derivation inline invites transcription drift (missed `--no-parent`, skipped branch rename, wrong path template)
- **Fix:** creation goes through `scripts/create-worktree.sh` — always; the script is the single source of the sequence

### Asking the user when the script fell back

- **Problem:** turning a silent fallback into a blocking question defeats its purpose
- **Fix:** consume the `git-fallback` JSON, continue the flow, disclose the mode (and the script's `note`) in the final report

### Assuming `--name` preserves branch spelling

- **Problem:** Orca flattens `/` to `-` when deriving the branch from `--name`, so `feat/agent-task` silently becomes `feat-agent-task`
- **Fix:** the script renames back automatically; if you ever bypass it (you should not), verify and `branch -m` before entering

### Leaving the path implicit

- **Problem:** a missing or relative path makes workspace identity ambiguous
- **Fix:** take `path` from the script's JSON output, then enter that exact path

### Forgetting to enter after creating

- **Problem:** creation doesn't change cwd; commands keep running in the main checkout
- **Fix:** Step 2 immediately after creation — Claude native entry or Codex explicit workdir binding

### Skipping detection

- **Problem:** Reusing a task worktree as an unintended base, or missing an allowed default base worktree
- **Fix:** Always run Step 0 and classify the exact current branch before creating anything

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

## Red Flags

**Never:**
- Hand-roll the orca probe/create sequence or the fallback `git worktree add` instead of running `scripts/create-worktree.sh`
- Retry creation or remove an existing path/branch automatically after a script failure — report and ask
- Create from a linked worktree unless its branch is exactly `release`, `feature`, `main`, `master`, or `persist` and the user confirmed it as the base
- Continue from an existing linked worktree without explicit user confirmation
- Call the platform entry operation as if it could create a worktree. Creation and entry are separate steps.
    - Run Codex operations without the entered worktree's explicit workdir after creation
    - Fall back from an Env worktree creation failure to in-place Build without explicit confirmation
- Skip baseline test verification
- Proceed with failing tests without asking

**Always:**
- Run Step 0 detection first
- Create via `scripts/create-worktree.sh` with explicit `--branch` and `--base`
- Enter with Claude's native worktree entry; on Codex bind every later command to the absolute `workdir`
- Auto-detect and run project setup
- Verify clean test baseline
- Disclose the creation mode (orca-managed vs git fallback, with the script's note) in the final report
