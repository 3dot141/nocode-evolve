# ADR（Architecture Decision Record）

单一架构决策记录——回答 **"why did we decide X?"**，给未来的工程师看。

## 何时用 ADR

- 团队 / 个人做了一个有 trade-off 的架构选择
- 决策本身比实施细节重要（"为什么" > "如何"）
- 决策可能在未来被质疑（"为什么我们用 X 不用 Y？"）
- **不是** 实施细节（用 Design Doc）
- **不是** 跨团队提案（用 RFC）

## ADR 的特殊性：**Immutable**

**一旦 accept 后绝不修改。**

如果决策变了，写**新 ADR + supersede 旧的**：
- 新 ADR frontmatter：`supersedes: ADR-NNN`
- 旧 ADR frontmatter：`superseded_by: ADR-MMM`，status 改 `superseded`

这与 Design Doc / RFC 不同（它们是 living document，可 in-place 修改）。

## 主线节（经典 4 段，**不分两半**）

ADR 整篇都简短——1-2 页，整体面向人 review。

#### Context
- 我们面对什么决策？
- 什么 constraint？什么 trigger？
- 力的对抗：x 约束 vs y 约束

#### Decision
- 我们决定做 X
- 一句话陈述（"我们将 X"——主动语态、现在时态）

#### Consequences【正 / 负面都写】
- 正面：这个决策带来什么好处
- 负面：付出什么代价（**必填**——decision 必有 trade-off）
- 中性：什么变化但不算好坏

#### Alternatives Considered【≥2 个备选 + 否决理由】
- 至少 2 个备选方案 + 真否决理由
- 每个：方案 → 优点 → 否决理由

## 状态机

```
proposed → accepted → superseded
proposed → rejected
accepted → deprecated   # 被淘汰但不被替代
```

## frontmatter

```yaml
---
type: adr
adr_id: ADR-NNN   # 仓库内递增唯一编号
topic: <决策一句话>
date: YYMMDD
author: <username>
status: proposed   # proposed | accepted | rejected | superseded | deprecated
supersedes: ADR-MMM      # 可选：本 ADR 替代了哪个旧 ADR
superseded_by: ADR-PPP   # 可选：本 ADR 被哪个新 ADR 替代
---
```

## 写作纪律

- ✅ 简短——目标 1-2 页
- ✅ Consequences 必含负面（trade-off 是 ADR 的灵魂）
- ✅ Alternatives ≥2（单一备选意味着没真选过）
- ✅ Decision 用主动语态、现在时态
- ❌ 不要 ADR 改写——改决策就写新 ADR + supersede
- ❌ 不要长篇 implementation 细节（用 Design Doc）
- ❌ 不要 ADR + Design Doc 混在一起——分两个文档，cross-ref

## 长度参考

1-2 页。超过 3 页通常说明应该是 Design Doc。

## 与其他 doc-type 的关系

- **PRD 描述需求 → Design Doc 详细设计 → Design Doc 中的关键决策提炼为 ADR**
- 一份 Design Doc 通常衍生多个 ADR（每个关键技术选型一个）
- ADR 可以独立于 Design Doc 存在（如"我们使用 PostgreSQL"这种基础选型）
