---
name: dev-land
description: "\"Use when implementation is complete and you need to land the work — merge locally, create a PR…"
---

合并后项目流转使用 `$lark-project`。
PR 定时监控用 `exec_command` 启动 `references/pr-check.mjs --watch`，保存 session id；后续用 `write_stdin` 续取输出继续处置。

# land — 3 步着陆，干净收场

**Iron Law: 意图与参数统一进入全景；用户只确认一次完整全景。确认前不设独立 Gate，确认后不追加询问。遇到计划外风险或执行失败，停止并报告；需要继续时生成新的全景。**

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

disposition 直接从入口语读，读得出就进入对应全景：

| 入口语 | disposition |
|---|---|
| 提 PR / 创建 PR / push 提 PR | **PR** |
| 合并 / merge 到 main/release | **Merge** |
| discard / 丢弃 / 不要了 | **Discard** |
| keep / 先放着 / 留着分支 | **Keep** |
| 收尾 / 完成 worktree / land / devflow 路由未带意图 | 推不定 → 不提问，进入候选全景 |

- 候选全景把 PR / Merge / Keep / Discard 作为 `disposition` 字段，结合仓库状态标一个安全的推荐默认值；用户回「OK」即接受默认值，也可在同一次全景回应里改选
- detached HEAD → 候选全景去掉 Merge
- 选择与授权属于同一个全景 Gate；禁止先问 disposition、拿到答案后再出第二个确认 Gate

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
| 否则 | 不提问；全景写 `toolchain: 待指定（gh / bkt / 跳过 PR）` |

全景仍有 `待指定` 字段时不可执行。用户只回「OK」→ 不创建新 Gate，原样重展同一份全景并标出待补字段；用户补字段并确认后才进入 Step 3。

#### 2b. 补清检测

上次会话定时进程中断的兜底——跨会话唯一恢复点，不可删。当前在 worktree 时查当前分支对应 PR：

- gh：`gh pr view --json state`（报 "no pull requests found" → 无 PR，静默继续）
- bkt：按分支搜（见 `references/pr-flow-bkt.md`「按分支搜 PR」）
- state == MERGED 且 worktree 还在 → 停止常规路径，生成「补清全景」：列出 worktree / 本地分支 / 远程分支 / 任务流转处置；这份全景是本轮唯一确认
- 其它状态 / 主仓内 → 静默继续

#### 2c. 信息收集

以下三项收集为**信息**，不阻塞——有风险的在全景里标出，用户自己决定：

- **Review 状态**（仅 devflow 路由入口）：Review task 是否标完成 + 无未解决 Critical
- **工作目录**：`git status`——可归因于 Build/Verify/Review 的改动 → 统一 commit；来源不明 → 标为风险项
- **分支新鲜度**：behind base 差距
- **push 可快进性**（PR）：fetch 后比较远程 source tip 是否为 HEAD 祖先；已知会 non-ff → 把 `force-with-lease` 作为全景中的显式动作与风险，不留到执行期追问

#### 2d. Verify Tests（仅 PR / Merge）

- Keep / Discard → **跳过**
- 项目有测试 → 跑一遍。fail → 标为风险项（全景展示），不阻塞

#### 2e. 材料收集（无交互）

**base 解析（单源）**，按优先级取第一个命中：
1. `git config branch.<current>.nocode-base`（worktree 创建时写入）
2. `@{upstream}`
3. `origin/HEAD` → fallback `origin/main`

按 disposition 读 reference 收材料；候选全景按推荐默认值收完整材料，并为其它 disposition 收集足够展示差异的摘要：

| disposition | Read | 收集项 |
|---|---|---|
| **PR** | `references/prflow.md` + `references/pr-flow-<gh\|bkt>.md` + `references/pr-body-contract.md` + `references/commit-tidy.md` | push range、整理建议、target/title/body/Affected、default reviewer |
| **Merge** | `references/commit-tidy.md` + `references/remote-branch-cleanup.md` | push range、整理建议、merge 计划、远程坐标 + 独有 commit |
| **Discard** | `references/remote-branch-cleanup.md` | 将删清单、远程坐标 + 独有 commit |
| **Keep** | （无） | 直接一行报告现状，结束 |

- **任务号 + 目标状态**（PR / Merge）：`git log <base>..HEAD --format=%B | grep -oE '#[fgm]-[a-z0-9]+' | sort -u`；有任务号 → Read `references/post-merge.md` 拿典型流转映射 + 查当前状态 → 推定目标状态
- **远程坐标必须此刻捕获**——删 branch 后 `branch.<name>.remote/merge` 配置即消失（见 `references/remote-branch-cleanup.md`）

### 展示：全景一屏

把整条线一屏展给用户，**回合末尾文本展示**，等用户自由回应。不用结构化决策。全景同时承载参数选择与执行授权；红线：**禁止「工具调用间文本展示 + 同回合 ask」**。

**候选版模板**（意图推不定时）：

```
[全景计划] <branch> → 待选择着陆方式
  着陆方式
  - PR → <target>（推荐）
  - 本地 Merge → <base>
  - Keep → 保留当前分支
  - Discard → 丢弃当前分支

  若接受推荐的 PR，将执行:
  <完整 PR 全景各项 + body + Affected>

回「OK」接受推荐项并执行；或在同一次回应里改着陆方式 / 参数并确认。改选 Discard 时，确认字面必须包含 `discard`。
```

推荐项不是已授权动作；没有完整全景确认，任何 disposition 都不得执行。若推荐项不是 PR，替换下半段为对应完整全景。

**PR 版模板**（详见 `references/prflow.md`）：

```
[全景计划] <branch> → PR → <target>，确认后全自动:
  ⚠ <风险项：Review 未过 / tests fail / behind N commits>   ← 有才展示
  1. commit 整理   <建议内容>（默认: 跳过）
  2. push + 建 PR  push: <普通（默认） / force-with-lease（仅已知 non-ff）>;
                   title「<title>」; reviewer: <名单 or 空>
  3. 发布策略      <全量（默认） / 灰度 / dark launch>    ← 生产改动才展示
  4. 合并方式      approve 后自动合并（默认）; pr-check 每 5min（定时进程存活期间）
  5. 合并后清理    worktree + branch + 远程: 删除（默认）
  6. 合并后流转    #<task>: <当前> → <目标>

--- body ---
## 背景
<...>
## 方案
### 方案 1：<语义标题>
**问题**：<...>
**方案**：<...>
## 重点评审
> <为什么优先看这些高影响 / 复杂 / 高风险位置>
1. 看 **<Affected 中的真实文件路径>**：<为什么看、看什么、怎样算有问题>

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
- 「改 X 为 Y，OK / 确认」→ 局部更新，两行复述后直接执行，不等第二次确认
- 只说「改 X 为 Y」→ 局部更新并重展同一份全景，尚未授权执行
- 「我先整理 commit」→ 贴出整理命令（`references/commit-tidy.md`）等「好了」，重收材料重展全景
- 用户主动明确要求「分步确认」→ 可覆盖默认协议；不要在模板里主动提供或诱导该选项
- 「先去 Review」→ 暂停，交回 dev-review
- **Discard 特例**：只认字面 `discard`，其它一律取消

**非 worktree 场景**：去掉 worktree 与本地 branch 清理行（当前分支删不了），**其余全部照走**——全景计划 / PR body 契约 / reviewer / 定时监控 / 任务流转一项不省。

**devflow 路由入口额外约束**（仅对生产改动）：

发布策略直接进入全景，默认「全量」，可在同一次全景回应中改为「灰度 / dark launch」；禁止全景前追问。

---

## Step 3: 全自动执行（含 post-merge）

| disposition | 自动段 |
|---|---|
| **PR** | 按全景选定的普通 push 或 `force-with-lease` → 建 PR → 加 reviewer → 启动 pr-check 定时监控 → 就绪后合并 → 三件套清理 → 任务流转 |
| **Merge** | merge → 三件套清理 → 任务流转 |
| **Discard** | 清 worktree → `branch -D` → (全景选删) 删远程；字面 `discard` 就是本全景的唯一确认 |
| **Keep** | 一行报告现状 |

执行失败或出现全景未覆盖的新风险 → 停在当前步报告，不静默跳过、不回滚已成功步、**不临时追问是否继续**。用户要求继续时，重新收集现状并生成一份新的全景。

### 三件套清理

合并后收尾 = worktree + 本地 branch + 远程分支，只清 worktree 留 branch 是残留。

- 顺序：先 `cd "$MAIN_ROOT"` → `git worktree remove` → `git worktree prune` → 删本地 branch → (全景选删) 删远程
- PR 路径 MERGED 后用 `-D`（squash/rebase 下 `-d` 误报 not merged）；Merge 路径用 `-d`
- 长期分支（main / master / release / develop）→ 永不删
- 未提交改动 → remove 报错，不加 `--force`
- 识别 4 种 worktree 路径模式：`.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/` / 插件平级路径
- 非 worktree → 跳过 worktree remove 和本地 branch delete，只处置远程

### PR 路径定时监控

统一运行 `node <REF>/pr-check.mjs --watch --interval-seconds 300 ...`，不依赖平台专属 cron。`<REF>` 是本 skill 的 `references/` 目录；`pr-check` 引用 `periodic-runner.mjs` 的定时能力，查到 READY / MERGED / CLOSED 后退出；agent 根据最终状态执行合并、清理和任务流转。详见 `references/prflow.md` Step 6。

生命周期边界如实告知：定时进程只在当前执行宿主和长进程句柄存活期间有效；句柄丢失或宿主退出后，由 Step 2b 补清检测兜底。禁止用 `nohup` / 系统 cron 把无人监管的合并动作留在后台。

### 合并后流转

合并后按上方平台语法调用 lark-project，传入 request、stage、design path、DES scope、artifacts、constraints 和 decision，把任务流转到全景计划定好的目标状态。连接器不可用时明确报告缺失能力，不伪造完成。详见 `references/post-merge.md`。

- 前置：有任务号 + FeishuProjectMcp 可用。不满足 → 跳过，报告原因
- 典型映射：缺陷/任务类 `组员开发 → 创建者验收`

---

## 单次确认边界

| 情形 | 处理 |
|---|---|
| tests fail / Review 未过 / behind base | 全景风险项，用户在唯一确认中决定 |
| Discard | 字面 `discard` 确认整份 Discard 全景 |
| 已知 non-ff | 全景明确列出 `force-with-lease`；只有确认了该全景才执行 |
| 执行时才发现 non-ff / 冲突 / 权限变化 | 停止并报告；若用户要继续，生成新的全景 |
| 私域 host 工具栈未知 | 全景保留待指定字段，不单独 ask |
| PR 已合并未清 | 生成补清全景，不先询问再确认 |

参数修改、风险授权和 disposition 选择都必须收敛进这一个 Gate。全景确认后新增任何询问都是 bug；失败报告与用户主动要求暂停 / 分步执行不算 agent 新增 Gate。

## Worktree 清理安全规则

- Merge / Discard → 必清理 worktree；PR → pr-check 就绪并合并后自动清；Keep → 不清理
- 先 remove worktree 再删 branch（反了 `branch -d` 会 fail）
- `git worktree remove` 前必须 cd 到主仓根（在 worktree 内跑会静默失败）
- 未提交改动 → remove 报错，不加 `--force`，用户先 stash

## Common Rationalizations

| 借口 | 现实 |
|---|---|
| "Review 差不多了，先 push 再改" | 全景会标 Review 状态，用户自己决定 |
| "先合了再跑 CI" | CI 是 PR 流程的一部分 |
| "worktree 保着占空间，顺手删了" | 全景让用户选 |
| "任务号懒得填" | 流转闭环是 Land 的一部分 |
| "force push 一下就好" | 先把 `force-with-lease` 风险写进新的完整全景；不做执行期追加确认 |
| "不在 worktree 里，全景/PR契约/reviewer/定时监控不适用" | **非 worktree 只影响清理项，其余全部照走** |
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
- 不要在全景确认后新增计划外交互 — 计划外风险停下报告，需要继续则生成新全景
- 不要自动 force push — 必须已在完整全景中明确列出并获确认
- 不要在 approve 前 merge — 判据 = 平台可合并 + ≥1 approve
- 不要假设 toolchain — 私域 git host 在全景中标待指定
- 不要在 worktree 内跑 `git worktree remove` — 先 cd 到 `$MAIN_ROOT`
- 不要删 branch 前没 remove worktree
- PR 轮询只走 `pr-check.mjs --watch` + `periodic-runner.mjs` 定时单源；不要再造平台专属 cron 分支
- 不要用 `nohup` / 系统 cron 托管自动合并——进程失联后无法处置冲突、权限变化和任务流转失败
- gh / bkt 特有坑 → 见 `references/pr-flow-gh.md` / `references/pr-flow-bkt.md`
