# 安全指南

共享 reference，多 skill 按需 Read。

## 总览

面向 Web 应用的安全优先开发实践。把每一个外部输入都当作敌对的，把每一个 secret 都当作神圣的，把每一次授权检查都当作强制的。安全不是一个阶段——它是对每一行触及用户数据、认证或外部系统的代码的约束。

适用场景：

- 构建任何接受用户输入的功能
- 实现认证或授权
- 存储或传输敏感数据
- 集成外部 API 或服务
- 添加文件上传、webhook 或回调
- 处理支付或 PII 数据

## Threat Model First（先建威胁模型）

没有威胁模型就硬塞控制措施，等于在猜。在加固之前，花五分钟像攻击者一样思考：

1. **画出信任边界。** 不可信数据从哪里跨入你的系统？HTTP 请求、表单字段、文件上传、webhook、第三方 API、消息队列，以及 **LLM 输出**。每一个边界都是攻击面。
2. **命名资产。** 什么东西值得偷或值得搞坏？凭据、PII、支付数据、管理员操作、资金流转。
3. **对每个边界跑一遍 STRIDE** —— 一个快速的视角，而非一套仪式：

| 威胁 | 要问的问题 | 典型缓解措施 |
|---|---|---|
| **S**poofing（仿冒） | 有人能冒充某个用户/服务吗？ | 认证、签名验证 |
| **T**ampering（篡改） | 数据在传输中或静态时能被改动吗？ | 完整性校验、参数化查询、HTTPS |
| **R**epudiation（抵赖） | 某个操作事后能被否认吗？ | 对安全事件做审计日志 |
| **I**nformation disclosure（信息泄露） | 数据会泄漏吗？ | 加密、字段允许列表、通用错误信息 |
| **D**enial of service（拒绝服务） | 它会被压垮吗？ | 限流、输入大小上限、超时 |
| **E**levation of privilege（提权） | 用户能获得本不该有的权限吗？ | 授权检查、最小权限 |

4. **在 use case 旁边写 abuse case。** 对每个功能问一句"我会怎么滥用它？"——然后把它作为你的第一个测试。

如果你说不出一个功能的信任边界，那你还没准备好去保护它。这就是 OWASP **A04: Insecure Design（不安全设计）**——大多数入侵始于设计，而非代码。

## 三层边界系统（Three-Tier Boundary System）

### Always Do（永远要做，无例外）

- **在系统边界校验所有外部输入**（API 路由、表单处理器）
- **参数化所有数据库查询**——绝不把用户输入拼接进 SQL
- **对输出做编码**以防 XSS（使用框架的自动转义，别绕过它）
- **对所有外部通信使用 HTTPS**
- **用 bcrypt/scrypt/argon2 哈希密码**（绝不存明文）
- **设置安全响应头**（CSP、HSTS、X-Frame-Options、X-Content-Type-Options）
- **会话使用 httpOnly、secure、sameSite cookie**
- **在每次发布前运行 `npm audit`**（或同等工具）

### Ask First（需要人工批准）

- 添加新的认证流程或改动认证逻辑
- 存储新类别的敏感数据（PII、支付信息）
- 添加新的外部服务集成
- 改动 CORS 配置
- 添加文件上传处理器
- 修改限流或节流
- 授予提升的权限或角色

### Never Do（永远不要做）

- **绝不把 secret 提交**到版本控制（API key、密码、token）
- **绝不记录敏感数据**（密码、token、完整信用卡号）
- **绝不把客户端校验当作安全边界来信任**
- **绝不为了方便而禁用安全响应头**
- **绝不对用户提供的数据使用 `eval()` 或 `innerHTML`**
- **绝不把会话存放在客户端可访问的存储中**（用 localStorage 存认证 token）
- **绝不向用户暴露堆栈跟踪**或内部错误细节

## OWASP Top 10 防护模式

这些是防护模式，不是排名。2021 年的排序见 `references/security-checklist.md` 中的速查表。

### Injection（SQL、NoSQL、OS 命令注入）

```typescript
// BAD: 通过字符串拼接造成 SQL 注入
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: 参数化查询
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// GOOD: 使用 ORM 的参数化输入
const user = await prisma.user.findUnique({ where: { id: userId } });
```

### Broken Authentication（认证失效）

```typescript
// 密码哈希
import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);

// 会话管理
app.use(session({
  secret: process.env.SESSION_SECRET,  // 来自环境变量，不写在代码里
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,     // JavaScript 不可访问
    secure: true,       // 仅 HTTPS
    sameSite: 'lax',    // CSRF 防护
    maxAge: 24 * 60 * 60 * 1000,  // 24 小时
  },
}));
```

### Cross-Site Scripting（XSS，跨站脚本）

```typescript
// BAD: 把用户输入当作 HTML 渲染
element.innerHTML = userInput;

// GOOD: 使用框架的自动转义（React 默认就这么做）
return <div>{userInput}</div>;

// 如果你必须渲染 HTML，先做净化
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

### Broken Access Control（访问控制失效）

```typescript
// 永远要检查授权，而不只是认证
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);

  // 检查已认证用户是否拥有此资源
  if (task.ownerId !== req.user.id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Not authorized to modify this task' }
    });
  }

  // 继续执行更新
  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

### Security Misconfiguration（安全配置错误）

```typescript
// 安全响应头（Express 用 helmet）
import helmet from 'helmet';
app.use(helmet());

// 内容安全策略 Content Security Policy
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],  // 尽可能收紧
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
  },
}));

// CORS —— 限制到已知来源
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));
```

### Sensitive Data Exposure（敏感数据暴露）

```typescript
// 绝不在 API 响应中返回敏感字段
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}

// 用环境变量存放 secret
const API_KEY = process.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error('STRIPE_API_KEY not configured');
```

### Server-Side Request Forgery（SSRF，服务端请求伪造）

任何时候服务端去 fetch 一个受用户影响的 URL——webhook、"从 URL 导入"、图片代理、链接预览——攻击者都能把它指向内部服务（云元数据、`localhost`、私有 IP）。

```typescript
// BAD: 用户给什么就 fetch 什么
await fetch(req.body.webhookUrl);

// GOOD: 对 scheme + host 做允许列表，若任一解析出的 IP 是私有则拒绝，禁止跟随重定向
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const ALLOWED_HOSTS = new Set(['hooks.example.com']);

async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');
  // 解析所有记录；只要有一个私有/保留地址就判定失败。
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.some((a) => ipaddr.parse(a.address).range() !== 'unicast')) {
    throw new Error('private/reserved IP');
  }
  return url;
}

await fetch(await assertSafeUrl(req.body.webhookUrl), { redirect: 'error' });
```

`range() !== 'unicast'` 这个检查覆盖了 loopback、link-local `169.254.169.254`（云元数据，头号 SSRF 目标）、私有以及 unique-local 范围，IPv4 和 IPv6 都涵盖。

**注意——这里仍有 TOCTOU 间隙。** `fetch` 在检查之后会再次解析 DNS，所以使用短 TTL 记录的攻击者可以在校验与连接之间把记录重绑定到内部 IP。对于高风险面，应一次性解析并连接到固定 IP，或在前面放一个过滤代理（`request-filtering-agent` / `ssrf-req-filter`）。

## Input Validation（输入校验模式）

### 在边界做 Schema 校验

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});

// 在路由处理器处校验
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten(),
      },
    });
  }
  // result.data 现在是已类型化且已校验的
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

### 文件上传安全

```typescript
// 限制文件类型和大小
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function validateUpload(file: UploadedFile) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new ValidationError('File type not allowed');
  }
  if (file.size > MAX_SIZE) {
    throw new ValidationError('File too large (max 5MB)');
  }
  // 别信任文件扩展名——若关键，检查 magic bytes
}
```

## Triaging npm audit Results（分诊 npm audit 结果）

并非所有 audit 发现都需要立即处理。使用下面的决策树：

```
npm audit 报告一个漏洞
├── 严重级别：critical 或 high
│   ├── 易受攻击的代码在你的应用中是否可达？
│   │   ├── 是 --> 立即修复（更新、打补丁或替换该依赖）
│   │   └── 否（仅 dev 依赖、未使用的代码路径）--> 尽快修，但不阻断
│   └── 是否有可用的修复？
│       ├── 是 --> 更新到已打补丁的版本
│       └── 否 --> 找绕过方案、考虑替换依赖，或带审查日期加入允许列表
├── 严重级别：moderate
│   ├── 在生产中可达？--> 在下一个发布周期修复
│   └── 仅 dev？--> 方便时修，记入 backlog 跟踪
└── 严重级别：low
    └── 跟踪，在常规依赖更新时修复
```

**关键问题：**
- 易受攻击的函数在你的代码路径里真的被调用了吗？
- 该依赖是运行时依赖还是仅 dev 依赖？
- 在你的部署上下文下该漏洞可被利用吗（例如，一个服务端漏洞出现在纯客户端应用里）？

当你推迟修复时，记录原因并设置一个审查日期。

### Supply-Chain Hygiene（供应链卫生）

`npm audit` 抓的是已知 CVE；它抓不到恶意或仿冒（typosquat）的包。此外：

- **提交 lockfile**，并在 CI 中用 `npm ci`（而非 `npm install`）安装——可复现的构建，无静默版本漂移。
- **添加新依赖前先审查**——维护状况、下载量，以及它是否真的配得上它的位置。每个依赖都是攻击面（OWASP **A06: Vulnerable Components（易受攻击的组件）**、**LLM03: Supply Chain（供应链）**）。
- **警惕陌生包里的 `postinstall` 脚本**——它们会在安装时运行任意代码。
- **留意仿冒包名**——`cross-env` vs `crossenv`、`react-dom` vs `reactdom`。

## Rate Limiting（限流）

```typescript
import rateLimit from 'express-rate-limit';

// 通用 API 限流
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,                   // 每窗口 100 个请求
  standardHeaders: true,
  legacyHeaders: false,
}));

// 对认证端点更严格的限制
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // 每 15 分钟 10 次尝试
}));
```

## Secrets Management（密钥管理）

```
.env 文件：
  ├── .env.example  → 提交（带占位值的模板）
  ├── .env          → 不提交（包含真实 secret）
  └── .env.local    → 不提交（本地覆盖）

.gitignore 必须包含：
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
```

**提交前务必检查：**
```bash
# 检查是否误暂存了 secret
git diff --cached | grep -i "password\|secret\|api_key\|token"
```

**一旦某个 secret 被提交过，就轮换它。** 删除那一行或重写历史是不够的——它一旦到达远端，就当它已经被泄露。先吊销并重新签发 key，然后再从历史中清除。

## Securing AI / LLM Features（AI / LLM 特有安全考虑）

如果你的应用调用 LLM——聊天机器人、摘要器、agent、RAG——它就继承了一个新的攻击面。把它映射到 [OWASP Top 10 for LLM Applications (2025)](https://genai.owasp.org/llm-top-10/)：

- **把所有模型输出都当作不可信输入（LLM05: Improper Output Handling，不当输出处理）。** 绝不把 LLM 输出直接传入 `eval`、SQL、shell、`innerHTML` 或文件路径。要像对待原始用户输入一样校验并编码它。
- **假设 prompt 可被劫持（LLM01: Prompt Injection，提示注入）。** 上下文窗口里的不可信文本——用户消息、抓取的网页、PDF——都可能携带指令。系统提示不是安全边界；在代码里强制权限，而不是在 prompt 里。
- **把 secret 和其他用户的数据排除在 prompt 之外（LLM02 / LLM07）。** 上下文里的任何东西都可能被回显出来。别把 API key、跨租户数据或完整系统提示放在模型能复述的地方。
- **约束工具与 agent 权限（LLM06: Excessive Agency，过度自主）。** 把工具范围限到最小，对破坏性或不可逆的操作要求确认，并校验每一个工具参数。
- **限定消耗（LLM10: Unbounded Consumption，无界消耗）。** 对 token、请求速率以及循环/递归深度设上限，使得精心构造的输入无法堆高成本或拖垮系统。
- **隔离检索数据（LLM08: Vector and Embedding Weaknesses，向量与嵌入弱点）。** 在 RAG 中，把向量库当作信任边界：按租户分区嵌入，让一个用户无法检索到另一个用户的数据；并在索引前校验文档，使被投毒的内容无法引导答案。

```typescript
// BAD: 把模型输出当作命令或当作标记来信任
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);                                   // 任意查询执行
container.innerHTML = await llm.reply(userMessage);   // 经由模型造成的存储型 XSS

// GOOD: 模型输出是数据——防御性解析，再校验，再编码
let intent;
try {
  intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
} catch {
  throw new ValidationError('unexpected model output'); // JSON.parse 或 schema 失败
}
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```

## Security Review Checklist（安全评审清单）

```markdown
### Authentication（认证）
- [ ] 密码用 bcrypt/scrypt/argon2 哈希（salt rounds ≥ 12）
- [ ] 会话 token 是 httpOnly、secure、sameSite
- [ ] 登录有限流
- [ ] 密码重置 token 会过期

### Authorization（授权）
- [ ] 每个端点都检查用户权限
- [ ] 用户只能访问自己的资源
- [ ] 管理员操作需要验证管理员角色

### Input（输入）
- [ ] 所有用户输入在边界处校验
- [ ] SQL 查询参数化
- [ ] HTML 输出被编码/转义
- [ ] 服务端 URL fetch 走允许列表（不会 SSRF 到内部服务）

### Data（数据）
- [ ] 代码或版本控制中无 secret
- [ ] 敏感字段被排除在 API 响应之外
- [ ] PII 静态加密（如适用）

### Infrastructure（基础设施）
- [ ] 配置了安全响应头（CSP、HSTS 等）
- [ ] CORS 限制到已知来源
- [ ] 依赖做过漏洞审计
- [ ] 错误信息不暴露内部细节

### Supply Chain（供应链）
- [ ] 提交了 lockfile；CI 用 `npm ci` 安装
- [ ] 新依赖经过审查（维护状况、下载量、postinstall 脚本）

### AI / LLM（如使用）
- [ ] 模型输出被当作不可信（无 eval/SQL/innerHTML/shell）
- [ ] secret 和其他用户的数据排除在 prompt 之外
- [ ] 工具/agent 权限受限；破坏性操作需要确认
```

## Common Rationalizations（常见的自我开脱）

| 开脱说法 | 现实 |
|---|---|
| "这是内部工具，安全不重要" | 内部工具一样会被攻陷。攻击者专挑最薄弱的环节。 |
| "我们以后再加安全" | 事后补安全比一开始就建进去难 10 倍。现在就加。 |
| "没人会去利用这个" | 自动化扫描器会找到它。靠隐蔽求安全不是安全。 |
| "框架会处理安全" | 框架提供工具，不提供保证。你仍然得正确地使用它们。 |
| "这只是个原型" | 原型会变成生产。从第一天就养安全习惯。 |
| "在这里做威胁建模属于过度" | 五分钟的"我会怎么攻击它？"能防住事后任何控制都补不了的设计缺陷。 |
| "这只是 LLM 输出，不过是文本而已" | 那段"文本"可以是一条 SQL 语句、一个 script 标签或一条 shell 命令。把它当作任何不可信输入来对待。 |

## Red Flags（危险信号）

- 用户输入被直接传入数据库查询、shell 命令或 HTML 渲染
- secret 出现在源码或提交历史中
- API 端点没有认证或授权检查
- 缺少 CORS 配置或使用通配符（`*`）来源
- 认证端点上没有限流
- 向用户暴露堆栈跟踪或内部错误
- 依赖中存在已知的 critical 漏洞
- 服务端 fetch 用户提供的 URL 而没有允许列表（SSRF）
- LLM/模型输出被传入查询、DOM、shell 或 `eval`
- secret、PII 或完整系统提示被放进 LLM 上下文窗口

## Verification（验证）

在实现安全相关代码之后：

- [ ] `npm audit` 显示无 critical 或 high 漏洞
- [ ] 源码或 git 历史中无 secret
- [ ] 所有用户输入在系统边界处校验
- [ ] 每个受保护端点都检查了认证与授权
- [ ] 响应中存在安全响应头（用浏览器 DevTools 检查）
- [ ] 错误响应不暴露内部细节
- [ ] 认证端点上的限流已生效
- [ ] 服务端 URL fetch 已对照允许列表校验（不会 SSRF）
- [ ] LLM/模型输出在使用前已校验并编码（如有 AI 功能）
