---
type: rfc
rfc_id: RFC-001
topic: 是否在 nocode-evolve 引入项目级 wiki 系统
date: 260509
author: 3dot141
status: accepted
---

# RFC-001：引入项目级 wiki 系统

## Summary

为 nocode-evolve 增加项目级长期记忆能力：用户主动 `/wiki-update`，AI 从当前会话提炼项目知识写入 `.agents-personal/wiki/pages/`，自动派生 INDEX；AI 在新会话遇到项目背景问题时主动 search。

## Motivation

跨多次 Claude Code 会话工作时，项目背景知识（设计决策、约定、术语）反复丢失。每开新会话用户都要重新解释——浪费时间且不一致。

**Evidence**：
- 同一项目内 5 次会话调研：平均 8.4 分钟在重复解释项目背景
- AI 出错追溯：60% "AI 不知道项目某约定"导致的错误来自跨会话信息丢失

**力的对抗**：
- X 约束：项目背景信息分散在多次会话历史里，AI 不持久化
- Y 约束：完整持久化所有对话（如 memory MCP）成本高 + 噪音大
- 不决定的代价：跨项目工作时 AI 体验持续低于预期

## Guide-level Explanation

用户视角：

> 跑完一段长会话讨论完某设计 → 输入 `/wiki-update` → AI 提炼出 1-3 个值得沉淀的主题 → 写入 `<project>/.agents-personal/wiki/pages/yymmdd-<slug>.md` → 派生 INDEX。

下次新会话开始，AI 受 SessionStart 注入的 overlay-wiki rule 驱动，遇到项目背景问题先 ls wiki 目录 → Read INDEX → 按 description 决定是否 Read 具体页。

适用场景：项目特有设计决策、独有约定 / 术语、关键模块边界、反复踩过的坑。

不适用：通用知识、一次性进度、未定型的草案。

## Drawbacks

- **AI 提炼可能漏 / 错**：什么算"值得沉淀"由 AI 判断，可能漏掉真正重要的或塞入垃圾
- **wiki 与代码可能脱节**：代码变了但 wiki 没更新，AI 读到过时信息
- **整合判断复杂**：新主题 vs 已有页 vs see also，AI 判断不准会产生碎片
- **触发依赖手动**：用户忘记跑 `/wiki-update` 就不沉淀

## Rationale & Alternatives

**Alternative 1：SessionEnd hook 自动沉淀**——每次会话结束自动跑。**否决**：大多数会话不产生可沉淀内容，自动跑产生水货 + 浪费 token。

**Alternative 2：skill 自动判断时机**——AI 判断"该沉淀了"时调用。**否决**：触发不准，AI 判断"什么时候该记下"不可靠。

**Alternative 3：AI 扫代码库自动生成（DeepWiki 风格）**——定期扫整个代码库。**否决**：和"会话提炼"语义不符；代码库大时贵；不能捕捉非代码决策。

**Alternative 4：完全自由生长（无 INDEX）**——扁平地建页，无目录。**否决**：多次会话后碎片化严重，AI 找不到相关内容。

**选定方案**：用户主动 command + 父子结构（INDEX + pages/）+ AI 自主整合判断。

## Reference-level Explanation

详见 `commands/wiki-update.md`，主要 components：
- command 文件（slash command 定义）
- overlay-wiki rule（告诉 AI 按需 search）
- 文件契约（page frontmatter + INDEX 派生格式）

## Implementation Plan

- Phase 1：创建 `commands/wiki-update.md` + `rules/overlay-wiki.md`
- Phase 2：写完整文档契约（INDEX 派生、page frontmatter）
- Phase 3：加 .gitignore（wiki 是本地状态）
- Phase 4：dogfood 验证

## Unresolved Questions

- wiki 内容是否应该跨项目共享？（当前：不共享，每个项目独立）
- 是否需要 `/wiki-search <query>` 命令？（当前：不做，AI 用 Grep / Read 即可）
- 多年后 wiki 膨胀怎么办？（当前：未来再说）
