# ADR（Architecture Decision Record）

单一架构决策记录——回答 **"why did we decide X?"**，给未来的工程师看。

## 何时用 ADR

- 团队 / 个人做了一个有 trade-off 的架构选择
- 决策本身比实施细节重要（"为什么" > "如何"）
- 决策可能在未来被质疑（"为什么我们用 X 不用 Y？"）
- **不是** 实施细节（用 Design Doc）
- **不是** 跨团队提案（用 RFC）

## ADR 的特殊性：Immutable

**一旦 accept 后绝不修改。**

如果决策变了，写**新 ADR + supersede 旧的**：

- 新 ADR frontmatter：`supersedes: ADR-NNN`
- 旧 ADR frontmatter：`superseded_by: ADR-MMM`，status 改 `superseded`

这与 Design Doc / RFC 不同（它们是 living document，可 in-place 修改）。

## 骨架

ADR 整篇都简短——1-2 页，整体面向人 review。

```
## 背景         (面对什么决策 + 什么 trigger + 力的对抗)
## 决策
说明：本次要决定什么 / 决策对象
方案对比：方案 A / B / C 的关键差异（每方案 优点 + 否决理由）
结论：选 X，因为 Y（主动语态、现在时态）
## 后果
正面 / 负面 / 中性
```

**关键约束**：

- ADR 只讨论**一个**决策——因此不需要"问题拆解"，整篇就是这一个问题的「说明 / 方案对比 / 结论」三件套
- 「决策.方案对比」≥ 2 个真备选 + 真否决理由——不允许稻草人方案
- 「后果」必含负面——trade-off 是 ADR 的灵魂，没负面不是真决策
- 「决策.结论」用主动语态、现在时态："我们将 X"——不是"建议 / 可能 / 应该"
- 不写长篇 implementation 细节（用 Design Doc）

## 各节写作要点

### 背景

- 面对的决策是什么？什么 trigger 触发现在要决定？
- **力的对抗**：x 约束 vs y 约束——ADR 经典写法
- 不决定的代价：列具体后果（"再拖一周会导致 X"、"不决就是默认选了 Y，但 Y 有问题"）
- 不要复述上下文流水账——只留与决策相关的部分

### 决策

#### 说明

一段话讲清要决定什么。范围、约束、与什么不相关都讲明。

#### 方案对比

≥ 2 个真备选，每个：

```
**方案 A：<名字>**
- 优点：...
- 否决理由：<具体到 metric / 场景 / 量化的成本>

**方案 B：...**
```

每方案 1-3 行——ADR 主战场是结论，不是把每方案展开成 design doc。

#### 结论

主动语态、现在时态。一句话或一段话：

> 我们将 X，因为 Y。

### 后果

```
**正面**：
- ...

**负面**：（必填）
- 实施成本
- 引入的新限制 / 复杂度
- 与既有系统的摩擦

**中性**：（如有）
- 变化但不算好坏
```

不允许只写正面——decision 必有 trade-off，没负面就是没真选过。

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

## 长度参考

1-2 页。超过 3 页通常说明应该是 Design Doc。

## 与其他 doc-type 的关系

- **PRD 描述需求 → Design Doc 详细设计 → Design Doc 中的关键决策提炼为 ADR**
- 一份 Design Doc 通常衍生多个 ADR（每个关键技术选型一个）
- ADR 可以独立于 Design Doc 存在（如"我们使用 PostgreSQL"这种基础选型）

## 写作纪律

- 简短——目标 1-2 页
- 「决策.结论」主动语态、现在时态
- 「决策.方案对比」≥ 2 个真备选 + 真否决理由
- 「后果」必含负面
- 不要 ADR 改写——改决策就写新 ADR + supersede
- 不要长篇 implementation 细节
- 不要 ADR + Design Doc 混在一起——分两个文档，cross-ref
