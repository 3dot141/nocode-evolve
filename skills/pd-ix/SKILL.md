---
name: pd-ix
description: Use when the user wants to design the interaction structure of a product after the PRD is defined. Use when the user says "交互设计/信息架构/页面流/交互拆解/IA/用户流程", or when pdflow routes to the interaction design stage after PRD. Produces a .ix.md (interaction spec with IA, page flow, and interaction breakdown). Not for visual design (use nocode-evolve:pd-vd), technical architecture (use nocode-evolve:dev-design), or production component code (use devflow Build).
---

# pd-ix — 交互设计

**Iron Law: PRD 说"做什么"，没说"怎么走"。交互结构不定，视觉只是贴皮。**

独立于 devflow 的产品流交互设计阶段。产出 `.ix.md`，作为视觉设计（pd-vd）和开发的输入。

## 渐进式披露

交互阶段的产出是完整交付物，不是半成品。用户拿到 `.ix.md` 可以直接进开发，也可以继续进 pd-vd 加视觉。

```
pd-ix → ASCII 线框 + IA + 交互流    → 可交付 ✓
         ↓ 要视觉？
pd-vd → 低保真 / 高保真 / 完整实现   → 可交付 ✓
```

## 边界

| pd-ix 做 | 不做（→ 去哪） |
|---|---|
| 信息架构、页面/视图清单 | 视觉方向、配色排版 → pd-vd |
| 关键用户流程、交互态 | 可交互原型 → pd-vd |
| ASCII 线框、4 态枚举 | 技术架构、模块划分 → dev-design |
| 竞品交互分析 | 生产级组件代码 → devflow Build |

**非本 skill**：无 PRD → 先 pd-prd。要视觉设计 → pd-vd。要技术架构 → dev-design。

## Enter Gate

- [ ] pd-ix skill 已加载
- [ ] 有 `.prd.md` 或明确的产品上下文（无 → 建议先 pd-prd）

## Step 0: TaskCreate

**进入 pd-ix 后第一件事**，创建以下全部 task：

```
Task 1: 确定起点 — 读 PRD + 查 .ix.md
  Sub-steps: 读 PRD 提取路径 → 查已有 .ix.md → 定起点
  Gate: 起点已确认（复用/自填/从零）

Task 2: 竞品探索 + 逐交互拆解
  Sub-steps: 并行竞品+现状 → 提交互清单 → 逐交互四块 → 用户校验
  Gate: 交互清单覆盖全路径，每个交互锁定

Task 3: IA 汇总 + 用户批准
  Sub-steps: 汇总 IA → approve gate → 写 .ix.md
  Gate: IA 经批准，.ix.md 已写入

Task 4: 保存 + Handoff
  Sub-steps: 保存 .ix.md → 提示下一步：有界面 → 调 Skill(nocode-evolve:pd-vd)；否则进 devflow
  Gate: 文件保存，全部 Task 更新
```

每完成一个标 done。

---

## Step 1: 确定起点

**Enter Gate:**
- [ ] Step 0 完成（Task 已创建）

**Core Actions:**
1. **读 PRD** — 提取使用路径（含路径 ID）+ 目标用户 + 功能清单
2. **查已有 `.ix.md`** — 在 `{pd_ix_output}` 查：
   - 有 → 用户确认：沿用（跳 Step 2 直接 Handoff）/ 重设计（继续 Step 2）
   - 没有 → 用户自填（跳 Step 2 直接 Handoff）/ 从零设计（继续 Step 2）

**Exit Gate:**
- [ ] PRD 已读，路径清单已提取
- [ ] 起点已确认

---

## Step 2: 竞品探索 + 逐交互拆解

> 先看别人怎么做，再按交互粒度逐个拆。全部锁定后才汇总 IA——不允许反过来。

**Enter Gate:**
- [ ] 起点为「从零设计」或「重设计」

**Core Actions:**
1. **竞品与产品探索** — 并行 spawn 两个方向（竞品 + 产品现状）
2. **提取交互清单** — 从使用路径拆交互点
3. **逐交互调研 + 设计 + 线框** — 每个交互四块（竞品做法 / 设计决策 / ASCII 线框 / 4 态）
4. **逐交互用户校验** — 每个交互最多 3 轮，全部锁定才进 Step 3

**Exit Gate:**
- [ ] 竞品参考表已产出（≥3 竞品，标 `[SOURCE]`）
- [ ] 交互清单覆盖全部使用路径
- [ ] 每个交互四块已完成 + 用户已锁定

> 展开 → `references/step-1-exploration.md`、`references/step-3-interaction-breakdown.md`

---

## Step 3: IA 汇总 + 用户批准

**Enter Gate:**
- [ ] 全部交互已锁定

**Core Actions:**
1. **IA 汇总** — 页面/视图清单 + 导航结构 + 页面间跳转
2. **用户批准**（approve gate）
3. **写入 `.ix.md`** — 交互流（标路径 ID）+ IA + 线框/4 态

**Exit Gate:**
- [ ] IA 经用户批准
- [ ] `.ix.md` 已写入

---

## Step 4: 保存 + Handoff

**Core Actions:**
1. `.ix.md` → `{pd_ix_output}`
2. 提示下一步选择：
   - **进 pd-vd**（推荐，有界面需求时）→ 调 `Skill(nocode-evolve:pd-vd)` 做视觉设计
   - **直接进 devflow** → 以 PRD + `.ix.md` 为输入

**Exit Gate:**
- [ ] `.ix.md` 已保存
- [ ] 全部 Task 已更新

---

## Exit Gate (Global)

- [ ] PRD 已读，路径清单已提取
- [ ] 交互清单覆盖全部使用路径，每个交互锁定
- [ ] IA 经用户批准
- [ ] `.ix.md` 已保存到 `{pd_ix_output}`

## AI 能力边界

| AI 能做 | AI 不能做（标 `[ASSUMED]`） |
|---|---|
| wireframe / IA / 交互流 | 真实用户可用性测试 |
| 竞品交互分析 | A/B 测试预判 |
| 状态/边界枚举 | 用户认知负荷量化 |

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "界面让开发看着办" | 你没决定的地方由实现细节替你决定 |
| "先拍个 IA 再补交互" | IA 是从交互拆解汇总出来的 |
| "交互太简单不用拆" | 简单的交互也有 empty/loading/error 态 |
| "直接出视觉更快" | 没批准交互就出视觉 = 在未验证的骨架上贴皮 |
| "这个改动简单，跳过某 Step 或不建 TaskCreate" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权（详见 agent-catalog-using.md「进了 skill 就走完」） |

## Red Flags

- 没建 TaskCreate 就开始做
- 跳 Step 2 直接出 IA
- IA 先于交互拆解产出
- wireframe 缺 empty/loading/error
- 交互流没标路径 ID
- 没对照 PRD 逐条核路径
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
