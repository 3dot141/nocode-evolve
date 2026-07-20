# Platform capability contract

`contract.json` is the platform behavior boundary for nocode. Common workflow
content names semantic capabilities; each adapter declares whether the behavior
is supported, degraded, or unsupported and supplies a fallback for every
non-supported mapping.

Rules:

- A capability must define both `claude` and `codex` mappings.
- `status` is one of `supported`, `degraded`, or `unsupported`.
- `implementation` describes the platform mechanism without changing workflow
  semantics.
- `degraded` and `unsupported` mappings must include a non-empty `fallback`.
- Changes to this contract are plugin changes and require a version bump plus
  regenerated platform artifacts.
