# Component: frontmatter-card

顶部 metadata 卡——把 markdown frontmatter（type / date / status / author / topic）渲染成 H1 下方的元数据条。

## 触发

每份 design-doc 都有 frontmatter；本 component **总是触发**——是必有元素，不是按需。

markdown 形态（YAML frontmatter）：

```yaml
---
type: design
topic: rules-injection
date: 260514
author: Harrison
status: draft  # draft | in-review | approved | archived
---
```

## HTML

```html
<aside class="frontmatter-card">
  <dl class="frontmatter-grid">
    <div class="frontmatter-item">
      <dt class="frontmatter-key">Type</dt>
      <dd class="frontmatter-val"><span class="chip">design</span></dd>
    </div>
    <div class="frontmatter-item">
      <dt class="frontmatter-key">Topic</dt>
      <dd class="frontmatter-val">rules-injection</dd>
    </div>
    <div class="frontmatter-item">
      <dt class="frontmatter-key">Date</dt>
      <dd class="frontmatter-val"><time>260514</time></dd>
    </div>
    <div class="frontmatter-item">
      <dt class="frontmatter-key">Author</dt>
      <dd class="frontmatter-val">Harrison</dd>
    </div>
    <div class="frontmatter-item">
      <dt class="frontmatter-key">Status</dt>
      <dd class="frontmatter-val"><span class="status-badge status-draft">DRAFT</span></dd>
    </div>
  </dl>
</aside>
```

## CSS Cheatsheet

```css
.frontmatter-card {
  margin: 0 0 32px;
  padding: 16px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
}

.frontmatter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px 24px;
  margin: 0;
}

.frontmatter-item { margin: 0; }

.frontmatter-key {
  margin: 0 0 4px;
  font: 600 10px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
}

.frontmatter-val {
  margin: 0;
  font: 500 14px/1.4 var(--font-sans);
  color: var(--text-primary);
}

/* Status badge：4 档颜色 */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;
  font: 600 11px/1.2 var(--font-mono);
  letter-spacing: 0.08em;
}

.status-draft {
  background: var(--bg-hover, var(--bg-surface));
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.status-in-review {
  background: var(--status-info-bg, color-mix(in srgb, var(--accent) 12%, transparent));
  color: var(--status-info-text, var(--accent));
}

.status-approved {
  background: var(--status-success-bg, color-mix(in srgb, #16a34a 14%, transparent));
  color: var(--status-success-text, #16a34a);
}

.status-archived {
  background: transparent;
  color: var(--text-tertiary);
  border: 1px dashed var(--border-subtle);
}
```

## 用到的 CSS variables

`--bg-surface`, `--bg-hover`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--font-sans`, `--font-mono`

可选：`--status-info-bg/text`, `--status-success-bg/text`（preset 没提供时 fallback 用 `color-mix(--accent)` 或硬 hex）

## 配合

- **位置**：在 H1 文档标题**之后**，第一个 H2 / hero-svg **之前**
- **和 hero-svg 协作**：如果文档用了 `hero-svg`，frontmatter-card 在 hero **下方**（hero 占首屏视觉，frontmatter 是元信息）

## 边界

- 字段不全时（如没 author / date）—— 跳过对应 `<div class="frontmatter-item">`，不要留空
- status 字段不在 4 档预设里时——用 `status-draft` fallback 样式
- frontmatter 字段超过 5 个（极少见）——`auto-fit` 自动换行；不要手动 break
