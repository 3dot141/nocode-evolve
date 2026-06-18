---
name: plan
description: 把确认的目标拆成可执行的任务序列。Use when you have defined goals and need to break work into implementable tasks. Use when devflow routes to Plan stage, or when the user says "写计划/拆任务/怎么实现/plan it out". Use when a task feels too large to start, when you need to estimate scope, or when parallel work is possible.
---

# nocode-evolve:plan — 把目标拆成任务序列

> 输入：Define 确认的 restate。产出：用户确认的任务序列，每个任务 ≤ M、可独立执行、可独立回滚。
>
> 融合来源：superpowers `writing-plans`（硬约束底子：每步贴代码/禁占位符/HARD-GATE）+ agent-skills `planning-and-task-breakdown`（垂直切片/sizing/checkpoint/依赖图）。完整映射见 `references/skill-integration-map.md`。

## 为什么这个 skill 存在

计划的价值不在"列出步骤"，而在**让执行变成机械动作**。一个好计划，agent 拿到就能照做，不需要边做边想"这里该怎么写"。坏计划留下一堆判断题，把设计决策推迟到执行期——那时返工代价最大。

所以核心要求只有一条：**计划里贴的是真实代码和命令，不是占位符**。这条贵，但它把"想清楚"的成本前置到便宜的时候付。

## 协议

### Step 1: 进只读模式

读，不写。先读 Define 的 restate（成果物 / 验收标准 / 约束 / Out of Scope），再读相关代码——你要拆的东西现在长什么样，依赖谁，谁依赖它。

这一步不碰代码。如果你发现自己开始改文件，停下——你在跳过 Plan 直接 Build。

### Step 2: 画依赖图

列出要做的所有"块"，标出谁依赖谁。

```
DependencyGraph:
  - schema (无依赖)
  - repository → 依赖 schema
  - service → 依赖 repository
  - api handler → 依赖 service
  - frontend → 依赖 api handler
```

底层先建——下游任务依赖的东西必须先就位，否则下游任务没法贴出真实代码（它引用的符号还不存在）。

### Step 3: 垂直切片

切片优先**端到端可交付**，而不是按层横切。

- 垂直（推荐）："用户能创建一条记录"——穿过 schema → repository → service → api → 一个最小 UI，一条窄但完整的路径
- 横切（避免）："建好所有 repository""建好所有 service"——做完每一层都不可验证，集成风险堆到最后才爆

垂直切片的好处：每个切片做完就有能跑、能 demo、能回滚的东西。

**Risk-first**：最不确定的切片先做。如果某条路径可能根本不可行，早点撞墙比在第 8 个任务才发现强。

### Step 4: 写 task

每个 task 用 `references/task-template.md` 的格式。硬约束：

- **贴真实代码 / 命令 / 预期输出**——不是伪代码，不是"类似这样"，不是"调用相关函数"。写出实际要敲的代码、实际要跑的命令、实际预期的输出
- **禁占位符**——`<your code here>`、`TODO`、`...` 都不允许出现。如果你写不出真实代码，说明你还没想清楚这一步，那就回 Step 1 继续读
- **2-5 分钟粒度**——每个 task 是 agent 能在 2-5 分钟内完成的动作。超过就拆
- **Task sizing**：
  - **XS** — 1 个文件
  - **S** — 1-2 个文件
  - **M** — 3-5 个文件
  - **L / XL** — 不允许。超过 5 个文件的 task 必须再拆，没有例外

为什么禁 L/XL：大任务藏着没想清楚的判断。"实现登录系统"是 L，它把"密码怎么 hash""session 存哪""错误怎么返回"全压成一句话——这些都是设计决策，应该在 Plan 期拆开定掉，而不是 Build 期临时拍。

### Step 5: 插 checkpoint

每 2-3 个 task 插一个 checkpoint，用 `references/task-template.md` 里的 checkpoint 模板。checkpoint = 全部测试通过 + build 通过 + 用户 review。

为什么：checkpoint 是 rollback 的边界。出问题时回退到上一个 checkpoint，而不是回退整个计划。每个 task 也要 rollback-friendly——独立 commit，能单独 revert 不牵连别的。

### Step 6: 用户确认

把完整计划（依赖图 + 切片 + task 序列 + checkpoint）给用户。

Gate 是显式确认，不是沉默。"随你"是委托不是确认——重新提具体问题。

确认后退出 Plan，进 Build（或 executing-plans）。

## Gate

三条全过才算 Plan 完成：

- [ ] 计划已产出（依赖图 + 任务序列 + checkpoint）
- [ ] 所有 task ≤ M（≤ 5 文件），没有 L/XL
- [ ] 用户显式确认

外加 HARD-GATE：**计划里只要还有一处没贴真实代码 / 命令 / 预期输出，就不算完成。** 占位符 = 没写完。

## Common Rationalizations

| 借口 | 反驳 |
|---|---|
| "先写框架，代码执行时再填" | 执行时填 = 把设计决策推到最贵的时候做。写不出真实代码说明还没想清楚，回 Step 1 |
| "贴 `...` 表示省略，意思到了就行" | 意思没到。占位符正是藏判断题的地方，每个 `...` 都是一个待定的设计决策 |
| "这个 task 大点没关系，逻辑是连贯的" | 连贯不等于小。L 任务把多个设计决策压成一句话，拆开才看得见 |
| "横着按层做更整齐" | 整齐但每层做完都不可验证，集成风险全堆到最后。垂直切片每片都能跑能回滚 |
| "checkpoint 太频繁拖慢节奏" | checkpoint 是 rollback 边界。省掉它 = 出问题只能回退整个计划 |
| "简单的先做，难的留到后面" | 难的留后面 = 不确定性留到投入最大时才暴露。risk-first：最不确定的先撞 |
| "用户大概会同意，先开始" | "大概"不是确认。Plan 的成本就是为了让 Build 机械化，跳过确认等于赌 |

## Red Flags

- 计划里出现 `<...>` / `TODO` / `...` / "类似这样" / "调用相关方法"
- 某个 task 写不出具体要改哪几个文件
- 出现 ≥ 6 个文件的 task（L/XL），没有拆
- 按层横切（"先建所有 model"），没有一条端到端切片
- 连续 4 个以上 task 没有 checkpoint
- task 之间共享可变状态，无法单独 revert
- 最不确定 / 最可能不可行的部分被排到了最后
- 还没读相关代码就开始写 task（贴出的符号可能根本不存在）

## Verification Checklist

- [ ] Step 1 只读：读了 restate + 相关代码，Plan 期没碰代码
- [ ] 依赖图已画，底层任务排在依赖它的任务前面
- [ ] 至少一条垂直切片（端到端可交付），不是纯横切
- [ ] 每个 task 贴了真实代码 / 命令 / 预期输出，零占位符
- [ ] 所有 task ≤ M（≤ 5 文件），无 L/XL
- [ ] 每 2-3 个 task 有一个 checkpoint（测试 + build + review）
- [ ] 每个 task 可独立 commit、独立 revert
- [ ] 用户显式确认了完整计划
