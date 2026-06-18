---
name: code-review
description: Use before merging any change, after completing a feature, or when reviewing code. Use when devflow routes to Review stage, or when the user says "review 一下/看看代码/评审/check the code".
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

## Entry Gate

- [ ] Verify Gate 已过（验收标准逐条通过 + 证据齐全）
- [ ] Change sizing 已判断（~100 行好；~300 行可接受；~1000 行先建议 split）
- [ ] 评审范围 = 本次变更涉及的代码（不评历史遗留）

## 领域指南（评审时按需 Read）

| 领域 | 何时 Read | 用来做什么 |
|---|---|---|
| `references/security-guide.md` | 过安全轴时 | OWASP 逐条 / 三层边界 / AI/LLM 安全 |
| `references/performance-guide.md` | 过性能轴时 | N+1 / 重渲染 / bundle 反模式 |
| `references/architecture-principles.md` | 过架构轴时 | Deep/Shallow / Seam 纪律 / Hyrum's Law |
| `references/testing-guide.md` | 审测试质量时 | DAMP / 替身偏好序 / 金字塔 |
| `references/frontend-guide.md` | 审 UI 代码时 | 组件模式 / Avoid AI Aesthetic / WCAG |

## Checklist (TaskCreate)

1. **Five-Axis Self-Review** — 正确性 → 可读性 → 架构 → 安全 → 性能
2. **Simplification Pass** — Chesterton's Fence + dead code
3. **Codex Cross-Review** — 独立交叉评（不可用则降级并明说）
4. **Findings Triage** — 统一 schema 分级，呈现给用户
5. **用户 approve** — Gate：Critical 全 fix + 用户逐条拍板 Warning

## 协议

### 7a. Five-Axis Self-Review

按五轴逐一过 diff（详细检查点见 `references/five-axis-guide.md`）：

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| 正确性 | 逻辑对吗？边界处理了吗？ | off-by-one / race / null 未防 |
| 可读性 | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 魔法数 |
| 架构 | 职责分对了吗？依赖方向？ | 循环依赖 / 与现有 pattern 不一致 |
| 安全 | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 密钥硬编码 |
| 性能 | 不必要的开销？ | N+1 / unbounded fetch / 缺分页 |

安全详见 `references/security-guide.md`。性能详见 `references/performance-guide.md`。

**Review 中测试评估**：测试是否会在重构中存活？重命名内部函数测试就挂 = 测的是实现不是行为——这是测试质量问题不是代码质量问题。

### 7b. Simplification Pass

只针对本次变更，不改行为（详见 `references/simplification-guide.md`）。
- **Chesterton's Fence**：删代码前先 `git blame` 理解它为什么存在。不懂就不删
- **Rule of 500**：函数 > 50 行拆，文件 > 500 行拆。拆职责不拆行数
- **Dead code**：识别 → 列出 → 问用户 → 确认后再删
- **Testability**：接受依赖不创建依赖（`processOrder(order, gateway)` 而非内部 `new`）；返回结果不副作用；接口面积小。可测的形状 = 好的形状

### 7c. Codex Cross-Review

自评有盲区——单模型 reviewer 与原作者共享同源盲点，不同架构的模型才能抓出来。先探 codex 可用性（`rule-codex-review` 的 `setup --json`），不可用则降级自评 + 明说（不静默跳过）。
合并两路 findings：交集 = 高置信，对称差 = 各自盲点。

**Doubt theater 检测**：连续 2+ 轮 reviewer 有实质发现但 0 条被分类为 actionable = 在验证不是在评审，停下升级。

### 7d. Findings Triage

每条 finding 统一结构：`id`（C1/W1/S1）+ `axis` + `evidence`（file:line + 代码）+ `fix`（可操作的修法）+ `action`（Critical/Warning/Suggestion）。

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

### 7e. Feedback Discipline（收到外部 review 时）

- **禁语**：不说 "Great catch" / "Absolutely right"——performative 同意掩盖未验证
- **unclear → 全部停**：看不懂就停下问清楚，不做部分实现
- **YAGNI**：reviewer 说"加 X 以备将来" → grep 看现在用没用，没用就 push-back
- **push-back**：技术正确 > 社交舒适

**新依赖 5 问**（review 发现新增 import/package）：标准库能否解决？包多大？维护活跃？已知 CVE？License 兼容？答不全 = Warning。

## Exit Gate

- [ ] 所有 Critical 已 fix
- [ ] 用户对 Warning 逐条显式拍板
- [ ] fix 改了代码 → 已回 Build → Verify → 再 Review（回流规则）

## 核心规则（when X → do Y）

- **When** 你觉得"自己写的不用 review" → 自评盲区最大，调 codex 或 subagent
- **When** 你想把 Critical 降级成 Warning → **不可 override**。没有"这次特殊"
- **When** 你要删代码但不知道它为什么存在 → **先 git blame**。不懂就别删
- **When** reviewer 的建议你觉得不对 → 先重读自查，仍确信 → push-back 并给证据
- **When** fix 改了代码 → **必须回 Build → Verify → 再 Review**

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "改动小，扫一眼就行" | off-by-one / 越权常藏在小改动里。小改动也过五轴 |
| "reviewer 说的肯定对" | external 反馈先验证再实现。错的要 push-back |
| "简化顺手就删了" | Chesterton's Fence——先 git blame 查来历 |
| "这次 Critical 特殊" | Critical 不可 override 就是为了挡这句话 |

## Red Flags

- 五轴只过了正确性，安全/性能跳过
- finding 写成"感觉怪"——没有 file:line + evidence
- 1000 行 diff 直接开评，没先建议 split
- 对外部 reviewer 每条都"good point"全盘照改
