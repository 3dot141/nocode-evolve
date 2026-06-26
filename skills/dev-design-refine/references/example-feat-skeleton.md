# feat 产出骨架示例（多域）

> 以"Nocode Manager 资源批量导入"为例。实际产出按项目调整，学结构和思路不照搬措辞。

---

## 背景

核心问题：用户迁移一个完整工作环境要手动添加 20+ 个资源，逐个操作。
PRD 路径 `资源库.P3` 要求支持从 JSON / ZIP / GitHub repo 批量导入。
pd-ui 产出了导入流程的交互设计（`.ui.md`）。

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

> 按影响范围从大到小。每条说清选了什么、为什么、否决了什么。标注影响哪个 BF / 约束。

### Q1: 导入格式怎么统一？→ 影响 BF1

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 每种格式独立处理链 | JSON/ZIP/GitHub 各走各的 | 实现简单 | 3 条链路，加新格式写全套 |
| **B. 统一转 ImportManifest** | 解析层各自，解析后统一 | 加新格式只改 parser | 需定义中间格式 |
| C. 插件式 adapter | 注册 adapter 分发 | 最灵活 | 3 种格式 over-engineering |

**选 B**。区别只在解析层，后续逻辑相同。方案 C 等 6+ 种格式再考虑。

### Q2: 同步串行还是并行？→ 影响 BF3, Agent.P1

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 并行 Promise.all | 全部同时推 | 理论最快 | 触发 rate limit（实测 Claude 10 req/s） |
| **B. 串行逐条** | 一条一条推 | 不触发限流 | 20×3=60 条约 6 秒 |
| C. 并行 + rate limiter | 并行但限流 | 快且可控 | 实现复杂，6 秒够了 |

**选 B**。6 秒可接受。≥100 资源时再考虑方案 C。

### Q3: 实时进度怎么推？→ 影响 场景 3

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 轮询 | 前端定时 GET | 简单 | 延迟高、浪费请求 |
| **B. SSE** | 服务端单向推送 | 实时、自动重连 | 单向（够用） |
| C. WebSocket | 双向通信 | 最灵活 | 只需单向，overkill |

**选 B（SSE）**。进度推送是单向的，SSE 比轮询实时，比 WebSocket 轻量。

### Q4: 冲突怎么处理？→ 影响 BF2, 约束.2

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 静默覆盖 | 同名直接覆盖 | 零交互 | 用户不知道被覆盖 |
| B. 静默跳过 | 同名跳过 | 零交互 | 想更新时更新不了 |
| **C. 让用户选** | 展示冲突列表，逐条/批量决策 | 用户掌控 | 多一步交互 |

**选 C**。用户对"rule 会不会被覆盖"敏感。批量操作控制交互成本。

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

## 监控设计

> 监控是独立的功能设计——按可观测性三支柱（Logs / Metrics / Traces）组织。核心问题：导入功能上线后，怎么知道它在正常工作？出问题时怎么定位？

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
