---
name: pd-ix
description: Use after PRD for interaction design, information architecture, page flows, or an .ix.md specification. Not for visual design, technical architecture, or production code.
---

# pd-ix — 交互设计

**Iron Law: PRD 说"做什么"，没说"怎么走"。交互结构不定，视觉只是贴皮。**

<!-- nocode:platform claude -->
计划使用 `TaskCreate` / `TaskUpdate`；handoff 使用 `Skill(nocode:pd-vd)`。
<!-- /nocode:platform -->
<!-- nocode:platform codex -->
计划使用 `update_plan`；handoff 使用 `$pd-vd`。
<!-- /nocode:platform -->
<!-- nocode:platform pi -->
计划使用文本里程碑列表（同时最多一个进行中）；handoff 使用 `/skill:pd-vd`。
<!-- /nocode:platform -->

独立于 devflow 的产品流交互设计阶段。产出 `.ix.md`，作为视觉设计（pd-vd）和开发的输入。

## 渐进式披露

交互阶段的产出是完整交付物，不是半成品。用户拿到 `.ix.md` 可以直接进开发，也可以继续进 pd-vd 加视觉。

```
pd-ix → ASCII 线框 + IA + 交互流    → 可交付 ✓
         ↓ 要视觉？
pd-vd → 高保真可交互原型             → 可交付 ✓
```

## 边界

| pd-ix 做 | 不做（→ 去哪） |
|---|---|
| 信息架构、页面/视图清单 | 视觉方向、配色排版 → pd-vd |
| 关键用户流程、行为规格 | 可交互原型 → pd-vd |
| ASCII 线框、状态覆盖枚举 | 控件四态样式（pd-vd 域）→ pd-vd |
| 竞品交互分析、场景脚本 | 技术架构、模块划分 → dev-design |
| | 生产级组件代码 → devflow Build |

**非本 skill**：无 PRD → 先 pd-prd。要视觉设计 → pd-vd。要技术架构 → dev-design。

> IX↔VD 分工判据与共享术语（状态覆盖 / 行为规格 / 控件四态）单源在 `{NOCODE_SKILL_REF}/ix-vd-contract.md`——该态改变内容或行为归本 skill，纯样式反馈归 pd-vd。

## Enter Gate

- [ ] pd-ix skill 已加载
- [ ] 有 `.prd.md` 或明确的产品上下文（无 → 建议先 pd-prd）

## Step 0: workflow.plan.create

**进入 pd-ix 后第一件事**，创建以下全部 task：

```
Task 1: 确定起点 — 读 PRD + 查 .ix.md
  Sub-steps: 读 PRD 提取路径 → 查已有 .ix.md → 定起点
  Gate: 起点已确认（复用/自填/从零）

Task 2: 竞品探索 + 逐交互拆解
  Sub-steps: 并行竞品+现状 → 提交互清单 → 逐交互五块 → 分批校验
  Gate: 交互清单覆盖全路径，每个交互锁定

Task 3: IA 汇总 + 完整性四查 + 用户批准
  Sub-steps: 汇总 IA → 场景脚本 → 完整性四查 → approve gate → 写 .ix.md
  Gate: 四查全过，IA 经批准，.ix.md 已写入

Task 4: 保存 + Handoff
  Sub-steps: 保存 .ix.md → 提示下一步：有界面 → 调用 pd-vd 并传入完整上下文信封；否则进 devflow
  Gate: 文件保存，全部 Task 更新
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

调用时把上面**每一条** Task 建成稳定计划项，不得提交空计划。每次状态变化都通过本平台原生计划工具提交稳定顺序的完整状态；Codex 同时最多一个 `in_progress`。

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
3. **逐交互调研 + 设计 + 线框** — 每个交互五块（竞品做法 / 设计决策 / ASCII 线框 / 状态覆盖 / 行为规格），五块全必填，无分级
4. **分批用户校验** — 有争议交互（设计决策标 `[TRADEOFF]`）逐个校验；常规交互按路径打包整批校验。每个交互最多 3 轮，全部锁定才进 Step 3

**Exit Gate:**
- [ ] 竞品参考表已产出（≥3 竞品，标 `[SOURCE]`）
- [ ] 交互清单覆盖全部使用路径
- [ ] 每个交互五块已完成 + 用户已锁定（含批量锁定）

> 展开 → `references/step-1-exploration.md`、`references/step-3-interaction-breakdown.md`

---

## Step 3: IA 汇总 + 完整性四查 + 用户批准

**Enter Gate:**
- [ ] 全部交互已锁定

**Core Actions:**
1. **IA 汇总** — 页面/视图清单 + 导航结构 + 页面间跳转
2. **场景脚本** — 每条 PRD 路径至少一个带具体数据的走查实例（用户是谁 / 输入什么 / 每步看到什么，引用交互 ID）。它是批准 IA 的可读材料，也是 pd-vd 原型 demo 编排和 dev-verify E2E 场景的直接来源
3. **完整性四查**（机械核对，结果落 `.ix.md`）：

   | # | 查什么 | 不过的处理 |
   |---|---|---|
   | 正向 | PRD 每条路径 → ≥1 交互 | 补交互 |
   | 反向 | 每个交互 → 映射回某条路径 | 无归属 = 镀金，删交互或补 PRD |
   | 连通 | 每个页面从入口可达 | 孤岛页显式标注理由（404 / 邮件落地页） |
   | 出口 | 每个交互的 error/empty 态有下一步（重试/引导/返回） | 补死胡同的出口 |

4. **用户批准**（approve gate）
5. **写入 `.ix.md`** — 交互流（标路径 ID）+ IA + 场景脚本 + 五块拆解 + 四查结果

**Exit Gate:**
- [ ] 完整性四查全过（或孤岛已显式标注）
- [ ] IA 经用户批准
- [ ] `.ix.md` 已写入

> 展开：场景脚本 / 四查落盘格式 → `references/step-3-interaction-breakdown.md`（2d 节）

---

## Step 4: 保存 + Handoff

**Core Actions:**
1. `.ix.md` → `{pd_ix_output}`
2. 提示下一步选择：
   - **进 pd-vd**（推荐，有界面需求时）→ 按上方平台语法调用 pd-vd，传入 request/stage/restate/artifacts/constraints/decision
   - **直接进 devflow** → 以 PRD + `.ix.md` 为输入

**Exit Gate:**
- [ ] `.ix.md` 已保存
- [ ] 全部 Task 已更新

---

## Exit Gate (Global)

- [ ] PRD 已读，路径清单已提取
- [ ] 交互清单覆盖全部使用路径，每个交互五块锁定
- [ ] 完整性四查全过，场景脚本覆盖每条路径
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
| "交互太简单不用拆" | 简单的交互也有 empty/loading/error 态；行为规格五块必填，不适用的字段填 N/A + 理由 |
| "hover/disabled 是视觉的事" | 态改变内容或行为就归 IX（判据见 ix-vd-contract）；pd-vd 只管控件四态的样式 |
| "直接出视觉更快" | 没批准交互就出视觉 = 在未验证的骨架上贴皮 |
| "这个改动简单，跳过某 Step 或不建 workflow.plan.create" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权 |

## Red Flags

- 没建 workflow.plan.create 就开始做
- 跳 Step 2 直接出 IA
- IA 先于交互拆解产出
- wireframe 缺 empty/loading/error
- 行为规格字段留空（不适用也必须填 N/A + 一句理由）；浮层类交互的「退出」填了 N/A
- 交互流没标路径 ID
- 没对照 PRD 逐条核路径；完整性四查没跑就请求批准 IA
- `.ix.md` 里出现 hex / px / 动画时长等样式值（违反 ix-vd-contract 禁令）
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 workflow.plan.create、或漏掉最后的交接 task
