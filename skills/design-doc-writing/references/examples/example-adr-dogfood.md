---
type: adr
adr_id: ADR-002
topic: 去掉 design-doc-writing skill 的 layer 概念，由问题拆解 + 逻辑 X 详细度自然表达覆盖深度
date: 260512
author: 3dot141
status: accepted
supersedes: ADR-001
---

# ADR-002：去掉 design-doc-writing skill 的 layer 概念

> dogfood：本次 skill 重构里的一个具体决策——从两层（architecture / implementation）的 layer 字段切换为"由骨架自然表达"。演示 ADR 的简短写法。

## 背景

在 design-doc-writing skill 重构（260512）中，旧骨架支持 `layer: implementation | architecture+implementation` frontmatter 字段——writer 判断任务粒度后填值，决定读 `references/layer-supplements/architecture.md` 还是叠加。

**力的对抗**：

- 一边：layer 字段提供"系统级 vs 小改动"明确区分，writer 知道该多重还是轻
- 另一边：layer × doc-type 组合增加判断成本——writer 要做两次选择（doc-type + layer）；且 layer 字段对其他 doc-type（PRD / RFC / ADR）无意义，仅 design-doc 用
- 新骨架引入「问题拆解」+「逻辑 X」线性结构——覆盖深度可以由**问题数 + 每个逻辑的详细度**自然表达，不需要显式字段

不决定的代价：保留 layer 会让新骨架与旧概念共存，writer 困惑"我已经按问题拆解写了，还要填 layer 吗？"

## 决策

**说明**

要决定的是：design-doc frontmatter 的 `layer` 字段保留还是删除？以及 `references/layer-supplements/` 目录是删还是留？

范围限定：仅 design-doc 类型；不影响 PRD / RFC / ADR。

**方案对比**

**方案 A：保留 layer 字段 + layer-supplements 目录**

- 优点：向后兼容；writer 仍能用 layer 标记任务粒度作元信息
- 否决：与新骨架重复——「架构.问题拆解」节数已经表达了粒度（1-2 个问题 = 小改动；4-6 个 = 系统级）。维持 layer 字段会让 writer 困惑该看新骨架还是旧 layer-supplements

**方案 B：删除 layer 字段，目录暂保留作 deprecated**

- 优点：frontmatter 干净；覆盖深度由骨架自然表达；保留目录给历史文档 cross-ref
- 否决理由：无（选定方案）

**方案 C：删除 layer 字段 + 立即删 layer-supplements 目录**

- 优点：最彻底
- 否决：历史 design doc 可能仍 cross-ref 到 `layer-supplements/architecture.md`；立即删会产生 dead link

**结论**

我们采用方案 B：删除 design-doc frontmatter 的 `layer` 字段；`references/layer-supplements/` 目录暂保留作 deprecated reference，下个 minor 版本（0.22.x）再清理。

## 后果

**正面**：

- frontmatter schema 简化（design-doc 字段从 7 → 6）
- writer 判断成本降低——只需选 doc-type 一次，不再二次判断 layer
- 「覆盖深度」由骨架表达（问题数 + 逻辑详细度），更符合直觉
- 与新骨架"线性递进、无元标签"原则一致

**负面**：

- 历史 design doc（带 `layer: ...` frontmatter）会被新 reviewer 报 Warning `deprecated field`——需要手动迁移或在 Review Log 标注"legacy"
- `layer-supplements/` 目录处于 limbo 状态（保留但不再被引用），下个版本要再做一次清理动作
- 失去了"显式声明覆盖深度"的元信息——reviewer 不能机器判断"这份 doc 应该是系统级"

**中性**：

- 与业界主流 design doc 模板一致——Google / Meta / Abnormal AI 公开的模板都没有 layer 字段

---

> 本 ADR supersede ADR-001（reviewer 6 维度审查框架）——因为重构后 reviewer 维度从 6 扩为 7，ADR-001 的决策记录已不准确。新维度集见 `agents/design-doc-reviewer.md`。
