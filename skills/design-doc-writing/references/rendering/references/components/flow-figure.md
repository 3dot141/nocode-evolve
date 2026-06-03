# Component: flow-figure

流程图——SVG / Mermaid 主视觉 + `<details>` 包裹的原始 ASCII fallback。**markdown 含 ASCII 流程图时必触发**。

## 触发

markdown 形态命中：

- 含 ASCII 流程图（多行 `节点 ↓ 节点` / `A --> B`）
- 「架构.流程图」节（SKILL.md 行 398 标记的必有视觉）
- 用户在 markdown 里手画了 box 字符（`┌─┐ │ │ └─┘`）

## HTML

```html
<figure class="flow-figure">
  <span class="figure-label">FLOW</span>

  <!-- 主视觉：Mermaid 或 inline SVG -->
  <pre class="mermaid">
graph LR
    User[用户输入] --&gt; LLM[LLM 流式]
    LLM --&gt; Sanitizer[Sanitizer 滤毒]
    Sanitizer --&gt; SSE[SSE 推送]
    SSE --&gt; UI[前端渲染]

    classDef node fill:var(--bg-surface),stroke:var(--text-primary),color:var(--text-primary);
    class User,LLM,Sanitizer,SSE,UI node;
  </pre>

  <!-- ASCII fallback（默认折叠） -->
  <details class="flow-ascii">
    <summary>原始 ASCII 流程图</summary>
    <pre><code>用户输入
   ↓
LLM 流式生成
   ↓
Sanitizer 滤毒
   ↓
SSE 推送
   ↓
前端渲染</code></pre>
  </details>
</figure>
```

## CSS Cheatsheet

```css
.flow-figure {
  position: relative;
  margin: 24px 0;
  padding: 32px 24px 20px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  max-width: 100%;
}

.flow-figure .mermaid {
  display: flex;
  justify-content: center;
  margin: 0 0 16px;
  background: transparent;
  border: 0;
  padding: 0;
}

.flow-ascii {
  margin-top: 12px;
  border-top: 1px dashed var(--border-subtle);
  padding-top: 12px;
}

.flow-ascii summary {
  cursor: pointer;
  padding: 4px 0;
  font: 500 12px/1.4 var(--font-mono);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  list-style: none;
}

.flow-ascii summary::before {
  content: "▸ ";
  display: inline-block;
  transition: transform 180ms ease;
}

.flow-ascii[open] summary::before {
  transform: rotate(90deg);
}

.flow-ascii pre {
  margin: 8px 0 0;
  padding: 12px 16px;
  background: var(--code-bg);
  border-radius: 4px;
  font: 400 12px/1.5 var(--font-mono);
  color: var(--text-secondary);
  white-space: pre;
  overflow-x: auto;
}
```

## 用到的 CSS variables

`--bg`, `--bg-surface`, `--code-bg`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--font-mono`

## 配合

- **markdown 给了 ASCII 流程图必触发**——SVG 主视觉 + ASCII fallback 两形态并存（SKILL.md 行 405-419 已经约定）
- 单纯文字描述流程（没 ASCII）时——直接用 `decision-tree` 或 `state-machine`，不要硬套 flow-figure
- Mermaid 失败时 ASCII 是 fallback 兜底——保留 ASCII 不删

## 边界

- ASCII 节点 ≤ 8 个；超过用 mermaid 主视觉 + 不保留 ASCII（太长读不下去）
- 横向流程用 `graph LR`，纵向用 `graph TD`——按 markdown 原 ASCII 方向选
- 不要把决策树（含菱形 / yes/no）塞进 flow-figure——那是 `decision-tree` 的事
