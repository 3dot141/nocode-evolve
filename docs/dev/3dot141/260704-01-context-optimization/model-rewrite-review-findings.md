# 重写稿双审结果汇总（Codex + subagent 两路已回）

> 双审档独立评审完整结果，Verify 合并。**结论：两份重写稿均不能直接采用。**

## 结果概览

| | Codex（独立路） | subagent（主路） |
|---|---|---|
| Critical | 2 | 3 |
| Warning | 7 | 19 |
| Suggestion | 若干 | 7 |
| Open Question | 1 | 2 |
| 数据污染扫描 | 干净 | 干净 |
| verdict.approved | false | false |

两路独立评审**都判定不能直接采用**，且两者发现的具体问题**大部分不重叠**——这本身是重要信号：单路评审存在结构性盲区，subagent 挖出的 19 条 Warning 里，Codex 完全没提到的至少有 14 条（W3/W4/W5/W8/W9/W10/W11/W13/W14/W16/W17/W18/W19 等）；反过来 Codex 的 Open Question（`dev_plan_output` 零匹配的验证漏洞）subagent 也没提。

## 交集（两路都独立发现，高置信）

- **`docs/nocode/prds/` 路径被遗漏**：Codex Warning 5 与 subagent W15 独立命中同一处（`agent-about.md:172` vs 草稿），且 subagent 进一步核实该路径在 `docs/AGENTS.md`、历史 spec、`pd-prd` 示例里仍有实际引用，不是可以被通配符 `docs/superpowers/*` 隐含覆盖的同义压缩，是真实遗漏。
- **AskUserQuestion 规则被过度压缩**：Codex Warning 1（丢失编号多选格式要求）与 subagent C3（丢失触发/不触发边界 + 编号多选格式，评级更高定为 Critical）指向同一处内容损失，subagent 给出了更完整的证据链。
- **"4 个粗桶"改成"各粗桶"的处理方式是对的**：两路都认可（Codex Suggestion 4 + subagent SA2 都单独核实了 `agent-catalog-1.md` 本身不写死数字，去掉数字而非硬编码成 6 是更稳妥的处理）。
- **无数据污染**：两路都做了字面占位符/YAML 泄漏/截断扫描，结论一致：干净。

## 仅 subagent 发现（Codex 遗漏的真实内容损失）

subagent 做了逐句全文比对（未抽样），额外发现的确认性内容损失包括：

- **C1（Critical）**："语气规范—工程动词"整节丢失，全仓库 `rg` 核实无任何替代路径承载同等内容，且草稿没有任何说明为何删除。
- **C2（Critical）**：catalog-using.md 里"进了skill就走完"唯一的具体反面案例（dev-plan 跳过 Step 6/8 的 ❌/✅ 示例）被整体删除——这是当前**唯一剩下的防跳步机制**里唯一的场景化演示，Codex 完全没提到这条。
- 大量具体列举项/否定词/cross-reference 被静默删除：方案类型枚举（10项→5项，丢RFC/ADR/修复方案/架构/migration）、git-inspection 具体命令清单、离场信号消歧义句（"跳过某步"≠"离开会话"）、worktree 授权否定词（"在主仓写/就地"）、"支持 worktree 非 main 派生 base"等技术事实句、多处维护性 cross-reference。

## 仅 Codex 发现

- **Critical**："用户指令优先级"漏掉 `AGENTS.md`（subagent 把这条归为 Suggestion S5，判轻了——这是两路对同一处的**严重度分歧**，不是内容分歧，按证据本身应定 Critical，因为这是最高优先级判据的一部分，漏掉会实际改变优先级排序逻辑）。
- **Open Question**：我之前声称"6个占位符都被skill消费"的验证方法有漏洞，`dev_plan_output` 实际在 skills/ 下零匹配——这条揭示的是我自己方法论的问题，不是重写稿本身的问题，但值得记录。

## 对review流程本身的初步印证（正式结论见另一条独立评估）

两路合起来发现的问题远超单路各自发现的问题总和——这直接验证了"为什么要跑双审而不是单审"：如果只跑了 Codex 一路，语气规范整节丢失、dev-plan案例丢失这两个 Critical 会被完全漏掉；如果只跑了 subagent 一路，`dev_plan_output` 验证方法漏洞这个 Open Question 不会被发现。两路结构性地互补，不是重复劳动。

## 结论

**两份重写稿都需要重新做一版**，不是打几个补丁就能过关——遗漏的内容量级（3 Critical + 20+ 条不重复的 Warning）说明我第一次重写时对"密度优先"的追求过了头，具体的枚举项/否定词/边界条件/cross-reference 这类"看起来像修饰词但实际是触发依据"的内容被系统性地压缩掉了。

下一版重写需要的纪律：**每一条具体列举、每一个否定词、每一句"不触发"边界、每一个 cross-reference，删除前必须显式判断"有没有其他地方能承载同等信息"，而不是默认"这是修饰性文字可以精简"**。
