# pd-ui

把 PRD 的需求落成界面结构、交互流、视觉方向。产出 `.ui.md`，和 `.prd.md` 一起作为 devflow 的开发输入。

独立于 devflow 的产品流第三阶段（Research → PRD → **UI**）。回答"用户看到什么、怎么操作"，不碰技术架构（那是 dev-design）。

## 设计决策

### 为什么 Step 0 就解析设计源

设计源（DesignSync / Figma / 截图参考 / taste skill）决定的不只是高保真产出的格式，而是全程的工作方式：

- 用户已有 Figma 设计稿 → 竞品探索应该针对性对比，线框图往 Figma 已有的方向靠
- 用户有截图参考 → 视觉方向发散围绕参考做变体，不是凭空发散
- 用 DesignSync → 中间产物格式不同，且需要在 Step 5 补齐 design system

pd-ui 是设计源链的最上游产出者（pd-ui → dev-design → dev-plan → dev-build），在这里确定了，后面的阶段直接继承、不重复问用户。共享流程见 `references/ui-taste-skills.md`。

### 为什么加 Entry/Exit Gate

上一版没有 gate，导致执行时跳步：Step 3（逐交互拆解）整个被跳过，Step 6 没有回查设计源导致 DesignSync 被绕过。Gate 是最低成本的防跳步机制——每步的前置条件和产出条件写成 checklist，进入时扫 Enter Gate，完成时扫 Exit Gate。

### 为什么加 Step 5 设计系统补齐

设计系统是 foundations → components → patterns 自下而上的层级。页面 pattern 由组件组装——组件不齐就组装不了。上一版直接在 Step 5（现 Step 6）写本地 HTML，跳过了"现有 design system 够不够用"的检查。加 Step 5 让 gap analysis 成为必经步骤。

### 为什么用渐进式披露

SKILL.md 保留每步的骨架（目的 + gate + 核心动作），详细的格式/模板/例子/降级链放到 references/ 按需 Read。agent 先拿到全局 gate 结构，执行到具体步骤时再展开细节，防止信息过载导致选择性跳步。

## 流程概览

| Step | 做什么 | Enter Gate | Exit Gate |
|---|---|---|---|
| 0 | 读 PRD + 解析设计源 | skill 已加载 + 有 PRD | PRD 路径提取 + 设计源确定 |
| 1 | 竞品与产品探索 | Step 0 通过 | 竞品表 + 现状清单 |
| 2 | 澄清 + 选保真度 | Step 1 通过 | 4 维确认 + 保真度选定 |
| 3 | 逐交互拆解 + IA | Step 2 通过 | 全部交互锁定 + IA 用户批准 |
| 4 | 视觉方向发散 | Step 3 通过 | 2-3 方向 + 用户选定 |
| 5 | 设计系统补齐 | Step 4 通过 + DesignSync | 缺口补齐 |
| 6 | 高保真产出 | Step 4 通过 + (DesignSync→Step 5 通过) | 产物产出 |
| 7 | 验证 + 交付 | Step 6 或 Step 4 通过 | PRD 走查 + 五维 + vis-review |
| 8 | 保存 + Handoff | Step 7 通过 | 文件保存 |

## 与其他 skill 的关系

- **上游**：`pd-prd`（提供 PRD）、`pdflow`（路由到本阶段）
- **下游**：`devflow` Define/Design 消费 `.ui.md` + `.prd.md`
- **共享**：`ui-taste-skills.md`（设计源解析共享流程，四阶段统一消费）
- **交叉审**：`vis-review.md`（Step 6a，红蓝双模型评审）
