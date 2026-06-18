---
name: dev-workflow
description: "⚠️ DEPRECATED — 请使用 nocode-evolve:devflow 代替。本 skill 是旧版，不再维护。"
---

# ⚠️ DEPRECATED — 使用 nocode-evolve:devflow

本 skill 已被 `nocode-evolve:devflow` 替代（8 阶段 · 4 场景路由 · 含 Entry/Exit Gate + 共享词汇表 + 横切能力）。

调用 `Skill(nocode-evolve:devflow)` 进入新版。
> 
> 规则依赖: SessionStart 已注入 `model/agent-catalog-*.md` 完整路由到 context。每个阶段对应的 rule 触发条件 / 摘要 / guard 已常驻, 需要完整指令时按需 Read `rules/rule-*.md`。

## 协议 (被调起时严格按此走)

### Step 1: 先判「这任务要不要流程建议」

如果用户的任务是 **简单 / 明确单步**(改个变量名 / 修个小 bug / 查个事实 / 改一行文案),**直接回**:

> "这是单步任务, 直接做即可, 无需流程编排。"

然后**退出**, 不强吐方案、不画流程图。

只有 **复杂 / 多步 / 不确定下一步 / 要规划整体** 时才走 Step 2-5。

### Step 2: 判当前阶段

扫下方阶段地图, 看会话情境 (已经做了什么、哪些 Gate 已过), 判 agent 当前处于哪个阶段。

### Step 3: 用 TaskCreate 创建 todo 列表 (task 自带三要素)

**首次进入 workflow 时**, 用 `TaskCreate` 为**当前阶段及后续所有阶段**各创建一条 task。已完成的阶段不建。每条 task:

- **subject**: `阶段 N: <阶段名>`
- **description**: 从阶段总览表逐行抄该阶段三要素——`调用: <skill/rule>` / `进入前 Read: <rule 文件>` / `Gate: <过关条件>`。目的: 标 in_progress 那刻看到的就是操作指令, 不依赖回本 SKILL.md 翻表——信息附着在 task 流转这个必经动作上, 防长会话遗忘。

示例 (从阶段 1 开始, 其余阶段同构, 三要素逐行抄阶段总览表):
```
TaskCreate(subject: "阶段 1: Brainstorming",
           description: "调用: superpowers:brainstorming / 进入前 Read: rule-superpowers-brainstorming / Gate: 需求与设计意图明确, 用户确认")
TaskCreate(subject: "阶段 2: Goal",
           description: "调用: 与用户对齐成果定义 / 进入前 Read: (无专属 rule) / Gate: 成果定义 + 验收标准明确, 用户确认")
TaskCreate(subject: "阶段 3: Create Worktree",
           description: "调用: Gate Base (base 确认) → superpowers:using-git-worktrees → EnterWorktree / 进入前 Read: rule-git-worktree / Gate: Gate Base 用户确认 base + worktree 已建并进入")
... (阶段 4-13 同构)
```

**中途进入** (如用户说「从阶段 6 开始」): 只建阶段 6 及之后的 task, 之前的视为已完成。

**阶段推进时 (gate 证据强制)**:

1. 标 `TaskUpdate(status: completed)` **前**, 必须在回复里点名该阶段的 **Gate 证据**——引用 Gate 条件 + 满足它的具体事实 (如「Gate Base 已过: 用户回复 OK, base=upstream/main」「阶段 5 Gate 已过: 用户 approve 于上一轮」)。拿不出证据 = 不标 completed = 不进下一阶段。这是工序, 不是自觉——「大概过了 / 应该没问题」不算证据。
2. 证据点名后 → `TaskUpdate(status: completed)` → 下一阶段 `TaskUpdate(status: in_progress)`, 并按其 description 的「进入前 Read」先 Read 再动手。用户能随时看到整体进度。

### Step 4: 输出建议 (含 rule/gate 检查)

进入每个阶段前, **先 Read 该阶段对应的 rule 文件** (阶段总览表的「进入前 Read」列), 检查 Gate 条件是否满足, 然后输出建议:

```
当前在阶段 N: <阶段名> (依据: 已过 Gate X、Y)
建议下一步: 阶段 N+1 <阶段名>
  → 调用: <skill / rule>
  → Gate 条件: <需满足什么才能进下一阶段>
  → 进入前 Read: <rule 文件> (已读 / 待读)
备选: 跳过 / 回退 (需用户显式授权)
```

### Step 5: 停下来让用户拍板

**不自动执行**下一步。等用户说 "OK" 或调整方向后再动手。

---

## 13 阶段生命周期地图

每阶段必须过 Gate 才进入下一阶段。Gate 是软卡——agent 检查并报告状态, 用户显式说「跳过」可放行, agent 不自行判断跳过。

### 阶段总览

| # | 阶段 | 调用 | 进入前 Read | Gate (过了才进下一阶段) |
|---|---|---|---|---|
| 1 | **Brainstorming** | `superpowers:brainstorming` | `rule-superpowers-brainstorming` | 需求 / 设计意图明确, 用户确认 |
| 2 | **Goal** | 与用户对齐成果定义 (见下方) | (无专属 rule) | 成果定义 + 验收标准明确, 用户确认 |
| 3 | **Create Worktree** | Gate Base (base 确认, 见下方) → `superpowers:using-git-worktrees` → EnterWorktree | `rule-git-worktree` | Gate Base 用户确认 base + worktree 已建并进入 (pwd 在 worktree 内) |
| 4 | **Writing Design** | `nocode-evolve:design-doc-writing` | (skill 内含流程) | 设计文档已产出 |
| 5 | **Review Design** | 双路交叉评审 loop (见下方) | `rule-codex-review` | 用户 approve |
| 6 | **Writing Plan** | `superpowers:writing-plans` | (无专属 rule) | 实现计划已产出 |
| 7 | **Executing** | `superpowers:executing-plans` / `superpowers:test-driven-development` / `superpowers:subagent-driven-development` | (无专属 rule) | 代码完成 + 测试通过 |
| 8 | **Code Review** | 双路交叉评审 loop (同阶段 5 机制) | `rule-codex-review` | 用户 approve |
| 9 | **Create PR** | `rule-finishing-branch` option 2 | `rule-finishing-branch` | Gate Title-Body (title/body) + push 成功 + PR 已创建 (不含 reviewer) |
| 10 | **Add Reviewers** | `rule-finishing-branch` pr-flow-bkt-appendix Step 7 | (同 rule-finishing-branch) | reviewer 已添加 (或用户说跳过) |
| 11 | **Poll & Merge PR** | ScheduleWakeup 轮询 PR 审批状态 → `bkt pr merge` | (无专属 rule) | canMerge=true + merge 成功 |
| 12 | **Task Transition** | `rule-feishu-transition` | `rule-feishu-transition` | 飞书 issue 流转到「研发已改待BUILD」(或用户说跳过) |
| 13 | **Finish Worktree** | `rule-finishing-branch` Gate Worktree-Cleanup → ExitWorktree | (同 rule-finishing-branch) | worktree 清理完成 |

### 横切 (任意阶段可调)

| 能力 | 调用 | 说明 |
|---|---|---|
| 评估 / 拍板 | `nocode-evolve:red-blue-deep` | 需要判断 / 权衡时随时调 |
| Git freshness | `rule-git-freshness` | 设计 / 搜索 / 多文件 Read 前自动触发 (常驻 behavior) |
| Git 只读合并 | `rule-git-inspection` | ≥2 git 只读命令 && 串 (常驻 behavior) |

---

## 阶段 2: Goal（Brainstorming 之后、设计文档之前）

Brainstorming 确认需求后，**在写设计文档之前**先与用户对齐最终成果的定义。目的：明确"做成什么样算完"，让成果标准驱动后续设计和实现，而非写完代码再补验收。

### 沟通内容（agent 输出 → 用户确认）

agent 输出一份结构化的成果定义提案，包含三部分：

**1. 成果物定义**：最终交付什么，每项成果物的形态
```
交付物:
- wiki/search.py: IndexSearch 支持关键词匹配 + grep fallback + 空结果处理
- wiki/ingest.py: 新建页 / 已有页更新 / 层级路由 / 拒绝规则
- clip/intent.py: QUERY 意图识别（与 CLIP/TASK 不冲突）
- 配置: settings.yaml 新增 search provider 配置项

不交付 (理由):
- GBrainSearch/GraphRAGDiscovery 集成: 外部服务, 留后续迭代
- Docker 构建优化: 与本次目标无关
```

**2. 验收标准**：什么算做完——功能维度 + 质量维度 + 边界条件
```
功能验收:
- wiki/search: 零配置下 _index.md 匹配返回正确结果; 有 LLM key 时综合回答含引用来源
- wiki/lint: 扫真实 vault 结构能检出已知的 5 类问题, 且不误报 README.md/_index.md

边界条件 (重点):
- 状态交叉: 有 key 无 url / 有 url 无 key / 全有 / 全无
- 降级路径: 每个 Provider 故障时正确 fallback (不只"降级了", 要验降级后结果质量)
- 数据边界: 空文件 / 超大文件 / 特殊字符文件名 / 中文路径 / 嵌套路径
- 并发/时序: 写队列竞争 / 索引间隔判断的时间边界
- 反馈环: auto_ingest + radar 简报 = 噪声放大 (要验 type:radar-report 排除生效)
```

**3. 不做什么**：明确排除范围，防止 scope creep
```
排除:
- 不改现有 API 接口签名 (向后兼容)
- 不做性能优化 (功能先行, 性能留后续 profiling 后再定)
- 不迁移已有数据 (只影响新写入)
```

### Gate

用户确认成果定义后才进阶段 3。确认方式：用户说"OK / 成果定义没问题 / 同意"。

### 产出流向

Goal 阶段的产出会被后续阶段消费：
- **阶段 4 Writing Design**：设计文档的「测试与验收」节直接引用本阶段确认的验收标准和边界条件
- **阶段 6 Writing Plan**：实现计划的步骤拆分和 TDD 节奏基于本阶段确认的成果物和验收标准
- **阶段 7 Executing**：TDD 作为执行手段之一，测试用例从本阶段的验收标准推导

### 不要

- **不写代码** — 这是沟通阶段，只对齐成果定义，不写实现
- **不只列 happy path** — happy path 谁都会想到，价值在边界条件和排除范围
- **不把成果定义当 checklist 念** — 要讲清楚"为什么交付这个、不交付那个"的判断依据

---

## 阶段 3: Gate Base — Base 确认（worktree add 之前）

`git worktree add` 之前, agent 把 base 推断结果一次性呈现给用户确认——「base 选哪个」和「是否基于最新基准」合成一个 gate, 不连环弹问:

1. **base 选哪个 ref**: 按 `rule-git-worktree` 推断优先级 (存在 `upstream` remote → `upstream/HEAD`; 否则 `@{u}` → `origin/HEAD` → `origin/main`) 给出推断值 + 推断依据 + 候选 (fork 的 origin/main、release/develop 等长期分支)
2. **是否基于最新基准**: fetch base 所在 remote 后展示 behind/ahead 状态; 本地有独有 commit (ahead > 0) 时列出 commits, 三选同 `rule-git-worktree` (基于远程最新 / 基于本地 HEAD / 指定其他 start-point)

```
[Gate Base] 即将创建 worktree:
  branch: feature/foo
  base:   upstream/main   (推断: upstream remote 存在; 候选: origin/main / release-1.2)
  基准状态: 已 fetch, upstream/main 领先本地 3 commits → 将基于最新 upstream/main 建

(回 OK / 或改 base, 如 "base 用 release-1.2")
```

- **用户 OK** → `git worktree add` 基于确认的 base; 确认值写 `git config branch.<name>.nocode-evolve-base`——后续 freshness-check 与阶段 9 的 PR target 默认值都读它, 一次确认全程闭环
- **用户改 base** → 更新后再次展示, 循环到 OK
- **范围**: Gate Base 只在 dev-workflow 流程内强制; 非流程零散建 worktree 仍按 `rule-git-worktree` 静默默认 (ahead == 0 不弹问)

---

## 阶段 5 / 8: 双路交叉评审 Loop

阶段 5 (设计评审) 和阶段 8 (代码评审) 共用同一个**双路交叉评审** loop 机制, 区别仅在评审对象:

```
┌─→ Claude Code 评审 + Codex 交叉评审 (rule-codex-review)
│     ↓
│   汇总 findings → 呈现给用户
│     ↓
│   用户判断: fix 哪些 (逐条选)
│     ↓
│   执行 fix
│     ↓
│   用户判断: 需要再次评审?
│     ├─ 是 → loop ──┘
│     └─ 否 → approve → 进下一阶段
```

- **阶段 5**: 评审对象 = 设计文档
- **阶段 8**: 评审对象 = 代码改动 (diff)
- **交叉**: Claude Code 自己评 + Codex 独立评 (`rule-codex-review`), 两份结果合并呈现, 避免单一视角盲区
- **用户始终在 loop 中拍板**: fix 哪些 / 是否再评审, agent 不自行决定

---

## 阶段 9 + 10: Create PR → Add Reviewers (解耦)

PR 创建和添加 reviewer 拆成两个独立阶段, 原因:
- Bitbucket cross-fork 场景下 `bkt pr create --with-default-reviewers` 会失败 (`source repo id '0'`)
- reviewer 添加可能部分失败 (大小写 / 权限), 不应阻塞 PR 创建
- 解耦后每步可独立重试

### 阶段 9: Create PR

1. Read `rule-finishing-branch` + 工具栈检测 (gh / bkt)
2. Gate Title-Body: 生成 title + body, 用户确认
3. Push 分支到 remote
4. 创建 PR (**不带 reviewer**——避免单 user 错导致整个 create 失败)
5. Gate: PR 已创建, 拿到 PR URL + id
6. `TaskUpdate(阶段 9: completed)`

### 阶段 10: Add Reviewers

1. 若 toolchain == bkt:
   - Workflow A (单仓/personal): 跳整段 (团队无 read 权限)
   - Workflow B (cross-fork): 从 `/reviewers` endpoint 取默认 reviewer 名单 → 排除作者 → `bkt pr edit --reviewer` batch 加
   - 详见 `rule-references/rule-finishing-branch/pr-flow-bkt-appendix.md` Step 7
2. 若 toolchain == gh: `gh pr edit --add-reviewer`
3. 部分失败时: 大小写 fallback → 仍失败则跳过该 reviewer + 报告
4. Gate: reviewer 已添加 (或用户说跳过)
5. `TaskUpdate(阶段 10: completed)`

---

## 阶段 11: Poll & Merge PR

PR 创建 + reviewer 添加后, 等待审批通过再 merge。**用户可指定轮询间隔**(默认 3 分钟)或说「直接 merge」跳过等待。

### 流程

1. 检查 PR 是否可 merge: `bkt api GET .../pull-requests/<id>/merge` → `canMerge`
   - 若 toolchain == gh: `gh pr checks <id>` + `gh pr view <id> --json reviewDecision`
2. `canMerge == false` → 用 `ScheduleWakeup(delaySeconds=180)` 设 3 分钟后再查
3. `canMerge == true` → 执行 merge:
   - bkt: `bkt pr merge <id> --project <target> --repo <repo>`
   - gh: `gh pr merge <id> --merge`
4. merge 失败 (冲突 / 权限) → 报错等用户介入
5. Gate: merge 成功

### 用户可选行为

- 「直接 merge」→ 跳过轮询, 立即执行 step 3
- 「不 merge, 等人工」→ 跳过整个阶段 11
- 「每 5 分钟检查」→ 调整 ScheduleWakeup 间隔

---

## 阶段 12: Task Transition (飞书项目流转)

PR merge 后把飞书 issue 从「组员开发」流转到「研发已改待BUILD」。

### 流程

1. 进入前 Read `rule-feishu-transition`
2. 从 push range commit messages 提取任务号 (`#f-xxx` / `#g-xxx` / `#m-xxx`)
3. 逐个任务走 rule 流程:
   - `get_workitem_brief` → 确认当前状态 = 组员开发
   - `update_field(field_ecff7b)` → 填「缺陷来源于缺陷」(默认自关联, 用户可指定)
   - `get_transition_required(mode=unfinished)` → 确认必填项已完成
   - `transition_state(transition_id=20862226)` → 执行流转
4. 一个失败不阻塞其他; 必填项无法自动填充时报告用户手动补
5. Gate: 全部任务流转成功 (或用户说跳过)

### 用户可选行为

- 「跳过流转」→ 整段跳过
- 「只流转 #f-xxx」→ 部分流转
- 指定源缺陷 id → 覆盖默认自关联

---

## 阶段跳转规则

- **顺序前进**: 默认按 1→2→…→13 线性推进
- **跳过**: 用户显式说「跳过阶段 N」才跳, agent 不自行判断; 跳过时回复点名「按你要求跳过阶段 N」
- **回退**: 用户说「回到阶段 N」可回退重做
- **中途进入**: 用户说「从阶段 N 开始」可从中间进入 (已有 worktree / 设计文档等); agent 检查前置 Gate 状态并报告

---

## 例子

### 例 1: 简单任务 (Step 1 放行)

用户: "把 utils.ts 里的 formatDate 改成 snake_case"
→ "这是单步任务, 直接做即可, 无需流程编排。" → 退出

### 例 2: 复杂任务 (从头走)

用户: "给插件加个新 skill"
→ 判断: 跨文件 + 多步 → 进流程

> **当前在阶段 1: Brainstorming** (依据: 新任务, 未开始)
> **建议下一步**: 调用 `superpowers:brainstorming` 探索需求
>   → 进入前 Read: `rule-superpowers-brainstorming`
>   → Gate: 需求 / 设计意图明确后进阶段 2
> **备选**: 如果需求已清晰, 说「跳过」直接到阶段 2

→ 等用户拍板

### 例 3: 中途进入

用户: "我已经有设计文档了, 帮我写实现计划"
→ 判断: 阶段 4 已完成 (有文档)

> **当前在阶段 4 之后** (依据: 设计文档已有)
> **建议下一步**: 先走阶段 5 设计评审 (交叉评审 loop), 确认设计无问题再进阶段 6
> **备选**: 说「跳过评审」直接到阶段 6 写计划

→ 等用户拍板

---

## 不要

- **简单任务别强加流程** — Step 1 必判, 简单就放行
- **不替用户执行** — 给建议后停下, 等用户拍板
- **不自行跳过阶段** — 跳过需用户显式授权 (「跳过 / 不要 X」), 模糊信号不算
- **不重复规则细节** — 路由表在常驻 catalog 分片, 这里只给阶段 / 建议, 不抄 rule 内容
- **不在 dev-workflow 内跑评审 / 写文档** — 调对应 skill / rule, 它们有各自的流程
- **不把 Create PR 和 Add Reviewers 合并** — 解耦是刻意设计, 避免 reviewer 失败拖垮 PR 创建
- **不跳过 TaskCreate** — 进入 workflow 必须建 todo 列表, 让用户看到整体进度
- **不无证据标 completed** — gate 证据点名是 task 流转的前置工序, 不是事后补写; 没证据就停在当前阶段
