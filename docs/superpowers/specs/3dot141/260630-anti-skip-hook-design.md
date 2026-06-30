---
type: design-doc
topic: anti-skip-hook
date: 260630
author: 3dot141
status: draft
---

# 防跳步 Hook 设计文档（anti-skip-hook）

**Goal**: 在 harness 层兜住"进了 workflow skill 却跳步"，补 markdown 层（commit 67bc104）无法机制化强制的盲区。
**Architecture**: 两个 CC hook（PreToolUse on Skill 提醒 + Stop 拦截未完成交接 task）+ manifest 单源生成 15 skill 名单。纯 Node.js「纯函数 + CLI driver」。

> 决策编号用本文档局部前缀 `AD`（anti-skip decision），避免与 `260601-rework-plan.md` 的 D1–D3 撞号。引 D1 时特指那份 plan 的「PreToolUse 默认 inject」决策。

---

## 1. 背景

防跳步目前只有**文本层**（commit 67bc104，4.2.x）：常驻单源 `agent-catalog-using.md`「进了 skill 就走完」+ 15 个 devflow/pdflow skill 下沉借口表 / 红旗 / 交接 task。

**核心问题（主因）**：red-blue 独立审查指出最大盲区——文本层全靠散文劝导，一个"想跳步"的 agent 仍能绕过。本仓库 RFC-001 早有同源教训：`finishing-branch` 在 clean-room route-recall **6/6 满分，真实主会话仍触发失败** [Read docs/plans/3dot141/260526-rule-trigger-eval-design.md:183-185]，证明「组织做到满分也不保证遵守」，才转向机械手段。本设计补的就是运行时强制层。

**辅因**：进 skill 时缺一道机制化提醒减速带（借口型漏步）。Hook A 顺带治。

文本层强制（措辞组织）vs 运行时拦截（hook）是 RFC-001 明确的**正交两件事**，可独立采纳。本设计不改文本层，只加 hook。

### 涉及的 15 个 workflow skill（SA1/S3：显式列举，避免实施者推错）

```
devflow            pd-research
pdflow             pd-prd
dev-define         pd-ix
dev-design         pd-vd
dev-design-refine
dev-design-render
dev-plan
dev-build
dev-verify
dev-review
dev-land
```

均以 `nocode-evolve:` 为前缀。这份名单是 BF5 生成 `workflow-skills.json` 的源、也是 §8 要回改 metadata 的 15 个 SKILL.md。

---

## 2. 调研

### 代码现状（现有 hook 体系）

- [Read hooks/pretooluse-guard.mjs:35-61] 可复用「纯函数 + CLI driver」骨架：stdin 读 `fs.readFileSync(0)`，JSON.parse 失败静默 `exit 0`，决策靠 stdout JSON body 而非 exit code。
- [Read hooks/pretooluse-guard.mjs:24-32] inject 走 `hookSpecificOutput.additionalContext`（**不带** `permissionDecision`）；block 走 `permissionDecision:'deny'`（**仅 PreToolUse 支持**）。
- [Read hooks/pretooluse-guard.mjs:48-56] `NOCODE_EVOLVE_OBSERVE=1` opt-in 观测落盘（敏感信息截断 `slice(0,200)`）——W3 的 canary 复用此套路。
- [Read hooks/generate.mjs:146-151] 单源生成：`targets(m)` 把 manifest 渲染成生成物，BF5 在此挂载 `genWorkflowSkills(m)`。
- [Read hooks/hooks.json] 现注册 SessionStart / PreToolUse / PostToolUse，**无 Stop**。

### CC hook 能力（claude-code-guide 查官方）

- [SOURCE: code.claude.com/docs/en/hooks] Stop hook 输入**无 task 列表**，但有 `transcript_path` → 读 JSONL 重建 task 状态。
- Stop 只在主 agent 触发，subagent 走 SubagentStop → 挂 Stop 天然隔离 fork。
- block 格式 `{"decision":"block","reason":"..."}`；`additionalContext` 上限 **10000 字符**。
- 主/子上下文判定：`agent_id` 存在 = subagent。
- **Stop hook 仓库从未用过、没讨论过 = 全新决策，无现成依据。**

### spike 实测（真实 transcript）

- Skill 工具 `tool_input.skill` = skill 名 ✅（确认）。
- TaskCreate（观测到 `subject/description/activeForm`）+ TaskUpdate（`taskId/status`）= **增量模型**，非 TodoWrite 全量快照。
- **⚠️ 重要 caveat（C1/Q1）**：spike 观测的 TaskCreate **没有 metadata 字段，是因为当时建 task 没传 metadata**——并未证实 TaskCreate 接受的 `metadata` 能在 transcript 的 tool_use input 里被 Hook B 读到。这是 Hook B 的**承重前提**，列为实测项第一位（§10 阶段0）。

### 已有决策

- [Read docs/plans/3dot141/260601-rule-trigger-rework-plan.md:17] **D1（外部）**：PreToolUse 默认 inject，仅高危不可逆才 block，理由是**误拦代价 inject < block**。
- 单源消除双源漂移（manifest 唯一真值源）。
- 踩坑：additionalContext 10000 截断、line-wrap 绕过防护、bypass 观测隐私 gate。

---

## 3. 方案选择

### Q1: hook 力度——要不要 Stop 层、用什么力度？→ 影响 BF4

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| 1. 纯 inject | 只 Hook A 进 skill 提醒 | 对齐 D1、零脆性 | 治不了断链型 |
| **2. inject + Stop block** | Hook A + Hook B 拦未勾交接 task | 真挡住断链型 | Stop 新机制、transcript 脆性、误判风险 |
| 3. inject + Stop 软提醒 | Hook B 只 additionalContext | 对齐 D1 | agent 已决定停，力度弱 |

**选 2**。断链型是非主观根因，软提醒在 agent 已决定停时力度太弱。

**与 D1 的关系（W1 修正——正面立论，不偷换轴）**：D1 的真实轴心是**误拦代价**（inject < block，怕阻断合法操作）。Hook B 用 Stop 的 `{decision:'block'}`，本就和 D1 针对的 PreToolUse `permissionDecision:'deny'` 是**两套机制**——所以这不是"套用 D1 精神"，而是**对 D1 默认姿态的有意例外**，需独立论证误拦代价：
- Hook B 的误拦代价 = **一次 re-prompt 往返**（reason 明确告知"确实要停就再说一次"，第二次 Stop 经 `stop_hook_active`/标记文件放行，见 BF4）。
- 对比 D1 怕的"合法 git push 被 deny"——那是阻断不可逆操作；Hook B 误拦只是多问一句，代价低一个量级。
- 故结论：在"误拦只赔一次往返"的前提下，对断链型用 block 是可接受的有意例外。**前提成立依赖 W2/W4 把误判率压到最低 + BF4 的二次放行兜底。**

其余实现层决策落在各模块设计里。

---

## 4. 领域划分 + 总图

### 拆分思路（单域）

所有逻辑围绕一个实体：**「workflow skill 的执行完整性」**。域内按 hook 生命周期位置拆 3 模块：进 skill（Hook A 提醒）/ 停下（Hook B 检查交接）/ 名单来源（单源生成，仅 Hook A 消费）。变更独立：改提醒文案只动 Hook A、改交接检查只动 Hook B、改名单只动 manifest。

### 域内模块关系图（总图）

```
┌────────────────────────────────────────────────────────────┐
│                     防跳步 hook 域                           │
│                                                             │
│   ┌──────────────┐              ┌──────────────────┐       │
│   │  Hook A       │              │  Hook B           │       │
│   │ PreToolUse    │              │  Stop             │       │
│   │ matcher:Skill │              │  [BF2 重放]       │       │
│   │ [BF1 提醒]    │              │  [BF3 查交接]     │       │
│   │   [P1]        │              │  [BF4 decide]     │       │
│   └──────┬───────┘              │   [P2]            │       │
│          │ 读名单                └──────────────────┘       │
│          ↓                       （不读名单，只读 transcript │
│   ┌──────────────────────┐       找 handoff metadata）      │
│   │ 单源生成 [BF5]         │                                 │
│   │ genWorkflowSkills      │                                 │
│   └──────────────────────┘                                  │
└────────────────────────────────────────────────────────────┘

约束.1（[P3] fork 排除）: Hook A 判 agent_id 非空则放行；Hook B 挂 Stop 天然隔离 + 读 agent_id 兜底（S1）
约束.2: 整体解析失败默认放行（不阻断 session）；但行级丢失偏向放行（W2）
```

| 模块 | 职责 | 路径 ID | BF |
|---|---|---|---|
| Hook A | 进 workflow skill 时 inject 提醒 | P1 | BF1 |
| Hook B | Stop 时拦未完成交接 task | P2 | BF2/BF3/BF4 |
| 单源生成 | manifest → 15 skill 名单生成物 | 单源 | BF5 |

---

## 5. 架构设计

### hook 在 CC 生命周期的位置

```
agent 调 Skill(workflow skill)
  ↓ ←─ [Hook A] PreToolUse matcher:Skill：skill ∈ 名单 且 非 fork？→ inject 提醒
skill 执行（TaskCreate 建 task，交接 task 带 metadata:{handoff:true}）
  ↓ TaskUpdate 改 status（transcript 累积 tool_use / tool_result 事件）
agent 准备停下
  ↓ ←─ [Hook B] Stop：读 transcript 重放 → 有未完成 handoff task？→ block
停 / 继续
```

### 数据流（Hook B transcript 重放）

```
Stop 输入 { transcript_path, stop_hook_active?, agent_id? }
  ↓ 流式读 JSONL，逐行挑 tool_use / tool_result
TaskCreate（subject, metadata, tool_use_id） + tool_result（taskId ← tool_use_id） + TaskUpdate（taskId, status）
  ↓ 重放：taskId → {subject, metadata, status}
当前 task 状态表
  ↓ 筛 metadata.handoff==true && status ∈ 活动态(pending/in_progress)
未完成交接 task 列表 → 非空 block / 空放行
```

技术选型：纯 Node.js（无新依赖）；Hook A 挂 PreToolUse（matcher:Skill）；Hook B 挂 Stop；名单走 manifest 单源。

---

## 6. 系统交互场景（纯后端无 UI）

### 场景 1：进 workflow skill 提醒 [P1]

agent 调 `Skill('nocode-evolve:dev-plan')` → Hook A 见 skill ∈ 名单且 agent_id 空 → inject「进了 dev-plan：第一步 TaskCreate 建全 task，走完所有 Step，最后一个 task 调下一阶段 skill」。负例：`Skill('nocode-evolve:bkt')` 不在名单 → 不 inject。

### 场景 2：Stop 时拦未勾交接 task [P2]

agent 做完 dev-plan 实质步骤，但「交接 dev-build」task 仍非 completed → Stop 触发 Hook B → 重放发现 metadata.handoff 且活动态的 task → block，reason 列出 + 告知"确实要停就再说一次"。负例：交接已 completed / 无交接 / 已 cancelled → 放行。

### 场景 3：fork 排除 [P3]

fork subagent 调 Skill → Hook A 见 agent_id 非空 → 放行。fork 结束 → SubagentStop（非 Stop）→ Hook B 不触发；即便某版本 Stop 误对 subagent 触发，Hook B 读 agent_id 兜底放行（S1）。

---

## 7. 领域层设计

### 7.1 Hook A 模块（`hooks/skill-entry-reminder.mjs`）

类接口（纯函数 + CLI driver）：

```
matchWorkflowSkill(skill, skillList) → boolean
decideReminder(payload, skillList) → output | null
loadSkillList() → string[]      // SA2：CLI driver 启动时读 hooks/workflow-skills.json（生成物），解析失败返回 [] → 全放行
```

**SA2 — skillList 加载**：CLI driver 在 `import.meta.url === file://argv[1]` 入口里 `loadSkillList()` 一次性同步读 `${__dirname}/workflow-skills.json`，传给 `decideReminder`。读不到/解析失败 → 返回空数组 → `decideReminder` 一律 return null（不阻断）。

**BF1 — 进 skill 提醒**：

```
function decideReminder(payload, skillList):
  if payload.agent_id: return null                  // fork/subagent 不触发 [P3, 约束.1]
  if payload.tool_name != 'Skill': return null       // 只管 Skill 工具
  skill = payload.tool_input?.skill                  // spike 确认字段名=skill
  if !skill or skill not in skillList: return null   // 不在 15 名单 → 不提醒 [P1 负例]
  return {                                            // inject（不带 permissionDecision）
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: REMINDER_TEXT                // 「TaskCreate 必调+走完所有 Step+末尾交接」，固定常量 <10000 字符
    }
  }
```

### 7.2 Hook B 模块（`hooks/handoff-stop-guard.mjs`）

类接口：

```
replayTaskState(lines) → { tasks: Map, parseStats: {total, parsed, toolUseSeen} }
findOpenHandoffTasks(taskState) → task[]
decideStop(payload) → output | null
```

**BF2 — 重放 task 状态（含 W2 丢行偏放行 + W3 canary 统计）**：

```
function replayTaskState(lines):
  tasks = {}; pending = {}                            // taskId→{subject,metadata,status}; tool_use_id→{subject,metadata}
  stats = { total:0, parsed:0, toolUseSeen:0 }        // W3：供 decideStop 判"解析到 0 task"漂移
  for line in lines:
    stats.total++
    o = tryParse(line)
    if !o: continue                                    // W2：坏行跳过——但下游对"completed 行可能被跳"偏向放行
    stats.parsed++
    for c in toolUses(o):
      stats.toolUseSeen++
      if c.name == 'TaskCreate':
        pending[c.id] = { subject:c.input.subject, metadata:c.input.metadata || {} }
      elif c.name == 'TaskUpdate' and tasks[c.input.taskId]:
        tasks[c.input.taskId].status = c.input.status  // 增量重放 status
    for r in toolResults(o):
      if pending[r.tool_use_id]:                        // Q2：关联字段名假设为 tool_use_id，待 Plan 实测
        tasks[r.taskId] = { ...pending[r.tool_use_id], status:'pending' }
  return { tasks, parseStats: stats }
```

> 注：BF2 引用的 `tool_use_id` / `r.taskId` 字段名是**假设、待 Plan 阶段实测项#3 核实**（Q2）。时序上 TaskUpdate 因果上不可能早于产出 taskId 的 tool_result（agent 拿不到 taskId 就发不出 update），故 JSONL 顺序下时序安全；真正风险是**丢行**，由 W2 偏置 + W3 canary 兜。

**BF3 — 找未完成交接 task（W4 活动态白名单）**：

```
function findOpenHandoffTasks(taskState):
  return values(taskState).filter(t =>
    t.metadata?.handoff == true &&
    t.status in ['pending', 'in_progress'])            // W4：活动态白名单，cancelled/completed 都不拦
```

**BF4 — Stop decide（含防循环 + W2/W3 安全偏置）** ← 决策来自 §3 Q1：

```
function decideStop(payload):
  if payload.agent_id: return null                     // S1：fork 兜底，subagent 不拦
  if payload.stop_hook_active or markerExists(session): return null  // 防循环：已 block 过就放行 [AD-防循环]
  try:
    { tasks, parseStats } = replayTaskState(readLinesStreaming(payload.transcript_path))
  catch:
    return null                                         // 整体解析失败 → 放行，不阻断 session [约束.2]
  if parseStats.toolUseSeen == 0:                       // W3：能 parse 但 0 个 tool_use = schema 漂移信号
    observeCanary('stop-parsed-zero-tooluse')           // opt-in 落盘（复用 NOCODE_EVOLVE_OBSERVE）
    return null                                         // 静默失效优于误判 → 放行
  open = findOpenHandoffTasks(tasks)
  if open.length == 0: return null                      // 无未完成交接 → 放行 [P2 负例]
  writeMarker(session)                                  // 防循环兜底：本次 block 留痕
  return {
    decision: 'block',
    reason: `还有交接 task 未完成：${open.map(t=>t.subject)}。完成交接再停；确实要停就再说一次。`
  }
```

**防循环**（[SOURCE] stop_hook_active 待实测）：优先用 Stop 输入的 `stop_hook_active`；若该字段实测不存在，用 session 级标记文件（scratchpad `.handoff-blocked-<session>`），block 时写、放行时清。同 session 第二次 Stop 见标记则放行 → 误拦最多赔一次往返（呼应 §3 Q1 误拦代价立论）。

### 7.3 单源生成模块（`hooks/generate.mjs` 加 `genWorkflowSkills`）

**BF5 — 生成 15 skill 名单**：

```
function genWorkflowSkills(m):
  skills = m.workflow_skills                            // manifest 顶层新增数组（唯一真值源）
  return { file:'hooks/workflow-skills.json', text:JSON.stringify({skills}, null, 2) }
  // 塞进 targets(m)（generate.mjs:146-151），check()/renderAll 自动获得漂移检测 + SessionStart --check 兜底
```

### 接口设计

**hook 输入输出契约**：

| Hook | 事件 | 输入关键字段 | 输出 |
|---|---|---|---|
| A | PreToolUse(matcher:Skill) | tool_name, tool_input.skill, agent_id | `{hookSpecificOutput:{additionalContext}}` 或 exit 0 空 |
| B | Stop | transcript_path, stop_hook_active?, agent_id? | `{decision:'block', reason}` 或 exit 0 空 |

**数据契约**：

```
hooks/workflow-skills.json（生成物，禁手改）: { "skills": ["nocode-evolve:devflow", ... 15 个] }
交接 task metadata（15 skill 交接 task 模板回改）: TaskCreate(..., metadata:{ handoff:true })   // ⚠️ 可见性待 §10 阶段0 实测
```

---

## 8. 实现.异常与失败模式（C2 补）

| 所属 BF | 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|---|
| BF1 | 名单文件读不到/坏 | workflow-skills.json 缺失或非法 JSON | `loadSkillList` 返回 [] → 不提醒（不阻断 Skill 调用） | 吞 |
| BF1 | REMINDER_TEXT 超限 | 文案 >10000 字符 | 固定常量，构建期保证 <10000；单测断言长度 | 吞（设计期防 ） |
| BF2 | 单行损坏 | transcript 某行非法 JSON | 跳过该行（W2：可能漏读 completed → 下游偏放行兜） | 吞 |
| BF2 | metadata 不可见 | TaskCreate 的 metadata 未在 transcript tool_use input 出现（C1/Q1） | Hook B 找不到 handoff task → 全放行（退化为无 Hook B，非误判） | 吞（阶段0 实测前不上 Hook B） |
| BF4 | 整体解析异常 | transcript 读失败/格式全变 | catch → 放行（约束.2） | 吞 |
| BF4 | schema 漂移（能 parse 但 0 tool_use） | CC 改 transcript 结构 | canary 落盘 + 放行（W3） | 吞 + 观测 |
| BF4 | block 死循环 | Stop block 后重新触发 Stop | stop_hook_active / 标记文件二次放行（AD-防循环） | — |
| BF5 | manifest 缺 workflow_skills | 字段未填 | `skills=undefined` → 生成空名单 → generate --check 应报；建议 generate 加非空断言 | 上抛（生成期失败优于静默） |

设计姿态：**所有运行时失败一律偏向"放行"**，最坏退化为"hook 不存在"而非"卡死 session"。唯一上抛的是 BF5 生成期错误（构建期暴露好于运行期静默）。

---

## 9. 文件影响汇总

```
hooks/
  ├── skill-entry-reminder.mjs        (NEW)       Hook A [BF1]
  ├── skill-entry-reminder.test.mjs   (NEW)       Hook A 单测
  ├── handoff-stop-guard.mjs          (NEW)       Hook B [BF2-4]
  ├── handoff-stop-guard.test.mjs     (NEW)       Hook B 单测
  ├── hooks.json                      (改)        PreToolUse 加 matcher:Skill；新增 Stop
  ├── generate.mjs                    (改)        加 genWorkflowSkills + 塞 targets()
  ├── generate.test.mjs               (改)        加生成物断言
  └── workflow-skills.json            (NEW 生成物) 15 skill 名单（禁手改）
rules/manifest.json                   (改)        加 workflow_skills 名单字段
skills/{15 个 workflow skill}/SKILL.md (改)        交接 task 模板加 metadata:{handoff:true}
.claude-plugin/plugin.json            (改)        升 minor 版本

合计：5 NEW + 1 生成物 + 3 改基建 + 15 skill 改 + 1 版本
```

---

## 10. 验证策略汇总

| TO | 覆盖 | 层级 | 说明 |
|---|---|---|---|
| TO-1 | P1 | 单测 | skill∈名单+主agent → inject |
| TO-2 | P1负 | 单测 | 不在名单/非Skill/agent_id存在 → null |
| TO-3 | P2 | 单测 | 构造 transcript（活动态 handoff task）→ block |
| TO-4 | P2负 | 单测 | 交接 completed/cancelled/无交接 → null（W4） |
| TO-5 | P2容错 | 单测 | 整体解析失败/丢行 → 放行（W2） |
| TO-6 | W3 漂移 | 单测 | 能 parse 但 0 tool_use → canary + 放行 |
| TO-7 | P3 | 单测 | agent_id 存在 → 放行；Stop 事件隔离 |
| TO-8 | 防循环 | 单测 | stop_hook_active/标记 → null |
| TO-9 | 单源 | check | genWorkflowSkills 生成物与 manifest 一致 |

**Verify**：纯函数单测为主（抄 `pretooluse-guard.test.mjs`，喂构造 transcript fixture）。

### 阶段0（命门实测，先于一切实现）— C1/Q1/SA3

**Hook B 全部价值的前提是 metadata 可见**。实现任何东西前，先验证：

1. **TaskCreate 的 `metadata` 是否在 transcript 的 tool_use input 里持久化、可被读取**（C1/Q1）——写一次性 dump，建一个带 `metadata:{handoff:true}` 的 task，grep transcript 确认 metadata 出现。
2. tool_result → taskId 的真实关联字段名（Q2，BF2 假设 `tool_use_id`）。
3. Stop 输入是否有 `stop_hook_active`（防循环）+ 是否含 `agent_id`（S1/Q3）。
4. Skill `tool_input.skill` 字段（spike 已确认，复核）。

**阶段0 gate（SA3）**：第 1 项不通过 → 不实现 Hook B、不给 15 skill 焊 metadata，回退方案（如改用 subject 文本标记或放弃 Hook B）。**阶段1 也必须 gate 在第 1 项之后**，避免把死 metadata 焊进 15 个 skill。

### 分阶段落地

- **阶段0**：命门实测（上）。
- **阶段1**（命门通过后）：Hook A（进 skill 提醒）+ manifest 名单 + genWorkflowSkills + 15 skill metadata。简单、零脆性。
- **阶段2**：Hook B（Stop 拦截）。依赖阶段0 + metadata 铺好。

**不测项**：真实 Stop 端到端触发——核心解析路径（tool_result→taskId 关联）未在活 harness 验，风险显式留存到阶段0/阶段2 实测，不在本设计内消除。

### 承重假设（风险）

transcript JSONL 逐行 schema 无稳定契约。两类退化都已兜：异常 → catch 放行（BF4）；能 parse 但字段变 → 0-tool_use canary + 放行（W3）。最坏退化为"无 Hook B"而非"卡死 session"。长期靠 W3 canary 的 opt-in 观测发现生产漂移。

---

## Review Log

### Round 1（general-purpose 独立 review，codex 未登录降级单路）

Report 摘要：C1（metadata 未验证可见性、不在实测项）、C2（缺异常表）、W1（D1 framing）、W2（丢行误 block）、W3（静默退化）、W4（status 过宽）、W5（D 编号撞号）、W6（偏离骨架）、S1（Hook B agent_id 兜底）、S2（不测项 oversell）、S3（列 15 skill）、Q1-Q3（metadata/taskId/agent_id 待实测）、SA1-3。

用户决定：**全修 C+W+关键 SA，Q 标实测**（授权自主推进）。

修订摘要：
- C1/Q1/SA3 → §2 spike 补 caveat + §10 新增"阶段0 命门实测"并 gate 阶段1。
- C2 → 新增 §8「异常与失败模式」表（含 BF1/BF5 失败模式）。
- W1 → §3 Q1 改为正面立论（误拦代价=一次 re-prompt 往返，承认是对 D1 的有意例外）。
- W2 → BF2/BF4 明确"丢行偏放行"，§8 列入。
- W3 → BF4 加 0-tool-use canary（复用 NOCODE_EVOLVE_OBSERVE）。
- W4 → BF3 改活动态白名单（pending/in_progress）。
- W5 → 决策编号改本文局部前缀 AD，引 D1 明确指 260601 plan。
- W6 → 补 frontmatter（type/topic/date/author/status）+ 异常节；保留 10 节可读结构（reviewer 也认"内容散落齐了"）。
- S1 → BF4 加 agent_id 兜底。S2 → §10 不测项措辞收紧。S3/SA1 → §1 列全 15 skill。SA2 → §7.1 补 loadSkillList。
- Q1/Q2/Q3 → 标注为阶段0 实测项（answer，非 skip）。
