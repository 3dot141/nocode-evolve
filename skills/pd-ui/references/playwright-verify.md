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

基于原型清单 + 保真度输出，用户审批后才写脚本执行。

```
## 测试方案

保真度：完整实现
交付方式：本地 HTML

### Phase 1 — 页面截图
| 文件 | 对应 IA 页面 | 预期内容 |
|---|---|---|
| home.html | 首页 | 卡片网格 + 统计面板 + 活动流 |
| library.html | 资源库 | 筛选栏 + 数据表格 + 嵌入组件布局可见 |
| settings.html | 设置页 | 偏好设置表单 |

### Phase 2 — 交互场景（高保真+完整实现）
| 场景 | 文件 | 操作 | 预期结果 | data-testid |
|---|---|---|---|---|
| 打开资源详情 | library.html | 点击行 | Drawer 滑出 | library-detail-trigger → library-detail-drawer |
| 打开导入对话框 | library.html | 点击"+导入" | Dialog 弹出 | library-import-trigger → library-import-dialog |
| 关闭导入对话框 | library.html | 点击"取消" | Dialog 关闭 | library-import-cancel |

### Phase 3 — 完整验证（仅完整实现）
| 维度 | 场景 | 文件 | data-testid | 预期 |
|---|---|---|---|---|
| 4 态 | 筛选按钮 hover | library.html | library-filter-btn | 背景色变化 |
| 4 态 | 筛选按钮 disabled | library.html | library-filter-btn | 灰色 + 不可点 |
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
| **完整实现** | Phase 1 + Phase 2 + Phase 3 | 高保真全部 + 4 态逐控件验证 + 边界态切换 + 跨页导航链路走通 |

### Phase 1 — 基础截图（所有保真度）

```bash
node scripts/prototype-verify.mjs <prototype-dir>
```
自动打开每个 HTML 文件、截全页面图、收集页面元数据（链接/按钮/dialog 数量）。

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

**1. 4 态逐控件**：每个可操作控件的 hover / active / focus-visible / disabled
```json
{
  "file": "library.html",
  "label": "筛选按钮 4 态",
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
