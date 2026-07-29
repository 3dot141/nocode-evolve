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

## Step 2: 建立设计图

先展开多路径,不先锁架构:

| 路径 | 场景 |
|---|---|
| P1 | 调用方发送一条通知到多个渠道 |
| P2 | 单渠道失败后重试,其它渠道继续 |
| P3 | 新增渠道且不改核心分发逻辑 |
| P4 | 查询一次通知各渠道的发送结果 |

初始架构缺口:渠道边界怎么拆、分发状态归谁、重试如何隔离、结果如何汇总。

## Step 3-5: full 深度的三轮设计图下钻

### Round 1: 系统拓扑

| 方案 | 推荐度 | 推荐原因 | 代价 / 改选条件 |
|---|---:|---|---|
| **A. 模块化单体 + Channel Registry** | 5 | 唯一同时满足"新增渠道≤1文件"、无 MQ 约束和渠道隔离 | 需建抽象层;吞吐/隔离需求显著上升时重评事件总线 |
| **B. switch-case 分发** | 1 | 改动小,但直接违反新增渠道不改核心逻辑 | 仅一次性固定渠道时才可考虑 |
| **C. 独立渠道消费者 + 事件总线** | 2 | 解耦强,但违反已有"不引入 MQ"决策且当前 YAGNI | 团队具备 MQ 运维且需独立扩缩容时重评 |

agent 暂定 A,状态 `provisional`;传播到 P1/P3,形成 `Caller → Dispatcher → Channel Registry → Channel` 架构主干。新缺口:分发状态和失败重试放在哪。

### Round 2: 状态所有权 + 重试边界

| 方案 | 推荐度 | 推荐原因 | 代价 / 改选条件 |
|---|---:|---|---|
| **A. Dispatcher 统一重试整次发送** | 2 | 实现集中,但单渠道失败会重跑成功渠道,违反 P2 | 只有全渠道强一致时考虑 |
| **B. 每个 Channel 返回独立 DeliveryResult,RetryPolicy 按渠道执行** | 5 | 失败隔离且结果可汇总,同时闭环 P2/P4 | 接口需携带 attempt/error/status |
| **C. Channel 内部自行吞掉重试状态** | 2 | Channel 自包含,但 Dispatcher 无法提供完整 P4 结果 | 不要求统一结果查询时才可用 |

agent 暂定 B;Round 1 的 A 因得到重试/状态证据升级为 `validated`。设计图新增 `DeliveryResult`、`RetryPolicy` 和按渠道状态集合,影响 P1/P2/P4。新缺口:并行还是串行分发、并发失败怎样收口。

### Round 3: 分发并发 + 结果汇总

| 方案 | 推荐度 | 推荐原因 | 代价 / 改选条件 |
|---|---:|---|---|
| **A. 串行遍历渠道** | 3 | 最简单,但慢渠道会拖延其它渠道 | 渠道数固定且延迟不敏感时可用 |
| **B. 有界并行发送 + allSettled 汇总** | 5 | 慢/坏渠道互不阻塞,直接满足 P1/P2,又能汇总 P4 | 需设并发上限和逐渠道超时 |
| **C. fire-and-forget** | 1 | 调用返回最快,但结果与重试不可追踪 | 只有完全不关心结果时才可用 |

agent 暂定 B;端到端设计闭环:

```text
Caller
  → Dispatcher
  → Registry 取已启用 Channels
  → 有界并行调用 Channel.send()
  → 每渠道按 RetryPolicy 独立重试
  → 汇总 DeliveryResult[]
  → 返回/保存各渠道状态供 P4 查询
```

三轮后回检整张图:P1-P4 均映射到组件;跨组件边有 `Channel.send()` / `DeliveryResult` 契约;状态归 Dispatcher 侧的 delivery aggregate;失败/重试路径闭环;无可能推翻模块化单体 + Registry 的高影响缺口。若仍有缺口则继续 Round 4+,不能因已满三轮停止。

## Step 6-8: 领域覆盖 + 测试目标 + Packet 终审

| Success Criteria | 测试目标 | 层级 |
|---|---|---|
| 新增渠道 ≤1 文件 | 单测：mock 一个新 Channel 注册后能被分发 | 单元 |
| 发送失败可重试 | 单测：Channel 抛错触发 retry，N 次后标记失败 | 单元 |
| 渠道故障不阻塞其他 | 集成：email 渠道抛错，验证 sms 仍发送成功 | 集成 |

Decision Packet 展示完整路径图、架构图、三轮决策链、推荐度/原因/证据/改选条件和 TO,此时才由用户一次终审;通过后交 writing 在同一 `docPath` 忠实扩写。

---

**这个示例的关键点**：本例因多渠道、失败隔离和查询路径选择 `designDepth: full`，所以至少三轮；focused 小改只需至少一轮真实比较。无论深度，都从多路径 + 架构关系图挑最承重缺口，每轮比较完整切片并给推荐度/原因/证据/改选条件，传播到所有受影响路径，满足闭环条件才终审。已有决策（无 MQ）可以直接淘汰候选，测试目标逐条挂到 Success Criteria。
