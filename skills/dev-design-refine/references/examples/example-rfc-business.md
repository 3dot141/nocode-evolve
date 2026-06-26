---
type: rfc
rfc_id: RFC-014
topic: ContextCo 企业 SSO 接入——选 SAML 2.0 还是 OIDC？自建还是 SSO-as-a-service？
date: 260315
author: arch-carol
status: accepted
---

# RFC-014：ContextCo 企业 SSO 接入方向

> 业务场景 example。承接 PRD（260301 立项接入 SSO+MFA）后的方向性提案——决定**走 SAML 2.0 还是 OIDC**、**自建对接层还是用 WorkOS / Auth0**。演示跨团队 RFC 骨架，**不要照搬这里的供应商名 / 报价 / 团队角色**，按你公司情况替换。

## 背景

PRD（260301）确定要做企业 SSO + MFA，但选哪条技术路径还没定。本 RFC 收集跨团队（Platform / Security / 客户支持 / 法务）意见，定方向。

**Evidence**（市场调研 + 销售复盘，260308 完成）：

- 销售复盘过去 12 个月**38 笔** "无 SSO 流失" 案例：**32 笔（84%）客户要求 SAML 2.0**，6 笔接受 OIDC——SAML 仍是企业市场默认协议
- 目标客户企业 IdP 分布：Okta 41% / Azure AD 33% / OneLogin 8% / Ping 7% / Google Workspace 6% / 其他 5%——前 4 家都同时支持 SAML 2.0 和 OIDC
- WorkOS（SSO-as-a-service）公开报价 $125/月/企业 client + setup fee；Auth0 Enterprise 起价 $1500/月（不分 client 数）
- 自建估算：Platform 团队评估 SAML 2.0 适配 + 多 IdP 兼容性测试需 **4 人月**

**力的对抗**：

- X 约束：销售要求 Q3 上线、必须 SAML 2.0（市场基准）
- Y 约束：Platform 团队人手紧（仅 5 人 fulltime），自建 SAML 难调试且后续要持续维护 IdP 兼容性
- 不决定的代价：销售继续流失高价值客户；Platform 把方向定错后期重写代价更大（迁移现有 session / 用户绑定关系）

## 目标

本 RFC 要争取的认同：

- 跨团队对**协议选型**（SAML 2.0 优先，OIDC 后续）达成一致
- 跨团队对**实施路径**（自建 vs WorkOS vs Auth0）达成一致
- 法务 + 安全对**第三方依赖**风险有明确意见
- 客户支持对**接入流程**的角色分工有共识

## 提案

### 提案核心

ContextCo Q3 上线 SAML 2.0 SSO，**通过 WorkOS 作为统一 IdP 适配层**——而不是自建 SAML 协议栈，也不是 Auth0。OIDC 在 Q4 评估后追加，复用同一套 WorkOS 接入层。MFA TOTP 自建（见 ADR-007，不依赖 WorkOS）。

### 问题拆解

#### 问题一：SAML 2.0 vs OIDC 优先级

**说明**

两者都是企业 SSO 主流协议，差异在生态与复杂度——SAML 2.0 历史悠久、XML、企业 IdP 兼容度极高；OIDC 基于 OAuth 2.0、JSON、cloud-native 公司更偏好。我们必须选一个**先上线的**，另一个排后续。

**方案对比**

- **方案 A：SAML 2.0 先上 + OIDC 后追加**
  - 优点：覆盖 84% 销售复盘流失案例；目标企业 IdP 前 4 家原生支持 SAML 2.0
  - 否决：无（选定方案）

- **方案 B：OIDC 先上 + SAML 2.0 后追加**
  - 优点：协议更简单、JSON、调试容易；与现代 cloud-native 客户更亲和
  - 否决理由：6/38 流失案例接受 OIDC，但 32/38 明确要 SAML——上 OIDC 先并不能立刻打开销售上探，与 PRD 目标错位

- **方案 C：两者同时上**
  - 优点：覆盖全市场
  - 否决理由：4 人月已经紧，同时上拉到 7-8 人月，错过 Q3 deadline

**结论**：方案 A——SAML 2.0 优先，Q3 上线；OIDC 在 Q4 视客户需求追加。

#### 问题二：自建 SAML 栈 vs WorkOS vs Auth0

**说明**

SAML 2.0 协议复杂（XML 签名校验、metadata schema、多 IdP 实现差异），自建后期持续吃 Platform 维护工时。SSO-as-a-service（WorkOS / Auth0）把这部分外包出去，团队只接 SDK。

**方案对比**

- **方案 A：自建 SAML 栈**
  - 优点：零运行时第三方依赖；无 per-customer 费用；team 完全掌控
  - 否决理由：估算 4 人月 + 后续每个 IdP 兼容性问题持续吃工时（Platform 测算每个新 IdP 适配平均 2 人周）；SAML XML 签名 / metadata 校验出 bug 极难调试

- **方案 B：WorkOS 接入**（**选定**）
  - 优点：4 人月降到 2-3 人周；WorkOS 已适配主流 IdP；不锁定（提供 metadata 透出，迁出可控）；定价线性透明（$125/月/client）
  - 否决：无

- **方案 C：Auth0 Enterprise**
  - 优点：功能最完整（社交登录、passwordless、Universal Login 一站式）
  - 否决理由：定价起步 $1500/月、按 MAU 上浮，按 ContextCo 现有 30 万 MAU 测算年成本 > $200K，超过自建 4 人月人力成本（约 $80K）

**结论**：方案 B——WorkOS 接入。

#### 问题三：session 管理——本地 session 还是 IdP session？

**说明**

用户走 SSO 登录后，"还登录着"由谁说了算——ContextCo 本地 session（自己 cookie / JWT）还是查 IdP（每次都 redirect 检查）？两种 trade-off 不同。

**方案对比**

- **方案 A：纯 IdP session（SAML Just-In-Time）**
  - 优点：用户在 IdP 端登出后 ContextCo 立刻失效，符合零信任
  - 否决理由：每个请求都要 redirect 校验 = 高延迟、对 SPA 体验差；与 PRD"99p ≤ 3 秒"冲突

- **方案 B：本地 session 8 小时 + SAML SLO（Single Logout）订阅**
  - 优点：用户体验流畅；IdP 端 logout 时通过 SLO 通知 ContextCo 失效；可控 timeout
  - 否决：无（选定方案）

- **方案 C：本地 session 无 SLO**
  - 优点：实现最简单
  - 否决理由：用户在 IdP 端 logout（如 Okta 注销）后 ContextCo session 仍存活——安全审计 finding

**结论**：方案 B——本地 session（8h timeout）+ SLO 异步失效。

#### 问题四：SSO 用户与历史邮箱密码用户怎么共存？

**说明**

ContextCo 已有约 300K 邮箱密码用户。企业接入 SSO 后，旧用户怎么走 SSO？是否强制迁移？

**方案对比**

- **方案 A：企业接入 SSO 后强制全部用户走 SSO**
  - 优点：管理清晰
  - 否决理由：企业里部分用户邮箱不在 IdP 域内（如外包 / 顾问），强制后他们无法登录

- **方案 B：用户首次 SSO 登录时弹"绑定到现有账号"对话框**（**选定**）
  - 优点：自愿迁移；未绑定的用户继续邮箱密码走老路
  - 否决：无

- **方案 C：后台批量迁移 + 通知邮件**
  - 优点：管理员省心
  - 否决理由：误匹配风险（同名邮箱归属错），且邮件通知到达率低，用户 confused

**结论**：方案 B——用户自愿绑定。

### 提案总结

Q3：SAML 2.0 通过 WorkOS 上线，本地 session + SLO，旧用户自愿绑定。Q4：OIDC 通过同一套 WorkOS 接入层追加。MFA 独立自建走 TOTP（ADR-007）。

## 影响评估

### 受影响方

| 团队 | 受影响事项 |
|---|---|
| Platform | 2-3 人周实施 WorkOS SDK 接入；后续维护 SLO callback + 用户绑定流程 |
| Security | 评估 WorkOS 供应商（SOC2 报告、数据驻留、SLA） |
| 客户支持 | 培训"如何指导企业 IT 上传 SAML metadata"；新增 SSO 故障排查 runbook |
| 法务 / 合规 | 起草 WorkOS DPA（Data Processing Agreement）；评估 GDPR 跨境数据合规 |
| 客户成功 | 改 onboarding playbook——企业客户上线后第一阶段就介绍 SSO 接入路径 |
| 销售 | 培训"如何回答客户技术问题"；准备 SSO demo 环境 |

### 缺点 / 风险

- **第三方依赖**：WorkOS 宕机 = 所有企业用户登录受影响（mitigation：本地 session 8h timeout，宕机期间已登录用户不受影响；同时邮箱密码登录通道保留作 fallback）
- **per-customer 费用上涨**：当前预估 50 企业 client × $125/月 = $6.25K/月；规模到 500 client = $62.5K/月，到一定规模可能反过来不如自建——重新评估阈值定为 200 client
- **WorkOS 数据驻留限制**：EU 客户数据必须留 EU——WorkOS 提供 EU region 但要单独签约（法务 follow-up）
- **SLO 异步失效有窗口期**：IdP 端 logout 到 ContextCo 失效有 0-30 秒窗口，期间 stale session 仍可用（mitigation：高敏操作即使在 session 内仍要求 MFA 二次验证）
- **用户绑定误操作**：邮箱地址相同但实际是不同人时，自愿绑定流程可能误绑——绑定后 24h 内邮件确认，用户可回滚

### 迁移 / 兼容

- 现有 300K 邮箱密码用户**不动**——继续走老登录路径
- 企业接入 SSO 后，企业内用户首次 SSO 登录看到 "绑定到现有账号 / 创建新账号" 二选
- API token 模式**完全不动**——客户端原生应用、API 集成走老 token 路径
- 数据库 schema 加 `user_identities` 表（user × idp_provider × external_id），现有 `users` 表不动

## 开放问题

- **问题 1**（Platform）：SLO callback 用 SAML Logout Request 还是 WorkOS webhook？两者都能用，希望 Platform 给意见
- **问题 2**（Security）：WorkOS DPA 中"数据保留期" 默认 90 天，是否需要争取到 30 天？
- **问题 3**（产品）：用户自愿绑定时，"绑定成功"是否需要发邮件确认（防误绑）？
- **问题 4**（销售）：报价模型——企业接入 SSO 是否额外收费（其他 SaaS 普遍把 SSO 作为 Enterprise tier 收 20-30% 溢价）？
- **问题 5**（合规）：EU 客户能否接受 WorkOS US region 走 SCC（Standard Contractual Clauses）？还是必须 EU region？
