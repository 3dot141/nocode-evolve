---
name: research-workflow
description: Generic research engine for any skill that needs structured search + verification. Not meant to be invoked directly by users — called by other skills (pd-research, dev-design, brainstorming, etc.) when they need research capability. Supports web search, code search, or mixed, configured via systemPrompt. Two depth modes — shallow (fast, unverified) and deep (multi-angle + adversarial verification).
---

# research-workflow — 通用研究工作流

供其他 skill 委派的研究基础设施。一个问题进来，多角度搜索 + 可选对抗验证，出一份结构化发现。

**为什么不让每个 skill 自己搜？** 因为"搜完就信"是最常见的研究错误。shallow 模式至少保证多角度覆盖（不只搜一个方向）；deep 模式加对抗验证（搜到的东西经得住反驳吗？），把博客/营销/过时信息杀掉，只留站得住的声明。

## 非本 skill 请求

不直接面向用户。用户说"调研 / research" → 走 pd-research。用户说"技术选型" → 走 dev-design。它们内部按需委派到这里。

## 调用方式

调用方通过 Workflow 工具委派，脚本路径在本 skill 目录下：

```js
Workflow({
  scriptPath: '$CLAUDE_PLUGIN_ROOT/skills/research-workflow/workflow.js',
  args: {
    question: '要研究的问题',
    depth: 'shallow',
    systemPrompt: '领域上下文 + 工具偏好',
  }
})
```

调用方不需要知道内部实现——传 question + depth + systemPrompt，拿回结构化 findings。

## 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `question` | 是 | 具体问题。"React 状态管理方案对比"比"前端怎么做"好 |
| `depth` | 否 | `shallow`（快，不验证）或 `deep`（对抗验证，默认） |
| `systemPrompt` | 否 | 告诉引擎用什么工具、关注什么维度 |
| `angles` | 否 | 预设搜索角度 `[{label, query, rationale}]`，跳过自动分解 |

### systemPrompt 为什么重要

systemPrompt 替代了硬编码的 web/code/mixed 模式分类。同一个引擎，不同的 systemPrompt 产出完全不同的搜索行为：

```
产品竞品调研：
  "搜索用 WebSearch 或 Exa。关注功能差异、用户痛点、定价策略。引用格式: [SOURCE: url]。"
  → agent 会搜竞品网站、评测文章、用户评论

代码现状探索：
  "搜索用 semble-search agent。找已有模块、可复用代码、架构 pattern。引用格式: [Read path:line]。"
  → agent 会搜代码库、读文件、查 caller

技术选型：
  "网络搜索用 WebSearch 查方案对比、benchmark。代码搜索用 semble-search 看已有技术栈。"
  → agent 同时搜网络和代码
```

## 两种深度

### shallow（5-10 agent，秒级）

```
Scope → Search（并行）→ Synthesize
```

2-3 个角度搜索，不提取声明，不验证。拿到什么综合什么。

**用于**：快速了解、发散阶段、辅助判断。"先大概看看"的场景。

**风险**：搜到的东西可能过时、有偏差、来自低质量源——shallow 不会告诉你这些。

### deep（40-80 agent，分钟级）

```
Scope → Search+Extract（pipeline，无 barrier）→ Verify（3 票对抗）→ Synthesize
```

4-6 个角度搜索，从源文档提取可证伪声明，每条声明 3 个独立 skeptic agent 投票。默认立场 refuted=true——有疑问就杀。≥2 票 refute 则该声明不进最终报告。

**为什么默认 refuted=true？** 因为研究的目标是找到"站得住的结论"，不是"搜到的东西越多越好"。一条经不住反驳的声明，进了报告比不进更危险——它给人虚假的信心。

**用于**：正式调研、设计决策依据、需要引用的报告。

## 返回值

```js
{
  question: string,
  depth: 'shallow' | 'deep',
  summary: string,             // 回答研究问题的摘要
  findings: [{                 // 综合后的发现
    claim: string,             // 一条结论
    confidence: 'high' | 'medium' | 'low',
    sources: string[],         // 支撑来源
    evidence: string,          // 关键证据
    vote?: string,             // deep: "2-1" = 2 票支持 1 票反对
  }],
  caveats: string,             // 局限性
  openQuestions: string[],     // 未解问题
  refuted?: [{claim, vote, source}],  // deep: 被杀掉的声明（透明性）
  sources: [{ref, quality}],   // 所有检索到的源
  stats: { angles, sourcesFetched, claimsExtracted, confirmed, killed, ... },
}
```

**调用方怎么用返回值**：
- `findings` 是主要产出，每条带置信度和来源
- `refuted` 是透明性——告诉用户"这些声明搜到了但被杀了"
- `openQuestions` 提示还有什么没搞清楚

## 迭代检索模式

> 吸收自 everything-claude-code v1.2.0 iterative-retrieval skill (MIT)

在 systemPrompt 里加一句即可启用。解决"第一轮搜的词不命中"的问题——代码库有自己的命名习惯，你预期的术语和实际的可能不一样。

最多 3 轮循环：宽泛搜 → 打相关度分 → 据结果换术语再搜 → 收敛。

```
搜索时走迭代检索：先用宽泛关键词搜一轮，给结果打相关度分（0-1）并记录还缺什么；
据此补术语、排无关、针对缺口再搜，最多 3 轮。停在"够用"（3 个高相关结果胜过 10 个平庸的）。
```

**何时不用**：`angles` 已预设（知道搜什么就不需要逐轮逼近），或 shallow 快速场景。
