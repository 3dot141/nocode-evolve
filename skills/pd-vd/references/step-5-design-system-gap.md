# Step 6 展开：设计系统补齐（claude-design）

## 为什么先补齐再组装

设计系统三层：

```
foundations/   ← 原子层：颜色 token、字号、间距
    ↓
components/    ← 分子层：按钮、卡片、表格、输入框
    ↓
patterns/      ← 组织层：页面级布局（sidebar + content area + detail page）
```

patterns 由 components 组装，components 依赖 foundations。如果跳过 gap analysis 直接写 pattern，就会在 pattern 里内联本该是 component 的东西——下次改组件要改所有 pattern，违背 design system 的复用初衷。

## claude-design 操作流程

通过 `Skill(nocode:claude-design)` 统一操作，内部自动路由到 MCP 或 DesignSync。

### 1. 盘点现有

```
claude-design open <projectId>
# 内部调 MCP list_files(project_id)
```

看 foundations/、components/、patterns/ 各层现有文件。

### 2. Gap Analysis

对照 Step 2 交互清单，逐交互检查：

| 交互点 | 需要的组件 | 现有 components | 缺失 |
|---|---|---|---|
| 资源库.P5.1 浏览列表 | DataTable, FilterBar, Badge | DataTable ✓, Badge ✓ | FilterBar ✗ |
| 预设.P1 创建预设 | Form, MultiSelect, TagInput | Form ✓ | MultiSelect ✗, TagInput ✗ |

### 3. 补齐组件

每个缺失组件：

1. 写 `.dc.html` 文件（放本地 scratchpad 或 localDir）
2. 通过 claude-design 批量推送：

```
claude-design write <projectId> components/filter-bar.dc.html components/multi-select.dc.html
# 内部自动路由：小文件 → MCP finalize_plan + write_files
#                大文件 → DesignSync finalize_plan + write_files (localPath)
```

### 4. 补齐 foundations（如需）

新视觉方向引入了新 token（如新的 accent color、新的 spacing scale）→ 更新 foundations/ 下对应文件，同一批推送。

## `.dc.html` 格式要点

- 首行 `<!-- @dsCard group="Components" -->` — Design System 面板自动建卡片索引
- 使用 foundations 定义的 CSS 变量（`var(--color-primary)`），不硬编码 hex
- 展示组件的关键变体（primary / secondary / disabled / loading 等）
- 自包含：一个 `.dc.html` 文件 = 一个组件的完整展示

## 检查点

补齐后验证：
- `claude-design open <projectId>` 确认文件已在项目里
- 新组件引用的 token 在 foundations 里都有定义
- 组件变体覆盖了 Step 2 交互里会用到的状态
