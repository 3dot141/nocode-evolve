---
name: strategic-compact
description: "Reference/setup guide for the optional suggest-compact.sh PreToolUse hook, which suggests manua…"
---

# Strategic Compact Skill

> **当前状态：未接线。** 本插件的 `hooks/hooks.json` 并未注册 `suggest-compact.sh`，下文描述的"PreToolUse 自动建议"行为**默认不会发生**。这是一个可选的手动 hook——如果你想启用，需要按下方 [Hook Setup](#hook-setup) 自行接入；接入前，本 skill 只是说明文档，不代表功能已生效。

Suggests manual `/compact` at strategic points in your workflow rather than relying on arbitrary auto-compaction.

## Why Strategic Compaction?

Auto-compaction triggers at arbitrary points:
- Often mid-task, losing important context
- No awareness of logical task boundaries
- Can interrupt complex multi-step operations

Strategic compaction at logical boundaries:
- **After exploration, before execution** - Compact research context, keep implementation plan
- **After completing a milestone** - Fresh start for next phase
- **Before major context shifts** - Clear exploration context before different task

## How It Works

Once wired up (see [Hook Setup](#hook-setup) — not on by default), the `suggest-compact.sh` script runs on PreToolUse (Edit/Write) and:

1. **Tracks tool calls** - Counts tool invocations in session
2. **Threshold detection** - Suggests at configurable threshold (default: 50 calls)
3. **Periodic reminders** - Reminds every 25 calls after threshold

## Hook Setup

这个 hook 不属于插件的默认行为，需要用户自行决定是否开启（未接线进 `hooks/hooks.json`，插件不会替你自动开启）。开启方式二选一：

1. **加进本插件的 `hooks/hooks.json`**（推荐，`${PLUGIN_ROOT}` 在插件自身 manifest 内可正确解析，和文件里其他 hook 条目写法一致）：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "tool == \"Edit\" || tool == \"Write\"",
      "hooks": [{
        "type": "command",
        "command": "${PLUGIN_ROOT}/skills/strategic-compact/suggest-compact.sh"
      }]
    }]
  }
}
```

2. **加进个人 `~/.claude/settings.json`**：`${PLUGIN_ROOT}` 这类插件变量在个人配置里不一定能解析，需要把 `command` 换成本插件在你机器上的实际安装绝对路径（例如 `/path/to/nocode-plugin/skills/strategic-compact/suggest-compact.sh`），而不是原来失效的 `~/.claude/skills/strategic-compact/suggest-compact.sh`。

## Configuration

Environment variables:
- `COMPACT_THRESHOLD` - Tool calls before first suggestion (default: 50)

## Best Practices

1. **Compact after planning** - Once plan is finalized, compact to start fresh
2. **Compact after debugging** - Clear error-resolution context before continuing
3. **Don't compact mid-implementation** - Preserve context for related changes
4. **Read the suggestion** - The hook tells you *when*, you decide *if*

## Related

- [The Longform Guide](https://x.com/affaanmustafa/status/2014040193557471352) - Token optimization section
- Memory persistence hooks - For state that survives compaction
