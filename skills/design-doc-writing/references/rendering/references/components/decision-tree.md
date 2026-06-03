# Component: decision-tree

决策树——if-else / 多分支选择路径的视觉化。**首选 Mermaid `graph TD`**；inline SVG 作 fallback。

## 触发

markdown 形态命中：

- 文字描述含 "if X 则 / else 则 / 满足条件则" 多分支结构
- 列表里反复出现 "→" / "↓" / "yes/no" 的判断
- 「方案对比」结论是有条件的（"如果 A 则用方案 1，否则用方案 2"）

## HTML（首选：Mermaid）

```html
<figure class="decision-tree">
  <span class="figure-label">DECISION TREE</span>
  <pre class="mermaid">
graph TD
    Start([开始：用户提交请求])
    Q1{Q1: 是否登录?}
    Q2{Q2: 数据量 &gt; 1MB?}
    A[走 sync 路径]
    B[走 async 队列]
    C[拒绝 + 引导登录]

    Start --&gt; Q1
    Q1 --&gt;|是| Q2
    Q1 --&gt;|否| C
    Q2 --&gt;|否| A
    Q2 --&gt;|是| B

    classDef terminal fill:var(--accent),stroke:var(--accent),color:var(--bg);
    classDef decision fill:var(--bg-surface),stroke:var(--text-primary),color:var(--text-primary);
    class A,B,C terminal;
    class Q1,Q2 decision;
  </pre>
</figure>
```

> Mermaid CDN：`<script type="module" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"></script>` 后调用 `mermaid.initialize({startOnLoad: true, theme: 'base', themeVariables: {...}})` —— 详见 RENDERING.md「推荐 CDN 物料表」。

## HTML（fallback：inline SVG）

**仅当 Mermaid CDN 不可用 / 需精确像素级布局**时使用。骨架：

```html
<figure class="decision-tree">
  <span class="figure-label">DECISION TREE</span>
  <svg class="decision-tree-svg" viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg">
    <g class="dt-decision">       <polygon .../>  <text>...?</text>  </g>  <!-- 菱形决策 -->
    <path class="dt-edge"/>       <text class="dt-edge-label">是/否</text>   <!-- 边 + label -->
    <g class="dt-terminal">       <rect rx="6"/>  <text>...</text>     </g>  <!-- 终节点圆角矩形 -->
  </svg>
</figure>
```

下方 CSS Cheatsheet 同时覆盖 `dt-decision` / `dt-edge` / `dt-terminal` 三类，agent 按 viewBox 布局填坐标即可。

## CSS Cheatsheet

```css
.decision-tree {
  position: relative;
  margin: 24px 0;
  padding: 32px 24px 24px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  max-width: 100%;
}

.figure-label {
  position: absolute;
  top: -8px;
  left: 16px;
  padding: 2px 8px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 3px;
  font: 600 10px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Mermaid 容器宽度自适应 */
.decision-tree .mermaid {
  display: flex;
  justify-content: center;
  background: transparent;
  padding: 0;
  border: 0;
}

/* SVG fallback 样式 */
.decision-tree-svg {
  width: 100%;
  height: auto;
  max-height: 400px;
}

.dt-decision polygon {
  fill: var(--bg-surface);
  stroke: var(--text-primary);
  stroke-width: 1.5;
}
.dt-decision text {
  fill: var(--text-primary);
  font: 600 13px/1 var(--font-sans);
}

.dt-terminal rect {
  fill: var(--accent);
  stroke: var(--accent);
}
.dt-terminal text {
  fill: var(--bg);
  font: 500 13px/1 var(--font-sans);
}

.dt-edge {
  stroke: var(--text-secondary);
  stroke-width: 1.5;
  fill: none;
}

.dt-edge-label {
  fill: var(--text-tertiary);
  font: 500 11px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

## 用到的 CSS variables

`--accent`, `--bg`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--font-sans`, `--font-mono`

## 配合

- 与 `problem-block` 的「方案对比」节配套——文字描述放 problem-block，视觉用 decision-tree
- Mermaid 主题用 `theme: 'base' + themeVariables: {...}` 把 hex 换成 CSS variable 引用，自动跟 light/dark token

## 边界

- 决策节点 ≤ 4 层；超过的话考虑拆 2 个 decision-tree 或用 `state-machine`
- 单层分支 ≤ 4 路；> 4 路视觉混乱，改用 `failure-table` 或文字 + 列表
- 不要画"装饰性 decision tree"——每个分支都要在文档正文里有对应决策出处
