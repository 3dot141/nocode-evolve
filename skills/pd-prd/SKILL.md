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
4. **User Stories 确认** — 逐条用户确认
5. **自审** — 五维检查
6. **用户最终确认** — AskUserQuestion 三选

## 协议

### Step 0: 加载输入

检查是否有 research-memo：
- `docs/nocode/prds/{username}/research-memo-*.md` 存在 → Read 它，作为默认值生成的依据
- 不存在 → 降级为纯问答模式，明确告知用户"无调研数据，将基于你的描述起草"

多个 memo 文件 → 列出让用户选。

### Step 1: Clarify Gate

在写任何内容之前，暴露歧义。**对每个核心字段，先给带理由的默认值让用户改**（"提议默认值"模式——改比答空白快）。

用 AskUserQuestion 逐字段确认（不一次问完，一次一个）：

1. **Problem** — "基于调研，核心问题是 X，因为 Y。对吗？"
2. **Target User** — "目标用户是 X。对吗？"
3. **Appetite** — "建议投入 X 时间。这个封顶可以吗？"
4. **No-Gos** — "建议不做 X、Y、Z。还有要排除的吗？"

有 research-memo 时默认值来自调研结论；没有时 AI 根据用户描述推断，标 `[ASSUMED]`。

### Step 2: 起草 PRD

按模板逐节写。每个字段的值来源标注：

- `[CONFIRMED]` — 用户在 Step 1 确认的
- `[ASSUMED]` — AI 编了个合理值，需用户核验（不是事实，是推断）
- `[TBD]` — 用户还没决定（不是 AI 不知道，是用户说"还没想好"）

**PRD 文档模板**：

```markdown
# PRD: {title}
> Status: Draft
> Author: {username}
> Date: {yymmdd}
> Research: {research-memo 路径, 无则 "N/A"}

## Problem
[问题描述 + 痛点证据]
[主因 vs 辅因显式划分]

## User Stories
- As a [user], I want [action], so that [benefit] [CONFIRMED/TBD/ASSUMED]
- ...

## Appetite
[时间封顶 + 理由]
[这不是估时——是"最多愿意花多少", 超过就不值得做]

## Solution Direction
[粗粒度方向, 草图级, 不是详细设计]
[够说明可行性就行]

## Competitive Analysis
[功能矩阵引用 / 定位图引用, 来自 research-memo]
[无 research-memo 时标 [TBD] 或基于已知信息简写]

## Success Metrics
- Primary: [核心指标] [CONFIRMED/TBD]
- Secondary: [辅助指标] [CONFIRMED/TBD]
- Guardrail: [不能恶化的指标] [CONFIRMED/TBD]

## Rabbit Holes
[已知风险 + 技术不确定性]
[每条标注来源: research / 代码探索 / 推断]

## No-Gos
[明确不做什么]
[这是 PRD 里最有价值的一节——一半的范围蔓延来自没写下来的"不做"]

## Open Questions
- [TBD] 问题 1
- [TBD] 问题 2

## Source Appendix
[调研来源引用, 按 [SOURCE: url/path] 格式]
```

### Step 3: User Stories 确认

逐条展示 user story，用 AskUserQuestion 让用户确认/修改/删除：

- 确认 → 标 `[CONFIRMED]`
- 修改 → 记录修改后标 `[CONFIRMED]`
- 删除 → 移除
- 用户补充新 story → 加入并标 `[CONFIRMED]`

全删 → 回 Step 1 重新 clarify（可能问题理解有偏差）。

### Step 4: 自审

写完后五维检查：

| 维度 | 检查什么 |
|---|---|
| 完整性 | 所有核心字段都有内容？没有空节？ |
| 一致性 | Problem ↔ User Stories ↔ Success Metrics 三者对齐？ |
| 可测性 | 每条 Success Metric 可量化？能写验收标准？ |
| 边界 | No-Gos 覆盖了容易蔓延的方向？ |
| 假设标注 | 所有 `[ASSUMED]` 都标了？没有隐藏假设？ |

发现问题 → 修正后再进 Step 5。

### Step 5: 用户最终确认

用 AskUserQuestion 三选：

- **确认** → 保存文档
- **要修改** → 用户指出修改点，改完再确认
- **重来** → 回 Step 1

以下不算确认：
- "随你"/"都行" → 重新提具体选项
- "可以" → 追问"有没有要改的？"

### Step 6: 保存

文档存到 `docs/nocode/prds/{username}/{yymmdd}-{topic-slug}.prd.md`。

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

## Exit Gate

- [ ] PRD 文档已产出，包含所有核心字段
- [ ] User Stories 已逐条用户确认
- [ ] 自审五维通过
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
- No-Gos 为空（几乎不可能——总有不该做的东西）
- Success Metrics 写"用户满意"（不可量化 = 没写）
- User Stories 全是 AI 生成没有用户确认（假共识）
- 引用了不存在的调研数据（编造）
