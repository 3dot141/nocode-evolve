# Preset Attribution

本目录下大部分 preset 是从上游项目 fork + 适配而来。License chain：

```
VoltAgent / awesome-design-md  (MIT)
        │
        ▼
NousResearch / hermes-agent
  skills/creative/popular-web-designs  (MIT, PR #5194 by @teknium1)
        │
        ▼
nocode-evolve  (MIT, 本插件)
  skills/design-doc-rendering/references/presets
```

## Fork 来源对照

| 本插件 preset | 上游文件 | 主要适配 |
|---|---|---|
| `vercel-geist.md` | hermes-agent `templates/vercel.md` | 删 Hermes Implementation Notes / Section 9；加「Map to Design Doc Components」+「5 个必有交互的视觉处理」 |
| `stripe-purple.md` | hermes-agent `templates/stripe.md` | 同上 |
| `linear-precision.md` | hermes-agent `templates/linear.app.md` | 同上 |
| `mintlify-reading.md` | hermes-agent `templates/mintlify.md` | 同上 |
| `posthog-playful.md` | hermes-agent `templates/posthog.md` | 同上 |
| `warp-blocks.md` | hermes-agent `templates/warp.md` | 同上 |
| `terminal-mono.md` | hermes-agent `templates/voltagent.md` + `ollama.md` 综合改造 | 重写以贴合设计文档（非 marketing landing）场景 |
| `tufte-essay.md` | **原创**（Hermes 无对应 preset） | 参考 Tufte CSS / ETBook 设计原则手写 |

## 删了什么

每个 fork 文件都做了以下处理：

1. **删** 文件顶部 `> Hermes Agent — Implementation Notes` block 中引用 `write_file` / `generative-widgets` / `browser_vision` 的部分（这些是 Hermes 平台工具，Claude Code 没有）。保留字体 CDN / fallback stack 信息。
2. **删** Section 9 「Agent Prompt Guide」/「Example Prompts」——上游里全是 marketing 场景（landing page / pricing / hero section），不适用于设计文档渲染。
3. **保留** Section 1–7（Visual Theme / Color Palette / Typography / Components / Layout / Shadows / Do's-Don'ts）—— 这是精华。
4. **加** 新一节「Map to Design Doc Components」—— 将本 preset 的 token 映射到 design doc 的标准组件（metadata 卡片 / TOC / 代码块 / Review Log 折叠等）。
5. **加** 新一节「5 个必有交互的视觉处理」—— 用本 preset 的色板/字体落实 design-doc-rendering skill 强制的 5 个交互（TOC 跟随 / 章节折叠 / 暗黑切换 / 代码高亮 / 回到顶部）。

## 协议

本目录所有文件遵守 MIT License，与 nocode-evolve 插件根 LICENSE 一致。

若 fork 的内容被进一步分发，请保留本 ATTRIBUTION.md 并维护 license chain。
