# 方法卡：checklist（固定维度逐项核查）

> reviewing 框架方法库 · 评审方法之一。**适合**：代码 diff、设计文档、需求/PRD、数据库、安全——任何有**稳定维度清单**的评审对象，逐项遍历不漏。**不适合**：开放式「该不该 / 选哪个」判断（用 red-blue-adversarial）。
>
> ⚠️ 业界证据（设计 §2.3）：checklist 不比 ad-hoc 检出更多，主要价值是**新手脚手架**和**完整性兜底**（保证不漏维度）。对资深 reviewer，配合 perspective-based / error-mechanism 检出力更高。

## 一、维度 / 思路

checklist 的核心是**一张领域维度表**——框架不规定具体维度，由引入的细则填（dev-review 填五轴、define-review 填 restate 七维、security-method 填 OWASP……）。逐项遍历，每项判 **✅ 通过 / ⚠️ 疑点 / ❌ 问题**，不能默默跳过。

维度表来源（细则按对象选）：
- 代码 diff → 细则领域维度 + `code-quality-method` 卡
- 设计文档 → `design-review` 十维
- 安全 → `security-method` 卡（OWASP Top10）
- 数据库 → `database-method` 卡（SQL 反模式 / 索引 / RLS / 并发）
- 架构决策 → `architecture-method` 卡（架构原则 / Trade-Off / Red Flags）

**逐项核查纪律**：① 每个维度都要显式标 ✅/⚠️/❌，「没问题」也要标 ✅，不能因为没发现就略过——略过和通过是两回事；② 发现问题落到 `file:line` 或 `[章节锚点]`，不要泛泛说「安全性不足」；③ 维度表是完整性骨架，遍历完才算覆盖。

## 二、输出契约

产出 `findings[]`，映射 `references/findings-contract.md`：

- 每条 finding：`axis` = 维度名（来自领域维度表）；`location` 必填到 `file:line` / `[锚点]`；`severity` = critical / warning / suggestion；`source` = `主路` 或方法名（主会话自评型）/ `独立路(Codex)` / `独立路(subagent, 降级)`（dual-review 异源交叉时）。
- 受 **Evidence Gate** 约束：代码事实类 critical/warning 缺 `location` → 降级 `kind=open-question`，防猜测式指控。
- 通过项（✅）不必逐条进 findings，但**维度覆盖快照**要留（改造回归 TO-2 用：维度漏了 = 行为退化）。
- `verdict.counts` 汇总 C/W/S；Critical 必修才放行。

> **场景 / 视角 / 派发 / 档位 / 升档 / CLAIM 剥离 / codex 降级见 skeleton §1–§3、§4.0–§4.2，本卡不复述。** subagent+codex 双审档下，本方法按 §4.0 走双执行位（subagent + codex）执行，仅单路命中的候选按 §4.7 Verify 走独立验证，双评合并结构单源在 `dual-review.md`；同位置同维度的交集 = 高置信。
