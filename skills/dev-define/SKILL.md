---
name: dev-define
description: Use when starting any non-trivial task, when requirements are unclear ("build me X" without "for whom" or "why now"), when the user says "澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标", or when devflow routes to Define stage. Also use when a task description is missing who/why/what-success-looks-like.
---

# define — 从模糊到明确

**Iron Law: 问题没定义清就动手 = 赌。建错东西的代价是澄清的 10 倍，而且由用户承担。**

定义问题边界，不选解法。产出一份 **restate**——用户显式确认的结构化目标。brainstorming 用于发散问题空间，不延伸到解法选择。Define 回答"做什么 + 为什么做 + 怎么算做成了"。"怎么做"是 Design 的事。

> Leading word: **restate**。所有对话收敛到这份产出物。没有确认的 restate 就没有 Define 的产出。

## 非本 skill 请求

纯事实问答 / 已明确的单步执行 / 已有确认 restate 要设计方案 → 不进 Define，直接回答或路由到对应 skill（Design / Build / Mini 直接做）。

## Entry Gate

- [ ] 用户有任务描述或意图

## Checklist (TaskCreate)

进入 Define 后，为以下步骤各建一条 task，按顺序完成：

1. **场景分类** — AskUserQuestion 确认 Mini/Fix/Standard/Full
2. **探索现状** — 按场景裁剪：代码探索 + 网络探索（Mini 跳过）
3. **路径校验** — 搬入/生成路径清单 + 每条路径绑 SC（Full/Standard）
4. **假设先行** — 基于探索结论形成判断 + CONFIDENCE
5. **澄清循环** — 代码能自答的不问用户；用 AskUserQuestion 给选项
6. **产出 restate** — 含路径清单 + SC 绑定 + Quality Bar + Collaboration Pact
7. **用户确认** — AskUserQuestion 三选：确认/修改/重来（路径 + SC 一起确认）

> 端到端示例（模糊需求 → 确认 restate）见 `references/examples/example-define-session.md`

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
Fix → 侧重复现：重现步骤 + 预期 vs 实际 + 影响范围。模糊诉求（"让它更快"/"修好这个"）→ reframe 成可测标准（"LCP < 2.5s" / "500 错误率 < 0.1%"），问用户确认。
Standard/Full → 进 Step 2。

**Scope check**：如果任务描述涉及多个独立子系统（如"搭一个带聊天+文件存储+计费+分析的平台"），**立即标记**——别花问题去细化一个需要先分解的项目。帮用户拆成独立子项目，每个子项目各自走完整流程。用白话告诉用户"这个太大了，需要先拆"——不对用户引用 SKILL.md 条文或行号。

### Step 2: 探索现状

**先看世界再形成判断。**探索在假设之前——不是先猜答案再找支撑，是先了解现状再说话。

按场景裁剪探索深度：

| 场景 | 代码探索 | 网络探索 |
|---|---|---|
| **Full** | semble-search 扫代码库：已有相关实现、pattern、可复用模块 | Exa/WebSearch 搜：类似问题别人怎么定义的、行业标准/规范 |
| **Standard** | semble-search 扫代码库：已有相关实现 | 轻量搜一两个查询（有没有现成问题框架） |
| **Fix** | 探索 bug 所在模块 + 上下游调用链 | 不搜 |
| **Mini** | 跳过 | 跳过 |

**并行执行**：代码探索和网络探索互不依赖，**用并行 subagent 同时跑**（在一条消息里同时发出多个 Agent 调用）。两路结果回来后再综合。

**代码探索 agent**（Full / Standard / Fix）：
- `Agent(subagent_type: "semble-search")`，prompt 说明要找什么
- 找已有的相关实现、可复用模块、相似 pattern
- 标注 `[Read path:line]` 来源
- 目的：不重复造轮子，理解当前系统的约束和边界

**网络探索 agent**（Full 完整 / Standard 轻量）：
- `Agent(subagent_type: "fork")`，prompt 用 Exa/WebSearch 搜索
- 搜类似问题在业界怎么定义的、有没有行业标准/规范
- **只搜问题定义层面的参考，不搜解法**——解法是 Design 的事
- 标注 `[SOURCE: url]` 来源
- 目的：避免重新发明已有的问题框架

**工具降级**：semble-search 不可用 → 降级 Bash grep + Explore agent。Exa/WebSearch 不可用 → 跳过网络探索，标注"网络不可用"。

**综合**：两路 agent 结果回来后，输出一段简要总结（代码里已有什么 + 网上发现了什么），带入 Step 4 影响假设的置信度。

### Step 3: 路径校验

把用户使用场景显式建模成路径清单，作为 restate 的完整性骨架。路径格式、ID 体系、状态标注见 `{NOCODE_SKILL_REF}/path-conventions.md`。

**Mini/Fix 跳过本步**——Mini 走 mini-goal，Fix 走复现定义，都不需要路径建模。Standard/Full 必做。

**有 PRD**（`{pd_prd_output}` 所在目录有 `*.prd.md`）：
- Read PRD 的「业务领域与使用路径 / 跨领域路径 / 系统路径 / 约束」节，搬入 restate 的路径清单
- 按领域逐个检查完整性：每个领域的路径齐了吗？有没有遗漏的异常路径、恢复路径、角色差异？
- PRD 标 `[ASSUMED]/[TBD]` 的路径，在这里收敛成 `[CONFIRMED]` 或确认删除

**无 PRD**：
- 基于 Step 2 探索结论现场生成路径清单，全部标 `[ASSUMED]`，需用户确认
- 至少覆盖：核心使用路径 + 明显的异常路径 + 涉及的系统路径（回调/定时任务/批处理）

**SC 绑定**（ID 由 Define 独占分配，PRD 不分配 SC 编号）：
- **每条路径至少绑定一条 SC**
- 有路径无 SC → 补 SC（这条路径怎么算做成了？）
- 有 SC 无路径 → 检查是否遗漏路径（这条标准在验哪条使用场景？）

**关键 SC 补具体例子**：对核心 SC 用 Given/When/Then 锚定一个具体场景，让断言式 SC 有可直接变成测试的骨架：
> SC-1: "搜索响应 < 200ms (p95)"
> 例：Given 10 万条记录 / When 搜 'apple' / Then p95 < 200ms

不要求每条 SC 都写——关键路径的 SC 写了即可。这个例子直接喂给 Build 当测试骨架，减少 Define→Build 的语义漂移。

产出路径清单 + 路径↔SC 绑定，带入 Step 6 写进 restate。

### Step 4: 假设先行

基于 Step 2 的探索结论，写出你的判断。**面向用户用白话说**——"代码里已有类似实现 X，所以我猜你想要 Y，大概 80% 把握"，不贴 HYPOTHESIS/CONFIDENCE 标签。

**快速路径**：如果之前会话已充分讨论，置信度已 ≥ 95% → 跳过 Step 5 澄清，直接出 restate 给用户确认。

**Surface Assumptions**：把隐含假设全摊开给用户：「我正在假设 1.X 2.Y 3.Z → 纠正我否则按此推进」。假设是最危险的误解——不摊开的假设会在 Build 期变成返工。

### Step 5: 澄清循环

**提问前自查：这个问题的答案在代码里或 Step 2 的探索结论里吗？**
- 已在探索中确认的事实 → 直接引用，不问用户
- 只有用户才能回答的问题（意图、优先级、约束、business context）→ 用 AskUserQuestion

**能给选项就给选项**。用户点选比手打快，也更不容易礼貌性同意。开放式问题仍可纯文字，但附猜测——用户纠正错误猜测比从零生成答案快。偶尔故意往你预期会被反驳的方向猜——防止用户礼貌性附和。

**95% 停止测试**：置信度写了 ≥ 95%？验证一下——你能预测用户对接下来 3 个问题的反应吗？能 → 出 restate。不能 → 置信度是假的，继续问。

一次只问一个。第三个问题常常取决于第一个的答案。

**识别 "want vs should want"**：用户说"最佳实践是..."、用 buzzword 当目标（"可扩展"/"现代"）→ 追问"如果不需要向任何人解释，你真正想要的是什么？"

### Step 6: 产出 restate

置信度 ≥ 95% 时产出（完整模板见 `references/restate-template.md`）：

**必填字段**：Outcome / User / Why Now / Success Criteria / Constraint / Out of Scope / Assumptions / Boundaries (Always/Ask First/Never)

**Full/Standard 额外字段**（Step 3 产出，写进 restate）：

```markdown
## 路径清单
[从 PRD 搬入，或现场生成；格式见 path-conventions.md]
- 使用路径: 订单.P1 ... / 订单.P2 ...
- 跨领域路径: 跨域.1 ...
- 系统路径: 系统.1 ...
- 约束: 约束.1 ...

## 路径 ↔ SC 绑定
| 路径 | 绑定 SC |
|---|---|
| 订单.P1 | SC-1, SC-3 |
| 订单.P2 | SC-2 |
| 系统.1 | SC-4 |
| 约束.1 | SC-5 |
```

**Out of Scope 不可省略**——这是 restate 里最有价值的一行。一半的对齐偏差来自对"不做什么"的沉默分歧。用户确认 Out of Scope 比确认 Outcome 更能防止后续返工。

**Quality Bar**：主动问"怎样算高质量？"。agent 先提 2-4 条可检验标准，用户确认/修改。"代码质量高"不行，"无 lint warning + 关键路径测试覆盖"可以。

**Collaboration Pact**：主动问"我们怎么协作？"。agent 提出：自己做什么、需要用户提供什么、中间检查点。可选引用协作指令（穷尽探索 / 信心验证循环），用户拍板。

**引用探索结论**：restate 里引用 Step 2 发现的关键事实（代码里有什么、网上有什么行业标准），让 restate 有事实基础，不是空中楼阁。

### Step 7: 用户确认

用 AskUserQuestion 三选：确认 / 要修改 / 重新来。**路径清单 + SC 绑定和 restate 主体一起确认，不分开问**（合批降低确认疲劳）。

以下不算确认：
- "随你"/"都行" → 用户在委托，重新提具体选项
- "可以"/"行" → 追问"有没有要修改的？"
- 沉默后"那开始吧" → 用户放弃了讨论，停下问是否遗漏

## Exit Gate

- [ ] restate 已产出，用户显式确认（AskUserQuestion 选了"确认"）
- [ ] 场景分类已标注
- [ ] （Full/Standard）路径清单已校验——有 PRD 则搬入并查完整性，无 PRD 则现场生成
- [ ] （Full/Standard）每条路径至少绑定一条 SC，无裸路径也无裸 SC
- [ ] 后续阶段输入齐全：Full → Design 可用 restate + 路径清单，Standard → Plan 可用 restate + 路径清单

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "需求够清楚了" | 写不出一句话 Outcome = 不清楚 |
| "问太多浪费时间" | 4-6 个问题用几分钟，建错东西用几小时 |
| "做着做着就明白了" | 实现中的发现是返工，不是发现 |
| "先给几个选项让用户挑" | 用户还不知道自己要什么，提问缩小空间比列选项扩大空间有效 |
| "不用探索，我知道代码里有什么" | 你上次看可能是 N 轮工具调用之前，隔了就重新过一遍 |

## Red Flags

- 置信度 < 70% 不附理由
- 3 轮后置信度没明显上升——在问错误的问题
- 启用了"穷尽探索"但只试 1-2 种方法
- 跳过了 Step 2 探索就直接形成假设——凭印象不是凭事实
- Full/Standard 场景没做代码探索就出 restate——可能遗漏已有实现
- Full/Standard 场景 restate 没有路径清单——用户使用场景没建模，下游无完整性骨架
- 路径清单里有路径没绑任何 SC，或有 SC 不对应任何路径——绑定断裂
