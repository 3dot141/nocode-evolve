# workspace capability reference

This reference maps workspace semantic capabilities to claude's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### claude-workspace

Validate all paths and argv first. Use native read/write/exec/browser primitives. For worktrees, use native worktree entry when available. Return only the Workspace result contract and never compose a shell string.

## Capabilities

## workspace.browser.verify

- Provider: claude-workspace
- Input: object; fields: url; required: url
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.exec

- Provider: claude-workspace
- Input: object; fields: argv; required: argv
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.read

- Provider: claude-workspace
- Input: object; fields: path; required: path
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.worktree.create

- Provider: claude-workspace
- Input: object; fields: branch, path, startPoint; required: branch, path
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.worktree.current

- Provider: claude-workspace
- Input: object
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.worktree.enter

- Provider: claude-workspace
- Input: object; fields: path; required: path
- Output: object; fields: operation, ok, path, output, details; required: operation, ok

## workspace.write

- Provider: claude-workspace
- Input: object; fields: path, content; required: path, content
- Output: object; fields: operation, ok, path, output, details; required: operation, ok
