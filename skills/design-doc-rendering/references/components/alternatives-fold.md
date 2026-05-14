# Component: alternatives-fold

「Alternatives Considered」折叠容器——默认隐藏的备选方案，点击展开。让主线决策清爽、备选有迹可查。

## 触发

markdown 形态命中：

- H2 / H3 标题含「Alternatives Considered」「备选方案」「考虑过的方案」「Rejected approaches」
- ADR 模板里固定有的「Considered Options」节
- 标记 "已 rejected / 已 deferred / 未采用" 的方案列表

## HTML

```html
<details class="alt-fold">
  <summary class="alt-fold-summary">
    <span class="alt-fold-icon">▸</span>
    <span class="alt-fold-label">ALTERNATIVES</span>
    <span class="alt-fold-title">考虑过但未采用的方案 (3)</span>
  </summary>
  <div class="alt-fold-body">
    <article class="alt-item">
      <h5 class="alt-item-title">
        <span class="alt-item-tag">REJECTED</span>
        全量重写
      </h5>
      <p><strong>方案</strong>：放弃现有代码，从零重写。</p>
      <p><strong>为什么不选</strong>：估时 4 个月，期间业务停摆 ROI 倒挂。</p>
    </article>

    <article class="alt-item">
      <h5 class="alt-item-title">
        <span class="alt-item-tag">DEFERRED</span>
        引入 Kafka
      </h5>
      <p><strong>方案</strong>：用 Kafka 做事件中枢。</p>
      <p><strong>为什么暂缓</strong>：当前流量 &lt; 1k tps，引入 Kafka 复杂度溢出；预留到 Phase 3。</p>
    </article>

    <article class="alt-item">
      <h5 class="alt-item-title">
        <span class="alt-item-tag">REJECTED</span>
        SaaS 方案
      </h5>
      <p><strong>方案</strong>：买现成 SaaS。</p>
      <p><strong>为什么不选</strong>：合规要求数据不出域。</p>
    </article>
  </div>
</details>
```

## CSS Cheatsheet

```css
.alt-fold {
  margin: 24px 0;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.alt-fold-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  cursor: pointer;
  user-select: none;
  list-style: none;
  transition: background-color 150ms ease;
}

.alt-fold-summary::-webkit-details-marker { display: none; }
.alt-fold-summary:hover { background: var(--bg-hover, var(--bg-surface)); }

.alt-fold-icon {
  display: inline-block;
  font: 400 12px/1 var(--font-mono);
  color: var(--text-tertiary);
  transition: transform 180ms ease;
}

.alt-fold[open] .alt-fold-icon {
  transform: rotate(90deg);
}

.alt-fold-label {
  padding: 2px 8px;
  background: var(--accent);
  color: var(--bg);
  border-radius: 3px;
  font: 600 10px/1.4 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.alt-fold-title {
  font: 500 14px/1.4 var(--font-sans);
  color: var(--text-secondary);
}

.alt-fold-body {
  padding: 0 18px 18px;
  border-top: 1px solid var(--border-subtle);
}

.alt-item {
  margin: 16px 0;
  padding: 14px 16px;
  background: var(--bg);
  border-left: 3px solid var(--border-strong, var(--text-tertiary));
  border-radius: 0 4px 4px 0;
}

.alt-item-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font: 600 14px/1.4 var(--font-sans);
  color: var(--text-primary);
}

.alt-item-tag {
  padding: 1px 7px;
  border-radius: 3px;
  font: 600 9px/1.4 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* REJECTED：红 / DEFERRED：amber */
.alt-item:has(.alt-item-tag:is(:contains("REJECTED"))) .alt-item-tag {
  background: color-mix(in srgb, var(--status-danger-text, #dc2626) 14%, transparent);
  color: var(--status-danger-text, #dc2626);
}

/* 浏览器 :contains 支持有限，可用 attribute selector 兜底 */
.alt-item-tag {
  background: var(--bg-surface);
  color: var(--text-tertiary);
}
.alt-item .alt-item-tag[data-status="rejected"] {
  background: color-mix(in srgb, var(--status-danger-text, #dc2626) 14%, transparent);
  color: var(--status-danger-text, #dc2626);
}
.alt-item .alt-item-tag[data-status="deferred"] {
  background: color-mix(in srgb, var(--status-warn-text, #d97706) 14%, transparent);
  color: var(--status-warn-text, #d97706);
}

.alt-item > p { margin: 4px 0; font-size: 14px; line-height: 1.55; }
```

> 推荐用 `<span class="alt-item-tag" data-status="rejected">REJECTED</span>` —— attribute selector 比 `:contains` 兼容性好。

## 用到的 CSS variables

`--accent`, `--bg`, `--bg-surface`, `--bg-hover`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--border-strong`, `--font-sans`, `--font-mono`

可选：`--status-danger-text`, `--status-warn-text`

## 配合

- **位置**：放在文档**结尾**或具体决策章节末尾——主决策叙述完后再露 alternatives
- 和 `problem-block` 不重复——problem-block 是"为何选 A"，alternatives-fold 是"为何不选 B/C/D"
- ADR 文档里 alternatives 是核心节，不应该折叠——用 `split-compare` 平展更合适

## 边界

- 备选 ≤ 5 个；超过说明决策没真正收敛
- 每个 alt-item 描述 ≤ 80 字；详细论证写到正文，alt-item 只放"方案 + 为什么不选"两点
- 默认折叠是有意的——读者关心的是"选了什么"，"没选什么"放二线
