---
name: dev-review
description: Use before merging any change, after completing a feature, or when reviewing code. Use when devflow routes to Review stage, or when the user says "review 一下/看看代码/评审/check the code/审一下/有没有问题/帮我review/code review". Also use when the user asks to review a PR or diff. Not for writing or fixing code (use dev-build), or standalone red-team/second-implementation/delegation review outside devflow context (use codex-review rule).
---

# code-review — 多维度代码评审

**Iron Law: Critical 不可 override。fix 改了代码必须回 Build → Verify → 再 Review。没有"这次特殊"。**

自评为主，有异议再升档独立交叉（skeleton §1a），统一 **findings** 分级。对自己写的、另一个 agent 写的、人写的代码都适用。

## 调 reviewing 引擎

dev-review 的评审执行走 `reviewing` 引擎——本 skill 只管 workflow 编排（Gate / 五轴维度 / 简化 / 交接），评审的流程 / 独立性 / 分级 / 派发全交引擎。评审步骤（Step 1 / 3 / 4）里 `Skill(nocode:reviewing)`，声明：

- **对象** = 代码 diff
- **领域维度** = 五轴（正确性 / 可读性 / 架构 / 安全 / 性能），是后续 finding 的 `axis`。Spec 轴（需求对齐）不在 dev-review 查，前移到 Design/Plan/Build（见"Review 的检查范围是 Standards 轴"）
- **方法** = checklist（五轴逐项核查）；碰到 **SQL / schema / migration** 或 **架构决策** 时在声明里点出对象特征，引擎自动加对应领域 method（database / architecture）
- **Context Capsule** = 已拍板决策 / 非目标 / 约束（不带主会话对改动的预期结论）

引擎回 findings + verdict（统一 schema，C/W/S 分级，Q/SA 走 kind）——升档异源交叉 / CLAIM 剥离 / Evidence Gate / Doubt Theater / 分档全由引擎承载，本 skill 不复述。

> Leading word: **findings**。每条 finding 有 id + axis + evidence + fix。没有 evidence 的 finding 是直觉不是评审。

产出：分级 findings 报告（Critical / Warning / Suggestion），用户逐条拍板。Critical 不可 override。

**Review 顺序：先读测试，再读实现。** 测试告诉你代码该做什么，实现告诉你代码怎么做。先看意图再看手段。

**Review 的检查范围是 Standards 轴**（五轴：正确性/可读性/架构/安全/性能），不查需求对齐。

## 非本 skill 请求

写代码/解释函数/需求判断 → 非 review（无 diff）：分别转 Build/直接答/Define。

## Enter Gate

- [ ] Verify Gate 已过（验收标准逐条通过 + 证据齐全）
- [ ] Change sizing 已判断（~100 行好；~300 行可接受；~1000 行先建议 split）
- [ ] 评审范围 = 本次变更涉及的代码（不评历史遗留）

## 领域维度来源（评审时按需取）

安全 / 架构 / 数据库维度由引擎承载（声明对象特征即可，详见上文"调 reviewing 引擎"）；其余轴按需 Read dev-review 自己的 guide：

| 轴 / 检查 | 取什么 | 用来做什么 |
|---|---|---|
| **安全 / 架构 / 数据库轴** | 声明对象特征，引擎自选领域 method | OWASP / Deep-Shallow / SQL 反模式·RLS 等由引擎 method 承载 |
| 性能轴 | Read `{NOCODE_SKILL_REF}/performance-guide.md` | N+1 / 重渲染 / bundle 反模式 |
| 测试质量 | Read `{NOCODE_SKILL_REF}/testing-guide.md` | DAMP / 替身偏好序 / 金字塔 |
| UI 代码 | Read `{NOCODE_SKILL_REF}/frontend-guide.md` | 组件模式 / Avoid AI Aesthetic / WCAG |

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
Task 0: 准备评审上下文
  Sub-steps: 确定 diff 范围 + 五轴维度 + Context Capsule（评审执行调 Skill(nocode:reviewing)，档位/流程引擎判）
  Gate: diff 范围 + 五轴维度 + Capsule 就绪

Task 1: Five-Axis Review（调 reviewing 引擎）
  Sub-steps: Skill(nocode:reviewing) 传 diff + 五轴维度 + Capsule，引擎按 checklist 逐轴过（碰 SQL/架构声明对象特征，引擎加 method）
  Gate: 五轴逐轴过，每轴至少一条 finding

Task 2: Simplification Pass
  Sub-steps: Chesterton's Fence（删前 git blame）+ dead code
  Gate: 简化项已识别

Task 3: 升档异源交叉（引擎判）
  Sub-steps: 引擎按升档判据决定是否派异源交叉；升档 / CLAIM 剥离 / codex 降级全由引擎承载，本 skill 不复述
  Gate: 引擎给出是否升档 + 独立性档位声明

Task 4: Findings Triage（对应 Step 4）
  Sub-steps: 套统一契约 schema 分级（Critical/Warning/Suggestion + kind），过 Evidence Gate
  Gate: findings 呈现给用户

Task 5: 用户 approve
  Sub-steps: Critical 全 fix + 用户逐条拍板 Warning
  Gate: Critical 清零 + 用户拍板

Task 6: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Review 完成（findings 统计 + Critical/Warning 处置）→ 建议进 Land → 等用户拍板后调 Skill(nocode:dev-land)
  Gate: 用户拍板进入 Land（这一步不勾，Review 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: Five-Axis Review（checklist 方法 · 主路）

调 `Skill(nocode:reviewing)` 传 diff 范围 + 五轴维度 + Context Capsule（已拍板决策 / 非目标 / 约束，不带预期结论），引擎按 checklist 逐轴过 diff、每轴显式标 ✅/⚠️/❌（五轴详细检查点见 `references/five-axis-guide.md`，随声明给引擎）：

**打包前先读 Build 各 task 的 Quality Review verdict**：可读性/架构/正确性（对应 Conventions/Structure/Quality）不再通读全部文件，只找合并后才出现的增量问题（循环依赖/重复抽象/职责重叠），per-task 已挑过的不重复记。**安全/性能轴仍全量强制检查**——Build 未覆盖这两维，这里是唯一一次系统检查。

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| 正确性 | 逻辑对吗？边界处理了吗？ | off-by-one / race / null 未防 |
| 可读性 | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 魔法数 |
| 架构 | 职责分对了吗？依赖方向？ | 循环依赖 / 与现有 pattern 不一致 |
| 安全 | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 密钥硬编码 |
| 性能 | 不必要的开销？ | N+1 / unbounded fetch / 缺分页 |

**Review 中测试评估**：测试是否会在重构中存活？重命名内部函数测试就挂 = 测的是实现不是行为。

**五轴必须逐轴过**——不能只过正确性就跳到 simplification。每轴至少检查一个具体点、记一条 finding（即使是"此轴未发现问题"），确保没跳过。

**完整示例**：一段 diff 走完五轴、产出 C1/W1/S1 分级 findings（含 Structural Remedy）见 `references/examples/example-review-findings.md`。

### Step 2: Simplification Pass

只针对本次变更，不改行为（详见 `references/simplification-guide.md`）。
- **Chesterton's Fence**：删代码前先 `git blame` 理解它为什么存在。不懂就不删
- **Rule of 500**：函数 > 50 行拆，文件 > 500 行拆。拆职责不拆行数
- **Dead code**：识别 → 列出 → 问用户 → 确认后再删
- **Testability**：接受依赖不创建依赖（`processOrder(order, gateway)` 而非内部 `new`）；返回结果不副作用；接口面积小。可测的形状 = 好的形状

### Step 3: 升档异源交叉（引擎判）

主路审完，是否派异源交叉由引擎按升档判据决定（判据/CLAIM剥离/降级细节见上文"调 reviewing 引擎"，不复述）。dev-review 只需把五轴维度 + Context Capsule 传全（Capsule 尽量全——triage 能滤独立路误报，补不回漏报）。引擎回：是否升档 + 合并后 findings + 独立性档位声明。

### Step 4: Findings Triage

引擎返回的每条 finding 套统一契约 schema（id / severity / kind / axis=五轴名 / location / evidence / finding / fix / source）——字段定义单源在引擎 findings-contract，本 skill 不复述。dev-review 拿到 findings 后做下面的 triage。

> `action`(C/W/S) 即 `severity`，1:1 直通；顶层加 `verdict{approved, counts, recommendation}`，有未处置 Critical 则 `approved:false`。

**Evidence Gate 由引擎把关**：代码事实类 finding 缺 `location` 已被引擎降 `open-question`——dev-review 直接用引擎给的分级，不重判。

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
| "这个改动简单，跳过某 Step 或不建 TaskCreate" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权（详见 agent-catalog-using.md「进了 skill 就走完」） |

## Red Flags

- 五轴只过了正确性，安全/性能跳过
- finding 写成"感觉怪"——没有 file:line + evidence
- 1000 行 diff 直接开评，没先建议 split
- 对外部 reviewer 每条都"good point"全盘照改
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
