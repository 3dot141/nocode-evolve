# reviewing 流程骨架 — 通用 review 的"怎么走一遍"

> 这是 `reviewing` 框架的**被引用件**。各专项 review 细则（dev-review / define-review / design-review / prd-review / vis-review / dev-design-refine / dev-build per-task / brainstorming self-review 等）在自己 SKILL.md 里 `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md`，按本文照做，**只在第 3 步填自己的领域维度**。骨架管"怎么走"，方法库管"用什么打法"，findings 契约管"产出长什么样"。
>
> **本文是给 agent 照做的判据，不是可执行代码。** 文中的 `classify / selectMethods / dispatchIndependent / evidenceGate` 是 review 的逻辑环节名，对应下面的判据表和 how-to —— agent 读完照判据自己做，不是调函数。

---

## 0. 三个共享件（细则按需 Read）

| 件 | 路径 | 管什么 |
|---|---|---|
| 本骨架 | `{NOCODE_SKILL_REF}/reviewing/skeleton.md` | 7 步流程 + 分档 + 方法选择 + 公共能力 |
| findings 契约 | `{NOCODE_SKILL_REF}/reviewing/findings-contract.md` | finding/verdict schema + 5→3 分级映射 + Evidence Gate 入 schema |
| 方法 card | `{NOCODE_SKILL_REF}/reviewing/methods/<method>.md` | 每个评审方法的维度表/输出契约/派发策略 |

---

## 1. 分档判据（步骤 1 = `classify`，公共前置）

review 不是越重越好。先按**评审对象的风险 + 可逆性**定深度，再决定走多深。

| 信号（任一命中） | 档位 | 含义 |
|---|---|---|
| **可逆** + **单文件 / 单点** + **易回滚**（命名、文案、风格、内部小改） | **轻档** | self-review 一遍即可，不派 subagent、不拉 codex |
| **不可逆** / **跨模块** / **涉及外部输入·认证·敏感数据** / **架构或选型决策** / **数据库 schema·migration** / **多方案僵持** / 用户显式说"深度 / 仔细审 / 红蓝军" | **重档** | 领域维度 checklist + **异源交叉**（codex / 独立 subagent），CLAIM 剥离 |

**模糊时默认轻档**：判据表未命中、或拿不准是否命中 → 轻档。"能否 5 分钟内回滚"只作辅助——明确回滚不了 = 命中"不可逆"走重档；只是拿不准 ≠ 命中。

**降档权（档位怎么来的，决定谁能降）**：判档由 agent 自动做——没命中重档信号就是轻档，这是判档不是降档，不需要授权。命中重档信号、或调用方声明强制重档后要降 → 只认用户显式否定词（"轻档就行 / 跳过 codex / 不用深审"），模糊信号（"快速看看 / 先出草稿"）不算授权（对齐 `model/agent-about.md`"偏离 rule/skill 触发需用户显式授权"）。

**边界示例**：
- 改对外 API 字段名：代码可逆但已发布 client 会破 → **重档**
- 升主框架 / 语言运行时大版本 → **重档**
- 升 lint / formatter / 单测库 → **轻档**
- 调一个内部函数命名 → **轻档**
- 一段 SQL migration（哪怕只一行） → **重档**（不可逆 + 数据风险）

> 档位是**深度旋钮**，不改方法选择的"主方法"——轻档省掉异源交叉那一路，重档加上。

---

## 2. 七步流程详解

每步"做什么 → 产出什么"。细则照走，只有第 3 步是自己的领域内容。

| # | 步骤 | 做什么 | 产出 |
|---|---|---|---|
| 1 | **分档** | 按 §1 判据表定轻/重档 | `depth = light \| heavy` |
| 2 | **对象界定 + 进入 gate** | 明确评什么（diff / 设计文档 / 方案 / restate）、范围边界、前置条件是否满足（如 dev-review 要求 Verify Gate 已过）。前置不满足 → 不进 review，回退 | 评审对象 + 范围 + gate 通过 |
| 3 | **评审维度**（细则注入点） | **骨架不规定具体维度，细则在这里填自己的领域维度表**（dev-review 五轴 / define-review 7 维 / 安全 OWASP …）。维度 = 后续 finding 的 `axis` | `domainAxes[]` |
| 4 | **执行（选方法）** | 按 §3 方法选择表 + 档位，从方法库选 1+ 种方法，逐个 Read 对应 card 执行：清单/自评类直接套维度产出 finding；对抗/PBR 类需独立交叉（进步骤 5） | 每方法的 raw findings |
| 5 | **独立交叉**（重档） | 公共能力（见 §4）：**CLAIM 剥离 + Context Capsule**（§4.1）后派独立审查——默认单路 codex（经 `rule-codex-review` 单一通道），调用报错才 fallback 独立 subagent 单跑，非并行双跑。声明独立性档位（异源 / 同模型（降级） / 无） | 独立路 findings + 独立性声明 |
| 6 | **findings 统一 schema + 分级** | 把各路 raw findings 归一到 `findings-contract.md` 的 schema：查 5→3 映射表定 `severity`（C/W/S）、Q/SA 转 `kind`、security High 上提 Critical；按 `[location, axis]` 去重（交集 = 高置信）；过 **Evidence Gate**（见 §4） | 归一 findings[] |
| 7 | **收口 / triage / 拍板** | 排序呈现（correctness/security 优先，少而精）；**Critical 必修不可 override**；产出 verdict（approved + counts + recommendation）；交用户逐条拍板 | verdict + 用户拍板 |

> 轻档：步骤 1→2→3→4（self-review）→7，跳过 5（无独立交叉）、6 退化为一句表态。重档：全 7 步走完。

---

## 3. 方法选择表（步骤 4 = `selectMethods`）

**两维判据**：① **评审对象**定主方法；② **档位**（§1）定深度——轻档只取主方法的 self-review 形态，重档加异源交叉。

| 评审对象 | 默认方法 | 备选 | 独立性 |
|---|---|---|---|
| **代码 diff** | `checklist`（领域维度，通用质量清单载体 = `code-quality-method`）+ `dual-review`（异源双评） | `error-mechanism` | 异源 |
| **方案 / 决策 / 架构选型** | `red-blue-adversarial` | `perspective-based` | 异源 |
| **设计文档** | `checklist`（领域维度）+ `dual-review`（异源双评） | — | 异源 |
| **安全**（外部输入 / 认证 / 敏感数据） | `threat-modeling` + `checklist`（`security-method` card · OWASP） | — | 异源 |
| **数据库**（SQL / schema / migration） | `checklist`（`database-method` card） | — | 同模型 / 异源 |
| **架构决策** | `checklist`（`architecture-method` card）+ `red-blue-adversarial` | — | 异源 |
| **需求 / PRD / restate** | `checklist`（领域维度）+ `dual-review`（异源双评） | — | 异源 |
| **轻档 / 低风险** | `self-review` | — | 无 |

> **red-blue vs dual-review 分界**：`red-blue-adversarial` 是**有防守方的对抗**（蓝军防守提议、红军攻击），回答「该不该 / 选哪个」，主产物是 `verdict.recommendation`；`dual-review` **无防守方**——主路 + 独立路两路**中立**挑错后合并，回答「这份工件有什么问题」，主产物是 `findings[]`。工件缺陷发现误挂 red-blue 会诱导主路去「防守」工件（护短）；拍板题误挂 dual-review 则没人做立场论证。分界详表见 `methods/dual-review.md`。

**db / architect 的"接线"就在这张表**——细则审到 SQL/migration 或架构决策时，据此选 `database-method` / `architecture-method` card，**不经 manifest 路由**（框架走 reference 不进 manifest）。"补接线" = 在本表加"对象 → card"映射，不改 manifest / generate。

**怎么用**：
1. 定对象类型 → 查表取默认方法集。
2. 看档位：轻档 → 只跑主方法的 self-review 形态，删掉"+ red-blue 异源交叉"那一路；重档 → 全跑。
3. 一个对象可命中多行（如"代码 diff 且碰认证" → 同时取代码行 + 安全行的 card）。
4. 逐方法 `Read {NOCODE_SKILL_REF}/reviewing/methods/<method>.md`，card 内有该方法的维度/输出契约/派发策略（是否要 subagent、是否拉 codex、档位参数）。

---

## 4. 公共能力 how-to（框架级，方法不各写一份）

这些是横切关注点，骨架统一定义，方法 card 和细则直接引用。

### 4.1 CLAIM 剥离（独立交叉的前提）

派独立审查（codex / 独立 subagent）时，**只传"被评审对象的原文 + 约束条件 + 维度清单",绝不传主路（主会话；对抗型即蓝军）已得出的审查结论或倾向**。

- ✅ 传：restate 原文 + 真约束 + "请按这些维度攻击这份需求定义"
- ❌ 不传："我觉得 SC-3 不可测，你看对不对"——这会把独立路诱导成确认路，假独立。
- 目的：让独立路从零形成判断，与主路的交集 = 高置信、对称差 = 各自盲点。被诱导 = 失去独立性价值。

**剥结论、留事实 —— Context Capsule**：CLAIM 剥离剥的是主路的**结论与倾向**，不是事实。会话里已确立、但工件未必写全的事实，打包成中立 Context Capsule 随对象一起传：

- 已拍板决策（用户确认过的选择）
- 被否决方案 + 否决原因（防独立路把否决过的旧方案当新建议重提）
- 非目标 / Out of Scope
- 硬约束与预算（成本 / 时延 / 依赖 / 兼容性）
- **已知缺失上下文声明**：明说「以上是全部已知事实约束」或列出未提供项——独立路依赖但未提供的上下文，相应判断标 `kind=open-question`，不硬上 Critical/Warning

Capsule 只装**事实**（用户拍过板的、文档已确认的），不装主路分析 / 倾向 / 已得 findings——装了就把独立路诱导成确认路。上下文缺口的代价是**不对称的**：合并时 triage 能滤掉独立路的误报，补不回它因缺上下文漏掉的发现——宁可 Capsule 打包多一点。

### 4.2 codex 经 `rule-codex-review` 派（异源单一通道）

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

§1 的分档判据是公共件——任何细则需要"判这次 review 该多重"时引本表，不各写一套档位定义。红蓝对抗方法 card 的 `light/heavy` 档位参数与本表同源。

### 4.6 Delta review（修完 findings 的重跑判据）

同一工件同一轮 review 循环内，修完 findings **不重跑全量独立交叉**——主会话逐条核对 fix 落实、追加 Review Log 即可。重跑独立路仅当：**结构性变更**（新增/删除章节、方案改向、接口重定义）、用户显式要求再来一轮完整交叉、或上轮是降级单跑且本轮对象足够重。目的：防「每修一轮跑一次 codex」的流程税——分钟级等待累积会让用户绕过流程。完整判据与反例见 `methods/dual-review.md` §三。

---

## 5. 落地约定

- **Critical 不可 override**（步骤 7）：fix 改了代码必须回 Build → Verify → 再 Review，没有"这次特殊"。
- **Structural Remedy 优先**：finding 的 `fix` 给具体重构动作（"把 X 移到 Y、改调用方 Z"）而非"考虑重构一下"。几条高置信 Structural Remedy 胜过一长串 nit。
- **少而精**：一个架构问题 + 十个 nit，那个架构问题才是 review。correctness/security 优先呈现。
- **细则只填第 3 步**：骨架、方法、契约、公共能力都是共享单源；细则不重写流程，只注入领域维度并选方法。
