# Component: state-machine

状态机——对象 / 流程在多个状态间的转换关系。**首选 Mermaid `stateDiagram-v2`**。

## 触发

markdown 形态命中：

- 出现 "进入 X 态 / 转 Y 态 / 状态：A → B → C"
- `logic-block` 的异常表里多个状态相互影响（"网络断 → reconnecting → 上限后 → failed"）
- 设计涉及 lifecycle（订单状态机 / 任务调度状态 / 连接状态）

## HTML（Mermaid 首选）

```html
<figure class="state-machine">
  <span class="figure-label">STATE MACHINE</span>
  <pre class="mermaid">
stateDiagram-v2
    [*] --&gt; Idle
    Idle --&gt; Connecting : connect()
    Connecting --&gt; Connected : on_open
    Connecting --&gt; Failed : timeout 30s
    Connected --&gt; Reconnecting : on_error
    Reconnecting --&gt; Connected : retry success
    Reconnecting --&gt; Failed : retry max
    Failed --&gt; Idle : reset()
    Connected --&gt; [*] : close()
  </pre>
</figure>
```

## HTML（inline SVG fallback）

**仅当 Mermaid CDN 不可用**时使用。骨架（agent 按状态机布局填坐标）：

```html
<figure class="state-machine">
  <span class="figure-label">STATE MACHINE</span>
  <svg class="state-machine-svg" viewBox="0 0 700 320" xmlns="http://www.w3.org/2000/svg">
    <g class="sm-state">                <rect rx="30"/> <text>Idle</text>      </g>  <!-- 普通态：rx=30 椭圆 -->
    <g class="sm-state sm-state-active"> <rect rx="30"/> <text>Connected</text> </g>  <!-- 当前态：accent fill -->
    <g class="sm-state sm-state-error">  <rect rx="30"/> <text>Failed</text>    </g>  <!-- 错误终态 -->
    <path class="sm-edge"/>       <text class="sm-edge-label">connect()</text>        <!-- 正常转换 -->
    <path class="sm-edge sm-edge-error"/>  <text class="sm-edge-label">timeout</text> <!-- 错误转换 dashed -->
  </svg>
</figure>
```

下方 CSS Cheatsheet 同时覆盖 `sm-state` / `sm-state-active` / `sm-state-error` / `sm-edge` / `sm-edge-error` 五类。

## CSS Cheatsheet

```css
.state-machine {
  position: relative;
  margin: 24px 0;
  padding: 32px 24px 24px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  max-width: 100%;
}

.state-machine .mermaid {
  display: flex;
  justify-content: center;
  background: transparent;
}

.state-machine-svg {
  width: 100%;
  height: auto;
}

.sm-state rect {
  fill: var(--bg-surface);
  stroke: var(--text-primary);
  stroke-width: 1.5;
}

.sm-state text {
  fill: var(--text-primary);
  font: 600 13px/1 var(--font-sans);
}

.sm-state-active rect {
  fill: var(--accent);
  stroke: var(--accent);
}
.sm-state-active text { fill: var(--bg); }

.sm-state-error rect {
  fill: color-mix(in srgb, var(--status-danger-text, #dc2626) 12%, var(--bg));
  stroke: var(--status-danger-text, #dc2626);
}
.sm-state-error text { fill: var(--status-danger-text, #dc2626); }

.sm-edge {
  stroke: var(--text-secondary);
  stroke-width: 1.5;
  fill: none;
  marker-end: url(#sm-arrow);
}

.sm-edge-error {
  stroke: var(--status-danger-text, #dc2626);
  stroke-dasharray: 4 3;
}

.sm-edge-label {
  fill: var(--text-tertiary);
  font: 500 11px/1 var(--font-mono);
}
```

> SVG fallback 需要 `<defs><marker id="sm-arrow">...</marker></defs>` 定义箭头——首份 design-doc 用 mermaid 时 mermaid 自己处理。

## 用到的 CSS variables

`--accent`, `--bg`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--border-subtle`, `--font-sans`, `--font-mono`

可选：`--status-danger-text`

## 配合

- `state-machine` 和 `failure-table` 是同一份异常信息的两种表达——一图一表，互补
- 状态名应是名词（`Connecting` / `Idle`），转换 label 是动词（`connect()` / `on_open`）

## 边界

- 状态 ≤ 6 个；超过的话拆 sub-state-machine 或文字描述
- 不要把"步骤"画成状态机——步骤用 `timeline`，状态机强调**可逆 / 循环 / 多入口**
- 终态用 mermaid 的 `[*]`，SVG fallback 用 double-circle 或 accent fill 强调
