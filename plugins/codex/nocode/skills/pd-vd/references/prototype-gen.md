# Step 4 展开：生成原型

把交互结构 + 视觉方向 + 冻结的设计系统（tokens + components，Step 3 样张已拍板、3d 已落点）拼成可看可走的高保真原型。两条交付线（Claude Design / 本地 HTML）步骤相同、实现不同。**先回查 Step 2a 选定的交付线，别凭记忆判断走哪条线。**

---

## 共同结构：拆分 + 组合

两条线的产出都遵循同一个结构：

- **拆分（独立页面文件）**：每个独立页面一个文件，嵌入组件（Modal/Dialog/Drawer）在宿主页面内实现
- **组合（交互原型）**：在独立页面基础上，再产出可交互的原型。两条线的区别在于怎么组合

**文件拆分标准**：独立页面 = 不同路径分支的落地页（首页、列表页、设置页），各一个文件；嵌入组件 = 同一页面内的交互分支（弹窗、抽屉、对话框），在宿主页面内实现，不单独建文件。

**100% 覆盖**：IA 中的每个页面/视图都必须在原型中实现——独立页面有自己的文件，嵌入组件在宿主页面内实现。不存在"设计覆盖但原型未实现"的中间态，**也不存在"先出关键页"**——覆盖度不打折。

| | Claude Design 线 | 本地 HTML 线 |
|---|---|---|
| 怎么出 | `$claude-design` → `claude-design <brief>` | 本地写多个 `.html` 文件 |
| 喂什么 | brief = IA + 交互清单 + 场景脚本 + 视觉方向；绑 Step 3d 的 DS 项目（design_system_id）+ 挂 template | IA + 交互清单 + 场景脚本 + 视觉方向 + 冻结 tokens/components/样张 |
| 拆分 | 每个独立页面一个文件（含宿主内嵌入组件） | 每个独立页面一个文件（含宿主内嵌入组件） |
| 组合 | 额外一个组合文件（融合全部主链路页面代码，JS tab 切换/弹窗） | 多文件之间用 URL 跳转，每个文件内做弹窗 |
| 组合的代价 | 内容在独立页面和组合文件中重复，改一处要同步改另一处 | 无重复，每个文件只存在一份 |
| 产物在哪 | claude.ai 原型项目（记 projectId，与 DS 项目分离） | `{pd_vd_output}` 目录落本地 repo |
| 适合 | 团队 canvas 协作、复用组织设计系统 | 版本控制、离线、无重复维护 |

**行为语义单源在 `.ix.md`**：交互怎么触发、维持、退出，按行为规格实现，不就地发明；需要 IX 未定义的行为 → 先在 `.ix.md`「下游澄清回流」节登记；时序参数（浮层退出缓冲时长等）原型定值后同步登记。

---

## Claude Design 线

### `claude-design <brief>` 写法

先调 `$claude-design` 加载 claude-design skill，然后传 brief。Claude Design 基于已同步的设计系统生成多屏设计/原型。brief 写得越结构化，产出越贴合。

**brief 必含五块：**

1. **设计系统引用** — "用 \<设计系统名\> 设计系统"（Step 3d 落点的 DS 项目，创建原型项目时绑 `design_system_id`）
2. **页面结构（IA）** — 从 `.ix.md` 的 IA 抄：每个页面有哪些区块，**全部页面，无例外**
3. **交互清单 + 行为规格要点** — 每个页面用户能做什么操作、关键行为语义（浮层维持/退出）
4. **场景脚本** — `.ix.md` 的走查实例，作为 demo 编排依据
5. **视觉方向** — Step 2b 方向（一句话 + 参考产品）；产出标准固定高保真（独立页面 + 组合文件，交互可操作）

### 绑 design system 和挂 template

- **绑 design system**：创建原型项目时绑 Step 3d 的 DS 项目（`design_system_id`），brief 里写"用 \<名\> 设计系统"。注意：平台每个文件独立渲染，页面文件仍需自包含 token 定义——值从冻结表复制、名零漂移，这解决渲染；浏览/绑定/复用由 DS 项目承载，两者不互相替代
- **挂 template**：Step 1 搜到的 template 候选 → brief 里写"以 \<template 名\> 为起点结构"，省去从空白生成

### Claude Design 交互能力边界

Claude Design 的每个文件独立渲染，**跨文件导航不支持**——写了 5 个文件就是 5 个独立页面，互相点不过去。

解法：独立页面文件保留不动（每个文件内已含该页的嵌入组件），**额外创建一个组合文件**（`prototype.html`），把所有页面的代码融合进来，用 tab/section 切换模拟导航。单文件内 JS 正常执行，弹窗、抽屉、状态切换都能做。

**组合文件内可做：**
- 顶部 tab 切换页面（JS display toggle）
- 弹窗 / 模态对话框（JS + CSS）
- 侧边抽屉滑出（JS + CSS transition）
- 控件四态（CSS，继承组件级定义）
- empty / loading / error 边界态切换（JS 按钮演示）

**不能做：**
- 跨文件导航（平台限制，所以才需要组合文件）
- 真实 URL 路由（URL 不会变）

**代价：** 组合文件里的页面代码和独立页面文件是重复的。改了某个独立页面的设计，组合文件也要同步改，否则两边不一致。

### brief 示例

```
claude-design 用 Nocode Manager 设计系统，生成资源管理应用的高保真可交互原型。

第一步：独立页面文件（每个独立页面一个，嵌入组件在宿主页面内实现，覆盖 IA 全部页面）
- home.html — 首页：预设卡片网格 + 统计面板 + 最近活动流
- library.html — 资源库：顶部筛选栏 + 数据表格 + 批量操作条 + 资源详情抽屉（嵌入） + 导入对话框（嵌入）
- settings.html — 设置页：偏好设置表单

第二步：组合文件 prototype.html
把所有页面的代码融合到一个文件里，用顶部 tab 切换页面。
Claude Design 不支持跨文件导航，所以交互统一在这个组合文件实现。

组合文件内交互（必须能点，行为按 .ix.md 行为规格）：
- 顶部 tab 切换：首页 ↔ 资源库 ↔ 设置
- 资源库点一行 → 右侧滑出详情面板（含维持/退出语义）
- 点"+导入" → 弹出模态对话框 → 确认后关闭

视觉方向：工具感——深色底、紧凑行高、等宽字体标签，参考 Linear。
```

### 并行生成（≥3 个独立页面时推荐）

页面多时一个 brief 塞所有页面，单次调用质量会下降。拆分并行：每页一个 subagent 独立生成，最后合流推送。

**前提**：设计系统已冻结（Step 3 样张拍板、3d 已落点）、视觉方向已定（Step 2b）。

#### 1. 拆分 page-brief

IA 每个独立页面拆成一份 page-brief。共享部分抽公共 context，避免重复：

```
公共 context（所有 subagent 共享）：
- 设计系统引用：Step 3d 的 DS 项目名 + dsProjectId + 冻结 tokens 变量清单 + 样张路径
  （subagent 本地写文件需要 token 值——从冻结表复制，名零漂移）
- 视觉方向：Step 2b 确定的方向（一句话 + 参考产品）
- 导航结构（全站统一）

page-brief（每页独有）：
- 页面名称 + 文件名
- 该页 IA 结构（区块清单）
- 该页交互清单 + 行为规格（从 .ix.md 筛选该页相关交互）
- 该页嵌入组件（Modal/Dialog/Drawer，在宿主页面内实现）
- test-id 前缀（<页面名>-）
```

#### 2. 并行生成

每页一个 subagent，产出 `.html` 文件到本地（纯本地写文件，不调 Claude Design API）：

```
parallel(pages.map(page => () =>
  agent(`生成 ${page.name} 页面。\n${sharedContext}\n${page.brief}`, {
    label: `page:${page.file}`,
    phase: 'Generate'
  })
))
```

subagent 只产本地文件、只引用冻结 tokens 变量（禁硬编码）。orchestrator 负责最终推送——不让 subagent 各自调 API，否则违反并发限制。

#### 3. 合流判定（基于导航链路连通性）

并行完成后，不是纯用户选择"融合还是分支"——**由页面之间的导航链路决定**哪些能合并、哪些必须独立。

**判定逻辑：**

1. 从 IA 的导航结构提取页面间跳转关系，构建**导航图**
2. 找出导航图中的**连通子图**——哪些页面之间有前端链路可达（导航栏跳转、按钮跳转、链接跳转）
3. 分类：

| 类型 | 特征 | 例子 | 处理 |
|---|---|---|---|
| **主链路页面** | 在导航图的最大连通子图内，前端链路连贯 | 首页 ↔ 资源库 ↔ 设置 | 融合到 `prototype.html` 组合文件 |
| **孤立页面** | 无法通过前端导航到达，只在特定条件触发 | 404 页面、onboarding 引导、邮件验证页 | 保留为独立文件，不进组合文件 |
| **条件分支** | 连通但触发条件特殊（如登录后跳转、权限不同展示不同页面） | 登录页 → 首页（登录后）| 视链路完整性：能串起来就融合，串不起来就独立 |

**推送流程：**
```
1. 选/建目标 project
2. 写入前版本检查（已有 project 时 list_files → read_file 拿 etag）
3. 所有文件（主链路 + 孤立）推到同一 project
   finalize_plan(project_id, writes: [所有页面文件名])
   write_files(project_id, plan_token, files: [所有页面，已存在的带 if_match])
4. 追加 prototype.html（只融合主链路页面）→ 再一次 finalize_plan → write_files
```

**最终产物结构：**
```
project/
├── home.html          ← 主链路（进组合文件）
├── library.html       ← 主链路（进组合文件）
├── settings.html      ← 主链路（进组合文件）
├── prototype.html     ← 组合文件：融合主链路页面，tab 切换
├── styleguide.html    ← Step 3 样张（组件基线）
├── 404.html           ← 孤立页面（独立保留）
└── onboarding.html    ← 孤立页面（独立保留）
```

#### 4. 组合文件

组合文件只融合**主链路页面**（导航图连通子图内的页面），不强行塞入孤立页面：

- 读取主链路页面文件（`read_file` 每个页面）
- 融合代码到 `prototype.html`：顶部 tab 切换 + JS 弹窗/抽屉
- 孤立页面保持独立文件，各自可渲染、可截图，但不参与组合文件的导航链路
- 再一次 `finalize_plan` → `write_files` 推送组合文件

组合文件内容与独立页面重复——改了独立页面，组合文件要同步改。

### 拉回本地（Step 5 验证必做）

Step 5 Playwright 验证需要本地文件，Claude Design 线必须先拉回：

```
claude-design read <projectId> <path>
```

把指定项目的文件拉进工作目录，然后在拉下来的文件上跑 `prototype-verify.mjs`，流程与本地 HTML 线一致。拉取失败时降级为 `claude-design render` 预览 + 截图。

---

## 本地 HTML 线

产出多个 `.html` 文件 → `{pd_vd_output}` 目录，落本地 repo。多文件之间用 URL 跳转串联，不需要额外的组合文件。

### 页面产出要求

- 每页一个文件（`home.html`、`library.html`…），**覆盖 IA 全部页面**
- 所有视觉值引用冻结 tokens（`<link>` 引入 Step 3d 落盘的共享 `tokens.css` 或等价物），禁硬编码、禁改名
- 组件结构复用 Step 3 的 components（样张即对照基线）

### 交互要求

两条硬要求：

1. **token 零漂移** — 颜色/间距全走 `var(--token)`，变量名与冻结表逐一一致
2. **交互按行为规格** — 嵌入组件能弹出/滑出、页面间能跳转；触发/维持/退出语义照 `.ix.md` 实现，不就地发明

```html
<!-- 多文件导航示例（每个可操作元素加 data-testid） -->
<nav>
  <a href="home.html" data-testid="nav-home">首页</a>
  <a href="library.html" data-testid="nav-library">资源库</a>
  <a href="settings.html" data-testid="nav-settings">设置</a>
</nav>

<!-- 页内弹窗 -->
<dialog id="import-dialog" data-testid="library-import-dialog">
  <h2>导入资源</h2>
  <!-- ... -->
  <button onclick="this.closest('dialog').close()" data-testid="library-import-cancel">取消</button>
</dialog>
<button onclick="document.getElementById('import-dialog').showModal()" data-testid="library-import-trigger">+导入</button>
```

### taste skills 在哪一步生效（本节只是提醒，不在这加载）

风格与取值知识已在 **Step 3a** 经决策树注入（决策框架恒加载、风格包最多一个、dataviz 按需、redesign 按场景）——Step 4 出稿时**只消费冻结的 tokens + components**，不再临时加载 taste skill 补视觉。发现视觉不对 → 回 Step 3 改 token / 组件，样张重拍板，不在页面里就地改值。

---

## 两条线共同要求

- **test-id** — 每个可操作元素（按钮、链接、输入框、导航项、状态切换控件、弹窗触发器）加 `data-testid` 属性。Playwright selector 用 `[data-testid="xxx"]` 定位，不依赖脆弱的 CSS class 或文本内容。命名规则：`<页面>-<组件>[-<变体>]`，kebab-case。两条线（本地 HTML + Claude Design）都加
- **基线不推翻** — 在 `.ix.md` ASCII 骨架上落视觉 + 交互，不改 IA / 页面结构；视觉不对回 Step 3 改 token / 组件重拍板，不在页面里就地改值
- **截图走查** — Step 5 用 Playwright 自动截图 + 交互验证，不手动看
- **对照 IA 核覆盖** — 原型产出后回扫 `.ix.md` 的 IA：每个页面/视图都有对应屏吗？每条交互流走得通吗？缺的补，多的删

---

## 原型清单（Step 5 验证的输入）

Step 4 产出后、进 Step 5 前，列一份原型清单：每个 IA 页面/视图的实现位置 + 交互入口。IA 中每个页面/视图都必须有实现位置，无遗漏。Step 5 矩阵基于这份清单核对。

```markdown
## 原型清单
| IA 页面/视图 | 类型 | 实现位置 | 交互入口 |
|---|---|---|---|
| 首页 | 独立页面 | home.html | nav-home |
| 资源详情 | 嵌入组件 | library.html（Drawer） | 行点击 |
```

## 检查点

原型产出后验证：
- 产出标准达标（视觉渲染正常 + 交互可操作：嵌入组件可弹出/滑出、页面间可跳转）
- IA 的页面/视图 100% 覆盖：独立页面有文件，嵌入组件在宿主页面内实现，无遗漏
- token 零硬编码、零改名（与 Step 3 冻结表逐一比对）
- 行为语义与 `.ix.md` 行为规格一致；新增行为已回流登记
- 所有可操作元素有 `data-testid`（Step 5 Playwright 验证依赖）
- Claude Design 线：原型项目已绑 Step 3d 的 DS 项目 + projectId 已记录 + `claude-design read` 可拉回本地 / HTML 线：文件已保存到 `{pd_vd_output}`
