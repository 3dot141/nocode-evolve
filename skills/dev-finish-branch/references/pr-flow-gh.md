# Option 2: push + 建 PR (GitHub gh 主流程)

option 2 在 `toolchain == "gh"` 时的全流程: title/body 生成 → Gate Title-Body → PR 计划 → Gate PR → push → `gh pr create` → reviewer add.

含 **Gate 体系中的 Gate Title-Body + Gate PR** (Gate Merge 在 option 1, Gate Discard 在 option 4, Gate Remote-Delete 在 option 1/4 删 branch 后).

## 前置条件

- 已选 option 2
- 已走完 `commit-tidy.md` (用户已整理或显式跳过)
- 工具栈 = `gh` (BF0 检测 = `github.com` 显式匹配, 或私域 askUser 选 gh)
- `gh` CLI 可用 (`gh --version` 验)

## Step 1: 生成 title + body

**输出契约**直接引用 `rules/rule-push-summary.md`, 不在本文件复制规则:

- **标题**: ≤ 50 字, 提炼最大变更轴 (含版本号 if any); 不逐条罗列 commit
- **描述**: ≤ 200 字 (中文按字), 含两小节:
  - **基础内容**: 逐 commit 一行 `<short-sha> <type>: <一句话变更>`, **必须覆盖 push range 全部 commit**, 不漏不并
  - **重点评测**: 每 commit 至少给 亮点 / 风险 / 未验证项 三类中一类; 实在没的写 `无评测 (机械修订)` 不硬凑

确认 push range:

```bash
git log "$(git merge-base HEAD $base_branch)..HEAD" --oneline
```

range 内 N 个 sha, 基础内容就要有 N 行.

## Step 2: 收集影响文件

Gate Title-Body 展示前, 先拿本次 PR 涉及的全部变更文件:

```bash
git diff --name-only "$(git merge-base HEAD $base_branch)..HEAD" | sort
```

按目录层级组织成 **tree 格式** 输出 (用 `├──` `└──` `│` 字符画), 同目录下的文件聚拢:

```
.claude-plugin/
└── plugin.json
rules/
├── manifest.json
├── rule-git-freshness.md
└── rule-git-worktree.md
scripts/
└── freshness-check.mjs
```

根目录文件直接列 (不加前缀目录), 目录按字母序排.

## Step 2a: 解析 PR target

Gate Title-Body 前先解析 target, 让用户尽早看到 PR 方向, 避免「target 是 upstream/release 还是 origin/release」的歧义。

解析 `base_branch` (优先级):

1. `git config branch.<current>.nocode-evolve-base` (worktree 创建 / devflow Env 阶段 Gate Base 写入)
2. `@{upstream}` (tracking branch)
3. `origin/HEAD` 指向 → fallback `origin/main`

解析结果 → `target_remote` + `target_branch`:
- `upstream/release` → target_remote=`upstream`, target_branch=`release` (fork 场景, PR: `origin/<branch>` → `upstream/release`)
- `origin/main` → target_remote=`origin`, target_branch=`main`

**项目本地 override**: **仅**读 `.agents-personal/rules/personal-repo-pr.md` 的 target 约定。不存在 = 无约定, 走默认优先级, 不在其他位置搜索。

## Gate Title-Body: target + title/body + 影响文件 用户确认

agent 输出 target + title + body + 影响文件 tree 给用户审, 等响应:

- "OK / 好 / 没问题 / 通过" → 进 Step 3
- 改 target (e.g. "target 应该是 origin/release") → 更新 target, **不重生成 title/body**, 再次 askGate
- 改 title/body (e.g. "标题太长", "body 第二段删掉") → **重生成** title + body, 再次 askGate

```
[Gate Title-Body] 候选 PR 草稿如下, 确认 OK 还是给修改意见?

# target
<target_remote>/<target_branch>    ← 来源: <nocode-evolve-base | @{upstream} | origin/HEAD>

# title
<标题>

# body
<完整 body markdown>

# 影响文件
<tree 格式的文件路径, 按目录聚拢>

(target / title / body 均可改; 回 OK 进 Gate PR 确认 reviewer)
```

循环到用户明确 OK 才进 Step 3.

## Step 3: 构 PR 计划

构 PR 元数据让用户审:

```
[PR Plan]
  push:    origin/<branch>
  source:  <owner>:<source-branch>    (GitHub 默认 = head repo)
  target:  <owner>:<target-branch>    (默认 base_branch)
  reviewer: <list, 含 default reviewer>
```

**`target`**: 沿用 Step 2a 解析结果 (`target_remote`/`target_branch`), Gate Title-Body 阶段用户改过的以改后值为准。fork 场景 (target_remote=`upstream`) PR 形态为 `origin/<branch>` → `upstream/<target_branch>`, 不先合并回本地 base 再从 fork base 发 PR。

**项目本地 reviewer override**: **仅**读 `.agents-personal/rules/personal-repo-pr.md` 的 reviewer 名单。不存在 = 无项目本地约定 → 走下面 default reviewer 优先级, 不在其他位置搜索。

查 default reviewer (按优先级试):

```bash
# 优先级 1: GitHub branch protection rules (required reviewers)
gh api "repos/<owner>/<repo>/branches/$base_branch/protection" \
   --jq '.required_pull_request_reviews.dismissal_restrictions.users[]?.login' 2>/dev/null

# 优先级 2: CODEOWNERS (fallback, agent 自己 parse 第一行匹配 path 的 owner)
test -f .github/CODEOWNERS && cat .github/CODEOWNERS

# 优先级 3: 无 default reviewer → 空列表 (用户在 Gate PR 可补)
```

## Gate PR: 计划用户确认

用户可改任一字段:
- 改 reviewer (加 alice / 删 bob / 替换 / 清空)
- 改 target_branch (默认 base, 可重定向到其他 branch)
- 改 source (跨 fork PR 时显式指定 head repo)

```
[Gate PR] 上述 PR 计划确认 OK 还是改?

(回 OK / 或给 "去掉 bob 加 charlie" / "target 改成 develop" 等)
```

改 reviewer / target 时**局部更新 plan**, **不重生成 title/body** (Gate Title-Body 已通过, body 不动). 再次 askGate 直到用户 OK.

## Step 5: push (永不自动 force)

```bash
git push -u origin HEAD
```

异常处理:

| 异常 | 处理 |
|---|---|
| no permission / auth fail | 报错因 + 不进 PR 阶段, worktree 保留, 用户授权后重跑 |
| branch 已存在 (非 ff) | 走 non-ff 分支, 见下 |
| network / timeout | 报错因 + 提示 retry 命令 |

### non-fast-forward 分支 (用户改过 history 想覆写)

```
[non-ff detected]
本地 HEAD 跟 origin/<branch> 有分歧, 通常是你 rebase / amend / squash 改了 history.

要 force-push 吗? 这会**覆写 remote**, 协作者拉不下来会撞 conflict.

回 'force' 字面我才跑:
  git push --force-with-lease origin HEAD

(--force-with-lease 比裸 --force 安全, 检测 remote 有没有新 commit 后才覆写)
```

用户 typed 任何**非 `force` 字面** (含 'yes' / 'y' / 'OK') → 不 force, 报错因 return.

## Step 6: 建 PR (不带 --reviewer)

```bash
gh pr create \
  --title "<title from Gate Title-Body>" \
  --base "<target_branch from Gate PR>" \
  --body "$(cat <<'EOF'
<完整 body markdown>
EOF
)"
```

- **绝不带 `--reviewer`** — gh `pr create` 时塞 reviewer, 单个 user 名错会让整个 PR 都建不出来. 拆 "create 不带 reviewer + edit 单独加" 更稳
- create 成功返 PR URL, 抓 PR number 用 `--json number --jq '.number'`

create 失败:
- rate limit → 报错 + 等 retry (不自动 retry)
- auth fail → 报错 + 用户 `gh auth login`
- body 格式问题 (markdown 含特殊字符) → 报错 + 让用户改
- 不进 reviewer add 阶段, worktree 保留, 用户从这步重跑

## Step 7: 加 reviewer (batch + 单个 fallback)

```bash
# 批量 add — gh 支持 comma-separated multi reviewer
gh pr edit <pr-number> --add-reviewer "alice,bob,charlie"
```

- 整体成功 (exit 0) → 完成, 报告 PR URL
- 整体 fail (rate limit / auth) → 报错 + 不 retry
- 单个 fail (gh stderr 会出 "user X not found" / "X cannot be added as reviewer") → 扫 output 抽 fail 的:
  - GitHub 没 bkt 那种"大小写敏感" 问题, 不需要 case-fallback
  - 单个 fail = 用户无 read 权限 / 用户不存在 → 跳过该 reviewer, 不阻断
  - 最后报告 "PR <url> 创建成功, reviewer X 添加失败已跳过"

## Step 8: Gate Worktree-Cleanup — worktree 清理 (gh)

PR 创建 + reviewer 加完后, 检测当前是否在 worktree 中. 非 worktree 则跳过.

### 前置检测

```bash
git_dir=$(git rev-parse --git-dir)
common_dir=$(git rev-parse --git-common-dir)
[ "$git_dir" != "$common_dir" ] && is_worktree=true || is_worktree=false
```

`is_worktree == false` → 跳过, 报告 PR URL 结束.

### Gate Worktree-Cleanup 文案

```
[Gate Worktree-Cleanup] PR 已创建: <pr_url>
当前在 worktree: <worktree_path>

① 保留 worktree (默认) — 继续在此 iterate PR feedback
② 清理 worktree — 删本地 worktree, PR 合并后可删远程分支
```

### 判定

- **选 ①**: 报 "worktree 已保留". 结束.
- **选 ②**: 执行 worktree 清理, 然后输出远程分支清理提示.

### 执行 (选 ②)

worktree 清理 (识别 4 种 provenance 路径模式, 见 dev-finish-branch SKILL.md):

```bash
cd "$MAIN_ROOT"
git worktree remove "<worktree_path>"    # 未提交改动会报错, 不加 --force
git worktree prune
```

- `remove` 报错 → 报错因, 用户可 `git stash` 后重试
- 成功 → 报 "已清理 worktree `<path>`"

远程分支清理提示 (GitHub):

```
PR 合并后清理远程分支:
  - GitHub PR 页面: 合并后点 "Delete branch" 按钮
  - 或命令行: git push origin --delete <remote_branch>
  - 或 repo Settings → General → 勾选 "Automatically delete head branches"
```

**不在此刻删远程** — PR 的 source 分支删了 PR 会关闭.

## 不要

- **不要在 `gh pr create` 时塞 `--reviewer`** — 见 Step 6
- **不要假设 default reviewer 一定有** — branch protection 没配 / CODEOWNERS 不存在 = 空列表, 正常进 Gate PR, 用户可手填
- **不要自动 force-push** — non-ff 用户 typed `force` 字面才执行, 见 Step 5
- **不要等 GitHub Actions / CI 状态** — 不在本流程 scope; 用户自己看 PR 页
- **不要 PR 创建完立刻关 / merge** — Option 2 终态是 PR 提交并加 reviewer, 后续 review / merge 走 GitHub UI 或另一轮 finishing-branch (这次选 option 1 本地 merge?)

## Bitbucket DC 项目

若 BF0 检测 `toolchain == "bkt"`, **额外** Read `pr-flow-bkt-appendix.md`, 它覆盖本文件 Step 6 (建 PR) + Step 7 (加 reviewer) + Step 8 远程分支清理提示段, 用 `bkt` 命令 + Bitbucket 提示替换.

主流程 (Step 1-5 + Gate Title-Body + Gate PR + Step 8 worktree 清理) 不变.
