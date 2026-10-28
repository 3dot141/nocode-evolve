# artifacts — 产出物规格

所有产出都是静态 HTML + PNG，能被浏览器直接打开。下面给的是可以直接抄的骨架，不要每次重新设计。

## 目录结构

```
design-demos/
├── index.html              总入口：三张入口卡 + 全部页面文档表
├── ui-overview.html        Token + 组件索引 + 使用规则
├── ux-overview.html        交互地图
├── design-widget/
│   ├── index.html          聚合全部组件，按通用分类
│   └── w01.html … wNN.html 每件一个独立文件
├── spec-mXX-<name>.html    每页四段式
├── _shared-design.md       子 agent 共享规范（不进最终交付，但必须存在）
└── *.png                   与 HTML 同名
```

## 页面文档：四段式

四块白板纵向排列，宽 1240，居中；每块左上角一个黑色小标签。

```html
<div class="board">
  <div class="tag">UI</div>
  <div class="bh"><h2>界面</h2><span class="en">Screens</span></div>
  <p class="lede">本页由哪几层组成、状态如何组合。</p>
  <div class="screens"><!-- 每屏一个 .s --></div>
</div>

<div class="board">
  <div class="tag">UX</div>
  <div class="bh"><h2>交互</h2><span class="en">Interactions</span></div>
  <p class="lede">先说明：内部交互是什么，外部入口与出口有哪些。</p>
  <table><!-- 交互 / 说明 / 规格 --></table>
  <div class="uxseq"><!-- 前后对照原型 --></div>
</div>

<div class="board">
  <div class="tag">Design Widget</div>
  <div class="bh"><h2>组件</h2><span class="en">Widgets In Use</span></div>
  <p class="lede">本页用了哪几个组件；完整规格在 design-widget/。</p>
  <div class="ws"><!-- 编号 + 名称 + 职责 + 一行规格 --></div>
</div>

<div class="board">
  <div class="tag">Design Token</div>
  <div class="bh"><h2>Token</h2><span class="en">Tokens Used</span></div>
  <p class="lede">本页实际用到的值；没列出的不许用。</p>
  <div class="tk"><!-- 色彩 / 字体 / 形状与间距 --></div>
</div>
```

```css
.board{background:var(--paper);border-radius:3px;box-shadow:0 12px 36px rgba(31,36,39,.12);
  padding:40px 44px 44px;margin-bottom:30px;position:relative}
.board > .tag{position:absolute;top:-11px;left:32px;background:var(--ink);color:var(--paper);
  font-family:var(--mono);font-size:9.5px;letter-spacing:1.6px;padding:4px 10px;border-radius:3px}
```

`board` 不要加 `overflow:hidden`——板标签是负 top，会被裁掉。

## 手机屏：真实尺寸

UI 段和 UX 段共用同一套外壳。真实尺寸是 390×844，放进 350 宽的格子时按容器收缩宽度，**字号保持 iOS 真值**（不缩字号，缩容器）。

```html
<div class="s">
  <div class="screen"><div class="phone">
    <div class="st-bar"><span>9:41</span><span class="sig">…</span></div>
    <div class="island"></div>
    <!-- 页面内容 -->
    <div class="home-ind"></div>
  </div></div>
  <div class="cap"><b>01 常态</b><i>一句规格</i></div>
</div>
```

```css
.screens{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px 24px}
.s{display:flex;flex-direction:column;min-width:0}
.screen{background:#DCD8D1;border-radius:22px;padding:9px;box-shadow:inset 0 0 0 1px rgba(31,36,39,.06)}
.phone{width:100%;height:774px;background:var(--paper);border-radius:15px;overflow:hidden;
  position:relative;display:flex;flex-direction:column}
.island{position:absolute;left:50%;top:8px;transform:translateX(-50%);
  width:104px;height:26px;background:#0C0D0E;border-radius:13px;z-index:12}
.home-ind{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);
  width:120px;height:4.5px;background:var(--ink);opacity:.85;border-radius:3px;z-index:12}
```

`minmax(0,1fr)` 不是可选项：用 `1fr` 时，一个 280 宽的菜单会把某一列挤到 192px。

## UX 前后对照

左边「之前」、箭头、右边「之后」、右侧说明。手机整体缩放到 0.639，放进 250 宽的框。

```html
<div class="uxrow">
  <div class="uxshot"><div class="phone"><!-- 之前 --></div></div>
  <div class="uxarrow"><svg width="26" height="10" viewBox="0 0 26 10">…</svg></div>
  <div class="uxshot"><div class="phone"><!-- 之后 --></div></div>
  <div class="uxnote"><b>交互名</b>
    <p>触发 / 发生什么 / 可逆性</p>
    <i>尺寸与动效</i></div>
</div>
```

```css
.uxrow{display:grid;grid-template-columns:250px 34px 250px 1fr;gap:16px;
  align-items:start;padding:26px 0;border-top:1px solid var(--hair)}
.uxshot{width:250px;height:541px;background:#DCD8D1;border-radius:16px;padding:6px;overflow:hidden}
.uxshot .phone{width:390px;height:844px;border-radius:12px;transform:scale(.639);
  transform-origin:top left;position:relative;overflow:hidden;background:var(--paper)}
```

## 组件库

每件一个文件，index 聚合。拆分方式：从聚合页里按 `<div class="board"` 切分，每段包一层独立页面，共用同一份样式。

组件文件的最小结构：

```html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>W01 · 顶栏</title>
<style>/* 与 index 相同的样式 */</style></head>
<body>
  <div class="topbar-a"><a href="./index.html">← 组件库</a> / W01 · 顶栏</div>
  <div class="board" id="root"><!-- 组件本体 --></div>
</body></html>
```

独立文件里 `.board` 要覆盖掉绝对定位：`position:relative!important;left:auto!important;top:auto!important`。

分类用通用组件库分法，五组：导航 Navigation / 数据展示 Data Display / 数据录入 Data Entry / 反馈 Feedback / 按钮与容器 Button & Container。

## 交互地图

两层结构，缺一不可：

1. **聚合层**：全部跨页动作按起点排开（起点 → 动作 → 终点 → 跳转类型）
2. **页面卡片**：每页一张，卡片内用虚线分成「页面间」与「页面内」两区

```html
<div class="card">
  <div class="hd"><span class="nm">首页 · 时间线</span><span class="id">M-01 · 6 屏</span></div>
  <div class="zone inter"><div class="zt">页面间<em>4 进 · 4 出</em></div>
    <div class="row in"><span class="ar">←</span><span class="t">登录</span><span class="a">验证成功</span></div>
    <div class="row"><span class="ar">→</span><span class="t">详情 · 阅读</span><span class="a">点条目</span><span class="k push">push</span></div>
  </div>
  <div class="zone"><div class="zt">页面内<em>5 项</em></div>
    <div class="intra"><i>知识库下拉</i><i>多选态</i>…</div>
  </div>
</div>
```

跳转类型固定四种：`push` 压栈可返回 / `present` 模态关闭回原处 / `overlay` 浮层手势关闭 / `replace` 替换主区域不产生返回栈。

## _shared-design.md

子 agent 开工前必须读到的唯一规范。至少包含：

1. `:root` 变量（逐字复制，不许改值）
2. 字体三级分工（衬线标题 / 无衬线正文 / 等宽元信息）
3. 形状与间距常量
4. 手机外壳骨架（可直接抄）
5. 条目结构（时间轴 + 内容列）
6. 输出路径与文件命名
7. 截图命令
8. 内容纪律：只画真实存在的功能，文案真实，不编造数据

## index.html

总入口三张卡（UI Overview / UX Overview / Design Widget）+ 一张全部页面文档表（模块 / 屏数 / 文档链接 / 内容要点）。
