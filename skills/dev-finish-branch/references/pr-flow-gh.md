# pr-flow-gh — 提 PR 的 GitHub (gh) 实现

配合 `prflow.md` 骨架用——本文件只给 **gh 特有命令**，按主题组织，**不带 Step 编号**（Step 骨架在 prflow.md）。前置：`gh` CLI 可用（`gh --version`），toolchain 检测 = `github.com`。

## default reviewer（prflow Step 3）

按优先级查：

```bash
# 1: branch protection required reviewers
gh api "repos/<owner>/<repo>/branches/$base_branch/protection" \
   --jq '.required_pull_request_reviews.dismissal_restrictions.users[]?.login' 2>/dev/null

# 2: CODEOWNERS (agent parse 第一行匹配 path 的 owner)
test -f .github/CODEOWNERS && cat .github/CODEOWNERS

# 3: 无 → 空列表 (用户在 Gate PR 可补)
```

## 建 PR（prflow Step 6）

```bash
gh pr create \
  --title "<title from Gate Title-Body>" \
  --base "<target_branch from Gate PR>" \
  --body "$(cat <<'EOF'
<完整 body markdown>
EOF
)"
```

- **绝不带 `--reviewer`** — 单 user 名错会让整个 PR 建不出来，拆 create + edit
- 成功返 PR URL，抓 number：`--json number --jq '.number'`
- 失败：rate limit → 报错等 retry（不自动）；auth → `gh auth login`；body 格式（含特殊字符）→ 报错让用户改。不进 reviewer 阶段，worktree 保留，从这步重跑

## 加 reviewer（prflow Step 7）

```bash
gh pr edit <pr-number> --add-reviewer "alice,bob,charlie"
```

- 整体成功（exit 0）→ 完成，报告 PR URL
- 整体 fail（rate limit/auth）→ 报错 + 不 retry
- 单个 fail（"user X not found" / "X cannot be added as reviewer"）→ GitHub **无大小写坑**（不需要 case fallback），单个 = 无 read 权限 / 不存在 → 跳过该 reviewer 不阻断，最后报 "PR <url> 创建成功, reviewer X 添加失败已跳过"

## 起 pr-watch（prflow Step 8 决策线①）

```bash
node "<REF>/pr-watch.mjs" --toolchain gh --pr <pr-number> \
  --worktree "<worktree_path>" --main-root "<MAIN_ROOT>" \
  --interval 300 --tasks "<commit 提取的任务号,逗号分隔,无则省>"
```

查状态命令：`gh pr view <n> --json state,mergeStateStatus,mergeable`（归一化见 `pr-watch.mjs` `normalizeGh`：state=OPEN/MERGED/CLOSED，mergeable = MERGEABLE 且 mergeStateStatus=CLEAN）。

## 远程分支清理（prflow Step 8）

```
PR 合并后清理远程分支:
  - GitHub PR 页面: 合并后点 "Delete branch" 按钮
  - 或命令行: git push origin --delete <remote_branch>
  - 或 repo Settings → General → 勾选 "Automatically delete head branches"
```

## 不要（gh 特有）

- **不要 `gh pr create` 时塞 `--reviewer`** — 见「建 PR」
- **不要假设 default reviewer 一定有** — branch protection 没配 / CODEOWNERS 不存在 = 空列表，正常进 Gate PR，用户手填
- **不要在主流程同步等 GitHub Actions / CI** — 同步阻塞等 CI 不在本流程 scope；PR 决策线选①的 pr-watch 是后台异步盯（run_in_background），不算同步等
- **不要 PR 创建完立刻关 / merge** — 终态是 PR 提交并加 reviewer，后续 review / merge 走 GitHub UI 或另一轮 dev-finish-branch（选 option 1 本地 merge）
