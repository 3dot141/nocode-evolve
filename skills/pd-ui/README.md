# pd-ui

把 PRD 的需求落成界面结构、交互流、视觉方向。产出 `.ui.md`，和 `.prd.md` 一起作为 devflow 的开发输入。

独立于 devflow 的产品流第三阶段（Research → PRD → **UI**）。回答"用户看到什么、怎么操作"，不碰技术架构（那是 dev-design）。

## 设计决策

### 为什么 Step 0 就解析设计源

设计源（DesignSync / Figma / 截图参考 / taste skill）决定的不只是 Step 5 高保真产出的格式，而是全程的工作方式：

- 用户已有 Figma 设计稿 → 竞品探索应该针对性对比，线框图往 Figma 已有的方向靠
- 用户有截图参考 → 视觉方向发散围绕参考做变体，不是凭空发散
- 用 DesignSync → 中间产物格式不同

如果等到 Step 5 才问"你有没有 Figma？"，前面的竞品探索和视觉方向可能白费。

另外 pd-ui 是设计源链的最上游产出者（pd-ui → dev-design → dev-plan → dev-build），在这里确定了，后面的阶段直接继承、不重复问用户。共享流程见 `references/ui-taste-skills.md`。

一句话：设计源是全链路的分支条件，不是 Step 5 才用到的局部参数，放 Step 0 探测才不会让后续步骤做无用功。

## 流程概览

| Step | 做什么 | Gate |
|---|---|---|
| 0 | 读 PRD + 解析设计源 | — |
| 1 | 竞品与产品探索（并行两方向） | — |
| 2 | 澄清 + 选保真度 | — |
| 3 | 低保真：逐交互拆解 + 线框图 | approve gate（用户批准结构） |
| 4 | 视觉方向发散（2-3 个） | 用户选定方向 |
| 5 | 高保真产出（仅中/高保真档） | — |
| 6 | 验证 + 交付（PRD 路径逐条走查 + 五维自审） | vis-review |
| 7 | 保存 + Handoff | exit gate |

## 与其他 skill 的关系

- **上游**：`pd-prd`（提供 PRD）、`pdflow`（路由到本阶段）
- **下游**：`devflow` Define/Design 消费 `.ui.md` + `.prd.md`
- **共享**：`ui-taste-skills.md`（设计源解析共享流程，四阶段统一消费）
- **交叉审**：`vis-review.md`（Step 6a，红蓝双模型评审）
