# prflow — PR 路径：材料收集 + 全景计划 + 全自动执行（Step 单源）

PR disposition 的完整流程骨架。**Step 编号只在本文件**——gh / bkt 各自的命令实现见 `pr-flow-gh.md` / `pr-flow-bkt.md`（按主题组织，不重复 Step 编号）。

toolchain 检测（`github.com`→gh / `bitbucket.`→bkt）与 base 解析见 SKILL.md Step 2a / Step 2e。多数 Step 对 gh/bkt 无差异（直接写在本文件）；有差异的（查 reviewer / 建 PR / 加 reviewer / 查 PR 状态）标注「→ 见 pr-flow-gh / pr-flow-bkt」。

## Step 1: 材料收集（无交互，为全景计划备料）

全部算好再见用户，缺一项就不算收集完：

1. **push range**：`git log "$(git merge-base HEAD $base_branch)..HEAD" --oneline`
2. **commit 整理建议**：按 `commit-tidy.md` 判定规则产出「建议 + 完整命令」，只作为全景计划一行展示，**不在此等待用户**
3. **title + body**：契约单源见 `pr-body-contract.md`（标题 + 复杂度自适应的背景/方案/重点评审），核对 push range 无遗漏实质变更
4. **Affected**：`git diff --name-status "$(git merge-base HEAD $base_branch)..HEAD" | sort -k2`——按目录聚合成**目录树**展示：目录作节点（同链单子目录合并成 `a/b/c/` 一行），文件作叶用 `├──`/`└──` 连线；状态只标非修改项——新增 `(新)`、删除 `(删)`、改名 `(← 旧路径)`；同目录同类批量文件（如 i18n 语言包）折叠为一行 `<模式> ×N`。禁止扁平路径列表或 ` / ` 单行串接。只进全景计划展示，**不写进 PR body**
5. **target 解析**：`base_branch` 已由 SKILL.md Step 2e 单源解析；映射 `target_remote` + `target_branch`（fork 场景 `origin/<branch>`→`upstream/<base>`；单仓 `origin/<base>`）。项目本地 override 仅读 `.agents-personal/rules/personal-repo-pr.md`，不存在即无约定
6. **default reviewer** → 见 `pr-flow-gh`「default reviewer」/ `pr-flow-bkt`「default reviewer」（gh 走 branch protection/CODEOWNERS，bkt 走 default-reviewers API）。**名单全量采用（只排除 PR 作者），agent 不得自行精简或挑选**——「挑最相关的人减少打扰」「合并只需一个 approve」都不是精简理由：default 名单是团队配置的应加集合，取舍权在用户；仅当用户在全景回应中显式指定名单/点名增删时才偏离（实测教训：agent 曾自行把 10 人名单精简为 2 人，被用户事后纠正）
7. **任务号 + 目标状态**：SKILL.md Step 2e 已提取推定（有任务号时已 Read `post-merge.md` 拿映射），直接引用结果
8. **远程坐标**（合并后清理用，此刻捕获进监控上下文——删 branch 后 `branch.<name>.remote/merge` 配置即消失）：`remote=$(git config branch.<current>.remote)`（空则 origin）+ `remote_branch=$(git config branch.<current>.merge | sed 's|^refs/heads/||')`（空则同名）

## Step 2: 全景计划展示 + 确认

呈现机制与回应处理的总则见 SKILL.md Step 2 展示段（回合末尾文本，禁止「工具调用间文本 + 同回合 ask」）。PR 版模板：

```
[全景计划] <branch> → PR → <target_remote>/<target_branch>（来源: <解析来源>），确认后全自动:
  1. commit 整理   <建议内容 or 无建议>（默认: 跳过，原样进 PR）
  2. push + 建 PR  push: <普通（默认） / force-with-lease（仅已知 non-ff）>
                   title「<title>」
                   body 与 Affected 见下；reviewer: <名单 or 空>
  3. 发布策略      <全量（默认） / 灰度 / dark launch>    ← 生产改动才展示
  4. 合并方式      approve 后自动合并（默认）；pr-check 每 5min 查一次（定时进程存活期间）
  5. 合并后清理    worktree <path> + 本地 branch <branch>；远程 <remote>/<remote_branch>: 删除（默认）
  6. 合并后流转    #<task>: <当前状态> → <目标状态>    ← 无任务号则写「无流转」

--- body ---
<body 全文>
--- Affected（仅此处展示，不进 body）---
<Affected 目录树，规格见 Step 1 第 4 项>

回「OK」全自动到底；或直接说改哪项（target / title / body / reviewer / 合并方式 / 远程分支处置 / 目标状态）。
回「我先整理 commit」暂停整理。
```

- 改 target / reviewer / 发布策略 / 合并方式 / 远程分支处置 / 目标状态并同时确认 → 局部更新，**不重生成** title/body，两行复述后执行
- 只改参数但未确认 → 更新并重展同一份全景，不执行
- 改 title / body 语义 → 重生成，重展全景
- 只有用户主动明确要求「分步确认」时才覆盖单次全景协议；模板不主动提供该选项
- **合并方式**二选一：「approve 后自动合并」（默认；判据 = 平台可合并 + ≥1 approve，缺一不合）／「只盯不合」（合并权在别人手里的仓库用，只在可合并时通知一次）。gh 可附加策略 merge/squash/rebase（默认 merge）；bkt 走仓库默认策略
- **远程分支处置**：PR 路径**默认合并后删除**（source 分支专为 PR 而生，平台 PR 页面永久保留分支记录）；可改「保留」。护栏：source 分支名是 main/master/release/develop 等长期分支 → 强制保留，不给删除选项
- 主仓直接跑（非 worktree）→ 第 5 行去掉 worktree 与本地 branch（当前分支删不了），只处置远程；流转仍有效

## Step 3: push（只执行全景已授权方式）

```bash
git push -u origin HEAD
```

- no permission / auth fail → 报错 + 不进 PR 阶段，worktree 保留
- 准备段已知 non-fast-forward 且全景明确授权 `force-with-lease` → `git push --force-with-lease origin HEAD`
- 执行时才撞 non-fast-forward → 停止并报告，不追加询问、不 force；用户要求继续时重新收集远端状态并生成一份包含 `force-with-lease` 风险的新全景

## Step 4: 建 PR（不带 reviewer）

用全景确认的 title/target/body 建 PR，**绝不在 create 时塞 reviewer**（单 user 错会让整个 PR 建不出来），拆「create 不带 reviewer + 单独 edit 加」。

→ 命令见 `pr-flow-gh`「建 PR」/ `pr-flow-bkt`「建 PR」（bkt 分单仓 Workflow A / cross-fork Workflow B）。

## Step 5: 加 reviewer

建 PR 后单独加 reviewer，batch + 单个 fallback；单个 fail（无权限/不存在）跳过不阻断；名单为空 → 跳过本步。

→ 命令见 `pr-flow-gh`「加 reviewer」/ `pr-flow-bkt`「加 reviewer」（bkt 有大小写 409 坑，需 fallback）。

## Step 6: 启动统一定时监控（或按全景选择手动收尾）

先检测是否在 worktree：

```bash
git_dir=$(git rev-parse --git-dir); common_dir=$(git rev-parse --git-common-dir)
[ "$git_dir" != "$common_dir" ] && is_worktree=true || is_worktree=false
```

`is_worktree == false` → 监控上下文去掉清 worktree 步（无任务号且非 worktree → 不启动监控，直接报告 PR URL 结束）。

### 启动 pr-check watch（默认路径）

统一用 `pr-check.mjs --watch` 定时轮询。定时实现单源是同目录 `periodic-runner.mjs`；gh / bkt 只提供查询参数，不各写一套 sleep/cron。按 SKILL.md 顶部的平台区块启动 managed long process 并保存句柄：

```bash
node <REF>/pr-check.mjs --watch --interval-seconds 300 \
  <toolchain 参数，见 pr-flow-gh/bkt「pr-check 调用」>
```

脚本每次成功查询输出 `PR_CHECK ...`；命中停止条件后输出 `PR_WATCH reason=<READY|MERGED|CLOSED> runs=<N>` 并退出。连续查询失败 3 次会失败退出，避免静默挂死。

长进程完成后按最终 reason 处置：

- `READY` + 全景为自动合并 → 执行 pr-flow-gh/bkt 的合并命令；成功后立即单轮查询确认 MERGED，再走收尾
- `READY` + 全景为只盯不合 → 通知一次“已可合并”，保留 worktree / branch / 远程，停止监控
- `MERGED` → 直接走收尾
- `CLOSED` → 通知 PR 被关未合，worktree / branch / 远程全保留
- 脚本失败 / 句柄丢失 → 报告原因，所有内容保留；下次进入 dev-land 由 SKILL.md Step 2b 补清

MERGED 收尾按序：

1. `cd <MAIN_ROOT> && git worktree remove <worktree> && git worktree prune`
   - remove 报错=有未提交改动 → 不加 `--force`，提示用户手动清，跳过本地 branch 删除
2. `git -C <MAIN_ROOT> branch -D <branch>`
   - 平台已 MERGED 内容必在 target；squash/rebase 合并下 `-d` 会误报 not merged，故用 `-D`
3. 全景选删远程时：`git -C <MAIN_ROOT> push <remote> --delete <remote_branch>`
   - protected / 已删 → 报原因，不阻塞任务流转
4. 任务号非空 → 按 `post-merge.md` 流转到全景目标状态
5. 通知用户已合并 + 收尾清单

非 worktree 时去掉第 1、2 步（当前分支删不了自己），只做远程处置与任务流转。

启动后报告「PR 已创建 <url>，已启动 pr-check 定时监控（每 5min，执行进程存活期间有效）：approve 后自动合并 → 清 worktree → 流转」。

> **生命周期边界（如实告知用户）**：定时进程依赖当前执行宿主和 managed process 句柄；宿主退出或句柄丢失后不会继续。不要改成 `nohup` / 系统 cron 自动合并——无人监管时无法处置 merge veto、权限变化和流转失败。跨会话由 SKILL.md Step 2b 补清检测兜底。

### 全景选了「不盯」→ 手动保留

不启动 pr-check watch，报告「PR <url> 创建成功，worktree 保留，你后续 iterate / 合并后自己清」。清理时识别 4 种 provenance 路径模式（见 SKILL.md）。

### 远程分支清理提示

PR 合并后删远程分支的方式 gh/bkt 不同 → 见 `pr-flow-gh`「远程分支清理」/ `pr-flow-bkt`「远程分支清理」。**不在 PR 存续期删远程**——PR 的 source 分支删了 PR 会关闭。
