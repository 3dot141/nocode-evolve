# workspace capability reference

This reference maps workspace semantic capabilities to codex's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### codex-workspace

Validate all paths and argv first. Use native read/write/exec/browser primitives. For worktrees, keep every command scoped with an explicit workdir or git -C. Return only the Workspace result contract and never compose a shell string.

## Capabilities

## workspace.browser.verify

- Provider: codex-workspace
- Input: object; fields: url; required: url
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.exec

- Provider: codex-workspace
- Input: object; fields: argv; required: argv
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.read

- Provider: codex-workspace
- Input: object; fields: path; required: path
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.worktree.create

- Provider: codex-workspace
- Input: object; fields: branch, path, startPoint; required: branch, path
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.worktree.current

- Provider: codex-workspace
- Input: object
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.worktree.enter

- Provider: codex-workspace
- Input: object; fields: path; required: path
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.write

- Provider: codex-workspace
- Input: object; fields: path, content; required: path, content
- Output: object; fields: operation, ok, path, output, details; required: operation, ok
