# PRD（Product Requirements Document）

产品需求文档——回答 **"what + why"**，给团队对齐用，是工程设计的起点。

## 何时用 PRD

- 新产品 / 新模块 / 新 feature 立项
- 产品负责人和工程团队对齐需求
- **不是** 工程实施细节（用 Design Doc）
- **不是** 单一架构决策（用 ADR）

## 主线节（上半 / 下半两半结构）

### 上半（Human Review）

#### Problem Statement
- 用户痛点 / 业务问题
- 现状 vs 期望
- 不做的代价（loss）

#### Target Users
- 用户 persona / 角色
- 使用频率与场景

#### Goals / Non-Goals【两个都必填】
- Goals: 这个 feature 要达成什么（可衡量）
- Non-Goals: 明确**不做**什么——同等重要！

#### Success Metrics
- 怎么衡量做成了？
- 量化指标（DAU、转化率、错误率、时间节省）

### 下半（Light Implementation Hints）

#### User Stories / Use Cases
- 2-3 个具体场景（who / what / when / expected）
- 反例："用户可以查看订单"
- 正例：场景化叙述含人名 / 时间 / 动作 / 预期

#### Acceptance Criteria
- 可验证的判据 checklist
- 包含边界情况

#### Out of Scope
- 明确排除（防止 scope creep）

## 状态机

```
draft → in-review → approved → implemented → archived
```

## frontmatter

```yaml
---
type: prd
topic: <一句话讲这个产品 / feature 是什么>
date: YYMMDD
author: <username>
status: draft   # draft | in-review | approved | implemented | archived
---
```

## 写作纪律

- ✅ 写"为什么"——每个需求附理由
- ✅ Non-Goals 与 Goals 同等具体（不能写"其他都不做"敷衍）
- ❌ 不要写工程实施细节（接口 schema / 数据库 / 算法）——那是 Design Doc 的事
- ❌ 不要堆功能清单——PRD 是问题驱动，不是功能驱动

## 长度参考

1-2 页正常；超过 3 页通常说明 scope 太大，考虑拆分多个 PRD。
