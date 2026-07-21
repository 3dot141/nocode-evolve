---
name: strategic-compact
description: "Reference/setup guide for the optional suggest-compact.sh PreToolUse hook, which suggests manua…"
---

# Strategic Compact Skill

> **当前状态：未接线。** 当前发布清单未注册 `suggest-compact.sh`，下文描述的 "PreToolUse 自动建议"行为**默认不会发生**。这是一个可选的手动 hook——如果你想启用，需要按下方 [Hook Setup](#hook-setup) 自行接入；接入前，本 skill 只是说明文档，不代表功能已生效。

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

这个 hook 不属于插件的默认行为，需要用户自行决定是否开启，插件不会替你自动注册。要启用它，请在当前客户端的个人 Hook 配置里添加 PreToolUse command，并把 `command` 指向本 skill 目录下 `suggest-compact.sh` 的实际安装绝对路径。不要依赖只在插件 manifest 内解析的路径变量；配置完成后先用一个临时 Edit/Write 操作验证 command 可达，再投入日常使用。

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
