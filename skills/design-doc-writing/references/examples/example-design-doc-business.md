---
type: design-doc
topic: ContextCo 企业 SSO + MFA 实施详细设计
date: 260520
author: eng-david
status: approved
last_updated: 260520
---

# Design Doc: ContextCo 企业 SSO + MFA 实施

> 业务场景 example. 承接 PRD (260301) + RFC-014 (260315) 已定方向——SAML 2.0 通过 WorkOS、本地 session、TOTP MFA、旧用户自愿绑定——本 doc 落到实施详细设计.
>
> **注意措辞风格**: 本示例刻意使用「主要痛点 / 衍生需求 / 拖延的代价 / 张力 / 取舍」这套**业务化连接词**, 替代 dogfood example 里的「核心问题 / 附带问题 / 不决定的代价 / 力的对抗」. 两套都对, 按你的领域语境选——结构对就行.

## 背景

**主要痛点**: RFC-014 已定方向, 但**实施层关键决策未定**——WorkOS SDK 放哪一层、用户绑定如何防误绑、session token 格式怎么选、TOTP 备份恢复怎么做、WorkOS 宕机时怎么降级. 任一选错都会导致 Q3 deadline miss 或后期返工.

**衍生需求** (本 doc 一并解):

- 跨认证事件目前散落各 service, 安全审计要求集中式 audit log
- 现有 `users` 表已固化, 不能 breaking change

**拖延的代价**: Q3 实施 freeze 时多个团队各自补丁式实现 → schema 互不兼容 → Q4 整合代价数倍.

## 目标

- **协议覆盖**: SAML 2.0 完整支持 (XML 签名校验、SLO、JIT provisioning), 通过 WorkOS SDK
- **MFA 策略**: admin 角色强制, 普通用户可选, 企业 admin 可全员开启
- **性能**: SSO 登录 99p ≤ 3 秒 (含 IdP 回跳); MFA 校验 99p ≤ 200 ms
- **可用性**: WorkOS 宕机时邮箱密码 fallback 仍可用; 已登录 session 不受影响
- **数据兼容**: 现有 `users` 表零修改; 新增 `user_identities` 承载多 IdP 身份
- **审计完整**: 所有认证事件写 `auth_events`, 保留 1 年

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
   │  下游 services (订单/数据/报表) —— 只验签名  │
   └─────────────────────────────────────────────┘
```

### 流程图

```
用户输入邮箱 → 查 organizations 是否绑定 SSO
   ├─ 已绑定 ──► redirect IdP → SAML Response → 校验签名
   │                                            ↓
   │                          查 user_identities 找/建本地 user
   │                                            ↓
   │                          admin? ──是──► TOTP 输入 → 验证
   │                                            ↓        ↓
   │                                          签 JWT (否则直接签)
   │                                            ↓
   │                                       redirect 原页
   └─ 未绑定 ──► 走传统邮箱密码登录
```

### 时序图

SSO 登录主路径涉及 4 个角色异步交互, 纯文字描述容易丢顺序, 画时序图:

```
Browser    auth-service    WorkOS SDK    IdP(Okta)    PostgreSQL
   │             │              │            │             │
   │  GET /login │              │            │             │
   │────────────►│              │            │             │
   │ 302 redirect│  initSso()   │            │             │
   │◄────────────│─────────────►│            │             │
   │             │              │ SAML req   │             │
   │             │              │───────────►│             │
   │             │              │            │             │
   │  user auth (IdP login page, 浏览器直接走)              │
   │◄═══════════════════════════════════════►│             │
   │             │              │            │             │
   │ POST /sso/callback (SAML resp)          │             │
   │────────────►│              │            │             │
   │             │ parseProfile()            │             │
   │             │─────────────►│            │             │
   │             │ ParsedProfile│            │             │
   │             │◄─────────────│            │             │
   │             │   findOrCreate user_identity             │
   │             │──────────────────────────────────────────►│
   │             │   identity                                 │
   │             │◄──────────────────────────────────────────│
   │             │ ── 若 admin, redirect MFA challenge       │
   │             │ ── 否则: issueJwt + 302 redirect 原页     │
   │  302 (Set-Cookie: JWT)    │            │             │
   │◄────────────│              │            │             │
```

### 文本总结

整体架构: 独立 `auth-service` 微服务承载所有认证 (SAML + session + MFA), 通过 WorkOS SDK 屏蔽 SAML 协议细节. session 用 JWT (RS256, 8h) 主路径 + Redis blocklist 兜 SLO 即时失效. MFA 用 TOTP + 10 个一次性备份码. WorkOS 宕机时 10s 健康检查 + banner 降级到密码登录但仍要求 MFA. 数据层新增 `user_identities` / `mfa_secrets` / `auth_events` 三表, `users` 表零修改. 关键约束: 下游 service 只验 JWT 签名 + 1 次 O(1) Redis 查, 不依赖 auth-service 在线.

下一节按 5 条业务流展开 (BF1 SSO 回调 / BF2 用户绑定 / BF3 JWT 签发与校验 / BF4 MFA enrollment 与验证 / BF5 集中式 audit), 关键设计取舍归到「方案选型」节.

## 实现

### 影响

```
auth-service/                                              ← NEW 微服务
└── src/main/java/com/contextco/auth/
    ├── saml/
    │   ├── SamlHandler.java                  (NEW)  ① /sso/init redirect
    │   │                                            ② /sso/callback SAML 校验 + JIT provisioning
    │   ├── WorkOsClient.java                 (NEW)  SDK wrapper (重试 + 超时)
    │   └── SloHandler.java                   (NEW)  接 SLO webhook, 加 jti 进 blocklist
    ├── session/
    │   ├── JwtIssuer.java                    (NEW)  RS256 签 JWT, 8h exp
    │   ├── JwtValidator.java                 (NEW)  签名 + blocklist 双校验
    │   ├── RedisBlocklist.java               (NEW)  TTL=剩余 exp
    │   └── WorkOsHealthChecker.java          (NEW)  10s 探活, 3 次失败 → DOWN
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

### 接口设计

**对外 API** (前后台对接 + WorkOS 回调):

| Method | Path | Request | Response | 错误码 | 备注 |
|---|---|---|---|---|---|
| GET  | `/login`              | `?email=...` (query)                       | 200 HTML (banner 若 WorkOS DOWN)            | —                                          | LoginController.decideLoginPath, BF3 |
| GET  | `/sso/init`           | `orgId, relayState` (query)                | 302 → IdP SAML AuthN URL                    | 400 缺参数                                   | SamlHandler.handleSsoInit |
| POST | `/sso/callback`       | `SAMLResponse, RelayState` (form)          | 302 → 原页 (Set-Cookie JWT) / 302 MFA / 绑定 | 401 SAML 错 / 302 fallback                  | BF1 |
| POST | `/sso/bind`           | `{tempToken, password}` (JSON)             | 200 `{success: true}` + Set-Cookie JWT      | 401 密码错 / 409 已绑 / 410 token 过期       | BF2 |
| POST | `/mfa/enroll`         | (JWT cookie 鉴权)                          | 200 `{otpauthQrUrl, backupCodes: string[]}` | 401 未认证 / 409 已 enroll                   | BF4 |
| POST | `/mfa/verify`         | `{code}` (JWT cookie 鉴权)                 | 200 `{verified: true}` + new JWT            | 401 错码 / 423 锁 30 min                     | BF4 |
| POST | `/sso/slo-webhook`    | WorkOS HMAC 签名 + `{jti, remainingExpSec}` | 204                                         | 401 签名错                                   | WorkOS 推, 加 blocklist, BF3 |
| GET  | `/bind/rollback`      | `?token=...` (邮件链接, 24h TTL)          | 200 HTML "已回滚"                            | 410 链接过期                                 | BF2 误绑回滚 |

鉴权: 已登录走 `JWT` cookie (HttpOnly, Secure, SameSite=Strict); SLO webhook 用 WorkOS HMAC 签名头校验.

错误响应 envelope 统一: `{error: {code: string, message: string, traceId: string}}`.

完整 OpenAPI spec 在 `auth-service/openapi.yaml`, 本段只列骨架.

**数据模型** (DB schema + 表关联):

ER 图:

```
       users                              user_identities                       organizations
+------------------+                +------------------------+              +------------------+
| id (PK)          |◄───────────────┤ user_id (FK NOT NULL)  │              | id (PK)          |
| email UNIQUE     |       1:N      | idp_provider           │              | name             |
| password_hash    |                | external_id            │     N:1      | domain UNIQUE    |
| created_at       |                | organization_id (FK)   ├─────────────►| sso_enabled bool |
+------------------+                | status                 │              | created_at       |
       ▲ ▲ ▲                        | created_at             │              +------------------+
       │ │ │                        | last_used_at           │
       │ │ │                        +------------------------+
       │ │ │                        UNIQUE(idp_provider, external_id)
       │ │ │                        UNIQUE(user_id, idp_provider, organization_id)
       │ │ │
       │ │ │ 1:1
       │ │ └──►  mfa_secrets                          backup_codes
       │ │      +-----------------------------+      +------------------------------+
       │ │      | user_id (PK + FK)           |      | id (PK)                      |
       │ │      | encrypted_secret (KMS)      |      | user_id (FK NOT NULL)        |
       │ │      | algorithm "TOTP_SHA1"       |      | code_hash (bcrypt cost=12)   |
       │ │      | created_at                  |      | consumed_at (NULL = active)  |
       │ │      +-----------------------------+      | created_at                   |
       │ │              ▲                            +------------------------------+
       │ └──────1:N─────┘                                       ▲
       │                                                        │
       │                                                  1:N (per user, 10 codes)
       │
       │ 1:N           auth_events
       └──────────────►+------------------------------+
                       | id (PK)                      |
                       | user_id (FK, NULLABLE)       |  partition by month
                       | event_type                   |  (保留 1 年)
                       | status / reason              |
                       | ip / user_agent / created_at |
                       +------------------------------+
```

关键关系:

- `users` 1:N `user_identities` — 一个用户可绑多个 IdP 身份 (Okta + Azure AD 跨企业各算一条)
- `user_identities` N:1 `organizations` — 同一 user 在不同企业可有独立绑定; 双 UNIQUE 兜底防误绑 (见 Q2)
- `users` 1:1 `mfa_secrets` — 一个用户最多一个 TOTP secret; user_id 既是 PK 也是 FK
- `users` 1:N `backup_codes` — enrollment 时生成 10 条; partial index 仅索引 active (`WHERE consumed_at IS NULL`) 减小体积
- `users` 1:N `auth_events` — 审计日志; user_id 可空 (SAML 签名失败时还没确认 user)

DDL:

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

CREATE TABLE mfa_secrets (
    user_id            BIGINT PRIMARY KEY REFERENCES users(id),
    encrypted_secret   BYTEA NOT NULL,                -- KMS encrypted
    algorithm          VARCHAR(32) NOT NULL DEFAULT 'TOTP_SHA1',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE backup_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    code_hash   VARCHAR(255) NOT NULL,                -- bcrypt cost=12
    consumed_at TIMESTAMPTZ,                          -- NULL = active
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_backup_codes_user_active ON backup_codes(user_id) WHERE consumed_at IS NULL;

CREATE TABLE auth_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),          -- 可空 (SAML 签名失败时还没确认 user)
    event_type  VARCHAR(64) NOT NULL,
    status      VARCHAR(16) NOT NULL,                 -- success | failure
    reason      TEXT,
    ip          INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_events_user_time ON auth_events(user_id, created_at DESC);
CREATE INDEX idx_auth_events_type_time ON auth_events(event_type, created_at DESC);
-- partition by month, 保留 1 年
```

迁移: Flyway `V2026_04_01__sso_mfa_schema.sql` 单脚本, `users` 表零修改 100% 向后兼容; 回滚 `V2026_04_01.rollback.sql` 删 4 新表 (生产首次部署前确认).

**内部接口** (类签名 + 类图):

```java
class SamlHandler {
    Response handleSsoInit(String orgId, String relayState);
    Response handleSsoCallback(String samlResponse, String relayState);
}
class WorkOsClient {
    ParsedProfile parseProfile(String samlResponse)
        throws SamlValidationException, WorkOsUnavailableException;
}
class JwtIssuer        { String issue(User user); }
class JwtValidator     { Payload validate(String token); }
class RedisBlocklist   { void add(String jti, long ttlSec); boolean contains(String jti); }
class WorkOsHealthChecker { boolean isWorkOsDown(); }
class TotpService {
    EnrollmentResult enroll(User user);
    boolean verify(User user, String code);
    void regenerateBackupCodes(User user);
}
class AuthEventLogger {
    void logEvent(User user, String eventType, String status, String reason);
}
```

类图 (auth-service 多模块协作):

```
+-------------+   +-------------+   +-------------+
| SamlHandler |──►| JwtIssuer   |   | TotpService |
+-------------+   +-------------+   +-------------+
       │                 │                 │
       │                 ▼                 ▼
       │          +-------------+   +-----------------+
       │          | RedisBlock- |   | BackupCodeStore |
       │          | list        |   +-----------------+
       │          +-------------+
       │                 ▲
       ▼                 │
+-------------+          │
| WorkOsClient│   +---------------+
+-------------+   | JwtValidator  |◄── api-gateway
       │          +---------------+      (下游只信 JWT)
       ▼
+---------------+         共享:
| WorkOsHealth- |    +-------------------+
| Checker       |◄───| AuthEventLogger   |  所有上述类调
+---------------+    +-------------------+
```

### 业务流

**BF1 — SSO 回调 + JIT provisioning**

```
function SamlHandler.handleSsoCallback(samlResponse, relayState):  // POST /sso/callback, IdP 跳回
    try:
        profile = WorkOsClient.parseProfile(samlResponse)          // SDK 校验 XML 签名 + 解析
        identity = userIdentitiesRepo.findOrCreate(                // 查表, 未绑定时 needsBinding=true
            profile.connection, profile.idpId, profile.email)
        if identity.needsBinding:                                  // 旧用户首次走 SSO
            return redirectToBindingPrompt(identity.tempToken)     // 跳"绑定到现有账号"
        if identity.user.requiresMfa():                            // admin 强制 MFA
            return redirectToMfaChallenge(identity.user.id, relayState)
        return issueJwtAndRedirect(identity.user, relayState)
    catch SamlValidationException:                                 // 签名错 / metadata 不匹配 / replay
        AuthEventLogger.failure(null, "saml_validation")
        return errorPage("SSO 验证失败", 401)
    catch WorkOsUnavailableException:                              // SDK 5xx / 超时
        return redirect("/login?fallback=true")                    // 走密码路径
```

**BF2 — 旧用户绑定到 SSO**

```
function SamlHandler.bindToExistingAccount(tempToken, password):   // 旧用户走 SSO 后绑现有账号
    pending = bindingTokenStore.consume(tempToken)                 // 5 min TTL, 一次性
    if pending == null: throw BindingTokenExpired
    existingUser = usersRepo.authenticate(                         // 用旧邮箱密码验证身份
        pending.email, password)                                   // 防有人拿 tempToken 绑别人账号
    if existingUser == null:
        AuthEventLogger.failure(pending.email, "binding_wrong_password")
        throw InvalidCredentials
    try:
        userIdentitiesRepo.insert(existingUser.id, pending.idpProvider,
            pending.externalId, pending.organizationId)
    catch UniqueViolation:                                         // 同 IdP external_id 已绑别人
        throw IdentityAlreadyBound                                 // 409 + 邮件告知 admin
    sendConfirmationEmail(existingUser, 24h_rollback_link)         // 24h 内邮件可回滚 (防误绑)
    return issueJwtAndRedirect(existingUser)
```

**BF3 — JWT 签发 + 校验 + SLO 失效 + WorkOS 降级**

```
function JwtIssuer.issue(user):
    jti = uuid()
    return RS256.sign({sub: user.id, roles: user.roles, jti: jti,
                       iat: now(), exp: now() + 8h}, privateKey)
    // 8h 来源: PRD 用户场景三"安全 + 不至于每天烦"取舍

function JwtValidator.validate(token):                             // 下游 JwtAuthFilter 调
    payload = RS256.verify(token, publicKey)                       // 失败抛
    if RedisBlocklist.contains(payload.jti):                       // SLO 撤销过
        throw TokenRevoked
    return payload

function SloHandler.onSloWebhook(jti, remainingExpSec):            // WorkOS SLO 触发
    RedisBlocklist.add(jti, ttl=remainingExpSec)                   // TTL=剩余 exp 自动清

function WorkOsHealthChecker.tick():                               // ScheduledExecutor 10s
    if httpGet(WORKOS_HEALTH_URL, timeout=3s).ok:
        consecutiveFailures.set(0)
        if globalState.workosDown:
            globalState.workosDown = false                         // 恢复
    else:
        if consecutiveFailures.incrementAndGet() >= 3:
            globalState.workosDown = true                          // 3 次 × 10s = 30s 容忍窗口
            notifyOncall()                                         // 30s 平衡敏感度 vs 误报

function LoginController.decideLoginPath(emailDomain):             // 登录页加载时调
    org = organizationsRepo.findByDomain(emailDomain)
    if org == null or not org.ssoEnabled: return PATH_PASSWORD
    if globalState.workosDown: return PATH_PASSWORD_WITH_BANNER    // admin 走密码后仍要 MFA
    return PATH_SSO
```

**子图 — WorkOS 健康状态机** (BF3 多张力同时拍板, 纯文字读者要在脑里画状态机才能 grasp):

```
          probe ok            probe ok              probe ok
          ┌──────┐            ┌──────┐              ┌──────┐
          │      │            │      │              │      │
          ▼      │            ▼      │              ▼      │
       ┌────┐ fail│         ┌────┐ fail│         ┌────┐ fail│
       │ UP │────┴────────►│ F1 │────┴────────►│ F2 │────┴───────┐
       └────┘                └────┘              └────┘            │
          ▲                                                        ▼
          │                                                    ┌──────┐
          │      probe ok (任一)                               │ DOWN │
          └────────────────────────────────────────────────────┴──────┘

状态行为:
- UP / F1 / F2: 登录走 SSO; banner 关; F1/F2 是"容忍单次抖动"的中间态
- DOWN: 登录页 banner 开; admin 改走密码+TOTP; 已签 JWT 不受影响 (下游只验签名 + blocklist)
- 恢复路径: 任意状态下 probe ok → UP (不需累计回正次数; 上线后真出过的状况都是要么持续 ok 要么持续 fail)
```

**BF4 — MFA TOTP enrollment + 校验 + 备份码**

```
function TotpService.enroll(user):                                 // admin 首次或主动开启
    secret = generateBase32(160 bits)                              // RFC 6238 推荐 ≥ 128 bits
    mfaSecretsRepo.upsert(user.id, KMS.encrypt(secret))
    backupCodes = generate10Codes()                                // 10 个一次性
    BackupCodeStore.saveAll(user.id, backupCodes.map(c => bcrypt(c, 12)))
    return (otpauthQrUrl(user, secret), backupCodes)               // codes 仅本次返回

function TotpService.verify(user, code):                           // 登录第二步
    secret = KMS.decrypt(mfaSecretsRepo.find(user.id))
    if code in [totp(secret, now()-30s),                           // ±1 时间窗容差, 覆盖手机时钟漂移
                totp(secret, now()),
                totp(secret, now()+30s)]:
        return true
    if BackupCodeStore.consumeIfMatch(user.id, code):              // 不命中 TOTP 则尝试备份码
        if BackupCodeStore.remainingCount(user.id) <= 2:
            notifyUserLowBackup(user)                              // 剩 ≤ 2 个提示重生成
        return true
    incrementFailCounter(user.id)                                  // 5 次失败锁 30 min
    return false
```

**BF5 — 集中式 audit 写入** (跨 BF1-BF4 共享)

```
function AuthEventLogger.logEvent(user, eventType, status, reason): // 所有 BF 统一调
    auth_events.insertAsync({                                       // 异步写, DB 抖动不阻塞登录
        user_id: user?.id,                                          // 可空 (SAML 签名失败时还没确认 user)
        event_type: eventType,                                      // "sso_login" / "mfa_totp" / "binding_conflict"
        status, reason,                                             // reason 仅枚举常量, 防注入
        ip: ctx.ip, user_agent: ctx.userAgent,
        created_at: now()
    })
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | SamlValidationException | XML 签名失败 / IdP 配置错 / 中间人篡改 | 401 + AuthEventLogger.failure | 吞 |
| BF1 | Replay 攻击 | 重放旧 SAML Response | SDK 自带 InResponseTo + 时间窗自动拒 | 吞 |
| BF1 | WorkOsUnavailableException | WorkOS 5xx / 超时 | redirect /login?fallback=true | 吞 |
| BF1 | UniqueViolation (user_identities) | 同 external_id 绑到不同 user (理论不应发生) | 409 + oncall 告警 | 上抛 |
| BF2 | InvalidCredentials | 旧密码错 / 钓鱼 | 5 次失败锁 30 min | 401 |
| BF2 | IdentityAlreadyBound | 同 IdP external_id 已绑别人 | 409 + 通知企业 admin | 409 |
| BF2 | BindingTokenExpired | 用户停顿 > 5 min | 让用户重新走 SSO | 410 |
| BF3 | TokenSignatureInvalid | JWT 被篡改 | 401 + audit | 上抛 |
| BF3 | TokenExpired | 8h 到期 | 重登 | 401 |
| BF3 | TokenRevoked | jti 在 blocklist (SLO 或 admin 撤销) | 401 引导重登 | 上抛 |
| BF3 | Redis 不可用 | Redis 宕机 | **fail-open** — 可用性优先于 SLO 即时性, 最多 8h 自然过期 | 吞 + 告警 |
| BF3 | WorkOS 抖动单次失败 | 网络抖动 | 不立刻 DOWN (要连续 3 次) | 吞 |
| BF3 | WorkOS 连 3 次失败 | 真宕机 | DOWN + banner + oncall | 吞 (状态变更) |
| BF4 | 时钟漂移 ±30s | 手机时间不准 | ±1 时间窗自动覆盖 | 透明 |
| BF4 | 设备丢失 | 用户换手机 | 备份码登录 + regenerate | 透明 |
| BF4 | 备份码用完 | 10 个全消费 | 拒绝 + 邮件指引联系企业 admin | 403 |
| BF4 | 5 次 MFA 失败 | 暴力尝试 | 锁 30 min + 告警 | 423 |
| BF5 | DB 写失败 | PostgreSQL 暂不可用 | 异步 + 本地 fallback 文件队列 | 吞 (绝不阻塞登录) |
| BF5 | 日志注入 | user email 含特殊字符 | reason 仅枚举常量, 不存原始输入 | 透明 |

### 单测设计

**BF1 — SSO 回调 + JIT provisioning**

- **case 1.1 主路径 — 新用户首次 SSO 直签**
  - Given: SAML Response 签名有效, user_identities 表中 (provider, external_id) 不存在, user 非 admin
  - When: handleSsoCallback 被调
  - Then: user_identities + users 新建, 直接 issueJwtAndRedirect, JWT cookie 已设

- **case 1.2 admin 跳 MFA 挑战**
  - Given: SAML 有效, identity 已存在, user.roles 含 "admin"
  - When: handleSsoCallback 被调
  - Then: 302 redirectToMfaChallenge, 未签 JWT

- **case 1.3 旧用户 needsBinding 分支**
  - Given: SAML 有效, 邮箱与现有 user 匹配但 user_identities 无对应行
  - When: handleSsoCallback 被调
  - Then: 302 redirectToBindingPrompt, tempToken 已生成 (5 min TTL)

- **case 1.4 异常 — SAML 签名失败**
  - Given: SAML Response 签名错 (篡改或 IdP 配置不一致)
  - When: handleSsoCallback 被调
  - Then: 401 errorPage, AuthEventLogger 写 saml_validation failure

- **case 1.5 异常 — WorkOS 不可用 fallback**
  - Given: WorkOsClient.parseProfile 抛 WorkOsUnavailableException
  - When: handleSsoCallback 被调
  - Then: 302 redirect /login?fallback=true

**BF2 — 旧用户绑定**

- **case 2.1 主路径 — 密码验证通过, 绑定成功**
  - Given: tempToken 有效, 旧密码正确, 绑定无冲突
  - When: bindToExistingAccount 被调
  - Then: user_identities 新行, 24h 回滚邮件已发, JWT 签出

- **case 2.2 异常 — tempToken 过期**
  - Given: tempToken 已超 5 min TTL
  - When: bindToExistingAccount 被调
  - Then: 410 BindingTokenExpired

- **case 2.3 异常 — 密码错防钓鱼**
  - Given: tempToken 有效, 旧密码错
  - When: bindToExistingAccount 被调
  - Then: 401 InvalidCredentials, audit 写 binding_wrong_password, **不**绑定

- **case 2.4 异常 — IdP 身份已绑别人**
  - Given: tempToken 有效, 密码对, 但 (provider, external_id) 已绑其他 user
  - When: bindToExistingAccount 被调
  - Then: 409 IdentityAlreadyBound, 通知企业 admin

**BF3 — JWT + SLO + WorkOS 降级**

- **case 3.1 主路径 — JWT 签发与下游验签**
  - Given: user 有效
  - When: JwtIssuer.issue → JwtValidator.validate
  - Then: payload.sub == user.id, payload.exp ≈ now + 8h

- **case 3.2 SLO 撤销 → blocklist 命中**
  - Given: JWT 已签, SloHandler.onSloWebhook 被触发
  - When: 下游 validate(token)
  - Then: 抛 TokenRevoked

- **case 3.3 fail-open — Redis 不可用**
  - Given: RedisBlocklist.contains 抛 RedisConnException
  - When: 下游 validate(token)
  - Then: 校验通过 (吞), audit 写 redis_unavailable 告警

- **case 3.4 WorkOS 健康状态机 UP → F1 → F2 → DOWN**
  - Given: WorkOsHealthChecker 起点 UP
  - When: 连续 3 次 probe fail
  - Then: 状态转 DOWN, notifyOncall 被调

- **case 3.5 WorkOS 抖动单次失败不切 DOWN**
  - Given: 状态 UP
  - When: 1 次 probe fail 后立刻 1 次 probe ok
  - Then: 状态回 UP, consecutiveFailures 重置 0, banner 关

**BF4 — MFA TOTP**

- **case 4.1 主路径 — TOTP 校验通过**
  - Given: user 已 enroll, code = totp(secret, now())
  - When: verify(user, code) 被调
  - Then: 返回 true, 不触发 fail counter

- **case 4.2 时钟漂移 ±30s 容差**
  - Given: code = totp(secret, now()-30s)
  - When: verify(user, code) 被调
  - Then: 返回 true (覆盖手机时钟漂移)

- **case 4.3 备份码消费 + low-watermark 提示**
  - Given: TOTP 不匹配, 但 code 在 backup codes 里, 剩余备份码 == 2
  - When: verify(user, code) 被调
  - Then: 返回 true, 该备份码标 used, notifyUserLowBackup 被调

- **case 4.4 异常 — 5 次失败锁**
  - Given: 前 4 次 verify 失败
  - When: 第 5 次 verify 失败
  - Then: 423 + lockUntil = now + 30 min, audit 写

**BF5 — audit 写入**

- **case 5.1 主路径 — 异步写入**
  - Given: BF1 触发 audit 调用
  - When: logEvent 被调
  - Then: 立即返回 (不阻塞), insertAsync 入队列

- **case 5.2 异常 — DB 写失败 fallback 队列**
  - Given: PostgreSQL 暂不可用
  - When: logEvent 被调
  - Then: 写本地 fallback 文件队列, 不抛异常给上游

## 方案选型

### Q1: WorkOS SDK 集成放在哪一层?

**选项**: 嵌入 monolith (无新部署, 但加大 deploy 单元 + WorkOS 升级整回滚) vs API Gateway 中间件 (流量自然经过, 但破坏无状态层) vs **独立 auth-service** (独立 deploy/scale/回滚, 故障 blast radius 限定)
**定**: 独立 auth-service. 因 monolith 已 200K+ LOC 不该再加, Gateway 是无状态层不能查 DB. → 影响 BF1, BF3.

### Q2: user_identities schema 怎么防误绑?

**选项**: 把 idp_provider + external_id 加到 users 表 (但一 user 只能绑一个 IdP + breaking) vs **独立 user_identities 表 + 双 UNIQUE** vs JSON 字段挂 users 表 (DB 无法保证唯一性, 查询差)
**定**: 独立 user_identities 表 + 双 UNIQUE. `UNIQUE (idp_provider, external_id)` 防一 IdP 身份绑多 user; `UNIQUE (user_id, idp_provider, organization_id)` 防同 user 在同企业重复绑. → 影响 BF2.

### Q3: session token 格式?

**选项**: 纯 opaque token + Redis lookup (每请求回查 Redis, 高 QPS 压力) vs **JWT (RSA, 8h) + Redis blocklist** vs JWT 无 blocklist (SLO 失效等 8h 自然过期违反零信任 + SOC2)
**定**: JWT (RSA, 8h) + Redis blocklist. 下游 99% 请求只验签名 + 1 次 O(1) Redis 查; blocklist 仅存未到期失效 jti, 容量小. → 影响 BF3.

### Q4: WorkOS 宕机时怎么降级?

**选项**: 全员锁定 (用户体验崩) vs 全 fallback 到密码 (admin 也跳过 MFA, 安全降级) vs **fallback 到密码但 admin 仍要 MFA**
**定**: fallback 到密码但 admin 仍要 MFA. 因 admin 权限大不能丢 MFA, 普通用户密码登录已是 baseline. 健康检查 30s 容忍窗口 (3 次 × 10s) 平衡敏感度 vs 误报. → 影响 BF3 子图状态机.

### Q5: TOTP 设备丢失怎么自助恢复?

**选项**: 纯 TOTP, 丢失走 admin 人工 (客服工单量大) vs **TOTP + 10 个一次性备份码** vs TOTP + SMS/Email 后备因子 (SMS 不抗钓鱼 + SIM swap, 见 ADR-007)
**定**: TOTP + 10 个 hashed 备份码. enrollment 时一次性生成, bcrypt cost=12 存储. 剩余 ≤ 2 提示重生成. → 影响 BF4.

## 其他

### 部署

- **灰度策略**:
  - Phase 1 (1 week): 内部员工 (~50 user) 全员开 SSO + admin 强制 MFA
  - Phase 2 (2 week): 5 家 design partner 客户开启 (~500 user), banner 提示 SSO 已可用
  - Phase 3 (4 week): 普通用户按 organization 灰度 10% → 50% → 100%, 按 org_id 哈希分组
- **回滚预案**:
  - 触发条件: SSO 登录成功率 < 95% 持续 10 min, 或 P99 > 5s 持续 10 min, 或 oncall 手动
  - 回滚操作: api-gateway feature flag `sso_enabled=false` → 全员走密码; auth-service 保持运行 (已签 JWT 不受影响)
  - runbook: `ops/runbooks/sso-rollback.md`
- **监控指标**:
  - `auth.sso.login_success_rate` (阈值 < 95% 触发 PagerDuty P2)
  - `auth.sso.callback_latency_p99` (阈值 > 3s 触发 P3)
  - `auth.mfa.verify_latency_p99` (阈值 > 200ms 触发 P3)
  - `auth.workos.health_state` (DOWN 持续 > 1min 触发 P1)
  - `auth.redis.blocklist_unavailable_rate` (阈值 > 1% 触发 P2)
- **数据迁移**: V2026_04_01__sso_mfa_schema.sql 通过 Flyway 在 Phase 1 部署前执行; `users` 表零改动无回滚风险

---

> 本 example 演示结束. 真实 design doc 在此处追加 `## Review Log` 节 (含 reviewer Report + 用户决定 + 修订摘要), example 不带 Review Log 以保持骨架清晰.
