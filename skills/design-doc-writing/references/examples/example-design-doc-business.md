---
type: design-doc
topic: ContextCo 企业 SSO + MFA 实施详细设计
date: 260401
author: eng-david
status: approved
last_updated: 260401
---

# Design Doc：ContextCo 企业 SSO + MFA 实施

> 业务场景 example。承接 PRD（260301）+ RFC-014（260315）已定方向——SAML 2.0 通过 WorkOS、本地 session、TOTP MFA、旧用户自愿绑定——本 doc 落到实施详细设计。演示完整 design-doc 骨架，**不要照搬这里的供应商 / 模块名 / SLA 数字 / Java/Spring 技术栈**，按你公司情况替换。

## 背景

**核心问题**：RFC-014 已定方向（SAML 2.0 + WorkOS + 本地 session），但**实施层多个关键问题未定**——WorkOS 集成放哪一层、用户绑定流程怎么设计、session token 格式选哪种、TOTP 备份恢复怎么做、WorkOS 宕机如何 fallback。这些问题任一选错都会导致 Q3 deadline miss 或后期返工。

**附带问题**（本 doc 一并解，但不是 driver）：

- 跨认证事件（登录成功 / 失败 / MFA 失败 / IdP 错误）目前散落各 service，安全审计要求集中式 audit log——本 doc 顺手解决
- 现有 `users` 表 schema 已固化，不能 breaking change——本 doc 设计要兼容

不解决的代价：Q3 实施 freeze 时多个团队各自补丁式实现 → schema 互不兼容 → Q4 整合代价数倍。

## 目标

- **协议覆盖**：SAML 2.0 完整支持（XML 签名校验、SLO、Just-In-Time provisioning），通过 WorkOS SDK
- **MFA 强制策略可配置**：admin 角色强制，普通用户可选，企业 admin 可全员开启
- **性能**：SSO 登录链路 99 percentile ≤ 3 秒（含 IdP redirect 往返）；MFA 校验 99 percentile ≤ 200 ms
- **可用性**：WorkOS 宕机时邮箱密码 fallback 仍可用；已登录 session 不受 WorkOS 状态影响
- **数据兼容**：现有 `users` 表零修改；新增 `user_identities` 表承载多 IdP 身份关系
- **审计完整**：所有认证事件集中写 `auth_events` 表，保留 1 年

## 架构

### 架构图

```
┌──────────────┐   redirect    ┌─────────────────────┐
│   Browser    │ ◄──────────►  │   IdP (Okta /       │
└──────┬───────┘  SAML AuthN   │   Azure AD / ...)   │
       │                       └─────────────────────┘
       │ POST /sso/callback
       │ (SAML Response)
       ▼
┌──────────────────────────────────────────────────┐
│  auth-service  (NEW)                             │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ SAML       │  │ Session     │  │ MFA       │  │
│  │ Handler    │  │ Manager     │  │ Verifier  │  │
│  │ (WorkOS    │  │ (JWT +      │  │ (TOTP)    │  │
│  │  SDK)      │  │  Redis BL)  │  │           │  │
│  └─────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│        │                │                │        │
└────────┼────────────────┼────────────────┼────────┘
         ▼                ▼                ▼
   ┌─────────────────────────────────────────────┐
   │  PostgreSQL: users / user_identities /      │
   │              mfa_secrets / auth_events      │
   └─────────────────────────────────────────────┘
                          │
                          ▼ (read)
   ┌─────────────────────────────────────────────┐
   │  Other backend services (订单 / 数据 / 报表)│
   │  通过 JWT 信任 auth-service 签名            │
   └─────────────────────────────────────────────┘
```

`auth-service` 是新增微服务，承担所有认证 / MFA / session 生成职责，下游服务通过验证 JWT 信任。

### 流程图

SSO + MFA 完整登录链路：

```
用户点登录
   ↓
输入邮箱 bob@acme.com
   ↓
auth-service 查 acme.com 是否绑定企业（user_identities + organizations）
   ├─ 已绑定 SSO ──► redirect 到 IdP（带 SAML AuthnRequest）
   │                       ↓
   │                  IdP 验证用户身份（用户已 Okta 登录）
   │                       ↓
   │                  POST /sso/callback (SAML Response)
   │                       ↓
   │                  SAML Handler 校验签名 + 解析 user
   │                       ↓
   │                  查 user_identities 找/建本地 user
   │                       ↓
   │                  判 user 是否 admin
   │                       ├─ 是 ──► 弹 MFA TOTP 输入
   │                       │           ↓
   │                       │       MFA Verifier 校验 6 位码
   │                       │           ↓
   │                       │       通过 → 签 JWT
   │                       └─ 否 ──► 直接签 JWT
   │                                   ↓
   │                              写 auth_events（success）
   │                                   ↓
   │                              redirect 用户原页面
   │
   └─ 未绑定 SSO ──► 走传统邮箱密码登录（不变）
```

### 问题拆解

#### 问题一：WorkOS SDK 集成放在哪一层？

**说明**

WorkOS 提供 Node.js / Python / Go SDK。ContextCo 现有 Spring Boot 单体 + 部分微服务。SAML 处理放在哪一层影响后续 scaling 模型与故障 blast radius。

**方案对比**

- **方案 A：嵌入 monolith 内**
  - 优点：实施最快，无新部署单元
  - 否决：monolith 已 200K+ LOC，加 SSO 增大 deploy 单元；WorkOS SDK 升级 = 整 monolith 回滚

- **方案 B：API Gateway 中间件层**
  - 优点：所有流量都经过，自然拦截
  - 否决：Gateway 是无状态层，要查 user_identities 表 + 写 auth_events 表，破坏无状态特性

- **方案 C：独立 auth-service 微服务**（**选定**）
  - 优点：独立 deploy / scale / 回滚；故障 blast radius 限定（auth-service 宕机时已登录用户的下游 service 不受影响——下游只验 JWT 签名）；WorkOS SDK 隔离在单 service
  - 否决：无

**结论**：方案 C。auth-service 独立部署，Spring Boot，2 个实例 + LB。

#### 问题二：user_identities 表 schema 与绑定冲突处理

**说明**

需要承载"一个 ContextCo user 对应多个 IdP 身份"（同一用户可能既绑了 Acme Corp 的 Okta，又有 free tier 邮箱密码 fallback）。schema 要兼顾查询效率与冲突可发现。

**方案对比**

- **方案 A：把 idp_provider + external_id 加到 users 表**
  - 优点：表少
  - 否决：违反单一身份原则；一个 user 只能绑一个 IdP；breaking change `users` 表

- **方案 B：独立 `user_identities` 表**（**选定**）
  - 列：`id, user_id, idp_provider, external_id, organization_id, created_at, last_used_at, status`
  - 唯一索引：`(idp_provider, external_id)`——防同一 IdP 身份绑到多个 user
  - 唯一索引：`(user_id, idp_provider, organization_id)`——同一 user 在同一企业 IdP 下只能有一条
  - 优点：clean、查询索引清晰、`users` 表零改动；冲突由 UNIQUE 在 DB 层兜底

- **方案 C：JSON 字段挂 users 表**
  - 优点：schema 简单
  - 否决：DB 层无法保证唯一性约束；查询性能差

**结论**：方案 B——独立表 + 双 UNIQUE 索引。绑定冲突由 DB UNIQUE violation 触发，应用层捕获返 409。

#### 问题三：session token 选 JWT 还是 opaque + Redis？SLO 失效怎么 propagate？

**说明**

session token 格式决定下游 service 验证开销与 SLO 失效广播路径。两种方案 trade-off 不同。

**方案对比**

- **方案 A：纯 opaque token + Redis lookup**
  - 优点：失效立即生效（删 Redis 即可）
  - 否决：每个下游请求都要回查 Redis = 高 QPS 压力；下游 service 强耦合 Redis；99p 延迟会受 Redis 抖动影响

- **方案 B：JWT + Redis blocklist**（**选定**）
  - JWT 含 user_id + roles + exp（8h），auth-service RSA 签名；下游只校验签名 + 查 Redis blocklist
  - SLO 收到 logout：把 JWT jti 加入 Redis blocklist，TTL 设为剩余 exp
  - 优点：下游 99% 请求只校验签名 + 一次 O(1) Redis lookup；blocklist 容量小（仅未到期的失效 token）
  - 否决：无

- **方案 C：JWT 无 blocklist**
  - 优点：完全无状态
  - 否决：SLO 失效 = 等 JWT 自然过期最多 8h，违反零信任 + SOC2 finding

**结论**：方案 B——JWT 主路径 + Redis blocklist 兜 SLO 失效。

#### 问题四：MFA TOTP 备份与恢复

**说明**

TOTP 依赖用户设备上的 Authenticator app（Authy / 1Password）。设备丢失 / 重装时如何恢复，否则用户被永久锁定。

**方案对比**

- **方案 A：纯 TOTP，丢失走 admin 人工恢复**
  - 优点：实现最简单
  - 否决：admin 工单量大；客户体验差

- **方案 B：TOTP + 一次性备份码**（**选定**）
  - enrollment 时生成 10 个一次性备份码（hashed 存储），让用户保存
  - 设备丢失时用备份码登录 + 重新 enrollment
  - 优点：自助恢复；备份码 hashed 存储（与密码同 bcrypt cost），泄漏不可逆
  - 否决：无

- **方案 C：TOTP + SMS / Email 后备因子**
  - 优点：用户体验好
  - 否决理由：见 ADR-007——SMS 不抗钓鱼 + SIM swap 风险，违反合规

**结论**：方案 B——10 个一次性备份码，hashed 存储。

#### 问题五：WorkOS 宕机 fallback

**说明**

WorkOS 是单点。一旦宕机所有 SSO 登录中断——但 PRD 验收要求"宕机期间已登录用户不受影响"+ "邮箱密码 fallback 仍可用"。

**方案对比**

- **方案 A：被动 fallback**——SSO 请求失败时 UI 提示用户走邮箱密码
  - 优点：实现最简单
  - 否决理由：用户已登录企业 Okta，回头让他想起 ContextCo 邮箱密码体验糟；且企业接入 SSO 后用户根本不知道自己邮箱密码

- **方案 B：健康检查 + 主动降级**（**选定**）
  - auth-service 每 10 秒探 WorkOS health endpoint
  - 连续 3 次失败 → 标记 WorkOS DOWN → 登录页 banner 显示"SSO 暂不可用，请用密码登录"+ admin 用户走密码登录后**仍要 MFA**（绕过 SSO 但保留 MFA 这一层）
  - 已登录用户 JWT 仍有效，下游 service 不受影响
  - 优点：用户预期清晰；admin 仍保 MFA；已登录 unaffected
  - 否决：无

- **方案 C：多 SSO provider 热备**
  - 优点：彻底解
  - 否决理由：成本 + 复杂度 > 业务价值；WorkOS 自身 SLA 99.99%，年宕机 < 1h，加热备非常不划算

**结论**：方案 B——10s 健康检查 + 主动降级 banner，admin 仍走 MFA。

### 架构总结

基于问题 1-5 的结论：新增独立 `auth-service` 微服务承载 WorkOS SAML / session / MFA 三块；`user_identities` 独立表 + 双 UNIQUE 兜底；JWT (8h, RSA) + Redis blocklist 解 SLO 失效广播；MFA TOTP + 10 个 hashed 备份码自助恢复；WorkOS 健康检查 10s 主动降级 banner。下面按这 5 个问题逐一展开实现。

## 实现

### 影响文件

```
auth-service/                                              ← NEW 微服务
└── src/main/java/com/contextco/auth/
    ├── saml/
    │   ├── SamlHandler.java                  (NEW)  ① 处理 /sso/init redirect
    │   │                                            ② 处理 /sso/callback SAML Response 校验
    │   │                                            ③ Just-In-Time provisioning
    │   ├── WorkOsClient.java                 (NEW)  WorkOS Java SDK wrapper（重试 + 超时）
    │   └── SloHandler.java                   (NEW)  接 WorkOS SLO webhook，加 JWT jti 进 blocklist
    ├── session/
    │   ├── JwtIssuer.java                    (NEW)  RSA 签 JWT，8h exp，含 user_id + roles + jti
    │   ├── JwtValidator.java                 (NEW)  签名校验 + Redis blocklist 查询
    │   └── RedisBlocklist.java               (NEW)  blocklist API，TTL=剩余 exp
    ├── mfa/
    │   ├── TotpService.java                  (NEW)  ① enrollment 生成 secret + QR
    │   │                                            ② verify 6 位码（含 ±1 时间窗容差）
    │   │                                            ③ 备份码生成 / 验证 / 失效
    │   └── BackupCodeStore.java              (NEW)  bcrypt 存 10 个备份码
    ├── fallback/
    │   └── WorkOsHealthChecker.java          (NEW)  10s 间隔探活，3 次失败 → DOWN
    └── audit/
        └── AuthEventLogger.java              (NEW)  集中写 auth_events 表

db/migrations/                                             ← NEW migration
└── V2026_04_01__sso_mfa_schema.sql           (NEW)  ① CREATE TABLE user_identities
                                                     ② CREATE TABLE mfa_secrets
                                                     ③ CREATE TABLE auth_events
                                                     ④ users 表不动

api-gateway/                                               ← 改
└── src/main/java/com/contextco/gateway/
    └── JwtAuthFilter.java                    (改)  调用 auth-service 的 JwtValidator
                                                    （之前是 monolith 内部的 SessionFilter）

monolith/                                                  ← 改
└── src/main/java/com/contextco/web/
    ├── LoginController.java                  (改)  ① 邮箱密码 fallback 路径保留
                                                    ② 登录页 banner（WorkOS DOWN 时显示）
    └── SessionFilter.java                    (删)  迁移到 api-gateway/JwtAuthFilter
```

### 逻辑一：WorkOS SAML 集成（auth-service.saml）

**业务流**

```
function handleSsoCallback(samlResponse, relayState):  // POST /sso/callback，IdP 跳回
    try:
        workosResponse = WorkOsClient.parseProfile(samlResponse)  // SDK 校验 XML 签名 + 解析 user profile
                                                                  // 失败抛 SamlValidationException
        identity = userIdentitiesRepo.findOrCreate(                // 查 user_identities 表
            idpProvider=workosResponse.connection,                 // 用 idp_provider + external_id 组合键
            externalId=workosResponse.idpId,
            email=workosResponse.email                             // 首次登录用 email 找已有 user 提示绑定
        )
        if identity.needsBinding:                                  // 旧用户首次走 SSO
            return redirectToBindingPrompt(identity.tempToken)     // 跳"绑定到现有账号"对话框
        user = identity.user                                       // 已绑定，拿到本地 user
        if user.requiresMfa():                                     // admin 角色要求 MFA
            return redirectToMfaChallenge(user.id, relayState)     // 跳 TOTP 输入页
        jwt = JwtIssuer.issue(user)                                // 签 JWT，8h exp
        AuthEventLogger.success(user, "sso_login")                 // 审计
        return redirect(relayState ?: "/dashboard", setCookie(jwt))
    catch SamlValidationException as e:                            // XML 签名错 / metadata 不匹配 / replay
        AuthEventLogger.failure(null, "saml_validation", e.reason)
        return errorPage("SSO 验证失败，请联系企业 IT 管理员", code=401)
    catch WorkOsUnavailableException as e:                         // WorkOS SDK 抛 5xx / 超时
        AuthEventLogger.failure(null, "workos_down", e.reason)
        return redirect("/login?fallback=true")                    // 走密码 fallback 路径
```

**关键契约**

```java
class SamlHandler {
    Response handleSsoInit(String organizationId, String relayState);
    Response handleSsoCallback(String samlResponse, String relayState);
}

class WorkOsClient {
    ParsedProfile parseProfile(String samlResponse) throws SamlValidationException, WorkOsUnavailableException;
}
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| XML 签名校验失败 | IdP 配置错 / 中间人篡改 | 返 401 错误页 + 审计 | 吞 |
| SAML Response replay | 攻击者重放旧 Response | WorkOS SDK 自带 InResponseTo + 时间窗校验，自动拒 | 吞 |
| WorkOS 5xx / 超时 | WorkOS 故障 | 跳 fallback `/login?fallback=true` | 吞 |
| user_identities UNIQUE 冲突 | 同一 external_id 绑到不同 user（理论不该发生） | 返 409 + 告警 | 上抛到全局 handler |

### 逻辑二：用户绑定流程（user_identities）

**业务流**

```
function bindToExistingAccount(tempToken, password):  // 旧用户走 SSO 后选"绑定到现有账号"
    pending = bindingTokenStore.consume(tempToken)    // tempToken 5 min TTL，一次性
    if pending == null:                                // token 过期或重放
        throw BindingTokenExpiredException()
    existingUser = usersRepo.authenticate(             // 用旧邮箱密码验证身份
        email=pending.email,                           // 防止有人拿 tempToken 绑到别人账号
        password=password                              // 必须知道旧密码才能绑定
    )
    if existingUser == null:                           // 密码错
        AuthEventLogger.failure(pending.email, "binding_wrong_password")
        throw InvalidCredentialsException()
    try:
        userIdentitiesRepo.insert(                     // 创建绑定，DB UNIQUE 兜底冲突
            userId=existingUser.id,
            idpProvider=pending.idpProvider,
            externalId=pending.externalId,
            organizationId=pending.organizationId
        )
    catch UniqueViolationException as e:               // 同 IdP external_id 已绑到别人
        AuthEventLogger.failure(existingUser, "binding_conflict")
        throw IdentityAlreadyBoundException()          // 返 409 + 邮件告知 admin
    AuthEventLogger.success(existingUser, "identity_bound")
    sendConfirmationEmail(existingUser, 24h_rollback_link)  // 24h 内可邮件回滚（防误绑）
    return issueJwtAndRedirect(existingUser)
```

**关键契约**

```sql
CREATE TABLE user_identities (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    idp_provider VARCHAR(64) NOT NULL,              -- "workos:okta" / "workos:azure_ad" 等
    external_id  VARCHAR(255) NOT NULL,             -- IdP 给的稳定 user id
    organization_id BIGINT REFERENCES organizations(id),
    status       VARCHAR(32) NOT NULL DEFAULT 'active',  -- active | revoked
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    UNIQUE (idp_provider, external_id),             -- 防一个 IdP 身份绑到多 user
    UNIQUE (user_id, idp_provider, organization_id) -- 防同 user 在同企业重复绑
);
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| 旧密码错 | 钓鱼或用户记错 | 计入失败计数（5 次锁 30 min） | 上抛 401 |
| 绑定冲突（external_id 已用） | 同名邮箱归不同人 | 返 409 + 通知企业 admin | 上抛 409 |
| tempToken 过期 | 用户绑定时停了 > 5 min | 让用户重新走 SSO | 上抛 410 |
| 误绑 24h 内 | 用户邮件中点回滚 | 删 user_identities 行 + 邮件确认 | （独立 endpoint） |

### 逻辑三：JWT + Redis Blocklist session 管理

**业务流**

```
function issueJwt(user):                              // SSO 或密码登录通过后调
    jti = generateUuid()                              // 唯一 jti 用于 SLO 失效
    payload = {                                       // JWT claims
        sub: user.id,                                 // user 主键
        roles: user.roles,                            // ["admin"] 等
        jti: jti,
        iat: now(),
        exp: now() + 8h                               // 8h TTL，来源：PRD 用户场景三"安全 + 不至于每天烦"
    }
    return RS256.sign(payload, privateKey)            // RSA 私钥签，下游用公钥校验

function validateJwt(token):                          // 下游 service 通过 JwtAuthFilter 调
    payload = RS256.verify(token, publicKey)          // 签名 + exp 校验，失败抛
    if RedisBlocklist.contains(payload.jti):          // 查 blocklist，命中说明已被 SLO 撤销
        throw TokenRevokedException()
    return payload                                    // 通过，下游拿 user_id + roles

function onSloWebhook(jti, remainingExpSec):          // WorkOS SLO 触发或 admin 撤销时调
    RedisBlocklist.add(jti, ttl=remainingExpSec)      // TTL 设为剩余 exp，过期自动清
    AuthEventLogger.success(jti, "token_revoked")
```

**关键契约**

```java
class JwtIssuer {
    String issue(User user);              // 8h exp 写死，roles 来自 user.roles
}
class JwtValidator {
    Payload validate(String token);       // 签名 + exp + blocklist 三道，任一失败抛
}
class RedisBlocklist {
    void add(String jti, long ttlSec);
    boolean contains(String jti);
}
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| JWT 签名错 | 攻击者篡改 | 返 401 + 审计 | 上抛 |
| JWT 过期 | 8h 到期 | 用户重新登录 | 上抛 401 |
| jti 在 blocklist | SLO / admin 撤销 | 返 401，前端引导重登 | 上抛 |
| Redis 不可用 | Redis 宕机 | **fail-open**（让请求通过 + 告警），来源：登录可用性优先于 SLO 即时性；最多 8h JWT 自然过期 | 吞 + 告警 |

### 逻辑四：MFA TOTP + 备份码

**业务流**

```
function enrollMfa(user):                             // admin 首次登录或主动开启 MFA 时调
    secret = generateBase32Secret(160bits)            // 160 bits 来源：RFC 6238 推荐最低 128 bits + 容差
    mfaSecretsRepo.upsert(user.id, encrypt(secret))   // KMS 加密存
    qrUrl = otpauth("ContextCo", user.email, secret)  // 生成 QR 给用户扫
    backupCodes = generate10Codes(10 digits each)     // 10 个一次性备份码
    BackupCodeStore.saveAll(                          // bcrypt cost=12 hash 存
        user.id,
        backupCodes.map(c => bcrypt.hash(c, cost=12))
    )
    return (qrUrl, backupCodes)                       // backupCodes 仅本次返回，之后用户自存

function verifyTotp(user, code):                      // 登录第二步调
    secret = decrypt(mfaSecretsRepo.find(user.id))    // KMS 解密
    expected = totp(secret, time=now(), step=30s)     // 30s 时间步 + ±1 容差
    if code in [totp(secret, now()-30s), expected, totp(secret, now()+30s)]:
        AuthEventLogger.success(user, "mfa_totp")
        return true
    if BackupCodeStore.consumeIfMatch(user.id, code): // 不命中 TOTP 时尝试备份码（一次性消费）
        AuthEventLogger.success(user, "mfa_backup_code")
        if BackupCodeStore.remainingCount(user.id) <= 2:
            notifyUserLowBackup(user)                 // 剩 ≤ 2 个时邮件提示重新生成
        return true
    AuthEventLogger.failure(user, "mfa_wrong_code")
    incrementFailCounter(user.id)                     // 5 次失败锁 30 min
    return false
```

**关键契约**

```java
class TotpService {
    EnrollmentResult enroll(User user);  // 返回 (qrUrl, backupCodes)
    boolean verify(User user, String code);
    void regenerateBackupCodes(User user);  // 用户主动重生成时调
}
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| 时钟漂移 ±30s | 用户手机时间不准 | ±1 时间窗容差自动覆盖（30s 步） | 透明 |
| 设备丢失 | 用户重置手机 | 用备份码登录 + regenerate | 透明 |
| 备份码用完 | 10 个全消费 | 拒绝登录 + 邮件指引联系企业 admin 重置 | 上抛 403 |
| 5 次失败 | 暴力尝试 | 账号 MFA 锁 30 min + 邮件告警 user | 上抛 423 |

### 逻辑五：WorkOS 健康检查 + 主动降级

**业务流**

```
function checkWorkOsHealth():                         // ScheduledExecutor 每 10s 跑
    try:
        response = httpGet(WORKOS_HEALTH_URL, timeout=3s)
        if response.status == 200:
            consecutiveFailures.set(0)
            if globalState.workosDown:                // 之前 DOWN 现在恢复
                globalState.workosDown = false
                AuthEventLogger.success(null, "workos_recovered")
        else:
            recordFailure()
    catch (IOException | TimeoutException) as e:
        recordFailure()

function recordFailure():
    n = consecutiveFailures.incrementAndGet()
    if n >= 3 and not globalState.workosDown:         // 连续 3 次失败 → DOWN
        globalState.workosDown = true                 // 来源：3 次 × 10s = 30s 容忍窗口，平衡敏感度与误报
        AuthEventLogger.failure(null, "workos_down")
        notifyOncall()

function decideLoginPath(emailDomain):                // 登录页加载时调
    org = organizationsRepo.findByDomain(emailDomain)
    if org == null or not org.ssoEnabled:
        return PATH_PASSWORD                          // 个人邮箱走密码
    if globalState.workosDown:
        return PATH_PASSWORD_WITH_BANNER              // SSO 暂不可用 banner + 密码登录
    return PATH_SSO                                   // 正常走 SSO
```

**关键契约**

```java
class WorkOsHealthChecker {
    boolean isWorkOsDown();   // 全局状态，所有登录请求查询
}
class GlobalState {
    volatile boolean workosDown;
}
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| WorkOS 短暂抖动 | 单次 timeout | 不立刻 DOWN（要连续 3 次） | 吞 |
| 连续 3 次失败 | WorkOS 真宕 | DOWN + banner + oncall 告警 | 吞（状态变更） |
| 误报后恢复 | WorkOS 抖动后回稳 | 下次成功即清 DOWN 状态 + 审计恢复事件 | 吞 |

### 逻辑六：集中式 auth_events 审计（细节性）

> 本逻辑未在架构.问题拆解中独立讨论——它是跨逻辑一至五**共享的横切能力**，属于实施层细节，单独成节避免在每条业务流里重复描述。

**业务流**

```
function logEvent(user, eventType, status, reason):   // 所有逻辑统一调
    auth_events.insert({
        user_id: user?.id,                            // 可能为 null（如 SAML 签名失败时还没确认 user）
        event_type: eventType,                        // "sso_login" / "mfa_totp" / "binding_conflict" 等
        status: status,                               // "success" | "failure"
        reason: reason,                               // 失败时的具体原因（不含敏感数据）
        ip: requestContext.ip,                        // 留给安全团队溯源
        user_agent: requestContext.userAgent,
        created_at: now()
    })
```

**关键契约**

```sql
CREATE TABLE auth_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),          -- 可空
    event_type  VARCHAR(64) NOT NULL,
    status      VARCHAR(16) NOT NULL,                 -- success | failure
    reason      TEXT,                                 -- 失败原因
    ip          INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_events_user_time ON auth_events(user_id, created_at DESC);
CREATE INDEX idx_auth_events_type_time ON auth_events(event_type, created_at DESC);
-- 保留期 1 年，partition by month
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| DB 写失败 | PostgreSQL 暂不可用 | 异步写 + 本地 fallback 文件队列，恢复后回灌 | 吞（绝不阻塞登录） |
| 日志注入风险 | 用户 email 含特殊字符 | reason 字段不存原始输入，仅枚举常量 | 透明 |
