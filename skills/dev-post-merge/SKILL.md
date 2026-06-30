---
name: dev-post-merge
description: "Post-merge actions — extract task IDs from commits and transition Lark/Feishu task states, with extensibility for notifications and changelog. Use when dev-land routes here after merge, or standalone when user says \"PR合了/流转任务/合并后流转/任务状态改一下\". Not for: pre-merge actions (dev-finish-branch), code review (dev-review)."
---

# dev-transition — 合并后流转

代码合并后的收尾动作。当前：飞书任务流转。预留：通知、changelog、部署触发。

## 触发

- dev-land Step 3 调用（合并后）
- 用户直接说「PR 合了 / 流转任务 / 合并后流转 / 任务状态改一下」

## Step 1: 提取任务号

从 merge range 的 commit messages 提取飞书任务号：
- `#f-xxx` / `#g-xxx` / `#m-xxx`（Meego 工作项 ID 格式）
- 没有任务号 → 报告"未找到任务号"，跳过 Step 2

## Step 2: Lark 任务流转

调 `nocode-evolve:lark-project`，按 `lark-project/references/transition.md` 流转状态。

典型流转：组员开发 → 研发已改待BUILD。

**前置条件**：
- 有 Step 1 提取到的任务号
- FeishuProjectMcp 可用

不满足 → 跳过，报告原因，不报错。

## Step 3: 其他 post-merge 动作（预留）

当前为空。扩展位：
- 通知（Slack / 飞书群 / 邮件）
- Changelog 条目生成
- 部署触发 / 灰度推进

新增动作加在本 step 内，每项独立 try — 一项失败不阻塞其余。

## Exit Gate

- [ ] 飞书任务已流转（有任务号时）或已标注跳过
- [ ] 其他 post-merge 动作已完成或已跳过

## 不要

- 不要在 merge 前调本 skill — 这是 post-merge 动作
- 不要因 MCP 不可用报错阻塞 — 跳过 + 报告，不影响收尾
- 不要对非组员开发状态的任务强行流转 — 状态不对时报告让用户判断
