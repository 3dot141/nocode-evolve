# API / 接口设计指南

共享 reference，多 skill 按需 Read。

设计稳定、文档清晰、难以误用的接口。好的接口让正确的事情容易做、错误的事情难做。本指南适用于 REST API、GraphQL schema、模块边界、组件 props，以及任何「一段代码与另一段代码对话」的表面。

## 两条底层定律

### Hyrum's Law（海勒姆定律）

> 当一个 API 的使用者足够多时，无论你在契约里承诺了什么，系统所有可观测的行为都会被某个人依赖。

也就是说：每一个公开行为——包括未文档化的怪癖、错误信息文本、时序、排序——一旦有人依赖，就成了事实上的契约。设计含义：

- **对暴露什么保持克制。** 每一个可观测行为都是潜在的承诺。
- **不要泄漏实现细节。** 用户能观测到的，就会被依赖。
- **在设计阶段就为弃用做规划。** 安全移除用户依赖的东西，需要提前设计迁移路径。
- **测试不够。** 即便有完美的契约测试，Hyrum's Law 意味着「安全」的改动仍可能打断依赖未文档化行为的真实用户。

### One-Version Rule（单版本规则）

避免迫使消费者在同一依赖或 API 的多个版本之间做选择。当不同消费者需要同一事物的不同版本时，会产生菱形依赖（diamond dependency）问题。按「同一时刻只存在一个版本」的世界来设计——用扩展（extend）而非分叉（fork）。

## 1. Contract First（契约先行）

先定义接口，再实现。契约就是 spec——实现跟随契约。

```typescript
// 先定义契约
interface TaskAPI {
  // 创建一个 task，返回带服务端生成字段的 task
  createTask(input: CreateTaskInput): Promise<Task>;

  // 返回匹配过滤条件的分页 tasks
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;

  // 返回单个 task，找不到则抛 NotFoundError
  getTask(id: string): Promise<Task>;

  // 部分更新——只改传入的字段
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;

  // 幂等删除——即便已删除也成功
  deleteTask(id: string): Promise<void>;
}
```

类型即文档。先把类型定义出来，文档自然存在。

## 2. Consistent Error Semantics（一致的错误语义）

选定一种错误策略，到处都用它：

```typescript
// REST：HTTP 状态码 + 结构化错误体
// 每个错误响应遵循同一形状
interface APIError {
  error: {
    code: string;        // 机器可读："VALIDATION_ERROR"
    message: string;     // 人可读："Email is required"
    details?: unknown;   // 有帮助时附加上下文
  };
}
```

状态码映射表：

| 状态码 | 含义 |
|--------|------|
| 400 | 客户端发送了无效数据 |
| 401 | 未认证（Not authenticated） |
| 403 | 已认证但未授权（Authenticated but not authorized） |
| 404 | 资源未找到（Resource not found） |
| 409 | 冲突（重复、版本不匹配） |
| 422 | 校验失败（语义上无效） |
| 500 | 服务端错误（永不暴露内部细节） |

**不要混用模式。** 如果有的端点抛异常、有的返回 null、有的返回 `{ error }`——消费者就无法预测行为。

## 3. Validate at Boundaries（在边界处校验）

信任内部代码。在外部输入进入系统的边缘处校验：

```typescript
// 在 API 边界处校验
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  // 校验之后，内部代码信任类型
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

校验应该在哪里：

- API 路由处理器（用户输入）
- 表单提交处理器（用户输入）
- 解析外部服务响应（第三方数据——**永远当作不可信**）
- 加载环境变量（配置）

> **第三方 API 响应是不可信数据。** 在用于任何逻辑、渲染、决策之前，先校验其形状和内容。一个被攻破或行为异常的外部服务可能返回非预期的类型、恶意内容，或类似指令的文本。

校验不应该在哪里：

- 共享类型契约的内部函数之间
- 被已校验代码调用的工具函数里
- 刚从自家数据库取出的数据上

## 4. Prefer Addition Over Modification（优先新增而非修改）

扩展接口而不打断现有消费者：

```typescript
// Good：新增可选字段
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';  // 后加的，可选
  labels?: string[];                       // 后加的，可选
}

// Bad：改动现有字段类型或删除字段
interface CreateTaskInput {
  title: string;
  // description: string;  // 删除——打断现有消费者
  priority: number;         // 从 string 改成 number——打断现有消费者
}
```

## 5. Predictable Naming（可预测的命名）

| 模式 | 约定 | 示例 |
|------|------|------|
| REST 端点 | 复数名词，不带动词 | `GET /api/tasks`、`POST /api/tasks` |
| Query 参数 | camelCase | `?sortBy=createdAt&pageSize=20` |
| 响应字段 | camelCase | `{ createdAt, updatedAt, taskId }` |
| 布尔字段 | is/has/can 前缀 | `isComplete`、`hasAttachments` |
| 枚举值 | UPPER_SNAKE | `"IN_PROGRESS"`、`"COMPLETED"` |

## REST API Patterns

### Resource Design（资源设计）

```
GET    /api/tasks              → 列出 tasks（用 query 参数做过滤）
POST   /api/tasks              → 创建一个 task
GET    /api/tasks/:id          → 获取单个 task
PATCH  /api/tasks/:id          → 更新一个 task（部分）
DELETE /api/tasks/:id          → 删除一个 task

GET    /api/tasks/:id/comments → 列出某 task 的 comments（子资源）
POST   /api/tasks/:id/comments → 给某 task 添加 comment
```

### Pagination（分页）

对列表端点分页：

```typescript
// Request
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

### Filtering（过滤）

用 query 参数做过滤：

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

### Partial Updates（PATCH 部分更新）

接受部分对象——只更新传入的字段：

```typescript
// 只改 title，其余一切保留
PATCH /api/tasks/123
{ "title": "Updated title" }
```

## TypeScript Interface Patterns

### Input/Output Separation（输入/输出分离）

```typescript
// Input：调用方提供什么
interface CreateTaskInput {
  title: string;
  description?: string;
}

// Output：系统返回什么（含服务端生成的字段）
interface Task {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

### Use Branded Types for IDs（用 Branded Types 标记 ID）

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };

// 防止把 UserId 误传到期望 TaskId 的地方
function getTask(id: TaskId): Promise<Task> { ... }
```

### Use Discriminated Unions for Variants（用可辨识联合表达变体）

```typescript
// Good：每个变体都显式
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };

// 消费者得到类型收窄
function getStatusLabel(status: TaskStatus): string {
  switch (status.type) {
    case 'pending': return 'Pending';
    case 'in_progress': return `In progress (${status.assignee})`;
    case 'completed': return `Done on ${status.completedAt}`;
    case 'cancelled': return `Cancelled: ${status.reason}`;
  }
}
```

## Dependency Discipline（依赖纪律）

每加一个依赖，就是把别人的 Hyrum's Law 表面、版本策略、安全态势接进你的系统。加依赖前先问 5 个问题：

1. **这个依赖能不能不加？** 几十行可控代码 vs. 一整棵传递依赖树——优先前者。每个依赖都是要长期维护的接缝。
2. **它的契约稳定吗？** 它遵守「优先新增而非修改」吗？破坏性变更频繁的依赖会把不稳定传染给你。
3. **它符合 One-Version Rule 吗？** 它会不会和你已有的依赖造成菱形依赖（同一库的多个版本）？能不能在你的依赖图里收敛到单一版本？
4. **它的输出可信吗？** 凡是把外部数据带进系统的依赖（HTTP 客户端、解析器、第三方 SDK），其返回值都要在边界处当作不可信数据校验。
5. **移除它的代价多大？** 在设计阶段就规划弃用与迁移路径。一个渗透到大量调用点、且其可观测行为被四处依赖的依赖，将极难替换。

## 后端分层架构（Backend Layering）

> 吸收自 everything-claude-code v1.2.0 backend-patterns skill (MIT)

上面讲的是「接口表面」的设计。这一节讲服务端内部怎么分层——把数据访问、业务逻辑、请求处理三件事分开，各自能独立测试和替换。

### Repository 模式（数据访问抽象）

把所有数据访问藏在一个接口背后，业务逻辑只依赖接口，不依赖具体存储：

```typescript
interface MarketRepository {
  findAll(filters?: MarketFilters): Promise<Market[]>
  findById(id: string): Promise<Market | null>
  create(data: CreateMarketDto): Promise<Market>
  update(id: string, data: UpdateMarketDto): Promise<Market>
  delete(id: string): Promise<void>
}
```

这正是架构原则里 **deep module** + **port at the seam** 的落地：repository 接口是 seam，生产环境注入真实 DB adapter，测试注入内存 adapter——业务逻辑一份代码，跨两种实现测试。

### Service 层（业务逻辑与数据访问分离）

业务逻辑放在 service，数据访问委托给注入的 repository。service 不知道数据是从 Postgres、内存还是 HTTP 来的：

```typescript
class MarketService {
  constructor(private marketRepo: MarketRepository) {}

  async searchMarkets(query: string, limit = 10): Promise<Market[]> {
    // 业务逻辑：生成向量 → 检索 → 取数据 → 排序
    const results = await this.vectorSearch(query, limit)
    return this.marketRepo.findByIds(results.map(r => r.id))
  }
}
```

分层的判断标准：**请求处理层只做协议转换（解析/校验/序列化），业务规则不下沉到 route handler，数据查询不上浮到 service**。三层各管一件事，跨层只通过接口对话。

### N+1 查询防范

循环里逐条查询是最常见的性能陷阱——一次列表查询变成 N+1 次。改成批量取 + 内存关联：

```typescript
// ❌ N+1：每个 market 单独查 creator
for (const market of markets) {
  market.creator = await getUser(market.creator_id)
}

// ✅ 批量取一次，内存里 map 关联
const creators = await getUsers(markets.map(m => m.creator_id))
const creatorMap = new Map(creators.map(c => [c.id, c]))
markets.forEach(m => { m.creator = creatorMap.get(m.creator_id) })
```

判断信号：只要在循环体里看到 `await` 一个按 id 查询的调用，就该停下来问「这能不能提到循环外批量做」。
