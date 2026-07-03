# reviewing 流程骨架 — 通用 review 的"怎么走一遍"

> 这是 `reviewing` 引擎的**流程骨架**。引擎（被 `Skill(nocode:reviewing)` 调用）按本文走 7 步流程；调用方只传第 3 步的领域维度，不 Read 本文。骨架管"怎么走"，方法库管"用什么打法"，findings 契约管"产出长什么样"。
>
> **单一源契约（多对一）**：review 怎么执行——档位深度（§1）、升档判据（§1a）、主路执行方式（§4.0：轻档就地 / 中档 subagent / 重档 subagent+codex 双路）、异源派发与降级链（§4.2）——**只在本文定义**。任何细则 / 调用方 skill / rule 涉及 review，一律写「按 reviewing skeleton 流程走」+ 自己的领域维度 / 材料 / Gate，**不复述执行机制**（模型、升档信号、降级链等不出现在本文以外）。要改默认行为（换 reviewer 模型、改升档阈值）**只改本文**——别处是引用不是副本，改了本文就全生效。
>
> **本文是给 agent 照做的判据，不是可执行代码。** 文中的 `classify / selectMethods / dispatchIndependent / evidenceGate` 是 review 的逻辑环节名，对应下面的判据表和 how-to —— agent 读完照判据自己做，不是调函数。

---

## 0. 三个共享件（细则按需 Read）

| 件 | 路径 | 管什么 |
|---|---|---|
| 本骨架 | `references/skeleton.md` | 7 步流程 + 分档 + 方法选择 + 公共能力 |
| findings 契约 | `references/findings-contract.md` | finding/verdict schema + 5→3 分级映射 + Evidence Gate 入 schema |
| 方法 card | `references/methods/<method>.md` | 每个评审方法的维度表/输出契约/派发策略 |

> 方法 card 分两类：**真方法**（checklist / red-blue-adversarial / threat-modeling / perspective-based / error-mechanism + 4 个领域 card）由 §3 按评审对象选，回答"用什么眼光看"；**档位默认执行形态**（self-review / dual-review）不进 §3 选择表，由档位（§1）直接决定，回答"谁来看、跑几路"——轻档统一走 self-review，重档统一走 dual-review 的双路合并机制，调用方不点名、不挑选。

---

## 1. 分档判据（步骤 1 = `classify`，公共前置）

review 不是越重越好。先按**评审对象的风险 + 可逆性**定深度，再决定走多深。

**下表给的是起始档，不是终态**——分档只发生一次，但档位在执行过程中还会按 §1a 动态上升（只能升不能降）。起始档定的是"从哪里开始看"，不是"最多看多深"。

| 信号（任一命中） | 档位 | 含义 |
|---|---|---|
| **可逆** + **单文件 / 单点** + **易回滚**（命名、文案、风格、无逻辑变更的内部小改） | **轻档** | 主会话就地自查（§4.0）——按 self-review 清单过一遍，不派 subagent、不拉 codex |
| **可逆** + **多文件但同模块内** / **有实际逻辑变更但影响面可控**，且不命中下方重档信号 | **中档** | 派 1 个隔离 subagent（§4.0）按领域维度 checklist 单路全量审 |
| **不可逆** / **跨模块** / **涉及外部输入·认证·敏感数据·加密** / **架构或选型决策** / **数据库 schema·migration** / **并发原语** / **资金相关** / **多方案僵持** / 用户显式说"深度 / 仔细审 / 红蓝军" | **重档** | 直接派 subagent + codex 双路（§4.0）按领域维度 checklist 双评，合并取交集 |

**模糊时默认轻档**：判据表未命中、或拿不准是否命中 → 轻档——这是起始档，不是判死；"能否 5 分钟内回滚"只作辅助，明确回滚不了 = 命中"不可逆"走重档，只是拿不准 ≠ 命中。

**降档权（档位怎么来的，决定谁能降）**：判档由 agent 自动做——没命中中/重档信号就是轻档，命中中档信号但没命中重档信号就是中档，这是判档不是降档，不需要授权。命中中/重档信号、或调用方声明强制某档后要降 → 只认用户显式否定词（"轻档就行 / 跳过 codex / 不用深审"），模糊信号（"快速看看 / 先出草稿"）不算授权（对齐 `model/agent-about.md`"偏离 rule/skill 触发需用户显式授权"）。

**边界示例**：
- 改对外 API 字段名：代码可逆但已发布 client 会破 → **重档**
- 升主框架 / 语言运行时大版本 → **重档**
- 一段 SQL migration（哪怕只一行） → **重档**（不可逆 + 数据风险）
- 一个功能模块内新增 / 调整业务逻辑，多文件但不碰外部输入 / 认证 / 数据层 → **中档**
- 升 lint / formatter / 单测库 → **轻档**
- 调一个内部函数命名 → **轻档**

> 档位是**深度旋钮**，管的是谁来审、跑几路——轻档主会话自查一路，中档隔离 subagent 一路，重档 subagent + codex 直接双路（不需要先经过中档再判断升不升档）。执行方式见 §4.0；起始档判完之后仍会按 §1a 动态上升。

## 1a. 升档判据（档位只能上升，不能下降）

§1 给的是**起始档**，不是终态。**轻档、中档执行中只要读到实际内容命中更高档信号，必须升档**——不是"审完再回头判断要不要升"，是随时命中随时升，机械匹配、不经自由裁量。重档已是最高档，执行完仍有疑虑走 §4.4 Doubt Theater（换方法 / 换独立源），不是升档。

**触发源一：静态信号复用（贯穿全程）**——§1 那张信号表不只在分档那一刻用一次。审查过程中读到的**实际范围**（不是分档时看到的表面范围）一旦命中更高档信号，立即升到对应档位，不必逐级爬。典型场景：轻档看起来是"改一个字段默认值"，读代码发现这个字段会被序列化进对外 API → 命中"外部输入"信号 → 直接跳重档，不必先经过中档。

**触发源二：审查过程发现（该档执行完才能判断）**——轻档自查或中档 subagent 跑完，命中下列任一信号 → 升档重新派：

| 升档信号 | 说明 |
|---|---|
| **审出无法裁决的 finding** | Critical 拿不准是否成立、或 open-question 堆积且主会话/作者裁决不了——需要更高独立性视角定夺 |
| **结论有争议** | 多方案僵持、执行者结论主会话自己都不确定、或用户/调用方对结论提出异议 |
| **用户显式要求** | 「深审 / 仔细审 / 红蓝军 / 找 codex 看看 / 异源交叉」 |
| **Doubt Theater 命中**（§4.4） | 连续 2+ 轮有发现但 0 条 actionable——换更高独立性正是它的升级出口 |

**升档动作**：换到目标档位对应的干净语境重新执行（§4.0）——不是在当前语境接着往深审。已经做过的低档审查不带入新一轮，最多降格成一句 hint 随对象一起转交给新派的执行者，不作为审查结论的一部分。升档目标是**信号对应的档位**，不是逐级爬。

- 全不命中 → 该档收口（步骤 6/7），verdict 独立性按该档默认值标注（轻 = 无 / 中 = 同源隔离 / 重 = 异源）——这是默认路径，不算偷工。
- 信号命中后要跳过升档 → 只认用户显式否定词（同 §1 降档权），agent 不许自行找理由（"应该没事"）压掉信号。
- 自带完整对抗流程的 skill（red-blue-deep / dev-plan Step 8）不经本判据，按其自身流程派发。

---

## 2. 七步流程详解

每步"做什么 → 产出什么"。细则照走，只有第 3 步是自己的领域内容。

| # | 步骤 | 做什么 | 产出 |
|---|---|---|---|
| 1 | **分档** | 按 §1 判据表定轻/中/重档——这是起始档，执行中还会按 §1a 动态上升 | `depth = light \| medium \| heavy` |
| 2 | **对象界定 + 进入 gate** | 明确评什么（diff / 设计文档 / 方案 / restate）、范围边界、前置条件是否满足（如 dev-review 要求 Verify Gate 已过）。前置不满足 → 不进 review，回退 | 评审对象 + 范围 + gate 通过 |
| 3 | **评审维度**（细则注入点） | **骨架不规定具体维度，细则在这里填自己的领域维度表**（dev-review 五轴 / define-review 7 维 / 安全 OWASP …）。维度 = 后续 finding 的 `axis` | `domainAxes[]` |
| 4 | **主路审（按档位执行）** | 按 §4.0 以当前档位的执行方式跑：轻档主会话按 self-review 清单自查；中/重档按 §3 方法选择表 + 档位选 1+ 种方法，逐个 Read 对应 card，把评审对象原文 + 领域维度 + Context Capsule 打包派发（重档同时派 subagent + codex 两路） | 主路 raw findings |
| 5 | **升档重跑**（§1a 触发，仅轻/中档适用） | 轻档或中档执行中命中 §1a 升档信号 → 回到步骤 2，以信号对应的更高档位重新执行步骤 2→4；原档位结论不带入新一轮，最多降格成一句 hint。重档已是最高档，若执行完仍命中升档类信号，按 §4.4 Doubt Theater 处理（换方法 / 换独立源），不再有更高档可升 | 新档位下的主路 findings（覆盖旧结果） |
| 6 | **findings 统一 schema + 分级** | 把各路 raw findings 归一到 `findings-contract.md` 的 schema：查 5→3 映射表定 `severity`（C/W/S）、Q/SA 转 `kind`、security High 上提 Critical；按 `[location, axis]` 去重（交集 = 高置信）；过 **Evidence Gate**（见 §4） | 归一 findings[] |
| 7 | **收口 / triage / 拍板** | 排序呈现（correctness/security 优先，少而精）；**Critical 必修不可 override**；产出 verdict（approved + counts + recommendation）；交用户逐条拍板 | verdict + 用户拍板 |

> 轻档：1→2→3→4（主会话自查）→7，6 退化为一句表态，步骤 5 默认跳过。
> 中档：1→2→3→4（单 subagent checklist 全量审）→6→7，步骤 5 默认跳过，命中 §1a 才回跳到更高档（通常是重档）。
> 重档：1→2→3→4（subagent + codex 双路直派）→6→7，不再触发步骤 5（已是最高档，仍有疑虑走 §4.4）。

---

## 3. 方法选择表（步骤 4 = `selectMethods`）

本表只回答**评审对象该用什么眼光看**（checklist / red-blue-adversarial / threat-modeling / perspective-based / error-mechanism）——这些是可选的"真方法"。**档位决定跑几路、谁来跑，不在本表选**：轻档不查本表，直接按 self-review 清单走；中/重档查本表选方法后，按 §4.0 用对应路数执行（中档 1 路，重档 2 路取交集，合并规则见 `methods/dual-review.md`）。

| 评审对象 | 默认方法 | 备选 |
|---|---|---|
| **代码 diff** | `checklist`（领域维度，通用质量清单载体 = `code-quality-method`） | `error-mechanism` |
| **方案 / 决策 / 架构选型** | `red-blue-adversarial` | `perspective-based` |
| **设计文档** | `checklist`（领域维度） | — |
| **安全**（外部输入 / 认证 / 敏感数据） | `threat-modeling` + `checklist`（`security-method` card · OWASP） | — |
| **数据库**（SQL / schema / migration） | `checklist`（`database-method` card） | — |
| **架构决策** | `checklist`（`architecture-method` card）+ `red-blue-adversarial` | — |
| **需求 / PRD / restate** | `checklist`（领域维度） | — |

> **red-blue vs dual-review 分界**：`red-blue-adversarial` 是**有防守方的对抗**（蓝军防守提议、红军攻击），回答「该不该 / 选哪个」，主产物是 `verdict.recommendation`，走它自己独立的轻/重两档（见该 card），不套本表的三档。`dual-review` 不是可选方法，是**重档默认的双路合并机制**——重档下本表选出的任一方法都跑两路（subagent + codex），回来按 dual-review 规则合并，回答「这份工件有什么问题」。误用症状：工件缺陷发现误走 red-blue 会诱导主路去"防守"工件（护短）；拍板题当成 dual-review 走两路中立挑错则没人做立场论证。分界详表见 `methods/dual-review.md`。

**db / architect 的"接线"就在这张表**——细则审到 SQL/migration 或架构决策时，据此选 `database-method` / `architecture-method` card，**不经 manifest 路由**（框架走 reference 不进 manifest）。"补接线" = 在本表加"对象 → card"映射，不改 manifest / generate。

**怎么用**：
1. 定对象类型 → 查表取默认方法集。
2. 定档位（§1）：轻档不用本表；中档单路跑本表选出的方法；重档双路跑（§4.0）。
3. 一个对象可命中多行（如"代码 diff 且碰认证" → 同时取代码行 + 安全行的 card）。
4. 逐方法 `Read references/methods/<method>.md`，card 内有该方法的维度/输出契约。

---

## 4. 公共能力 how-to（框架级，方法不各写一份）

这些是横切关注点，骨架统一定义，方法 card 和细则直接引用。

### 4.0 主路派发（三档执行方式，步骤 4 的执行方式）

> **本节是主路执行者的唯一定义点（default 单源）**——细则与方法卡只写「执行者见 skeleton §4.0」，不复述执行者 / 模型 / 派发参数；要换默认 reviewer（如 sonnet → 其他模型），只改本节。

三档换的是**执行者和路数**，不是换审查眼光——方法（§3 选出的 checklist / red-blue 等）不变，变的是"谁来跑、跑几路"：

| 档位 | 执行者 | 路数 | 独立性 |
|---|---|---|---|
| **轻档** | 主会话就地 | 1 路（自查） | 无 |
| **中档** | 隔离 subagent | 1 路 | 同源隔离 |
| **重档** | 隔离 subagent + codex | 2 路，直接双派 | 异源 |

**轻档 —— 主会话就地自查**：不派 subagent、不拉 codex。按 `references/methods/self-review.md` 的自查清单过一遍产出对象本身。**独立判断，不背书**：自查不是回顾"当时为什么这么做"或确认"这个决定当时是对的"——那是在给之前的判断背书，不是在审查。放下产出过程中的推理和已下的结论，只看产出本身现在站不站得住，具体纪律见 `self-review.md`。

**中档 —— 单路隔离 subagent**：主会话多半是工件作者，自己审自己看不出自己的假设错，盲区结构性存在——派给一个隔离 subagent 执行：

```
Agent({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "主路评审（sonnet subagent）",
  prompt: "<评审对象原文 + 领域维度表（步骤 3 注入）+ Context Capsule（§4.1）+ findings 契约要点（location + evidence + severity 建议）>"
})
```

- **prompt 同样吃 §4.1 CLAIM 剥离**：只传对象原文 + 约束 + 维度 + 中立事实包，不传作者的预期结论 / "我觉得没问题的地方"——主路 subagent 的价值就是不带作者视角。
- 按领域维度 checklist（或 §3 选出的其他方法）全量逐项过。
- **返回物**：raw findings（每条带 location + evidence + severity 建议）。主会话收回后做步骤 6 归一——只做 schema 归一 / 去重 / Evidence Gate，**不复审改写 findings 内容**（改写 = 作者视角回灌，主路白派）。成立性拿不准的条目留给步骤 7 用户拍板或走 §1a 升档，不由主会话单方压掉。

**重档 —— subagent + codex 双路直派**：不再"先派 subagent 审完再判断要不要拉 codex"——命中重档信号本身已经说明这份对象值得两路独立视角，两路同时派出，各自隔离执行，回来按 `methods/dual-review.md` 的规则合并取交集。subagent 一路同中档执行方式；codex 一路见 §4.2。

**降级**：中/重档的 subagent 派不出去（极端环境）→ 主会话自审替代，独立性标「无（自审），原判 X 档降级」并明说降级——这和轻档默认自查是两回事，必须点破是降级不是常态。

### 4.1 CLAIM 剥离（隔离审查的前提）

派隔离审查（中/重档主路 subagent / 升档 codex / fallback subagent）时，**只传"被评审对象的原文 + 约束条件 + 维度清单",绝不传派发方（主会话＝作者；对抗型即蓝军）已得出的审查结论或倾向**。（轻档就地自查不隔离、不涉及本节。）

- ✅ 传：restate 原文 + 真约束 + "请按这些维度攻击这份需求定义"
- ❌ 不传："我觉得 SC-3 不可测，你看对不对"——这会把独立路诱导成确认路，假独立。
- 目的：让独立路从零形成判断，与主路的交集 = 高置信、对称差 = 各自盲点。被诱导 = 失去独立性价值。

**剥结论、留约束 —— Context Capsule**：CLAIM 剥离剥的是主路的**结论与倾向**，Capsule 补的是**约束性事实**，不是决策的心路历程。判据：一条信息如果是"这里不能做 X"（边界 / 约束，独立路不知道会真误报）→ 装；如果是"我们讨论后认为 X 更好，因为 Y"（推理过程、决策心路历程）→ 不装——独立路读到"这是已经讨论过、有人权衡过的决定"，会倾向去确认而不是去质疑，这正是把独立路变成确认路的来源。

Capsule 装：

- **硬约束与预算**（成本 / 时延 / 依赖 / 兼容性 / 接口签名不可改 / 必须向后兼容……）——边界条件，独立路不知道会真误报
- **非目标 / Out of Scope**——同上，防止独立路把"没做"当成"漏做"
- **已知缺失上下文声明**：明说「以上是全部已知事实约束」或列出未提供项——独立路依赖但未提供的上下文，相应判断标 `kind=open-question`，不硬上 Critical/Warning

Capsule 不装：

- 已拍板决策**为什么**这么定的推理过程——独立路读到"这是权衡过的决定"会倾向不质疑，该发现的问题被理由挡住
- 被否决方案的完整来龙去脉——独立路读到"这个方案被否决过"会把它当禁区，即便当前场景下它其实该被重新提出
- 主路分析 / 倾向 / 已得 findings——装了就把独立路诱导成确认路

约束不带理由会显得突兀（比如"接口签名不可改"不说为什么），这是有意的——独立路不需要认同这个约束，只需要照它去评估方案是否满足，认不认可决策本身不是它的工作。上下文缺口的代价仍不对称：约束漏喂会让独立路对着一个不知道的边界误报，但补一份够用的约束清单就能盖住这个代价；理由喂多了换来的是系统性漏报（独立路被讲过的道理说服，不再质疑）——比约束不够的代价更贵，所以宁可 Capsule 的约束部分打包多一点，也不把决策理由塞进去。

### 4.2 codex 经 `rule-codex-review` 派（异源单一通道）

> 何时派见 §1（重档直接）与 §1a（升档触发）；本节只管怎么派。

异源攻击/审查**统一走 `rule-codex-review`**（`{CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`），不另起通道：

1. **不预先探活，直接派发**：决策/选型类用 `task`（只读，传 CLAIM 剥离后的对象 + 约束 + 维度）；对应一段具体 diff 用 `adversarial-review --wait`；纯缺陷查代码用 `review`。**实际调用派 subagent 执行**（`Agent()` 包一层 Bash），不在主 agent 直接 Bash 跑这条命令——原始输出别堆进主 agent context。具体派发模板见 `rule-codex-review.md`。
2. **降级**：subagent 返回报错（未装 / 未登录 / 其他运行时错误）→ **不静默跳过**，fallback 改派 general-purpose subagent 单跑独立路（prompt 同样 CLAIM 剥离 + Context Capsule）+ 明说"codex 调用失败，fallback 至 subagent 独立审查"，独立性声明标"同模型（降级）"而非"异源"。subagent 也不可用（极端环境）才由主会话自评替代，独立性标"无"并明说。**不许主会话"自演红军/独立路"替代隔离执行**——自攻自手下留情，隔离上下文是独立性的最低保障。

> codex 是**异源独立性**的来源；它不可用时降级不阻断，但必须在 verdict 里如实标独立性档位下降。

### 4.3 Evidence Gate（防猜测式指控）

**代码事实类 finding 要上 Critical / Warning，必须带 `location`（file:line 或 `[章节锚点]`）+ `evidence`（原文/代码摘录）。**

- 缺 location 的代码事实类 finding → **不许上 Critical/Warning**，降级 `kind = open-question`（待核实），severity 另算（默认 suggestion）。
- 道理：没有 evidence 的 finding 是直觉不是评审。"这里可能有并发问题"但指不出哪行 = open-question，让作者去核，不是阻塞性指控。
- 非代码事实类（如方案权衡、风格建议）不强制 location，但要有可追溯的理由。
- 具体降级规则与 schema 字段见 `findings-contract.md`。

### 4.4 Doubt Theater 检测（防表演式 review）

**连续 2+ 轮 reviewer 有实质发现、但 0 条被分类为 actionable**（全被"其实没问题/可以接受"消化）= 在**验证不是在评审**。

- 命中 → **停下升级**：要么换方法（清单查不出 → 上对抗），要么换独立源（同模型盲区 → 拉 codex），要么显式记录"本轮确实无 actionable，依据是 X"——不许靠不断"复核确认"刷出"没问题"的假象。
- 反面：每条 finding 都被作者一句话挡回去且 reviewer 立刻认同 = 典型 doubt theater。

### 4.5 分档判定复用

§1 的分档判据是公共件——任何细则需要"判这次 review 该多重"时引本表，不各写一套档位定义。红蓝对抗方法 card 有自己独立的 light/heavy 判据（判"要不要走完整四步"，不是审查深度），信号类别与本表相近但不是同一件事，两者不通用、不要混用。

### 4.6 Delta review（修完 findings 的重跑判据）

同一工件同一轮 review 循环内，修完 findings **不重跑全量独立交叉**——主会话逐条核对 fix 落实、追加 Review Log 即可。重跑独立路仅当：**结构性变更**（新增/删除章节、方案改向、接口重定义）、用户显式要求再来一轮完整交叉、或上轮是降级单跑且本轮对象足够重。目的：防「每修一轮跑一次 codex」的流程税——分钟级等待累积会让用户绕过流程。完整判据与反例见 `methods/dual-review.md` §三。

---

## 5. 落地约定

- **Critical 不可 override**（步骤 7）：fix 改了代码必须回 Build → Verify → 再 Review，没有"这次特殊"。
- **Structural Remedy 优先**：finding 的 `fix` 给具体重构动作（"把 X 移到 Y、改调用方 Z"）而非"考虑重构一下"。几条高置信 Structural Remedy 胜过一长串 nit。
- **少而精**：一个架构问题 + 十个 nit，那个架构问题才是 review。correctness/security 优先呈现。
- **细则只填第 3 步**：骨架、方法、契约、公共能力都是共享单源；细则不重写流程，只注入领域维度并选方法。
