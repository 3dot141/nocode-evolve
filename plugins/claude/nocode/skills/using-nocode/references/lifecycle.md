# lifecycle capability reference

This reference maps lifecycle semantic capabilities to claude's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### claude-hooks

Decode only the current structured Hook payload, call the platform-neutral Lifecycle dependency, and encode the documented claude Hook result. Never inspect a transcript.

## Capabilities

## lifecycle.post-tool

- Provider: claude-hooks
- Input: object; fields: sessionId, event, toolInput, toolResult; required: sessionId, event
- Output: object; fields: allow, reason, context; required: allow

## lifecycle.pre-tool

- Provider: claude-hooks
- Input: object; fields: sessionId, event, toolInput, toolResult; required: sessionId, event
- Output: object; fields: allow, reason, context; required: allow

## lifecycle.session-start

- Provider: claude-hooks
- Input: object; fields: sessionId, event, toolInput, toolResult; required: sessionId, event
- Output: object; fields: sessionId, segments; required: sessionId, segments
