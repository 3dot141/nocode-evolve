# post-merge — 合并后流转（原 dev-post-merge，已并入 dev-finish-branch）

代码合并后的收尾动作。原独立 skill `dev-post-merge` 并入本 reference，由 dev-finish-branch 在合并后调用，或用户直接说「PR 合了 / 流转任务」时进入。

当前：飞书任务流转。预留：通知、changelog、部署触发。

## 何时进入

- **Option 1（本地 merge）**：merge 成功后，commit range 有任务号
- **Option 2（PR 路径）**：pr-watch 输出 `PR_WATCH_RESULT merged worktree=<p> tasks=<ids>`，`tasks` 非空
- **用户直接说**「PR 合了 / 流转任务 / 合并后流转 / 任务状态改一下」

## Step 1: 提取任务号

飞书任务号格式：`#f-xxx` / `#g-xxx` / `#m-xxx`（Meego 工作项 ID）。

- **PR 路径**：pr-watch 已从 commit 提取并传在 `PR_WATCH_RESULT ... tasks=<ids>`（逗号分隔），直接用
- **Merge 路径**：从 merge range 提取
  ```bash
  git log "<base>..<merged-head>" --format=%B | grep -oE '#[fgm]-[a-z0-9]+' | sort -u
  ```
- 没有任务号 → 报告"未找到任务号"，跳过 Step 2

## Step 2: Lark 任务流转

调 `nocode:lark-project`，按 `lark-project/references/transition.md` 流转状态到**决策线定死的目标状态**（PR 路径在 prflow Step 0 决策线已确认；典型流转：组员开发 → 研发已改待BUILD）。

**前置条件**：有 Step 1 提取到的任务号 + FeishuProjectMcp 可用。

不满足 → 跳过，报告原因，不报错。

## Step 3: 其他 post-merge 动作（预留）

扩展位（当前为空）：通知（Slack / 飞书群 / 邮件）、Changelog 条目、部署触发 / 灰度推进。每项独立 try——一项失败不阻塞其余。

## 不要

- 不要在 merge 前进入本流程 — 这是 post-merge 动作
- 不要因 MCP 不可用报错阻塞 — 跳过 + 报告，不影响收尾
- 不要对非组员开发状态的任务强行流转 — 状态不对时报告让用户判断
