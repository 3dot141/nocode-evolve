---
name: pd-ui
description: Use when the user wants to design the interaction and visual direction of a product after the PRD is defined. Use when the user says "交互设计/视觉设计/界面设计/原型/wireframe/线框图/设计稿/长什么样", or when pdflow routes to the interaction-visual-design stage after PRD. Produces a .ui.md (interaction + visual spec), with optional low/high-fidelity prototypes via Claude Design or local HTML. Not for technical architecture (use nocode-evolve:dev-design) or production component code (use devflow Build).
---

# pd-ui — 交互视觉设计

**Iron Law: PRD 说"做什么"，没说"长什么样、怎么走"。这层空白不填，开发只能边写边猜。**

独立于 devflow 的产品流第三阶段。产出 `.ui.md`，和 `.prd.md` 一起作为开发输入。

## 渐进式披露

每一层都是完整交付物，不是半成品。用户随时可以停，需要更多时在已有基础上往上加，不推翻重来。

```
交互阶段 → ASCII 线框 + IA          → 可交付 ✓
            ↓ 要更多？
视觉阶段 → 低保真静态 UI             → 可交付 ✓
            ↓ 要更多？
         → 高保真可交互原型           → 可交付 ✓
```

每次升档基于前一档。跳档 = 在未批准的骨架上贴皮。

## 边界

| pd-ui 做 | 不做（→ 去哪） |
|---|---|
| 信息架构、页面/视图清单 | 技术架构、模块划分 → dev-design |
| 关键用户流程、交互态 | 数据流、API、数据库 → dev-design |
| wireframe、视觉方向、配色排版 | 生产级组件代码 → devflow Build |
| 可交互原型（Claude Design / HTML） | 技术栈选型 → dev-design |

**非本 skill**：无 PRD → 先 pd-prd。要技术架构 → dev-design。要生产代码 → devflow Build。

## Entry Gate

- [ ] pd-ui skill 已加载
- [ ] 有 `.prd.md` 或明确的产品上下文（无 → 建议先 pd-prd）

## Step 0: TaskCreate

**进入 pd-ui 后第一件事**，创建以下全部 task：

```
Task 1: 确定起点 — 读 PRD + 查 .ui.md
  Sub-steps: 读 PRD 提取路径 → 查已有 .ui.md → 定起点
  Gate: 起点已确认（复用/自填/从零）

Task 2: 竞品探索 + 逐交互拆解
  Sub-steps: 并行竞品+现状 → 提交互清单 → 逐交互四块 → 用户校验
  Gate: 交互清单覆盖全路径，每个交互锁定

Task 3: IA 汇总 + 用户批准
  Sub-steps: 汇总 IA → approve gate → 写 .ui.md 交互部分
  Gate: IA 经批准，.ui.md 交互部分写入

Task 4: 视觉探索
  Sub-steps: 问竞品截图 → 搜 Template
  Gate: 视觉参考集整理

Task 5: 保真度 + 交付方式 + 视觉方向
  Sub-steps: 选保真度 → 选交付方式 → 定视觉方向
  Gate: 三项已定（ASCII 档跳 Task 6-7）

Task 6: Design System 决策
  Sub-steps: 判需求 → 搜已有 → 创建（三步走）
  Gate: skip/复用/创建完成（ASCII 档 skip）

Task 7: 生成原型
  Sub-steps: 回查交付方式 → Claude Design 或本地 HTML 出稿
  Gate: 原型产出（ASCII 档 skip）

Task 8: 验证
  Sub-steps: PRD 路径走查 → 五维自审 → vis-review
  Gate: 走查 + 自审通过

Task 9: 保存 + Handoff
  Sub-steps: 写 .ui.md + 保存原型 → 提示 devflow
  Gate: 文件保存，全部 Task 更新
```

每完成一个标 done。不适用的标 skip + 原因（如 ASCII 档跳 Task 6-7）。

---

# 交互阶段

## Step 1: 确定起点

**Entry Gate:**
- [ ] Step 0 完成（Task 已创建）

**Core Actions:**
1. **读 PRD** — 提取使用路径（含路径 ID）+ 目标用户 + 功能清单
2. **查已有 `.ui.md`** — 在 `{pd_ui_output}` 查：
   - 有 → 用户确认：沿用（跳 Step 4）/ 重设计（继续 Step 2）
   - 没有 → 用户自填（跳 Step 4）/ 从零设计（继续 Step 2）

**Exit Gate:**
- [ ] PRD 已读，路径清单已提取
- [ ] 起点已确认

---

## Step 2: 竞品探索 + 逐交互拆解

> 先看别人怎么做，再按交互粒度逐个拆。全部锁定后才汇总 IA——不允许反过来。

**Entry Gate:**
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

**Entry Gate:**
- [ ] 全部交互已锁定

**Core Actions:**
1. **IA 汇总** — 页面/视图清单 + 导航结构 + 页面间跳转
2. **用户批准**（approve gate）
3. **写入 `.ui.md` 交互部分** — 交互流（标路径 ID）+ IA + 线框/4 态

**Exit Gate:**
- [ ] IA 经用户批准
- [ ] `.ui.md` 交互部分已写入

> 交互阶段完成。`.ui.md` 已含 ASCII 线框 + 交互流 + IA — **已是完整交付物**（渐进式第一层）。

---

# 视觉阶段

## Step 4: 视觉探索

> 竞品截图和模板都是"视觉起点"——找到了就不用从空白憋方向。交互阶段的竞品探索看的是"别人怎么做"（功能 + 流程），这一步看的是"别人长什么样"（视觉 + 排版 + 调性）。

**Entry Gate:**
- [ ] 交互阶段已完成（IA 已批准）

**Core Actions:**

1. **问目标竞品** — "有没有想对标 / 参考的产品？"
   - 有 → 定位到对应 IA 关键页的视觉页面，请用户截图整理
   - 没有 → 按产品类型搜同类视觉参考（可深入 Step 2 竞品的视觉层）

2. **搜 Template** — Claude Design 可用时查模板库，匹配产品类型（dashboard / landing / app 等）
   - 有匹配 → 记为起点候选，Step 5 视觉方向可直接用它定调
   - 没匹配 / 不可用 → 跳过

3. **产出视觉参考集** — 竞品截图 + 模板候选（如有），每条标来源，作为 Step 5 定方向的输入

**视觉参考集示例：**

```
## 视觉参考集

### 竞品截图
| 竞品 | 页面 | 截图 | 视觉特征 | 来源 |
|---|---|---|---|---|
| Linear | Issue 列表 | [截图] | 深色底、紧凑行高、左侧彩色标签 | [SOURCE] linear.app |
| Notion | 数据库视图 | [截图] | 浅色底、宽松留白、圆角卡片 | [SOURCE] notion.so |
| Raycast | 命令面板 | [截图] | 深色底、模糊背景、大圆角 | [SOURCE] raycast.com |

### Template 候选
| 模板名 | 类型 | 匹配度 | 备注 |
|---|---|---|---|
| Dashboard Pro | SaaS Dashboard | 高 | 侧边栏 + 卡片网格，接近我们的 IA |
```

**Exit Gate:**
- [ ] 视觉参考集已整理（≥3 个竞品视觉参考，标来源）
- [ ] Template 搜索已完成（有候选或注明无匹配）

> 展开：竞品视觉分析方法、截图工具链、Template 搜索操作 → `references/visual-exploration.md`

---

## Step 5: 确定保真度 + 交付方式 + 视觉方向

**Entry Gate:**
- [ ] Step 4 完成

**Core Actions:**

**5a. 保真度**（AskUserQuestion，默认低保真）：

| 档 | 产出 | 适用 | 后续 |
|---|---|---|---|
| **ASCII** | 视觉方向文字描述写入 `.ui.md` | 够拍板结构，不需要看视觉 | 跳 Step 6-7 |
| **低保真** | 静态 UI（具体配色/排版/间距值） | 确认视觉观感 | 走 Step 6-7 |
| **高保真** | 可交互、可导航、多屏流程 + 4 态 | 演示 / 验证复杂交互 | 走 Step 6-7 |

**低保真 vs 高保真的区别（few-shot）：**
- 低保真：一张静态截图——"首页长这样，侧边栏蓝底白字，卡片 12px 圆角"
- 高保真：能点的——"点侧边栏的'资源库'跳到列表页，点一行展开详情抽屉，空状态显示引导"

**5b. 交付方式**（低/高保真时，AskUserQuestion）：

| 方式 | 产物在哪 | 选它当 |
|---|---|---|
| **Claude Design** | claude.ai 项目 | 要多屏导航、团队在 canvas 协作、基于组织设计系统生成 |
| **本地 HTML** | `.ui-prototype.html` 落 repo | 要版本控制、离线、不依赖 claude.ai |

两条线 Step 6-7 步骤相同、实现不同。选定后全程走一条线。

**5c. 视觉方向**：
- 有 Step 4 的 template 匹配 → 用它当起点（方向已定），可微调
- 没有 → 沿三轴给 2-3 个明显不同的方向，用户选（可混搭）：
  - 布局密度：紧凑 ↔ 宽松
  - 视觉强度：克制 ↔ 表现力
  - 调性：专业 ↔ 友好

**方向示例：**
- 方向 A「工具感」：紧凑行高、深色底、等宽字体标签、类似 Linear
- 方向 B「编辑器感」：宽松留白、浅色底、衬线标题、类似 Notion
- 方向 C「仪表盘感」：卡片网格、数据密集、彩色图表、类似 Grafana

**5d. 渐进式升级**（已有前一档产出时）：
- 已有 ASCII → 升级到低保真：**加视觉**（配色/排版），不重新设计交互
- 已有低保真 → 升级到高保真：**加交互**（导航/4 态），不重画页面
- 回查 `.ui.md` 确认升级基线，不推翻

**Exit Gate:**
- [ ] 保真度 + 交付方式 + 视觉方向已定
- [ ] ASCII 档：视觉描述已写入 `.ui.md`，Step 6-7 标 skip

> 展开：视觉方向三轴定义、渐进式升级判断规则 → `references/visual-direction.md`

---

## Step 6: Design System 决策

> 设计系统 = 品牌渲染层（颜色/字体/组件）。它让多个页面看起来像同一个产品，不是各写各的。**不是每个项目都需要**——3 页以下的小项目直接出稿比建设计系统快，brand-neutral 够用。

**Entry Gate:**
- [ ] 保真度为低/高（ASCII → 跳过）

**Core Actions:**

**6a. 需不需要？**
- 小项目（≤3 页）/ 快速验证 / 无品牌要求 → **跳过**，Task 标 skip
- 有品牌要求 / 多页一致性 / 长期产品 → 进 6b

**6b. 搜已有，能复用就不新建：**

| 来源 | 怎么搜 |
|---|---|
| Claude Design | `/design status` 或 `DesignSync list_projects` |
| 本地代码库 | 扫已有 design tokens / 组件库 |
| Figma | `figma-design-read` |

有匹配 → 复用（记录标识）。无匹配 → 进 6c。

**6c. 创建（三步走，自下而上）** — 为什么这个顺序：patterns 由 components 组装，components 引用 foundations 的 token。跳层 = 在 pattern 里内联本该复用的组件，改一处要改全部。

```
foundations  颜色 token、字号、间距    → 串行先做，冻结 token
    ↓
components   按钮、卡片、输入框等      → 可并行（一组件一 subagent）
    ↓
patterns     页面级布局               → Step 7 组装
```

**Exit Gate:**
- [ ] 已判断（skip / 复用 / 创建完成）
- [ ] 创建时：foundations 冻结 → components 补齐
- [ ] 设计系统标识已记录（如有）

> 展开：三步走并行流程、gap analysis、创建方式选型（Claude Design 在线创建 / `/design-sync` 推 React 组件 / `.dc.html` 手写兜底）→ `references/design-system-build.md`

---

## Step 7: 生成原型

> 把交互结构 + 视觉方向 + 设计系统拼成可看可走的原型。**回查 Step 5 交付方式，不凭记忆判断。**

**Entry Gate:**
- [ ] Step 6 完成（done 或 skip）
- [ ] 回查交付方式：Claude Design / 本地 HTML

**Core Actions:**

| | Claude Design 线 | 本地 HTML 线 |
|---|---|---|
| **怎么出** | `/design <brief>` | 本地写 `.ui-prototype.html` |
| **喂什么** | brief = IA + 交互清单 + 视觉方向；挂 template + design system（如有） | IA + 交互清单 + 视觉方向 + token/组件；无设计系统则加载 taste skill |
| **低保真** | 静态多屏 UI | 静态页面 HTML |
| **高保真** | 多屏可交互 + 导航逻辑 + 4 态 | 可点击原型，关键流程走得通 |
| **产物** | claude.ai 项目（记 projectId） | `{pd_ui_prototype}` |

**brief 示例（Claude Design 线）：**

```
用 Nocode Manager 设计系统，创建一个资源管理应用的低保真原型。

页面结构（来自 IA）：
- 首页：预设卡片 + 统计面板 + 活动流
- 资源库：筛选栏 + 数据表格 + 批量操作
- 资源详情：抽屉式，属性表单 + 同步状态

视觉方向：工具感——深色底、紧凑行高、等宽标签，参考 Linear。
```

**两条线共同要求：**
- 低保真：给具体值（配色 hex / 字号 / 间距 / 圆角），不说"某种蓝"
- 高保真：token 不硬编码，4 态（hover / active / focus-visible / disabled），empty / loading / error 态
- 渐进式：在已有基线上加，不推翻

**Exit Gate:**
- [ ] 原型已产出
- [ ] Claude Design 线：projectId 已记录 / HTML 线：文件已保存
- [ ] 高保真：4 态 + 导航 + empty/loading/error 已覆盖

> 展开：`/design <brief>` 完整写法、HTML 原型规范、两条线详细操作 → `references/prototype-gen.md`

---

## Step 8: 验证

**Entry Gate:**
- [ ] ASCII 档：Step 5 完成 / 低高保真：Step 7 完成

**Core Actions:**
1. **PRD 路径逐条走查** — 按路径 ID 点名，缺补多删
2. **五维自审** — 信息层级 / 一致性 / 交互完整性 / 可行性 / PRD 对齐
3. **vis-review 交叉审**（低/高保真，可选）

**Exit Gate:**
- [ ] 路径走查 + 五维自审通过
- [ ] vis-review 无 Critical（或已修复）

---

## Step 9: 保存 + Handoff

**Core Actions:**
1. `.ui.md` → `{pd_ui_output}`
2. 原型：Claude Design 记 projectId / HTML → `{pd_ui_prototype}`
3. 提示："进 devflow 以 PRD + `.ui.md` 为输入。"

**Exit Gate:**
- [ ] `.ui.md` + 原型已保存
- [ ] 全部 Task 已更新

---

## AI 能力边界

| AI 能做 | AI 不能做（标 `[ASSUMED]`） |
|---|---|
| wireframe / IA / 交互流 | 真实用户可用性测试 |
| 视觉方向 / 配色排版建议 | 品牌战略决策 |
| 可交互原型 | 像素级还原手稿 |
| 状态/边界枚举 | A/B 测试预判 |

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "界面让开发看着办" | 你没决定的地方由实现细节替你决定 |
| "低保真够了，不用想交互态" | empty/loading/error 是一半的真实使用时间 |
| "直接上高保真快" | 没批准低保真就糊高保真 = 在未验证的骨架上贴皮 |
| "视觉方向凭感觉定一个" | 2-3 个方向让人选，比赌一个返工率低 |
| "先拍个 IA 再补交互" | IA 是从交互拆解汇总出来的 |
| "小项目也要建设计系统" | 小项目 brand-neutral 够用 |
| "Claude Design 不可用就没法做" | 本地 HTML 是完整备选 |

## Red Flags

- 没建 TaskCreate 就开始做
- 跳 Step 2 直接出 IA
- IA 先于交互拆解产出
- wireframe 缺 empty/loading/error
- 跳档（没低保真就出高保真）
- 只给一个视觉方向
- 没对照 PRD 逐条核路径
- 交互流没标路径 ID
- 升档时推翻前一档（渐进式 = 叠加不是替换）
- Step 7 没回查交付方式
