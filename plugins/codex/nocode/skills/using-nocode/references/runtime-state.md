# runtime-state capability reference

This reference maps runtime-state semantic capabilities to codex's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### codex-plugin-data

Read only `CODEX_PLUGIN_DATA` at this provider boundary, map it to `NOCODE_PLUGIN_DATA`, and execute the selected session, workflow, plan, or handoff-state operation through an argv-only bridge.

## Capabilities

## state.cleanup

- Provider: codex-plugin-data
- Input: object; fields: sessionId, retentionMs; required: sessionId
- Output: object; fields: sessionId, workspace, status; required: sessionId, status

## state.execution.cleanup

- Provider: codex-plugin-data
- Input: object; fields: sessionId, retentionMs; required: sessionId
- Output: object; fields: removed, retained; required: removed, retained

## state.execution.read

- Provider: codex-plugin-data
- Input: object; fields: sessionId, executionId; required: sessionId, executionId
- Output: object; fields: executionId, sessionId, provider, status, tasks, degraded, degradedFrom, createdAt, updatedAt; required: executionId, sessionId, provider, status, tasks, degraded, degradedFrom, createdAt, updatedAt

## state.plan.create

- Provider: codex-plugin-data
- Input: object; fields: sessionId, plan; required: sessionId, plan
- Output: object; fields: planRef, provider, items, createdAt, updatedAt; required: planRef, provider, items, createdAt, updatedAt

## state.plan.read

- Provider: codex-plugin-data
- Input: object; fields: sessionId, planRef, provider; required: sessionId, planRef
- Output: object; fields: planRef, provider, items, createdAt, updatedAt; required: planRef, provider, items, createdAt, updatedAt

## state.plan.update

- Provider: codex-plugin-data
- Input: object; fields: sessionId, planRef, provider, items; required: sessionId, planRef, items
- Output: object; fields: planRef, provider, items, createdAt, updatedAt; required: planRef, provider, items, createdAt, updatedAt

## state.session.close

- Provider: codex-plugin-data
- Input: object; fields: sessionId, retentionMs; required: sessionId
- Output: object; fields: sessionId, workspace, status; required: sessionId, status

## state.session.open

- Provider: codex-plugin-data
- Input: object; fields: sessionId, workspace; required: sessionId, workspace
- Output: object; fields: sessionId, workspace, status; required: sessionId, status
