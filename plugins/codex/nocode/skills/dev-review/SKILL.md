---
name: dev-review
description: "Use for the default code/PR/diff review path, before merge, after Verify, or when devflow enter…"
---

# review — 多维度代码评审


计划使用 `update_plan`；独立审查使用 `$reviewing`，Land handoff 使用 `$dev-land`。

**Iron Law: Critical 不可 override。fix 改了代码必须回 Build → Verify → 再 Review。没有"这次特殊"。**

默认**主会话五轴自查**，独立交叉仅用户显式要求才派，统一 **findings** 分级。对自己写的、另一个 agent 写的、人写的代码都适用。

## 评审执行方式（默认自查 · 显式要求才升审）

**默认（主路）**：主会话就地按五轴 checklist 逐轴过 diff——不调 reviewing 引擎、不派 subagent/Codex。维度 = 五轴（正确性 / 可读性 / 架构 / 安全 / 性能），是后续 finding 的 `axis`；五轴详细检查点见 `references/five-axis-guide.md`。Spec 轴（需求对齐）不在 dev-review 查，前移到 Design/Plan/Build（见"Review 的检查范围是 Standards 轴"）。自查纪律：放下写代码时的推理，只看 diff 本身站不站得住；代码事实类 finding 必须带 file:line + 摘录，缺 location 不上 Critical/Warning（降 open-question）。

**升审只在两种情况**：
- **用户显式要求**（「深审 / 独立审 / 找 codex / 红蓝军」）→ 按上方平台语法调用 reviewing，传入代码 diff、五轴维度、checklist、已拍板决策/非目标/约束组成的 Context Capsule 和 independent 深度（不带主会话预期结论）
- **diff 命中敏感面**（外部输入 / 认证 / 敏感数据 / SQL·schema·migration / 并发 / 资金 / 不可逆）→ 向用户**一句话建议**升审，用户点头才调，不自动派发

findings 统一 schema（C/W/S 分级，Q/SA 走 kind），来源标注「自审」或独立路。

> Leading word: **findings**。每条 finding 有 id + axis + evidence + fix。没有 evidence 的 finding 是直觉不是评审。

产出：分级 findings 报告（Critical / Warning / Suggestion），用户逐条拍板。Critical 不可 override。

**Review 顺序：先读测试，再读实现。** 测试告诉你代码该做什么，实现告诉你代码怎么做。先看意图再看手段。

**Review 的检查范围是 Standards 轴**（五轴：正确性/可读性/架构/安全/性能），不查需求对齐。

## 非本 skill 请求

"写代码" / "解释函数" / "需求合不合理" → 不是 review。没有 diff 就没有 evidence，无法 review。写代码 → Build，解释 → 直接答，需求判断 → Define。用户显式点名内置 code-review（`/code-review` 或带档位 xhigh/ultra）→ 让内置引擎接，不进本协议；除此之外的 review 意图（含 devflow 阶段链里的 review）默认走本 skill。

## Enter Gate

- [ ] Verify Gate 已过（验收标准逐条通过 + 证据齐全）
- [ ] Change sizing 已判断（~100 行好；~300 行可接受；~1000 行先建议 split）
- [ ] 评审范围 = 本次变更涉及的代码（不评历史遗留）

## 领域维度来源（评审时按需取）

自查时按需 Read 对应领域 guide（升审时这些维度由 reviewing 引擎的领域 method 承载，不需要传）：

| 轴 / 检查 | 取什么 | 用来做什么 |
|---|---|---|
| 安全轴 | Read `${PLUGIN_ROOT}/skills/references/security-guide.md` | OWASP / 注入 / 信任边界 |
| 架构轴 | Read `${PLUGIN_ROOT}/skills/references/architecture-principles.md` | Deep-Shallow / 依赖方向 / seam |
| 数据库（SQL/schema/migration） | 敏感面——自查基础反模式 + 一句话建议升审 | migration 本身命中敏感面提醒 |
| 性能轴 | Read `${PLUGIN_ROOT}/skills/references/performance-guide.md` | N+1 / 重渲染 / bundle 反模式 |
| 测试质量 | Read `${PLUGIN_ROOT}/skills/references/testing-guide.md` | DAMP / 替身偏好序 / 金字塔 |
| UI 代码 | Read `${PLUGIN_ROOT}/skills/references/frontend-guide.md` | 组件模式 / Avoid AI Aesthetic / WCAG |

## 协议

### Step 0: workflow.plan.create

**进入后第一件事**，创建以下全部 task：

```
Task 0: 准备评审上下文
  Sub-steps: 确定 diff 范围 + 五轴维度 + Build 审查覆盖清单（增量/全量判定输入）
  Gate: diff 范围 + 五轴维度 + 覆盖清单就绪

Task 1: Five-Axis Review（主会话自查）
  Sub-steps: 主会话按 checklist 逐轴过 diff（five-axis-guide 检查点；敏感面命中 → 一句话建议升审）
  Gate: 五轴逐轴过，每轴至少一条 finding

Task 2: Simplification Pass
  Sub-steps: Chesterton's Fence（删前 git blame）+ dead code
  Gate: 简化项已识别

Task 3: 独立交叉（仅用户显式要求）
  Sub-steps: 默认跳过并记录「未派独立交叉（默认自审）」；用户显式要求 → 按上方平台语法调用 reviewing，并传入完整 review payload
  Gate: 已记录跳过，或独立路 findings 已合并 + 独立性声明

Task 4: Findings Triage（对应 Step 4）
  Sub-steps: 套统一契约 schema 分级（Critical/Warning/Suggestion + kind），过 Evidence Gate
  Gate: findings 呈现给用户

Task 5: 用户 approve
  Sub-steps: Critical 全 fix + 用户逐条拍板 Warning
  Gate: Critical 清零 + 用户拍板

Task 6: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Review 完成（findings 统计 + Critical/Warning 处置）→ 建议进 Land → 等用户拍板后按上方平台语法调用 dev-land，传入完整上下文信封
  Gate: 用户拍板进入 Land（这一步不勾，Review 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

调用时把上面**每一条** Task 建成稳定计划项，不得提交空计划。每次状态变化都使用上方平台原生计划工具提交稳定顺序的完整状态；Codex 同时最多一个 `in_progress`。

每完成一个标 done。

### Step 1: Five-Axis Review（checklist 方法 · 主路）

主会话按 checklist 逐轴过 diff、每轴显式标 ✅/⚠️/❌（五轴详细检查点见 `references/five-axis-guide.md`；用户显式要求升审时按上方平台语法调用 reviewing，传 diff 范围 + 五轴维度 + Context Capsule）：

**打包前先读 Build 的 Quality Review verdict（per-task 或 checkpoint 批量，有则读，增量提示写进 prompt）**：可读性/架构/正确性（对应 Build Quality Review 的 Conventions/Structure/Quality）这三轴，对**已有 Quality Review 覆盖的 task** 不再从零通读——只找"合并后才出现"的增量问题（多个 task 各自看都合规、合起来才暴露的循环依赖/重复抽象/职责重叠），已经被挑过的同类问题不重复记 finding；**无 Quality Review 覆盖的 task**（`subagent-lite` 跳过审查的非风险 task / `executing` 模式全部 task）这三轴保持全量检查，不按增量处理——覆盖情况以 Build 收尾报告的审查覆盖清单为准。**安全轴 / 性能轴对所有 task 仍是全量强制检查**——Build 的 Quality Review 没有这两个维度，这里是它们第一次、也是唯一一次被系统性检查。

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| 正确性 | 逻辑对吗？边界处理了吗？ | off-by-one / race / null 未防 / 误删被依赖的行为 |
| 可读性 | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 魔法数 |
| 架构 | 职责分对了吗？依赖方向？ | 循环依赖 / 与现有 pattern 不一致 / 契约两端不同步 |
| 安全 | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 密钥硬编码 |
| 性能 | 不必要的开销？ | N+1 / unbounded fetch / 缺分页 |

安全 / 架构轴自查时 Read 上表对应 guide。性能详见 `${PLUGIN_ROOT}/skills/references/performance-guide.md`。

**Review 中测试评估**：测试是否会在重构中存活？重命名内部函数测试就挂 = 测的是实现不是行为。

**五轴必须逐轴过**——不能只过正确性就跳到 simplification。每轴至少检查一个具体点、记一条 finding（即使是"此轴未发现问题"），确保没跳过。

**完整示例**：一段 diff 走完五轴、产出 C1/W1/S1 分级 findings（含 Structural Remedy）见 `references/examples/example-review-findings.md`。

### Step 2: Simplification Pass

只针对本次变更，不改行为（详见 `references/simplification-guide.md`）。
- **Chesterton's Fence**：删代码前先 `git blame` 理解它为什么存在。不懂就不删
- **Rule of 500**：函数 > 50 行拆，文件 > 500 行拆。拆职责不拆行数
- **Dead code**：识别 → 列出 → 问用户 → 确认后再删
- **Testability**：接受依赖不创建依赖（`processOrder(order, gateway)` 而非内部 `new`）；返回结果不副作用；接口面积小。可测的形状 = 好的形状

### Step 3: 独立交叉（仅用户显式要求）

**默认跳过本步**，记录一行「未派独立交叉（默认自审）」。仅当用户显式要求（「深审 / 独立审 / 找 codex / 红蓝军」）才按上方平台语法调用 reviewing——派发 / CLAIM 剥离 / 降级由 reviewing 承载；调用时把五轴维度 + Context Capsule 传全。diff 命中敏感面时在 Step 1 已向用户建议过升审，用户点头即视为显式要求。

### Step 4: Findings Triage

自查（或独立交叉）产出的每条 finding 套统一 schema（id / severity / kind / axis=五轴名 / location / evidence / finding / fix / source=自审或独立路）。dev-review 拿到 findings 后做下面的 triage。

> 原 `action`（Critical/Warning/Suggestion）语义即 `severity`——dev-review 原生就是 C/W/S，1:1 直通，无需映射。最上层加一个 `verdict { approved, counts, recommendation }`：存在未处置 Critical → `approved:false`。

**Evidence Gate**：代码事实类 finding 缺 `location`（file:line）不许上 Critical/Warning，降 `open-question`——自查产出同样受此约束，没有 evidence 的 finding 是直觉不是评审。

**Structural Remedies**：fix 字段不只指出问题，要给出具体重构动作——"replace conditionals with typed dispatcher" 比 "consider refactoring" 有用。具体到"把什么移到哪，怎么改调用方"。几条高置信度的 Structural Remedies 胜过一长串 nit。

**排序原则**：correctness + security 优先呈现。少而精好过事无巨细——如果有一个架构问题和十个 nit，那个架构问题才是 review。

**Finding 分类优先级**（分歧时先排序再讨论）：
1. **Contract misread** — reviewer 误读了需求描述 → 先修需求再说
2. **Valid + actionable** — 真问题且修得动
3. **Valid trade-off** — 真问题但修复成本 > 接受成本 → 显式记录后接受
4. **Noise** — reviewer 缺上下文误报 → 标注来源消除

| 级别 | 含义 | 谁拍板 |
|---|---|---|
| Critical | 阻塞 merge：安全漏洞/数据丢失/功能破坏 | 不可 override |
| Warning | 应修非致命 | 用户决定 fix/skip/defer |
| Suggestion | 改进/风格 | 记录不阻塞 |

### Step 5: Feedback Discipline（收到外部 review 时）

禁语 / unclear→全停 / YAGNI grep / push-back 协议 → 见 `references/feedback-discipline.md`，不在此重述。

**新依赖 5 问**（review 发现新增 import/package）：标准库能否解决？包多大？维护活跃？已知 CVE？License 兼容？答不全 = Warning。

## Exit Gate

- [ ] 所有 Critical 已 fix
- [ ] 用户对 Warning 逐条显式拍板
- [ ] fix 改了代码 → 已回 Build → Verify → 再 Review（回流规则）
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Review 完成（含 findings 统计 + Critical/Warning 处置结果），建议下一阶段：Land（`nocode:dev-land`）。列出 Land 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "改动小，扫一眼就行" | off-by-one / 越权常藏在小改动里。小改动也过五轴 |
| "reviewer 说的肯定对" | external 反馈先验证再实现。错的要 push-back |
| "简化顺手就删了" | Chesterton's Fence——先 git blame 查来历 |
| "这次 Critical 特殊" | Critical 不可 override 就是为了挡这句话 |
| "这个改动简单，跳过某 Step 或不建 workflow.plan.create" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权 |

## Red Flags

- 五轴只过了正确性，安全/性能跳过
- finding 写成"感觉怪"——没有 file:line + evidence
- 1000 行 diff 直接开评，没先建议 split
- 对外部 reviewer 每条都"good point"全盘照改
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 workflow.plan.create、或漏掉最后的交接 task
