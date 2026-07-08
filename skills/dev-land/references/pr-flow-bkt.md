# pr-flow-bkt — 提 PR 的 Bitbucket DC (bkt) 实现

配合 `prflow.md` 骨架用——本文件给 **bkt 特有命令 + cross-fork 复杂逻辑**，按主题组织，**不带 Step 编号**（Step 骨架在 prflow.md）。前置：`bkt` CLI 可用（`bkt --version`；subcommand 或 `bkt api` REST passthrough，subcommand 优先），toolchain = `bitbucket.`。

沉淀 fx-data-agents 实战教训（来源 `fx-data-agents/.agents-personal/rules/personal-repo-pr.md`）。项目本地特异内容（reviewer 名单 / slug 历史）见文末「项目本地特异」。

> ⚠️ **Acceptance 未完全验证**：「加 reviewer」的 batch + 单个 fallback 假设（部分失败时成功的仍被加、失败的可 parse）**部分未实测**（batch happy-path 已实测，见下）。真撞到部分失败按坑表处理。

## Workflow 检测（先判 source/target repo 关系）

| 模式 | source | target | 行为 |
|---|---|---|---|
| **A**（单仓 / personal repo PR） | 同（`~harrison/`） | 同 | `bkt pr create` 直接用；reviewer add **整段跳过**（personal repo 团队无 read 权限） |
| **B**（跨 fork） | personal（`~harrison/`） | upstream（`FXDATA/`） | `bkt pr create` **不支持 cross-fork**；必须 `bkt api` POST + JSON body；reviewer 走 batch + 单个 fallback |

```bash
source_project="$SOURCE_PROJECT"; target_project="$TARGET_PROJECT"
if [ "$source_project" = "$target_project" ]; then workflow="A"; else workflow="B"; fi
```

## 按分支查 PR（SKILL.md Step 2b 补清检测）

```bash
# direction=OUTGOING 相对被查 repo = source 侧; cross-fork 查 source repo（personal fork）
bkt api "/rest/api/1.0/projects/<SOURCE_KEY>/repos/<slug>/pull-requests?direction=OUTGOING&at=refs/heads/<branch>&state=ALL&limit=5" \
  --json --jq '.values[0] | {id, state}'
```

取最新一条（API newest first）：`state=MERGED` → 补清场景；`OPEN`/查不到 → 静默继续主流程。

## 建 PR（prflow Step 4）

### Workflow A: 单仓 / personal repo

```bash
bkt pr create \
  --project "$source_project" --repo "$repo_slug" \
  --source "$source_branch" --target "$target_branch" \
  --title "<title>" --description "$(cat <<'EOF'
<完整 body markdown>
EOF
)"
```

> ⚠️ `bkt pr create` 默认 target 是远程 default（master）；要走 release **必须显式 `--target release`**，否则 PR 落错路径。

### Workflow B: cross-fork（走 bkt api REST）

`bkt pr create` 的 `--project`/`--repo` 只覆盖 target 一侧，source 默认同 repo，不支持 cross-fork。走原生 REST：

```bash
# 1) 写 JSON body 到临时文件 (避免 shell quote 地狱; 嵌套 JSON 必须 --input)
cat > /tmp/pr-body.json <<EOF
{
  "title": "<title>", "description": "<body, \\n 转义换行>",
  "state": "OPEN", "open": true, "closed": false,
  "fromRef": { "id": "refs/heads/${source_branch}",
    "repository": { "slug": "${repo_slug}", "project": { "key": "${source_project}" } } },
  "toRef": { "id": "refs/heads/${target_branch}",
    "repository": { "slug": "${repo_slug}", "project": { "key": "${target_project}" } } }
}
EOF
# 2) POST
bkt api "/rest/api/1.0/projects/${target_project}/repos/${repo_slug}/pull-requests" \
  --method POST --input "$(cat /tmp/pr-body.json)" > /tmp/pr-create.stdout
# 3) 抓 id (output 含真实换行, pipe jq 会 parse error)
pr_id=$(grep -oE '"id":[0-9]+' /tmp/pr-create.stdout | head -1 | grep -oE '[0-9]+')
# 4) 清理临时 JSON (含敏感 body)
rm /tmp/pr-body.json
```

### 创建失败处理

- rate limit（429）→ 报错等 retry
- JSON parse error（description 含未转义 quote）→ 报错让用户改 title/body
- fork 关系错配（fromRef slug/project 与 remote 不一致）→ 报错重审 source
- **绝不带 `reviewers` 字段** — 单 user 大小写/无权限错整个 PR 建不出来（409）

## default reviewer + 加 reviewer（prflow Step 1 / Step 5）

### Workflow A: 跳整段

source 是 personal repo（`~$source_project`），团队对其无 read 权限，任何 reviewer add 都 409。不调 `bkt pr edit --reviewer`，报告 "PR 创建成功（Workflow A personal repo），reviewer 未加，已 cc 到 description"。

### Workflow B: 取名单 → batch → 单个 fallback

**取 cross-fork 默认 reviewer 名单**（`--with-default-reviewers` 在 B 失效，见坑表）。两个 endpoint 按时机选：

**(a) 建 PR 后（source 已 push）** → `/reviewers` resolved，`.name` 已 canonical。repo id 从 PR 现取：
```bash
src_repo_id=$(bkt api ".../pull-requests/${pr_id}" --json --jq '.fromRef.repository.id')
tgt_repo_id=$(bkt api ".../pull-requests/${pr_id}" --json --jq '.toRef.repository.id')
bkt api "/rest/default-reviewers/1.0/projects/${target_project}/repos/${repo_slug}/reviewers?sourceRepoId=${src_repo_id}&targetRepoId=${tgt_repo_id}&sourceRefId=refs/heads/${source_branch}&targetRefId=refs/heads/${target_branch}" \
  --json --jq '.[].name'
```

**(b) 全景计划材料收集阶段（push 前，PR 未建）** → `/reviewers` 会 404（source ref 不存在）。改用 `/conditions`（不依赖 source ref），repo id 从 repo endpoint 取：
```bash
src_repo_id=$(bkt api "/rest/api/1.0/projects/${source_project}/repos/${repo_slug}" --json --jq '.id')
tgt_repo_id=$(bkt api "/rest/api/1.0/projects/${target_project}/repos/${repo_slug}" --json --jq '.id')
bkt api "/rest/default-reviewers/1.0/projects/${target_project}/repos/${repo_slug}/conditions" \
  --json --jq '.[].reviewers[].name'
```
两条都**排除 PR 作者**（`author.user.name` / 预览阶段即当前 bkt 登录用户）。

**batch add**（multi `--reviewer` 单次；idempotent）：
```bash
bkt pr edit "$pr_id" --project "$target_project" --repo "$repo_slug" \
  --reviewer user1 --reviewer user2 --reviewer user3 \
  > /tmp/bkt-edit.stdout 2> /tmp/bkt-edit.stderr
```
- exit 0 且全成功 → 完成
- exit≠0 整体 fail（rate limit/auth）→ 报错不 retry，已加的保留
- exit 0 但单个 fail（stderr warning）→ 扫 stderr 抽 fail 名，走大小写 fallback

> ✅ batch happy-path 已实测（PR #848：8 reviewer 含混合大小写一次加成功，前提名字精确大小写，从 `/reviewers` 取即 canonical）。

**大小写 fallback**（bkt 大小写敏感：`Kerim.Zhou`/`North` 必须精确，lowercase 409）：
```bash
correct_name=$(bkt api "/rest/api/1.0/users/${fail_user}" --json --jq '.name' 2>/dev/null)
if [ -n "$correct_name" ] && [ "$correct_name" != "$fail_user" ]; then
    bkt pr edit "$pr_id" --project "$target_project" --repo "$repo_slug" --reviewer "$correct_name"
    # 仍 fail → 跳过 log_missing
else
    log_missing "$fail_user"   # 不存在 / 无权限
fi
```
最后报告漏哪几个。

## pr-check 调用（prflow Step 6 cron 轮）

```bash
node "<REF>/pr-check.mjs" --toolchain bkt --pr <pr-id> \
  --target-project "<PROJECT_KEY>" --repo-slug "<repo_slug>"
```

输出 `PR_CHECK state=<S> mergeable=<M> approved=<A>`（归一化见 `pr-check.mjs` `normalizeBkt`：DECLINED→CLOSED；mergeable=`/merge` 的 `.canMerge`；approved=`.reviewers[].approved` 任一 true）。

## 合并 PR（prflow Step 6 自动合并分支）

```bash
# version 必须现取——PR 每次变更(加 reviewer/push)都会递增, 旧 version POST 会 409
version=$(bkt api "/rest/api/1.0/projects/<KEY>/repos/<slug>/pull-requests/<id>" --json --jq '.version')
bkt api "/rest/api/1.0/projects/<KEY>/repos/<slug>/pull-requests/<id>/merge?version=${version}" --method POST
```

- 合并策略走仓库默认（DC 端配置），不在命令侧选
- 失败（409 version 过期 → 重取一次再试；conflict / veto / 权限 → 通知转人工 + 删 cron，不重试）

## 远程分支清理（prflow Step 6 MERGED 收尾 c）

全景默认删：cron MERGED 轮内 `git push origin --delete <remote_branch>`。

- 仓库配了 "Auto delete branch on merge" → 报 ref 不存在 = 平台已删，当成功
- protected / 权限不足 → 报原因不阻塞收尾

## bkt 坑表（不要重撞）

- **不要 `--field 'fromRef[repository][slug]=...'` 传嵌套 JSON** — bkt 当 flat key，嵌套没解析。必须 `--input` 传完整 JSON
- **不要 `bkt api --method PUT` 改 PR 元数据** — Bitbucket PUT 全量替换，不带 `reviewers` → 已加的全清空。改 title/description/reviewer 一律 `bkt pr edit`
- **不要 create 时塞 `reviewers` 数组** — 单 user 错让整个 PR 建不出来
- **不要 pipe `bkt api` 输出给 jq** — output 含真实换行（非 escaped），pipe jq parse error。抓 id 用 `grep -oE '"id":[0-9]+' | head -1`
- **不要假设 PR slug 跟 git remote URL 一致** — DC 改名后 remote URL 可能仍旧 slug（redirect 兜底），bkt 必须用新 slug。验证 `bkt api '/rest/api/1.0/projects/<user>/repos' --param 'limit=200' --json --jq '.values[].slug'`
- **`/reviewers` resolved endpoint push 前会 404** — 依赖 source ref 已在 origin；cross-fork push 前无此 ref。预览用 `/conditions`，push 后用 `/reviewers`
- **不要对 fork PR（Workflow B）用 `bkt pr edit --with-default-reviewers`** — 报 `400 source repository with id '0' does not exist`。B 的 reviewer 必须 `--reviewer` 显式加
- **不要用 `bkt pr view` 验证跨仓（Workflow B）PR** — author/reviewers 显示 None/空。走 raw GET `bkt api '.../pull-requests/<id>' --json` 看 `reviewers[].user.name`/`.state`

## 项目本地特异内容不在本文件

> **查找范围**：项目本地 PR 约定（reviewer 名单 / slug / target）**仅限** `.agents-personal/rules/personal-repo-pr.md`。不存在即"无项目本地约定"→ 走 default-reviewers API 默认逻辑，**不扩大搜索**。

reviewer 名单 / repo slug 历史 / 团队 default reviewer 规则 → 项目本地 rule。本文件只承担通用 Bitbucket DC + bkt 模式。

## v2 待办

- [x] batch happy-path 已实测（PR #848）
- [ ] **部分失败**行为未实测（单个 fail 而其余成功时的 exit_code/stderr）— 真撞到再补
- [ ] 若部分失败发现整体 fail/回滚 → 改「加 reviewer」为"逐个 add + 单个 retry"两段式
