---
name: dev-finish-branch
description: "Use when implementation is complete and you need to finish a branch — merge locally, create a PR, keep, or discard. Use when devflow Land routes here (via dev-land), or standalone when user says \"提PR/收尾/合并/创建PR/完成worktree/discard worktree\". Not for: PR review (dev-review), work-in-progress pushes, or git queries."
---

# dev-finish-branch — commit, PR, 分支收场

**一次确认，全程自动**：4 条路（merge / PR / keep / discard）。所有可预见决策在动手前收集齐，一份**全景计划**确认后自动走到底；执行中只有「不可预见 + 不可逆」的安全例外才再拦（见「安全例外」表）。

> Leading word: **panorama**。全景计划确认 = 用户对整条线的唯一授权点。

## 触发

- dev-land 调用（devflow Land 阶段）
- 用户直接说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 合并到 release / 删 branch / discard worktree」
- 用户说「PR 合了 / 流转任务 / 合并后流转 / 任务状态改一下」（合并后流转，见 `references/post-merge.md`）

**不触发**:
- 纯查询（"我在哪个 branch / worktree 状态 / 当前 PR 列表"）
- 已在 PR review 中

## Step 1: 工具栈检测 + 补清检测

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
remote_url=$(git -C "$MAIN_ROOT" remote get-url origin)
```

| remote_url 含 | toolchain |
|---|---|
| `"bitbucket."` | `bkt` |
| `"github.com"` | `gh` |
| 否则 | askUser "工具栈不确定 (remote=$remote_url), 选 [gh / bkt / 跳过 PR]" |

**补清检测**（上次会话 cron 监控中断的兜底）：PR 路径的 cron 监控是**会话级**（CronCreate 的 job 只活在会话内存）——用户中途关了 Claude Code，job 随之消失，worktree 不会自动清、任务不会流转。本检测是唯一的跨会话兜底，不可删。当前在 worktree（`git rev-parse --git-dir` ≠ `--git-common-dir`）时查一次当前分支对应 PR：

- gh：`gh pr view --json state`（自动按当前分支解析；报 "no pull requests found" → 无 PR，静默继续）
- bkt：按分支搜（命令见 `pr-flow-bkt.md`「按分支搜 PR」；查不到 → 静默继续）
- state == MERGED 且 worktree 还在 → 询问补做收尾（一次问清，列出实际值）：「上次 PR 已合并未收尾。补做：清 worktree <path> + 删本地 branch <branch>；远程 <remote>/<branch> 删除还是保留（上个会话的选择已丢失）？」确认后按 cron MERGED 轮同款三件套执行（顺序与护栏见 `prflow.md` Step 6 收尾 a-c）；commit 有任务号 → Read `references/post-merge.md` 流转
- 其它状态 / 主仓内 → 静默进 Step 2

## Step 2: 意图推定

disposition 直接从入口语读，读得出就**不出菜单**：

| 入口语 | disposition |
|---|---|
| 提 PR / 创建 PR / push 提 PR | **PR** |
| 合并 / merge 到 main/release | **Merge** |
| discard / 丢弃 / 不要了 | **Discard** |
| keep / 先放着 / 留着分支 | **Keep** |
| 收尾 / 完成 worktree / dev-land 路由未带意图 | 推不定 → AskUserQuestion 四选一菜单 |

- 菜单是本 skill 唯一使用 AskUserQuestion 的点（纯单选，选项 label 写实际分支名与 base）
- detached HEAD → 菜单去掉 Merge
- tests fail（Step 3 先跑的菜单场景）→ Merge / PR 两项标「锁定: tests fail」

## Step 3: Verify Tests（仅 Merge / PR / 菜单场景）

- 意图 Keep / Discard → **跳过**（要保留或丢弃的分支，不需要测试通过）
- 项目有测试 → 跑一遍。fail：
  - 意图已是 Merge / PR → hard stop，先修 tests 再重进
  - 菜单场景 → 照出菜单，Merge / PR 标锁定，Keep / Discard 可选

## Step 4: 材料收集（无交互）

**base 解析（单源，本节是唯一定义处）**，按优先级取第一个命中：

1. `git config branch.<current>.nocode-base`（worktree 创建时写入）
2. `@{upstream}`
3. `origin/HEAD` → fallback `origin/main`

按 disposition 读 reference 收材料，全程不问用户：

| disposition | Read | 收集项 |
|---|---|---|
| **PR** | `prflow.md` + `pr-flow-<gh\|bkt>.md` + `pr-body-contract.md` + `commit-tidy.md` | push range、整理建议、target/title/body/Affected、default reviewer |
| **Merge** | `commit-tidy.md` + `remote-branch-cleanup.md` | push range、整理建议、merge 计划、远程坐标 + 独有 commit |
| **Discard** | `remote-branch-cleanup.md` | 将删清单、远程坐标 + 独有 commit |
| **Keep** | （无） | 直接一行报告现状，结束 |

- **任务号 + 目标状态**（PR / Merge 共用）：`git log <base>..HEAD --format=%B | grep -oE '#[fgm]-[a-z0-9]+' | sort -u`；有任务号 → **此刻 Read `references/post-merge.md`** 拿典型流转映射 + 查当前状态 → 推定目标状态（写进全景计划，合并后不再问）
- **远程坐标必须此刻捕获**——删 branch 后 `branch.<name>.remote/merge` 配置即消失（见 `remote-branch-cleanup.md`）

## Step 5: 全景计划（唯一主 Gate）

把整条线一屏展给用户，**回合末尾文本展示**，等用户自由回应。不用 AskUserQuestion——多字段可改场景下自由文本一句话能改多处，且回合末尾文本 harness 保证渲染。红线：**禁止「工具调用间文本展示 + 同回合 ask」**——工具调用间的自由文本常被吞，用户面对确认框看不到内容（生产实证）。

PR 版模板见 `prflow.md`「全景计划」。Merge / Discard 版：

```
[全景计划] <branch> → 本地 merge 回 <base>，确认后全自动:
  1. commit 整理   <建议内容>（默认: 跳过）
  2. merge         <branch> → <base>（<N> 个 commit）
  3. 清理          worktree <path> + 本地 branch <branch>
  4. 远程分支      <remote>/<remote_branch>: 保留（默认）；改「删」则删（<独有 commit 三态文案>）
  5. 合并后流转    #<task>: <当前状态> → <目标状态>    ← 无任务号则省略本行
回「OK」全自动到底；或直接说改哪项。
```

```
[全景计划·Discard] 将删除以下内容，不可恢复:
  - worktree: <path>
  - 本地 branch: <branch>（<N> 个未合并 commit: <sha 最多列 5 个>）
  - 远程分支 <remote>/<remote_branch>: 保留（默认）；改「删」则删（<独有 commit 文案>）
确认删除请回复字面 `discard`；yes / OK / 好 均视为取消。
```

回应处理：

- 「OK / 确认」→ Step 6 全自动到底
- 「改 X 为 Y」→ 局部更新（title/body 语义变更才重生成），两行复述变更，执行
- 「我先整理 commit」→ 贴出整理命令（`commit-tidy.md`）等「好了」，重收 push range 相关材料，重展全景
- 「分步确认」→ 降级为逐项单独确认的旧行为
- **Discard 特例**：只认字面 `discard`，其它一律取消

## Step 6: 全自动执行

| disposition | 自动段 | 中途可拦点（仅安全例外） |
|---|---|---|
| **PR** | push → 建 PR → 加 reviewer → 注册 cron 监控（每 5min 一轮：approve 后自动合并 → 清 worktree + 删本地 branch + (默认)删远程分支 → 流转 → cron 自删）→ 报告（全流程见 `prflow.md`） | non-ff → typed `force` |
| **Merge** | merge → 清 worktree → 删本地 branch → (全景选删) 删远程 → 流转 → 报告 | 无 |
| **Discard** | 清 worktree → `branch -D` → (全景选删) 删远程 → 报告 | 无（字面确认已在 Step 5） |
| **Keep** | 一行报告现状 | 无 |

执行失败 → 停在失败步报告（push 无权限 / PR 建失败 → worktree 保留），不静默跳过、不回滚已成功步。

## 安全例外表

全自动的边界——**只有**这些情形允许在全景确认后再拦：

| 例外 | 触发 | 防什么 |
|---|---|---|
| typed `force` | push 撞 non-fast-forward | 自动 force push 覆盖远端历史 |
| typed `discard` | Discard 全景确认 | 误丢弃整支工作，不可恢复 |
| tests fail 锁定 | Step 3 | 带病 merge / PR |
| toolchain askUser | 私域 git host | 瞎猜工具栈 |
| 补清询问 | Step 1 检测到 PR 已合并未清 | 上个会话的决策不能代表本会话 |

除表内情形，全景确认后新增任何交互都是 bug。

## Worktree 清理安全规则

- Merge / Discard → 必清理 worktree；PR → cron 监控合并后自动清（全景内定）；Keep → 不清理
- **合并后收尾 = worktree + 本地 branch + 远程分支三件套**，只清 worktree 留 branch 是残留（生产实证）。PR 路径平台确认 MERGED 后本地 branch 用 `-D`（squash/rebase 合并下 `-d` 误报 not merged）；Merge 路径本地 merge 成功后用 `-d`
- 长期分支护栏：分支名是 main / master / release / develop → 永不删（本地远程都不删）
- 清理顺序：先确认 merge/discard 成功 → `cd "$MAIN_ROOT"` → `git worktree remove <path>` → `git worktree prune`
- 先 remove worktree 再删 branch（反了 `branch -d` 会 fail，worktree 还在引用）
- `git worktree remove` 前必须 cd 到主仓根（在 worktree 内跑会静默失败）
- 未提交改动 → remove 报错，不加 `--force`，用户先 stash
- cleanup 时识别 4 种 worktree 路径模式：`.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/` / 插件 `<project>-<branch_flat>/` 平级路径（per `rule-git-worktree`）

## 不要

- 不要跳过全景计划直接执行 — 「用户催了 / 很简单」不是理由，全景是唯一授权点
- 不要在全景确认后新增计划外交互 — 安全例外表之外再问 = bug；反过来也不要把安全例外并进全景「顺手确认」
- 不要自动 force push — 用户 typed `force` 字面才执行
- 不要在 approve 前 merge — 自动合并判据 = 平台可合并 + ≥1 approve，缺一不合；全景选了「只盯不合」就绝不代合
- 不要假设 toolchain — 私域 git host 必须 askUser，不擅自归类
- 不要 tests fail 时放行 Merge / PR — Keep / Discard 不受此限
- 不要在 worktree 内跑 `git worktree remove` — 先 cd 到 `$MAIN_ROOT`
- 不要删 branch 前没 remove worktree — worktree 还引用着，`branch -d` 会拒绝
- 盯合并只用 CronCreate 轮询（每轮 agent 在场，合并冲突 / 流转失败可当场处置）— 不要 `run_in_background` 常驻脚本（动作硬编码，意外无法处置），不要 ScheduleWakeup（/loop 专用）。cron 是会话级，Step 1 补清检测是必然兜底，不可省
- gh / bkt 工具特有的坑（`--reviewer` / PUT / `reviewers` 数组 / pipe jq / osascript）→ 见 `pr-flow-gh.md` / `pr-flow-bkt.md` 各自「不要」节，此处不重复
