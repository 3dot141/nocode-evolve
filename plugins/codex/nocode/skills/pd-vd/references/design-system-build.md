# Step 3 展开：设计系统（tokens + components + 样张）

> pd-vd Step 3 的展开 reference。设计系统 = 品牌渲染层，让多个页面看起来像同一个产品。本文覆盖：三层顺序、tokens 取值方法、gap analysis、并行创建、样张构成、两线落点（3d）、claude-design 操作参考。
> 三层命名（tokens / components / patterns）单源在 `${PLUGIN_ROOT}/shared/references/ix-vd-contract.md`。

## 一、三层为什么是这个顺序

```
tokens/        ← 原子层：色板、字体角色、字号刻度、间距、圆角、阴影、控件四态规则
    ↓
components/    ← 分子层：按钮、卡片、表格、输入框
    ↓
patterns/      ← 组织层：页面级布局（= Step 4 组装，不在 Step 3 内做真实页面）
```

依赖方向是单向的：

- **components 引用 tokens 的变量** — 按钮的背景色是 `var(--color-primary)`，token 不定，组件没法引用。
- **patterns 由 components 组装** — 页面是把按钮、卡片、表格摆到布局里，组件不齐就组装不了。

**跳层的后果**：跳过 tokens / components 直接写 pattern，就会在 pattern 里内联本该复用的东西（直接写死一个按钮的 HTML+CSS）。下次改按钮样式，要改所有 pattern 里的每一处——这正是设计系统要消除的重复。

**生产顺序 tokens 先、components 后（引用变量）；确认点只有一个**——样张（第五节）同时展示两层，一次拍板。token 改值经变量传播到全部组件零成本，所以不需要「先拍 token 再产组件」的中间 Gate。

## 二、tokens 取值方法（3a 展开）

从「视觉方向一句话」到「具体值」必须有推导链，不靠即兴。三步：

### 1. 决策树定来源（SKILL.md Step 3a 的树，不重复）

已有设计系统 → 沿用；无 → request_user_input 选品牌资产/风格包；不选 → 按三轴坐标就近匹配。

### 2. 决策框架给方法（恒加载）

- `frontend-design`：token-plan 方法——4-6 个**具名** hex（每个色有名字有用途，不是一坨色板）、≥2 种字体角色（display / body / mono 各司其职）、一句话 layout 概念、一个 signature 元素（这个产品独有的视觉记号）
- `design-taste-frontend`：反模式禁令——AI 套路配色（紫蓝渐变 / 米色+衬线+赤陶等默认聚集区）、模板化布局，生成前主动规避
- 风格包命中时：其死值作**初值**（如 minimalist 的 `#F7F6F3` 底、brutalist 的零圆角），再按产品微调；风格包与用户 brief 冲突时 brief 赢

### 3. 竞品参考转化为值

Step 1 视觉参考集里的定性描述（「深色底、紧凑行高」）落成具体值时标注来源：`--bg: #0f1115（参考 Linear 深色底，非直抄）`。

### tokens 完备 schema（缺一不过 Gate）

| # | 项 | 内容 | 反例（缺它的后果） |
|---|---|---|---|
| 1 | 色板 | 4-6 具名 hex（bg / surface / text / primary / 语义色） | 只有颜色没有名字，页面间用途漂移 |
| 2 | 字体角色 | ≥2（display / body，可加 mono） | 全站一个字重拉不开层级 |
| 3 | 字号刻度 | 明确刻度（如 12/13/15/18/22/28） | 每页字号即兴，13px vs 14px 漂移 |
| 4 | 间距基 | 基数网格（4 或 8pt）+ 常用档 | 卡片内边距各页不一 |
| 5 | 圆角 | 一套圆角系统（卡片/按钮/输入框各档） | 8px 与 12px 混用 |
| 6 | 阴影 | 层级档位（含 hover 态） | 景深随手写 |
| 7 | 控件四态规则 | hover / active / focus-visible / disabled 的**通用样式规则**（组件级一次定义，页面继承） | 逐控件逐页补，永远补不齐 |
| 8 | signature 元素 | 本产品独有的视觉记号 | 产出物「像任何一个模板」 |

全部落成 CSS 变量（`tokens.css` 或等价物），带一句语义注释：

```css
--color-primary: #3370FF;   /* 主操作、链接、选中态 */
--space-md: 16px;           /* 卡片内边距、模块间距基准 */
--radius-card: 12px;        /* 卡片；按钮用 --radius-btn */
```

## 三、Gap Analysis 流程

对照 IA 逐交互检查：这个交互需要哪些组件？现有覆盖吗？

### 1. 盘点现有

```
claude-design open <projectId>
# 内部调 MCP list_files(project_id)
```

看 tokens/、components/、patterns/ 各层现有文件，建立现状基线。本地 HTML 线扫已有组件/样式文件。

### 2. 逐交互列缺口

| 交互点 | 需要的组件 | 现有 components | 缺失 |
|---|---|---|---|
| 资源库.P5.1 浏览列表 | DataTable, FilterBar, Badge | DataTable ✓, Badge ✓ | FilterBar ✗ |
| 预设.P1 创建预设 | Form, MultiSelect, TagInput | Form ✓ | MultiSelect ✗, TagInput ✗ |

缺失列就是要并行补齐的组件清单。注意去重——FilterBar 可能被多个交互复用，只补一次。**组件清单由交互驱动**：小项目交互少，清单自然短——这是「components 必做」不构成负担的原因。

## 四、并行创建流程

核心模式：**tokens 串行先做 → components 并行生产 → 收口校验 → 样张渲染 → 一次拍板 → 统一推送**。

### 4.1 tokens 串行先做

所有组件引用 tokens 的变量，token 名还在变就并行不了。按第二节方法产出后，整理「变量名 + 语义」清单作为下游 subagent 的共享输入。

### 4.2 components 并行生产（一组件一 subagent）

每个缺失组件 spawn 一个 subagent，并行执行。每个 subagent 只产出文件写到共享 localDir，**不调 claude-design write**（推送收口在编排者，避免多 plan 竞争）。

精简版 subagent prompt 模板：

```
为设计系统产出一个组件的 .dc.html 文件。只产出文件，不调 claude-design write。

组件名：<ComponentName>
服务的交互点：<从 gap analysis 取>
必须覆盖的变体/状态：<从交互的行为规格与状态覆盖推，如 default / focused / disabled>
控件四态：按 tokens 的通用四态规则实现（hover/active/focus-visible/disabled）
视觉方向（Step 2b 选定）：<一句话描述 + 调性>

可用的 tokens（只能用这些变量，禁止硬编码 hex/px）：
<冻结的 token 清单>

.dc.html 格式：
- 首行 <!-- @dsCard group="Components" -->
- 用 var(--token) 引用，绝不硬编码 hex/px
- 自包含：一个文件 = 该组件所有关键变体的完整展示

产出：
1. 写到 <localDir>/components/<kebab-name>.dc.html
2. 返回：文件路径 + 引用的全部 token 清单（供校验）
```

### 4.3 收口校验（编排者）

1. **barrier** — 收齐所有 subagent 产出
2. **变量化校验** — 每个组件引用的 token 都在清单里吗？不在 = 硬编码了，打回重做
3. **失败降级** — 某组件 subagent 失败 / 校验不过 → 记入失败清单 → 串行重试一次 → 仍失败编排者自己补。一个组件失败不拖垮整批

### 4.4 样张渲染 + 拍板（见第五节）→ 拍板后按交付线落点（3d，见第六节）

拍板后执行 3d 落点。**这一步不专属并行流程**——串行生产、复用已有设计系统同样要走：

- Claude Design 线：一次 `finalize_plan`（writes 列全部组件路径 + tokens + 样张）→ 一次 `write_files` 批量推 → 组件卡显式入索引
- 本地 HTML 线：直接落 `{pd_vd_output}` 目录

## 五、单页样张（styleguide.html）

**样张 = 一页 HTML 全览，不是任何真实页面**。结构三段：

```
┌─ Tokens ────────────────────────────────────┐
│  色板（具名色块 + hex + 用途）                  │
│  字体样例（display / body / mono 各一段真实文案）│
│  字号刻度 / 间距刻度可视化                      │
├─ Components ────────────────────────────────┤
│  每个组件 × 关键变体 × 控件四态                 │
│  （按钮排一行：default/hover/active/focus/disabled）│
├─ Patterns ──────────────────────────────────┤
│  布局骨架缩略（灰块示意区块划分，不填真实内容）    │
└─────────────────────────────────────────────┘
```

**迭代方式**：
- 调性不对（色/字/距）→ 改 token 变量，整页自动刷新，原地迭代
- 单个组件不对 → 重做该组件，其它不动
- 结构性推翻（风格包选错）→ 回决策树重选，components 因引用变量大部分可保留

**拍板后**：tokens + components 冻结，成为 Step 4-6 唯一取值来源。样张存 `{pd_vd_output}` 同目录 `styleguide.html`，Step 5 Phase 1b 对照它核组件一致性，devflow Build 拿它当组件参考。

## 六、两线落点（3d）与创建方式选型

落点由 Step 2a 交付线决定。**落点绑死，创建路径不绑死**——不论设计系统从哪来、用什么方式创建，冻结结果必须落到交付线对应的位置。

### 本地 HTML 线

冻结结果落 `{pd_vd_output}` 目录：`tokens.css` + components + `styleguide.html`。复用代码库已有 tokens 时，提取对齐后落盘冻结快照（标注上游来源 + 冻结日期）。

### Claude Design 线：DS 项目必落，创建路径三选

**交付线 = Claude Design ⇒ 冻结结果必须成为独立 DS 项目**（与 Step 4 原型项目分离，可被 `design_system_id` 绑定），**设计真源在代码库也不豁免**——推送物是冻结时点快照（标注上游来源 + 冻结日期），单向同步，不构成双主。tokens 内联进原型文件只解决渲染（平台每个文件独立渲染，页面文件本就需要自包含 token 定义）；DS 面板可浏览、跨项目可绑定、协作可见，靠的是 DS 项目——内联不能替代落点。

创建路径按项目当前状态选：

| 方式 | 适用 | 推什么 |
|---|---|---|
| **Claude Design 在线创建** | 无代码的产品设计阶段 | 在 claude.ai/design 的 Design Systems 页面直接描述品牌（"深色工具风、蓝色强调、紧凑"），平台生成设计系统 |
| **`/design-sync` 推 React 组件** | 已有 Storybook 或 React 组件库 | 真实编译的组件 bundle（`_ds_bundle.js` + `.d.ts` + 预览），设计 agent 用真实组件出稿 |
| **`.dc.html` 手写 + claude-design write 推** | 兜底：无代码、又想从 Claude Code 端控制 | 手写的静态 HTML 展示卡片（见第七节格式） |

### 选型决策

```
有 React 组件库 / Storybook？
├─ 有 → /design-sync（推真实组件，质量最高；样张用 Storybook 页替代）
└─ 没有（纯产品设计阶段）
   ├─ Claude Design 可用 → 在线创建 + 本地样张校验
   └─ 想从 Claude Code 端逐文件控制 → .dc.html 手写 + claude-design write 推
```

> `/design-sync`（命令）和 `claude-design`（skill）是两回事：前者推真实 React 组件 bundle（走 DesignSync localPath），后者是通用 Claude Design 操作入口（MCP + DesignSync 自动路由）。无代码阶段用 `claude-design write` 推 `.dc.html`，有代码阶段用 `/design-sync` 推 bundle。

**复用已有设计系统 ≠ 跳过 Step 3**：取值来源变为「提取对齐已有 tokens」（3a）、gap analysis 只补缺口（3b）、样张仍然渲染拍板（3c，已有系统 + 新组件同页展示）、**落点仍然执行（3d）**——Claude Design 线已有 DS 项目则增量推缺口，没有则新建。

## 七、claude-design 操作参考

### 写入流程

通过 `$claude-design` 统一操作。claude-design 内部自动路由到 MCP 或 DesignSync:

- **小文件**（.dc.html 等 < 50KB）→ MCP `finalize_plan` → `write_files`（inline data）
- **大文件**（bundle/字体/图片 > 50KB）→ DesignSync `finalize_plan` → `write_files`（localPath 从磁盘读）

调用方不需要关心路由细节，只需要知道 `claude-design write` 会处理。

### DS 项目与卡片索引（3d 必查）

DS 类型项目的创建、组件卡显式入索引的具体工具路由以 `$claude-design` 为准。两处不能赌默认行为：普通项目建了**不能转** DS 型（类型创建时不可变，建错只能重建）；手写推的组件卡**不显式注册不保证入索引**（卡片长时间不出现在 Design System 面板）。

### 并发限制（重要）

不要对同一 project 并发开多个 plan——并发提交会争用文件索引（`@dsCard` 卡片重建），互相覆盖。

正确做法：**并行生产所有 `.dc.html`（纯本地写文件，无 API）→ 单个 `claude-design write` 批量推送**。即「并行算、批量提交」。

### `.dc.html` 格式要点

- 首行 `<!-- @dsCard group="Components" -->` — Design System 面板自动建卡片索引（group 按层填 Tokens / Components / Patterns）
- 使用 tokens 定义的 CSS 变量（`var(--color-primary)`），不硬编码 hex
- 展示组件的关键变体（primary / secondary / disabled / loading 等）+ 控件四态
- 自包含：一个 `.dc.html` 文件 = 一个组件的完整展示

### 检查点

补齐后验证：

- `claude-design open <projectId>` 确认文件已在项目里
- DS 项目类型 = 设计系统（不是普通项目），`claude-design systems` 可见、可被原型项目绑定
- 组件卡已入 Design System 面板索引（显式注册过，不是等被动扫描）
- 新组件引用的 token 在 tokens 里都有定义（零硬编码）
- 组件变体覆盖了交互的行为规格与状态覆盖会用到的状态
- 样张已渲染且经用户拍板
