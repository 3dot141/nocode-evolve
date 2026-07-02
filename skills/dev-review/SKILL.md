---
name: dev-review
description: Use before merging any change, after completing a feature, or when reviewing code. Use when devflow routes to Review stage, or when the user says "review 一下/看看代码/评审/check the code/审一下/有没有问题/帮我review/code review". Also use when the user asks to review a PR or diff. Not for writing or fixing code (use dev-build), or standalone red-team/second-implementation/delegation review outside devflow context (use codex-review rule).
---

# code-review — 多维度代码评审

**Iron Law: Critical 不可 override。fix 改了代码必须回 Build → Verify → 再 Review。没有"这次特殊"。**

自评为主，有异议再升档独立交叉（skeleton §1a），统一 **findings** 分级。对自己写的、另一个 agent 写的、人写的代码都适用。

## 引入 reviewing 框架

dev-review 是 `reviewing` 框架的一个细则（评审对象 = 代码 diff）。**进入后先 Read 框架骨架，套通用流程**，不在本 skill 重写流程/独立性/分级语义：

1. `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md` —— 7 步流程 + 分档 + 方法选择表 + 公共能力 how-to
2. `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md` —— finding / verdict schema + 5→3 分级映射 + Evidence Gate

dev-review 在框架里的定位（其余照骨架走）：

- **领域维度（框架第 3 步注入点）= 五轴**。正确性 / 可读性 / 架构 / 安全 / 性能，是 Standards 轴的领域维度，也是后续 finding 的 `axis`。Spec 轴（需求对齐）不在 dev-review 查，前移到 Design/Plan/Build 阶段（见下方"Review 的检查范围是 Standards 轴"）。
- **选方法（框架第 4 步 selectMethods）= `checklist`（五轴逐项核查，主路默认）**；`dual-review`（异源双评）是**升档预案**——自审完成后命中 skeleton §1a 升档判据才派，不默认跑。**按对象加选 card**：审到 SQL / schema / migration → 加选 `{NOCODE_SKILL_REF}/reviewing/methods/database-method.md`；审到架构决策 → 加选 `{NOCODE_SKILL_REF}/reviewing/methods/architecture-method.md`（不经 manifest，靠 selectMethods）。
- **findings 套统一契约**：每条 finding 走 findings-contract 的 schema；分级走 C/W/S（dev-review 原生即 C/W/S，1:1 直通 `severity`），Q/SA 走 `kind`。
- **公共能力全走框架**：CLAIM 剥离 / codex 经 `rule-codex-review` 派 / Evidence Gate / Doubt Theater / 分档判定都在 skeleton §4，本 skill 只引用不重写。

> Leading word: **findings**。每条 finding 有 id + axis + evidence + fix。没有 evidence 的 finding 是直觉不是评审。

产出：分级 findings 报告（Critical / Warning / Suggestion），用户逐条拍板。Critical 不可 override。

**Review 顺序：先读测试，再读实现。** 测试告诉你代码该做什么，实现告诉你代码怎么做。先看意图再看手段。

**Review 的检查范围是 Standards 轴**（五轴：正确性/可读性/架构/安全/性能），不查需求对齐。

## 非本 skill 请求

"写代码" / "解释函数" / "需求合不合理" → 不是 review。没有 diff 就没有 evidence，无法 review。写代码 → Build，解释 → 直接答，需求判断 → Define。

## Enter Gate

- [ ] Verify Gate 已过（验收标准逐条通过 + 证据齐全）
- [ ] Change sizing 已判断（~100 行好；~300 行可接受；~1000 行先建议 split）
- [ ] 评审范围 = 本次变更涉及的代码（不评历史遗留）

## 领域维度来源（评审时按需取）

**安全轴 / 架构轴的领域清单已统一为 method card 单源**——selectMethods 选对应 card，**不再 Read 旧 `security-guide.md` / `architecture-principles.md`**（消除重叠）。其余轴仍按需 Read guide。

| 轴 / 检查 | 取什么 | 用来做什么 |
|---|---|---|
| **安全轴** | selectMethods 选 `{NOCODE_SKILL_REF}/reviewing/methods/security-method.md`（card 单源） | OWASP 逐条 / 三层边界 / AI/LLM 安全 |
| **架构轴** | selectMethods 选 `{NOCODE_SKILL_REF}/reviewing/methods/architecture-method.md`（card 单源） | Deep/Shallow / Seam 纪律 / Hyrum's Law |
| 数据库（审到 SQL/schema/migration） | selectMethods 加选 `{NOCODE_SKILL_REF}/reviewing/methods/database-method.md` | SQL 反模式 / 索引 / RLS / 并发 |
| 性能轴 | Read `{NOCODE_SKILL_REF}/performance-guide.md` | N+1 / 重渲染 / bundle 反模式 |
| 测试质量 | Read `{NOCODE_SKILL_REF}/testing-guide.md` | DAMP / 替身偏好序 / 金字塔 |
| UI 代码 | Read `{NOCODE_SKILL_REF}/frontend-guide.md` | 组件模式 / Avoid AI Aesthetic / WCAG |

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
Task 0: Read 框架骨架
  Sub-steps: Read skeleton.md + findings-contract.md，套通用流程；按 §1 分档（轻/重档）
  Gate: 骨架已读 + 档位已定

Task 1: Five-Axis Self-Review（checklist 方法 · 领域维度）
  Sub-steps: 正确性 → 可读性 → 架构 → 安全 → 性能逐轴过 diff（安全/架构轴取对应 card）
  Gate: 五轴逐轴过，每轴至少一条 finding

Task 2: Simplification Pass
  Sub-steps: Chesterton's Fence（删前 git blame）+ dead code
  Gate: 简化项已识别

Task 3: Cross-Review（dual-review · 仅升档，skeleton §1a）
  Sub-steps: 自审完成后过一遍 §1a 升档判据；命中 → CLAIM 剥离 + Context Capsule 派 codex 独立路（经 rule-codex-review；报错 fallback subagent 单跑并明说）；未命中 → 记录「未命中升档判据，自审收口」后跳过（不算跳步）
  Gate: 升档判据已过（命中：两路 findings 合并或降级标注；未命中：跳过理由已记录）

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

### Step 1: Five-Axis Self-Review（checklist 方法 · 领域维度）

这是框架第 4 步选的 `checklist` 方法套 dev-review 的领域维度（五轴）。按五轴逐一过 diff，每轴显式标 ✅/⚠️/❌（详细检查点见 `references/five-axis-guide.md`）：

**先读 Build 各 task 的 Quality Review verdict（有则读）**：可读性/架构/正确性（对应 Build Quality Review 的 Conventions/Structure/Quality）这三轴不再从零通读全部文件——Build per-task 已经查过一遍，这里只找"合并后才出现"的增量问题（多个 task 各自看都合规、合起来才暴露的循环依赖/重复抽象/职责重叠），已经被 per-task 挑过的同类问题不重复记 finding。**安全轴 / 性能轴仍是全量强制检查**——Build 的 Quality Review 没有这两个维度，这里是它们第一次、也是唯一一次被系统性检查。

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| 正确性 | 逻辑对吗？边界处理了吗？ | off-by-one / race / null 未防 |
| 可读性 | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 魔法数 |
| 架构 | 职责分对了吗？依赖方向？ | 循环依赖 / 与现有 pattern 不一致 |
| 安全 | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 密钥硬编码 |
| 性能 | 不必要的开销？ | N+1 / unbounded fetch / 缺分页 |

安全轴 / 架构轴取 method card（`reviewing/methods/security-method.md` / `architecture-method.md`，card 单源，不再 Read 旧 guide）。性能详见 `{NOCODE_SKILL_REF}/performance-guide.md`。

**Review 中测试评估**：测试是否会在重构中存活？重命名内部函数测试就挂 = 测的是实现不是行为。

**五轴必须逐轴过**——不能只过正确性就跳到 simplification。每轴至少检查一个具体点、记一条 finding（即使是"此轴未发现问题"），确保没跳过。

**完整示例**：一段 diff 走完五轴、产出 C1/W1/S1 分级 findings（含 Structural Remedy）见 `references/examples/example-review-findings.md`。

### Step 2: Simplification Pass

只针对本次变更，不改行为（详见 `references/simplification-guide.md`）。
- **Chesterton's Fence**：删代码前先 `git blame` 理解它为什么存在。不懂就不删
- **Rule of 500**：函数 > 50 行拆，文件 > 500 行拆。拆职责不拆行数
- **Dead code**：识别 → 列出 → 问用户 → 确认后再删
- **Testability**：接受依赖不创建依赖（`processOrder(order, gateway)` 而非内部 `new`）；返回结果不副作用；接口面积小。可测的形状 = 好的形状

### Step 3: Cross-Review（dual-review · 仅升档）

**先过 skeleton §1a 升档判据**——五轴自审 + 简化 pass 完成后，命中任一信号（自审出无法自行裁决的 finding / 结论有争议 / 用户显式要求深审 / Doubt Theater）才进本步；全不命中 → 记录「未命中升档判据，自审收口」直接进 Step 4，verdict 独立性标「无（自审）」。

升档后走 `dual-review` 方法的独立路，公共能力走 skeleton §4：

自评有盲区——单模型 reviewer 与原作者共享同源盲点，不同架构的模型才能抓出来。**CLAIM 剥离 + Context Capsule**后（只传 diff + 约束 + 五轴维度 + 中立事实包，不传主路自评结论）派独立路，统一经 `rule-codex-review` 派 codex（不预先探活，直接派），调用报错才 fallback 改派 general-purpose subagent 单跑 + 明说，独立性声明标"同模型（降级）"（不静默跳过、不自演）。
合并两路 findings：同 `[location, axis]` 交集 = 高置信，对称差 = 各自盲点（主会话 triage 只能滤独立路误报，补不回漏报——Capsule 打包尽量全）。

**Doubt theater 检测**（skeleton §4.4）：连续 2+ 轮 reviewer 有实质发现但 0 条被分类为 actionable = 在验证不是在评审，停下升级。

### Step 4: Findings Triage

每条 finding 套**统一契约**（`{NOCODE_SKILL_REF}/reviewing/findings-contract.md` 的 schema）：`id`（C1/W1/S1，特殊性质用 Q1/SA1）+ `severity`（critical/warning/suggestion）+ `kind`（normal/open-question/self-audit，正交于 severity）+ `axis`（五轴名）+ `location`（file:line / `[锚点]`）+ `evidence`（代码摘录）+ `finding`（问题描述）+ `fix`（可操作修法）+ `source`（主路 / 独立路(Codex) / 独立路(subagent)，值域单源见 findings-contract）。

> 原 `action`（Critical/Warning/Suggestion）语义即 `severity`——dev-review 原生就是 C/W/S，1:1 直通，无需映射。最上层加一个 `verdict { approved, counts, recommendation }`：存在未处置 Critical → `approved:false`。

**Evidence Gate**（skeleton §4.3 / 契约约束③）：代码事实类 finding 缺 `location` 不许上 Critical/Warning，降级 `kind=open-question`（待作者核实），防猜测式指控。

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
