# Component: timeline

时间线——阶段步骤 / 迁移路径 / Phase 1/2/3 的视觉化。**横向（默认）/ 纵向**两种 layout。

## 触发

markdown 形态命中：

- 出现「阶段一/二/三」「Phase 1/2/3」「Step 1 → Step 2」
- 「迁移路径」「rollout 计划」「实施步骤」节
- 任何有**严格先后顺序 + 状态（已完成 / 进行中 / 未开始）**的列表

## HTML（横向）

```html
<ol class="timeline timeline-horizontal">
  <li class="timeline-step timeline-step-done">
    <div class="timeline-marker"></div>
    <div class="timeline-body">
      <span class="timeline-eyebrow">Phase 1 · DONE</span>
      <h4 class="timeline-title">收集需求</h4>
      <p class="timeline-desc">和 3 个利益相关方对齐，产出 brainstorming 文档</p>
    </div>
  </li>

  <li class="timeline-step timeline-step-active">
    <div class="timeline-marker"></div>
    <div class="timeline-body">
      <span class="timeline-eyebrow">Phase 2 · NOW</span>
      <h4 class="timeline-title">写设计文档</h4>
      <p class="timeline-desc">含架构 / 实现 / 异常 / 迁移计划</p>
    </div>
  </li>

  <li class="timeline-step">
    <div class="timeline-marker"></div>
    <div class="timeline-body">
      <span class="timeline-eyebrow">Phase 3 · NEXT</span>
      <h4 class="timeline-title">实现 + 灰度</h4>
      <p class="timeline-desc">分 3 批 rollout，每批观察 24h</p>
    </div>
  </li>
</ol>
```

## HTML（纵向，长描述时用）

```html
<ol class="timeline timeline-vertical">
  <li class="timeline-step timeline-step-done">
    <div class="timeline-marker"></div>
    <div class="timeline-body">
      <span class="timeline-eyebrow">DONE · 260301</span>
      <h4 class="timeline-title">阶段一：架构方案敲定</h4>
      <p class="timeline-desc">多段描述...</p>
    </div>
  </li>
  <!-- 更多步骤 -->
</ol>
```

## CSS Cheatsheet

```css
.timeline {
  list-style: none;
  margin: 24px 0;
  padding: 0;
}

/* 横向 */
.timeline-horizontal {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0;
  position: relative;
}

.timeline-horizontal::before {
  content: "";
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--border-subtle);
  z-index: 0;
}

.timeline-horizontal .timeline-step {
  position: relative;
  padding: 0 12px;
  z-index: 1;
}

.timeline-horizontal .timeline-marker {
  width: 12px;
  height: 12px;
  margin: 6px 0 12px;
  border-radius: 50%;
  background: var(--bg);
  border: 2px solid var(--border-subtle);
}

/* 纵向 */
.timeline-vertical {
  position: relative;
  padding-left: 32px;
}

.timeline-vertical::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 6px;
  width: 2px;
  background: var(--border-subtle);
}

.timeline-vertical .timeline-step {
  position: relative;
  margin-bottom: 28px;
}

.timeline-vertical .timeline-marker {
  position: absolute;
  left: -32px;
  top: 4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bg);
  border: 2px solid var(--border-subtle);
}

/* 状态着色 */
.timeline-step-done .timeline-marker {
  background: var(--status-success-text, #16a34a);
  border-color: var(--status-success-text, #16a34a);
}
.timeline-step-active .timeline-marker {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent);
}

/* body */
.timeline-eyebrow {
  display: inline-block;
  margin-bottom: 4px;
  font: 600 10px/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
}
.timeline-step-done .timeline-eyebrow { color: var(--status-success-text, #16a34a); }
.timeline-step-active .timeline-eyebrow { color: var(--accent); }

.timeline-title {
  margin: 0 0 6px;
  font: 600 15px/1.4 var(--font-sans);
  color: var(--text-primary);
}

.timeline-desc {
  margin: 0;
  font: 400 13px/1.5 var(--font-sans);
  color: var(--text-secondary);
}
```

## 用到的 CSS variables

`--bg`, `--accent`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--font-sans`, `--font-mono`

可选：`--status-success-text`

## 配合

- 当步骤含**时间戳**（`260301`、`Q1 2026`）时用纵向 timeline，每步加 date eyebrow
- 当步骤是**抽象阶段**（Phase 1/2/3）时用横向 timeline，gap 自然撑开
- 步骤 > 6 个用纵向；横向超过 6 个会被 `auto-fit` 挤变形

## 边界

- 不要把"4 个无序的 work item"做成 timeline——timeline 必须有**严格先后**
- 状态只 3 档（done / active / pending）；不要发明 `paused` / `cancelled` 等额外档
- 横向 timeline 在移动端会自动 wrap——`auto-fit minmax(200px, 1fr)` 自然降级，不要额外 media query
