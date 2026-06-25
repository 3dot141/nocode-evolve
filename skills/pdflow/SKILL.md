---
name: pdflow
description: 产品发现工作流领航（Research → PRD · 2 场景路由）。可被 devflow 主动建议，也可用户 /调 进入。给"当前阶段判断 + 下一步建议"，用户拍板，不替执行。用于产品调研和需求定义阶段，独立于开发流 devflow。触发：用户说"pdflow/产品发现/走产品阶段/先调研再写 PRD"，或 devflow Full 场景建议先走产品流。
---

# nocode-evolve:pdflow — 产品阶段工作流领航

> 产品流驾驶舱。独立于 devflow，专管"开发前"的产品调研和需求定义。
>
> 与 devflow 的关系：devflow 管开发（Define → ... → Land），pdflow 管产品（Research → PRD → 交互视觉设计）。两者通过 `.prd.md` + `.design.md` 文档衔接。devflow Full 场景会建议先走 pdflow。

## 协议

> **顺序推进纪律（硬约束）**：禁止自动跳步。推进只有一条路：todo 写好流程 → 进入当前节点 → 顺序执行子步骤 → 逐条验证 Gate → 全部通过 → 报告用户 → 等用户拍板 → 才进下一阶段。agent 不得自行跳过、合并、快进任何阶段。"这步简单直接过" / "上一轮做过" 都不是跳步的理由。

### Step 1: 判断场景

用户的产品意图有两种场景：

```
┌─ Full:  Research → PRD → 交互视觉设计   (完整调研 + PRD + 界面设计)
└─ Light: PRD → 交互视觉设计              (思路清晰, 直接 PRD + 设计)
```

> 交互视觉设计（pd-vis）产出界面结构 + 视觉方向，保真度可选（默认低保真 wireframe）。**纯后端 / 无界面的需求可跳过**（见 Step 3）。

**判断信号**：

| 信号 | 场景 |
|---|---|
| 用户说"调研/看看竞品/市场调研" | **Full** — 先 Research 再 PRD |
| 用户说"写 PRD" + 没有已有调研 | **Full** — 建议先 Research |
| 用户说"写 PRD" + 已有 research-memo 或思路清晰 | **Light** — 直接 PRD |
| devflow 建议走产品流 | **Full** — 默认完整 |
| 用户给了一句话模糊想法 | **Full** — 需要发散探索 |

用 AskUserQuestion 确认场景：

- "你想完整调研再写 PRD（推荐），还是直接写 PRD？"
- 推荐放 Full，除非用户明确有充分信息

### Step 2: TaskCreate

为当前场景的阶段建 task。每个有对应 skill 的阶段（Research / PRD / 交互视觉设计），**task description 的 sub-steps 链首固定写 `⓪ Skill(...)`**——把"加载该阶段 skill"钉成进入阶段的第一个动作。Handoff 是衔接动作，无 skill，不加 ⓪。

**Full 场景**：
```
Task 1: Research — 发散探索（竞品/代码/市场/已有方案）
  Sub-steps: ⓪ Skill(nocode-evolve:pd-research) → 发散探索 → 产出 research-memo
  Gate: research-memo 产出 + Go/No-Go 用户拍板

Task 2: PRD — 收敛成文档
  Sub-steps: ⓪ Skill(nocode-evolve:pd-prd) → 读 memo + clarify → 写 .prd.md
  Gate: .prd.md 产出 + 用户确认

Task 3: 交互视觉设计 — 界面结构 + 视觉方向（无界面需求可跳过）
  Sub-steps: ⓪ Skill(nocode-evolve:pd-vis) → 读 PRD + 选保真度 → wireframe(批准) → 方向发散 → 产出 .design.md
  Gate: .design.md 产出 + 用户确认方向

Task 4: Handoff — 衔接开发流
  Gate: 用户决定是否进 devflow
```

**Light 场景**：
```
Task 1: PRD — 收敛成文档
  Sub-steps: ⓪ Skill(nocode-evolve:pd-prd) → 读 memo + clarify → 写 .prd.md
  Gate: .prd.md 产出 + 用户确认

Task 2: 交互视觉设计 — 界面结构 + 视觉方向（无界面需求可跳过）
  Sub-steps: ⓪ Skill(nocode-evolve:pd-vis) → 读 PRD + 选保真度 → wireframe(批准) → 方向发散 → 产出 .design.md
  Gate: .design.md 产出 + 用户确认方向

Task 3: Handoff — 衔接开发流
  Gate: 用户决定是否进 devflow
```

### Step 3: 推进阶段

每个阶段严格按以下 5 步执行，不跳不并行，缺任一步 = 跳步 bug：

1. **加载 skill（硬 Gate）**：标 in_progress 后的第一个动作必须是 `Skill(nocode-evolve:pd-research)` / `Skill(nocode-evolve:pd-prd)` / `Skill(nocode-evolve:pd-vis)`。没看到 Skill 调用回执，不许执行任何 sub-step——task description 里的 sub-steps 是地图，skill 内才有 clarify gate / 文档结构 / 标注约定这些详图。
2. **顺序执行 sub-steps**：按 task description 中的子步骤链逐个执行，每个子步骤完成后确认其条件满足再进下一个。
3. **Gate 证据点名**：所有子步骤完成后，逐条核对 Gate 条件 + 具体证据。任一条不满足 = 不标 completed。
4. **标 completed + 停下报告**：向用户报告本阶段完成情况 + 建议下一步。**不自动进入下一阶段。**
5. **等用户拍板**：用户明确说 OK / 继续，才标下一阶段 in_progress 并进入。

**Research → PRD 衔接**：Research 完成（Go）后，自动建议进 PRD：
> "调研完成，Go 已确认。建议下一步写 PRD，把调研结论收敛成需求文档。"

**PRD → 交互视觉设计 衔接**：PRD 完成后，若需求涉及界面，自动建议进 pd-vis：
> "PRD 已就绪。建议下一步做交互视觉设计，把需求落成界面结构 + 视觉方向（默认低保真 wireframe，可升档）。纯后端 / 无界面需求可跳过，直接 Handoff。"

**Research No-Go**：用户在 Research 阶段选了 No-Go → pdflow 结束，不进 PRD：
> "调研结论是 No-Go。产品流结束。如果要重新评估，可以再次调起 pdflow。"

### Step 4: Handoff — 衔接开发流

交互视觉设计完成后（或无界面需求跳过 pd-vis 后），提示用户下一步选择：

用 AskUserQuestion 三选：

1. **进 devflow** — "PRD + 设计已就绪，进入开发流。devflow 的 Define/Design 会以 PRD（做什么）+ design（长什么样）为输入。"
2. **先沉淀** — "PRD 先放着，不急开发。可以用 `/distill` 沉淀这次讨论。"
3. **结束** — "产品流结束。后续随时可以调 devflow 开始开发。"

## 全景图

```
                  pdflow (产品流)                        devflow (开发流)
┌────────────────────────────────────────────────┐   ┌──────────────────────────────┐
│                                                │   │                              │
│  ┌────────┐   ┌────────┐   ┌──────────────┐   │   │  Define → Env → Design →    │
│  │Research │─▶│  PRD   │─▶│ 交互视觉设计  │───┼──▶│  Plan → Build → Verify →   │
│  │ (发散)  │   │ (收敛) │   │  (pd-vis)    │   │   │  Review → Land              │
│  └────────┘   └────────┘   └──────────────┘   │   │                              │
│                                                │   │                              │
│  产出: research-memo.md  .prd.md  .design.md  │   │  输入: .prd.md + .design.md │
│                                                │   │                              │
└────────────────────────────────────────────────┘   └──────────────────────────────┘
```

## 场景差异速查

| | Full | Light |
|---|---|---|
| Research | 完整（4 切面可裁剪） | 跳过 |
| PRD | 有 memo 输入 | 无 memo，纯问答 |
| 交互视觉设计 | ✅（无界面需求可跳过） | ✅（无界面需求可跳过） |
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
| 交互视觉设计 | PRD | 设计时发现需求有歧义/缺失 → 回 PRD 修订 |
| Handoff | 交互视觉设计 | 用户看完设计想改 → 回 pd-vis 修订 |
| devflow Define | pdflow | Define 发现需求不清 → 建议回 pdflow |

## 不要

- **不替用户执行** — 给建议后停下，等用户拍板
- **不自动进入下一阶段** — 标 completed 后停下报告，等用户说"继续"才进下一阶段。"已经做完了直接走下一步" = 自动跳步
- **不照 todo 裸跑** — 进入 Research / PRD 阶段，标 in_progress 后第一个动作先 `Skill()` 加载该阶段 skill，再走 sub-steps。只跑 todo 不加载 skill = 丢失 skill 内的 clarify gate / 文档结构 / 标注约定
- **不自行跳 Research** — Full 场景不跳 Research，除非用户显式说"跳过调研"
- **交互视觉设计按需跳** — 纯后端 / 无界面需求可跳过 pd-vis，但有界面时不省略（界面结构留空 = 开发瞎猜）
- **不在 pdflow 内做技术设计** — 技术设计是 devflow Design 的事（pd-vis 只做界面交互 + 视觉，不碰技术架构 / API）
- **不强制进 devflow** — Handoff 给选择，不自动开始开发
