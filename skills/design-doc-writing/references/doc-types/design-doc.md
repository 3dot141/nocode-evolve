# Design Doc（Detailed Design Document）

详细设计文档——回答 **"how will we implement this?"**，工程团队实施前的 alignment。

## 何时用 Design Doc

- 实施前对一个 feature / system / 改造进行详细设计
- 工程团队内部 alignment（不像 RFC 那样跨团队）
- 需要在写代码前讨论 trade-offs
- **不是** 单一架构决策（用 ADR）
- **不是** 产品需求（用 PRD）

## 主线节（上半 / 下半两半结构）

### 上半（Human Review）

#### TL;DR
- 30 秒读懂核心
- 这是什么 + 为什么做 + 怎么做（一句话）

#### Problem Statement
- 要解决什么问题？
- 现状 / 痛点（具体到 file path、metric、bug ID）

#### Goals / Non-Goals【必填】
- Goals: 这个设计要达成什么
- Non-Goals: 明确**不做**什么——同等具体

#### Alternatives Considered【≥1 + 否决理由】
- 至少 1 个被否决方案 + 具体理由
- 复杂决策建议 ≥2

#### Trade-offs
- 这个方案有什么代价？
- 牺牲了什么换什么？

### 下半（Agent Implementation）

#### Component / Module Design
- 主要组件清单（职责 / 接口）
- 与现有模块的关系

#### API Contracts / Function Signatures
- 接口的**具体形状**（代码 / JSON 示例）
- 不要描述，给真实形状

#### Data Model
- 新表 / 新字段 / 迁移脚本
- 无变更也明示"无变更"

#### Error Handling
- 失败模式表（场景 / 用户感知 / 系统行为）
- 真实可能发生，不要假想

#### Testing Strategy
- 单测 / 集成 / 人工验证具体场景

#### Cross-cutting Concerns Checklist【必逐项回应，N/A 也要说理由】
- [ ] Security / Privacy
- [ ] Monitoring / Observability
- [ ] Performance Budget
- [ ] Migration / Rollout
- [ ] Backwards Compatibility
- [ ] Documentation Updates

详见 `common.md`。

## 覆盖深度：架构层 vs 开发层

判断任务粒度，决定是否叠加 architecture layer：

| 任务粒度 | 该读什么 | layer 字段值 |
|---|---|---|
| **小改动**：改某几个函数、加字段、调整配置 | 只读 `layer-supplements/implementation.md` | `implementation` |
| **系统级**：新模块 / 新服务 / 子系统重新设计 | 读 `layer-supplements/architecture.md` **+** `implementation.md`（两者**叠加**） | `architecture+implementation` |

**不是二选一——架构层是叠加的**。系统级文档必须**既有**架构思考（边界 / 组件 / 数据流 / 失败模式）**也有**实施细节（接口 / 数据 / 错误处理）。

## 状态机

```
draft → in-review → approved → implemented → archived
```

注：design doc 是 **living document**——approved 后实施中仍可修改（反映实际实施变化），完成后归档。

与 ADR 不同：ADR 一旦 accept 就 immutable，design doc 允许 in-place 修订。

## frontmatter

```yaml
---
type: design-doc
layer: implementation   # 或 architecture+implementation（系统级）
topic: <一句话讲设计>
date: YYMMDD
author: <username>
status: draft   # draft | in-review | approved | implemented | archived
last_updated: YYMMDD   # 实施中修订时更新
---
```

## 写作纪律

- ✅ 上半给人 review，下半给 agent 实施——边界清楚
- ✅ Non-Goals 必填，与 Goals 同等具体
- ✅ Alternatives 真备选 + 真否决理由
- ✅ 下半部具体（文件路径 / 函数名 / 数据 shape）
- ✅ Cross-cutting checklist 每条都回应（即使 N/A）
- ❌ 不要把 PRD 的"用户需求"塞 design doc——上游已有 PRD 就 cross-ref
- ❌ Cross-cutting 不写"N/A"敷衍——要说明为什么不适用

## 长度参考

5-15 页常见；小改动 2-3 页；系统级 10-20 页。超过 20 页考虑拆分。
