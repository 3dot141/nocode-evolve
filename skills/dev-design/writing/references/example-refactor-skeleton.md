# refactor 产出骨架示例

> 以"Nocode Manager 资源同步从轮询改为事件驱动"为例。实际产出按项目调整，学结构和思路不照搬措辞。
> refactor 与 feat 的区别：核心是 Before/After 对比 + 可回滚的迁移策略，重在"证明行为不变"。

---

## 背景

核心问题：资源库有变更（新增/编辑/删除资源）后，需要同步到已连接的 Agent。当前用**定时轮询**——每 30 秒扫一遍所有资源，对比 hash 找出变更，再推送。

三个痛点（核心痛点是延迟）：
- **核心：同步延迟高**。用户改完资源最长要等 30 秒才同步，体感"没生效"
- 辅助：轮询空转。90% 的轮询没有任何变更，白扫一遍，浪费 CPU
- 辅助：扩展性差。资源量涨到 1000+ 后，单次全量扫描 hash 对比耗时超过轮询间隔，开始堆积

不改业务行为（同步的结果完全一致），只改"怎么触发同步"——从"定时拉"改成"变更推"。

## 调研

**现状代码分析**：
- [Read src/services/sync.ts:34] `SyncPoller.start()` 用 `setInterval(30_000)` 定时触发
- [Read src/services/sync.ts:52] `scanAndDiff()` 全量读资源 + 算 hash + 对比上次快照
- [Read src/services/sync.ts:88] `syncToAgent()` 单资源同步逻辑（**复用，不改**）
- [Read src/models/resource.ts:120] `ResourceRepo.update()` 是所有资源变更的唯一收口——事件埋点的天然位置

**外部方案**：

| 方案 | 代表 | 启发 |
|---|---|---|
| [SOURCE: nodejs EventEmitter] | 进程内事件总线 | 单实例够用，零依赖 |
| [SOURCE: redis pub/sub] | 跨进程消息 | 多实例才需要，当前 over |
| [SOURCE: postgres LISTEN/NOTIFY] | DB 触发事件 | 绑死 PG，灵活性低 |

启发：当前单实例部署，进程内 EventEmitter 足够；多实例化时再升级 Redis pub/sub。

**已有决策**：
- [Read .agents-personal/wiki/pages/sync-design.md] 同步幂等性已保证（syncToAgent 内部去重），事件驱动不破坏这条

## 现状分析

### 现状结构总图

```
┌─────────────────────────────────────────────────┐
│                  Sync 域（现状）                  │
│                                                 │
│  ┌──────────────┐                               │
│  │  SyncPoller   │  setInterval(30s)            │
│  │  start()      │ ←──────── 定时器             │
│  └──────┬───────┘                               │
│         │ 每 30s 触发                            │
│         ↓                                       │
│  ┌──────────────┐     全量扫描 + hash 对比      │
│  │ scanAndDiff() │ ←─── [问题①] 90% 空转        │
│  └──────┬───────┘     [问题②] O(n) 扫描随量增长 │
│         │ 找出变更资源                          │
│         ↓                                       │
│  ┌──────────────┐                               │
│  │ syncToAgent() │  ← 复用，本次不改             │
│  └──────────────┘                               │
└─────────────────────────────────────────────────┘
       ↑
  [问题③] 变更后最长等 30s 才进入这个链路
```

### DDD 视角审视

```
现状的耦合问题：
  SyncPoller 同时承担两个职责
    ├─ "什么时候同步"（定时触发）   ← 时间耦合
    └─ "同步什么"（扫描找变更）     ← 与资源存储耦合

  scanAndDiff 直接读 ResourceRepo 全量数据
    → Sync 域侵入了 Resource 域的存储细节
    → 资源量、存储结构一变，Sync 域就受影响
```

诊断：**触发机制（when）和变更检测（what）应该解耦**。变更检测本该是 Resource 域的事（它最清楚自己什么时候变了），Sync 域只该关心"收到变更就推送"。

## 方案选择

> **结论先行**：先看速查表，再逐 Q 展开。否决项配同等篇幅理由（反方配平），决策标 `[已确认]`/`[假定]`。

### 决策速查表

| # | 决策点 | 定 | 状态 | 影响 |
|---|---|---|---|---|
| Q1 | 用什么做事件机制 | **进程内 EventEmitter** | `[假定]` | 整体架构 |
| Q2 | 迁移期怎么过渡 | **双轨并行（事件为主 + 轮询兜底）** | `[假定]` | 迁移策略 |

### Q1: 用什么做事件机制？→ 影响整体架构

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| **A. 进程内 EventEmitter** | Resource 域变更时 emit，Sync 域 on | 零依赖，单实例够用 | 多实例时事件不跨进程 |
| B. Redis pub/sub | 变更发到 Redis，Sync 订阅 | 跨实例 | 引入 Redis 依赖，当前 over |
| C. PG LISTEN/NOTIFY | DB 触发器发事件 | 离数据最近 | 绑死 PG，逻辑下沉到 DB 难维护 |

**选 A（进程内 EventEmitter）**。`[假定]` 当前单实例部署，EventEmitter 零依赖、零延迟。**否决 B（Redis pub/sub）**：能跨实例，但当前单实例部署，引入 Redis 依赖是为不存在的需求付费。**否决 C（PG LISTEN/NOTIFY）**：离数据最近，但把事件逻辑下沉到 DB 触发器难维护、绑死 PG。预留 `EventBus` 接口，多实例化时替换为 Redis，调用方不变。

### Q2: 迁移期怎么过渡？→ 影响迁移策略

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 一刀切 | 直接删轮询，上事件 | 干净 | 事件漏发 = 同步丢失，无兜底 |
| **B. 双轨并行** | 事件驱动为主 + 低频轮询兜底 | 事件漏发有兜底，可灰度 | 过渡期两套逻辑共存 |

**选 B（双轨并行）**。`[假定]` 事件驱动有"漏发"风险（进程重启时内存事件丢失）。**否决 A（一刀切）**：干净，但事件漏发 = 同步丢失且无兜底，重构期风险太高。保留一个 5 分钟低频轮询作兜底网，确认事件机制稳定后再决定是否移除（见迁移策略 Step 3）。

## 目标设计

### Before / After 对比

```
         Before（轮询）                         After（事件驱动）

┌──────────────────────┐            ┌──────────────────────┐
│      Sync 域          │            │     Resource 域       │
│                      │            │                      │
│  SyncPoller          │            │  ResourceRepo.update()│
│   setInterval(30s)   │            │       │ ① emit        │
│       │              │            │       ↓ 'resource.   │
│       ↓              │            │         changed'      │
│  scanAndDiff()       │            └───────┼──────────────┘
│   全量扫描+hash对比   │                    │ ② 事件
│   [空转/O(n)]        │                    ↓
│       │              │            ┌──────────────────────┐
│       ↓              │            │      Sync 域          │
│  syncToAgent()       │            │  SyncListener         │
│                      │            │   on('resource.       │
└──────────────────────┘            │      changed')        │
                                    │       │ ③ 收到即推     │
                                    │       ↓              │
                                    │  syncToAgent() ←复用  │
                                    │                      │
                                    │  SyncPoller(5min)     │
                                    │   ④ 兜底低频轮询       │
                                    └──────────────────────┘
```

变更点：

| # | 变更 | 理由 |
|---|---|---|
| ① | ResourceRepo.update() 加 emit 'resource.changed' | 变更检测回归 Resource 域——它最清楚自己何时变 |
| ② | 新增 EventBus（EventEmitter 封装） | 解耦触发与处理，预留多实例升级口 |
| ③ | 新增 SyncListener 替代 SyncPoller 主链路 | Sync 域只关心"收到变更就推"，不再扫描 |
| ④ | SyncPoller 降级为 5min 兜底 | 事件漏发的安全网，过渡期保留 |

**行为不变性**：同步的*结果*完全一致（同样的资源推到同样的 Agent），只是*触发时机*从"30s 定时"变成"变更即时 + 5min 兜底"。syncToAgent() 一行不改。

## 迁移策略

> 三步走，每步独立可回滚。核心原则：先加新机制并验证，再降级旧机制，最后才考虑移除。

### Step 1: 加事件基础设施（纯新增，零风险）

```
新增 EventBus + ResourceRepo.update() 埋点 emit
  ↓
SyncListener 订阅事件，但此时只 log 不实际同步
  ↓
观察：事件是否在每次资源变更时都正确触发？
```

- **文件影响**：
  ```
  src/events/
    └── event-bus.ts            (NEW)  EventEmitter 封装 + EventBus 接口
  src/models/
    └── resource.ts             (改)   update() 末尾 emit 'resource.changed'
  src/services/
    └── sync-listener.ts        (NEW)  订阅事件，本步只 log
  ```
- **验证**：[ ] 集成：每次 ResourceRepo.update() → 事件触发且 payload 正确
- **回滚**：删 sync-listener.ts + 移除 update() 的 emit。轮询逻辑完全没动，零影响。

### Step 2: 双轨并行（事件为主 + 轮询降频兜底）

```
SyncListener 从"只 log"改为"实际调 syncToAgent"
  ↓
SyncPoller 间隔从 30s 改为 5min（兜底，不是主力）
  ↓
观察：变更同步延迟是否降到秒级？兜底轮询是否还能捞到漏网的变更？
```

- **文件影响**：
  ```
  src/services/
    ├── sync-listener.ts        (改)   log → 实际 syncToAgent()
    └── sync.ts                 (改)   SyncPoller interval 30s → 5min
  ```
- **验证**：
  - [ ] E2E：改资源 → 秒级同步（事件路径）
  - [ ] 集成：手动制造事件漏发 → 5min 内兜底轮询捞回（兜底路径）
  - [ ] **回归**：同步结果与轮询版完全一致（同资源同 Agent）
- **回滚**：SyncPoller 间隔改回 30s + SyncListener 改回只 log。退回 Step 1 状态，轮询重新接管。

### Step 3: 评估是否移除兜底（观察期后决策）

```
双轨运行 2 周，统计兜底轮询实际捞回的变更数
  ├─ 捞回数 ≈ 0 → 事件机制稳定，移除兜底轮询
  └─ 捞回数 > 0 → 事件有漏发，先修漏发，暂不移除
```

- **文件影响**（仅当决定移除时）：
  ```
  src/services/
    └── sync.ts                 (改)   删除 SyncPoller（或保留更低频如 1h 终极兜底）
  ```
- **回滚**：恢复 5min 兜底轮询。
- **注**：本步是决策点，不强制移除。保守做法是永久保留一个低频（如 1h）终极兜底。

## 文件影响汇总

```
src/events/
  └── event-bus.ts              (NEW)  Step 1 — EventBus 封装

src/models/
  └── resource.ts               (改)   Step 1 — update() emit 事件

src/services/
  ├── sync-listener.ts          (NEW)  Step 1 新增 / Step 2 启用
  └── sync.ts                   (改)   Step 2 — Poller 降频 / Step 3 — 评估移除

合计：2 NEW + 2 改（分 3 步落地，每步可独立回滚）
```

## 验证策略汇总

> 重构的核心是**证明行为不变**——回归测试比新功能测试更重要。

| TO | 覆盖 | 层级 | 说明 |
|---|---|---|---|
| TO-1 | 事件触发 | 集成 | ResourceRepo.update() → 事件正确 emit（Step 1）|
| TO-2 | 事件同步路径 | E2E | 改资源 → 秒级同步到 Agent（Step 2）|
| TO-3 | 兜底路径 | 集成 | 制造漏发 → 兜底轮询捞回（Step 2）|
| TO-4 | **行为等价** | 回归 | 同一组变更，事件版同步结果 == 轮询版结果（逐 Agent 逐资源比对）|
| TO-5 | 幂等性 | 集成 | 事件 + 兜底同时触发同一资源 → 不重复推送（syncToAgent 幂等）|

**回归基线**：重构前先录一组"变更→同步结果"快照作为黄金样本，重构后跑同样输入比对输出。结果不一致 = 重构破坏了行为，不许合并。

## 部署注意事项

**容器/服务**：现有 api-server 容器，无新增服务（EventEmitter 进程内）。

**环境配置**：
- 新增 `SYNC_POLLER_INTERVAL`（默认 5min，Step 2 用；原来硬编码 30s 改为可配）
- 新增 `FEATURE_EVENT_SYNC`（feature flag，控制 SyncListener 是否实际同步，支持灰度/快速回滚）

**脚本/迁移**：无 DB schema 变更。

**灰度**：
1. Step 1 全量上线（只加埋点，无行为变化）
2. Step 2 用 `FEATURE_EVENT_SYNC` 灰度：10% → 50% → 100%，每档观察 2 天
3. 关 flag 即退回纯轮询，秒级回滚

**注意**：
- 进程重启瞬间内存事件丢失 → 靠 5min 兜底轮询捞回，可接受
- 多实例化（未来）→ EventEmitter 不跨进程，需替换为 Redis pub/sub（EventBus 接口已预留）

## 基础日志设计（必写）

> 重构引入的**新机制关键路径 / 兜底触发 / 漏发**都要打 log——重构尤其要能从日志看出"新旧机制此消彼长"（⑥ 基础日志必写层，来源 Decision Packet 的 `domainDecisions.observability.basicLogging`）。

| 位置 | 级别 | 内容 | 为什么 |
|---|---|---|---|
| ResourceRepo.update emit | info | resource + 'resource.changed' | 事件源头，证明埋点触发 |
| SyncListener.onChange | info | resource + latency（event 路径）| 主路径 |
| 兜底轮询捞回 | warn | resource + caught_by_fallback（原始变更时间）| 事件漏发信号，异常分支必打 |
| syncToAgent 失败 | error | resource + agent + error | 关键失败路径 |

## 生产监控设计（按需触发）

> 重构特别要监控"新旧机制的此消彼长"——事件路径是否真的接管了，兜底是否在空转。（属按需的生产监控层；本例重构影响同步核心链路，展开。）

**工具栈**：Prometheus + Grafana / 结构化日志 / OpenTelemetry（与现有一致）

### Metrics（重构新增/调整）

| 指标 | 类型 | 采集点 | 说明 |
|---|---|---|---|
| `sync.trigger.total` | Counter | SyncListener / Poller | **按 source 标签**（event / poller_fallback）区分触发来源 |
| `sync.event.latency_seconds` | Histogram | SyncListener | 变更→同步完成延迟（核心改善指标，应从 ~30s 降到秒级）|
| `sync.poller.caught_total` | Counter | SyncPoller | **兜底轮询实际捞回的变更数**——决定 Step 3 是否移除的依据 |
| `sync.poller.scan_total` | Counter | SyncPoller | 轮询扫描次数（应大幅下降：30s→5min）|

**关键告警**：

| 条件 | 级别 | 含义 |
|---|---|---|
| `sync.event.latency_p95 > 5s` | P2 | 事件路径变慢，可能 listener 阻塞 |
| `rate(sync.poller.caught_total[1h]) > 0` 持续 | P3 | 事件有漏发，兜底在干活——需排查事件机制，**暂不能移除兜底** |

**对比看板**（重构特有）：触发来源占比饼图（event vs poller_fallback）。健康状态应是 event 占 ~100%，poller_fallback ≈ 0。

### Logs

```json
{
  "level": "info",
  "event": "sync.triggered",
  "sync_id": "sync_abc",
  "source": "event",            // event | poller_fallback —— 区分触发来源
  "resource_name": "my-rule",
  "latency_ms": 120,
  "agents_synced": ["claude", "cursor"]
}
```

兜底捞回时额外标 `"caught_by_fallback": true` + 原始变更时间——用于排查为什么事件没发出。

### Traces

```
trace: sync_abc (source=event)
│
├─ span: ResourceRepo.update          (15ms)
│   └─ span: EventBus.emit            (1ms)
├─ span: SyncListener.onChange        (120ms)
│   ├─ span: syncToAgent(claude)      (60ms)
│   └─ span: syncToAgent(cursor)      (55ms)
```

排查场景："为什么这次同步走了兜底而不是事件" → 按 sync_id 查 trace → 看是否有 EventBus.emit span（无 = 事件没发出，埋点漏了）。

---

## 术语与缩略语

| 统一格式 | 一句话解释 |
|---|---|
| 领域驱动设计 Domain-Driven Design - DDD | 按业务实体拆域、高内聚低耦合的设计方法 |
| 业务流 Business Flow - BF | 一条业务逻辑的伪代码流程（带编号）|
| 测试目标 Test Objective - TO | 每条路径要验证什么 |
| 发布订阅 Publish/Subscribe - pub/sub | 消息发布方与订阅方解耦的通信模式 |
