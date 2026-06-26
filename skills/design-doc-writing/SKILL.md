---
name: design-doc-writing
description: Use when the design skill delegates document writing, or when the user asks to write a PRD / RFC / Design Doc / ADR / 重构方案 / 系统设计 / 技术 spec. Not for code comments, PR descriptions, commit messages, or READMEs.
---

# 设计文档写作

把确认的设计方案落地成结构化的 markdown 文档。方案探索和选型由 `nocode-evolve:dev-design` 完成，本 skill 接收选定方案后负责**写文档**。不负责实施（writing-plans / executing-plans 的事）。

工作流：write → review → 用户逐条确认 → 修订 → 追加 Review Log。reviewer 只列问题，**不自动循环修订**——是否修、修哪些由用户决定。

## 何时使用

**应该用：**

- nocode-evolve:brainstorming 走到 step 5（写设计文档）时
- 用户说「帮我写个 PRD / RFC / 设计文档 / ADR / 重构方案 / 系统设计 / 架构记录 / 提案」
- 你即将创建 `*-design.md` / `*-prd.md` / `*-rfc.md` / `*-adr.md` 性质的文件

**不要用：**

- 写代码注释、PR 描述、commit message、README、changelog
- 用户只是问「X 应该怎么做」——这是方案探索阶段，先用 `nocode-evolve:dev-design`
- 简单 bug 修复（用 nocode-evolve:systematic-debugging）

**注：简单任务也要验收标准，只是 spec 更短。** 两行 spec 也是 spec——不要因"太简单"完全跳过。区别在规模不在有无。

## 选 doc-type

设计文档分 4 类，按**这份文档主要回答什么问题**选：

| 任务特征 | doc-type | 主要回答 | 长度 |
|---|---|---|---|
| 产品 / feature 立项，定义需求 | `prd` | what + why（用户痛点 + 目标） | 1-2 页 |
| 跨团队提案，需收 feedback | `rfc` | Is this right direction? | 3-10 页 |
| 实施前详细设计 | `design-doc` | How to build? | 5-15 页 |
| 单一架构决策记录 | `adr` | Why we decided X? | 1-2 页 |

选不准时优先 `design-doc`——最通用且最 detailed。

## 各 doc-type 骨架（速记）

详见 `references/doc-types/<type>.md`。线性递进，无元结构标签：

- **design-doc**：背景 → 目标 → 架构（架构图 / 流程图 / 时序图 / 文本总结）→ 实现（影响 / 接口设计 / 业务流 / 异常 / 单测设计）→ 方案选型（Q→选项→定）→ 验证策略（Full 场景含路径：TO 表 + 层级分组 + 不测项 + 路径覆盖状态表）→ 领域覆盖检查（见下）→ 其他（部署 ...）
- **PRD**：背景 → 目标 → 用户场景 → 验收标准
- **RFC**：背景 → 目标 → 提案（问题拆解 + 总结）→ 影响评估 → 开放问题
- **ADR**：背景 → 决策（说明 / 方案对比 / 结论）→ 后果

## 领域覆盖检查（design-doc 骨架可选节）

方案选型写完后，逐项检查以下领域是否与本次设计相关。相关的加入设计文档作为独立节，不相关的标注"不涉及"跳过。

| 领域 | 检查问题 | 参考 |
|---|---|---|
| 安全设计 | 有外部输入/认证/敏感数据吗？ | `{NOCODE_SKILL_REF}/security-guide.md` |
| 性能设计 | 有高负载/实时性要求吗？ | `{NOCODE_SKILL_REF}/performance-guide.md` |
| 可观测性 | 上线后怎么知道它在正常工作？ | `{NOCODE_SKILL_REF}/observability-guide.md` |
| 验证策略 | 怎么证明实现是对的？测试分层？ | `{NOCODE_SKILL_REF}/testing-guide.md` |
| 迁移计划 | 在替换已有系统吗？ | `{NOCODE_SKILL_REF}/migration-guide.md` |
| 前端设计 | 有 UI 吗？渲染策略/组件架构？ | `{NOCODE_SKILL_REF}/frontend-guide.md` |

小改动（3 屏内的 design-doc / ADR）不需要全覆盖。大设计（≥ 5 屏）至少检查安全+性能+验证。

## 工作流

```
0. (by overlay) 先开 worktree —— 不分入口（brainstorming step 5 / 用户直接要求写文档），写初稿前都先开；分支 design/<topic>，路径按 rule-git-worktree.md；用户显式弃用（「在主仓写」/「不要 worktree」）则跳过，并在回复点名告知
1. 判断 doc-type（按上表）
2. Read references/doc-types/<type>.md（学骨架 + 写作要点）
3. Read references/examples/example-<type>-dogfood.md + example-<type>-business.md（看 dogfood 示例 + 业务场景示例）
4. 写初稿
5. Dispatch reviewer——**默认交叉验证**（general-purpose subagent + codex 跨模型**并行各跑一遍**）。一份稿同时被两个不同模型审：交集=高置信、对称差=盲点；首轮就避开「Claude 审 Claude」同源盲区。
   - **a. general-purpose subagent**（in-harness、模板原生）：
     i. Read `skills/design-doc-writing/references/reviewer-template.md`
     ii. 把模板内容里的 `{DOC_PATH}` 替换为当前文档路径
     iii. 调用 Task tool（subagent_type=`general-purpose`，description=`"Review design doc"`，prompt=上一步替换后的全文）
   - **b. codex 跨模型**：按 `rule-codex-review.md` 场景 4 调 codex companion（reviewer-template 准则 + 文档路径）。先 `setup --json` 探测——codex **不可用才降级为仅 general-purpose** 并明说 fallback（不让 codex 成硬依赖）。
   - **合并两路 Report**：按 reviewer-template 五档（C/W/S/Q/SA）归类；两方都提的标「双方都提=高置信」、单方独有标来源；codex 自由文本先归类再并入。合并后进 step 6。
   - **降档**（仅琐碎改动 / 文案修订 / 用户显式说「轻档」）：可只跑 general-purpose 一路，回复里点名「轻档，跳过 codex 交叉」。
6. 用户确认环节（核心 gate，见下方）：
   - 默认：把 Report 完整呈现给用户，每条问题前编号，**逐条让用户勾选** fix / skip
   - 用户可一键说「全修 Critical+Warning」「全跳过」「我来给指示」走捷径
   - reviewer 已 ✅ Pass：跳过此步直接进 step 10
7. 据用户决定修订文档（in-place 改主体）；不在用户清单里的问题**不要顺手修**
8. 把本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`（无则新建）
9. 询问用户「再来一轮 review？」
   - 是 → 回 step 5（默认仍双路交叉；盲点检测信号在清理过的稿上最值钱，交集=高置信、对称差=盲点图）
   - 否 → 进 step 10
10. 保存到输出路径
11. (by overlay) 按 references/rendering/RENDERING.md 渲染 HTML
```

## 用户确认环节（step 6 细则）

reviewer 输出 Report 后，**不要自己挑哪些修哪些不修**。把决定权交给用户：

1. 把 Report 原样展示给用户（Critical / Warning / Suggestion / **Open Questions** / **Self-Audit** 五档全部保留——Self-Audit 常是隐藏的 Critical（"实施时第一行就被卡住"），Open Questions 是 reviewer 触发 Evidence Gate 但核实不到的事实疑问，**两者都绝不能漏展示**）
2. 给每条问题一个**短编号**（`C1 / C2 / W1 / S1 / Q1 / SA1 ...`），方便用户引用。**Open Questions 与 Self-Audit 也必须编号**——`Q1, Q2, ...` / `SA1, SA2, ...`；与 C/W 重叠时 reviewer 应已标注「与 Cx 同根」帮用户去重
3. 用 AskUserQuestion 或文字 prompt 让用户选：
   - 默认多选：勾选要修 / 要答的编号（含 Q、SA）
   - 提供快捷选项：「全修 Critical+Warning+Self-Audit」「全跳过」「自由指示」
   - **Open Questions 三选**：fix（按疑问反向修文档）/ skip（接受现状，作者自负风险）/ **answer**（作者贴 `path:line` 或文字答案核实，写入 Review Log；若 answer 反证 reviewer 错了，记为"reviewer 误指控"不算修订项）
4. 用户确认前**不要动文档主体**——只能等

例外：reviewer Verdict 是 ✅ Pass 时跳过这一步，直接进 step 10。

## Review Log 格式

写到设计文档末尾，每轮 review 追加一条：

```markdown
## Review Log

### Review 1 — 2026-05-12

<!-- Reviewer Report 全文（含 Critical / Warning / Suggestion / Open Questions / Self-Audit / Verdict） -->

**用户决定**：fix C1, C2, W1, SA2；skip C3（理由：暂不在 scope）、W2、S1、SA3；answer Q1, Q2；skip Q3

**本轮修订**：
- C1：背景节 补主因 vs 辅因划分
- C2：实现.异常与失败模式 补 BF2 共享异常行
- W1：影响节 路径补全到包名
- SA2：方案选型 Q3 补"AI 数轮次"工具能力假设

**Open Questions 答复**：
- Q1：`auth/session.go` 是新建文件，已在「影响」节标 (NEW)
- Q2：reviewer 误指控——`pkg/x/concurrent.go:88` 已支持并发，否决方案 B 的真实理由改为"配置侵入太大"，已修订
- Q3：skip——本文档不与 ADR-0007 冲突，是平行决策；不必修订

---

### Review 2 — 2026-05-12
...
```

Review Log 与文档主体同步演进——主体回答"为什么这样设计"，Log 留下"这份文档怎么演化来的"的审计轨迹。

## 写作准则（核心）

> **同源 note**：本节 8 条准则与 `references/reviewer-template.md`《核心审查》7 维度是同一套规则的两个视角——writer 视角"做什么"（积极指令） vs reviewer 视角"挑什么"（消极挑刺）。改一处务必同步检查另一处，避免 reviewer 不查 writer 必做的事，或反过来。

理解原则比死守章节更重要。每条附 ✅ 正例 / ❌ 反例。

### 1. 入口段必须自洽

新骨架默认无 TL;DR——文档从「背景」起步即可。
若加了 Summary / TL;DR / 提要 一类入口段，**绝不能引用全文才会出现的概念 / 缩写**——读者读完入口段必须能 grasp 核心，不需回头查。

> ✅「把 design-doc 模板从'上下半结构'改成'背景 → 架构 → 实现'线性骨架。」  
> ❌「把 design-doc 从 layer × intent 双轴改为 doc-type 主轴 + reviewer 跑 humanizer 风格附带检查。」（layer、intent、humanizer 都是文中才出现的术语）

### 2. 章节标题用内容实体，不用元结构标签

「上半」「下半」「Human Review」「Agent Implementation」一律不用——这些是告诉读者"这一节是给谁看的"的标签，消耗注意力但不传递信息。直接用内容实体名：背景 / 目标 / 架构 / 实现 / 决策 / 后果。

> ✅ `## 架构` `## 实现`  
> ❌ `## 上半：Human Review` `## 下半：Agent Implementation`

### 3. 节间承上启下

每节开头一句承接上一节的结论，读者跳读时能 trace 论证链。

> ✅ 架构.文本总结末尾："整体架构为 X，关键组件 A/B/C 各负责 Y/Z/W"；实现节开头："按以上总结，本节展开 BF1-BF3 三条业务流。"  
> ❌ 架构节末尾戛然而止；实现节直接讲第一个文件改动

### 4. pain point 分主次

「背景」节列多条问题时，必须**显式标注主因 vs 辅因**。允许一句话定主因（"核心问题是 X；附带还有 Y、Z"），不允许平铺 5 条 bullet 让读者自己排序。

> ✅「核心问题：每次新会话项目背景丢失。附带的 wiki 缺自动维护、跨项目共享难——本 doc 不解决。」  
> ❌「问题：1. 重复配置 2. 缺一致性 3. 项目记忆丢失 4. 文档质量参差」（4 条平铺，不知道哪条最痛）

### 5. 方案选型 ↔ 业务流 通过 BF 编号交叉引用

「方案选型」的 Q→选项→定 决策，如果直接影响某条业务流的实现路径，**在「定」一行末尾标注 `→ 影响 BFx`**。reviewer 看完方案选型能跳到对应 BF 验证决策落地。

不强制 1:1——方案选型记的是**重大决策**，业务流列的是**核心路径**，二者颗粒度不同。但落到代码的关键选型必须能追到 BF。

> ✅ Q1 定：「sanitizer 用 64 字符滑窗。→ 影响 BF2」；BF2 伪代码注释里能看到 `HOLD_SIZE=64`  
> ❌ Q1 定：「重试一次」，业务流里没任何 BF 出现"重试"，决策与实现脱节  
> ❌ 业务流列了 5 条 BF 但方案选型只 1 项 Q——大概率漏记了关键选型

### 6. 项目内部术语首次出现 inline 解释

业界通用名词（HTTP / PostgreSQL / TDD / retry / callback）不解释；**项目内自创词或缩写**（dogfood / two-half / humanizer / 自定义 component 名）首次出现必须一句话 inline 解释或链接 glossary，后续可直接用。

> ✅「dogfood（用自己产出的工具实测）本插件历史决策……」  
> ❌ 通篇用 humanizer / two-half / 自定义 sanitizer 却没告诉读者这是什么

### 7. 小黄鸭式讲解：把每一步的"为什么"讲透

把读者当成完全没看过这个项目的小黄鸭——每个决策、每个跳跃、每个数字都要 explain。遇到「显然」「众所周知」「不言而喻」→ 信号说明跳步了，回去补"为什么"。

数字 / 阈值 / 模块名 / 行号 都要交代来源——不允许 magic number。

> ✅「`HOLD_SIZE = 64` 字符。来源：入口点最长 `NumberFormatConfig.percentage(`（30 字符）+ LLM token chunk 平均 3-5 字符 × 容差 → 64 字符滑窗才能稳定捕获跨 chunk 拼接。」  
> ❌「`HOLD_SIZE = 64`（显然够用）。」

### 8. 直白讲：用最简单的话讲复杂概念

如果一句话讲不清楚某个概念，说明你也没真懂——回去搞懂再写。复杂机制用简单例子 / 一行伪代码讲明白，**先讲直觉、再补细节**，不要一上来堆术语，**也不要硬塞类比**——类比常常把简单事情说复杂。

检验：能教一个**从没接触过项目的同事**吗？如果一份 design doc 拿给他读完，他能复述出问题 / 解法 / 权衡 → pass。复述不出来 → 你写得不够清楚。

> ✅「sanitizer：流入 chunk 先囤进 64 字符滑窗；符合 DSL 入口点特征（`Query.from(` 等）的整段丢弃；普通字符 overflow 后正常下游送给 SSE。」
> ❌「sanitizer 基于 sliding-window heuristic entry-point detection 实现 hold-and-scan 流式预处理管道。」

### 9. 视觉化优先：内容形态必须匹配视觉媒介

**design-doc 可读性的命脉规则**——≥3 个并列项 / 对比关系 / 流程 / 状态转换 / 矩阵关系**禁止**写成连续长段，必须用对应视觉媒介。长段 wall of text 在技术文档里几乎总是错的：读者抓不住结构、reviewer trace 不了论证链。

| 内容形态 | 用什么 | 反例（禁用） |
|---|---|---|
| 多个对比维度（≥3 个 cell） | **表格** | "A 是 X，B 是 Y，C 是 Z" 长段 |
| 时序流程 / pipeline | **ASCII 流程图**（节点 + ↓ 串联） | "首先 A，然后 B，接着 C" 长段 |
| 组件拓扑 / 数据流 | **ASCII 架构图**（方框 + 连线） | 散文描述"A 调 B，B 又调 C" |
| 状态转换 | **状态机图**（节点 + 标 transition 条件的箭头） | "X 状态可以转到 Y 也可以转到 Z" |
| 决策分支 / if-else 流程 | **决策树**（条件 + 分支 + 结果） | "如果 X 则 Y，否则 Z；Y 时如果 W 则..." |
| 二维关系（任务×指标 / 阶段×角色） | **矩阵表** | 罗列每个 cell 内容 |
| 阶段时间线 | **横向时间线** / 阶段表 | 段落叙述各阶段 |
| 层级 / 分类 / 文件结构 | **ASCII 树**（`├─` `└─` 前缀） | 缩进列表也行但树更直观 |

**「先图后文」原则**：图放前面（让读者先看图理解结构），文字解释放后面（补充图里没传达的细节）。**禁止**"5 段文字 + 1 张图作总结"反向布局——读者读完文字已经累了，图变成附录。

**图密度参考**：
- 普通 design-doc：至少 1 张架构图 / 流程图
- 矩阵驱动场景（评测体系 / 路由表 / 状态机 / 协议类）：至少 2-3 张（quick-view 锚点节必有 + 各章节按需）—— 见 `references/cards/quick-view.md`
- 长文档（>10 屏）：平均 1-2 屏 1 张图作节奏锚点

> ✅「3 层打分共性观察」用矩阵表（任务类型 × {L2 权重 / L3 权重 / Judge 敏感度}）一目了然
> ❌「类 1 的 L2 权重重 L3 权重轻 judge 不敏感；类 2 的 L2 权重重 L3 权重轻...」4 段并列文字
>
> ✅「单 case 流转」用 ASCII 流程图（节点 + ↓）
> ❌「先做意图识别，然后跑 agent，接着 3 层打分，最后采集过程指标」一长段

## 可选增强：骨架驱动型 design-doc 的 references/cards/

针对**骨架驱动**型内容（矩阵 / 管线 / 状态机 / 协议 / 评测体系 / 路由表 / lifecycle 等非线性结构），doc-type 主轴（背景 → 目标 → 架构 → 实现 → 方案选型 → 后果）可在「目标」节之后**插入锚点节**，让读者前 3 屏抓骨架：

| 锚点 reference | 适用场景 | 节位置 | 详见 |
|---|---|---|---|
| `quick-view` | 整体结构是矩阵 / 管线 / 状态机 / 协议 | 「目标」之后、「架构」之前 | `references/cards/quick-view.md` |
| `prerequisites` | 实施前必须明确的 runner / 基础设施 / 依赖假设 | `quick-view` 之后（如有）、「架构」之前 | `references/cards/prerequisites.md` |

**不替代 doc-type 主轴**——是可选增强。线性叙事的 design-doc（「背景 → 方案对比 → 结论」决策驱动）不需要 `quick-view`；已有完整基础设施的 feature design 不需要 `prerequisites`。

何时不加锚点节：单一架构决策（ADR）、决策驱动型 feature design、小改动（3 屏内）—— 这些骨架本身就是结论，硬加锚点是 over-engineering。

## 可选工作流变体：两阶段填充（骨架轮 → 丰富轮）

适合 **brainstorming step5 写第一稿**或**大型设计文档**（>5 屏）——先快速过完整体骨架（每个章节 1-3 句），让用户 ack 整体方向，再逐章丰富。

```
Phase A — 骨架轮：
  每章节 1-3 句（背景一句话、目标一句话、架构一句话总结 + ASCII 图、实现 BF1-BFn 各一句标题、方案选型 Q1-Qn 各一行）
  → 用户看完整体骨架 → ack（整体方向对 / 哪里要调）

Phase B — 丰富轮：
  按 Phase A ack 后的骨架，逐章节展开完整内容（含 BF 业务流伪代码、Q 决策推演、ASCII 架构图等）
  → 进 step 5 双路 review
```

**何时用**：
- brainstorming step5：agent 写第一稿，骨架不确定时
- 大型 design-doc（≥5 屏，≥5 个章节）：避免逐章写完发现整体方向错
- 用户明示「先骨架后丰富 / 先看整体再细化」

**不用**：
- ADR / 小改动 / 已有清晰骨架（直接写就行）
- 用户明示「一稿到位 / 不要分两阶段」

**与强制 review 的关系**：两阶段填充**不替代** step 5-9 的双路 review + 用户逐条确认 + Review Log——review 仍在 Phase B 丰富轮完成后跑。

## 实现的边界：design-doc vs plan vs ops doc

design-doc 是 reviewer challenge **设计**是否合理的层级，不需要 reviewer "逐行照抄成代码"——后者是 plan 的工作。同理部署节只写策略，详细 runbook 是 ops doc 的工作。

### design-doc 「实现」节止于

- **影响**：多模块 ASCII 树 + (改)/(NEW) + ①②③ 改动要点。**不是**散文描述、**不是**长文件列表
- **接口设计**：按面分 3 段 (按需展开)
  - **对外 API** (前后台对接 / 跨服务): HTTP / RPC / GraphQL endpoint 表 (Method / Path / Request / Response / 错误码); 涉及前后台对接必有本段
  - **数据模型** (DB schema + 表关联): CREATE TABLE + 索引/UNIQUE 约束; 多表外键关联必画 ER 图
  - **内部接口** (类 / 模块): public 方法签名 / 关键字段 / 对外状态; 多类协作时加 ASCII 类图
- **业务流**：BF1/BF2/... 编号，每条 `function`/`method` 签名 + 函数体行，主路径 + 异常路径，每行 `//` 注释。**不是**文件结构树、**不是**层次列表、**不是**散文
- **异常与失败模式**：表格含「所属 BF / 场景 / 触发 / 处理 / 上抛吞」5 列
- **单测设计**：按 BF 分组，每条 case 用 Given/When/Then 三行；**不写代码** (不写 `@Test` / mock setup / assertion 语法)

**业务流伪代码硬规则**：

- 必须用 `function` / `method` 签名 + 函数体行（每行一句意图）
- **每行都要有 `//` 注释**——小黄鸭式讲解，不允许"显然"。简单流程注释可短，复杂逻辑 / 数字阈值必须讲来源
- 命名用真实类名 / 方法名（如 `AgentLoop.callLlmForTurn`），不用 placeholder
- 涉及数字 / 阈值时注释里讲清来源（如 `// HOLD_SIZE=64，来源：最长入口点 30 字符 + chunk 容差`）

**对的写法示例**：详见 `references/doc-types/design-doc.md`《业务流》节或任一 example 的「BFx」段。

**错的写法**（这是文件层次描述，属于「影响」节）：

```
NinesAgent.java
  ├─ setContentStreamHandler 包装
  └─ finally 块 flush
AgentLoop.java
  ├─ instanceof 白名单
  └─ catch + 注入
```

### design-doc 「其他.部署」节止于

- **灰度策略**: 比例 / 分组 / 时长一句话
- **回滚预案**: 触发条件 + 回滚操作一句话
- **监控指标**: 新增 metric 名 + 阈值

详细命令 / K8s manifest / Ansible playbook / 跑批脚本 → ops doc。

### 留给 plan（writing-plans skill）

- class 内部具体实现（私有方法 / 循环 / retry 退避算法 / null 检查）
- TDD 步骤化清单（先写哪个测试 → 再写哪段实现）
- 每步验证命令
- 单测的具体 mock 工具用法 / fixture 数据 / setup-teardown 顺序

### 留给 ops doc

- 详细部署脚本 / K8s manifest / Helm chart
- 监控 dashboard 的具体配置
- 告警的 runbook（具体处理步骤）

**判据**：design doc 回答"为什么这么设计 + 关键路径长什么样"；plan 回答"按什么顺序写代码"；ops doc 回答"出问题了怎么操作"。

## 「影响」节硬格式

多模块 ASCII 树 + (改)/(NEW) + ① ② ③ 编号要点。例：

```
fx-agent-workspace-api/                                ← API 模块
└── src/main/java/com/fanruan/core/agent/workspace/observe/
    └── AgentEvent.java                 (改)  新增 OutputViolation record

fx-agent-workspace/                                    ← impl 模块
└── src/main/java/com/fanruan/core/agent/workspace/agent/
    ├── loop/
    │   ├── OutputViolationException.java   (NEW)
    │   └── AgentLoop.java                  (改)  ① 1802 行 instanceof 白名单加 OutputViolationException
    │                                              ② callLlmForTurn 加 catch
    │                                              ③ 新增 injectOutputViolationCorrection 方法
    └── nines/
        ├── NinesContentSanitizer.java      (NEW)
        └── NinesPrompts.java               (改)  事前防御硬规则
```

要求：路径完整到包名（不缩略）；同一文件多处改动用 ①②③ 编号；行号 / 函数名能给就给。

## 架构图 / 流程图 / 时序图

默认 ASCII，**可选**——内容简单时省略，命名/结构 writer 自决。

**总分两层**——复杂设计单图必爆，要拆：

- **总图**（`## 架构 → ### 架构图 / 流程图 / 时序图` 节）：聚焦组件关系 / 主链路 / 跨角色协作，让 reviewer 30 秒 grasp 全局
- **子图**（`### 业务流.BFx` 节下）：单条 BF 如果有局部状态机 / 多分支 / 详细 sequence，纯文字读不下去时画

三种图分工：

- **架构图** — 组件间静态依赖。触发：新增 / 调整模块边界
- **流程图** — 单一请求从输入到输出的串行决策。触发：多分支判断 / 状态转换
- **时序图** — 多角色随时间的消息往复。触发：异步 / RPC / 跨服务 / 多角色协作

完整规则详见 `references/doc-types/design-doc.md`《架构图 / 流程图 / 时序图》节。

mini cheat sheet：

- **组件**：方框 `┌─┐ │ │ └─┘` 或 `+---+`
- **依赖**：`→` 或 `↓`
- **时序消息**：角色列 + 横向箭头 + 时间向下
- **粒度**：总图 组件 ≤ 7 / 流程节点 ≤ 10 / 时序角色 ≤ 5，超了 → 下沉到子图，不靠把总图画大

## 常见反模式

> 内容层反例已分散在《写作准则》8 条每条的 ❌ 反例里，本节只列**写作准则未覆盖的工作流 / 选型 / 套话**反模式。

- ❌ **章节空话**：「需要保证安全性、性能」「值得一提」「未来可扩展」——无具体内容的填充段
- ❌ **跳过 reviewer**：不 spawn reviewer 直接交付——评审是工作流硬 gate
- ❌ **代用户拍板**：拿到 Report 自己挑修哪些——用户确认是 hard gate
- ❌ **吞 Review Log**：只 in-place 改主体不 append Review Log——审计轨迹断
- ❌ **混淆 doc-type**：PRD 写 SQL schema / ADR 写百页 implementation / Design Doc 写不到 1 页

## 看 examples 学结构，不照搬措辞

每个 doc-type 在 `references/examples/` 下有两份示例：

- `example-<type>-dogfood.md`：dogfood 本插件历史决策（skill 内部场景）
- `example-<type>-business.md`：业务场景示例（虚构 SaaS 公司 ContextCo 把登录改造成 SSO+MFA 的一条故事线，从 PRD → RFC → Design Doc → ADR 串起来）

两份各有价值——dogfood 看 meta 决策怎么记，business 看 B2B 工程场景怎么写。

**看 example 学骨架，但不要照搬措辞 / 不要套业务情境概念**。三点提醒：

- **措辞按你的语境调**：example 反复用「核心问题 / 附带问题 / 不决定的代价 / 力的对抗」这套连接词——是**结构提示不是模板填空**。你的文档按你领域的术语重写，不要让产出文档读起来都是同一个人的口吻
- **方案选型数量不要硬凑**：example 演示了 3-5 项 Q→选项→定，但**你的设计核心可能只有 1 个关键决策**——就写 1 项；强凑 3 项反而稀释重点。方案选型数量应由设计本身的复杂度决定，微小决策不必入档
- **伪代码注释密度按复杂度调**：example 演示得很饱满（每行 `//` 讲来源），但简单流程（如"调 LLM → 解析 → 存库"三步）不需要每行加来源注释——只有数字/阈值/非显然选择才必须讲来源。机械全注释反而稀释重点

目标：结构对得上 example，措辞与颗粒度匹配你的场景。比无参照自由发挥可靠，比无脑照搬 example 也可靠。

## 状态机

各 doc-type 状态机：

- **PRD**：`draft → in-review → approved → implemented → archived`
- **RFC**：`open → accepted → implemented → superseded` / `open → withdrawn` / `open → rejected`
- **Design Doc**：`draft → in-review → approved → implemented → archived`（**living**，approved 后仍可修改）
- **ADR**：`proposed → accepted → superseded` / `proposed → rejected` / `accepted → deprecated`（**immutable**，accept 后绝不改）

注：ADR 一旦 accept 不可修改；改决策就写新 ADR + supersede 旧的。

## 输出路径

路径由 `{dev_design_output}` 变量定义（见 `model/agent-about.md`「文档产出路径变量」）。同 topic 的 plan 等文档落同一目录。
