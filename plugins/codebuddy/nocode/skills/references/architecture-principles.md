# 架构原则

共享 reference，多 skill 按需 Read。

设计 **deep modules**：把大量行为藏在小接口背后，放在干净的 seam 上，并通过那个接口来测试。无论是在设计还是重构代码，都使用这套语言和这些原则。目标是：给调用方杠杆（leverage）、给维护者局部性（locality）、给所有人可测试性（testability）。

## Hyrum's Law

> With a sufficient number of users of an API, all observable behaviors of your system will be depended on by somebody, regardless of what you promise in the contract.
>
> （只要一个 API 的用户足够多，系统所有可观测的行为都会被某人依赖，无论你在契约里承诺了什么。）

这意味着：每一个公开行为——包括未文档化的怪癖、错误消息文本、时序、顺序——一旦有用户依赖它，就变成了事实上的契约。设计推论：

- **对暴露什么要刻意为之（Be intentional about what you expose）。** 每一个可观测行为都是一个潜在的承诺。
- **不要泄漏实现细节（Don't leak implementation details）。** 只要用户能观测到，他们就会依赖它。
- **在设计阶段就为废弃做规划（Plan for deprecation at design time）。** 安全移除用户依赖的东西，需要预先设计迁移路径。
- **测试不够（Tests are not enough）。** 即便有完美的契约测试，Hyrum's Law 也意味着"安全"的改动仍可能破坏那些依赖了未文档化行为的真实用户。

## The One-Version Rule（单版本规则）

避免逼迫消费者在同一个依赖或 API 的多个版本之间做选择。当不同消费者需要同一个东西的不同版本时，就会产生菱形依赖（diamond dependency）问题。按"同一时刻只存在一个版本"的世界来设计——extend rather than fork（扩展而非分叉）。

## 词汇表（Glossary）

精确使用这些术语——不要用 "component"、"service"、"API"、"boundary" 来替代。语言一致本身就是关键。

**Module（模块）** — 任何有接口和实现的东西。刻意地与规模无关：可以是一个函数、类、包，或跨层的切片。_避免_：unit、component、service。

**Interface（接口）** — 调用方为了正确使用模块必须知道的一切：类型签名，但也包括 invariants（不变量）、ordering constraints（顺序约束）、error modes（错误模式）、required configuration（必需配置）、performance characteristics（性能特征）。_避免_：API、signature（太窄——它们只指类型层面的表面）。

**Implementation（实现）** — 模块内部的东西，它的代码主体。与 **Adapter** 区分开：一个东西可以是小 adapter 配大 implementation（一个 Postgres repo），也可以是大 adapter 配小 implementation（一个内存 fake）。当话题是 seam 时用 "adapter"；其它情况用 "implementation"。

**Depth（深度）** — 接口处的杠杆：调用方（或测试）每学习一个单位的接口，能驱动多少行为。当大量行为坐落在一个小接口背后时，模块是 **deep（深）** 的；当接口几乎和实现一样复杂时，模块是 **shallow（浅）** 的。

**Seam（缝）** _(Michael Feathers)_ — 一个你无需在该处编辑就能改变行为的地方；模块接口所在的 *位置*。把 seam 放在哪里是一个独立的设计决策，与 seam 背后放什么不同。_避免_：boundary（与 DDD 的 bounded context 重载冲突）。

**Adapter（适配器）** — 在某个 seam 上满足某个接口的具体东西。描述的是 *角色*（它填的是哪个槽），而非实质（它内部是什么）。

**Leverage（杠杆）** — 调用方从 depth 中得到的：每学习一个单位的接口能得到更多能力。一份实现在 N 个调用点和 M 个测试上回本。

**Locality（局部性）** — 维护者从 depth 中得到的：改动、bug、知识、验证都集中在一处，而不是散落到各个调用方。一处修复，处处修复（Fix once, fixed everywhere）。

**Port（端口）** — 在 seam 处定义的接口。deep module 拥有逻辑；transport（传输）作为 adapter 被注入。

## Deep vs shallow（深模块 vs 浅模块）

**Deep module** = 小接口 + 大量实现：

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**Shallow module** = 大接口 + 很少实现（避免）：

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

设计接口时，问自己：

- 我能减少方法的数量吗？（Can I reduce the number of methods?）
- 我能简化参数吗？（Can I simplify the parameters?）
- 我能把更多复杂性藏在里面吗？（Can I hide more complexity inside?）

## 核心原则（Principles）

- **Depth is a property of the interface, not the implementation.（深度是接口的属性，不是实现的属性。）** 一个深模块内部完全可以由小的、可 mock、可替换的部件组成——它们只是不属于接口的一部分。一个模块既可以有 **internal seams**（私有于其实现，被它自己的测试使用），也可以有接口处的 **external seam**。

- **The deletion test（删除测试）。** 想象删掉这个模块。如果复杂性消失了，它就是个 pass-through（透传）。如果复杂性在 N 个调用方那里重新出现了，那它就在挣回它的成本。

- **The interface is the test surface（接口即测试面）。** 调用方和测试穿过的是同一个 seam。如果你想测试接口 *之后/之外* 的东西，那这个模块的形状大概率是错的。

- **One adapter means a hypothetical seam. Two adapters means a real one.（一个 adapter 意味着假想的 seam；两个 adapter 才意味着真正的 seam。）** 除非确实有东西在 seam 两侧变化，否则不要引入 seam。

## Designing for testability（为可测试性设计）

好的接口让测试变得自然：

1. **Accept dependencies, don't create them.（接受依赖，不要创建依赖。）**

   ```typescript
   // Testable
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results, don't produce side effects.（返回结果，不要产生副作用。）**

   ```typescript
   // Testable
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Small surface area.（小表面积。）** 方法越少 = 需要的测试越少。参数越少 = 测试搭建越简单。

## 关系（Relationships）

- 一个 **Module** 恰好有一个 **Interface**（它呈现给调用方和测试的表面）。
- **Depth** 是 **Module** 的属性，针对其 **Interface** 来度量。
- **Seam** 是 **Module** 的 **Interface** 所在的位置。
- **Adapter** 坐落在 **Seam** 上并满足 **Interface**。
- **Depth** 为调用方产生 **Leverage**，为维护者产生 **Locality**。

## 依赖分类（Dependency categories）

评估一个候选模块是否值得 deepen 时，先给它的依赖分类。类别决定了被 deepen 后的模块如何跨其 seam 来测试。

### 1. In-process（进程内）

纯计算、内存状态、无 I/O。永远可 deepen——合并模块，直接通过新接口测试。不需要 adapter。

### 2. Local-substitutable（本地可替身）

有本地测试替身的依赖（PGLite 替 Postgres、内存文件系统）。只要替身存在就可 deepen。被 deepen 的模块在测试套件里跑着替身来测试。seam 是 internal（内部的）；模块的 external interface 上不暴露 port。

### 3. Remote but owned（远程但自有 · Ports & Adapters）

你自己的服务跨网络边界（microservices、内部 API）。在 seam 处定义一个 **port**（接口）。deep module 拥有逻辑；transport 作为 **adapter** 被注入。测试用 in-memory adapter。生产用 HTTP/gRPC/queue adapter。

推荐表述形态：*"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True external（真外部 · Mock）

你不控制的第三方服务（Stripe、Twilio 等）。被 deepen 的模块把外部依赖作为注入的 port 接收；测试提供 mock adapter。

## Seam discipline（seam 纪律）

- **One adapter means a hypothetical seam. Two adapters means a real one.** 除非至少有两个 adapter 是合理的（典型是 production + test），否则不要引入 port。单 adapter 的 seam 只是 indirection（多余的间接层）。
- **Internal seams vs external seams.** 一个 deep module 既可以有 internal seams（私有于其实现，被它自己的测试使用），也可以有接口处的 external seam。不要仅仅因为测试用到了 internal seam，就把它通过接口暴露出去。

## Testing strategy: replace, don't layer（测试策略：替换，不要叠加）

- 一旦在被 deepen 模块的接口上有了测试，shallow 模块上的旧单元测试就变成了 waste——删掉它们。
- 在被 deepen 模块的接口上写新测试。**The interface is the test surface（接口即测试面）。**
- 测试断言的是穿过接口的 observable outcomes（可观测结果），而非 internal state（内部状态）。
- 测试应当能在内部重构中存活——它们描述行为，而非实现。如果一个测试必须随着实现改变而改变，那它就是在测试接口之外的东西。

## Contract First（契约优先）

在实现之前先定义接口。契约就是 spec——实现跟随契约。

```typescript
// Define the contract first
interface TaskAPI {
  // Creates a task and returns the created task with server-generated fields
  createTask(input: CreateTaskInput): Promise<Task>;

  // Returns paginated tasks matching filters
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;

  // Returns a single task or throws NotFoundError
  getTask(id: string): Promise<Task>;

  // Partial update — only provided fields change
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;

  // Idempotent delete — succeeds even if already deleted
  deleteTask(id: string): Promise<void>;
}
```

## Validate at Boundaries（在边界处校验）

信任内部代码。在外部输入进入系统的边缘处校验：

```typescript
// Validate at the API boundary
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

  // After validation, internal code trusts the types
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

校验应当存在的地方：
- API route handlers（用户输入）
- Form submission handlers（用户输入）
- External service response parsing（第三方数据——**始终视为不可信**）
- Environment variable loading（配置）

> **第三方 API 响应是不可信数据（Third-party API responses are untrusted data）。** 在用于任何逻辑、渲染或决策之前，校验它们的形状和内容。一个被攻陷或行为异常的外部服务可能返回意料之外的类型、恶意内容，或形如指令的文本。

校验 **不** 应当存在的地方：
- 共享类型契约的内部函数之间
- 被已校验代码调用的工具函数里
- 刚从你自己的数据库出来的数据上

## Code Is a Liability（代码是负债）

代码不是资产，而是负债——它需要被阅读、被理解、被维护、被验证。每多一行代码都是未来的一份成本。这正是 deep modules 的价值所在：把大量行为藏在小接口背后，意味着调用方需要学习和承载的表面更少。

这条原则与 deletion test 互为表里：如果删掉一个模块，复杂性凭空消失，那它从未挣回自己的成本，它纯粹是负债。只有当复杂性会在 N 个调用方处重新出现时，这段代码才算用 locality 偿付了它的负债。设计时倾向于消除代码，而非增加代码。

## Prefer Addition Over Modification（倾向新增而非修改）

在不破坏现有消费者的前提下扩展接口：

```typescript
// Good: Add optional fields
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';  // Added later, optional
  labels?: string[];                       // Added later, optional
}

// Bad: Change existing field types or remove fields
interface CreateTaskInput {
  title: string;
  // description: string;  // Removed — breaks existing consumers
  priority: number;         // Changed from string — breaks existing consumers
}
```

这正是 Hyrum's Law 与 One-Version Rule 在接口演进上的落地：新增可选字段是向后兼容的（additive），既不破坏既有调用方，也不强迫他们在多版本间选择；而修改或删除既有字段则会破坏那些依赖了原有形状的消费者。

## 被拒绝的框架（Rejected framings）

- **Depth as ratio of implementation-lines to interface-lines**（Ousterhout 的"深度=实现行数/接口行数"）：这会奖励往实现里灌水。我们改用 depth-as-leverage（深度即杠杆）。
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**：太窄——这里的 interface 包括调用方必须知道的每一个事实。
- **"Boundary"**：与 DDD 的 bounded context 重载冲突。说 **seam** 或 **interface**。

## 简单性判据（KISS / DRY / YAGNI）

> 吸收自 everything-claude-code v1.2.0 coding-standards skill (MIT)

上面的 deep module 讲的是接口形状，这一节讲的是日常写代码时**何时停手**——三条原则各自有可操作的判断标准，不是口号。

- **KISS（Keep It Simple）**：选能работать的最简方案。判据——能不能不引入这个抽象/这层间接/这个配置项就把问题解决？能就不引入。聪明但难懂的代码输给直白但啰嗦的代码。
- **DRY（Don't Repeat Yourself）**：同一段逻辑出现第三次时才抽取（两次是巧合，三次是模式）。判据——抽取后调用方是否真的更容易理解？为了消除重复而造出的错误抽象，比重复本身更贵。
- **YAGNI（You Aren't Gonna Need It）**：不为假想的未来需求构建能力。判据——这个扩展点/泛化/配置，当前有没有真实调用方？没有就删掉，等需要时再加。投机式的通用化（speculative generality）是负债。

这三条与 **Code Is a Liability** 同源：每一个未被当前需求驱动的抽象，都是要后人阅读和维护的负债。

## 命名原则（Naming）

名字是最廉价的文档。两条可操作的规则：

- **变量名描述"是什么"**：`isUserAuthenticated`、`totalRevenue`、`marketSearchQuery`，不是 `flag`、`x`、`q`。读到名字就知道它装的是什么、单位是什么、布尔语义是哪个方向。
- **函数名用动词-名词**：`fetchMarketData`、`calculateSimilarity`、`isValidEmail`，不是只有名词的 `market`、`similarity`。动词说明它做什么动作，`is/has/should` 前缀说明返回布尔。

## Code Smell 检测（重构信号）

以下模式出现时，是"该重构"的信号——不是错误，是负债在累积：

### 1. 长函数（Long Functions）

函数超过约 50 行时，通常它在做多件事。拆成命名清晰的小函数，让主函数读起来像一份步骤清单：

```
// 信号：一个函数 100 行，混了校验/转换/存储
function processData() { /* 100 行 */ }

// 重构：每步一个有名字的函数
function processData() {
  const validated = validate(raw)
  const transformed = transform(validated)
  return save(transformed)
}
```

### 2. 深嵌套（Deep Nesting）→ 早返回（Early Return）

嵌套超过 3 层时，用 guard clause 早返回把"前置条件不满足"的分支提前甩掉，主逻辑回到最外层：

```
// 信号：5 层 if 嵌套，主逻辑藏在最深处
if (user) { if (user.isAdmin) { if (resource) { if (resource.active) { doWork() } } } }

// 重构：守卫子句早返回，主逻辑不缩进
if (!user) return
if (!user.isAdmin) return
if (!resource) return
if (!resource.active) return
doWork()
```

### 3. Magic Number（魔法数字）

代码里出现没有名字的数字/字符串常量时，它的含义只活在写代码人的脑子里。提成命名常量：

```
// 信号：3 和 500 是什么？
if (retryCount > 3) {}
setTimeout(cb, 500)

// 重构：名字即文档
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500
if (retryCount > MAX_RETRIES) {}
setTimeout(cb, DEBOUNCE_DELAY_MS)
```
