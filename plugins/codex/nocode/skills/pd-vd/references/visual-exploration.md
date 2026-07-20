# Step 1 展开：视觉探索

> 交互阶段（pd-ix Step 2）的竞品探索看「别人怎么做」（功能 + 流程），这一步看「别人长什么样」（视觉 + 排版 + 调性）。同一批竞品，换一层视角再看一遍。

## 1. 竞品视觉分析方法

### 从功能层下沉到视觉层

pd-ix 已经把竞品的功能和交互摸清了。这一步不重新找竞品，而是对同一批产品换问题：

| pd-ix 问的 | 本步问的 |
|---|---|
| 这个筛选器怎么用？ | 这个筛选器长什么样——位置、配色、圆角、字号？ |
| 列表怎么分页？ | 列表行高多少、斑马纹还是分割线、悬停态什么颜色？ |
| 详情页有哪些字段？ | 详情页用抽屉还是整页、留白多宽、标题层级怎么拉开？ |

转化动作：拿 pd-ix 的竞品清单（`.ix.md` 竞品参考表），逐个回访它们的关键页，这次只记录视觉特征。

### 截图截什么

每个竞品的每个关键页，截三类：

| 类型 | 截什么 | 为什么 |
|---|---|---|
| **整页布局** | 完整页面（full-page） | 看信息架构、留白节奏、区块划分 |
| **关键组件特写** | 按钮 / 卡片 / 表格 / 表单的局部放大 | 看圆角、阴影、间距、字重这些细节值 |
| **状态切换** | hover / active / empty / loading 态 | 看交互反馈的视觉表达，这是最容易漏的 |

边界状态尽量截——很多产品的空状态、加载态设计得很用心，是容易被忽略的部分。

### 每张截图的标注

一句话标三项，不要长篇：

```
[SOURCE] Linear · Issue 列表 · 深色底 + 紧凑行高 + 左侧彩色优先级标签
[SOURCE] Notion · 数据库视图 · 浅色底 + 宽松留白 + 12px 圆角卡片
[SOURCE] Raycast · 命令面板 · 深色半透 + 模糊背景 + 大圆角居中浮层
```

## 2. 截图工具链（降级链）

按可用性依次尝试：

1. **Playwright 可用** → 自动截全页

   ```bash
   npx playwright screenshot <url> --full-page -o <competitor>-<page>.png
   ```

   登录态页面：先 `--save-storage` 存 session，再带 `--load-storage` 截。

2. **mcp__computer-use 可用** → `screenshot` 截当前屏，适合已登录的桌面应用或需要手动导航到的状态

3. **都没有 / 竞品有付费墙** → 搜公开素材（Product Hunt、官方 blog 配图、Dribbble、review 站），或列出「产品名 + 具体页面 + 想看的状态」请用户手动截图提供

> 状态态（hover/active）自动截图很难触发，通常要么 computer-use 手动操作，要么请用户提供。

## 3. Template 搜索（Claude Design 可用时）

### Template 是什么

Claude Design 新建项目时的一个起步入口。选 Template = 拿一个已经做好的成品当起点，在它基础上改，而不是对着空白 prompt 从零描述。一个匹配的 template 等于 80% 的页面骨架已经搭好。

### Template vs Design System（别混）

两者正交，管完全不同的事：

| | 管什么 | 类比 |
|---|---|---|
| **Template** | 从什么**结构**起步（页面骨架已搭好） | 户型图 |
| **Design System** | 用什么**品牌**渲染（颜色/字体/组件） | 软装风格 |

可以叠加：用 template 起步（拿现成结构）+ 挂自己的 design system（套品牌色）= 既省搭骨架的功夫，又符合品牌。用了 template 不强制要 design system，不挂就是模板自带的视觉。

### 怎么搜

- Claude Design 可用 → `$claude-design` → `claude-design list` 确认授权，浏览模板库找匹配本产品类型的（dashboard / landing / app / settings 等）
- 匹配判断：看模板的页面结构跟本次 IA 的关键页是否接近，接近 → 记为起点候选
- **Claude Design 不可用 / 走本地 HTML 线 → 跳过本节**，无 template 概念，直接走 Step 2b 视觉方向发散

## 4. 视觉参考集产出格式

### 竞品视觉参考

| 竞品 | 页面 | 截图 | 视觉特征 | 来源 |
|---|---|---|---|---|
| Linear | Issue 列表 | `linear-issues.png` | 深色底、紧凑行高、左侧彩色标签 | [SOURCE] linear.app |
| Notion | 数据库视图 | `notion-db.png` | 浅色底、宽松留白、圆角卡片 | [SOURCE] notion.so |
| Raycast | 命令面板 | `raycast-cmd.png` | 深色模糊底、大圆角浮层 | [SOURCE] raycast.com |

### Template 候选（如有）

| 模板名 | 类型 | 匹配度 | 备注 |
|---|---|---|---|
| Dashboard Pro | SaaS Dashboard | 高 | 侧边栏 + 卡片网格，接近本次 IA |
| Minimal Admin | Admin Panel | 中 | 结构匹配但调性偏冷，需调色 |

> 视觉参考集是 Step 2b 定视觉方向的输入——有了它，定方向是「从这几个里挑/融合」，而不是凭空发散。
