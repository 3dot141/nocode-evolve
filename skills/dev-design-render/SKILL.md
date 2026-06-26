---
name: dev-design-render
description: Render design documents into visual HTML — architecture diagrams, flow charts, sequence diagrams, domain relationship maps. Converts ASCII diagrams from design docs into styled HTML/SVG. Called after dev-design-refine produces a design doc. Not for UI prototypes (use pd-ui) or production code (use dev-build).
---

# dev-design-render — 设计文档可视化

把设计文档里的 ASCII 图（架构图/流程图/时序图/域关系图）渲染成 HTML 可视化。参考 pd-ui 的渐进式方案——ASCII 图已是可交付（第一层），HTML 渲染在此基础上升档。

## 非本 skill 请求

UI 原型 → pd-ui。写设计文档 → dev-design-refine。纯看设计文档 → 直接读。

## Enter Gate

- [ ] dev-design-refine 已完成，设计文档已产出
- [ ] 设计文档中有 ASCII 图

## 渐进式

```
ASCII 图（设计文档里已有）     → 可交付 ✓
HTML 渲染（样式化可视化）      → 可交付 ✓
```

## 协议

### Step 0: TaskCreate

```
Task 1: 盘点图
  Sub-steps: 读设计文档 → 列出所有 ASCII 图（类型+位置）
  Gate: 图清单产出

Task 2: 渲染 HTML
  Sub-steps: 每张图转 HTML/SVG
  Gate: 所有图渲染完成

Task 3: 验证 + 保存
  Sub-steps: 对照 ASCII 核对准确性 → 保存
  Gate: 产出已保存
```

### Step 1: 盘点图

**Enter Gate:**
- [ ] 设计文档路径已知

**Core Actions:**

读设计文档，列出所有 ASCII 图：

| 图 | 类型 | 位置 | 内容摘要 |
|---|---|---|---|
| 总图 | 域关系图 | ## 领域划分 | 资源域→Agent域 |
| 域内图 | 模块关系图 | ## 资源域 | Parser→Validator→Repo |
| BF1 | 流程图 | ## 业务流 | 上传→解析→写入 |

**Exit Gate:**
- [ ] 图清单产出，每张标类型和位置

### Step 2: 渲染 HTML

**Enter Gate:**
- [ ] 图清单已产出

**Core Actions:**

生成一个 HTML 文件，包含设计文档所有图的可视化渲染：

**视觉风格**：技术文档风格，清晰优先
- 域/模块：圆角矩形，灰色边框，白色底
- 关系线：蓝色带箭头
- 流程节点：圆角矩形 + 箭头串联
- 时序：生命线 + 横向消息箭头
- 状态机：圆角节点 + 标条件的转换箭头
- 字体：等宽标签（代码/接口名），无衬线（描述文字）

**HTML 结构**：
```html
<!-- 每张图一个 section -->
<section class="diagram">
  <h3>域关系图</h3>
  <div class="diagram-content">
    <!-- SVG 或 CSS Grid 渲染 -->
  </div>
  <details>
    <summary>ASCII 原文</summary>
    <pre>原始 ASCII 图</pre>
  </details>
</section>
```

每张图保留可折叠的 ASCII 原文——reviewer 能对照检查渲染是否准确。

**产出路径**：设计文档同目录 `<topic>-diagrams.html`

**Exit Gate:**
- [ ] HTML 文件产出
- [ ] 每张图渲染完成 + ASCII 原文保留

### Step 3: 验证 + 保存

**Enter Gate:**
- [ ] HTML 文件已产出

**Core Actions:**

1. **准确性核对**：逐张对比渲染 vs ASCII
   - [ ] 节点数量一致
   - [ ] 连线方向一致
   - [ ] 标签文字一致

2. **保存**：HTML 文件保存到设计文档同目录

3. **更新设计文档**：末尾追加引用
   ```markdown
   ## 可视化
   渲染产出：`<topic>-diagrams.html`
   ```

**Exit Gate:**
- [ ] 准确性核对通过
- [ ] 文件已保存
- [ ] 设计文档已追加引用

## Red Flags

- 渲染跟 ASCII 原文对不上（节点/连线数量或方向不一致）
- 没有设计文档就直接画图（设计在先，渲染在后）
- 花太多时间调视觉效果但信息结构没对
