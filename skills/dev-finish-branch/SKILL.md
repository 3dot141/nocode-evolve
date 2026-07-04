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
- 用户说「PR 合了 / 流转任务 / 合并后流转 / 任务状态改一下」（合并后流转，原 dev-post-merge 已并入本 skill，见 `references/post-merge.md`）

**不触发**:
- 纯查询（"我在哪个 branch / worktree 状态 / 当前 PR 列表"）
- 已在 PR review 中

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

**决策线（进入时一次确认）**：选定 disposition 后，reference 开头先展该路径的**完整决策线**，用户一次确认整条（含合并后清 worktree + 流转的目标状态）；确认后中途只保留安全 Gate（Title-Body / PR / force）。**PR 流程 Step 骨架单源在 `prflow.md`**（Step 0-8），gh/bkt 命令实现见 `pr-flow-gh.md` / `pr-flow-bkt.md`。

| Option | 额外 Read | 涉及 Gate |
|---|---|---|
| **1. Merge** | `references/remote-branch-cleanup.md`；合并后有任务号则 `references/post-merge.md` | Gate Merge + Gate Remote-Delete |
| **2. PR** | `references/prflow.md`（Step 骨架）+ `pr-flow-gh.md` / `pr-flow-bkt.md`（gh/bkt 实现）；合并后 `references/post-merge.md` | PR 决策线(Step 0) + Gate Title-Body + Gate PR + pr-watch |
| **3. Keep** | (无，一行报告) | (无) |
| **4. Discard** | `references/remote-branch-cleanup.md` | Gate Discard + Gate Remote-Delete |

### Worktree provenance（跨路径适用）

cleanup 时识别 4 种 worktree 路径模式：
- `.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/`
- 插件 `<project>-<branch_flat>/` 平级路径（per `rule-git-worktree`）

### PR title/body 格式（Option 2）

契约单源见 `rule-push-summary`（标题 + 背景/方案两段描述），不在此重复字段细节。

## Gate 速查

**Gate 展示总则（覆盖下表全部 Gate）**：要用户确认的内容必须内嵌进 AskUserQuestion 的 payload 自足——短字段（target / title / 一行值）写进 `question` 文本（写**实际值**，不是字段名），长内容（body / Affected 路径列表 / 计划）放 `options[].preview`（每个选项带同一份，等宽多行 markdown 渲染，Gate 均单选可用）。**禁止**「以上 / 上述…确认?」这类指代前文的问法——Gate 前刚跑完 Bash 时，工具调用之间的自由文本 harness 不保证渲染，经常被吞，用户面对确认框看不到要确认的内容（生产实证）。自由文本可照发作冗余，但 payload 缺内容即违规。超长内容（数百行级，塞不进 preview）降级为纯文本 Gate：内容作为**回合末尾**文本发出后结束回合等用户打字回复，绝不「文本展示 + 同回合 ask」。（插件级总则同见 `model/agent-about.md`「常驻交互习惯」）

| Gate | 位置 | 要点 |
|---|---|---|
| **Gate Merge** | option 1, commit 整理后 | 呈现 merge 计划（branch → base + 删 worktree + 删 branch），OK 执行 |
| **Gate Title-Body** | option 2, target 解析后 | target (`<remote>/<branch>` + 来源) + title + body + **Affected**（变更文件路径列表）。target/title/body 均可改 |
| **Gate PR** | option 2, Gate Title-Body 后 | push + source + target + reviewer。可改任一字段，不重生成 title/body |
| **Gate Discard** | option 4 | 列将删内容。typed `discard` **字面**才执行，yes/OK 算否定 |
| **PR 决策线** | option 2, 进入 PR 流程(Step 0) | 一次确认整条（提PR/后台盯/合并后清+流转）。确认①→ worktree 由 pr-watch 合并后自动清，不再单问；选③手动保留 |
| **Gate Remote-Delete** | option 1/4, 删本地 branch 后 | 远程有分支时询问删/保留。默认保留 |

## pr-watch 后台盯合并（Option 2 决策线①）

PR 决策线选①后，PR 创建完用 `Bash(run_in_background=true)` 起 `references/pr-watch.mjs` 后台盯合并（gh/bkt 双栈）：合并 → 确定性清 worktree + 输出 `PR_WATCH_RESULT` → 脚本退出 re-invoke agent → agent 读信号接续流转。**决策线 + 状态机 + Step 骨架见 `references/prflow.md`**（Step 8）。

> 机制是 `run_in_background`（会话级，退出 re-invoke agent 做流转），不是 ScheduleWakeup。会话关了后台进程随之结束——由下方 Fallback 兜底。

## Fallback：进入时检测已合并未清 worktree

`run_in_background` 是会话级——用户中途关了 Claude Code，pr-watch 进程随之死，worktree 不会自动清。兜底：**进入 dev-finish-branch（Step 1 后）时，若当前在 worktree 且查到其对应 PR 已 MERGED**，提示补清：

- 查一次 PR 状态（gh `gh pr view --json state` / bkt `bkt api .../pull-requests/<id> --json` 看 `.state`）
- state == MERGED 且 worktree 还在 → 提示"上次 PR 已合并，worktree 未清，现在清理吗？"，用户确认后清 + 有任务号则 Read `post-merge.md` 流转
- state 非 MERGED → 正常进 disposition 菜单，不打扰

## Worktree 清理安全规则

- Option 1 (Merge) / 4 (Discard) → 必清理 worktree
- Option 2 (PR) → 决策线选①：pr-watch 合并后自动清；选③：手动保留（默认）
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
- 不要用 ScheduleWakeup / cron 替代 pr-watch 的 run_in_background — 后者退出能 re-invoke agent 接流转，前两者回不到 agent
- 不要在非 macOS 硬依赖 osascript 通知 — pr-watch 已对非 darwin 降级到 stdout，别再加平台假设
