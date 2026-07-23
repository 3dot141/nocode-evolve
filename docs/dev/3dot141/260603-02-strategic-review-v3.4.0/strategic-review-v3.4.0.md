---
type: design-doc
topic: nocode-evolve v3.4.0 双路 audit + 红蓝军推演后的战略级架构改进
date: 260603
author: 3dot141
status: draft
last_updated: 260603
---

# 战略级架构改进 · v3.4.0 → 下一阶段

> 本文是 **双路独立 audit + 红蓝军对抗** 的综合产出:
> - **蓝军(general-purpose subagent)**:维护者视角,21 条改进候选 + 2 核心议题
> - **红军(codex 跨模型)**:挑刺/瓶颈视角,15 条 finding(R1-R6 + F1-F6 + I1-I6 + Q1)+ 3 根本问题
> - **Controller(我)**:综合 → 红蓝军推演 → 改进路线
>
> 不立即实施。这是 review 报告,你 review 后再决定哪些先做。

## 背景

v3.4.0 已经把 codex 上次 review 的 11 条 tactical finding 全修(I1-I6 + M1-M3 + S1/S2 follow-up 在档)。但战略级问题仍在:

- **catalog 常驻是不是另一种软触发?**(skillify-route 当初的核心承诺没真兑现)
- **pilot 触发率根本性弱点**(用户想不起来 /pilot,等于闲置)
- **manifest 单源不够彻底**(还有 4 处独立维护;schema 表达力不足)
- **PreToolUse 只覆盖 PR/worktree,核心安全护栏没硬化**(rm/force push 没拦)
- **reactive vs proactive 二分边界模糊**(codex-review 既是规则又是流程步骤)

**核心矛盾**:v3.0.0→v3.4.0 几次大改造的方向感是"统一/收敛",但增长压力(rule 7→可能 30,skill 5→可能 20)正反向冲击当初被简化的边界。

## 目标

| 目标 | 量化 / 验收 |
|---|---|
| **触发可靠性提升**(对抗深度负载漏触发) | 1 项硬机制(非"agent 自觉") + 至少 1 个 rule 跑过 rule-eval, route-recall 提升 ≥ +0.1 |
| **单源彻底化**(manifest 驱动更多生成物) | 至少 1 个手维护点纳入 manifest 生成;CI 强制 `generate --check` + tests |
| **安全护栏硬化**(关键不可逆操作硬拦截) | PreToolUse 拦截 +3 类(删除护栏区、force push、gh api PATCH/PUT pulls) |
| **意图传递修复**(README/about 同步) | agent-about.md 前 20 行加架构总览;docs/INDEX.md 标 current/superseded |
| **可扩展面拓宽**(为 rule 30 / skill 20 准备) | manifest schema +3 字段(depends_on / severity / lifecycle_stage);segment 同步从 3 处降到 1 处 |

不在本次改造范围(留 follow-up):reactive/proactive → task graph 统一(红军 R3,激进,需独立 spec)、rule-eval 进 CI(独立工程问题)、命名风格全仓重命名(影响面大)。

## 架构

### 当前(v3.4.0)与改进后对比

```
                  v3.4.0 现状                          改进后
─────────────────────────────────────────────────────────────────────────
触发可靠性    catalog 常驻 + "扫桶自觉"指令          + 扫桶硬指令(每消息 step 0)
                                                       (远期: UserPromptSubmit resurfacing)
                                                     + pilot description 加"主动建议用户调"
                                                     + catalog 头部加"何时建议 /pilot"

单源生成     manifest → catalog 分片 + pretooluse    + manifest schema: depends_on/severity/
            bkt overlay / pilot lifecycle 手维护       lifecycle_stage(C1+B2)
                                                     + JSON Schema 校验(F4)
                                                     + generate 还驱动 hooks.json catalog
                                                       segment(B1+F3)
                                                     + pre-commit 强制 --check(F4)

安全护栏     PreToolUse 4 条(PR/worktree)           + 3 类: 删除护栏区(.agents-personal/
                                                       $USER_VAULT_PATH rm/mv) /
                                                       git push --force / gh api PATCH/PUT pulls
                                                     + 通用 Bash risk policy 分级(R5)

意图传递     README v3.3.0(过时)/ about 无架构总览  + README 去 hardcoded 版本(A1)
            specs/ 无 INDEX                          + about 前 20 行加架构总览(I6)
                                                     + docs/dev/INDEX.md
                                                       标 current/superseded(F6+A3)

文件结构     about 单文件 8 职责                     + about 拆 meta-rules + globals(C2)
            rule-git-worktree 24K 单文件 8 段         + 拆 rule-references/rule-git-worktree/
                                                       (B5,参照 finishing-branch 模式)
            rendering 残留 SKILL.md frontmatter      + 改名 RENDERING.md + 删 frontmatter(C5/R4)
```

### 触发链路改进(从"自觉"到"工序化")

```
v3.4.0:
用户消息 → agent **可能**扫桶 catalog → **可能**命中 → 读 rule → 动作
        ↑ 软指令"任何工程任务前扫下方粗桶",深度负载下可能漏

改进后(短期):
用户消息 → catalog 头部硬指令:**Step 0 强制扫 4 桶 trigger_summary**
        → 命中桶 → 读对应 rule → 动作
        ↑ 把"自觉"工序化,catalog 头部明示这是强制 step

(远期 follow-up):
用户消息 → UserPromptSubmit hook → 机械 keyword 匹配 → resurface 提醒
        → agent 命中 → 读 rule
        ↑ 真正的硬触发(类似 skillify-route 之前那一层,但只做粗触发提醒,不全表注入)
```

## 实现(分组改进点)

### 优先级标记说明
- **P0** = 红蓝双方共识 + 实施成本低 + 收益直接 → 强烈推荐
- **P1** = 一方独有但有价值,或需要决策的渐进改良
- **P2** = 红军独有的"激进重构",需后续单独 spec

### Group A:触发可靠性(P0 - P1)

| # | 改进 | 来源 | 优先级 | 影响 |
|---|---|---|---|---|
| **T1** | catalog 头部加"Step 0 强制扫 4 桶"硬指令 | 蓝军 D5 + 红军 R1 共识 | **P0** | `model/agent-catalog-1.md` 头部 + generate header |
| **T2** | pilot description 加"agent 视角:复杂任务主动建议用户 /pilot" | 蓝军 D2 + 红军 R2 共识 | **P0** | `skills/pilot/SKILL.md:3` |
| **T3** | catalog 头部加"何时建议 /pilot" | 蓝军 A2 + 红军 R2 共识 | **P0** | `model/agent-catalog-1.md` + generate header |
| T4 | red-blue-deep description 收窄(轻档不 invoke) | 蓝军 D1 | P1 | `skills/red-blue-deep/SKILL.md:3` |
| T5 | git-freshness trigger_desc 改可观测判据(pwd 是否含 worktree 路径) | 蓝军 D4 | P1 | `rules/manifest.json` git-freshness 条目 |
| **T6** | pilot 拆"轻量 auto suggestion" + "手动驾驶舱" | 红军 R2 反对方案 | **P2**(激进) | 新增 hook 或独立 skill,需 spec |

### Group B:单源彻底化(P0 - P1)

| # | 改进 | 来源 | 优先级 | 影响 |
|---|---|---|---|---|
| **S1** | manifest schema +`depends_on` / `severity` / `lifecycle_stage` | 蓝军 B2/C1 + 红军 F1 共识 | **P0** | `rules/manifest.json` schema + `hooks/generate.mjs` 渲染 |
| **S2** | manifest JSON Schema(.schema.json) + generate 启动校验 | 红军 I1 | **P0** | 新增 `rules/manifest.schema.json` + generate.mjs Ajv 校验 |
| **S3** | hooks.json catalog segment 也从 manifest 生成 | 蓝军 B1 + 红军 F3 共识 | **P0** | `hooks/generate.mjs` 加 hooks.json segment 生成;或单独 `hooks/segments.json` 中间产物 |
| **S4** | pre-commit / CI hook 强制 `generate --check` + `node --test` | 红军 F4 | **P1**(工程) | `.husky/` 或 `.github/workflows/` (项目本地) |
| S5 | bkt overlay 段从 manifest.guard 生成(patchGeneratedRegion 复活) | 蓝军 C3 | P1 | `hooks/generate.mjs` + `skills/bkt/SKILL.md` 加 marker |
| S6 | manifest 字段精简:删冗余 `action`,`triggers` 显式标注消费者 | 蓝军 C4 | P1 | `rules/manifest.json` + `hooks/generate.mjs` |

### Group C:安全护栏硬化(P0)

| # | 改进 | 来源 | 优先级 | 影响 |
|---|---|---|---|---|
| **P1** | PreToolUse 拦 `rm/mv/find -delete` 在 `.agents-personal/` / `$USER_VAULT_PATH/` | 蓝军 D3 + 红军 R5 共识 | **P0** | `rules/manifest.json` 加 pretooluse 条目;agent-personal 已有 rule 文本 |
| **P2** | PreToolUse 拦 `git push --force` / `--force-with-lease` | 蓝军 D3 + 红军 R5 共识 | **P0** | manifest finishing-branch.pretooluse 加 |
| **P3** | PreToolUse 拦 `gh api .*pulls.*--method (PATCH|PUT)` | 蓝军 D3 | **P0** | manifest 加 |
| P4 | 通用 Bash risk policy 分级(删除/force/secret/外部写) | 红军 R5 反对方案 | P2(架构) | 重构 PreToolUse 体系,需 spec |

### Group D:意图传递修复(P0)

| # | 改进 | 来源 | 优先级 | 影响 |
|---|---|---|---|---|
| **D1** | README 去 hardcoded 版本号(改"两类知识分离 + 单一真值源"无版本号定语) | 蓝军 A1 + 红军 I5 共识 | **P0** | `README.md:3,32` |
| **D2** | `agent-about.md` 前 20 行加"本插件工作模型"架构总览 | 红军 I6 + 蓝军 A3 共识 | **P0** | `model/agent-about.md` 前 20 行 |
| **D3** | `docs/dev/INDEX.md` 标 current/superseded/historical | 蓝军 A3 + 红军 F6 共识 | **P0** | 新增 INDEX.md |
| D4 | distill/sow/task 引用废弃 `docs/plans/` 路径修(改 `docs/superpowers/specs/`) | 蓝军 E5 | P1 | `commands/distill.md` / `sow.md` / `task.md` |

### Group E:文件结构 + 残留清理(P1)

| # | 改进 | 来源 | 优先级 | 影响 |
|---|---|---|---|---|
| **F1** | `references/rendering/SKILL.md` 改名 `RENDERING.md` + 删 frontmatter | 蓝军 C5 + 红军 R4 共识 | **P0** | 改名 + Edit frontmatter |
| F2 | `agent-about.md` 拆 about + meta-rules + globals(3 文件) | 蓝军 C2 | P1 | model/ 重构 |
| F3 | `rule-git-worktree.md` 拆门面 + sub-files(参照 finishing-branch) | 蓝军 B5 | P1 | rules/ + rule-references/ |
| F4 | `agent-personal.md` 删除护栏拆出去(挪 about 或 agent-safety.md) | 蓝军 A5 | P1 | model/ 重构 |
| F5 | `commands/_shared/` 抽 env/路径校验共用段 | 蓝军 B4 | P2 | command 增长后再做 |

### Group F:扩展性 + 命名一致性(P1 - P2)

| # | 改进 | 来源 | 优先级 |
|---|---|---|---|
| X1 | 桶命名风格统一(全动名词 or 全领域名词) | 蓝军 E1 | P2(影响 manifest.json + 全部 rule) |
| X2 | skill 命名风格统一(自创 skill 动名词;wraps-cli 沿用) | 蓝军 E2 | P2 |
| X3 | rule frontmatter 加 `title` 字段(便于 catalog 渲染) | 蓝军 E3 | P1 |
| X4 | 文档语言风格约定(自创 vs wraps-cli) | 蓝军 E4 | P2 |
| Q1 | 孤儿 rule 是 draft 还是 hard fail?(distill 报告 vs manifest 强校验) | 红军 Q1 | P1 (需澄清) |

## 方案选型(红蓝军推演记录)

### Q1: catalog 常驻是不是另一种软触发?

**蓝军方案**:catalog 常驻没错,但缺"扫桶硬指令"。在 catalog 头部加 Step 0 强制扫桶,把"自觉"工序化。改动最小,渐进改良。

**红军方案**(R1+R6+F2):catalog 常驻指望 LLM "工程任务前扫一遍" = 与 v3.0.0 失败的 route 软触发本质同质。**反对方案**:薄 catalog + UserPromptSubmit 机械 keyword resurfacing + 按需完整 rule。从机制级保证可靠性,而非靠 agent 自觉。

**推演**:
- 红军论点强:LLM 看到指令也会漏(深度负载下),Step 0 仍是软指令。机制级才是真硬。
- 蓝军论点强:UserPromptSubmit 是 v3.0.0 退役机制,回归是反转 + 与 catalog 常驻冲突。架构反复成本高。
- **结论**:
  - **短期 P0**:蓝军方案(扫桶硬指令)—— 0 风险,立刻提升;
  - **长期 follow-up**:**红军方案纳入下一轮 spec**(UserPromptSubmit resurfacing 怎么和 catalog 常驻共存,需深度设计 + rule-eval 量化)
- 不立即推翻 catalog 常驻(刚做完,代价大)。

### Q2: pilot 怎么提升触发率?

**蓝军方案**:agent 自己看 pilot description + catalog 提示 → 主动建议用户 /pilot。改 description + catalog 一句话。

**红军方案**:拆"轻量 auto next-step suggestion" + "手动完整驾驶舱"。前者自动触发但只一两句提示,后者保留手动。

**推演**:
- 蓝军方案先做(P0,改动小);如果验证后仍触发率低,再考虑红军 R2 的拆分(P2)
- **结论**:**P0 蓝军方案** + **P2 红军方案放 follow-up**

### Q3: manifest 单源边界扩到什么程度?

**蓝军方案 ②**:扩 schema 含 depends_on / severity / lifecycle_stage + skill description 也进 manifest + bkt overlay 生成。

**红军方案 R3**:更激进——统一成 task graph(policy / capability / workflow 三层)。

**推演**:
- 蓝军方案是渐进 extension,manifest 仍是 rule + 拦截,但表达力增强(P0/P1)
- 红军方案 task graph 是根本性重构,需要独立 spec + 大改造,**P2**
- **结论**:**P0/P1 蓝军方案 + P2 红军 task graph 放远期愿景 / 独立 spec**

## 推荐实施路径(分批)

### Batch 1: P0 高优先级合集(本批一次性落地,~2-3 commit)

**收益最高 / 风险最低 / 双方共识**:

1. **触发硬化**:T1(catalog 头部 Step 0 扫桶)+ T2(pilot description 主动建议)+ T3(catalog 提示何时 /pilot)
2. **意图传递**:D1(README 去版本号)+ D2(about 加架构总览)+ D3(specs INDEX)
3. **安全护栏**:P1(.agents-personal/$USER_VAULT_PATH 删除拦截)+ P2(force push 拦截)+ P3(gh api PATCH/PUT pulls)
4. **manifest schema 扩**:S1(+depends_on/severity/lifecycle_stage 字段)
5. **残留清理**:F1(rendering frontmatter)

**版本**:bump **3.5.0** minor(新增 PreToolUse 拦截规则 + manifest schema 扩 + 触发硬指令 = 兼容性增强)

### Batch 2: P1 渐进改良(看 Batch 1 效果再做)

- S2(JSON Schema 校验)+ S3(hooks.json 生成)+ S4(pre-commit 强制 check)+ S5(bkt overlay 生成)+ S6(manifest 字段精简)
- T4(red-blue-deep description 收窄)+ T5(git-freshness 触发可观测化)
- D4(distill 等引用废弃路径修)
- F2(about 拆分)+ F3(rule-git-worktree 拆 sub-files)+ F4(删除护栏拆)
- X3(rule frontmatter title)
- Q1 澄清(孤儿 rule 处理)

**版本**:每批 patch / minor 按内容定

### Batch 3: P2 激进改造(各自独立 spec)

- T6(pilot 拆 auto + manual)
- P4(通用 Bash risk policy 分级)
- F5(commands/_shared/)
- X1/X2/X4(命名 + 文档风格全仓重命名)
- 红军 R3 task graph 统一 → 独立 spec

## 实施收益预估

| Batch | 改动文件数 | 预估工作量 | 主要风险 | 收益 |
|---|---|---|---|---|
| **Batch 1**(P0) | ~10 文件 | 0.5 天 | 低(渐进改良,不推翻) | 触发率↑ / 安全 gate ↑ / 入口文档同步 / manifest 表达力↑ |
| Batch 2(P1) | ~15 文件 | 1-2 天 | 中(部分 refactor) | 单源更彻底 / 长期维护性↑ / 触发率精细↑ |
| Batch 3(P2) | 大幅重构 | 各自独立 spec | 高(架构反转) | 长远扩展性 / 触发可靠性根本性提升 |

## 红蓝军未达成共识的点(需用户拍板)

1. **catalog 常驻 vs 薄 catalog + UserPromptSubmit resurfacing**:Q1 推演给出"短期蓝军 / 长期红军",但**远期是否真做 UserPromptSubmit 回归**需用户决策(因为它推翻 v3.2.0 的核心决策)。
2. **pilot 拆分(P2)**:蓝军认为先改 description 看效果,红军认为 description 改不够。**等 Batch 1 实施 + rule-eval 量化后**再定。
3. **task graph 统一(R3)**:红军提出 reactive/proactive 二分不稳。**需深度独立 spec**,这里只记录方向。

## 后果

### Batch 1 实施后

- v3.5.0 minor:catalog 头部 + pilot description + PreToolUse 拦截 + manifest schema 扩 + README/about/INDEX
- 触发率(经验观察):catalog 命中桶概率↑(扫桶工序化)、pilot 被建议率↑(description 含主动建议)
- 安全护栏覆盖:从 4 类 → 7 类(+ 删除护栏、force push、gh PATCH)
- manifest 表达力:支持 rule 间依赖 / 严重度 / 生命周期阶段,为未来 rule 30+ 准备
- 入口文档与实际架构一致

### 长期(Batch 2 + 3 后)

- 真正"机制级"触发可靠性(UserPromptSubmit resurfacing,如果做的话)
- manifest 单源覆盖所有约束(skill desc / overlay / lifecycle / bucket)
- 通用 Bash risk policy(分级硬拦截)
- 命名一致 + 文档风格统一(扩展性 + 新人成本↓)

### 回滚

每个 Batch 独立 commit,可独立 revert。Batch 1 内的多个 commit 按分组(触发 / 意图 / 安全 / 单源 / 残留)分别 commit,定位问题方便。

---

## Appendix: 完整 finding 清单

### 蓝军(21 条)

A1 README 版本号 / A2 catalog 提示何时 /pilot / A3 README 加架构理由 / A4 pilot vs catalog 边界 / A5 删除护栏拆出
B1 三处分片硬编码 / B2 schema +depends_on/severity/stale_after / B3 skill description 纳入 manifest / B4 commands/_shared / B5 rule-git-worktree 拆 sub-files
C1 pilot lifecycle 表 / C2 about 拆 3 文件 / C3 bkt overlay 生成 / C4 manifest 字段冗余 / C5 rendering SKILL.md frontmatter
D1 red-blue-deep description / D2 pilot 主动建议 / D3 PreToolUse 漏拦 / D4 trigger_desc 可观测化 / D5 catalog 扫桶硬指令
E1 桶名风格 / E2 skill 命名风格 / E3 rule 标题 / E4 文档语言 / E5 distill 引用废弃路径

### 红军(15 条)

R1 catalog 常驻 ≠ 解决深度负载 / R2 pilot 手动入口可靠性弱 / R3 reactive/proactive 二分不稳 / R4 rendering 残留 frontmatter / R5 安全策略分散 / R6 behavior rule 仍是软触发
F1 桶内选择错误 / F2 80% 会话不用常驻 / F3 三处 segment 同步 / F4 --check 被 hook 吞掉 / F5 skill 触发冲突 / F6 specs INDEX 缺失
I1 manifest JSON Schema / I2 bkt description 过宽 / I3 rule-eval 不进 CI / I4 pilot 简单/复杂硬阈值 / I5 README 版本同步 / I6 about 无架构总览
Q1 孤儿 rule 处理(draft 还是 hard fail)
