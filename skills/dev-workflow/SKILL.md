---
name: dev-workflow
description: 工程任务流程领航. 可被 model 主动调起, 也可用户 /调 进入, 给"当前阶段判断 + 下一步建议 + 备选", 用户拍板, 不替用户执行. agent 视角: 复杂 / 多步 / 跨阶段任务 (跨文件 + 状态未知 / 需要 commit / PR / 设计文档 / 评审 / 用户说"整个/整体/全流程") 时, 主动调起本 skill 给流程建议并停下等用户拍板. 不用于简单单步任务.
---

# nocode-evolve:dev-workflow — 工程任务流程领航

> 工程任务驾驶舱。**model 命中复杂多步任务时主动调起**, 用户也可 **`/调`** 进入。给建议不替执行。
> 
> 规则依赖: SessionStart 已注入 `model/agent-catalog-*.md` 完整路由到 context。每个阶段对应的 rule 触发条件 / 摘要 / guard 已常驻, 需要完整指令时按需 Read `rules/rule-*.md`。

## 协议 (被调起时严格按此走)

### Step 1: 先判「这任务要不要流程建议」

如果用户的任务是 **简单 / 明确单步**(改个变量名 / 修个小 bug / 查个事实 / 改一行文案),**直接回**:

> "这是单步任务, 直接做即可, 无需流程编排。"

然后**退出**, 不强吐方案、不画流程图。

只有 **复杂 / 多步 / 不确定下一步 / 要规划整体** 时才走 Step 2-4。

### Step 2: 判当前阶段

扫下方 9 阶段地图, 看会话情境 (已经做了什么、哪些 Gate 已过), 判 agent 当前处于哪个阶段。

### Step 3: 输出建议

格式:

```
当前在阶段 N: <阶段名> (依据: 已过 Gate X、Y)
建议下一步: 阶段 N+1 <阶段名>
  → 调用: <skill / rule>
  → Gate 条件: <需满足什么才能进下一阶段>
  → 进入前 Read: <rule 文件> (如有)
备选: 跳过 / 回退 (需用户显式授权)
```

### Step 4: 停下来让用户拍板

**不自动执行**下一步。等用户说 "OK" 或调整方向后再动手。

---

## 9 阶段生命周期地图

每阶段必须过 Gate 才进入下一阶段。Gate 是软卡——agent 检查并报告状态, 用户显式说「跳过」可放行, agent 不自行判断跳过。

### 阶段总览

| # | 阶段 | 调用 | 进入前 Read | Gate (过了才进下一阶段) |
|---|---|---|---|---|
| 1 | **Brainstorming** | `superpowers:brainstorming` | `rule-superpowers-brainstorming` | 需求 / 设计意图明确, 用户确认 |
| 2 | **Create Worktree** | `superpowers:using-git-worktrees` → EnterWorktree | `rule-git-worktree` | worktree 已建并进入 (pwd 在 worktree 内) |
| 3 | **Writing Design** | `nocode-evolve:design-doc-writing` | (skill 内含流程) | 设计文档已产出 |
| 4 | **Review Design** | 交叉评审 loop (见下方) | `rule-codex-review` | 用户 approve |
| 5 | **Writing Plan** | `superpowers:writing-plans` | (无专属 rule) | 实现计划已产出 |
| 6 | **Executing** | `superpowers:executing-plans` / `superpowers:test-driven-development` / `superpowers:subagent-driven-development` | (无专属 rule) | 代码完成 + 测试通过 |
| 7 | **Code Review** | 交叉评审 loop (同阶段 4 机制) | `rule-codex-review` | 用户 approve |
| 8 | **Create PR** | `rule-finishing-branch` option 2 | `rule-finishing-branch` | Gate TB (title/body) + Gate PR (push+reviewer) 均过 |
| 9 | **Finish Worktree** | `rule-finishing-branch` Gate WC → ExitWorktree | (同 rule-finishing-branch) | worktree 清理完成 |

### 横切 (任意阶段可调)

| 能力 | 调用 | 说明 |
|---|---|---|
| 评估 / 拍板 | `nocode-evolve:red-blue-deep` | 需要判断 / 权衡时随时调 |
| Git freshness | `rule-git-freshness` | 设计 / 搜索 / 多文件 Read 前自动触发 (常驻 behavior) |
| Git 只读合并 | `rule-git-inspection` | ≥2 git 只读命令 && 串 (常驻 behavior) |

---

## 阶段 4 / 7: 交叉评审 Loop

阶段 4 (设计评审) 和阶段 7 (代码评审) 共用同一个 loop 机制, 区别仅在评审对象:

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

- **阶段 4**: 评审对象 = 设计文档
- **阶段 7**: 评审对象 = 代码改动 (diff)
- **交叉**: Claude Code 自己评 + Codex 独立评 (`rule-codex-review`), 两份结果合并呈现, 避免单一视角盲区
- **用户始终在 loop 中拍板**: fix 哪些 / 是否再评审, agent 不自行决定

---

## 阶段跳转规则

- **顺序前进**: 默认按 1→2→…→9 线性推进
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
→ 判断: 阶段 3 已完成 (有文档)

> **当前在阶段 3 之后** (依据: 设计文档已有)
> **建议下一步**: 先走阶段 4 设计评审 (交叉评审 loop), 确认设计无问题再进阶段 5
> **备选**: 说「跳过评审」直接到阶段 5 写计划

→ 等用户拍板

---

## 不要

- **简单任务别强加流程** — Step 1 必判, 简单就放行
- **不替用户执行** — 给建议后停下, 等用户拍板
- **不自行跳过阶段** — 跳过需用户显式授权 (「跳过 / 不要 X」), 模糊信号不算
- **不重复规则细节** — 路由表在常驻 catalog 分片, 这里只给阶段 / 建议, 不抄 rule 内容
- **不在 dev-workflow 内跑评审 / 写文档** — 调对应 skill / rule, 它们有各自的流程
