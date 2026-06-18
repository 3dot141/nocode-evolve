# Design 阶段触发

design skill 的独立触发 + 增强约束。

## 触发条件

用户要求设计方案 / 方案对比 / 架构设计 / 写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec / API 设计，或 devflow 路由到 Design 阶段。

## 做法

1. `Skill(nocode-evolve:design)` — 方案探索 + 测试目标 + 用户选方案
2. Design 内部调 `Skill(nocode-evolve:design-doc-writing)` 写设计文档
3. Review 使用统一 Findings Schema（参考 `references/findings-schema.md`）
4. Review 提示词使用 adversarial framing（"find issues" 不是 "evaluate"）

## 阶段职责边界

| 阶段 | 职责 | brainstorming 用途 |
|---|---|---|
| Define | 问题边界、验收标准、场景分类 | 发散问题空间（真问题是什么） |
| **Design** | **方案探索、测试目标、设计文档** | **发散解法空间（怎么做）** |
| Plan | 任务拆分、实现顺序 | — |

## 增强约束（v2 — 融合 agent-skills）

### 设计 Review 五轴

| 维度 | 检查什么 |
|---|---|
| 可行性 | 能按描述实现吗？技术可行性 |
| 清晰度 | 读者能看懂吗？歧义/遗漏 |
| 一致性 | 与现有架构冲突吗？ |
| 安全影响 | 引入新攻击面吗？轻量 threat model (STRIDE) |
| 可扩展性 | 会成为瓶颈吗？ |

### Source-Driven 前置检查

设计文档引用的代码/API 必须是 Read 过的真实状态，不凭记忆。引用格式 `[Read path:line]`。

### API 契约设计（涉及 API 时）

参考 `design-doc-writing/references/api-design-guide.md`（如已创建）：
- Hyrum's Law：所有可观察行为都是隐式契约
- Contract-first：先定义接口再实现
- One Version Rule：不强迫消费者选版本

### 轻量 Threat Model（涉及外部输入/认证/数据时）

设计阶段先做轻量 STRIDE 分析：
1. 画信任边界（哪里有外部输入）
2. 命名资产（什么值得偷/破坏）
3. 对每个边界跑 STRIDE 6 问

不需要正式安全审计——只需 5 分钟"如果我是攻击者"的思考。

## 不要

- 不跳过方案探索直接写文档——方案未经对比的设计文档是假设不是设计
- 不跳过 review 直接进 Plan——设计文档必须评审通过
- 不让 review 走"验证"模式——必须 adversarial（"find issues"）
- 不引用没有 Read 过的代码——先看再写
- 不在 Define 未完成时进 Design——问题都没定义清楚，方案对比无基准
