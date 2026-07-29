# 设计文档评审维度（dev-design writing 领域细则）

> **定位**：本文件是 `dev-design writing` 评审设计文档的**领域维度表**——`reviewing` 引擎的 domainAxes。通用流程 / reviewer 纪律 / Evidence Gate / Q/SA / findings 分级全由引擎承载，本文只提供设计文档专属的评审维度。
>
> **怎么用**：dev-design writing 的 Review step Read 本文拿维度，**默认主会话就地逐维自查**（不调 reviewing 引擎、不派 subagent/Codex）；用户显式要求升审时才调 `平台原生 Skill 调用`，声明「对象 = 设计文档、方法 = checklist、领域维度 = 本文 8 维度 + 附带检查」（此时 reviewer 纪律 / Evidence Gate / 分级 schema 由引擎自带）。自查时的编号（C/W/S/Q/SA）与 Evidence 纪律见 SKILL.md Review 节。
>
> **评审两层**：架构骨架已在 Step 3「架构审核」过（业务边界/依赖），本步（唯一全文评审）审**完整性 / 一致性 / 可执行**，不重复审纯架构骨架问题。
>
> **设计文档审查顺序**（领域特化，通用步骤走 skeleton）：Read 文档全文 + frontmatter + 相关 ADR/wiki → 按 scenario（feat/bug/refactor）加载检查项 → 第一遍 8 维度核心审查 + 附带检查 → Evidence Gate 核实（触发清单见引擎的 reviewer-discipline）→ 第二遍 Self-Audit 换位。

## 核心审查（按重要性排序，占重点）

> **同源 note**：本节 8 维度与 `SKILL.md`《写作准则（核心）》各条是同一套规则的两个视角——reviewer 视角"挑什么" vs writer 视角"做什么"。改一处务必同步检查另一处。

### 1. 设计意图是否清晰

- 「背景」节 30 秒能读懂主因吗？
- 「背景」节是否显式标注主因 vs 辅因（≥3 条 bullet 时强制要求）？
- 「目标」是否真反映"背景.主因"的解法？还是答非所问？
- （如有）入口段 / Summary / TL;DR 是否能独立成立？（不需读全文也能 grasp 核心）
- （PRD）「验收标准.明确排除」节是否具体？还是「其他都不做」敷衍？
- **罗盘对齐**：首章「罗盘」是否存在，`restateOwner` 是否明确？owner=define 时 Design 不得改写；owner=design-lite 时每次修订是否有协调器 checkpoint？全文是否与罗盘对齐——每条 SC 有落点且不越 Out of Scope？非法改写 / 缺失 → Warning；SC 无落点 / 越界扩范围 → Critical

### 2. 决策是否站得住脚

- 「方案选择」每项的「选项」是否 ≥ 2 个真备选 + 真否决理由？还是只放选定方案？
- 「方案选择」每项严格 Q→选项→定 三行格式：**Q** 必须是问句（含 "?")，**选项** ≥ 2 个特征对比，**定** 含"因 Y"否决理由
- 「定」的否决理由是否量化（"P99 会涨 80ms"、"实施成本 2 人月"）？还是"复杂"、"不优雅" 等抽象词？——指控"理由不充分"不需要代码；**指控"数据 / 结论说反了"→ 触发 Evidence Gate**
- 「定」与实际「实现.业务流」展开的是同一方案？还是 favorable framing 把负面藏起来？
- 关键选择有 evidence / 数据 / 引用 还是拍脑袋？
- 是否漏了明显方案？
- **结论先行·决策速查表（①）**：多个决策时，「方案选择」章节开头是否有速查表列全 Q + 定 + 确认状态 + 影响？缺速查表（读者要逐段翻找结论）→ Warning
- **反方配平（①）**：每个否决项的理由是否与推荐项同等分量（展开代价 + 换不到的收益）？还是"选 B 因为 B 好"一句带过否决项 = 假对比 → Warning
- **确认状态标注（①）**：每个决策是否标 `[已确认]`（用户/评审拍板）/ `[假定]`（agent 自主待复核）？缺标注（读者不知哪些拍死、哪些能推翻）→ Suggestion

### 3. 设计是否完整

关键维度都考虑了吗：

- 边界与 scope（PRD 看「明确排除」；design-doc 看「目标」是否限定不做什么）
- 依赖（上下游 / 必需 vs 可选）
- 失败模式（design-doc 「实现.异常与失败模式」必填，表必有「所属 BF」列；列真实可能发生的，不只 happy path 反面）
- 数据流（成功 + 至少一条失败路径——「实现.业务流」每条 BF 必含 catch 块或失败分支）
- 测试与验证：「实现.单测设计」必须按 BF 分组，每条 case 用 Given/When/Then 三行；覆盖每条 BF 主路径 + 每个异常分支；**不写代码** (无 `@Test` / mock setup / assertion 语法)。覆盖缺失（异常表第 N 行无对应 case） → Critical
- 部署：「其他.部署」必填（无运行时部署的纯库内重构可一行写"无部署变更"）；含灰度策略 + 回滚预案 + 监控指标三件套；详细命令/manifest 出现在本节 → Warning（越 ops doc 边界）
- Security / Performance / Migration 等横切关注点——按 `references/cross-cutting-design.md` 审：`domainDecisions` 是否为权威结论，placement 是否用 `decisionRefs` 双向回链？`providerOrOwner`、所有 consumer 的 `layerResponsibilities`、`enforcementPoints`、`dataOwners` 是否齐全？items 为空时 exemption 是否有理由与证据？——SC 级横切要求无落点、权威结论与 placement 矛盾 → Critical；provider / consumer 漏走查、层留空无理由、豁免空泛 → Warning

### 4. 实施层面是否可执行

- 「实现.影响」是否给出多模块 ASCII 树 + (改)/(NEW) + ① ② ③ 编号要点？路径是否完整到包名？——**指控"路径不存在 / 写错"→ 触发 Evidence Gate**
- 「实现.接口设计」按面分 3 段 (对外 API / 数据模型 / 内部接口), 按需展开:
  - **对外 API** (前后台对接 / 跨服务): 涉及 HTTP/RPC endpoint 时必有本段, 列表含 Method / Path / Request / Response / 错误码 / 鉴权; 若业务流伪代码出现 `/foo/bar` 等 endpoint 但本段未汇总 → Critical
  - **数据模型** (DB schema + 表关联): 涉及多表外键关联**必画 ER 图**, 单表 schema 可不画; 关键索引 + UNIQUE 约束必须标; 缺 ER 图 → Warning (multi-table) / 缺 UNIQUE 约束 → Critical (语义易遗漏)
  - **跨限界上下文**（按业务能力、统一语言与一致性边界识别；仓 / 服务 / 部署只是信号，判据见 `references/ddd-modeling.md`）：数据 owner 是否唯一？共享可变实体 / 跨上下文 join / 直写对方存储 → Critical；必要副本未写同步、陈旧度与修复语义，或同名概念未映射 → Warning
  - **内部接口** (类签名 + 类图): 给出 public 方法签名 / 字段名 / 状态字段类型, 还是只描述"提供 X 接口"? 多类协作 (≥3) 时是否画 ASCII 类图?
  - 触发 Evidence Gate: **指控"签名 / 字段 / 类型 / endpoint / schema 与现有代码不符"→ 必须 Read 代码或 OpenAPI/migration 文件**
- **「实现.业务流」必须 BF 编号 + 伪代码**（`function`/`method` 签名 + 函数体行），且**每行必有 `//` 注释**讲清"这行干什么 / 为什么"
  - ❌ 写成 ASCII 文件树（`NinesAgent.java ├─ ...`）→ Critical（这是「影响」节的内容，不是业务流）
  - ❌ 写成层次列表 / 散文描述 / 无注释的代码 → Critical
  - ❌ BF 没编号（用「业务流一 / 业务流二」中文序数） → Critical
  - 数字 / 阈值出现时必须**注明来源**（`// HOLD_SIZE=64，来源：最长入口点 30 字符 + chunk 容差`）——**指控"来源数值错了"→ 触发 Evidence Gate**
- 「实现.异常与失败模式」列具体表（所属 BF / 场景 / 触发 / 处理 / 上抛吞 5 列），还是泛泛"会处理错误"？「所属 BF」列与业务流编号对得上？
- 「实现.单测设计」按 BF 分组、每条 Given/When/Then 三行？覆盖业务流主路径 + 异常表每行？是否写了代码（`@Test` annotation / mock 工具 API） → Critical（越 plan 边界）
- 是否把 plan 内容塞进来（class 内部循环细节 / TDD 步骤 / 具体 catch 块写法）—— design-doc 应止于伪代码 + 契约 + Given/When/Then case，class 内部留给 plan
- 是否把 ops doc 内容塞进部署节（具体 K8s manifest / Ansible playbook / 跑批脚本） → Warning

### 5. 内部一致性

- 「目标」与「架构.文本总结」对得上？
- 「方案选择」的 Q「定」如果末尾标 `→ 影响 BFx`，对应 BFx 必须在「实现.业务流」存在；BF 实现的关键参数（数字 / 阈值 / 分支条件）能在某条 Q 的「定」里追到出处
- 「异常与失败模式」表「所属 BF」列必须出现在「实现.业务流」里；「单测设计」每条 case 必须挂在某个 BF 下
- frontmatter 的 status / type 与正文实际状态匹配？
- 跨文档：与既有 ADR / wiki 历史决策一致？——**指控"和 ADR-X / wiki/Y 冲突"必须 Read 过那份文档 → 触发 Evidence Gate**

### 6. 范围是否合理

- 过度设计：写了处理不可能发生的输入、做了"将来可能用"的扩展？
- 欠考虑：关键维度缺失？复杂度被低估？
- 「方案选择」项数与项目复杂度匹配——小改动列 6+ Q = 过度（微小决策不必入档）；系统级只列 1 项 = 欠
- 「业务流」BF 数量匹配——单一改动给了 8 条 BF = 过度；复杂系统只给 1 条 = 欠
- 单 BF 详细度匹配——简单改动给了 50 行业务流伪代码 = 过度；复杂逻辑只给 3 行 = 欠
- 文档长度与项目规模匹配（小改动写了 30 页 / 系统级写了 3 节都是信号）

### 7. 骨架可读性（Structural Readability）

覆盖设计文档骨架的可读性准则（场景驱动 feat / bug / refactor，各有骨架）。**先整体后局部**两层评估——整体问题严重度优先。整体论证立不住时，单句再漂亮也救不回来。

**整体层（可上 Critical）：**

- **入口段引用未定义术语 / 缩写**：TL;DR / Summary 用了全文才解释的内部词，读者必须读完全文才懂入口段
- **元结构标签作 H2**：「上半 / 下半 / Human Review / Agent Implementation」等告诉读者"这一节给谁看"的元标签——直接上 Critical，建议改为内容实体名
- **节间无承上启下**：架构.文本总结后突然进实现，未交代映射关系；实现节内 5 子节之间无衔接
- **方案选择 Q→选项→定 三行格式破坏**：Q 不是问句、选项 < 2、定缺否决理由、长论证混入（应升 ADR）
- **业务流缺 BF 编号 / 异常表缺「所属 BF」列**：让 reviewer 没法把业务流 ↔ 异常 ↔ 单测三节交叉对照
- **pain point 平铺不分主次**：背景节列 ≥3 条 bullet，未显式标主因 vs 辅因
- **项目内自创词未首次解释**：dogfood / humanizer / two-half / 内部 component 名 等首次出现无 inline 解释
- **小黄鸭跳步**：决策 / 数字 / 阈值出现却无"为什么"——含「显然 / 众所周知 / 不言而喻 / 不必赘述」等跳步信号词
- **直白检验失败**：一句话讲不清复杂概念——表现为段首堆砌技术术语而无直觉先导；不假设读者背景的"教不会"段落。**不因"无类比"扣分**——类比是 nice-to-have 不是必需。
- **论证链断点**：第 N 节的结论建立在第 N+M 节才定义的概念上，跳着读拼不起来
- **决策与展开错位**：方案选择 Q「定」选了 A，实现.业务流却展开 B
- **关键决策被埋**：最重要的决策段被塞在 200 字段落中间，不在段首或独立成段

**局部层（一般 Warning / Suggestion）：**

- **段落墙**：单段 ≥8 句、无列表无 break 的信息块
- **信息密度失衡**：一段塞 5 个独立论点（拆）；三段说同一件事（合）
- **节奏单调**：连续 5 段都是无差别长段、零列表零表格
- **视觉媒介错配**：明显是对比表 / 时间线 / 决策树的内容，硬写成连续长段
- **场景流程图缺失**：交互场景既无流程图、也无「单步无分支不画图」的 inline 声明 → Warning（这是写作侧 Exit Gate 的硬性产出，不是可选美化；「场景太简单」不构成豁免，豁免必须显式声明）
- **跨服务场景缺调用时序图**：调用链跨 ≥2 服务 / 部署单元的场景只有散文或普通流程图，method / path / 入参 / 返回码要读者自己从文字里拼 → Warning
- **子图缺失**：某条 BF 合并多张力同时拍板（如 session + SLO + fallback）、纯文字需要 reviewer 自己脑里画状态机 → 应在该 BF 下加局部状态机 / 子流程图；判级 Suggestion——只在反过来"加图明显更易读"时提，不强求
- **跨章重复**：同一个论点在 3+ 节复述（信号：你 ctrl-F 同一论点出现 3 次）

**Critical 触发边界**：整体层问题**实际影响理解**时——关键决策段读不下去、论证链断到 reviewer 自己拼不起来、元标签 H2 让读者困惑、术语前后矛盾。纯句式累 / 段落微长 → Warning；可优化但不影响理解 → Suggestion。

### 8. 方案质量与验证覆盖（并入自 dev-design 设计评审）

> dev-design 拆薄协调器后评审唯一化到本步，原 dev-design 独立 design-review 的方案层维度并入这里。

- **TO 覆盖**：每条路径和约束都有对应测试目标（TO）？跨域 TO 和领域 TO 不重复也不遗漏？
- **verify 策略可行**：测试分层合理？不测项的风险评估充分？
- **失败预演（pre-mortem）**：做了失败预演吗？top 3 失败原因在方案里有应对措施或显式接受风险？
- **目标漂移**：方案还在服务原始目标？有没有为了方案优雅偷偷改了目标？
- **UI 设计（涉及前端时）**：有 UI 设计节吗？组件清单 / 布局 / 交互行为 / design taste skill 引用到位？

## 附带检查（顺手做，非 Critical）

### Structural（机器可验证）

按场景不同（feat / bug / refactor，退役旧 doc-type 地层后收敛到三场景）：

**通用**：
- frontmatter 字段齐全（scenario / topic / date / author / status）
- approved 文档必须有 `designRevision` / `designDigest`，且当前 `DesignReviewVerdict.reviewedRevision / reviewedDigest` 完全匹配；不匹配即 Critical
- scenario 是 feat / bug / refactor 之一
- status 符合 Design Doc 状态机（draft → in-review → approved → implemented → archived）
- approved 文档必须有「实施设计项清单」；按 `${PLUGIN_ROOT}/skills/references/design-traceability.md` 检查 Registry ↔ 来源章节双向完整，任一方向 orphan 都是 Critical
- 规范性内容不得只存在于附件或补充文档；发现第二事实源必须合并回单一 `docPath` 后重跑 Review
- H2 章节名是内容实体；**含「上半 / 下半 / Human Review / Agent Implementation」等元标签作 H2 直接上 Critical**
- **决策速查表（①）**：有多个决策时「方案选择」章节开头必有速查表（Q + 定 + 确认状态 + 影响）
- **文末术语表（⑤）**：用了缩写 / 自创词时文末必有「术语与缩略语」表；首次出现用「中文 英文全称 - 缩写」三段式
- **可观测（⑥）**：涉及运行时逻辑必有「基础日志设计」节（关键路径 / 异常 / 出入口打点）；AI 功能类必有「eval 设计」节（③）

**feat**：必有节「背景 / 调研 / 方案选择 / 业务边界 + 总图 / 横切设计（或豁免声明）/ 表现层设计 / 领域层设计 / 汇总」；边界由业务能力、统一语言与一致性边界解释；总图节点标 新建/改造/已有·复用，被复用的已有能力进图（缺状态标注 → Suggestion；复用决策完全不可见 → Warning）；每域自包含（接口 + 业务流 + 文件影响 + 验证）；业务流必须 BF1/BF2/... 编号 + 每行 `//` 注释；接口按四层按需；跨限界上下文时总图节点标上下文归属，并允许一个上下文含多个聚合，跨上下文协作有引用方向表；交互场景逐个有流程图，纯文字场景必有「单步无分支」inline 声明
**bug**：必有节「问题现象 + 复现 + 影响范围 / 根因分析（推理链带 `[Read path:line]` + 问题位置图）/ 修复方案（修复前 vs 修复后对比）/ 验证（回归测试能在没 fix 时失败）」；修复涉横切关注点变更时有「横切影响」小节
**refactor**：必有节「现状分析（结构图 + DDD 诊断）/ 目标设计（Before/After 对比 + 变更点理由）/ 迁移策略（每步可回滚）/ 汇总（含行为不变的回归验证）」；before/after 总图节点标 新建/改造/已有·复用；结构变化影响横切落层时有「横切设计」章

### AI Writing Patterns（humanizer 风格抽样 10 类，降级为 Warning/Suggestion）

1. **Significance inflation**：「关键」「核心」「至关重要」无谓滥用
2. **Filler phrases**：「值得一提的是」「需要注意的是」
3. **AI vocabulary**：「深入探讨」「leverage」「delve」
4. **Vague attributions**：「业界普遍认为」「最佳实践显示」（无具体来源）
5. **Generic conclusions**：「展望未来」「为后续奠定基础」
6. **Signposting**：「让我们来看一下」「接下来...」
7. **Forced rule of three**：「灵活、可扩展、易维护」凑数
8. **Copula avoidance**：「该模块**充当**...的角色」→「该模块**是**」
9. **章节空话**：「需保证安全性、性能、可维护性」无具体内容
10. **抽象描述**：写"会话模块"而非具体 `auth/session.go`

加 3 类设计文档特有：
11. **抄需求**：背景节直接复述用户原 prompt
12. **将来式 YAGNI**：「未来如果有 X 需求，可扩展为 Y」
13. **方案选择缺否决理由**：「定」只写选的方案不说为啥不选其他

## 输出格式（设计文档专属示例）

每条 finding 套 findings-contract 的 schema，`axis` = 上方维度名（如「决策站得住脚」「实施可执行」「骨架可读性」）。设计文档评审的 Report 示例：

```markdown
## Review Report
**Doc**: <path>
**Scenario**: feat

### ❌ Critical (建议必修)
- **C1** [`## 背景`]：列了 4 条 pain point 但未标主因 vs 辅因（核心审查 #1 + #7 整体层 "pain point 平铺"）
- **C2** [`## 上半：Human Review`]：元结构标签作 H2——改用内容实体名（背景 / 目标 / 架构）（核心审查 #7 整体层 "元标签"）
- **C3** [`## 方案选择 → Q2`]：「定」只写"选方案 A"未给否决其他方案的理由（核心审查 #2）
- **C4** [`## 方案选择 → Q1`]：「定」末尾标 `→ 影响 BF3`，但「实现.业务流」找不到 BF3——决策与实现脱节（核心审查 #5）
- **C5** [`### 接口设计`]：文档写 `CreateSession(uid string)`，但 `pkg/auth/session.go:42` 实际签名是 `CreateSession(ctx context.Context, uid string)`——少了 ctx 参数（Evidence Gate 已核实）
- **C6** [`### 单测设计`]：BF2 异常表列了「BindingTokenExpired」失败模式但 case 节无对应 Given/When/Then——异常覆盖缺失（核心审查 #3 测试与验证）
- **C7** [`### 业务流`]：BF1 写成了 ASCII 文件树而不是 function 伪代码——这是「影响」节的内容，不是业务流（核心审查 #4）

### ⚠️ Warning (建议修)
- **W1** [`### 业务流 → BF1`]：抽象描述 —— "调用会话模块" → 用 `auth/session.go::CreateSession`
- **W2** [`### 单测设计 → BF1`]：写了 `@Test` annotation 与 mock setup 代码——越 plan 边界，应只写 Given/When/Then 三行（核心审查 #4）
- **W3** [`### 影响`]：路径缩略到 `auth/` 未给完整包名；改动要点未编号（核心审查 #4）
- **W4** [`### 方案选择 → Q1.说明`]：含 AI vocabulary —— "深入探讨"、"核心要素"
- **W5** [`## 其他.部署`]：贴了完整 K8s manifest YAML——越 ops doc 边界，应只写灰度比例 / 回滚条件 / 监控阈值（核心审查 #4）

### 💡 Suggestion (可选)
- **S1** [`## 方案选择 → Q2`]：连续 50 字长论证比较方案 A vs B，已超 Q→选项→定 三行紧凑形式——升格成独立 ADR 更合适（核心审查 #6）
- **S2** [`## 架构.文本总结`]：当前直接列 bullet——加一句承接「实现」节的引导更显论证链

### ❓ Open Questions (待核实事实，请作者确认或贴 `path:line` 反驳)
- **Q1** [`### 影响`]：文档列了 `auth/session.go::CreateSession`，本地 grep 搜不到该路径——是新建文件，还是包路径写错？
- **Q2** [`### 方案选择 → Q2`]：否决方案 B 时说"现有 X 模块不支持并发"——未 Read 到 X 模块代码核实，请作者贴 path:line 证明，或确认这是预设假设而非现状
- **Q3** [`### 跨文档`]：本文档结论与 `docs/adr/0007-foo.md`（仅看到文件名引用未 Read 内容）可能冲突，请作者点名是新决策 supersede 还是补充

### Self-Audit
- **SA1** 文档说"调用 design-doc-writing skill"——没说调用方在哪 / 什么时机（→ 与 C1 同根）

## Verdict
❌ Has issues — 见上方编号清单，用户决定修哪些 / 答哪些。
```

无问题时也必须返回绑定当前基线的 `DesignReviewVerdict`。Open Questions 先分 `blocking` / `non-blocking`：blocking 未解决时不得 Pass；non-blocking 必须记录 reason、owner、target stage。正文修订后旧 verdict 一律失效，按 Writing 协议执行 Delta Verification 或完整重审。

> 编号规则 / Evidence Gate / Self-Audit 判据 / verdict schema 全见 reviewer-discipline + findings-contract，本文不复述。
