---
scenario: feat
topic: design-traceability
date: 2026-07-23
author: 3dot141
status: approved
---

# 设计项端到端追踪

## 罗盘（Define Restate）

**Outcome**：修复 nocode 工程流中的设计追踪断链，使日志、安全、Metrics、迁移等规范性设计项不会在 Design 之后无声遗漏。

**User**：使用 nocode Devflow 进行复杂工程任务的开发者。

**Why Now**：断点续传案例已经证明日志在 Design 文档中存在，但后续仍可能遗漏。当前流程只能证明 Plan task 完成，不能证明每个设计项都被承接。

**Success Criteria**：

- SC-1：Dev Design 产出可识别的规范性设计项，覆盖 BF、接口、日志、安全、Metrics、迁移、TO 等类型。
- SC-2：运行时功能缺少基础日志设计时，Design Gate 必须失败。
- SC-3：Plan 能反向检查每个 required 设计项是否对应 task、verify-only 或明确延期。
- SC-4：Build/Verify 能保留 Design ID，并提供代码或测试证据。
- SC-5：`in-review` 或不完整的 Design 不能进入下游。
- SC-6：“主文档 + 未纳入交接的补充文档”不能绕过覆盖检查。
- SC-7：使用断点续传日志案例做回归验证，所有日志项都能追踪到实施落点。
- SC-8：相关测试、插件版本及双平台生成物保持一致。

**路径清单**：

- 工作流.P1：Design 生成规范性设计项 → Review → approved → 下游消费。
- 工作流.P2：Plan 读取设计项 → 映射 task → 反向孤儿检查 → 通过或退回。
- 工作流.P3：Build 完成 task → 保留设计项映射 → 产生实现证据。
- 工作流.P4：Verify 按设计项核对代码、测试或人工证据。
- 系统.1：运行时功能缺少基础日志 → Design Gate 拒绝。
- 系统.2：设计文档仍为 `in-review` → 下游入口拒绝。
- 系统.3：required 设计项无人承接 → Plan Gate 拒绝。
- 系统.4：设计内容被拆入未声明附件 → 完整性 Gate 拒绝。
- 约束.1：不采用 DDD 建模。
- 约束.2：不引入独立 RTM/manifest 作为第二事实源。
- 约束.3：本次执行跳过 Env、Plan、Verify、Review、Land，只走 Define、Design、Build。
- 约束.4：Build 必须自行完成测试、编译和生成物一致性检查，不能因跳过 Verify 而省略取证。

**路径 ↔ SC 绑定**：

| 路径 | 绑定 SC |
|---|---|
| 工作流.P1 | SC-1、SC-2、SC-5、SC-6 |
| 工作流.P2 | SC-3、SC-7 |
| 工作流.P3 | SC-4、SC-8 |
| 工作流.P4 | SC-4 |
| 系统.1 | SC-2 |
| 系统.2 | SC-5 |
| 系统.3 | SC-3 |
| 系统.4 | SC-6 |
| 约束.1–4 | SC-8 |

**Constraint**：

- 不采用 DDD 建模。
- 单一 approved 设计文档是设计事实源。
- 本轮不经过独立 Dev Plan 阶段；Design 批准后直接进入 Build。

**Out of Scope**：

- 不修改断点续传业务项目。
- 不把设计文档每句话都编号。
- 不强制每个日志事件单独成为 task。
- 不建设通用需求管理平台。
- 不引入第二份机器 manifest。

**Assumptions**：

1. 规范性设计项是会影响代码、配置或验证结果的内容，不含背景和被否决方案。
2. Design 批准后的实施清单可直接作为本次 Build 输入，不另产出 Plan 文档。
3. 虽然本轮执行跳过 Verify，目标源码仍可修改 `dev-verify` 的设计追踪协议。

**Boundaries**：

- Always：保持单一事实源；required 项不得无声遗漏；所有结论有本地证据或明确来源。
- Ask First：扩大到独立 manifest、改变用户已确认的四态语义、删除现有兼容字段。
- Never：修改附件对应的业务项目；把所有自然语言都转成追踪项；手改双平台生成物。

**Quality Bar**：

- 所有 required 设计项都有下游状态。
- 不存在无人承接且无解释的孤儿设计项。
- 日志案例形成确定性回归。
- Skill、模板、评审 Gate 和示例保持一致。
- 相关测试、vendor/platform check 通过。
- 插件按新增能力进行 SemVer minor 升级。

**Scenario**：Full，自定义执行路径 Define → Design → Build，Design 不使用 DDD。

**探索胶囊**：

- scanBase：`b54cbd4`
- findings：
  - Dev Design 已要求运行时功能必须设计基础日志，但下游没有强制消费每个日志项。— confidence: high — sources: `skills/dev-design/decision/SKILL.md:109-153`, `skills/dev-plan/SKILL.md:128-145`
  - Plan 的 `covers` 只追踪 restate 路径/约束，最终 Validation 没有 Design → Task 反向孤儿检查。— confidence: high — sources: `skills/dev-plan/SKILL.md:242-286`
  - Build 只能证明已有 Plan task 完成，无法发现从未进入 Plan 的设计项。— confidence: high — sources: `skills/dev-build/SKILL.md:14-18`, `skills/dev-build/SKILL.md:80-89`
  - Verify 的强制证据对象仍是 Define SC、路径和约束，不是全部规范性设计项。— confidence: high — sources: `skills/dev-verify/SKILL.md:141-166`
  - 日志案例存在 9 个结构化日志事件，但位于链接主文档的 `in-review` 补充文档。— confidence: high — sources: `/Users/yes365/.codex/attachments/b97af9ad-c424-48c3-8dbf-498ca1ec2538/pasted-text.txt:1-15`, `/Users/yes365/.codex/attachments/b97af9ad-c424-48c3-8dbf-498ca1ec2538/pasted-text.txt:332-371`
- openQuestions：实际历史 Plan/Build 产物不可用，因此本轮用附件作为确定性回归 fixture，而不追溯当时究竟在 Plan 还是 Build 丢失。

## 方案决策

### 决策速查表

| # | 决策点 | 定 | 状态 | 影响 |
|---|---|---|---|---|
| Q1 | 追踪事实源放在哪里 | 单一设计文档内的稳定 ID + 双向覆盖矩阵 | `[已确认]` | 工作流.P1–P4、约束.2 |
| Q2 | 设计项编号到什么粒度 | 独立可实施、验证、延期或判定不适用的最小单元 | `[已确认]` | SC-1、SC-3、SC-4 |
| Q3 | Gate 覆盖到哪些阶段 | Design 建清单、Plan 查孤儿、Build 保留映射、Verify 查证据 | `[已确认]` | 工作流.P1–P4 |

### Q1：追踪事实源放在哪里?

**选项**：

- A：只补 Plan/Verify checklist。改动最小，但仍依赖模型记忆，不能可靠识别孤儿设计项。
- B：在单一设计文档内给规范性设计项稳定 ID，并由下游建立双向矩阵。保持单一事实源，能做反向完整性检查。
- C：另建 JSON/YAML manifest。机器校验最直接，但产生第二事实源和同步风险。

**定**：选择 B。A 只能提醒，不能证明完整；C 与单一事实源约束冲突。→ 影响工作流.P1–P4。

### Q2：设计项编号到什么粒度?

**选项**：

- A：章节级。成本低，但一个章节部分落实、部分遗漏时仍会误判为覆盖。
- B：独立可实施项级。能分别实施、验证、延期或判定不适用的项各有一个 ID。
- C：逐句/逐字段级。最细，但会把解释性文字变成维护噪声。

**定**：选择 B。A 抓不住日志表中个别事件遗漏；C 超出本次问题需要。→ 影响 SC-1、SC-3、SC-4。

### Q3：Gate 覆盖到哪些阶段?

**选项**：

- A：只在 Plan 检查。能抓 Plan 漏项，但不能保证 Design 输入批准或最终实现留证。
- B：分阶段闭环。Design 建清单、Plan 查孤儿、Build 保留映射、Verify 查证据。
- C：所有设计项都必须立即实现。最严格，但无法表达合理延期、仅验证或不适用项。

**定**：选择 B，并使用 `required | verify-only | deferred | n/a` 四态。C 的强制全实施会把合理延期伪装成完成；A 仍留下上下游断点。→ 影响工作流.P1–P4。

## 领域覆盖决策（非 DDD）

### Architecture

追踪链以设计文档中的“实施设计项清单”为源，沿 Plan task 的 `designCovers`、Build 完成记录、Verify 证据矩阵向下传递。任何阶段都可从下游反查上游设计项，也可从设计项正查实施和证据。

### API / Contract

新增的是 Markdown 文档契约，不引入运行时 API：

- 设计项字段：`ID | 类型 | 设计项 | 影响范围 | 状态 | 依据`
- Plan task 字段：保留现有 `covers`，新增 `designCovers`
- Plan 矩阵：`Design ID | Task/Verify | 处理方式 | 理由`
- Verify 矩阵：`Design ID | 结果 | 代码/测试/人工证据`

### Testing

用确定性 fixture 覆盖：

- 单文档中多种设计项能被枚举。
- required 项无人承接时 Gate 失败。
- verify-only 缺验证方式时 Gate 失败。
- deferred/n/a 缺理由时 Gate 失败。
- `in-review` 文档不能进入 Plan。
- 补充文档中的日志项不能静默绕过单文档 Gate。
- 断点续传附件的 9 个日志事件能全部进入设计项清单并映射下游。

### Security

设计项允许记录日志事件名和字段类别，但 fixture 不复制敏感业务 payload。日志类设计项必须携带禁记字段或脱敏约束时，Plan/Verify 不得丢弃该约束。

### Performance

不引入运行时扫描器。覆盖矩阵由 agent 在既有文档处理步骤中生成和核对，不新增线上性能成本。

### Observability

本功能只改变 Skill 文档和生成物，不引入运行时代码路径，因此基础业务日志设计不适用。自身可诊断性通过确定性测试失败信息提供：失败必须点名 orphan Design ID 和缺失状态/理由。

### Migration / Compatibility

- 保留 `covers` 的现有语义，新增 `designCovers`，不复用同一字段承载两类 ID。
- Standard 场景没有 Design 文档时，`designCovers` 明确标 `N/A`，不强造设计项。
- 旧设计文档没有实施设计项清单时，Plan 必须明确报告 legacy 输入；本次不静默宣称全量 Design 覆盖。

## 失败预演 Top 3

| 排名 | 三个月后失败原因 | 早期信号 | 应对 |
|---:|---|---|---|
| 1 | agent 机械给每句话编号，矩阵膨胀失去可读性 | 设计项数量远大于文件影响和测试目标 | 用“可独立实施/验证/延期/N/A”判据，Review 检查解释性文字误入 |
| 2 | Plan 只做正向映射，仍有 orphan 设计项 | 路径覆盖全绿但日志/安全项无 task | 强制产出 Design → Task 反向矩阵，空白项阻断 Gate |
| 3 | verdict approved 与 frontmatter 仍为 in-review | Plan 消费未批准或分裂文档 | Design Exit Gate 同时校验 verdict、frontmatter 和单 docPath 完整性 |

## 测试目标

| TO | 覆盖 | 层级 | 目标 |
|---|---|---|---|
| TO-1 | 工作流.P1、系统.1、系统.4、约束.2 | 结构检查 | Design 模板、Review 和 Exit Gate 能识别规范性设计项、基础日志及单文档完整性，不产生第二事实源 |
| TO-2 | 工作流.P2、系统.2、系统.3 | 结构检查 | Plan 拒绝 in-review、orphan required、无验证方法的 verify-only、无理由的 deferred/n/a |
| TO-3 | 工作流.P3 | 结构检查 | Build task 完成协议保留 `designCovers`，并能报告缺失设计项 |
| TO-4 | 工作流.P4 | 结构检查 | Verify 为 required/verify-only 设计项输出逐项证据 |
| TO-5 | SC-7 | fixture 回归 | 断点续传附件的 9 个日志事件全部有稳定 ID 和下游处理状态 |
| TO-6 | SC-8、约束.1、约束.3、约束.4 | 仓库验证 | 不引入 DDD 或独立 Plan 产物；Build 内完成 Skill 测试、vendor check、平台编译 check |

## 验证策略

1. 使用 `rg`/Node 测试检查关键协议文本、字段和 Gate 同时存在，避免只改一层。
2. 对断点续传附件建立最小匿名化 fixture，验证 9 个日志项不会成为 orphan。
3. 运行相关 Node 测试和 hooks 测试。
4. 运行 `node scripts/vendor-sync.mjs --check`。
5. 运行 `node scripts/compile.platform.mjs` 后再执行 `--check`。

## Open Questions

无。已确认的执行约束是：本轮不走独立 Plan/Verify 阶段，但实现范围仍包含 `dev-plan`、`dev-build`、`dev-verify` 的协议修改。

## 背景

**主因**：现有流程追踪的是 Define 路径和 Plan task，不是 Design 中全部需要实施或验证的规范性设计项。因此，日志已经写进设计文档，仍可能因为没有进入任何 task 而无声遗漏。

**辅助问题**：

- Design 的 `approved: true` verdict 与文档 frontmatter 状态没有形成同一个 Gate。
- 当前单文档契约缺少下游入口校验，“主文档 + 补充文档”可能只被消费一半。
- Build 和 Verify 只验证已经进入 task/SC 的内容，无法识别上游 orphan。

这不是日志专项问题。日志只是最先暴露断链的横切项；安全、Metrics、迁移、回滚和 eval 都受同一缺口影响。

## 前置调研

| 结论 | 证据 |
|---|---|
| Design 已要求运行时功能必须设计基础日志 | `skills/dev-design/decision/SKILL.md:109-153` |
| Plan task 只有 restate `covers`，没有设计项覆盖字段 | `skills/dev-plan/SKILL.md:128-145` |
| Plan Validation 没有 Design → Task 反向孤儿检查 | `skills/dev-plan/SKILL.md:242-286` |
| Build Gate 只证明 Plan task 完成 | `skills/dev-build/SKILL.md:80-89` |
| Verify 最终逐条核对 Define SC、路径和约束 | `skills/dev-verify/SKILL.md:141-166` |
| 案例日志存在于链接主文档的 `in-review` 补充文档 | `/Users/yes365/.codex/attachments/b97af9ad-c424-48c3-8dbf-498ca1ec2538/pasted-text.txt:1-15,332-371` |

外部工程资料把这类问题称为双向可追踪性：正向确认每项设计有下游，反向识别没有上游或没有承接者的 orphan。这里采用这个完整性原则，不引入重型合规工具。

## 组件结构

本设计不做 DDD 拆域。按现有 Skill 边界分为一个协议单源和四个消费者：

```text
skills/references/design-traceability.md
  │
  ├─ Dev Design
  │    生成 Implementation Item Registry
  │    校验 approved + 单 docPath
  │
  ├─ Dev Plan
  │    task.designCovers
  │    Design → Task 反向覆盖矩阵
  │
  ├─ Dev Build
  │    按 task 保留 designCovers
  │    汇总 required 实施状态
  │
  └─ Dev Verify
       Design ID → evidence 证据矩阵
```

`design-traceability.md` 只定义跨阶段协议，不保存任何项目的设计项。项目事实仍只存在于其 approved Design 文档。

### 协议单源

共享 reference 定义：

1. 什么内容属于规范性设计项。
2. ID、类型和四态字段。
3. Design Registry、Plan Coverage、Verify Evidence 三张表的标准列。
4. 各阶段 orphan 判定和回退目标。
5. Full、Standard、旧文档三种输入如何处理。

Skill 只引用共享 reference，不在四个阶段各复制一份 schema，避免协议漂移。

### ID 与类型

ID 使用“语义前缀 + 连续整数”，分配后不可复用或重排。已有 `Q1`、`BF1`、`TO-1` 和约束 ID 原样复用，不重复造同义 ID。

推荐类型：

| 类型 | ID 示例 | 何时使用 |
|---|---|---|
| Decision | `Q1` | 已确认、会影响实现的方案决策 |
| Business Flow | `BF1` | 主路径或可独立验证的业务流 |
| API / Contract | `API-1` / `CONTRACT-1` | 外部接口或跨阶段契约 |
| Data | `DATA-1` | schema、持久化和数据约束 |
| Log | `LOG-1` | 可独立实施或验证的日志事件/规则 |
| Metric / Alert | `METRIC-1` / `ALERT-1` | 指标与告警 |
| Security / Performance | `SEC-1` / `PERF-1` | 横切约束 |
| Migration | `MIG-1` | 兼容、迁移、回滚 |
| Eval / Test Objective | `EVAL-1` / `TO-1` | AI 评估和测试目标 |
| Gate | `GATE-1` | 阶段阻断条件 |

类型不是封闭枚举；新增前缀必须能解释为什么现有类型表达不了。

### 四态

| 状态 | 含义 | 必填补充 |
|---|---|---|
| `required` | 本迭代必须实施 | 下游 task |
| `verify-only` | 不要求改代码，但必须验证 | 验证方法 |
| `deferred` | 已确认延期 | 原因 + 用户确认 |
| `n/a` | 对本场景不适用 | 判定依据 |

空状态、未知状态、缺少必填补充都视为 Gate 失败。

## 文档契约

### Implementation Item Registry

Design 文档在汇总区生成：

```markdown
## 实施设计项清单

| ID | 类型 | 设计项 | 来源章节 | 影响范围 | 状态 | 验证/理由 |
|---|---|---|---|---|---|---|
| LOG-1 | Log | task.created 结构化日志 | 基础日志设计 | coordinator | required | 集成测试检查事件与字段 |
```

生成规则：

- 能独立实施、验证、延期或判定不适用的内容必须单列。
- 同一行为在 Q、BF、TO 中已有 ID 时复用。
- 背景、解释、被否决方案和非规范性示例不进入清单。
- 每个规范性章节要能正向找到 Registry 项；每个 Registry 项要能反向找到来源章节。

### Plan task

现有 `covers` 保持不变，新增：

```markdown
**designCovers**
- BF1
- LOG-1
- SEC-1
```

- `covers`：Define 路径和约束。
- `designCovers`：Design Registry 中 `required` 的 ID。
- Standard 场景没有 Design 文档时写 `designCovers: N/A (Standard)`。

不能把两类 ID 混入同一个字段，否则反向覆盖无法区分需求缺口和设计缺口。

### Design → Task 覆盖矩阵

```markdown
| Design ID | Task / Verify | 处理方式 | 理由 |
|---|---|---|---|
| LOG-1 | Task 3 | implement | 跟随 coordinator 实现 |
| ALERT-1 | Verify | verify-only | 人工检查告警配置 |
| MIG-2 | — | deferred | 用户确认下一迭代处理 |
```

矩阵以 Registry 为左表做反向遍历。不能只从 task 汇总已有 `designCovers`，因为那样永远看不到没人引用的项。

### Design → Evidence 证据矩阵

```markdown
| Design ID | 结果 | 证据类型 | 证据 |
|---|---|---|---|
| LOG-1 | ✅ | test | 日志事件与脱敏字段测试 |
| SEC-1 | ✅ | inspection | diff 中无敏感 payload 字段 |
```

`required` 和 `verify-only` 都必须有证据；`deferred`、`n/a` 原样带入并显示理由，不伪装成通过。

## 业务流

### BF1：Design 生成实施设计项清单

```text
function Writing.finalizeDesignDocument(docPath):
  read reviewed document                          // 单一 docPath 是事实源
  collect normative decisions and cross-cuts      // 收集 Q/BF/API/LOG/SEC/MIG/TO 等规范性内容
  assign or reuse stable IDs                       // 已有 Q/BF/TO ID 不重复分配
  classify each item into four states              // required/verify-only/deferred/n/a
  reject missing status or required rationale      // 空状态和缺理由不能进入 approved
  append Implementation Item Registry              // Registry 写回同一设计文档
  verify registry ↔ source sections both ways      // 正向和反向都不能有 orphan
  set frontmatter status to approved after verdict // verdict 与生命周期状态一起收口
```

**异常路径**：

- 发现未声明补充文档承载规范性内容：停止 approved，合并回 `docPath`。
- 规范性内容无法判断状态：进入 Open Questions，不能默认 required 或 N/A。
- Registry 项无来源章节：删除错误项或补来源，不允许悬空。

### BF2：Plan 建立双向覆盖

```text
function Plan.validateDesignCoverage(designDoc, tasks):
  require designDoc.status == approved             // in-review 不可作为基线
  read Implementation Item Registry                // Full 场景必须有 Registry
  validate every task.designCovers reference       // 不允许引用未知 ID
  for each item in Registry:                        // 从 Design 左表反向遍历
    if item.status == required:
      require at least one task covers item.id      // 无 task 即 orphan，回 Design/Plan 补
    if item.status == verify-only:
      require verification method                  // 没验证方法不能交给 Verify
    if item.status in deferred or n/a:
      require rationale and confirmation            // 禁止用状态词掩盖遗漏
  output Design → Task Coverage Matrix              // 矩阵进入 Plan Validation
```

**异常路径**：

- Full 旧文档没有 Registry：明确返回 Design 回填，不静默降级成“已覆盖”。
- Standard 无 Design：`designCovers: N/A (Standard)`，继续只走 restate 覆盖。
- task 引用未知 ID：视为计划与设计版本漂移，停止确认。

### BF3：Build 保留实施映射

```text
function Build.completeTask(task, implementationResult):
  lock task scope and designCovers                  // 实施方不能自行改覆盖范围
  implement and verify task                         // 维持现有红绿循环
  collect changed files and test evidence           // 每个 task 留实施证据
  report completed designCovers                     // 结果显式带回对应 Design ID
  reject missing or extra claimed IDs               // 不能漏报或冒领设计项
```

Build 编排者在所有 task 完成后汇总 `designCovers`，对照 Plan Coverage Matrix 的 required 项。Plan 中存在、但没有任何已完成 task 报告的 ID，Build Gate 失败。

### BF4：Verify 建立设计符合性证据

```text
function Verify.auditDesignConformance(designDoc, plan, buildResult):
  read Registry and Coverage Matrix                 // 读取批准的设计基线和实施映射
  for each required or verify-only item:
    identify test, inspection, demo or manual proof // 证据类型按设计项选择
    run or collect fresh evidence                   // 不接受“代码看起来对”
    record pass or fail with evidence               // 输出 Design → Evidence 矩阵
  if any item failed or lacks evidence:
    return to Build                                 // 缺证据不宣称完成
```

Verify 继续保留现有 SC、路径和约束核对；Design Evidence 是新增维度，不替代 Define 验收。

## 异常与失败模式

| 所属 BF | 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|---|
| BF1 | 文档拆分 | 规范性内容只在补充文档 | 合并回单一 `docPath`，Review 重跑 | 上抛到 Design |
| BF1 | 状态不明 | 设计项没有四态 | 进入 Open Questions | 上抛给用户 |
| BF2 | 设计未批准 | frontmatter 不是 approved | 拒绝 Plan Enter Gate | 上抛到 Design |
| BF2 | orphan required | required ID 无 task | 补 task 或回 Design 改状态 | 上抛到 Plan |
| BF2 | 未知 ID | task 引用 Registry 外 ID | 停止确认，重新加载 Design | 上抛到 Plan |
| BF3 | 实施漏报 | task 完成但结果缺 designCovers | task 未完成 | 上抛到 Build |
| BF4 | 证据缺失 | required/verify-only 无新鲜证据 | 标 ❌，回 Build | 上抛到 Verify |

## 单测设计

### BF1

**Registry 完整生成**

- Given：Design 同时包含 BF、日志、安全、迁移和 TO。
- When：Writing 执行汇总与 Review。
- Then：每个独立可实施项出现在 Registry，已有 BF/TO ID 被复用。

**补充文档阻断**

- Given：主文档链接一个包含 9 个日志事件的补充文档。
- When：Design 尝试进入 approved。
- Then：Gate 失败并要求把日志设计合并回单一 `docPath`。

### BF2

**required orphan**

- Given：Registry 有 `LOG-1 required`，所有 task 的 `designCovers` 都没有 `LOG-1`。
- When：Plan Validation 反向遍历 Registry。
- Then：明确报告 orphan `LOG-1`，Plan 不得确认。

**合法四态**

- Given：required 有 task、verify-only 有方法、deferred/n/a 有理由。
- When：Plan Validation 执行。
- Then：覆盖矩阵通过且保留全部四态。

**旧文档**

- Given：Full Design 为 approved，但没有 Registry。
- When：进入 Plan。
- Then：返回 Design 回填；不能默认为覆盖通过。

### BF3

**Build 漏报**

- Given：Plan task 覆盖 `LOG-1`，实现结果未报告 `LOG-1`。
- When：Build 编排者汇总完成结果。
- Then：该 task 保持未完成，Build Gate 失败。

### BF4

**证据缺失**

- Given：`SEC-1 verify-only` 声明通过，但没有测试、检查或人工证据。
- When：Verify 生成 Design Evidence Matrix。
- Then：`SEC-1` 标记为失败并回 Build。

## 实施设计项清单

| ID | 类型 | 设计项 | 来源章节 | 影响范围 | 状态 | 验证/理由 |
|---|---|---|---|---|---|---|
| Q1 | Decision | 单一设计文档内稳定 ID + 双向矩阵 | 方案决策 Q1 | 全链路 | required | TO-1–TO-5 |
| Q2 | Decision | 独立可实施项级粒度 | 方案决策 Q2 | Design/Plan | required | TO-1、TO-2 |
| Q3 | Decision | 四态 + 分阶段闭环 | 方案决策 Q3 | 全链路 | required | TO-1–TO-4 |
| CONTRACT-1 | Contract | 共享 traceability reference 定义三张表和 Gate | 协议单源 | 四个 Skill | required | 结构测试检查所有消费者引用同一 reference |
| BF1 | Business Flow | Design 生成 Registry 并收口 approved 状态 | 业务流 BF1 | dev-design | required | TO-1 |
| BF2 | Business Flow | Plan 反向检查 orphan | 业务流 BF2 | dev-plan | required | TO-2、TO-5 |
| BF3 | Business Flow | Build 保留并汇总 designCovers | 业务流 BF3 | dev-build | required | TO-3 |
| BF4 | Business Flow | Verify 输出 Design Evidence Matrix | 业务流 BF4 | dev-verify | required | TO-4 |
| GATE-1 | Gate | Full Design 必须 approved 且包含 Registry | 文档契约 | Design/Plan | required | TO-1、TO-2 |
| GATE-2 | Gate | required orphan 阻断 Plan | 文档契约 | Plan | required | TO-2 |
| GATE-3 | Gate | Build 完成结果必须覆盖 Plan required IDs | 文档契约 | Build | required | TO-3 |
| GATE-4 | Gate | required/verify-only 必须有新鲜证据 | 文档契约 | Verify | required | TO-4 |
| MIG-1 | Migration | Standard 场景显式 N/A；Full 旧文档回 Design 回填 | Migration / Compatibility | Plan | required | TO-2 |
| LOG-1 | Log | 本功能无运行时路径，不新增业务日志 | Observability | 插件运行时 | n/a | 纯 Skill/文档协议变更；失败诊断由测试消息承担 |
| TO-1 | Test Objective | Design Registry 与 approved/单文档 Gate | 测试目标 | Design | verify-only | 结构测试 |
| TO-2 | Test Objective | Plan 四态与 orphan Gate | 测试目标 | Plan | verify-only | 结构测试 |
| TO-3 | Test Objective | Build designCovers 汇总 | 测试目标 | Build | verify-only | 结构测试 |
| TO-4 | Test Objective | Verify Evidence Matrix | 测试目标 | Verify | verify-only | 结构测试 |
| TO-5 | Test Objective | 9 个日志事件 fixture 回归 | 测试目标 | Plan | verify-only | fixture 测试 |
| TO-6 | Test Objective | 仓库生成链与测试通过 | 测试目标 | 发布物 | verify-only | Node tests + compile/vendor checks |

## 文件影响汇总

```text
skills/references/
  ├── design-traceability.md                         (NEW)  ① ID/类型/四态
  │                                                          ② Registry/Coverage/Evidence schema
  │                                                          ③ 各阶段 Gate 与回退
  └── path-conventions.md                            (改)   ① 增加设计项 ID 与下游消费说明

skills/dev-design/
  ├── SKILL.md                                       (改)   ① final gate 校验 Registry
  │                                                          ② verdict + frontmatter approved + 单 docPath
  ├── decision/SKILL.md                              (改)   ① 决策/领域覆盖作为 Registry 输入
  └── writing/
      ├── SKILL.md                                   (改)   ① 汇总 Registry
      │                                                      ② Review 后同步 approved 状态
      └── references/
          ├── template-feat.md                       (改)   增加实施设计项清单
          ├── template-bug.md                        (改)   增加实施设计项清单
          ├── template-refactor.md                   (改)   增加实施设计项清单
          ├── writing-principles.md                  (改)   增加规范性内容识别原则
          └── design-doc-review.md                   (改)   增加双向完整性与单文档 Gate

skills/dev-plan/
  ├── SKILL.md                                       (改)   ① approved/Registry Enter Gate
  │                                                          ② designCovers
  │                                                          ③ Design → Task 反向矩阵
  └── references/
      ├── task-template.md                           (改)   增加 designCovers
      └── examples/example-plan-output.md            (改)   增加覆盖矩阵示例

skills/dev-build/
  ├── SKILL.md                                       (改)   ① designCovers 汇总 Gate
  └── references/
      ├── dev-build-executing.md                     (改)   task 结果保留 Design ID
      └── dev-build-subagent.md                      (改)   objective/result 保留 Design ID

skills/dev-verify/
  └── SKILL.md                                       (改)   ① Design Evidence Matrix
                                                            ② required/verify-only 逐项证据

skills/devflow/
  └── SKILL.md                                       (改)   Design/Plan/Build/Verify Gate 摘要同步

hooks/
  └── design-traceability.test.mjs                   (NEW)  ① 协议单源消费测试
                                                            ② 四态/orphan Gate 文本契约
                                                            ③ 9 日志项匿名 fixture

plugin/
  └── metadata.json                                  (改)   minor 版本升级

plugins/claude/nocode/                               (生成) compile.platform.mjs
plugins/codex/nocode/                                (生成) compile.platform.mjs
```

实现时不得修改当前工作树里已有的 `skills/agents-launcher/` 及其双平台生成物改动；它们属于用户的另一项工作。

## 验证策略汇总

| TO | 覆盖 | 验证方式 | 通过标准 |
|---|---|---|---|
| TO-1 | BF1、GATE-1 | `hooks/design-traceability.test.mjs` | 协调器、decision、writing、review 同时落实 Registry、approved、单文档 Gate |
| TO-2 | BF2、GATE-2、MIG-1 | 同上 | Plan 明确反向遍历 Registry，四态缺字段会失败 |
| TO-3 | BF3、GATE-3 | 同上 | Build 两种执行模式和协调器均保留 `designCovers` |
| TO-4 | BF4、GATE-4 | 同上 | Verify 生成 Design Evidence Matrix，缺证据回 Build |
| TO-5 | 日志案例 | 匿名 fixture | 9 个日志事件均有 ID 和下游状态；删除任一映射测试失败 |
| TO-6 | 发布链 | Node tests + vendor/platform checks | 全部命令 exit 0，双平台无漂移 |

## 部署与回滚

这是插件 Skill/文档协议更新，无服务部署、数据库迁移或运行时配置变更。

- 发布：升级 minor 版本，生成 Claude/Codex 两个平台发布物。
- 灰度：不需要 Feature Flag；发布前以完整测试和平台 diff 为 Gate。
- 回滚：回滚同一 commit 即同时恢复源码、版本和双平台生成物。
- 监控：无线上指标；以测试失败、平台漂移检查和真实工作流 dogfood 作为反馈。

## 基础日志设计

本功能不新增运行时代码路径，`LOG-1` 判定为 `n/a`。失败可诊断性由确定性测试消息承担：任何 orphan、未知 ID、缺理由或缺证据都必须在失败结果中点名对应 Design ID。

## 术语与缩略语

| 术语 | 定义 |
|---|---|
| 规范性设计项 | 会影响代码、配置或验证结果，必须被实施、验证、延期或判定不适用的设计内容 |
| 实施设计项清单 Implementation Item Registry | Design 文档中全部规范性设计项的单一清单 |
| 双向可追踪性 | 既能从设计项找到下游，也能从下游反查设计来源，并能识别 orphan |
| orphan | 没有下游承接者或没有合法来源的悬空项 |
| `covers` | Plan task 对 Define 路径和约束的覆盖字段 |
| `designCovers` | Plan/Build task 对 Design Registry ID 的覆盖字段 |
| Design Evidence Matrix | Verify 输出的 Design ID 到实现证据映射 |

## Review Log

### 2026-07-23 Writing 自查

- 设计意图：主因、辅助问题和 Out of Scope 清楚，SC 全部在设计中有落点。
- 决策质量：Q1–Q3 均有三个真备选、否决理由、确认状态和影响范围。
- 完整性：成功/失败路径、四态、兼容、测试、部署、回滚和可诊断性齐全。
- 可执行性：共享 reference、各消费 Skill、模板、测试、版本和生成物均有真实路径。
- 内部一致性：Registry、BF、异常表、测试设计和 TO 可互相追踪；无未知 ID。
- 范围：只改跨阶段追踪协议，不引入 DDD、运行时 parser、业务项目或第二事实源。
- 可读性：总图、状态表、契约示例和四条 BF 分层展开，没有元结构标题或长段落墙。
- 验证覆盖：TO-1–TO-6 覆盖工作流.P1–P4、系统.1–4 和约束.1–4。
- Findings：无 Critical、Warning、Open Questions 或 Self-Audit 遗留。
- Verdict：✅ Pass。用户已确认详细设计并选择 Render，frontmatter 已切换为 `approved`。
