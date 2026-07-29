---
name: devflow
description: 工程任务流程领航（8 阶段 · 4 场景路由）。可被 model 主动调起，也可用户 /调 进入。给"当前阶段判断 + 下一步建议 + 备选"，用户拍板，不替用户执行。agent 视角：复杂/多步/跨阶段任务（跨文件 + 状态未知 / 需要 commit / PR / 设计文档 / 评审 / 用户说"整个/整体/全流程"）时，主动调起本 skill。不用于简单单步任务（由 define skill 的 Mini 场景处理）。
---

# nocode:devflow — 工程任务流程领航

计划使用 `TaskCreate` / `TaskUpdate`，决策使用 `AskUserQuestion`；阶段 Skill 使用 `Skill(nocode:<stage-skill>)`。


> 驾驶舱。**model 命中复杂多步任务时主动调起**，用户也可 `/调` 进入。给建议不替执行。
>
> 各阶段只通过上方平台原生 Skill 语法进入；不读取路由层或其它插件内部实现。

跨 Design / Plan / Build / Verify 的设计项追踪 Gate 统一 Read `{QODER_PLUGIN_ROOT}/skills/references/design-traceability.md`；devflow 只展示阶段摘要，不复制四态或表结构。

## 协议

> **顺序推进纪律（硬约束）**：禁止自动跳步。推进只有一条路：todo 写好流程 → 进入当前节点 → 顺序执行子步骤 → 逐条验证 Gate → 全部通过 → 报告用户 → 等用户拍板 → 才进下一阶段。agent 不得自行跳过、合并、快进任何阶段或子步骤。"这步简单直接过" / "上一轮做过" / "用户说快点" / "用户说自主执行到 land" 都不是跳步的理由——快≠跳，可以每步简洁，不能省步骤。用户授权自主推进免除的是等待拍板的时间，不是阶段本身。

> ❌ 反例：进了某阶段判断"任务简单"，跳过该阶段的对抗审视 / 用户确认，用户一句"继续"就快进下一阶段——没走完 Gate 的产出直接往下游流。
> ✅ 正例：简单任务也逐子步骤走完 + 逐条验证 Gate + 等用户拍板；每阶段 todo 的最后一项是"调用下一阶段 skill"（如 Plan 末尾 → 调 `nocode:dev-build`），把交接固化成一个没勾的 task，context 丢了也不断在原地。

### Step 1: 调 Define 判断场景

任何任务进入 devflow 的第一步都是调 `nocode:dev-define`。Define 内部完成：
- 需求澄清 + 目标定义
- 场景分类（Full / Standard / Fix / Mini）

Define 返回后，拿到确认的 restate + 场景分类，进 Step 2。

**Full 场景产品流前置检查**（Define 返回 Full 场景后、进入 Step 2 前执行）：检查 `{pd_prd_output}` 所在目录下有没有已有 `.prd.md`：
- 有 → Define 读它作为输入，正常进 Step 2
- 没有 → 建议用户先走产品流（`nocode:pdflow`），用平台原生结构化决策询问“当前 Full 场景没有 PRD，下一步如何推进？”：
  1. "走产品流 (pdflow)" — 调起产品流驾驶舱（Research → PRD），完成后回 devflow
  2. "只做 research" — 调起 `nocode:pd-research` 单独调研
  3. "跳过，直接继续" — 不做产品调研，按用户描述继续

用户选跳过 = 显式授权，按其意愿继续。不反复追问。

### Step 2: 按场景路由

```
┌─ Full:     [产品流前置检查] → Env → Design [→ Decompose if needed] → Plan → Build → Verify → Review → Land
├─ Standard: Env → Plan → Build → Verify → Review → Land
├─ Fix:      Env → [Debug] → Build → Verify → Review → Land
└─ Mini:     Build-lite → Verify-lite → Land-lite (不开 worktree)
```

> Design 产出架构后，如果模块多/复杂度高需要拆分子任务，由 Design 内部的 Decompose 子步骤处理（见 Design sub-flow 3e）。devflow 不做独立的规模评估——以完整需求为准，不考虑人天/人力。

### Step 3: 创建阶段计划

为当前场景的阶段各建一条 task。每条 task 的 description 含：

1. **三要素**：`调用` / `进入前 Read` / `Gate`（从「8 阶段总览」表抄）
2. **Sub-steps 序列**：从下方「Phase sub-flows」抄该阶段的子步骤编号链，**链首固定是 `⓪ 调用 <stage-skill>`**——把“加载该阶段 skill”写成显式第 0 步，进入阶段第一眼就看到
3. **完成条件**：最后一个阶段 item 也只记录其完整 Sub-steps 与 Gate；没有额外的 handoff 状态。

为当前场景一次创建全部稳定阶段项；description 保留完整子步骤和 Gate。后续每次状态变化都提交顺序稳定的完整计划状态，不得只表达单项 patch。

使用 `TaskCreate` 创建每个阶段并保存 task id；使用 `TaskUpdate` 更新状态。


Sub-steps 写进 description 是为了**进入阶段时一眼看到完整步骤序列**——防止跳步遗漏。链首的 `⓪ 调用 <stage-skill>` 是为了把“加载 skill”钉成每个阶段的第一个动作——**sub-steps 是地图，skill 才是详图**，照地图裸跑会丢掉 skill 内的模板 / Iron Law / 格式约束。

### Step 4: 推进阶段

每个阶段严格按以下 6 步执行，不跳不并行，缺任一步 = 跳步 bug：

1. **进入前** Read 该阶段的 rule（如有）
2. **加载 skill（硬 Gate）**：先用平台原生计划工具把当前阶段标为 `in_progress`；成功后的第一个动作必须是按平台原生 Skill 语法调用当前阶段 Skill，传入 confirmed restate、stage、artifacts、constraints 和用户 decision。未实际加载 Skill，不许执行任何 sub-step。
3. **顺序执行 sub-steps**：按 task description 中的子步骤链**逐个**执行，每个子步骤完成后确认其产出/条件满足，再进下一个子步骤。不跳步、不合并、不并行。
4. **Gate 证据点名**：所有子步骤完成后，逐条核对 Gate 条件 + 满足它的具体证据。任一条不满足 = 不标 completed。
5. **更新计划为 completed + 停下报告**：通过平台原生计划工具提交完整 items 快照后停下，向用户报告本阶段完成情况 + 下一步建议（格式见 Step 5）。**不自动进入下一阶段。**
6. **等用户拍板**：用户明确说 OK / 继续 / 下一步，才标下一阶段 in_progress 并进入。

**两条强制工序**：

- **加载 skill 是硬 Gate**——plan item description 抄了 sub-steps，不等于可以照着裸跑。sub-steps 只列“做什么”，skill 内才有“怎么做”（模板 / Iron Law / 格式约束 / Gate 细节）。跳过原生 Skill 调用 = 丢掉一半指令，这正是本流程要防的 bug。
- **Gate 证据是强制工序**——"大概过了 / 应该没问题"不算证据。拿不出证据 = 不标 completed = 不进下一阶段。

**反例**（触发本次强化的 bug）：
```
❌ 进入 Build 阶段，看到 task description 里已有 "5a.Scope Lock → 5b.Test First → ..."，
   直接照着写代码——没按平台原生 Skill 语法调用 dev-build，丢了 TDD Iron Law 和 slice 循环约束。
```
正确做法：用原生计划标 in_progress → 调用 dev-build 并传入完整上下文 → 再按 sub-steps 推进。

### Step 5: 输出建议 + 等用户拍板

进入阶段时，**展开该阶段的所有 sub-steps 及每步的关键决策**：

```
当前在: <阶段名> 已完成（依据: Gate 证据 X、Y）

建议下一步: 阶段 N+1 <阶段名>
  Sub-steps:
    Na. <子步骤名> — 决策: <需要用户拍板什么 / 有什么分支>
    Nb. <子步骤名> — 决策: <...>
    Nc. <子步骤名> — 决策: <...>
  Gate: <需满足什么>
  为什么是这一步: <一句话理由>
备选: 跳过 / 回退（需用户显式授权）
```

**建议要具体**——列出子步骤让用户看到完整路径，不是一句话糊弄。理由越具体，用户拍板越快。

**反例**（触发本次优化的真实 bug）：
```
❌ 建议下一步: Land — push 到远端 + 写任务日志
```
Land 有 5 个子步骤（8a Create PR → 8b ... → 8e Cleanup），只说"push"跳过了 Create PR，导致遗漏 PR 流程。正确做法是列出 8a-8e 全部子步骤。

**不自动执行**。等用户说 "OK" 或调整方向。

---

## 8 阶段总览

| # | 阶段 | 调用 | 进入前 Read | Gate |
|---|---|---|---|---|
| 1 | **Define** | `nocode:dev-define` | — | 问题边界收敛 + 场景分类 + 用户确认 |
| 2 | **Env** | Gate Base → `nocode:using-git-worktrees` → 平台原生进入隔离工作区 | `rule-git-worktree` | worktree 已建并进入（注：Env 不需要独立 nocode skill，逻辑完全由 superpowers skill + rule-git-worktree 覆盖） |
| 3 | **Design** | `nocode:dev-design` | — | 方案确认 + approved 单文档 + Implementation Item Registry 双向无 orphan |
| 4 | **Plan** | `nocode:dev-plan` | — | 计划已产出 + Design → Task 反向矩阵零 required orphan + 用户确认 |
| 5 | **Build** | `nocode:dev-build` | — | 所有 task 完成 + required Design ID 全部回报 + 测试/build 通过 |
| 6 | **Verify** | `nocode:dev-verify` | — | Define 验收逐条通过 + Design → Evidence Matrix 逐 ID 有新鲜证据 |
| 7 | **Review** | `nocode:dev-review` | — | Critical 全 fix + 用户 approve（默认主会话五轴自查；独立交叉仅用户显式要求） |
| 8 | **Land** | `nocode:dev-land` | — | 意图推定 → 全景计划 → 全自动执行(PR/merge/keep/discard + post-merge) |

### 共享词汇（跨 skill leading words）

| Leading Word | 中文 | 所属 skill | 含义 |
|---|---|---|---|
| **restate** | 重述 | Define | 把模糊需求收敛为结构化问题定义（目标 + Quality Bar + Out of Scope）——没有 restate 就没有 Define 的产出；Full 场景确认后落盘为设计文档首章「罗盘」，Design 全程在同一文档上迭代 |
| **approach** | 方案 | Design | 差异化方案对比——没有对比过的 approach 就没有设计 |
| **tracer bullet** | 穿透切片 | Plan | 穿透所有层的端到端垂直切片——窄但完整的交付单元 |
| **red-green** | 红绿循环 | Build | 失败测试(red)→最小实现(green)的 TDD 循环 |
| **evidence** | 证据 | Verify | 可贴出的命令+输出——没有 evidence 的断言不成立 |
| **findings** | 发现 | Code-Review | 带 id/axis/evidence/fix/action 的结构化评审发现 |
| **disposition** | 处置 | Land | merge/PR/keep/discard 四选一——选了就走完该路径全部 Gate |

这些词在各 skill 内已定义。跨 skill 沟通时用这些词锚定——说"restate 还没确认"比"Define 的产出还没让用户点头"更精确。

### Context Hygiene（建议，不强制）

Define → Design → Plan 尽量保持在同一个上下文窗口——设计讨论的推理链会在 compact 中丢失。每个 Build task 开始新 subagent 时才切上下文。

上下文过长时可以建议用户 `/compact` 或开新会话，但**不因此中断、拒绝或简化正在进行的工作**。提醒一次即可，用户没响应就继续干活。

### 非协商行为（跨所有阶段生效）

1. 遇到不一致 → **STOP**，不带猜测推进
2. 不当 yes-machine——技术上站不住的建议要 push-back
3. 范围外的代码/注释不碰、不删不懂的东西
4. 任务未过验证不算完成——"seems right"永远不够
5. 发现自己在猜 → 停下问用户或查代码
6. 每个 slice 闭环后才进下一个——不积累未验证的产出
7. 上下文冲突（spec 说 X 但代码是 Y）→ 不静默选一个，显式列出冲突 + 选项让用户拍板
8. 需求缺失 → 查先例（代码里有没有类似实现），无先例则停下问，不发明需求
9. **禁止自行裁剪需求范围** — devflow 以完整需求（PRD 全部 Phase/模块）为准，不考虑人天、人力、工期。PRD 分了多个 Phase 不代表只做其中一个——实现范围由用户在 Define 阶段明确确认，agent 不得自行假设只做部分。"规模太大先做 Phase 1" = 自行裁剪，除非用户显式说

### 横切能力（任意阶段可调）

| 能力 | 调用 | 触发时机 | 优先级（冲突时） |
|---|---|---|---|
| **Debug** | `../../references/debug-protocol.md` | Build/Verify 遇阻（测试失败/卡住） | bug/失败 → 优先 Debug |
| **Red-Blue-Deep** | `nocode:red-blue-deep` | 仅用户显式要求（「红蓝军 / 深度评估 / 仔细想」） | 用户要求 → 优先 Red-Blue |
| **Doubt-Driven** | spawn 独立 reviewer（偏向证伪不是批准） | 仅用户显式要求；敏感面（跨模块/不可逆/安全）命中时 agent 一句话建议、不自动派 | 用户要求 → 优先 Doubt |
| **Context Engineering** | 主动建议 `/distill` + 新会话 | 长会话（多轮工具调用/跨子任务） | 上下文风险 → 建议收尾 |
| **Git Freshness** | `rule-git-freshness` | 设计/搜索/多文件 Read 前 | 自动触发 |
| **Git Inspection** | `rule-git-inspection` | ≥2 git 只读命令 | 自动合并 |

### 回流路径

| 从 | 到 | 条件 |
|---|---|---|
| Review | Build → Verify → Review | fix 改了代码 → 必须重新取证 |
| Verify | Build | 验收标准未满足 → 补实现 |
| Build | Build (Debug) | 测试失败 3 次 → Debug 横切 |
| Build | Design → Plan | 发现设计有问题 → 需要回溯 |

### Post-mortem 钩子

Fix 类任务的 Review 通过后，问一句：**"什么能预防这个 bug？"** 如果答案涉及架构（没有好的测试 seam / 调用方纠缠 / 隐藏耦合），建议后续开一个 Design 改进任务。把单次修复转成架构改进的回路。

### Phase sub-flows（全阶段子步骤 + 决策点）

每个阶段的子步骤序列。Step 3 创建 plan snapshot 时抄编号链，Step 5 进入时展开决策点。

> 下表只列阶段内子步骤。**每条链实际都隐含一个 `⓪ 调用 <阶段 skill>` 前置步**（见 Step 3 / Step 4）——进入阶段先加载 skill，再走表里的子步骤，表略去 ⓪ 不重复。

#### Define sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 1a. 场景分类 | 平台原生结构化决策四选 | Full/Standard/Fix/Mini（拿不准偏 Full） |
| 1b. 实现范围确认 | PRD 有多 Phase/模块时，明确问用户"这次做哪些" | 不问 = 默认全部；禁止自行假设只做部分 |
| 1c. 假设先行 | hypothesis + confidence | ≥95% 跳 1d 走快速路径 |
| 1d. 澄清循环 | 一次一问（代码能答的不问用户） | 95% 停止测试退出循环 |
| 1e. 产出 restate | 结构化输出（含实现范围） | Quality Bar + Out of Scope + 实现范围 不可省 |
| 1f. 用户确认 | 平台原生结构化决策三选 | 确认/修改/重来（“随你”不算确认） |

#### Env sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 2a. Base 推断 | 按优先级推断 base ref | upstream→@{u}→origin/HEAD→origin/main |
| 2b. Gate Base | 展示 base + behind/ahead 状态 | ahead>0 弹问三选；流程内必须用户确认 |
| 2c. worktree add | `git worktree add -b` + 写 nocode-base config | 分支名 / 路径自动推导 |
| 2d. 进入隔离工作区 | Claude 使用原生 worktree 入口；Codex 后续命令显式指定绝对 workdir | — |
| 2e. Setup | worktree-setup.mjs 补齐 env/config | envCandidates 哪些 cp（拿不准优先 cp） |
| 2f. Verify Baseline | 跑测试确认起点干净 | 失败则报告 + 请示 |

#### Design sub-flow

> Design 阶段是**薄协调器 dev-design** 编排三个阶段 skill（重构后架构）：选方案 → 详细设计+评审 → 渲染。协调器自己不做领域工作。

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 3a. 进 dev-design（薄协调器） | 持状态机，编排下面三阶段，自己不选方案不写文档 | 路由 decision→writing→(可选)render |
| 3b. 选方案（decision） | 探索 + 多方案差异化对比选定 + 领域覆盖(含可观测两层) + 测试目标 TO + eval | 产出 Decision Packet（含 alternatives 供 writing 反方配平） |
| 3c. 详细设计 + 唯一评审（writing） | 消费 Decision Packet → feat/bug/refactor 详细设计 + 架构审核前置 + 唯一评审（design-doc-review 8 维度） | 遇方案级决策 replan_required → 协调器回 decision 重选 |
| 3d.（可选）渲染（render） | 设计文档 → Artifact 页面 + 产物引用，不改输入文档 | 产物关系由协调器在 final gate 报告 |
| 3e. Decompose 判断 | 架构产出后评估是否需要拆分子任务（见下） | 不需要 → 正常进 Plan；需要 → 拆分后各子任务走独立 devflow |

**3e. Decompose 判断**（Design 产出架构后执行）：

Design 完成方案选定 + 设计文档后，基于架构产出评估项目是否需要拆分为子任务。判断依据是**架构复杂度**（模块数、依赖深度、技术栈跨度），不是人天/人力。

**触发条件**（任一命中）：
- 架构包含 ≥ 3 个独立模块，且模块间有明确接口边界
- 技术栈跨度大（如前端 + 后端 + AI + 基础设施，各自需要不同的设计决策）
- 设计文档中出现"分阶段实现"/"分批交付"的建议

**不触发**：单模块应用、修改已有系统的局部功能、技术栈统一的项目。

**触发后的 Decompose 流程**：

1. **拆分维度**：基于架构的模块边界拆（产品域 > 用户流 > 交付批次 > 技术层）
2. **定义子任务**（每个写清 5 要素）：
   ```
   子任务 N: <名称>
     1. Scope:     做什么（in）+ 不做什么（out）
     2. 依赖:      前置子任务（哪些完成后才能开始）
     3. 接口契约:  与其他子任务的接口/数据流
     4. 验收标准:  可验证的完成条件
     5. 交付物:    代码 / 文档 / 接口 / 配置
   ```
3. **覆盖验证**：主会话自查——子任务∪ = 全部需求？缺口 → 补任务，重叠 → 明确边界；用户显式要求才调 `red-blue-deep`（拆分属跨模块敏感面，向用户一句话建议升审，点头才派）
4. **依赖排序**：拓扑排序 + 风险优先（无依赖的高风险排前）
5. **用户确认**：确认拆分 + 排序 + 第一个启动

**拆分后的执行模型（PDCA + 依赖驱动并行）**：

每个子任务继承全局 Design，走独立 devflow（Plan → Build → Verify → Review → Land）。基于依赖图决定串行还是并行：

```
依赖图示例：

  子任务₁ (数据层)
      ↓ 依赖
  子任务₂ (API 层)  ←── 子任务₃ (AI 模块)  ← 无依赖，与₂并行
      ↓ 依赖
  子任务₄ (前端)

执行：
  ₁ 串行先做（底层）
  → ₂ 和 ₃ 并行（workflow/subagent，各自独立 worktree）
  → ₄ 串行最后（依赖 ₂₃）
  → 全局集成验证
```

**并行执行**（无依赖关系的子任务）：
- 用 Workflow `pipeline`/`parallel` 或多个 Agent（subagent_type 按需选）同时推进
- 每个子任务在独立 worktree 中工作（isolation: 'worktree'），互不干扰
- 每个子任务独立 Land（独立 PR + merge）

**串行执行**（有依赖关系的子任务）：
- 前置子任务 Land 后才启动后续子任务
- PDCA 检查点：每个子任务 Land 后回检 master todo + 后续子任务是否受影响

```
PDCA 循环：

  Plan   依赖图 + 并行/串行分组
           │
           ▼
  Do     并行组内 workflow/subagent 同时推进
         串行组按依赖顺序逐个推进
           │
           ▼
  Check  每个子任务 Land 后：回检 master todo + 接口契约 + 后续影响
           │
           ▼
  Act    调整后续子任务（scope/顺序/新增/取消）→ 用户确认
           │
           ▼
  全局集成验证（所有子任务 Land 后：跨子任务集成测试 + E2E 走查）
```

子任务不再经过 Define/Design（全局已做），各自建独立 worktree + 独立 PR。

#### Plan sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 4a. 只读加载 | 读 restate→设计文档→代码→pattern | 开始改文件即停（在跳过 Plan） |
| 4b. 画依赖图 | 列块 + 标依赖方向 | 底层先建 |
| 4c. 垂直切片 | Slicing + Risk-first 排序 | 形态选择：Vertical / Contract-First |
| 4d. 写 task | 贴真实代码零占位符，标 `covers` + `designCovers` | ≤M（≤5 文件），标 HITL/AFK |
| 4e. 插 checkpoint | 每 2-3 task 一个 | rollback 边界 |
| 4f. Plan Validation | 需求/路径覆盖 + Design Registry 反向 orphan 检查 + 任务可验证 + 依赖无环 | 不过回 4d 或 Design 补 |
| 4g. 用户确认 | 平台原生结构化决策 | 确认计划 |

#### Build sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 5a. 加载计划 | 读 Plan 任务序列 + 测试目标 | — |
| 5b. 逐 task slice 循环 | 每 task: Scope Lock（含 `designCovers`）→ Test First → Implement → Verify → 回报 `completedDesignCovers` | ≤5 文件否则回 Plan；HITL 停等用户 |
| 5c. Gate 检查 | 全 task 完成 + required Design ID 无漏报 + 测试/build 通过 | 同测试修 3 次失败 → Debug 横切 |
| 5d. 统一 Commit | Gate 通过后一次性 commit 覆盖全部 task 改动，不按 task 拆分 | — |

#### Verify sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 6a. 证据收集 | 跑测试套件 + build，三元组（命令+输出+通过/失败） | 证据须新鲜（本轮跑的） |
| 6b. 集成测试 | 跨模块契约 + 数据流端到端 | requirements 逐行核对 |
| 6c. E2E/Browser | golden path + 边界 case + 截图 | 无 UI 变更标注跳过 |
| 6d. 性能检查 | Core Web Vitals / benchmark | 无性能需求标注跳过 |
| 6e. 验收逐条核对 | SC/路径/约束 + required/verify-only Design ID 逐条 ✅/❌，输出 Design → Evidence Matrix | 任一 ❌ 或缺证据回 Build |

#### Review sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 7a. Five-Axis Self-Review | 先读测试再读实现，五轴逐轴过 | 每轴至少一条 finding |
| 7b. Simplification Pass | Chesterton's Fence（删前 git blame） | Dead code 问用户确认后删 |
| 7c. Cross-Review（仅用户显式要求） | 用户显式要求才派独立路（经 rule-codex-review）；敏感面命中仅一句话建议 | 默认记录「未派（默认自审）」后跳过；调用报错降级自评 + 明说 |
| 7d. Findings Triage | 统一 schema，分类优先级 | Contract misread 最高优先 |
| 7e. 用户 approve | Critical 全 fix，Warning 逐条拍板 | fix 改了代码须回 Build→Verify→再 Review |

#### Land sub-flow

| Sub-step | 做什么 | 决策 |
|---|---|---|
| 8a. Pre-flight | 确认 Review Gate + 统一 commit 尾款改动 + 分支新鲜度 | 任一不满足 → 报告 + 建议动作，不自行修复 |
| 8b. Disposition | 呈现 4 选项（merge/PR/keep/discard），用户选路径 | 有 reviewer/CI → 建议 PR；个人快修 → 建议 Merge |
| 8c. Plan + Execute | 按路径呈现计划（PR: title/body + target + reviewer；Merge: merge 计划），Gate 确认后执行（push + create PR + add reviewer） | Gate Title-Body → Gate PR → 执行 |
| 8d. Poll & Merge | PR 路径：pr-watch(run_in_background)后台盯直到合并、退出 re-invoke；Merge 路径：本地合并后直接过 | merge 成功（PR 路径由 pr-watch 自动盯，无超时上限） |
| 8e. Cleanup + 流转 | 合并后一起做：worktree 清理（PR 决策线①的 pr-watch 合并后自动清）+ 飞书任务流转（`post-merge.md` → `lark-project`） | PR 路径 pr-watch 自动清；任务号缺失则跳过流转 |

---

## 场景差异速查

| | Full | Standard | Fix | Mini |
|---|---|---|---|---|
| Define | 完整循环 | 完整循环 | 侧重复现 | mini-goal |
| Env | ✅ | ✅ | ✅ | ❌ |
| Design | ✅ (含 Decompose 判断) | ❌ | ❌ | ❌ |
| Plan | ✅ | ✅ | ❌ (直接 Build fix) | ❌ |
| Build | 完整 slice 循环 | 完整 slice 循环 | 修复 slice | Build-lite (单 TDD slice) |
| Verify | 完整 6a-6e | 完整 6a-6e | 完整 6a-6e | Verify-lite (test+build) |
| Review | 完整 7a-7e | 完整 7a-7e | 完整 7a-7e | ❌ |
| Land | 完整 8a-8e | 完整 8a-8e | 完整 8a-8e | Land-lite (commit only) |

---

## 阶段跳转规则

- **顺序前进（唯一路径）**：严格按场景路径线性推进，每个阶段必须完整走完（加载 skill → 顺序跑 sub-steps → Gate 验证 → 报告 → 用户拍板）才进下一个。不存在"快进"模式
- **跳过**：用户显式说"跳过阶段 N"才跳，agent 绝不自行判断跳过。回复点名"按你要求跳过阶段 N"。agent 认为某阶段不需要时，可建议跳过并说明理由，但不自行跳
- **回退**：用户说"回到阶段 N"可回退重做
- **中途进入**：用户说"从阶段 N 开始"可从中间进入。agent 检查前置 Gate 状态并报告
- **task 排序**：用户问"先做哪个" → 按 Plan 的 risk-first 原则：最不确定的 task 排前，先撞墙
- **场景分类争议**（Mini vs Standard vs Full）：拿不准偏 Full。但如果任务只涉及安全/认证策略变更（如"记住我"延长 token），即使看似小改也可能是 Full（触及安全模型）。判断依据是"是否涉及架构/安全决策"而非"代码量大不大"

---

## 不要

- **简单任务别用 devflow** — Define 的 Mini 场景直接处理，不进 devflow
- **不替用户执行** — 给建议后停下，等用户拍板
- **不自行跳过阶段** — 跳过需用户显式授权
- **不自动进入下一阶段** — 标 completed 后停下报告，等用户说"继续"才进下一阶段。"已经做完了直接走下一步" = 自动跳步
- **用户授权自主推进（"我会离开 / 执行到 land / 全部跑完"）≠ 跳步许可** — 授权免除的是"等用户拍板"的等待，不是阶段本身。每个阶段的 sub-steps、Gate 检查、skill 加载一个不少，只是不停下来问用户"继续吗"。快速推进 = 每步简洁但完整执行；跳步 = 省掉步骤。前者合法，后者违规
- **不跳过 plan.create** — 进入 devflow 必须创建完整阶段计划并保存 `planRef`
- **不无证据标 completed** — Gate 证据点名是前置工序
- **不把 skill 实现细节抄进 devflow** — devflow 列子步骤序列和决策点（防跳步），不抄 skill 内部的具体做法/模板/格式要求（那些进入 skill 后自然加载）
