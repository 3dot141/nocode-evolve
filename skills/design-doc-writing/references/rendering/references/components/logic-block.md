# Component: logic-block

逻辑三子节结构容器（业务流 / 关键契约 / 异常与失败模式），design-doc 「实现.逻辑 X」节的标准容器。

## 触发

markdown 形态命中：

```
### 逻辑一：xxx
**业务流**
<伪代码 pre 块>
**关键契约**
- 方法签名 / 字段 ...
**异常与失败模式**
| 场景 | 触发 | 处理 | 上抛吞 |
```

每个 `### 逻辑 N：xxx` 包一个 `<section class="logic-block">`。

## HTML

```html
<section class="logic-block">
  <h3 class="logic-title">
    <span class="logic-num">L1</span>
    <span class="logic-name">逻辑标题</span>
  </h3>

  <div class="logic-piece logic-piece-flow">
    <span class="logic-piece-label">业务流</span>
    <!-- 嵌入 pseudocode-block component -->
    <pre class="pseudocode"><code>...</code></pre>
  </div>

  <div class="logic-piece logic-piece-contract">
    <span class="logic-piece-label">关键契约</span>
    <ul>
      <li><code>method(arg)</code> — 描述</li>
    </ul>
  </div>

  <div class="logic-piece logic-piece-failure">
    <span class="logic-piece-label">异常与失败模式</span>
    <!-- 嵌入 failure-table component -->
    <table class="failure-table">...</table>
  </div>
</section>
```

## CSS Cheatsheet

```css
.logic-block {
  margin: 40px 0;
  padding: 24px 28px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}

.logic-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
  font: 600 22px/1.3 var(--font-sans);
  color: var(--text-primary);
}

.logic-num {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border-radius: 4px;
  font: 600 13px/1 var(--font-mono);
  letter-spacing: 0.04em;
}

.logic-piece {
  margin: 20px 0;
}

.logic-piece-label {
  display: inline-block;
  margin-bottom: 8px;
  font: 600 11px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.logic-piece > ul,
.logic-piece > p { margin: 0; }

/* 业务流的 pseudocode 看 pseudocode-block.md */
/* 异常表的 failure-table 看 failure-table.md */
```

## 用到的 CSS variables

`--bg`, `--accent`, `--text-primary`, `--text-tertiary`, `--border-subtle`, `--font-sans`, `--font-mono`

## 配合

- **依赖**：通常嵌套 `pseudocode-block`（业务流）+ `failure-table`（异常表）。**先 Read 这两个 component md** 拿子结构 CSS
- **位置**：在 `problem-block` 之后出现——问题先讲清，再讲落地逻辑
- **重复**：多个 `logic-block` 之间用 40px margin 自然分隔

## 边界

- 业务流可以不是 pseudocode，纯文字描述也接受——但 `<pre class="pseudocode">` 的视觉锚点强烈推荐
- 关键契约 / 异常表至少要有一个；都没有的话用 `problem-block` 更合适，不要用 `logic-block`
- `<h3>` 已被 preset 全局样式覆盖；`.logic-title` 在其上叠加 flex 布局 + badge——是 enhance 不是 override
