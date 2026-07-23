# MyJarvis 任务管理子系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 MyJarvis 任务管理子系统——一文件一 task + Obsidian Bases 5 视图 + Templater 模板 + nocode-evolve 的 /task 命令 8 sub-action, 跨两个仓.

**Architecture:** 三层 (L1 目标层复用 vault Flow/01-03 / L2 任务层 NEW `Flow/05-Tasks/yymm/<slug>.md` / L3 视图层 NEW `Flow/05-Tasks/views/tasks.base`). AI 命令 `/task` 在 nocode-evolve `commands/` 内, 单一入口 8 sub-action 路由.

**Tech Stack:** Obsidian markdown + frontmatter / Obsidian Bases YAML (1.9+ 原生) / Templater (Obsidian plugin, 已装) / Claude Code slash command markdown.

**Design Doc:** `docs/dev/3dot141/260521-02-task-management-system/task-management-system-design.md` (同目录, 3 轮 reviewer 收敛)

**注意**: 本系统非传统代码项目, 无单测框架. 验证全部走"手动操作 Obsidian / Claude Code, 观察行为 + design doc 单测 case 对照". TDD 节奏变成"写文件 → 验证 → commit" 三步.

---

## 文件结构 (跨两个仓)

```
MyJarvis vault (~/AI/MyJarvis/, 独立 git remote)
├── Flow/
│   └── 05-Tasks/                                      (NEW) 整个目录
│       ├── 2605/                                      (NEW)
│       │   ├── 260521-test-hammerspoon-double-tap.md  (NEW, Task 2) 示例 todo
│       │   └── 260521-write-fineReport-prd.md         (NEW, Task 2) 示例 done
│       └── views/
│           └── tasks.base                             (NEW, Task 1) Bases 5 视图
└── Meta/Templates/Templater/Template/
    ├── Task.md                                        (NEW, Task 4) Templater 录入模板
    ├── DailyNotes.md                                  (改, Task 3) 加 2 行 Bases 嵌入
    └── WeekPlan.md                                    (改, Task 3) 加 1 行 Bases 嵌入

nocode-evolve  (~/AI/nocode-evolve/, claude-code plugin)
├── commands/
│   └── task.md                                        (NEW, Task 5) /task 命令 8 sub-action
└── .claude-plugin/
    └── plugin.json                                    (改, Task 5) version minor +1 (0.41.0 → 0.42.0)
```

**Task 顺序与依赖**:
- Task 1 (tasks.base) → Task 2 (示例 task) [Task 2 验证依赖 Task 1 视图]
- Task 1 → Task 3 (模板嵌入) [Task 3 嵌入引用 base 文件]
- Task 1 + Task 2 → Task 4 (Task.md 模板) [验证依赖 Task 2 给视图灌数据]
- Task 5 (/task 命令) 独立, 可与 Task 1-4 并行——但**验证**依赖 Task 1-4 全部就位 (没 tasks.base 没 Templater 模板, /task 创建出来的文件没视图渲染)

实际执行顺序: **Task 1 → 2 → 3 → 4 → 5**, 线性. 每个 task 完成即 commit, 不积压.

---

## Task 1: 建 `tasks.base` Bases 视图配置 (vault)

**Files:**
- Create: `~/AI/MyJarvis/Flow/05-Tasks/views/tasks.base`

- [ ] **Step 1.1: 建目录结构**

```bash
mkdir -p ~/AI/MyJarvis/Flow/05-Tasks/views
```

Run + Expected: 目录建好, `ls ~/AI/MyJarvis/Flow/05-Tasks/` 显示 `views/`.

- [ ] **Step 1.2: 写 tasks.base 完整内容**

文件路径: `~/AI/MyJarvis/Flow/05-Tasks/views/tasks.base`

```yaml
filters:
  and:
    - file.hasTag("task")
    - file.inFolder("Flow/05-Tasks")

formulas:
  priority_label: 'if(priority == "P0", "🔴 P0", if(priority == "P1", "🟠 P1", if(priority == "P2", "🟡 P2", "🟢 P3")))'
  days_until_due: 'if(due, (date(due) - today()).days, "")'
  is_overdue: 'if(due, date(due) < today() && status != "done", false)'
  is_today: 'if(scheduled, date(scheduled) == today(), false)'
  goal_short: 'if(goal, goal, "📥 Inbox")'

properties:
  formula.priority_label:
    displayName: "优先级"
  formula.days_until_due:
    displayName: "剩余天数"
  formula.goal_short:
    displayName: "目标"
  formula.is_overdue:
    displayName: "是否逾期"
  scheduled:
    displayName: "计划日"
  est_min:
    displayName: "估时(分)"
  actual_min:
    displayName: "实际(分)"
  due:
    displayName: "截止日"

views:
  - type: table
    name: "今日任务"
    filters:
      and:
        - 'status != "done"'
        - 'status != "cancelled"'
        - 'formula.is_today == true'
    order:
      - formula.priority_label
      - file.name
      - formula.goal_short
      - est_min
    groupBy:
      property: priority
      direction: ASC
    summaries:
      est_min: Sum

  - type: table
    name: "今日完成"
    filters:
      and:
        - 'status == "done"'
        - 'done_date == today()'
    order:
      - formula.priority_label
      - file.name
      - formula.goal_short
      - actual_min
    summaries:
      actual_min: Sum

  - type: cards
    name: "Inbox 临时任务"
    filters:
      and:
        - 'status == "todo"'
        - '!goal'
    order:
      - formula.priority_label
      - file.name
      - scheduled

  - type: table
    name: "本周计划"
    filters:
      and:
        - 'status != "done"'
        - 'date(scheduled) >= today() - "7d"'
        - 'date(scheduled) <= today() + "7d"'
    order:
      - scheduled
      - formula.priority_label
      - file.name
      - formula.goal_short
    groupBy:
      property: scheduled
      direction: ASC

  - type: table
    name: "逾期"
    filters:
      and:
        - 'formula.is_overdue == true'
    order:
      - file.name
      - due
      - formula.days_until_due
      - formula.goal_short
```

- [ ] **Step 1.3: 验证 — Obsidian 打开 tasks.base**

操作: Obsidian 内打开 `Flow/05-Tasks/views/tasks.base`.

Expected:
- 5 个视图标签 (今日任务 / 今日完成 / Inbox 临时任务 / 本周计划 / 逾期) 在顶部可切换
- 每个视图当前**为空** (因为还没 task 数据), 但**不报 YAML 错**
- 如果某视图报错, 检查 formula 语法 (常见: `!goal` 在 Bases 里可能要写 `goal == ""` — 用 `'goal == ""'` 替代)

- [ ] **Step 1.4: commit (vault)**

```bash
cd ~/AI/MyJarvis
git add Flow/05-Tasks/views/tasks.base
git commit -m "feat(tasks): add tasks.base with 5 views (今日任务/今日完成/Inbox/本周计划/逾期)"
```

---

## Task 2: 建 2 个示例 task 文件 (vault)

**Files:**
- Create: `~/AI/MyJarvis/Flow/05-Tasks/2605/260521-test-hammerspoon-double-tap.md`
- Create: `~/AI/MyJarvis/Flow/05-Tasks/2605/260521-write-fineReport-prd.md`

- [ ] **Step 2.1: 建 yymm 目录**

```bash
mkdir -p ~/AI/MyJarvis/Flow/05-Tasks/2605
```

- [ ] **Step 2.2: 写示例 task 1 (todo 状态)**

文件路径: `~/AI/MyJarvis/Flow/05-Tasks/2605/260521-test-hammerspoon-double-tap.md`

```markdown
---
slug: test-hammerspoon-double-tap
title: 测试 Hammerspoon 双击触发率
status: todo
priority: P1
scheduled: 2026-05-21
goal: ""
due:
est_min: 30
actual_min:
outcome: ""
created_date: 2026-05-21 14:30
modified_date: 2026-05-21 14:30
done_date:
tags: [task]
---

# 测试 Hammerspoon 双击触发率

## 目标 (why)
跑 10 次 Cmd+Shift+T 测试豆包输入法的双击右 CMD 触发率, 找到 INPUT_SWITCH_DELAY / DOUBLE_TAP_GAP 的稳定值组合.

## 进展 (做了什么)
<!-- 做的过程中按时间逆序记 -->

## 时间日志
<!-- YYYY-MM-DD HH:MM-HH:MM (XXm) ... -->

## 卡点 / 风险
<!-- 遇到才记 -->

## 结论 / 产出
<!-- 必填 (done 时) -->

## 衍生任务
<!-- 选填 -->
```

- [ ] **Step 2.3: 写示例 task 2 (done 状态, 完整 body 6 段)**

文件路径: `~/AI/MyJarvis/Flow/05-Tasks/2605/260521-write-fineReport-prd.md`

```markdown
---
slug: write-fineReport-prd
title: 写完 FineReport 商业化 PRD
status: done
priority: P1
scheduled: 2026-05-21
goal: "[[2026-Q2-FineReport商业化]]"
due: 2026-05-25
est_min: 60
actual_min: 95
outcome: "[[260521-fineReport-marketplace-prd]]"
created_date: 2026-05-21 09:00
modified_date: 2026-05-21 16:30
done_date: 2026-05-21 16:30
tags: [task]
---

# 写完 FineReport 商业化 PRD

## 目标 (why)
完成商业化 PRD 初稿, 给法务过协议, 月底前对外宣发. 是 2026-Q2 FineReport 商业化目标的关键里程碑.

## 进展 (做了什么)
- 16:30  PRD v1 终稿 commit, 共 3200 字, 含定价 / SLA / 退款 3 节
- 15:00  跟 @Sam 对齐定价上限, 决定先按 199/月 测一个月
- 14:30  写 outline → 3 个核心模块: 定价 / SLA / 退款条款
- 13:00  调研竞品 Lark / Notion 定价结构 (见 [[260520-research-pricing]])
- 09:30  起稿, 沿用上次 brainstorming 结果

## 时间日志
- 2026-05-21 09:30–11:00  (90m)  写 outline + 调研
- 2026-05-21 14:00–15:30  (90m)  写定价节
- 2026-05-21 15:30–16:30  (60m)  对齐 + 终稿
- 合计: 95m (frontmatter actual_min)

## 卡点 / 风险
- 定价上限纠结半小时, 最后跟 @Sam 拍 199—参考点不足, 一个月后看数据再校准
- 退款条款引用了别处的 boilerplate, 法务可能要改

## 结论 / 产出
- 产出: [[Memory/05-Outputs/2605/260521-fineReport-marketplace-prd]]
- 决策: 199/月 试一个月; 退款条款待法务过审

## 衍生任务
- [[Flow/05-Tasks/2605/260522-法务审核-FineReport协议]]
- [[Flow/05-Tasks/2605/260601-收集-FineReport-定价反馈]]
```

- [ ] **Step 2.4: 验证 — Bases 视图渲染示例数据**

操作: Obsidian 打开 `Flow/05-Tasks/views/tasks.base`.

Expected:
- "今日任务" 视图: 1 行 (test-hammerspoon-double-tap, P1, 30m, 📥 Inbox)
- "今日完成" 视图: 1 行 (write-fineReport-prd, P1, FineReport, 95m), summary 显示 actual_min sum = 95
- "Inbox 临时任务" 视图 (cards): 1 张卡 (test-hammerspoon-double-tap, P1)
- "本周计划" 视图: 1-2 行 (本周 ± 7 天内未 done 的 task)
- "逾期" 视图: 0 行 (无 due 字段或 due > today 的 task)

如果视图为空但应有数据 → 检查 `file.hasTag("task")` 是否生效 (tags 写法应为 `tags: [task]` 不是 `tags: task`).

- [ ] **Step 2.5: commit (vault)**

```bash
cd ~/AI/MyJarvis
git add Flow/05-Tasks/2605/
git commit -m "feat(tasks): add 2 example task files (todo + done with full body)"
```

---

## Task 3: 改 Templater 模板预置嵌入 (vault)

**Files:**
- Modify: `~/AI/MyJarvis/Meta/Templates/Templater/Template/DailyNotes.md`
- Modify: `~/AI/MyJarvis/Meta/Templates/Templater/Template/WeekPlan.md`

- [ ] **Step 3.1: 改 DailyNotes.md — `## 今日计划` 段顶部加 Bases 嵌入**

操作: 用 Edit 工具改 `~/AI/MyJarvis/Meta/Templates/Templater/Template/DailyNotes.md`, 找到 `## 今日计划` 行, 在其后**插入**一行嵌入 (`### 重点任务` 之前):

旧:
```markdown
## 今日计划 (2025-08-07 周四)

根据本周计划，今日主要任务：

### 重点任务
```

新:
```markdown
## 今日计划 (2025-08-07 周四)

![[tasks.base#今日任务]]

根据本周计划，今日主要任务：

### 重点任务
```

- [ ] **Step 3.2: 改 DailyNotes.md — `## 总结` 段顶部加 Bases 嵌入**

同一文件, 找到 `## 总结` 行, 在其后插入嵌入:

旧:
```markdown
## 总结

> 一天结束后进行总结，只有执行 总结 功能时，才会填充这里的内容
```

新:
```markdown
## 总结

![[tasks.base#今日完成]]

> 一天结束后进行总结，只有执行 总结 功能时，才会填充这里的内容
```

- [ ] **Step 3.3: 改 WeekPlan.md — `## 本周事务` 段顶部加 Bases 嵌入**

操作: Edit `~/AI/MyJarvis/Meta/Templates/Templater/Template/WeekPlan.md`, 找到 `## 本周事务` 行, 在其后插入 (`### 项目事务` 之前):

旧:
```markdown
## 本周事务

> 本周的事务在这里写，手动写，无需生成

### 项目事务
```

新:
```markdown
## 本周事务

![[tasks.base#本周计划]]

> 本周的事务在这里写，手动写，无需生成

### 项目事务
```

- [ ] **Step 3.4: 验证 — Templater 新建 daily / weekly note**

操作:
1. Obsidian 内用 Templater 命令 (Cmd+P → "Templater: Create new note from template" → 选 DailyNotes) 新建一个 daily note 到 `Flow/04-Daily/2605/`
2. 同样新建 weekly note 到 `Flow/03-Weekly/2605/`

Expected:
- 新 daily note 在 `## 今日计划` 下自动渲染"今日任务" Bases 视图; 在 `## 总结` 下自动渲染"今日完成" 视图
- 新 weekly note 在 `## 本周事务` 下自动渲染"本周计划" 视图
- 如果嵌入显示 "file not found" — 检查 wikilink 路径解析 (Obsidian 设置 → 文件与链接 → "新链接的格式" 选 "shortest possible"; tasks.base 文件名要全局唯一)

- [ ] **Step 3.5: commit (vault)**

```bash
cd ~/AI/MyJarvis
git add Meta/Templates/Templater/Template/DailyNotes.md Meta/Templates/Templater/Template/WeekPlan.md
git commit -m "feat(tasks): embed tasks.base views in DailyNotes + WeekPlan templates"
```

---

## Task 4: 建 Task.md Templater 录入模板 (vault)

**Files:**
- Create: `~/AI/MyJarvis/Meta/Templates/Templater/Template/Task.md`

- [ ] **Step 4.1: 写 Task.md Templater 模板**

文件路径: `~/AI/MyJarvis/Meta/Templates/Templater/Template/Task.md`

```markdown
<%*
const title = await tp.system.prompt("Task title");
if (!title) { return; }

const priority = await tp.system.suggester(
  ["🔴 P0", "🟠 P1", "🟡 P2", "🟢 P3"],
  ["P0", "P1", "P2", "P3"],
  false,
  "Priority"
);
if (!priority) { return; }

const scheduledStr = await tp.system.prompt(
  "Scheduled (YYYY-MM-DD, default today)",
  tp.date.now("YYYY-MM-DD")
);

const goalStr = await tp.system.prompt(
  "Goal wikilink (e.g. [[2026-Q2-XXX]], empty = inbox)",
  ""
);

const estMinStr = await tp.system.prompt("Estimated minutes (optional, empty to skip)", "");

const slug = title
  .toLowerCase()
  .replace(/[^\w一-龥\s-]/g, "")
  .replace(/\s+/g, "-")
  .substring(0, 50);

const yymm = tp.date.now("YYMM");
const yymmdd = tp.date.now("YYMMDD");
const targetPath = `Flow/05-Tasks/${yymm}/${yymmdd}-${slug}`;

await tp.file.move(targetPath);

const now = tp.date.now("YYYY-MM-DD HH:mm");
const goalLine = goalStr ? `"${goalStr}"` : `""`;
const estMinLine = estMinStr ? `est_min: ${estMinStr}` : `est_min:`;
-%>
---
slug: <% slug %>
title: <% title %>
status: todo
priority: <% priority %>
scheduled: <% scheduledStr %>
goal: <% goalLine %>
due:
<% estMinLine %>
actual_min:
outcome: ""
created_date: <% now %>
modified_date: <% now %>
done_date:
tags: [task]
---

# <% title %>

## 目标 (why)
<!-- 必填 — 1-2 句, 期望产出什么, 跟哪个 goal 联动 -->

## 进展 (做了什么)
<!-- 做的过程中按时间逆序记: HH:MM ... -->

## 时间日志
<!-- 选填: YYYY-MM-DD HH:MM–HH:MM (XXm) ... -->

## 卡点 / 风险
<!-- 选填: 遇到才记 -->

## 结论 / 产出
<!-- 必填 (done 时): - 产出: [[...]] / - 决策: ... -->

## 衍生任务
<!-- 选填: [[Flow/05-Tasks/...]] -->
```

- [ ] **Step 4.2: 验证 — 通过 Templater 触发模板**

操作:
1. Obsidian Cmd+P → "Templater: Create new note from template" → 选 Task
2. 弹 prompt 1 → 输入 "测试 Task 模板"
3. 弹 prompt 2 (suggester) → 选 "🟡 P2"
4. 弹 prompt 3 → 留默认 (今天)
5. 弹 prompt 4 → 留空 (inbox)
6. 弹 prompt 5 → 输入 "20"

Expected:
- 文件创建到 `Flow/05-Tasks/2605/<yymmdd>-测试-task-模板.md`
- frontmatter 全字段填妥 (status=todo, priority=P2, scheduled=今天, goal="", est_min=20)
- body 6 段骨架完整
- Bases 今日任务视图自动渲染出新 task

如果中文 title slug 不理想 (如 slug="测试-task-模板" 含中文) — slug 字段可手改; 不影响视图渲染 (Bases 不挑剔 slug 形式).

- [ ] **Step 4.3: commit (vault)**

```bash
cd ~/AI/MyJarvis
git add Meta/Templates/Templater/Template/Task.md
git commit -m "feat(tasks): add Task.md Templater template (quickadd entry)"
```

---

## Task 5: 写 /task 命令 + 升 plugin.json (nocode-evolve)

**Files:**
- Create: `~/AI/nocode-evolve-design_task-management-system/commands/task.md`
- Modify: `~/AI/nocode-evolve-design_task-management-system/.claude-plugin/plugin.json` (version: 0.41.0 → 0.42.0)

- [ ] **Step 5.1: 写 /task 命令完整内容**

文件路径: `~/AI/nocode-evolve-design_task-management-system/commands/task.md`

```markdown
---
description: 任务管理子系统单一入口, AI 解析意图分发到 8 个 sub-action (add / update / done / cancel / wrap-day / carry-over / breakdown / start-week)
argument-hint: <自然语言意图>
---

# /task: MyJarvis 任务管理子系统单一入口

把用户的自然语言输入解析成 8 个 sub-action 之一, 操作 `~/AI/MyJarvis/Flow/05-Tasks/yymm/<yymmdd>-<slug>.md` task 文件 + 跟 Obsidian Bases 视图渲染配合.

设计文档: `docs/dev/3dot141/260521-02-task-management-system/task-management-system-design.md` (含完整业务流 BF0-BF7 + 单测 case + 方案选型).

## 入参 ($ARGUMENTS)

**必填**——一句话自然语言. 例:
- `/task 记一个 测试 Hammerspoon 双击 priority P1`
- `/task PRD 写完了 95 分钟 产出 [[260521-prd]]`
- `/task 取消法务那条`
- `/task 今天做了什么`
- `/task 上周没做完的拉过来`
- `/task 周一了, 准备本周`

无参 → 报错"请说明你要做什么. 用法: `/task <自然语言意图>`. 见命令开头 8 sub-action 关键词例."

## 环境依赖

- `~/AI/MyJarvis/` vault 路径存在
- `~/AI/MyJarvis/Flow/05-Tasks/views/tasks.base` 已建 (Task 1)
- `~/AI/MyJarvis/Meta/Templates/Templater/Template/Task.md` 已建 (Task 4, 备用录入入口)
- 任一不满足 → 报错 + 引导用户走 plan 文档对应 Task

## BF0 — Intent Router

AI 按以下关键词把 `$ARGUMENTS` 路由到 sub-action:

| sub-action | 触发关键词 |
|---|---|
| **add** | "记一个 / 加个 / 新建 / 添加 / 加任务" |
| **update** | "改 X 的 Y / 把 X 改成 / 更新 X 的 Y" (含 field + new value) |
| **done** | "X 做完了 / 完成 X / 标 X 完成 / X done" (含 actual_min, 可含 outcome) |
| **cancel** | "取消 X / 不做了 / cancel X" |
| **wrap-day** | "今天做了什么 / 日终复盘 / wrap-day / 总结今天" |
| **carry-over** | "上周没做完 / 拉过来 / carry over / 延续上周" |
| **breakdown** | "拆 / 拆解本周 / 拆成 daily / breakdown" |
| **start-week** | "周一了 / 准备本周 / start week" |

intent 冲突 (如"记一个 PRD 做完了" 含 add + done 两关键词): 取**最长后缀匹配**——句末关键词通常是真意图. 冲突仍无法决议 → askUser 二选一.

intent 无法识别 → 报错列上述关键词例, 让用户重述.

---

## BF1 — add (创建 task)

**触发**: 用户喊"记一个 X / 加个 X / 新建 X".

**AI 抽参**:
- `title` (必)
- `priority` (默 P2; 用户说 P0/P1/P2/P3 或 "最重要/重要/一般/次要" 时按对应档)
- `scheduled` (默 today; 用户说"明天/周三/某月某日" 等转换)
- `goal` (用户说"放到 X 目标下" / 提供 wikilink 时填; 否则空 = inbox)
- `est_min` (用户说"30 分钟 / 半小时 / 1 小时" 等转换)
- `why` (用户说"为了 X / 因为 Y" 时摘出)

**执行**:
1. `slug = slugify(title)` (kebab-case, 3-7 词, 中英文均可, 长度 ≤50)
2. `yymm = format(today, "YYMM")`, `yymmdd = format(today, "YYMMDD")`
3. `path = "~/AI/MyJarvis/Flow/05-Tasks/" + yymm + "/" + yymmdd + "-" + slug + ".md"`
4. 检查 `path` 是否已存在 → 存在则报错 "slug 冲突, 请改 title"; 不存在继续
5. 不存在 `Flow/05-Tasks/yymm` 目录 → `mkdir -p`
6. Write 文件, frontmatter + body 骨架 (6 段, why 填入"目标"段, 其余段空骨架)

**Frontmatter 模板**:

```yaml
---
slug: <slug>
title: <title>
status: todo
priority: <P0/P1/P2/P3>
scheduled: <YYYY-MM-DD>
goal: <wikilink or "">
due:
est_min: <int or empty>
actual_min:
outcome: ""
created_date: <YYYY-MM-DD HH:mm>
modified_date: <YYYY-MM-DD HH:mm>
done_date:
tags: [task]
---
```

**报告**: `"task created at <path>"` (短路径, 跟 yymm/<filename> 显示).

---

## BF2 — done (标完成)

**触发**: 用户喊"X 做完了 / 完成 X / 标 X 完成".

**AI 抽参**:
- `query` (必, task 描述关键词)
- `actual_min` (必, 用户没说时 askUser 追问"花了多少分钟?")
- `outcome` (选, 用户说"产出 [[X]] / 链接 Y" 时填)

**执行**:
1. glob `~/AI/MyJarvis/Flow/05-Tasks/*/*` 找 frontmatter `status: todo` + title/slug 模糊匹配 `query` 的 task
2. 0 候选 → 报错 "no matching todo task for: <query>"
3. 多候选 → askUser 列候选让用户选 (显示 path + title)
4. 1 候选 → 改 frontmatter: `status: done`, `actual_min: <n>`, `outcome: <wikilink or "">`, `done_date: <now>`, `modified_date: <now>`
5. 若 outcome 非空, body `## 结论 / 产出` 段追加一行 "- 产出: <outcome>" (段已存在则末尾追加, 不覆盖)

**报告**: `"task done. <slug>, actual_min=<n>"`

---

## BF6 sub-1 — update (改单字段)

**触发**: 用户喊"改 X 的 priority 改成 P0" / "把 Y 的 scheduled 改到周三".

**AI 抽参**:
- `query` (必)
- `field` (必)
- `new_value` (必)

**白名单字段**:
- **always-allowed**: `scheduled`, `due`, `priority`, `goal`, `est_min`, `title`
- **done-only** (status=done 才能改): `actual_min`, `outcome`
- 其他字段 (slug / created_date / tags 等) → 报错 "not updatable, allowed: <list>"

**执行**:
1. searchTasks 找候选 (0/多候选处理同 BF2)
2. 校验 field 在白名单
3. field 是 done-only 类 → 校验 task.status == "done", 否则报错 "use /task done to set actual_min/outcome on todo task"
4. 改 frontmatter (单字段 patch + modified_date 刷新)
5. field=="scheduled" 时**不**触发 carried_from (那是 BF3 carry-over 的语义)

**报告**: `"updated <slug>.<field> = <new_value>"`

---

## BF6 sub-2 — cancel (取消)

**触发**: 用户喊"取消 X / 不做了 X".

**AI 抽参**: `query` (必)

**执行**:
1. searchTasks 仅 status=todo (cancel 不允许 done 状态; 已 done 想撤回需走 update + reopen 流程, 暂不支持)
2. 0/多候选处理同 BF2
3. 改 frontmatter: `status: cancelled`, `modified_date: <now>`
4. **不清空** actual_min / outcome (cancel 是中止, 不删历史)

**报告**: `"cancelled <slug>"`

---

## BF5 — wrap-day (日终复盘)

**触发**: 用户喊"今天做了什么 / 日终复盘 / 总结今天".

**AI 抽参**: `date` (默 today, 用户可指定"昨天 / 某日")

**执行**:
1. listTasks (frontmatter `done_date == date`) → completed list
2. listTasks (frontmatter `scheduled == date` && `status == todo`) → in_progress list
3. 总耗时 = sum(t.actual_min for t in completed)
4. 按 goal 分组耗时
5. 按 priority 分组耗时 (用于跟方法论比例对比: P0 40-50% / P1 30-40% / P2 10-20% / P3 0-10%)
6. AI 生成自然语言总结, 显示给用户读 (不写盘)

**输出格式 (display only)**:

```
📅 <date> 日终复盘

✅ 完成 <N> 条 / 总耗时 <X>h <Y>m

按目标分组:
- <goal1>: <耗时 + 占比>
- <goal2>: <耗时 + 占比>
- 📥 Inbox: <耗时 + 占比>

按优先级分组 (对照方法论目标):
- 🔴 P0: <耗时占比>% (目标 40-50%) <✅ / ⚠️ 偏离>
- 🟠 P1: <耗时占比>% (目标 30-40%)
- 🟡 P2: <耗时占比>% (目标 10-20%)
- 🟢 P3: <耗时占比>% (目标 0-10%)

未完成 (scheduled=<date> 仍 todo): <N> 条
- <task1>
- <task2>
```

---

## BF3 — carry-over (上周延续)

**触发**: 用户喊"上周没做完的拉过来 / 延续上周".

**AI 抽参**: `weekRange` (默 lastWeek = [lastMonday, lastSunday])

**执行**:
1. listTasks (scheduled in [weekRange.start, weekRange.end] && status=todo) → candidates
2. 0 候选 → return `{ quit: false, count: 0, message: "no carry-over candidates from <range>" }`
3. 渲染候选表格 (Markdown table 给用户读):

```
| # | title | priority | 原 scheduled | goal |
|---|---|---|---|---|
| 1 | <task1> | P0 | 2026-05-15 | <goal> |
| ... |
```

4. 提示短码语法:

```
短码:
  go          全部延续到 nextMonday (默认)
  1 today     #1 延续到今天
  2 mon       #2 延续到下周一
  3 x         #3 取消 (status=cancelled)
  4 keep      #4 保持原 scheduled (会显示逾期)
  q / quit    退出 (不动任何文件)
```

5. 读用户短码 → 解析 → 逐条应用:
   - "today": newScheduled = today
   - "mon": newScheduled = nextMonday
   - "x": updateFrontmatter status=cancelled
   - "keep": 不动
   - 其他动作: updateFrontmatter `{ scheduled: newScheduled, carried_from: <原 scheduled>, modified_date: now }`
6. quit → return `{ quit: true, count: 0 }`

**报告**: `"carried <N> tasks"` (count = 实际改动数, 不含 cancelled).

---

## BF4 — breakdown (从 weekly 拆 daily)

**触发**: 用户喊"拆本周计划 / 拆成 daily".

**AI 抽参**: `weeklyNotePath` (默 currentWeeklyNote: `~/AI/MyJarvis/Flow/03-Weekly/<yymm>/<yymmdd>-week<N>.md`, 推断当前周)

**执行**:
1. 路径不存在 → 报错 "weekly note not found at <path>, create it first"
2. read weekly note, extractSection "## 本周事务" (vault WeekPlan.md 模板真实段名)
3. 段缺失 → 报错 "weekly note missing '## 本周事务' section, add it first"
4. AI 拆解段内目标, 注入 priority 分配 (P0 45% / P1 35% / P2 15% / P3 5% 中位; 不严格按此, 看实际任务性质)
5. 单日 ≤5 条 task; 平均分散到周一-周日, 重要的往周初
6. 渲染候选表格:

```
| # | title | priority | scheduled | est_min | goal |
|---|---|---|---|---|---|
| 1 | <task1> | P1 | 2026-05-21 | 60 | <weekly wikilink> |
| ... |
```

7. 短码语法 (扩展 BF3 短码):

```
短码:
  go            全部建文件
  - 3,4,5       跳过 #3,4,5
  2 P0          把 #2 priority 改 P0
  2 wed         把 #2 scheduled 改本周三
  2 /new-slug   改 #2 slug
  q / quit      退出 (不动任何文件)
```

8. 读用户短码 → 应用到 candidates → 逐条调 BF1 task_add 创建文件
9. 每条 task 自动设 `goal = "[[<weeklyNotePath>]]"`
10. quit → return `{ quit: true, count: 0 }`

**报告**: `"breakdown created <N> tasks"`

---

## BF7 — start-week (周一启动复合工作流)

**触发**: 用户喊"周一了 / 准备本周 / start week".

**执行**: 串行两阶段
1. **阶段 1**: 调 BF3 carry-over(lastWeek)
2. BF3 返回 `{quit, count}`:
   - quit=true → 报告 "start-week 在阶段 1 carry-over 取消, 未延续 task; 阶段 2 breakdown 跳过", 早返
   - quit=false → 继续
3. **阶段 2**: `weeklyPath = currentWeeklyNote()`
4. 路径不存在 → 报错 "当前周 weekly note 不存在: <path>, 请先建 weekly note"
5. 调 BF4 breakdown(weeklyPath)
6. BF4 返回 `{quit, count}`:
   - quit=true → 报告 "start-week: 延续 <N> 个 task; 阶段 2 breakdown 被用户取消, 无新增 task"
   - quit=false → 报告 "start-week: 延续 <N> + 拆出 <M> 个 task"

---

## 异常与失败模式

| BF | 异常 | 触发 | 处理 |
|---|---|---|---|
| BF0 | intent 无法识别 | 输入不匹配关键词 | 提示重述 + 列关键词例 |
| BF1 | slug 冲突 | 同 yymmdd-slug 已存在 | 报错让用户改 title |
| BF1 | yymm 目录缺失 | 首次该月使用 | 自动 mkdir -p |
| BF2 | query 0 候选 | 描述不在 todo list | 报错让用户描述更精确 |
| BF2 | query 多候选 | 关键词撞 | askUser 让用户选 |
| BF2 | actual_min 缺省 | 用户没说耗时 | askUser 追问 |
| BF3 | 用户短码无法识别 | NL ("改成 P0") 而非短码 | 报错 + 示例短码, 等用户重打, 不接受 NL |
| BF3 | 短码 # 越界 | "#7 today" 但只 5 候选 | 报错 "#7 不存在, 候选 1-5" |
| BF4 | weekly note 不存在 | 路径推错 / 没建 | 报错让用户先建 weekly |
| BF4 | 缺 "## 本周事务" 段 | 没用模板 | 报错 + 指引添加该段 |
| BF6 | update field 不在白名单 | 用户改 slug 等不可改字段 | 报错 + 列允许字段 |
| BF6 | update actual_min/outcome 时 status ≠ done | todo 状态改 done-only 字段 | 报错 + 引导走 /task done |
| BF7 | 当前周 weekly note 不存在 | 周一未建 | 报错让用户先建 |

## 反模式

- ❌ AI 自动延续 carry-over 候选不让用户拍 — 必须表格短码确认
- ❌ AI 自动建 weekly note 替用户写 plan — weekly plan 是 user-content, AI 不替写
- ❌ 改 done 状态的 task 的 status 字段 (走 cancel 后悔了不能 reopen) — 暂不支持 status 回退
- ❌ NL 接受短码场景 (BF3 / BF4) — 短码必须严格语法, AI 解析 NL 失败模式不是"懂/不懂" binary 而是"懂错", 容错收益远低于误执行风险 (跟 sediment 一致)
- ❌ 把 `Flow/05-Tasks/` 路径写死在命令逻辑里 — 应该用 `~/AI/MyJarvis/` 推断 vault root, 后续支持其他 vault path
```

- [ ] **Step 5.2: 升 plugin.json 版本**

文件路径: `~/AI/nocode-evolve-design_task-management-system/.claude-plugin/plugin.json`

Edit `"version": "0.41.0"` → `"version": "0.42.0"` (minor 升级, 见 CLAUDE.md "新增 hook / skill / 兼容性增强 = minor").

- [ ] **Step 5.3: 验证 — Claude Code 重启后喊 /task 测试**

操作:
1. 退出当前 Claude Code 会话, 重新 `claude` (让插件 reload)
2. 在新会话喊以下测试 case (对应 design doc 单测):
   - `/task 记一个 测试 task 命令 priority P2` → 应创建 task 文件 (case 1.1)
   - `/task 测试 task 命令 做完了 5 分钟` → 应标 done (case 2.1)
   - `/task 改 测试 的 priority 改成 P0` → BF6 update (case 6.1)
   - `/task 取消 一个不存在的 task` → BF2 0 候选错 (case 2.2)
   - `/task 今天做了什么` → BF5 wrap-day (case 5.1)
   - `/task 上周没做完的拉过来` → BF3 carry-over (case 3.x)

Expected:
- 每个 case AI 路由到正确 sub-action
- BF1 创建文件后, Obsidian Bases 今日任务视图自动渲染新 task
- BF2 标 done 后, 今日完成视图自动渲染
- BF5 输出按 design doc 格式, 含目标分组 + priority 比例对比方法论

如果 AI 路由不对 → 检查 `/task` 命令开头 8 sub-action 关键词表是否清晰可识别.

- [ ] **Step 5.4: commit (nocode-evolve worktree)**

```bash
cd ~/AI/nocode-evolve-design_task-management-system
git add commands/task.md .claude-plugin/plugin.json
git commit -m "feat(command): add /task with 8 sub-actions, bump v0.41.0→0.42.0

8 sub-action 路由: add / update / done / cancel / wrap-day / carry-over / breakdown / start-week
跟 MyJarvis vault Flow/05-Tasks/ + tasks.base + Templater 模板配合
设计文档: docs/dev/3dot141/260521-02-task-management-system/task-management-system-design.md (3 轮 reviewer 收敛)"
```

---

## Self-Review Checklist

执行前 writer 自己跑一遍:

- [ ] **Spec 覆盖**: 翻 design doc 每节, 能不能点到 plan 里某个 task 实现?
  - L1 目标层: 不动, 复用 vault Flow/01-03 ✓
  - L2 任务层: Task 1 (tasks.base) + Task 2 (示例 task)
  - L3 视图层: Task 1 + Task 3 (模板嵌入)
  - Templater 录入: Task 4
  - /task 命令 8 sub-action: Task 5
  - plugin.json 升版本: Task 5 合并
- [ ] **Placeholder 扫描**: 无 "TBD / TODO / fill in details"
- [ ] **Type 一致**: BF1-BF7 函数签名跟 design doc 业务流对得上
- [ ] **跨仓 commit**: vault 4 个 commit (Task 1-4), nocode-evolve 1 个 commit (Task 5), 不混淆
- [ ] **验证步骤**: 每个 Task 含具体 Obsidian/Claude Code 操作 + Expected 行为
- [ ] **依赖顺序**: Task 1 → 2 → 3 → 4 → 5 线性, 每步可独立 commit + verify

---

## 已知风险 / 后续 follow-up

下列在 design doc Review Log Q 答复里 skip, 实施时遇到再处理:

- **Q1 slugify 中文**: Task.md Templater 模板 用简单 `replace(/[^\w一-龥\s-]/g, "")` 保留中文字符 + 替换空格为 `-`. /task 命令的 slug 由 AI 生成 (含语义翻译). 二者不一致, 由用户在 Task.md 录入时自己决定 slug 形式. 后续如果不一致影响视图, 加 plan stage 2.
- **Q2 tasks.base 文件名 vault 全局唯一**: 当前 vault 别处无同名, 风险可接受. 未来若冲突走"全路径嵌入" `![[Flow/05-Tasks/views/tasks.base#视图名]]`.
- **Q3 短码语法与 sediment 不统一**: 有意不统一. plan 中保持 BF3 (today/mon/x/keep/q) + BF4 (go/-N/N P0/N wed/N /slug/q) 两套.
- **历史 daily 的 `- [ ]` 迁移**: 不迁移. Backward-compatible — 新建 daily 自动嵌入 Bases, 老 daily 保留原状.
