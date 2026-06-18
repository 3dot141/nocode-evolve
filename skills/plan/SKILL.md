---
name: plan
description: Use when you have defined goals and need to break work into tasks. Use when devflow routes to Plan stage, or when the user says "写计划/拆任务/怎么实现/plan it out". Use when a task feels too large to start or when parallel work is possible.
---

# plan — 把目标拆成任务序列

**Iron Law: 计划里贴的是真实代码和命令，不是占位符。写不出真实代码 = 还没想清楚。**

计划的价值不在"列出步骤"，在让执行变成机械动作。每个任务是一根 **tracer bullet**——穿透所有层的端到端垂直切片。好计划拿到就能照做，不需要边做边想"这里该怎么写"。

> Leading word: **tracer bullet**。每个 task 切一条窄但完整的端到端路径，不按层横切。

输入：Define 的 restate + Design 的设计文档和测试目标（Full 场景）。
输出：用户确认的任务序列 + 执行模式选择。

## Entry Gate

- [ ] Define restate 存在且已确认
- [ ] Full 场景：Design 设计文档 + 测试目标已产出
- [ ] Standard 场景：restate 足够指导任务拆分

## Checklist (TaskCreate)

1. **只读模式** — 读 restate + 设计文档 + 测试目标 + 相关代码，不碰代码
2. **画依赖图** — 列块 + 标依赖方向
3. **垂直切片** — 端到端可交付，risk-first 排序
4. **写 task** — 每个 ≤ M，贴真实代码，标 HITL/AFK，零占位符
5. **插 checkpoint** — 每 2-3 task 一个
6. **用户确认 + 选执行模式** — AskUserQuestion Gate

## 协议

### Step 1: 只读模式

读，不写。读 restate（成果物/验收标准/约束/Out of Scope）→ 读设计文档（含测试目标）→ 读相关代码（现在长什么样，依赖谁，谁依赖它）。

发现自己开始改文件 → 停——你在跳过 Plan 直接 Build。

### Step 2: 依赖图

列出所有块，标谁依赖谁。底层先建——下游任务依赖的东西必须先就位。

### Step 3: 垂直切片

优先**端到端可交付**，不按层横切。每个切片做完有能跑、能 demo、能回滚的东西。

**Risk-first**：最不确定的切片先做。可能不可行的路径早点撞墙。

测试目标分配到对应 slice——每个 slice 知道自己要验证什么。

### Step 4: 写 task

每个 task 用 `references/task-template.md` 格式。硬约束：

- **贴真实代码/命令/预期输出**——不是伪代码，不是"类似这样"
- **禁占位符**——`<your code here>`/`TODO`/`...` 不允许出现。写不出真实代码说明没想清楚，回 Step 1
- **task 描述 durable 化**——用行为意图描述（"用户创建记录时验证必填字段"），不用易腐的行号/文件路径/代码片段。行号会漂移、函数名会改，但行为意图扛重构。代码贴在 step 内部，不贴在 task 描述里
- **Sizing ≤ M**（≤ 5 文件）。L/XL 必须再拆——大任务藏着没想清楚的判断
- **标 HITL/AFK**：
  - `HITL`（Human-in-the-loop）：需人决策的 task（API 设计确认/数据迁移策略/安全敏感）→ Build 时停下等用户
  - `AFK`（Away-from-keyboard）：agent 可独立完成的 task → Build 时连续推进

### Step 5: 插 checkpoint

每 2-3 个 task 一个 checkpoint = 全测试通过 + build 通过 + 用户 review。checkpoint 是 rollback 边界。

### Step 6: 用户确认 + 执行模式

计划完整呈现后用 AskUserQuestion 确认，再选执行模式：

```
AskUserQuestion: "计划确认了，怎么执行？"
- Subagent 并行 (推荐) — 每 task 派独立 subagent，快速迭代
- 当前会话顺序执行 — 在本会话逐 task 执行
```

Subagent → `Skill(superpowers:subagent-driven-development)`。当前会话 → Build slice 循环。

### Plan Document Header

每份计划文档以标准 header 开头：

```markdown
# [Feature Name] Implementation Plan

**Goal**: [一句话]
**Architecture**: [2-3 句]
**Tech Stack**: [关键技术/库]
**Design Doc**: [路径（Full 场景）]
**Test Objectives**: [测试目标摘要]
```

## Exit Gate

- [ ] 计划已产出（依赖图 + 任务序列 + checkpoint）
- [ ] 所有 task ≤ M，零占位符
- [ ] 每个 task 标了 HITL/AFK
- [ ] 测试目标已分配到 slice
- [ ] 用户显式确认 + 选了执行模式

## 核心规则（when X → do Y）

- **When** 某步写不出真实代码只能写"类似这样" → **回 Step 1 继续读**，写不出 = 没想清楚。占位符藏的是设计决策
- **When** 你按层横切（"先建所有 model，再建所有 service"） → 改用 **tracer bullet**——每个 slice 端到端穿透所有层，做完可验证
- **When** 你想把简单的排前面、难的留后面 → **risk-first**：最不确定的先撞墙，不确定性留到投入最大时才暴露更贵
- **When** 某 task 涉及 > 5 文件 → **必须再拆**。L 任务把多个设计决策压成一句话
- **When** task 标题里出现 "and" → 大概率该拆成两个 task

## Red Flags

- 计划里出现 `<...>` / `TODO` / "调用相关方法"
- 某 task 写不出具体改哪几个文件
- 连续 4+ task 没有 checkpoint
- 最不确定的部分排到了最后
- 没读相关代码就开始写 task
