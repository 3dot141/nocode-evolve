---
name: define
description: 从模糊任务到明确目标+方案的收敛门。Use when starting any non-trivial task, when requirements are unclear or underspecified ("build me X" without "for whom" or "why now"), when the user explicitly says "澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标", or when devflow routes to Define stage. Also triggers on task descriptions missing at least one of: who the user is, why they want it, what success looks like, what the binding constraint is. Even for seemingly clear tasks, use this skill if you catch yourself silently filling in ambiguous requirements.
---

# nocode-evolve:define — 从模糊到明确

> Goal ⇄ Brainstorm 收敛循环。产出：用户显式确认的结构化 restate + 场景分类。

## 协议

### Step 1: 任务分类（场景路由入口）

判断任务规模，决定 devflow 场景：

| 信号 | 场景 | 后续路径 |
|---|---|---|
| 单文件/单步/改变量名/修文案 | **Mini** | mini-goal → Build-lite → Verify-lite → Land-lite |
| 用户报 bug/测试失败/行为异常 | **Fix** | 复现定义 → Env → Debug → Build → Verify → Review → Land |
| 跨文件 + 实现路径明确 | **Standard** | 完整 Define → Env → Plan → Build → Verify → Review → Land |
| 跨文件 + 需要架构/选型/设计 | **Full** | 完整 Define → Env → Design → Plan → Build → Verify → Review → Land |
| 用户说"整个/整体/全流程" | **Full** | 同上 |

**Mini 场景**：输出 3 行 mini-goal（做什么 + 验收标准 + 不做什么），用户确认后退出 Define，进 Build-lite。不走后续完整流程。

**Fix 场景**：Define 侧重复现——写出重现步骤 + 预期 vs 实际行为 + 影响范围。

**Standard/Full**：进 Step 2 完整 Define 循环。

### Step 2: Goal — 需求澄清 + 目标定义

**2a. 假设先行**

动手问问题之前，先写下你当前的判断：

```
HYPOTHESIS: 一句话，你认为用户想要什么
CONFIDENCE: 0-100%（< 70% 附理由——什么还不确定）
```

这迫使你诚实。如果你写了高置信度但答不出用户接下来三个问题的反应，置信度是假的。

**2b. 一次一问，附带猜测**

```
Q: 一个聚焦问题
GUESS: 你对答案的假设 + 产出假设的理由
```

等用户回答后再问下一个。不批量提问——批量鼓励泛泛作答，而且第三个问题常常取决于第一个的答案。

附猜测的目的：用户纠正一个错误猜测比从零生成答案更快。风险是用户礼貌性同意——偶尔故意猜一个你预期会被推翻的方向来缓解。

**2c. 识别 "want vs should want"**

危险答案：用户说的是"聪明答案听起来像什么"而不是真正想要什么。

信号：
- "我应该..."、"最佳实践是..."、"标准做法是..."
- 用架构/工程 buzzword 当目标（"可扩展"、"现代"、"robust"）
- "大多数应用都这么做"

一个问题常常比前五个更有用：

> "如果不需要向任何人解释，你真正想要的是什么？"

**2d. 产出结构化 restate**

当置信度 ≥ 95%（可检验测试：你能预测用户对下三个问题的反应）：

```
RESTATE:
- Outcome:      一句话——最终产出什么
- User:         一句话——谁受益
- Why Now:      一句话——什么变了导致现在要做
- Success:      一句话——怎么知道做成了（可量化）
- Constraint:   一句话——约束条件
- Out of Scope: 一句话——明确不做什么
- Assumptions:  列出所有假设

Boundaries (Always / Ask First / Never):
- Always: ...
- Ask First: ...
- Never: ...
```

> 参考完整模板见 `references/restate-template.md`

**Out of Scope 不可省略**——一半的对齐偏差来自对"不做什么"的沉默分歧。

**2e. 用户确认**

Gate 是**显式确认**。以下不算确认：
- "随你"/"都行" → 用户在委托。重新提两个具体选项让用户选
- "可以"/"行" → 模糊。追问"有没有要修改的？"
- 沉默然后"那开始吧" → 用户放弃了讨论，不是收敛了。停下问是否遗漏了什么

### Step 3: 方案路径判断

Goal 确认后，判断实现路径：

- 实现路径显而易见 → 跳 Brainstorm，Define 收敛，退出
- 需要设计探索（多条可行路径 / 架构决策 / 技术选型）→ 进 Step 4

### Step 4: Brainstorm — 方案探索

调用 `Skill(superpowers:brainstorming)`，输入为 Step 2 确认的 restate。

**降级**（brainstorming skill 不可用时）：
agent 自行列出 2-3 方案 + 权衡矩阵（维度 × 方案得分），明说"brainstorming skill 不可用，自行探索"。

### Step 5: Confirm — 方案是否改变目标？

方案探索常常发现新约束，改变 Goal 的边界。

- 方案没有改变 Goal → Define 收敛，退出循环
- 方案改变了 Goal（新约束 / 范围调整 / 不可行导致缩减）→ 回 Step 2，带上新发现修正 restate
- 最多循环 3 次。第 3 次仍不收敛 → 停下告诉用户："3 轮后目标和方案仍不稳定，可能有更根本的问题需要先解决"

### 产出

Define 的产出被后续所有阶段消费：
- **Design**：设计文档引用 restate 的验收标准和约束
- **Plan**：任务拆分基于 restate 的成果物和验收标准
- **Build**：TDD 测试用例从验收标准推导
- **Verify**：验收标准逐条核对

## Common Rationalizations

| 借口 | 反驳 |
|---|---|
| "需求很清楚，不用澄清" | 你写不出用户期望结果的一句话 = 不清楚。跑 Step 2a | 
| "问太多问题浪费时间" | 4-6 个问题用几分钟。建错东西用几小时，而且是用户承担代价 |
| "做着做着就明白了" | 做完切换的代价是现在澄清的 10 倍。实现中的发现是返工，不是发现 |
| "用户说'随你'，那就我定" | "随你"是委托不是决定。提两个具体选项让用户选 |
| "先给几个选项让用户挑" | 用户还不知道自己要什么，列选项是扩大搜索空间。提问是缩小搜索空间 |
| "附上猜测会引导用户" | 引导正是目的——纠正错误猜测比凭空生成答案快。风险是阿谀式同意，用偶尔故意猜错来缓解 |
| "聊得够多了，我懂了" | 测试：你能预测用户对下三个问题的反应吗？不能 = 还不懂 |

## Red Flags

- 在同一条消息里问 ≥ 3 个问题（在批量提问，不是在面试）
- 问问题不附猜测（在做问卷，不是在承诺假设）
- 接受"随你"/"都行"作为最终答案
- restate 没有 Out of Scope 行
- 置信度 < 70% 但不附理由
- 在用户确认 restate 之前就写 spec / plan / 代码
- 用户给了 buzzword 答案（"可扩展"/"现代"），没有追问实际需求
- 3 轮后置信度仍没有明显上升——在问错误的问题，需要换方向

## Verification Checklist

- [ ] Step 1 场景分类已输出，用户知道走哪个场景
- [ ] 每轮置信度 < 70% 附有理由
- [ ] 问题一次一个，每个附猜测
- [ ] 至少一次 "want vs should want" 探测（当用户给 buzzword 答案时）
- [ ] 结构化 restate 已输出（Outcome / User / Why Now / Success / Constraint / Out of Scope / Assumptions / Boundaries）
- [ ] 用户显式确认 restate（不是"随你"，不是沉默）
- [ ] 如果进了 Brainstorm，Confirm 步骤检查了方案是否改变 Goal
- [ ] 产出明确标注场景分类，供 devflow 路由
