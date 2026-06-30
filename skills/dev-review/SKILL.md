---
name: dev-review
description: Use before merging any change, after completing a feature, or when reviewing code. Use when devflow routes to Review stage, or when the user says "review 一下/看看代码/评审/check the code/审一下/有没有问题/帮我review/code review". Also use when the user asks to review a PR or diff.
---

# code-review — 多维度代码评审

**Iron Law: Critical 不可 override。fix 改了代码必须回 Build → Verify → 再 Review。没有"这次特殊"。**

自评 + 独立交叉评 + 统一 **findings** 分级。对自己写的、另一个 agent 写的、人写的代码都适用。

> Leading word: **findings**。每条 finding 有 id + axis + evidence + fix + action。没有 evidence 的 finding 是直觉不是评审。

产出：分级 findings 报告（Critical / Warning / Suggestion），用户逐条拍板。Critical 不可 override。

**Review 顺序：先读测试，再读实现。** 测试告诉你代码该做什么，实现告诉你代码怎么做。先看意图再看手段。

**双轴意识**：Review 隐含两个正交维度——
- **Standards 轴**：代码标准合规（五轴 review 覆盖的就是这个）
- **Spec 轴**：实现与需求/PRD/restate 是否对齐（过建了？欠建了？偏了？）

一个改动可能一轴过一轴挂。五轴 review 做完后，回 Define 的 restate / Design 的设计文档核对 Spec 轴。两轴分别报 findings，不合并——合并会让一轴掩盖另一轴。

**Spec 轴含路径覆盖检查**（详见 Step 6）。核对对象不止文档整体，要到**路径级粒度**——拿 **PRD 原始路径清单**（不只 Design 的 TO 表）逐条比对代码。这道检查能兜住 Design 阶段的漏项：Design 漏了某条路径 → TO 表里没有 → 但 PRD 清单有 → Review 在这里拦住，不用等 Verify。

## 非本 skill 请求

"写代码" / "解释函数" / "需求合不合理" → 不是 review。没有 diff 就没有 evidence，无法 review。写代码 → Build，解释 → 直接答，需求判断 → Define。

## Enter Gate

- [ ] Verify Gate 已过（验收标准逐条通过 + 证据齐全）
- [ ] Change sizing 已判断（~100 行好；~300 行可接受；~1000 行先建议 split）
- [ ] 评审范围 = 本次变更涉及的代码（不评历史遗留）
- [ ] Spec 轴输入就位：PRD 原始路径清单 + restate 路径↔SC 绑定 + Design TO 表（Full 场景）

## 领域指南（评审时按需 Read）

| 领域 | 何时 Read | 用来做什么 |
|---|---|---|
| `{NOCODE_SKILL_REF}/security-guide.md` | 过安全轴时 | OWASP 逐条 / 三层边界 / AI/LLM 安全 |
| `{NOCODE_SKILL_REF}/performance-guide.md` | 过性能轴时 | N+1 / 重渲染 / bundle 反模式 |
| `{NOCODE_SKILL_REF}/architecture-principles.md` | 过架构轴时 | Deep/Shallow / Seam 纪律 / Hyrum's Law |
| `{NOCODE_SKILL_REF}/testing-guide.md` | 审测试质量时 | DAMP / 替身偏好序 / 金字塔 |
| `{NOCODE_SKILL_REF}/frontend-guide.md` | 审 UI 代码时 | 组件模式 / Avoid AI Aesthetic / WCAG |
| `{NOCODE_SKILL_REF}/path-conventions.md` | 过 Spec 轴路径检查时 | 路径 ID 体系 / 状态标注 / 下游消费协议 |

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
Task 1: Five-Axis Self-Review
  Sub-steps: 正确性 → 可读性 → 架构 → 安全 → 性能逐轴过 diff
  Gate: 五轴逐轴过，每轴至少一条 finding

Task 2: Simplification Pass
  Sub-steps: Chesterton's Fence（删前 git blame）+ dead code
  Gate: 简化项已识别

Task 3: Codex Cross-Review
  Sub-steps: 独立交叉评（不可用则降级并明说）
  Gate: 两路 findings 合并或降级标注

Task 4: Path Coverage Check
  Sub-steps: Spec 轴，拿 PRD 原始路径清单逐条比对实现
  Gate: 路径覆盖率报告产出

Task 5: Findings Triage
  Sub-steps: 统一 schema 分级（Critical/Warning/Suggestion）
  Gate: findings 呈现给用户

Task 6: 用户 approve
  Sub-steps: Critical 全 fix + 用户逐条拍板 Warning
  Gate: Critical 清零 + 用户拍板

Task 7: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Review 完成（findings 统计 + Critical/Warning 处置）→ 建议进 Land → 等用户拍板后调 Skill(nocode-evolve:dev-land)
  Gate: 用户拍板进入 Land（这一步不勾，Review 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: Five-Axis Self-Review

按五轴逐一过 diff（详细检查点见 `references/five-axis-guide.md`）：

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| 正确性 | 逻辑对吗？边界处理了吗？ | off-by-one / race / null 未防 |
| 可读性 | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 魔法数 |
| 架构 | 职责分对了吗？依赖方向？ | 循环依赖 / 与现有 pattern 不一致 |
| 安全 | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 密钥硬编码 |
| 性能 | 不必要的开销？ | N+1 / unbounded fetch / 缺分页 |

安全详见 `{NOCODE_SKILL_REF}/security-guide.md`。性能详见 `{NOCODE_SKILL_REF}/performance-guide.md`。

**Review 中测试评估**：测试是否会在重构中存活？重命名内部函数测试就挂 = 测的是实现不是行为。

**五轴必须逐轴过**——不能只过正确性就跳到 simplification。每轴至少检查一个具体点、记一条 finding（即使是"此轴未发现问题"），确保没跳过。

**完整示例**：一段 diff 走完五轴、产出 C1/W1/S1 分级 findings（含 Structural Remedy）见 `references/examples/example-review-findings.md`。

### Step 2: Simplification Pass

只针对本次变更，不改行为（详见 `references/simplification-guide.md`）。
- **Chesterton's Fence**：删代码前先 `git blame` 理解它为什么存在。不懂就不删
- **Rule of 500**：函数 > 50 行拆，文件 > 500 行拆。拆职责不拆行数
- **Dead code**：识别 → 列出 → 问用户 → 确认后再删
- **Testability**：接受依赖不创建依赖（`processOrder(order, gateway)` 而非内部 `new`）；返回结果不副作用；接口面积小。可测的形状 = 好的形状

### Step 3: Codex Cross-Review

自评有盲区——单模型 reviewer 与原作者共享同源盲点，不同架构的模型才能抓出来。先探 codex 可用性（`rule-codex-review` 的 `setup --json`），不可用则降级自评 + 明说（不静默跳过）。
合并两路 findings：交集 = 高置信，对称差 = 各自盲点。

**Doubt theater 检测**：连续 2+ 轮 reviewer 有实质发现但 0 条被分类为 actionable = 在验证不是在评审，停下升级。

### Step 4: Findings Triage

每条 finding 统一结构：`id`（C1/W1/S1）+ `axis` + `evidence`（file:line + 代码）+ `fix`（可操作的修法）+ `action`（Critical/Warning/Suggestion）。

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

### Step 6: Path Coverage Check（Spec 轴路径级核对）

五轴（Standards 轴）查"代码写得对不对"，这一步（Spec 轴）查"该做的路径有没有做"。两件事，分开报 findings。

**输入**：
- **PRD 原始路径清单**（使用路径 / 跨域路径 / 系统路径 / 约束）——这是 source of truth，不是 Design 的 TO 表
- restate 的路径 ↔ SC 绑定
- Design 的 TO 表（辅助参照，但不替代 PRD 原始清单）
- **有 pd-ix/pd-vd 产出时**：`.ix.md` 的覆盖矩阵（页面 + 交互）作为前端实现完整度的对照基准——IA 中列出的每个页面/视图/交互在代码里都有对应实现吗？`data-testid` 命名是否和 `.vd.md` 定义一致？

为什么拿 PRD 原始清单而非 TO 表：Design 漏掉某条路径时，TO 表里也没有这条，只对照 TO 表会跟着漏。PRD 原始清单是上游 source，对照它才能兜住 Design 的遗漏。路径 ID 体系见 `{NOCODE_SKILL_REF}/path-conventions.md`。

**逐条核对**：
1. **每条路径** → 实现里有没有对应代码？走查入口、关键步骤、异常分支、边界
2. **每条约束** → 有没有对应的校验逻辑？（约束是跨路径不变量，如"退款 ≤ 实付"，要有显式守卫）
3. **每条系统路径** → 后台行为/回调/定时任务在代码里落地了吗？

**产出路径覆盖率报告**：

```
| 路径/约束 | 实现位置 | 覆盖 | 备注 |
|---|---|---|---|
| 订单.P1 | order/create.ts:45 | ✅ 覆盖 | |
| 订单.P2 | order/cancel.ts:30 | ⚠️ 部分 | 缺"已发货不可取消"异常分支 |
| 约束.1 | — | ❌ 未覆盖 | 退款金额无上限校验 |
| 系统.1 | webhook/pay.ts:12 | ✅ 覆盖 | |
```

- **未覆盖 / 部分覆盖** → 标 reason，转 Spec 轴 finding（Critical 还是 Warning 看影响）
- 这是 Build 之后的兜底关卡。Design Review 是第一道（设计层），这里是第二道（代码层）。两道都没拦住才会漏到 Verify

## Exit Gate

- [ ] 所有 Critical 已 fix
- [ ] 用户对 Warning 逐条显式拍板
- [ ] fix 改了代码 → 已回 Build → Verify → 再 Review（回流规则）
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Review 完成（含 findings 统计 + Critical/Warning 处置结果），建议下一阶段：Land（`nocode-evolve:dev-land`）。列出 Land 阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

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
- Spec 轴只对照 Design 的 TO 表，没回 PRD 原始路径清单（Design 漏的路径会跟着漏）
- 约束（跨路径不变量）没逐条查校验逻辑，只看了单条路径功能
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
