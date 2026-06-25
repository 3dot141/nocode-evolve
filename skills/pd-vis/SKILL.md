---
name: pd-vis
description: Use when the user wants to design the interaction and visual direction of a product after the PRD is defined. Use when the user says "交互设计/视觉设计/界面设计/原型/wireframe/线框图/设计稿/长什么样", or when pdflow routes to the interaction-visual-design stage after PRD. Produces a .design.md (interaction + visual spec), with optional mid/high-fidelity static mockups or a clickable HTML prototype. Not for technical architecture (use nocode-evolve:dev-design) or production component code (use devflow Build).
---

# pd-vis — 交互视觉设计

**Iron Law: PRD 说"做什么"，没说"长什么样、怎么走"。这层空白不填，开发只能边写边猜——猜错就推倒重来。**

独立于 devflow 的产品流第三阶段。把 PRD 的需求落成**界面结构 + 交互流 + 视觉方向**。产出物喂给 devflow 的 Define/Design 阶段，和 `.prd.md` 一起作为开发输入。

> Leading word: **design**。所有收敛到一份 `.design.md`，没有文档就没有交互视觉设计的产出。

## 边界：pd-vis 做什么、不做什么

| pd-vis 做（产品交互 + 视觉） | 不做（→ 去哪） |
|---|---|
| 信息架构、页面/视图清单 | 技术架构、模块划分 → `dev-design` |
| 关键用户流程、交互态 | 数据流、API 契约、数据库 → `dev-design` |
| wireframe、视觉方向、配色排版 | 生产级组件代码 → devflow Build |
| 可点击 HTML 原型（验证用） | 技术栈选型 → `dev-design` |

**pd-vis 回答"用户看到什么、怎么操作"，dev-design 回答"系统怎么实现"。** 不在 pd-vis 里定技术栈 / 数据库 / API。

## 非本 skill 请求

没有 PRD、产品上下文不清 → 先走 `nocode-evolve:pd-prd`。
要技术架构 / API / 数据流设计 → 走 `nocode-evolve:dev-design`。
要写生产代码组件 → 走 devflow Build。
纯改现有 UI 的一两个样式值（不涉及交互/结构设计）→ 直接改，不进本 skill。

## Entry Gate

- [ ] 有 `.prd.md` 或明确的产品上下文（知道做什么、给谁用）

无 PRD 时不硬开——先确认产品上下文，或建议回 `pd-prd`。

## Checklist (TaskCreate)

1. **读 PRD + 选保真度** — Read `.prd.md` + AskUserQuestion 定保真档（默认低保真）
2. **低保真：IA + wireframe** — 信息架构 + 关键流程（映射 PRD 路径 ID）+ 线框图，**先批准**
3. **方向发散** — 2-3 个视觉方向，用户选一个
4. **高保真产出**（仅中/高保真档）— 静态视觉稿 or 可点击原型
5. **验证 + 交付** — 对照 PRD 逐条走查 + 写 `.design.md`

## 协议

### Step 0: 读 PRD

检查是否有 PRD：
- `{pd_prd_output}` 所在目录存在 `*.prd.md` → Read 它，拿核心场景 / 用户故事 / 目标用户 / 功能清单作为设计依据。**额外读取「业务领域与使用路径」节**——使用路径（含路径 ID，如 `订单.P1`）是交互设计的骨架，每条路径对应一段要设计的交互流
- 不存在 → 降级为基于用户口头描述设计，明确告知"无 PRD，将基于你的描述设计；建议先写 PRD"。**无 PRD 时本会话现场产出的交互流没有稳定路径 ID**——若后续要进 Define，提醒用户路径 ID 将在 Define/PRD 阶段补齐

路径 / ID 格式约定见 `{NOCODE_SKILL_REF}/path-conventions.md`。

多个 PRD 文件 → 列出让用户选。

### Step 1: 澄清 + 选保真度

先暴露交互/视觉相关的歧义（提议默认值，改比答快）：

1. **平台** — "目标平台是 Web / 移动 / 桌面？默认 X。"
2. **调性** — "视觉调性偏专业克制 / 友好活泼 / ？默认 X。"
3. **参考** — "有想对齐的参考产品吗？（Stripe / Linear / Notion 风格之类）"
4. **关键流程数** — "核心要设计几条用户流程？默认从 PRD 的使用路径提（每条使用路径对应一段交互流）。"

然后用 AskUserQuestion 定**保真度档**（默认低保真，提示用户可升档）：

| 档 | 产出 | 适用 |
|---|---|---|
| **低保真 wireframe（默认）** | 文字/ASCII 结构 + 交互流，写进 `.design.md` | 大多数情况，够拍板方向 |
| **中保真静态稿** | + 关键页单屏静态视觉（配色/排版/层级具体值） | 要确认视觉观感 |
| **高保真可点击原型** | + `prototype.html`（能点、能走流程） | 给 stakeholder 演示 / 验证复杂交互 |

**默认轻，按需重。** 不替用户升档——低保真够用就别浪费。

### Step 2: 低保真——IA + 交互流 + wireframe（所有档都做）

无论选哪档，结构先行。这一步产出后**先给用户批准，再往下做高保真**（approve gate）——别在没定的骨架上糊视觉。

1. **信息架构**：列页面/视图清单 + 层级关系（哪些页、谁包含谁、导航结构）
2. **关键流程**：每条核心流程从入口到完成目标的步骤（entry → steps → done）。**从 PRD 使用路径映射而来，保留路径 ID**：
   - 每条交互流标注它实现的 PRD 路径 ID（如 `订单.P1 → 交互流: 商品页 → 购物车 → 确认 → 支付`），不另起编号
   - **跨领域路径**（`跨域.N`）展开成端到端交互流——把串联的几条领域路径连成一条用户实际走完的流程
   - **系统路径**（`系统.N`）无界面不进 wireframe，但要识别"触发后用户看到什么"（如支付回调成功后支付等待页切成成功态），把这个用户可见反馈纳入相关页面的状态
3. **wireframe**：每个关键页的文字/ASCII 版布局——区块划分 + 内容清单 + **状态列表**（正常 / empty / loading / error，缺一不可）

展示给用户：**"结构和交互流是这样，确认了我再往视觉/原型走。"** 用户改 → 改完再确认。

### Step 3: 方向发散——2-3 个视觉方向

不赌单一方向。沿这些轴给 2-3 个明显不同的方向，让用户选（可混搭）：

- **布局密度**：紧凑信息密集 ↔ 宽松留白
- **视觉强度**：克制中性 ↔ 表现力强（强色/大字/动效）
- **调性**：专业严肃 ↔ 友好轻松

每个方向给：一句话描述 + 适用场景 + 参考产品类比。

- **低保真档**：方向只用文字描述，不出稿，记进 `.design.md` 的 Visual Direction
- **中/高保真档**：基于用户选定的方向出稿（Step 4）

### Step 4: 高保真产出（仅中 / 高保真档）

低保真档跳过此步。

- **中保真**：选定方向的关键页单屏静态视觉（1-2 个核心页）。给具体值——配色 token、字号/字重、间距尺度、圆角。可用 HTML/CSS 或结构化描述。
- **高保真**：可点击 `prototype.html`。要求：关键流程能走通、用 design token 不硬编码 hex、交互元素 4 态全给（hover/active/focus-visible/disabled）、带 empty/loading 态。
- **验证产出**：有 browser/截图工具 → 截图走查关键页；否则结构自查（区块齐全、状态覆盖）。

### Step 5: 验证 + 交付

产出 `.design.md` 前，两道自查：

**① PRD 路径逐条走查**（硬约束）：PRD 的每条**使用路径**，在设计里都有对应的交互流吗？逐条点名（按路径 ID），缺的补、PRD 没有的删（脱离 PRD 自由发挥要回头确认）。**系统路径**的用户可见反馈也要核——支付回调、定时同步这类后台行为触发后用户在界面上看到什么，有没有设计对应的状态。

**② 五维自审**：

| 维度 | 检查什么 |
|---|---|
| 信息层级 | 每屏最重要的东西最突出？ |
| 一致性 | 同类元素同样处理？导航/按钮模式统一？ |
| 交互完整性 | 每个关键页的 empty/loading/error 都设计了？ |
| 可行性 | 这个设计开发能实现？没有依赖不存在的能力？ |
| PRD 对齐 | 设计没超出 PRD 范围，也没漏使用路径 / 系统路径反馈？ |

**填好的低保真示例**（对照颗粒度，不照搬措辞）：`references/examples/example-vis-wireframe.md`

**`.design.md` 模板**：

```markdown
# 设计: {title}
> 状态: 草稿
> 作者: {username}
> 日期: {yymmdd}
> PRD: {.prd.md 路径, 无则 "N/A"}
> 保真度: 低保真 / 中保真 / 高保真

## 信息架构
[页面/视图清单 + 层级 + 导航结构]

## 关键流程
[每条标注对应的 PRD 路径 ID]
| 路径 ID | 交互流 | 状态覆盖 |
|---|---|---|
| 订单.P1 | 商品页→购物车→确认→支付 | 正常/库存不足/地址不可配送 |
| 订单.P2 | 订单详情→取消→确认弹窗→结果 | 正常/已发货不可取消 |
| 跨域.1 | 下单→支付→物流→签收（端到端串联） | 正常/任一环节失败回退 |

## 线框图
[每个关键页: ASCII/文字布局 + 内容清单 + 状态列表(正常/empty/loading/error)]

## 视觉方向
[选定方向描述; 中/高保真填具体值: 配色 token / 字号字重 / 间距 / 圆角]

## 原型
[高保真档: prototype.html 路径 + 截图说明; 否则 "N/A — 低保真，未出原型"]

## PRD 路径覆盖
[逐条使用路径 + 系统路径 → 对应界面/交互流, 确认无遗漏]
| 路径 | 对应界面/流程 | 状态 |
|---|---|---|
| 订单.P1 | 见上方交互流 | ✅ |
| 系统.1 (支付回调) | 支付等待页→成功/失败状态切换 | ✅ (用户可见部分) |

## 待定项
- [TBD] 问题 1
```

### Step 6: 保存 + Handoff

- `.design.md` 存到 `{pd_vis_output}` 变量指定的路径，和同 topic 的 PRD 同目录
- 高保真原型存 `{pd_vis_prototype}` 变量指定的路径
- 变量定义见 `model/agent-about.md`「文档产出路径变量」

完成后提示："交互视觉设计完成。进 devflow 开发时，Define/Design 会以 PRD + 这份 design 为输入（做什么 + 长什么样）。"

## Exit Gate

- [ ] `.design.md` 已产出，含 IA + 关键流程 + wireframe（带状态列表）
- [ ] 低保真结构经用户批准（approve gate 过了）
- [ ] 给了 2-3 个视觉方向，用户已选
- [ ] PRD 路径覆盖逐条核过，无遗漏使用路径 / 系统路径反馈
- [ ] 选了中/高保真则原型/静态稿已产出
- [ ] 文件已保存到正确路径

## AI 能力边界（硬约束）

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
| "低保真够了，不用想交互态" | empty/loading/error 是一半的真实使用时间，不设计就是漏 |
| "直接上高保真原型快" | 没批准低保真结构就糊高保真 = 在错的骨架上贴皮，返工更贵 |
| "视觉方向凭感觉定一个" | 给 2-3 个方向让人选，比赌一个的返工率低 |
| "这是产品阶段，顺便把技术架构定了" | 技术架构是 dev-design 的事，混进来会绑死实现 |

## Red Flags

- wireframe 只画正常态，没有 empty/loading/error
- 跳过低保真直接出高保真（没 approve gate）
- 只给一个视觉方向（没发散）
- 没对照 PRD 逐条核（可能漏了使用路径对应界面 / 系统路径反馈）
- 交互流没标 PRD 路径 ID（断了与下游的可追溯链）
- `.design.md` 出现 PRD 里不存在的功能（脱离 PRD 自由发挥）
- 在 pd-vis 里定了技术栈 / API / 数据库（越界到 dev-design）
