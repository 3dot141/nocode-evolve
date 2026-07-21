---
name: _nocode-provider-project-wiki
description: Private provider for project-local personal Wiki reads, usage accounting, and snapshots.
user-invocable: false
---

# Project Wiki provider

For `personal-knowledge.page.read`, invoke the provider-local `scripts/wiki-read.mjs` bridge. It reads only `.agents-personal/wiki/pages/` or `wiki/draft/`, records usage after a successful read, and returns `personal-knowledge.page-read-result` directly.

Usage lock or status-write failure is non-fatal: return the page with `usageRecorded=false` and a warning. Missing, unreadable, or out-of-scope pages fail. Direct workspace reads are outside this provider and never count as Wiki usage.

For `personal-knowledge.usage.record`, resolve the page inside the physical
`.agents-personal/wiki` root and atomically increment its usage row without reading page content.

For `personal-knowledge.snapshot`, initialize the nested personal repository when necessary,
snapshot the current `.agents-personal` state, and return whether a commit was created plus its
commit id. Never move personal knowledge state into plugin data.
