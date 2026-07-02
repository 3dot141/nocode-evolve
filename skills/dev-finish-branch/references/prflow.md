# prflow — 提 PR 公用流程骨架（Step 单源）

Option 2（push + 建 PR）的完整 Step 骨架。**Step 编号只在本文件**——gh / bkt 各自的命令实现见 `pr-flow-gh.md` / `pr-flow-bkt.md`（按步骤名组织，不重复 Step 编号）。

toolchain 检测（`github.com`→gh / `bitbucket.`→bkt）见 SKILL.md Step 1。多数 Step 对 gh/bkt 无差异（直接写在本文件）；有差异的（查 reviewer / 建 PR / 加 reviewer / 查 PR 状态）标注「→ 见 pr-flow-gh / pr-flow-bkt」。

## Step 0: 决策线 — 进入 PR 流程时一次确认

进 PR 流程前，把整条线展给用户**一次确认整条**——把"合并后才问 worktree 去留"提前到此刻（PR 刚建、没 review 时让用户猜去留是坏时机）：

```
[PR 路径决策线] 选了 PR, 这条线会走:
  1. 提 PR              → title/body 你过一眼 (Gate Title-Body, 安全 Gate 保留)
  2. 后台盯合并          → run_in_background 每 <interval> 秒查一次
  3. 合并后 · 清 worktree
  4. 合并后 · 流转飞书任务 <task-ids> → <目标状态>   (此刻定死目标状态)

确认整条线?
  ① 确认 → 全自动 (中途只 Gate Title-Body/PR/force 打断)
  ② 改某步 (目标状态 / 要不要流转 / interval)
  ③ 只到第 1 步 (提完 PR 就停, worktree 保留 = 旧行为)
```

- **目标状态定死（第 4 步）**：从 commit 提取任务号（`#f-xxx`/`#g-xxx`/`#m-xxx`）+ 当前状态，此刻推定并确认，写入决策；pr-watch 退出后 agent 按此执行，不再问。无任务号 → 标"无流转"。
- **确认①后**：worktree 由后台盯合并后自动清，后续不再单问去留。
- **选③**：跳过后台盯，手动保留分支。

## Step 1: 生成 title + body

**输出契约**引用 `rules/rule-push-summary.md`：

- **标题**：≤ 50 字，提炼最大变更轴（含版本号 if any）；不逐条罗列 commit
- **描述**：≤ 200 字（中文按字），两小节：
  - **基础内容**：逐 commit 一行 `<short-sha> <type>: <一句话变更>`，**覆盖 push range 全部 commit**，不漏不并
  - **重点评测**：每 commit 至少给 亮点 / 风险 / 未验证项 一类；实在没的写 `无评测 (机械修订)`

确认 push range：`git log "$(git merge-base HEAD $base_branch)..HEAD" --oneline`。range 内 N 个 sha，基础内容就 N 行。

（gh/bkt 无差异）

## Step 2: 收集 Affected

Gate Title-Body 前拿全部变更文件，按目录层级组织成 tree 格式（`├──` `└──` `│`），列在 **Affected** 一节：

```bash
git diff --name-only "$(git merge-base HEAD $base_branch)..HEAD" | sort
```

根目录文件直接列，目录按字母序。**Affected 只用于 Gate Title-Body 给用户一同确认，不写进 PR body**——body 只有 Step 1 的「基础内容 + 重点评测」（`rule-push-summary` 契约）。（gh/bkt 无差异）

## Step 2a: 解析 PR target

解析 `base_branch`（优先级）：
1. `git config branch.<current>.nocode-base`（worktree 创建 / Env Gate Base 写入）
2. `@{upstream}`
3. `origin/HEAD` → fallback `origin/main`

→ `target_remote` + `target_branch`（`upstream/release` = fork 场景 `origin/<branch>`→`upstream/release`；`origin/main` = origin/main）。

**项目本地 override**：仅读 `.agents-personal/rules/personal-repo-pr.md` 的 target 约定，不存在即无约定。（gh/bkt 无差异）

## Gate Title-Body

用 AskUserQuestion 让用户确认 target / title / body / Affected，**内容内嵌 payload 自足**（Gate 展示总则见 SKILL.md「Gate 速查」）：

- `question` 文本写入实际值：target（+ 来源标注）+ title 全文
- body 全文 + Affected tree 放 `options[].preview`，**每个选项带同一份**（用户聚焦任何选项都能看到）
- 禁止「以上…确认?」指代前文——此刻刚跑完收集 Affected 的 Bash，工具调用之间的自由文本 harness 不保证渲染，被吞后用户看不到要确认的内容

选项与响应：
- OK → 进 Step 3
- 改 target → 更新 target，**不重生成** title/body，再 askGate
- 改 title/body → **重生成**，再 askGate

循环到用户 OK。（gh/bkt 无差异）

## Step 3: 构 PR 计划 + Gate PR

用 AskUserQuestion 让用户审计划：`push / source / target / reviewer` 四字段实际值写进 `question` 文本或每个选项的 `preview`（内嵌 payload 自足，禁止「以上计划…确认?」指代，总则见 SKILL.md「Gate 速查」）。用户可改任一字段（改 reviewer/target 时局部更新，不重生成 title/body）。

**项目本地 reviewer override**：仅读 `.agents-personal/rules/personal-repo-pr.md`。

**查 default reviewer** → 见 `pr-flow-gh`「default reviewer」/ `pr-flow-bkt`「default reviewer」（工具差异大：gh 走 branch protection/CODEOWNERS，bkt 走 default-reviewers API + cross-fork endpoint）。

## Step 5: push（永不自动 force）

```bash
git push -u origin HEAD
```

- no permission / auth fail → 报错 + 不进 PR 阶段，worktree 保留
- **non-fast-forward**（rebase/amend 改过 history）→ 用户 typed `force` **字面**才 `git push --force-with-lease origin HEAD`；任何非 `force` 字面（含 yes/y/OK）→ 不 force。（gh/bkt 无差异，纯 git）

## Step 6: 建 PR（不带 reviewer）

做什么：用 Gate 确认的 title/target/body 建 PR，**绝不在 create 时塞 reviewer**（单 user 错会让整个 PR 建不出来），拆「create 不带 reviewer + 单独 edit 加」。

→ 命令见 `pr-flow-gh`「建 PR」/ `pr-flow-bkt`「建 PR」（bkt 分单仓 Workflow A / cross-fork Workflow B）。

## Step 7: 加 reviewer

做什么：建 PR 后单独加 reviewer，batch + 单个 fallback；单个 fail（无权限/不存在）跳过不阻断。

→ 命令见 `pr-flow-gh`「加 reviewer」/ `pr-flow-bkt`「加 reviewer」（bkt 有大小写 409 坑，需 fallback）。

## Step 8: 按决策线执行 — pr-watch 后台盯 或 手动收尾

PR 创建 + reviewer 加完后，按 Step 0 决策线分流。先检测是否在 worktree：

```bash
git_dir=$(git rev-parse --git-dir); common_dir=$(git rev-parse --git-common-dir)
[ "$git_dir" != "$common_dir" ] && is_worktree=true || is_worktree=false
```

`is_worktree == false` → 决策线 3/4 步（清 worktree）不适用，报告 PR URL 结束。

### 决策线选① → 起 pr-watch（骨架表，差异只在查状态）

`is_worktree == true` 且选①：用 `Bash(run_in_background=true)` 起 `pr-watch.mjs`。脚本每 5min 查一次、无超时上限盯到终态，退出时 re-invoke agent。四步骨架：

| Step | 公用逻辑（gh/bkt 都一样） | 差异（只此一处） |
|---|---|---|
| **1. 查状态** | 每 interval 秒查、归一化成 `{state, mergeable}` | gh: `gh pr view --json state,mergeStateStatus,mergeable`；bkt: `bkt api .../pull-requests/<id>`（.state）+ `/merge`（.canMerge） |
| **2. 状态机** | MERGED→清 / CLOSED→通知退 / 可合+未提醒→通知一次 | 公用（`decide`） |
| **3. 清 worktree** | `git -C <MAIN_ROOT> worktree remove + prune` | 公用 |
| **4. 流转** | Read `post-merge.md` 按目标状态流转 | 公用 |

> 骨架表对应 `pr-watch.mjs`：Step 1 = `normalizeGh`/`normalizeBkt`（唯一分叉），Step 2-4 = `decide`/`cleanupWorktree`/`loop`（公用）。

**起脚本命令**（REF = `dev-finish-branch/references` 绝对路径；MAIN_ROOT 见 SKILL.md Step 1）→ 见 `pr-flow-gh`「起 pr-watch」/ `pr-flow-bkt`「起 pr-watch」（差别只在 `--toolchain` + bkt 多 `--target-project`/`--repo-slug`）。

起后报告 "PR 已创建 <url>，后台盯合并中（每 5min），合并后自动清 worktree + 流转"，本轮结束。

### pr-watch 退出后 → agent 读信号接续（公用）

读 stdout 的 `PR_WATCH_RESULT` 行：
- `PR_WATCH_RESULT merged worktree=<p> tasks=<ids>` → worktree 已清。`tasks` 非空 → **Read `post-merge.md`** 按 Step 0 定死目标状态流转；空 → 报告合并完成，无流转。
- `PR_WATCH_RESULT closed worktree=<p>` → PR 被关未合，worktree 保留，报告让用户决定。

### 决策线选③ → 手动保留（公用）

不起脚本，报告 "PR <url> 创建成功，worktree 保留，你后续 iterate / 合并后自己清"。清理时识别 4 种 provenance 路径模式（见 SKILL.md）。

### 远程分支清理提示

PR 合并后删远程分支的方式 gh/bkt 不同 → 见 `pr-flow-gh`「远程分支清理」/ `pr-flow-bkt`「远程分支清理」。**不在此刻删远程**——PR 的 source 分支删了 PR 会关闭。
