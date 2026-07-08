---
name: dev-design-refine
description: 详细设计——把 dev-design-select 的方案（Decision Packet）细化为设计文档并做唯一评审，feat / bug / refactor 三场景。由 dev-design 协调器在方案选定后调用，或用户直接要求把已定方案写成详细设计文档时进入。Not for 选方案/技术选型/预研（use nocode:dev-design-select），渲染 HTML（use nocode:dev-design-render），code comments, PR descriptions, commit messages, or READMEs.
---

# dev-design-refine — 设计完善

**Iron Law: 详细设计不是"写文档"——领域怎么拆、模块怎么组织、接口长什么样，这些是设计决策。文档只是这些决策的载体。**

dev-design-select 选完方案（"走哪条路"，产出 Decision Packet），本 skill 做详细设计（"选定的路怎么走"）：领域划分、模块设计、接口设计、业务流、文件影响。设计文档是详细设计的自然产出物，不是额外"写"出来的。

> Leading word: **领域设计**。所有细化收敛到一份按 DDD 组织的设计文档。

## DDD 基础原则（贯穿全 skill）

- **域 = 围绕业务实体的边界**（名词不是动词）。"订单域 / Agent 域"，不是"创建 / 同步"
- **高内聚**：每个域 / 模块自包含——接口 + 业务流 + 文件影响 + 验证 + 安全/性能 都在自己的章节里
- **低耦合**：域间通过接口交互，边界显式标出
- **总分结构**：先总图（全局一屏看完）再分（各域 / 模块展开）。先图后文
- **接口四层**：对外 API / 类接口 / 事件接口 / 数据契约——按需展开，不只有 HTTP

## 非本 skill 请求

- 没有选定方案（无 Decision Packet），要先探索 / 选方案 → 回 `nocode:dev-design-select`
- 写代码注释 / PR 描述 / commit message / README / changelog → 不进
- 纯执行不需设计 → 直接做

## 协调模式：确认与回退

- **确认点**（Step 2 文档结构确认 / Review findings 逐条 fix-skip / 是否渲染）：被 `dev-design` 协调器调用时**返回 `needs_user_input`** 交协调器统一弹（envelope 单源见 select SKILL「收尾」节）；独立运行时用本地 AskUserQuestion。
- **方案级决策变更**（改数据流 / 模块边界 / 外部契约 / 关键约束）：返回 `replan_required` 回 select 重选（不是 needs_user_input）——方案级决策的唯一所有者是 select，refine 擅自改会让文档与已确认的 Decision Packet 漂移。
- **StageResult** = `completed | needs_user_input | replan_required`（refine 向协调器返回的三态，与 select 对齐）。

## Enter Gate

- [ ] dev-design-select 已完成（Decision Packet：选定方案 + 探索结论 + 测试目标），或用户直接要求写设计文档并已说清要做什么
- [ ] 场景类型已确定（feat / bug / refactor）

## 协议

> **消费 Decision Packet**：refine 是决策包的**消费方**——dev-design-select 产出、经协调器传入。schema（含 requiredFields / 条件必填 / replan envelope）单源在 `dev-design-select` SKILL 的「收尾」节，本 skill 只按它校验、映射、消费，不重复定义。

> **内部 Step 编号统一**：通用流程步 **Step 0-5** 与场景模板 detail 步 **Step 4a/4b/…** 连续编号，不各自从 Step 2 重启——历史上"通用 Step2 章节大纲 vs 场景 Step2 领域划分"曾因各自编号撞车，统一编号后消除。

### Step 0: TaskCreate

**进入后第一件事**，创建以下 task（Step 4 内部 detail 子步因场景而异，见场景模板）：

```
Task 1: 消费 Decision Packet + 确定场景 + Read 场景模板/写作准则/example（步 7 落笔前核对）
Task 2: 文档结构确认——章节大纲 + 结构骨架，用户确认（步 8）
Task 3: 架构审核——审结构骨架的域拆分/边界/依赖（步 9）
Task 4: 信息补全——按场景模板 4a/4b 逐节补全，遇新决策套 replan 判据（步 10）
Task 5: 汇总——文件影响总表 + 验证策略总表（步 11）
Task 6: Review（唯一评审：调 reviewing 引擎、有异议升档交叉 + 用户逐条确认 + Review Log）（步 12）
Task 7: 保存 + 渲染确认 + handoff（步 13-14）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

---

### Step 1: 消费 Decision Packet + 确定场景 + 加载输入

> 对应 14 步流程线的 **步 7 落笔前核对**。落笔前先校验上游交接契约完整，再确定场景、加载场景模板与输入。

**Enter Gate:**
- [ ] 能拿到设计输入（dev-design-select 的 Decision Packet，或用户直接描述）

**Core Actions:**

1. **消费 + 校验 Decision Packet**（经协调器从 select 传入时必做；用户直接描述、无 Packet 时跳过校验、从描述提取）：
   - **校验 version**：不支持的 schema version → **返回错误**，不静默按当前版本硬解析（防上下游字段漂移）
   - **校验 requiredFields**（**清单单源见 `dev-design-select` SKILL「收尾」节的 schema**，本 skill 不复述字段名以防漂移）：缺任一 → 报缺、回协调器补，不带缺口硬写
   - **条件必填校验**：`isAIFeature=true` 时 `evalSpec` 必填；涉及运行时逻辑时 `domainDecisions.observability.basicLogging` 必填。**空数组 / 空占位视为缺失**，不放行
   - **字段映射到文档章节**：`selectedApproach + alternatives → 决策章节`（反方配平用 `alternatives`）、`constraints → 约束`、`domainDecisions → 领域/架构设计`（含可观测基础日志层）、`openQuestions → 未决项`（进信息补全消解，遗留则进 Review 的 Open Questions）、`testObjectives + verifyStrategy → 验证策略`、`evalSpec → eval 设计节`、`sources → 前置调研`

2. **确定场景 + Read 对应场景模板**（从 devflow / Packet 继承，或按意图判断）：

   | devflow 场景 / 用户意图 | 场景 | 必 Read 的模板 | 骨架示例 |
   |---|---|---|---|
   | Full / 新功能 / 产品设计 | **feat** | `references/template-feat.md` | `references/example-feat-skeleton.md` |
   | Fix / bug 修复 | **bug** | `references/template-bug.md` | `references/example-bug-skeleton.md` |
   | 重构 / 重组 / 迁移 | **refactor** | `references/template-refactor.md` | `references/example-refactor-skeleton.md` |

   - **场景模板必 Read**——Step 2 的结构骨架产出标准和 Step 4 的 detail 子步（4a/4b）只存在于模板文件里，不读模板就没有可执行的场景内容。
   - **骨架示例必 Read**——学骨架和颗粒度，不照搬措辞；决策数量按设计复杂度（核心只有 1 个关键决策就写 1 个，不硬凑）；伪代码注释密度按复杂度。
   - 预研 / 技术选型 / 调研（research）→ 不在本 skill，走 `dev-design-select` 的预研模式。refine 只做 feat / bug / refactor 三种详细设计。

3. **Read `references/writing-principles.md`**（写作准则全文 12 条 + 文件影响硬格式 + 文档生命周期）——Step 2 起所有产出按它写，本文末尾只留索引。

4. **加载输入**：Decision Packet（选定方案 / 备选 / 约束 / 领域决策 / TO / evalSpec / 来源）、UI 设计（`.ix.md` / `.vd.md`，如有）。无 Packet 时从用户描述提取。

**Exit Gate:**
- [ ] Decision Packet 已校验（version + requiredFields + 条件必填齐；不齐已报缺回协调器）
- [ ] 场景类型已定，**对应场景模板 + 骨架示例 + 写作准则已 Read**，设计输入已加载

---

### Step 2: 文档结构确认（章节大纲 + 结构骨架）

> 对应 **步 8 文档结构确认**。一次产出"文档会有哪些章节"+"架构结构骨架"，让用户确认。结构骨架是下一步架构审核的对象。

**Enter Gate:**
- [ ] Step 1 完成（场景模板已 Read）

**Core Actions:**

1. **章节大纲**：基于场景模板的「章节大纲示例」生成本次文档的章节列表，展示给用户。
2. **结构骨架**（架构审核的对象，先图后文，产出标准见场景模板「结构骨架」节）：
   - **feat** → 域划分 + 域关系总图
   - **bug** → 现象 + 复现 + 影响范围（问题位置图在 Step 4a 根因分析里补细）
   - **refactor** → 现状结构图 + 目标结构图（before/after）
3. **展示 + 确认（拆两回合，大纲/骨架禁塞 AskUserQuestion）**：
   - **展示回合**：章节大纲（有序列表，一行一章）+ 结构骨架（代码块）作为**回合末尾文本**完整输出，末尾问「这个结构可以吗，还是要调整？」，**结束回合，不接任何工具调用**。大纲塞 `question` 会挤成密集段落，骨架塞 `preview` 会被终端折叠（`N lines hidden`）——用户什么都没看清就被要求确认。
   - **确认回合**：用户回应通常已是决策（确认 / 具体调整意见）→ 直接采纳，不再补 ask；回应含糊才 AskUserQuestion 澄清。要调整 → 改后重走展示回合；章节太多 → 去掉不需要的（小改动不需监控/eval 章）。

**Exit Gate:**
- [ ] 章节大纲 + 结构骨架经用户确认

---

### Step 3: 架构审核（结构确认后、信息补全前）

> 对应 **步 9 架构审核**。评审拆两层的**早层**：结构定型后立刻审架构骨架——架构错了此时改动成本最低。晚层（完整性/一致性/可执行）在通用收尾的唯一评审做，各审各的不重叠。

**Enter Gate:**
- [ ] Step 2 结构骨架已确认

**Core Actions:**
- 审 Step 2 结构骨架：**域拆分按实体（名词非动词）** / **模块边界清晰** / **依赖方向单向无环** / **高内聚低耦合**
- 对照 Decision Packet 的 `selectedApproach` + `domainDecisions`：结构是否忠实落地选定方案，无偏离
- **场景轻重**：feat / refactor 重点审（域/模块拆分是架构核心）；**bug 局部修复通常无跨模块架构影响 → 快速确认影响范围不跨模块即轻过**
- 发现架构级问题（域拆错 / 边界错位 / 依赖成环）→ 就地修正结构骨架、回 Step 2 重新确认；若问题触及**方案级决策**（改数据流 / 模块边界 / 外部契约 / 关键约束）→ 按 Step 4 replan 判据返回 `replan_required` 回 select

**Exit Gate:**
- [ ] 结构骨架架构审核通过（域拆分/边界/依赖方向），或轻过（bug 无架构影响）

---

### Step 4: 信息补全（逐章补全详细设计）

> 对应 **步 10 文档信息补全**。按场景模板的 detail 子步（**Step 4a / 4b / …**，见已 Read 的 `references/template-<场景>.md`）逐节补全。

**Enter Gate:**
- [ ] 架构审核通过

**通用原则**：
- 先图后文，每章有图的先画图
- 图标路径 ID / BF / 约束，文本引用 ID，互相跳转
- 每个域/场景章节自包含（接口+业务流+文件影响+验证+安全/性能）

**每遇新决策 → 套「局部 vs 方案级」判据**（方案级决策的唯一所有者是 select——refine 在补全中自行改方案级决策，文档会和已确认的 Decision Packet 漂移，评审和实现就会各信一边）：
- 改动**数据流 / 模块边界 / 外部契约 / 关键约束**任一 → **方案级决策**：停下，返回结构化 `replan_required`（含 `originalPacketRevision / invalidatedDecision / evidence / affectedSections[] / resumeState`，envelope 单源见 select SKILL），由协调器回 select 重选，不带方案级变更硬写
- 都没改（接口参数 / 命名 / 模块内部实现）→ **局部决策**：refine 自己定，小问题 AskUserQuestion 当场确认，不中断

**Exit Gate:**
- [ ] 场景模板各 detail 子步（4a/4b/…）完成
- [ ] 遇方案级决策已返回 `replan_required`（若有）

---

### Step 5: 汇总（文档落地）

> 对应 **步 11 文档落地**。所有场景共用一次汇总。

**Enter Gate:**
- [ ] Step 4 各 detail 子步完成

**Core Actions:**
- **文件影响总表**（合并各小节，全局视图，统计 NEW / 改 数量；硬格式见 writing-principles「文件影响」节）
- **验证策略总表**（跨场景跨域的 E2E / 集成测试；各小节内的单测/组件测试见各小节）

**Exit Gate:**
- [ ] 文件影响总表产出
- [ ] 验证策略总表产出（覆盖每条使用路径）

→ 进入「通用收尾」（Review + 保存）。

---

## 通用收尾：Review + 保存（所有场景）

### Review（唯一评审 · 调 reviewing 引擎 · 有异议升档）

> **本 Review 是整份设计文档的唯一一次全文评审**——历史上 dev-design 协调器与 refine 收尾各审一遍，重复且结论可能冲突；现在全文评审只在本步做，协调器只验证本步返回的**标准化 review verdict**、不重审。与 Step 3 架构审核**不重叠**：Step 3 是早层（结构定型时审架构骨架的域拆分/边界/依赖），本 Review 是晚层（全文写完时审完整性/一致性/可执行）。

**Enter Gate:**
- [ ] 设计文档初稿完成（含 Step 5 汇总）

**调 reviewing 引擎**：本 Review 的评审执行走 `reviewing` 引擎——Read `references/design-doc-review.md` 拿设计文档评审维度，然后 `Skill(nocode:reviewing)`，声明：

- **对象** = 设计文档
- **领域维度** = design-doc-review 的 8 维度核心审查（设计意图 / 决策 / 完整性 / 可执行 / 一致性 / 范围 / 骨架可读性 / 方案质量与验证覆盖）+ 附带检查
- **方法** = checklist（或让引擎按对象自选）
- **Context Capsule** = 已拍板决策 / 被否决方案及原因 / 非目标 / 预算（不带作者对文档的预期结论）
- **档位**（领域特化）：设计文档跨模块、含架构 / 选型决策 → 重档（7 维度全量过）；琐碎改动 / 文案修订、拿不准 → 轻档（agent 自判，命中重档信号后要降只认用户显式否定词）

引擎产 findings + verdict——主路派发 / 升档异源交叉 / CLAIM 剥离 / codex 降级 / Evidence Gate / Doubt Theater / 分级归一（五档 C/W/S/Q/SA，Q/SA 经 kind 承载不丢语义）全由引擎承载，本节不复述。dev-design-refine 拿到引擎返回的 findings（五档全保留）后，做下面的收口确认。

**收口 + 用户确认（hard gate）**：
- 把 findings 完整呈现给用户（C / W / S / **Open Questions(Q)** / **Self-Audit(SA)** 五档全保留，后两者绝不能漏）
- 每条问题短编号（`C1 / W1 / S1 / Q1 / SA1`）
- 用户逐条勾选 fix / skip；Open Questions 三选 fix / skip / **answer**
- 快捷选项：「全修 Critical+Warning+Self-Audit」「全跳过」「自由指示」
- **Critical 不可 override**——Critical 级 finding 不提供 skip 选项，必须修复，或经再评审降级后再议；**用户确认前不动文档主体**
- 例外：verdict `approved:true`（reviewer ✅ Pass）→ 跳过此步直接保存

**修订 + Review Log**：
- 据用户决定 in-place 改主体；不在清单里的问题不顺手修
- 把本轮 findings 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`
- 询问「再来一轮 review？」是 → 回 Review 调引擎（是否重跑异源交叉由引擎按 delta 判据定：纯修复不重跑，结构性变更 / 用户要求才重跑）；否 → 保存

**返回标准化 review verdict（交协调器）**：本 Review 收口后向协调器返回 verdict（`approved: true|false` + 未决 Open Questions + 剩余风险），schema 套 `findings-contract` 的 verdict 层。**协调器只验这个 verdict、不重新评审**——评审的唯一所有者是本步。

**Exit Gate:**
- [ ] 评审已调 reviewing 引擎（传 design-doc-review 维度）
- [ ] 引擎返回 findings（升档时含异源交叉，或引擎记录未升档）
- [ ] findings 套统一契约（五档；Q/SA 经 kind）
- [ ] 用户逐条确认 fix / skip
- [ ] 修订完成 + Review Log 已追加
- [ ] 标准化 review verdict 已产出（交协调器，供其验证不重审）

### 保存 + 渲染确认

**Core Actions:**
1. 保存到 `{dev_design_output}`（文档产出路径变量，项目本地 AGENTS.md / CLAUDE.md 可覆盖）
2. **AskUserQuestion：是否渲染成 HTML？**
   - 是 → 调 `Skill(nocode:dev-design-render)` 把设计文档转成可浏览的 HTML（架构图/流程图/时序图渲染为 SVG，表格可交互）
   - 否 → 设计文档（markdown）即最终交付
3. **硬交接**：向调用方/用户报告 dev-design-refine 完成 + 文档保存路径 + **review verdict**——若由协调器（dev-design）调入，返回 reviewed 文档 + verdict，协调器**只验 verdict 不重审**，继续状态机（→ render / final gate）；独立进入则向用户报告完成并建议下一步（评审已在本步做过，不再走 dev-review；直接进 dev-plan）

**Exit Gate:**
- [ ] 文档已保存到正确路径
- [ ] 渲染确认已完成（渲染 / 跳过）
- [ ] 全部 Task 状态已更新

---

## 写作准则索引（全文在 `references/writing-principles.md`，Step 1 已强制 Read）

此表只作回查索引，不是替代品：

| # | 准则 | 一句话要点 |
|---|---|---|
| 1 | DDD 拆域 | 域按实体（名词）拆，每域自包含 |
| 2 | 总分结构 | 先总图再分，先图后文 |
| 3 | 接口四层 | API / 类 / 事件 / 数据契约，不只 HTTP |
| 4 | 视觉化优先 | ≥3 并列项/流程/矩阵禁长段，用表格/ASCII 图 |
| 5 | 小黄鸭讲解 | 每个决策和数字讲透"为什么"，禁 magic number |
| 6 | 直白讲 | 自创词首次出现 inline 解释 |
| 7 | pain point 分主次 | 主因 vs 辅因显式标出 |
| 8 | 决策↔业务流互引 | 决策处标 `→ 影响 BFx` |
| 9 | 伪代码硬规则 | 真实类名 + 每行 `//` 注释 |
| 10 | 可观测两层 + eval | 基础日志默认必写；AI 功能必带 eval 设计节 |
| 11 | 决策章节三件套 | 速查表 + 反方配平 + `[已确认]/[假定]` 标注 |
| 12 | 术语规范 | 「中文 英文全称 - 缩写」+ 文末术语表 |

「文件影响」节硬格式、状态机与文档生命周期（推翻式修订 / superseded 留痕）也在该文件内。

## 实现的边界：design-doc vs plan vs ops doc

**判据**：design doc 回答"为什么这么设计 + 关键路径长什么样"；plan 回答"按什么顺序写代码"；ops doc 回答"出问题怎么操作"。

留给 **plan**（dev-plan skill）：class 内部具体实现（私有方法 / 循环 / retry 退避算法）、TDD 步骤化清单、每步验证命令、mock 工具具体用法。

留给 **ops doc**：详细部署脚本 / K8s manifest / Helm chart、监控 dashboard 配置、告警 runbook。

设计文档的「业务流」止于"足以让 reviewer 判断设计合理"的粒度，不进 class 内部细节。「单测设计」按 BF 分组列 case（Given/When/Then 三行），**不写代码**（不写 `@Test` / mock setup / assertion 语法）。

## 常见反模式

- ❌ **域按动词拆**：把流水线阶段（解析 / 存储 / 同步）当 DDD 域——应按实体（资源 / Agent）拆
- ❌ **跳过总图**：直接进细节，读者不知道整体长什么样
- ❌ **接口只写 HTTP**：类怎么协作、数据怎么存只字未提
- ❌ **章节空话**：「需要保证安全性、性能」「未来可扩展」——无具体内容的填充
- ❌ **不读场景模板就写**：主文件没有 4a/4b 场景内容，凭大纲硬写 = 跳过了 detail 子步的 Enter/Exit Gate
- ❌ **跳过 reviewer**：不调 reviewing 引擎直接交付——review 是 hard gate
- ❌ **代用户拍板**：拿到 findings 自己挑修哪些——用户确认是 hard gate
- ❌ **吞 Review Log**：只改主体不 append Review Log——审计轨迹断
- ❌ **把 plan 内容塞进来**：class 内部 / TDD 步骤 / 具体 catch 块写法
- ❌ 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉收尾交接——进了 skill 就走完所有 Step

## 输出路径

路径由 `{dev_design_output}` 变量定义（项目本地 AGENTS.md / CLAUDE.md 可覆盖）。同 topic 的 plan 等文档落同一目录。

## references 索引

- `references/template-{feat,bug,refactor}.md` — 三种场景模板（结构骨架产出标准 + Step 4a/4b detail 子步），Step 1 按场景必 Read
- `references/example-{feat,bug,refactor}-skeleton.md` — 三种场景的骨架示例，随场景模板一起 Read
- `references/writing-principles.md` — 写作准则 12 条全文 + 文件影响硬格式 + 文档生命周期，Step 1 必 Read
- `references/design-doc-review.md` — 设计文档评审维度（调 reviewing 引擎时传入）
- `references/cards/{quick-view,prerequisites}.md` — 骨架驱动型内容的可选锚点节
- `Skill(nocode:dev-design-render)` — 设计文档 → HTML 可视化
