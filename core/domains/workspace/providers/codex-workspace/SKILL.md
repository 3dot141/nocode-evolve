---
name: _nocode-provider-codex-workspace
description: Private codex Workspace provider.
user-invocable: false
---

# codex Workspace provider

Validate all paths and argv first. Use native read/write/exec/browser primitives. For worktrees, keep every command scoped with an explicit workdir or git -C. Return only the Workspace result contract and never compose a shell string.
