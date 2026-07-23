# Platform overlays

`platform/claude/` and `platform/codex/` contain files whose non-Markdown
format must differ between the two plugin runtimes. The platform packager
copies shared source and then adds the selected runtime directory.

Overlay files may define Hook entrypoints and context budgets. They must not
contain business routing, task graphs, or workflow payloads.

Markdown tool differences belong next to their shared business instructions:

```markdown
<!-- nocode:platform claude -->
Use the Claude-native tool.
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
Use the Codex-native tool.
<!-- /nocode:platform -->
```
