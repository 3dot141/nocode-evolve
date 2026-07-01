---
name: research-workflow
description: Generic research engine for any skill that needs structured search + verification. Not meant to be invoked directly by users — called by other skills (pd-research, dev-define, dev-design, brainstorming, etc.) when they need research capability. Pick a preset type (web/code/mixed) and the tool chain + iteration strategy are wired in; only custom type needs a hand-written systemPrompt. Two depth modes — shallow (fast, unverified) and deep (multi-angle + adversarial verification).
---

# research-workflow — 通用研究工作流

供其他 skill 委派的研究基础设施。选类型（`web` / `code` / `mixed`）就行——工具链、降级链、迭代策略都预制好了，调用方不用关心内部怎么搜。

## 为什么不让每个 skill 自己搜

两个原因：

1. **"搜完就信"是最常见的研究错误。** shallow 模式至少保证多角度覆盖（不只搜一个方向）；deep 模式加对抗验证（搜到的东西经得住反驳吗？），把博客 / 营销 / 过时信息杀掉，只留站得住的声明。
2. **工具链和降级逻辑不该在每个调用方重复。** 抓网页 WebFetch 失败要降级 ScraplingServer、代码搜 semble-search 失败要降级 grep——这些写一次，按 `type` 复用，调用方不用每次都抄一遍。

## 非本 skill 请求

不直接面向用户。用户说"调研 / research" → 走 pd-research。用户说"技术选型" → 走 dev-design。它们内部按需委派到这里。

## 调用方式

调用方通过 Workflow 工具委派，脚本路径在本 skill 目录下：

```js
Workflow({
  scriptPath: '$CLAUDE_PLUGIN_ROOT/skills/research-workflow/workflow.js',
  args: {
    question: '要研究的问题',
    type: 'web',          // web | code | mixed | custom
    depth: 'shallow',     // shallow（默认）| deep
  }
})
```

大多数情况只需要 `question` + `type` + `depth`。`type` 决定了用什么工具、怎么降级、迭代几轮——这些都不用调用方操心。

**约束：仅主 agent 可委派。** `Workflow` 是主 agent 的工具，subagent / fork 内没有它。调用方 skill 若正在 subagent 或 fork 里执行，委派本 workflow 会失败——需要 research 能力时，由主 agent 来委派。

## 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `question` | 是 | 具体问题。"React 状态管理方案对比"比"前端怎么做"好 |
| `type` | 是 | `web` / `code` / `mixed` / `custom`，决定工具链 + 默认迭代轮数 |
| `depth` | 否 | `shallow`（默认，快、不验证）或 `deep`（多角度 + 对抗验证） |
| `iterate` | 否 | 最大迭代轮数，不传则跟 `type` 默认值走（web=1 / code=3 / mixed=2） |
| `systemPrompt` | 否 | 追加到类型预制 prompt 后面，补充关注维度。`custom` 类型必填 |
| `angles` | 否 | 预设搜索角度 `[{label, query, rationale}]`，跳过自动分解 |

### iterate 参数

`iterate` 控制每个搜索角度最多搜几轮。每轮搜完后，一个**独立的评估 agent** 判断结果够不够好，不够就换关键词再搜。

| `iterate` | 行为 |
|---|---|
| `1` | 搜一次就停（不迭代） |
| `2` | 最多 2 轮，第一轮不够好再搜一次 |
| `3` | 最多 3 轮收敛 |

不传时跟 `type` 默认值走（见下表）。提前收敛（够好了）就不会跑满。

## 预制类型

每个 `type` 绑定一套工具链 + 降级链 + 默认迭代轮数：

| type | 搜索工具 | 抓取 / 降级 | 默认 iterate | 适用 |
|---|---|---|---|---|
| `web` | WebSearch / Exa | WebFetch → ScraplingServer（反爬严的站用 stealthy_fetch）；开源库用 deepwiki | 1 | 网络调研、竞品、用户信号、市场 |
| `code` | semble-search → grep → Explore | Read | 3 | 代码库现状、已有实现、可复用 pattern |
| `mixed` | semble-search + WebSearch / Exa | WebFetch → ScraplingServer；deepwiki | 2 | 技术选型（既看代码又看外部方案） |
| `custom` | 调用方在 systemPrompt 里自定义 | 调用方定义 | 1 | 不属于上述任何一类的特殊场景 |

**为什么 code 默认 iterate=3，web 默认 1：**

- **code=3**：代码库有自己的命名习惯。你预期的术语（"auth"）和代码里实际用的（"credential" / "session" / "principal"）常常对不上，第一轮搜不到点子上是常态。迭代让搜索 agent 从第一轮的结果里学到项目的真实命名，第二、三轮换词再搜。
- **web=1**：网络搜索的关键词通常够用——搜"React Server Components 对比"基本一轮就能命中相关文章。多搜几轮收益低，不值得多花 agent。

## 两种深度

### shallow（默认，秒级）

```
Scope → Search（并行，每角度按 iterate 轮收敛）→ Synthesize
```

多角度搜索，不提取声明，不验证。拿到什么综合什么。

**用于**：快速了解、发散阶段、辅助判断。"先大概看看"的场景。

**风险**：搜到的东西可能过时、有偏差、来自低质量源——shallow 不会告诉你这些。

### deep（分钟级）

```
Scope → Search+Extract（pipeline，无 barrier）→ Verify（3 票对抗）→ Synthesize
```

多角度搜索，从源文档提取可证伪声明，每条声明 3 个独立 skeptic agent 投票。默认立场 refuted=true——有疑问就杀。≥2 票 refute 则该声明不进最终报告。

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

## 迭代检索原理

> 思路源自 everything-claude-code v1.2.0 iterative-retrieval skill (MIT)，在本 workflow 里落成代码层的循环（不再靠 prompt 自觉）。

每个搜索角度走一个最多 `iterate` 轮的循环：

```
搜一轮 → 独立评估 agent 打相关度分 → 够好？
                                    ├─ 是 → 停（提前收敛）
                                    └─ 否 → 从结果学新术语 → 换词再搜
```

**为什么搜索和评估分给两个 agent：** 搜索 agent 会倾向于觉得自己搜到的东西不错（self-serving bias）——让它自己判断"够不够"，它几乎总会说"够了"。独立的评估 agent 没有这个偏见，它只看结果质量，该说不够就说不够。这是迭代真正起作用的关键，不是多跑几轮就行。

**为什么 code 默认 3 轮、web 默认 1 轮：** 见上文「预制类型」——代码库术语不可预期需要多轮逼近，网络关键词通常一轮够用。

**何时关掉迭代（iterate=1）：** `angles` 已预设（调用方明确知道搜什么），或纯发散的 shallow 快速场景。

## 示例

**竞品调研**（pd-research 竞品切面）：
```js
{
  question: '<产品> 的竞品在功能、定价、定位上的差异',
  type: 'web',
  depth: 'shallow' | 'deep',  // 跟随 pd-research Step1 用户选择的调研档位，默认 shallow
  systemPrompt: '关注功能差异、用户痛点、定价策略、市场定位。产出应包含 Feature Matrix 和 Positioning Map 素材。',
}
```

**代码探索**（dev-define / dev-design 代码现状）：
```js
{
  question: '<任务关键词> 在当前代码库的已有实现和可复用 pattern',
  type: 'code',
  depth: 'shallow',
  // iterate 自动 = 3，工具链自动绑 semble-search → grep → Explore
}
```

**技术选型**（dev-design 外部方案）：
```js
{
  question: '<要解决的技术问题> 有哪些成熟方案',
  type: 'mixed',
  depth: 'shallow',
  systemPrompt: '关注开源库的成熟度、维护状态、与现有架构的兼容性。不把搜索结果当事实——需对照本项目实际情况评估适用性。',
}
```

**用户信号**（pd-research 用户信号切面）：
```js
{
  question: '<产品领域> 用户的真实痛点和需求信号',
  type: 'web',
  depth: 'shallow',
  systemPrompt: '重点搜 Reddit、HN、知乎、GitHub Issues、论坛、G2 / ProductHunt / App Store 评价。提取痛点、需求信号、用户原话。',
}
```
