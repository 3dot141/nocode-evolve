# SkillOpt 10 轮优化总结报告

> **日期**: 260618
> **版本**: 3.24.0 → 3.28.0
> **commit 数**: 13（本会话 devflow 相关）
> **变更量**: 32 files, +1948 / -713 行

## 来源研究

深读 4 套来源共 71 个 skill + SkillOpt 优化方法论：

| 来源 | skill 数 | 研究方式 |
|---|---|---|
| superpowers (Matt Pocock) | 14 | 4 个并行 subagent 逐 skill 读取 |
| mattpocock/skills | 33 | 同上 |
| agent-skills (Addy Osmani) | 24 | 同上 |
| SkillOpt (Microsoft) | 方法论 | README + 训练循环 + 优化后 skill 样本 |

## 10 轮优化记录

| 轮 | 核心改动 | eval |
|---|---|---|
| **R1** | 结构拆分: Define/Design/Brainstorming 边界 + 新建 Design skill + 6 项 review 修复 + AskUserQuestion + TaskCreate checklist | 6/6 ✅ |
| **R1b** | 全部 skill 按"必经之路"原则重构（净减 502 行）+ 11 项来源吸收 + 新建 handoff/caveman | — |
| **R1c** | description 纯触发 + Iron Law 前置 + Leading Word + 内容补全 | — |
| **R2** | devflow context hygiene + 非协商行为 + prototype logic/UI + DAMP/测试替身 | 20/20 ✅ |
| **R3** | 双轴 review + durable task + browser 安全 + 上下文预算 + doubt theater | 15/15 ✅ |
| **R4** | 共享词汇表 + when-do 规则格式 + CSO description 修正 | — |
| **R5** | when-do 全覆盖 + sediment 清理(dev-workflow 废弃) + no-op 收紧 | — |
| **R6** | 全量回归 35/35 零回归 + Gate 链修复(Plan Exit) | 35/35 ✅ |
| **R7** | 语气一致性审计(6/6) + verify Iron Law 补齐 + Red Flags zero no-op | — |
| **R8** | 压力 eval 12/12 + 触发词缺口修补(3 个 regex) + 全景文档更新 | 12/12 ✅ |
| **R9** | 最终回归 20/20 + depends_on 链验证 | 20/20 ✅ |
| **R10** | 本报告 | — |

## Eval 累积数据

| 指标 | 数值 |
|---|---|
| 总 probe 数 | **67** |
| 正确数 | **67** |
| 准确率 | **100%** |
| fixture 覆盖 rule 数 | 6 (define/design/plan/build/verify/finishing-branch) |
| 压力/歧义 probe | 12 条，全部落在预期区间 |
| 回归数 | **0**（R6 全量 + R9 最终，均零回归）|

## 达成指标

| 指标 | 优化前 | 优化后 | 状态 |
|---|---|---|---|
| description 只含触发条件 | 0/10 | 10/10 | ✅ |
| Iron Law 前置 | 2/6 | 6/6 | ✅ |
| Leading Word | 0/6 | 6/6 + 共享词汇表 | ✅ |
| eval route-recall (design) | 66% | 100% | ✅ |
| eval route-recall (全部) | — | 100% (67/67) | ✅ |
| SKILL.md 平均行数 | ~200 | ~104 (82-120) | ✅ |
| when-do 规则格式 | 0/6 | 6/6 | ✅ |
| Gate 链完整性 | 5/6 断裂 | 6/6 | ✅ |
| eval fixture | 1 rule | 6 rules | ✅ |
| 语气一致性 | 未审计 | 6/6 统一 | ✅ |
| Red Flags no-op | 未审计 | 0 no-op | ✅ |

## 吸收来源统计

| 来源 | 吸收项数 | 关键吸收 |
|---|---|---|
| mattpocock/skills | 8 | grill-me 代码自答、design-it-twice 差异化、prototype logic/UI、to-issues HITL/AFK、diagnose 假设排序、writing-great-skills leading word + no-op/sediment 检测 |
| superpowers | 5 | AskUserQuestion、Execution Handoff、Plan Header、description 纯触发原则、Iron Law 前置模式 |
| agent-skills | 6 | 双轴 review、durable task、browser 安全边界、上下文预算、doubt theater、DAMP/测试替身 |
| SkillOpt | 方法论 | 验证门(rule-eval 充当 gate)、bounded edit(每轮 ≤ 3 条)、slow-update(跨 commit 回归检查) |

## 新建产物

| 产物 | 说明 |
|---|---|
| `skills/design/SKILL.md` | 方案探索独立阶段 |
| `skills/handoff/SKILL.md` | 会话续接 |
| `skills/caveman/SKILL.md` | token 压缩模式 |
| `eval/cases/{define,design,plan,build,verify}.md` | 5 个 eval fixture |
| `260618-skill-panorama-design.md` | 全景设计文档 |
| `260618-skill-absorption-v2-design.md` | 吸收计划 |
| 本报告 | 10 轮总结 |

## 未完成项

| 项 | 优先级 | 说明 |
|---|---|---|
| eval fixture 覆盖剩余 rule | P2 | code-review、red-blue-deep、git-worktree 等还没 fixture |
| 真实 session 验证 | P1 | 目前 eval 是路由 probe，未在真实开发 session 中端到端验证 skill 效果 |
| SkillOpt-Sleep 集成 | P3 | 离线从历史 session 学习 + 自动提出 skill 改进提案 + rule-eval 当 gate |
| design-doc-writing 重构 | P2 | 410 行最长 skill，未在本轮重构（内容成熟、改动风险大） |
| 原子 skill 拆分 | P3 | mattpocock 的 grilling 9 行被 5 个 skill 复用——我们还没做这种组合模式 |

## 后续建议

1. **Push + 真实 session 验证**：push 后在实际开发任务中跑一轮完整 devflow（Full 场景），观察 skill 是否真的按预期工作
2. **补 eval fixture**：code-review 和 red-blue-deep 是高频 rule，应该有 fixture
3. **SkillOpt-Sleep 试点**：用 rule-eval 当 gate，从历史 session 挖掘高频失败模式，提出 skill bounded edit，staged → 人工 review → adopt
4. **design-doc-writing 精简**：参照本轮其他 skill 的重构模式（必经之路留正文 + 条件内容到 references），从 410 行降到 ~150 行
5. **定期 slow-update**：每月跑一次全量 eval（所有 fixture × cold + mid-task preamble），对比上月，检测退化
