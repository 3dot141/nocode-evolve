---
type: design-doc
topic: rule-trigger-eval
date: 2026-05-26
author: 3dot141
status: draft
---

# 规则触发率 eval — 设计

## 背景

本会话用户多次说"创建 PR / 提交推送 / 创建pr origin-upstream"，主 agent 未走 `rule-finishing-branch`，直接裸 `git` + `curl` 建 PR、用 `PUT` 加 reviewer（`bkt 附录`明令禁止的反模式）。该 rule 的 catalog 条目本就列了"创建 PR"做触发——措辞没问题，是没被认出/遵守。

需要一个机制，在加入/修改 `agent-catalog` 规则条目时，量化它"该触发时被认出的比例"，并把不达标挡在前面。

### Keystone 实证：subagent 是隔离环境

派 probe subagent 报告：它**不继承**主会话的 SessionStart 注入——只拿到"可调用 skill 一行 description 清单" + CLAUDE.md + 环境，没有 agent-catalog 路由、没有 model/*.md 常驻规则。含义：测某条 rule 触发率，必须往 subagent **显式重建会话上下文**再喂话术。

## 目标

- **主指标 momentum-aware route-recall ≥ 0.8**：给"该触发"的话术，在**重建会话上下文（`model/*.md` + `agent-catalog`）+ 任务情境 preamble（模拟主会话"正深陷另一任务、有动量"的压力）**下，subagent 把 `primary_route` 选中目标 rule 的比例 ≥ 0.8。
- 提供 Claude Code command 按需产出报告，成本低、不进 CI 硬阻断。

### 保真度（C1，用户选"更高保真"）

本会话失败**不是**冷启动认不出"创建 PR"，而是主 agent **深陷 benchmark 工作、有动量**时该 rule 被淹没。所以高保真的关键不是补全完整对话历史（补不回），而是给 probe 加 **任务情境 preamble**——复现"动量/上下文负载"这个最高价值的失真来源（与 superpowers pressure-scenario 测法合流，直击真实失败）。

- probe 输入 = SessionStart 重建（`model/*.md` + `catalog`）+ **preamble**（一段"你刚跑完 X、改了几个文件、正准备 Y"的任务动量铺垫）+ 触发话术。
- **残余 gap（诚实）**：仍无法复现精确的完整 200k 历史；但动量/压力是其中最高价值的部分，已覆盖。故 route-recall 是**高保真代理 + 压力冒烟**，比冷启单句逼真得多，但仍非 100% 真实触发率——措辞+抗动量达标是必要、强相关、非充分。

### 阶段化目标（C5）

- **v1（本设计）**：跑通 `finishing-branch` 一条的 fixture + report loop，确立格式与判分。**不承诺**所有 rule ≥0.8。
- **里程碑 2**：所有 catalog rule 都有 fixture；`/rule-eval --all` + 覆盖报告（列未覆盖 rule）；"改了 catalog 条目但没跑对应 eval"能被流程发现。只有补齐这些，"每条规则 ≥0.8"才谈得上。

### 非目标（YAGNI）

不测"压力下守不守规"（compliance-under-pressure）；v1 不做真实遵守的执行 trace eval（C3 留 v2）；不进 CI 硬阻断；不自动生成 fixtures。

## 架构

一个 plugin command 当 orchestrator → 读 fixtures → 对每条 case 派隔离 subagent（注入 `model/*.md` + `agent-catalog` + 一条话术）→ subagent 输出**结构化 JSON 决策** → orchestrator **机械判分**（exact-match + 布尔统计）→ 出报告（含 raw output）。

```
fixtures/<rule>.md ───────┐
model/*.md + catalog ─────┤(注入,重建会话上下文)
preamble(任务动量/压力) ──┤
                          ▼
  orchestrator(command) ──Agent 派生──▶ 隔离 subagent ──(可 Read 命中 rule)──▶ JSON{primary_route, secondary_routes, reason, read_files, will_do_actions}
                     ◀──────────────────────────────────────────────────────────────┘
                     │ 机械判分(exact-match, 不解读自然语言)
                     ▼
                  报告(route-recall / 混淆矩阵 / intent-signal / raw output)
```

## 实现

### 组件

| 组件 | 落点 | 职责 |
|---|---|---|
| eval command | `commands/rule-eval.md`（`/rule-eval [<rule-id> | --all]`） | 读 fixture(s)、逐 case 派 subagent、机械判分、出报告 |
| fixtures | `eval/cases/<rule-id>.md` | 正/负样本（分型）+ 每 case 期望 + rule 级默认 |
| 隔离 probe | 运行时 `Agent` 派生 | 收[model/*.md + catalog + **preamble(任务动量)** + 一条话术]，可 Read 命中 rule，输出 JSON |
| preamble 库 | `eval/preambles/<profile>.md` | 共享任务情境铺垫（v1 至少 `mid-task-momentum`：模拟深陷另一任务的压力）|

### probe 输出契约（C4/W2）

subagent **必须**输出严格 JSON（orchestrator 只 exact-match，不解读自然语言）：
```json
{
  "primary_route": "<rule-id | none>",
  "secondary_routes": ["<rule-id>", ...],
  "read_files": ["rules/rule-finishing-branch.md", ...],
  "will_do_actions": ["gate-tb", "gate-pr", "use-bkt", "no-put-reviewer"],
  "reason": "<一句话>"
}
```
- 入口判定只看 `primary_route`；链式/嵌套看 `secondary_routes`（W2）。
- `will_do_actions` 是**动作 ID 数组**（枚举，非自然语言），对齐 rule 里的 gate 名/步骤 ID。
- probe 输入**不含期望答案**（防泄漏）。

### fixture 格式（W3/W5）

```markdown
# rule-finishing-branch
primary_route: finishing-branch
acceptable_alternates: []          # 真两可才填；只进歧义桶，不进 0.8 分子
preamble_profiles: [cold, mid-task-momentum]   # 每条正样本在这些情境下各跑一次；recall 取最严(动量下)
default_intent:                    # rule 级默认，case 可覆盖
  must_action_ids:    ["gate-pr", "use-bkt"]
  forbidden_action_ids: ["put-reviewer", "raw-curl-pr"]
  required_read: "rules/rule-finishing-branch.md"

## positive            # 每条可带 case 级 expected/forbidden 覆盖默认
- 帮我提个 PR
- 创建 pr
- push 完了，合并到 release
- submit a pull request for this

## negative            # 分型，每型 ≥2 条
- [near-miss]          我现在在哪个分支
- [explicit-exclusion] 帮我写 PR 描述但先别提交
- [other-rule-primary] 总结这次 push 都改了啥      # → 应路由 push-summary
- [tool-only]          列一下当前打开的 PR
```

### 判分（机械，C2/C4/W1/W4）

每条 case：
- **route-recall**（主门）= 正样本中 `primary_route == 目标 rule` 的占比，重建上下文下测，**≥0.8 PASS**。
- **acceptable_alternates**：`primary_route ∈ alternates` 的样本进"歧义桶"单列，**不进 recall 分子**（C2，避免互列虚高）。
- **steal/precision 预算**（C2）：本 rule 抢了别条 `other-rule-primary` 负样本的占比 > 0.1 → WARNING/FAIL。
- **失败分型**（W1）：每个 miss 标 `route_miss`（进触发 gate）/ `rule_read_but_noncompliant` / `tool_policy_violation` / `context_interference`（后三者进 intent-signal，不进 route gate）。
- **intent-signal**（C3，**不叫"遵守率"**）= 命中样本中 `will_do_actions ⊇ must_action_ids` 且 `∩ forbidden_action_ids == ∅` 的占比。是意图信号，非真实遵守。
- 判分全 exact-match / 布尔；报告**必列 raw output**。

### 混淆矩阵（W4）

所有 rule 正样本一起跑，记录各自 `primary_route` 落点。对角=命中，非对角=串扰。混淆矩阵是**诊断假设 + 证据**（每个 miss 列：user phrase / route / reason / read_files / 相邻 rule 描述片段），**不自动开"改措辞"这种单一处方**。

### 报告

每条 rule 一段：route-recall N/M（vs 0.8，PASS/FAIL）+ 歧义桶 + steal 率 + intent-signal + 逐 miss 证据 + raw output。v1 inline 输出，不落文件。

## 方案选型

- **隔离 probe + 注入重建上下文** vs 真主会话测：后者无法自动化、无法隔离变量；前者可自动化但有保真 gap（C1，已在目标里诚实标注）。取前者，gap 显式记。
- **orchestrator 内联 exact-match 判分** vs 独立 judge LLM：JSON + exact-match 把自评偏差降到最低（C4），省一次 judge 调用；自然语言判断已从设计剔除。v1 取内联 exact-match。
- **command 驱动 + agent 自派 subagent** vs 独立脚本 runtime：command 复用 agent 的 Agent 能力，无新 runtime，成本低；契合插件已有 commands/ 模式。

## 其他

### 部署 / enforcement（软门，S3）

不进 CI。写进"改/增 catalog 条目"的流程（仿 `writing-skills` Iron Law）：
- 改/增条目 → 跑 `/rule-eval <rule-id>`，**PR/commit message 必含 eval 摘要**；
- 该 rule 无 fixture → 先补 fixture 再改；
- 紧急跳过 → 写 `skip_reason` + 补测 待办编号；
- `route-recall < 0.8` 不交（RED→改措辞→GREEN 复跑）。

### 失败模式

- probe 不输出合法 JSON → 该 case 判 invalid，报告单列，不计入分母（需复跑/修 probe 指令）。
- 注入的 model/*.md / catalog 过期 → orchestrator 每次现读源文件，不缓存。

### v1 待办

1. `commands/rule-eval.md`（注入 model/*.md + catalog + preamble；JSON 契约；exact-match 判分；混淆矩阵）
2. `eval/preambles/mid-task-momentum.md` + `cold.md`（任务动量铺垫）
3. `eval/cases/finishing-branch.md`（分型正负样本 + action-id 词表 + preamble_profiles）
4. 跑 RED 基线看现状（动量情境下）
5. 据混淆矩阵证据调 catalog 条目措辞到 ≥0.8（GREEN）
6. bkt 附录自识别改动 + 同步 finishing-branch fixture 的 action-id
7. 把"改 catalog 必跑 rule-eval"写进 agent-catalog 维护段

---

## Review Log

### Codex 独立审稿（260526，scenario 4）

| # | 级别 | 结论 | 处置 |
|---|---|---|---|
| C1 | Critical | clean-room 测 catalog-only 路由,代表不了主会话 | **fix**: probe 注入 model/*.md+catalog 重建上下文;目标改"route-recall(代理指标)+诚实 gap" |
| C2 | Critical | acceptable_routes 互列虚高 | **fix**: primary_route(进分子)+acceptable_alternates(歧义桶)+steal 预算 |
| C3 | Critical | WILL_DO 关键词撑不起"遵守" | **fix**: 改 intent-signal + action-id 枚举;真遵守 trace eval 留 v2 |
| C4 | Critical | 主 agent 内联判分自评偏差 | **fix**: JSON 契约 + exact-match + 列 raw output |
| C5 | Critical | 范围/承诺不匹配 | **fix**: 目标阶段化(v1 跑通;全 rule≥0.8 是里程碑2,需 --all+覆盖+变更检测) |
| W1 | Warning | 没区分没触发 vs 触发后不遵守 | **fix**: 失败分型,只 route_miss 进 route gate |
| W2 | Warning | 单 ROUTE 承担入口+链式 | **fix**: primary_route + secondary_routes |
| W3 | Warning | 负样本太弱 | **fix**: 负样本分型(near-miss/explicit-exclusion/other-rule-primary/tool-only) |
| W4 | Warning | 混淆矩阵→病因推断过强 | **fix**: 改诊断假设+证据,不自动开处方 |
| W5 | Warning | key_actions rule 级一刀切 | **fix**: 下沉 case 级(default + case 覆盖) |
| S1 | Suggestion | 缺 frontmatter | **fix**: 补 YAML frontmatter |
| S2 | Suggestion | 非 design-doc 骨架 | **fix**: 重排背景/目标/架构/实现/方案选型/其他 |
| S3 | Suggestion | 软门缺流程契约 | **fix**: 补报告位置/无 fixture/跳过/补测 契约 |

## 后记：RED 基线实证 → pivot 到真实遵守

跑 finishing-branch 的 RED 基线（6 正样本 × mid-task-momentum，clean-room probe）：**route-recall = 6/6 = 1.00**，每个 probe 都正确路由、读了 rule、选了 gate/bkt、拒了 PUT/裸 curl。

**关键发现（实证 C1）**：eval 绿、但本会话我（真实主会话）红。一段"你很忙"的 preamble 远弱于真实 200k token 深度负载——所以**这个 eval 测不到真实失败**。触发措辞本就 ≥0.8，本会话栽的是**深度负载下知道却没在那刻行动**（遵守，非 discovery）。

**决定（用户选"转去攻真实遵守"）**：eval 保留为"措辞守门"（对未来措辞糟的新规则有用），但真实遵守另用机械手段——**UserPromptSubmit hook 触发点重新浮现**：

- `hooks/triggers.json`（触发词，与 catalog 触发行一致，v1 先 finishing-branch）
- `hooks/trigger-resurface.mjs`（读 stdin prompt → 命中 → stdout 注入即时提醒）
- 注册进 `hooks/hooks.json` 的 `UserPromptSubmit`
- 非阻断（只追加提醒，误触发代价低）
- 确定性测试：6/6 正样本触发、6/6 负样本静默

不靠 agent 在动量里自觉——触发那刻硬把规则怼到眼前。eval（措辞质量）+ hook（即时浮现）互补闭环。
