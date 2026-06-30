---
name: dev-finish-branch
description: "Use when implementation is complete and you need to finish a branch — merge locally, create a PR, keep, or discard. Handles toolchain detection (gh/bkt), commit tidy, PR creation with Gate sequence, worktree cleanup, and remote branch cleanup. Use when devflow Land routes here (via dev-land), or standalone when user says \"提PR/收尾/合并/创建PR/完成worktree/discard worktree\". Not for: PR review (dev-review), work-in-progress pushes, or git queries."
---

# dev-finish-branch — commit, PR, 分支收场

4 条路（merge / PR / keep / discard），每条有 Gate 序列。选了走到底，不中途混搭。

> Leading word: **disposition**。4 选 1，选了走完该路径全部 Gate。

## 触发

- dev-land 调用（devflow Land 阶段）
- 用户直接说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 合并到 release / 删 branch / discard worktree」

**不触发**:
- 纯查询（"我在哪个 branch / worktree 状态 / 当前 PR 列表"）
- 已在 PR review / PR 已合并

## Step 1: 工具栈检测

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
remote_url=$(git -C "$MAIN_ROOT" remote get-url origin)
```

| remote_url 含 | toolchain |
|---|---|
| `"bitbucket."` | `bkt` |
| `"github.com"` | `gh` |
| 否则 | askUser "工具栈不确定 (remote=$remote_url), 选 [gh / bkt / 跳过 PR]" |

## Step 2: Verify Tests

项目有测试 → 跑一遍。fail → hard stop，不进 disposition 菜单。先修 tests 再重跑。

## Step 3: Disposition

检测环境（`GIT_DIR == GIT_COMMON` → 主仓，否则 worktree），确定 base branch（`git merge-base`），呈现菜单：

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work
```

Detached HEAD → 3 选项（无 merge）。

## Step 4: Execute — 按选项分发

先 Read `references/commit-tidy.md`（Option 1 & 2 需要 commit 整理）。然后按选项 Read 对应 reference，由 reference 接管全部细节。

| Option | 额外 Read | 涉及 Gate |
|---|---|---|
| **1. Merge** | `references/remote-branch-cleanup.md` | Gate Merge + Gate Remote-Delete |
| **2. PR** | `references/pr-flow-gh.md`; bkt 额外 `references/pr-flow-bkt-appendix.md` | Gate Title-Body + Gate PR + Gate Worktree-Cleanup |
| **3. Keep** | (无，一行报告) | (无) |
| **4. Discard** | `references/remote-branch-cleanup.md` | Gate Discard + Gate Remote-Delete |

### Worktree provenance（跨路径适用）

cleanup 时识别 4 种 worktree 路径模式：
- `.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/`
- 插件 `<project>-<branch_flat>/` 平级路径（per `rule-git-worktree`）

### PR title/body 格式（Option 2）

标题 ≤50 字（提炼最大变更轴）；描述 ≤200 字（基础内容逐 commit + 重点评测），契约见 `rule-push-summary`。

## Gate 速查

| Gate | 位置 | 要点 |
|---|---|---|
| **Gate Merge** | option 1, commit 整理后 | 呈现 merge 计划（branch → base + 删 worktree + 删 branch），OK 执行 |
| **Gate Title-Body** | option 2, target 解析后 | target (`<remote>/<branch>` + 来源) + title + body + 影响文件 tree。target/title/body 均可改 |
| **Gate PR** | option 2, Gate Title-Body 后 | push + source + target + reviewer。可改任一字段，不重生成 title/body |
| **Gate Discard** | option 4 | 列将删内容。typed `discard` **字面**才执行，yes/OK 算否定 |
| **Gate Worktree-Cleanup** | option 2, PR 创建 + reviewer 加完后 | 保留（默认）/ 清理。仅在 worktree 内时弹出 |
| **Gate Remote-Delete** | option 1/4, 删本地 branch 后 | 远程有分支时询问删/保留。默认保留 |

## Worktree 清理安全规则

- Option 1 (Merge) / 4 (Discard) → 必清理 worktree
- Option 2 (PR) → Gate Worktree-Cleanup 让用户选，默认保留
- Option 3 (Keep) → 不清理
- 清理顺序：先确认 merge/discard 成功 → `cd "$MAIN_ROOT"` → `git worktree remove <path>` → `git worktree prune`
- 先 remove worktree 再删 branch（反了 `branch -d` 会 fail，worktree 还在引用）
- `git worktree remove` 前必须 cd 到主仓根（在 worktree 内跑会静默失败）
- 未提交改动 → remove 报错，不加 `--force`，用户先 stash

## 不要

- 不要 `gh pr create` 时塞 `--reviewer` — 单 user 错会让整个 PR 建不出来。拆 create + edit
- 不要 `bkt api --method PUT` 改 PR 元数据 — PUT 全量替换会清 reviewer。用 `bkt pr edit`
- 不要自动 force push — non-ff 用户 typed `force` 字面才执行
- 不要 PR 创建后立刻 merge — 终态是 PR 提交 + reviewer，merge 走 review 流程
- 不要假设 toolchain — 私域 git host 必须 askUser，不擅自归类
- 不要 create 时塞 `reviewers` 数组 — 单 user 错（大小写/无权限）让整个 PR 建不出来
- 不要跳过 test 验证就进 disposition 菜单 — tests fail = hard stop
- 不要在 worktree 内跑 `git worktree remove` — 先 cd 到 `$MAIN_ROOT`
- 不要删 branch 前没 remove worktree — worktree 还引用着，branch -d 会拒绝
