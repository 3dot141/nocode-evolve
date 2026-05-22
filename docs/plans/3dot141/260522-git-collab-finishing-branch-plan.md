# git 协作端到端链 finishing-branch implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec source:** `docs/plans/3dot141/260522-git-collab-finishing-branch-design.md` (同目录). 本 plan 落实 spec 6 节 (背景 / 目标 / 架构 / 实现 / 方案选型 / 其他) 中「实现 → 影响 / 业务流」段为具体 task; 内容细节优先回查 spec 影响表 ①②③ 编号要点.

**Goal:** 实现 plugin rule `rule-finishing-branch.md` 门面 + 4 子文件, 覆盖 + 扩展 `superpowers:finishing-a-development-branch` skill, 含 4 个 Gate (Merge / Title-Body / PR / Discard).

**Architecture:** 主门面 `rules/rule-finishing-branch.md` (~80 行) = 触发 + 4 选项菜单 + 子文件路由表 + 工具栈检测; `rule-references/rule-finishing-branch/` 子目录 4 子文件 = `skill-overlay.md` (~40) / `commit-tidy.md` (~50) / `pr-flow-gh.md` (~120) / `pr-flow-bkt-appendix.md` (~70). 通过 `model/agent-catalog.md` 路由触发, 复用现有 `inject-rules.sh:55-63` sanity check (非递归 glob, 子文件自动免检查).

**Tech Stack:** plugin rule markdown 文件 + Claude Code agent SessionStart hook 注入; 验证靠 acceptance scenarios 在 nocode-evolve (GitHub `gh`) + fx-data-agents (Bitbucket DC `bkt`) 实跑.

---

## File Structure

**Create (5)**:

- `rules/rule-finishing-branch.md` — 门面 (~80 行)
- `rules/rule-references/rule-finishing-branch/skill-overlay.md` (~40 行)
- `rules/rule-references/rule-finishing-branch/commit-tidy.md` (~50 行)
- `rules/rule-references/rule-finishing-branch/pr-flow-gh.md` (~120 行)
- `rules/rule-references/rule-finishing-branch/pr-flow-bkt-appendix.md` (~70 行)

**Modify (2)**:

- `model/agent-catalog.md` — 新增 `### finishing-branch` 路由条目
- `.claude-plugin/plugin.json` — version bump 1.1.x → 1.2.0

**Not modified** (依赖, 不动):

- `hooks/inject-rules.sh` — sanity check 已非递归扫子目录
- `rules/rule-push-summary.md` — pr-flow-gh 引用其输出契约不复制
- `rules/rule-git-worktree.md` — 创建端 rule, 收尾端独立
- `fx-data-agents/.agents-personal/rules/personal-repo-pr.md` — 项目本地特异保留

---

## Task 0: Pre-flight — acceptance 假设验证 (bkt multi-flag 部分失败行为)

**Why first**: Review 2 C3 / Q1 flagged BF2 + case 2.7 中 `bkt pr edit --reviewer A --reviewer B --reviewer C` 部分失败行为是**未经实证的假设**. 若假设不成立 (multi-flag 整体 fail / A/C 也不被加), BF2 两段式逻辑根本走不通, Task 5/6 写的 pr-flow-gh.md / pr-flow-bkt-appendix.md 会立即作废. 必须先验证.

**Files:** 无修改, 输出记录到 design doc 末尾 Review Log.

- [ ] **Step 1: 准备 testbed**
  - 进 fx-data-agents 仓库, 创临时 worktree branch `test-bkt-batch-add-260522`
  - push 一个 empty commit 到 `~harrison/fx-data-agents`
  - 走 Workflow B 建临时 PR (跨 fork → `FXDATA/fx-data-agents:release`) (照 spec BF2 cross-fork pattern)
  - 拿到 PR id

- [ ] **Step 2: 准备 reviewer 列表 (1 个 invalid 用户)**
  - 选 3 个用户: 2 个**确认有 read 权限** (e.g. `imp`, `ju`), 1 个**确认无 read 权限或不存在** (e.g. `nonexistent_user_xyz`)
  - 命令: `bkt api '/rest/api/1.0/users/<each>' --json --jq '.name'` 确认 valid 用户的精确大小写

- [ ] **Step 3: 实测 multi-flag batch add**
  
  ```bash
  bkt pr edit <pr-id> --project FXDATA --repo fx-data-agents \
    --reviewer imp --reviewer nonexistent_user_xyz --reviewer ju \
    > /tmp/bkt-test.stdout 2> /tmp/bkt-test.stderr
  echo "exit=$?"
  cat /tmp/bkt-test.stdout
  cat /tmp/bkt-test.stderr
  ```
  
  记录:
  - 整体 exit code (0 / 非 0)
  - stdout 内容 (是否含每个 reviewer 的状态)
  - stderr 内容 (warning / error 格式)
  - 哪些 reviewer 实际被加 (`bkt api '/rest/api/1.0/projects/FXDATA/repos/fx-data-agents/pull-requests/<pr-id>'` 查 `.reviewers[].user.slug`)

- [ ] **Step 4: 决定 BF2 流程 (根据 Step 3 结果)**
  
  | 实测结果 | BF2 流程决策 | 后续 Task 5/6 内容 |
  |---|---|---|
  | exit=0, imp/ju 被加, nonexistent 给 warning 行可 parse | **假设成立** | BF2 保持当前设计 (batch + 扫 output + 单个 fallback), case 2.7 不改 |
  | exit≠0, 没人被加 (整体 fail) | **假设不成立** | 修订 BF2 为 "逐个 add + 单个 retry", case 2.7 同步改, pr-flow-gh.md / -bkt-appendix.md 按修订后写 |
  | exit=0, 仅 imp 被加 (短路 stop on first fail) | **部分假设** | BF2 改为 "排序: 已知 valid 先 add, 然后逐个 add unknown", 同步 spec |
  
- [ ] **Step 5: 清理 testbed**

  ```bash
  bkt api "/rest/api/1.0/projects/FXDATA/repos/fx-data-agents/pull-requests/<pr-id>/decline" --method POST
  cd /Users/yes365/Work/Source/fx-data-agents
  git branch -D test-bkt-batch-add-260522
  ```

- [ ] **Step 6: 结果记录到 design doc Review Log**

  在 design doc 末尾追加 `### Implementation Acceptance — 260522` 段, 记录:
  - 实测命令
  - exit code / stdout / stderr
  - 决策 (上方 3 选 1)
  - 若需修订 BF2 — 改动摘要

- [ ] **Step 7: Commit**

  ```bash
  cd /Users/yes365/AI/nocode-evolve-design_git-collab-finishing-branch
  git add docs/plans/3dot141/260522-git-collab-finishing-branch-design.md
  git commit -m "docs(plan): 260522 bkt batch add acceptance 实测结果"
  ```

---

## Task 1: 创建 rule-references 子目录 + skill-overlay.md

**Files:**

- Create: `rules/rule-references/rule-finishing-branch/skill-overlay.md`

**Goal:** 定义跟 superpowers `finishing-a-development-branch` skill 的覆盖关系大表 (照 `rule-git-worktree.md:62-80` "覆盖关系" 段风格).

- [ ] **Step 1: mkdir + 创建文件骨架**

  ```bash
  cd /Users/yes365/AI/nocode-evolve-design_git-collab-finishing-branch
  mkdir -p rules/rule-references/rule-finishing-branch
  ```

- [ ] **Step 2: 写文件内容**

  按 spec 影响表「skill-overlay.md ①②③④」要点 + spec《业务流 BF0》「skill overlay 启用」段写. 内容骨架:

  ```markdown
  # superpowers:finishing-a-development-branch skill 行为覆盖

  执行 `superpowers:finishing-a-development-branch` skill 时, 本文规则覆盖 skill 内默认值. 若与 skill 内文冲突, **以本规则为准**.

  ## 推翻段 (3 段)

  | skill 内默认 | 本规则覆盖为 |
  |---|---|
  | Step 6 worktree provenance check (识别 `.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/`) | 扩展为**包含** plugin `<project>-<branch_flat>/` 平级路径 (per `rule-git-worktree.md` 推翻). cleanup 时认这三老路径 **或** 新平级路径 |
  | Option 2 PR title/body 默认占位符 (`<title>` / `<2-3 bullets of what changed>` / `## Test Plan` checklist) | 改调 `rule-push-summary.md` 输出契约: 标题 ≤50 字, 描述 ≤200 字 (基础内容 + 重点评测) |
  | Option 2 直接 `gh pr create` 单工具假设 | 改按 BF0 工具栈检测分支 — gh 走 `gh pr create`, bkt 走 cross-fork JSON body POST (`pr-flow-bkt-appendix.md`) |

  ## 保留段 (per skill 内 SKILL.md)

  - Step 1 Verify Tests (tests fail → hard stop, 不进 4 选项菜单)
  - Step 2 Detect Environment (GIT_DIR == GIT_COMMON 判定)
  - Step 3 Determine Base Branch
  - Step 4 Present Options 4 选项菜单文案
  - Step 5 Option 4 typed `discard` 字面确认 Gate
  - Step 6 Cleanup Workspace 的 `cd MAIN_ROOT → git worktree remove → git worktree prune` 命令链 (provenance 段除外, 已被推翻段扩展)
  - Common Mistakes / Red Flags 大部分约束 (含 "Never force-push without explicit request")

  ## 不要

  - 不要重写 4 选项菜单文案——本文档只扩展 provenance / 替换 title-body 占位符 / 替换工具栈假设, 其余原样
  - 不要绕过 typed `discard` 字面 Gate——sp skill 自带, overlay 保留
  - 不要把 plugin `<project>-<branch_flat>/` 模式加进 sp skill 源文件——上游 sp 不识别我们的 worktree 命名, overlay 是 plugin 端的 graft
  ```

- [ ] **Step 3: 验证文件结构 + sanity check**

  ```bash
  cat rules/rule-references/rule-finishing-branch/skill-overlay.md | head -20
  bash hooks/inject-rules.sh model 2>&1 | tail
  # 期望: 无 WARN (子文件在 rule-references/ 下, sanity check 不递归扫)
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add rules/rule-references/rule-finishing-branch/skill-overlay.md
  git commit -m "feat(rule): 加 finishing-branch skill-overlay 覆盖关系表"
  ```

---

## Task 2: 创建 commit-tidy.md

**Files:**

- Create: `rules/rule-references/rule-finishing-branch/commit-tidy.md`

**Goal:** option 1 + 2 共用的 commit 整理建议子文件. agent 给建议 + 完整命令, 用户自跑 (per spec Q4 决策).

- [ ] **Step 1: 写文件内容**

  按 spec 影响表「commit-tidy.md ①②③④」要点 + spec BF1/BF2 的 commit 整理段写. 内容骨架:

  ```markdown
  # Commit 整理建议 (option 1 + 2 共用)

  ## 触发

  选 option 1 (merge) 或 option 2 (push+PR) 后, 进入 commit 整理子步前.

  ## 主流程

  1. 列 push range 内 commit:
     ```bash
     git log --oneline $(git merge-base HEAD <base>)..HEAD
     ```
  2. 按下方 squash 判定规则给建议
  3. 给完整命令 (用户复制运行)
  4. 等用户说 "已整理 / 跳过" 再进 Gate M / Gate TB

  ## Squash 判定规则

  - **建议 squash**: 连续 ≥2 个 commit message 含关键字 `wip|tmp|fixup|fix typo|wip:|tmp:|WIP|TMP`
  - **建议 reword**: commit message 不符合 conventional commits (无 `<type>(<scope>):` 前缀)
  - **建议 fixup**: 某 commit 是为修前一个 commit 的 typo / 小遗漏 (message 含 "fix" + 引用之前 commit subject)
  - **其他场景默认不建议整理** — agent 不主动建议"reword 一切", 用户没要求别强迫

  ## 命令模板

  ### squash 多个 WIP commit

  ```bash
  git rebase -i HEAD~N    # N = 含 WIP 的 commit 数 + 1 (留一个 base)
  # 编辑器内把后续 commit 的 `pick` 改成 `squash` (或 `fixup` 不保留 message)
  ```

  ### autosquash (commit 已用 --fixup 标记时)

  ```bash
  git commit --fixup=<sha-of-target>    # 创建 fixup commit
  git rebase -i --autosquash HEAD~N      # autosquash 自动排序
  ```

  ### reword

  ```bash
  git rebase -i HEAD~N
  # 把对应 commit 的 `pick` 改成 `reword`, 保存; 后续编辑 message
  ```

  ## 不要

  - **不要 agent 自动跑 rebase**——交互式 rebase 失败会破坏 history, agent 没人工 oversight 风险高 (per spec Q4)
  - 不要强迫用户整理——给建议后等用户决定; "跳过" 是合法响应
  - 不要在 commit-tidy 阶段加 lint 检查 (commit message format / branch name 等)——那是 pre-commit hook 的事, 不在本流程
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add rules/rule-references/rule-finishing-branch/commit-tidy.md
  git commit -m "feat(rule): 加 finishing-branch commit-tidy 整理建议"
  ```

---

## Task 3: 创建 pr-flow-gh.md

**Files:**

- Create: `rules/rule-references/rule-finishing-branch/pr-flow-gh.md`

**Goal:** option 2 GitHub 全流程实现 — title/body 生成 → Gate TB → PR 计划 → Gate PR → push → `gh pr create` → reviewer add. 含 4 个 Gate (TB + PR 在本文件, M + D 在门面).

- [ ] **Step 1: 写文件内容**

  按 spec BF2 业务流伪代码 + spec 影响表「pr-flow-gh.md ①②③④⑤⑥⑦」要点写. 关键内容:

  ```markdown
  # option 2: push + 建 PR (GitHub gh 主流程)

  ## 前置条件

  - 已选 option 2
  - 已走完 `commit-tidy.md` (用户已整理或跳过)
  - 工具栈 = gh (BF0 检测结果)

  ## Step 1: 生成 title + body

  调 `rules/rule-push-summary.md` 输出契约 (本文件不复制其规则, 引用即可):

  - **标题**: ≤50 字, 提炼最大变更轴
  - **描述**: ≤200 字 (中文按字), 含两小节
    - 基础内容: 逐 commit 一行 `<short-sha> <type>: <一句话变更>`, 覆盖 push range 全部 commit
    - 重点评测: 亮点 / 风险 / 未验证项 三类至少一类

  ## Gate TB: title/body 用户确认

  agent 输出生成的 title + body markdown, 等用户:
  - 说 "OK / 好 / 没问题" → 进 Step 3
  - 给修改意见 (e.g. "标题太长", "body 第二段删") → agent 重生成, 再次输出, 再次等用户确认 (循环)

  ## Step 3: 构 PR 计划

  显示完整元数据让用户审核:
  - `push: origin/<branch>`
  - `PR: <source-repo>:<source-branch> → <target-repo>:<target-branch>`
  - `reviewer: <list>` (查 GitHub branch protection / CODEOWNERS 获得 default reviewer)

  查 default reviewer 命令:
  ```bash
  # GitHub branch protection rules
  gh api "repos/<owner>/<repo>/branches/<base>/protection" --jq '.required_pull_request_reviews.dismissal_restrictions.users[].login' 2>/dev/null
  # CODEOWNERS (fallback)
  test -f .github/CODEOWNERS && cat .github/CODEOWNERS
  ```

  ## Gate PR: 计划用户确认

  用户可改任一字段:
  - 改 reviewer (加 / 删 / 替换)
  - 改 target_branch (默认 base branch, 但用户可重定向)
  - 改 source (rare, 跨 fork 时可能用到)

  改完局部更新 plan, **不重生成 title/body**, 再次输出等确认.

  ## Step 5: 执行 push + 创建 PR + 加 reviewer

  ```bash
  # push (永不自动 --force)
  git push -u origin HEAD
  ```

  若 PushFail:
  - 一般 fail (no permission / branch 占用) → 报错因, return, worktree 保留
  - non-fast-forward → 提示用户 "回 'force' 字面我才跑 git push --force-with-lease", 不自动 force

  ```bash
  # create PR (不带 --reviewer, 留单独加)
  gh pr create --title "<title>" --base <target_branch> --body "$(cat <<'EOF'
  <body markdown 内容>
  EOF
  )"
  ```

  ## Step 6: 加 reviewer (batch + 单个 fallback)

  ```bash
  # 批量 add (gh 支持 comma-separated)
  gh pr edit <pr-number> --add-reviewer "alice,bob,charlie"
  ```

  - 若 batch fail (rate limit / auth) → 报错 + 不 retry
  - 若 batch 成功但单个 reviewer fail (gh 也会出 "user X not found" warning) → 跳过此 reviewer, 继续, 最后报告漏哪几个

  ## 不要

  - **不要在 `gh pr create` 时塞 `--reviewer`**——若某个 user 名错会整体 fail PR 都建不出来, 拆 "create 不带 reviewer + edit 单独加" 更稳
  - 不要假设 default reviewer 一定有——branch protection 没配 = 空列表, 正常进 Gate PR
  - 不要自动 force-push——non-ff 时让用户显式 typed `force`
  - 不要补 GitHub Actions / CI 状态等待——sp skill 没覆盖, 不在本 doc scope

  ## Bitbucket DC 项目

  → 读 `pr-flow-bkt-appendix.md` 覆盖本文件 Step 5 + 6 (建 PR + reviewer 段)
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add rules/rule-references/rule-finishing-branch/pr-flow-gh.md
  git commit -m "feat(rule): 加 finishing-branch pr-flow-gh 主流程 (含 Gate TB / PR)"
  ```

---

## Task 4: 创建 pr-flow-bkt-appendix.md

**Files:**

- Create: `rules/rule-references/rule-finishing-branch/pr-flow-bkt-appendix.md`

**Goal:** Bitbucket DC 工具栈 (`bkt`) 覆盖 `pr-flow-gh.md` 的 Step 5 (建 PR) + Step 6 (加 reviewer). 沉淀 fx-data-agents 已踩坑.

**Prerequisite:** Task 0 acceptance 实测结果若不支持当前 BF2 batch 假设, 本 task 内容按修订后版本写.

- [ ] **Step 1: 写文件内容**

  按 spec 影响表「pr-flow-bkt-appendix.md ①②③④⑤」要点 + spec BF2 bkt 分支 + fx-data-agents `personal-repo-pr.md` 通用模式上提写. 关键内容:

  ```markdown
  # option 2: Bitbucket DC bkt 附录 (覆盖 pr-flow-gh Step 5 + 6)

  ## 前置条件

  - 已读 `pr-flow-gh.md` (主流程 Step 1-4 + Gate TB + Gate PR 都走完)
  - 工具栈 = bkt (BF0 检测 `origin url` 含 `bitbucket.` 子串)
  - `bkt` CLI 可用 (subcommand 或 `bkt api` REST passthrough 任一即可, subcommand 优先)

  ## 覆盖 Step 5: 建 PR

  ### Workflow B (cross-fork)

  `bkt pr create` **不支持 cross-fork** (CLI 没暴露 source repo flag). 必须用 `bkt api` 原生 REST + JSON body 写临时文件:

  ```bash
  # 1. 准备 JSON body (绝不带 reviewers 字段)
  cat > /tmp/pr-body.json <<EOF
  {
    "title": "<title>",
    "description": "<markdown, \\n 转义换行>",
    "state": "OPEN",
    "open": true,
    "closed": false,
    "fromRef": {
      "id": "refs/heads/<source-branch>",
      "repository": {
        "slug": "<repo-slug>",
        "project": { "key": "~<your-user>" }
      }
    },
    "toRef": {
      "id": "refs/heads/<target-branch>",
      "repository": {
        "slug": "<repo-slug>",
        "project": { "key": "<UPSTREAM-PROJECT>" }
      }
    }
  }
  EOF

  # 2. POST
  bkt api "/rest/api/1.0/projects/<UPSTREAM-PROJECT>/repos/<repo-slug>/pull-requests" \
    --method POST --input "$(cat /tmp/pr-body.json)"
  # 抓 PR id: grep -oE '"id":[0-9]+' | head -1

  # 3. 清理
  rm /tmp/pr-body.json
  ```

  ### Workflow A (单仓 / personal repo)

  `bkt pr create` 单仓直接用:

  ```bash
  bkt pr create --project '<project>' --repo '<repo>' \
    --source '<source-branch>' --target '<target-branch>' \
    --title "<title>" --description "$(cat <<'EOF'
  <body markdown 内容>
  EOF
  )"
  ```

  ## 覆盖 Step 6: 加 reviewer

  ### Workflow 检测

  - **Workflow A** (source repo project = `~<user>/`): 团队对 personal repo 无 read 权限, 加 reviewer 全 409 — **整段跳过 reviewer add**, cc 已在 description (Gate PR 已捕到列表)
  - **Workflow B** (source = `~<user>/`, target = upstream `<PROJECT>/`): 走批量 add

  ### Workflow B 批量 add

  ```bash
  bkt pr edit <pr-id> --project <UPSTREAM-PROJECT> --repo <repo> \
    --reviewer user1 --reviewer user2 --reviewer user3
  # 多个 --reviewer flag 单次调用 idempotent; 已是 reviewer 的回 warning + skip 不 fail
  ```

  ### 大小写 fallback (Workflow B 单个 409)

  扫批量 output 找单个 fail. bkt **大小写敏感** (e.g. `kerim.zhou` 实际 `Kerim.Zhou`):

  ```bash
  # 查 user API 拿精确大小写
  bkt api "/rest/api/1.0/users/<lowercase>" --json --jq '.name'
  # → 拿到 "Kerim.Zhou"
  # 用精确大小写 retry 单个
  bkt pr edit <pr-id> --project <UPSTREAM-PROJECT> --repo <repo> --reviewer Kerim.Zhou
  ```

  仍 fail (e.g. 该用户对 source repo 无 read 权限) → 跳过此 reviewer, log_missing, 不阻断后续.

  ## bkt 已沉淀的坑 (不要重撞)

  - **不要 `--field 'fromRef[repository][slug]=...'` 传嵌套 JSON** — bkt 把整个字符串当 flat key 名, 嵌套结构没解析. 必须用 `--input` 传完整 JSON
  - **不要用 `bkt api ... --method PUT` 改 PR 元数据** — Bitbucket PUT 是**全量替换**, 不带 `reviewers` 数组 → 已加的 reviewer 全清空. 改 title / description / reviewer 一律用 `bkt pr edit`, 它内部用细粒度 endpoint, 只动指定字段
  - **不要 create 时塞 `reviewers` 数组** — 单 user 错会让整个 PR 都建不出来. 拆"先建空 reviewer PR + 逐 edit 加" 更稳
  - **不要 pipe bkt api 输出给 jq** — output 含真实换行 (不是 JSON-escaped), pipe 给 jq 会 parse error. 抓 id 用 `grep -oE '"id":[0-9]+' | head -1`

  ## 项目本地特异内容不在本附录

  - reviewer 名单 (e.g. `imp / ju / Kerim.Zhou / North / rinoux`) — 留项目本地 `.agents-personal/rules/personal-repo-pr.md`
  - repo slug 历史 (e.g. `fx-data-nines` → `fx-data-agents` redirect) — 同上
  - 团队 default reviewer 规则 — 项目本地查询命令

  本附录只承担**通用 Bitbucket DC + bkt 工具栈**模式, 项目特异由项目本地 rule 承载.
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add rules/rule-references/rule-finishing-branch/pr-flow-bkt-appendix.md
  git commit -m "feat(rule): 加 finishing-branch pr-flow-bkt 附录 (沉淀 fx-data-agents 通用坑)"
  ```

---

## Task 5: 创建主门面 rules/rule-finishing-branch.md

**Files:**

- Create: `rules/rule-finishing-branch.md`

**Goal:** 门面 — 触发 + 4 选项菜单 + 子文件路由表 + 工具栈检测. 这是 agent 命中 catalog 触发后第一个 Read 的文件.

**Why Task 5 (not Task 1):** 门面引用 4 个子文件路径, 子文件先建好 (Task 1-4) 再写门面引用更稳, 避免 forward reference.

- [ ] **Step 1: 写文件内容**

  按 spec 影响表「rule-finishing-branch.md ①②③④⑤」要点 + spec 整体架构图 + 流程图 写. 内容骨架:

  ```markdown
  # superpowers:finishing-a-development-branch 行为覆盖 + 扩展

  执行 `superpowers:finishing-a-development-branch` skill 时, 本文规则覆盖 + 扩展 skill 内默认值. 若与 skill 内文冲突, **以本规则为准**.

  ## 触发

  - **即将执行** `superpowers:finishing-a-development-branch` skill (sp skill 内的自动调用)
  - 或用户说「完成 worktree / 收尾 / 合并 worktree / 提 PR / 创建 PR / 合并到 main / 合并到 release / 删 branch / discard worktree」, 中英文同义等价
  - **不触发**: 单纯问"我在哪个 branch / worktree 状态如何" (查询不进收尾流程)

  ## 整体流程 (覆盖 sp skill 4 选项菜单)

  ### Step 0 前置 — 工具栈检测 + skill overlay 启用 (BF0)

  ```bash
  MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
  remote_url=$(git -C "$MAIN_ROOT" remote get-url origin)
  ```

  按 remote_url 子串判 toolchain:
  - 含 `"bitbucket."` → `toolchain="bkt"`
  - 含 `"github.com"` → `toolchain="gh"`
  - 否则 (私域 git host) → **askUser** "工具栈不确定 (remote=<url>), 选 [gh / bkt / 跳过 PR]"

  Read `rule-references/rule-finishing-branch/skill-overlay.md` 加载覆盖关系.

  ### Step 1 verify tests (sp skill 已含, 不重复)

  失败 → hard stop, 不进菜单.

  ### Step 2 显示 4 选项菜单 (sp skill 默认文案, 不改)

  ```
  Implementation complete. What would you like to do?

  1. Merge back to <base-branch> locally
  2. Push and create a Pull Request
  3. Keep the branch as-is (I'll handle it later)
  4. Discard this work
  ```

  ### Step 3 按选项分发 (子文件路由表)

  | Option | 动作 | Read 子文件 (按需) |
  |---|---|---|
  | **1. Merge 回 base** | commit 整理 → Gate M → 本地 merge → cleanup | `commit-tidy.md` |
  | **2. Push + 建 PR** | commit 整理 → 生成 title/body → Gate TB → PR 计划 → Gate PR → push → 建 PR → reviewer | `commit-tidy.md`, `pr-flow-gh.md` (默认), 若 toolchain="bkt" 额外 `pr-flow-bkt-appendix.md` |
  | **3. Keep as-is** | 一行报告路径 | (无) |
  | **4. Discard** | 显示将删 → typed 'discard' Gate D → cleanup + force delete | (无, Gate D 在 sp skill 自带) |

  ## 4 Gate Summary

  | Gate | 在哪 | 内容 | 失败回路 |
  |---|---|---|---|
  | Gate M (Merge Plan) | option 1, commit 整理后 | "将 merge <branch> → <base>, 删 worktree <path>, 删 branch <name>" | 用户拒 → 回 4 选项菜单 |
  | Gate TB (Title/Body) | option 2, commit 整理后 | 草稿 title + 完整 body markdown | 用户改 → agent 重生成 → 再 Gate TB (循环) |
  | Gate PR (PR Plan) | option 2, Gate TB 后 | push remote + source→target + reviewer 列表 | 用户改任一字段 → 局部更新 → 再 Gate PR (不重生成 title/body) |
  | Gate D (Discard) | option 4 | "将删 branch + commits + worktree" | typed `discard` 字面 (非 yes/y/OK) → 才执行 |

  ## 不要

  - 不要重写 sp skill 4 选项菜单文案——本 rule 只覆盖 worktree provenance + option 2 占位符 + 工具栈假设 3 段, 其余原样
  - 不要假设 toolchain — 私域 git host 走 askUser, **不擅自归类为 gh**
  - 不要自动 force-push — non-ff 用户 typed `force` 字面才 `--force-with-lease`
  - 不要 `gh pr create` / `bkt api POST` 时塞 `--reviewer` / `reviewers` 字段 — 单 user 错会让 PR 都建不出来
  - 不要 `bkt api --method PUT` 改 PR 元数据 — PUT 全量替换会清 reviewer 数组
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add rules/rule-finishing-branch.md
  git commit -m "feat(rule): 加 finishing-branch 门面 (触发 + 4 选项菜单 + 子文件路由)"
  ```

---

## Task 6: 加 catalog 路由条目 + sanity check

**Files:**

- Modify: `model/agent-catalog.md`

**Goal:** 在 plugin 路由表加 `### finishing-branch` 条目, 让 agent 命中触发能找到门面 rule.

- [ ] **Step 1: Read 现有 catalog 末尾**

  ```bash
  tail -30 model/agent-catalog.md
  ```

- [ ] **Step 2: 加新条目 (放 `### git-inspection` 之后, `## 维护` 之前)**

  ```markdown
  ### finishing-branch
  **触发**: 即将执行 `superpowers:finishing-a-development-branch` skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 删 branch」
  **读**: `rules/rule-finishing-branch.md`
  **摘要**: 覆盖 + 扩展 superpowers skill, 4 选项 (merge/PR/keep/discard) 各自含 commit 整理建议; option 2 含 4 个 Gate (M/TB/PR/D), gh 主, Bitbucket DC 项目按需读 bkt 附录
  ```

- [ ] **Step 3: 跑 inject-rules.sh sanity check, 确认无 WARN**

  ```bash
  bash hooks/inject-rules.sh model 2>&1 | grep WARN
  # 期望: 无输出 (没有孤儿 rule, 没有未引用文件)
  ```

  若有 WARN — 检查:
  - 新 rule 文件名拼写跟 catalog 条目里 `**读**:` 路径一致
  - 子文件没误放在 `rules/*.md` (子文件应该全在 `rules/rule-references/rule-finishing-branch/` 下)

- [ ] **Step 4: Commit**

  ```bash
  git add model/agent-catalog.md
  git commit -m "feat(model): catalog 加 finishing-branch 路由条目"
  ```

---

## Task 7: bump plugin.json version

**Files:**

- Modify: `.claude-plugin/plugin.json`

**Goal:** version 1.1.x → 1.2.0 (minor: 新增 rule + 兼容性增强, per spec 部署节).

- [ ] **Step 1: Read 当前 version**

  ```bash
  grep version .claude-plugin/plugin.json
  # 当前是 1.1.1 或 1.1.2 (主仓可能并行改过), 看实际值
  ```

- [ ] **Step 2: Edit version 字段**

  ```bash
  # 用 jq 或手动 Edit
  sed -i.bak 's/"version": "1\.1\.[0-9]*"/"version": "1.2.0"/' .claude-plugin/plugin.json
  rm .claude-plugin/plugin.json.bak
  cat .claude-plugin/plugin.json | head -10
  ```

- [ ] **Step 3: Commit (合并 catalog + plugin.json 改动 OR 独立 commit)**

  独立 commit 更清晰:

  ```bash
  git add .claude-plugin/plugin.json
  git commit -m "chore(version): bump 1.1.x → 1.2.0 (minor: 新 finishing-branch rule + 子文件)"
  ```

---

## Task 8: Acceptance scenarios 实跑验证

**Files:** 无修改, 输出记录到 design doc Review Log.

**Goal:** 在 3 个项目环境实跑 spec《单测设计》节列出的关键 case, 验证 plugin 实际工作.

- [ ] **Step 1: nocode-evolve (本仓库 GitHub 路径)**
  - case 0.1 (GitHub 检测): 在 main checkout 跑 `git -C $PWD remote get-url origin`, 应含 `github.com`, BF0 应返 `gh`
  - case 1.1 (option 1 主路径): 创个空 commit branch, 走 `superpowers:finishing-a-development-branch` skill 选 option 1, 应 cd MAIN_ROOT → merge → cleanup worktree
  - case 4.1 (option 4 typed discard): 创个 branch, 走 skill 选 option 4, 输入 `discard` 字面应删 worktree + force delete branch
  - case provenance.1 (平级 worktree 识别): 创个 `<project>-test_xyz/` 平级 worktree, option 1/4 应识别并清理

- [ ] **Step 2: fx-data-agents (Bitbucket DC 路径)**
  - case 0.2 (Bitbucket DC 检测): 在 fx-data-agents 跑, BF0 应返 `bkt`
  - case 2.2 (cross-fork Workflow B): 走 option 2, 应读 bkt 附录, Gate PR 显示 cross-fork source→target
  - case 2.2b (Workflow A 跳 reviewer add): 创个 source = target = `~harrison/` 的 PR, 应跳整段 reviewer add
  - case 2.6 (大小写 fallback): reviewer 列表加 lowercase `kerim.zhou`, 应 retry 到 `Kerim.Zhou` 成功

- [ ] **Step 3: 私域 git host 项目 (若用户有)**
  - case 0.3: origin url 非 github / bitbucket, BF0 应触发 askUser, 不自动归 gh

- [ ] **Step 4: 失败的 case 记录到 design doc Review Log**

  按 spec《部署 → Acceptance 验证》节末"acceptance scenarios 失败 → 在本文档末尾 Review Log 标记实际 issue" 操作.

- [ ] **Step 5: Commit acceptance log**

  ```bash
  git add docs/plans/3dot141/260522-git-collab-finishing-branch-design.md
  git commit -m "docs(plan): 260522 finishing-branch acceptance 实跑结果"
  ```

---

## Self-Review Checklist (实施完毕跑一遍)

- [ ] spec 「实现.影响」表 5 个 NEW 文件全部创建 (Task 1-5)
- [ ] spec 「实现.影响」表 2 个改文件 (catalog / plugin.json) 完成 (Task 6/7)
- [ ] sanity check `bash hooks/inject-rules.sh model` 无 WARN
- [ ] 4 个 Gate (M / TB / PR / D) 都在 plan 任一文件中明确实现
- [ ] BF2 batch reviewer add 行为 = Task 0 实测决策的版本 (假设成立 → 当前设计, 不成立 → 修订后)
- [ ] acceptance scenarios (Task 8) 至少在 nocode-evolve + fx-data-agents 两个项目跑过
- [ ] design doc Review Log 末尾追加 implementation 段, 记录实测发现 (若有)

---

## 注意事项

- **Task 0 是 blocking dependency**: 不通过 Task 0 直接进 Task 4 写 pr-flow-bkt-appendix.md 风险高 — 假设错的设计无法工作
- **Worktree 隔离**: 本 plan 跑在 worktree `nocode-evolve-design_git-collab-finishing-branch/`, 改动不污染主仓 main. 完成后走 `superpowers:finishing-a-development-branch` (本设计自己实现的) 把 worktree 合回 main 或建 PR — **dogfood**
- **HTML 不动**: design doc 改了的话 (Task 0 / Task 8 acceptance 结果记录), HTML 是派生物 (`docs/plans/**/*.html` gitignored), 实施时**不重 render**; 真要更新展示版用户主动跑 `nocode-evolve:design-doc-rendering`
- **plugin.json version commit 时机**: 等所有 rule 文件都 ok 再 bump, 不在每个 task 都 bump (per 本仓 CLAUDE.md "改动了被插件加载的文件就视为插件更新, 必须更新版本" — 但允许多个 task 合一次 version bump)

---

> Plan v1, 260522. 待 Task 0 实测结果可能修订 Task 4 内容. 实施者按 self-review checklist 验完即可标 plan completed.
