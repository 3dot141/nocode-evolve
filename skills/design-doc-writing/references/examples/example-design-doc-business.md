---
type: design-doc
topic: ContextCo 企业 SSO + MFA 实施详细设计
date: 260401
author: eng-david
status: approved
last_updated: 260401
---

# Design Doc：ContextCo 企业 SSO + MFA 实施

> 业务场景 example。承接 PRD（260301）+ RFC-014（260315）已定方向——SAML 2.0 通过 WorkOS、本地 session、TOTP MFA、旧用户自愿绑定——本 doc 落到实施详细设计。
>
> **注意措辞风格**：本示例刻意使用「主要痛点 / 衍生需求 / 拖延的代价 / 张力 / 取舍」这套**业务化连接词**，替代其他 example 里的「核心问题 / 附带问题 / 不决定的代价 / 力的对抗」。两套都对，按你的领域语境选——结构对就行。

## 背景

**主要痛点**：RFC-014 已定方向，但**实施层关键问题未定**——WorkOS SDK 放哪一层、用户绑定如何防误绑、session token 格式怎么选、TOTP 备份恢复怎么做。任一选错都会导致 Q3 deadline miss 或后期返工。

**衍生需求**（本 doc 一并解）：

- 跨认证事件目前散落各 service，安全审计要求集中式 audit log
- 现有 `users` 表已固化，不能 breaking change

**拖延的代价**：Q3 实施 freeze 时多个团队各自补丁式实现 → schema 互不兼容 → Q4 整合代价数倍。

## 目标

- **协议覆盖**：SAML 2.0 完整支持（XML 签名校验、SLO、JIT provisioning），通过 WorkOS SDK
- **MFA 策略**：admin 角色强制，普通用户可选，企业 admin 可全员开启
- **性能**：SSO 登录 99p ≤ 3 秒（含 IdP 回跳）；MFA 校验 99p ≤ 200 ms
- **可用性**：WorkOS 宕机时邮箱密码 fallback 仍可用；已登录 session 不受影响
- **数据兼容**：现有 `users` 表零修改；新增 `user_identities` 承载多 IdP 身份
- **审计完整**：所有认证事件写 `auth_events`，保留 1 年

## 架构

### 架构图

```
┌──────────────┐   redirect    ┌─────────────────────┐
│   Browser    │ ◄──────────►  │   IdP (Okta /       │
└──────┬───────┘  SAML AuthN   │   Azure AD / ...)   │
       │                       └─────────────────────┘
       │ POST /sso/callback
       ▼
┌──────────────────────────────────────────────────┐
│  auth-service  (NEW)                             │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ SAML       │  │ Session     │  │ MFA       │  │
│  │ Handler    │  │ Manager     │  │ Verifier  │  │
│  │ (WorkOS)   │  │ (JWT + BL)  │  │ (TOTP)    │  │
│  └─────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
└────────┼────────────────┼────────────────┼────────┘
         ▼                ▼                ▼
   ┌─────────────────────────────────────────────┐
   │  PostgreSQL: users / user_identities /      │
   │              mfa_secrets / auth_events      │
   └─────────────────────────────────────────────┘
                          │ JWT 信任
                          ▼
   ┌─────────────────────────────────────────────┐
   │  下游 services（订单/数据/报表）—— 只验签名  │
   └─────────────────────────────────────────────┘
```

`auth-service` 是新增微服务，承担所有认证 / MFA / session 生成；下游通过验证 JWT 信任。

### 流程图

```
用户输入邮箱 → 查 organizations 是否绑定 SSO
   ├─ 已绑定 ──► redirect IdP → SAML Response → 校验签名
   │                                            ↓
   │                          查 user_identities 找/建本地 user
   │                                            ↓
   │                          admin? ──是──► TOTP 输入 → 验证
   │                                            ↓        ↓
   │                                          签 JWT （否则直接签）
   │                                            ↓
   │                                       redirect 原页
   └─ 未绑定 ──► 走传统邮箱密码登录
```

### 问题拆解

#### 问题一：WorkOS SDK 集成放在哪一层？

**说明**

WorkOS 提供 Java SDK，可嵌入现有 Spring Boot monolith、放 API Gateway 中间件、或独立 auth-service。三种 trade-off 不同。

**方案对比**

- **方案 A：嵌入 monolith** —— 优点：实施快、无新部署单元；**否决**：monolith 已 200K+ LOC，加 SSO 拉大 deploy 单元；WorkOS SDK 升级 = monolith 整回滚

- **方案 B：API Gateway 中间件** —— 优点：所有流量自然经过；**否决**：Gateway 是无状态层，要查 user_identities + 写 auth_events 破坏无状态

- **方案 C：独立 auth-service**（**选定**） —— 优点：独立 deploy/scale/回滚；故障 blast radius 限定（auth-service 宕机时下游 service 不受影响——只验 JWT 签名）

**结论**：方案 C。auth-service 独立 Spring Boot，2 个实例 + LB。

#### 问题二：user_identities schema 与绑定冲突

**说明**

要承载"一个 ContextCo user 对应多个 IdP 身份"，schema 要兼顾查询效率与冲突可发现。

**方案对比**

- **方案 A：把 idp_provider + external_id 加到 users 表** —— **否决**：一个 user 只能绑一个 IdP，且 breaking `users` 表

- **方案 B：独立 `user_identities` 表 + 双 UNIQUE 索引**（**选定**） —— `UNIQUE (idp_provider, external_id)` 防一 IdP 身份绑多 user；`UNIQUE (user_id, idp_provider, organization_id)` 防同 user 在同企业重复绑

- **方案 C：JSON 字段挂 users 表** —— **否决**：DB 层无法保证唯一性；查询性能差

**结论**：方案 B——独立表 + 双 UNIQUE。冲突由 DB 层兜底，应用捕获返 409。

#### 问题三：session token 格式 + SLO 失效 + WorkOS 宕机 fallback

**说明**

三件事强耦合在 session 这一层：token 格式决定下游验证开销；SLO 失效决定能否实时撤销；WorkOS 宕机时已签 session 是否还应该有效。一起拍板避免冲突设计。

**方案对比**（token 格式）

- **方案 A：纯 opaque token + Redis lookup** —— **否决**：每下游请求回查 Redis = 高 QPS 压力；99p 受 Redis 抖动影响

- **方案 B：JWT (RSA, 8h) + Redis blocklist**（**选定**） —— 下游 99% 请求只验签名 + 1 次 O(1) Redis 查；blocklist 仅存未到期失效 jti，容量小

- **方案 C：JWT 无 blocklist** —— **否决**：SLO 失效要等 JWT 自然过期最多 8h，违反零信任 + SOC2 finding

**SLO 失效路径**：WorkOS webhook 收 SLO 通知 → 加 JWT jti 到 Redis blocklist（TTL = 剩余 exp）。

**WorkOS 宕机 fallback**：

- auth-service 每 10s 探 WorkOS health；连续 3 次失败 → 标记 DOWN
- DOWN 时登录页 banner 提示"SSO 暂不可用，请用密码"，admin 走密码登录后**仍要 TOTP**（绕过 SSO 但保留 MFA）
- 已签 JWT 仍有效，下游不受影响——这是把"主动降级"和"已登录 session 独立"两个张力同时解掉

**结论**：JWT (8h, RSA) 主路径 + Redis blocklist 兜 SLO + 10s 健康检查兜 WorkOS 宕机。

#### 问题四：MFA TOTP 备份恢复

**说明**

TOTP 依赖用户设备 Authenticator app。设备丢失要有自助恢复，否则用户永久锁定。

**方案对比**

- **方案 A：纯 TOTP，丢失走 admin 人工** —— **否决**：客服工单量大

- **方案 B：TOTP + 10 个一次性备份码**（**选定**） —— enrollment 时一次性生成，bcrypt cost=12 存储；设备丢失用备份码登录 + 重新 enrollment

- **方案 C：TOTP + SMS / Email 后备因子** —— **否决**：见 ADR-007，SMS 不抗钓鱼 + SIM swap 风险

**结论**：方案 B——10 个 hashed 备份码。

### 架构总结

基于问题 1-4 的取舍：独立 `auth-service` 承载 WorkOS SAML + session + MFA；`user_identities` 独立表 + 双 UNIQUE 兜底；JWT (8h) + Redis blocklist 解 SLO 即时失效；10s 健康检查 + banner 兜 WorkOS 宕机（admin 降级时保留 MFA）；TOTP + 10 个备份码自助恢复。下面按这 4 个问题逐一展开实现，外加 1 条横切的 audit 细节性逻辑。

## 实现

### 影响文件

```
auth-service/                                              ← NEW 微服务
└── src/main/java/com/contextco/auth/
    ├── saml/
    │   ├── SamlHandler.java                  (NEW)  ① /sso/init redirect
    │   │                                            ② /sso/callback SAML 校验 + JIT provisioning
    │   ├── WorkOsClient.java                 (NEW)  SDK wrapper（重试 + 超时）
    │   └── SloHandler.java                   (NEW)  接 SLO webhook，加 jti 进 blocklist
    ├── session/
    │   ├── JwtIssuer.java                    (NEW)  RS256 签 JWT，8h exp
    │   ├── JwtValidator.java                 (NEW)  签名 + blocklist 双校验
    │   ├── RedisBlocklist.java               (NEW)  TTL=剩余 exp
    │   └── WorkOsHealthChecker.java          (NEW)  10s 探活，3 次失败 → DOWN
    ├── mfa/
    │   ├── TotpService.java                  (NEW)  enrollment + verify + ±1 时间窗
    │   └── BackupCodeStore.java              (NEW)  bcrypt 存 10 个备份码
    └── audit/
        └── AuthEventLogger.java              (NEW)  集中写 auth_events 表

db/migrations/
└── V2026_04_01__sso_mfa_schema.sql           (NEW)  ① user_identities ② mfa_secrets ③ auth_events
                                                     ④ users 表不动

api-gateway/JwtAuthFilter.java                (改)   调 auth-service JwtValidator
monolith/web/LoginController.java             (改)   ① 邮箱密码 fallback 保留 ② DOWN banner
monolith/web/SessionFilter.java               (删)   迁移到 api-gateway/JwtAuthFilter
```

### 逻辑一：WorkOS SAML 集成（auth-service.saml）

**业务流**

```
function handleSsoCallback(samlResponse, relayState):  // POST /sso/callback，IdP 跳回
    try:
        profile = WorkOsClient.parseProfile(samlResponse)         // SDK 校验 XML 签名 + 解析
        identity = userIdentitiesRepo.findOrCreate(               // 查表，未绑定时返回 needsBinding=true
            profile.connection, profile.idpId, profile.email)
        if identity.needsBinding:                                 // 旧用户首次走 SSO
            return redirectToBindingPrompt(identity.tempToken)    // 跳"绑定到现有账号"
        if identity.user.requiresMfa():                           // admin 强制 MFA
            return redirectToMfaChallenge(identity.user.id, relayState)
        return issueJwtAndRedirect(identity.user, relayState)
    catch SamlValidationException:                                // 签名错 / metadata 不匹配 / replay
        AuthEventLogger.failure(null, "saml_validation")
        return errorPage("SSO 验证失败", 401)
    catch WorkOsUnavailableException:                             // SDK 5xx / 超时
        return redirect("/login?fallback=true")                   // 走密码路径
```

**关键契约**

```java
class SamlHandler {
    Response handleSsoInit(String orgId, String relayState);
    Response handleSsoCallback(String samlResponse, String relayState);
}
class WorkOsClient {
    ParsedProfile parseProfile(String samlResponse)
        throws SamlValidationException, WorkOsUnavailableException;
}
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| XML 签名失败 | IdP 配置错 / 中间人篡改 | 401 + 审计 | 吞 |
| Replay 攻击 | 重放旧 SAML Response | SDK 自带 InResponseTo + 时间窗，自动拒 | 吞 |
| WorkOS 5xx / 超时 | WorkOS 故障 | 跳 fallback | 吞 |
| user_identities UNIQUE 冲突 | 同 external_id 绑到不同 user（理论不应发生） | 409 + 告警 | 上抛 |

### 逻辑二：用户绑定流程（user_identities）

**业务流**

```
function bindToExistingAccount(tempToken, password):  // 旧用户走 SSO 后绑现有账号
    pending = bindingTokenStore.consume(tempToken)    // 5 min TTL，一次性
    if pending == null: throw BindingTokenExpired
    existingUser = usersRepo.authenticate(             // 用旧邮箱密码验证身份
        pending.email, password)                       // 防有人拿 tempToken 绑别人账号
    if existingUser == null:
        AuthEventLogger.failure(pending.email, "binding_wrong_password")
        throw InvalidCredentials
    try:
        userIdentitiesRepo.insert(existingUser.id, pending.idpProvider,
            pending.externalId, pending.organizationId)
    catch UniqueViolation:                             // 同 IdP external_id 已绑别人
        throw IdentityAlreadyBound                     // 409 + 邮件告知 admin
    sendConfirmationEmail(existingUser, 24h_rollback_link)  // 24h 内邮件可回滚（防误绑）
    return issueJwtAndRedirect(existingUser)
```

**关键契约**

```sql
CREATE TABLE user_identities (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    idp_provider    VARCHAR(64) NOT NULL,            -- "workos:okta" / "workos:azure_ad"
    external_id     VARCHAR(255) NOT NULL,           -- IdP 给的稳定 user id
    organization_id BIGINT REFERENCES organizations(id),
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    UNIQUE (idp_provider, external_id),
    UNIQUE (user_id, idp_provider, organization_id)
);
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| 旧密码错 | 钓鱼 / 用户记错 | 5 次失败锁 30 min | 401 |
| 绑定冲突 | 同名邮箱不同人 | 409 + 通知企业 admin | 409 |
| tempToken 过期 | 用户停顿 > 5 min | 让用户重新走 SSO | 410 |
| 误绑回滚 | 用户 24h 内点邮件链接 | 删 user_identities 行 | （独立 endpoint） |

### 逻辑三：JWT session + SLO 失效 + WorkOS 降级（合三个张力）

**业务流**

```
function issueJwt(user):
    jti = uuid()
    return RS256.sign({sub: user.id, roles: user.roles, jti: jti,
                       iat: now(), exp: now() + 8h}, privateKey)
    // 8h 来源：PRD 用户场景三"安全 + 不至于每天烦"取舍

function validateJwt(token):                          // 下游 JwtAuthFilter 调
    payload = RS256.verify(token, publicKey)          // 失败抛
    if RedisBlocklist.contains(payload.jti):          // SLO 撤销过
        throw TokenRevoked
    return payload

function onSloWebhook(jti, remainingExpSec):          // WorkOS SLO 触发
    RedisBlocklist.add(jti, ttl=remainingExpSec)      // TTL=剩余 exp 自动清

function checkWorkOsHealth():                         // ScheduledExecutor 10s
    if httpGet(WORKOS_HEALTH_URL, timeout=3s).ok:
        consecutiveFailures.set(0)
        if globalState.workosDown:
            globalState.workosDown = false            // 恢复
    else:
        if consecutiveFailures.incrementAndGet() >= 3:
            globalState.workosDown = true             // 3 次 × 10s = 30s 容忍窗口
            notifyOncall()                            // 30s 平衡敏感度 vs 误报

function decideLoginPath(emailDomain):                // 登录页加载时调
    org = organizationsRepo.findByDomain(emailDomain)
    if org == null or not org.ssoEnabled: return PATH_PASSWORD
    if globalState.workosDown: return PATH_PASSWORD_WITH_BANNER  // admin 走密码后仍要 MFA
    return PATH_SSO
```

**关键契约**

```java
class JwtIssuer        { String issue(User user); }
class JwtValidator     { Payload validate(String token); }
class RedisBlocklist   { void add(String jti, long ttlSec); boolean contains(String jti); }
class WorkOsHealthChecker { boolean isWorkOsDown(); }
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| JWT 签名错 | 篡改 | 401 + 审计 | 上抛 |
| JWT 过期 | 8h 到期 | 重登 | 401 |
| jti 在 blocklist | SLO / admin 撤销 | 401 引导重登 | 上抛 |
| Redis 不可用 | Redis 宕机 | **fail-open**——可用性优先于 SLO 即时性，最多 8h 自然过期 | 吞 + 告警 |
| WorkOS 抖动单次失败 | 网络抖动 | 不立刻 DOWN（要连续 3 次） | 吞 |
| WorkOS 连 3 次失败 | 真宕机 | DOWN + banner + oncall | 吞（状态变更） |

### 逻辑四：MFA TOTP + 备份码

**业务流**

```
function enrollMfa(user):                             // admin 首次或主动开启
    secret = generateBase32(160 bits)                 // RFC 6238 推荐 ≥ 128 bits
    mfaSecretsRepo.upsert(user.id, KMS.encrypt(secret))
    backupCodes = generate10Codes()                   // 10 个一次性
    BackupCodeStore.saveAll(user.id, backupCodes.map(c => bcrypt(c, 12)))
    return (otpauthQrUrl(user, secret), backupCodes)  // codes 仅本次返回

function verifyTotp(user, code):                      // 登录第二步
    secret = KMS.decrypt(mfaSecretsRepo.find(user.id))
    if code in [totp(secret, now()-30s),              // ±1 时间窗容差，覆盖手机时钟漂移
                totp(secret, now()),
                totp(secret, now()+30s)]:
        return true
    if BackupCodeStore.consumeIfMatch(user.id, code): // 不命中 TOTP 则尝试备份码
        if BackupCodeStore.remainingCount(user.id) <= 2:
            notifyUserLowBackup(user)                 // 剩 ≤ 2 个提示重生成
        return true
    incrementFailCounter(user.id)                     // 5 次失败锁 30 min
    return false
```

**关键契约**

```java
class TotpService {
    EnrollmentResult enroll(User user);
    boolean verify(User user, String code);
    void regenerateBackupCodes(User user);
}
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| 时钟漂移 ±30s | 手机时间不准 | ±1 时间窗自动覆盖 | 透明 |
| 设备丢失 | 用户换手机 | 备份码登录 + regenerate | 透明 |
| 备份码用完 | 10 个全消费 | 拒绝 + 邮件指引联系企业 admin | 403 |
| 5 次失败 | 暴力尝试 | MFA 锁 30 min + 告警 | 423 |

### 逻辑五：集中式 auth_events 审计（细节性）

> 本逻辑未在架构.问题拆解中独立讨论——它是跨逻辑一至四**共享的横切能力**，属于实施层细节，单独成节避免每条业务流里重复描述。

**业务流**

```
function logEvent(user, eventType, status, reason):   // 所有逻辑统一调
    auth_events.insertAsync({                          // 异步写，DB 抖动不阻塞登录
        user_id: user?.id,                            // 可空（SAML 签名失败时还没确认 user）
        event_type: eventType,                        // "sso_login" / "mfa_totp" / "binding_conflict"
        status, reason,                               // reason 仅枚举常量，防注入
        ip: ctx.ip, user_agent: ctx.userAgent,
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
    reason      TEXT,
    ip          INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_events_user_time ON auth_events(user_id, created_at DESC);
CREATE INDEX idx_auth_events_type_time ON auth_events(event_type, created_at DESC);
-- 保留 1 年，partition by month
```

**异常与失败模式**

| 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|
| DB 写失败 | PostgreSQL 暂不可用 | 异步 + 本地 fallback 文件队列 | 吞（绝不阻塞登录） |
| 日志注入 | user email 含特殊字符 | reason 仅枚举常量，不存原始输入 | 透明 |
