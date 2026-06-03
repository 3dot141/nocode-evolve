# Component: problem-block

问题三件套结构容器（说明 / 方案对比 / 结论），design-doc 「架构.问题拆解」节的核心 visual anchor。

## 触发

markdown 形态命中：

```
#### 问题一：xxx
**说明**：...
**方案对比**：
- 方案 A：...
- 方案 B：...
**结论**：...
```

每个 `#### 问题 N：xxx` 都包成一个 `<section class="problem-block">`。

## HTML

```html
<section class="problem-block">
  <h4 class="problem-title">
    <span class="problem-num">Q1</span>
    <span class="problem-name">问题标题</span>
  </h4>
  <div class="three-piece three-piece-explain">
    <span class="three-piece-label">说明</span>
    <p>问题背景与上下文……</p>
  </div>
  <div class="three-piece three-piece-options">
    <span class="three-piece-label">方案对比</span>
    <ul>
      <li><strong>方案 A</strong>：……</li>
      <li><strong>方案 B</strong>：……</li>
    </ul>
  </div>
  <div class="three-piece three-piece-conclusion">
    <span class="three-piece-label">结论</span>
    <p>采用方案 A，理由是……</p>
  </div>
</section>
```

## CSS Cheatsheet

```css
.problem-block {
  margin: 32px 0;
  padding: 20px 24px;
  background: var(--bg-surface);
  border-left: 4px solid var(--accent);
  border-radius: 6px;
  box-shadow: var(--shadow-ring);
}

.problem-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 16px;
  font: 600 20px/1.3 var(--font-sans);
  color: var(--text-primary);
}

.problem-num {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 4px;
  font: 600 13px/1 var(--font-mono);
  letter-spacing: 0.04em;
}

.problem-name { flex: 1; }

.three-piece {
  margin: 16px 0;
  padding: 12px 16px;
  border-radius: 4px;
}

.three-piece-label {
  display: inline-block;
  margin-bottom: 8px;
  font: 600 11px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.three-piece > p,
.three-piece > ul,
.three-piece > ol { margin: 0; }

.three-piece-explain { background: transparent; }
.three-piece-options { background: var(--bg-panel, var(--bg)); }
.three-piece-conclusion {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-left: 3px solid var(--accent);
}
```

## 用到的 CSS variables

`--bg`, `--bg-surface`, `--bg-panel`, `--accent`, `--text-primary`, `--text-tertiary`, `--shadow-ring`, `--font-sans`, `--font-mono`

> 注：`color-mix()` 现代浏览器（Safari 16.4+ / Chrome 111+ / Firefox 113+）均支持。preset 文档场景下浏览器都够新。

## 配合

- 通常和 `logic-block` 配对出现（先 problem 后 logic）
- 内嵌 `<pre>`：业务流的伪代码用 `pseudocode-block`；其他代码直接 `<pre>` 不包
- 多个连续 problem-block 之间用 32px margin 自然分隔；不需要额外 divider

## 边界

- 只有「说明 / 方案对比 / 结论」三段时用本 component。如果 markdown 还有「关键论据」「依赖前提」等额外段，**按顺序**加 `.three-piece .three-piece-<段名>` 即可，无需新 class
- 单个方案不写「方案对比」时，省略 `three-piece-options` 块，保留「说明」「结论」即可
