# Component: hero-svg

顶部数据流 SVG hero——首屏 visual anchor，让读者一眼 grasp 文档全局。

## 触发

每份 design-doc **强烈推荐**有 hero（SKILL.md 行 394-401 "至少 3-5 个视觉元素"硬约束）。本 component 总是触发——除非文档明确是 ADR 短决策（< 500 字 + < 3 个 H2）。

## HTML

```html
<figure class="hero" aria-label="系统数据流">
  <header class="hero-eyebrow">
    <span class="hero-eyebrow-tag">DATA FLOW</span>
    <span class="hero-eyebrow-text">输入 → 处理 → 输出 一句话主题</span>
  </header>

  <svg class="hero-svg" viewBox="0 0 800 240" xmlns="http://www.w3.org/2000/svg" role="img">
    <!-- 节点 1 -->
    <g class="hero-node" transform="translate(40, 80)">
      <rect width="140" height="80" rx="8" />
      <text x="70" y="36" text-anchor="middle">LLM Stream</text>
      <text x="70" y="56" text-anchor="middle" class="hero-node-sub">输入</text>
    </g>

    <!-- 箭头 1 -->
    <path class="hero-arrow" d="M180 120 L240 120" />
    <polygon class="hero-arrow-head" points="240,120 232,116 232,124" />

    <!-- 节点 2（带关键决策点高亮） -->
    <g class="hero-node hero-node-highlight" transform="translate(240, 80)">
      <rect width="160" height="80" rx="8" />
      <text x="80" y="36" text-anchor="middle">Sanitizer</text>
      <text x="80" y="56" text-anchor="middle" class="hero-node-sub">Q2 在此</text>
    </g>

    <!-- 箭头 2 -->
    <path class="hero-arrow" d="M400 120 L460 120" />
    <polygon class="hero-arrow-head" points="460,120 452,116 452,124" />

    <!-- 节点 3 -->
    <g class="hero-node" transform="translate(460, 80)">
      <rect width="140" height="80" rx="8" />
      <text x="70" y="36" text-anchor="middle">SSE 推送</text>
      <text x="70" y="56" text-anchor="middle" class="hero-node-sub">输出</text>
    </g>

    <!-- 箭头 3 -->
    <path class="hero-arrow" d="M600 120 L660 120" />
    <polygon class="hero-arrow-head" points="660,120 652,116 652,124" />

    <!-- 终节点 -->
    <g class="hero-node hero-node-terminal" transform="translate(660, 80)">
      <rect width="100" height="80" rx="8" />
      <text x="50" y="46" text-anchor="middle">前端</text>
    </g>
  </svg>
</figure>
```

## CSS Cheatsheet

```css
.hero {
  margin: 0 0 40px;
  padding: 24px 28px 32px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  max-width: 100%;  /* break-out 撑满 main */
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.hero-eyebrow-tag {
  padding: 3px 8px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 3px;
  font: 600 10px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hero-eyebrow-text {
  font: 500 13px/1.4 var(--font-sans);
  color: var(--text-secondary);
}

.hero-svg {
  width: 100%;
  height: auto;
  aspect-ratio: 800 / 240;  /* 3.33:1 横向 */
  max-height: 320px;
}

.hero-node rect {
  fill: var(--bg);
  stroke: var(--border-strong, var(--text-primary));
  stroke-width: 1.5;
}

.hero-node text {
  fill: var(--text-primary);
  font: 600 14px/1 var(--font-sans);
}

.hero-node-sub {
  fill: var(--text-tertiary) !important;
  font-size: 11px !important;
  font-weight: 400 !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* 关键决策点高亮（dashed accent border） */
.hero-node-highlight rect {
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}

/* 终节点（accent fill） */
.hero-node-terminal rect {
  fill: var(--accent);
  stroke: var(--accent);
}
.hero-node-terminal text {
  fill: var(--bg);
}

.hero-arrow {
  stroke: var(--text-secondary);
  stroke-width: 1.5;
  fill: none;
}

.hero-arrow-head {
  fill: var(--text-secondary);
}
```

## 用到的 CSS variables

`--bg`, `--bg-surface`, `--accent`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--border-strong`, `--font-sans`, `--font-mono`

## 配合

- **位置**：H1 文档标题之后、`frontmatter-card` 之后、第一个 H2 之前
- **不和 mermaid 混用做 hero**——hero 是手画 SVG 的标准场景（mermaid 横向 hero 控制力不够）
- 内部「关键决策点」对应文档里 `problem-block` 的 `Q1/Q2/Q3` 标号——hero 节点子标题写 `Q2 在此` 让读者跳转有据

## 边界

- 文档 < 500 字 / 单决策 ADR / 纯文字 thinking piece —— **可以省略 hero**，但要在文档中段补 ≥ 1 个 SVG 或 mermaid 图
- viewBox 默认 `800x240` (3.33:1)；横向元素 ≤ 5 个时合适；> 5 个考虑换成 `1000x300` 或拆 2 排
- 节点文字 ≤ 8 字符；长描述写 H1/H2 章节正文，不堆 hero 节点
