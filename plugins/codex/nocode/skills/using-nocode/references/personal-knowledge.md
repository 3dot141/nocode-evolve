# personal-knowledge capability reference

This reference maps personal-knowledge semantic capabilities to codex's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### project-wiki

For `personal-knowledge.page.read`, invoke the provider-local `scripts/wiki-read.mjs` bridge. It reads only `.agents-personal/wiki/pages/` or `wiki/draft/`, records usage after a successful read, and returns `personal-knowledge.page-read-result` directly.

Usage lock or status-write failure is non-fatal: return the page with `usageRecorded=false` and a warning. Missing, unreadable, or out-of-scope pages fail. Direct workspace reads are outside this provider and never count as Wiki usage.

For `personal-knowledge.usage.record`, resolve the page inside the physical
`.agents-personal/wiki` root and atomically increment its usage row without reading page content.

For `personal-knowledge.snapshot`, initialize the nested personal repository when necessary,
snapshot the current `.agents-personal` state, and return whether a commit was created plus its
commit id. Never move personal knowledge state into plugin data.

## Capabilities

## personal-knowledge.page.read

- Provider: project-wiki
- Input: object; fields: sessionId, path; required: sessionId, path
- Output: object; fields: path, content, usageRecorded, warnings; required: path, content, usageRecorded, warnings

## personal-knowledge.snapshot

- Provider: project-wiki
- Input: object; fields: sessionId, snapshotMessage; required: sessionId
- Output: object; fields: created, commit; required: created, commit

## personal-knowledge.usage.record

- Provider: project-wiki
- Input: object; fields: sessionId, path; required: sessionId, path
- Output: object; fields: recorded, count, warning; required: recorded
