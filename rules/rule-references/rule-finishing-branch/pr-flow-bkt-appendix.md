# Option 2: Bitbucket DC bkt 附录 (覆盖 pr-flow-gh Step 6 + 7)

`toolchain == "bkt"` 时, 本附录覆盖 `pr-flow-gh.md` 的 **Step 6 建 PR** + **Step 7 加 reviewer** 段, 用 `bkt` CLI + `bkt api` REST passthrough 替换. 主流程 (Step 1 生成 title/body + Gate TB + Step 3 PR 计划 + Gate PR + Step 5 push) **不变**.

沉淀 fx-data-agents 项目实战教训 (来源: `fx-data-agents/.agents-personal/rules/personal-repo-pr.md`). 项目本地特异内容 (reviewer 名单 / slug 历史) 仍在项目本地 rule, 本附录只承担通用 Bitbucket DC + bkt 模式.

> ⚠️ **Acceptance 未完全验证 (Review 2 Q1 / C3)**: 本附录 Step 7 batch + 单个 fallback 假设 (`bkt pr edit --reviewer A --reviewer B --reviewer C` 部分失败时, 成功的仍被加, 失败的可 parse) **尚未实测**. 实施 plan Task 0 acceptance scenario 应先跑通验证; 若假设不成立, 本文件 Step 7 需修订为"逐个 add + 单个 retry".

## 前置条件

- 已读 `pr-flow-gh.md` (主流程 Step 1-5 + Gate TB + Gate PR 都走完)
- 工具栈 = `bkt` (BF0 检测 `remote_url` 含 `"bitbucket."` 子串, 或私域 askUser 选 bkt)
- `bkt` CLI 可用: `bkt --version` 验; subcommand (`bkt pr create` / `bkt pr edit`) + `bkt api` REST passthrough 任一即可, **subcommand 优先**

## Workflow 检测

进 Step 6 前先判 source repo 跟 target repo 关系:

| 模式 | source project | target project | 行为 |
|---|---|---|---|
| **Workflow A** (单仓 / personal repo PR) | 同 (e.g. `~harrison/`) | 同 (e.g. `~harrison/`) | `bkt pr create` 单仓直接用; reviewer add **整段跳过** (personal repo 团队无 read 权限) |
| **Workflow B** (跨 fork) | personal (e.g. `~harrison/`) | upstream (e.g. `FXDATA/`) | `bkt pr create` **不支持 cross-fork** (CLI 没暴露 source repo flag); 必须用 `bkt api` POST + JSON body; reviewer add 走 batch + 单个 fallback |

检测:

```bash
# 从 Gate PR 拿到 source / target 元数据
source_project="$SOURCE_PROJECT"    # e.g. "~harrison"
target_project="$TARGET_PROJECT"    # e.g. "FXDATA"
if [ "$source_project" = "$target_project" ]; then workflow="A"; else workflow="B"; fi
```

## Step 6: 建 PR

### Workflow A: 单仓 / personal repo

`bkt pr create` 单仓直接用 (CLI 支持单 repo 流程):

```bash
bkt pr create \
  --project "$source_project" --repo "$repo_slug" \
  --source "$source_branch" --target "$target_branch" \
  --title "<title from Gate TB>" \
  --description "$(cat <<'EOF'
<完整 body markdown>
EOF
)"
```

> ⚠️ 若 `bkt pr create` 默认 target 是远程 default (master), 而你想走 release → **必须显式 `--target release`**, 否则 PR 落 master 错路径.

### Workflow B: cross-fork (走 bkt api REST)

`bkt pr create` 不支持 cross-fork — 它的 `--project` / `--repo` 只覆盖 target 一侧, source 默认在同 repo. 必须走 `bkt api` 原生 REST:

```bash
# Step 6.B.1: 写 JSON body 到临时文件 (避免 shell quote 地狱; 嵌套 JSON 必须 --input)
cat > /tmp/pr-body.json <<EOF
{
  "title": "<title from Gate TB>",
  "description": "<body markdown, \\n 转义换行>",
  "state": "OPEN",
  "open": true,
  "closed": false,
  "fromRef": {
    "id": "refs/heads/${source_branch}",
    "repository": {
      "slug": "${repo_slug}",
      "project": { "key": "${source_project}" }
    }
  },
  "toRef": {
    "id": "refs/heads/${target_branch}",
    "repository": {
      "slug": "${repo_slug}",
      "project": { "key": "${target_project}" }
    }
  }
}
EOF

# Step 6.B.2: POST
bkt api "/rest/api/1.0/projects/${target_project}/repos/${repo_slug}/pull-requests" \
  --method POST --input "$(cat /tmp/pr-body.json)" \
  > /tmp/pr-create.stdout

# Step 6.B.3: 抓 PR id (output 含真实换行, pipe 给 jq 会 parse error)
pr_id=$(grep -oE '"id":[0-9]+' /tmp/pr-create.stdout | head -1 | grep -oE '[0-9]+')
echo "PR created: id=$pr_id"

# Step 6.B.4: 清理临时 JSON (含敏感 body, 不留残)
rm /tmp/pr-body.json
```

### 创建失败处理

- rate limit (429) → 报错 + 等用户 retry
- JSON body parse error (description 含未转义 quote / control char) → 报错 + 让用户改 title/body 重跑 Gate TB
- fork 关系错配 (`fromRef.repository` slug / project 与 remote 实际不一致) → 报错, 走 Gate PR 重审 source 字段
- **绝不带 `reviewers` 字段** — Bitbucket POST 若 reviewers 数组某个 user 大小写错 / 无 read 权限, 整个 PR 都建不出来 (`409 Conflict`). 拆 "create 不带 reviewer + edit 单独加" 更稳

## Step 7: 加 reviewer

### Workflow A: 跳整段

```
[Workflow A detected]
source 是 personal repo (~$source_project), 团队成员对其无 read 权限.
任何 reviewer add 都会 409. 跳整段, cc 已在 description (Gate PR 已捕到列表).
```

不调任何 `bkt pr edit --reviewer`. 直接报告 "PR 创建成功 (Workflow A personal repo), reviewer 未加, 已 cc 到 description".

### Workflow B: batch + 单个 fallback

#### Step 7.B.1: 批量 add

```bash
# multi --reviewer flag 单次调用; idempotent — 已是 reviewer 的回 warning + skip 不 fail
bkt pr edit "$pr_id" --project "$target_project" --repo "$repo_slug" \
  --reviewer user1 --reviewer user2 --reviewer user3 \
  > /tmp/bkt-edit.stdout 2> /tmp/bkt-edit.stderr
exit_code=$?
```

#### Step 7.B.2: 分析结果

- **`exit_code == 0` && 所有 reviewer 都成功** → 完成, 报告 PR URL
- **`exit_code != 0` && batch 整体 fail** (rate limit / auth):
  - 报错 + **不 retry**
  - 已加成功的 reviewer (若有) 保留, 不撤
- **`exit_code == 0` 但单个 reviewer fail** (stderr 含 warning):
  - 扫 `/tmp/bkt-edit.stderr` 抽 fail 的 reviewer 名
  - 对每个走下方大小写 fallback / 跳过决策

> ⚠️ **此处行为假设 acceptance 未完全验证** (per Review 2 C3): bkt multi-flag 部分失败时是否 `exit_code == 0` + 成功的仍被加 + stderr 可 parse — 实施 Task 0 必须先实测确认. 若实测发现 multi-flag 整体 fail / 成功的也回滚, 本节改"逐个 add + 单个 retry"两段式.

#### Step 7.B.3: 大小写 fallback (Workflow B 单个 409)

bkt **大小写敏感**: e.g. `imp` / `ju` / `rinoux` lowercase 能加, 但 `Kerim.Zhou` / `North` 必须精确大小写, lowercase 会 409.

对每个 stderr 抽到的 fail reviewer:

```bash
fail_user="$1"          # e.g. "kerim.zhou" (lowercase 错版)

# 查 user API 拿精确大小写
correct_name=$(bkt api "/rest/api/1.0/users/${fail_user}" --json --jq '.name' 2>/dev/null)

if [ -n "$correct_name" ] && [ "$correct_name" != "$fail_user" ]; then
    # 大小写差异 → retry 单个
    bkt pr edit "$pr_id" --project "$target_project" --repo "$repo_slug" \
      --reviewer "$correct_name"
    # 仍 fail → 跳过此 reviewer, log_missing
else
    # 不是大小写问题 (用户不存在 / 无 read 权限) → 跳过
    log_missing "$fail_user"
fi
```

最后报告漏哪几个: `"PR $pr_url 创建成功, reviewer X / Y 添加失败, 已跳过"`.

## bkt 已沉淀的坑 (不要重撞)

- **不要 `--field 'fromRef[repository][slug]=...'` 传嵌套 JSON** — bkt 把整个字符串当 flat key 名, 嵌套结构没解析. 必须 `--input` 传完整 JSON
- **不要用 `bkt api ... --method PUT` 改 PR 元数据** — Bitbucket PUT 是**全量替换**, 不带 `reviewers` 数组 → 已加的 reviewer **全清空**. 实战教训: PR #493 用 PUT 改 title 清掉 5 个 default reviewer, 不得不再逐个补. 改 title / description / reviewer **一律用 `bkt pr edit`**, 它内部用细粒度 endpoint, 只动指定字段
- **不要 create 时塞 `reviewers` 数组** — 单 user 错 (大小写 / 无权限) 会让整个 PR 都建不出来. 拆 "建空 reviewer PR + 逐 edit 加" 更稳
- **不要 pipe `bkt api` 输出给 jq** — output 含真实换行 (不是 JSON-escaped), pipe 给 jq 会 parse error. 抓 id 用 `grep -oE '"id":[0-9]+' | head -1`
- **不要假设 PR slug 跟 git remote URL 一致** — Bitbucket DC 改名后 git remote URL 可能仍是旧 slug (server redirect 兜底), 但 bkt CLI / API 调用必须用**新 slug**. 实战: `fx-data-nines.git` (remote URL) → `fx-data-agents` (实际 slug). 验证: `bkt api '/rest/api/1.0/projects/<user>/repos' --param 'limit=200' --json --jq '.values[].slug'`
- **不要对 fork PR (Workflow B) 用 `bkt pr edit --with-default-reviewers`** — 报 `400 The source repository with id '0' does not exist` (bkt 拿不到 fork 的 source repo id). Workflow B 的 reviewer 必须 `--reviewer` 显式加 (见 Step 7.B); default reviewer 名单从 `bkt api '/rest/default-reviewers/1.0/projects/<target>/repos/<repo>/conditions'` 查, 排除作者本人
- **不要用 `bkt pr view` 验证跨仓 (Workflow B) PR** — 它对 cross-repo PR 解析 `author` / `reviewers` 会显示 None / 空 (不可靠). 验证走 raw GET: `bkt api '/rest/api/1.0/projects/<target>/repos/<repo>/pull-requests/<id>' --json`, 看 `reviewers[].user.name` / `.status` / `author.user.name`

## 项目本地特异内容不在本附录

> **查找范围**: 项目本地 PR 约定 (reviewer 名单 / slug / target) **仅限** `.agents-personal/rules/personal-repo-pr.md`。该文件不存在即视为"无项目本地约定" → 走 default-reviewers API 默认逻辑, **不扩大搜索** (不扫项目根 / docs / 其他 rule, 不"找实际位置")。

- reviewer 名单 (e.g. fx-data-agents 的 `imp / ju / Kerim.Zhou / North / rinoux`) — 留项目本地 `.agents-personal/rules/personal-repo-pr.md`
- repo slug 历史 (e.g. `fx-data-nines` → `fx-data-agents` redirect) — 同上
- 团队 default reviewer 规则 (e.g. `bkt api '/rest/default-reviewers/1.0/projects/.../conditions'` 查询) — 项目本地 rule 给具体命令; 本附录只指明用 default-reviewers API

本附录承担**通用 Bitbucket DC + bkt 工具栈**模式, 不沉淀项目特异.

## v2 待办 (Acceptance 实测后)

- [ ] Task 0 实测 `bkt pr edit --reviewer A --reviewer B --reviewer C` 部分失败行为, 确认 Step 7.B.2 假设
- [ ] 若假设不成立 → 改 Step 7 为"逐个 add + 单个 retry"两段式, 同步 design doc BF2 + case 2.7
- [ ] 实测 `bkt pr edit` stderr 格式后, 给 Step 7.B.2 一个具体 grep pattern (e.g. `grep -oE 'reviewer "[^"]+" .* (failed|not added)'`)
