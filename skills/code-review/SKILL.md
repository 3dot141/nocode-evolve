---
name: code-review
description: 多维度代码评审 + 简化 + 安全 + 统一 findings 分级。Use before merging any change, after completing a feature, or when reviewing code written by yourself, another agent, or a human. Use when devflow routes to Review stage, or when the user says "review 一下/看看代码/评审/check the code". Covers five axes (correctness, readability, architecture, security, performance), code simplification, and feedback discipline.
---

# nocode-evolve:code-review — 多维度代码评审

> Review 阶段的驾驶舱。**自评 + 独立交叉评 + 统一 findings 分级**。对自己写的、另一个 agent 写的、人写的代码都适用。
>
> 产出：一份分级 findings 报告（Critical / Warning / Suggestion），用户逐条拍板 fix / skip / defer。Critical 类不可 override。

## Checklist（强制 TaskCreate）

进入 Review 后，你必须为以下步骤各建一条 task，按顺序完成：

1. **Change sizing** — 判断 diff 大小，>1000 行先建议 split
2. **Five-Axis Self-Review** — 正确性 → 可读性 → 架构 → 安全 → 性能
3. **Simplification Pass** — Chesterton's Fence + dead code
4. **Codex Cross-Review** — 独立交叉评（不可用则降级并明说）
5. **Findings Triage** — 统一 schema 分级，呈现给用户
6. **用户 approve** — Gate：所有 Critical 已 fix + 用户逐条拍板 Warning

## 适用判断

- **本次变更涉及的代码**才评——不评历史遗留、不评未改动文件（除非它们被本次变更直接影响）。
- **Change sizing 先看**：~100 行 = 好；~300 行 = 可接受；~1000 行 = 太大，先建议 split 再评。大改动评审噪声高、漏检多。

## 子流程（5 步）

```
7a. Five-Axis Self-Review   正确性 → 可读性 → 架构 → 安全 → 性能
7b. Simplification Pass      Chesterton's Fence + Rule of 500 + Dead code
7c. Codex Cross-Review       Claude 自评 + Codex 独立评 (rule-codex-review)
7d. Findings Triage          统一 schema, C/W/S/Q/A 分类 + 分级
7e. Feedback Discipline      收到外部 review 时: 禁语 + unclear→停 + YAGNI + push-back
```

### 7a. Five-Axis Self-Review

按五轴逐一过 diff。每轴的详细检查点 + 好/坏代码对比见 `references/five-axis-guide.md`。

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| **1. 正确性** | 逻辑对吗？边界处理了吗？ | off-by-one / race condition / 错误未处理 / 与 spec 不符 / null 未防 |
| **2. 可读性** | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 复杂度爆炸 / dead code / 魔法数 |
| **3. 架构** | 职责分对了吗？依赖方向对吗？ | 循环依赖 / 抽象层级混乱 / 与现有 pattern 不一致 / 上帝对象 |
| **4. 安全** | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 越权 / 密钥硬编码 / AI prompt 注入 / 供应链 |
| **5. 性能** | 有不必要的开销吗？ | N+1 查询 / unbounded fetch / 缺分页 / 不必要同步 / 重渲染 |

- 安全详见 `references/security-checklist.md`（OWASP + 三层边界 + STRIDE + AI/LLM + 供应链）。
- 性能详见 `references/performance-checklist.md`（N+1 + 分页 + 重渲染 + bundle + profiling）。

### 7b. Simplification Pass

简化只针对**本次变更涉及的代码**，且**不改行为**（preserve behavior exactly）。详见 `references/simplification-guide.md`。

- **Chesterton's Fence**：删代码 / 改结构前，先理解它为什么存在。`git blame` / `git log -p` 查这行的来历——不懂为什么有它，就不要删它。
- **Rule of 500**：函数 > 50 行考虑拆；文件 > 500 行考虑拆。拆的是职责，不是机械切行数。
- **Dead code hygiene**：识别死代码 → 列出来 → **问用户**（可能有外部引用 / 反射调用）→ 确认后再删。不擅自删。
- 简化是建议（多为 Suggestion 级），不是阻塞项——除非简化能消除一个真 bug。

### 7c. Codex Cross-Review

自评有盲区——自己 review 自己看不出自己的假设错。所以**自评后追一道独立交叉评**：

1. 先探 codex 可用性（`rule-codex-review` 的 `setup --json`），不可用则降级为仅自评 + 明说 fallback。
2. 找缺陷用 `review`；挑方案 / 设计假设用 `adversarial-review`（adversarial 提示词，攻击性视角找盲点）。
3. 范围：当前 working-tree；对分支加 `--base <ref>`。
4. 合并两路 findings——交集 = 高置信，对称差 = 各自的盲点。Codex 找到的标注来源。

> 详细调用见 `rules/rule-codex-review.md` 场景 2。护栏：琐碎 / 单文件 / 纯格式改动自己看就行，不拉 codex。

### 7d. Findings Triage（统一 schema）

每条 finding 用统一结构落地，不口语化堆叠：

```
- id:       C1 / W1 / S1 ...（类型字母 + 序号）
- type:     C(Correctness) / W(Readability) / S(Security) / Q(Quality/简化) / A(Architecture/性能)
- axis:     正确性 / 可读性 / 架构 / 安全 / 性能
- evidence: file:line + 具体代码 / 现象（不是"感觉不对"）
- fix:      建议的修法（可操作，不是"考虑优化一下"）
- action:   Critical(blocker) / Warning / Suggestion
```

**分级（action）决定阻塞性**：

| 级别 | 含义 | 谁拍板 |
|---|---|---|
| **Critical** | 阻塞 merge：安全漏洞 / 数据丢失 / 功能破坏 | **不可 override**——必须 fix |
| **Warning** | 应修但非致命 | 用户决定 fix / skip / defer |
| **Suggestion** | 改进 / 简化 / 风格 | 记录，不阻塞 |

**Severity Labels（呈现 finding 时给前缀，与 action 对齐）**：

- `(无前缀)` = 必须修
- `Critical:` = 阻塞 merge（安全漏洞 / 数据丢失 / 功能破坏，blocker 不可 override）
- `Nit:` = 可选（格式 / 风格）
- `Optional:` / `Consider:` = 建议
- `FYI` = 仅供参考，不要求动作

### 7e. Feedback Discipline（当本会话是「收到外部 review」时）

如果你是**收到**别人（人 / 另一个 agent / Codex）的 review 在处理反馈，切到反馈纪律模式。详见 `references/feedback-discipline.md`。

- **禁语**：不说 "Great catch" / "Absolutely right" / "Thanks for..."——performative 同意掩盖未验证。
- **unclear → 全部停**：任何一条看不懂，停下问清楚，**不做部分实现**（半懂的实现比不实现更危险）。
- **YAGNI check**：reviewer 说"加个 X 以备将来"——`grep` 看现在是否真用了，没用就 push-back。
- **push-back**：技术正确 > 社交舒适。reviewer 建议技术上站不住，礼貌但坚定地反驳并给证据。
- **来源分级**：human partner 的反馈权重高；external / 自动 reviewer 的建议**先验证再实现**。

## Dependency Discipline

引入新依赖（review 中发现新增 import / package）必须回答 5 问，答不全 = Warning：

1. 标准库 / 现有依赖能否解决？（**已有方案优先**）
2. 包多大？（bundle / 体积代价）
3. 维护活跃吗？（最近 commit / issue 响应）
4. 有已知 CVE 吗？（`npm audit` / `pip-audit`）
5. License 兼容吗？（GPL 污染 / 商用限制）

## Gate（过了才出 Review 阶段）

- **所有 Critical 已 fix**（blocker 类不可 override）。
- **用户 approve**（逐条过完 Warning，用户对剩余项显式拍板）。

**回流规则**：fix 改了代码 → **必须回 Build → Verify → 再 Review**。不能改完直接当评审通过——改动本身可能引入新缺陷。

## Common Rationalizations

| 借口 | 反驳 |
|---|---|
| "自己写的代码不用 review" | 自评盲区最大——你看不出自己的假设错。这正是 7c 交叉评的理由 |
| "改动小，扫一眼就行" | off-by-one / 越权常藏在小改动里。小改动也过五轴，只是更快 |
| "Critical 这次特殊，先合了" | Critical 不可 override 就是为了挡这句话。安全 / 数据丢失没有"这次特殊" |
| "简化顺手就删了" | Chesterton's Fence——不懂为什么有它就别删。先 git blame，dead code 先问用户 |
| "reviewer 说的肯定对，照做" | external 反馈先验证再实现。技术正确 > 社交舒适，错的建议要 push-back |
| "Great catch！马上改" | 禁语。performative 同意掩盖你还没验证它对不对 |
| "这条看不太懂，先把懂的改了" | unclear 全部停。部分实现比不实现更危险——半懂的改动埋雷 |
| "加个 flag 以后可能用得上" | YAGNI。grep 看现在用没用，没用就不加 |
| "新依赖很流行，直接装" | 5 问答不全不装。流行 ≠ 无 CVE ≠ license 兼容 ≠ 你真需要 |
| "fix 完直接合，不用再测" | 回流规则：改了代码必须回 Build → Verify。fix 可能引新 bug |

## Red Flags

- 评了未改动的历史代码（范围失控，噪声淹没真问题）
- 1000 行的 diff 直接开评，没先建议 split
- 五轴只过了正确性，安全 / 性能跳过
- finding 写成"这里感觉怪"——没有 file:line + evidence
- Critical 被降级成 Warning 好让它"可 skip"
- 删代码没查 git blame / 没问用户就动手
- 对外部 reviewer 每条都说 "good point" 然后全盘照改
- 看不懂的反馈做了"部分实现"
- 新依赖没回答 5 问就进 diff
- fix 完代码没回 Verify 就报"评审通过"

## Verification Checklist

- [ ] 评审范围 = 本次变更涉及的代码（未越界评历史）
- [ ] Change sizing 已判断，>1000 行先建议 split
- [ ] 五轴逐一过（正确性 / 可读性 / 架构 / 安全 / 性能），无跳轴
- [ ] Simplification Pass 做了，删代码前查了 git blame / dead code 问了用户
- [ ] Codex 交叉评做了（或不可用时明说 fallback 自评）
- [ ] 每条 finding 有统一 schema（id / type / axis / evidence / fix / action）
- [ ] Critical 全部 fix（无 override）
- [ ] 收外部 review 时无禁语、unclear 已停、YAGNI 已 grep、技术错误已 push-back
- [ ] 新依赖回答了 5 问
- [ ] fix 改了代码 → 已回 Build → Verify → 再 Review
- [ ] 用户对剩余 Warning 显式 approve
