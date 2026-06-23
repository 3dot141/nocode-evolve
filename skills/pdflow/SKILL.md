---
name: pdflow
description: 产品发现工作流领航（Research → PRD · 2 场景路由）。可被 devflow 主动建议，也可用户 /调 进入。给"当前阶段判断 + 下一步建议"，用户拍板，不替执行。用于产品调研和需求定义阶段，独立于开发流 devflow。触发：用户说"discoveryflow/产品发现/走产品阶段/先调研再写 PRD"，或 devflow Full 场景建议先走产品流。
---

# nocode-evolve:pdflow — 产品阶段工作流领航

> 产品流驾驶舱。独立于 devflow，专管"开发前"的产品调研和需求定义。
>
> 与 devflow 的关系：devflow 管开发（Define → ... → Land），discoveryflow 管产品（Research → PRD）。两者通过 `.prd.md` 文档衔接。devflow Full 场景会建议先走 discoveryflow。

## 协议

### Step 1: 判断场景

用户的产品意图有两种场景：

```
┌─ Full:  Research → PRD   (需要完整调研 + 写 PRD)
└─ Light: PRD-only         (已有调研/思路清晰, 直接写 PRD)
```

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

为当前场景的阶段建 task：

**Full 场景**：
```
Task 1: Research — 发散探索（竞品/代码/市场/已有方案）
  调用: nocode-evolve:pd-research
  Gate: research-memo 产出 + Go/No-Go 用户拍板

Task 2: PRD — 收敛成文档
  调用: nocode-evolve:pd-prd
  Gate: .prd.md 产出 + 用户确认

Task 3: Handoff — 衔接开发流
  Gate: 用户决定是否进 devflow
```

**Light 场景**：
```
Task 1: PRD — 收敛成文档
  调用: nocode-evolve:pd-prd
  Gate: .prd.md 产出 + 用户确认

Task 2: Handoff — 衔接开发流
  Gate: 用户决定是否进 devflow
```

### Step 3: 推进阶段

每个阶段：

1. 调用对应的 skill（`nocode-evolve:pd-research` 或 `nocode-evolve:pd-prd`）
2. skill 完成后检查 Gate
3. Gate 证据点名后标 completed → 下一阶段

**Research → PRD 衔接**：Research 完成（Go）后，自动建议进 PRD：
> "调研完成，Go 已确认。建议下一步写 PRD，把调研结论收敛成需求文档。"

**Research No-Go**：用户在 Research 阶段选了 No-Go → discoveryflow 结束，不进 PRD：
> "调研结论是 No-Go。产品流结束。如果要重新评估，可以再次调起 discoveryflow。"

### Step 4: Handoff — 衔接开发流

PRD 完成后，提示用户下一步选择：

用 AskUserQuestion 三选：

1. **进 devflow** — "PRD 已就绪，进入开发流。devflow 的 Define 会以这份 PRD 为输入。"
2. **先沉淀** — "PRD 先放着，不急开发。可以用 `/distill` 沉淀这次讨论。"
3. **结束** — "产品流结束。后续随时可以调 devflow 开始开发。"

## 全景图

```
          discoveryflow (产品流)                    devflow (开发流)
┌────────────────────────────────────┐   ┌──────────────────────────────┐
│                                    │   │                              │
│  ┌──────────┐    ┌──────────┐     │   │  Define → Env → Design →    │
│  │ Research  │───▶│   PRD    │─────┼──▶│  Plan → Build → Verify →   │
│  │ (发散)    │    │ (收敛)   │     │   │  Review → Land              │
│  └──────────┘    └──────────┘     │   │                              │
│                                    │   │                              │
│  产出: research-memo.md  .prd.md  │   │  输入: .prd.md              │
│                                    │   │                              │
└────────────────────────────────────┘   └──────────────────────────────┘
```

## 场景差异速查

| | Full | Light |
|---|---|---|
| Research | 完整（4 切面可裁剪） | 跳过 |
| PRD | 有 memo 输入 | 无 memo，纯问答 |
| Handoff | ✅ | ✅ |

## 与 devflow 的交互

- **devflow → discoveryflow**：devflow Define 判 Full 场景 + 无已有 PRD → 建议"先走 discoveryflow"
- **discoveryflow → devflow**：PRD 完成后 Handoff 阶段建议"进 devflow"
- **独立调起**：用户直接 `/discoveryflow` 或说"产品调研"，不经 devflow
- **不嵌套**：discoveryflow 和 devflow 是平级关系，不是父子。一个结束另一个才开始

## 回流路径

| 从 | 到 | 条件 |
|---|---|---|
| PRD | Research | PRD 写作中发现信息不足 → 回 Research 补充 |
| Handoff | PRD | 用户看完 PRD 想改 → 回 PRD 修订 |
| devflow Define | discoveryflow | Define 发现需求不清 → 建议回 discoveryflow |

## 不要

- **不替用户执行** — 给建议后停下，等用户拍板
- **不自行跳 Research** — Full 场景不跳 Research，除非用户显式说"跳过调研"
- **不在 discoveryflow 内做技术设计** — 技术设计是 devflow Design 的事
- **不强制进 devflow** — Handoff 给选择，不自动开始开发
