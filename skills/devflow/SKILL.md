---
name: devflow
description: 工程任务流程领航（8 阶段 · 4 场景路由）。可被 model 主动调起，也可用户 /调 进入。给"当前阶段判断 + 下一步建议 + 备选"，用户拍板，不替用户执行。agent 视角：复杂/多步/跨阶段任务（跨文件 + 状态未知 / 需要 commit / PR / 设计文档 / 评审 / 用户说"整个/整体/全流程"）时，主动调起本 skill。不用于简单单步任务（由 define skill 的 Mini 场景处理）。
---

# nocode-evolve:devflow — 工程任务流程领航

> 驾驶舱。**model 命中复杂多步任务时主动调起**，用户也可 `/调` 进入。给建议不替执行。
>
> 依赖：SessionStart 已注入 `model/agent-catalog-*.md` 完整路由。每阶段 rule 已常驻，需要完整指令时按需 Read。
>
> 各阶段集成了哪些 agent-skills / superpowers skill 的完整映射见 `references/skill-integration-map.md`。

## 协议

### Step 1: 调 Define 判断场景

任何任务进入 devflow 的第一步都是调 `nocode-evolve:define`。Define 内部完成：
- 需求澄清 + 目标定义
- 场景分类（Full / Standard / Fix / Mini）

Define 返回后，拿到确认的 restate + 场景分类，进 Step 2。

### Step 2: 按场景路由

```
┌─ Full:     Env → Design → Plan → Build → Verify → Review → Land
├─ Standard: Env → Plan → Build → Verify → Review → Land
├─ Fix:      Env → [Debug] → Build → Verify → Review → Land
└─ Mini:     Build-lite → Verify-lite → Land-lite (不开 worktree)
```

### Step 3: TaskCreate

为当前场景的阶段各建一条 task。每条 task 的 description 包含三要素：
- `调用: <skill/rule>`
- `进入前 Read: <rule 文件>`
- `Gate: <过关条件>`

```
示例 (Standard 场景):
TaskCreate(subject: "阶段 1: Define", description: "调用: nocode-evolve:define / Gate: 目标+方案收敛，用户确认")
TaskCreate(subject: "阶段 2: Env", description: "调用: superpowers:using-git-worktrees / Read: rule-git-worktree / Gate: worktree 已建")
TaskCreate(subject: "阶段 3: Plan", description: "调用: nocode-evolve:plan / Gate: 计划已产出 + 所有 task ≤ M + 用户确认")
TaskCreate(subject: "阶段 4: Build", description: "调用: nocode-evolve:build / Gate: 所有 task 完成 + 测试通过 + build 通过")
TaskCreate(subject: "阶段 5: Verify", description: "调用: nocode-evolve:verify / Gate: 验收标准逐条通过 + 证据收集")
TaskCreate(subject: "阶段 6: Review", description: "调用: nocode-evolve:code-review / Read: rule-codex-review / Gate: Critical 全 fix + 用户 approve")
TaskCreate(subject: "阶段 7: Land", description: "调用: rule-finishing-branch / Read: rule-finishing-branch / Gate: PR merged + worktree 清理")
```

### Step 4: 推进阶段

每个阶段：

1. **进入前** Read 该阶段的 rule（如有）
2. **调用** 该阶段的 skill
3. **Gate 证据点名**：在回复里引用 Gate 条件 + 满足它的具体事实
4. **TaskUpdate** completed → 下一阶段 in_progress

**Gate 证据是强制工序**——"大概过了 / 应该没问题"不算证据。拿不出证据 = 不标 completed = 不进下一阶段。

### Step 5: 输出建议 + 等用户拍板

```
当前在阶段 N: <阶段名>（依据: 已过 Gate X、Y）
建议下一步: 阶段 N+1 <阶段名>
  → 调用: <skill/rule>
  → Gate 条件: <需满足什么>
备选: 跳过 / 回退（需用户显式授权）
```

**不自动执行**。等用户说 "OK" 或调整方向。

---

## 8 阶段总览

| # | 阶段 | 调用 | 进入前 Read | Gate |
|---|---|---|---|---|
| 1 | **Define** | `nocode-evolve:define` | — | 目标+方案收敛 + 场景分类 + 用户确认 |
| 2 | **Env** | Gate Base → `superpowers:using-git-worktrees` → EnterWorktree | `rule-git-worktree` | worktree 已建并进入 |
| 3 | **Design** | `nocode-evolve:design-doc-writing` | `rule-design` | 评审通过 + 用户 approve |
| 4 | **Plan** | `nocode-evolve:plan` | — | 计划已产出 + 所有 task ≤ M + 用户确认 |
| 5 | **Build** | `nocode-evolve:build` | — | 所有 task 完成 + 测试通过 + build 通过 |
| 6 | **Verify** | `nocode-evolve:verify` | — | 验收标准逐条通过 + 证据收集 |
| 7 | **Review** | `nocode-evolve:code-review` | `rule-codex-review` | Critical 全 fix + 用户 approve |
| 8 | **Land** | `rule-finishing-branch` composite | `rule-finishing-branch` | PR merged + 任务流转 + worktree 清理 |

### 横切能力（任意阶段可调）

| 能力 | 调用 | 触发时机 | 优先级（冲突时） |
|---|---|---|---|
| **Debug** | `superpowers:systematic-debugging` + `references/debug-protocol.md` | Build/Verify 遇阻（测试失败/卡住） | bug/失败 → 优先 Debug |
| **Red-Blue-Deep** | `nocode-evolve:red-blue-deep` | 决策分歧（选 A 还是 B？） | 决策前 → 优先 Red-Blue |
| **Doubt-Driven** | spawn 独立 reviewer | 非平凡实现完成后验证 | 决策后验证 → 优先 Doubt |
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

### Land composite sub-flow

| Sub-step | 调用 | Sub-gate |
|---|---|---|
| 8a. Create PR | `rule-finishing-branch` option 2 | Gate Title-Body + push + PR 已创建 |
| 8b. Add Reviewers | `rule-finishing-branch` pr-flow | reviewer 已添加（或跳过） |
| 8c. Poll & Merge | ScheduleWakeup → merge | canMerge + merge 成功 |
| 8d. Task Transition | `rule-feishu-transition` | 飞书 issue 流转（或跳过） |
| 8e. Cleanup | `rule-finishing-branch` Gate Worktree-Cleanup | worktree 清理完成 |

---

## 场景差异速查

| | Full | Standard | Fix | Mini |
|---|---|---|---|---|
| Define | 完整循环 | 完整循环 | 侧重复现 | mini-goal |
| Env | ✅ | ✅ | ✅ | ❌ |
| Design | ✅ | ❌ | ❌ | ❌ |
| Plan | ✅ | ✅ | ❌ (直接 Build fix) | ❌ |
| Build | 完整 slice 循环 | 完整 slice 循环 | 修复 slice | Build-lite (单 TDD slice) |
| Verify | 完整 6a-6e | 完整 6a-6e | 完整 6a-6e | Verify-lite (test+build) |
| Review | 完整 7a-7e | 完整 7a-7e | 完整 7a-7e | ❌ |
| Land | 完整 8a-8e | 完整 8a-8e | 完整 8a-8e | Land-lite (commit only) |

---

## 阶段跳转规则

- **顺序前进**：默认按场景路径线性推进
- **跳过**：用户显式说"跳过阶段 N"才跳，agent 不自行判断。回复点名"按你要求跳过阶段 N"
- **回退**：用户说"回到阶段 N"可回退重做
- **中途进入**：用户说"从阶段 N 开始"可从中间进入。agent 检查前置 Gate 状态并报告

---

## 不要

- **简单任务别用 devflow** — Define 的 Mini 场景直接处理，不进 devflow
- **不替用户执行** — 给建议后停下，等用户拍板
- **不自行跳过阶段** — 跳过需用户显式授权
- **不跳过 TaskCreate** — 进入 devflow 必须建 todo
- **不无证据标 completed** — Gate 证据点名是前置工序
- **不把 skill 细节抄进 devflow** — devflow 是路由器，调对应 skill 获取详细流程
