---
name: define
description: 从模糊任务到明确问题边界的收敛门。Use when starting any non-trivial task, when requirements are unclear or underspecified ("build me X" without "for whom" or "why now"), when the user explicitly says "澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标", or when devflow routes to Define stage. Also triggers on task descriptions missing at least one of: who the user is, why they want it, what success looks like, what the binding constraint is. Even for seemingly clear tasks, use this skill if you catch yourself silently filling in ambiguous requirements.
---

# nocode-evolve:define — 从模糊到明确

> 定义问题边界，不选解法。产出：用户显式确认的结构化 restate + 场景分类。
>
> Define 回答"做什么 + 为什么做 + 怎么算做成了"。"怎么做"是 Design 的事。
>
> Brainstorming 是 Define 的工作方式之一——用来发散问题空间（真问题是什么？有没有隐藏的约束？用户以为的问题和真正的问题是同一个吗？）。但 Define 里的 brainstorming 止步于问题本身，不延伸到解法选择。

## Checklist（强制 TaskCreate）

进入 Define 后，你必须为以下步骤各建一条 task，按顺序完成：

1. **场景分类** — 判断 Mini/Fix/Standard/Full
2. **假设先行** — 写出 HYPOTHESIS + CONFIDENCE
3. **一次一问澄清** — 逐个问题 + 猜测，直到置信度 ≥ 95%
4. **产出 restate** — 结构化 restate（含 Quality Bar + Collaboration Pact）
5. **用户显式确认** — Gate：用户确认 restate

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

**场景分类是对问题性质的判断，不是对解法的判断**。判断依据是问题本身的复杂度——"这个问题涉不涉及架构决策"——而不是"方案是什么"。比如"加个搜索接口"是 Standard（问题清晰，不需要架构探索），"建分布式缓存层"是 Full（问题本身蕴含架构决策）。拿不准时偏向 Full——多走一步 Design 的成本远低于跳过 Design 后返工。

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

**2e. Quality Bar — 质量对齐**

restate 写完后，**主动问用户**：

> "这个任务的输出，怎样才算高质量？"

目的：校准双方对评价标准的理解。agent 不猜测用户的质量期望——显式问出来。

流程：
1. agent 基于 restate 先提出质量标准草案（2-4 条，具体可检验，不用 buzzword）
2. 用户确认 / 修改 / 补充
3. 最终质量标准写入 restate 的 `Quality Bar` 字段

质量标准必须**可检验**——"代码质量高"不行，"无 lint warning + 测试覆盖关键路径 + 无硬编码"可以。

**2f. Collaboration Pact — 协作契约**

质量标准对齐后，**主动问用户**：

> "我们如何协作，才能确保输出质量？"

agent 提出协作计划：自己做什么、需要用户提供什么信息、中间有几个检查点。用户确认 / 调整后写入 restate 的 `Collaboration Pact` 字段。

协作契约可引用以下**协作指令**（用户可选择启用）：

| 指令 | 适用场景 | 含义 |
|---|---|---|
| **穷尽探索** | 多条可行路径的设计 / 调试 / 选型 | 尽可能多用不同方法尝试，不人为设限。该尝试的方法都试完才停；还有未探索的方法就继续，即便已尝试多次 |
| **信心验证循环** | 策略决策 / 方案定稿 / 关键路径 | 每个决策点显式检查：对这个策略 100% 有信心吗？没有 → 列出所有可能漏洞 + 修复方案，循环执行直到在事实层面确信 |

指令不是必选。agent 根据任务特征建议合适的指令组合，用户拍板。

> 不启用任何指令也完全合法——简单任务不需要重型协作约定。

**2g. 用户确认**

Gate 是**显式确认**。以下不算确认：
- "随你"/"都行" → 用户在委托。重新提两个具体选项让用户选
- "可以"/"行" → 模糊。追问"有没有要修改的？"
- 沉默然后"那开始吧" → 用户放弃了讨论，不是收敛了。停下问是否遗漏了什么

### 产出

Define 只产出问题定义，不产出解法。后续阶段各取所需：

- **Design**（Full 场景）：基于 restate 的约束和验收标准探索方案、写设计文档
- **Plan**：任务拆分基于 restate 的成果物和验收标准
- **Build**：TDD 测试用例从验收标准推导
- **Verify**：验收标准逐条核对

Define 不判断"实现路径是否显而易见"——那是 Design 的职责。场景分类（Full/Standard/Fix/Mini）决定后续是否经过 Design 阶段。

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
| "质量标准不用问，我知道什么是好的" | 你的"好"和用户的"好"经常不同。显式问出来的标准省下返工的时间 |
| "协作方式不需要协商，直接干就行" | 直接干 = agent 单方面决定节奏和深度。中间没有检查点，偏了发现不了 |
| "应该没问题" | "应该"是假设。列出可能漏洞，逐个排除，在事实层面确认 |
| "方案很明显，不用 Design" | 场景分类决定是否走 Design，不由 Define 跳过 |

## Red Flags

- 在同一条消息里问 ≥ 3 个问题（在批量提问，不是在面试）
- 问问题不附猜测（在做问卷，不是在承诺假设）
- 接受"随你"/"都行"作为最终答案
- restate 没有 Out of Scope 行
- 置信度 < 70% 但不附理由
- 在用户确认 restate 之前就写 spec / plan / 代码
- 用户给了 buzzword 答案（"可扩展"/"现代"），没有追问实际需求
- 3 轮后置信度仍没有明显上升——在问错误的问题，需要换方向
- restate 没有 Quality Bar（质量标准缺失，后续无法验收"好不好"）
- restate 没有 Collaboration Pact（协作方式未协商，agent 单方面决定节奏）
- 启用了"穷尽探索"指令但只尝试了 1-2 种方法就停下
- 启用了"信心验证循环"但在决策点没有显式检查漏洞

## Verification Checklist

- [ ] Step 1 场景分类已输出，用户知道走哪个场景
- [ ] 每轮置信度 < 70% 附有理由
- [ ] 问题一次一个，每个附猜测
- [ ] 至少一次 "want vs should want" 探测（当用户给 buzzword 答案时）
- [ ] 结构化 restate 已输出（Outcome / User / Why Now / Success / Constraint / Out of Scope / Assumptions / Boundaries）
- [ ] Quality Bar 已输出，用户确认质量标准（可检验，非 buzzword）
- [ ] Collaboration Pact 已输出，用户确认协作方式（含检查点）
- [ ] 如适用，协作指令（穷尽探索 / 信心验证循环）已协商
- [ ] 用户显式确认 restate（不是"随你"，不是沉默）
- [ ] 如果进了 Brainstorm，Confirm 步骤检查了方案是否改变 Goal
- [ ] 产出明确标注场景分类，供 devflow 路由
