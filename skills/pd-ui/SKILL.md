---
name: pd-ui
description: Use when the user wants to design the interaction and visual direction of a product after the PRD is defined. Use when the user says "交互设计/视觉设计/界面设计/原型/wireframe/线框图/设计稿/长什么样", or when pdflow routes to the interaction-visual-design stage after PRD. Produces a .ui.md (interaction + visual spec), with optional mid/high-fidelity static mockups or a clickable HTML prototype. Not for technical architecture (use nocode-evolve:dev-design) or production component code (use devflow Build).
---

# pd-ui — 交互视觉设计

**Iron Law: PRD 说"做什么"，没说"长什么样、怎么走"。这层空白不填，开发只能边写边猜。**

独立于 devflow 的产品流第三阶段。产出 `.ui.md`，和 `.prd.md` 一起作为开发输入。

## 边界

| pd-ui 做 | 不做（→ 去哪） |
|---|---|
| 信息架构、页面/视图清单 | 技术架构、模块划分 → dev-design |
| 关键用户流程、交互态 | 数据流、API、数据库 → dev-design |
| wireframe、视觉方向、配色排版 | 生产级组件代码 → devflow Build |
| 可点击 HTML 原型 | 技术栈选型 → dev-design |

**非本 skill**：无 PRD → 先 pd-prd。要技术架构 → dev-design。要生产代码 → devflow Build。纯改一两个样式值 → 直接改，不进本 skill。

## Checklist（进入后立即 TaskCreate）

| # | Task | 对应 Step |
|---|---|---|
| 1 | 读 PRD + 解析设计源 | Step 0 |
| 2 | 竞品与产品探索 | Step 1 |
| 3 | 澄清 + 选保真度 | Step 2 |
| 4 | 逐交互拆解 + IA + 用户批准 | Step 3 |
| 5 | 视觉方向发散 + 用户选定 | Step 4 |
| 6 | 设计系统补齐 | Step 5 |
| 7 | 高保真产出 | Step 6 |
| 8 | 验证 + 交付 | Step 7 |
| 9 | 保存 + Handoff | Step 8 |

**进入 pd-ui 后第一件事是 TaskCreate 创建以上全部 task。** 每完成一个标 done。不适用的标 skip + 原因（如低保真跳 Step 6、非 DesignSync 跳 Step 5）。

---

## Step 0: 读 PRD + 解析设计源

> 确定设计的输入（PRD）和产出方式（设计源）。设计源决定全程工作方式，不只是 Step 6。

**Entry Gate:**
- [ ] pd-ui skill 已加载
- [ ] 有 `.prd.md` 或明确的产品上下文（无 → 告知用户，建议先 pd-prd）

**Core Actions:**
1. **读 PRD** — `{pd_prd_output}` 目录下 `*.prd.md`，提取「业务领域与使用路径」节（路径 ID 是交互设计的骨架）+ 目标用户 + 功能清单。多个 PRD → 列出让用户选。路径 ID 格式见 `{NOCODE_SKILL_REF}/path-conventions.md`
2. **解析设计源** — 按 `{NOCODE_SKILL_REF}/ui-taste-skills.md`「设计源解析」共享流程执行
3. **记录设计源标识** — 写入后续 `.ui.md`，格式见 `{NOCODE_SKILL_REF}/ui-taste-skills.md`「设计源标识格式」

**Exit Gate:**
- [ ] PRD 已读，使用路径清单已提取（含路径 ID）
- [ ] 设计源已确定，标识已记录（`[design-source: ...]`）
- [ ] Task 1 标 done

---

## Step 1: 竞品与产品探索

> 看看世界上已经有什么。没看过别人怎么做就画 wireframe = 闭门造车。

**Entry Gate:**
- [ ] Step 0 Exit Gate 全部满足

**Core Actions:**
1. **并行 spawn 两个方向：**
   - **方向 A 竞品探索** — 从 PRD 提取 3-5 个关键页/流程，搜 3-5 个竞品，每个竞品的每个关键功能拿三块：文字说明 + HTML + 截图
   - **方向 B 产品现状** — 改造已有产品 → 截取当前产品页面记录现状；全新产品 → 扫描代码库的 UI 组件/设计系统
2. **产出**竞品参考表 + 产品现状清单

**Exit Gate:**
- [ ] 竞品参考表已产出（≥3 竞品，含文字说明 / HTML / 截图，标 `[SOURCE]`）
- [ ] 产品现状清单已产出（已有什么 + 要新建什么 + 要改什么）
- [ ] Task 2 标 done

> 展开：降级链、表格格式、Playwright 用法 → `references/step-1-exploration.md`

---

## Step 2: 澄清 + 选保真度

> 暴露歧义，定保真度。提议默认值——改比答快。不替用户升档。

**Entry Gate:**
- [ ] Step 1 Exit Gate 全部满足

**Core Actions:**
1. **澄清 4 个维度**（每个给默认值）：
   - 平台 — Web / 移动 / 桌面？
   - 调性 — 结合 Step 1 竞品参考给更有依据的建议
   - 参考偏好 — 竞品里倾向哪个方向？
   - 关键流程数 — 默认从 PRD 使用路径提
2. **AskUserQuestion 定保真度**（默认低保真）：

| 档 | 产出 | 适用 |
|---|---|---|
| **低保真（默认）** | 文字/ASCII 结构 + 交互流 → `.ui.md` | 够拍板方向 |
| **中保真** | + 关键页单屏静态视觉（具体配色/排版值） | 确认视觉观感 |
| **高保真** | + 可点击 `prototype.html`（能走流程） | 演示 / 验证复杂交互 |

**Exit Gate:**
- [ ] 平台 / 调性 / 参考 / 关键流程数已确认
- [ ] 保真度已选定
- [ ] Task 3 标 done

---

## Step 3: 逐交互拆解（所有档都做）

> **核心工作量在这里。** 按交互粒度逐个拆、逐个调研、逐个画线框、逐个给用户看。全部锁定后才汇总 IA——不允许反过来（先拍 IA 再补交互）。

**Entry Gate:**
- [ ] Step 2 Exit Gate 全部满足

**Core Actions:**

**3a. 提取交互清单** — 从 PRD 每条使用路径拆出交互点。路径是"用户要完成什么"，交互是"每一步做什么操作"。跨域路径展开为端到端交互链。系统路径识别"触发后用户看到什么"。

**3b. 逐交互调研 + 设计 + 线框** — 每个交互完成四块：

| 块 | 内容 |
|---|---|
| 竞品做法 | 从 Step 1 深入到具体交互层，追加搜索/截图，标 `[SOURCE]` |
| 设计决策 | 我们怎么做 + 为什么（引用竞品 + PRD 约束） |
| 线框图 | ASCII 布局：区块划分 + 内容清单 |
| 状态覆盖 | 正常 / empty / loading / error（缺一不可） |

**3c. 逐交互用户校验（1-3 轮）** — 每个交互展示给用户："竞品做法对吗？设计方向对吗？" 同一交互最多 3 轮。**全部交互锁定后才进 3d。**

**3d. IA 汇总** — 从锁定的交互拆解**汇总**出：页面/视图清单 + 层级关系 + 导航结构 + 每页包含哪些交互 + 页面间跳转。展示给用户批准。

**Exit Gate:**
- [ ] 交互清单已提取（覆盖 PRD 全部使用路径 + 跨域路径 + 系统路径可见反馈）
- [ ] 每个交互的四块（竞品/决策/线框/4 态）已完成
- [ ] 用户已逐交互校验并锁定
- [ ] IA 汇总经用户批准（approve gate）
- [ ] Task 4 标 done

> 展开：交互提取格式、四块详细要求、例子 → `references/step-3-interaction-breakdown.md`
> 已填好的低保真示例 → `references/examples/example-vis-wireframe.md`

---

## Step 4: 视觉方向发散

> 不赌单一方向。给 2-3 个明显不同的方向，让用户选。

**Entry Gate:**
- [ ] Step 3 Exit Gate 全部满足（IA 已批准）

**Core Actions:**
1. 沿三轴给 **2-3 个方向**（必须明显不同）：
   - 布局密度：紧凑信息密集 ↔ 宽松留白
   - 视觉强度：克制中性 ↔ 表现力强
   - 调性：专业严肃 ↔ 友好轻松
2. 每个方向：一句话描述 + 适用场景 + 参考产品类比
3. 低保真档：文字描述记入 `.ui.md`，不出稿
4. 中/高保真档：记住用户选定的方向，Step 6 出稿

**Exit Gate:**
- [ ] 2-3 个视觉方向已呈现（不是 1 个）
- [ ] 用户已选定方向（可混搭）
- [ ] Task 5 标 done

---

## Step 5: 设计系统补齐（仅 DesignSync 设计源）

> 设计系统是 foundations → components → patterns 自下而上。页面 pattern 由组件组装——组件不齐就组装不了。先补齐 design system，再进 Step 6 组装页面。

**Entry Gate:**
- [ ] Step 4 Exit Gate 全部满足
- [ ] 设计源为 DesignSync（Step 0 记录的 `[design-source: DesignSync <projectId>]`）
- [ ] **非 DesignSync → 跳过本步**，Task 6 标 skip "设计源非 DesignSync"

**Core Actions:**
1. **盘点现有** — `DesignSync list_files` 列出 foundations / components / patterns 各层现有文件
2. **Gap Analysis** — 对照 Step 3 交互清单逐交互检查：这个交互需要哪些组件？现有 components 覆盖吗？
3. **产出缺口清单**：

| 交互点 | 需要的组件 | 现有 | 缺失 |
|---|---|---|---|
| 资源库.P5.1 浏览列表 | DataTable, FilterBar | DataTable ✓ | FilterBar ✗ |

4. **补齐 components** — 缺失组件作为 `.dc.html` 推送到 DesignSync `components/`（`finalize_plan` → `write_files`）
5. **补齐 foundations（如需）** — 新视觉方向需要新 token → 更新 `foundations/`

**Exit Gate:**
- [ ] 缺口清单已产出（每个交互 → 需要的组件 → 现有/缺失）
- [ ] 缺失组件已补齐到 DesignSync 项目 components/
- [ ] foundations 仍覆盖新组件所需 token（不足则已更新）
- [ ] design system 层级完整：foundations ✓ → components ✓ → 可以组装 patterns
- [ ] Task 6 标 done

> 展开：DesignSync 操作流程、`.dc.html` 格式、自下而上流程 → `references/step-5-design-system-gap.md`

---

## Step 6: 高保真产出（仅中/高保真档）

> 低保真档跳过。按 Step 0 确定的设计源分路——**回查设计源标识，不凭记忆判断**。

**Entry Gate:**
- [ ] Step 4 Exit Gate 全部满足
- [ ] 保真度为中 / 高保真（**低保真 → 跳过**，Task 7 标 skip）
- [ ] **回查 Step 0 设计源标识**：`[design-source: DesignSync ...]` → 路径 A + Step 5 Exit Gate 必须满足；其他 → 路径 B
- [ ] DesignSync 设计源 → Step 5 Exit Gate 全部满足（design system 已补齐）

**路径 A: DesignSync**
1. 用 Step 5 补齐的 components 组装页面级 patterns（`.dc.html`）
2. `finalize_plan` → `write_files` 推送到 DesignSync `patterns/`
3. 记录 projectId，下游通过 `get_file` 消费

**路径 B: 本地原型**
1. 截图/Figma → 照着参考出稿，严格还原
2. Taste skill → `Skill()` 加载对应 skill，按其规范出稿
3. 产出 `.ui-prototype.html` → `{pd_ui_prototype}`

**两条路径共同要求：**
- 中保真：关键页单屏静态视觉，给具体值（配色 token / 字号字重 / 间距 / 圆角）
- 高保真：可点击原型，关键流程能走通，design token 不硬编码 hex，交互元素 4 态（hover / active / focus-visible / disabled），empty / loading 态
- 有 browser/截图工具 → 截图走查关键页；否则结构自查

**Exit Gate:**
- [ ] 中/高保真产物已产出
- [ ] 路径 A: patterns 已推送到 DesignSync / 路径 B: prototype.html 已保存
- [ ] Task 7 标 done

---

## Step 7: 验证 + 交付

> 两道自查 + 交叉审。Critical 不过不交付。

**Entry Gate:**
- [ ] 高保真档：Step 6 Exit Gate 满足
- [ ] 低保真档：Step 4 Exit Gate 满足（跳过了 Step 5/6）

**Core Actions:**

**① PRD 路径逐条走查**（硬约束）— 每条使用路径在设计里有对应交互流吗？按路径 ID 逐条点名。系统路径的用户可见反馈也要核。缺的补，PRD 没有的删。

**② 五维自审：**

| 维度 | 检查什么 |
|---|---|
| 信息层级 | 每屏最重要的东西最突出？ |
| 一致性 | 同类元素同样处理？导航/按钮模式统一？ |
| 交互完整性 | 每个关键页的 empty/loading/error 都设计了？ |
| 可行性 | 这个设计开发能实现？没有依赖不存在的能力？ |
| PRD 对齐 | 没超出 PRD 范围，没漏使用路径 / 系统路径反馈？ |

**③ vis-review 交叉审** — 按 `{NOCODE_SKILL_REF}/vis-review.md` 做 red-blue 双模型评审（蓝军 Claude + 红军 Codex，CLAIM 剥离）。Critical 必须修复。Codex 不可用 → 降级标注。

**Exit Gate:**
- [ ] PRD 路径逐条走查通过（无遗漏使用路径 / 系统路径反馈）
- [ ] 五维自审通过
- [ ] vis-review 无 Critical findings（或已修复）
- [ ] Task 8 标 done

---

## Step 8: 保存 + Handoff

> 产出文件，提示下游。

**Entry Gate:**
- [ ] Step 7 Exit Gate 全部满足

**Core Actions:**
1. 产出 `.ui.md` → `{pd_ui_output}`（模板见 `references/ui-doc-template.md`）
2. 高保真原型 → `{pd_ui_prototype}`（如有）
3. 提示用户："交互视觉设计完成。进 devflow 时，Define/Design 以 PRD + 这份 design 为输入（做什么 + 长什么样）。"

**Exit Gate:**
- [ ] `.ui.md` 已保存到正确路径
- [ ] 高保真原型已保存（如有）
- [ ] 全部 Task 状态已更新（done / skip）
- [ ] Task 9 标 done

> .ui.md 模板 → `references/ui-doc-template.md`

---

## AI 能力边界

| AI 能做 | AI 不能做（标 `[ASSUMED]` 或"需人工"） |
|---|---|
| wireframe / IA / 交互流 | 真实用户可用性测试 |
| 视觉方向 / 配色排版建议 | 品牌战略 / 视觉识别系统决策 |
| 可点击 HTML 原型 | 像素级还原设计师手稿 |
| 状态/边界枚举 | A/B 测试效果预判 / 转化率预测 |

**不假装能做**。做不了的标注，不编造"设计研究数据"。

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "PRD 写清楚了，界面让开发看着办" | 开发"看着办" = 你没决定的地方由实现细节替你决定 |
| "低保真够了，不用想交互态" | empty/loading/error 是一半的真实使用时间 |
| "直接上高保真原型快" | 没批准低保真结构就糊高保真 = 在错的骨架上贴皮 |
| "视觉方向凭感觉定一个" | 2-3 个方向让人选，比赌一个返工率低 |
| "这是产品阶段，顺便把技术架构定了" | 技术架构是 dev-design 的事，混进来会绑死实现 |
| "组件够用了不用补" | 没做 gap analysis 你怎么知道够用 |
| "先写 HTML 再推 DesignSync" | DesignSync 是设计源不是归档处——在里面出稿，不是事后搬运 |
| "先拍个 IA 再补交互" | IA 是从交互拆解汇总出来的，不是先画框架再填内容 |

## Red Flags

- 没建 TaskCreate 就开始做
- 跳 Step 3 直接出 IA（没有逐交互拆解基础）
- IA 先于交互拆解产出（顺序反了）
- wireframe 只画正常态，缺 empty/loading/error
- 跳过低保真直接出高保真（没 approve gate）
- 只给一个视觉方向（没发散）
- 没对照 PRD 逐条核路径覆盖
- 设计源是 DesignSync 却写本地 HTML（Step 6 没回查设计源）
- 没做 design system gap analysis 就组装页面 pattern
- 交互流没标 PRD 路径 ID（断了可追溯链）
- `.ui.md` 出现 PRD 里不存在的功能（脱离 PRD 自由发挥）
- 在 pd-ui 里定了技术栈 / API / 数据库（越界到 dev-design）
