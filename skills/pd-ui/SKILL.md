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
  Sub-steps: 选保真度(ASCII/低保真/高保真/完整实现) → 选交付方式 → 定视觉方向
  Gate: 三项已定（ASCII 档跳 Task 6-7）

Task 6: Design System 决策
  Sub-steps: 判需求 → 搜已有 → 创建（三步走）
  Gate: skip/复用/创建完成（ASCII 档 skip）

Task 7: 生成原型
  Sub-steps: 回查交付方式 → Claude Design 或本地 HTML 出稿 → 产出原型清单
  Gate: 原型产出 + 原型清单 100% 覆盖 IA 全部页面/视图（ASCII 档 skip）

Task 8: 验证
  Sub-steps: 测试方案(8a,审批) → Playwright 分层验证(8b,P1/P2/P3按保真度) → 页面覆盖矩阵(8c) → 交互覆盖矩阵(8d) → 交叉审(8e) → 写入.ui.md(8f)
  Gate: 测试方案审批通过 + Playwright errors=0 + 按保真度 Gate 表全过

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

> 展开：视觉参考集模板 → `references/visual-exploration.md`

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

| 档 | 核心能力 | 原型覆盖度 | Playwright 验证 | 适用 | 后续 |
|---|---|---|---|---|---|
| **ASCII** | 文字描述 | — | — | 够拍板结构，不需要看视觉 | 跳 Step 6-7 |
| **低保真** | 看得见 | 每个 IA 页面/视图都有静态渲染 | Phase 1：截图确认渲染正常 | 确认视觉观感 | 走 Step 6-7 |
| **高保真** | 点得动 | 低保真 + 每个交互点可操作 | Phase 1 + Phase 2：交互场景验证 | 验证交互逻辑 | 走 Step 6-7 |
| **完整实现** | 跑得通 | 高保真 + 4 态逐控件 + 边界态全覆盖 + 跨页导航链路 | Phase 1 + Phase 2 + Phase 3：完整测试套件 | 演示 / 交付前验收 | 走 Step 6-7 |

**三层递进（few-shot）：**
- 低保真：一张静态截图——"首页长这样，侧边栏蓝底白字，卡片 12px 圆角"。嵌入组件在宿主页面里展示布局，不需要能点
- 高保真：能点的——"点侧边栏的'资源库'跳到列表页，点一行展开详情抽屉，空状态显示引导"
- 完整实现：跑得通——"每个按钮 hover/active/focus-visible/disabled 4 态都有、列表区 empty/loading/error 切换正常、从首页走到详情再回来链路无断点"

**5b. 交付方式**（低/高保真时，AskUserQuestion）：

两条线的共同结构：**独立页面文件（拆分）+ 交互原型（组合）**。低保真只需要拆分的独立页面；高保真在独立页面基础上再产出一个可交互的组合原型。

**什么算独立页面文件，什么不算：**
- **独立页面** = 不同路径分支的落地页（首页、列表页、详情页、设置页）→ 各一个文件
- **嵌入组件** = Modal / Dialog / Drawer / Toast / Popover 等 → 不单独建文件，在宿主页面内实现（`<dialog>`、JS toggle）
- 判断标准：用户走不同路径会到达不同的独立页面；嵌入组件是同一页面内的交互分支，不是路径分支

| 方式 | 产物在哪 | 独立页面（拆分） | 交互原型（组合） | 选它当 |
|---|---|---|---|---|
| **Claude Design** | claude.ai 项目 | 每个独立页面一个文件，嵌入组件写在宿主页面内 | 额外一个组合文件，融合所有页面代码，JS 实现 tab 切换/弹窗/4 态 | 团队 canvas 协作、设计系统复用 |
| **本地 HTML** | 落 repo | 每个独立页面一个 `.html`，嵌入组件写在宿主页面内 | 多文件之间用 URL 跳转串联，不需要额外组合文件 | 版本控制、离线、无重复维护 |

**Claude Design 的代价**：组合文件里的内容和独立页面文件是重复的，改了独立页面的设计，组合文件也要同步改。

**覆盖要求**：IA 中的每个页面/视图都必须在原型中实现——独立页面有自己的文件，嵌入组件在宿主页面内实现。不存在"设计覆盖但原型未实现"的中间态。

两条线 Step 6-7 步骤相同、实现不同。选定后全程走一条线。

**5c. 视觉方向**：
- 有 Step 4 的 template 匹配 → 用它当起点（方向已定），可微调
- 没有 → 沿三轴给 2-3 个明显不同的方向，用户选（可混搭）：
  - 布局密度：紧凑 ↔ 宽松
  - 视觉强度：克制 ↔ 表现力
  - 调性：专业 ↔ 友好

> 展开：方向示例（工具感/编辑器感/仪表盘感）→ `references/visual-direction.md`

**5d. 渐进式升级**（已有前一档产出时）：
- 已有 ASCII → 升级到低保真：**加视觉**（配色/排版），不重新设计交互
- 已有低保真 → 升级到高保真：**加交互**（导航/嵌入组件能弹出），不重画页面
- 已有高保真 → 升级到完整实现：**加 4 态 + 边界态 + 跨页链路**，不重做交互逻辑
- 回查 `.ui.md` 确认升级基线，不推翻

**Exit Gate:**
- [ ] 保真度（ASCII / 低保真 / 高保真 / 完整实现）+ 交付方式 + 视觉方向已定
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
| **低保真** | 每个独立页面一个文件（含宿主内的嵌入组件），静态 | 每个独立页面一个文件（含宿主内的嵌入组件），静态 |
| **高保真** | 保留独立页面文件 + 新增一个组合文件（融合全部页面，JS tab 切换/弹窗） | 多文件之间用 URL 跳转，每个文件内做弹窗/4 态 |
| **完整实现** | 高保真基础上：组合文件内每个控件 4 态 + 边界态切换 + 跨页导航链路 | 高保真基础上：每个控件 4 态 + 边界态切换 + URL 跳转链路全覆盖 |
| **产物** | claude.ai 项目（记 projectId） | `{pd_ui_prototype}` 目录 |

**Claude Design 线并行生成（≥3 个独立页面时推荐）：**

页面数少（≤2）时一个 brief 一次出完；≥3 时拆分并行，提高速度和单页质量：

```
拆分 page-brief → 并行 subagent 本地生成 → 选合流策略 → batch push
```

1. **拆分 brief**：IA 每个独立页面 → 独立 page-brief（共享：视觉方向 + 设计系统 + 公共样式约定；独有：该页 IA 结构 + 该页交互清单 + 该页嵌入组件）
2. **并行生成**：每页一个 subagent，本地产出 `.html`（纯文件产出，不调 API），嵌入组件在宿主页面内实现
3. **合流判定**（基于导航链路连通性，非纯用户选择）：
   - 分析 IA 导航图，找出**连通子图**（哪些页面之间有导航链路可达）
   - **连通的页面** → 融合到同一 prototype（一个组合文件，tab/跳转串联）
   - **孤立页面**（404、onboarding、条件触发的边界页面等，前端链路不连贯）→ 保留为独立文件，不强行塞进组合文件
   - 一个项目可能产出：一个主链路 prototype + 若干独立页面文件
4. **推送**：所有文件（含独立的）推到同一 project，走一次 `finalize_plan` → `write_files`（遵守并发限制 + 写入前版本检查）

> 展开：并行流程、page-brief 模板、合流策略详细操作 → `references/prototype-gen.md`

**Claude Design 高保真的两层结构：**
- **独立页面文件**：每页的完整视觉 + 该页内的嵌入组件，可单独审查
- **组合文件**（`prototype.html`）：融合所有页面代码，JS tab 切换/弹窗/抽屉。跨文件导航不支持，所以交互都在这里
- **代价**：改了独立页面，组合文件要同步改

> 展开：brief 完整写法（低保真/高保真/完整实现）、两条线详细操作 → `references/prototype-gen.md`

**两条线共同要求（按保真度分层）：**

| | 低保真 | 高保真 | 完整实现 |
|---|---|---|---|
| **视觉值** | 具体值（hex / 字号 / 间距 / 圆角） | token 不硬编码（CSS 变量） | 同高保真 |
| **嵌入组件** | 在宿主页面展示布局（初始隐藏态可见） | 可触发（点击弹出/滑出） | 可触发 + 关闭后状态回归 |
| **4 态** | 不要求 | 不要求 | 每个可操作控件 hover/active/focus-visible/disabled 逐个实现 |
| **边界态** | 不要求 | 不要求 | 数据区 empty/loading/error 全覆盖，可切换 |
| **导航链路** | 不要求 | 页面间可跳转 | 端到端链路可走通（A→B→C→A 无断点） |
| **test-id** | 所有可操作元素加 `data-testid` | 同低保真 | 同低保真 |
| **渐进式** | 在 ASCII 基线上加视觉 | 在低保真上加交互 | 在高保真上加 4 态 + 边界态 + 链路 |

**test-id**：每个可操作元素加 `data-testid`，命名 `<页面>-<组件>[-<变体>]` kebab-case。Playwright 用 `[data-testid="xxx"]` 定位。

> 展开：命名规则示例 → `references/playwright-verify.md`

**原型清单（Step 8 验证的输入）：**

Step 7 产出后、进 Step 8 前，列一份原型清单：每个 IA 页面/视图的实现位置 + 交互入口 + 状态切换入口。IA 中每个页面/视图都必须有实现位置，无遗漏。Step 8 矩阵基于这份清单核对。

> 展开：原型清单模板 → `references/prototype-gen.md`

**Exit Gate:**
- [ ] 原型已产出
- [ ] 原型清单 100% 覆盖 IA 全部页面/视图（独立页面有文件 + 嵌入组件在宿主页面内实现，无遗漏）
- [ ] Claude Design 线：projectId 已记录 / HTML 线：文件已保存
- [ ] 高保真：交互可操作（弹窗能弹、抽屉能滑、导航能跳）
- [ ] 完整实现：4 态逐控件 + 边界态全覆盖 + 跨页导航链路无断点

> 展开：`claude-design <brief>` 完整写法、HTML 原型规范、两条线详细操作 → `references/prototype-gen.md`

---

## Step 8: 验证

**Enter Gate:**
- [ ] ASCII 档：Step 5 完成 / 低高保真：Step 7 完成（含原型清单）

**三表关系：** PRD 路径覆盖 → 页面覆盖矩阵 → 交互覆盖矩阵，是同一条链的三个粒度递进，不是重复核对：
- PRD 路径覆盖：每条使用路径能走通吗（端到端）
- 页面覆盖矩阵：每个 IA 页面/视图都画出来了吗（逐页）
- 交互覆盖矩阵：每个交互点都能操作吗（逐交互，高保真 + 完整实现）

PRD 路径覆盖的状态必须由下面两个矩阵聚合得出，不能单独手填 ✅——矩阵里有 ❌，路径就不能标 ✅。

**Iron Rule: 矩阵里的 ✅ 必须基于实际渲染结果（截图 + 交互验证），不允许手填。**

**Core Actions:**

### 8a. 测试方案（先审后跑）

基于原型清单 + 保真度输出测试方案，用户审批后才写脚本执行。不允许跳过方案直接跑。

测试方案必须包含三部分：
1. **页面层级图**（ASCII 树）：IA 全部页面/视图的树状结构，独立页面为节点、嵌入组件为子节点，每个标注验证 Phase
2. **导航链路图**（ASCII 流程）：前端可达路径，标出主链路（进组合文件）和孤立页面（独立保留），标出验证链路
3. **分层验证表**：Phase 1/1b/2/3 按保真度列出具体场景（覆盖统计数字必须出现）

测试方案按保真度分四层 Phase：
- **Phase 1**（所有保真度）：每个页面截图，确认渲染正常
- **Phase 1b**（所有保真度）：UI 细节审核——遮挡/溢出/截断/层叠/间距一致性（自动化检查 + AI 截图走查）
- **Phase 2**（高保真 + 完整实现）：交互场景——点击弹出/滑出/跳转
- **Phase 3**（仅完整实现）：4 态逐控件 + 边界态切换 + 跨页导航链路

**审批 Gate**：用户确认测试方案后才进 8b。

> 展开：测试方案模板、各 Phase 详细内容 → `references/playwright-verify.md`

### 8b. Playwright 渲染验证（两条线都做）

基于审批通过的测试方案，写 `interactions.json` 并用 `prototype-verify.mjs` 执行。Claude Design 线先 `claude-design read` 拉到本地再跑。Phase 1b UI 细节审核在截图完成后自动跑（遮挡/溢出/截断/层叠/间距检查 + AI 截图走查）。

```bash
# Phase 1：基础截图
node scripts/prototype-verify.mjs <prototype-dir>

# Phase 2+3：交互验证（selector 统一用 data-testid）
node scripts/prototype-verify.mjs <prototype-dir> --interactions interactions.json
```

产出：`verify-output/screenshots/` + `verify-report.json`。errors > 0 → 修原型后重跑。

截图完成后，基于截图填写下面的覆盖矩阵。每个 ✅ 旁标注对应的截图文件名。

> 展开：interactions.json 示例、Phase 1/2/3 详细操作、Claude Design 线流程、验证失败处理 → `references/playwright-verify.md`

### 8c. 页面覆盖矩阵（所有保真度必做）

真值源：Step 3 的 IA（页面/视图清单）。矩阵行从 IA 逐条搬，每行核对该页面在各层产出中是否存在。**IA 中的每个页面/视图都必须在原型中有实现——不存在"设计覆盖但原型未实现"的中间态。**

**页面分两类：**
- **独立页面**（首页、列表页、设置页等）：不同路径分支的落地页，各有独立文件
- **嵌入组件**（弹窗、抽屉、对话框等）：同一页面内的交互分支，在宿主页面内实现（不单独建文件）

**判断标准**：用户走不同路径会到达不同的独立页面；嵌入组件是同一页面内触发的 UI（Modal/Dialog/Drawer/Toast/Popover），属于宿主页面的一部分。

```
## 页面覆盖矩阵

| IA 页面/视图 | 类型 | ASCII 线框 | 状态覆盖(4态) | 原型实现位置 | 原型中可达 | 截图证据 | 状态 |
|---|---|---|---|---|---|---|---|
| 首页 | 独立页面 | ✓ | 正常/empty/loading/error ✓ | home.html | tab "首页" / URL 跳转 | home.png | ✅ |
| 资源库 | 独立页面 | ✓ | 正常/empty/loading/error ✓ | library.html | tab "资源库" / URL 跳转 | library.png | ✅ |
| 资源详情 | 嵌入组件 | ✓ | 正常/empty ✓ | library.html 内 (Drawer) | 行点击滑出 | detail-drawer-open.png | ✅ |
| 导入对话框 | 嵌入组件 | ✓ | 正常 ✓ | library.html 内 (Dialog) | "+导入"按钮弹出 | import-dialog-open.png | ✅ |
| 设置页 | 独立页面 | ✓ | 正常 ✓ | settings.html | tab "设置" / URL 跳转 | settings.png | ✅ |
```

**列说明：**
- **ASCII 线框**：所有保真度必须有（Step 2 逐交互拆解时产出）
- **状态覆盖(4态)**：所有保真度必须有（Step 2 四块之一）。核对该页面/视图涉及的正常/empty/loading/error 是否在线框中标出
- **原型实现位置**：低保真 + 高保真必须有。独立页面填文件名；嵌入组件填"宿主文件名 内 (组件类型)"
- **原型中可达**：高保真必须有。填写到达方式——Claude Design 线填组合文件内的 tab/弹窗/抽屉；本地 HTML 线填 URL 跳转 / 页内 `<dialog>` / JS 滑出。ASCII 档标"N/A"
- **截图证据**：低/高保真/完整实现必须有。填 8b 产出的截图文件名。嵌入组件填交互触发后的截图。**无截图不允许标 ✅**
- **状态**：✅ 已覆盖（有截图证据） / ❌ 缺失（缺失即补，补完重跑验证再改 ✅）。**Gate 要求全部 ✅，不接受部分覆盖**

### 8d. 交互覆盖矩阵（高保真 + 完整实现必做）

真值源：Step 2 的交互清单（每条交互带 ID，如 `订单.P1.3`）。逐条核对每个交互在原型中是否可操作。基于 Step 7 原型清单定位实际实现位置。

**高保真 vs 完整实现的区别**：高保真只需核对交互"能操作"（点了有反应）；完整实现还要核对每个控件的 4 态和边界态。

```
## 交互覆盖矩阵

| 交互 ID | 交互描述 | 原型中的实现 | 可操作控件 | 4 态 | 边界态 | 截图证据 | 状态 |
|---|---|---|---|---|---|---|---|
| 订单.P1.1 | 浏览商品列表 | 资源库 tab，数据表格 | 筛选栏 H/A/F/D ✓、排序按钮 H/A/F/D ✓ | ✓ | E/L/Err ✓ | library.png, library-empty.png | ✅ |
| 订单.P1.3 | 加入购物车 | "+导入"按钮 → 模态弹窗 | 按钮 H/A/F/D ✓、弹窗确认/取消 H/A/F/D ✓ | ✓ | — | import-dialog-open.png | ✅ |
| 订单.P1.4 | 编辑购物车 | 详情抽屉，属性表单 | 行 hover ✓、输入框 H/A/F/D ✓ | ✓ | Empty ✓ | detail-drawer-open.png | ✅ |
```

**列说明：**
- **交互 ID**：从 Step 2 交互清单逐条搬，不允许跳过
- **可操作控件**：拆到具体控件级别（按钮、输入框、筛选栏、排序、分页等），每个控件单独核对 4 态。只有完全无可操作控件的纯文本展示区才标"—"——有筛选/排序/分页/行 hover 的列表不算纯展示
- **4 态**：每个可操作控件的 hover / active / focus-visible / disabled 逐个核对
- **边界态**：该交互涉及的数据区有 empty / loading / error 吗。不涉及数据的标"—"
- **截图证据**：8b Playwright 验证产出的截图文件名，证明该交互实际可操作。**无截图不允许标 ✅**
- **状态**：✅ 全部达标（有截图证据） / ❌ 未达标（列出缺什么）。补完重跑验证再改 ✅。**Gate 只认 ✅，不存在中间态通过**

### 8e. 独立交叉审（低保真 / 高保真 / 完整实现）

调 `Skill(nocode-evolve:red-blue-deep)` 强制重档，审查范围：

- 8c/8d 矩阵完整性（有没有漏页面 / 漏交互）
- PRD 路径走查（端到端能走通吗）
- 五维自审（信息层级 / 一致性 / 交互完整性 / 可行性 / PRD 对齐）
- Playwright 截图 vs 设计意图（截图里看到的和设计的是不是同一个东西）

red-blue-deep 重档会走红军环节（独立模型审），输出分级 Report（Critical / Warning / Suggestion）。Critical 必须全部修复后重跑 Playwright 验证。

### 8f. 验证记录写入 .ui.md

在 `.ui.md` 中新建独立的 `## 验证记录` 节，包含：
1. 测试方案（8a 审批通过的版本）
2. 页面覆盖矩阵
3. 交互覆盖矩阵（高保真 + 完整实现）
4. PRD 路径走查结果
5. 五维自审结果
6. 交叉审 Report 摘要
7. Playwright verify-report.json 摘要（errors / screenshots 数量）

PRD 路径覆盖表（已有节）的状态从矩阵聚合：该路径涉及的所有页面和交互都 ✅ → 路径才标 ✅。

**Exit Gate（按保真度递增）：**

| Gate 项 | 低保真 | 高保真 | 完整实现 |
|---|---|---|---|
| Playwright Phase 1（截图） | 必须 | 必须 | 必须 |
| Phase 1b UI 细节审核（遮挡/溢出/截断/层叠/间距） | 必须 | 必须 | 必须 |
| Playwright Phase 2（交互） | — | 必须 | 必须 |
| Playwright Phase 3（4 态 + 边界态 + 链路） | — | — | 必须 |
| 页面覆盖矩阵 100%（有截图证据） | 必须 | 必须 | 必须 |
| 交互覆盖矩阵 100%（有截图证据） | — | 必须 | 必须 |
| PRD 路径走查 | 必须 | 必须 | 必须 |
| 交叉审无 Critical | 必须 | 必须 | 必须 |

verify-report.json errors = 0 才过 Gate。

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
| "低保真够了，不用想交互态" | empty/loading/error 是一半的真实使用时间，完整实现才覆盖 |
| "直接上高保真快" | 没批准低保真就糊高保真 = 在未验证的骨架上贴皮 |
| "高保真够了，4 态以后开发再说" | 4 态在开发阶段补的成本远高于原型阶段——完整实现就是为了提前验证 |
| "视觉方向凭感觉定一个" | 2-3 个方向让人选，比赌一个返工率低 |
| "先拍个 IA 再补交互" | IA 是从交互拆解汇总出来的 |
| "小项目也要建设计系统" | 小项目 brand-neutral 够用 |
| "Claude Design 不可用就没法做" | 本地 HTML 是完整备选 |
| "Modal 太简单不用做原型" | IA 里列了就要实现，在宿主页面里加一个 `<dialog>` 不费事 |
| "截图看了没问题就行" | Playwright 跑一遍比看一眼靠谱，交互验证能抓住点不动的按钮 |

## Red Flags

- 没建 TaskCreate 就开始做
- 跳 Step 2 直接出 IA
- IA 先于交互拆解产出
- wireframe 缺 empty/loading/error
- 跳档（没低保真就出高保真，或没高保真就出完整实现）
- 只给一个视觉方向
- 没对照 PRD 逐条核路径
- 交互流没标路径 ID
- 升档时推翻前一档（渐进式 = 叠加不是替换）
- Step 7 没回查交付方式
- 覆盖矩阵手填 ✅ 没跑 Playwright 验证（只看代码/summary 不算验证）
- 嵌入组件单独建了文件（应在宿主页面内实现）
- IA 中有页面/视图但原型里没实现（不允许"设计有原型无"）
