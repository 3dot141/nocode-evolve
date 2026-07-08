# prflow — PR 路径：材料收集 + 全景计划 + 全自动执行（Step 单源）

PR disposition 的完整流程骨架。**Step 编号只在本文件**——gh / bkt 各自的命令实现见 `pr-flow-gh.md` / `pr-flow-bkt.md`（按主题组织，不重复 Step 编号）。

toolchain 检测（`github.com`→gh / `bitbucket.`→bkt）与 base 解析见 SKILL.md Step 2a / Step 2e。多数 Step 对 gh/bkt 无差异（直接写在本文件）；有差异的（查 reviewer / 建 PR / 加 reviewer / 查 PR 状态）标注「→ 见 pr-flow-gh / pr-flow-bkt」。

## Step 1: 材料收集（无交互，为全景计划备料）

全部算好再见用户，缺一项就不算收集完：

1. **push range**：`git log "$(git merge-base HEAD $base_branch)..HEAD" --oneline`
2. **commit 整理建议**：按 `commit-tidy.md` 判定规则产出「建议 + 完整命令」，只作为全景计划一行展示，**不在此等待用户**
3. **title + body**：契约单源见 `pr-body-contract.md`（标题 + 背景/方案两段），核对 push range 无遗漏实质变更
4. **Affected**：`git diff --name-only "$(git merge-base HEAD $base_branch)..HEAD" | sort`——扁平路径列表，每行一个完整路径，不做目录树缩进。只进全景计划展示，**不写进 PR body**
5. **target 解析**：`base_branch` 已由 SKILL.md Step 2e 单源解析；映射 `target_remote` + `target_branch`（fork 场景 `origin/<branch>`→`upstream/<base>`；单仓 `origin/<base>`）。项目本地 override 仅读 `.agents-personal/rules/personal-repo-pr.md`，不存在即无约定
6. **default reviewer** → 见 `pr-flow-gh`「default reviewer」/ `pr-flow-bkt`「default reviewer」（gh 走 branch protection/CODEOWNERS，bkt 走 default-reviewers API）
7. **任务号 + 目标状态**：SKILL.md Step 2e 已提取推定（有任务号时已 Read `post-merge.md` 拿映射），直接引用结果
8. **远程坐标**（合并后清理用，此刻捕获写死进 cron prompt——删 branch 后 `branch.<name>.remote/merge` 配置即消失）：`remote=$(git config branch.<current>.remote)`（空则 origin）+ `remote_branch=$(git config branch.<current>.merge | sed 's|^refs/heads/||')`（空则同名）

## Step 2: 全景计划展示 + 确认

呈现机制与回应处理的总则见 SKILL.md Step 2 展示段（回合末尾文本，禁止「工具调用间文本 + 同回合 ask」）。PR 版模板：

```
[全景计划] <branch> → PR → <target_remote>/<target_branch>（来源: <解析来源>），确认后全自动:
  1. commit 整理   <建议内容 or 无建议>（默认: 跳过，原样进 PR）
  2. push + 建 PR  title「<title>」
                   body 与 Affected 见下；reviewer: <名单 or 空>
  3. 合并方式      approve 后自动合并（默认）；cron 每 5min 查一次（本会话内有效）
  4. 合并后清理    worktree <path> + 本地 branch <branch>；远程 <remote>/<remote_branch>: 删除（默认）
  5. 合并后流转    #<task>: <当前状态> → <目标状态>    ← 无任务号则写「无流转」

--- body ---
<body 全文>
--- Affected（仅此处展示，不进 body）---
<扁平路径列表>

回「OK」全自动到底；或直接说改哪项（target / title / body / reviewer / 合并方式 / 远程分支处置 / 目标状态）。
回「我先整理 commit」暂停整理；回「分步确认」降级逐项确认。
```

- 改 target / reviewer / 合并方式 / 远程分支处置 / 目标状态 → 局部更新，**不重生成** title/body，两行复述后执行
- 改 title / body 语义 → 重生成，重展全景
- **合并方式**二选一：「approve 后自动合并」（默认；判据 = 平台可合并 + ≥1 approve，缺一不合）／「只盯不合」（合并权在别人手里的仓库用，只在可合并时通知一次）。gh 可附加策略 merge/squash/rebase（默认 merge）；bkt 走仓库默认策略
- **远程分支处置**：PR 路径**默认合并后删除**（source 分支专为 PR 而生，平台 PR 页面永久保留分支记录）；可改「保留」。护栏：source 分支名是 main/master/release/develop 等长期分支 → 强制保留，不给删除选项
- 主仓直接跑（非 worktree）→ 第 4 行去掉 worktree 与本地 branch（当前分支删不了），只处置远程；流转仍有效

## Step 3: push（永不自动 force）

```bash
git push -u origin HEAD
```

- no permission / auth fail → 报错 + 不进 PR 阶段，worktree 保留
- **non-fast-forward**（rebase/amend 改过 history）→ 安全例外：用户 typed `force` **字面**才 `git push --force-with-lease origin HEAD`；任何非 `force` 字面（含 yes/y/OK）→ 不 force。（gh/bkt 无差异，纯 git）

## Step 4: 建 PR（不带 reviewer）

用全景确认的 title/target/body 建 PR，**绝不在 create 时塞 reviewer**（单 user 错会让整个 PR 建不出来），拆「create 不带 reviewer + 单独 edit 加」。

→ 命令见 `pr-flow-gh`「建 PR」/ `pr-flow-bkt`「建 PR」（bkt 分单仓 Workflow A / cross-fork Workflow B）。

## Step 5: 加 reviewer

建 PR 后单独加 reviewer，batch + 单个 fallback；单个 fail（无权限/不存在）跳过不阻断；名单为空 → 跳过本步。

→ 命令见 `pr-flow-gh`「加 reviewer」/ `pr-flow-bkt`「加 reviewer」（bkt 有大小写 409 坑，需 fallback）。

## Step 6: 注册 cron 监控（或按全景选择手动收尾）

先检测是否在 worktree：

```bash
git_dir=$(git rev-parse --git-dir); common_dir=$(git rev-parse --git-common-dir)
[ "$git_dir" != "$common_dir" ] && is_worktree=true || is_worktree=false
```

`is_worktree == false` → cron prompt 里去掉清 worktree 步（无任务号且非 worktree → 不注册 cron，直接报告 PR URL 结束）。

### 注册 cron（默认路径）

用 `CronCreate` 注册轮询 job（`cron: "2-59/5 * * * *"`，错开整点分钟），**prompt 必须自足**——PR 号 / worktree / MAIN_ROOT / 任务号 / 目标状态 / 合并方式全部写进 prompt 字面值，每轮不依赖会话记忆（盯合并常隔数小时，context 可能已压缩）。模板：

```
[pr-watch #<pr>] 单轮检查 PR 并按状态处置，本 prompt 自足：
1. 跑 node <REF>/pr-check.mjs <toolchain 参数，见 pr-flow-gh/bkt「pr-check 调用」>
   → 读输出行 PR_CHECK state=<S> mergeable=<M> approved=<A>
2. 按状态处置:
   - OPEN 且 (M=false 或 A=false) → 本轮结束，不输出任何内容
   - OPEN 且 M=true 且 A=true → 执行合并（命令见 pr-flow-gh/bkt「合并 PR」，策略 <s>）;
     合并失败 → 通知用户需手动处理 + 删本 cron（见步骤 4），不重试
   - MERGED → 完整收尾，按序:
     a. cd <MAIN_ROOT> && git worktree remove <worktree> && git worktree prune
        （remove 报错=有未提交改动 → 不加 --force，提示用户手动清，跳过 b 保留 branch）
     b. git -C <MAIN_ROOT> branch -D <branch>
        （平台已 MERGED 内容必在 target，squash/rebase 合并下 -d 会误报 not merged 故用 -D）
     c. <全景选删远程时> git -C <MAIN_ROOT> push <remote> --delete <remote_branch>
        （失败=protected/已删 → 报原因不阻塞）
     d. 任务号 <ids> 非空 → Read <REF>/post-merge.md 流转到「<目标状态>」
     e. 通知用户已合并 + 收尾清单; 删本 cron（见步骤 4）
   - CLOSED → 通知用户 PR 被关未合，worktree / branch / 远程全保留; 删本 cron（见步骤 4）
3. <is_worktree=false 时步骤 2 的 MERGED 分支去掉 a、b（当前分支删不了自己）: 只做 c-e>
4. 删本 cron: CronList 找 prompt 含 "[pr-watch #<pr>]" 的 job → CronDelete
```

注册后报告「PR 已创建 <url>，已注册 cron 监控（每 5min，**本会话内有效**）：approve 后自动合并 → 清 worktree → 流转」，本轮结束。

> **会话级边界（如实告知用户）**：CronCreate 的 job 只活在本会话内存，关掉 Claude Code 即失效（recurring 亦有 7 天上限）——跨会话由 SKILL.md Step 2b 的补清检测兜底。不要用 `run_in_background` 常驻脚本替代 cron 轮：常驻脚本动作硬编码，撞上合并冲突 / 流转失败无法处置；cron 每轮 agent 在场，意外当场处理。

### 全景选了「只盯不合」→ cron prompt 去掉 auto-merge 分支

步骤 2 的「OPEN 且可合已批」分支改为：通知用户可合并，然后 CronDelete 本 job + CronCreate 一个去掉本分支的新 job（只等 MERGED / CLOSED 做清理与流转）——保证「可合并」只提醒一次，不每 5min 骚扰。

### 全景选了「不盯」→ 手动保留

不注册 cron，报告「PR <url> 创建成功，worktree 保留，你后续 iterate / 合并后自己清」。清理时识别 4 种 provenance 路径模式（见 SKILL.md）。

### 远程分支清理提示

PR 合并后删远程分支的方式 gh/bkt 不同 → 见 `pr-flow-gh`「远程分支清理」/ `pr-flow-bkt`「远程分支清理」。**不在 PR 存续期删远程**——PR 的 source 分支删了 PR 会关闭。
