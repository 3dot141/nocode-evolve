---
name: pd-research
description: Use when the user wants to explore a problem space before committing to a solution. Use when the user says "调研/research/竞品分析/市场调研/看看已有方案/看看别人怎么做", or when devflow suggests running the product flow first for a Full-scene task. Also use when the user gives a vague product idea and needs to understand the landscape before defining scope.
---

# research — 发散探索问题空间

**Iron Law: 没看过世界就动手 = 赌。闭门造车的代价是调研的 10 倍。**

独立于 devflow 的产品流第一阶段。回答"世界上已经有什么"——竞品、代码现状、用户信号、市场空间、已有方案。产出结构化调研报告，喂给 prd skill 或直接给用户。

> Leading word: **report**。所有探索收敛到一份 research-report，没有 report 就没有 Research 的产出。

## 非本 skill 请求

已有明确技术方案只需实现 / 单文件修改 / 纯事实查询 → 不进 Research。
已有 PRD 只需写代码 → 直接进 devflow Define。
只想做技术方案对比（不涉及产品调研）→ 走 `nocode-evolve:dev-design`。

## Entry Gate

- [ ] 用户有调研意图或 devflow 建议走产品流

## Checklist (TaskCreate)

1. **定范围** — AskUserQuestion 确认调研切面
2. **并行探索** — 每个切面 spawn 专职 agent
3. **逐切面校验** — 每个切面结果独立展示，用户校验+补充，1-3 轮
4. **综合** — 汇总校验后的各切面 → research-report
5. **Go/No-Go** — 用户拍板
6. **保存** — report 文件写入输出目录

## 协议

### Step 1: 定范围

用户给出调研对象（一句话即可）。AI 提议调研切面，用 AskUserQuestion 让用户勾选：

| 切面 | 做什么 |
|---|---|
| **竞品分析** | 搜 5-7 个竞品，Feature Matrix + Positioning Map |
| **代码现状** | 扫描当前代码库已有的相关实现/pattern/模块 |
| **用户信号** | 搜社区讨论、用户反馈、评价、痛点 |
| **市场空间** | 市场规模估算、增长趋势、商业模式、竞争格局、空白机会 |
| **已有方案** | 搜开源库/工具/最佳实践/架构模式 |

默认全选。用户可取消不需要的切面。至少选一个。

**选完切面后，用 AskUserQuestion 让用户选研究深度**：

| 深度 | 行为 | 适用场景 |
|---|---|---|
| **浅研究**（shallow） | 2-3 角度搜索 → 直接综合，不做验证 | 快速了解、发散阶段 |
| **深度研究**（deep） | 4-6 角度搜索 → 提取声明 → 3 票对抗验证 → 综合 | 正式调研、需引用的报告 |

默认浅研究。用户说"仔细看看"/"深入调研"时建议深度。

**内部审计模式**：调研对象是内部产物（代码/skill/流程/架构）而非外部产品时，切面按审计维度自定义（如结构一致性 / 路由对齐 / 边界分析 / 内容质量 / 方法论对标），不拘泥于标准五切面。

**裁剪**：轻量调研可只选 1-2 个切面（用户说"快速看看"/"简单调研一下"时建议精简 + 浅研究）。

### Step 2: 并行探索（委派 research-engine）

每个选中的切面调用 `research-engine` workflow，传入切面专属的 systemPrompt。多个切面可并行（spawn fork agent 各自调 Workflow）。

```js
Workflow({
  scriptPath: '$CLAUDE_PLUGIN_ROOT/workflows/research-engine.js',
  args: {
    question: '<调研对象> 的 <切面名> 方面',
    depth: '<用户选的深度>',
    systemPrompt: '<切面专属 prompt，见下表>',
  }
})
```

**各切面的 systemPrompt 模板**：

**竞品分析**：
```
你在做产品竞品调研。搜索用 WebSearch 或 Exa。
搜 5-7 个相关竞品/产品，关注功能差异、用户体验、定价策略、市场定位。
产出应包含 Feature Matrix（功能对比表）和 Positioning Map（两轴定位图）素材。
引用格式: [SOURCE: url]。
```

**代码现状**：
```
你在搜索代码库的现有实现和 pattern。搜索用 semble-search agent（Agent subagent_type: "nocode-evolve:semble-search"）。
找已有的相关模块、可复用代码、架构 pattern、接口定义。
引用格式: [Read path:line]。验证时查 caller、test、实际导出。
```

**用户信号**：
```
你在搜集用户反馈和社区讨论。搜索用 WebSearch 或 Exa。
重点搜 Reddit、HN、知乎、GitHub Issues、论坛、G2/ProductHunt/App Store 评价。
提取痛点、需求信号、用户原话。引用格式: [SOURCE: url]。
```

**市场空间**：
```
你在做市场空间分析。搜索用 WebSearch 或 Exa。
搜市场规模数据（TAM/SAM/SOM，公开数据优先，找不到标 [ASSUMED]）、行业增长趋势、市场报告摘要。
分析竞品商业模式（定价策略、营收模式）。识别市场空白。引用格式: [SOURCE: url]。
```

**已有方案**：
```
你在搜索已有的技术方案和最佳实践。搜索用 WebSearch 或 Exa，遇到开源库用 deepwiki 查文档。
搜开源项目/库/框架、最佳实践文章、架构模式。评估成熟度和适用性。
引用格式: [SOURCE: url]。
```

**内部审计模式**：自定义切面的 systemPrompt 按审计维度写，工具按需选（代码用 semble-search，文档用 Read，外部对标用 WebSearch）。

**research-engine 返回值**中的 `findings` 即该切面的结构化发现，`sources` 含所有检索到的源，`stats` 含验证统计。agent 把返回值暂存，进 Step 3 逐切面展示。

### Step 3: 逐切面校验（1-3 轮）

并行探索完成后，**不直接综合**。逐个切面把结果展示给用户校验：

对每个切面：
1. **展示该切面的探索结果**（竞品列表、用户痛点、市场数据等）
2. **等用户反馈**：
   - "这些竞品对吗？漏了 X" → 补跑该切面 Round 2，加入用户指定的方向
   - "痛点方向不对，重点看 Y" → 按用户方向重新探索
   - "够了 / 没问题" → 该切面锁定，进下一个
3. **最多 3 轮**：同一切面校验超过 3 轮，建议锁定当前结果（可在 report 里标 `[待深入]`）

**校验顺序**：按依赖关系展示——竞品先（后续切面可能引用竞品），其次代码现状、用户信号、市场空间，最后已有方案。用户可调整顺序。

**全部切面锁定后才进 Step 4。**

### Step 4: 综合

汇总各切面**校验后**的结论，写成结构化 research-report（填好的示例见 `references/examples/example-research-report.md`，对照颗粒度不照搬）：

```markdown
# Research Report: {topic}
> Date: {yymmdd}
> Author: {username}
> Facets: {选中的切面列表}

## Executive Summary
[一段话总结关键发现]

## 竞品分析
### Feature Matrix
| Feature | 竞品A | 竞品B | 竞品C | ... | 我们 |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | [TBD] |

### Positioning Map
[mermaid quadrantChart 或 ASCII 二维图]

### 关键发现
- [SOURCE: url] 发现 1
- [SOURCE: url] 发现 2

## 代码现状
- [Read path:line] 已有实现 1
- [Read path:line] 已有实现 2
- 可复用模块: ...
- 现有 pattern: ...

## 用户信号
- [SOURCE: url] 痛点/需求 1
- [SOURCE: url] 痛点/需求 2

## 市场空间
- **规模**: [SOURCE: url] TAM/SAM 估算 / [ASSUMED] 推断
- **增长趋势**: [SOURCE: url] 行业走势
- **商业模式**: 竞品定价策略对比
- **空白机会**: 哪块需求没人做好

## 已有方案
- [SOURCE: url] 方案 1: ...
- [SOURCE: url] 方案 2: ...

## Go/No-Go 建议
**建议**: Go / No-Go / 需要更多信息
**理由**: ...
**Stop Criteria**: [什么条件下应该放弃]
**[ASSUMED]**: [AI 的判断依据，需用户核验]
```

**每条发现必须带 `[SOURCE]` 引用**——无来源的发现不写进 report。

没有调研到结果的切面写"未找到相关信息"，不编造。

### Step 5: Go/No-Go

把 report 的 Go/No-Go 建议展示给用户，用 AskUserQuestion：

- **Go** — 继续，建议接 prd skill 写 PRD
- **No-Go** — 放弃，标注原因
- **需要更多调研** — 回 Step 1 补充切面或深入某个方向

**AI 不替用户决定 Go/No-Go**。AI 给建议 + 理由，用户拍板。

### Step 6: 保存

research-report 存到 `{pd_research_output}` 变量指定的路径（见 `model/agent-about.md`「文档产出路径变量」）。

完成后提示用户："调研完成。要继续写 PRD 吗？（调 `nocode-evolve:pd-prd`）"

## Exit Gate

- [ ] research-report 已产出，包含至少一个切面的结构化结论
- [ ] 每条发现有 `[SOURCE]` 引用
- [ ] 各切面结果已经用户校验（至少 1 轮）
- [ ] Go/No-Go 建议已给出，用户已拍板
- [ ] report 文件已保存

## AI 能力边界（硬约束）

以下是 AI 做不了的，在 report 里遇到要显式标注：

| AI 能做 | AI 不能做（标 `[ASSUMED]`） |
|---|---|
| 竞品 feature 矩阵 | 真实用户访谈 |
| 定位图 / 象限图 | 定量满足度打分（需问卷） |
| 社区/评论/论坛搜索综合 | 付费意愿评估 |
| 开源方案评估 | 战略取舍 / 优先级判断 |
| 公开市场数据搜索 | 精确 TAM 数字（需付费报告） |
| 商业模式对比 | 营收预测 |

**不假装能做**。做不了的标注"需人工"或 `[ASSUMED]`，不编造数据。

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "需求够清楚了，不用调研" | 你觉得清楚可能是因为没看过别人怎么做 |
| "调研浪费时间" | 30 分钟调研省 3 天返工 |
| "先做着看，遇到问题再调研" | 遇到问题时已经投入了沉没成本 |
| "竞品跟我们不一样" | 不一样也值得看——知道为什么不一样更有价值 |

## Red Flags

- 没有 `[SOURCE]` 引用的发现（可能是编造的）
- Feature Matrix 只列优势不列劣势（在做推销不是调研）
- Go/No-Go 建议没有理由（逃避判断）
- 跳过了代码现状切面就去搜外部方案（可能重复造轮子）
- 切面校验全跳过（没给用户看就直接综合）
