---
name: pd-research
description: Use when the user wants to explore a problem space before committing to a solution. Use when the user says "调研/research/竞品分析/市场调研/看看已有方案/看看别人怎么做", or when devflow suggests running the product flow first for a Full-scene task. Also use when the user gives a vague product idea and needs to understand the landscape before defining scope.
---

# research — 发散探索问题空间

**Iron Law: 没看过世界就动手 = 赌。闭门造车的代价是调研的 10 倍。**

独立于 devflow 的产品流第一阶段。回答"世界上已经有什么"——竞品、代码现状、市场信号、已有方案。产出结构化调研备忘，喂给 prd skill 或直接给用户。

> Leading word: **memo**。所有探索收敛到一份 research-memo，没有 memo 就没有 Research 的产出。

## 非本 skill 请求

已有明确技术方案只需实现 / 单文件修改 / 纯事实查询 → 不进 Research。
已有 PRD 只需写代码 → 直接进 devflow Define。
只想做技术方案对比（不涉及产品调研）→ 走 `nocode-evolve:dev-design`。

## Entry Gate

- [ ] 用户有调研意图或 devflow 建议走产品流

## Checklist (TaskCreate)

1. **定范围** — AskUserQuestion 确认调研切面
2. **并行探索** — 每个切面 spawn 专职 agent
3. **综合** — 汇总各切面 → research-memo
4. **Go/No-Go** — 用户拍板
5. **保存** — memo 文件写入输出目录

## 协议

### Step 1: 定范围

用户给出调研对象（一句话即可）。AI 提议调研切面，用 AskUserQuestion 让用户勾选：

| 切面 | 做什么 | 工具 |
|---|---|---|
| **竞品分析** | 搜 5-7 个竞品，Feature Matrix + Positioning Map | Exa/WebSearch |
| **代码现状** | 扫描当前代码库已有的相关实现/pattern/模块 | semble-search |
| **市场/社区** | 搜社区讨论、用户反馈、评价、痛点 | Exa/WebSearch |
| **已有方案** | 搜开源库/工具/最佳实践/架构模式 | Exa/WebSearch + deepwiki |

默认全选。用户可取消不需要的切面。至少选一个。

**裁剪**：轻量调研可只选 1-2 个切面（用户说"快速看看"/"简单调研一下"时建议精简）。

### Step 2: 并行探索

每个选中的切面 spawn 一个专职 agent（fork），各自独立探索。

**竞品分析 agent**：
- 搜索 5-7 个相关竞品/产品
- 产出 Feature Matrix（功能对比表）
- 产出 Positioning Map（两轴定位图，选用户真在意的轴）
- 每条发现带 `[SOURCE: url]` 引用

**代码现状 agent**：
- 用 semble-search 扫描代码库
- 找已有的相关实现、可复用模块、pattern
- 标注 `[Read path:line]` 来源

**市场/社区 agent**：
- 搜社区（Reddit / HN / 知乎 / GitHub Issues / 论坛）
- 搜用户评价（G2 / ProductHunt / App Store）
- 提取痛点、需求信号、用户反馈
- 每条带 `[SOURCE: url]` 引用

**已有方案 agent**：
- 搜开源项目 / 库 / 框架
- 搜最佳实践文章、架构模式
- 用 deepwiki 查相关库文档
- 评估成熟度和适用性

**工具降级**：Exa/WebSearch 不可用 → 跳过该切面，标注 `[网络不可用, 跳过]`。semble-search 不可用 → 降级 Bash grep，标注 fallback。

### Step 3: 综合

汇总各切面结论，写成结构化 research-memo（填好的示例见 `references/examples/example-research-memo.md`，对照颗粒度不照搬）：

```markdown
# Research Memo: {topic}
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

## 市场/社区信号
- [SOURCE: url] 信号 1
- [SOURCE: url] 信号 2

## 已有方案
- [SOURCE: url] 方案 1: ...
- [SOURCE: url] 方案 2: ...

## Go/No-Go 建议
**建议**: Go / No-Go / 需要更多信息
**理由**: ...
**Stop Criteria**: [什么条件下应该放弃]
**[ASSUMED]**: [AI 的判断依据，需用户核验]
```

**每条发现必须带 `[SOURCE]` 引用**——无来源的发现不写进 memo。

没有调研到结果的切面写"未找到相关信息"，不编造。

### Step 4: Go/No-Go

把 memo 的 Go/No-Go 建议展示给用户，用 AskUserQuestion：

- **Go** — 继续，建议接 prd skill 写 PRD
- **No-Go** — 放弃，标注原因
- **需要更多调研** — 回 Step 1 补充切面或深入某个方向

**AI 不替用户决定 Go/No-Go**。AI 给建议 + 理由，用户拍板。

### Step 5: 保存

research-memo 存到 `{pd_research_output}` 变量指定的路径（见 `model/agent-about.md`「文档产出路径变量」）。

完成后提示用户："调研完成。要继续写 PRD 吗？（调 `nocode-evolve:pd-prd`）"

## Exit Gate

- [ ] research-memo 已产出，包含至少一个切面的结构化结论
- [ ] 每条发现有 `[SOURCE]` 引用
- [ ] Go/No-Go 建议已给出，用户已拍板
- [ ] memo 文件已保存

## AI 能力边界（硬约束）

以下是 AI 做不了的，在 memo 里遇到要显式标注：

| AI 能做 | AI 不能做（标 `[ASSUMED]`） |
|---|---|
| 竞品 feature 矩阵 | 真实用户访谈 |
| 定位图 / 象限图 | 定量满足度打分（需问卷） |
| 社区/评论/论坛搜索综合 | 付费意愿评估 |
| 开源方案评估 | 战略取舍 / 优先级判断 |

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
