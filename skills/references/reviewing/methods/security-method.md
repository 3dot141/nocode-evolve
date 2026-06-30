# 方法卡：security-method（OWASP Top10 + 漏洞模式清单）

> reviewing 框架方法库 · 评审方法之一（清单载体）。**适合**：涉及**外部输入 / 认证授权 / API 端点 / 敏感数据 / 支付·资金**的代码 diff——安全评审的「逐项核查」载体。**不适合**：纯内部计算、无外部面逻辑（按信任边界裁剪，别全量套）。
>
> 本卡由 `agents/security-reviewer.md` 转出：剥 frontmatter + 写死项目示例，**完整保留 OWASP Top10 清单 + 10 个漏洞模式 + 漏洞 category**。常与 `threat-modeling` 配对：threat-modeling 按信任边界系统性发现威胁，本卡按 OWASP / 漏洞模式逐项兜底核查（§4.3 选择表「安全 → threat-modeling + checklist(security-method OWASP)」）。
>
> **caller 用法**：`Read` 本卡 + `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md`（套通用流程）+ `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md`（套 findings 契约）；把待审 diff 注入下方 `{DIFF}` 占位符。流程步骤（分档 / 独立交叉 / 分级 / 收口）走骨架，本卡只提供「领域维度」（骨架第 3 步）。

---

## 待审对象（caller 注入）

```
{DIFF}
```

---

## 一、维度 / 思路

安全 review 的领域维度 = **OWASP Top10 全清单 + 10 个高发漏洞模式 + 高风险区域**。逐项核查，每项判 ✅ 通过 / ⚠️ 疑点 / ❌ 问题，不默默跳过。

### 1.1 高风险区域（先定位再深挖）

先扫这些区域，安全问题密度最高：

- 认证 / 授权代码
- 接受用户输入的 API 端点
- 数据库查询
- 文件上传处理
- 支付 / 资金处理
- Webhook 处理器
- 外部 API 集成 / 出站请求

### 1.2 OWASP Top10 逐项核查（完整清单，不可删项）

| # | 类别 | 核查问 |
|---|---|---|
| 1 | **Injection**（SQL / NoSQL / Command） | 查询是否参数化？用户输入是否净化？ORM 用法是否安全？ |
| 2 | **Broken Authentication** | 密码是否哈希（bcrypt / argon2）？JWT 是否正确校验？session 是否安全？是否提供 MFA？ |
| 3 | **Sensitive Data Exposure** | 是否强制 HTTPS？secret 是否在环境变量？PII 是否静态加密？日志是否净化？ |
| 4 | **XML External Entities (XXE)** | XML parser 是否安全配置？外部实体处理是否禁用？ |
| 5 | **Broken Access Control** | 每个路由是否做授权检查？对象引用是否间接？CORS 是否正确配置？ |
| 6 | **Security Misconfiguration** | 默认凭据是否更换？错误处理是否安全？安全响应头是否设置？生产是否禁用 debug？ |
| 7 | **Cross-Site Scripting (XSS)** | 输出是否转义 / 净化？是否设置 CSP？框架是否默认转义？ |
| 8 | **Insecure Deserialization** | 用户输入是否安全反序列化？反序列化库是否最新？ |
| 9 | **Using Components with Known Vulnerabilities** | 依赖是否最新？`npm audit` 是否干净？CVE 是否监控？ |
| 10 | **Insufficient Logging & Monitoring** | 安全事件是否记录？日志是否监控？告警是否配置？ |

### 1.3 漏洞模式（10 个高发，附 ❌/✅ 对照 + 原生 category）

漏洞 category（原生 4 档 CRITICAL / HIGH / MEDIUM / LOW）保留如下，进 findings 时按 §2 压成统一 C/W/S（**High 上提 Critical**）：

1. **Hardcoded Secrets（CRITICAL）**
```javascript
// ❌ 硬编码 secret
const apiKey = "sk-proj-xxxxx"
// ✅ 环境变量 + 缺失即抛
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
```

2. **SQL Injection（CRITICAL）**
```javascript
// ❌ 字符串拼接
const query = `SELECT * FROM users WHERE id = ${userId}`
// ✅ 参数化 / ORM 安全用法
await supabase.from('users').select('*').eq('id', userId)
```

3. **Command Injection（CRITICAL）**
```javascript
// ❌ 用户输入进 shell
exec(`ping ${userInput}`, callback)
// ✅ 用库而非 shell
dns.lookup(userInput, callback)
```

4. **Cross-Site Scripting (XSS)（HIGH）**
```javascript
// ❌ innerHTML 注入
element.innerHTML = userInput
// ✅ textContent 或 DOMPurify.sanitize
element.textContent = userInput
```

5. **Server-Side Request Forgery (SSRF)（HIGH）**
```javascript
// ❌ 直接 fetch 用户 URL
const response = await fetch(userProvidedUrl)
// ✅ 白名单校验 host 再请求
const url = new URL(userProvidedUrl)
if (!allowedDomains.includes(url.hostname)) throw new Error('Invalid URL')
```

6. **Insecure Authentication（CRITICAL）**
```javascript
// ❌ 明文密码比较
if (password === storedPassword) { /* login */ }
// ✅ 哈希比较
const isValid = await bcrypt.compare(password, hashedPassword)
```

7. **Insufficient Authorization（CRITICAL）**
```javascript
// ❌ 无授权检查，谁都能拿任意 user
app.get('/api/user/:id', async (req, res) => { res.json(await getUser(req.params.id)) })
// ✅ 校验调用者能否访问该资源
if (req.user.id !== req.params.id && !req.user.isAdmin) return res.status(403).json({ error: 'Forbidden' })
```

8. **Race Conditions in Financial Operations（CRITICAL）**
```javascript
// ❌ 余额检查与扣减之间有竞态
const balance = await getBalance(userId)
if (balance >= amount) await withdraw(userId, amount) // 并行请求可重复扣
// ✅ 原子事务 + 行锁
await db.transaction(async (trx) => {
  const balance = await trx('balances').where({ user_id: userId }).forUpdate().first()
  if (balance.amount < amount) throw new Error('Insufficient balance')
  await trx('balances').where({ user_id: userId }).decrement('amount', amount)
})
```

9. **Insufficient Rate Limiting（HIGH）**
```javascript
// ❌ 端点无限流
app.post('/api/trade', async (req, res) => { await executeTrade(req.body) })
// ✅ rateLimit 中间件
app.post('/api/trade', tradeLimiter, async (req, res) => { await executeTrade(req.body) })
```

10. **Logging Sensitive Data（MEDIUM）**
```javascript
// ❌ 日志打 password / apiKey
console.log('User login:', { email, password, apiKey })
// ✅ 净化后再打
console.log('User login:', { email: mask(email), passwordProvided: !!password })
```

### 1.4 常见误报（核查前先排除，防猜测式指控）

并非每条命中都是漏洞，先验上下文：

- `.env.example` 里的环境变量（不是真 secret）
- 测试文件里明确标注的测试凭据
- 确实设计为公开的 public API key
- 用于校验和的 SHA256 / MD5（不是密码哈希）

### 1.5 可选 example（领域专项，按项目裁剪——非通用维度）

> 以下为某资金类平台的写死示例，**已降级为可选 example**——caller 审到对应栈才参考，否则跳过。不属于通用 OWASP 维度。

<details>
<summary>资金 / 区块链 / 特定栈专项核查（可选）</summary>

- **资金安全**：交易原子化、提现/交易前余额检查、资金端点限流、资金流动审计日志、复式记账校验、交易签名校验、禁用浮点做金额。
- **Solana / 区块链**：钱包签名校验、指令发送前校验、私钥不落日志/不存储、RPC 限流、滑点保护、MEV 保护、恶意指令检测。
- **认证（如 Privy）**：每请求校验 JWT、session 管理安全、无认证绕过路径、钱包签名校验、认证端点限流。
- **数据库（如 Supabase）**：所有表开 RLS、客户端不直连库、仅参数化查询、日志无 PII、备份加密、凭据定期轮换。
- **检索（如 Redis + OpenAI）**：Redis 连接走 TLS、OpenAI key 仅服务端、查询净化、不向第三方发 PII、检索端点限流、Redis AUTH。

</details>

---

## 二、输出契约

产出 `findings[]`，映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- 每条 finding：`axis` = OWASP 项或漏洞模式名（`Injection` / `Broken Access Control` / `SSRF`……）；`location` = `file:line`；`evidence` = 漏洞代码摘录 + 攻击向量（构造什么输入/请求触发）；`fix` = 缓解（Structural Remedy 优先：参数化查询消除整类注入，胜过单点转义）。
- **security 4档 → 统一 C/W/S 的关键约束**（findings-contract §4 约束①）：security 的 **High 上提 Critical**（High = "Fix Before Production" 语义近阻塞），4→3 压缩**上提不下沉**——`Critical + High → critical`，`Medium → warning`，`Low → suggestion`。绝不把 High 下沉成 warning（会让上线前必修的安全问题被当可选修）。
- 受 **Evidence Gate** 约束：安全 critical 必须有 `location` + 攻击向量/PoC，否则降 `kind=open-question`（无证据的安全指控易误报，让作者去核而非阻塞）。
- `verdict`：有未缓解 critical → `approved=false`；安全硬伤必修才放行（recommendation 给「N Critical 必修后可合并」式拍板建议）。

---

## 三、派发策略

| 模式 | 派 subagent | 调 codex | 说明 |
|---|---|---|---|
| **自评清单**（低风险 / 纯内部逻辑） | 否 | 否 | 主 agent 直接套 OWASP + 漏洞模式逐项核查，但仍标信任边界确认「确实无外部面」 |
| **异源交叉**（推荐，安全默认重档） | **是** | **是** | 外部输入/认证/敏感数据 → 重档：subagent + codex 独立跑 OWASP/漏洞模式，**CLAIM 剥离**（只传 diff + 维度清单，不传已发现的漏洞结论），异源更易发现单模型盲区 |

档位：安全（外部输入 / 认证 / 敏感数据 / 资金）默认 **重档 + 异源**（独立性档 = 异源，§4.3）。codex 不可用 → 单 subagent + 明说降级，独立性声明标「同模型（降级）」。配 `threat-modeling` 用：threat-modeling 出威胁 → 本卡 OWASP 兜底逐项核查。
