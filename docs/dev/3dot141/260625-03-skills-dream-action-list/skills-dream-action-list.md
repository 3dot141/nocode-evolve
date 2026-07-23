# Skills Dream 优化清单（完整版）

> 来源: 260625-skills-dream-research.md（两轮八切面）
> 状态: 待执行

---

## 第一梯队：Bug 修复（直接修，无需设计决策）

### B1. [P0] 修复 dead reference 路径（debug-protocol + skill-integration-map）

**根因**: 仓根 `references/` vs `skills/references/` 两个目录 + 裸相对路径歧义。文件存在但路径解析到 skill 子目录（不存在）。
**动作**:
- [ ] devflow/SKILL.md:156 和 dev-build/SKILL.md:95 的 `references/debug-protocol.md` 改为正确路径
- [ ] devflow/SKILL.md:12 的 `references/skill-integration-map.md` 改为正确路径
- [ ] 评估是否合并两个 `references/` 目录（仓根 vs skills/references/），从根源消除歧义

### B3. [P0] dev-review 加 manifest 路由

**动作**:
- [ ] manifest.json 加 dev-review 条目
- [ ] trigger_desc 明确与 codex-review 的分工负例
- [ ] `node hooks/generate.mjs` 重新生成
- [ ] 升 plugin.json 版本 (minor)

### B4. [P1] design-doc-writing 内容修复

**动作**:
- [ ] 删第 27 行重复行
- [ ] `superpowers:debugging` → `superpowers:systematic-debugging`

### B5. [P1] 删 skills/design/ 空壳目录

**动作**:
- [ ] `rm -rf skills/design/`

### O1-O4. 路由优化

- [ ] O1: dev-design 的 `\bprd\b` 加限定 + design-doc-writing disclaim 产品 PRD
- [ ] O2: discoveryflow → pdflow 全文统一
- [ ] O3: dev-review/codex-review 负例分工（与 B3 同步）
- [ ] O4: pd-research 加"内部审计时切面自定义"

---

## 第二梯队：方法论暗线补强（需要设计，逐个 skill 改）

> 核心方向：把 failure path 的纪律提到和 happy path 同等水平。

### M1. [P0] dev-build: TDD 学派指引 + outside-in 衔接

**现状**: 隐性 Chicago（测行为不测交互），没提 outside-in。与 dev-plan 的 tracer bullet（从外切）有未点破的张力。
**改法**: dev-build Step 5b「Test First」加学派选择指引：
> "默认 outside-in（先写切片最外层的失败测试，下层用 fake 顶住，逐层向内）——与 plan 的 tracer bullet 同向。当切片核心是纯领域逻辑时切回 inside-out。按切片形状选，不是信仰。"

### M2. [P0] dev-define: Given/When/Then 具体例子驱动 SC

**现状**: SC 是断言式（"搜索响应<200ms"），不是场景式。
**改法**: dev-define Step 6 产出 SC 时，对关键 SC 补 Given/When/Then 例子：
> "SC-1: 搜索响应<200ms。例：Given 10万条记录 / When 搜'apple' / Then p95<200ms"
> 这个例子直接喂给 dev-build 当测试骨架。

### M3. [P1] dev-land: 发布策略决策点

**现状**: disposition 四选一（merge/PR/keep/discard），merge 后生命周期结束。
**改法**: 对生产改动加发布策略子问：
> "发布策略：全量 / 灰度（canary %）/ dark launch（flag 默认关）"
> 哪怕 AI 不执行部署，暴露决策点给用户。

### M4. [P1] pd-prd: Job Story 情境视角

**现状**: User Story persona 驱动（"作为 X，我想要 Y"）。
**改法**: pd-prd Step 4 路径建模时，对核心 US 补情境锚定：
> "当用户在什么情境下触发这条路径？（Job Story: When [情境], I want [动机], so that [结果]）"
> pd-research 竞品切面加子问："用户从竞品切换的 Push（旧方案不爽）和 Anxiety（切换顾虑）是什么？"

### M5. [P2] dev-design: Pre-mortem

**现状**: forward-looking 风险分析。
**改法**: 选定方案后加轻量 pre-mortem：
> "假设这个方案上线 3 个月后彻底失败了，最可能的 top 3 死因是什么？"
> 可复用 red-blue-deep 的蓝军环节。

### M6. [P2] dev-verify: 韧性验证

**现状**: 只验正常路径能用。
**改法**: 加可选的韧性检查（有外部依赖时触发）：
> "对每条系统路径和跨域路径，问：依赖超时/失败时，降级行为验过吗？"

---

## ~~第三梯队：缺失 skill~~ — 暂不处理

> 用户决定：先不新增 skill，聚焦修已有的。缺失场景（incident/dependency/migration/refactor/performance/release）记录在 research memo 备查。

---

## 第四梯队：元设计演进（需要架构级决策）

### R1. catalog 扩展性

**问题**: MAX_CATALOG_SHARDS=3，rule 翻倍直接 throw。
**选项**:
- A: 提高 shard 上限（治标）
- B: catalog 自身分层——热桶常驻、冷桶降级回按需 Read（治本但改架构）
- C: 压缩 catalog 内容密度（每条 rule 的 summary 更短）

### R2. 上游漂移检测

**问题**: integration-map 是 38 个上游 skill 的死快照。
**建议**: SessionStart 或 generate.mjs 加上游 skill 清单 hash 检测，漂移时 stderr 警告。

### R3. 真实 session 验证闭环（流程建议，非代码改动）

**问题**: benchmark 打磨但无端到端验证。
**建议**: 挑 3-5 个真实开发任务，完整走 devflow 全阶段，记录摩擦点回流进 wiki/eval。这不是代码改动，是下一步的使用验证——在真实场景里跑一遍，把痛点收集回来。

---

## 不处理（记录但不动）

| 项 | 理由 |
|---|---|
| agents-launcher 归属 | 有意设计，disable-model-invocation |
| design-doc-writing 过长 | 内容有价值，后续单独处理 |
| 5 个 skill 无 catalog 路由 | 工具类/模式类靠原生匹配是合理取舍 |
| Shape Up appetite/circuit breaker | AI 单任务场景收益不如团队场景大 |
| Chaos Engineering 生产故障注入 | 需平台基础设施，超出 skill 能力 |

---

## 执行路线图建议

```
第一梯队（1-2 个 session）
  B1+B2 → B3+O3 → B4 → B5 → O1 → O2 → O4
  ↓
第二梯队（每个 1 个 session，可分期）
  M1(build) → M2(define) → M3(land) → M4(prd) → M5(design) → M6(verify)
  ↓
第三梯队（需要讨论架构方向）
  R1(catalog) → R2(漂移检测) → R3(真实验证)
```
