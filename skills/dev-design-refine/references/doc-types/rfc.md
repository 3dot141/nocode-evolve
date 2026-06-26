# RFC（Request for Comments）

提案性文档——回答 **"is this the right direction?"**，跨团队收 feedback 用。

## 何时用 RFC

- 跨团队 / 跨服务 / 跨外部影响的变更
- 需要 alignment 而不只是记录
- 期望多方反馈（多种意见、对立观点）
- **不是** 单一团队内决策（用 Design Doc 或 ADR）

## 骨架

```
## 背景         (跨团队的真实痛点 + evidence)
## 目标         (RFC 要争取认同的事 / 目标)
## 提案
### 提案核心    (一段话讲清"提议做什么 + 期望什么变化")
### 问题拆解
#### 问题一 <名字>
说明 / 方案对比 / 结论
#### 问题二 ...
### 提案总结    (整体方案一段话)
## 影响评估
### 受影响方     (列谁会被影响、怎么被影响)
### 缺点 / 风险  (必含——promo 文不是 RFC)
### 迁移 / 兼容  (如有)
## 开放问题     (留给 reviewer 回答的问题；评审中讨论)
```

**关键约束**：

- 「背景」必含 evidence（数据 / 调研 / 真实需求）——不是"感觉应该"
- 「问题拆解」每问题三件套（说明 / 方案对比 / 结论），与 Design Doc 一致
- 「影响评估.缺点 / 风险」**必填**——不写就是 promo 文
- 「开放问题」是 RFC 特有节，列**还没确定、希望 reviewer 回答**的问题
- 不展开实施细节（接口签名 / 具体代码改动）——那是 Design Doc 的事

## 各节写作要点

### 背景

跨团队的真实痛点 + 量化 evidence。

**力的对抗**写法：x 约束 vs y 约束 + 不做的代价——这种格式特别适合 RFC，让 reviewer 看到张力。

不允许"业界都这么做"式 vague attribution——给具体来源 / 数据 / 案例。

### 目标

本 RFC 要争取的认同 / 决策。不是技术目标——是"团队接受这个方向"的目标。

### 提案

#### 提案核心

一段话讲清提议做什么 + 期望什么变化。读者读完这一段应能 grasp 整体提案。

#### 问题拆解

与 Design Doc 同——每问题独立讨论，方案对比 + 否决理由。

跨团队 RFC 通常 4-6 个问题（团队各自关心点不同）；单团队内问题集中。

#### 提案总结

整体方案一段话，承接「影响评估」。

### 影响评估

#### 受影响方

列谁会被影响（用户 / 团队 / 服务）、被影响什么（接口变 / 流程变 / SLA 变 / 数据迁移）。

#### 缺点 / 风险

必填。RFC 没缺点节就是 promo 文。

- 实施成本（人月 / 时间）
- 引入的新复杂度
- 失败模式 / 回滚难度
- 与现有系统的摩擦

#### 迁移 / 兼容（如有）

涉及 schema / API breaking / data migration 时必写迁移路径。

### 开放问题

RFC 特有——列**评审中希望讨论的问题**：

```
- 问题 1：<具体问题，期望 reviewer 给意见>
- 问题 2：...
```

不是"未来可能扩展" / "后续可考虑"占位话——这些直接删。

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

## 长度参考

3-10 页常见；评审周期通常 1-2 周；accept 后可衍生多个 Design Doc + ADR。

## 写作纪律

- 「背景」必含 evidence
- 「问题拆解」每问题 说明 / 方案对比 / 结论 三件套
- 「影响评估.缺点 / 风险」必填
- 「开放问题」列具体问题，不堆"未来可扩展"占位话
- 不写实施细节（具体接口 / 代码）
- 不写"this is the future" / "revolutionary" 等 promo 用语
