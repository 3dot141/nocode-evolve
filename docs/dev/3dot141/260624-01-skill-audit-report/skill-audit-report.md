---
type: design-doc
topic: skill-audit-report
date: 2026-06-24
author: 3dot141
status: draft
---

# Skill 全量审计报告 — 18 skill × 3 标准 × 3 体系

> 基于 skill-creator 标准 + 腾讯《如何写好 Skill》+ GSD/superpowers/agent-skills 三体系对标

## 评估维度速查

| 编号 | 维度 | 来源 | 达标线 |
|---|---|---|---|
| A1 | Description 触发质量 | skill-creator | 够 pushy、覆盖常见措辞 |
| A2 | SKILL.md 行数 | skill-creator | <500 行 |
| A3 | Progressive disclosure | skill-creator | metadata → body → references 三层 |
| A4 | 解释 why | skill-creator + 腾讯 | 讲原理不堆 MUST |
| B1 | 开头三件事 | 腾讯 | 做什么/为什么/怎么判断 |
| B2 | 祈使句+讲原理 | 腾讯 | — |
| B3 | Few-shot 示例 | 腾讯 | 3-5 个，覆盖正常/边界/错误 |
| B4 | 可视化 | 腾讯 | 表格/决策树/流程图 |
| B5 | 6 反模式 | 腾讯 | ①大杂烩 ②黑话desc ③无示例 ④无验证点 ⑤写死数值 ⑥Wiki化 |
| C1-3 | 三体系对标 | GSD/superpowers/agent-skills | 对应 skill 的核心能力已覆盖 |

## 全量评分矩阵

| Skill | 行数 | A1 | A2 | A3 | A4 | B1 | B2 | B3 | B4 | B5 | C | 优化点数 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| devflow | 298 | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | 3 |
| dev-define | 153 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | 3 |
| dev-design | 190 | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | 3 |
| dev-plan | 144 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | 3 |
| dev-build | 126 | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | 4 |
| dev-verify | 130 | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | 3 |
| dev-review | 130 | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ⚠️ | ⚠️ | 5 |
| dev-land | 130 | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ❌ | 4 |
| pd-prd | 199 | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | ✅ | ⚠️ | 4 |
| pd-research | 180 | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | ✅ | ⚠️ | 4 |
| pd-vis | 201 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ⚠️ | 2 |
| pdflow | 152 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 1 |
| design-doc-writing | 429 | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 2 |
| red-blue-deep | 110 | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ❌ | 4 |
| bkt | 174 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 0 |
| caveman | 40 | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | 2 |
| signoz-cli | 379 | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | 3 |
| agents-launcher | 357 | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 2 |

## 问题分类汇总（按频次排序）

### P0: Few-shot 示例缺失 (10/18 skill)

命中 skill: dev-define, dev-design, dev-plan, dev-build, dev-verify, dev-review, dev-land, pd-prd, pd-research, pd-vis

腾讯文章反模式③"只有指令没示例"——这是全量审计最一致的短板。每个 skill 都有表格和格式说明，但缺"完整输入→完整输出"的端到端正例。

**修复方式**: 每 skill 补 1-2 个 few-shot 到 references/examples/（不塞 SKILL.md 主文件），SKILL.md 加指针。

### P1: Description 触发词偏窄 (6/18 skill)

命中 skill: dev-build, dev-verify, dev-review, dev-land, dev-design, signoz-cli

只列了少量中文措辞，漏大量同义表达。dev-build 漏"实现功能/把X加上/继续写"，dev-verify 漏"测一下/能跑吗/验收"，signoz-cli 漏"查日志/看链路"。

**修复方式**: 批量补触发词到 description 字段。

### P2: 开头缺前置检查 (6/18 skill)

命中 skill: dev-build, dev-verify, dev-review, dev-land, pd-prd, pd-research

"怎么判断要不要用本 skill"分散在"非本 skill 请求"段落，不在开头。

**修复方式**: 开头加一句前置检查（如"Entry Gate"或"非本 skill"移到开头）。

### P3: 三体系缺失模式 (高价值)

| 缺失 | 来源 | 命中 skill | 价值 |
|---|---|---|---|
| Plan Validation (需求覆盖+任务完整性) | GSD plan-checker | dev-plan | 高 |
| CLAIM 剥离 + Doubt Theater + 三轮上限 | agent-skills doubt-driven | red-blue-deep | 高 |
| Deviation handling (偏差分级处置) | GSD executor | dev-build | 高 |
| Structural Remedies ("propose the move") | agent-skills | dev-review | 中 |
| PR body 回链需求/验收 | GSD ship | dev-land | 中 |
| DoD Pre-launch 检查 | agent-skills shipping | dev-land | 中 |
| Subagent 产出验证 | superpowers | dev-build | 中 |
| 实现偏好收集 | GSD discuss | dev-define | 中 |
| User Story ID 可追踪 | GSD requirements | pd-prd | 低 |

### P4: Progressive disclosure 结构 (4/18 skill)

| Skill | 行数 | 问题 | 修复 |
|---|---|---|---|
| design-doc-writing | 429 | 接近 500 上限 | 继续精简 |
| signoz-cli | 379 | SQL Reference 120行应下沉 | 移到 references/clickhouse-sql.md |
| agents-launcher | 357 | 坑速查与正文重复 | 去重合并 |
| pd-prd | 199 | 模板 47 行内联 | 移到 references/prd-template.md |

### P5: 触发词重叠 (1 处)

design-doc-writing ↔ pd-prd 都含"写PRD"，需分工（产品PRD vs 技术设计文档）。

### P6: 标杆 skill (无需改动)

- **bkt**: vendored + Overlay，质量顶，不改
- **pdflow**: 最完整的编排器 skill，改动最少
- **pd-vis**: 边界表开头 + Red Flags 全，本组最佳

## 10 轮 PDCA 执行计划

每轮 = Do(执行修复) → Check(验证) → Act(调整)。

| 轮次 | 范围 | 预期改动量 |
|---|---|---|
| R1 | P1: Description 触发词 (6 skill 批量) | ~6 个 description 字段 |
| R2 | P3 高价值: dev-plan Plan Validation | 1 skill 加 step |
| R3 | P3 高价值: red-blue-deep 三缺失 | 1 skill 加 3 段 |
| R4 | P3 高价值: dev-build deviation handling + subagent 验证 | 1 skill 加 2 段 |
| R5 | P0 批次1: devflow core few-shot (define/design/plan/build) | 4 个 references/examples/ |
| R6 | P0 批次2: impl few-shot (verify/review/land) | 3 个 references/examples/ |
| R7 | P0 批次3: product few-shot (pd-prd/research/vis) | 3 个 references/examples/ |
| R8 | P3 中价值: dev-review Structural Remedies + dev-land DoD | 2 skill 各加 1 段 |
| R9 | P4: Progressive disclosure (signoz/launcher/pd-prd) | 3 skill 结构重组 |
| R10 | P2+P5+终审: 开头标准化 + 触发词去重 + generate + test + version | 全量一致性 |
