---
name: dev-design-refine
description: 设计完善——把选定方案细化为领域设计、模块设计、接口、业务流，产出设计文档。支持 feat/bug/refactor/research 四种场景。基于 DDD 高内聚低耦合原则。由 dev-design 在方案选定后调用，也可用户直接要求写设计文档 / RFC / ADR / 重构方案时进入。Not for code comments, PR descriptions, commit messages, or READMEs.
---

# dev-design-refine — 设计完善

**Iron Law: 详细设计不是"写文档"——领域怎么拆、模块怎么组织、接口长什么样，这些是设计决策。文档只是这些决策的载体。**

dev-design 选完方案（"走哪条路"），本 skill 做详细设计（"选定的路怎么走"）：领域划分、模块设计、接口设计、业务流、文件影响。设计文档是详细设计的自然产出物，不是额外"写"出来的。

> Leading word: **领域设计**。所有细化收敛到一份按 DDD 组织的设计文档。

## DDD 基础原则（贯穿全 skill）

- **域 = 围绕业务实体的边界**（名词不是动词）。"订单域 / Agent 域"，不是"创建 / 同步"
- **高内聚**：每个域 / 模块自包含——接口 + 业务流 + 文件影响 + 验证 + 安全/性能 都在自己的章节里
- **低耦合**：域间通过接口交互，边界显式标出
- **总分结构**：先总图（全局一屏看完）再分（各域 / 模块展开）。先图后文
- **接口四层**：对外 API / 类接口 / 事件接口 / 数据契约——按需展开，不只有 HTTP

## 非本 skill 请求

- 没有 dev-design 的选定方案，要先探索方案 → 回 `nocode:dev-design`
- 写代码注释 / PR 描述 / commit message / README / changelog → 不进
- 纯执行不需设计 → 直接做

## Enter Gate

- [ ] dev-design 已完成（选定方案 + 探索结论 + 测试计划），或用户直接要求写设计文档并已说清要做什么
- [ ] 场景类型已确定（feat / bug / refactor / research）

> 端到端示例见 `references/examples/example-design-doc-dogfood.md`（feat）+ 其余 doc-type 示例。

## 协议

### Step 0: TaskCreate

**进入后第一件事**，按场景类型创建对应 task。四种场景的 task 列表见下方各模板的 Step。通用收尾两步（Review + 保存）所有场景都有。

```
通用结构：
Task 1: 确定场景 + 加载输入
Task 2..N: 按场景模板的 Step（feat 最多，research 最少）
Task N+1: Review（引 reviewing 框架，有异议升档交叉 + 用户逐条确认 + Review Log）
Task N+2: 保存 + 渲染
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

---

### Step 1: 确定场景 + 加载输入 + 读 example

**Enter Gate:**
- [ ] 能拿到设计输入（dev-design 产出，或用户直接描述）

**Core Actions:**
1. **确定场景**（从 devflow 继承，或按意图判断）：

   | devflow 场景 / 用户意图 | 本 skill 场景 | 用哪个模板 |
   |---|---|---|
   | Full / 新功能 / 产品设计 | **feat** | DDD 域设计（最完整） |
   | Fix / bug 修复 | **bug** | 根因 → 修复 → 影响 → 验证 |
   | 重构 / 重组 / 迁移 | **refactor** | 现状 → 目标 → 迁移 |
   | 预研 / 技术选型 / 调研 | **research** | 问题 → 调研 → 对比 → 结论 |

2. **读对应 example 作为参考**：
   - feat → Read `references/example-feat-skeleton.md`（多域/单域完整示例）
   - bug → Read `references/example-bug-skeleton.md`
   - refactor → Read `references/example-refactor-skeleton.md`
   - research → Read `references/example-research-skeleton.md`
   学骨架和颗粒度，不照搬措辞。

3. **加载输入**：dev-design 的选定方案、探索结论、UI 设计（`.ix.md` / `.vd.md`，如有）、测试计划。无 dev-design 产出时，从用户描述提取。

**Exit Gate:**
- [ ] 场景类型已定
- [ ] 对应 example 已读
- [ ] 设计输入已加载

---

### Step 2: 章节大纲 + 用户确认

**Enter Gate:**
- [ ] Step 1 完成

**Core Actions:**

基于场景类型和设计输入，生成**本次设计文档的章节大纲**，展示给用户确认。不同场景的章节不同（见各模板），但先让用户看"这份文档会有哪些章节"，用户可以加/减/调整顺序。

**feat 章节大纲示例**：

```
1. 背景
2. 调研（代码现状 + 竞品分析 + 已有决策）
3. 方案选择（Q1 格式统一 / Q2 同步策略 / Q3 实时通信 / Q4 冲突处理）
4. 领域划分 + 总图（资源域 + Agent 域）
5. 架构设计（技术架构图 + 数据流）
6. 表现层设计
   6.1 端到端业务流总图
   6.2 场景 1: 上传与解析 [资源.P1]
   6.3 场景 2: 冲突解决 [资源.P2]
   6.4 场景 3: 同步进度 [Agent.P1]
7. 领域层设计
   7.1 资源域（ImportParser / Validator / Deduplicator / Repo）
   7.2 Agent 域（SyncService / AgentClient）
8. 文件影响汇总
9. 验证策略汇总
10. 部署注意事项
11. 监控设计（Metrics / Logs / Traces）
```

**AskUserQuestion**：
- 确认大纲 → 进入 Step 3 逐章生成
- 要调整 → 修改后再确认
- 章节太多 → 去掉不需要的（如小改动不需要监控设计）

**Exit Gate:**
- [ ] 章节大纲经用户确认

---

### Step 3+: 逐章生成

按确认的章节大纲，逐章做详细设计。每个场景模板的具体步骤见下。

**通用原则**：
- 先图后文，每章有图的先画图
- 图标路径 ID / BF / 约束，文本引用 ID，互相跳转
- 每个域/场景章节自包含（接口+业务流+文件影响+验证+安全/性能）

**发现未明确内容时**：
详细设计过程中经常发现之前没想清楚的东西。两种处理：
- **小问题**（接口参数不确定、命名犹豫）→ AskUserQuestion 当场确认，不中断流程
- **大问题**（方案方向有冲突、缺少关键路径、架构假设不成立）→ 暂停设计，建议回退到 dev-design 重新评估方案，不带着问题硬写下去

---

## feat 模板（DDD 全流程，最完整）

> 新功能 / 产品设计。按 DDD 组织：总图（域关系）→ 边（交互场景 / 表现层）→ 节点（域设计 / 领域层）→ 汇总。

**设计思路**：用 DDD 拆分业务域，域间关系图就是产品设计全貌。边（域间关系）= 交互场景（表现层），节点（域）= 领域设计。先画总图让 reviewer 30 秒看清全局，再逐个展开边和节点。每个域自包含——接口、业务流、文件影响、验证都在域章节内，读一个域不用跳来跳去。

> 产出骨架示例见 `references/example-feat-skeleton.md`

### Step 2: 领域划分 + 总图

**Enter Gate:**
- [ ] 选定方案已加载
- [ ] 探索结论已加载

**Core Actions:**
1. **划分域**——从选定方案识别业务实体，按实体划域（名词不是动词）。**讲清为什么这么拆**：按变更边界拆（改一个域不需要动另一个域）。
2. **画总图**（先图后文）：
   - **多域** → 域间关系图：节点 = 域 + 核心实体，边 = 交互场景（用户流程）
   - **单域** → 域内模块关系图：节点 = 模块，边 = 调用 / 依赖
3. **总图 = 产品设计全貌**。每条边是表现层（用户看到的流程），每条边应对应 PRD 一条使用路径。

```
多域总图示例（节点=域，边=用户流程）：
┌──────────┐   导入流程    ┌──────────┐
│  资源域   │ ───────────→ │ Agent 域  │
│ Resource │ ←─────────── │  Agent   │
└────┬─────┘   同步状态     └──────────┘
     │ 预设管理
     ↓
┌──────────┐
│  预设域   │
│  Preset  │
└──────────┘
```

**Exit Gate:**
- [ ] 域划分完成，每域标核心实体 + 拆分理由
- [ ] 总图产出（先图后文）
- [ ] 每条边对应 PRD 使用路径（无 PRD 时对应用户流程）

### Step 3: 交互场景设计（边 / 表现层）

**Enter Gate:**
- [ ] 总图产出，边已识别

**Core Actions:**
逐条边展开。来自 pd-ix 的交互设计 → 细化为前端组件 + 消费的域接口；无 pd-ix 时从使用路径推导。

每个场景章节自包含：
- **流程图**（用户操作的串行步骤）
- **前端组件设计**（组件拆分 / 状态 / 关键交互）
- **消费哪些域的哪些接口**（连接表现层和领域层）
- **文件影响**（前端文件）
- **验证方案**（组件测试 / E2E）
- **安全 / 性能**（如涉及，如 SSRF 校验 / 大文件 streaming）

> 纯后端无 UI 时，"交互场景"变为"系统交互场景"（API 调用链 / 事件流 / 定时任务触发），结构同。

**Exit Gate:**
- [ ] 每条边展开完毕，每个场景有流程图
- [ ] 每个场景标注消费的域接口
- [ ] 每个场景有文件影响 + 验证方案

### Step 4: 域设计（节点 / 领域层）

**Enter Gate:**
- [ ] 交互场景已定（各域的接口需求已明确）

**Core Actions:**
逐个域展开。每个域自包含，内部拆到模块：

1. **域内模块关系图**（总览，先图后文）
2. **每个模块**：
   - 类接口（public 方法签名 + 关键字段）
   - 状态机（实体有状态转换时）
   - 业务流（BF 编号，`function`/`method` 签名 + 函数体 + 每行 `//` 注释，主路径 + 异常路径）
3. **域级接口设计**（四层按需，不只 HTTP）：
   - **对外 API**：HTTP / RPC / GraphQL 端点表（Method / Path / Request / Response / 错误码）
   - **类接口**：模块间 public 方法签名（多类协作画类图）
   - **事件接口**：Event / MQ / WebSocket / SSE
   - **数据契约**：DB schema（多表外键画 ER 图）/ 配置格式 / 文件格式
4. **域文件影响**（该域改哪些文件，ASCII 树 + (改)/(NEW)）
5. **域验证方案**（单测 / 集成）
6. **域安全 / 性能考量**（如涉及）

**Exit Gate:**
- [ ] 每域展开完毕，每域有模块关系图
- [ ] 每域接口按四层覆盖（涉及的都展开）
- [ ] 每域有业务流（BF 伪代码）+ 文件影响 + 验证方案

### Step 5: 汇总

**Enter Gate:**
- [ ] 所有边 + 所有域已展开

**Core Actions:**
- **文件影响总表**（前端 + 后端合并，全局视图，统计 NEW / 改 数量）
- **验证策略总表**（跨场景跨域的 E2E / 集成测试，各小节内的单测/组件测试见各小节）

**Exit Gate:**
- [ ] 文件影响总表产出（合并各小节）
- [ ] 验证策略总表产出（E2E / 集成覆盖每条使用路径）

→ 进入「通用收尾」（Review + 保存）。

---

## bug 模板

> 根因分析 + 修复方案。形状：现象 → 根因 → 修复 → 影响 → 验证。

**设计思路**：从现象追到根因，用代码追踪链（每步标 `[Read path:line]`）让 reviewer 能跟着走一遍推理过程。修复方案用"修复前 vs 修复后"的伪代码对比——不只说改了什么，要说"改之前是怎么走的、改之后怎么走"。总图画出问题在系统里的位置，reviewer 能判断修复会不会影响其他模块。

> 产出骨架示例见 `references/example-bug-skeleton.md`

### Step 2: 问题现象 + 复现

**Enter Gate:**
- [ ] 有 bug 描述或复现线索

**Core Actions:**
- 症状描述 + 复现步骤 + 预期 vs 实际
- 影响范围（哪些用户 / 场景受影响）

**Exit Gate:**
- [ ] 症状 + 复现步骤 + 影响范围已写清

### Step 3: 根因分析

**Enter Gate:**
- [ ] 复现已明确

**Core Actions:**
- **代码追踪**：从症状到根因的推理链，每步标 `[Read path:line]`
- **根因定位**：哪个模块、哪行逻辑有问题
- **总图**：问题在系统中的位置（受影响的模块关系图，先图后文）

**Exit Gate:**
- [ ] 根因定位（带 `[Read path:line]` 推理链）
- [ ] 问题位置图产出

### Step 4: 修复方案

**Enter Gate:**
- [ ] 根因已定位

**Core Actions:**
- 修复方式 + 为什么这么修（多种选择时简要对比）
- 类接口变更（如涉及）
- **业务流变更**：修复前 vs 修复后的伪代码对比
- 文件影响
- **验证方案**：回归测试（先复现 bug → 修复后验证）+ 复现用例
- 安全 / 性能影响（如涉及）

**Exit Gate:**
- [ ] 修复方案 + 理由
- [ ] 修复前后业务流对比
- [ ] 文件影响 + 回归测试方案

→ 进入「通用收尾」（Review + 保存）。

---

## refactor 模板

> 从 A 状态到 B 状态。形状：现状 → 目标 → before/after → 迁移。

**refactor 产出骨架示例**：

```
# Refactor: 资源同步从轮询改为事件驱动

## 现状分析
  现状结构图 + DDD 问题诊断
  问题：SyncService 轮询所有 Agent，耦合重、延迟高

## 目标设计
  Before                          After
  ┌─────────────┐                ┌─────────────┐
  │ SyncService │                │ SyncService │
  │ poll(all)   │     →          │ onEvent()   │
  │ 轮询全部     │                │ 事件驱动     │
  └─────────────┘                └─────────────┘
  变更理由 + 每个变更点说明

## 迁移策略
  Step 1: 加事件基础设施（可回滚）
  Step 2: 双写（轮询 + 事件并行）
  Step 3: 关闭轮询（一键回退到 Step 2）
  每步文件影响 + 验证 + 回滚方案

## 汇总
```

### Step 2: 现状分析

**Enter Gate:**
- [ ] 重构对象已明确

**Core Actions:**
- **现有结构**（总图：当前的模块 / 域关系，先图后文）
- **问题在哪**（为什么要重构）
- **DDD 视角审视**：域划分合理吗？高内聚低耦合吗？哪里耦合过重 / 职责混乱

**Exit Gate:**
- [ ] 现状结构图 + 问题诊断（DDD 视角）

### Step 3: 目标设计

**Enter Gate:**
- [ ] 现状问题已诊断

**Core Actions:**
- **目标结构**（总图：重构后的模块 / 域关系）
- **Before/After 对比**（两张图并排，标出每个变更点）
- 每个变更点的理由

**Exit Gate:**
- [ ] 目标结构图
- [ ] Before/After 对比 + 每个变更点理由

### Step 4: 迁移策略

**Enter Gate:**
- [ ] 目标设计已定

**Core Actions:**
- **步骤拆解**：怎么从 A 到 B，每步可回滚
- **兼容策略**：过渡期两套共存？还是一刀切？
- 每步文件影响
- 每步验证方案
- 风险 + 回滚方案

**Exit Gate:**
- [ ] 迁移步骤（每步可回滚）
- [ ] 兼容策略
- [ ] 每步文件影响 + 验证 + 回滚方案

### Step 5: 汇总

**Core Actions:**
- 文件影响总表
- 验证策略总表（重构尤其重回归测试——证明行为不变）

**Exit Gate:**
- [ ] 文件影响总表
- [ ] 验证策略总表（含行为不变的回归验证）

→ 进入「通用收尾」（Review + 保存）。

---

## research 模板

> 预研 / 技术选型。形状：问题 → 调研 → 对比 → 结论。**预研文档不含实现设计，产出是决策建议。**

**research 产出骨架示例**：

```
# Research: Agent 同步方案选型

## 问题定义
  要研究什么 + 边界 + 评估维度（延迟/可靠性/成本）

## 调研
  研究发现（每条带 [SOURCE]）

## 选项对比
  | 维度 | WebSocket | SSE | 轮询 |
  |---|---|---|---|
  | 延迟 | 实时 | 实时 | 秒级 |
  | 可靠性 | 需重连 | 自动重连 | 高 |
  | 成本 | 高(长连接) | 中 | 低 |

## 结论
  推荐 SSE + 理由
  后续：进 dev-design 做详细方案
```

### Step 2: 问题定义

**Enter Gate:**
- [ ] 有预研主题

**Core Actions:**
- 要研究什么、为什么（边界 + 约束 + 评估维度）

**Exit Gate:**
- [ ] 问题边界 + 约束 + 评估维度已定

### Step 3: 调研

**Enter Gate:**
- [ ] 问题已定义

**Core Actions:**
- 委派 `research-workflow` skill（见 `skills/research-workflow/SKILL.md`），`type: mixed`，`depth: shallow`（默认；用户明确要求深入调研，或该预研要作为正式决策依据时改 `deep` 加对抗验证）
- 每条发现带 `[SOURCE: url]` / `[Read path:line]` 来源

**Exit Gate:**
- [ ] 调研发现产出，每条带来源

### Step 4: 选项对比

**Enter Gate:**
- [ ] 调研完成

**Core Actions:**
- 逐维度对比表（每个选项 × 每个评估维度）
- 每个选项的优劣 + 适用条件

**Exit Gate:**
- [ ] 逐维度对比表
- [ ] 每个选项优劣 + 适用条件

### Step 5: 结论 + 建议

**Enter Gate:**
- [ ] 对比完成

**Core Actions:**
- 推荐 + 理由
- 不推荐的为什么
- **后续行动建议**：进 dev-design？进 dev-plan？还是放弃？

**Exit Gate:**
- [ ] 推荐结论 + 理由
- [ ] 后续行动建议

→ 进入「通用收尾」（Review + 保存）。

---

## 通用收尾：Review + 保存（所有场景）

### Review（调 reviewing 引擎 · 有异议升档）

**Enter Gate:**
- [ ] 设计文档初稿完成

**调 reviewing 引擎**：本 Review 的评审执行走 `reviewing` 引擎——Read `references/design-doc-review.md` 拿设计文档评审维度，然后 `Skill(nocode:reviewing)`，声明：

- **对象** = 设计文档
- **领域维度** = design-doc-review 的 7 维度核心审查（设计意图 / 决策 / 完整性 / 可执行 / 一致性 / 范围 / 骨架可读性）+ 附带检查
- **方法** = checklist（或让引擎按对象自选）
- **Context Capsule** = 已拍板决策 / 被否决方案及原因 / 非目标 / 预算（不带作者对文档的预期结论）
- **档位**（领域特化）：设计文档跨模块、含架构 / 选型决策 → 重档（7 维度全量过）；琐碎改动 / 文案修订、拿不准 → 轻档（agent 自判，命中重档信号后要降只认用户显式否定词）

引擎产 findings + verdict——主路派发 / 升档异源交叉 / CLAIM 剥离 / codex 降级 / Evidence Gate / Doubt Theater / 分级归一（五档 C/W/S/Q/SA，Q/SA 经 kind 承载不丢语义）全由引擎承载，本节不复述。dev-design-refine 拿到引擎返回的 findings（五档全保留）后，做下面的收口确认。

**收口 + 用户确认（框架步骤 7 · hard gate）**：
- 把 findings 完整呈现给用户（C / W / S / **Open Questions(Q)** / **Self-Audit(SA)** 五档全保留，后两者绝不能漏）
- 每条问题短编号（`C1 / W1 / S1 / Q1 / SA1`）
- 用户逐条勾选 fix / skip；Open Questions 三选 fix / skip / **answer**
- 快捷选项：「全修 Critical+Warning+Self-Audit」「全跳过」「自由指示」
- **Critical 不可 override**（skeleton §5）；**用户确认前不动文档主体**
- 例外：verdict `approved:true`（reviewer ✅ Pass）→ 跳过此步直接保存

**修订 + Review Log**：
- 据用户决定 in-place 改主体；不在清单里的问题不顺手修
- 把本轮 findings 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`
- 询问「再来一轮 review？」是 → 回 Review 调引擎（是否重跑异源交叉由引擎按 delta 判据定：纯修复不重跑，结构性变更 / 用户要求才重跑）；否 → 保存

**Exit Gate:**
- [ ] 评审已调 reviewing 引擎（传 design-doc-review 维度）
- [ ] 引擎返回 findings（升档时含异源交叉，或引擎记录未升档）
- [ ] findings 套统一契约（五档；Q/SA 经 kind）
- [ ] 用户逐条确认 fix / skip
- [ ] 修订完成 + Review Log 已追加

### 保存 + 渲染确认

**Core Actions:**
1. 保存到 `{dev_design_output}`（见 `model/agent-about.md`「文档产出路径变量」）
2. **AskUserQuestion：是否渲染成 HTML？**
   - 是 → 调 `Skill(nocode:dev-design-render)` 把设计文档转成可浏览的 HTML（架构图/流程图/时序图渲染为 SVG，表格可交互）
   - 否 → 设计文档（markdown）即最终交付
3. **硬交接**：向调用方/用户报告 dev-design-refine 完成 + 文档保存路径——若由 dev-design Step 8c 调入，交回其 Step 9 继续评审；独立进入则向用户报告完成并建议下一步（评审走 dev-review / 直接进 dev-plan）

**Exit Gate:**
- [ ] 文档已保存到正确路径
- [ ] 渲染确认已完成（渲染 / 跳过）
- [ ] 全部 Task 状态已更新

---

## 写作准则（核心）

> **同源 note**：本节准则与 `references/design-doc-review.md`《核心审查》是同一套规则的两个视角——writer 视角"做什么" vs reviewer 视角"挑什么"。改一处务必同步检查另一处。

理解原则比死守章节更重要。

### 1. DDD：域按实体拆，每域自包含

域名是名词（订单 / Agent / 会话），不是动词（创建 / 同步 / 更新）。同一实体被拆到多个"域" = 拆错了。每个域 / 模块章节自包含：接口 + 业务流 + 文件影响 + 验证 + 安全/性能 都在自己的章节里，reviewer 读一个域不用跳来跳去。

> ✅「资源域 / Agent 域」（实体）
> ❌「导入解析 / 存储去重 / 同步」（动词 = 流水线阶段，不是 DDD 域）

### 2. 总分结构：先总图再分，先图后文

文档先给总图（全局一屏看完），再逐节展开。每节内也先图后文——图放前面让读者先理解结构，文字补充图里没传达的细节。**禁止**"5 段文字 + 1 张图作总结"反向布局。

> ✅ 总图（域关系）→ 边展开 → 节点展开 → 汇总
> ❌ 直接跳进第一个模块的代码细节，读者不知道整体长什么样

### 3. 接口四层，不只 HTTP

接口设计覆盖：对外 API（HTTP/RPC/GraphQL）/ 类接口（public 方法签名 + 类图）/ 事件接口（Event/MQ/SSE）/ 数据契约（DB schema + ER 图 / 配置格式）。涉及哪层展开哪层。

> ✅ 资源域：类接口（ImportParser.parse 签名）+ 数据契约（Resource 表 + ImportManifest 格式）+ 对外 API（/api/import）
> ❌ 只列了 HTTP 端点，类怎么协作、数据怎么存只字未提

### 4. 视觉化优先：内容形态匹配视觉媒介

≥3 个并列项 / 对比 / 流程 / 状态转换 / 矩阵关系**禁止**写成长段，必须用对应媒介：

| 内容形态 | 用什么 |
|---|---|
| 多个对比维度（≥3 cell） | 表格 |
| 时序流程 / pipeline | ASCII 流程图（节点 + ↓） |
| 组件拓扑 / 数据流 | ASCII 架构图（方框 + 连线） |
| 状态转换 | 状态机图（节点 + 标条件的箭头） |
| 决策分支 | 决策树 |
| 层级 / 文件结构 | ASCII 树（`├─` `└─`） |

**图密度**：普通设计至少 1 张总图 + 各域 1 张模块图；长文档（>10 屏）平均 1-2 屏 1 张图作节奏锚点。

**图粒度**：总图组件 ≤ 7 / 流程节点 ≤ 10 / 时序角色 ≤ 5，超了下沉到子图，不靠把总图画大。

### 5. 小黄鸭式讲解：把"为什么"讲透

把读者当成完全没看过项目的小黄鸭——每个决策、每个数字都要 explain。遇到「显然」「众所周知」→ 信号说明跳步了，回去补"为什么"。数字 / 阈值 / 模块名 / 行号 都要交代来源，不允许 magic number。

> ✅「`HOLD_SIZE = 64` 字符。来源：最长入口点 30 字符 + LLM chunk 容差 → 64 字符滑窗才能稳定捕获跨 chunk 拼接。」
> ❌「`HOLD_SIZE = 64`（显然够用）。」

### 6. 直白讲 + 项目术语首次解释

一句话讲不清的概念说明你没真懂，回去搞懂再写。先讲直觉再补细节，不堆术语，不硬塞类比。项目内自创词 / 缩写首次出现一句话 inline 解释；业界通用名词（HTTP / TDD / retry）不解释。

> ✅「dogfood（用自己产出的工具实测）本插件历史决策……」
> ❌ 通篇用自创词却没告诉读者是什么

### 7. pain point 分主次

「背景」列多条问题时显式标主因 vs 辅因，不平铺 bullet 让读者自己排序。

> ✅「核心问题：迁移要手动 20+ 次。附带的格式不统一、缺校验——本设计顺带解决。」
> ❌「问题：1. 重复操作 2. 格式乱 3. 没校验 4. 没进度」（平铺不知哪条最痛）

### 8. 决策 ↔ 业务流交叉引用

域设计里的关键决策（如有多种选择），如果直接影响某条业务流，在决策处标注 `→ 影响 BFx`，reviewer 能跳到对应 BF 验证决策落地。

### 9. 业务流伪代码硬规则

- `function` / `method` 签名 + 函数体行，每行一句意图
- **每行 `//` 注释**（小黄鸭式，复杂逻辑 / 数字阈值必须讲来源）
- 真实类名 / 方法名（`AgentLoop.callLlmForTurn`），不用 placeholder
- **不是**文件结构树、**不是**层次列表、**不是**散文（那些属「文件影响」节）

## 实现的边界：design-doc vs plan vs ops doc

**判据**：design doc 回答"为什么这么设计 + 关键路径长什么样"；plan 回答"按什么顺序写代码"；ops doc 回答"出问题怎么操作"。

留给 **plan**（dev-plan skill）：class 内部具体实现（私有方法 / 循环 / retry 退避算法）、TDD 步骤化清单、每步验证命令、mock 工具具体用法。

留给 **ops doc**：详细部署脚本 / K8s manifest / Helm chart、监控 dashboard 配置、告警 runbook。

设计文档的「业务流」止于"足以让 reviewer 判断设计合理"的粒度，不进 class 内部细节。「单测设计」按 BF 分组列 case（Given/When/Then 三行），**不写代码**（不写 `@Test` / mock setup / assertion 语法）。

## 「文件影响」节硬格式

多模块 ASCII 树 + (改)/(NEW) + ①②③ 编号要点。路径完整到包名（不缩略）；同一文件多处改动用 ①②③ 编号；行号 / 函数名能给就给。

```
src/services/import/
  ├── parser.ts                 (NEW)  三种格式解析
  └── validator.ts              (NEW)  资源校验
src/services/
  └── resource.ts               (改)   ① batchCreate() 方法
                                       ② findByNameAndType() 查询
```

## 常见反模式

- ❌ **域按动词拆**：把流水线阶段（解析 / 存储 / 同步）当 DDD 域——应按实体（资源 / Agent）拆
- ❌ **跳过总图**：直接进细节，读者不知道整体长什么样
- ❌ **接口只写 HTTP**：类怎么协作、数据怎么存只字未提
- ❌ **章节空话**：「需要保证安全性、性能」「未来可扩展」——无具体内容的填充
- ❌ **跳过 reviewer**：不 spawn reviewer 直接交付——review 是 hard gate
- ❌ **代用户拍板**：拿到 Report 自己挑修哪些——用户确认是 hard gate
- ❌ **吞 Review Log**：只改主体不 append Review Log——审计轨迹断
- ❌ **把 plan 内容塞进来**：class 内部 / TDD 步骤 / 具体 catch 块写法
- ❌ 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉收尾交接——进了 skill 就走完所有 Step（详见 agent-catalog-using.md「进了 skill 就走完」）

## 看 examples 学结构，不照搬措辞

`references/examples/` 下每个 doc-type 有 dogfood + business 两份示例。**看 example 学骨架，不照搬措辞 / 不套业务情境**。措辞按你的语境调；决策数量按设计复杂度（核心只有 1 个关键决策就写 1 个，不硬凑）；伪代码注释密度按复杂度（简单流程不必每行讲来源）。

## 状态机

- **Design Doc**：`draft → in-review → approved → implemented → archived`（**living**，approved 后仍可修改）
- **预研报告**：`draft → reviewed → decided`（决策做出后归档）
- 旧 doc-type（PRD / RFC / ADR）状态机见 `references/doc-types/<type>.md`

## 输出路径

路径由 `{dev_design_output}` 变量定义（见 `model/agent-about.md`「文档产出路径变量」）。同 topic 的 plan 等文档落同一目录。

## references 索引

- `references/doc-types/<type>.md` — 各 doc-type 详细骨架与写作要点（design-doc / prd / rfc / adr）
- `references/examples/example-<type>-{dogfood,business}.md` — 填好的示例
- `references/design-doc-review.md` — 设计文档评审维度（调 reviewing 引擎时传入）
- `references/cards/{quick-view,prerequisites}.md` — 骨架驱动型内容的可选锚点节
- `Skill(nocode:dev-design-render)` — 设计文档 → HTML 可视化
