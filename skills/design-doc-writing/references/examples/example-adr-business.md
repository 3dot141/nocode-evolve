---
type: adr
adr_id: ADR-007
topic: ContextCo MFA 第二因素采用 TOTP，不采用 SMS / Email / Push
date: 260415
author: sec-bob
status: accepted
---

# ADR-007：MFA 第二因素采用 TOTP

> 业务场景 example。从 Design Doc（260401）"逻辑四：MFA TOTP + 备份码"中提炼出的单点决策——为什么是 TOTP 而不是 SMS / Email / Push / WebAuthn。演示 ADR 的简短紧凑写法，**不要照搬这里的合规要求 / 攻击模型 / 客户假设**，按你公司情况替换。

## 背景

ContextCo 即将上线企业 SSO + MFA（PRD 260301、RFC-014、Design Doc 260401）。第二因素选什么协议是 Design Doc 逻辑四的核心决策，影响：

- **安全模型**：不同因子对钓鱼、SIM swap、设备丢失的抗性差异巨大
- **合规**：SOC2 Type II 2026 Q2 复审、NIST SP 800-63B 对 MFA 等级要求
- **客户体验**：用户是否要装额外 app、是否依赖手机信号、enrollment 摩擦
- **运营成本**：SMS 按条计费、push 需自建后端、TOTP 零成本

**力的对抗**：

- X 约束：合规要求第二因素抗钓鱼（NIST SP 800-63B AAL2）；2025 年 NIST 已不再推荐 SMS-based OTP
- Y 约束：用户体验要尽量低摩擦——理想是"已有手机就能用"
- 不决定的代价：Design Doc 实施 freeze 后无法变更协议；先上 SMS 后再迁 TOTP 等于做两次 enrollment 流程，用户疲劳

## 决策

**说明**

要决定的是：ContextCo MFA 第二因素采用什么协议？范围限定在登录后第二步校验；不影响 SSO 主路径，也不影响密码 fallback。本 ADR 不决定备份恢复方案（备份码已在 Design Doc 逻辑四定）。

**方案对比**

**方案 A：TOTP（RFC 6238）**（**选定**）

- 优点：抗钓鱼（6 位码只在 30s 内有效，钓鱼站难实时转发）；离线可用（不依赖网络）；零运营成本；NIST AAL2 认可；用户用 Authy / 1Password / Google Authenticator 等开源 app 即可
- 否决：无

**方案 B：SMS OTP**

- 优点：用户 enrollment 几乎零摩擦——已有手机号即可
- 否决理由：NIST SP 800-63B 2017 起明确不推荐（restricted）；SIM swap 攻击在过去 2 年已造成头部 SaaS 多起账户接管事件（Twitter 2020、Coinbase 2021、Reddit 2023）；按条计费——按 ContextCo 100K admin × 月均 4 次 = $1.6K/月 持续成本

**方案 C：Email OTP**

- 优点：用户 enrollment 零摩擦——任何账号都有邮箱
- 否决理由：第二因素与第一因素同信道（邮箱+密码 + 邮件 OTP——攻击者拿到邮箱即可一锅端）；不构成"独立第二因素"；明确违反合规

**方案 D：Push notification（自建 mobile app）**

- 优点：用户体验最好（一键 approve）
- 否决理由：ContextCo 当前没有 mobile app（web 端 SaaS），为 MFA 单独建 mobile app 工作量数倍于 TOTP，且要持续维护 iOS/Android 发布渠道；当前规模不划算

**方案 E：WebAuthn / Passkeys**

- 优点：抗钓鱼最强（域名绑定）；用户体验好
- 否决理由：用户端要求 OS 支持（macOS / iOS / Windows 11 / Android 9+ 已普及，但 Linux 桌面 + 老 Android 还有缺口）；本期 PRD 验收"通过 SOC2 finding"+"打开企业销售"TOTP 已够，WebAuthn 排 Q4 增量

**方案 F：硬件 key（YubiKey）**

- 优点：抗钓鱼极强；NIST AAL3
- 否决理由：用户要买实体 key（~$50/个）；不适合 ContextCo 客户企业规模（一家 200 人企业要花 $10K 配 key）；适合金融 / 政府场景，与 B2B SaaS 错位

**结论**

我们采用 **TOTP（RFC 6238）作为 MFA 第二因素**，配套 10 个一次性备份码用于设备丢失恢复（备份码方案见 Design Doc 逻辑四）。WebAuthn 在 Q4 评估后作为增量选项追加，与 TOTP 并存供用户选择，不替代 TOTP。

## 后果

**正面**：

- 满足 SOC2 Type II MFA finding 整改要求（NIST AAL2）
- 抗钓鱼能力达标，避免 SIM swap / 邮箱 single-channel 已知攻击向量
- 零运营成本（vs SMS $1.6K/月）
- 用户用现成开源 Authenticator app，enrollment 一次性二维码扫码即可
- 离线场景可用（用户在飞机 / 弱网时仍能登录）

**负面**：

- 用户必须装 Authenticator app——比 SMS 多一步 onboarding 摩擦，预计 enrollment 完成率 ~85%（vs SMS 估算 95%），影响普通用户开启 MFA 的覆盖率
- 设备丢失时依赖备份码——若用户没保存备份码，需要走 admin 人工恢复流程（预估 1-2% 用户会触发）
- 不抗中间人——熟练攻击者仍可用实时 phishing proxy 转发 TOTP（30s 窗口内）；本期接受这个残余风险，Q4 WebAuthn 解决

**中性**：

- 与业界主流 B2B SaaS 一致（Notion / Slack / Linear / Stripe / GitHub 默认都是 TOTP），不构成差异化也不落后

---

> 与其他文档关系：本 ADR 由 Design Doc（260401）逻辑四提炼。如果未来 ContextCo 决定迁移到 WebAuthn 替代 TOTP，写**新 ADR + supersede 本 ADR**，本文不修改。
