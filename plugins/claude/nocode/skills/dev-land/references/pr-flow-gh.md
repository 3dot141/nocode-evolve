# pr-flow-gh — 提 PR 的 GitHub (gh) 实现

配合 `prflow.md` 骨架用——本文件只给 **gh 特有命令**，按主题组织，**不带 Step 编号**（Step 骨架在 prflow.md）。前置：`gh` CLI 可用（`gh --version`），toolchain 检测 = `github.com`。

## 按分支查 PR（SKILL.md Step 2b 补清检测）

```bash
gh pr view --json state,url          # 不带 PR 号，自动按当前分支解析
```

报 `no pull requests found for branch ...` = 该分支无 PR → 静默继续主流程。

## default reviewer（prflow Step 1 材料收集）

按优先级查：

```bash
# 1: branch protection required reviewers
gh api "repos/<owner>/<repo>/branches/$base_branch/protection" \
   --jq '.required_pull_request_reviews.dismissal_restrictions.users[]?.login' 2>/dev/null

# 2: CODEOWNERS (agent parse 第一行匹配 path 的 owner)
test -f .github/CODEOWNERS && cat .github/CODEOWNERS

# 3: 无 → 空列表 (用户在全景计划可补)
```

## 建 PR（prflow Step 4）

```bash
gh pr create \
  --title "<title from 全景计划>" \
  --base "<target_branch from 全景计划>" \
  --body "$(cat <<'EOF'
<完整 body markdown>
EOF
)"
```

- **绝不带 `--reviewer`** — 单 user 名错会让整个 PR 建不出来，拆 create + edit
- 成功返 PR URL，抓 number：`--json number --jq '.number'`
- 失败：rate limit → 报错等 retry（不自动）；auth → `gh auth login`；body 格式（含特殊字符）→ 报错让用户改。不进 reviewer 阶段，worktree 保留，从这步重跑

## 加 reviewer（prflow Step 5）

```bash
gh pr edit <pr-number> --add-reviewer "alice,bob,charlie"
```

- 整体成功（exit 0）→ 完成
- 整体 fail（rate limit/auth）→ 报错 + 不 retry
- 单个 fail（"user X not found" / "X cannot be added as reviewer"）→ GitHub **无大小写坑**（不需要 case fallback），单个 = 无 read 权限 / 不存在 → 跳过该 reviewer 不阻断，最后报 "PR <url> 创建成功, reviewer X 添加失败已跳过"

## pr-check 调用（prflow Step 6 定时监控）

```bash
node "<REF>/pr-check.mjs" --toolchain gh --pr <pr-number>
```

持续监控时在同一命令增加 `--watch --interval-seconds 300`。输出 `PR_CHECK state=<S> mergeable=<M> approved=<A>`；命中可处置状态时再输出 `PR_WATCH reason=<READY|MERGED|CLOSED> runs=<N>`（归一化：mergeable = `MERGEABLE` 且 mergeStateStatus=`CLEAN`；approved = reviewDecision=`APPROVED`）。

## 合并 PR（prflow Step 6 自动合并分支）

```bash
gh pr merge <pr-number> --merge      # 策略按全景选择: --merge / --squash / --rebase
```

- 失败（并发 push / branch protection 变化 / 权限）→ 通知转人工 + 停止监控，不重试

## 远程分支清理（prflow Step 6 MERGED 收尾 c）

全景默认删：MERGED 收尾时 `git push origin --delete <remote_branch>`。

- 仓库配了 "Automatically delete head branches" → 报 `remote ref does not exist` = 平台已删，当成功
- protected branch / 权限不足 → 报原因不阻塞收尾

## 不要（gh 特有）

- **不要 `gh pr create` 时塞 `--reviewer`** — 见「建 PR」
- **不要 `gh pr merge` 不带策略 flag** — 非交互环境会失败/挂起，定时监控处置时必须显式 `--merge`/`--squash`/`--rebase`
- **不要假设 default reviewer 一定有** — branch protection 没配 / CODEOWNERS 不存在 = 空列表，全景计划里用户手补
- **不要在 PR 创建主流程里反复手工查询 GitHub Actions / CI** — 统一交给 `pr-check.mjs --watch`
