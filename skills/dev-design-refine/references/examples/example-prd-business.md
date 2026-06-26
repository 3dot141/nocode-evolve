---
type: prd
topic: ContextCo 登录系统接入企业 SSO + 强制 MFA
date: 260301
author: pm-alice
status: approved
---

# PRD：ContextCo 登录系统接入企业 SSO + 强制 MFA

> 业务场景 example。虚构一家中型 SaaS 公司 ContextCo（年 ARR $20M、300+ 客户企业），演示在真实 B2B 立项场景下 PRD 骨架怎么填——结构对照学，措辞按你自己产品的语境调，**不要照搬这里的具体数字、角色、术语**。

## 背景

**核心问题**：企业销售线索在 procurement 阶段流失——B2B sales 团队过去 6 个月统计，**30% 的潜在企业客户（年合同 ≥ $50K）在合同评审阶段要求"必须支持 SAML SSO 才能签字"**，当前回答只能是"在 roadmap"，平均推迟成交 2-3 个月或彻底流失。Q1 仅此一项预估损失 ARR $1.8M。

**附带问题**（本 PRD 一并解，但不是 driver）：

- 过去 12 个月发生 3 次撞库相关 security incident，根因是没有 MFA 兜底
- SOC2 Type II 2025 年审计明确把"admin 账号缺 MFA"列为 finding，限期 2026 Q2 整改
- 客户支持工单 18% 是密码重置（占用 2 位全职 CS 工时）

不解决的代价：企业销售上探（从 SMB 向上探 mid-market / enterprise）的核心瓶颈打不开；安全 + 合规审计持续暴露；CS 工单结构无法优化。

## 目标

- **打通企业销售上探**：年底"无 SSO"导致的企业客户流失率从 30% 降至 ≤ 5%
- **企业 IT 自助接入**：客户企业 IT 管理员从拿到 SSO 配置文档到完成 metadata 上传 + 测试登录，**< 30 min**（行业基准是来回邮件 1-2 天）
- **admin 强制 MFA**：100% 覆盖所有 admin 角色（ContextCo 内部 SRE + 客户企业 admin）
- **通过 SOC2 finding**：2026 Q2 复审 MFA 项 pass
- **降密码工单**：实施 3 个月后密码重置工单占比从 18% 降至 ≤ 5%

## 用户场景

#### 场景一：企业 IT 管理员配置 SSO 接入

- **角色**：客户企业（如 Acme Corp）的 IT 管理员
- **触发**：Acme Corp 签完合同，要把公司 200 名员工 onboard 到 ContextCo
- **当前流程**：每个员工自己去 ContextCo 注册邮箱 + 密码 → IT 拿不到统一账号列表 → 员工离职后账号清理靠每月手工 audit → 平均 3 个工作日完成 200 人 onboard
- **期望流程**：IT 管理员登录 ContextCo admin → "SSO 设置"页上传公司 Okta 导出的 SAML metadata.xml → ContextCo 自动配置 IdP 对接 → IT 用一个测试账号验证 SSO 跳转通了 → 200 名员工以后首次登录直接走 Okta，自动 provision；员工离职 Okta 撤权后下次访问自动 de-provision → 30 min 完成
- **痛点定位**：每个员工手工注册 + 离职清理无自动化通道

#### 场景二：开发人员日常登录

- **角色**：Acme Corp 的开发人员 Bob
- **触发**：晨会前要登录 ContextCo 看昨晚的 build status
- **当前流程**：Bob 半年没登录 ContextCo → 密码忘了 → 申请重置 → 等邮件 → 重置完登录 → 整个过程 5-8 分钟
- **期望流程**：Bob 打开 ContextCo 登录页 → 输入企业邮箱 `bob@acme.com` → 系统识别 `@acme.com` 已配置 SSO → 自动跳 Okta（Bob 早上已经登录过 Okta，浏览器还有 session）→ 直接回跳 ContextCo 进入系统 → 总耗时 5 秒
- **痛点定位**：密码记忆与重置流程占用早晨工作时间

#### 场景三：admin 操作加固 MFA

- **角色**：ContextCo 内部 SRE，或客户企业 admin
- **触发**：admin 要进后台改用户权限 / 看敏感数据 / 操作生产配置
- **当前流程**：只有密码一层 → admin 密码一旦泄漏（钓鱼 / 撞库 / 同事电脑被入侵），攻击者拿到 admin 全部权限 → SRE 因此不敢用 password manager 自动填充，反而采用更弱的"记忆 + 复用"模式
- **期望流程**：admin 输入密码 → 系统识别 admin 角色强制要求 MFA → 弹 TOTP 输入框 → admin 用 Authy / 1Password 取 6 位码 → 通过；同设备 30 天内不再要求第二因素（"trusted device"）；高敏操作（删用户 / 改密钥）即使在 trusted device 仍要求 MFA
- **痛点定位**：admin 操作没有第二层防护

## 验收标准

- [ ] 企业客户走 self-service flow 完成 SAML 接入，**< 30 min** 完成 metadata 上传 + 测试登录 + 用户首次 SSO 登录
- [ ] SSO 登录链路（用户点击登录 → IdP 回跳 → 进入系统）99 percentile **≤ 3 秒**
- [ ] 强制 MFA 覆盖 100% admin 角色（ContextCo SRE + 客户企业 admin），普通用户可选开启
- [ ] 已有用户**保留邮箱+密码登录**作为 fallback（free tier 用户 + 未接入 SSO 的企业用户兼容）
- [ ] SOC2 Type II 2026 Q2 复审，MFA finding 标记为 resolved
- [ ] 密码重置工单占比从 18% 降至 ≤ 5%（实施完成 3 个月后统计）
- [ ] "无 SSO"导致的企业客户流失率从 30% 降至 ≤ 5%（实施完成 6 个月后统计）

**明确排除**：

- ❌ **客户端原生应用 SSO**——iOS / Android / 桌面客户端继续走现有 API token 模式；本期仅 web 端 SSO
- ❌ **Social login**（Google / Apple / GitHub）——本 PRD 目标是 B2B 企业 SSO，社交账号不在 scope，会冲淡企业定位
- ❌ **Passwordless 登录**（magic link / WebAuthn / Passkeys）——下个 quarter 单独评估
- ❌ **MFA 第二因素覆盖 SMS / Email**——见 ADR-007，本期仅 TOTP（合规 + 防钓鱼考虑）
- ❌ **自动迁移历史密码用户到 SSO**——企业接入 SSO 后，旧用户首次登录提示"绑定 SSO 账号"，由用户自愿绑定；不做后台批量迁移
- ❌ **跨企业身份联邦**（同一个用户被多家企业共享）——本期一个用户 belongs to 一个企业；多企业身份后续 quarter 评估
