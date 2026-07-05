---
name: dev-land
description: "Use when Review is complete and you need to land the work (pre-flight checks + dev-finish-branch). Use when devflow routes to Land stage, or when user says \"land/着陆/准备着陆/走land阶段\". Note: standalone \"提PR/合并/merge\" without devflow context should use dev-finish-branch directly, not this skill."
---

# land — 选路着陆，干净收场

**Iron Law: 先确认 Review Gate 已过，再选着陆路径。没过 Review 的代码不着陆。**

编排层：pre-flight → dev-finish-branch（PR/merge 机制 + post-merge 流转）。post-merge 流转已并入 dev-finish-branch（`references/post-merge.md`），不再是独立 skill。

## 非本 skill 请求

"帮我看看代码" → Review，不是 Land。"写完了" → 先 Verify 再 Review 再 Land。
单独说"提 PR" / "删 worktree"且不在 devflow 上下文 → 直接 `dev-finish-branch`。

## Enter Gate

- [ ] Review Gate 已过（Critical 全 fix + 用户 approve）
- [ ] 无需额外处理的未提交改动（Verify/Review 阶段产生的改动会在 Step 1 统一 commit 一次）
- [ ] 分支与 base 无重大冲突（behind ≤ 阈值，或已 rebase）

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下 task：

```
Task 1: Pre-flight
  Gate: Review 状态 + 统一 commit 尾款改动 + 分支新鲜度

Task 2: Finish-branch
  Gate: dev-finish-branch 完成（PR 已创建 / 已合并 / keep / discard）

Task 3: Post-merge
  Gate: post-merge 流转完成（dev-finish-branch 的 post-merge.md，或标注跳过）

Task 4: 收口 — 报告完成并交回
  Sub-steps: 向用户 / devflow 导航报告 Land 完成（合并状态 + 任务流转结果）→ 交回控制
  Gate: 已报告完成（devflow 流程末端，无下游阶段 skill）
  metadata: {handoff: true}（供防跳步 Hook B 识别交接 task）
```

每完成一个标 done。

### Step 1: Pre-flight

Enter Gate 三项逐条检查：

- [ ] **Review 状态**：Review task 标完成 + 无未解决 Critical
- [ ] **工作目录**：`git status` 检查改动来源——若可归因于 Build 之后 Verify/Review 阶段产生的改动 → 在本步统一 commit 一次（message 概括本轮修复内容）；若改动来源不明或与本次任务无关 → 仍停手告知，不代理处理
- [ ] **分支新鲜度**：调 `rule-git-freshness` 检查 behind 差距。behind 大 → 建议先 rebase，但用户决定

三项全过 → 进 Step 2。任一不满足 → 报告具体状态 + 建议动作，不自行修复。

**Exit Gate:**
- [ ] Review 状态确认
- [ ] 工作目录干净
- [ ] 分支新鲜度确认

### Step 2: Finish-branch

调 `Skill(nocode:dev-finish-branch)`，它处理全部 commit/PR/merge/discard 机制（disposition 菜单、Gate 序列、worktree 清理）。

**Land 在 dev-finish-branch 之上的额外约束**：

**发布策略**（Option 1/2 选定后、执行前追问——仅对生产改动）：
> "这次改动的发布策略？全量 / 灰度（canary %）/ dark launch（flag 默认关）"
>
> AI 不执行部署，但把决策点暴露给用户——merge 和 release 是两个动作。用户选了灰度/dark launch → 提醒确认 flag 已就位。纯内部工具/无生产影响 → 跳过。

**PR body 回链**（Option 2，Gate Title-Body 时）：PR body 除了 dev-finish-branch 的标准格式，额外包含：
- **Requirements Addressed**：引用 Define 的 restate Success Criteria 编号，逐条说明满足
- **Verification Evidence**：引用 Verify 阶段的关键证据（测试命令+结果摘要）

这样 reviewer 看到 PR 就能追溯"为什么做"和"怎么证明做完了"。

**Exit Gate:**
- [ ] dev-finish-branch 完成（PR 已创建 + worktree 状态确认 / 已合并 / keep / discard）

### Step 3: Post-merge

合并后流转已并入 dev-finish-branch——Read `dev-finish-branch/references/post-merge.md` 执行（原独立 dev-post-merge skill 已降级为该 reference）。

- **Option 1 (Merge)**：Step 2 合并成功后即执行
- **Option 2 (PR)**：pr-watch 盯到合并、退出 re-invoke 后触发；或后续会话用户说"PR 合了"时
- **Option 3/4**：跳过

**Exit Gate:**
- [ ] post-merge 流转完成或已跳过

## Exit Gate（全局）

- [ ] dev-finish-branch 完成
- [ ] post-merge 流转完成或已跳过（合并后）

## 场景差异

| | Full / Standard / Fix | Mini |
|---|---|---|
| Pre-flight | 完整 Enter Gate | commit only |
| Finish-branch | dev-finish-branch 完整 | 跳过（Mini 不开 worktree） |
| Post-merge | 合并后按需 | 跳过 |

Mini 场景的 Land-lite：确认 commit 已完成即可，不进完整 Step 1-3。

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "Review 差不多了，先 push 再改" | Review Gate 没过就不着陆。"差不多"不是"过了" |
| "先合了再跑 CI" | CI 是 PR 流程的一部分，不是合后补丁 |
| "worktree 保着占空间，顺手删了" | Gate Worktree-Cleanup 让用户选。用户可能要 iterate on PR feedback |
| "任务号懒得填" | 流转闭环是 Land 的一部分，不是可选 |
| "force push 一下就好" | force push 是高风险操作，有专门的 Gate |
| "这个改动简单，跳过某 Step 或不建 TaskCreate" | 进了 skill 就走完所有 Step。"简单"是你的判断，不是跳 Gate 的授权（详见 agent-catalog-using.md「进了 skill 就走完」） |

## Red Flags

- 还没进 Review 就说"land 一下"——Review 和 Land 是两个阶段
- 跳过 Gate Title-Body 直接 `gh pr create`——Gate 存在就是为了拦这个
- PR 创建后立刻 merge 不等 review——option 2 终态是 PR 提交，不是合并
- 清理 worktree 但没 ExitWorktree——先退出再清理
- Option 2 选了 PR 路径又说"还是本地 merge 吧"——回 Step 2 重选，不混搭
- 因"任务简单 / 还在概览 / 用户说了'继续'"跳过某 Step、不建 Step 0 TaskCreate、或漏掉最后的交接 task
