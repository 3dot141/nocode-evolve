---
description: 任务管理子系统单一入口, AI 解析意图分发到 8 个 sub-action (add / update / done / cancel / wrap-day / carry-over / breakdown / start-week)
argument-hint: <自然语言意图>
---

# /task: MyJarvis 任务管理子系统单一入口

把用户的自然语言输入解析成 8 个 sub-action 之一, 操作 `$USER_VAULT_PATH/Flow/05-Tasks/yymm/<yymmdd>-<slug>.md` task 文件 + 跟 Obsidian Bases 视图渲染配合.

**设计文档**: `docs/dev/3dot141/260521-02-task-management-system/task-management-system-design.md` (含完整业务流 BF0-BF7 + 单测 case + 方案选型).

## 入参 ($ARGUMENTS)

**必填**——一句话自然语言. 例:

- `/task 记一个 测试 Hammerspoon 双击 priority P1`
- `/task PRD 写完了 95 分钟 产出 [[260521-prd]]`
- `/task 把 PRD 的 priority 改成 P0`
- `/task 取消法务那条`
- `/task 今天做了什么`
- `/task 上周没做完的拉过来`
- `/task 把本周计划拆成 daily`
- `/task 周一了, 准备本周`

无参 → 报错"请说明你要做什么. 用法: `/task <自然语言意图>`. 见命令开头 8 sub-action 关键词例."

## 环境依赖

- **`$USER_VAULT_PATH`** (env 变量, 必填) — 指向用户 Obsidian vault 根目录 (例: `~/AI/MyJarvis`)
- `$USER_VAULT_PATH/` vault 路径存在
- `$USER_VAULT_PATH/Flow/05-Tasks/views/tasks.base` 已建
- `$USER_VAULT_PATH/Meta/Templates/Templater/Template/Task.md` 已建 (备用录入入口)

任一不满足 → 报错 + 引导用户走 plan 文档 (`docs/dev/3dot141/260521-02-task-management-system/task-management-system-plan.md`) 对应 Task; env 未设 → 报错 + 指引在 zshrc 加 `export USER_VAULT_PATH=<your-vault-root>`.

---

## BF0 — Intent Router

按以下关键词把 `$ARGUMENTS` 路由到 sub-action:

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

**intent 冲突** (如"记一个 PRD 做完了" 同含 add + done 关键词): 取**最长后缀匹配**——句末关键词通常是真意图. 仍无法决议 → askUser 二选一.

**intent 无法识别** → 报错列上述关键词例, 让用户重述.

---

## BF1 — add (创建 task)

**触发**: 用户喊"记一个 X / 加个 X / 新建 X".

**抽参**:

- `title` (必)
- `priority` (默 P2; 用户说 P0/P1/P2/P3 或"最重要/重要/一般/次要" 时按对应档)
- `scheduled` (默 today; 用户说"明天/周三/某月某日" 等转换 YYYY-MM-DD)
- `goal` (用户说"放到 X 目标下" / 提供 wikilink 时填; 否则空 = inbox)
- `est_min` (用户说"30 分钟 / 半小时 / 1 小时" 等转换 int)
- `why` (用户说"为了 X / 因为 Y" 时摘出, 填入 body 目标段)

**执行**:

1. `slug = slugify(title)` — kebab-case, 3-7 词, 中英文均可, 长度 ≤50
2. `yymm = format(today, "YYMM")`, `yymmdd = format(today, "YYMMDD")`
3. `path = "$USER_VAULT_PATH/Flow/05-Tasks/" + yymm + "/" + yymmdd + "-" + slug + ".md"`
4. 检查 path 已存在 → 报错 "slug 冲突, 请改 title"; 否则继续
5. `Flow/05-Tasks/<yymm>` 目录缺失 → `mkdir -p`
6. Write 文件 (frontmatter + body 骨架 6 段, why 填入"目标"段)

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

**Body 骨架 6 段**: 目标 / 进展 / 时间日志 / 卡点 / 结论 / 衍生. 仅"目标"段必填 (填 why); 其他段保留注释占位.

**报告**: `"task created at <yymm>/<filename>"`.

---

## BF2 — done (标完成)

**触发**: 用户喊"X 做完了 / 完成 X / 标 X 完成".

**抽参**:

- `query` (必, task 描述关键词)
- `actual_min` (必, 用户没说时 askUser 追问"花了多少分钟?")
- `outcome` (选, 用户说"产出 [[X]] / 链接 Y" 时填)

**执行**:

1. glob `$USER_VAULT_PATH/Flow/05-Tasks/*/*` 找 frontmatter `status: todo` + title/slug 模糊匹配 `query` 的 task
2. 0 候选 → 报错 "no matching todo task for: <query>"
3. 多候选 → askUser 列候选让用户选 (显示 path + title)
4. 1 候选 → 改 frontmatter: `status: done`, `actual_min: <n>`, `outcome: <wikilink or "">`, `done_date: <now>`, `modified_date: <now>`
5. 若 outcome 非空, body `## 结论 / 产出` 段追加一行 "- 产出: <outcome>" (段已存在则末尾追加, 不覆盖)

**报告**: `"task done. <slug>, actual_min=<n>"`

---

## BF6 — update / cancel

### update (改单字段)

**触发**: 用户喊"改 X 的 priority 改成 P0" / "把 Y 的 scheduled 改到周三".

**抽参**: `query`, `field`, `new_value` (三必)

**白名单字段**:

- **always-allowed**: `scheduled`, `due`, `priority`, `goal`, `est_min`, `title`
- **done-only** (status=done 才能改): `actual_min`, `outcome`
- 其他 (slug / created_date / tags 等) → 报错 "not updatable, allowed: <list>"

**执行**:

1. searchTasks 找候选 (0/多候选处理同 BF2)
2. 校验 field 在白名单
3. field 是 done-only 类 → 校验 task.status == "done", 否则报错 "use /task done to set actual_min/outcome on todo task"
4. 改 frontmatter (单字段 patch + modified_date 刷新)
5. field=="scheduled" 时**不**触发 carried_from (那是 BF3 carry-over 的语义, update 只是改计划日)

**报告**: `"updated <slug>.<field> = <new_value>"`

### cancel (取消)

**触发**: 用户喊"取消 X / 不做了 X".

**抽参**: `query` (必)

**执行**:

1. searchTasks 仅 status=todo (不允许 done 状态; 已 done 想撤回需走 update + reopen, 暂不支持)
2. 0/多候选处理同 BF2
3. 改 frontmatter: `status: cancelled`, `modified_date: <now>`
4. **不清空** actual_min / outcome (cancel 是中止, 不删历史)

**报告**: `"cancelled <slug>"`

---

## BF5 — wrap-day (日终复盘)

**触发**: 用户喊"今天做了什么 / 日终复盘 / 总结今天".

**抽参**: `date` (默 today, 用户可指定"昨天 / 某日")

**执行**:

1. listTasks (frontmatter `done_date == date`) → completed list
2. listTasks (frontmatter `scheduled == date` && `status == todo`) → in_progress list
3. 总耗时 = sum(t.actual_min for t in completed)
4. 按 goal 分组耗时
5. 按 priority 分组耗时 (用于跟方法论比例对比: P0 40-50% / P1 30-40% / P2 10-20% / P3 0-10%)
6. AI 生成自然语言总结, 显示给用户读 (**不写盘**)

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

用户读完可自决要不要走 `/sow` 沉淀, 本命令不主动建议下一步.

---

## BF3 — carry-over (上周延续)

**触发**: 用户喊"上周没做完的拉过来 / 延续上周".

**抽参**: `weekRange` (默 lastWeek = [lastMonday, lastSunday])

**执行**:

1. listTasks (scheduled in [weekRange.start, weekRange.end] && status=todo) → candidates
2. 0 候选 → return `{ quit: false, count: 0, message: "no carry-over candidates from <range>" }`
3. 渲染候选表格 (Markdown table 给用户读):

```
| # | title | priority | 原 scheduled | goal |
|---|---|---|---|---|
| 1 | <task1> | P0 | 2026-05-15 | <goal> |
| ... | | | | |
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

**短码必须严格语法**, 不接受自然语言 (NL 容错收益远低于误执行风险, 跟 distill 一致).

**报告**: `"carried <N> tasks"` (count = 实际改动数, 不含 cancelled).

---

## BF4 — breakdown (从 weekly 拆 daily)

**触发**: 用户喊"拆本周计划 / 拆成 daily".

**抽参**: `weeklyNotePath` (默 currentWeeklyNote: `$USER_VAULT_PATH/Flow/03-Weekly/<yymm>/<yymmdd>-week<N>.md`, 推断当前周)

**执行**:

1. 路径不存在 → 报错 "weekly note not found at <path>, create it first"
2. read weekly note, extractSection `## 本周事务` (vault WeekPlan.md 模板真实段名)
3. 段缺失 → 报错 "weekly note missing '## 本周事务' section, add it first"
4. AI 拆解段内目标, 注入 priority 分配 (P0 45% / P1 35% / P2 15% / P3 5% 中位; 不严格按此, 看实际任务性质)
5. 单日 ≤5 条 task; 平均分散到周一-周日, 重要的往周初
6. 渲染候选表格:

```
| # | title | priority | scheduled | est_min | goal |
|---|---|---|---|---|---|
| 1 | <task1> | P1 | 2026-05-21 | 60 | <weekly wikilink> |
| ... | | | | | |
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
   - `quit=true` → 报告 "start-week 在阶段 1 carry-over 取消, 未延续 task; 阶段 2 breakdown 跳过", 早返
   - `quit=false` → 继续
3. **阶段 2**: `weeklyPath = currentWeeklyNote()`
4. 路径不存在 → 报错 "当前周 weekly note 不存在: <path>, 请先建 weekly note"
5. 调 BF4 breakdown(weeklyPath)
6. BF4 返回 `{quit, count}`:
   - `quit=true` → 报告 "start-week: 延续 <N> 个 task; 阶段 2 breakdown 被用户取消, 无新增 task"
   - `quit=false` → 报告 "start-week: 延续 <N> + 拆出 <M> 个 task"

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

- ❌ **AI 自动延续 carry-over 候选不让用户拍** — 必须表格短码确认
- ❌ **AI 自动建 weekly note 替用户写 plan** — weekly plan 是 user-content, AI 不替写
- ❌ **改 done 状态的 task 的 status 字段 (走 cancel 后悔了不能 reopen)** — 暂不支持 status 回退
- ❌ **NL 接受短码场景 (BF3 / BF4)** — 短码必须严格语法, AI 解析 NL 失败模式不是"懂/不懂" binary 而是"懂错", 容错收益远低于误执行风险 (跟 distill 一致)
- ❌ **把 vault 路径写死在命令逻辑里** — 必须用 `$USER_VAULT_PATH` env var 拼出 vault 子路径, 支持不同用户 vault 位置 / 跨设备同步差异
