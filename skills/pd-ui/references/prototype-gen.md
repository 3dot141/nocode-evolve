# Step 7 展开：生成原型

把交互结构 + 视觉方向 + 设计系统拼成可看可走的原型。两条交付线（Claude Design / 本地 HTML）步骤相同、实现不同。**先回查 Step 5 选定的交付方式，别凭记忆判断走哪条线。**

---

## 共同结构：拆分 + 组合

两条线的产出都遵循同一个结构：

- **拆分（独立页面文件）**：每个独立页面一个文件，嵌入组件（Modal/Dialog/Drawer）在宿主页面内实现。低保真到这里就够了
- **组合（交互原型）**：高保真在独立页面基础上，再产出可交互的原型。区别在于怎么组合

**文件拆分标准**：独立页面 = 不同路径分支的落地页（首页、列表页、设置页），各一个文件；嵌入组件 = 同一页面内的交互分支（弹窗、抽屉、对话框），在宿主页面内实现，不单独建文件。

**100% 覆盖**：IA 中的每个页面/视图都必须在原型中实现。独立页面有自己的文件，嵌入组件在宿主页面内实现。不存在"设计覆盖但原型未实现"的中间态。

| | Claude Design 线 | 本地 HTML 线 |
|---|---|---|
| 怎么出 | `Skill(nocode-evolve:claude-design)` → `claude-design <brief>` | 本地写多个 `.html` 文件 |
| 喂什么 | brief = IA + 交互清单 + 视觉方向 + 保真度；挂 template/design system | IA + 交互清单 + 视觉方向 + token/组件；无设计系统则加载 taste skill |
| 低保真（拆分） | 每个独立页面一个文件（含宿主内嵌入组件），静态 | 每个独立页面一个文件（含宿主内嵌入组件），静态 |
| 高保真（组合） | 保留独立页面 + 额外一个组合文件（融合全部页面代码，JS tab 切换/弹窗/4 态） | 多文件之间用 URL 跳转串联，每个文件内做弹窗/4 态 |
| 组合的代价 | 内容在独立页面和组合文件中重复，改一处要同步改另一处 | 无重复，每个文件只存在一份 |
| 产物在哪 | claude.ai 项目（记 projectId） | `{pd_ui_prototype}` 目录落本地 repo |
| 适合 | 团队 canvas 协作、复用组织设计系统 | 版本控制、离线、无重复维护 |

---

## Claude Design 线

### `claude-design <brief>` 写法

先调 `Skill(nocode-evolve:claude-design)` 加载 claude-design skill，然后传 brief。Claude Design 基于已同步的设计系统生成多屏设计/原型。brief 写得越结构化，产出越贴合。

**brief 必含四块：**

1. **设计系统引用** — "用 \<设计系统名\> 设计系统"（Step 6 已创建/复用的）。没有设计系统就省略，产出 brand-neutral
2. **页面结构（IA）** — 从 Step 3 的 IA 抄：每个页面有哪些区块
3. **交互清单** — 从 Step 2 锁定的交互抄：每个页面用户能做什么操作
4. **视觉方向 + 保真度** — Step 5 选定的方向（一句话 + 参考产品）+ 明确说低保真还是高保真

### 挂 template 和 design system

- **挂 design system**：brief 里写"用 \<名\> 设计系统"，Claude Design 自动引用该项目的 foundations + components 渲染
- **挂 template**：Step 4 搜到的 template 候选 → brief 里写"以 \<template 名\> 为起点结构"，省去从空白生成

### Claude Design 交互能力边界

Claude Design 的每个文件独立渲染，**跨文件导航不支持**——写了 5 个文件就是 5 个独立页面，互相点不过去。

高保真的解法：独立页面文件保留不动（每个文件内已含该页的嵌入组件），**额外创建一个组合文件**（`prototype.html`），把所有页面的代码融合进来，用 tab/section 切换模拟导航。单文件内 JS 正常执行，弹窗、抽屉、状态切换都能做。

**组合文件内可做：**
- 顶部 tab 切换页面（JS display toggle）
- 弹窗 / 模态对话框（JS + CSS）
- 侧边抽屉滑出（JS + CSS transition）
- hover / active / focus-visible / disabled 4 态（CSS）
- empty / loading / error 状态切换（JS 按钮演示）

**不能做：**
- 跨文件导航（平台限制，所以才需要组合文件）
- 真实 URL 路由（URL 不会变）

**代价：** 组合文件里的页面代码和独立页面文件是重复的。改了某个独立页面的设计，组合文件也要同步改，否则两边不一致。

### 低保真 vs 高保真的 brief 差异

| | 低保真 brief | 高保真 brief |
|---|---|---|
| 文件结构 | 每页一个文件（拆分） | 保留独立页面 + 额外一个组合文件 `prototype.html`（拆分 + 组合） |
| 措辞 | "生成静态界面，确认视觉观感" | "独立页面 + 组合文件，组合文件用 tab 切换页面" |
| 交互 | 不强调交互逻辑 | 组合文件内：tab 导航 + 弹窗 + 4 态 + empty/loading/error |
| 屏数 | 关键页即可 | 覆盖完整流程 |

### brief 示例

**低保真：**

```
claude-design 用 Nocode Manager 设计系统，生成资源管理应用的低保真静态界面，
确认视觉观感。每个独立页面一个文件，嵌入组件在宿主页面内实现。

独立页面文件（IA）：
- home.html — 首页：预设卡片网格 + 统计面板 + 最近活动流
- library.html — 资源库：顶部筛选栏 + 数据表格 + 批量操作条 + 资源详情抽屉（嵌入） + 导入对话框（嵌入）
- settings.html — 设置页：偏好设置表单

嵌入组件在宿主页面内以初始隐藏状态呈现（低保真展示布局即可，不需要 JS 交互）。
视觉方向：工具感——深色底、紧凑行高、等宽字体标签，参考 Linear。
```

**高保真：**

```
claude-design 用 Nocode Manager 设计系统，生成资源管理应用的高保真可交互原型。

第一步：独立页面文件（每个独立页面一个，嵌入组件在宿主页面内实现）
- home.html — 首页
- library.html — 资源库 + 资源详情抽屉（嵌入） + 导入对话框（嵌入）
- settings.html — 设置页

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

### 拉回本地（可选）

需要把 Claude Design 产物纳入版本库时：

```
claude-design read <projectId> <path>
```

把指定项目的文件拉进工作目录。Step 9 Handoff 时按需操作，不强制。

---

## 本地 HTML 线

产出多个 `.html` 文件 → `{pd_ui_prototype}` 目录，落本地 repo。多文件之间用 URL 跳转串联，不需要额外的组合文件。

### 低保真：静态页面

- 每页一个文件（`home.html`、`library.html`…）
- **给具体值，不说"某种蓝"**：配色 hex（`#3b82f6`）、字号字重（`14px/600`）、间距（`12px`）、圆角（`8px`）
- 多文件共享同一份 CSS 变量（内联或 `<link>` 引入公共样式文件），保证视觉一致

### 高保真：可点击原型

四条硬要求：

1. **token 不硬编码** — 颜色/间距用 CSS 变量（`var(--accent)`），不散落 hex。公共样式文件定义，各页引用
2. **交互元素 4 态** — hover / active / focus-visible / disabled，缺一不可
3. **边界态** — 列表/数据区覆盖 empty / loading / error，不只画正常态
4. **多文件 URL 跳转** — `<a href="library.html">` 跳转到其他页面，点击能真的跳。弹窗/抽屉在各自页面内用 JS 实现

```html
<!-- 多文件导航示例 -->
<nav>
  <a href="home.html">首页</a>
  <a href="library.html">资源库</a>
  <a href="settings.html">设置</a>
</nav>

<!-- 页内弹窗 -->
<dialog id="import-dialog">
  <h2>导入资源</h2>
  <!-- ... -->
  <button onclick="this.closest('dialog').close()">取消</button>
</dialog>
<button onclick="document.getElementById('import-dialog').showModal()">+导入</button>
```

### 无设计系统时：用 taste skill

Step 6 判定小项目跳过设计系统时，HTML 线靠 taste skill 兜底视觉。按 Step 5 视觉方向 `Skill()` 加载对应 skill，按其规范出稿：

| 视觉方向 | taste skill |
|---|---|
| 简约编辑风 | `minimalist-ui` |
| 高端精致 | `high-end-visual-design` |
| 机械工业风 | `industrial-brutalist-ui` |
| 防模板化 | `design-taste-frontend` |
| 改造已有 | `redesign-existing-projects` |

---

## 两条线共同要求

- **渐进式** — 在 Step 5 确认的升级基线上加东西，不推翻重来。低保真升高保真 = 给已有静态页面加交互，不重画
- **截图走查** — 有 browser/截图工具 → 截图逐个关键页走查；否则按 IA 结构自查
- **对照 IA 核覆盖** — 原型产出后回扫 Step 3 的 IA：每个页面/视图都有对应屏吗？每条交互流走得通吗？缺的补，多的删

---

## 检查点

原型产出后验证：
- 保真度对应的完整度达标（低保真有具体视觉值；高保真有 4 态 + 导航 + 边界态）
- IA 的页面/视图 100% 覆盖：独立页面有文件，嵌入组件在宿主页面内实现，无遗漏
- Claude Design 线：projectId 已记录 / HTML 线：文件已保存到 `{pd_ui_prototype}`
