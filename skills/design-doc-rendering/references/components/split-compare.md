# Component: split-compare

左右栏对比卡——「方案 A vs 方案 B」结构化对比。带推荐 badge。

## 触发

markdown 形态命中：

- 「方案 A vs 方案 B」/「approach 1 / approach 2」字面表达
- `problem-block .three-piece-options` 内列了 ≥2 个方案
- 「优缺点对比」「迁移前后」「old vs new」结构

## HTML

```html
<div class="split-compare">
  <article class="split-pane split-pane-a">
    <header class="split-head">
      <span class="split-eyebrow">方案 A</span>
      <h4 class="split-title">单库直连</h4>
    </header>
    <div class="split-body">
      <p>把所有服务直连同一个 PG。</p>
      <ul class="split-pros">
        <li>实现快、SQL 直观</li>
        <li>事务一致性强</li>
      </ul>
      <ul class="split-cons">
        <li>单点故障</li>
        <li>团队边界模糊</li>
      </ul>
    </div>
  </article>

  <article class="split-pane split-pane-b split-pane-recommended">
    <header class="split-head">
      <span class="split-eyebrow">方案 B</span>
      <h4 class="split-title">DB per Service</h4>
      <span class="split-badge">RECOMMENDED</span>
    </header>
    <div class="split-body">
      <p>每个服务独立 PG，跨服务通过 API/event 通信。</p>
      <ul class="split-pros">
        <li>边界清晰、独立部署</li>
        <li>故障隔离</li>
      </ul>
      <ul class="split-cons">
        <li>跨域事务需 saga</li>
        <li>初期投入更大</li>
      </ul>
    </div>
  </article>
</div>
```

## CSS Cheatsheet

```css
.split-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 24px 0;
}

@media (max-width: 900px) {
  .split-compare { grid-template-columns: 1fr; }
}

.split-pane {
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  position: relative;
}

.split-pane-recommended {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.split-head {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
}

.split-eyebrow {
  display: inline-block;
  margin-bottom: 4px;
  font: 600 10px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
}

.split-title {
  margin: 0;
  font: 600 18px/1.3 var(--font-sans);
  color: var(--text-primary);
}

.split-badge {
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 8px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 9999px;
  font: 600 10px/1.4 var(--font-mono);
  letter-spacing: 0.08em;
}

.split-body > p { margin: 0 0 12px; }

.split-pros,
.split-cons {
  margin: 8px 0;
  padding-left: 22px;
  font: 400 13px/1.5 var(--font-sans);
}

.split-pros li::marker { content: "✓ "; color: var(--status-success-text, #16a34a); }
.split-cons li::marker { content: "✗ "; color: var(--status-danger-text, #dc2626); }

.split-pros li,
.split-cons li {
  list-style-position: outside;
  padding-left: 4px;
  margin-bottom: 4px;
}
```

## 用到的 CSS variables

`--accent`, `--bg`, `--text-primary`, `--text-tertiary`, `--border-subtle`, `--font-sans`, `--font-mono`

可选：`--status-success-text`, `--status-danger-text`

## 配合

- 比 `problem-block .three-piece-options` 视觉强——后者是 inline 列表，前者是结构化卡
- 推荐 badge 只贴一个 pane；两个都推荐就不需要对比
- 多于 2 方案时改用 `failure-table`-like 的 N 列对比表，不要硬塞 3 列 split

## 边界

- 移动端自动堆叠为单列（`@media max-width: 900px`）—— 不需要额外处理
- pros / cons 各 ≤ 4 条；超过说明粒度太细，应该归并
- 不要在 `split-pane` 里嵌套大组件（`logic-block` / `flow-figure`）——split 是"轻量结构对比"
