# dev-build-subagent — 顺序派发独立 subagent，分档审查

对应 plan `Execution` 字段值 `subagent-lite` / `subagent-full`（旧计划的 `subagent` 按 `subagent-full` 处理）。dev-build 编排者用 `平台原生 agent/plan/decision 工具` 逐个 task **顺序**派发独立 subagent 执行；两档共用同一条实现链，差别只在**审查派发密度**。实现链改编自上游 superpowers `subagent-driven-development`；审查分档是本仓库为墙钟成本加的本地扩展（per-task 双 review 随 task 数线性增长，是全链路重触点墙钟的最大来源）。

开始前 Read `{NOCODE_SKILL_REF}/design-traceability.md`。派发 objective 必须原样包含 Plan 的 `designRevision` / `designDigest` 与当前 task 的 `designCovers`，并要求 result 返回相同基线、`completedDesignCovers`、`changedFiles` 和测试 `evidence`；implementer 不得自行改设计基线或 ID 覆盖范围。

## 为什么顺序，不并行

并行派发的 subagent 共享同一个工作目录，「依赖图无依赖」≠「文件不冲突」——两个 task 改到同一个 lockfile / 快照 / 共享类型就会互相覆盖，这正是上游 superpowers 明确禁止并行 implementer 的原因。顺序执行天然规避，用少量 wall-clock 换可靠性 + 出问题能二分定位。

## 两档审查派发策略（本文件唯一分叉点）

| | Implement | Spec Review | Quality Review |
|---|---|---|---|
| **subagent-lite**（默认推荐） | 每 task 派 implementer | 仅风险 task | 仅风险 task（随该 task spec 通过后立即派） |
| **subagent-full** | 每 task 派 implementer | 每 task | checkpoint 批量（见下） |

**风险 task 判定**（任一命中即风险 task；拿不准按命中处理）：task 涉及**外部输入 / 认证鉴权 / 敏感数据 / 数据库 schema·migration / 并发原语 / 资金 / 跨模块共享接口 / 不可逆操作**。判定在排好线性顺序后逐 task 做一次，结果记入编排状态——lite 档据此决定派不派审查，full 档把风险标注写进 quality 批审 prompt 供 reviewer 重点看。

**checkpoint 批量 Quality Review**（仅 subagent-full）：Quality Review 不 per-task 派发，改为在 plan 的 checkpoint 处（plan 无 checkpoint 则每 2-3 个 task）批量审一次——派一个 quality reviewer，拿到自上个 checkpoint 以来全部已过 spec review 的 task 摘要 + 合并改动文件清单，issues 逐条标注归属 task。**最后不足一批的尾巴 task，在回到 dev-build Step 2 编排者验证之前必须补一次批量审查，不许跳过**。批审 `approved:false` → 定位归属 task 让 implementer 修复，重审该批。

> 为什么 Quality 可以批量而 Spec 不行：spec 偏离（做错了需求）在 task 边界内立即修最便宜，拖到批边界会让后续 task 在错误产出上叠加；quality 问题（结构 / 命名 / pattern / 重复抽象）批量看反而更容易暴露跨 task 的重复与漂移，且 rollback 边界正好是 checkpoint。

**审查覆盖如实上报**：lite 档跳过的审查在编排状态里记一行「lite 跳过（非风险 task）」，Build 收尾报告必须列出每个 task 的审查覆盖情况（spec/quality 已审 / lite 跳过）——「跳过」≠「已审通过」，dev-review 五轴据此决定对哪些 task 走增量、哪些走全量。

## 协议

1. 按依赖图拓扑把 task 排成一条**线性执行顺序**（被依赖的先跑；无依赖的 task 也排进这条线，不并行）
2. 逐 task 做风险判定（见上表），记入编排状态
3. 为每个 task 组装 implementer prompt（见「Implementer Prompt 组装」）
4. 逐个 task 走「实现 + 按上表应派的审查」，**前一个 task 的应派审查全部通过才进下一个**（full 档的 checkpoint 批量 quality 审查在批边界执行，不阻塞批内 task 推进）

**每个 task 的阶段：**

1. **Implement** — 派 implementer subagent（`平台原生 agent/plan/decision 工具`，prompt 见 `implementer-prompt.md`）。要求它按下面格式结构化报告：
   - `status`：`DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`
   - `summary` / `filesChanged` / `concerns` / `testResults`
   - `designRevision` / `designDigest`：必须与 objective 完全一致
   - `completedDesignCovers`：必须与 task `designCovers` 完全一致
2. **Spec Review** — 仅当 `status ∈ {DONE, DONE_WITH_CONCERNS}` 且 `completedDesignCovers` 无漏报/冒领时，才按上表决定是否派发（prompt 见 `spec-reviewer-prompt.md`）。Design ID 不一致先退回 implementer，不得用 review 掩盖。reviewer 报 `{approved, issues[]}`。lite 档非风险 task 跳过本阶段，记「lite 跳过」。
3. **Quality Review** — lite 档：风险 task 在 spec `approved === true` 后立即派发；full 档：spec 通过的 task 进入当前批，checkpoint 批边界统一批审（prompt 见 `quality-reviewer-prompt.md`，批量模式）。reviewer 报 `{approved, issues[]}`。

**gate**：任一 review `approved:false` → implementer 修复对应问题，重新走该阶段审查，循环直到通过才进下一 task（批审场景：重审该批）。

## Handling Implementer Status

| 状态 | 处理 |
|---|---|
| **DONE** | 进入 Spec Review（或按分档跳过，见上表） |
| **DONE_WITH_CONCERNS** | 先读顾虑内容——涉及正确性/scope 的顾虑，处理完再审；纯观察性的记下来直接进下一阶段 |
| **NEEDS_CONTEXT** | implementer 需要没提供的信息，补充上下文后重新派发 |
| **BLOCKED** | 评估卡点：缺 context → 补充信息重派；需要更强推理 → 换更强模型重试；任务太大 → 拆小；plan 本身有问题 → 升级给用户 |

不忽略任何一次升级，也不在不改变任何条件的情况下让同一模型重试——implementer 说卡住了，说明有什么地方需要改变。

## Implementer Prompt 组装

Build 为每个 task 组装 implementer prompt，内容来自：

1. **task 描述**（来自 Plan）：完整 task 文本、代码、验证命令——从 Plan 文档提取，不让 subagent 自己读 Plan 文件
2. **执行纪律**（来自 `implementer-disciplines.md`）：Scope Lock、Iron Law TDD、偏差分级、NOTICED BUT NOT TOUCHING、异常路径
3. **上下文注入**（按条件）：有 pd-vd 原型时注入视觉清点段落

Prompt 模板见 `implementer-prompt.md`。

## Red Flags

- 有 BLOCKED task 未处理就继续派发下一个
- spec review 不过强行跳过
- 并行派发多个 implementer subagent（共享工作目录会冲突）
- 让 subagent 读 plan 文件（应提供完整文本，不是路径）
- 用 implementer 的自我审查代替独立审查（应派的审查一个不少）
- spec compliance 还没通过就先跑 quality review
- 某一 review 还有未处理 issue 就进下一个 task
- 忽略 subagent 提出的问题，不澄清就催它继续
- **lite 档把命中风险信号的 task 当普通 task 跳过审查**（风险判定拿不准必须按命中处理）
- **full 档尾巴批因「只剩 1-2 个 task」跳过 quality 批审**（编排者验证前必须补审）
- **把「lite 跳过」当「已审通过」上报**（审查覆盖必须如实进 Build 收尾报告）
