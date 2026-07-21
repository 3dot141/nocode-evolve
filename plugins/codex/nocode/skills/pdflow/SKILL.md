---
name: pdflow
description: "产品发现工作流领航（Research → PRD · 2 场景路由）。可被 devflow 主动建议，也可用户 /调 进入。给\"当前阶段判断 + 下一步建议\"，用户拍板，不替执行。用于产品调…"
---

> 本文写“结构化决策”时，必须把当前步骤的完整问题与 2–3 个互斥选项编译为 `Capability(workflow.decision.request, {"question":"<self-contained current-step question>","options":[{"label":"<option-label>","description":"<impact or tradeoff>"}],"allowFreeform":false})`；示例只展示单项形状，真实调用需带齐本步骤列出的选项，不得回退到平台专属提问工具。

# nocode:pdflow — 产品阶段工作流领航

> 产品流驾驶舱。独立于 devflow，专管"开发前"的产品调研和需求定义。
>
> 与 devflow 的关系：devflow 管开发（Define → ... → Land），pdflow 管产品（Research → PRD → 交互设计 → 视觉设计）。两者通过 `.prd.md` + `.ix.md` + `.vd.md` 文档衔接。devflow Full 场景会建议先走 pdflow。

## 协议

> **顺序推进纪律（硬约束）**：禁止自动跳步。推进只有一条路：todo 写好流程 → 进入当前节点 → 顺序执行子步骤 → 逐条验证 Gate → 全部通过 → 报告用户 → 等用户拍板 → 才进下一阶段。agent 不得自行跳过、合并、快进任何阶段。"这步简单直接过" / "上一轮做过" 都不是跳步的理由。

> ❌ 反例：PRD 阶段判断"需求简单"，跳过用户确认直接快进交互设计——没确认的需求带着错误往下游设计流。
> ✅ 正例：简单需求也走完每个子步骤 + Gate + 等拍板；每阶段 todo 的最后一项是"调用下一阶段 skill"（如 Research 末尾 → 调 `nocode:pd-prd`）。

### Step 1: 判断场景

用户的产品意图有两种场景：

```
┌─ Full:  Research → PRD → 交互设计 → 视觉设计   (完整调研 + PRD + 界面设计)
└─ Light: PRD → 交互设计 → 视觉设计              (思路清晰, 直接 PRD + 设计)
```

> 交互设计（pd-ix）产出界面结构 + 交互流，视觉设计（pd-vd）产出视觉方向 + 高保真可交互原型（唯一档位）。**纯后端 / 无界面的需求可跳过两者**（见 Step 3）。

**判断信号**：

| 信号 | 场景 |
|---|---|
| 用户说"调研/看看竞品/市场调研" | **Full** — 先 Research 再 PRD |
| 用户说"写 PRD" + 没有已有调研 | **Full** — 建议先 Research |
| 用户说"写 PRD" + 已有 research-report 或思路清晰 | **Light** — 直接 PRD |
| devflow 建议走产品流 | **Full** — 默认完整 |
| 用户给了一句话模糊想法 | **Full** — 需要发散探索 |

用 `Capability(workflow.decision.request, {"question":"本次产品发现采用哪条路径？","options":[{"label":"Full（推荐）","description":"先 Research，再 PRD、交互与视觉设计"},{"label":"Light","description":"已有充分输入，直接 PRD、交互与视觉设计"}],"allowFreeform":false})` 确认场景：

- "你想完整调研再写 PRD（推荐），还是直接写 PRD？"
- 推荐放 Full，除非用户明确有充分信息

### Step 2: workflow.plan.create

为当前场景的阶段建 task。每个有对应 skill 的阶段（Research / PRD / 交互设计 / 视觉设计），**task description 的 sub-steps 链首固定写 `⓪ Skill(...)`**——把"加载该阶段 skill"钉成进入阶段的第一个动作。Handoff 是衔接动作，无 skill，不加 ⓪。最后一个阶段 task（Handoff）建 workflow.plan.create 时带 `metadata: {handoff: true}`——供防跳步 Hook B 识别交接 task。

**Full 场景**：
```
Task 1: Research — 发散探索（竞品/代码/市场/已有方案）
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-research","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 发散探索 → 产出 research-report
  Gate: research-report 产出 + Go/No-Go 用户拍板

Task 2: PRD — 收敛成文档
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-prd","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 读 memo + clarify → 写 .prd.md
  Gate: .prd.md 产出 + 用户确认

Task 3: 交互设计 — 界面结构 + 交互流（无界面需求可跳过）
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-ix","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 起点 → 竞品+交互拆解 → IA批准 → 产出 .ix.md
  Gate: .ix.md 产出 + 用户确认 IA

Task 4: 视觉设计 — 视觉方向 + 原型（无界面需求可跳过）
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-vd","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 视觉探索 → 交付线+方向 → DS(含落点) → 原型 → 产出 .vd.md
  Gate: .vd.md 产出 + 用户确认方向

Task 5: Handoff — 衔接开发流
  Gate: 用户决定是否进 devflow
```

**Light 场景**：
```
Task 1: PRD — 收敛成文档
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-prd","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 读 memo + clarify → 写 .prd.md
  Gate: .prd.md 产出 + 用户确认

Task 2: 交互设计 — 界面结构 + 交互流（无界面需求可跳过）
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-ix","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 起点 → 竞品+交互拆解 → IA批准 → 产出 .ix.md
  Gate: .ix.md 产出 + 用户确认 IA

Task 3: 视觉设计 — 视觉方向 + 原型（无界面需求可跳过）
  Sub-steps: ⓪ Capability(workflow.skill.invoke, {"skill":"pd-vd","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}}) → 视觉探索 → 交付线+方向 → DS(含落点) → 原型 → 产出 .vd.md
  Gate: .vd.md 产出 + 用户确认方向

Task 4: Handoff — 衔接开发流
  Gate: 用户决定是否进 devflow
```

调用时把所选场景的**每一条** Task 编译成稳定 item：`id` 固定、`subject` 为标题、`description` 完整包含 Sub-steps + Gate、初始 `status=pending`，仅 Handoff 设置 `handoff`。不得传空 items：

`Capability(workflow.plan.create, {"items":[{"id":"<stable-task-id>","subject":"<task-title>","description":"<complete Sub-steps and Gate>","status":"pending","handoff":"<handoff-item-only; otherwise omit>"}]})`

示例只展示单项形状；真实调用必须包含所选场景全部 items。保存返回的 `planRef`；每次进入或完成阶段都通过 `Capability(workflow.plan.update, {"planRef":"<planRef>","items":[{"id":"<same-stable-id>","subject":"<same-title>","description":"<same-complete-description>","status":"<pending|in_progress|completed>","handoff":"<preserve-final-item-handoff; otherwise omit>"}]})` 提交**完整快照**（示例仍只展示单项形状）；每次 update 必须原样保留最终 item 的 `handoff`，其它 item 继续省略该字段，不得发送单项 patch。

### Step 3: 推进阶段

每个阶段严格按以下 5 步执行，不跳不并行，缺任一步 = 跳步 bug：

1. **加载 skill（硬 Gate）**：标 in_progress 后的第一个动作必须是 `Capability(workflow.skill.invoke, {"skill":"pd-research","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` / `Capability(workflow.skill.invoke, {"skill":"pd-prd","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` / `Capability(workflow.skill.invoke, {"skill":"pd-ix","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` / `Capability(workflow.skill.invoke, {"skill":"pd-vd","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})`。没看到 Skill 调用回执，不许执行任何 sub-step——task description 里的 sub-steps 是地图，skill 内才有 clarify gate / 文档结构 / 标注约定这些详图。
2. **顺序执行 sub-steps**：按 task description 中的子步骤链逐个执行，每个子步骤完成后确认其条件满足再进下一个。
3. **Gate 证据点名**：所有子步骤完成后，逐条核对 Gate 条件 + 具体证据。任一条不满足 = 不标 completed。
4. **标 completed + 停下报告**：向用户报告本阶段完成情况 + 建议下一步。**不自动进入下一阶段。**
5. **等用户拍板**：用户明确说 OK / 继续，才标下一阶段 in_progress 并进入。

**Research → PRD 衔接**：Research 完成（Go）后，自动建议进 PRD：
> "调研完成，Go 已确认。建议下一步写 PRD，把调研结论收敛成需求文档。"

**PRD → 交互设计 衔接**：PRD 完成后，若需求涉及界面，自动建议进 pd-ix：
> "PRD 已就绪。建议下一步做交互设计，把需求落成界面结构 + 交互流。纯后端 / 无界面需求可跳过，直接 Handoff。"

**交互设计 → 视觉设计 衔接**：pd-ix 完成后，若需求涉及界面，自动建议进 pd-vd：
> "交互设计已就绪（`.ix.md`）。建议下一步做视觉设计，把交互骨架落成视觉方向 + 高保真可交互原型。只需交互规范的可跳过，直接 Handoff。"

**Research No-Go**：用户在 Research 阶段选了 No-Go → pdflow 结束，不进 PRD：
> "调研结论是 No-Go。产品流结束。如果要重新评估，可以再次调起 pdflow。"

### Step 4: Handoff — 衔接开发流

视觉设计完成后（或无界面需求跳过 pd-ix/pd-vd 后），提示用户下一步选择：

用 结构化决策 三选：

1. **进 devflow** — "PRD + 设计已就绪，进入开发流。devflow 的 Define/Design 会以 PRD（做什么）+ design（长什么样）为输入。"
2. **先沉淀** — "PRD 先放着，不急开发。可以用 `/distill` 沉淀这次讨论。"
3. **结束** — "产品流结束。后续随时可以调 devflow 开始开发。"

## 全景图

```
                       pdflow (产品流)                               devflow (开发流)
┌──────────────────────────────────────────────────────────┐   ┌──────────────────────────────┐
│                                                          │   │                              │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐   │   │  Define → Env → Design →    │
│  │Research │─▶│  PRD   │─▶│ 交互设计  │─▶│ 视觉设计  │───┼──▶│  Plan → Build → Verify →   │
│  │ (发散)  │  │ (收敛) │  │ (pd-ix)  │  │ (pd-vd)  │   │   │  Review → Land              │
│  └────────┘  └────────┘  └──────────┘  └──────────┘   │   │                              │
│                                                          │   │                              │
│  产出: research-report.md  .prd.md  .ix.md  .vd.md       │   │  输入: .prd.md + .ix.md + .vd.md │
│                                                          │   │                              │
└──────────────────────────────────────────────────────────┘   └──────────────────────────────┘
```

## 场景差异速查

| | Full | Light |
|---|---|---|
| Research | 完整（4 切面可裁剪） | 跳过 |
| PRD | 有 memo 输入 | 无 memo，纯问答 |
| 交互设计 | ✅（无界面需求可跳过） | ✅（无界面需求可跳过） |
| 视觉设计 | ✅（无界面需求可跳过） | ✅（无界面需求可跳过） |
| Handoff | ✅ | ✅ |

## 与 devflow 的交互

- **devflow → pdflow**：devflow Define 判 Full 场景 + 无已有 PRD → 建议"先走 pdflow"
- **pdflow → devflow**：PRD 完成后 Handoff 阶段建议"进 devflow"
- **独立调起**：用户直接 `/pdflow` 或说"产品调研"，不经 devflow
- **不嵌套**：pdflow 和 devflow 是平级关系，不是父子。一个结束另一个才开始

## 回流路径

| 从 | 到 | 条件 |
|---|---|---|
| PRD | Research | PRD 写作中发现信息不足 → 回 Research 补充 |
| 交互设计 | PRD | 设计时发现需求有歧义/缺失 → 回 PRD 修订 |
| 视觉设计 | 交互设计 | 视觉阶段发现交互/IA 有缺失 → 回 pd-ix 修订 |
| Handoff | 视觉设计 | 用户看完设计想改 → 回 pd-vd 修订 |
| devflow Define | pdflow | Define 发现需求不清 → 建议回 pdflow |

## 不要

- **不替用户执行** — 给建议后停下，等用户拍板
- **不自动进入下一阶段** — 标 completed 后停下报告，等用户说"继续"才进下一阶段。"已经做完了直接走下一步" = 自动跳步
- **不照 todo 裸跑** — 进入 Research / PRD 阶段，标 in_progress 后第一个动作先 `Skill()` 加载该阶段 skill，再走 sub-steps。只跑 todo 不加载 skill = 丢失 skill 内的 clarify gate / 文档结构 / 标注约定
- **不自行跳 Research** — Full 场景不跳 Research，除非用户显式说"跳过调研"
- **交互/视觉设计按需跳** — 纯后端 / 无界面需求可跳过 pd-ix/pd-vd，但有界面时不省略（界面结构留空 = 开发瞎猜）
- **不在 pdflow 内做技术设计** — 技术设计是 devflow Design 的事（pd-ix/pd-vd 只做界面交互 + 视觉，不碰技术架构 / API）
- **不强制进 devflow** — Handoff 给选择，不自动开始开发
