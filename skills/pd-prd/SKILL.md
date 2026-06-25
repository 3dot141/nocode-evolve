---
name: pd-prd
description: Use when the user wants to write a product requirements document. Use when the user says "写 PRD/产品需求/产品设计/产品 brief/写需求文档", or after research skill completes and the user wants to synthesize findings into a document. Also use when devflow Full-scene suggests running the product flow. Not for technical design docs (use nocode-evolve:design-doc-writing) or code comments/README.
---

# prd — 收敛成产品需求文档

**Iron Law: 没有写下来的需求就不存在。口头共识在第三个人加入时蒸发。**

独立于 devflow 的产品流第二阶段。把调研结论（或用户描述）收敛成结构化 PRD 文档。产出物喂给 devflow 的 Define 阶段。

> Leading word: **prd**。所有收敛到一份 `.prd.md` 文档，没有文档就没有 Product Design 的产出。

## 非本 skill 请求

纯调研不写文档 → 走 `nocode-evolve:pd-research`。
技术设计文档 / RFC / ADR → 走 `nocode-evolve:design-doc-writing`。
已有 PRD 直接进开发 → 走 devflow Define。
改 README / commit message → 不进本 skill。

## Entry Gate

- [ ] 用户有写 PRD 的意图，或 research 刚完成建议衔接

## Checklist (TaskCreate)

1. **加载输入** — Read research-memo（如有）
2. **Clarify Gate** — 逐字段提议默认值 + 用户确认
3. **起草 PRD** — 按模板写，标注 [CONFIRMED]/[ASSUMED]/[TBD]
4. **领域与路径建模** — 识别领域 → 展开使用路径 → 跨域 → 系统 → 约束
5. **合批确认** — 整份清单（用户故事 + 路径 + 约束）一次确认
6. **自审** — 完整性 + 路径覆盖维度
7. **用户最终确认** — AskUserQuestion 三选
8. **保存** — 写到产出路径

## 协议

### Step 1: 加载输入

检查是否有 research-memo：
- `{pd_research_output}` 所在目录存在 `research-memo.md` → Read 它，作为依据
- 不存在 → 降级为纯问答模式，明确告知用户"无调研数据，将基于你的描述起草"

多个 memo 文件 → 列出让用户选。

### Step 2: Clarify Gate

在写任何内容之前，暴露歧义。**对每个核心字段，先给带理由的默认值让用户改**（"提议默认值"模式——改比答空白快）。

用 AskUserQuestion 逐字段确认（不一次问完，一次一个）：

1. **Problem** — "基于调研，核心问题是 X，因为 Y。对吗？"
2. **Target User** — "目标用户是 X。对吗？"
3. **Appetite** — "建议投入 X 时间。这个封顶可以吗？"
4. **不做的事** — "建议不做 X、Y、Z。还有要排除的吗？"

有 research-memo 时默认值来自调研结论；没有时 AI 根据用户描述推断，标 `[ASSUMED]`。

### Step 3: 起草 PRD

按模板逐节写。每个字段的值来源标注：

- `[CONFIRMED]` — 用户在 Step 2 确认的
- `[ASSUMED]` — AI 编了个合理值，需用户核验（不是事实，是推断）
- `[TBD]` — 用户还没决定（不是 AI 不知道，是用户说"还没想好"）

**填好的示例**（对照颗粒度，不照搬措辞）：`references/examples/example-prd-filled.md`

**路径与 ID 格式**：业务领域 / 使用路径 / 跨领域路径 / 系统路径 / 约束的 ID 编号与书写格式见 `{NOCODE_SKILL_REF}/path-conventions.md`，Step 4 建模时 Read。

**PRD 文档模板**：

```markdown
# PRD: {title}
> 状态: 草稿
> 作者: {username}
> 日期: {yymmdd}
> 调研: {research-memo 路径, 无则 "N/A"}

## 问题
[问题描述 + 痛点证据]
[主因 vs 辅因显式划分]

## 用户故事
- US-1: 作为 [角色], 我想要 [动作], 以便 [收益] [CONFIRMED/TBD/ASSUMED]
- US-2: ...

## 业务领域与使用路径

### {领域名}
> 关注点: {一句话}

**使用路径**
- {领域}.P1: {一句话描述} [{角色}] [CONFIRMED/ASSUMED/TBD]
  来源: US-{X}
  {触发/前置} → {关键步骤} → {结果}
  | 异常: {异常场景}
  | 边界: {在哪结束、和哪个领域交界}
- {领域}.P2: ...

### {领域名}
> 关注点: ...

## 跨领域路径
- 跨域.1: {一句话描述} [{角色}] [CONFIRMED/ASSUMED/TBD]
  {领域}.P{X} → {领域}.P{Y} → {领域}.P{Z}
  | 异常: 任一环节失败的回退链

## 系统路径
- 系统.1: {一句话描述} [CONFIRMED/ASSUMED/TBD]
  {触发条件} → {处理步骤} → {结果}
  | 异常: {异常场景}

## 约束
- 约束.1: {业务规则描述} [CONFIRMED/ASSUMED/TBD]

## 投入上限
[时间封顶 + 理由]
[这不是估时——是"最多愿意花多少", 超过就不值得做]

## 方向草图
[粗粒度方向, 草图级, 不是详细设计]
[够说明可行性就行]

## 竞品分析
[功能矩阵引用 / 定位图引用, 来自 research-memo]
[无 research-memo 时标 [TBD] 或基于已知信息简写]

## 成功指标
- 主要: [核心指标] [CONFIRMED/TBD]
- 次要: [辅助指标] [CONFIRMED/TBD]
- 护栏: [不能恶化的指标] [CONFIRMED/TBD]
（注: PRD 不分配 SC 编号，SC-N 由 Define 阶段统一分配并绑定路径）

## 风险与不确定性
[已知风险 + 技术不确定性]
[每条标注来源: research / 代码探索 / 推断]

## 不做的事
[明确不做什么]
[这是 PRD 里最有价值的一节——一半的范围蔓延来自没写下来的"不做"]

## 待定项
- [TBD] 问题 1
- [TBD] 问题 2

## 来源附录
[调研来源引用, 按 [SOURCE: url/path] 格式]
```

### Step 4: 领域与路径建模

User Stories 是意图（一句话），使用路径是把意图展开成"谁、从哪进、走几步、到哪结束、什么情况会异常"。这一步把每条 story 落成可被下游设计和验证的具体路径。

格式与 ID 约定见 `{NOCODE_SKILL_REF}/path-conventions.md`，开始前 Read。

1. **识别业务领域**：从 User Stories 归纳业务面（如电商 → 商品/订单/支付/物流/售后）。**按业务面分，不按技术层分**——不是"前端/后端/API"，是"订单/支付/物流"。
2. **展开使用路径**：每个领域下，每条相关 User Story 至少展开一条使用路径。路径是 outcome 级别（"用户能取消未发货订单并收到退款"），**不写交互步骤**（点哪个按钮是 vis 的事）。每条标 `来源: US-{X}`。
   **情境锚定**：对核心路径补 Job Story 视角——"When [用户在什么情境下触发], I want [动机], so that [结果]"。User Story 的 persona 告诉你"谁"，Job Story 的情境告诉你"什么时候、为什么"——后者更能驱动差异化设计。不替换 US，作为情境补充。
3. **识别跨领域路径**：串联多个领域的端到端链路（如"下单→支付→发货→签收"穿订单/支付/物流），用 `跨域.{N}` 单独管理，不拆回各领域重复计。
4. **识别系统路径**：没有用户入口但有系统行为的场景——webhook 回调、定时同步、批处理、缓存失效、降级恢复。这些常是事故来源，容易被 User Story 漏掉。
5. **提取约束**：跨路径的业务不变量（"退款 ≤ 实付"、"库存 ≥ 0"、"订单关闭后不可发货"）。不是某条 path，是所有 path 都要遵守的硬规则。
6. **状态标注**：每条路径/约束标 `[CONFIRMED]/[ASSUMED]/[TBD]`。AI 推断的标 ASSUMED，等 Step 5 用户确认后才转 CONFIRMED。

### Step 5: 合批确认

不再逐条确认 User Story。整份清单（用户故事 + 所有路径 + 约束）一次性展示给用户，用户加 / 减 / 改后一次确认。减少确认疲劳。

- 用户确认的项 → 标 `[CONFIRMED]`
- 用户修改 → 记录后标 `[CONFIRMED]`
- 用户删除 → 移除（ID 留空不回收，见 path-conventions 铁律）
- 用户补充 → 加入并分配新 ID

整份清单全被否决 → 回 Step 2 重新 clarify（可能问题理解有偏差）。

### Step 6: 自审

写完后检查：

| 维度 | 检查什么 |
|---|---|
| 完整性 | 所有核心字段都有内容？没有空节？ |
| 一致性 | 问题 ↔ 用户故事 ↔ 成功指标 三者对齐？ |
| 可测性 | 每条成功指标可量化？能写验收标准？ |
| 路径完整性 | 每条 US 至少展开了一条路径？ |
| 领域覆盖 | 有没有遗漏的业务面？ |
| 角色覆盖 | 涉及多角色时，角色差异是否标注？ |
| 约束覆盖 | 跨路径的业务规则是否提取？ |
| 系统路径 | 有后台行为/回调/定时任务，是否建模？ |
| 假设标注 | 所有 `[ASSUMED]` 都标了？没有隐藏假设？ |

发现问题 → 修正后再进 Step 7。

### Step 7: 用户最终确认

用 AskUserQuestion 三选：

- **确认** → 保存文档
- **要修改** → 用户指出修改点，改完再确认
- **重来** → 回 Step 2

以下不算确认：
- "随你"/"都行" → 重新提具体选项
- "可以" → 追问"有没有要改的？"

### Step 8: 保存

文档存到 `{pd_prd_output}` 变量指定的路径（见 `model/agent-about.md`「文档产出路径变量」）。和同 topic 的 research-memo 落同一目录。

完成后提示："PRD 写完了。若需求涉及界面，建议下一步做交互视觉设计（调 `nocode-evolve:pd-vis`），把需求落成界面结构 + 视觉方向；纯后端 / 无界面需求可直接进 devflow 开发流。"

## 文档质量硬规则

1. **文档必须自包含**：下游的 Define/Design/Build 看不到本次对话，只看 `.prd.md` 文件。文档里不能有"如前所述""上面提到的"等依赖对话上下文的表述。
2. **目标读者 = 不在场的人**：一个没参加讨论的初级开发读完 PRD，能理解要做什么、不做什么、怎么算成。读不懂 = PRD 没写好。
3. **Outcome-level 写需求，不写实现**："用户能不进设置就改通知频率"而不是"放一个三选下拉"。设计师和工程师独立读能得到同一理解。
4. **不编造数据**：AI 不确定的东西标 `[ASSUMED]`，不知道的标 `[TBD]`。没有来源的"市场数据"不写。

## Go/No-Go 判据（从 research 传递）

research skill 的 Go/No-Go 建议基于以下判据（PRD 里引用）：

| 判据 | Go 信号 | No-Go 信号 |
|---|---|---|
| 竞品覆盖 | 竞品未完全覆盖，有差异化空间 | 已有成熟竞品完全覆盖且无差异化角度 |
| 技术可行 | 代码现状能支撑，或改造成本可接受 | 技术障碍大且无绕过方案 |
| 用户需求 | 社区/市场有明确痛点信号 | 找不到痛点证据，需求是假设 |

### Step 6a: prd-review（交叉审）

用户确认前，按 `{NOCODE_SKILL_REF}/prd-review.md` 做 red-blue 双模型交叉评审——Claude 做蓝军、Codex 做红军（CLAIM 剥离不传蓝军结论）。findings 合并报告，Critical 必须修复再让用户确认。

## Exit Gate

- [ ] PRD 文档已产出，包含所有核心字段
- [ ] 业务领域 + 使用路径 + 跨域 + 系统路径 + 约束已建模（含 ID + 状态 + US 来源）
- [ ] 用户故事 + 路径清单已合批确认
- [ ] prd-review 自审通过（无 Critical findings）
- [ ] 用户显式确认（AskUserQuestion 选了"确认"）
- [ ] 文件已保存到正确路径

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "PRD 太重了，不需要" | 两行 PRD 也是 PRD。区别在规模不在有无 |
| "先做着，需求做着做着就清楚了" | 那叫 spike，不叫产品设计。spike 完回来写 PRD |
| "团队都知道要做什么" | 默契在第三个人加入时失效。写下来成本极低 |
| "AI 写的 PRD 不靠谱" | AI 写初稿 + 人确认 > 人从零写。不靠谱的部分标 [ASSUMED] |

## Red Flags

- 全文没有 `[ASSUMED]` 标注（AI 不可能全知，0 个 ASSUMED = 隐藏了假设）
- 「不做的事」为空（几乎不可能——总有不该做的东西）
- 成功指标写"用户满意"（不可量化 = 没写）
- 用户故事全是 AI 生成没有用户确认（假共识）
- 引用了不存在的调研数据（编造）
- User Story 没展开成路径（下游 vis/Define 拿不到可设计的输入）
- 业务领域按技术层切（前端/后端），不是按业务面切（订单/支付）
- 给 PRD 路径写了交互步骤（点哪个按钮）——越界到 vis
- 系统路径节为空但需求明显有回调/定时任务（漏了非用户场景）
