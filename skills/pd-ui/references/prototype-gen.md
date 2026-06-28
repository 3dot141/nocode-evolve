# Step 6 展开：生成原型

把交互结构 + 视觉方向 + 设计系统拼成可看可走的原型。两条交付线（Claude Design / 本地 HTML）步骤相同、实现不同。**先回查 Step 4 选定的交付方式，别凭记忆判断走哪条线。**

---

## 两条线快速对比

| | Claude Design 线 | 本地 HTML 线 |
|---|---|---|
| 怎么出 | `Skill(nocode-evolve:claude-design)` → `claude-design <brief>` | 本地写 `.ui-prototype.html` |
| 喂什么 | brief = IA + 交互清单 + 视觉方向 + 保真度；挂 template/design system | IA + 交互清单 + 视觉方向 + token/组件；无设计系统则加载 taste skill |
| 低保真产出 | 静态多屏 UI | 静态页面 HTML |
| 高保真产出 | 多屏可交互 + 导航逻辑 + 4 态 | 可点击原型，关键流程走得通 |
| 产物在哪 | claude.ai 项目（记 projectId） | `{pd_ui_prototype}` 落本地 repo |
| 适合 | 多屏导航、团队 canvas 协作、复用组织设计系统 | artifact 进版本库、离线、不依赖 claude.ai |

---

## Claude Design 线

### `claude-design <brief>` 写法

先调 `Skill(nocode-evolve:claude-design)` 加载 claude-design skill，然后传 brief。Claude Design 基于已同步的设计系统生成多屏设计/原型。brief 写得越结构化，产出越贴合。

**brief 必含四块：**

1. **设计系统引用** — "用 \<设计系统名\> 设计系统"（Step 5 已创建/复用的）。没有设计系统就省略，产出 brand-neutral
2. **页面结构（IA）** — 从 Step 2 的 IA 抄：每个页面有哪些区块
3. **交互清单** — 从 Step 1 锁定的交互抄：每个页面用户能做什么操作
4. **视觉方向 + 保真度** — Step 4 选定的方向（一句话 + 参考产品）+ 明确说低保真还是高保真

### 挂 template 和 design system

- **挂 design system**：brief 里写"用 \<名\> 设计系统"，Claude Design 自动引用该项目的 foundations + components 渲染
- **挂 template**：Step 3 搜到的 template 候选 → brief 里写"以 \<template 名\> 为起点结构"，省去从空白生成

### 低保真 vs 高保真的 brief 差异

| | 低保真 brief | 高保真 brief |
|---|---|---|
| 措辞 | "生成静态界面，确认视觉观感" | "生成可点击原型，含屏间导航" |
| 要不要交互 | 不强调交互逻辑 | 明确要导航逻辑 + 4 态 + empty/loading/error |
| 屏数 | 关键页即可 | 覆盖完整流程的所有屏 |

### brief 示例

**低保真：**

```
claude-design 用 Nocode Manager 设计系统，生成资源管理应用的低保真静态界面，
确认视觉观感。

页面结构（IA）：
- 首页：预设卡片网格 + 统计面板 + 最近活动流
- 资源库：顶部筛选栏 + 数据表格 + 批量操作条
- 资源详情：抽屉式，属性表单 + 同步状态

视觉方向：工具感——深色底、紧凑行高、等宽字体标签，参考 Linear。
低保真，关键页静态即可，不需要交互逻辑。
```

**高保真：**

```
claude-design 用 Nocode Manager 设计系统，生成资源管理应用的高保真可点击原型，
覆盖完整流程、屏间可导航。

页面结构（IA）：同上三页 + 导入对话框 + 设置页

关键流程（要能点着走）：
- 首页点预设卡 → 进资源库（已应用该预设筛选）
- 资源库点一行 → 右侧滑出详情抽屉
- 资源库点"+导入" → 弹导入对话框 → 确认后回列表

视觉方向：工具感，参考 Linear。
高保真：交互元素 4 态（hover/active/focus/disabled），
列表覆盖 empty/loading/error 态。
```

### 拉回本地（可选）

需要把 Claude Design 产物纳入版本库时：

```
claude-design read <projectId> <path>
```

把指定项目的文件拉进工作目录。Step 8 Handoff 时按需操作，不强制。

---

## 本地 HTML 线

产出单文件 `.ui-prototype.html` → `{pd_ui_prototype}`，落本地 repo。

### 低保真：静态页面

- 关键页单屏静态视觉
- **给具体值，不说"某种蓝"**：配色 hex（`#3b82f6`）、字号字重（`14px/600`）、间距（`12px`）、圆角（`8px`）
- 多页用同一份 `:root` CSS 变量，保证视觉一致

### 高保真：可点击原型

四条硬要求：

1. **token 不硬编码** — 颜色/间距用 CSS 变量（`var(--accent)`），不散落 hex。一份 `:root` 定义，全文引用
2. **交互元素 4 态** — hover / active / focus-visible / disabled，缺一不可
3. **边界态** — 列表/数据区覆盖 empty / loading / error，不只画正常态
4. **关键流程可走通** — 用 hash 路由（`#/library`）或 tab 切换实现多屏导航，点击能真的跳转

```html
<!-- hash 路由骨架 -->
<script>
  function route() {
    const page = location.hash.slice(2) || 'home';
    document.querySelectorAll('[data-page]').forEach(el =>
      el.hidden = el.dataset.page !== page);
  }
  addEventListener('hashchange', route);
  route();
</script>
```

### 无设计系统时：用 taste skill

Step 5 判定小项目跳过设计系统时，HTML 线靠 taste skill 兜底视觉。按 Step 4 视觉方向 `Skill()` 加载对应 skill，按其规范出稿：

| 视觉方向 | taste skill |
|---|---|
| 简约编辑风 | `minimalist-ui` |
| 高端精致 | `high-end-visual-design` |
| 机械工业风 | `industrial-brutalist-ui` |
| 防模板化 | `design-taste-frontend` |
| 改造已有 | `redesign-existing-projects` |

---

## 两条线共同要求

- **渐进式** — 在 Step 4 确认的升级基线上加东西，不推翻重来。低保真升高保真 = 给已有静态界面加交互，不重画
- **截图走查** — 有 browser/截图工具 → 截图逐个关键页走查；否则按 IA 结构自查
- **对照 IA 核覆盖** — 原型产出后回扫 Step 2 的 IA：每个页面/视图都有对应屏吗？每条交互流走得通吗？缺的补，多的删

---

## 检查点

原型产出后验证：
- 保真度对应的完整度达标（低保真有具体视觉值；高保真有 4 态 + 导航 + 边界态）
- IA 的页面/视图全覆盖，无遗漏
- Claude Design 线：projectId 已记录 / HTML 线：`.ui-prototype.html` 已保存到 `{pd_ui_prototype}`
