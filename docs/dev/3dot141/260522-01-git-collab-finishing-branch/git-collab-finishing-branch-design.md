---
type: design-doc
topic: git 协作端到端链 — worktree 收尾 + PR 创建, 4 Gate 守关, 渐进式 rule 加载
date: 260522
author: 3dot141
status: draft
last_updated: 260522
---

# Design Doc: git 协作端到端链 — worktree 收尾 + PR 创建

## 背景

**核心问题**: plugin 缺"worktree 工作完成后怎么收尾"的通用规则——commit 已落, push 是否要走, 走了 push 要不要建 PR, 建 PR 要不要查 reviewer, 工具是 gh 还是 bkt, 这条链路在 plugin 层没有 single source. 每个项目要么从零写 (fx-data-server `pr-create.md` 是 0 字节 placeholder), 要么把通用模式跟项目特异内容混堆 (fx-data-agents `personal-repo-pr.md` 235 行, 90% 是项目特异——reviewer 名单 / slug 历史 / Bitbucket DC 特定 API).

具体痛点:

- **fx-data-server `.agents-personal/rules/pr-create.md` 0 字节** + `AGENTS.md` 空文件——文件名占位但内容缺失, agent 命中触发也读不到指令
- **fx-data-agents `personal-repo-pr.md`** 235 行里 90% 是 Bitbucket DC + bkt CLI + fork 拓扑 + reviewer 名单 (项目特异), 通用模式 (PUT 全量替换坑 / reviewer 大小写 fallback / create 时不塞 reviewers) 没上提到 plugin
- **plugin `rules/rule-push-summary.md`** 已定义"push 后总结"输出格式 (≤200 字, 基础内容 + 重点评测), 但跟"建 PR title/body" 概念重叠**没串联**——用户每次提 PR 都要手动 copy
- **superpowers `finishing-a-development-branch` skill** 已提供 4 选项菜单 (merge / push+PR / keep / discard), 但 worktree provenance check 走 `.worktrees/` 等老路径, **跟 plugin `rule-git-worktree.md` 推翻后的 `<project>-<branch_flat>/` 扁平模式不识别**, option 1/4 cleanup 会把我们的 worktree 误判为 "harness-owned" 不清理

**附带问题** (本 doc 一并解): 用户提 PR 前缺 "commit 整理建议" 节点 (squash / fixup / reword), agent 没有触发条件知道什么时候建议; 跨 fork PR (Bitbucket fork pattern 或 GitHub fork-based contribution) 的 source→target 容易错配, 没显式 gate 确认.

不解决的代价: 新项目接入 git 协作要么自己重写 235 行 rule, 要么忍受 placeholder 状态; superpowers skill 在我们 worktree 模式下行为不一致, 用户每次撞同样的坑.

## 目标

- **plugin level 一条 rule 链覆盖 worktree 工作完成后的 4 个 disposition** (merge / push+PR / keep / discard), 不重写 superpowers `finishing-a-development-branch` skill, 只精确覆盖 + 扩展 (照 `rule-git-worktree.md` 的"覆盖关系表"模式)
- **rule 渐进式加载**: 主门面常驻短小 (~80 行), 子文件按需 Read (option 3/4 路径只读门面; option 2 GitHub 项目读门面 + 2-3 子文件; option 2 Bitbucket DC 项目额外读 1 个附录)
- **4 个 Gate 显式守关**: Merge Plan / Title-Body / PR Plan / Discard, 不让 agent 自作主张 push / 建 PR / 删 worktree
- **fx-data-agents 已踩坑沉淀**到 plugin 通用模式 (PUT 全量替换坑 / reviewer 大小写 fallback / create 时不塞 reviewers / cross-fork bkt CLI 不支持), 新项目零成本继承
- **跟现有 rule 协作不冲突**: `rule-push-summary.md` 输出契约被子文件**引用**而非复制; `rule-git-worktree.md` 创建端不动, 收尾端新增

## 架构

### 架构图

rule 文件依赖关系 (实线表示"门面路由到子文件", 虚线表示"子文件引用其他 rule"):

```
                       ┌──────────────────────────────────────┐
                       │ model/agent-catalog.md               │
                       │  (路由表: 新增 finishing-branch 条目) │
                       └──────────────┬───────────────────────┘
                                      │ 命中触发
                                      ▼
                  ┌────────────────────────────────────────┐
                  │ rules/rule-finishing-branch.md (门面)   │
                  │   触发 / 4 选项菜单 / 工具栈检测       │
                  │   子文件路由表 (按 option 按需 Read)    │
                  └─────┬──────────┬──────────┬────────────┘
                        │          │          │
                        ▼          ▼          ▼
       rule-references/rule-finishing-branch/
       ┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐
       │ skill-overlay.md │  │ commit-tidy  │  │ pr-flow-gh.md      │
       │ (跟 sp skill     │  │ .md          │  │ (option 2 GitHub   │
       │  覆盖关系)       │  │ (option 1+2  │  │  全流程, 4 Gate)   │
       └──────────────────┘  │  共用)       │  └─────────┬──────────┘
                             └──────────────┘            │
                                                         ▼ 覆盖 PR/reviewer 段
                                              ┌──────────────────────────┐
                                              │ pr-flow-bkt-appendix.md  │
                                              │ (Bitbucket DC bkt 替代)  │
                                              └──────────────────────────┘

                ┌─ 引用 (不复制) ────┐
                │                    │
                ▼                    ▼
       rules/rule-push-summary.md (已有, 不动)
       rules/rule-git-worktree.md  (已有, 不动)
```

### 流程图

`finishing-a-development-branch` 整体流, 标出 4 个 Gate 位置:

```
[用户触发: 完成 / 收尾 / 提 PR] → tests pass? ──no──→ stop
                                       │ yes
                                       ▼
                              [skill 4 选项菜单]
                                       │
       ┌───────────────────────────────┼──────────────────────────────┐
       │                  │            │                              │
       ▼ 1. merge         ▼ 2. push+PR ▼ 3. keep                      ▼ 4. discard
   commit-tidy         commit-tidy     报告路径                    显示将删
   (agent 建议)        (agent 建议)         结束                         │
       │                  │                                              ▼
   merge 计划         生成 title+body                              [Gate D: typed
       │                  │                                        'discard'?]
   [Gate M: 确认?]   [Gate TB: OK?]                                     │
       │                  │                                        cleanup+delete
   merge+cleanup      PR 计划 (push/                                
                      source→target/
                      reviewer)
                          │
                      [Gate PR: OK?]
                          │
                      push→建PR→reviewer
```

option 2 的 reviewer 处理子流程 (展开 gh 默认; bkt 附录在 BF2 异常分支说明):

```
查 default reviewer ──→ 用户在 Gate PR 修订 reviewer 列表 ──→ 批量 add
       │                                                          │
       │                                                          ▼
       │                                              成功? ──yes──→ 完成
       │                                                 no (409)
       │                                                  │
       │                                                  ▼
       └────────────────────── bkt 项目: 大小写 fallback (查 user API .name)
                                              │
                                              ▼
                                          仍 fail? ─→ 跳过此 reviewer, 报告漏哪几个
```

### 文本总结

整体架构: plugin `rules/` 下新增**一个门面 rule** + **一个 `rule-references/` 子目录** (4 子文件), 配合 `model/agent-catalog.md` 路由条目和 `inject-rules.sh` 现有 sanity check 机制 (该 sanity check 只扫顶层 `rules/*.md`, 不递归子目录, 子文件自动免 catalog 路由检查). 关键架构决策: 主门面常驻短小 (触发判定 + 4 选项菜单 + 子文件路由表), 真实指令分散到 4 个子文件按 disposition 按需 Read——不同路径用户的 token 消耗差异化, option 3/4 用户只读门面 (~80 行), option 2 GitHub 用户读门面 + 3 子文件 (~290 行), option 2 Bitbucket DC 用户额外读 bkt 附录 (~360 行). 关键约束: 不重写 superpowers `finishing-a-development-branch` skill, `skill-overlay.md` 只精确覆盖 3 段 (worktree provenance / option 2 占位符 / option 2 单 gh 假设), 保留 skill 大部分行为 (4 选项菜单 / tests verify / base 检测 / typed discard 确认).

下一节展开各文件改动 + rule 文件契约 + 4 个核心 BF 业务流 + 异常表 + acceptance scenarios.

## 实现

### 影响

```
nocode-evolve/
├── rules/
│   ├── rule-finishing-branch.md                          (NEW)  门面 ~80 行
│   │                                                              ① 触发条件 (含"即将执行 sp skill"+"用户说收尾...")
│   │                                                              ② 4 选项菜单 (照 skill 默认, 不重写文案)
│   │                                                              ③ 子文件路由表 (按 option 列必读子文件)
│   │                                                              ④ 工具栈检测 (主仓 remote URL 探测 bitbucket vs github)
│   │                                                              ⑤ 反例 list (典型用法错)
│   ├── rule-references/                                   (NEW)  rule 子文件目录, sanity check 不扫
│   │                                                              ⚠️ invariant: 依赖 hooks/inject-rules.sh:56
│   │                                                                 非递归 glob "${PLUGIN_ROOT}/rules/*.md".
│   │                                                                 未来若改递归则本目录会被扫为孤儿 rule,
│   │                                                                 须同步改 hook 或迁路径
│   │   └── rule-finishing-branch/                         (NEW)
│   │       ├── skill-overlay.md                           (NEW)  ~40 行: 跟 sp skill 覆盖关系大表
│   │       │                                                       ① 推翻 worktree provenance check
│   │       │                                                       ② 推翻 option 2 占位符 title/body
│   │       │                                                       ③ 推翻 option 2 单 gh 假设
│   │       │                                                       ④ 保留段明确列出
│   │       ├── commit-tidy.md                             (NEW)  ~50 行: option 1+2 共用
│   │       │                                                       ① agent 看 push range 内 commit
│   │       │                                                       ② squash 判定规则: 连续 ≥2 个 commit message
│   │       │                                                          含 `wip|tmp|fixup|fix typo` 关键字 → 建议 squash;
│   │       │                                                          其他场景默认建议 reword (不强制)
│   │       │                                                       ③ 列建议 + 完整命令 (git rebase -i --autosquash /
│   │       │                                                          git commit --fixup)
│   │       │                                                       ④ 反例 (不自动跑 / 不强迫 squash)
│   │       ├── pr-flow-gh.md                              (NEW)  ~120 行: option 2 gh 全流程
│   │       │                                                       ① title/body 生成 (引用 rule-push-summary 输出契约)
│   │       │                                                       ② Gate TB 模板
│   │       │                                                       ③ PR 计划构建 (push/source→target/reviewer)
│   │       │                                                       ④ Gate PR 模板
│   │       │                                                       ⑤ gh pr create 命令 + body HEREDOC
│   │       │                                                       ⑥ gh pr edit --add-reviewer 命令
│   │       │                                                       ⑦ reviewer 通用 anti-pattern (不在 create 时塞)
│   │       └── pr-flow-bkt-appendix.md                    (NEW)  ~70 行: Bitbucket DC 覆盖 pr-flow-gh 的 PR+reviewer 段
│   │                                                              ① cross-fork 用 bkt api 原生 REST (bkt CLI 不支持)
│   │                                                              ② JSON body 写临时文件 (避免 shell quote 地狱)
│   │                                                              ③ PUT 全量替换坑 (改元数据用 bkt pr edit 不用 PUT)
│   │                                                              ④ reviewer 大小写 fallback (查 /users/<lower> 拿 .name)
│   │                                                              ⑤ create 时不塞 reviewers (单 user 错全 fail)
│   │   (已有, 不动)
│   ├── rule-push-summary.md                                      pr-flow-gh.md 在 title/body 生成步引用其输出契约
│   ├── rule-git-worktree.md                                       skill-overlay.md 跨引用其平级路径模式
│   ├── rule-superpowers-brainstorming.md
│   └── rule-git-inspection.md
├── model/
│   └── agent-catalog.md                                   (改)   新增 `### finishing-branch` 路由条目
│                                                                  (完整 markdown 见《接口设计.内部接口》节末; 此处不重复
│                                                                   防漂移. 摘要必含: 4 选项 / 4 Gate (M/TB/PR/D) /
│                                                                   gh 主 bkt 附录 / 渐进式子文件)
└── .claude-plugin/
    └── plugin.json                                        (改)   version 1.1.1 → 1.2.0 (minor: 新 agent/skill 级行为)
```

不动:
- `hooks/inject-rules.sh` — sanity check 已不递归扫子目录, 子文件自动免检查; 不改动
- `rules/rule-push-summary.md` — 子文件**引用**其输出契约, 不复制不覆盖
- `rules/rule-git-worktree.md` — 创建端 rule, 收尾端 (本设计) 是另一个独立 rule
- fx-data-agents `.agents-personal/rules/personal-repo-pr.md` — 项目本地特异 (reviewer 名单 / slug 历史) 保留, plugin level 通用模式新增不取代

### 接口设计

本 doc 设计 rule 文档协作, 不涉及 HTTP API / DB schema; 内部接口指**每个 rule 文件的契约** (触发条件 + 输入假设 + 输出动作).

#### 内部接口 (rule 文件契约)

> 「前置条件」 = 进入此文件的状态前提; 「触发」 已在 catalog 路由表 (`model/agent-catalog.md`) 定义, 不在子文件契约重复以防漂移.

| 文件 | 前置条件 / 进入状态 | 输入假设 | 输出动作 |
|---|---|---|---|
| 门面 `rule-finishing-branch.md` | catalog 路由触发后进入 | 当前位于 worktree 或主仓, tests 已通过 | 选 4 disposition 之一; 路由到子文件; 显式工具栈检测结果 |
| `skill-overlay.md` | 已 Read 门面, 进入 4 选项流程 | 知道当前 worktree 路径模式 | skill 默认行为按 overlay 表执行 (推翻 3 段, 保留其余) |
| `commit-tidy.md` | 选 option 1 或 2 后, 进入 commit 整理子步 | git log 可读, branch 已知 | agent 给 squash/fixup/reword 建议 + 命令; 不交互 rebase |
| `pr-flow-gh.md` | 选 option 2, 工具栈 = gh (默认或私域 user 显式确认) | gh CLI 可用 | 走 title/body→Gate TB→PR 计划→Gate PR→push+create+reviewer; 每 gate 输出待用户响应 |
| `pr-flow-bkt-appendix.md` | 选 option 2, 工具栈 = bkt | `bkt` subcommand (`pr create`/`pr edit`) + `bkt api` REST passthrough 任一可用 (subcommand 优先, REST 用于 cross-fork) | 替换 pr-flow-gh 的 "建 PR" + "加 reviewer" 段为 bkt 命令 + cross-fork JSON body |

完整 catalog 条目 markdown (复制即用):

```markdown
### finishing-branch
**触发**: 即将执行 `superpowers:finishing-a-development-branch` skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 删 branch」
**读**: `rules/rule-finishing-branch.md`
**摘要**: 覆盖 + 扩展 superpowers skill, 4 选项 (merge/PR/keep/discard) 各自含 commit 整理建议; option 2 含 4 个 Gate (M/TB/PR/D), gh 主, Bitbucket DC 项目按需读 bkt 附录
```

### 业务流

按 option 拆 4 条主 BF + 1 条共用 BF0 (工具栈检测).

**BF0 — 工具栈检测 + skill overlay 启用** (4 个 option 共用前置)

```
function detectToolchainAndOverlay():                              // 主入口: 进入 finishing 流程前置
    MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
                                                                   // shell 标准写法, 照搬 sp SKILL.md:101 模式
    remote_url = $(git -C "$MAIN_ROOT" remote get-url origin)      // 探主仓 origin URL
    if remote_url 含通用子串 "bitbucket.":                          // Bitbucket 通用域名特征 (cloud + 自建 DC)
        toolchain = "bkt"                                          // 后续 option 2 走 bkt 附录
    elif remote_url 含 "github.com":                                // GitHub 显式匹配 (云 + GHE 含 github 子串)
        toolchain = "gh"                                           // 后续 option 2 走 gh 主流程
    else:                                                          // 私域 git host (GitLab self-hosted /
                                                                   //  Gitea / 公司内部仓库, 等等)
        toolchain = askUser(                                       // 不自动假定, 让用户显式确认
            "工具栈不确定 (remote=" + remote_url + "), 选 [gh / bkt / 跳过 PR]:")
    Read("rules/rule-references/rule-finishing-branch/skill-overlay.md")
                                                                   // overlay 修正 worktree provenance 识别
                                                                   // 加 <project>-<branch_flat>/ 模式进 cleanup 表
    return toolchain                                               // 工具栈结果, 用于 BF2 子流程分支
```

> 注: BF0 伪代码里 shell-style 命令 (`MAIN_ROOT=$(...)` / `$(git ...)`) 是真实可执行写法 (照搬 superpowers `finishing-a-development-branch` SKILL.md:101 模式); 业务流的 control flow (`if`/`elif`/`else`/`含`) 仅设计意图示意, 实际 implementation 由 `rule-references/` 子文件给出具体 bash. v1 仅覆盖 `gh` + `bkt` 两个工具栈, 详见方案选型 Q3 边界声明.

**BF1 — Option 1: Merge 回 base 分支**

```
function executeOptionMerge(base_branch):                          // 主入口: 用户选 option 1 后执行
    Read("rules/rule-references/rule-finishing-branch/commit-tidy.md")
                                                                   // 加载 commit 整理建议指令
    commits = list_commits_in_range(base_branch + ".." + HEAD)     // 列从 base 分叉以来的 commit
    suggestions = analyzeCommits(commits)                          // 给 squash/fixup/reword 建议
                                                                   // (e.g. "3 个 WIP 建议 squash 合一; commit 4 message 不规范建议 reword")
    presentToUser(suggestions, "复制运行下列命令再回来:")            // agent 给完整 rebase / fixup 命令
                                                                   // 用户自跑或跳过, agent 不交互 rebase
    waitForUserSignal("已整理 / 跳过")                              // 用户主动说"好了"再进 merge 计划

    plan = buildMergePlan(base_branch, HEAD, worktree_path)        // 构 merge 计划字符串:
                                                                   //   "将 merge <branch> → <base>; 删 worktree <path>; 删 branch"
    if not askGate("Gate M: 上述计划确认?", plan):                  // Gate M: 显示完整计划, 用户 OK 才执行
        return goto_menu                                           // 用户改主意, 回菜单

    cd main_root                                                   // 关键: cd 必须在主仓再 merge
                                                                   //  (sp skill 已含, overlay 强调)
    git checkout base_branch && git pull && git merge HEAD@{1}     // 执行 merge
    runTests()                                                     // verify 合并后 tests 仍通过
    if testFail: report_and_stop                                   // 不 cleanup, 让用户解决

    cleanupWorktree(worktree_path)                                 // overlay 修正后: 识别 <project>-<branch_flat>/ 并 remove
    git branch -d feature_branch                                   // 删 branch (-d 非 force, 已 merge 才允许)
```

**BF2 — Option 2: Push + 创建 PR** (本设计核心 BF, 含 4 Gate)

```
function executeOptionPushAndPR(base_branch, toolchain):           // 主入口: 用户选 option 2 后执行
    Read("rules/rule-references/rule-finishing-branch/commit-tidy.md")
    commits = list_commits_in_range(base_branch + ".." + HEAD)
    suggestions = analyzeCommits(commits)                          // 同 BF1 commit 整理建议
    presentToUser(suggestions)                                     // 用户自跑或跳过
    waitForUserSignal()                                            // 等用户说"好了"

    Read("rules/rule-references/rule-finishing-branch/pr-flow-gh.md")
                                                                   // 加载 gh 主流程指令
    if toolchain == "bkt":                                         // BF0 检测结果
        Read("rules/rule-references/rule-finishing-branch/pr-flow-bkt-appendix.md")
                                                                   // 附加 bkt 命令 + cross-fork 模式

    title_body = generateTitleBody(commits)                        // 调 push-summary 输出格式
                                                                   //  (引用 rule-push-summary 契约: 标题 ≤50 字
                                                                   //   + 描述 ≤200 字, 含基础内容+重点评测)
    while not askGate("Gate TB: title/body OK?", title_body):       // Gate TB: 用户改内容内联回环
        title_body = applyUserEdit(title_body, user_input)         // 用户给修改意见, agent 重生成

    pr_plan = buildPRPlan(                                          // 构 PR 计划元数据:
        push_remote = "origin",                                     //  push: origin/<branch>
        push_branch = HEAD_branch,                                  //  PR: <source-repo>:<source-branch>
        source_repo = inferFromRemote(),                            //       → <target-repo>:<target-branch>
        target_repo = pickTargetRepo(toolchain),                    //  fork 项目 (bkt) 默认上游, 单仓默认同 repo
        target_branch = base_branch,                                //  reviewer: <list> (含 default reviewer)
        reviewers = queryDefaultReviewers(toolchain, target_repo)   // 查 default reviewer (gh: branch rules; bkt: REST)
    )
    while not askGate("Gate PR: 计划 OK?", pr_plan):                 // Gate PR: 用户可改 target/reviewer 任一字段
        pr_plan = applyUserEdit(pr_plan, user_input)               // 局部更新计划, 不重生成 title/body

    try:
        git push -u origin HEAD                                     // 先 push branch 到 origin (永不自动 --force)
    catch PushFail as e:                                            // no permission / non-ff / branch 占用
        report(e.reason)                                            // 报错因, worktree 保留不动
        if e.is_non_fast_forward:                                   // history 改了想覆写 = non-ff
            promptUser("non-fast-forward, 是否 force-push?",        // 不自动 --force, 让用户显式
                       "回 'force' 字面我才 git push --force-with-lease")
        return                                                      // 不进 PR 阶段; 用户 force 后从此步重跑

    if toolchain == "gh":
        pr_id = gh pr create --title <t> --body <b> --base <target_branch>
                                                                    // 不带 --reviewer (留单独加, 防单 user 错整体 fail)
    else:  // bkt
        pr_id = bktPRCreate(pr_plan)                                // 写 /tmp/pr-body.json + bkt api POST
                                                                    //  (绝不带 reviewers 字段! 单 user 错会让 PR 都建不出来)
    if create_fail: report_and_stop                                 // worktree 保留, 用户从这步重跑

    // === reviewer add: workflow 检测 + batch + 单个 fallback ===
    workflow = detectWorkflow(source_repo, target_repo)             // A: source = target (单仓 / personal repo)
                                                                    // B: source ≠ target (跨 fork)
    if workflow == "A" and toolchain == "bkt":                      // bkt personal repo 已知坑:
                                                                    //  团队对 ~user/ 无 read 权限, 加 reviewer 全 409
        skip_reviewer_add()                                         // 跳整段, cc 已在 description (Gate PR 已写)
        report("personal repo 不支持 reviewer 字段, 已 cc 到 description")
    else:                                                           // Workflow B 或 gh: 走批量 add
        try:
            addReviewersBatch(pr_id, pr_plan.reviewers, toolchain)  // 一次 API call multi-flag
                                                                    //  (gh: gh pr edit --add-reviewer x,y,z)
                                                                    //  (bkt: bkt pr edit --reviewer x --reviewer y, idempotent)
                                                                    // bkt 已在 reviewer 的回 warning + skip 不 fail 整体命令
        catch BatchFail as e:                                       // 批量层 fail (整体 fail, e.g. rate limit / auth)
            report_and_stop                                         // 上抛, 不 retry
        // 批量成功 ≠ 每 reviewer 都成功
        for reviewer in extractFailedFromBatchOutput():             // 扫批量 output 找单个 fail 的
            if toolchain == "bkt" and is_409_case_sensitivity:      // bkt 大小写错: 查 user API 修正
                fixed = lookupCaseSensitive(reviewer)               // GET /users/<lowercase>, 拿 .name 精确大小写
                try addReviewer(pr_id, fixed)                       // retry 单个一次
            // 仍 fail (e.g. 无 read 权限) → 跳过, 不阻断后续
            log_missing(reviewer)
        reportMissing(pr_id, skipped_reviewers)                     // 最后报告漏哪几个
```

**BF3 — Option 3: Keep as-is** (skill 默认行为, 不改)

```
function executeOptionKeep():                                       // 主入口: 用户选 option 3
    report("Keeping branch <name>. Worktree preserved at <path>.")  // 一行报告, 不 cleanup, 不删 branch
                                                                    // 不需要任何 gate (无破坏性动作)
```

**BF4 — Option 4: Discard** (skill 自带 typed 'discard' Gate)

```
function executeOptionDiscard():                                    // 主入口: 用户选 option 4
    plan = buildDiscardPlan(branch, worktree_path, commits)         // 列将删: branch / commits / worktree
    if not askGate("Gate D: 输入 'discard' 字面确认", plan):         // Gate D: typed 'discard' 而非 yes/no
        return goto_menu                                            // 任何其他响应 (含 'yes' 'OK' 'y') 都算否定

    cd main_root                                                    // cd 主仓再删 (overlay 强调)
    cleanupWorktree(worktree_path)                                  // 识别 <project>-<branch_flat>/ 并 remove
    git branch -D feature_branch                                    // -D force 删 (commits 也丢)
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| 共享 (前置) | TestsFailBeforeMenu | skill Step 1 baseline tests 失败 | hard stop, 不进 4 选项菜单 | 上抛 (sp skill 自带) |
| BF1 | MergeConflict | git merge 冲突 | 不 cleanup, 不删 branch, worktree 保留待用户解决 | 上抛 (人工介入) |
| BF1 | TestFailAfterMerge | merge 后 tests 失败 | 不 cleanup, 不删 branch, 报告 fail | 上抛 |
| BF1 | CleanupWorktreeFail | git worktree remove 拒绝 | 报错因, 不强删, 不删 branch | 上抛 |
| BF2 | PushFail (一般) | no permission / branch 被占用 | 报错因, **不进** PR 阶段, worktree 保留 | 上抛 |
| BF2 | PushFail (non-ff) | history 改过想覆写 | **禁止自动 --force**; promptUser 让用户 typed `force` 字面才跑 `git push --force-with-lease` | 上抛 (待用户决定) |
| BF2 | PRCreateFail | gh/bkt 创建 PR 失败 (rate limit / JSON body 错 / fork 关系错配) | 报错因, **不 retry**, worktree 保留待用户从此步重跑 | 上抛 |
| BF2 | ReviewerAdd Workflow A (bkt) | source = `~user/` personal repo, 团队成员无 read 权限 | **整段跳过 reviewer add**, cc 已在 description (Gate PR 已捕到列表) | 单条吞, 整体不上抛 |
| BF2 | ReviewerAdd409 (gh) | gh 加 reviewer 失败 (user 无 read 权限) | 跳过此 reviewer, 继续加其他, 最后报告漏哪几个 | 单条吞, 整体不上抛 |
| BF2 | ReviewerAdd409 大小写 (bkt, Workflow B) | bkt 大小写敏感 (e.g. `kerim.zhou` 实际 `Kerim.Zhou`) | 查 `/users/<lowercase>` 拿 `.name` 修正 retry; 仍失败跳过 | 单条吞, 整体不上抛 |
| BF2 | TitleBodyGenFail | rule-push-summary 输出契约不符 (commit range 异常 / 无 commit) | fallback 简单模板: 最后一个 commit subject + 一行"包含 N commit" | 吞 (用 fallback) |
| BF2 | CrossForkInferenceFail (bkt) | source/target repo 推断失败 (主仓 remote URL 不规范) | Gate PR 显示空字段, 让用户手填 source/target | 吞 |
| BF4 | TypedDiscardMismatch | 用户没 typed 'discard' 字面 | 不删任何东西, 返回菜单 | 吞 (sp skill 自带) |
| BF4 | CleanupWorktreeFail | git worktree remove 拒绝 (含 in-use lock) | 报错因, 不 force 删 | 上抛 |
| 共享 | WorktreeProvenanceMismatch | worktree 路径既不是 `.worktrees/` 也不是 `<project>-<branch_flat>/` | 按 sp skill 默认 (treat as harness-owned, 不清理), 但**报告路径让用户决定** | 吞 (skill 默认行为) |

### 单测设计

本 doc 输出物是 rule 文档, 不是代码; "单测"形态为 **acceptance scenarios** — 在不同项目设置下走流程, 验证 rule 触发 / 子文件 read / Gate 行为 / 命令模板 / 异常处理.

**BF0 — 工具栈检测**

- **case 0.1 GitHub 项目检测**
  - Given: 当前主仓 origin URL = `https://github.com/3dot141/nocode-evolve.git`
  - When: BF0 执行
  - Then: toolchain = "gh", overlay 加载, 不读 bkt 附录

- **case 0.2 Bitbucket DC 项目检测**
  - Given: 当前主仓 origin URL = `ssh://git@code.fineres.com:7999/~harrison/fx-data-agents.git`
  - When: BF0 执行
  - Then: toolchain = "bkt", overlay 加载, BF2 触发时会读 bkt 附录

- **case 0.3 私有 git URL 不匹配**
  - Given: origin URL = `ssh://git@private.corp.com/team/repo.git`
  - When: BF0 执行
  - Then: toolchain = "gh" (默认), 不读 bkt 附录

**BF1 — Option 1 Merge 回 base**

- **case 1.1 主路径**
  - Given: branch 含 3 commit, 都已与 main rebase 干净, tests pass
  - When: 用户选 option 1, 跳过 commit 整理, Gate M 确认
  - Then: cd main_root → checkout base → pull → merge → tests pass → worktree removed → branch deleted

- **case 1.2 commit 整理走完**
  - Given: branch 含 4 commit, 其中 3 个是 "wip" 系列
  - When: 用户选 option 1, agent 建议 squash 3 个 wip → 1 个; 用户自跑 `git rebase -i --autosquash HEAD~4`; 回来说"好了"
  - Then: commits 数 4→2, 进入 Gate M

- **case 1.3 merge conflict 异常**
  - Given: base 与 worktree branch 有冲突
  - When: BF1 主路径执行到 `git merge`
  - Then: merge fail, **不 cleanup**, 不删 branch, 报告冲突文件让用户解决

**BF2 — Option 2 Push + PR** (核心)

- **case 2.1 主路径 GitHub**
  - Given: nocode-evolve 项目, branch `feature/foo` 含 2 commit, push-summary 输出 OK, Gate TB / Gate PR 用户都 OK
  - When: 走完 BF2
  - Then: 不读 bkt 附录; gh pr create 成功; gh 加 reviewer 成功; 报告 PR URL

- **case 2.2 主路径 Bitbucket DC cross-fork (Workflow B)**
  - Given: fx-data-agents 项目, 当前 worktree branch 在 `~harrison/fx-data-agents`, target `FXDATA/fx-data-agents:release`
  - When: 走完 BF2
  - Then: 读 bkt 附录; Gate PR 显示 source `~harrison:<branch>` → target `FXDATA:release`; 用 `bkt api` POST + JSON body 创建 (body 绝不含 reviewers 字段); reviewer 走**一次** `bkt pr edit --reviewer x --reviewer y --reviewer z` multi-flag idempotent 调用; 5 个 reviewer 都成功

- **case 2.2b Workflow A (personal repo) 跳整段 reviewer add**
  - Given: fx-data-agents 项目, source = target = `~harrison/fx-data-agents`, branch → release
  - When: 走完 BF2 进入 reviewer add 段
  - Then: detectWorkflow 返回 "A", 跳整段 reviewer add (不 retry 不 409 测试), 报告 "personal repo 不支持 reviewer 字段, 已 cc 到 description"

- **case 2.3 Gate TB 用户改 body**
  - Given: title_body 生成完毕显示给用户
  - When: 用户说"body 第二段太啰嗦, 删掉"
  - Then: agent 重生成 title_body, 再次 askGate

- **case 2.4 Gate PR 用户改 reviewer**
  - Given: PR 计划显示 default reviewer 5 个
  - When: 用户说"去掉 alice, 加 bob"
  - Then: pr_plan.reviewers 更新, 再次 askGate, **不重生成 title/body**

- **case 2.5 push 失败**
  - Given: branch 在 origin 已存在不能 fast-forward
  - When: BF2 执行到 `git push -u`
  - Then: 报告 fail 原因, **不**调 gh/bkt pr create, worktree 保留

- **case 2.6 reviewer 大小写 fallback (bkt)**
  - Given: reviewer 列表含 `kerim.zhou`, bkt 实际 username 是 `Kerim.Zhou`
  - When: BF2 执行 reviewer add
  - Then: 第一次 409, 查 `/rest/api/1.0/users/kerim.zhou` 拿 `.name = "Kerim.Zhou"`, 用大小写正确版 retry 成功

- **case 2.7 batch add 后单个 fail 跳过**
  - Given: Workflow B, 3 个 reviewer 中 1 个无 read 权限 (其他 2 个权限 OK)
  - When: BF2 reviewer add 走批量 `bkt pr edit --reviewer x --reviewer y --reviewer z`
  - Then: bkt 单次调用返回 2 个成功 + 1 个 warning (idempotent 不 fail 整体命令); 扫 output 抽到 1 个 fail; 不进大小写 retry (识别为权限非大小写); 跳过, 最后报告 "PR 创建成功, reviewer X 添加失败, 已跳过"

**BF3 — Option 3 Keep as-is**

- **case 3.1 主路径**: 一行报告, 不动 worktree, 不删 branch

**BF4 — Option 4 Discard**

- **case 4.1 typed confirm 通过**
  - Given: 用户选 option 4
  - When: 显示将删, 用户 typed `discard` (lowercase 字面)
  - Then: cleanup worktree + `git branch -D` force delete

- **case 4.2 typed confirm 不通过**
  - Given: 用户选 option 4
  - When: 用户输入 `yes` 或 `y` 或 `OK`
  - Then: 不删, 返回菜单

**共享 worktree provenance**

- **case provenance.1 平级 worktree 识别**
  - Given: worktree 路径 = `/Users/yes365/AI/nocode-evolve-feature_foo` (按 rule-git-worktree 平级模式)
  - When: BF1 或 BF4 触发 cleanup
  - Then: overlay 把该路径加进识别表, `git worktree remove` 执行成功

- **case provenance.2 老路径仍识别**
  - Given: worktree 路径 = `.worktrees/feature/foo` (sp skill 老默认)
  - When: BF1 或 BF4 触发 cleanup
  - Then: 仍按 sp skill 默认识别, cleanup 成功 (overlay 是叠加不是替换)

## 方案选型

### Q1: rule 结构形态 — 单 rule / 多 rule / 主门面+子文件渐进式?

**选项**: 单大 rule (一文件 250+ 行包揽全链) vs 4-5 个并列小 rule (commit-tidy / pr-create / pr-reviewer 各一文件) vs 主门面 + `rule-references/<topic>/` 子文件 (渐进式加载)
**定**: 主门面 + 子文件渐进式. token 量化对比 (估算行数):

| disposition | 渐进式 (本设计) Read 行数 | 单大 rule Read 行数 | 节省 |
|---|---|---|---|
| option 3 (keep) / option 4 (discard) | 门面 80 | 250 | **-68%** (-170 行) |
| option 1 (merge) | 门面 80 + overlay 40 + commit-tidy 50 = 170 | 250 | **-32%** (-80 行) |
| option 2 GitHub | 门面 80 + overlay 40 + commit-tidy 50 + pr-flow-gh 120 = 290 | 250 (单 rule 仅含 gh) | +16% (+40 行) |
| option 2 Bitbucket DC | 290 + bkt-appendix 70 = 360 | 250 + bkt 详细命令 → 实际 ~320 | 约等 (+10%) |

option 3/4 节省最大 (68%), option 1 中等 (32%), option 2 GitHub 略亏 16% token. 但**单大 rule 不能同时塞 gh 主+bkt 附录两套** (会膨胀到 320+ 行), 等于把 bkt 用户拖累成"读跟自己无关的 gh 详细命令"; 渐进式让两种 toolchain 用户各拿各的. 多并列小 rule 失去"端到端链"感, catalog 4 entry 维护 surface 大. **综合: token + 维护 + sanity check (`inject-rules.sh:56` 非递归 glob 自动免检查), 渐进式胜.** → 影响 BF0/BF1/BF2 Read 时机.

### Q2: 跟 superpowers skill 关系 — 重写 / overlay?

**选项**: 重写 skill (本仓库放完整 finishing skill) vs overlay (照 rule-git-worktree 模式精确覆盖 + 保留段)
**定**: overlay. 因重写要维护 sp skill 完整 251 行复制 + 上游升级要 sync; overlay 表只列推翻段 (3 段) + 保留段, 维护 surface 缩到 ~40 行 (skill-overlay.md). → 影响 BF0 (overlay 加载) + BF1/BF4 (worktree provenance 修正).

### Q3: 工具栈处理 — gh / bkt / 工具中性 / gh 主 bkt 附录?

**选项**: 工具中性 plugin 不写命令 (项目本地写) vs 双工具并写 plugin (gh+bkt 命令穿插) vs 先 bkt 项目优先 vs 先 gh 流程优先 + bkt 附录
**定**: gh 主 + bkt 附录. 工具中性虽零成本但**放弃了 fx-data-agents 已踩过的 bkt 坑** (PUT 全量替换 / 大小写 / cross-fork 等) 的沉淀机会, 新项目还得重新撞; 双工具并写主流程被穿插 bkt 细节淹没; gh 流程优先反映"业界标准化路径", bkt 附录承担 Bitbucket DC 工具特异. 项目本地 `personal-repo-pr.md` 保留 reviewer 名单 / slug 历史等真正特异内容. → 影响 BF0 (toolchain 检测) + BF2 (附录 Read 时机).

**v1 覆盖边界**: 仅 `gh` (GitHub / GHE) + `bkt` (Bitbucket DC / Cloud) 两个工具栈. GitLab (`glab`) / Gitea / SourceHut / 其他 git host **不在 v1 覆盖**——BF0 私域 git host 走 `askUser` 兜底, 让用户显式选 gh / bkt / 跳过 PR, 不擅自归类.

**未来扩展指引**: 加第 3 工具栈 (e.g. GitLab) 时, 走 **"平级 appendix 模式"** —— 新增 `rule-references/rule-finishing-branch/pr-flow-glab-appendix.md`, 跟 `pr-flow-bkt-appendix.md` 平级, 覆盖 `pr-flow-gh.md` 的 "建 PR" + "加 reviewer" 段. **不**拆 `pr-flow-gh.md` 主体——gh 流程保持"标准参考实现"地位, 其他工具栈以 appendix 形式承载差异. BF0 同步加 `elif remote_url 含 "gitlab."` 分支.

### Q4: commit 整理边界 — agent 自动跑 / agent 给建议用户自跑 / agent 只诊断?

**选项**: agent 全自动跑 (能用非交互命令的都跑) vs agent 给建议 + 完整命令, 用户复制运行 vs agent 只列问题不给命令 vs commit 整理可跳过, 默认不强制
**定**: agent 给建议 + 完整命令, 用户自跑. 因全自动风险高 (rebase 失败破坏 history); 只列问题对不熟 git 的用户不友好; 完全可跳违背"端到端链"初衷. 给建议 + 命令是用户主导 + agent 辅助的平衡. → 影响 BF1/BF2 共用的 commit-tidy.md 内容.

### Q5: Gate 数量与合并 — 几个 Gate 够? push 前要不要单独 Gate?

**选项**: 1 Gate (起步时一次 confirm 整个 option 2 链) vs 4 Gate (M/TB/PR/D 各自独立) vs 6 Gate (拆出 push 前 / reviewer 列表分开 / 等)
**定**: 4 Gate. 因 1 Gate 没法挽回 title 错; 6 Gate 用户疲劳 (push 失败可恢复不算高风险, 合到 Gate PR 即可; reviewer 是 PR 元数据合在 Gate PR 一起改更连贯). 4 Gate 把"高 stake 决策"独立守关, "可恢复操作"合并. → 影响 BF1 (Gate M) + BF2 (Gate TB / Gate PR) + BF4 (Gate D).

## 其他

### 部署

本设计是 plugin rule 文档新增, 通过 `plugin.json` version 升级触发用户端 plugin marketplace 自动更新.

- **灰度策略**: 无——plugin 直接拉 git, 用户主动 update 或 marketplace 自动同步; 不分批
- **回滚预案**: rule 行为出问题 → 用户 git checkout 上一版 tag, 或 plugin 单 rule 文件删除 (sanity check 不会因子文件缺失报警); 主仓回滚走 git revert 后再 version bump (patch)
- **监控指标**: 无 metric——plugin 无运行时; 通过用户在 fx-data-agents / nocode-evolve / 新项目实测反馈触发文档修订

#### 版本依赖

本设计依赖 **superpowers >= 5.1.0** 的 4 选项菜单结构 (skill `SKILL.md:68-91`). 若 superpowers 升级 6.x 重构菜单 / 改 disposition 命名 / 移除某 option, 本设计 overlay 表 (`skill-overlay.md`) 需重新校准——重点检查推翻段 (worktree provenance / option 2 占位符 / option 2 单 gh 假设) 是否仍指对应 skill 段落. 升级前**先跑一遍 acceptance scenarios** (见下) 确认行为没漂移再 ship.

#### 老用户 transition 影响

`plugin.json` 1.1.1 → 1.2.0 后, 用户跑 `superpowers:finishing-a-development-branch` skill 时:

- **行为不变**: 4 选项菜单 (merge / push+PR / keep / discard) 跟 sp skill 默认一致, 选项编号 / 顺序 / 名称 不变
- **行为新增**: option 1 / 2 进入时多一步 commit 整理建议 (用户可显式说"跳过"); option 2 多 3 个 Gate (Title-Body / PR Plan / 含 reviewer 列表确认)
- **行为修正**: worktree cleanup 路径识别**扩展支持** plugin `<project>-<branch_flat>/` 平级模式 (老 `.worktrees/` 仍识别, 不破坏 backward compat)
- **不需要用户配置**: rule 自动按 catalog 路由触发, 不需要 opt-in

#### Acceptance 验证

通过指定 2-3 个 reference 项目实跑核心 scenarios:

- **nocode-evolve** (本仓库): 验 BF2 gh 路径 — case 0.1 (GitHub 检测) + case 1.1 (option 1 主路径) + case 4.1 (option 4 typed discard) + case provenance.1 (平级 worktree 识别)
- **fx-data-agents**: 验 BF2 bkt 路径 — case 0.2 (Bitbucket DC 检测) + case 2.2 (cross-fork Workflow B) + case 2.2b (Workflow A 跳 reviewer add) + case 2.6 (大小写 fallback)
- **私域 git host** (可选 — 用户有 corp 仓库时): 验 BF0 私域兜底 — 应触发 "工具栈不确定" askUser 提示, 不自动选 gh

acceptance scenarios 失败 → 在本文档末尾 Review Log 标记实际 issue, 按 living doc 演进 (Design Doc 状态机 `approved → implemented` 后仍可修改).

## Review Log

### Review 1 — 260522

<!-- Reviewer Report 全文 (independent context, general-purpose subagent) -->

#### ❌ Critical (5)

- **C1** [`### 业务流` BF0]: `"code.fineres.com"` 硬编码进 plugin 通用 rule, 是 fx-data-agents 私域 hostname. 其他公司 Bitbucket DC (`git.acme.corp`) 会被误判为 gh. 建议只判通用 `"bitbucket."` 子串.
- **C2** [`### 异常` + BF2]: bkt reviewer 409 不只大小写一种, 还有 "Personal repo 团队无 read 权限" (personal-repo-pr.md:81). 当前流程对两种 409 不区分会无意义 retry. 应加 Workflow A vs B 分支检测.
- **C3** [`### 单测` case 2.2 vs BF2]: `bkt pr edit --reviewer` 实际支持 multi flag idempotent 单次加多个 (personal-repo-pr.md:127-130). BF2 退化成 N 次 API call 丢失沉淀.
- **C4** [`### 影响`]: `rule-references/` 新目录依赖 `inject-rules.sh:56` "非递归 glob" 假设, 影响表没显式标注这条 invariant.
- **C5** [BF0 伪代码]: `main_root = "$(git -C "$(git rev-parse...)")"` 双引号嵌套 shell 写法不合法. 应复用 superpowers `SKILL.md:101` 标准写法.

#### ⚠️ Warning (6)

- **W1** [接口设计]: 门面契约"触发"跟 catalog 重复, 易漂移. 改"前置条件 / 进入状态".
- **W2** [BF2 push 异常]: 漏 "non-fast-forward 但允许 force-push" 路径; 应显式约束"禁止自动 force-push".
- **W3** [Q1 论据]: 渐进式实际 token ~290/360 行, 节省只对 option 3/4 显著; Q1 论据偏弱有 favorable framing 嫌疑.
- **W4** [case 2.7]: reviewer batch add 后, "逐个 retry" 跟 batch 语义不匹配, 按 C3 修正后需重写.
- **W5** [部署节]: 缺 acceptance scenarios 验证策略 (fx-data-agents 验 bkt, nocode-evolve 验 gh).
- **W6** [影响表 catalog 改]: 只 prose 描述, 没给最终 catalog 条目完整 markdown; 跟 plugin.json 改给 before/after 不对称.

#### 💡 Suggestion (7)

- **S1** [流程图]: 漏 default reviewer 查询失败的容错路径.
- **S2** [背景]: "工具是 gh 还是 bkt 没 single source" 措辞不准——真问题是"缺协作 workflow 模板".
- **S3** [目标]: 第 1/2 条是 means 不是 ends; 应移到 Q1 论据.
- **S4** [影响表 appendix]: 显式列 bkt 附录覆盖 gh 哪两段.
- **S5** [Q3 定]: "90% 现成无法复用" 措辞歧义, 实际是只 10% 通用.
- **S6** [BF cd 注释]: "(overlay 强调)" 模糊.
- **S7** [Gate 命名]: M/TB/PR/D 中 D 语义不对称, 建议改名或加 legend.

#### ❓ Open Questions (3)

- **Q1** [影响 plugin.json]: minor 升级合理, 但部署节缺"老用户 transition 影响".
- **Q2** [背景 + 部署]: 设计依赖 superpowers >= 5.1.0, 上游 6.x 重构 overlay 表需校准——要在部署节加版本依赖声明吗?
- **Q3** [appendix 契约]: "bkt CLI 可用" 粗——`bkt` subcommand vs `bkt api` REST 是否要拆?

#### 🔍 Self-Audit (4)

- **SA1** (与 C1 同根): GitLab self-hosted 用户被错归 gh, 但 `gh` 不能用 GitLab. 应加边界声明.
- **SA2** (与 C2/C3 同根): 不熟 Bitbucket DC 开发者按 BF2 写 N 次 bkt pr edit, 漏掉 idempotent multi flag 优化.
- **SA3**: 未来加第 3 工具栈时是建平级 appendix 还是拆 pr-flow.md 主体, 没扩展指引.
- **SA4**: commit-tidy.md 没说 agent 怎么判定 squash 阈值.

**Verdict**: ❌ Has issues.

---

**用户决定**: fix C1-C5, W1-W6, SA1-SA4; answer Q1-Q3; skip S1-S7.

**本轮修订**:

- **C1**: BF0 移除 `code.fineres.com` 私域 hostname; 改通用 `"bitbucket."` 子串匹配 + `"github.com"` 显式匹配 + 私域 git host 走 `askUser` 兜底
- **C2 + W4**: 异常表 ReviewerAdd 409 拆 3 行 (Workflow A bkt / gh 一般 / Workflow B bkt 大小写); BF2 reviewer add 段加 `detectWorkflow` 分支, Workflow A bkt 整段跳过; case 2.2b 新增覆盖 Workflow A 场景
- **C3 + W4**: BF2 reviewer add 改 batch + 单个 fallback 两段式 (`addReviewersBatch` multi-flag idempotent); case 2.2 / 2.7 同步修正描述为批量调用
- **C4**: 影响表 `rule-references/` 行加 invariant 注释 (依赖 `hooks/inject-rules.sh:56` 非递归 glob)
- **C5**: BF0 伪代码改用 superpowers SKILL.md:101 标准 shell 写法 (`MAIN_ROOT=$(...)` / `$(git ...)`); 加说明注: shell-style 命令真实可执行, control flow 仅意图示意
- **W1**: 内部接口表「触发」列改名「前置条件 / 进入状态」, 加说明"触发已在 catalog 路由表定义不重复"
- **W2**: BF2 push 异常加 non-ff 分支 (promptUser typed 'force' 字面才跑 `--force-with-lease`); 异常表 PushFail 拆 (一般) / (non-ff) 两行
- **W3**: Q1「定」补完整 token 量化对比表 (4 disposition 各场景 vs 单大 rule), 节省百分比标明
- **W5**: 部署节新增「Acceptance 验证」子节, 指定 nocode-evolve / fx-data-agents / 私域 git host 三类 reference 项目对应 case 编号
- **W6**: 影响表 catalog 改注释改为"完整 markdown 见《接口设计.内部接口》节末"; 内部接口表后追加完整 catalog 条目 markdown 块 (复制即用)
- **SA1**: Q3「定」加 v1 覆盖边界声明 (仅 gh + bkt, GitLab/Gitea/SourceHut 不在 v1)
- **SA2**: 同 C2/C3 修订, BF2 reviewer 加 idempotent multi-flag 行注释明确"已在 reviewer 的回 warning + skip 不 fail 整体"
- **SA3**: Q3「定」加未来扩展指引 — 加第 3 工具栈走"平级 appendix 模式" (新增 `pr-flow-glab-appendix.md`), 不拆 `pr-flow-gh.md` 主体
- **SA4**: 影响表 commit-tidy 行加 squash 判定规则 (连续 ≥2 个 message 含 `wip|tmp|fixup|fix typo` 关键字 → squash; 其他默认 reword)

**Open Questions 答复**:

- **Q1**: 部署节新增「老用户 transition 影响」子节, 明确 1.1.1 → 1.2.0 后行为不变 / 行为新增 (commit 整理 + 3 Gate) / 行为修正 (worktree provenance 扩展) / 不需要 opt-in
- **Q2**: 部署节新增「版本依赖」子节, 显式声明 "依赖 superpowers >= 5.1.0 的 4 选项菜单结构", 升 6.x 时要重新校准 overlay 推翻段
- **Q3**: 不拆. 「内部接口」表 `pr-flow-bkt-appendix.md` 行的输入假设改为 "`bkt` subcommand + `bkt api` REST passthrough 任一可用 (subcommand 优先, REST 用于 cross-fork)", 在子文件 implementation 阶段再按需细化

**Skip 理由 (Suggestions)**:

- S1 (流程图 default reviewer 失败容错): 异常表已含 PRCreateFail / ReviewerAdd409 多行, 流程图为 high-level 不再细化
- S2/S3/S5 (背景 / 目标 / Q3 措辞): 文意已能传达, 措辞优化优先级低
- S4 (影响表 appendix 覆盖段显式列): 接口设计.内部接口表 "输出动作" 列已写"替换 pr-flow-gh 的 '建 PR' + '加 reviewer' 段", 不重复
- S6 (BF cd 注释 (overlay 强调) 模糊): 实施时 `skill-overlay.md` 子文件会显式列, 设计文档层面注释已足
- S7 (Gate 命名 D 不对称): M/TB/PR/D 用首字母编号已建立 mental model, 改名扰乱; legend 加在子文件 `skill-overlay.md` 内不入主 doc

---

### Review 2 — 260522

<!-- Reviewer Report 全文 (fresh general-purpose subagent, 已 Read Review 1 Log) -->

#### ❌ Critical (3)

- **C1** [BF1 / BF4 / case 1.1]: Review 1 的 C5 在 BF0 把变量改成 `MAIN_ROOT=$(...)`, 但 BF1 / BF4 / case 1.1 三处仍是 lowercase `cd main_root`, C5 fix 没跨 BF 传播.
- **C2** [流程图脱节]: BF2 v2 已改两段式 (Workflow A 跳 / Workflow B batch + 单个 fallback), 但 "option 2 reviewer 子流程图" 仍是 v1 单段式, 没体现 Workflow A/B 分支 + batch 步骤. 实施者从流程图建的 mental model 跟 BF2 实际行为对不上.
- **C3** [bkt multi-flag 部分失败行为 — Evidence Gate]: `bkt pr edit --reviewer A --reviewer B --reviewer C` 当 B 无 read 权限时, A/C 是否仍被加 / 整体 exit code / output 怎么标记 fail —— **personal-repo-pr.md 没原始证据**, BF2 + case 2.7 把它当确定事实写. 应在实施第一步 acceptance scenario 实测.

#### ⚠️ Warning (4)

- **W1** [case 2.7 output parsing]: `extractFailedFromBatchOutput()` 实施时 agent 拿什么 grep — BF2 没指定 parser 规则.
- **W2** [BF2 non-ff promptUser 无 retry path]: promptUser 后直接 return, 用户 typed `force` 后 agent 没明确机制回到 push 这步, 易撞"回菜单 / 跳 Gate PR" 歧义.
- **W3** [Q1 token 对比表]: 缺私域 git host (askUser 后) 路径行.
- **W4** [文本总结行数歧义]: "option 2 Bitbucket DC 用户额外读 bkt 附录 (~360 行)" — 360 是总 Read 量不是附录单独, 表述歧义.

#### 💡 Suggestion (2)

- **S1** [SKILL.md:101 引用]: 两处重复引用, 集中一处避免行号漂移.
- **S2** [commit-tidy 行数]: 实施超 60 行需重评 Q1 token 对比.

#### ❓ Open Questions (1)

- **Q1** [跟 C3 同根]: bkt multi-flag 部分失败行为 acceptance 必测项 — exit code / A/C 是否成功 / output 格式. 是 BF2 + case 2.7 关键假设.

#### 🔍 Self-Audit (2)

- **SA1** (与 C2 同根): 实施者按流程图写代码后 BF2 文本对不上, 不知该信哪个.
- **SA2** (与 C1 同根): BF1/BF4 看到 `cd main_root` 但 function 内没声明, agent 行为分歧.

**Verdict**: ❌ Has issues. v2 大部分修订到位, 但 C1/C2/C3 是 v1→v2 连带 gap 未到位/未同步.

---

**用户决定**: skip 全部 (C1-C3 / W1-W4 / S1-S2 / Q1 / SA1-SA2). 接受 v2 现状, 走 design-doc-rendering 出 HTML; 全部 finding 留待**实施阶段** (writing-plans → executing-plans) 用 acceptance scenarios 实测 + 修订, living doc 演进.

**本轮修订**: 无 (全 skip).

**Skip 理由 (Round 2)**:

- **C1 / SA2** (`MAIN_ROOT` 跨 BF 传播): 实施 BF1/BF4 时让 agent 显式声明变量即可, 设计层面不影响 reviewer 判断架构合理性; 实施 plan 内修正
- **C2 / SA1** (流程图 vs BF2 v2 脱节): 流程图作为 high-level 概览, BF2 文本为权威 implementation 契约, 实施时以文本为准; 流程图修订留 living doc 阶段
- **C3 / Q1** (bkt multi-flag 部分失败 evidence): 这是**已知 acceptance scenario 必测项**, 文档已在「部署 → Acceptance 验证」节列入 fx-data-agents 验 BF2 bkt 路径; 实施 plan 第一个 task 应是实测 bkt 行为确认 BF2 两段式逻辑可行, 不可行则修订 BF2
- **W1** (output parsing): 同 C3, 实施阶段确认 bkt output 格式后填具体 grep pattern
- **W2** (non-ff retry path): 实施 BF2 时 agent 在 catch 块内 while loop retry, plan 阶段补充实现细节
- **W3** (token 表私域路径): 私域路径 token 消耗 = askUser 后选 gh / bkt 等同, 表注释已隐含
- **W4** (文本总结行数歧义): 文意可读, 表述优化优先级低
- **S1 / S2**: 维护性建议, 实施时按需调整

**Open Questions 答复**:

- **Q1**: 这是 v1 假设 (基于 fx-data-agents 实战经验中"已是 reviewer 的 warning + skip 不阻断" 的延伸推断), 但**无 multi-flag + 单 user 无权限场景的原始证据**. 实施 BF2 时 acceptance scenario 第一步必测 bkt 行为, 实测后 (a) 若假设成立 — 维持 BF2 两段式; (b) 若 multi-flag 整体 fail — 修订 BF2 为"逐个 add + 单个 retry", 同步 case 2.7
