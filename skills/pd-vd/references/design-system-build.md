# Step 3 展开：Design System 决策与创建

> pd-vd Step 3 的展开 reference。设计系统 = 品牌渲染层（颜色 / 字体 / 组件），让多个页面看起来像同一个产品。本文覆盖：三步走顺序、创建方式选型、gap analysis、并行创建、claude-design 操作参考。

## 一、三步走为什么是这个顺序

设计系统三层，自下而上：

```
foundations/   ← 原子层：颜色 token、字号、间距
    ↓
components/    ← 分子层：按钮、卡片、表格、输入框
    ↓
patterns/      ← 组织层：页面级布局（sidebar + content area + detail page）
```

依赖方向是单向的：

- **components 引用 foundations 的 token** — 按钮的背景色是 `var(--color-primary)`，token 不定，组件没法引用。
- **patterns 由 components 组装** — 页面是把按钮、卡片、表格摆到布局里，组件不齐就组装不了。

**跳层的后果**：如果跳过 foundations / components 直接写 pattern，就会在 pattern 里内联本该是 component 的东西（直接写死一个按钮的 HTML+CSS）。下次改按钮样式，要改所有 pattern 里的每一处——这正是设计系统要消除的重复。

所以顺序是硬约束：**foundations 冻结 → components 补齐 → patterns 组装**。前一层不稳，后一层就是在流沙上盖楼。

## 二、创建方式选型（三条路，不绑死）

按项目当前状态选，不强制走某一条：

| 方式 | 适用 | 推什么 |
|---|---|---|
| **Claude Design 在线创建** | 无代码的产品设计阶段 | 在 claude.ai/design 的 Design Systems 页面直接描述品牌（"深色工具风、蓝色强调、紧凑"），平台生成设计系统 |
| **`/design-sync` 推 React 组件** | 已有 Storybook 或 React 组件库 | 真实编译的组件 bundle（`_ds_bundle.js` + `.d.ts` + 预览），设计 agent 用真实组件出稿 |
| **`.dc.html` 手写 + claude-design write 推** | 兜底：无代码、又想从 Claude Code 端控制 | 手写的静态 HTML 展示卡片（见第五节格式） |

### 选型决策

```
有 React 组件库 / Storybook？
├─ 有 → /design-sync（推真实组件，质量最高）
└─ 没有（纯产品设计阶段）
   ├─ Claude Design 可用 → 在线创建（描述品牌生成，最省事）
   └─ 想从 Claude Code 端逐文件控制 → .dc.html 手写 + claude-design write 推
```

> `/design-sync`（命令）和 `claude-design`（skill）是两回事：前者推真实 React 组件 bundle（走 DesignSync localPath），后者是通用 Claude Design 操作入口（MCP + DesignSync 自动路由）。无代码阶段用 `claude-design write` 推 `.dc.html`，有代码阶段用 `/design-sync` 推 bundle。

## 三、Gap Analysis 流程

对照 IA（Step 3 产出）逐交互检查：这个交互需要哪些组件？现有设计系统覆盖吗？

### 1. 盘点现有

```
claude-design open <projectId>
# 内部调 MCP list_files(project_id)
```

看 foundations/、components/、patterns/ 各层现有文件，建立现状基线。

### 2. 逐交互列缺口

| 交互点 | 需要的组件 | 现有 components | 缺失 |
|---|---|---|---|
| 资源库.P5.1 浏览列表 | DataTable, FilterBar, Badge | DataTable ✓, Badge ✓ | FilterBar ✗ |
| 预设.P1 创建预设 | Form, MultiSelect, TagInput | Form ✓ | MultiSelect ✗, TagInput ✗ |

缺失列就是要并行补齐的组件清单。注意去重——FilterBar 可能被多个交互复用，只补一次。

## 四、并行创建流程

核心模式：**foundations 串行冻结 → components 并行生产 → 收口统一推送**。

### 4.1 foundations 串行先做（冻结 token）

所有组件都引用 foundations 的 token，token 还在变就并行不了。先做完 foundations，整理一份「变量名 + 语义」清单作为下游 subagent 的共享输入：

```
--color-primary    主色
--color-surface    卡片背景
--space-md         标准间距（16px）
--radius-card      卡片圆角（12px）
...
```

新视觉方向引入了新 token（新 accent color、新 spacing scale）→ 在这一步更新 foundations，冻结后才进 components。

### 4.2 components 并行生产（一组件一 subagent）

每个缺失组件 spawn 一个 subagent，并行执行。每个 subagent 只产出 `.dc.html` 写到共享 localDir，**不调 claude-design write**（推送收口在编排者，避免多 plan 竞争）。

精简版 subagent prompt 模板：

```
为 Claude Design 设计系统产出一个组件的 .dc.html 文件。只产出文件，不调 claude-design write。

组件名：<ComponentName>
服务的交互点：<从 gap analysis 取>
必须覆盖的变体/状态：<从交互 4 态推，如 default / focused / disabled>
视觉方向（Step 5 选定）：<一句话描述 + 调性>

可用的 foundations token（只能用这些，禁止硬编码 hex/px）：
<冻结的 token 清单>

.dc.html 格式：
- 首行 <!-- @dsCard group="Components" -->
- 用 var(--token) 引用，绝不硬编码 hex/px
- 自包含：一个文件 = 该组件所有关键变体的完整展示

产出：
1. 写到 <localDir>/components/<kebab-name>.dc.html
2. 返回：文件路径 + 引用的全部 token 清单（供校验）
```

### 4.3 收口统一推送（编排者）

1. **barrier** — 收齐所有 subagent 产出
2. **校验** — 每个组件引用的 token 都在冻结清单里吗？不在 = 硬编码了，打回
3. **一次 finalize_plan**（writes 列全部组件路径 + foundations 改动）
4. **一次 write_files** 批量推
5. **失败降级** — 某组件 subagent 失败 / 校验不过 → 不进本批 write_files，记入失败清单 → 串行重试一次 → 仍失败编排者自己补。一个组件失败不拖垮整批。

## 五、claude-design 操作参考

### 写入流程

通过 `Skill(nocode:claude-design)` 统一操作。claude-design 内部自动路由到 MCP 或 DesignSync:

- **小文件**（.dc.html 等 < 50KB）→ MCP `finalize_plan` → `write_files`（inline data）
- **大文件**（bundle/字体/图片 > 50KB）→ DesignSync `finalize_plan` → `write_files`（localPath 从磁盘读）

调用方不需要关心路由细节，只需要知道 `claude-design write` 会处理。

### 并发限制（重要）

不要对同一 project 并发开多个 plan——并发提交会争用文件索引（`@dsCard` 卡片重建），互相覆盖。

正确做法：**并行生产所有 `.dc.html`（纯本地写文件，无 API）→ 单个 `claude-design write` 批量推送**。即「并行算、批量提交」。

### `.dc.html` 格式要点

- 首行 `<!-- @dsCard group="Components" -->` — Design System 面板自动建卡片索引（group 按层填 Foundations / Components / Patterns）
- 使用 foundations 定义的 CSS 变量（`var(--color-primary)`），不硬编码 hex
- 展示组件的关键变体（primary / secondary / disabled / loading 等）
- 自包含：一个 `.dc.html` 文件 = 一个组件的完整展示

### 检查点

补齐后验证：

- `claude-design open <projectId>` 确认文件已在项目里
- 新组件引用的 token 在 foundations 里都有定义
- 组件变体覆盖了 Step 2 交互里会用到的状态
