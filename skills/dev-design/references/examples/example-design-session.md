# Example: 从 restate 到确认方案

演示一次 Design 会话——给定 restate"重构通知系统支持多渠道"，如何探索解法空间、对比方案、选定并推导测试目标。

## 输入：restate（来自 Define）

> **目标**：通知系统当前只发站内信，需支持 email + 短信，且新增渠道不改核心逻辑。
> **Quality Bar**：新增一个渠道 ≤ 1 个文件；发送失败可重试；渠道故障不阻塞其他渠道。
> **Out of Scope**：通知模板编辑器、用户订阅偏好管理。

## Step 1: 探索解法空间（三层并行）

- **代码 pattern** `[Read notify/sender.ts:30]`：现有 `sendInApp()` 硬编码，调用方直接 `import` 它——无抽象层。
- **外部方案** `[SOURCE: refactoring.guru/strategy]`：多渠道分发是 Strategy + Registry 的经典场景；`[SOURCE: nodemailer docs]` email 有成熟库。
- **已有决策** `[Doc wiki/pages/notify.md]`：曾决定"通知不引入消息队列"（团队无 MQ 运维）——排除异步 queue 方案。

## Step 2: 提出方案（差异化）

| 方案 | 核心思路 | 优势 | 代价 |
|---|---|---|---|
| **A. Channel 接口 + Registry** | 每渠道实现 `Channel` 接口，注册到 registry，分发器遍历 | 新增渠道=新增 1 文件（满足 Quality Bar）；渠道隔离 | 需先建抽象层 |
| **B. switch-case 分发** | 一个 `send(type)` 里 switch 各渠道 | 改动小、直观 | 新增渠道要改核心 switch（违反 Quality Bar） |
| **C. 事件总线** | 发通知 = emit 事件，各渠道订阅 | 完全解耦 | 引入事件框架，超出当前需要（YAGNI），且接近被排除的异步方案 |

**推荐 A** —— 唯一满足"新增渠道≤1文件 + 渠道隔离"两条 Quality Bar 的方案。B 违反核心约束，C 过度设计。

## Step 3: 用户选方案

AskUserQuestion（A 推荐放第一）→ 用户选 A。

## Step 4: 方案←→目标对齐

回检 restate：A 的"分发器遍历 + 单渠道 try-catch"天然满足"渠道故障不阻塞其他渠道"；"失败可重试"需在 Channel 接口加 `retry` 策略 → 无冲突，继续。

## Step 5: 测试目标（每条 SC → ≥1 测试目标）

| Success Criteria | 测试目标 | 层级 |
|---|---|---|
| 新增渠道 ≤1 文件 | 单测：mock 一个新 Channel 注册后能被分发 | 单元 |
| 发送失败可重试 | 单测：Channel 抛错触发 retry，N 次后标记失败 | 单元 |
| 渠道故障不阻塞其他 | 集成：email 渠道抛错，验证 sms 仍发送成功 | 集成 |

→ 传递给 Plan（指导切片）+ Build（驱动 TDD）+ Verify（验收核对）。

---

**这个示例的关键点**：方案在核心架构上差异化（不是参数变体）；推荐落到 restate 的具体约束上；已有决策（无 MQ）直接排除了一类方案；测试目标逐条挂到 Success Criteria。
