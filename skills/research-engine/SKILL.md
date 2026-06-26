---
name: research-engine
description: Generic research engine for any skill that needs structured search + verification. Not meant to be invoked directly by users — called by other skills (pd-research, dev-design, brainstorming, etc.) when they need research capability. Supports web search, code search, or mixed, configured via systemPrompt. Two depth modes — shallow (fast, unverified) and deep (multi-angle + adversarial verification).
---

# research-engine — 通用研究引擎

供其他 skill 调用的研究基础设施。不直接面向用户——pd-research、dev-design、brainstorming 等 skill 在需要研究能力时委派到这里。

## 调用方式

调用方 skill 通过 Workflow 工具调用：

```js
Workflow({
  scriptPath: '<CLAUDE_PLUGIN_ROOT>/workflows/research-engine.js',
  args: {
    question: '要研究的问题',
    depth: 'shallow' | 'deep',
    systemPrompt: '领域上下文 + 工具偏好',
    angles: [{ label, query, rationale }]  // 可选，跳过自动分解
  }
})
```

`<CLAUDE_PLUGIN_ROOT>` 用环境变量 `$CLAUDE_PLUGIN_ROOT` 解析（SessionStart 已注入，指向 nocode-evolve 插件根）。

## 参数说明

### question (必填)
要研究的具体问题。越具体越好。

### depth (默认 'deep')

| depth | 行为 | agent 调用量 | 适用场景 |
|---|---|---|---|
| `shallow` | 2-3 角度搜索 → 直接综合 | 5-10 | 快速了解、发散阶段、辅助判断 |
| `deep` | 4-6 角度搜索 → 提取声明 → 3 票对抗验证 → 综合 | 40-80 | 正式调研、设计决策依据、需要引用的报告 |

### systemPrompt (有默认值但建议传)
告诉研究引擎：你在做什么领域的研究、偏好用什么工具、关注什么维度。引擎把这段 prompt 注入每个 agent，agent 据此选工具和策略。

**没有 mode 参数**——systemPrompt 完全替代了 web/code/mixed 的硬分类。

#### systemPrompt 示例

**产品竞品调研**：
```
你在做产品竞品调研。搜索用 WebSearch 或 Exa。关注功能差异、用户痛点、定价策略、市场定位。
引用格式: [SOURCE: url]。
```

**代码现状探索**：
```
你在搜索代码库的现有实现和 pattern。搜索用 semble-search agent（Agent subagent_type: "nocode-evolve:semble-search"）。
找已有的相关模块、可复用代码、架构 pattern。引用格式: [Read path:line]。
验证时查 caller、test、实际运行结果。
```

**技术选型调研**：
```
你在做技术选型。网络搜索用 WebSearch 查方案对比、benchmark、社区评价。
代码搜索用 semble-search 看项目已有的技术栈和集成方式。
关注性能、维护成本、社区活跃度、与现有架构的兼容性。
```

**用户信号收集**：
```
你在搜集用户反馈和社区讨论。搜索用 WebSearch，重点搜 Reddit、HN、知乎、GitHub Issues、论坛、G2 评价。
提取痛点、需求信号、用户原话。引用格式: [SOURCE: url]。
```

### angles (可选)
预设搜索角度，跳过 Scope 阶段的自动分解。每个 angle 需要 `label`（标签）和 `query`（搜索查询），可选 `rationale`（为什么选这个角度）。

不传则引擎自动分解（shallow 2-3 个角度，deep 4-6 个角度）。

## 返回值

```js
{
  question: string,
  depth: 'shallow' | 'deep',
  summary: string,           // 摘要
  findings: [{               // 综合后的发现
    claim: string,
    confidence: 'high' | 'medium' | 'low',
    sources: string[],
    evidence: string,
    vote?: string,           // deep 模式下的投票结果
  }],
  caveats: string,           // 局限性说明
  openQuestions: string[],   // 未解问题
  refuted?: [{...}],         // deep 模式下被杀掉的声明
  sources: [{...}],          // 所有检索到的源
  stats: {...},              // 统计数据
}
```

## 各 skill 调用建议

| 调用方 | 典型 systemPrompt 方向 | 建议 depth |
|---|---|---|
| pd-research 竞品切面 | 产品竞品 + WebSearch | 用户选 |
| pd-research 用户信号切面 | 社区/论坛搜索 | 用户选 |
| pd-research 市场空间切面 | 市场数据 + WebSearch | 用户选 |
| pd-research 已有方案切面 | 开源/最佳实践 + WebSearch + deepwiki | 用户选 |
| pd-research 代码现状切面 | 代码搜索 + semble-search | 用户选 |
| dev-design 方案探索 | 技术选型 + mixed | deep |
| brainstorming 发散 | 按主题自定义 | shallow |
| dev-build 查库/API | 技术文档 + WebSearch | shallow |

## 迭代检索模式（来自 iterative-retrieval）

> 吸收自 everything-claude-code v1.2.0 iterative-retrieval skill (MIT)

调用方在配置 `systemPrompt` 时，可以让搜索 agent 走"逐轮收敛"而非"一次搜定"。适用场景：**调用方不确定该用什么关键词/术语**（代码库有自己的命名习惯，第一轮搜的词常常不命中），或**初次检索结果相关度偏低**需要据此调整。

核心是一个最多 3 轮的循环：

```
DISPATCH → EVALUATE → REFINE → LOOP（满足停止条件则退出）
```

- **DISPATCH**：用宽泛的初始关键词搜一批候选（先广后窄，别一上来就过度限定）
- **EVALUATE**：给每个结果打相关度分，并记录"还缺什么上下文"
  - 高 (0.8-1.0)：直接命中目标
  - 中 (0.5-0.7)：相关 pattern / 类型
  - 低 (0.2-0.4)：勉强沾边
  - 无 (0-0.2)：排除
- **REFINE**：根据评估调整——补上从高相关结果里发现的新术语（第一轮常暴露代码库的命名习惯），排除确认无关的路径，针对"缺的上下文"开新查询
- **LOOP**：停止条件 = 高相关结果 ≥3 且无关键缺口；否则带着 refine 后的查询再来一轮，最多 3 轮

**怎么用**：这是 systemPrompt 层面的指导，不改引擎结构。在 systemPrompt 里加一句即可启用，例如：

```
搜索时走迭代检索：先用宽泛关键词搜一轮，给结果打相关度分（0-1）并记录还缺什么；
据此补术语、排无关、针对缺口再搜，最多 3 轮。代码库术语可能和你预期的不同——
第一轮没命中时换项目自己的命名再试，别硬搜原词。停在"够用"（3 个高相关结果胜过 10 个平庸的）。
```

**何时不用**：`angles` 已预设（跳过了自动分解，说明调用方已知道搜什么）、或 `depth: shallow` 的快速场景——迭代检索是为"术语不确定 / 需要逐步逼近"准备的，确定性检索不必绕这一圈。

## 非本 skill 请求

- 用户直接说「调研 / research」→ 走 pd-research（产品）或 dev-design（技术），由它们按需调用本引擎
- 用户直接说「deep research / 深度调研」→ 内置 deep-research workflow 或本引擎均可，由上层 skill 路由
- 纯事实查询（一次 WebSearch 能答的）→ 不用本引擎
