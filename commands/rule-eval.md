---
description: 跑某条 agent-catalog 规则的触发率 eval (momentum-aware route-recall + 混淆矩阵 + intent-signal), 出报告
argument-hint: <rule-id> | --all
---

# /rule-eval — 规则触发率 eval

测某条 catalog 规则"该触发时被认出"的比例（momentum-aware route-recall），出报告。设计见 `docs/plans/3dot141/260526-rule-trigger-eval-design.md`。

参数 `$ARGUMENTS`：一个 rule-id（如 `finishing-branch`）或 `--all`。

## 你（orchestrator）要做的

### 1. 读注入载荷 + fixture
- SessionStart 载荷（重建会话上下文）：`model/agent-about.md`、`model/agent-karpathy.md`、`model/agent-catalog.md`（及 `model/` 下其他 `*.md`）。
- fixture：`eval/cases/<rule-id>.md`（正/负样本、`preamble_profiles`、`default_intent`、action-id 词表）。
- 每个 preamble：`eval/preambles/<profile>.md`。

### 2. 逐 case × 每个 preamble 派 clean-room subagent
对 fixture 每条样本（正+负）× 每个 `preamble_profile`，用 `Agent`(general-purpose) 派一个 subagent。并发派发、各自独立。prompt 拼装如下——**不透露期望答案 / 不说这是 eval / 不暗示该走哪条**：

```
<preamble 内容>

---
以下是你的规则路由表与行为基线（你的常驻注入）：
<model/agent-about.md 全文>
<model/agent-karpathy.md 全文>
<model/agent-catalog.md 全文>
---
用户说："<样本话术>"

判断这句该路由到哪条规则。可 Read 命中的 rules/rule-*.md 确认。
最后只输出一个 JSON（别的都不要）：
{
  "primary_route": "<rule-id 或 none>",
  "secondary_routes": ["..."],
  "read_files": ["..."],
  "will_do_actions": ["从下面 action-id 词表里选你真会做的"],
  "reason": "<一句话>"
}
action-id 词表（含干扰/反例项）：<贴 fixture 里的词表>
```

### 3. 机械判分（只 exact-match / 布尔，不解读自然语言）
- **route-recall** = 正样本中 `primary_route == <rule-id>` 占比。每条正样本多 preamble 时**取最严**（任一情境漏即记该条漏），报告分情境列。**≥0.8 = PASS**。
- **steal** = 负样本中 `primary_route == <rule-id>` 占比（尤其 `other-rule-primary`）。**>0.1 = WARNING**。
- **intent-signal** = 命中正样本中 `will_do_actions ⊇ must_action_ids` 且 `∩ forbidden_action_ids == ∅` 占比。**标注为意图信号，非真遵守。**
- **失败分型**：每个 miss 标 `route_miss` / `rule_read_but_noncompliant` / `tool_policy_violation` / `context_interference`（只 `route_miss` 进 route gate）。

### 4. 出报告（inline）
每条 rule 一段：
- route-recall N/M（分 `cold` / `mid-task-momentum`）vs 0.8 → PASS/FAIL
- steal 率、intent-signal 率
- 逐 miss 证据：话术 / preamble / primary_route / reason / read_files / **raw JSON**
- 诊断假设（措辞模糊 vs 被相关规则抢 vs 样本窄 vs probe 没读文件…）+ 证据，**不自动开单一处方**

### 5. `--all`
对 `eval/cases/` 下每条 fixture 跑；汇总**混淆矩阵**（各 rule 正样本的 `primary_route` 落点，对角=命中、非对角=串扰）；列**未覆盖**的 catalog rule（有条目但无 fixture）。

## 不要
- 不透露期望答案 / 不暗示该走哪条 / 不告诉 subagent 这是测试。
- 不用自然语言判断代替 exact-match。
- route-recall 与 intent-signal 并列时必须标清后者是**意图信号、非真遵守**。
