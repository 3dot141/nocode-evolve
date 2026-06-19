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

为当前场景的阶段各建一条 task。每条 task 的 description 含三要素：`调用: <skill/rule>` / `进入前 Read: <rule 文件>` / `Gate: <过关条件>`。各阶段的 调用/Read/Gate 取值见下方「8 阶段总览」表，逐行抄进对应 TaskCreate。

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
| 1 | **Define** | `nocode-evolve:define` | — | 问题边界收敛 + 场景分类 + 用户确认 |
| 2 | **Env** | Gate Base → `superpowers:using-git-worktrees` → EnterWorktree | `rule-git-worktree` | worktree 已建并进入（注：Env 不需要独立 nocode-evolve skill，逻辑完全由 superpowers skill + rule-git-worktree 覆盖） |
| 3 | **Design** | `nocode-evolve:design` | `rule-design` | 方案确认 + 测试目标 + 设计文档评审通过 + 用户 approve |
| 4 | **Plan** | `nocode-evolve:plan` | — | 计划已产出 + 所有 task ≤ M + 用户确认 |
| 5 | **Build** | `nocode-evolve:build` | — | 所有 task 完成 + 测试通过 + build 通过 |
| 6 | **Verify** | `nocode-evolve:verify` | — | 验收标准逐条通过 + 证据收集 |
| 7 | **Review** | `nocode-evolve:code-review` | `rule-codex-review` | Critical 全 fix + 用户 approve |
| 8 | **Land** | `rule-finishing-branch` composite | `rule-finishing-branch` | PR merged + 任务流转 + worktree 清理 |

### 共享词汇（跨 skill leading words）

| Leading Word | 所属 skill | 含义 |
|---|---|---|
| **restate** | Define | 用户确认的结构化目标——没有 restate 就没有 Define 的产出 |
| **approach** | Design | 差异化方案对比——没有对比过的 approach 就没有设计 |
| **tracer bullet** | Plan | 穿透所有层的端到端垂直切片——窄但完整的交付单元 |
| **red-green** | Build | 失败测试(red)→最小实现(green)的 TDD 循环 |
| **evidence** | Verify | 可贴出的命令+输出——没有 evidence 的断言不成立 |
| **findings** | Code-Review | 带 id/axis/evidence/fix/action 的结构化评审发现 |

这些词在各 skill 内已定义。跨 skill 沟通时用这些词锚定——说"restate 还没确认"比"Define 的产出还没让用户点头"更精确。

### Context Hygiene

Define → Design → Plan 保持在**同一个不 compact 的上下文窗口**——设计讨论的推理链会在 compact 中丢失。每个 Build task 开始新 subagent 时才切上下文。

**上下文预算**：< 2000 行非任务上下文 = 聚焦；> 5000 行 = 失焦。逼近 smart zone 上限（~120k token）时用 `/handoff` 传递再开新会话，不要硬撑。

### 非协商行为（跨所有阶段生效）

1. 遇到不一致 → **STOP**，不带猜测推进
2. 不当 yes-machine——技术上站不住的建议要 push-back
3. 范围外的代码/注释不碰、不删不懂的东西
4. 任务未过验证不算完成——"seems right"永远不够
5. 发现自己在猜 → 停下问用户或查代码
6. 每个 slice 闭环后才进下一个——不积累未验证的产出
7. 上下文冲突（spec 说 X 但代码是 Y）→ 不静默选一个，显式列出冲突 + 选项让用户拍板
8. 需求缺失 → 查先例（代码里有没有类似实现），无先例则停下问，不发明需求

### 横切能力（任意阶段可调）

| 能力 | 调用 | 触发时机 | 优先级（冲突时） |
|---|---|---|---|
| **Debug** | `references/debug-protocol.md` | Build/Verify 遇阻（测试失败/卡住） | bug/失败 → 优先 Debug |
| **Red-Blue-Deep** | `nocode-evolve:red-blue-deep` | 决策分歧（选 A 还是 B？） | 决策前 → 优先 Red-Blue |
| **Doubt-Driven** | spawn 独立 reviewer（偏向证伪不是批准） | 非平凡决策（跨模块/不可逆/安全敏感） | 决策后验证 → 优先 Doubt |
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
