# Research Memo: nocode-evolve Skills Dream 审视

> Date: 260625
> Author: 3dot141
> Facets: 结构一致性 / 触发路由对齐 / skill 间边界 / 内容质量 + 专业度 / 方法论对标 / 使用体验回溯 / 缺失能力发散 / SDD 架构评估

## Executive Summary

对 18 个 skill 做了两轮八切面全扫。整体专业度 **4.75/5**，方法论密度达到领域专家水准。但发现三个层面的问题：

1. **具体 bug**（5 个，已明确可修）
2. **方法论暗线**：整套 skill 对"失败/异常/切换/发布"这条暗线系统性覆盖不足
3. **元设计风险**：常驻 catalog 有扩展悬崖 + 上游漂移不可见 + 真实 session 验证缺失（"温室里的精品"）

---

## 一、具体 Bug（5 个）

| # | 严重度 | 问题 | 位置 |
|---|---|---|---|
| B1 | P0 | debug-protocol.md dead reference（Debug 横切是空指针） | devflow:156, dev-build:95 |
| B2 | P0 | skill-integration-map.md dead reference | devflow:12 |
| B3 | P0 | dev-review 缺 manifest 路由（devflow 家族唯一没有 catalog 条目） | manifest.json |
| B4 | P1 | design-doc-writing 重复行 + 错误 skill 名 superpowers:debugging | SKILL.md:24-27 |
| B5 | P1 | skills/design/ 空壳目录 | skills/design/ |

根因：B1/B2 是仓根 `references/` vs `skills/references/` 两个目录 + 裸相对路径歧义。文件存在但路径解析错。路径解析是该仓系统性摩擦（git 历史有 4 个独立 fix 都在打这类 bug）。

---

## 二、方法论暗线：对"失败/异常/切换/发布"覆盖不足

方法论对标发现，10 套业界方法论中的 gap 高度一致地集中在同一方向：

| 暗线 | 现状 | Gap | 来源方法论 |
|---|---|---|---|
| TDD 只说红绿 | 隐性选边 Chicago（测行为不测交互），没提 outside-in | outside-in 最适合垂直切片（与 plan 的 tracer bullet 同向），但 build 的 classicist 风格倾向 inside-out，张力未点破 | Kent Beck TDD London vs Chicago |
| 验收只验 happy path | SC 是断言式（"<200ms"），不是场景式 | 缺 Given/When/Then 具体例子驱动验收，三份 artifact（restate/TO/测试）有同步漂移风险 | Specification by Example |
| land 只管 merge | dev-land 止于 merge/PR | 缺 deploy/release 解耦 + 渐进式发布（canary/dark launch）决策点 | Continuous Delivery |
| PRD 只问 persona | User Story 假设"身份预测行为" | 缺情境锚定（Job Story: When [情境], I want [动机], so that [结果]）+ 切换四力分析 | JTBD |
| design 只前瞻风险 | forward-looking 风险分析 | 缺 pre-mortem（"假设已失败，凶手是谁"）视角切换，风险识别准确率 +30% | Gary Klein Pre-mortem |
| verify 只验功能 | 验的是正常路径能用 | 缺韧性验证（依赖挂了/超时了怎么办），failure path 是生产事故主源 | Chaos Engineering |

**一句话**：Iron Law、路径覆盖链、evidence 门都是教科书级。但"流程纪律"只在 happy path 上严格，对 failure path 的纪律系统性缺失。

### 方法论 gap 优先级

| 级别 | Gap | 涉及 | 借鉴成本 |
|---|---|---|---|
| P0 | TDD outside-in 指引 + 与 tracer bullet 衔接 | dev-build | 低（加一段） |
| P0 | Given/When/Then 具体例子驱动 SC | dev-define → build | 中 |
| P1 | deploy/release 解耦 + 发布策略决策点 | dev-land | 中 |
| P1 | Job Story 情境视角 + 切换四力 | pd-prd / pd-research | 低 |
| P2 | Pre-mortem | dev-design | 低 |
| P2 | 韧性验证 | dev-verify | 中 |
| P2 | Appetite 贯穿 + circuit breaker | dev-plan/build | 中 |

---

## 三、缺失能力：devflow 止于 merge，运维半圈空白

devflow 的生命周期止于 Land(merge)。merge 之后的 deploy→monitor→incident→hotfix 一整段没有 skill 覆盖。

### 最该补的 4 个 skill

| # | 场景 | 为什么 | 核心能力 |
|---|---|---|---|
| 1 | incident/debug | devflow 的 Debug 横切已是空指针；线上事故处置完全没有 | 症状→假设→验证循环 + signoz 集成 + 止血优先 |
| 2 | dependency | 高频、繁琐、AI 强项 | 扫过时 → 分级 → 逐个升+测 → 风险报告 |
| 3 | migration | 高危不可逆，最需要 Gate；references/migration-guide.md 已存在但无 skill | 兼容性检查 + 双写策略 + 回滚预案 |
| 4 | refactor | 高频但被塞进 build/design，缺"行为不变"的核心保护 | 特征测试先行 → 小步重构 → 行为不变验证 |

### 已覆盖但不足

| 场景 | 缺什么 |
|---|---|
| Debug | 文件不存在（B1）|
| 性能优化 | 只有被动检查（verify），缺主动优化流程（profile-first） |
| 安全审计 | 轻量 threat model，缺独立 skill 把安全提到一等公民 |
| 技术债 | Land 有 post-mortem 钩子但被动，缺主动登记+优先级机制 |

---

## 四、SDD 元设计风险（3 个）

### R1: MAX_CATALOG_SHARDS=3 扩展悬崖

当前 22 条 rule / 3 分片。翻倍直接 throw。"常驻一切"的设计到某个点撞墙。

**建议**：catalog 自身分层——热桶常驻，冷桶降级回按需 Read，部分放弃"常驻一切"换扩展性。

### R2: 上游漂移不可见

devflow 合成了 38 个上游 skill 的快照（skill-integration-map）。superpowers 更新后这个快照静默过时，没有任何检测机制。

**建议**：加"上游 skill 清单 hash 检测"脚本，漂移时 sanity 警告。

### R3: "温室里的精品"

49 天 255 个 commit，180 个 benchmark case 100% probe 通过。但评测的是"路由能不能命中"，不是"skill 跑完产物对不对"。两个项目 wiki 零条 skill 使用反馈。SkillOpt 报告自己在 P1 写着"真实 session 端到端验证未做"。

**建议**：最该补的不是再修 bug，而是真实 session 端到端验证 + 痛点回流闭环。

---

## 五、路由优化（4 个）

| # | 问题 | 建议 |
|---|---|---|
| O1 | PRD 触发三方撞车（dev-design / pd-prd / design-doc-writing） | dev-design 的 `\bprd\b` 加限定；design-doc-writing disclaim 产品 PRD |
| O2 | pdflow vs discoveryflow 命名分裂 | 统一为 pdflow |
| O3 | dev-review vs codex-review 触发重叠 | 加路由时顺带明确负例分工 |
| O4 | pd-research 切面硬编码外部产品调研 | 加"内部产物审计时切面自定义" |

---

## 六、专业度评分

整体均分 **4.75/5**。

**亮点**：路径覆盖追溯链（PRD→SC→TO→covers→evidence 贯穿 7 个 skill）、Iron Law + Common Rationalizations + Red Flags 三件套、leading word 机制。

**短板**：对 failure path 的方法论纪律系统性缺失（见第二节）；元设计层面的扩展性和验证闭环（见第四节）。

---

## 七、演进轨迹

从 commit 历史看出四阶段健康曲线：
1. 散装期 (2.x–3.10)：单 skill 软地图
2. 流水线期 (3.22)：5 新 skill + devflow 重写
3. 打磨期 (3.28–3.29)：50 轮 SkillOpt + 180 case benchmark
4. 扩张期 (3.33–3.50)：统一命名 + 产品流 + 横向加新流

---

## Go/No-Go 建议

**建议**: **Go** — 进入收敛，整理可执行清单

**理由**:
- 具体 bug 明确可修
- 方法论暗线方向一致，可系统性补
- 元设计风险需要架构级决策，但不阻塞 bug 修复
- 缺失 skill 是增量，不改已有

**[ASSUMED]**: 方法论对标基于 AI 对业界文献的理解 + web 搜索验证，不代替团队对自身场景的判断——Shape Up 的 appetite/circuit breaker 在 AI 单任务场景收益可能不如团队场景大
