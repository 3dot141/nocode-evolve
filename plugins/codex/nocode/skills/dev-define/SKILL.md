---
name: dev-define
description: "Use when starting any non-trivial task, when requirements are unclear (\"build me X\" without \"fo…"
---

本文写“结构化决策”时，必须带齐当前步骤的完整问题与 2–3 个互斥选项：


在 `request_user_input` 可用时提交完整问题和全部选项；若当前模式未提供该工具，则在回合末尾直接提出同一问题并等待回答。

# define — 从模糊到明确

**Iron Law: 问题没定义清就动手 = 赌。建错东西的代价是澄清的 10 倍，而且由用户承担。**

定义问题边界，不选解法。产出一份 **restate**——用户显式确认的结构化目标。brainstorming 用于发散问题空间，不延伸到解法选择。Define 回答"做什么 + 为什么做 + 怎么算做成了"。"怎么做"是 Design 的事。

> Leading word: **restate**。所有对话收敛到这份产出物。没有确认的 restate 就没有 Define 的产出。

## 非本 skill 请求

纯事实问答 / 已明确的单步执行 / 已有确认 restate 要设计方案 → 不进 Define，直接回答或路由到对应 skill（Design / Build / Mini 直接做）。

## Enter Gate

- [ ] 用户有任务描述或意图

> 端到端示例（模糊需求 → 确认 restate）见 `references/examples/example-define-session.md`

## 协议

### Step 0: workflow.plan.create

**进入后第一件事**，创建以下全部 task：

```
Task 1: 场景分类 — Mini/Fix/Standard/Full
  Sub-steps: 结构化决策 判场景 → Scope check（太大先拆）
  Gate: 场景已确认（Mini 出 mini-goal 退出 / Fix 出复现定义 / Standard·Full 进 Task 2）

Task 2: 探索现状 — 代码 + 网络并行
  Sub-steps: 并行 spawn 代码探索(targeted) + 网络探索 → 综合成探索胶囊（scanBase + findings）
  Gate: 两路结果回来，探索胶囊产出（Mini 跳过）

Task 3: 路径校验 — 路径清单 + SC 绑定（Full/Standard）
  Sub-steps: 有 PRD 搬入 / 无 PRD 现场生成 → 每条路径绑 SC
  Gate: 路径清单 + 路径↔SC 绑定产出，无裸路径无裸 SC（Mini/Fix 跳过）

Task 4: 假设先行 — 判断 + CONFIDENCE
  Sub-steps: 基于探索写判断 → 摊开隐含假设
  Gate: 假设已摊给用户（≥95% 可跳 Task 5）

Task 5: 澄清循环 — 结构化决策 给选项
  Sub-steps: 代码能自答的不问 → 一次问一个 → 收敛到 95%
  Gate: 置信度 ≥95%（过 95% 停止测试）

Task 6: 产出 restate
  Sub-steps: 填必填字段 + 路径清单 + SC 绑定 + Quality Bar + Collaboration Pact
  Gate: restate 完整产出

Task 7: 用户确认 — 三选 + define-review
  Sub-steps: define-review（有异议升档交叉，skeleton §1a）→ 结构化决策 三选（确认/修改/重来）→（Full）确认后落盘罗盘
  Gate: 用户显式确认 + 无 Critical findings +（Full）罗盘已落盘

Task 8: 硬交接 — 调用下一步 skill
  Sub-steps: 按 Exit Gate 硬交接报告 Define 完成（场景分类 + restate 摘要）→ 按场景建议下一步：Full/Standard/Fix → Env（按下方平台指令调用 worktree skill，传入当前 request、stage、restate、artifacts、constraints 和用户 decision）；Mini → Build-lite → 等用户拍板
  Gate: 用户拍板进入下一阶段（这一步不勾，Define 不算收尾）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```


Env handoff 使用 `$using-git-worktrees`。

调用时把上面**每一条** Task 建成稳定计划项，不得传空计划：


使用 `update_plan` 提交全部计划项；每次状态变化都提交完整列表，保持稳定顺序，且同时最多一个 `in_progress`。

每完成一个标 done。

### Step 1: 场景分类

判断**问题性质**（不是解法），用 结构化决策 确认：

| 信号 | 场景 | 后续路径 |
|---|---|---|
| 单文件/单步/改变量名/修文案 | **Mini** | mini-goal → Build-lite → Verify-lite → Land-lite |
| 用户报 bug/测试失败/行为异常 | **Fix** | 复现定义 → Env → Debug → Build → Verify → Review → Land |
| 跨文件 + 实现路径明确 | **Standard** | Define → Env → Plan → Build → Verify → Review → Land |
| 跨文件 + 需要架构/选型/设计 | **Full** | Define → Env → Design → Plan → Build → Verify → Review → Land |

结构化决策 把你的判断 + 理由放推荐选项，其余场景放备选。拿不准偏向 Full。

Mini → 输出 3 行 mini-goal（做什么 + 验收标准 + 不做什么），用户确认后退出。
Fix → 侧重复现：重现步骤 + 预期 vs 实际 + 影响范围。模糊诉求（"让它更快"/"修好这个"）→ reframe 成可测标准（"LCP < 2.5s" / "500 错误率 < 0.1%"），问用户确认。
Standard/Full → 进 Step 2。

**Scope check**：如果任务描述涉及多个独立子系统（如"搭一个带聊天+文件存储+计费+分析的平台"），**立即标记**——别花问题去细化一个需要先分解的项目。帮用户拆成独立子项目，每个子项目各自走完整流程。用白话告诉用户"这个太大了，需要先拆"——不对用户引用 SKILL.md 条文或行号。

### Step 2: 探索现状

**先看世界再形成判断。**探索在假设之前——不是先猜答案再找支撑，是先了解现状再说话。

按场景裁剪探索深度：

| 场景 | 代码探索 | 网络探索 |
|---|---|---|
| **Full** | 已有相关实现、pattern、可复用模块 | 类似问题别人怎么定义的、行业标准/规范 |
| **Standard** | 已有相关实现 | 轻量搜（有没有现成问题框架） |
| **Fix** | bug 所在模块 + 上下游调用链 | 不搜 |
| **Mini** | 跳过 | 跳过 |

**两路都委派 `research-workflow` skill**（调用方式见 `skills/research-workflow/SKILL.md`），用不同 `type` 区分方向，并行执行：

**代码探索**（Full / Standard / Fix）：
- `question`: `<任务描述> 在当前代码库的已有实现和 pattern`
- `type`: `code`
- `depth`: `targeted`（默认——Define 只需要"有没有、在哪里"来定假设的置信度，深挖影响面是 Design Step 1a 的事，别在这里铺重档）
- `angles`: 从任务描述提炼 2~3 个搜索点（`[{label, query}]`，如 已有同类实现 / 相关模块与调用链 / 可复用 pattern）

**升档有疑点先问用户**：angles 提炼不出（任务太模糊 / 陌生子系统、术语和预期对不上）→ 结构化决策 让用户在 `targeted` / `shallow`（迭代逼近，agent 数翻倍以上）之间拍板，不自作主张往重档跑。

**网络探索**（Full / Standard）：
- `question`: `<任务描述> 在业界怎么定义、有没有行业标准/规范`
- `type`: `web`
- `depth`: `shallow`
- `systemPrompt`（追加）: `只搜问题定义层面的参考（行业标准/规范/问题框架），不搜解法——解法是 Design 的事。`

Standard 场景网络探索由当前会话使用可用的搜索工具做 1–2 个定向查询，返回来源、关键事实、不确定项及其与当前需求的关系；不走完整 research-workflow，也不为了浅搜强制派 agent。

**综合 → 探索胶囊**：两路结果回来后，产出「探索胶囊」——不把 findings 压缩成一段散文总结，下游要按证据复用它（Full 场景给 Design Step 1a，Standard 场景给 Plan Step 1）：

- `scanBase`: 综合时跑 `git rev-parse --short HEAD`，记录扫描基准 commit
- `findings`: research-workflow 返回的 findings 原样保留（claim / confidence / sources / evidence），代码类结论的 sources 必须含 `path:line`
- `summary`: 一段简要总结（代码里已有什么 + 网上发现了什么），带入 Step 4 影响假设的置信度

胶囊作为 restate 的附录随 restate 留存（格式见 `references/restate-template.md`）。胶囊不合格（sources 无 path:line / 缺 scanBase）= Design 无法判断复用还是重扫，只能从零重搜——降档省下的就全吐回去了。

### Step 3: 路径校验

把用户使用场景显式建模成路径清单，作为 restate 的完整性骨架。路径格式、ID 体系、状态标注见 `${PLUGIN_ROOT}/skills/references/path-conventions.md`。

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
- 只有用户才能回答的问题（意图、优先级、约束、business context）→ 用 结构化决策

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

**引用探索结论 + 附探索胶囊**：restate 正文引用 Step 2 发现的关键事实（代码里有什么、网上有什么行业标准），让 restate 有事实基础，不是空中楼阁；restate 末尾附上 Step 2 产出的探索胶囊（scanBase + findings，格式见 `references/restate-template.md`），供 Design Step 1a 判断复用还是重扫。

### Step 7: 用户确认

用 结构化决策 三选：确认 / 要修改 / 重新来。**路径清单 + SC 绑定和 restate 主体一起确认，不分开问**（合批降低确认疲劳）。

以下不算确认：
- "随你"/"都行" → 用户在委托，重新提具体选项
- "可以"/"行" → 追问"有没有要修改的？"
- 沉默后"那开始吧" → 用户放弃了讨论，停下问是否遗漏

**确认后落盘（Full 场景）**：restate 确认即创建设计文档 `{dev_design_output}`，把 restate 全文（含路径清单 + SC 绑定 + 探索胶囊附录）写成文档首章「罗盘（Define Restate）」——设计文档从罗盘起步，Design 的决策账本 / 详细设计 / Review Log 在**同一文件**上迭代长出，不产出独立 `-restate.md` 文件。罗盘的所有者是 Define：Design 各阶段只读它做校准、不改写；需求变更回 Define 修正罗盘再继续。Standard / Fix / Mini 不落盘——restate 对话内交接（Standard 交 Plan）。

### Step 7a: define-review（默认自查）

用户确认前做 define-review：Read `references/define-review.md`（restate 7 维度）拿维度，**主会话就地逐维自查**——不调 reviewing 引擎、不派 subagent/Codex。发现的问题按 Critical / Warning / Suggestion 粗分，Critical 级必须修复再让用户确认。

**升审只在两种情况**：① 用户显式要求（「审一下 / 深审 / 独立审」）→ 按下方平台指令调用 reviewing，传入完整 restate、7 个 define-review 维度、checklist 方法、context capsule 和 independent 深度；② restate 命中敏感面（权限 / 计费 / 数据迁移 / 对外接口 / 不可逆）→ 向用户**一句话建议**升审，用户点头才调，不自动派发。


独立审查 handoff 使用 `$reviewing`。

## Exit Gate

- [ ] restate 已产出，用户显式确认（结构化决策 选了"确认"）
- [ ] define-review 自查通过（无未修复的 Critical 级问题）
- [ ] 场景分类已标注
- [ ] （Full/Standard）路径清单已校验——有 PRD 则搬入并查完整性，无 PRD 则现场生成
- [ ] （Full/Standard）每条路径至少绑定一条 SC，无裸路径也无裸 SC
- [ ] 后续阶段输入齐全：Full → Design 可用罗盘文档（`{dev_design_output}` 首章 = restate + 路径清单 + 探索胶囊，scanBase + findings 带 path:line），Standard → Plan 可用 restate + 路径清单 + 探索胶囊（对话内交接）
- [ ] **硬交接**：Exit Gate 全部通过后，向用户报告 Define 完成（含场景分类 + restate 摘要），并按场景建议下一阶段：Full/Standard/Fix → Env（`nocode:using-git-worktrees`），Mini → Build-lite。列出下一阶段的 sub-steps + 关键决策（devflow Step 5 格式）。等用户拍板，不自行进入下一阶段

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "需求够清楚了" | 写不出一句话 Outcome = 不清楚 |
| "问太多浪费时间" | 4-6 个问题用几分钟，建错东西用几小时 |
| "做着做着就明白了" | 实现中的发现是返工，不是发现 |
| "先给几个选项让用户挑" | 用户还不知道自己要什么，提问缩小空间比列选项扩大空间有效 |
| "不用探索，我知道代码里有什么" | 你上次看可能是 N 轮工具调用之前，隔了就重新过一遍 |
| "这个改动简单，跳过某 Step 或不建 workflow.plan.create" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权 |

## Red Flags

- 置信度 < 70% 不附理由
- 3 轮后置信度没明显上升——在问错误的问题
- 启用了"穷尽探索"但只试 1-2 种方法
- 跳过了 Step 2 探索就直接形成假设——凭印象不是凭事实
- Full/Standard 场景没做代码探索就出 restate——可能遗漏已有实现
- Full/Standard 场景 restate 没有路径清单——用户使用场景没建模，下游无完整性骨架
- 路径清单里有路径没绑任何 SC，或有 SC 不对应任何路径——绑定断裂
- Full 场景 restate 落成独立 `-restate.md` 文件，或确认后没落盘——罗盘的唯一载体是设计文档首章
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 workflow.plan.create、或漏掉最后的交接 task
