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

## Enter Gate

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
  Sub-steps: 回查交付方式 → Claude Design 或本地 HTML 出稿 → 产出原型清单
  Gate: 原型产出 + 原型清单已列（ASCII 档 skip）

Task 8: 验证
  Sub-steps: 页面覆盖矩阵 → 交互覆盖矩阵(高保真) → PRD 路径走查 → 五维自审 → vis-review
  Gate: 三表全 ✅ + 自审通过

Task 9: 保存 + Handoff
  Sub-steps: 写 .ui.md + 保存原型 → 提示 devflow
  Gate: 文件保存，全部 Task 更新
```

每完成一个标 done。不适用的标 skip + 原因（如 ASCII 档跳 Task 6-7）。

---

# 交互阶段

## Step 1: 确定起点

**Enter Gate:**
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
3. **写入 `.ui.md` 交互部分** — 交互流（标路径 ID）+ IA + 线框/4 态

**Exit Gate:**
- [ ] IA 经用户批准
- [ ] `.ui.md` 交互部分已写入

> 交互阶段完成。`.ui.md` 已含 ASCII 线框 + 交互流 + IA — **已是完整交付物**（渐进式第一层）。

---

# 视觉阶段

## Step 4: 视觉探索

> 竞品截图和模板都是"视觉起点"——找到了就不用从空白憋方向。交互阶段的竞品探索看的是"别人怎么做"（功能 + 流程），这一步看的是"别人长什么样"（视觉 + 排版 + 调性）。

**Enter Gate:**
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

**Enter Gate:**
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

两条线的共同结构：**多页面独立文件（拆分）+ 交互原型（组合）**。低保真只需要拆分的独立页面；高保真在独立页面基础上再产出一个可交互的组合原型。

| 方式 | 产物在哪 | 独立页面（拆分） | 交互原型（组合） | 选它当 |
|---|---|---|---|---|
| **Claude Design** | claude.ai 项目 | 每页一个文件 | 额外一个组合文件，融合所有页面代码，JS 实现 tab 切换/弹窗/4 态 | 团队 canvas 协作、设计系统复用 |
| **本地 HTML** | 落 repo | 每页一个 `.html` | 多文件之间用 URL 跳转串联，不需要额外组合文件 | 版本控制、离线、无重复维护 |

**Claude Design 的代价**：组合文件里的内容和独立页面文件是重复的，改了独立页面的设计，组合文件也要同步改。

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

**Enter Gate:**
- [ ] 保真度为低/高（ASCII → 跳过）

**Core Actions:**

**6a. 需不需要？**
- 小项目（≤3 页）/ 快速验证 / 无品牌要求 → **跳过**，Task 标 skip
- 有品牌要求 / 多页一致性 / 长期产品 → 进 6b

**6b. 搜已有，能复用就不新建：**

| 来源 | 怎么搜 |
|---|---|
| Claude Design | `Skill(nocode-evolve:claude-design)` → `claude-design systems` / `claude-design list` |
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

**Enter Gate:**
- [ ] Step 6 完成（done 或 skip）
- [ ] 回查交付方式：Claude Design / 本地 HTML

**Core Actions:**

| | Claude Design 线 | 本地 HTML 线 |
|---|---|---|
| **怎么出** | `Skill(nocode-evolve:claude-design)` → `claude-design <brief>` | 本地写多个 `.html` 文件 |
| **喂什么** | brief = IA + 交互清单 + 视觉方向；挂 template + design system（如有） | IA + 交互清单 + 视觉方向 + token/组件；无设计系统则加载 taste skill |
| **低保真** | 每页一个文件，静态 | 每页一个文件，静态 |
| **高保真** | 保留独立页面文件 + 新增一个组合文件（融合全部页面，JS tab 切换/弹窗/4 态） | 多文件之间用 URL 跳转，每个文件内做弹窗/4 态 |
| **产物** | claude.ai 项目（记 projectId） | `{pd_ui_prototype}` 目录 |

**Claude Design 高保真的两层结构：**
- **独立页面文件**（`home.html`、`library.html`…）：每页的完整视觉，可单独审查
- **组合文件**（`prototype.html`）：融合所有页面代码，用 tab/section 切换模拟导航 + JS 弹窗/抽屉 + 4 态。跨文件导航在 Claude Design 不支持，所以交互只能在这个组合文件里实现
- **代价**：改了独立页面，组合文件要同步改

**brief 示例（Claude Design 线，低保真）：**

```
用 Nocode Manager 设计系统，创建一个资源管理应用的低保真原型。
每个页面一个独立文件。

页面结构（来自 IA）：
- home.html — 首页：预设卡片 + 统计面板 + 活动流
- library.html — 资源库：筛选栏 + 数据表格 + 批量操作
- detail.html — 资源详情：抽屉式，属性表单 + 同步状态

视觉方向：工具感——深色底、紧凑行高、等宽标签，参考 Linear。
```

**brief 示例（Claude Design 线，高保真）：**

```
用 Nocode Manager 设计系统，生成资源管理应用的高保真可交互原型。

第一步：独立页面文件（每页一个，和低保真相同）
- home.html / library.html / detail.html / settings.html

第二步：组合文件 prototype.html
把所有页面的代码融合到一个文件里，用顶部 tab 切换页面。
Claude Design 不支持跨文件导航，所以交互统一在这个组合文件实现。

组合文件内交互（必须能点）：
- 顶部 tab 切换：首页 ↔ 资源库 ↔ 设置
- 资源库点一行 → 右侧滑出详情面板（JS display toggle）
- 点"+导入" → 弹出模态对话框 → 确认后关闭
- 列表区：用按钮切换 empty / loading / 正常 / error 四种状态

交互元素 4 态：hover / active / focus-visible / disabled（CSS 实现）。
视觉方向：工具感，参考 Linear。
```

**两条线共同要求：**
- 低保真：给具体值（配色 hex / 字号 / 间距 / 圆角），不说"某种蓝"
- 高保真：token 不硬编码，4 态（hover / active / focus-visible / disabled），empty / loading / error 态
- 渐进式：在已有基线上加，不推翻

**原型清单（Step 8 验证的输入）：**

Step 7 产出后、进 Step 8 前，列一份原型清单，记录实际产出了什么。Step 8 矩阵基于这份清单核对，不凭记忆。

```
## 原型清单

| 文件/位置 | 对应 IA 页面 | 类型 | 交互入口 | 状态切换入口 |
|---|---|---|---|---|
| home.html | 首页 | 独立页面 | — | — |
| library.html | 资源库 | 独立页面 | 行点击→详情 | empty/loading/error 按钮 |
| prototype.html | 全部 | 组合文件 | tab 切换、弹窗、抽屉 | 状态切换按钮 |
```

**Exit Gate:**
- [ ] 原型已产出
- [ ] 原型清单已列（文件/位置 + 对应 IA 页面 + 交互入口 + 状态切换入口）
- [ ] Claude Design 线：projectId 已记录 / HTML 线：文件已保存
- [ ] 高保真：4 态 + 导航 + empty/loading/error 已覆盖

> 展开：`claude-design <brief>` 完整写法、HTML 原型规范、两条线详细操作 → `references/prototype-gen.md`

---

## Step 8: 验证

**Enter Gate:**
- [ ] ASCII 档：Step 5 完成 / 低高保真：Step 7 完成（含原型清单）

**三表关系：** PRD 路径覆盖 → 页面覆盖矩阵 → 交互覆盖矩阵，是同一条链的三个粒度递进，不是重复核对：
- PRD 路径覆盖：每条使用路径能走通吗（端到端）
- 页面覆盖矩阵：每个 IA 页面/视图都画出来了吗（逐页）
- 交互覆盖矩阵：每个交互点都能操作吗（逐交互，仅高保真）

PRD 路径覆盖的状态必须由下面两个矩阵聚合得出，不能单独手填 ✅——矩阵里有 ❌，路径就不能标 ✅。

**Core Actions:**

### 8a. 页面覆盖矩阵（所有保真度必做）

真值源：Step 3 的 IA（页面/视图清单）。矩阵行从 IA 逐条搬，每行核对该页面在各层产出中是否存在。

**页面分两类：**
- **独立页面**（首页、列表页、设置页等）：在 IA 中是顶层页面/视图，有独立文件
- **嵌入组件**（弹窗、抽屉、对话框等）：不是独立页面，嵌入在宿主页面内。独立文件列标"嵌入于 X"

```
## 页面覆盖矩阵

| IA 页面/视图 | 类型 | ASCII 线框 | 状态覆盖(4态) | 独立页面 | 原型中可达 | 状态 |
|---|---|---|---|---|---|---|
| 首页 | 独立页面 | ✓ | 正常/empty/loading/error ✓ | home.html | tab "首页" / URL 跳转 | ✅ |
| 资源库 | 独立页面 | ✓ | 正常/empty/loading/error ✓ | library.html | tab "资源库" / URL 跳转 | ✅ |
| 资源详情 | 嵌入组件 | ✓ | 正常/empty ✓ | 嵌入于 library | 行点击滑出 | ✅ |
| 导入对话框 | 嵌入组件 | ✓ | 正常 ✓ | 嵌入于 library | "+导入"按钮弹出 | ✅ |
| 设置页 | 独立页面 | ✓ | 正常 ✓ | settings.html | tab "设置" / URL 跳转 | ✅ |
```

**列说明：**
- **ASCII 线框**：所有保真度必须有（Step 2 逐交互拆解时产出）
- **状态覆盖(4态)**：所有保真度必须有（Step 2 四块之一）。核对该页面/视图涉及的正常/empty/loading/error 是否在线框中标出
- **独立页面**：低保真 + 高保真必须有。嵌入组件标"嵌入于 X"（宿主页面名）
- **原型中可达**：高保真必须有。填写到达方式——Claude Design 线填组合文件内的 tab/弹窗/抽屉；本地 HTML 线填 URL 跳转 / 页内 `<dialog>` / JS 滑出。ASCII 档标"N/A"
- **状态**：✅ 已覆盖 / ❌ 缺失（缺失即补，补完改 ✅）

### 8b. 交互覆盖矩阵（仅高保真必做）

真值源：Step 2 的交互清单（每条交互带 ID，如 `订单.P1.3`）。逐条核对每个交互在原型中是否可操作。基于 Step 7 原型清单定位实际实现位置。

```
## 交互覆盖矩阵

| 交互 ID | 交互描述 | 原型中的实现 | 可操作控件 | 4 态 | 边界态 | 状态 |
|---|---|---|---|---|---|---|
| 订单.P1.1 | 浏览商品列表 | 资源库 tab，数据表格 | 筛选栏 H/A/F/D ✓、排序按钮 H/A/F/D ✓ | ✓ | E/L/Err ✓ | ✅ |
| 订单.P1.3 | 加入购物车 | "+导入"按钮 → 模态弹窗 | 按钮 H/A/F/D ✓、弹窗确认/取消 H/A/F/D ✓ | ✓ | — | ✅ |
| 订单.P1.4 | 编辑购物车 | 详情抽屉，属性表单 | 行 hover ✓、输入框 H/A/F/D ✓ | ✓ | Empty ✓ | ✅ |
```

**列说明：**
- **交互 ID**：从 Step 2 交互清单逐条搬，不允许跳过
- **可操作控件**：拆到具体控件级别（按钮、输入框、筛选栏、排序、分页等），每个控件单独核对 4 态。只有完全无可操作控件的纯文本展示区才标"—"——有筛选/排序/分页/行 hover 的列表不算纯展示
- **4 态**：每个可操作控件的 hover / active / focus-visible / disabled 逐个核对
- **边界态**：该交互涉及的数据区有 empty / loading / error 吗。不涉及数据的标"—"
- **状态**：✅ 全部达标 / ❌ 未达标（列出缺什么）。补完改 ✅。**Gate 只认 ✅，不存在中间态通过**

### 8c. 独立交叉审（低/高保真）

两路并行审，避免同源自评盲区：

1. **Subagent 审**（`nocode-evolve:code-reviewer` 或 general-purpose）— 按 8a/8b 矩阵 + PRD 路径走查 + 五维自审（信息层级 / 一致性 / 交互完整性 / 可行性 / PRD 对齐），输出分级 Report（Critical / Warning / Suggestion）
2. **Codex 审**（`codex-companion.mjs task`）— 同样的审查范围，独立视角。Codex 不可用时降级为仅 subagent 单审 + 明说 fallback

两路结果合并：交集 = 高置信必修；对称差 = 盲点补充，逐条判断。Critical 必须全部修复。

### 8d. 验证记录写入 .ui.md

在 `.ui.md` 中新建独立的 `## 验证记录` 节，包含：
1. 页面覆盖矩阵
2. 交互覆盖矩阵（高保真）
3. PRD 路径走查结果
4. 五维自审结果
5. 交叉审 Report 摘要

PRD 路径覆盖表（已有节）的状态从矩阵聚合：该路径涉及的所有页面和交互都 ✅ → 路径才标 ✅。

**Exit Gate:**
- [ ] 页面覆盖矩阵：所有 IA 页面/视图 ✅（无 ❌）
- [ ] 交互覆盖矩阵（高保真）：所有交互 ✅（无 ❌，Gate 只认 ✅）
- [ ] PRD 路径走查：所有路径可走通
- [ ] 交叉审无 Critical（或已修复）

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
