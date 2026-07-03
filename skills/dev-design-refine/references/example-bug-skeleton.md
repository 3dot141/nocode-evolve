# bug 产出骨架示例

> 以"Nocode Manager 批量导入超过 50 条资源时 OOM 崩溃"为例。实际产出按项目调整，学结构和思路不照搬措辞。
>
> bug 文档形状：现象 → 根因（推理链 + 位置图）→ 修复方案对比 → 修复设计（before/after）→ 验证 → 部署 → 监控盲区补齐。**核心是把根因讲透**——没定位到根因的修复是猜。

---

## 背景

**问题现象**：批量导入超过约 50 条资源时，api-server 进程内存暴涨后崩溃（OOM Killed），导入中断，已写入的资源残留但同步未完成。

**复现步骤**：
```
1. 准备一个含 60 个资源的 ZIP（总解压后约 80MB）
2. POST /api/import/parse 上传
3. 观察 api-server 内存：解析阶段从 200MB 飙到 1.8GB
4. 容器内存上限 2GB → OOM Killed → 502
```

**预期 vs 实际**：
- 预期：60 条资源导入成功，内存平稳
- 实际：进程崩溃，导入中断，数据半残（resources 表有记录，Agent 未同步）

**影响范围**：
- 触发条件：单次导入 ≥50 条资源，或 ZIP 解压后 ≥50MB
- 受影响用户：迁移大型工作环境的用户（正是批量导入功能的目标用户）
- 严重度：P1 — 功能在主场景下不可用 + 留下脏数据

## 调研

从崩溃点回溯，追踪内存分配链路：

- [Read src/services/import/parser.ts:34] `parseZip()` 调 `unzip(content)` 把**整个 ZIP 一次性解压进内存**，返回 `files: Record<string, Buffer>`
- [Read src/services/import/parser.ts:41] 解压后 `manifest.assets = files.filter(...)` 又把所有附属文件 Buffer **复制一份**进 manifest
- [Read src/services/resource.ts:88] `batchCreate()` 在事务里**一次性收集全部 resource + assets** 再写入，事务期间整个 manifest 驻留内存
- [Read src/routes/import.ts:22] 三个端点间通过**内存传递 manifest**（parse 返回 → resolve → execute），manifest 在整个请求生命周期不释放

关键观察：内存峰值 = ZIP 原始大小 + 解压后大小 + manifest 复制 + 事务驻留，**约 4 倍放大**。60 条 80MB 的包 → 峰值 ~1.6GB+。

## 根因分析

### 问题在系统中的位置

```
┌─────────────────────────────────────────────────────┐
│                  API Server (Node.js)                 │
│                                                      │
│  ┌────────────────┐                                  │
│  │  Import Routes  │  manifest 内存传递贯穿三端点      │ ← 放大点 ③
│  │  parse/resolve/ │  （请求结束才释放）               │
│  │  execute        │                                  │
│  └───────┬────────┘                                  │
│          │                                           │
│  ┌───────┴────────┐                                  │
│  │ ImportParser    │  unzip 整包进内存 [根因]          │ ← 放大点 ①
│  │ parseZip()      │  + assets Buffer 复制            │ ← 放大点 ②
│  └───────┬────────┘                                  │
│          │                                           │
│  ┌───────┴────────┐                                  │
│  │ ResourceRepo    │  事务里全量驻留                   │ ← 放大点 ④
│  │ batchCreate()   │                                  │
│  └────────────────┘                                  │
└─────────────────────────────────────────────────────┘
```

### 推理链（症状 → 根因）

```
症状：≥50 条资源 OOM
  ↓ 内存 profiling 显示峰值在解析阶段
[Read parser.ts:34] unzip(content) 整包解压进内存
  ↓ 为什么整包？
[Read parser.ts:41] 设计假设"资源都是小文件"，没考虑附属文件（图标/模板）可能大
  ↓ 单点放大不致命，为什么到 1.6GB？
[Read parser.ts:41] assets 又 Buffer 复制一份 → 2 倍
[Read import.ts:22] manifest 跨三端点内存传递不释放 → 持续驻留
[Read resource.ts:88] 事务期间全量驻留 → 再叠加
  ↓
根因：parseZip 的"整包进内存"设计 + manifest 全程驻留，
      在大资源量下内存 4 倍放大，超过容器上限
```

**根因定性**：不是单个 bug，是**流式数据被当成批量数据处理**的设计缺陷。`parseZip` 假设资源量小、附属文件小——这个假设在批量导入的目标场景（迁移大环境）下不成立。

## 方案选择

> **结论先行**：先看速查表，再展开。否决项配同等篇幅理由（反方配平），决策标 `[已确认]`/`[假定]`。

### 决策速查表

| # | 决策点 | 定 | 状态 | 影响 |
|---|---|---|---|---|
| Q1 | 怎么消除内存放大 | **流式处理 + 分批写入** | `[假定]` | BF1、BF2 |

**核心决策（Q1）**：怎么消除内存放大？

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 调大容器内存 | 2GB → 8GB | 改一行配置 | 治标不治本，100 条又崩；成本翻 4 倍 |
| B. 加资源数上限 | 限制单次 ≤50 条 | 简单 | 砍掉核心场景（迁移大环境正需要批量）|
| **C. 流式处理 + 分批写入** | unzip 改 streaming 逐条解析，batchCreate 改分批提交 | 内存恒定（与资源量无关）| 改动较大，需重构 parser + repo |
| D. 异步队列 | 导入任务入队，worker 后台处理 | 彻底解耦，可扩展 | 引入消息队列基础设施，over-engineering |

**选 C（流式处理 + 分批写入）**。`[假定]` 根因是"全量进内存"，只有流式处理才真正消除放大。**否决 A（调大内存）**：改一行配置，但治标不治本——100 条又崩，成本还翻 4 倍。**否决 B（加资源上限）**：简单，但砍掉核心场景（迁移大环境正需要批量）。**否决 D（异步队列）**：彻底解耦可扩展，但为当前规模引入消息队列基础设施是 over-engineering——等真有"超大导入 + 高并发"再上。

## 修复设计

### BF1 — 解析：修复前 vs 修复后

**修复前**（整包进内存）：

```
unzip 整个 ZIP → files: Record<string, Buffer>（全部驻留）
  ↓
manifest.json 解析
  ↓
assets = 复制所有附属 Buffer（再翻一倍）
  ↓
返回完整 manifest（跨端点驻留到请求结束）
```

**修复后**（流式逐条）：

```
打开 ZIP 流 [BF1]
  ↓
先只读 manifest.json（小文件，确定资源清单）
  ↓
逐条迭代资源：
  ├─ 读一条 → 校验 [约束.1] → 写一条 → 释放
  └─ 附属文件按需流式读取，不全量复制 [约束.3: 单文件 ≤10MB]
  ↓
流结束 → 完成（峰值内存 = 单条资源大小，与总数无关）
```

**类接口变更**：

```typescript
// 修复前
class ImportParser {
  parseZip(content: Buffer): ImportManifest   // 返回全量 manifest
}

// 修复后
class ImportParser {
  openZipStream(content: Buffer): ManifestHeader   // 只读清单头
  *iterateResources(): Iterator<Resource>           // 逐条产出，generator
}
```

**伪代码**（修复后 BF1）：

```
function ImportParser.iterateResources(zipStream):
  header = readManifestJson(zipStream)          // 只读清单，确定有哪些资源
  for each entry in header.items:               // 逐条迭代，不全量加载
    raw = zipStream.readEntry(entry.path)        // 流式读单条
    if entry.size > MAX_ASSET_SIZE:              // [约束.3] 单文件上限
      yield { ...entry, status: 'too_large' }    // 标记跳过，不阻塞
      continue
    yield parseResource(raw)                     // 产出一条，调用方消费后即可释放
    // raw 离开作用域 → GC 回收，内存不累积
```

### BF2 — 写入：分批提交

**修复前**：事务里全量收集再写 → 全程驻留。
**修复后**：每 N 条（如 20）一个子事务提交，提交后释放。

```
function ResourceRepo.batchCreate(resourceIterator):
  batch = []
  for each resource in resourceIterator:        // 消费上游 generator
    batch.push(resource)
    if batch.length >= BATCH_SIZE:               // BATCH_SIZE=20
      db.transaction(() => insertAll(batch))     // 子事务提交
      batch = []                                 // 释放这批
  if batch.length > 0:
    db.transaction(() => insertAll(batch))       // 尾批
```

> 权衡：分批提交牺牲了"全有或全无"的原子性。补偿：记录已提交的 batch 数，失败时返回"已导入前 N 条"，用户可从断点续传。这个权衡在「方案选择 C」的代价里体现。

**文件影响**：

```
src/services/import/
  ├── parser.ts                 (改)   ① parseZip() → openZipStream() + iterateResources()
  │                                    ② assets 改流式读取，去掉 Buffer 复制
  └── types.ts                  (改)   ManifestHeader 类型（清单头与全量分离）
src/services/
  └── resource.ts               (改)   batchCreate() 改分批子事务提交
src/routes/
  └── import.ts                 (改)   三端点改传 stream handle，不传全量 manifest
src/config/
  └── limits.ts                 (NEW)  MAX_ASSET_SIZE / BATCH_SIZE 常量 [约束.3]
```

## 验证策略

> bug 修复的核心验证：**先复现，再证明修复有效**。回归测试必须能在没有 fix 时失败。

### 回归测试（防止复发）

- [ ] **复现用例**：构造 60 条资源 / 80MB ZIP → 修复前 OOM（手动确认）→ 修复后内存峰值 <300MB 通过
  - 验证有效性：还原 fix → 此用例必须 OOM/超内存阈值 → 恢复 fix → 通过
- [ ] **内存断言**：导入过程中采样 RSS，断言峰值 < 阈值（与资源量解耦）

### 边界用例

| 用例 | Given | Then |
|---|---|---|
| 单条超大附属文件 | 一条资源带 15MB 图标 [约束.3] | 标 too_large 跳过，不 OOM，其余正常 |
| 分批边界 | 恰好 BATCH_SIZE 整数倍（40 条）| 2 个子事务，无尾批空提交 |
| 分批中途失败 | 第 2 批写入时 DB 报错 | 返回"已导入前 20 条"，可断点续传 |
| 流式解析损坏包 | ZIP 中途字节损坏 | 已产出的资源保留，损坏处报错不崩溃 |

### 验证策略汇总

| TO | 覆盖 | 层级 | 说明 |
|---|---|---|---|
| TO-1 | BF1 | 集成 | 60 条/80MB 导入，内存峰值 <300MB（核心回归）|
| TO-2 | BF1, 约束.3 | 单测 | 单文件超限 → 跳过不阻塞 |
| TO-3 | BF2 | 集成 | 分批提交（整数倍 / 有尾批 / 中途失败续传）|
| TO-4 | BF1 | 单测 | 流式解析损坏包不崩溃 |

## 部署注意事项

**容器/服务**：
- 后端：现有 api-server 容器，无新增服务
- 内存上限：**修复后不需要调大**（流式处理内存恒定），但建议保留 2GB 给并发余量

**环境配置**：
- 新增 `MAX_ASSET_SIZE=10MB` / `BATCH_SIZE=20`（在 limits.ts，可环境变量覆盖）

**脚本/迁移**：
- 无 DB schema 变更
- **脏数据清理**：上线前需跑一次性脚本，清理历史 OOM 留下的"已写入未同步"残留资源（`scripts/cleanup-orphan-imports.ts`，按 import_id 找无同步记录的资源，提示用户重新同步或删除）

**发布策略**：
- 因是 P1 修复，建议**直接全量**（不灰度）—— 但先在 staging 用复现用例验证
- 回滚：保留旧 parser 代码一个版本周期，feature flag `IMPORT_STREAMING` 可切回旧逻辑（旧逻辑只对 <50 条安全）

**注意**：
- 流式解析改变了"解析失败时机"——修复前整包解析失败立即报错，修复后逐条解析可能"前 30 条成功，第 31 条失败"。前端需处理"部分成功"的新返回形态

## 基础日志设计（必写）

> 修复引入的**关键路径 / 异常分支 / 新守卫点**都要打 log——bug 修复尤其要让"修复是否真的生效"能从日志看出来（⑥ 基础日志必写层，来源 Decision Packet 的 `domainDecisions.observability.basicLogging`）。

| 位置 | 级别 | 内容 | 为什么 |
|---|---|---|---|
| iterateResources 每条 | debug/info | resource + 单条内存增量 | 证明流式不累积 |
| 单文件超限跳过 | warn | resource + size（[约束.3] too_large）| 新异常分支必打 |
| batchCreate 每批提交 | info | batch_index + 条数 | 证明分批生效 |
| 分批中途失败 | error | 已提交批数 + error（断点续传起点）| 关键失败路径 |

## 生产监控设计（盲区补齐 · 按需）

> 这个 bug 暴露的监控盲区：**没有内存指标和单次导入的资源量指标**，导致 OOM 是"用户报障"才发现，不是监控告警发现的。本次补齐（属按需的生产监控层）。

**工具栈**：Prometheus + Grafana（Metrics）/ 结构化 JSON（Logs）/ OpenTelemetry（Traces）

### Metrics（新增，盲区补齐）

| 指标 | 类型 | 采集点 | 标签 | 说明 |
|---|---|---|---|---|
| `import.memory.peak_bytes` | Gauge | Import Routes | format | **新增**：单次导入内存峰值（之前没有，是盲区根源）|
| `import.resource_count` | Histogram | ImportParser | format | **新增**：单次导入资源数分布（早发现"超大导入"趋势）|
| `import.asset.size_bytes` | Histogram | ImportParser | — | **新增**：附属文件大小分布 |
| `import.batch.commit_total` | Counter | ResourceRepo | status | **新增**：分批提交次数（监控分批是否生效）|
| `process.resident_memory_bytes` | Gauge | runtime | — | 进程 RSS（应已有，确认在 Dashboard 上）|

**告警规则**：

| 条件 | 级别 | 动作 |
|---|---|---|
| `import.memory.peak_bytes > 500MB` | P2 | 流式处理可能失效，检查是否有全量加载回归 |
| `histogram_quantile(0.95, import.resource_count) > 100` | P3 | 出现超大导入趋势，评估是否需异步队列（方案 D）|
| `rate(container_oom_kills_total[5m]) > 0` | P1 | OOM 复发，立即介入 |

### Logs（增强）

```json
{
  "level": "info",
  "event": "import.completed",
  "import_id": "imp_xyz789",
  "format": "zip",
  "resource_count": 60,
  "peak_memory_mb": 280,
  "batch_count": 3,
  "duration_ms": 5100
}
```

新增字段 `peak_memory_mb` + `batch_count` —— 让每次导入的内存行为可追溯，OOM 前的趋势能从日志看出来。

### Traces（验证修复）

修复后的 trace 应显示**内存不再集中在 unzip span**：

```
trace: import_xyz789
│
├─ span: POST /api/import/execute            (5100ms)
│   ├─ span: ImportParser.iterateResources   (流式，span 持续但内存平稳)
│   │   ├─ span: readEntry(r1)               (20ms)  mem +5MB → 释放
│   │   ├─ span: readEntry(r2)               (18ms)  mem +5MB → 释放  ← 不累积
│   │   └─ ...
│   └─ span: ResourceRepo.batchCreate
│       ├─ span: commit batch 1 (20 条)      (180ms)
│       ├─ span: commit batch 2 (20 条)      (175ms)
│       └─ span: commit batch 3 (20 条)      (160ms)
```

**排查用途**：对比修复前后同一 import_id 的 trace，确认 unzip span 不再是内存瓶颈、batchCreate 拆成多个 commit span。

---

## 术语与缩略语

| 统一格式 | 一句话解释 |
|---|---|
| 内存溢出 Out Of Memory - OOM | 进程内存超上限被系统杀掉 |
| 业务流 Business Flow - BF | 一条业务逻辑的伪代码流程（带编号）|
| 测试目标 Test Objective - TO | 每条路径要验证什么 |
| 常驻内存 Resident Set Size - RSS | 进程实际占用的物理内存 |
