# Platform overlays

当前活跃平台是 `claude`、`codex` 和 `codebuddy`；`platform/qoder/`、`platform/pi/` 和
`platform/deepseek/` 已停止发布，仅保留源码，由 `scripts/package.platform.mjs`
的 `ACTIVE_PLATFORMS` 控制是否参与打包。

这些目录存放各 runtime 中**非 Markdown 格式必须不同**的文件。packager 先复制共享
源码，再叠加所选 runtime 目录。

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

CodeBuddy 有独立发布物（`.codebuddy-plugin/plugin.json` + `${CODEBUDDY_PLUGIN_ROOT}`），
但它的 Hook 协议与工具命名跟 Claude 一致，因此构建时 fallback 到 `claude` 平台块：

- CodeBuddy builds fall back to `claude` platform blocks — when `platform === 'codebuddy'`,
  `claude` block content is also emitted. Add explicit `<!-- nocode:platform codebuddy -->`
  blocks only where CodeBuddy diverges from Claude.

以下 fallback 规则由 `scripts/lib/platform-blocks.mjs` 保留，供停用平台恢复后使用：

- Qoder builds fall back to `claude` platform blocks — when `platform === 'qoder'`,
  `claude` block content is also emitted. Add explicit `<!-- nocode:platform qoder -->`
  blocks only where Qoder diverges from Claude.
- Pi does **not** fall back to Claude. Write an explicit `<!-- nocode:platform pi -->`
  block wherever a file already has Claude/Codex native-tool differences.
- DeepSeek first-cut builds fall back to `pi` platform blocks — when
  `platform === 'deepseek'`, `pi` block content is also emitted and `/skill:` is
  rewritten to the DeepSeek `/name` user gesture. Add explicit
  `<!-- nocode:platform deepseek -->` blocks where DeepSeek should use its native
  `skill`, `todo_write`, `ask_user_question`, or `subagent` tools instead.
