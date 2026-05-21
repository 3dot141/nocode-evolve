---
type: design-doc
topic: MyJarvis vault 任务管理子系统 (一 task 一文件 + Obsidian Bases + /task 单命令多 sub-action)
date: 260521
author: 3dot141
status: draft
last_updated: 260521
---

# Design Doc: MyJarvis 任务管理子系统

## 背景

**核心问题**: MyJarvis vault 当前 todo 散落在日记 `Flow/04-Daily/YYMM/yymmdd-日记.md` 里, 用普通 GFM `- [ ]` 自由文本, **没结构化字段, 没稳定 ID, 没父子关系, 没时间统计**——月底回顾时, 用户面对 30 个 daily 文件里散落的几百个 `- [ ]`, 看不出"做了什么 / 花了多少时间 / 跟哪个目标关联". 调研 (260521 探索) 实证:

- 翻 `260303-日记.md` 真实例子: "知识沉淀: - [ ] 双轨商业化模式设计思路 → Knowledge/2-Outputs/" 这种条目跟"最重要的3件事 / 其他任务 / 明日计划" 多段混杂, 跨日聚合靠 dataview parse inline 文本——工程上脆弱 (任何文本格式漂移都让 query 崩)
- 时间记录仅在少数 daily 用了 `- 10:04 添加任务：xxx` 这种约定 (见 `260228-日记.md`), 但**没有"实际耗时"字段**——dataview 算不出"本周时间分布"
- task-management.md 方法论文档定义了 P0/P1/P2/P3 (40-50% / 30-40% / 10-20% / 0-10% 时间分配) + Annual→Daily 等级树, **但实际 vault 落不下来**——因为 `- [ ]` 自由文本表达不了 priority / hierarchy

**附带问题** (本 doc 一并解):

- "从上到下拆解" 落不了——weekly plan 是手写段落, 跟 daily task 没自动联系, 用户每周手动拆耗时且容易漏
- "上周未完延续" 没机制——逾期任务在旧 daily 里"沉了", 不被本周视图渲染, 容易遗忘
- 视图统一回顾缺位——没有一个地方能看"今天 / 本周 / 本月 各做了什么"

**不解决的代价**: 用户已经在 vault 用了几个月日记+todo, 但月底回顾价值低; OKR 从上到下拆解能力始终没建起来; 时间分配方法论 (P0-P3 比例目标) 没有实测数据校准.

## 目标

- **一 task 一文件**, 文件存在 `Flow/05-Tasks/yymm/<yymmdd>-<slug>.md`, **CRUD 稳定可寻址** (文件路径 = ID)
- task 含完整 **frontmatter 强字段** (status / priority / scheduled / due / est_min / actual_min / outcome / goal / carried_from) + **body 6 段** (目标 / 进展 / 时间日志 / 卡点 / 结论 / 衍生), 前 2 段必填后 4 选填
- **Obsidian Bases** (单一 `.base` 文件 5 视图) 统一渲染: 今日任务 / 今日完成 / Inbox / 本周计划 / 逾期
- 视图嵌入由 **Templater 模板预置** (`DailyNotes.md` / `WeekPlan.md` 模板里加 `![[tasks.base#视图名]]` 行)——用户每次按模板新建 daily / weekly note 时自动渲染. 历史 daily / weekly 不改 (backward-compatible, 不强制迁移); monthly note 与 goal note 用户按需手动加. **用户使用习惯不变**——仍打开 daily note, 上半是 Bases 渲染的今日任务, 中间手写流水, 下半是今日完成
- AI 单命令 `/task` 含 **8 sub-action**: add / update / done / cancel / wrap-day / carry-over / breakdown / start-week
- 用户每天总介入时长 **≤ 10 分钟** (3-5 次原子操作 + 1 次复盘); 周一集中介入 ≤ 15 分钟 (carry-over + breakdown)

## 架构

### 架构图

```
+------------------------- Obsidian Vault (~/AI/MyJarvis/) ----------------------+
|                                                                                |
|   L1: 目标层  Flow/01-Yearly/  Flow/02-Monthly/  Flow/03-Weekly/               |
|        一文件一目标, frontmatter parent: [[父目标]] 形成 hierarchy tree         |
|                       ▲                                                        |
|                       │ goal: [[父节点]] wikilink                              |
|                       │                                                        |
|   L2: 任务层  Flow/05-Tasks/yymm/<yymmdd>-<slug>.md   (NEW 目录)               |
|        一文件一 task, frontmatter status/priority/scheduled/est_min/...        |
|        body 6 段: 目标 / 进展 / 时间日志 / 卡点 / 结论 / 衍生                   |
|                       ▲                                                        |
|                       │ Bases YAML filter / formula / groupBy 引用 frontmatter  |
|                       │                                                        |
|   L3: 视图层  Flow/05-Tasks/views/tasks.base   (NEW)                            |
|        单 .base 文件配置 5 视图 (今日任务 / 今日完成 / Inbox / 本周计划 / 逾期)  |
|                       │                                                        |
|                       │ ![[tasks.base#视图名]] markdown embed                  |
|                       ▼                                                        |
|   渲染目标:  Flow/04-Daily/YYMM/yymmdd-日记.md     (今日任务 + 今日完成)        |
|              Flow/03-Weekly/YYMM/yymmdd-week.md    (本周计划)                  |
|              Flow/02-Monthly/YYMM/yymm-月度.md     (逾期 + 本月统计)            |
|              Goal note (按 goal filter 关联任务)                               |
|                                                                                |
+----------------------------+---------------------------------------------------+
                             │ AI 命令读写
                             │
                  +----------▼--------------------+
                  | /task <user-text>             |
                  | (nocode-evolve commands/)     |
                  |                               |
                  |  BF0 router → parseIntent     |
                  |               │               |
                  |  ┌────────────┴────────────┐  |
                  |  │ 单条 sub-action         │  |
                  |  │   BF1 add / update      │  |
                  |  │   BF2 done / cancel     │  |
                  |  └────────────┬────────────┘  |
                  |  ┌────────────┴────────────┐  |
                  |  │ 周期工作流 sub-action    │  |
                  |  │   BF3 carry-over         │  |
                  |  │   BF4 breakdown          │  |
                  |  │   BF5 wrap-day           │  |
                  |  │   start-week = BF3 + BF4 │  |
                  |  └─────────────────────────┘  |
                  +-------------------------------+
```

### 流程图

一天的工作流时间线 (用户视角):

```
09:00  打开 Obsidian → daily note 自动渲染今日任务 (Bases)  ────→  开始做事
                                                              │
                                                              ↓
工作中  /task 记一个 调研 Cursor 1.5 P2  ────→  AI: BF1 add → 新 task 文件
                                                              │
                                                              ↓
工作中  在 task 文件 ## 时间日志 段手写  ────→  Bases 视图自动刷新
        - 10:30-11:00 (30m)  跑 Hammerspoon 测试
                                                              │
                                                              ↓
12:00  /task PRD 写完了 95m 产出 [[260521-prd]]  ──→  AI: BF2 done → 标完成
                                                              │
                                                              ↓
22:00  /task wrap-day  ──────────────────→  AI: BF5 → 总结今日完成 + 时间分布
                                                              │
                                                              ↓ (周一)
周一   /task 周一了, 准备本周  ──────────────→  AI: start-week
                                              ├─ BF3 carry-over (上周延续)
                                              └─ BF4 breakdown (拆本周计划)
```

### 时序图

单次 `/task PRD 做完了 95m 产出 [[260521-prd]]` (BF2 done) 调用:

```
用户                   AI 路由器              Vault 文件系统           Obsidian (实时)
 │                       │                      │                        │
 │── /task PRD 做完了 ──→│                      │                        │
 │                       │── parseIntent ──┐    │                        │
 │                       │←─ "done" ───────┘    │                        │
 │                       │── searchTasks ──────→│                        │
 │                       │                      │ glob Flow/05-Tasks/*/*  │
 │                       │                      │  match query "*PRD*"   │
 │                       │←─ [task-1] ──────────│                        │
 │←── 候选 1 条: PRD ────│                      │                        │
 │── 确认 ──────────────→│                      │                        │
 │                       │── updateFrontmatter ─→│                        │
 │                       │                      │ status=done            │
 │                       │                      │ actual_min=95          │
 │                       │                      │ outcome=[[260521-prd]] │
 │                       │                      │ done_date=now          │
 │                       │── appendBody ───────→│                        │
 │                       │                      │ ## 结论 / 产出 段       │
 │                       │                      │── 写盘 ────────────────→│
 │←── 已标 done ─────────│                      │                        │ Bases 视图重渲染
 │                       │                      │                        │ daily note 自动刷新:
 │                       │                      │                        │  "今日完成" 多一行
```

### 文本总结

整体架构是**三层独立 + AI 命令编排**:

**L1 目标层**复用 vault 现有 `Flow/01-Yearly` ~ `03-Weekly` 子目录, 一文件一目标, frontmatter `parent: [[父目标]]` 形成 hierarchy tree (Quarterly → Monthly → Weekly).

**L2 任务层** (新增) 每条 task 一个 md 文件落 `Flow/05-Tasks/yymm/<yymmdd>-<slug>.md`. frontmatter 是 strongly-typed 数据 (status / priority / scheduled / due / est_min / actual_min / outcome / goal / carried_from), 是后续视图查询和 AI 命令操作的对象. body 是富文本回顾内容, 6 段固定结构 (目标 / 进展 / 时间日志 / 卡点 / 结论 / 衍生) 让月底回顾时**眼到即知**.

**L3 视图层**用 Obsidian Bases (Obsidian 1.9+ 官方原生, 非第三方插件), 单一 `tasks.base` 文件配置 5 视图通过 frontmatter 字段查询聚合, 嵌入到 daily / weekly / monthly / goal note (用 `![[tasks.base#视图名]]`). **用户不改使用习惯**——仍打开 daily note 看, 但上半是 Bases 渲染的今日任务自动列表.

**AI 命令 /task** 是用户的批量操作入口, 单一命令多 sub-action 路由——简单原子操作 (add/update/done/cancel) 用户口语化触发, 复杂工作流 (carry-over / breakdown / start-week / wrap-day) AI 提议候选 + 用户表格短码确认 + 批量写盘. **不接管单条 task CRUD 的所有路径**——在 Obsidian 内手动编辑 task 文件、用 Templater 模板新建、用 quickadd 拖拽 都是合法入口, AI 命令是其中之一.

下一节展开 5 子节实现细节.

## 实现

### 影响

跨两个仓:

```
MyJarvis vault  (~/AI/MyJarvis/, gitignored 的个人 vault, 有独立 git remote)
├── Flow/
│   └── 05-Tasks/                                                  (NEW) 整个目录
│       ├── 2605/                                                  (NEW) yymm 子目录
│       │   ├── 260521-test-hammerspoon-double-tap.md              (NEW) ① 示例 todo 状态
│       │   └── 260521-write-fineReport-prd.md                     (NEW) ② 示例 done 状态 (含完整 body 6 段)
│       └── views/
│           └── tasks.base                                         (NEW) Bases YAML, 5 视图
└── Meta/Templates/Templater/Template/
    ├── Task.md                                                    (NEW) Templater 模板, Obsidian quickadd 录入入口
    ├── DailyNotes.md                                              (改)  ① 在 `## 今日计划` 段顶部 (`### 重点任务` 之前) 插 `![[tasks.base#今日任务]]`
    │                                                                    ② 在 `## 总结` 段顶部插 `![[tasks.base#今日完成]]`
    └── WeekPlan.md                                                (改)  ① 在 `## 本周事务` 段顶部 (`### 项目事务` 之前) 插 `![[tasks.base#本周计划]]`
                                                                          (段名沿用 vault 现有模板, 不新增段; 新建 daily/weekly 自动渲染; 历史 daily 不改, 不强制迁移)

nocode-evolve  (~/AI/nocode-evolve/, claude-code plugin 仓)
├── commands/
│   └── task.md                                                    (NEW) /task 命令 (8 sub-action + intent router)
└── .claude-plugin/
    └── plugin.json                                                (改)  version minor +1 (新增 command, 见 CLAUDE.md 规则)
```

### 接口设计

#### 对外 API

无 HTTP / RPC. 用户接口有两条:

1. **Claude Code 命令**: `/task <自然语言>` — 全部 8 sub-action 经此入口
2. **Obsidian Templater 模板**: 用户在 Obsidian 内按 hotkey 触发 `Task.md` 模板, 弹 prompt 收 title / priority / scheduled, 自动生成 task 文件. 仅覆盖"创建" 一个能力, 用于 Claude 会话不在场时的轻量录入

#### 数据模型

**task frontmatter schema** (一 task 一文件落到 `Flow/05-Tasks/yymm/<yymmdd>-<slug>.md`):

```yaml
---
# ===== 自动 (AI 命令 / Templater 模板填) =====
slug: write-fineReport-prd            # kebab-case, 派生自 title, 同 yymmdd 内唯一
title: 写完 FineReport 商业化 PRD       # 一句话
created_date: 2026-05-21 09:00
modified_date: 2026-05-21 16:30
tags: [task]                          # 必含 "task" tag, Bases filter 用

# ===== 必填 =====
status: done                          # todo / done / cancelled (3 态, 见 Q5)
priority: P1                          # P0 / P1 / P2 / P3 (4 档, 对齐方法论, 见 Q6)
scheduled: 2026-05-21                 # YYYY-MM-DD, 计划哪天做, daily 投影靠它

# ===== 选填 =====
goal: "[[2026-Q2-FineReport商业化]]"   # 父节点 wikilink (可指 Quarterly/Monthly/Weekly), 空 = inbox
due:                                  # YYYY-MM-DD, 截止日
est_min: 60                           # int 分钟数, 估时

# ===== done 时填 =====
actual_min: 95                        # int 分钟数, 实际耗时
outcome: "[[260521-fineReport-marketplace-prd]]"  # 产出物 wikilink, 回顾抓手
done_date: 2026-05-21 16:30           # 完成时间

# ===== 周期工作流填 =====
carried_from: 2026-05-14              # YYYY-MM-DD, 从哪天 carry-over 过来 (audit trail, 累积 = 反复延期信号)
---
```

**hierarchy ER 图** (节点 = 文件类型, 边 = wikilink):

```
+--------------------+
| Quarterly Goal     |
| Flow/01-Yearly/    |
| frontmatter:       |
|   parent: null     |
+--------+-----------+
         ▲ parent
         │ 1:N
+--------+-----------+
| Monthly Goal       |
| Flow/02-Monthly/   |
|   parent: [[Q]]    |
+--------+-----------+
         ▲ parent
         │ 1:N
+--------+-----------+        +----------------------+
| Weekly Plan        |        | Outcome Doc          |
| Flow/03-Weekly/    |        | Memory/05-Outputs/   |
|   parent: [[M]]    |        |                      |
+--------+-----------+        +----------+-----------+
         ▲ goal                          ▲
         │ 1:N                           │ outcome (1:1, 选填)
+--------+----------------+               │
| Daily Task              |               │
| Flow/05-Tasks/yymm/     ├───────────────┘
|   goal: [[W]] or 空     |
|   outcome: [[Ω]]        |
|   carried_from: <date>  |
+-------------------------+
```

**关键约束**:
- `tags: [task]` UNIQUE-by-convention, 是 Bases 第一道 filter (没这 tag 的不进任何视图)
- `slug` 同 yymmdd 内唯一; 跨 yymmdd 允许重名 (slug 不是全局 UNIQUE, 文件路径才是)
- `scheduled` 字段决定 daily 视图归属——today() == scheduled 才进"今日任务" 视图
- `goal` 字段空 = inbox, Bases formula `goal_short` 用 `if(goal, goal, "📥 Inbox")` 兜底渲染
- `carried_from` 字段累积 (每次 carry-over 不覆盖, 追加) — 设计为 list? 当前简化为单值 (last carry date), 后续如需追踪全链路再改 list

#### 内部接口

`/task` 命令的 8 sub-action router 签名:

```
/task <自然语言>
  ↓ parseIntent (AI LLM 分类 + 抽参数)
  ↓
8 sub-action dispatch:
  add(title, priority?, scheduled?, goal?, est_min?, why?)    → BF1: 创建 task 文件
  update(query, field, new-value)                              → 改 frontmatter 单字段
  done(query, actual_min, outcome?)                            → BF2: 标 done + 填字段 + 补 body
  cancel(query)                                                → 标 cancelled
  wrap-day(date=today())                                       → BF5: 复盘今日完成 + 时间分布 (不写盘)
  carry-over(weekRange=lastWeek())                             → BF3: 列上周未完 + 表格短码确认 + 批量更新
  breakdown(weeklyNotePath)                                    → BF4: 读 weekly 拆 daily + 表格确认 + 批量创建
  start-week()                                                 → carry-over() ; breakdown(currentWeeklyNote())
```

### 业务流

**BF0 — /task 单一入口 intent 路由 (横切, 所有 sub-action 前置)**

```
function task_router(userText):                               // 主入口: 单一 /task 命令路由
    intent = aiParseIntent(userText)                          // LLM 分类 + 抽参数, 关键词例:
                                                              //   add: "记一个 / 加个 / 新建"
                                                              //   done: "做完了 / 完成 / 标完成"
                                                              //   carry-over: "上周没做完 / 拉过来"
                                                              //   breakdown: "拆 / 拆解 / 拆成 daily"
                                                              //   wrap-day: "今天做了什么 / 复盘"
                                                              //   start-week: "周一了 / 准备本周"

    switch intent.subaction:                                  // 8 路分发
        case "add":          return task_add(intent.parsed)
        case "update":       return task_update(intent.parsed)
        case "done":         return task_done(intent.parsed)
        case "cancel":       return task_cancel(intent.parsed)
        case "wrap-day":     return task_wrap_day(intent.parsed.date || today())
        case "carry-over":   return task_carry_over(intent.parsed.weekRange || lastWeek())
        case "breakdown":    return task_breakdown(intent.parsed.weeklyPath || currentWeeklyNote())
        case "start-week":   return startWeek()               // 复合: carry-over + breakdown 串行
        default:             return error("intent not recognized: " + userText)
                                                              // 让用户重述, 给关键词提示

function startWeek():                                          // 复合 sub-action
    task_carry_over(lastWeek())                                // 先延续
    task_breakdown(currentWeeklyNote())                        // 再拆解本周
```

**BF1 — 单条 task 创建 (add)**

```
function task_add(parsed):                                     // 主入口: 创建一条 task
    slug = slugify(parsed.title)                              // kebab-case, 3-7 个词, 中英文均可
                                                              //   "测试 Hammerspoon 双击触发率" → "test-hammerspoon-double-tap"
    yymm = format(today(), "YYMM")                            // 4 位月份, 跟 vault Flow/04-Daily/ 命名习惯对齐
    yymmdd = format(today(), "YYMMDD")                        // 6 位日期, 文件名前缀, 让 ls 按日期排序
    path = "Flow/05-Tasks/" + yymm + "/" + yymmdd + "-" + slug + ".md"
                                                              // 路径模板: yymm 分组 + yymmdd-slug 文件名

    if exists(path):                                          // slug 冲突检测 (BF1 异常 case)
        return error("slug conflict at " + path + ", rephrase title")
                                                              // 不自动加后缀避免歧义, 让用户改 title

    if not exists("Flow/05-Tasks/" + yymm):                   // 首次该月使用
        mkdirp("Flow/05-Tasks/" + yymm)                       // 自动建 yymm 子目录

    frontmatter = buildFrontmatter({                          // 必填字段全填, 选填空字符串占位
        slug: slug,  title: parsed.title,                     // 文件标识 + 一句话标题
        status: "todo",                                       // 新建默认 todo, 见 Q5 3 态决策
        priority: parsed.priority || "P2",                    // 默认 P2, 来源: 多数 ad-hoc 任务介于"重要"和"次要"
        scheduled: parsed.scheduled || today(),               // 默认今天
        goal: parsed.goal || "",                              // 空 = inbox, 视图层 formula 兜底成 "📥 Inbox"
        est_min: parsed.est_min,                              // 选填, 可空 (无估时也允许)
        created_date: now(),  modified_date: now(),           // 创建时间 = 修改时间, 后续每次改动同步 modified
        tags: ["task"]                                        // Bases filter 第一道 gate
    })
    body = buildBodyScaffold(parsed.title, parsed.why)        // 6 段骨架, 目标段填入 parsed.why (若无让用户后填)

    write(path, frontmatter + body)                           // 一次到位写盘
    return success("task created at " + path)                 // 返回路径, AI 报告给用户
```

**BF2 — 单条 task 标完成 (done)**

```
function task_done(parsed):                                    // 主入口: 标完成 + 填字段 + 补 body 结论段
    candidates = searchTasks(parsed.query, status="todo")     // glob Flow/05-Tasks/*/*, frontmatter status=todo
                                                              // fuzzy 匹配 query 关键词 (title / slug 都搜)

    if length(candidates) == 0:                               // 0 候选 (BF2 异常 case)
        return error("no matching todo task for: " + parsed.query)
    if length(candidates) > 1:                                // 多候选, 让用户选
        return askUser("matches: " + candidates + ", which?") // 不自动选, 避免误改

    task = candidates[0]
    updateFrontmatter(task.path, {                            // 改 frontmatter, 不动 body 其他段
        status: "done",
        actual_min: parsed.actual_min,
        outcome: parsed.outcome || "",                        // 选填, 没产出物链接时空
        done_date: now(),
        modified_date: now()
    })

    if parsed.outcome:                                         // 有 outcome 时补 body 结论段
        appendBodySection(task.path, "## 结论 / 产出",
                          "- 产出: " + parsed.outcome)
                                                              // 若 ## 结论 / 产出 段已存在, 追加在段末, 不覆盖
    return success("task done. actual_min=" + parsed.actual_min)
```

**BF3 — carry-over 上周未完延续**

```
function task_carry_over(weekRange):                          // 主入口: 列上周未完 + 用户确认 + 批量更新
    candidates = listTasks(                                   // Bases query 等价:
        scheduled_in: [weekRange.start, weekRange.end],       //   filters: and:
        status: "todo"                                        //     - 'date(scheduled) >= weekRange.start'
    )                                                         //     - 'date(scheduled) <= weekRange.end'
                                                              //     - 'status == "todo"'

    if length(candidates) == 0:                               // 上周无 todo (BF3 异常 case)
        return { quit: false, count: 0,                       // 统一返回 schema { quit, count } (W8 修订 + W10 统一);
                 message: "no carry-over candidates from " + weekRange }
                                                              //   BF7 阶段 1 收到 quit=false + count=0, 继续阶段 2 (不阻塞)

    table = renderCandidatesTable(candidates)                  // 表格: # / title / priority / 原 scheduled / goal
    decision = askUserShortCode(table)                         // 短码语法:
                                                              //   "go"            全部延续到 nextMonday (默认)
                                                              //   "1 today"       #1 延续到今天
                                                              //   "2 mon"         #2 延续到下周一
                                                              //   "3 x"           #3 取消 (status=cancelled)
                                                              //   "4 keep"        #4 保持原 scheduled (会显示逾期)
                                                              //   "q" / "quit"    用户中途退出

    if decision.quit:                                          // 用户在表格阶段 quit (BF7 start-week 复合工作流靠它早返)
        return { quit: true, count: 0 }                       // count=0 因为还没开始逐条写盘 (统一 schema, 见 W10)

    for each cmd in decision.commands:                        // 逐条应用, 失败一条不影响其他
        switch cmd.action:                                    // 4 路分发: today / mon / x / keep
            case "today":  newScheduled = today()             // 急需今天做的
            case "mon":    newScheduled = nextMonday()        // 默认延到下周一
            case "x":      updateStatus(cmd.taskId, "cancelled"); continue
                                                              // 取消直接跳过下面 updateFrontmatter
            case "keep":   continue                            // 不动, 保留原 scheduled (视图上显示逾期, 提醒)
        updateFrontmatter(cmd.taskId, {                       // today/mon 共用的 frontmatter 写盘
            scheduled: newScheduled,                          // 新计划日
            carried_from: candidates[cmd.id].scheduled,        // 留 audit trail, 追踪反复延期
            modified_date: now()                              // 更新修改时间, 视图层重新渲染
        })
    return { quit: false, count: count }                       // 正常完成, AI 报告"carried N tasks"
```

**BF4 — breakdown 从 weekly 拆 daily**

```
function task_breakdown(weeklyNotePath):                       // 主入口: 读 weekly note, 拆出 daily tasks
    if not exists(weeklyNotePath):                            // weekly note 不存在 (BF4 异常 case)
        return error("weekly note not found: " + weeklyNotePath)
                                                              // 让用户先建 weekly note 再调

    weekly = read(weeklyNotePath)                              // 全文读, plan_section 提取靠 markdown 标题匹配
    plan_section = extractSection(weekly, "## 本周事务")        // 找标题段; 沿用 vault WeekPlan.md 真实段名 (含 ### 项目事务 / ### 日常事务 两个子段)
    if not plan_section:                                      // 段缺失 (BF4 异常 case)
        return error("weekly note missing '## 本周事务' section, add it first")
                                                              // 见 Q8: 由用户填 user-content, 不 AI 替写

    proposals = aiBreakdown(plan_section, {                   // AI 拆解, 注入 task-management.md 方法论
        priority_distribution: {                              // P0-P3 目标分配, 拆出 task 大致按此比例
            "P0": 0.45, "P1": 0.35, "P2": 0.15, "P3": 0.05    //   来源: task-management.md 40-50%/30-40%/10-20%/0-10%
        },
        max_per_day: 5,                                        // 单日不超过 5 条 task, 避免过载
        spread_across_week: true                              // 平均分散到周一-周日, 重要的往周初放
    })

    table = renderProposalsTable(proposals)                    // 表格: # / title / priority / scheduled / est_min / goal
    decision = askUserShortCode(table)                         // 短码语法 (同 BF3 + 部分扩展):
                                                              //   "go"              全部建文件
                                                              //   "- 3,4,5"         跳过 #3,4,5
                                                              //   "2 P0"            把 #2 priority 改 P0
                                                              //   "2 wed"           把 #2 scheduled 改本周三
                                                              //   "2 /new-slug"     改 #2 slug
                                                              //   "q" / "quit"      用户中途退出 (跟 BF3 对称, 供 BF7 早返)

    if decision.quit:                                          // 用户在表格阶段 quit (BF7 复合工作流靠它早返)
        return { quit: true, count: 0 }                       // 无任何 task 创建

    applied = applyDecisionToProposals(proposals, decision)    // 把用户短码 ("- 3,4,5" / "2 P0") 应用到 candidates

    for each task in applied:                                  // 单条循环写盘, 失败一条不影响其他
        task.goal = "[[" + weeklyNotePath + "]]"              // 自动设 goal 指向 weekly note, 形成 hierarchy 链
        task_add(task)                                         // 复用 BF1 创建文件 (单条循环, 失败一条不影响其他)
    return { quit: false, count: count }                       // 正常完成, AI 报告"breakdown created N tasks"
```

**BF5 — wrap-day 日终复盘**

```
function task_wrap_day(date):                                  // 主入口: 复盘指定日 (默认今日)
    completed = listTasks(done_date: date)                     // 当日完成
    in_progress = listTasks(                                   // 当日计划但未完
        scheduled: date,                                       // scheduled = 当日
        status: "todo"                                         // status 仍是 todo (未完成也未取消)
    )

    if length(completed) == 0 and length(in_progress) == 0:    // 当日全空 (空白日)
        return display("today no scheduled or completed tasks")
                                                              // 不报错, 让用户感知今天确实没记 task

    total_actual_min = sum(t.actual_min for t in completed)    // 累计今日实际耗时, 用于跟方法论目标对比
    by_goal = groupBy(completed, "goal")                       // 按 goal 分组耗时
    by_priority = groupBy(completed, "priority")               // 按 priority 分组耗时, 校准方法论比例

    summary = aiSummarize({                                    // AI 生成自然语言复盘
        date: date,
        completed: completed,  in_progress: in_progress,
        total_actual_min: total_actual_min,
        by_goal: by_goal,
        by_priority: by_priority,
        compare_with_methodology: true                         // 跟 P0 45% / P1 35% 比例对比, 报偏差
    })
    return display(summary)                                    // 不写盘, 仅显示给用户读
                                                              // (用户读完可自己决定要不要 sow 沉淀到 vault)
```

**BF6 — update / cancel 单条 task 字段修改**

```
function task_update(parsed):                                  // 主入口: 改 task 单字段, 不改 status (status 变化走 BF2 done / BF6 cancel)
    candidates = searchTasks(parsed.query)                     // 不限 status, todo / done / cancelled 都可以改
    if length(candidates) == 0:                                // 0 候选 (BF6 异常 case)
        return error("no matching task for: " + parsed.query)
    if length(candidates) > 1:                                 // 多候选, 让用户选
        return askUser("matches: " + candidates + ", which?")  // 同 BF2, 不自动选

    task = candidates[0]

    allowed_fields_always = [                                  // 总是允许改的字段 (status 无关)
        "scheduled", "due", "priority", "goal", "est_min", "title"
    ]
    allowed_fields_done_only = [                               // 仅 status=done 时允许改的字段 (避免绕过 BF2 状态机)
        "actual_min", "outcome"                                //   actual_min/outcome 跟 done 强绑定: 写它们暗含"任务已结束"
    ]                                                          //   todo 状态下不应有 actual_min (那是已完成数据); 走 task_done 才合法

    if parsed.field in allowed_fields_always:                  // always-allowed 字段, 任何 status 都可改
        pass                                                   // 允许, 继续往下
    elif parsed.field in allowed_fields_done_only:             // done-only 字段, 校验当前 status
        if task.status != "done":                              // status != done 时拒绝 (BF6 异常 case)
            return error("field '" + parsed.field +
                         "' only updatable when status=done; current status=" + task.status +
                         "; use /task done to set actual_min/outcome on todo task")
        pass                                                   // status=done, 允许纠正 (e.g. 后来发现 actual_min 算错了)
    else:                                                      // 字段不在任何白名单 (BF6 异常 case)
        return error("field '" + parsed.field + "' not updatable, allowed: " +
                     allowed_fields_always + " or (status=done) " + allowed_fields_done_only)

    if parsed.field == "scheduled":                            // 改 scheduled 的特殊语义说明
                                                              //   不触发 carried_from (那是 BF3 carry-over 的语义)
                                                              //   update 仅记录"改了计划日", 不暗示"反复延期"
        pass                                                   // 一般更新, 不动 carried_from
    updateFrontmatter(task.path, {                            // 单字段 patch + 刷 modified_date
        parsed.field: parsed.new_value,
        modified_date: now()
    })
    return success("updated " + task.slug + "." + parsed.field + " = " + parsed.new_value)


function task_cancel(parsed):                                  // 主入口: 标 task 为 cancelled
    candidates = searchTasks(parsed.query, status="todo")      // 仅 todo 状态可 cancel; done 已完成不可改成 cancelled
    if length(candidates) == 0:                                // 0 候选 (BF6 异常 case)
        return error("no matching todo task for: " + parsed.query)
    if length(candidates) > 1:                                 // 多候选, 让用户选
        return askUser("matches: " + candidates + ", which?")

    task = candidates[0]
    updateFrontmatter(task.path, {                            // status 改 cancelled + 刷 modified
        status: "cancelled",
        modified_date: now()
                                                              // 不清空 actual_min / outcome 等已有字段
                                                              //   cancel 是"中止" 不是"删除", 已有工作量数据保留供回顾
    })
    return success("cancelled " + task.slug)
```

**BF7 — start-week 周一启动复合工作流 (carry-over + breakdown 串行)**

```
function startWeek():                                          // 主入口: 用户最高频的周一启动入口, 串行两阶段
    // ===== 阶段 1: carry-over 上周延续 =====
    carry_result = task_carry_over(lastWeek())                 // 调 BF3, 统一返 { quit, count } (见 BF3 早返与正常返两处)
    if carry_result.quit:                                      // 用户在 carry-over 阶段取消 (BF7 早返)
        return info("start-week 在阶段 1 carry-over 取消, 未延续 task; 阶段 2 breakdown 跳过")
                                                              // 不进入 breakdown, 让用户稍后再走 breakdown
                                                              // carry-over 表格阶段 quit 时 count=0 (在 BF3 逐条写盘之前早返)

    // ===== 阶段 2: breakdown 拆本周计划 =====
    weeklyPath = currentWeeklyNote()                           // 推断当前周 weekly note 路径, 例:
                                                              //   Flow/03-Weekly/2605/260520-week21.md
    if not exists(weeklyPath):                                 // 当前周 weekly 还没建 (BF7 异常 case)
        return error("当前周 weekly note 不存在: " + weeklyPath + ", 请先建 weekly note")
                                                              // start-week 不自动建 weekly note (user-content)

    breakdown_result = task_breakdown(weeklyPath)              // 调 BF4, 统一返 { quit, count } (见 BF4 早返与正常返两处)
    if breakdown_result.quit:                                  // 用户在 breakdown 阶段取消
        return info(                                           // 阶段 1 已经完成, 阶段 2 quit
            "start-week: 延续 " + carry_result.count +
            " 个 task; 阶段 2 breakdown 被用户取消, 无新增 task"
        )

    return success(                                            // 复合结果汇总, 两阶段都走完
        "start-week: 延续 " + carry_result.count +
        " + 拆出 " + breakdown_result.count + " 个 task"
    )
```

### 异常与失败模式

| 所属 BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF0 | intent 无法识别 | 用户输入不匹配任何 sub-action 关键词 | 提示用户重述 + 列出关键词例 | 吞 + 提示 |
| BF1 | slug 冲突 | 同 yymmdd-slug 文件已存在 | 报错让用户改 title 重试 | 吞 + 提示 |
| BF1 | yymm 目录缺失 | 首次该月使用 | 自动 mkdirp 建目录 | 吞 |
| BF1 | parsed.priority 缺省 | 用户没说 priority | 默认 P2 (中等优先级兜底) | 吞 |
| BF2 | query 匹配 0 候选 | 用户描述不在 todo task list | 报错 + 让用户描述更精确 | 吞 + 提示 |
| BF2 | query 匹配多候选 | 多 task 关键词相似 | askUser 让用户从候选选 1 个 | 吞 + 互动 |
| BF2 | actual_min 缺省 | 用户没说耗时 | askUser 追问 | 吞 + 互动 |
| BF3 | 上周无 todo task | 周一启动 carry-over 无候选 | info "no carry-over candidates", 不报错 | 吞 |
| BF3 | 用户短码无法识别 | 用户输入自然语言 ("改成 P0") 而非短码 | 报错+示例短码, 等用户重打, 不接受 NL | 吞 + 提示 |
| BF3 | 短码 # 越界 | "#7 today" 但只有 5 条候选 | 报错 "#7 不存在, 候选 1-5" | 吞 + 提示 |
| BF4 | weeklyNotePath 不存在 | 用户传错路径 / 没建本周 weekly | 报错让用户先建 weekly note | 吞 + 提示 |
| BF4 | weekly note 缺 "## 本周事务" 段 | 用户没用模板 | 报错 + 指引添加该段 (见 Q8) | 吞 + 提示 |
| BF4 | AI 拆解 0 条候选 | weekly plan 段为空 | info "weekly plan empty", 不报错 | 吞 |
| BF5 | 当日无 done / 无 scheduled task | wrap-day 调用日空白 | display "no scheduled or completed", 不报错 | 吞 |
| BF6 | query 匹配 0 候选 | 用户描述不在 task list | 报错 + 让用户描述更精确 | 吞 + 提示 |
| BF6 | query 匹配多候选 | 多 task 关键词相似 | askUser 让用户从候选选 1 个 | 吞 + 互动 |
| BF6 | update field 不在白名单 | 用户想改 slug / created_date 等不可改字段 | 报错 + 列允许字段 | 吞 + 提示 |
| BF6 | update actual_min/outcome 时 status ≠ done | 用户想在 todo 状态下改 done-only 字段 | 报错 + 引导走 /task done | 吞 + 提示 |
| BF6 | cancel 时 status ≠ todo | 想 cancel 已 done 的 task | searchTasks 限定 status=todo, 等同 0 候选错 | 吞 + 提示 |
| BF7 | 当前周 weekly note 不存在 | 周一未先建本周 weekly | 报错让用户先建 weekly note (不自动建 user-content) | 吞 + 提示 |
| BF7 | 用户在 carry-over 阶段 quit | 用户中途取消 | info "start-week aborted at carry-over", 不进入 breakdown | 吞 |
| BF1-BF4, BF6-BF7 共享 | vault 路径权限错 / 磁盘满 | 文件系统错 | 报错 + 终止当前 sub-action, 其他 task 不受影响 (BF4/BF7 内单条循环不 batch transactional) | 上抛 |
| Bases (运行时) | filter 字段名错 | tasks.base YAML 引用了 schema 不存在字段 | Obsidian 显示 YAML 错或空视图 | Obsidian 上抛 (用户感知) |
| Bases (运行时) | base 文件路径变 | 用户移动了 tasks.base | 嵌入 daily 的 `![[tasks.base#...]]` 失效 | 用户感知 + 手动修正 |

### 单测设计

**BF0 — /task 单一入口 intent 路由**

- **case 0.1 add 意图识别**
  - Given: 用户输入 "记一个 todo 测试 Hammerspoon priority P2"
  - When: task_router(userText)
  - Then: 路由到 task_add, parsed.title="测试 Hammerspoon", priority="P2"

- **case 0.2 done 意图识别**
  - Given: 用户输入 "PRD 做完了 95 分钟 产出 [[260521-prd]]"
  - When: task_router
  - Then: 路由到 task_done, parsed.query="PRD", actual_min=95, outcome="[[260521-prd]]"

- **case 0.3 carry-over 意图识别**
  - Given: 用户输入 "上周没做完的拉过来"
  - When: task_router
  - Then: 路由到 task_carry_over, weekRange = lastWeek()

- **case 0.4 异常 - 无法识别**
  - Given: 用户输入 "你好"
  - When: task_router
  - Then: error "intent not recognized", 列关键词提示

**BF1 — 单条 task 创建 (add)**

- **case 1.1 主路径**
  - Given: parsed.title="测试 Hammerspoon", priority="P0", scheduled=today(), today=2026-05-21
  - When: task_add(parsed)
  - Then: 文件 `Flow/05-Tasks/2605/260521-test-hammerspoon.md` 被创建, frontmatter 全字段填, body 6 段骨架齐, 目标段为空 (待用户后填) 或填 parsed.why

- **case 1.2 缺省值填充**
  - Given: parsed 只含 title="整理桌面" (priority/scheduled/goal 都缺)
  - When: task_add
  - Then: priority=P2, scheduled=today(), goal="", est_min=null

- **case 1.3 异常 - slug 冲突**
  - Given: `Flow/05-Tasks/2605/260521-foo.md` 已存在; parsed.title="foo"
  - When: task_add
  - Then: error "slug conflict at <path>", 文件未被覆盖

- **case 1.4 异常 - yymm 目录缺失自动创建**
  - Given: `Flow/05-Tasks/2605/` 目录不存在; today=2026-05-21
  - When: task_add
  - Then: 自动 mkdirp 创建 2605/ 目录, task 文件创建成功

**BF2 — 单条 task 标完成 (done)**

- **case 2.1 主路径**
  - Given: 1 条 todo task slug=write-prd; parsed.query="PRD", actual_min=95, outcome="[[260521-prd]]"
  - When: task_done
  - Then: frontmatter status=done, actual_min=95, outcome=[[260521-prd]], done_date=now; body 追加 ## 结论 / 产出 段含"- 产出: [[260521-prd]]"

- **case 2.2 异常 - 0 候选**
  - Given: 无 task title 含 "foo"
  - When: task_done(query="foo")
  - Then: error "no matching todo task for: foo"

- **case 2.3 异常 - 多候选**
  - Given: 2 条 todo task title 都含 "PRD"
  - When: task_done(query="PRD")
  - Then: askUser 候选列表, 等用户选 1 个; 文件不动

- **case 2.4 outcome 缺省**
  - Given: parsed.query 唯一匹配, actual_min=30, outcome 缺
  - When: task_done
  - Then: frontmatter status=done/actual_min=30, outcome 不改 (保持空); body 结论段不追加

**BF3 — carry-over**

- **case 3.1 主路径 全部延续到下周一**
  - Given: 5 条 task scheduled in [last Monday, last Sunday], status=todo
  - When: task_carry_over(lastWeek); 用户输入 "go"
  - Then: 5 条 task scheduled 改为 nextMonday, carried_from 留原 scheduled, modified_date=now

- **case 3.2 部分延续部分取消**
  - Given: 5 条候选
  - When: 用户输入 "1,2 today; 3 x; 4,5 keep"
  - Then: #1,2 scheduled=today(); #3 status=cancelled; #4,5 不动

- **case 3.3 无候选不报错**
  - Given: 上周无 todo task
  - When: task_carry_over
  - Then: info "no carry-over candidates"; 无文件改动

- **case 3.4 异常 - 短码越界**
  - Given: 5 条候选; 用户输入 "#7 today"
  - When: task_carry_over
  - Then: error "#7 不存在, 候选 1-5"; 不动 candidates

**BF4 — breakdown**

- **case 4.1 主路径**
  - Given: weekly note `Flow/03-Weekly/2605/260520-week21.md` 含 "## 本周事务" 段 3 行目标 (### 项目事务 + ### 日常事务); AI 拆解出 8 条候选
  - When: task_breakdown(weeklyPath); 用户输入 "go"
  - Then: 8 条 task 文件被创建, 每条 goal=[[Flow/03-Weekly/2605/260520-week21]] 形成 hierarchy

- **case 4.2 短码调整**
  - Given: 8 条候选
  - When: 用户输入 "- 5,6,7; 2 P0; 4 wed"
  - Then: 跳过 #5,6,7; #2 priority=P0; #4 scheduled=本周三; 创建 5 条文件

- **case 4.3 异常 - weekly note 不存在**
  - Given: weeklyPath 路径不存在
  - When: task_breakdown
  - Then: error "weekly note not found"

- **case 4.4 异常 - 缺 "## 本周事务" 段**
  - Given: weekly note 存在但无该段
  - When: task_breakdown
  - Then: error "weekly note missing '## 本周事务' section"

**BF5 — wrap-day**

- **case 5.1 主路径**
  - Given: 今日 3 条 done (actual_min sum=180m), 1 条 todo scheduled=today
  - When: task_wrap_day(today)
  - Then: summary 显示完成 3 / 总耗时 3h / 按 goal 分组 / 按 priority 分组 / 跟方法论比例对比

- **case 5.2 当日全空**
  - Given: 今日无 done 也无 scheduled
  - When: task_wrap_day
  - Then: display "today no scheduled or completed tasks"; 不报错

**BF6 — update / cancel 单条 task 字段修改**

- **case 6.1 update scheduled 主路径**
  - Given: 1 条 task slug=write-prd, scheduled=2026-05-21; parsed.query="PRD", field="scheduled", new_value="2026-05-23"
  - When: task_update
  - Then: frontmatter scheduled=2026-05-23, modified_date=now; carried_from 字段**不**写入 (update 不暗示延期)

- **case 6.2 update 字段不在白名单**
  - Given: parsed.field="slug" (不可改字段)
  - When: task_update
  - Then: error "field 'slug' not updatable, allowed: [scheduled, due, priority, goal, est_min, title] or (status=done) [actual_min, outcome]"

- **case 6.2b update actual_min 时 status=todo**
  - Given: 1 条 todo task slug=write-prd, status=todo; parsed.field="actual_min", new_value=95
  - When: task_update
  - Then: error "field 'actual_min' only updatable when status=done; current status=todo; use /task done to set actual_min/outcome on todo task"

- **case 6.2c update actual_min 时 status=done (允许纠正)**
  - Given: 1 条 done task slug=write-prd, actual_min=95; parsed.field="actual_min", new_value=120 (后来发现算错了)
  - When: task_update
  - Then: frontmatter actual_min=120, modified_date=now; done_date 不变

- **case 6.3 cancel 主路径**
  - Given: 1 条 todo task slug=write-prd, actual_min=15 (已记部分工作量)
  - When: task_cancel(query="PRD")
  - Then: frontmatter status=cancelled, modified_date=now; actual_min=15 **保留不清空** (cancel 不删历史)

- **case 6.4 cancel 异常 - 已 done 的 task**
  - Given: 1 条 done task slug=write-prd
  - When: task_cancel(query="PRD")
  - Then: error "no matching todo task for: PRD" (cancel 仅允许 status=todo 状态)

**BF7 — start-week 周一启动复合工作流**

- **case 7.1 主路径**
  - Given: 上周 5 条 todo task; 当前周 weekly note `Flow/03-Weekly/2605/260520-week21.md` 含 "## 本周事务" 3 行目标 (含 ### 项目事务 + ### 日常事务 子段)
  - When: startWeek(); 用户两阶段都 "go"
  - Then: 5 条 carry-over 到 nextMonday (carried_from 留 audit); breakdown 创建 8 条 daily task (goal 指 weekly note); 总报告 "start-week: 延续 5 + 拆出 8 个 task"

- **case 7.2 阶段 1 用户取消 (表格阶段 quit, 写盘前)**
  - Given: 上周 5 条 todo task; 用户在 carry-over **表格阶段**输入 "q" / "quit" (尚未开始逐条写盘)
  - When: startWeek
  - Then: BF3 返回 `{quit: true, count: 0}`; BF7 info "start-week 在阶段 1 carry-over 取消, 未延续 task; 阶段 2 breakdown 跳过"; breakdown 阶段**不执行**; **无新增 task 文件**; 无 frontmatter 修改 (表格阶段 quit 在 BF3 quit 早返分支退出, 不进入逐条 updateFrontmatter)

- **case 7.3 异常 - 当前周 weekly note 不存在**
  - Given: 上周延续完成; 但 currentWeeklyNote() 推断的路径不存在
  - When: startWeek; 阶段 2 进入前
  - Then: error "current weekly note not found at <path>, create it first"; carry-over 已写入的保留, breakdown 不执行

## 方案选型

### Q1: L2 任务层是一文件一 task 还是内联日记?

**选项**: (a) 一文件一 task (`Flow/05-Tasks/yymm/`) + Bases 视图嵌 daily (b) 内联日记 `- [ ]` + Obsidian Tasks 插件 (`🆔` emoji ID) (c) 内联日记 + dataview parse inline 文本
**定**: (a). 因 CRUD 需要**稳定 ID** (文件路径=ID, 远比 emoji 🆔 fuzzy 匹配稳健); 时间追踪需要 **frontmatter 强字段** (Obsidian Tasks 插件原生不支持 actual_min, 只有 截止日 ⏳ + 提醒 ⏰); 父子关系需要 wikilink 表达 (内联 `- [ ]` 跨日丢失 hierarchy). → 影响 BF1, BF2, BF3, BF4 全部.

### Q2: 视图层用 dataview 还是 Obsidian Bases?

**选项**: (a) dataview (社区第三方插件, DQL, 用户已装) (b) Obsidian Bases (官方 1.9+ 原生, YAML, 含 formulas+summaries) (c) 两者并存
**定**: Bases. 因官方原生未来路线稳; formulas 算 `priority_label`/`days_until_due`/`is_overdue` 比 dataview DQL 直观 (YAML 表达力 vs DQL 学习曲线); 性能据官方说明优于 dataview (大 vault 不易卡); 单一 `.base` 文件多 view 比 dataview 散落代码块易管理. → 影响 L3 视图层全部, 影响 daily/weekly/monthly note 嵌入方式从 `\`\`\`dataview` 改为 `![[tasks.base#...]]`.

### Q3: task 路径分组按 yymm 还是扁平?

**选项**: (a) `Flow/05-Tasks/yymm/<yymmdd>-<slug>.md` (b) `Flow/05-Tasks/<yymmdd>-<slug>.md` 扁平 (c) `Flow/05-Tasks/<status>/<slug>.md` 按状态分
**定**: (a). 因跟现有 `Flow/04-Daily/yymm/` 命名习惯完全对齐; 扁平方案一年后几百个文件一目录管理混乱; 按状态分需要 status 变化时 `mv` 文件, **破坏稳定 ID** (Bases query / wikilink 都会失效). → 影响 BF1 path 计算逻辑.

### Q4: task body 段落数?

**选项**: (a) **6 段** (目标 / 进展 / 时间日志 / 卡点 / 结论 / 衍生), 前 2 必填后 4 选填 (b) 3 段 (目标 / 进展 / 结论) (c) 不分段自由 markdown
**定**: (a). 因**回顾价值 = 信息密度**——用户原话"看不懂, 后面不好回顾". 月底回看任务时, 需要分别看到 why / 做了什么 / 卡在哪 / 产出. 6 段固定结构让回顾时眼到即知; 后 4 段选填降低录入摩擦. → 影响 BF1 body scaffold + BF2 done 时追加结论段.

### Q5: status 几态?

**选项**: (a) **3 态** todo/done/cancelled (b) 5 态 todo/in-progress/done/cancelled/blocked
**定**: 3 态. 跟 vault 现状对齐 (调研: 现状只用 `[ ]/[x]`); 5 态的 in-progress 实际通过 `scheduled` 字段 + body `## 时间日志` 段已经表达; blocked 通过 body `## 卡点 / 风险` 段表达. 3 态足够 + 视图查询简单. → 影响 frontmatter schema + 所有视图 filter.

### Q6: priority 几档?

**选项**: (a) **P0/P1/P2/P3 4 档** (跟 task-management.md 时间分配 40-50%/30-40%/10-20%/0-10% 对齐) (b) high/medium/low 3 档 (c) 不设 priority 只靠 scheduled 排序
**定**: P0-P3 4 档. 因要支撑"P0 = 最重要的 3 件事" 心智模型; 时间分配统计需要 4 档对应方法论 (wrap-day 比较实际比例 vs 目标比例); 3 档无法表达 P3 "0-10%" 的最低档. → 影响 schema + 视图 priority 字段 + BF5 wrap-day 时间分布对比.

### Q7: AI 命令是 1 个还是多个?

**选项**: (a) **单一 /task 命令**, AI 解析 intent 分发 (b) /task-add, /task-done, /task-carry-over... 多个独立命令 (c) /todo 单一极简命令 (内嵌 todo list)
**定**: 单一 /task + 内部 sub-action 路由. 因用户记 1 个命令心智负担最小 (用户原话"一个命令, 自动识别需求然后分配"); AI 路由失败率可控 (sub-action 数量 8, 关键词清晰); 内部分发逻辑收口到 1 个 markdown 文件易维护. → 影响 BF0 router 设计 + commands/task.md 单一文件结构.

### Q8: weekly note 缺 "## 本周事务" 段怎么办?

**选项**: (a) **报错让用户先建段** (b) AI 自动新建该段并写一句话占位 (c) AI 提议草稿让用户审
**定**: (a). 因 weekly plan 是 user-content (用户的本周战略), 不该 AI 替写; 报错+指引把责任划清; vault WeekPlan.md 模板已含 "## 本周事务" + 子段 (### 项目事务 / ### 日常事务), 用户走 Templater 建 weekly 时会自动有. → 影响 BF4 异常处理.

### Q9: carry-over 默认延续到哪天?

**选项**: (a) 全部延续到 next Monday (b) 全部延续到 today (c) AI 按 task priority 推测 (P0 → today, P1 → 本周内, P2/P3 → next Monday)
**定**: 默认 next Monday + 用户短码可逐条覆盖到 today / keep / cancel. 因周一启动场景下用户大多数时候希望"延到下周再说", 默认 next Monday 摩擦最小; 急需今天做的让用户显式短码 `1 today` 覆盖. → 影响 BF3 默认逻辑.

## 其他

### 部署

跨两个仓, 无运行时部署:

- **nocode-evolve 仓**: `commands/task.md` (NEW) + `plugin.json` version minor +1, git commit + push 后, 用户端 Claude Code marketplace 拉取生效 (即时, 用户重启 Claude Code 后)
- **MyJarvis vault**: 新增 `Flow/05-Tasks/views/tasks.base` + `Meta/Templates/Templater/Template/Task.md` + 1-2 个示例 task 文件. vault 有独立 git remote, 直接 commit + push 到 vault remote (vault 自动跨设备同步)
- **灰度策略**: 无——本系统是 user-local 工具, 单用户开关. 不分批
- **回滚预案**:
  - vault 端: 删 `Flow/05-Tasks/` 整目录 + `Meta/Templates/Templater/Template/Task.md` (无破坏其他数据); DailyNotes.md / WeekPlan.md 模板 revert 嵌入行
  - nocode-evolve 端: `git checkout` 上一版 tag (`/task` 命令文件不存在时, 用户喊命令会得到 "command not found")
- **监控指标**: 无 metric——纯文件操作工具, 无运行时. 通过用户实际使用反馈感知 (一周后 retro)

## Review Log

### Review 1 — 260521

<details>
<summary>Reviewer Report 全文 (3C / 6W / 5S / 3Q / 3SA, ❌ Has issues)</summary>

**Critical**

- **C1** [`## 实现.业务流`]: 伪代码硬规则违反——多行无 `//` 注释 (BF1 yymmdd/path/return error/frontmatter 多字段行; BF3 case 分支; BF4 read/return/applied; BF5 多行)
- **C2** [`## 实现.业务流`]: 「目标」声明 8 sub-action, 业务流仅展开 5 条 BF. update / cancel 没有 BF 展开; start-week 在 BF0 router 内联一句话也未独立编号
- **C3** [`## 目标` vs `## 实现.影响`]: 矛盾. 目标说"自动嵌入", 影响节说"用户手动嵌入". 谁负责嵌入没说清

**Warning**

- **W1** [`## 异常` vs `## 单测`]: BF2 actual_min 缺省的 askUser 分支三处脱节 (异常表列 / 业务流无 / 单测无 case)
- **W2** [`## 单测设计`]: BF1-BF4 共享 IO 错误异常表列了, 但单测无 case 覆盖
- **W3** [`## 接口设计`]: tasks.base YAML 骨架完全没列, 5 视图 filter/formula/groupBy 没示意
- **W4** [`## 方案选型`]: 9 项 Q, 接近 skill 写的"6 项以上 review 是否过度记录" 边界. Q5/Q9 论证较短接近微小决策
- **W5** [`## 数据模型`]: carried_from 当前单值, BF3 只记最后一次延期, 反复延期 ≥2 次的 task 丢失中间历史
- **W6** [`## 部署`]: "无 metric" 改成具体"用户感知信号" (一周后 retro checklist)

**Suggestion**

- **S1** [`## Q2`]: "Bases 性能优于 dataview" 无引用, 加 release note 或改"经验性"
- **S2** [`## BF0`]: 没说 intent 冲突时怎么决议 (如"记一个 PRD 做完了" 同含两个关键词)
- **S3** [`## BF4`]: priority_distribution 硬编码中位, 建议注释"中位取值, 后续按偏离量动态调"
- **S4** [`## 架构图`]: AI 命令块跟 L1-L3 层级图竖向连不上, 视觉悬空
- **S5** [`## BF5`]: groupBy(completed, "goal") 空字符串 key 没用 formula 兜底成 "📥 Inbox"

**Open Questions**

- **Q1** [`## BF1`]: slugify 对中文 title 怎么处理? 语义翻译 vs 音译, 实现细节
- **Q2** [`## 数据模型`]: `![[tasks.base#视图名]]` wikilink 解析按文件名, vault 全局唯一性未验证
- **Q3** [`## BF3`]: 短码语法跟 sow/sediment 是否统一? 新引入还是已有约定?

**Self-Audit**

- **SA1**: 工程师上手会卡: (1) tasks.base 5 视图配置缺 (跟 W3 同根) (2) aiParseIntent 是 LLM 还是规则匹配未说 (3) update/cancel 语义边界 (跟 C2 同根)
- **SA2**: Templater Task.md 跟业务流的关系? 同份逻辑还是分叉?
- **SA3**: 历史 daily 里几百个 `- [ ]` 怎么迁移? 文档完全没提

</details>

**用户决定**: fix C1, C2, C3 (Critical 3 条全修); skip W1-W6, S1-S5, SA1-SA3 (留 Report 记录, 不动文档); skip Q1, Q2, Q3 (接受现状, 作者自负风险)

**本轮修订**:

- **C1** [`## 实现.业务流` BF1/BF3/BF4/BF5]: 给所有缺 `//` 注释的行补上注释——BF1 补 yymmdd / path / slug 冲突 / frontmatter 多字段; BF3 补 case 分支与 updateFrontmatter 内字段; BF4 补 read / 段缺失原因 / applied / for 循环; BF5 补 listTasks 字段 / 当日全空原因 / total_actual_min 用途
- **C2** [`## 实现.业务流` 新增 BF6 + BF7]:
  - BF6: 新增 `task_update` + `task_cancel` 完整伪代码. 关键决策: update 字段白名单 (8 个), update scheduled **不**触发 carried_from (区分 update 与 carry-over 语义); cancel 仅允许 status=todo, 不清空 actual_min / outcome
  - BF7: 新增 `startWeek` 完整伪代码. 关键决策: 两阶段串行 (carry-over → breakdown), 阶段 1 用户 quit 早返不进阶段 2; 阶段 2 前若 currentWeeklyNote() 路径不存在则 error (不自动建 user-content)
  - 同步补 异常与失败模式 表 6 行 (BF6×4 + BF7×2); 单测设计 7 case (BF6 ×4 + BF7 ×3)
- **C3** [`## 目标` + `## 实现.影响`]: 选定方案"**Templater 模板预置嵌入**"——
  - 目标节: 改为"视图嵌入由 Templater 模板预置 (DailyNotes.md / WeekPlan.md 加 `![[tasks.base#视图名]]` 行), 用户新建 daily/weekly 时自动渲染; 历史 daily 不改; monthly/goal note 按需手动加"
  - 影响节: `Meta/Templates/Templater/Template/` 下加 `DailyNotes.md (改)` + `WeekPlan.md (改)` 两条; 不再有"用户后续手动嵌入"歧义描述
  - 部署节: 回滚预案补"DailyNotes.md / WeekPlan.md 模板 revert 嵌入行"

**Open Questions 答复**: 全部 skip——
- Q1 slugify 中文实现细节留 plan 阶段决 (可走 AI 翻译 + 校对, 或 pypinyin 音译, 不是 design-doc 颗粒度)
- Q2 `tasks.base` 文件名 vault 全局唯一性: 当前 vault 别处确认无同名 `.base`, 风险可接受; 未来若冲突再改成全路径嵌入
- Q3 短码与 sow/sediment 一致性: BF3/BF4 短码当前是新引入语法, sow 是必填意图无短码, sediment 有自己一套短码 (`go / -N / N plug / N wiki`). 不统一是有意——sediment 的短码语义跟任务管理不同, 强行统一反而困惑. 留 plan 阶段细化.

---

### Review 2 — 260521

<details>
<summary>Reviewer Report (Round 2) 全文 (1C / 3W / 2S, ❌ Has issues)</summary>

**Critical (新增)**

- **C4** [`## 影响` + `## 目标`]: **C3 修订引入的事实错误**. 文档说在 `DailyNotes.md` 的 "## 今日任务" / "## 今日完成" 段插入 Bases 嵌入, 在 `WeekPlan.md` "## 本周计划" 段插入. 实证核对真实模板 (`/Users/yes365/AI/MyJarvis/Meta/Templates/Templater/Template/DailyNotes.md` + `WeekPlan.md`): 这三段**根本不存在**. 真实段名: DailyNotes 是 `## 今日计划` (含 `### 重点任务/### 临时任务/### 推进记录`) + `## 总结`; WeekPlan 是 `## 上周回顾` (含 `### 本周待办`) + `## 本周事务` (含 `### 项目事务/### 日常事务`) + `## 日程安排` + `## 待办` + `## 变更记录`. BF4 `extractSection(weekly, "## 本周计划")` 100% 进 error path; C3 选定方案落地不可执行

**Warning (新增, 修订引入)**

- **W7** [`## 单测 case 7.2`]: BF7 单测自相矛盾. 同时写"breakdown 阶段**不执行**, **无任何文件改动**" 和 "carry-over 已完成的部分**保留**". 前者意味零写入, 后者意味有写入. 互斥
- **W8** [`## BF7`]: `carry_result.quit` 字段从 BF3 (`task_carry_over`) 返回值来. 但 BF3 当前只 return `info(...)` / `success(...)`, 没有任何 `{quit: true}` 结构定义. BF7 line 540 检查的字段无来源, 实施时不知道怎么传递
- **W9** [`## BF6 task_update`]: `allowed_fields` 含 `actual_min` / `outcome`, 但 BF2 task_done 才是写这俩字段的"主战场" (含 status=done + done_date + body 结论段同步追加). update 改 actual_min 会绕过状态机, 产生 status=todo 但 actual_min=95 的不一致 task

**Suggestion**

- **S6** [`## BF6 task_cancel`]: `// 不清空 actual_min / outcome` 这两行注释挂在闭合括号上, 应挪到 updateFrontmatter 调用末尾
- **S7** [`## 部署`]: 回滚预案要补"revert 模板新增段名"

**Self-Audit / Open Questions**: 无新增

</details>

**用户决定**: fix C4, W7, W8, W9; skip S6, S7

**本轮修订**:

- **C4** [`## 影响` + `## BF4` + `## 异常表` + `## 单测 case 4.1/4.4` + `## Q8`]: 全部对齐 vault 真实模板段名——
  - 影响节: DailyNotes.md 嵌入位置改为 `## 今日计划` (顶部 `### 重点任务` 之前) + `## 总结` 顶部; WeekPlan.md 嵌入位置改为 `## 本周事务` 顶部 (`### 项目事务` 之前)
  - BF4 业务流: `extractSection(weekly, "## 本周计划")` → `extractSection(weekly, "## 本周事务")`; 异常表 BF4 行 / 单测 case 4.1+4.4 / Q8 标题 + 决策措辞同步改成 "## 本周事务"
- **W7** [`## 单测 case 7.2`]: 改写矛盾描述为 "BF3 返回 `{quit: true, partial_count: 0}`; BF7 info ...; breakdown 阶段不执行; **无新增 task 文件**; 无 frontmatter 修改 (表格阶段 quit 在 BF3 line 410 早返, 不进入逐条 updateFrontmatter)". 明确"无新增 task 文件"而非"无任何文件改动"
- **W8** [`## BF3` + `## BF4` + `## BF7`]: BF3/BF4 都改返回结构化对象 `{ quit, count }`/`{ quit, partial_count }`, 同步声明 "q"/"quit" 短码语义. BF7 同时处理两阶段的 quit (阶段 1 quit → 不进阶段 2; 阶段 2 quit → 阶段 1 已写盘保留, 阶段 2 无新文件). 报告文案区分三种结果: 阶段 1 quit / 阶段 2 quit / 两阶段都完成
- **W9** [`## BF6 task_update` + 异常表 + 单测 case 6.2]: allowed_fields 拆成两组——always 允许 (`scheduled/due/priority/goal/est_min/title`) + done-only (`actual_min/outcome`). status ≠ done 时改 done-only 字段报错并引导走 task_done. 异常表新加一行 "update actual_min/outcome 时 status ≠ done"; 单测加 case 6.2b (todo 状态拒绝) + case 6.2c (done 状态允许纠正)

**Open Questions 答复**: 本轮无新增 Open Questions.

---

### Review 3 — 260521

<details>
<summary>Reviewer Report (Round 3) 全文 (2C / 2W / 1S, ❌ Has issues)</summary>

**Critical (Round 2 修订残留)**

- **C8** [`## BF3 line 393`]: W8 修订漏了 BF3 "无候选" 早返路径. 该行仍是 `return info(...)`——返回 info object 而不是 `{quit, count}` 结构. BF7 line 559 `carry_result = info(...)`, line 560 `if carry_result.quit:` 读 `.quit` 字段在 info object 上 undefined. 类型契约破了
- **C10** [`## 单测 case 7.1 line 773`]: C4 修订漏改一处 "## 本周计划". 其他位置 (BF4 / 异常表 / case 4.1/4.4 / Q8) 都改成 "## 本周事务" 了, case 7.1 残留. case 7.1 跑到 BF4 会触发 case 4.4 missing-section error

**Warning**

- **W10** [`## BF3 line 406 vs 420`]: BF3 返回 schema 不齐——quit 路径返 `{quit, partial_count}`, success 路径返 `{quit, count}`. 同函数两套 field name. footgun
- **W11** [`## BF7 line 559 / 572 / case 7.2 line 780`]: line refs 偏 5-11 行——W8 修订插入新行后没回填 ref. 三处都错

**Suggestion**

- **S8** [`## BF7 line 576 / 580-581`]: 报告 message 中英混排 (`"start-week: carried 5 + broke down 8 tasks"`). 全篇中文风, 建议统一

**Self-Audit / Open Questions**: 无新增 (跟 Round 1 同根, 不重提)

</details>

**用户决定**: fix C8, C10, W10, W11, S8 (全修)

**本轮修订**:

- **C8** [`## BF3` 无候选早返]: `return info("no carry-over candidates from ...")` → `return { quit: false, count: 0, message: "no carry-over candidates from " + weekRange }`. 统一返回 schema 为 `{ quit, count }`, 同时保留 message 让 BF7 / AI 报告用. BF7 收到 `quit=false + count=0` 后继续阶段 2 breakdown (不阻塞)
- **C10** [`## 单测 case 7.1`]: Given 里 "含 \"## 本周计划\" 3 行目标" → "含 \"## 本周事务\" 3 行目标 (含 ### 项目事务 + ### 日常事务 子段)". 总报告 message 同步改成中文版 "start-week: 延续 5 + 拆出 8 个 task" (跟 BF7 修订后的报告一致)
- **W10** [`## BF3 quit return`]: `{quit: true, partial_count: 0}` → `{quit: true, count: 0}`. 统一字段名为 `count`, BF3 两条返回路径 (early-return + success) 现在都是 `{ quit, count }` 同构 schema
- **W11** [`## BF7` + `## case 7.2`]: 移除所有 line refs (line 411 / 449 / 410 / 410)——line ref 容易过期 (插入新行后失效). 改成段名 + 短描述: "见 BF3 早返与正常返两处" / "在 BF3 quit 早返分支退出". 后续修订不再需要回填 ref
- **S8** [`## BF7` 报告 message]: 中英混排英文 message 全改中文——`"start-week aborted at carry-over"` → `"start-week 在阶段 1 carry-over 取消, 未延续 task; 阶段 2 breakdown 跳过"`; `"current weekly note not found"` → `"当前周 weekly note 不存在"`; `"start-week: carried 5 + broke down 8 tasks"` → `"start-week: 延续 5 + 拆出 8 个 task"`
