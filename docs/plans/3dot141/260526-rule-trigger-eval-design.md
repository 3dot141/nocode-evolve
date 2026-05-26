# 规则触发率 eval — 设计

> 260526 · 3dot141 · status: draft（待实施）

## 目标 / 成功标准

加入或修改 `agent-catalog` 里的规则条目时，保证其**触发率 ≥ 0.8**——给一组"该触发"的真实用户话术，agent 能正确认出"该读这条 rule"的比例不低于 0.8。提供一个 **Claude Code command**，按需产出触发率报告（成本低、不进 CI 硬阻断）。

## 动机（实证失败）

本会话用户多次说"创建 PR / 提交推送 / 创建pr origin-upstream"，主 agent 未走 `rule-finishing-branch`，直接裸 `git` + `curl` 建 PR、用 `PUT` 加 reviewer（正是 `bkt 附录`明令禁止的反模式）。该 rule 的 catalog 条目本就列了"创建 PR"做触发——**措辞没问题，是没被遵守**。这暴露两个独立问题：触发措辞质量、与触发后遵守。本 eval 覆盖**触发 + 轻量遵守**。

## Keystone 实证：subagent 是 clean room

派出的 probe subagent 报告：它**不继承**主会话的 SessionStart 规则注入——只拿到"可调用 skill 的一行 description 清单" + 全局/项目 CLAUDE.md + 环境；**没有** agent-catalog 路由表、没有"提 PR → rule-finishing-branch"指令、没有 semble/推理外化等常驻规则。

含义：要测某条 rule 的触发率，需往 subagent **显式注入待测的 catalog + 用户话术**。这反而让 eval 变干净——subagent 是无污染的隔离环境，变量只有"catalog 措辞 + 话术"。

## 测什么（范围）

- **触发**（discovery/CSO）：给"该触发"的多样话术，agent 认不认得出该读这条 rule。**这是 0.8 gate 的主指标。**
- **轻量遵守**：命中后，agent 读了 rule、声明要走该 rule 的**关键 gate/动作**（如 finishing-branch：Gate TB/PR 确认 + 用 `bkt` 不裸 curl + reviewer 用 `bkt pr edit` 不 PUT）。

**非目标（YAGNI）**：不测"压力下守不守规"（compliance-under-pressure，另一类测试）；不进 CI 硬阻断；不自动生成 fixtures；不引入独立 runtime/脚本（command + agent 自身即 harness）。

## 架构

一个 plugin command 当 orchestrator → 读 fixtures → 对每条 case 派 clean-room subagent（注入整张 catalog + 一条话术）→ subagent 输出结构化 routing 决策 → orchestrator 内联判分 → 出报告。

```
fixtures/<rule>.md  ──┐
agent-catalog.md ─────┤(注入)
                      ▼
   orchestrator(command) ──派生──▶ clean-room subagent ──(可 Read 命中 rule)──▶ ROUTE: + WILL_DO:
                      ◀──────────────────────────────────────────────────────────┘
                      │ 内联判分(无独立 judge LLM)
                      ▼
                  触发率报告
```

## 组件

| 组件 | 落点 | 职责 |
|---|---|---|
| eval command | `commands/rule-eval.md`（`/rule-eval [<rule-id>]`） | orchestrator prompt：读 fixture(s)、逐 case 派 subagent、判分、出报告 |
| 测试 fixtures | `eval/cases/<rule-id>.md` | 每条 rule 一文件：正样本 + 负样本 + 期望 ROUTE + 期望关键 gate 关键词 |
| clean-room probe | 运行时由 command 用 `Agent` 派生 | 收[全 catalog + 一条话术]，可 Read 命中 rule，输出 `ROUTE:` + `WILL_DO:` |

### probe subagent 契约

输入（command 拼装，**不含期望答案**）：
1. 整张 `model/agent-catalog.md` 文本，作为"你的规则路由表"。
2. 一条用户话术（fixture 里的一个样本）。
3. 指令：判断该读哪条 rule（可 Read 命中的 `rules/rule-*.md`），末尾输出固定块：
   ```
   ROUTE: <rule-id | none>
   WILL_DO: <若命中，列出你会走的关键动作/gate；否则留空>
   ```

### fixture 格式（`eval/cases/<rule-id>.md`）

```markdown
# rule-finishing-branch
expected_route: finishing-branch
key_actions: ["gate", "bkt", "不PUT"]   # 轻量遵守命中关键词(任一/全部策略见判分)

## positive   (该触发)
- 帮我提个 PR
- 创建 pr
- push 完了，合并到 release
- 这个分支收尾一下
- submit a pull request for this

## negative   (近义但不该触发)
- 我现在在哪个分支
- 列一下当前打开的 PR
- 看看这次 push 都改了啥
```

## 判分（orchestrator 内联，无独立 judge LLM）

- **触发率** = 正样本中 `ROUTE == expected_route` 的占比。**≥ 0.8 → PASS。**
- **误触发** = 负样本中 `ROUTE == expected_route`（或误命中别条）的占比，应为 0 / 接近 0。
- **轻量遵守率** = 命中的正样本中，`WILL_DO` 含 `key_actions` 关键词的占比（关键词匹配；命中策略默认"全部关键 gate 至少各出现一次"）。
- 判分由 orchestrator（主 agent）读 subagent 输出直接做；若日后嫌不稳再升独立 judge（v1 不做）。

## 报告

每条 rule 一段：
```
## finishing-branch  [PASS]
触发率 : 5/5 = 1.00  (gate 0.8)
误触发 : 0/3
轻量遵守: 4/5 = 0.80
漏 / 误:
  - (positive) "这个分支收尾一下" → ROUTE=none  ✗ 漏触发
```
v1 报告**只 inline 输出**，不落文件（YAGNI；要存再说）。

## enforcement（软门，靠流程不靠 hook）

不进 CI。写进"改/增 rule"的 rule（仿 `writing-skills` Iron Law）：**改/增 catalog 条目必跑 `/rule-eval <rule-id>`、贴报告，触发率 < 0.8 不交。** RED→GREEN：先跑看现状，措辞不行再改 catalog 条目，复跑到 ≥ 0.8。

## v1 范围 + 耦合

- **打样**：先做 `finishing-branch` 的 fixture + 跑通整 loop，再把 fixture 格式模板化推给别的 rule（semble / red-blue-deep 等）。
- **跟 bkt 附录自我识别改动耦合**：附录改"遵守目标"为"git remote + API 自识别 source/target/branch/reviewers"，所以 finishing-branch fixture 的 `key_actions` 要相应含自识别相关词。附录这次编辑也被本 eval（至少触发层）覆盖——满足 Iron Law。

## 待办（实施计划展开）

1. `commands/rule-eval.md` orchestrator
2. `eval/cases/finishing-branch.md` fixture
3. 跑一轮（RED 基线）看现状触发率
4. 据结果调 catalog 条目措辞到 ≥ 0.8（GREEN）
5. bkt 附录自我识别改动 + 更新 fixture key_actions
6. 把"改 rule 必跑 rule-eval"写进 agent-catalog 的维护段 / 相关 rule
