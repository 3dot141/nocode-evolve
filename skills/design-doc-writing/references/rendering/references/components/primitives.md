# Component: primitives

通用 UI 原子——badge / chip / eyebrow label / kbd / divider。**散布在文档各处**，不属于任何容器型 component。

## 触发

每个 primitive 各自触发——见下表。

| Primitive | markdown 触发 |
|---|---|
| `badge` | 强调短标签（"NEW" / "BREAKING" / "v2.0"） |
| `chip` | 分类 tag（type / topic / tech-stack） |
| `eyebrow` | 节前的小标签（"PART 1" / "PHASE 2" / "BACKGROUND"） |
| `kbd` | 键盘按键（`<kbd>Cmd</kbd> + <kbd>K</kbd>` / 「按 Ctrl+C」） |
| `divider` | 章节硬分隔（markdown `---` 也命中） |

## HTML

```html
<!-- badge：强调短标签 -->
<span class="badge badge-new">NEW</span>
<span class="badge badge-breaking">BREAKING</span>
<span class="badge badge-version">v2.0</span>

<!-- chip：分类 tag（中性） -->
<span class="chip">design</span>
<span class="chip">refactor</span>

<!-- eyebrow：节前小标签 -->
<p class="eyebrow">PART 1 · BACKGROUND</p>
<h2>...</h2>

<!-- kbd：键盘按键 -->
按 <kbd>⌘</kbd> + <kbd>K</kbd> 打开命令面板

<!-- divider：硬分隔 -->
<hr class="divider">
<hr class="divider divider-strong">  <!-- 章节级 -->
```

## CSS Cheatsheet

```css
/* badge：强调，带语义色 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font: 600 10px/1.4 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  vertical-align: middle;
}
.badge-new {
  background: var(--accent);
  color: var(--bg);
}
.badge-breaking {
  background: var(--status-danger-text, #dc2626);
  color: var(--bg);
}
.badge-version {
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

/* chip：分类 tag，中性配色 */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 9999px;
  font: 500 12px/1.4 var(--font-sans);
}

/* eyebrow：节前小标签（uppercase mono） */
.eyebrow {
  margin: 0 0 8px;
  font: 600 11px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-tertiary);
}

/* kbd：键盘按键 */
kbd {
  display: inline-flex;
  align-items: center;
  min-width: 1.5em;
  height: 1.5em;
  padding: 0 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-bottom-width: 2px;
  border-radius: 4px;
  font: 500 0.85em/1 var(--font-mono);
  vertical-align: middle;
}

/* divider：分隔线 */
.divider {
  margin: 32px 0;
  height: 1px;
  background: var(--border-subtle);
  border: 0;
}
.divider-strong {
  margin: 48px 0;
  height: 1px;
  background: var(--border-std, var(--border-subtle));
}
```

## 用到的 CSS variables

`--accent`, `--bg`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--border-std`, `--font-sans`, `--font-mono`

可选：`--status-danger-text`（preset 没提供时 hard hex `#dc2626`）

## 配合

- `badge-new` / `badge-breaking` 通常贴在 H2/H3 后面：`<h2>新 API <span class="badge badge-new">NEW</span></h2>`
- `chip` 集中出现时（如 frontmatter 的 type 标记），考虑用 `frontmatter-card` 而不是裸 chip
- `eyebrow` 在长文档分 part 时强烈推荐；短文档（< 3 个 H2）不需要
- `kbd` 严格只用于真键盘按键——不要拿来当代码标签（那是 `<code>`）

## 边界

- badge 颜色只 3 档（accent / danger / neutral）—— 不要发明 badge-warning / badge-success 等额外色，会和 callout 撞职责
- `kbd` 用 `&lt;kbd&gt;` 原生标签——不要写 `<span class="kbd">`，浏览器 reader-mode / 复制语义会丢失
- divider 单 markdown 文档建议出现 ≤ 5 次——更多说明文档结构需要拆 H2 而不是堆 hr
