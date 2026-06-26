---
name: dev-land
description: Use when Review is complete and you need to land the work (merge/PR/keep/discard). Use when devflow routes to Land stage, or when the user says "land/着陆/准备着陆/走 land 阶段/收尾/上线/ship it". Note: standalone "提PR/合并/merge" without devflow context should use finishing-branch rule, not this skill.
---

# land — 选路着陆，干净收场

**Iron Law: 先确认 Review Gate 已过，再选着陆路径。没过 Review 的代码不着陆——不是"先合再补"。**

Review 通过后的 **disposition** 门。4 条路（merge / PR / keep / discard），每条有自己的 Gate 序列。选哪条走到底，不要中途混搭。

> Leading word: **disposition**。merge / PR / keep / discard 四选一，选了就走完这条路的全部 Gate。没有"先 push 看看再说"。

## 非本 skill 请求

"帮我看看代码" → Review，不是 Land。"写完了" → 先 Verify 再 Review 再 Land。单独说"提个 PR" / "删掉这个 worktree"且不在 devflow 上下文 → 直接走 `rule-finishing-branch`，不需要完整 Land 流程。

## Enter Gate

- [ ] Review Gate 已过（Critical 全 fix + 用户 approve）
- [ ] 工作目录干净（无未 commit 的改动）
- [ ] 分支与 base 无重大冲突（behind ≤ 阈值，或已 rebase）

## 协议

### Step 0: TaskCreate

**进入后第一件事**，创建以下全部 task：

```
Task 1: Pre-flight
  Sub-steps: 确认 Enter Gate + 分支状态
  Gate: Review 状态 + 工作目录干净 + 分支新鲜度三项过

Task 2: Disposition
  Sub-steps: 呈现 4 选项，用户选路径
  Gate: 用户选定 merge/PR/keep/discard 之一

Task 3: Execute
  Sub-steps: 按选定路径执行（rule-finishing-branch）
  Gate: 选定路径的所有 Gate 通过

Task 4: Task Transition
  Sub-steps: 飞书 issue 状态流转（lark-project references/transition.md）
  Gate: 任务流转或标注跳过

Task 5: Cleanup
  Sub-steps: worktree 清理 + 确认终态
  Gate: worktree 状态与用户选择一致
```

每完成一个标 done。

### Step 1: Pre-flight

Enter Gate 三项逐条检查：

- [ ] **Review 状态**：Review task 标完成 + 无未解决 Critical
- [ ] **工作目录**：`git status` 干净。有未 commit 改动 → 停手告知，不替用户 commit
- [ ] **分支新鲜度**：调 `rule-git-freshness` 检查 behind 差距。behind 大 → 建议先 rebase，但用户决定

三项全过 → 进 Step 2。任一不满足 → 报告具体状态 + 建议动作，不自行修复。

**Exit Gate:**
- [ ] Review 状态确认
- [ ] 工作目录干净
- [ ] 分支新鲜度确认

### Step 2: Disposition

调 `nocode-evolve:finishing-a-development-branch`，由 `rule-finishing-branch` overlay 覆盖行为。

skill 呈现 4 选项菜单（文案顺序由 sp skill 定义，不改）：
1. **Merge 回 base** — 本地合并 + 清理
2. **Push + 建 PR** — 远端协作（最常见路径）
3. **Keep as-is** — 不动，用户后续处理
4. **Discard** — 放弃这次工作

**选路径建议**（不替用户选，仅在用户犹豫时给参考）：
- 有 reviewer / 需要 CI → option 2 (PR)
- 个人分支、快速修复、已自评 → option 1 (Merge)
- 未完成但要保留 → option 3 (Keep)
- 验证失败、方向错误 → option 4 (Discard)

**发布策略**（Option 1/2 选定后、执行前追问——仅对生产改动）：
> "这次改动的发布策略？全量 / 灰度（canary %）/ dark launch（flag 默认关）"
>
> AI 不执行部署，但把这个决策点暴露给用户——merge 和 release 是两个动作，不要混为一谈。用户选了灰度/dark launch → 提醒确认 flag 已就位。纯内部工具/无生产影响 → 跳过。

用户选定后，`rule-finishing-branch` 接管该路径的 Gate 序列。

**Exit Gate:**
- [ ] 用户已选定 Disposition（Merge / PR / Keep / Discard）
- [ ] 发布策略已确认（生产改动时）或已跳过

### Step 3: Execute

按 `rule-finishing-branch` 的选项分发执行。关键 Gate 序列：

**Option 2 (PR) 路径**：
commit 整理 → Gate Title-Body → Gate PR → push → 建 PR → 加 reviewer → Gate Worktree-Cleanup

**PR body 回链**（Gate Title-Body 时）：PR body 除了描述改了什么，还要包含：
- **Requirements Addressed**：引用 Define 的 restate Success Criteria 编号，逐条说明满足
- **Verification Evidence**：引用 Verify 阶段的关键证据（测试命令+结果摘要）
这样 reviewer 看到 PR 就能追溯"为什么做"和"怎么证明做完了"，不用翻会话记录。

**Option 1 (Merge) 路径**：
commit 整理 → Gate Merge → 本地 merge → tests → cleanup → Gate Remote-Delete

**Option 3 (Keep)**：报告路径，结束。

**Option 4 (Discard)**：Gate Discard (typed `discard`) → cleanup → Gate Remote-Delete。

每个 Gate 停手等用户确认，不跳过。

**完整示例**：走完 Option 2 (PR) 全流程（含 PR body 双回链）见 `references/examples/example-land-pr.md`。

**Exit Gate:**
- [ ] 选定路径执行完毕（PR 已创建 / 已合并 / 已 discard / 保留）
- [ ] 所有路径内 Gate 已通过

### Step 4: Task Transition

PR 合并后（option 2 等合并；option 1 合并后立即）：

- 从 commit messages 提取飞书任务号（`#f-xxx` / `#g-xxx` / `#m-xxx`）
- 按 `lark-project` (references/transition.md) 流转状态（组员开发 → 研发已改待BUILD）
- 没有任务号 / 非飞书项目 → 跳过，不报错

**Option 3/4 不走 Task Transition**。

**Exit Gate:**
- [ ] 飞书任务已流转（有任务号时）或已标注跳过

### Step 5: Cleanup

- **Option 1/4**：worktree 已在该路径中清理
- **Option 2**：按 Gate Worktree-Cleanup 用户选择（保留 / 清理）
- **Option 3**：不清理

清理后 `ExitWorktree` 回主仓。确认 `git worktree list` 不再包含已清理路径。

**Exit Gate:**
- [ ] worktree 状态与用户选择一致（清理 / 保留）
- [ ] 已 ExitWorktree 回主仓（清理时）

## Exit Gate（全局）

- [ ] 选定路径的所有 Gate 已通过
- [ ] PR 已创建（option 2）或已合并（option 1）或已 discard（option 4）
- [ ] 飞书任务已流转（有任务号时）或已标注跳过
- [ ] worktree 状态与用户选择一致（清理 / 保留）

## 场景差异

| | Full / Standard / Fix | Mini |
|---|---|---|
| Pre-flight | 完整 Enter Gate | commit only |
| Disposition | 4 选项完整 | 跳过（Mini 不开 worktree） |
| Task Transition | 按需 | 跳过 |
| Cleanup | 按路径 | 无 worktree 可清理 |

Mini 场景的 Land-lite：确认 commit 已完成即可，不进完整 Step 1-5。

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "Review 差不多了，先 push 再改" | Review Gate 没过就不着陆。"差不多"不是"过了" |
| "先合了再跑 CI" | CI 是 PR 流程的一部分，不是合后补丁 |
| "worktree 保着占空间，顺手删了" | Gate Worktree-Cleanup 让用户选。用户可能要 iterate on PR feedback |
| "任务号懒得填" | Task Transition 闭环是 Land 的一部分，不是可选 |
| "force push 一下就好" | force push 是高风险操作，有专门的 Gate |

## Red Flags

- 还没进 Review 就说"land 一下"——Review 和 Land 是两个阶段
- 跳过 Gate Title-Body 直接 `gh pr create`——Gate 存在就是为了拦这个
- PR 创建后立刻 merge 不等 review——option 2 终态是 PR 提交，不是合并
- 清理 worktree 但没 ExitWorktree——先退出再清理
- Option 2 选了 PR 路径又说"还是本地 merge 吧"——回 Step 2 重选，不混搭
