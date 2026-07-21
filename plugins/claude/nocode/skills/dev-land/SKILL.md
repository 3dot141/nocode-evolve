---
name: dev-land
description: "Use when implementation is complete and you need to land the work — merge locally, create a PR, keep, or discard. Use when devflow routes to Land stage, or when user says \"land/着陆/提PR/收尾/合并/创建PR/完成worktree/discard worktree/PR合了/流转任务\". Not for: PR review (dev-review), work-in-progress pushes, or git queries."
---

> 本文写“结构化决策”时，必须把当前步骤的完整问题与 2–3 个互斥选项编译为 `Capability(workflow.decision.request, {"question":"<self-contained current-step question>","options":[{"label":"<option-label>","description":"<impact or tradeoff>"}],"allowFreeform":false})`；示例只展示单项形状，真实调用需带齐本步骤列出的选项，不得回退到平台专属提问工具。

# land — 3 步着陆，干净收场

**Iron Law: 意图 → 全景 → 全自动。用户只在全景确认介入一次。**

## 触发

- devflow 路由到 Land 阶段
- 用户直接说「提 PR / 创建 PR / push 提 PR / 合并 / merge 到 main/release / discard / 丢弃 / keep / 先放着 / 收尾 / 完成 worktree / 着陆 / 准备着陆 / 走 land 阶段」
- 用户说「PR 合了 / 流转任务 / 合并后流转 / 任务状态改一下」（合并后流转，见 `references/post-merge.md`）

**不触发**:
- 纯查询（"我在哪个 branch / worktree 状态 / 当前 PR 列表"）
- PR review 中（走 dev-review）
- "帮我看看代码" → Review，不是 Land
- "写完了" → 先 Verify 再 Review 再 Land

---

## Step 1: 意图推定

disposition 直接从入口语读，读得出就**不出菜单**：

| 入口语 | disposition |
|---|---|
| 提 PR / 创建 PR / push 提 PR | **PR** |
| 合并 / merge 到 main/release | **Merge** |
| discard / 丢弃 / 不要了 | **Discard** |
| keep / 先放着 / 留着分支 | **Keep** |
| 收尾 / 完成 worktree / land / devflow 路由未带意图 | 推不定 → 结构化决策 四选一菜单 |

- 菜单是全景确认之外**唯一**使用 结构化决策 的点（纯单选，选项 label 写实际分支名与 base）
- detached HEAD → 菜单去掉 Merge

---

## Step 2: 全景计划

### 准备段（自动跑完，不停）

#### 2a. 工具栈检测

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
remote_url=$(git -C "$MAIN_ROOT" remote get-url origin)
```

| remote_url 含 | toolchain |
|---|---|
| `"bitbucket."` | `bkt` |
| `"github.com"` | `gh` |
| 否则 | askUser "工具栈不确定, 选 [gh / bkt / 跳过 PR]" |

#### 2b. 补清检测

上次会话 cron 中断的兜底——跨会话唯一恢复点，不可删。当前在 worktree 时查当前分支对应 PR：

- gh：`gh pr view --json state`（报 "no pull requests found" → 无 PR，静默继续）
- bkt：按分支搜（见 `references/pr-flow-bkt.md`「按分支搜 PR」）
- state == MERGED 且 worktree 还在 → 询问补做收尾（一次问清）
- 其它状态 / 主仓内 → 静默继续

#### 2c. 信息收集

以下三项收集为**信息**，不阻塞——有风险的在全景里标出，用户自己决定：

- **Review 状态**（仅 devflow 路由入口）：Review task 是否标完成 + 无未解决 Critical
- **工作目录**：`git status`——可归因于 Build/Verify/Review 的改动 → 统一 commit；来源不明 → 标为风险项
- **分支新鲜度**：behind base 差距

#### 2d. Verify Tests（仅 PR / Merge）

- Keep / Discard → **跳过**
- 项目有测试 → 跑一遍。fail → 标为风险项（全景展示），不阻塞

#### 2e. 材料收集（无交互）

**base 解析（单源）**，按优先级取第一个命中：
1. `git config branch.<current>.nocode-base`（worktree 创建时写入）
2. `@{upstream}`
3. `origin/HEAD` → fallback `origin/main`

按 disposition 读 reference 收材料：

| disposition | Read | 收集项 |
|---|---|---|
| **PR** | `references/prflow.md` + `references/pr-flow-<gh\|bkt>.md` + `references/pr-body-contract.md` + `references/commit-tidy.md` | push range、整理建议、target/title/body/Affected、default reviewer |
| **Merge** | `references/commit-tidy.md` + `references/remote-branch-cleanup.md` | push range、整理建议、merge 计划、远程坐标 + 独有 commit |
| **Discard** | `references/remote-branch-cleanup.md` | 将删清单、远程坐标 + 独有 commit |
| **Keep** | （无） | 直接一行报告现状，结束 |

- **任务号 + 目标状态**（PR / Merge）：`git log <base>..HEAD --format=%B | grep -oE '#[fgm]-[a-z0-9]+' | sort -u`；有任务号 → Read `references/post-merge.md` 拿典型流转映射 + 查当前状态 → 推定目标状态
- **远程坐标必须此刻捕获**——删 branch 后 `branch.<name>.remote/merge` 配置即消失（见 `references/remote-branch-cleanup.md`）

### 展示：全景一屏

把整条线一屏展给用户，**回合末尾文本展示**，等用户自由回应。不用 结构化决策。红线：**禁止「工具调用间文本展示 + 同回合 ask」**。

**PR 版模板**（详见 `references/prflow.md`）：

```
[全景计划] <branch> → PR → <target>，确认后全自动:
  ⚠ <风险项：Review 未过 / tests fail / behind N commits>   ← 有才展示
  1. commit 整理   <建议内容>（默认: 跳过）
  2. push + 建 PR  title「<title>」; reviewer: <名单 or 空>
  3. 合并方式      approve 后自动合并（默认）; cron 每 5min（本会话有效）
  4. 合并后清理    worktree + branch + 远程: 删除（默认）
  5. 合并后流转    #<task>: <当前> → <目标>

--- body ---
## 背景
<...>
## 方案
<...>

--- Affected（仅展示，不进 body）---
<Affected 目录树>

回「OK」全自动到底；或直接说改哪项。
```

**Merge 版模板**：

```
[全景计划] <branch> → 本地 merge 回 <base>，确认后全自动:
  ⚠ <风险项>
  1. commit 整理   <建议>（默认: 跳过）
  2. merge         <branch> → <base>（<N> 个 commit）
  3. 清理          worktree + 本地 branch
  4. 远程分支      <remote>/<branch>: 保留（默认）；改「删」则删（<独有 commit 文案>）
  5. 合并后流转    #<task>: <当前> → <目标>
回「OK」全自动到底；或直接说改哪项。
```

**Discard 版模板**：

```
[全景计划·Discard] 将删除以下内容，不可恢复:
  - worktree: <path>
  - 本地 branch: <branch>（<N> 个未合并 commit）
  - 远程分支 <remote>/<branch>: 保留（默认）
确认删除请回复字面 `discard`；yes / OK 均视为取消。
```

**回应处理**：
- 「OK / 确认」→ Step 3 全自动到底
- 「改 X 为 Y」→ 局部更新，两行复述
- 「我先整理 commit」→ 贴出整理命令（`references/commit-tidy.md`）等「好了」，重收材料重展全景
- 「分步确认」→ 降级逐项确认
- 「先去 Review」→ 暂停，交回 dev-review
- **Discard 特例**：只认字面 `discard`，其它一律取消

**非 worktree 场景**：去掉 worktree 与本地 branch 清理行（当前分支删不了），**其余全部照走**——全景计划 / PR body 契约 / reviewer / cron / 任务流转一项不省。

**devflow 路由入口额外约束**（仅对生产改动）：

发布策略（全景确认前追问）：
> "这次改动的发布策略？全量 / 灰度 / dark launch"

PR body 回链：Requirements Addressed（引用 Define 的 restate）+ Verification Evidence（引用 Verify 证据）。

---

## Step 3: 全自动执行（含 post-merge）

| disposition | 自动段 | 安全例外 |
|---|---|---|
| **PR** | push → 建 PR → 加 reviewer → 注册 cron 监控 → (cron 合并后) 三件套清理 → 任务流转 → cron 自删 | non-ff → typed `force` |
| **Merge** | merge → 三件套清理 → 任务流转 | 无 |
| **Discard** | 清 worktree → `branch -D` → (全景选删) 删远程 | 无（字面确认已在 Step 2） |
| **Keep** | 一行报告现状 | 无 |

执行失败 → 停在失败步报告，不静默跳过、不回滚已成功步。

### 三件套清理

合并后收尾 = worktree + 本地 branch + 远程分支，只清 worktree 留 branch 是残留。

- 顺序：先 `cd "$MAIN_ROOT"` → `git worktree remove` → `git worktree prune` → 删本地 branch → (全景选删) 删远程
- PR 路径 MERGED 后用 `-D`（squash/rebase 下 `-d` 误报 not merged）；Merge 路径用 `-d`
- 长期分支（main / master / release / develop）→ 永不删
- 未提交改动 → remove 报错，不加 `--force`
- 识别 4 种 worktree 路径模式：`.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/` / 插件平级路径
- 非 worktree → 跳过 worktree remove 和本地 branch delete，只处置远程

### PR 路径 cron 监控

用 `CronCreate` 注册轮询（`cron: "2-59/5 * * * *"`），prompt 必须自足——PR 号 / worktree / MAIN_ROOT / 任务号 / 目标状态 / 合并方式全部写进 prompt 字面值。详见 `references/prflow.md` Step 6。

会话级边界如实告知：CronCreate 的 job 随会话消亡，跨会话由 Step 2b 补清检测兜底。

### 合并后流转

合并后调 `Capability(workflow.skill.invoke, {"skill":"lark-project","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})` 把任务流转到全景计划定好的目标状态。详见 `references/post-merge.md`。

- 前置：有任务号 + FeishuProjectMcp 可用。不满足 → 跳过，报告原因
- 典型映射：缺陷/任务类 `组员开发 → 研发已改待BUILD`

---

## 安全例外表

全景确认后**只有**这些情形允许再拦：

| 例外 | 触发 | 防什么 |
|---|---|---|
| typed `force` | push 撞 non-fast-forward | 自动 force push 覆盖远端历史 |
| typed `discard` | Discard 全景确认 | 误丢弃整支工作 |
| tests fail 标注 | Step 2d | 带病 merge / PR（全景标风险，用户决定） |
| toolchain askUser | 私域 git host | 瞎猜工具栈 |
| 补清询问 | Step 2b 检测到 PR 已合并未清 | 上个会话的决策不能代表本会话 |

除表内情形，全景确认后新增任何交互都是 bug。

## Worktree 清理安全规则

- Merge / Discard → 必清理 worktree；PR → cron 合并后自动清；Keep → 不清理
- 先 remove worktree 再删 branch（反了 `branch -d` 会 fail）
- `git worktree remove` 前必须 cd 到主仓根（在 worktree 内跑会静默失败）
- 未提交改动 → remove 报错，不加 `--force`，用户先 stash

## 场景差异

| | Full / Standard / Fix | Mini |
|---|---|---|
| 意图推定 | 完整 | commit only |
| 全景计划 | 完整 | 跳过 |
| 执行 | 完整 | 确认 commit 即完成 |

Mini 场景的 Land-lite：确认 commit 已完成即可，不进完整 Step 1-3。

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "Review 差不多了，先 push 再改" | 全景会标 Review 状态，用户自己决定 |
| "先合了再跑 CI" | CI 是 PR 流程的一部分 |
| "worktree 保着占空间，顺手删了" | 全景让用户选 |
| "任务号懒得填" | 流转闭环是 Land 的一部分 |
| "force push 一下就好" | 安全例外，typed `force` 字面才执行 |
| "不在 worktree 里，全景/PR契约/reviewer/cron 不适用" | **非 worktree 只影响清理项，其余全部照走** |
| "用户说了提PR，直接 push + 建 PR 就行" | 「提PR」是 Step 1 意图推定的输入，不是跳过全景的授权 |
| "这个改动简单，跳过某 Step" | 进了 skill 就走完。"简单"不是跳 Step 的授权 |

## Red Flags

- 还没出全景就执行了 push / PR / merge
- 跳过 body 生成直接 `gh pr create` / `bkt pr create`
- PR 创建后立刻 merge 不等 review
- 清理 worktree 但没 ExitWorktree——先退出再清理
- 因"非 worktree"跳过全景计划
- 因"任务简单 / 用户催了"跳过全景

## 不要

- 不要跳过全景计划直接执行 — 全景是唯一授权点
- 不要在全景确认后新增计划外交互 — 安全例外表之外再问 = bug
- 不要自动 force push — typed `force` 字面才执行
- 不要在 approve 前 merge — 判据 = 平台可合并 + ≥1 approve
- 不要假设 toolchain — 私域 git host 必须 askUser
- 不要在 worktree 内跑 `git worktree remove` — 先 cd 到 `$MAIN_ROOT`
- 不要删 branch 前没 remove worktree
- cron 只用 CronCreate 轮询 — 不要 `run_in_background`，不要 ScheduleWakeup
- gh / bkt 特有坑 → 见 `references/pr-flow-gh.md` / `references/pr-flow-bkt.md`
