# Component: callout

4 色横条强调块——info / warning / danger / success。比 `<blockquote>` 更强、比专门画卡片更轻。

## 触发

markdown 形态命中（agent 主动识别语义触发，不依赖特殊语法）：

| 段首词 / 语义 | callout 类型 |
|---|---|
| `> ℹ️`、`> 💡`、`> 注意：`、`> Note:`、`> 说明：` | info |
| `> ⚠️`、`> 警告：`、`> Warning:`、`> 注意（强）：` | warning |
| `> ❌`、`> 🚫`、`> 风险：`、`> Danger:`、`> 不要：` | danger |
| `> ✅`、`> 推荐：`、`> Best practice:`、`> 已验证：` | success |

markdown 用 `<aside>` / `:::note` / 嵌套 `<blockquote>` 标记的也命中——agent 灵活识别。

## HTML

```html
<div class="callout callout-info">
  <span class="callout-icon" aria-hidden="true">ℹ</span>
  <div class="callout-body">
    <p class="callout-title">说明</p>
    <p>这里是 info 内容……</p>
  </div>
</div>

<div class="callout callout-warning">
  <span class="callout-icon" aria-hidden="true">⚠</span>
  <div class="callout-body">
    <p>warning 单段时可省略 title</p>
  </div>
</div>
```

## CSS Cheatsheet

```css
.callout {
  display: flex;
  gap: 12px;
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid;
  border-radius: 4px;
  background: var(--bg-surface);
}

.callout-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  font-size: 16px;
  line-height: 1.25;
  text-align: center;
}

.callout-body { flex: 1; min-width: 0; }
.callout-body > p:last-child { margin-bottom: 0; }
.callout-body > p:first-child { margin-top: 0; }

.callout-title {
  margin: 0 0 4px;
  font: 600 13px/1.4 var(--font-sans);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* 4 档语义色 */
.callout-info {
  border-left-color: var(--accent);
  background: var(--status-info-bg, color-mix(in srgb, var(--accent) 8%, transparent));
}
.callout-info .callout-title { color: var(--status-info-text, var(--accent)); }

.callout-warning {
  border-left-color: var(--status-warn-text, #d97706);
  background: var(--status-warn-bg, color-mix(in srgb, #d97706 10%, transparent));
}
.callout-warning .callout-title { color: var(--status-warn-text, #d97706); }

.callout-danger {
  border-left-color: var(--status-danger-text, #dc2626);
  background: var(--status-danger-bg, color-mix(in srgb, #dc2626 10%, transparent));
}
.callout-danger .callout-title { color: var(--status-danger-text, #dc2626); }

.callout-success {
  border-left-color: var(--status-success-text, #16a34a);
  background: var(--status-success-bg, color-mix(in srgb, #16a34a 10%, transparent));
}
.callout-success .callout-title { color: var(--status-success-text, #16a34a); }
```

## 用到的 CSS variables

`--accent`, `--bg-surface`, `--font-sans`，可选 `--status-{info|warn|danger|success}-{bg|text}`

> preset 没提供 status-* 时，fallback 用 hard hex（`#d97706` 琥珀 / `#dc2626` 红 / `#16a34a` 绿）——这些是业界共识 amber/red/green，不撞 brand。

## 配合

- 不要嵌套 callout（套娃没价值）
- callout 内可以有列表 / 行内 code / 强调；不要再加块级 `<pre>`——用 SKILL 行外的代码块即可
- 多个 callout 连出现时考虑改用 `failure-table`（如果是按场景列警告）

## 边界

- 单段超短（"⚠ 注意：X"）—— 可省略 `<p class="callout-title">`，HTML 只留 `.callout-body > p`
- 长内容（>3 段）—— 考虑是否该升级为 `problem-block` 或独立小节
- 不要把 callout 当装饰用——每个都要有真实语义信息
