---
type: adr
adr_id: ADR-001
topic: design-doc-reviewer 采用 humanizer 两遍法 + 6 维度核心审查
date: 260511
author: 3dot141
status: accepted
---

# ADR-001：reviewer 采用 humanizer 两遍法 + 6 维度核心审查

## Context

在重构 design-doc-writing skill 时，需要为 reviewer subagent 设计审查框架。

核心问题：reviewer 应该重点检查什么？

**力的对抗**：
- 一边：业界领先 skill（lemieux/rfc-skills、kk plugin、arkhe）的 reviewer 强调结构检查（章节齐全 / frontmatter 完整）
- 另一边：humanizer skill（18k stars）强调 AI 写作模式检测（套话 / inflation / vocabulary）
- 资源约束：reviewer 最多跑 3 轮，必须 prioritize 检查项

不决定的代价：reviewer 检查项混乱，每次审查重点不同，writer 不知道该改什么。

## Decision

reviewer 采用**两层 + 两遍法**结构：

**第一层（核心）**：6 维度核心审查（占重点）

1. 设计意图是否清晰
2. 决策是否站得住脚
3. 设计是否完整
4. 实施层面是否可执行
5. 内部一致性
6. 范围是否合理

**第二层（附带）**：humanizer 风格 AI patterns（缩减到 10 类）——降级为 Warning / Suggestion，非 Critical。

**两遍法**（借自 humanizer）：第一遍按 checklist；第二遍自问"假设我是不熟项目的工程师，读完仍不清楚什么？"

输出分级：Critical / Warning / Suggestion + Self-Audit。

## Consequences

**正面**：

- reviewer 主战场是"设计质量"，不是"形式合规"——抓重点
- 6 维度覆盖业界 design doc 评审的标准角度
- 两遍法捕获第一遍 checklist 漏掉的"clean but lifeless"问题
- 分级让 writer 知道哪些必改、哪些可选

**负面**：

- 6 维度判断需要 LLM 理解上下文，结果有方差（不同 reviewer agent 调用可能输出不同重点）
- humanizer 模式只查 10 类，可能漏过完整 29 类的某些情况
- 两遍法增加 token 消耗（~30%）

**中性**：

- 与 superpowers code-review 的三级反馈模式一致（Critical / Important / Minor → Critical / Warning / Suggestion）

## Alternatives Considered

**Alternative 1：只用结构性检查（章节齐全 + frontmatter）**

- 优点：简单、机器可验证、稳定
- 否决：抓不到设计质量问题（章节齐全但内容空话）

**Alternative 2：完整 humanizer 29 模式**

- 优点：AI patterns 检测最严
- 否决：技术文档场景不需要那么严（bold / em dash / title case 在 markdown 是合理表达）；且模式检测不是 reviewer 的主战场

**Alternative 3：不分级，所有问题平级输出**

- 优点：简单
- 否决：writer 不知道优先改什么，3 轮迭代可能耗在小问题上

**Alternative 4：加更多维度（如 8 维度 / 10 维度）**

- 优点：更全面
- 否决：维度越多 LLM 判断方差越大；6 个是甜点（覆盖关键 + 不过载）
