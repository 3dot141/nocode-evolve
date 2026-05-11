# RFC（Request for Comments）

提案性文档——回答 **"is this the right direction?"**，跨团队收集反馈用。

## 何时用 RFC

- 跨团队 / 跨服务 / 跨外部影响的变更
- 需要 alignment 而不只是记录
- 期望多方反馈（多种意见、对立观点）
- **不是** 单一团队内决策（用 Design Doc 或 ADR）

## 主线节（上半 / 下半两半结构）

### 上半（Human Review）

#### Summary
- 1 段，让 reader 30 秒理解
- 包含核心 motivation + proposal 的一句话

#### Motivation【最重要节，必含 evidence】
- 为什么这个变更**现在**必须做？
- 力的对抗：x 约束 vs y 约束，不决定的代价
- 数据 / 调研 / 真实需求支撑（不是"感觉应该"）

#### Guide-level Explanation
- 教读者"如同已实现"
- 给具体 example / 用户视角
- 命名 / 术语 / adoption path

#### Drawbacks【必填，最容易被回避】
- 这个变更的负面 / 风险 / 代价
- 不写 drawback 的 RFC 是促销文，不是 RFC

#### Rationale & Alternatives【≥2 个备选 + 否决理由】
- 为什么选这个方案 vs 其他？
- 至少 2 个 alternative + 具体否决理由
- 对比矩阵（trade-offs）

### 下半（Agent Implementation）

#### Reference-level Explanation
- 详细技术设计
- 接口签名 / data shape
- 与现有系统的 integration points
- Diagrams（架构图 / 数据流图）

#### Implementation Plan
- 分 phase 实施
- 每 phase 的 deliverable + acceptance
- Migration / rollback strategy

#### Unresolved Questions
- 还没确定的问题
- 需要 RFC 评审中讨论的点

## 状态机

```
open → accepted → implemented → superseded
open → withdrawn
open → rejected
```

## frontmatter

```yaml
---
type: rfc
rfc_id: RFC-NNN   # 仓库内递增唯一编号
topic: <一句话讲提案>
date: YYMMDD
author: <username>
status: open   # open | accepted | rejected | withdrawn | implemented | superseded
---
```

## 写作纪律

- ✅ Motivation 必含 evidence（数据 / 调研 / 真实需求）
- ✅ Alternatives ≥2 个真备选（不是稻草人方案，要有真否决理由）
- ✅ Drawbacks 必填（promo 文不是 RFC）
- ❌ 不要写得像 promo（"this is the future" / "revolutionary"）
- ❌ 不要 RFC + ADR 混淆：RFC 是讨论中的提案，ADR 是已做的决策

## 长度参考

3-10 页常见；评审周期通常 1-2 周；accept 后可衍生多个 Design Doc + ADR。
