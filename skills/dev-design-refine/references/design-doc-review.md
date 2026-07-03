# 设计文档评审维度（dev-design-refine 领域细则）

> **定位**：本文件是 `dev-design-refine` 评审设计文档的**领域维度表**——`reviewing` 框架 skeleton 第 3 步的 `domainAxes[]`。通用流程 / reviewer 纪律 / Evidence Gate / Q/SA / findings 分级全走框架，本文只提供设计文档专属的评审维度。
>
> **怎么用**：dev-design-refine 的 Review step 调 `Skill(nocode:reviewing)`，声明「对象 = 设计文档、方法 = checklist、领域维度 = 本文 7 维度 + 附带检查」。reviewer 纪律 / Evidence Gate / Self-Audit / 编号 / 分级 schema 全由 `reviewing` 引擎在调用时自带，本文不给死路径、不复述。
>
> **设计文档审查顺序**（领域特化，通用步骤走 skeleton）：Read 文档全文 + frontmatter + 相关 ADR/wiki → 按 doc-type 加载检查项 → 第一遍 7 维度核心审查 + 附带检查 → Evidence Gate 核实（触发清单见 reviewer-discipline）→ 第二遍 Self-Audit 换位。

## 核心审查（按重要性排序，占重点）

> **同源 note**：本节 7 维度与 `SKILL.md`《写作准则（核心）》8 条是同一套规则的两个视角——reviewer 视角"挑什么" vs writer 视角"做什么"。改一处务必同步检查另一处。

### 1. 设计意图是否清晰

- 「背景」节 30 秒能读懂主因吗？
- 「背景」节是否显式标注主因 vs 辅因（≥3 条 bullet 时强制要求）？
- 「目标」是否真反映"背景.主因"的解法？还是答非所问？
- （如有）入口段 / Summary / TL;DR 是否能独立成立？（不需读全文也能 grasp 核心）
- （PRD）「验收标准.明确排除」节是否具体？还是「其他都不做」敷衍？

### 2. 决策是否站得住脚

- 「方案选型」每项的「选项」是否 ≥ 2 个真备选 + 真否决理由？还是只放选定方案？
- 「方案选型」每项严格 Q→选项→定 三行格式：**Q** 必须是问句（含 "?")，**选项** ≥ 2 个特征对比，**定** 含"因 Y"否决理由
- 「定」的否决理由是否量化（"P99 会涨 80ms"、"实施成本 2 人月"）？还是"复杂"、"不优雅" 等抽象词？——指控"理由不充分"不需要代码；**指控"数据 / 结论说反了"→ 触发 Evidence Gate**
- 「定」与实际「实现.业务流」展开的是同一方案？还是 favorable framing 把负面藏起来？
- 关键选择有 evidence / 数据 / 引用 还是拍脑袋？
- 是否漏了明显方案？

### 3. 设计是否完整

关键维度都考虑了吗：

- 边界与 scope（PRD 看「明确排除」；design-doc 看「目标」是否限定不做什么）
- 依赖（上下游 / 必需 vs 可选）
- 失败模式（design-doc 「实现.异常与失败模式」必填，表必有「所属 BF」列；列真实可能发生的，不只 happy path 反面）
- 数据流（成功 + 至少一条失败路径——「实现.业务流」每条 BF 必含 catch 块或失败分支）
- 测试与验证：「实现.单测设计」必须按 BF 分组，每条 case 用 Given/When/Then 三行；覆盖每条 BF 主路径 + 每个异常分支；**不写代码** (无 `@Test` / mock setup / assertion 语法)。覆盖缺失（异常表第 N 行无对应 case） → Critical
- 部署：「其他.部署」必填（无运行时部署的纯库内重构可一行写"无部署变更"）；含灰度策略 + 回滚预案 + 监控指标三件套；详细命令/manifest 出现在本节 → Warning（越 ops doc 边界）
- Security / Performance / Migration 等横切关注点——**新骨架不要求 Checklist 形式**，但 reviewer 仍判断 writer 是否在合适位置（如「业务流 BFx」「异常与失败模式」「部署」节）回应了这些维度。**未回应不是 Critical**，但跨权限边界 / 涉及数据迁移 / 高频路径却完全不提 → Warning

### 4. 实施层面是否可执行

- 「实现.影响」是否给出多模块 ASCII 树 + (改)/(NEW) + ① ② ③ 编号要点？路径是否完整到包名？——**指控"路径不存在 / 写错"→ 触发 Evidence Gate**
- 「实现.接口设计」按面分 3 段 (对外 API / 数据模型 / 内部接口), 按需展开:
  - **对外 API** (前后台对接 / 跨服务): 涉及 HTTP/RPC endpoint 时必有本段, 列表含 Method / Path / Request / Response / 错误码 / 鉴权; 若业务流伪代码出现 `/foo/bar` 等 endpoint 但本段未汇总 → Critical
  - **数据模型** (DB schema + 表关联): 涉及多表外键关联**必画 ER 图**, 单表 schema 可不画; 关键索引 + UNIQUE 约束必须标; 缺 ER 图 → Warning (multi-table) / 缺 UNIQUE 约束 → Critical (语义易遗漏)
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
- 「方案选型」的 Q「定」如果末尾标 `→ 影响 BFx`，对应 BFx 必须在「实现.业务流」存在；BF 实现的关键参数（数字 / 阈值 / 分支条件）能在某条 Q 的「定」里追到出处
- 「异常与失败模式」表「所属 BF」列必须出现在「实现.业务流」里；「单测设计」每条 case 必须挂在某个 BF 下
- frontmatter 的 status / type 与正文实际状态匹配？
- 跨文档：与既有 ADR / wiki 历史决策一致？——**指控"和 ADR-X / wiki/Y 冲突"必须 Read 过那份文档 → 触发 Evidence Gate**

### 6. 范围是否合理

- 过度设计：写了处理不可能发生的输入、做了"将来可能用"的扩展？
- 欠考虑：关键维度缺失？复杂度被低估？
- 「方案选型」项数与项目复杂度匹配——小改动列 6+ Q = 过度（微小决策不必入档，升 ADR）；系统级只列 1 项 = 欠
- 「业务流」BF 数量匹配——单一改动给了 8 条 BF = 过度；复杂系统只给 1 条 = 欠
- 单 BF 详细度匹配——简单改动给了 50 行业务流伪代码 = 过度；复杂逻辑只给 3 行 = 欠
- 文档长度与项目规模匹配（小改动写了 30 页 / 系统级写了 3 节都是信号）

### 7. 骨架可读性（Structural Readability）

专门覆盖新骨架（背景 / 目标 / 架构 / 实现 / 方案选型 / 其他 6 节线性递进）的可读性准则。**先整体后局部**两层评估——整体问题严重度优先。整体论证立不住时，单句再漂亮也救不回来。

**整体层（可上 Critical）：**

- **入口段引用未定义术语 / 缩写**：TL;DR / Summary 用了全文才解释的内部词，读者必须读完全文才懂入口段
- **元结构标签作 H2**：「上半 / 下半 / Human Review / Agent Implementation」等告诉读者"这一节给谁看"的元标签——直接上 Critical，建议改为内容实体名
- **节间无承上启下**：架构.文本总结后突然进实现，未交代映射关系；实现节内 5 子节之间无衔接
- **方案选型 Q→选项→定 三行格式破坏**：Q 不是问句、选项 < 2、定缺否决理由、长论证混入（应升 ADR）
- **业务流缺 BF 编号 / 异常表缺「所属 BF」列**：让 reviewer 没法把业务流 ↔ 异常 ↔ 单测三节交叉对照
- **pain point 平铺不分主次**：背景节列 ≥3 条 bullet，未显式标主因 vs 辅因
- **项目内自创词未首次解释**：dogfood / humanizer / two-half / 内部 component 名 等首次出现无 inline 解释
- **小黄鸭跳步**：决策 / 数字 / 阈值出现却无"为什么"——含「显然 / 众所周知 / 不言而喻 / 不必赘述」等跳步信号词
- **直白检验失败**：一句话讲不清复杂概念——表现为段首堆砌技术术语而无直觉先导；不假设读者背景的"教不会"段落。**不因"无类比"扣分**——类比是 nice-to-have 不是必需。
- **论证链断点**：第 N 节的结论建立在第 N+M 节才定义的概念上，跳着读拼不起来
- **决策与展开错位**：方案选型 Q「定」选了 A，实现.业务流却展开 B
- **关键决策被埋**：最重要的决策段被塞在 200 字段落中间，不在段首或独立成段

**局部层（一般 Warning / Suggestion）：**

- **段落墙**：单段 ≥8 句、无列表无 break 的信息块
- **信息密度失衡**：一段塞 5 个独立论点（拆）；三段说同一件事（合）
- **节奏单调**：连续 5 段都是无差别长段、零列表零表格
- **视觉媒介错配**：明显是对比表 / 时间线 / 决策树的内容，硬写成连续长段
- **子图缺失**：某条 BF 合并多张力同时拍板（如 session + SLO + fallback）、纯文字需要 reviewer 自己脑里画状态机 → 应在该 BF 下加局部状态机 / 子流程图（见 `doc-types/design-doc.md` 子图触发判据）；判级 Suggestion——只在反过来"加图明显更易读"时提，不强求
- **跨章重复**：同一个论点在 3+ 节复述（信号：你 ctrl-F 同一论点出现 3 次）

**Critical 触发边界**：整体层问题**实际影响理解**时——关键决策段读不下去、论证链断到 reviewer 自己拼不起来、元标签 H2 让读者困惑、术语前后矛盾。纯句式累 / 段落微长 → Warning；可优化但不影响理解 → Suggestion。

## 附带检查（顺手做，非 Critical）

### Structural（机器可验证）

按 doc-type 不同：

**通用**：
- frontmatter 字段齐全（type / topic / date / author / status）
- type 是 prd / rfc / design-doc / adr 之一
- status 符合该 type 的状态机
- H2 章节名是内容实体；**含「上半 / 下半 / Human Review / Agent Implementation」等元标签作 H2 直接上 Critical**

**PRD**：必有节「背景 / 目标 / 用户场景 / 验收标准」；用户场景每条含 角色 / 触发 / 当前流程 / 期望流程 / 痛点定位；验收标准必含**明确排除**子节
**RFC**：必有节「背景 / 目标 / 提案 / 影响评估 / 开放问题」；背景含 evidence；影响评估含**缺点 / 风险**子节（不允许缺）；提案.问题拆解每问题三件套（说明 / 方案对比 / 结论）
**Design Doc**：必有节「背景 / 目标 / 架构 / 实现 / 方案选型 / 其他」6 顶层节；架构含「文本总结」必填子节（架构图 / 流程图 / 时序图 可选）；实现含 5 必填子节按固定顺序「影响 / 接口设计 / 业务流 / 异常与失败模式 / 单测设计」；接口设计按面分 3 段 (对外 API / 数据模型 / 内部接口) 按需展开 (涉及前后台对接必有对外 API 段, 涉及多表关联必画 ER 图)；业务流必须 BF1/BF2/... 编号；异常表必有「所属 BF」列；单测按 BF 分组每条 Given/When/Then 三行；方案选型每项 Q→选项→定 三行格式；其他.部署节必填（可一行"无部署变更"）
**ADR**：必有节「背景 / 决策 / 后果」；决策含 说明 / 方案对比 / 结论 三件套；方案对比 ≥ 2 个真备选 + 真否决理由；后果含**负面**子节（不允许缺）；结论用主动语态、现在时态

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
13. **方案选型缺否决理由**：「定」只写选的方案不说为啥不选其他

## 输出格式（设计文档专属示例）

每条 finding 套 findings-contract 的 schema，`axis` = 上方维度名（如「决策站得住脚」「实施可执行」「骨架可读性」）。设计文档评审的 Report 示例：

```markdown
## Review Report
**Doc**: <path> · **Type**: design-doc

### ❌ Critical
- **C1** [`## 方案选型 → Q2`]：「定」只写"选方案 A"未给否决理由（维度 2）
- **C2** [`### 接口设计`]：文档写 `CreateSession(uid string)`，但 `pkg/auth/session.go:42` 实际 `CreateSession(ctx context.Context, uid string)`——少 ctx（Evidence Gate 已核实）
- **C3** [`### 业务流`]：BF1 写成 ASCII 文件树而非 function 伪代码（维度 4）

### ⚠️ Warning
- **W1** [`### 业务流 → BF1`]：抽象描述"调用会话模块" → 用 `auth/session.go::CreateSession`

### ❓ Open Questions
- **Q1** [`### 影响`]：文档列了 `auth/session.go::CreateSession`，本地 grep 搜不到——新建文件还是路径写错？

### Self-Audit
- **SA1** 文档说"调用 design-doc-writing skill"——没说调用方在哪 / 什么时机（→ 与 C1 同根）

## Verdict
❌ Has issues — 见上方编号清单，用户决定修哪些 / 答哪些。
```

无问题时：`✅ Pass — 没有发现 Critical / Warning / Open Questions。` + `## Verdict\n✅ Pass`。

> 编号规则 / Evidence Gate / Self-Audit 判据 / verdict schema 全见 reviewer-discipline + findings-contract，本文不复述。
