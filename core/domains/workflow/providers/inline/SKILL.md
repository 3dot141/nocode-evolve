---
name: _nocode-provider-inline
description: Private Workflow provider for inline.
user-invocable: false
---

# inline

Execute the validated dependency graph in the current session. Honor `maxParallel`, dependencies, write scope, timeouts, and `continueOnError`. Return the same sanitized JSON-compatible task result as native providers. This provider is used only when the domain reference tells the model to use it; it is not an automatic retry path.
