# 安全评审清单

信任边界守住了吗？逐项扫 diff 中触及输入 / 鉴权 / 外部调用 / 密钥的代码。

---

## OWASP Top 10 — prevention patterns

| 风险 | 信号 | 防御 |
|---|---|---|
| **Injection**（SQL / NoSQL / shell / LDAP） | 字符串拼接进查询 / 命令 | 参数化查询 / 预编译语句；shell 用数组 argv 不拼字符串 |
| **Broken Access Control**（IDOR / 越权） | 用 client 传的 id 直接查资源 | server 端校验"当前用户拥有该资源"；不信任 client 的 role |
| **Cryptographic Failures** | 明文存密码 / 弱哈希（md5/sha1） | bcrypt/argon2 存密码；TLS 传输；不自造加密 |
| **Insecure Design** | 缺速率限制 / 缺账户锁定 | 设计期就加 rate limit / 验证码 / 锁定 |
| **Security Misconfiguration** | debug 开 / 默认密码 / 详细报错外泄 | 生产关 debug；最小权限；统一脱敏错误 |
| **Vulnerable Components** | 老旧 / 有 CVE 依赖 | `npm audit` / `pip-audit`，见下方 triage |
| **Auth Failures** | session 不失效 / token 不轮换 | 登出失效 session；短期 token + refresh |
| **Data Integrity Failures** | 反序列化不可信数据 / 无签名更新 | 不反序列化不可信输入；校验签名 |
| **Logging Failures** | 不记安全事件 / 日志打敏感信息 | 记录鉴权失败；日志脱敏 |
| **SSRF** | 用用户 URL 直接发请求 | 白名单 host；禁内网段 / metadata IP |

---

## 三层边界（Always / Ask / Never）

评审时把触及外部副作用的操作归类，越界即 finding：

- **Always（自动允许）**：只读查询、纯计算、读公开数据、写临时文件。
- **Ask First（需用户 / 显式授权）**：写生产数据、删数据、发外部请求、改权限 / 配置、装新依赖、动钱 / 下单 / 转账。
- **Never（绝不）**：硬编码密钥进代码 / 仓库、把用户输入直接当 SQL / shell / 代码执行、关闭安全校验"图省事"、把敏感数据写日志 / 发到第三方、绕过鉴权"方便测试"留进生产。

---

## STRIDE（威胁建模速查）

对涉及信任边界的改动逐项问：

- **S**poofing（伪装）：能冒充别的用户 / 服务吗？认证够强吗？
- **T**ampering（篡改）：传输 / 存储中的数据能被改吗？有完整性校验吗？
- **R**epudiation（抵赖）：关键操作有审计日志吗？能追责吗？
- **I**nformation Disclosure（信息泄露）：错误信息 / 响应 / 日志泄露内部细节吗？
- **D**enial of Service：无界循环 / 无限分配 / 缺速率限制能被打挂吗？
- **E**levation of Privilege（提权）：普通用户能触达管理操作吗？

---

## AI / LLM 安全

- **Prompt 注入**：用户输入直接拼进 system / prompt → 用户可改写指令。隔离用户内容（明确分隔 / 标注为不可信数据），不让其覆盖系统指令。
- **输出当代码执行**：LLM 生成的代码 / SQL / 命令直接 eval / exec → 等同执行任意输入。需沙箱 / 人工确认 / 严格校验。
- **越权工具调用**：LLM agent 能调用的工具有没有权限边界？能不能被诱导删数据 / 发请求？工具层做鉴权，不靠 prompt 约束。
- **敏感数据回传**：prompt 里塞了密钥 / PII 发给第三方模型？脱敏后再发。
- **过度信任输出**：把 LLM 输出直接当事实 / 当鉴权结论用？需校验。

---

## Supply chain（供应链）

- **新依赖 5 问**（见 SKILL.md Dependency Discipline）：已有方案？大小？维护？CVE？License？
- **lockfile**：改动是否锁定版本（lockfile 提交）？避免下游拉到被投毒的新版本。
- **typosquatting**：包名是否疑似仿冒（`crossenv` vs `cross-env`）？
- **post-install 脚本**：新依赖有没有可疑的 install 钩子？

### npm audit triage

```bash
npm audit --json            # 全量
npm audit --audit-level=high  # 只看 high/critical
```

- **critical / high** → 当 Critical / Warning，必须处理（升级 / 替换 / 加缓解）。
- **moderate / low** 且仅在 devDependencies / 不可达路径 → 可记录为 Suggestion，注明理由。
- **不盲目 `npm audit fix --force`**——可能引入 breaking change，逐个评估。
- 误报 / 无可达利用路径 → 记录豁免理由，不静默忽略。
