---
name: _nocode-provider-open-design
description: Private Open Design MCP provider.
user-invocable: false
---

# Open Design provider

Use only the configured Open Design MCP tools. Normalize workspace and artifact results into `design.design-result`. Report MCP startup/handshake failure as `OD_HANDSHAKE_FAILED` and authentication/authorization failure as `OD_AUTH_REQUIRED`. Never guess App-internal paths, silently retry with another provider, or cross providers for artifact writes.
