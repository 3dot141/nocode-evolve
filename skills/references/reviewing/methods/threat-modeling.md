# 方法卡：threat-modeling（信任边界 + STRIDE）

> reviewing 框架方法库 · 评审方法之一。**适合**：涉及**外部输入 / 认证授权 / 敏感数据 / 跨信任域**的代码或设计——安全评审主方法。**不适合**：纯内部计算、无外部面的逻辑（安全 review ≠ 全量套用，按信任边界裁剪）。
>
> 业界证据（设计 §2.3）：安全 review 应**前移到设计阶段**做。本卡常与 `checklist`（载体 = `security-method` 卡的 OWASP Top10 清单）**配对**：threat-modeling 出威胁，OWASP 清单兜底逐项核查（§4.3 选择表「安全 → threat-modeling + checklist(security-method OWASP)」）。

## 一、维度 / 思路

threat-modeling 不逐行扫代码，而是**先画信任边界，再沿边界用 STRIDE 系统性问威胁**：

**Step A — 标信任边界**：数据 / 控制流从哪里跨越信任域？典型边界——外部用户输入入口、第三方 API 调用、进程/服务间通信、数据库读写、文件/网络 IO、权限提升点。把这些边界标出来，威胁只在边界上发生。

**Step B — 沿边界跑 STRIDE**：对每条信任边界逐项问：

| STRIDE | 威胁 | 在这条边界问 |
|---|---|---|
| **S**poofing 伪装 | 身份冒充 | 认证够吗？能伪造身份/token 吗？ |
| **T**ampering 篡改 | 数据被改 | 传输/存储完整性？入参能被构造篡改吗？ |
| **R**epudiation 抵赖 | 否认操作 | 关键操作有审计日志吗？能抵赖吗？ |
| **I**nformation Disclosure 信息泄露 | 敏感数据外泄 | 越权读？错误信息泄露内部？日志含敏感数据？ |
| **D**enial of Service 拒绝服务 | 资源耗尽 | 无限制输入/查询？限流？放大攻击？ |
| **E**levation of Privilege 提权 | 越权 | 授权检查每个入口都做了吗？能绕过吗？ |

**Step C — OWASP 兜底**：STRIDE 出的威胁，对照 `{NOCODE_SKILL_REF}/reviewing/methods/security-method.md` 的 **OWASP Top10 清单**逐项核查（注入 / 失效认证 / 敏感数据暴露 / 访问控制失效 / SSRF……），保证不漏高发类。

> security-method 卡由批4 从 `agents/security-reviewer.md` 转出，保留完整 OWASP Top10 + 漏洞模式。本卡负责「按边界系统性发现威胁」，security-method 负责「按 OWASP 逐项核查」，两者互补。

**纪律**：① 威胁落到具体入口 `file:line` + **攻击向量**（怎么打——构造什么输入/请求）；② 每条威胁给缓解（Structural Remedy 优先：参数化查询消除整类注入，而非转义单点）；③ 无外部面的边界显式跳过，不为凑 STRIDE 编威胁（Doubt Theater）。

## 二、输出契约

产出 `findings[]`，映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- 每条 finding：`axis` = STRIDE 类别或 OWASP 项（`Spoofing` / `Injection` / `越权访问`……）；`location` = 边界入口 `file:line`；`evidence` = 攻击向量（构造的恶意输入/请求）；`severity` = C/W/S；`fix` = 缓解措施。
- **security 4档 → 统一 C/W/S 的关键约束**（findings-contract）：security 的 **High 上提 Critical**（High = "Fix Before Production" 语义近阻塞），4→3 压缩时**上提不下沉**；Critical+High → critical，Medium → warning，Low → suggestion。
- 受 Evidence Gate 约束：安全 critical 必须有 location + 攻击向量，否则降 `kind=open-question`（无 PoC 的安全指控易误报）。
- `verdict`：有未缓解 critical → `approved=false`，安全硬伤必修才放行。

## 三、派发策略

| 模式 | 派 subagent | 调 codex | 说明 |
|---|---|---|---|
| **主 agent 建模** | 否（Step A/B 主 agent 做）| — | 信任边界 + STRIDE 由主 agent 系统性走 |
| **异源交叉**（推荐，安全默认重档）| **是** | **是** | 安全 review 独立性档 = **异源**（§4.3）——subagent + codex 独立跑 STRIDE/OWASP，异源更可能发现单模型盲区 |

档位：安全（外部输入/认证/敏感数据）默认**重档 + 异源**。CLAIM 剥离（只传代码/设计 + 信任边界，不传已发现威胁），codex 不可用 → 单 subagent + 明说降级。低风险纯内部逻辑可降为主 agent 单跑 STRIDE，但仍要标信任边界确认「确实无外部面」。
