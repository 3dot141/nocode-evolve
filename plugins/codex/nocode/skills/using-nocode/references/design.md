# design capability reference

This reference maps design semantic capabilities to codex's native providers. Use the native tool named below; request the platform's normal approval before effects. If the primary provider is unavailable, explain the situation and offer the listed fallback—do not retry automatically.

## Provider guidance

### local-html

Write only the caller's explicit output directory and return the Design result contract with `provider=local-html`, `degraded=true`, and `degradedFrom=open-design`. Read and preview only materialized `localPath` artifacts. Never write an Open Design-owned artifact.

### open-design

Use only the configured Open Design MCP tools. Normalize workspace and artifact results into `design.design-result`. Report MCP startup/handshake failure as `OD_HANDSHAKE_FAILED` and authentication/authorization failure as `OD_AUTH_REQUIRED`. Never guess App-internal paths, silently retry with another provider, or cross providers for artifact writes.

## Capabilities

## design.artifact.generate

- Provider: open-design; manual fallback: local-html
- Input: object; fields: workspaceRef, kind, brief, outputDir; required: workspaceRef, kind, brief, outputDir
- Output: object; fields: provider, workspace, artifact, degraded, degradedFrom, reason, warnings; required: provider, workspace, artifact, degraded, degradedFrom, warnings
- Fallback: local-html (ask before using it)

## design.artifact.read

- Provider: artifactRef.provider (open-design, local-html); manual fallback: local-html
- Input: object; fields: artifactRef; required: artifactRef
- Output: object; fields: provider, workspace, artifact, degraded, degradedFrom, reason, warnings; required: provider, workspace, artifact, degraded, degradedFrom, warnings
- Fallback: local-html (ask before using it)

## design.artifact.write

- Provider: artifactRef.provider (open-design, local-html)
- Input: object; fields: artifactRef, content, patch; required: artifactRef
- Output: object; fields: provider, workspace, artifact, degraded, degradedFrom, reason, warnings; required: provider, workspace, artifact, degraded, degradedFrom, warnings

## design.preview.open

- Provider: artifactRef.provider (open-design, local-html); manual fallback: local-html
- Input: object; fields: artifactRef; required: artifactRef
- Output: object; fields: provider, workspace, artifact, degraded, degradedFrom, reason, warnings; required: provider, workspace, artifact, degraded, degradedFrom, warnings
- Fallback: local-html (ask before using it)

## design.workspace.create

- Provider: open-design; manual fallback: local-html
- Input: object; fields: projectRoot, kind, name; required: projectRoot, kind, name
- Output: object; fields: provider, workspace, artifact, degraded, degradedFrom, reason, warnings; required: provider, workspace, artifact, degraded, degradedFrom, warnings
- Fallback: local-html (ask before using it)
