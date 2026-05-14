# Component: failure-table

失败模式表——`logic-block` 的「异常与失败模式」标准结构，按严重度（上抛 / 吞）color-coded 行。

## 触发

markdown 形态命中：

```
| 场景 | 触发 | 处理 | 上抛吞 |
|---|---|---|---|
| 网络断开 | timeout 30s | retry 3 次 | 上抛 |
| 用户取消 | abort signal | 静默退出 | 吞 |
| 数据校验失败 | 字段缺失 | 默认值兜底 | 吞 |
```

四列表头是 design-doc 约定（场景 / 触发 / 处理 / 上抛吞）。**第 4 列「上抛吞」决定行 color**。

## HTML

```html
<table class="failure-table">
  <thead>
    <tr>
      <th>场景</th>
      <th>触发</th>
      <th>处理</th>
      <th class="failure-disposition">上抛 / 吞</th>
    </tr>
  </thead>
  <tbody>
    <tr class="failure-row failure-row-上抛">
      <td>网络断开</td>
      <td><code>timeout 30s</code></td>
      <td>retry 3 次后给用户提示</td>
      <td><span class="failure-tag failure-tag-上抛">上抛</span></td>
    </tr>
    <tr class="failure-row failure-row-吞">
      <td>用户取消</td>
      <td><code>abort signal</code></td>
      <td>静默退出</td>
      <td><span class="failure-tag failure-tag-吞">吞</span></td>
    </tr>
    <tr class="failure-row failure-row-降级">
      <td>数据校验失败</td>
      <td>字段缺失</td>
      <td>默认值兜底</td>
      <td><span class="failure-tag failure-tag-降级">降级</span></td>
    </tr>
  </tbody>
</table>
```

> 「降级」是「上抛 / 吞」之外的第三档——用户感知有差但不阻塞主流程。

## CSS Cheatsheet

```css
.failure-table {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  overflow: hidden;
  font: 400 14px/1.5 var(--font-sans);
}

.failure-table th,
.failure-table td {
  padding: 10px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border-subtle);
}

.failure-table th {
  background: var(--bg-surface);
  color: var(--text-secondary);
  font: 600 11px/1.4 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.failure-table tbody tr:last-child td { border-bottom: 0; }

/* 按严重度 left border 着色 */
.failure-row-上抛 { box-shadow: inset 4px 0 0 var(--status-danger-text, #dc2626); }
.failure-row-降级 { box-shadow: inset 4px 0 0 var(--status-warn-text, #d97706); }
.failure-row-吞   { box-shadow: inset 4px 0 0 var(--text-tertiary); }

.failure-row-上抛 > td:first-child { padding-left: 18px; }
.failure-row-降级 > td:first-child { padding-left: 18px; }
.failure-row-吞   > td:first-child { padding-left: 18px; }

/* Disposition tag */
.failure-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font: 600 11px/1.2 var(--font-mono);
  letter-spacing: 0.04em;
}
.failure-tag-上抛 {
  background: color-mix(in srgb, var(--status-danger-text, #dc2626) 14%, transparent);
  color: var(--status-danger-text, #dc2626);
}
.failure-tag-降级 {
  background: color-mix(in srgb, var(--status-warn-text, #d97706) 14%, transparent);
  color: var(--status-warn-text, #d97706);
}
.failure-tag-吞 {
  background: var(--bg-surface);
  color: var(--text-tertiary);
}
```

## 用到的 CSS variables

`--bg-surface`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--font-sans`, `--font-mono`

可选：`--status-danger-text`, `--status-warn-text`（缺则 fallback hex）

## 配合

- **常嵌入** `logic-block .logic-piece-failure` 内
- 不要单独使用本表——它是 design-doc 异常文档结构的物化，脱离 logic-block 上下文意义减半

## 边界

- 表头如果不是「场景 / 触发 / 处理 / 上抛吞」四列，**降级为普通 `<table>`**，不要硬套 failure-table 结构
- 单表行数 > 12 时考虑拆分 logic-block 或加 `<details>` 折叠（异常表过长往往说明 logic 太复杂）
- 「上抛吞」列允许 4 个值：`上抛` / `降级` / `吞` / 自定义文本——自定义文本时不上色（保留 neutral）
