# Step 8 展开：Playwright 渲染验证

Step 8 的 8a（测试方案）和 8b（Playwright 执行）的完整操作指南。

---

## test-id 约定（两条线通用）

每个可操作元素（按钮、链接、输入框、导航项、状态切换控件、弹窗触发器）加 `data-testid` 属性。Playwright selector 用 `[data-testid="xxx"]` 定位，不依赖脆弱的 CSS class 或文本内容。

命名规则：`<页面>-<组件>[-<变体>]`，kebab-case。例：
- `library-filter-btn` — 资源库筛选按钮
- `library-import-trigger` — 导入对话框触发按钮
- `library-import-dialog` — 导入对话框本体
- `library-import-cancel` — 导入对话框取消按钮
- `library-state-empty` — 切换到 empty 态的控件
- `nav-home` / `nav-library` / `nav-settings` — 导航项

---

## 8a. 测试方案模板

基于原型清单 + 保真度输出，用户审批后才写脚本执行。测试方案必须包含三个部分：**页面层级图**（ASCII 树）、**导航链路图**（ASCII 流程）、**分层验证表**（Phase 1-3 按保真度）。

```
## 测试方案

保真度：完整实现
交付方式：本地 HTML

### 一、页面层级图

IA 全部页面/视图的树状结构。独立页面为节点，嵌入组件为子节点。标注每个页面在哪个 Phase 验证。

┌─ 资源管理应用 ─────────────────────────────────────────┐
│                                                         │
│  首页 (home.html)                    [P1][P1b][P2][P3] │
│                                                         │
│  资源库 (library.html)               [P1][P1b][P2][P3] │
│    ├── 资源详情 (Drawer, 嵌入)            [P2][P3]      │
│    ├── 导入对话框 (Dialog, 嵌入)          [P2][P3]      │
│    └── 数据区 (empty/loading/error)       [P3]          │
│                                                         │
│  设置页 (settings.html)              [P1][P1b][P2]      │
│                                                         │
│  ── 孤立页面（不进组合文件）──                           │
│  404 页面 (404.html)                 [P1][P1b]          │
│  引导页 (onboarding.html)            [P1][P1b]          │
│                                                         │
│  覆盖统计：                                              │
│    独立页面 5/5  嵌入组件 2/2  总计 7/7 = 100%           │
└─────────────────────────────────────────────────────────┘

Phase 标记：[P1] 截图  [P1b] UI 细节审核  [P2] 交互  [P3] 控件四态+边界态+链路

### 二、导航链路图

前端可达路径。实线 = 导航跳转，虚线 = 条件触发。标注主链路（进组合文件）和孤立页面。

── 主链路（prototype.html 组合文件）──────────────────────

  ┌──────┐     nav      ┌──────────┐     nav     ┌────────┐
  │ 首页 │◄────────────►│  资源库  │◄───────────►│ 设置页 │
  └──────┘              └────┬─────┘              └────────┘
                             │ 点击行
                        ┌────▼─────┐
                        │ 详情抽屉 │ (Drawer)
                        └──────────┘
                             │ "+导入"
                        ┌────▼─────┐
                        │ 导入对话 │ (Dialog)
                        └──────────┘

── 孤立页面（独立保留，不进组合文件）────────────────────

  ┌──────────┐          ┌──────────────┐
  │ 404 页面 │          │ 引导页       │
  │ (后端404) │          │ (首次登录)   │
  └──────────┘          └──────────────┘

  主链路页面：3    孤立页面：2
  验证链路：首页→资源库→详情→导入→资源库→设置→首页 (无断点)

### 三、分层验证表

#### Phase 1 — 页面截图（所有保真度）
| 文件 | 对应 IA 页面 | 类型 | 预期内容 |
|---|---|---|---|
| home.html | 首页 | 主链路 | 卡片网格 + 统计面板 + 活动流 |
| library.html | 资源库 | 主链路 | 筛选栏 + 数据表格 + 嵌入组件布局可见 |
| settings.html | 设置页 | 主链路 | 偏好设置表单 |
| 404.html | 404 页面 | 孤立 | 错误提示 + 返回首页链接 |
| onboarding.html | 引导页 | 孤立 | 欢迎文案 + 引导步骤 |

#### Phase 1b — UI 细节审核（所有保真度）
| 检查项 | 范围 | 判定 |
|---|---|---|
| 遮挡 | 所有页面 | 非浮层元素重叠 > 10% → warning |
| 溢出 | 所有页面 | 非滚动容器溢出 → warning |
| 文字截断 | 所有页面 | 关键文案被截断 → warning |
| 层叠 | 弹窗/抽屉页面 | 浮层打开后底层可点 → error |
| 间距一致性 | 列表/卡片区 | 同级元素间距 σ > 4px → warning |
| AI 截图走查 | 所有截图 | 布局/颜色/间距 vs 视觉方向偏离 → warning |

#### Phase 2 — 交互场景（高保真+完整实现）
| 场景 | 文件 | 操作 | 预期结果 | data-testid |
|---|---|---|---|---|
| 打开资源详情 | library.html | 点击行 | Drawer 滑出 | library-detail-trigger → library-detail-drawer |
| 打开导入对话框 | library.html | 点击"+导入" | Dialog 弹出 | library-import-trigger → library-import-dialog |
| 关闭导入对话框 | library.html | 点击"取消" | Dialog 关闭 | library-import-cancel |

#### Phase 3 — 完整验证（仅完整实现）
| 维度 | 场景 | 文件 | data-testid | 预期 |
|---|---|---|---|---|
| 控件四态 | 筛选按钮 hover | library.html | library-filter-btn | 背景色变化 |
| 控件四态 | 筛选按钮 disabled | library.html | library-filter-btn | 灰色 + 不可点 |
| 边界态 | 列表 empty | library.html | library-state-empty | "暂无数据" + 引导 |
| 边界态 | 列表 loading | library.html | library-state-loading | 骨架屏 |
| 边界态 | 列表 error | library.html | library-state-error | 错误提示 + 重试 |
| 链路 | 首页→资源库→详情→首页 | home.html | nav-library → library-detail-trigger → nav-home | 无断点 |
```

---

## 8b. Playwright 执行

### 按保真度分层跑不同 Phase

| 保真度 | 跑什么 | 验证什么 |
|---|---|---|
| **低保真** | Phase 1 | 每个页面渲染正常（不白屏、不报错）、嵌入组件布局可见 |
| **高保真** | Phase 1 + Phase 2 | 低保真全部 + 每个交互可操作（点击弹出/滑出/跳转） |
| **完整实现** | Phase 1 + Phase 2 + Phase 3 | 高保真全部 + 控件四态逐控件验证 + 边界态切换 + 跨页导航链路走通 |

### Phase 1 — 基础截图（所有保真度）

```bash
node scripts/prototype-verify.mjs <prototype-dir>
```
自动打开每个 HTML 文件、截全页面图、收集页面元数据（链接/按钮/dialog 数量）。

### Phase 1b — UI 细节审核（所有保真度）

Phase 1 截图完成后，对每张截图 + 页面 DOM 做 UI 质量检查。不只看"能不能渲染"，还看"渲染出来的效果对不对"。

**自动化检查（Playwright 脚本内跑）：**

| 检查项 | 怎么查 | 判定标准 |
|---|---|---|
| **遮挡** | 获取所有可见元素的 bounding box，检测非预期重叠（排除设计意图的叠层如 tooltip、dropdown） | 非浮层元素之间 bounding box 重叠面积 > 10% → 标 warning |
| **溢出** | 检查容器 `scrollWidth > clientWidth` 或 `scrollHeight > clientHeight` | 非滚动容器出现溢出 → 标 warning |
| **文字截断** | 检查带 `text-overflow: ellipsis` 的元素是否 `scrollWidth > clientWidth` | 关键文案（标题、导航项）被截断 → 标 warning |
| **层叠** | 弹窗/抽屉打开时，检查 overlay 是否覆盖底层内容（z-index + visibility） | 浮层打开后底层可操作元素仍可点击 → 标 error |
| **间距一致性** | 同级同类元素（列表项、卡片、导航项）之间的间距标准差 | 同级元素间距标准差 > 4px → 标 warning |
| **元素可见性** | 检查 `data-testid` 元素是否在 viewport 内可见（未被 `display:none` / `visibility:hidden` / 零尺寸隐藏） | 应可见的元素不可见 → 标 error |

**截图走查（AI 审查截图）：**

Phase 1 产出的每张截图，喂给 AI 做视觉审查（Read 截图文件），关注：
- 布局是否符合 IA 描述的区块结构（顶部是导航、主区域是内容、侧边是面板等）
- 颜色/字号/间距是否与视觉方向一致（不需要像素级精确，但不能明显偏离）
- 有没有明显的视觉缺陷：空白大块、元素挤成一团、文字糊到背景上、图标看不清

产出：`verify-output/ui-audit.json`，每个 warning/error 标文件名 + 元素 + 问题描述。errors > 0 → 修原型后重跑。

### Phase 2 — 交互场景验证（高保真 + 完整实现）

准备 `interactions.json`，列出每个需要验证的交互场景（嵌入组件触发、状态切换等）：
```bash
node scripts/prototype-verify.mjs <prototype-dir> --interactions interactions.json
```

interactions.json 示例（selector 统一用 `data-testid`）：
```json
[
  {
    "file": "library.html",
    "label": "资源详情抽屉",
    "steps": [
      { "action": "click", "selector": "[data-testid='library-detail-trigger']", "screenshot": "detail-drawer-open" }
    ]
  },
  {
    "file": "library.html",
    "label": "导入对话框",
    "steps": [
      { "action": "click", "selector": "[data-testid='library-import-trigger']", "screenshot": "import-dialog-open" },
      { "action": "click", "selector": "[data-testid='library-import-cancel']", "screenshot": "import-dialog-closed" }
    ]
  }
]
```

### Phase 3 — 完整测试套件（仅完整实现）

在 Phase 2 基础上扩展 interactions.json，覆盖三个维度：

**1. 控件四态逐控件**：每个可操作控件的 hover / active / focus-visible / disabled
```json
{
  "file": "library.html",
  "label": "筛选按钮 控件四态",
  "steps": [
    { "action": "hover", "selector": "[data-testid='library-filter-btn']", "screenshot": "filter-btn-hover" },
    { "action": "click", "selector": "[data-testid='library-filter-btn']", "screenshot": "filter-btn-active" },
    { "action": "focus", "selector": "[data-testid='library-filter-btn']", "screenshot": "filter-btn-focus" }
  ]
}
```

**2. 边界态切换**：每个数据区的 empty / loading / error
```json
{
  "file": "library.html",
  "label": "列表边界态",
  "steps": [
    { "action": "click", "selector": "[data-testid='library-state-empty']", "screenshot": "library-empty" },
    { "action": "click", "selector": "[data-testid='library-state-loading']", "screenshot": "library-loading" },
    { "action": "click", "selector": "[data-testid='library-state-error']", "screenshot": "library-error" }
  ]
}
```

**3. 跨页导航链路**：从页面 A 到页面 B 再到 C 再回 A，验证链路无断点
```json
{
  "file": "home.html",
  "label": "首页→资源库→详情→首页 链路",
  "steps": [
    { "action": "click", "selector": "[data-testid='nav-library']", "screenshot": "nav-to-library" },
    { "action": "click", "selector": "[data-testid='library-detail-trigger']", "screenshot": "nav-to-detail" },
    { "action": "click", "selector": "[data-testid='nav-home']", "screenshot": "nav-back-home" }
  ]
}
```

### Claude Design 线

先用 `claude-design read <projectId> <path>` 把产物拉到本地临时目录，然后在拉下来的文件上跑 `prototype-verify.mjs`，流程与本地 HTML 线一致。拉取失败时降级为 `claude-design render` 预览 + 截图。

### 产出

- `verify-output/screenshots/` — 全部截图（每个页面 + 每个交互步骤）
- `verify-output/verify-report.json` — 结构化报告（文件/状态/截图路径/错误）

### 验证失败处理

- 截图缺失（文件打不开）→ 修原型后重跑
- 交互失败（selector 找不到）→ 要么原型里没实现该交互，要么 selector 写错——先确认原型，再调 selector
- JS 报错 → 修原型代码
