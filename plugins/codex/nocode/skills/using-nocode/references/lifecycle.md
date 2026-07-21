# lifecycle capability reference

This reference maps lifecycle semantic capabilities to codex's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### codex-hooks

Decode only the current structured Hook payload, call the platform-neutral Lifecycle dependency, and encode the documented codex Hook result. Never inspect a transcript.

## Capabilities

## lifecycle.post-tool

- Provider: codex-hooks
- Input: object; fields: sessionId, event, toolInput, toolResult; required: sessionId, event
- Output: object; fields: allow, reason, context; required: allow

## lifecycle.pre-tool

- Provider: codex-hooks
- Input: object; fields: sessionId, event, toolInput, toolResult; required: sessionId, event
- Output: object; fields: allow, reason, context; required: allow

## lifecycle.session-start

- Provider: codex-hooks
- Input: object; fields: sessionId, event, toolInput, toolResult; required: sessionId, event
- Output: object; fields: sessionId, segments; required: sessionId, segments
