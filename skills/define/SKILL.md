---
name: define
description: Use when starting any non-trivial task, when requirements are unclear ("build me X" without "for whom" or "why now"), when the user says "澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标", or when devflow routes to Define stage. Also use when a task description is missing who/why/what-success-looks-like.
---

# define — 从模糊到明确

**Iron Law: 问题没定义清就动手 = 赌。建错东西的代价是澄清的 10 倍，而且由用户承担。**

定义问题边界，不选解法。产出一份 **restate**——用户显式确认的结构化目标。brainstorming 用于发散问题空间，不延伸到解法选择。Define 回答"做什么 + 为什么做 + 怎么算做成了"。"怎么做"是 Design 的事。

> Leading word: **restate**。所有对话收敛到这份产出物。没有确认的 restate 就没有 Define 的产出。

## Entry Gate

- [ ] 用户有任务描述或意图

## Checklist (TaskCreate)

进入 Define 后，为以下步骤各建一条 task，按顺序完成：

1. **场景分类** — AskUserQuestion 确认 Mini/Fix/Standard/Full
2. **假设先行** — HYPOTHESIS + CONFIDENCE，≥ 95% 可走快速路径
3. **一次一问澄清** — 代码能自答的不问用户；用 AskUserQuestion 给选项
4. **产出 restate** — 含 Quality Bar + Collaboration Pact
5. **用户确认** — AskUserQuestion 三选：确认/修改/重来

## 协议

### Step 1: 场景分类

判断**问题性质**（不是解法），用 AskUserQuestion 确认：

| 信号 | 场景 | 后续路径 |
|---|---|---|
| 单文件/单步/改变量名/修文案 | **Mini** | mini-goal → Build-lite → Verify-lite → Land-lite |
| 用户报 bug/测试失败/行为异常 | **Fix** | 复现定义 → Env → Debug → Build → Verify → Review → Land |
| 跨文件 + 实现路径明确 | **Standard** | Define → Env → Plan → Build → Verify → Review → Land |
| 跨文件 + 需要架构/选型/设计 | **Full** | Define → Env → Design → Plan → Build → Verify → Review → Land |

AskUserQuestion 把你的判断 + 理由放推荐选项，其余场景放备选。拿不准偏向 Full。

Mini → 输出 3 行 mini-goal（做什么 + 验收标准 + 不做什么），用户确认后退出。
Fix → 侧重复现：重现步骤 + 预期 vs 实际 + 影响范围。
Standard/Full → 进 Step 2。

### Step 2: 假设先行

先写出判断再提问：

```
HYPOTHESIS: 一句话，你认为用户想要什么
CONFIDENCE: 0-100%（< 70% 附理由）
```

**快速路径**：如果之前会话已充分讨论，置信度已 ≥ 95% → 跳过 Step 3 面试，直接出 restate 给用户确认。不是每个任务都需要 4-6 轮提问。

### Step 3: 一次一问澄清

**提问前自查：这个问题的答案在代码里吗？**
- 能通过 Read / grep 确认的事实（什么框架、有没有类似实现、现有接口长什么样）→ 先自答，不问用户
- 只有用户才能回答的问题（意图、优先级、约束、business context）→ 用 AskUserQuestion

**能给选项就给选项**。用户点选比手打快，也更不容易礼貌性同意。开放式问题仍可纯文字，但附猜测——用户纠正错误猜测比从零生成答案快。

一次只问一个。第三个问题常常取决于第一个的答案。

**识别 "want vs should want"**：用户说"最佳实践是..."、用 buzzword 当目标（"可扩展"/"现代"）→ 追问"如果不需要向任何人解释，你真正想要的是什么？"

### Step 4: 产出 restate

置信度 ≥ 95% 时产出（完整模板见 `references/restate-template.md`）：

**必填字段**：Outcome / User / Why Now / Success Criteria / Constraint / Out of Scope / Assumptions / Boundaries (Always/Ask First/Never)

**Out of Scope 不可省略**——这是 restate 里最有价值的一行。一半的对齐偏差来自对"不做什么"的沉默分歧。用户确认 Out of Scope 比确认 Outcome 更能防止后续返工。

**Quality Bar**：主动问"怎样算高质量？"。agent 先提 2-4 条可检验标准，用户确认/修改。"代码质量高"不行，"无 lint warning + 关键路径测试覆盖"可以。

**Collaboration Pact**：主动问"我们怎么协作？"。agent 提出：自己做什么、需要用户提供什么、中间检查点。可选引用协作指令（穷尽探索 / 信心验证循环），用户拍板。

### Step 5: 用户确认

用 AskUserQuestion 三选：确认 / 要修改 / 重新来。

以下不算确认：
- "随你"/"都行" → 用户在委托，重新提具体选项
- "可以"/"行" → 追问"有没有要修改的？"
- 沉默后"那开始吧" → 用户放弃了讨论，停下问是否遗漏

## Exit Gate

- [ ] restate 已产出，用户显式确认（AskUserQuestion 选了"确认"）
- [ ] 场景分类已标注
- [ ] 后续阶段输入齐全：Full → Design 可用 restate，Standard → Plan 可用 restate

## 核心反模式

| 反模式 | 正确做法 |
|---|---|
| 批量提问（≥ 3 个一条消息） | 一次一问 |
| 可以自答的事实去问用户 | 先读代码，只问用户才能答的 |
| 接受"随你"作为确认 | 那是委托，重新提具体选项 |
| restate 确认前就写 spec/plan/代码 | 问题没定义清就动手 = 赌 |
| 在 Define 里做方案选型 | 那是 Design 的事 |
| 用户给 buzzword 不追问 | "可扩展"→ 追问真正想要什么 |

## Red Flags

- 置信度 < 70% 不附理由
- restate 缺 Out of Scope 或 Quality Bar
- 3 轮后置信度没明显上升——在问错误的问题
- 用户 buzzword 答案没追问
- 启用了"穷尽探索"但只试 1-2 种方法
