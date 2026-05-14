# Component: pseudocode-block

伪代码块——顶部带 `PSEUDOCODE` label 的特殊 `<pre>`，强调「这是设计层伪代码、不是 production code」。

## 触发

markdown 形态命中：

- `logic-block` 的 `**业务流**` 子节下方第一个 `<pre>` 块
- 任意标注「伪代码 / pseudocode / design-flow」上下文的代码块
- 看起来用自然语言混着语法描述流程（含中文动词 / 中英混排 / 无 import 头）

## HTML

```html
<figure class="pseudocode-figure">
  <span class="pseudocode-label">PSEUDOCODE</span>
  <pre class="pseudocode"><code>function handleX(input):
    if check(input):
      → 分支 A
    else:
      → 分支 B
    return result</code></pre>
</figure>
```

> 也接受没外层 `<figure>` 的 minimal 形态：`<pre class="pseudocode">` 单独使用，但 label 就失去位置——**推荐保留 `<figure>` 包裹**。

## CSS Cheatsheet

```css
.pseudocode-figure {
  position: relative;
  margin: 16px 0;
}

.pseudocode-label {
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
  z-index: 1;
}

.pseudocode {
  margin: 0;
  padding: 20px 24px 16px;
  background: var(--code-bg);
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  font: 400 14px/1.7 var(--font-mono);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.pseudocode code {
  /* 取消 inline code 的 box-shadow / bg，落到 pre 容器层 */
  background: transparent;
  box-shadow: none;
  padding: 0;
  font: inherit;
  color: inherit;
}
```

## 用到的 CSS variables

`--accent`, `--bg`, `--code-bg`, `--text-primary`, `--font-mono`

## 配合

- 通常嵌在 `logic-block .logic-piece-flow` 内
- 不要和 `highlight.js` 一起用——pseudocode 不需要语言 token 着色（也没真正的语言）
- 业务流多步时，**单个** pseudocode-block 包整段；不要每行一个 block

## 边界

- 真代码（production-quality TS/Python/Go）**不用** pseudocode-block——用普通 `<pre><code class="language-xxx">` 走 highlight.js
- 中英混排自然语言流程图（"if 用户登录 then 跳首页 else 显示登录"）属于 pseudocode 场景
- pseudocode-block 不挂 highlight.js 是有意的——视觉上一眼区分"设计层"和"实现层"
