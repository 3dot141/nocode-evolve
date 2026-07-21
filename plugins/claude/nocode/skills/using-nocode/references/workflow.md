# workflow capability reference

This reference maps workflow semantic capabilities to claude's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### claude-control

Map `workflow.skill.invoke` to Claude Skill invocation, `workflow.plan.create/update` to `TodoWrite`, and `workflow.decision.request` to `AskUserQuestion`. Return the native result directly after sanitizing provider-private details.

### claude-native

Use Claude native task/agent workflow operations for execute, wait, followup, collect, and cancel. Persist only opaque provider handles and return sanitized JSON-compatible task results directly.

### inline

Execute the validated dependency graph in the current session. Honor `maxParallel`, dependencies, write scope, timeouts, and `continueOnError`. Return the same sanitized JSON-compatible task result as native providers. This provider is used only when the domain reference tells the model to use it; it is not an automatic retry path.

## Capabilities

## workflow.cancel

- Provider: claude-native
- Input: object; fields: executionId, reason; required: executionId, reason
- Output: object; fields: executionId, status, provider, tasks, degraded, degradedFrom; required: provider, executionId, status, tasks, degraded, degradedFrom

## workflow.collect

- Provider: claude-native
- Input: object; fields: executionId; required: executionId
- Output: object; fields: executionId, status, provider, tasks, degraded, degradedFrom; required: provider, executionId, status, tasks, degraded, degradedFrom

## workflow.decision.request

- Provider: claude-control; manual fallback: inline
- Input: object; fields: question, options, allowFreeform; required: question, options
- Output: object; fields: selectedOption, freeform
- Fallback: inline (ask before using it)

## workflow.execute

- Provider: claude-native; manual fallback: inline
- Input: object; fields: tasks, maxParallel, fallbackPolicy; required: tasks, maxParallel, fallbackPolicy
- Output: object; fields: executionId, status, provider, tasks, degraded, degradedFrom; required: provider, executionId, status, tasks, degraded, degradedFrom
- Fallback: inline (ask before using it)

## workflow.followup

- Provider: claude-native
- Input: object; fields: executionId, taskId, instruction; required: executionId, taskId, instruction
- Output: object; fields: executionId, status, provider, tasks, degraded, degradedFrom; required: provider, executionId, status, tasks, degraded, degradedFrom

## workflow.plan.create

- Provider: claude-control; manual fallback: inline
- Input: object; fields: items; required: items
- Output: object; fields: planRef; required: planRef
- Fallback: inline (ask before using it)

## workflow.plan.update

- Provider: claude-control; manual fallback: inline
- Input: object; fields: planRef, items; required: planRef, items
- Output: object; fields: planRef; required: planRef
- Fallback: inline (ask before using it)

## workflow.skill.invoke

- Provider: claude-control; manual fallback: inline
- Input: object; fields: skill, arguments; required: skill, arguments
- Output: object; fields: status, resultRef, result; required: status, resultRef, result
- Fallback: inline (ask before using it)

## workflow.wait

- Provider: claude-native
- Input: object; fields: executionId, timeoutMs; required: executionId
- Output: object; fields: executionId, status, provider, tasks, degraded, degradedFrom; required: provider, executionId, status, tasks, degraded, degradedFrom
