# feat 产出骨架示例（多域）

> 以"Nocode Manager 资源批量导入"为例。实际产出按项目调整，学结构和思路不照搬措辞。

---

## 罗盘（Define Restate）

（Define 落盘的已确认 restate 原样承载：Outcome / User / Why Now / SC / Out of Scope / 路径清单 + SC 绑定 / 探索胶囊附录。writing 不改写，只对照校准——SC 有落点、不越 Out of Scope。）

## 背景

核心问题：用户迁移一个完整工作环境要手动添加 20+ 个资源，逐个操作。
PRD 路径 `资源库.P3` 要求支持从 JSON / ZIP / GitHub repo 批量导入。
pd-ix 产出了导入流程的交互设计（`.ix.md`）。

## 调研

**代码现状**：
- [Read src/services/resource.ts:45] 现有 addResource() 单条写入，无批量接口
- [Read src/models/resource.ts:12] Resource 模型有 type / name / source / config 四字段
- [Read src/services/sync.ts:88] 已有 syncToAgent() 单资源同步，批量场景需并发控制

**竞品分析**：

| 竞品 | 导入方式 | 优点 | 缺点 |
|---|---|---|---|
| [SOURCE: superpowers] | vendor-integration.json 声明式映射（keep/extract/skip） | 可扩展、配置驱动 | 只支持 plugin 格式 |
| [SOURCE: cursor.com] | Settings Sync JSON 导出/导入 | 简单一键 | 只支持自家格式 |
| [SOURCE: raycast.com] | GitHub repo 作为扩展源 | 版本控制天然集成 | 需 repo 结构约定 |

启发：superpowers 的三状态映射（keep/extract/skip）值得参考；Cursor 的"一键"体验是目标。

**已有决策**：
- [Read .agents-personal/wiki/pages/resource-model.md] 资源模型 type/name/config 三字段约定不改

## 方案选择

> **结论先行**：先看决策速查表（一眼看完所有拍板），再逐 Q 展开。逐 Q 每个否决项配与推荐项同等篇幅的理由（反方配平）；每决策标 `[已确认]`（用户/评审拍板）/ `[假定]`（agent 自主，待复核）。

### 决策速查表

| # | 决策点 | 定 | 状态 | 影响 |
|---|---|---|---|---|
| Q1 | 导入格式怎么统一 | **统一转 ImportManifest** | `[假定]` | BF1 |
| Q2 | 同步串行还是并行 | **串行逐条** | `[假定]` | BF3、Agent.P1 |
| Q3 | 实时进度怎么推 | **SSE** | `[假定]` | 场景 3 |
| Q4 | 冲突怎么处理 | **让用户选** | `[已确认]` 用户 | BF2、约束.2 |

### Q1: 导入格式怎么统一？→ 影响 BF1

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 每种格式独立处理链 | JSON/ZIP/GitHub 各走各的 | 实现简单 | 3 条链路，加新格式写全套 |
| **B. 统一转 ImportManifest** | 解析层各自，解析后统一 | 加新格式只改 parser | 需定义中间格式 |
| C. 插件式 adapter | 注册 adapter 分发 | 最灵活 | 3 种格式 over-engineering |

**选 B**。`[假定]` 区别只在解析层，后续逻辑相同。**否决 A（每格式独立链）**：省了中间格式定义，但代价是加一种新格式要重写整条链（解析+校验+去重+写入），3 条链维护成本随格式数线性涨。**否决 C（插件式 adapter）**：最灵活，但 3 种格式引入注册分发框架是 over-engineering，收益要第 4+ 种格式才显现，当前换不到——等 6+ 种再考虑。

### Q2: 同步串行还是并行？→ 影响 BF3, Agent.P1

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 并行 Promise.all | 全部同时推 | 理论最快 | 触发 rate limit（实测 Claude 10 req/s） |
| **B. 串行逐条** | 一条一条推 | 不触发限流 | 20×3=60 条约 6 秒 |
| C. 并行 + rate limiter | 并行但限流 | 快且可控 | 实现复杂，6 秒够了 |

**选 B（串行）**。`[假定]` 6 秒可接受。**否决 A（并行 Promise.all）**：理论最快，但实测触发 Claude 10 req/s 限流，反而更慢 + 不稳定。**否决 C（并行+限流器）**：快且可控，但为省这 6 秒引入限流器复杂度，当前规模不值——≥100 资源再考虑。

### Q3: 实时进度怎么推？→ 影响 场景 3

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 轮询 | 前端定时 GET | 简单 | 延迟高、浪费请求 |
| **B. SSE** | 服务端单向推送 | 实时、自动重连 | 单向（够用） |
| C. WebSocket | 双向通信 | 最灵活 | 只需单向，overkill |

**选 B（SSE）**。`[假定]` **否决 A（轮询）**：简单，但延迟高、大量空请求浪费。**否决 C（WebSocket）**：最灵活，但进度推送是纯单向，双向能力全浪费，overkill——SSE 单向足够且自动重连。

### Q4: 冲突怎么处理？→ 影响 BF2, 约束.2

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 静默覆盖 | 同名直接覆盖 | 零交互 | 用户不知道被覆盖 |
| B. 静默跳过 | 同名跳过 | 零交互 | 想更新时更新不了 |
| **C. 让用户选** | 展示冲突列表，逐条/批量决策 | 用户掌控 | 多一步交互 |

**选 C（让用户选）**。`[已确认·用户]` **否决 A（静默覆盖）**：零交互，但用户改的 rule 被覆盖却不知道，信任崩塌。**否决 B（静默跳过）**：零交互，但用户想更新时更新不了，同样意外。用户对"rule 会不会被覆盖"敏感，多一步交互换掉的是"被意外覆盖/跳过"的惊吓——值得。

## 领域划分

### 拆分思路

从 PRD 使用路径出发，识别核心实体：

```
PRD 资源库.P3 批量导入
  → "资源"被创建、校验、去重、写入 → Resource 实体
  → "Agent"被查询连接状态、推送资源 → Agent 实体
  → 两个不同的实体 → 两个域
```

验证变更独立性（确认拆分合理）：

```
加新导入格式（YAML）→ 只改资源域的 Parser → Agent 域不动 ✓
加新 Agent 类型（Gemini）→ 只改 Agent 域的 Client → 资源域不动 ✓
改去重策略（静默覆盖→用户选）→ 只改资源域 → Agent 域不动 ✓
→ 变更互不影响，拆分成立
```

### 域清单

| 域 | 核心实体 | 路径 ID 范围 | 变更独立性 |
|---|---|---|---|
| 资源域 | Resource | 资源.P1-P3 | 加格式/改策略不碰 Agent |
| Agent 域 | Agent | Agent.P1 | 加 Agent 类型不碰资源 |
| 跨域 | — | 跨域.1 | 导入流程穿越两域 |

### 总图（域间关系 + 路径 ID）

```
┌───────────────────┐                    ┌──────────────────┐
│     资源域          │                    │     Agent 域      │
│   Resource         │   跨域.1 导入流程   │     Agent        │
│                    │ ─────────────────→ │                  │
│ 资源.P1 解析校验    │                    │ Agent.P1 批量同步 │
│ 资源.P2 去重决策    │ ←──────────────── │                  │
│ 资源.P3 批量写入    │    同步状态反馈     │                  │
└───────────────────┘                    └──────────────────┘

约束.1: type ∈ {skill, mcp, rule, agent, plugin}
约束.2: 同 name+type 资源不允许静默覆盖（必须用户确认）
```

---

## 架构设计

> 域关系图是业务视角（谁和谁交互），架构图是技术视角（组件在哪跑、怎么通信）。

### 技术架构图

```
┌─────────────────────────────────────────────────────┐
│                    Browser (React)                    │
│  ImportDialog → ConflictResolver → SyncProgress      │
└──────────────────────┬──────────────────────────────┘
                       │ REST API + SSE
┌──────────────────────┴──────────────────────────────┐
│                  API Server (Node.js)                 │
│                                                      │
│  ┌────────────────┐        ┌───────────────┐        │
│  │  Import Routes  │        │  Sync Service  │        │
│  │  /api/import/*  │        │  batchSync()   │        │
│  └───────┬────────┘        └───────┬────────┘        │
│          │                         │                 │
│  ┌───────┴────────┐        ┌──────┴────────┐        │
│  │ Resource Domain │        │  Agent Domain  │        │
│  │ Parser/Validator│        │  AgentClient   │        │
│  │ Dedup/Repo     │        │  retry(1)      │        │
│  └───────┬────────┘        └───────┬────────┘        │
│          │                         │                 │
└──────────┼─────────────────────────┼─────────────────┘
           │                         │
     ┌─────┴─────┐          ┌───────┴────────┐
     │ PostgreSQL │          │ Agent APIs      │
     │ resources  │          │ Claude / Cursor │
     └───────────┘          └────────────────┘
```

**技术选型**：
- 前端：React（已有技术栈）
- API：Node.js + Express（已有）
- 数据库：PostgreSQL（已有 resources 表）
- 实时通信：SSE（单向推送进度，比 WebSocket 轻量）
- Agent API：各 Agent 的 REST API（已有 AgentClient 封装）

### 数据流

```
JSON/ZIP/GitHub URL
  ↓ parse
ImportManifest（内存，不持久化）
  ↓ validate + dedup
ResolvedManifest（内存）
  ↓ batchCreate（事务）
PostgreSQL resources 表
  ↓ batchSync（串行）
Agent APIs → SSE 推送进度
```

---

## 表现层设计（交互场景 / 边）

> 设计源：[design-source: claude-design c9346159]

### 端到端业务流总图

导入流程 [跨域.1] 穿越资源域 + Agent 域的完整链路（先总后分）：

```
用户上传
  ↓
解析 [BF1, 资源.P1]
  ↓
校验 [约束.1: type 合法]
  ├─ 通过
  │   ↓
  │ 去重检测 [BF2, 资源.P2]
  │   ├─ 无冲突
  │   │   ↓
  │   │ 写入 [资源.P3]
  │   │   ↓
  │   │ 同步 [BF3, Agent.P1, 跨域.1]
  │   │   ├─ 成功 → 结果报告
  │   │   └─ 失败 → [BF3 异常] 记录 + 继续
  │   │
  │   └─ 有冲突 [约束.2]
  │       ↓
  │     用户决策 [资源.P2a]（覆盖/跳过/重命名）
  │       ↓
  │     写入 [资源.P3] → 同步 [BF3] → 结果报告
  │
  └─ 失败
      ↓
    [BF1 异常] 标红 + 错误提示（不阻塞其余资源）
```

下面三个场景是这条总流程的"分"——每段展开前端交互细节。

### 场景 1：上传与解析 [资源.P1]

对应总流程的 "用户上传 → 解析 → 校验" 段。

**交互流程**：

```
拖拽/点选/粘贴 URL
  ↓
格式自动识别（JSON/ZIP/GitHub）
  ↓
解析进度条（>1MB 时显示）[BF1]
  ↓
资源预览列表
  ├─ 校验通过 → ✓ 绿色
  └─ 校验失败 → ✗ 红色 + tooltip [BF1 异常, 约束.1]
```

**前端组件**：
- `ImportDialog` — 上传区 + 格式选择
- `ParseProgress` — 解析进度条
- `ResourcePreview` — 预览列表 + 校验状态展示

**消费域接口**：POST /api/import/parse → 资源域.ImportParser [BF1]

**文件影响**：

```
src/components/import/
  ├── ImportDialog.tsx          (NEW)
  ├── ParseProgress.tsx         (NEW)
  └── ResourcePreview.tsx       (NEW)
```

**验证**：
- [ ] 组件测试：三种格式上传 → 预览列表正确渲染
- [ ] 组件测试：校验失败资源红色 + tooltip 内容对

**安全**：GitHub URL 校验白名单（防 SSRF），校验在后端。
**性能**：>5MB 用 streaming 上传。

### 场景 2：冲突解决 [资源.P2, 约束.2]

对应总流程的 "去重检测 → 有冲突 → 用户决策" 段。无冲突时自动跳过此步。

**交互流程**：

```
冲突列表表格
  │ 资源名 │ 类型 │ 已有版本 │ 导入版本 │ 操作 │
  每行：覆盖 / 跳过 / 重命名 [资源.P2a]
  顶部：全部覆盖 / 全部跳过（批量操作）
      ↓
  确认 → 进入写入
```

**前端组件**：`ConflictResolver` — 冲突表格 + 批量操作

**消费域接口**：POST /api/import/resolve → 资源域.Deduplicator [BF2]

**文件影响**：

```
src/components/import/
  └── ConflictResolver.tsx      (NEW)
```

**验证**：
- [ ] 组件测试：冲突列表渲染 + 批量操作
- [ ] 组件测试：无冲突时跳过

### 场景 3：同步进度与结果 [Agent.P1, 跨域.1]

对应总流程的 "写入 → 同步 → 结果报告" 段。

**交互流程 + 时序**：

```
前端                   后端                    Agent API
 │  POST /execute       │                       │
 │ ────────────→       │                       │
 │                      │ 事务写入 [资源.P3]     │
 │                      │                       │
 │                      │ syncOne [BF3]          │
 │                      │ ─────────────→        │
 │                      │      200 OK           │
 │                      │ ←─────────────        │
 │ SSE: r1 synced       │                       │
 │ ←───────────        │                       │
 │                      │ syncOne [BF3]          │
 │                      │ ─────────────→        │
 │                      │      500 fail         │
 │                      │ ←─────────────        │
 │                      │ retry [BF3 异常]       │
 │                      │ ─────────────→        │
 │                      │      200 OK           │
 │                      │ ←─────────────        │
 │ SSE: r2 synced       │                       │
 │ ←───────────        │                       │
 │ SSE: complete        │                       │
 │ ←───────────        │                       │
 │                      │                       │
 │ 结果报告             │                       │
 │ 成功 18 / 跳过 4     │                       │
 │ 失败 2 → [重试]      │                       │
```

**前端组件**：
- `SyncProgress` — 实时进度（SSE）
- `ImportResult` — 结果报告 + 失败项重试

**消费域接口**：
- POST /api/import/execute → 资源域.batchCreate [资源.P3]
- GET /api/import/progress (SSE) → Agent 域.batchSync [BF3]

**文件影响**：

```
src/components/import/
  ├── SyncProgress.tsx          (NEW)
  └── ImportResult.tsx          (NEW)
```

**验证**：
- [ ] 组件测试：SSE 进度实时更新（mock）
- [ ] 组件测试：失败项重试

---

## 领域层设计（域 / 节点）

> 每个域自包含：模块关系图 → 模块设计 → 接口 → 文件影响 → 验证 → 安全/性能。

### 资源域（Resource）

**核心实体**：Resource（type / name / source / config）
**本次新增**：批量解析 [BF1]、校验 [约束.1]、去重决策 [BF2]、批量写入 [资源.P3]

**域内模块关系图**：

```
┌──────────────────────────────────────────┐
│                资源域                      │
│                                          │
│  ┌────────────┐    ┌───────────┐        │
│  │ImportParser │───→│ Validator │        │
│  │  [BF1]     │    │ [约束.1]  │        │
│  └────────────┘    └─────┬─────┘        │
│                          │              │
│                    ┌─────┴──────┐       │
│                    │Deduplicator│       │
│                    │  [BF2]     │       │
│                    │  [约束.2]  │       │
│                    └─────┬──────┘       │
│                          │              │
│                    ┌─────┴──────┐       │
│                    │ResourceRepo│       │
│                    │ [资源.P3]  │       │
│                    └────────────┘       │
└──────────────────────────────────────────┘
```

#### ImportParser 模块

**类接口**：

```typescript
class ImportParser {
  parse(input: ImportInput): ImportManifest
}
```

**BF1 — 批量解析**：

流程图：

```
输入（JSON / ZIP / GitHub URL）
  ↓
格式识别
  ├─ JSON → JSON.parse → manifest
  ├─ ZIP → unzip → 读 manifest.json + 附属文件
  └─ GitHub → fetchContent → 识别 .claude/ 目录
  ↓
统一 ImportManifest → 交给 Validator
```

伪代码：

```
function ImportParser.parse(input):
  if input.type == 'json':
    manifest = JSON.parse(input.content)        // 直接解析
  elif input.type == 'zip':
    files = unzip(input.content)                // 解压
    manifest = files['manifest.json']           // 约定根目录有 manifest.json
    manifest.assets = files.filter(!manifest)   // 其余文件作为附属资源
  elif input.type == 'github':
    manifest = fetchGitHubContent(input.url)    // 拉仓库，识别 .claude/ 目录
  return manifest
```

选了"三种格式统一转 ImportManifest"（见方案选择 B）。

异常 [BF1 异常]：格式无法解析 / 内容损坏 → 标 invalid，不阻塞其余资源。

#### Deduplicator 模块

**BF2 — 去重决策**：

流程图：

```
遍历 manifest 每条资源
  ↓
按 name + type 匹配已有 [约束.2]
  ├─ 无匹配 → 标"新资源"
  └─ 有匹配 → 标"冲突" + 记录已有版本
  ↓
[有冲突?]
  ├─ 是 → 收集全部冲突 → 一次性问用户 [资源.P2a]
  └─ 否 → 直接进写入
  ↓
应用决策 → ResolvedManifest
```

伪代码：

```
function Deduplicator.detectConflicts(manifest, existing):
  for each resource in manifest.items:
    match = existing.find(e => e.name == resource.name && e.type == resource.type)
    if match:
      resource.conflict = { existing: match, action: 'ask' }
    else:
      resource.conflict = null
  return { conflicts: manifest.items.filter(r => r.conflict) }
```

选了"冲突让用户选"（约束.2）——静默覆盖或跳过都有人不满意。

**域级接口**：

对外 API：

| Method | Path | Request | Response | 错误码 |
|---|---|---|---|---|
| POST | /api/import/parse | {type, content} | {manifest} | 400 格式错 |
| POST | /api/import/resolve | {manifest, decisions[]} | {resolved} | 400 非法决策 |
| POST | /api/import/execute | {resolved} | {created[], failed[]} | 500 事务失败 |

数据契约：

```typescript
interface ImportManifest {
  items: { name: string, type: ResourceType, config: object }[]
  assets?: { path: string, content: Buffer }[]
  source: { type: 'json' | 'zip' | 'github', origin: string }
}
```

**域文件影响**：

```
src/services/import/
  ├── parser.ts                 (NEW)  三种格式解析 [BF1]
  ├── validator.ts              (NEW)  校验 [约束.1]
  └── types.ts                  (NEW)  ImportManifest
src/services/
  └── resource.ts               (改)   ① batchCreate() [资源.P3]
                                       ② findByNameAndType() [BF2]
src/routes/
  └── import.ts                 (NEW)  三个端点
```

**域验证**：
- [ ] 单测：JSON/ZIP/GitHub → ImportManifest [BF1]
- [ ] 单测：校验合法/非法 type [约束.1]
- [ ] 集成：去重（无冲突/有冲突/全冲突）[BF2]
- [ ] 集成：batchCreate 事务（成功/部分失败回滚）[资源.P3]

**安全**：GitHub URL 白名单（SSRF）+ ZIP 解压限制 ≤50MB / ≤200 文件（zip bomb）。

---

### Agent 域（Agent）

**核心实体**：Agent（name / type / connection / capabilities）
**本次新增**：批量同步 [BF3, Agent.P1]

**域内模块关系图**：

```
┌──────────────────────────────┐
│          Agent 域              │
│                               │
│  ┌─────────────┐             │
│  │ SyncService  │             │
│  │ batchSync()  │             │
│  │   [BF3]      │             │
│  └──────┬───────┘             │
│         │                     │
│  ┌──────┴───────┐             │
│  │ AgentClient   │             │
│  │ syncOne()     │             │
│  │ retry(1)      │             │
│  └───────────────┘             │
└──────────────────────────────┘
```

#### SyncService 模块

**BF3 — 批量同步**：

流程图：

```
遍历 resources × agents（串行）[Agent.P1]
  ↓
[agent 支持该 type?]
  ├─ 否 → 记录 skipped → 下一个
  └─ 是 → syncOne()
           ├─ 成功 → 记录 synced
           └─ 失败 → retry 1 次
                      ├─ 成功 → 记录 synced
                      └─ 仍失败 → 记录 failed [BF3 异常]
                                  → 继续（不中断）
  ↓
每条完成 → emit SSE 进度事件
  ↓
全部完成 → 结果报告
```

伪代码：

```
function SyncService.batchSync(resources, agents):
  for each resource in resources:              // 串行，不并行
    for each agent in agents:
      if !agent.supports(resource.type):
        record('skipped')
        continue
      try:
        AgentClient.syncOne(resource, agent)   // 复用已有单资源同步
        record('synced')
      catch e:
        record('failed', e.message)            // 不中断
  emit SSE progress
```

选了串行——Agent API rate limit（实测 Claude 10 req/s），并行触发限流更慢。

**事件接口**：GET /api/import/progress — SSE，每条资源同步后推送进度。

**域文件影响**：

```
src/services/
  └── sync.ts                   (改)   ① batchSync() [BF3]
                                       ② syncOne() 加 retry 1 次
```

**域验证**：
- [ ] 集成：批量同步（全成功/部分失败/不支持 type）[BF3]
- [ ] 集成：SSE 进度推送（mock Agent API）
- [ ] 单测：retry（首次失败→成功 / 仍失败）[BF3 异常]

**性能**：20 资源 × 3 Agent = 60 次，串行 ~6 秒。≥50 资源显示预估时间。

---

## 文件影响汇总

```
src/components/import/
  ├── ImportDialog.tsx           (NEW)  场景 1
  ├── ParseProgress.tsx          (NEW)  场景 1
  ├── ResourcePreview.tsx        (NEW)  场景 1
  ├── ConflictResolver.tsx       (NEW)  场景 2
  ├── SyncProgress.tsx           (NEW)  场景 3
  └── ImportResult.tsx           (NEW)  场景 3

src/services/import/
  ├── parser.ts                  (NEW)  资源域 [BF1]
  ├── validator.ts               (NEW)  资源域 [约束.1]
  └── types.ts                   (NEW)  资源域

src/services/
  ├── resource.ts                (改)   资源域 [资源.P3, BF2]
  └── sync.ts                    (改)   Agent 域 [BF3]

src/routes/
  └── import.ts                  (NEW)  API 端点

合计：10 NEW + 2 改
```

## 验证策略汇总

> 各域/场景的单测和组件测试见各小节。本节是跨场景跨域的 E2E。

| TO | 覆盖 | 层级 | 说明 |
|---|---|---|---|
| TO-1 | 资源.P1→P3, Agent.P1, 跨域.1 | E2E | JSON 导入全流程：上传→解析→无冲突→写入→同步→结果 |
| TO-2 | 资源.P2, 资源.P2a, 约束.2 | E2E | 有冲突→用户选覆盖→同步部分失败→重试 |
| TO-3 | 资源.P1, 约束.1 | E2E | GitHub URL→SSRF 拦截（内网 URL 被拒）|
| TO-4 | 资源.P1 | 集成 | 大文件 (10MB ZIP)→streaming + 解压限制 |

## 部署注意事项

**容器/服务**：
- 前端：现有 web 容器，新增 import 相关组件随正常前端构建部署
- 后端：现有 api-server 容器，新增 import routes 无需新服务
- 无新增容器/中间件

**环境配置**：
- 需新增环境变量：`IMPORT_MAX_FILE_SIZE=50MB`（ZIP 解压上限）
- GitHub 导入需确认 `GITHUB_TOKEN` 已配置（现有，不用新加）

**脚本/迁移**：
- 数据库：本次无 schema 变更（复用已有 resources 表，无需 migration 脚本）
- 如后续加新 type，需更新 `约束.1` 的合法 type 枚举（在 validator.ts 常量里，不在 DB）

**Feature Flag**：
- `FEATURE_BATCH_IMPORT`：控制导入按钮是否显示，灰度期间按用户 ID 哈希放量

**注意**：
- ZIP 解压在 api-server 内存里做，大文件（>50MB）会占内存。当前单实例够用，高并发场景需考虑队列化
- Agent API 调用在主线程串行，不阻塞其他请求（已有 async 处理）

## 基础日志设计（必写）

> **每个功能的默认必写项**——关键路径 / 异常分支 / 模块出入口都要打 log。这不是"要不要上监控"的可选项；基础日志落在门槛之下成了三不管地带，就是"很多 `logger.info` 都没有"的根因（⑥）。来源：Decision Packet 的 `domainDecisions.observability.basicLogging`。

**打点位置**（本例）：

| 位置 | 级别 | 内容 | 为什么 |
|---|---|---|---|
| Import Routes 入口 | info | `import.start`：import_id / format / user_id | 每次导入起点，串联后续日志 |
| ImportParser.parse 出入口 | info / error | 入：format；出：resource_count + 耗时；失败：error_type | 第一道处理，失败率高 |
| Validator 校验失败 | warn | 非法 type / 损坏资源 name | 异常分支必打 |
| Deduplicator 冲突 | info | conflict_count | 关键决策点 |
| SyncService.syncOne 每次 | info / error | 成功：resource + agent；失败：error_type + retry 结果 | 同步易错，逐条留痕 |
| Import Routes 出口 | info | `import.completed`：sync_results + duration_ms | 每次导入终点 |

**原则**：关键路径每步有 info、异常分支必有 warn/error、出入口用 import_id 串联。没有基础日志，线上出问题只能靠猜。

## 生产监控设计（按需触发）

> **按需层**——功能上生产、需要整体健康度 / 告警 / 链路追踪时才展开三支柱（Metrics / Logs / Traces）。小改动 / 内部工具可不展开。核心问题：导入功能上线后怎么知道它在正常工作？出问题怎么定位？

**工具栈**（按项目实际填）：
- Metrics：Prometheus（采集）+ Grafana（Dashboard）
- Logs：结构化 JSON 日志 → ELK / Loki
- Traces：OpenTelemetry → SigNoz / Jaeger

### Metrics（指标）

> 回答"系统整体健不健康"。

| 指标 | 类型 | 采集点 | 标签 | 说明 |
|---|---|---|---|---|
| `import.request.total` | Counter | Import Routes | format, status | 请求总量 |
| `import.parse.duration_seconds` | Histogram | ImportParser | format | 解析耗时 p50/p95/p99 |
| `import.parse.errors_total` | Counter | ImportParser | format, error_type | 解析失败数 |
| `import.dedup.conflicts_total` | Counter | Deduplicator | — | 冲突资源数 |
| `import.sync.duration_seconds` | Histogram | SyncService | agent_type | 单次同步耗时 |
| `import.sync.failures_total` | Counter | SyncService | agent_type, error_type | 同步失败数 |
| `import.e2e.duration_seconds` | Histogram | Import Routes | format | 端到端耗时 |

**告警规则**：

| 条件 | 级别 | 动作 |
|---|---|---|
| `rate(import.parse.errors_total[5m]) / rate(import.request.total[5m]) > 0.05` | P2 | 检查格式变更/文件损坏 |
| `rate(import.sync.failures_total[5m]) / rate(import.request.total[5m]) > 0.1` | P2 | 检查 Agent API 状态 |
| `histogram_quantile(0.95, import.e2e.duration_seconds) > 60` | P3 | 检查大文件或 Agent 响应慢 |

**Dashboard**：
- 导入概览：请求量趋势 + 成功率 + 耗时分布
- 按 format 分布：JSON / ZIP / GitHub 占比
- 按 Agent 分布：各 Agent 同步成功率 + 耗时

### Logs（日志）

> 回答"某一次导入发生了什么"。结构化 JSON，方便检索。

**正常日志**（每次导入一条）：

```json
{
  "level": "info",
  "event": "import.completed",
  "import_id": "imp_abc123",
  "format": "zip",
  "resource_count": 15,
  "conflict_count": 3,
  "sync_results": { "synced": 12, "skipped": 2, "failed": 1 },
  "duration_ms": 4200,
  "user_id": "user_456"
}
```

**错误日志**（每次失败一条）：

```json
{
  "level": "error",
  "event": "import.sync.failed",
  "import_id": "imp_abc123",
  "resource_name": "my-skill",
  "agent_type": "claude",
  "error_type": "rate_limit",
  "error_message": "429 Too Many Requests",
  "retry_attempted": true,
  "retry_succeeded": false
}
```

**关键字段**：
- `import_id`：串联一次导入的所有日志（解析→校验→去重→写入→同步）
- `format`：快速筛选某种格式的问题
- `agent_type`：快速筛选某个 Agent 的同步问题

### Traces（链路追踪）

> 回答"一次请求在各组件间怎么流转、哪一段慢了"。

**Span 结构**（一次导入 = 一条 trace）：

```
trace: import_abc123
│
├─ span: POST /api/import/parse          (3200ms)
│   ├─ span: ImportParser.parse           (2800ms)
│   │   └─ span: unzip                    (2500ms)  ← 瓶颈在这
│   └─ span: Validator.validate           (400ms)
│
├─ span: POST /api/import/resolve         (50ms)
│   └─ span: Deduplicator.detectConflicts (50ms)
│
├─ span: POST /api/import/execute         (4200ms)
│   ├─ span: ResourceRepo.batchCreate     (200ms)
│   └─ span: SyncService.batchSync        (4000ms)
│       ├─ span: syncOne(r1, claude)       (100ms)
│       ├─ span: syncOne(r2, claude)       (150ms)  retry
│       ├─ span: syncOne(r3, cursor)       (80ms)
│       └─ ...
│
└─ span: SSE progress events              (ongoing)
```

**埋点位置**：
- 每个 API endpoint 自动创建 root span
- ImportParser / Validator / Deduplicator / SyncService 各创建子 span
- syncOne 每次调用创建子 span（含 retry 标记）
- 慢 span（>1s）自动标 `slow=true`

**排查场景**：
- "某次导入为什么慢" → 按 import_id 查 trace → 看哪个 span 耗时长
- "Agent 同步批量超时" → 按 agent_type 筛选 sync span → 看是哪个 Agent 慢

---

## eval 设计（AI 功能类必写）

> **仅 AI 功能类必写**（LLM 生成 / 分类 / 抽取 / Agent 决策等——"对不对"单测覆盖不了，要评估体系）。本例"资源批量导入"非 AI 功能，此节省略。
>
> AI 功能类必须包含（来源：Decision Packet 的 `evalSpec`，select 在 AI 场景产出，refine 在此展开为设计节）：
> - **评估维度**：这个 AI 功能"好"体现在哪几维（如准确率 / 召回 / 有害率 / 延迟）
> - **指标 + baseline**：每维怎么量化 + 对比基线（旧方案 / 人工 / 上一版）
> - **用例集**：评估用的输入集（含边界 / 对抗样本），来源 + 规模
> - **分级判定 L1-L4**：命中 Hit（L1）/ 计划 Planned（L2）/ 尝试 Attempted（L3）/ 验证 Verified（L4）

---

## 附：单域骨架对比

> 只涉及一个域时，总图从"域间关系"变成"域内模块关系"。拆分思路和图标注方式不变。

```
# Design Doc: 认证域 SSO 登录

## 背景 + 调研 + 方案选择

## 领域划分（单域）
  拆分思路：只涉及认证域，核心实体 Session / Token

  域内模块关系图（= 总图）：
  ┌────────────────────────────────────────┐
  │              认证域                      │
  │  ┌─────────────┐  ┌──────────────┐    │
  │  │ SSOHandler   │─→│SessionManager│    │
  │  │ [BF1,认证.P1]│  │ [BF2,认证.P2]│    │
  │  └──────┬──────┘  └──────┬───────┘    │
  │         │                │            │
  │  ┌──────┴──────┐  ┌─────┴──────┐     │
  │  │SAMLValidator │  │ TokenIssuer │     │
  │  │ [约束.1]     │  │ [认证.P3]   │     │
  │  └─────────────┘  └────────────┘     │
  └────────────────────────────────────────┘

## 表现层（交互场景）
  场景 1：SSO 登录 [认证.P1] — 点"企业登录"→跳 IdP→回调→进系统
  场景 2：会话刷新 [认证.P2] — token 过期→静默刷新→或跳登录

## 领域层（模块设计）
  SSOHandler [BF1] — 类接口 + 状态机 + 流程图 + 伪代码
  SessionManager [BF2] — 类接口 + 流程图 + 伪代码
  安全：SAML 签名验证 [约束.1] + replay 防护

## 文件影响汇总
## 验证策略汇总
```

---

## 术语与缩略语

| 统一格式 | 一句话解释 |
|---|---|
| 业务流 Business Flow - BF | 一条业务逻辑的伪代码流程（带编号 BF1/BF2）|
| 测试目标 Test Objective - TO | 每条使用路径要验证什么（不是具体测试用例）|
| 领域驱动设计 Domain-Driven Design - DDD | 按业务实体拆域、高内聚低耦合的设计方法 |
| 服务端推送 Server-Sent Events - SSE | 服务端向浏览器单向实时推送的协议 |
| 服务端请求伪造 Server-Side Request Forgery - SSRF | 诱导服务端访问非预期地址的攻击 |
| 端到端 End-to-End - E2E | 走完整链路的测试层级 |
