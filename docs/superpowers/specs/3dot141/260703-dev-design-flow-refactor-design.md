---
type: design-doc
scenario: refactor
topic: dev 设计流程重构——薄协调器 + select/refine/render 四 skill
date: 260703
author: 3dot141
status: draft
last_updated: 260703
---

# Refactor: dev 设计流程重构——薄协调器 + 四 skill

> 把 dev 设计流程从"3 个职责纠缠的 skill"重构为"1 个薄协调器 + 3 个单一职责阶段 skill",用一份正式的决策包(Decision Packet)契约串联,消除跨 skill 的重复与往返。
>
> 缩写首次出现均用「中文 英文全称 - 缩写」,集中术语表见文末。

## 背景

**核心根因(主因):`dev-design` 一个 skill 背了两个职责。** 它既是"选方案的执行者"(探索 / 方案对比 / 领域覆盖 / 定测试目标),又是"整个设计流程的协调者"(调用 `dev-design-refine` 写文档、接收回来、再评审、最后交接)。这两个职责纠缠在一个 skill 里,是下面一连串问题的共同源头——决策在这做、文档在别处写(做写分裂),文档在别处评审、回来又评审一遍(评审两遍),任务在 3 个 skill 间往返跳转(无总图)。

**附带问题(辅因),4 个盲区**(独立审查挖出,与主因无关但同样要修):

1. `dev-design-refine` 的 `research` 场景其实是"选方案",放在详细设计阶段是边界错位
2. `dev-design-render` 渲染时会往已评审的设计文档追加内容,破坏"已评审"状态
3. 三个 skill 的触发词(description)可能互相撞车,只改正文不改路由,执行仍会进错阶段
4. `dev-design` 承诺"整个流程只有一个用户确认窗口",但它调用的 `dev-design-refine` 内部还藏着多个确认点,承诺兜不住

**不重构的代价**:每加一个流程环节,就要在"决策放哪个 skill、评审归谁、确认在哪弹"上重新纠结;新人(和 agent)读不懂"整个设计流程是什么",因为它散在 3 个文件里、靠各自的 handoff 拼。

**本次范围**:只重构这三个 skill 的**边界与协调方式**,不改它们各自的领域内容质量(DDD 域拆分怎么做、评审维度是什么等,原样保留)。

## 现状分析

### 现状结构总图(3 skill 的往返)

```
                    ┌─────────────────────────────────────────┐
                    │  dev-design (Step0-10)                    │
     用户/devflow ─→│  ① 选方案(探索/方案对比/领域覆盖/TO)      │
                    │  ② 协调(调 refine / 接收 / 评审 / 交接)   │
                    └──────┬───────────────────────▲───────────┘
                           │ Step8c 调用            │ 收尾交回 Step9
                           ▼                        │ 再评审一遍
                    ┌──────────────────────┐        │
                    │ dev-design-refine     │────────┘
                    │  详细设计 + 写文档     │
                    │  + 收尾评审一遍       │──┐ 岔出
                    └──────────────────────┘  │
                                              ▼
                                    ┌──────────────────────┐
                                    │ dev-design-render     │
                                    │  渲染 HTML            │
                                    │  (还会改回设计文档)   │← 盲区②
                                    └──────────────────────┘

跳转路径:A → B → A(回评审) → 岔 C。一个任务在 3 个 skill 间往返,无一张贯穿总图。
```

### DDD 视角审视:职责耦合诊断

```
dev-design 同时承担两类性质完全不同的职责:

  「选方案 worker」职责          「流程 coordinator」职责
   ├─ 探索代码/外部方案            ├─ 决定何时调 refine
   ├─ 多轮方案对比选定            ├─ 接收 refine 产物
   ├─ 领域覆盖检查                ├─ 评审文档(Step9)
   └─ 定测试目标 TO              ├─ 管全流程用户确认策略
                                 └─ 交接给 dev-plan
        ↑                              ↑
   收敛的领域工作              横切的流程编排
   (应属某个阶段 skill)        (应属独立协调层)
```

诊断:**worker 职责和 coordinator 职责应该分层**。协调是横切关注点(管状态机、路由、确认策略、异常回退),不该和"选方案"这个具体阶段的收敛工作塞在同一 skill。二者纠缠,就出现"协调逻辑(评审、确认)漏进了选方案 skill,又和下游 refine 的同类逻辑重复"。

### 问题清单(6 原始问题 + 4 盲区)

| # | 问题 | 类别 | 证据 |
|---|---|---|---|
| P1 | Step 编号撞车:refine 通用 Step2(章节大纲) vs 场景模板 Step2(领域划分) | 原·核心 | `refine/SKILL.md:85` vs `:150` |
| P2 | 决策"做"(dev-design)和"写"(refine)分裂,两处同名「方案选择」无分工声明 | 原·核心 | `refine/SKILL.md:85,394` |
| P3 | 同一设计文档被评审两遍(dev-design Step9 + refine 收尾),三套维度重叠 | 原·核心 | `dev-design/SKILL.md:520` + `refine/SKILL.md:475` |
| P4 | 完整性/一致性核对散在两 skill 三处(8a/8b/Step9 + refine 收尾) | 原 | `dev-design/SKILL.md:463,483,540` |
| P5 | "唯一确认窗口"承诺假:refine 内部有多个用户介入点 | 原 | `dev-design/SKILL.md:19` vs `refine/SKILL.md:510` |
| P6 | 三 skill 跳转靠各自 Gate 拼,无贯穿总图 | 原·核心 | 全流程 |
| B1 | `research` 场景实为选方案,放 refine 是永久边界重叠 | 盲区 | `refine/SKILL.md:394`(research 模板) |
| B2 | render 往已评审文档追加「可视化」引用,破坏"已评审"状态 | 盲区 | `render/SKILL.md:154` |
| B3 | 触发词路由:重构/RFC/ADR/技术选型意图可能同时命中 select 与 refine | 盲区 | 各 skill description |
| B4 | 缺流程质量指标(确认次数/回退次数/重复 findings/handoff 缺字段/独立调用成功率)。**本次挂待办**(见验证策略) | 盲区 | — |

> P1-P6 根在"边界切错 + 协调没独立";B1-B4 是独立的边界/契约缺陷。全部指向同一个重构方向:**分层(协调 vs 阶段)+ 单一所有权 + 正式 handoff 契约**。

## 方案选择

> 决策速查表在前(结论先行),读者一眼看完所有拍板;逐 Q 展开时每个否决项配与推荐项同等分量的理由。确认状态标 `[已确认]`(用户/红蓝拍板)/`[假定]`(agent 自主,待用户复核)。

### 关键决策速查表

| # | 决策点 | 定 | 状态 | 影响 |
|---|---|---|---|---|
| Q1 | 三 skill 要不要合并成一个 | **不合并** | `[已确认]` 红蓝拍板 | 全局 |
| Q2 | dev-design 怎么拆 | **拆成 薄协调器 + dev-design-select** | `[已确认]` 用户选 B | 架构总图 |
| Q3 | 评审放哪、放几次 | **归一到 refine 一次 + 架构审核前置** | `[假定]` | P3、目标 4.2 |
| Q4 | research 场景归属 | **从 refine 移到 select** | `[假定]` | B1、Q8 |
| Q5 | render 要不要改输入文档 | **纯化:只输出 HTML+报告,不碰输入** | `[假定]` | B2 |
| Q6 | 触发词路由怎么划 | **按产物意图重划,select/refine 不撞** | `[假定]` | B3 |
| Q7 | 决策章节参考谁 | **rinoux 结论先行骨架 + jimmy 反方配平** | `[已确认]` 红蓝轻档 | 目标 4.5 |
| Q8 | 骨架收敛到哪 | **场景驱动;清 prd/rfc/adr 旧地层** | `[已确认]` 用户 | 文件影响 |
| Q9 | 术语怎么写 | **「中文 英文全称-缩写」+ 文末术语表** | `[已确认]` 用户 | 全文 |
| Q10 | 可观测性怎么处理 | **分两层:基础日志必做 + 生产监控条件** | `[假定]` | ⑥、产出代码质量 |
| Q11 | 文档生命周期怎么管 | **superseded 留痕 + 单一有效版** | `[已确认]` 用户 | ②、refine |
| Q12 | eval 缝不缝进 design | **AI 功能类强制带 eval 设计节** | `[已确认]` 用户 | ③、select/refine |

### Q1: 三个 skill 要不要合并成一个？→ 影响全局

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 合并成 1 个 | 14 步一个 skill 顺下来 | 接缝最少,总图/确认策略天然一份 | ~1471 行巨型 skill,漏 Step 风险高;render 仍需独立 wrapper;发散/收敛思维混 |
| **B. 不合并,分层** | 协调器 + 阶段 skill | context 可控、关注点分离、可独立触发 | 需定义正式 handoff 契约 |

**定 B(不合并)。** `[已确认·红蓝重档拍板]`

**否决 A(合并)**:合并只是"分 0 条边界"的极端。它能物理消灭跨 skill 裂缝,但代价是每次进入都要吃 ~1471 行 context——skill 越大 agent 越容易跳步(这是 LLM 真实约束)。而且渲染是可选终点分支,很多设计不渲染,合并后 render 的 Step 常驻却常被 skip;发散思维(选方案)和收敛思维(详细设计)压一个 skill 会互相污染。**用重新划对边界能拿到合并的全部收益,不用付这些代价。** → 影响全局架构。

### Q2: dev-design 怎么拆？→ 影响架构总图

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 只瘦身(砍评审) | dev-design 保留"选方案+协调",只把评审移给 refine | 改动小 | dev-design 仍兼两职责,后续再膨胀 |
| **B. 拆协调器 + select** | 协调职责独立成薄协调器,选方案独立成 select | 单一职责、确认策略真正统一、往返变状态机 | 多一个 skill + 正式 schema |

**定 B(拆成薄协调器 + select)。** `[已确认·用户选 B]`

**否决 A(只瘦身)**:瘦身版能解决 P3(评审两遍),但 dev-design 仍然同时是"选方案 worker"和"流程 coordinator"。只要这两个职责还在一个 skill 里,确认策略就统一不了(协调逻辑和阶段逻辑混着)、往返也消不干净(协调没有独立的状态持有者)。独立审查明确判:瘦身"适合短期修复,但 dev-design 后续容易再次膨胀"。B 把协调抽成 ~100 行薄协调器,select 纯做选方案,才是治本。 → 影响架构总图(见目标 4.1)。

### Q3: 评审放哪、放几次？→ 影响 P3

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 维持两遍 | dev-design 和 refine 各审一次 | (无) | 同一文档审两遍,三套维度重叠 |
| **B. 归一 + 前置架构审核** | refine 收尾唯一一次全文评审;结构定型后先做一次架构审核 | 产出方审、不重复;架构错误早暴露 | 需把 dev-design Step9 的评审逻辑迁走 |

**定 B。** `[假定]`

**否决 A(维持两遍)**:文档是 refine 写的,refine 最清楚自己写了什么,评审该由产出方做。dev-design(拆分后是协调器)只需验证 refine 返回了"通过的评审结论(review verdict)",不重新审一遍未生成时它管不到的文档。**评审拆成两层**:结构定型后先做**架构审核**(早,审域拆分/模块边界/依赖方向,架构错了改动成本低)+ 全文写完做**评审**(晚,审完整性/一致性/可执行)。各审各的,不重复。 → 消解 P3、P4。

### Q4: research 场景归属？→ 影响 B1

**定:从 refine 移到 select。** `[假定]`

**理由**:`research`(预研/技术选型)会重新调研、对比方案、给推荐——这**本质就是选方案**,不是"选定的路怎么走"的详细设计。放在 refine 是永久的边界重叠(`refine/SKILL.md:394` 的 research 模板里就有方案对比)。移到 select 后,refine 的场景模板只剩 `feat / bug / refactor` 三种,纯做详细设计。

**否决"留在 refine"**:留着的唯一好处是"用户想直接预研可以只调 refine"——但预研的正确入口本就该是 select(或独立的 research 流),不是详细设计 skill。边界清晰的价值 > 省一次入口调整。 → 影响 B1、Q8 骨架收敛。

### Q5: render 要不要改输入文档？→ 影响 B2

**定:纯化——render 只输出 HTML + 渲染报告,不碰输入文档。** `[假定]`

**理由**:现在 render 渲染完会往设计文档追加「## 可视化」引用(`render/SKILL.md:154`)。问题是设计文档在 render 之前已经过评审(reviewed),render 又改了它——**"已评审"状态被破坏,评审结论不再对应当前文档**。改为:render 输出 `<topic>-design.html` + 一份渲染报告,产物关系由协调器或独立 manifest 记录,输入文档一个字不动。

**否决"维持追加引用"**:追加引用的好处是"设计文档里能看到渲染产物在哪"——但这点用协调器记录产物关系同样能达到,不必以破坏"已评审"不可变性为代价。 → 消解 B2。

### Q6: 触发词路由怎么划？→ 影响 B3

**定:按产物意图重划 description,select 与 refine 不撞。** `[假定]`

**理由**:skill 的 description/触发词也是架构的一部分。现在"重构方案 / RFC / ADR / 技术选型"这些意图可能同时命中 select(选方案)和 refine(写文档)——只改流程正文、不改触发路由,agent 实际执行时仍会随机进错阶段。重划:**select 接"选什么方案/技术选型/预研/方案对比"意图,refine 接"把已选方案写成详细设计文档"意图**,措辞上互斥。

**否决"只改正文不动路由"**:省事,但等于重构了流程却没重构入口,agent 该进 select 时可能进了 refine,前功尽弃。 → 消解 B3。

### Q7-Q9(沿用前期已确认决策,不再展开对比)

- **Q7 决策章节** `[已确认·红蓝轻档]`:以 rinoux 的"结论先行 + 固定小节"为骨架(章节首放决策速查表),嫁接 jimmy 的"反方配平"(每个否决项配同等篇幅理由),不选 north 的编号表(索引性强、理解性弱,且精华在独立文件)。本文档的「方案选择」节即按此写(dogfood)。
- **Q8 骨架收敛** `[已确认·用户]`:收敛到场景驱动(feat/bug/refactor),退役旧 doc-type 地层(design-doc/prd/rfc/adr + 对应 examples);prd 归 pd-prd、research 归 select、adr 决策并入本决策章节。
- **Q9 术语规范** `[已确认·用户]`:所有缩写首次出现用「中文 英文全称 - 缩写」,文末必带术语表。

### Q10: 可观测性怎么处理？→ 影响 ⑥、产出代码质量

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 维持条件触发 | "需要生产可观测?"才讨论 | 简单 | 普通功能整段跳过,实测大量 `logger.info` 缺失 |
| **B. 分两层** | 基础日志(默认必过)+ 生产监控(条件触发) | 关键路径/异常/出入口默认打 log | 领域覆盖多一个必过项 |

**定 B。** `[假定]`

**否决 A(维持条件触发)**:现状把可观测性一刀切当成"要不要上生产监控(Metrics/告警/Trace)"这种重量级决策。普通功能一判"不需要生产监控",整个可观测环节就跳过——**连关键路径打不打日志都没人讨论**,基础日志落在门槛之下成了三不管地带,这就是"很多 `logger.info` 都没有"的根因。分层后,基础日志(关键路径 / 异常分支 / 模块出入口)是**每个功能的默认项**,不设条件;完整三支柱才按需触发。 → 影响 select 领域覆盖 + refine 监控章拆两层。

### Q11: 文档生命周期怎么管？→ 影响 ②

**定:给 refine 加两条规范。** `[已确认·早期同意]`(非选型决策,沿用早期已确认,故不列备选)

1. **superseded 留痕**:文档被取代时,顶部标注指向当前权威版、保留原文不删(供审计),不靠删除或放任 stale 误导。
2. **推翻式修订保持单一有效版**:当前有效内容就是正文,读者不需要在"顶部 banner + 正文 + 尾部 Review Log"三处对账才知道"现在到底信哪段"。

**理由**:现状 refine 有状态机(draft→…→archived)+ Review Log,但"被取代 / 推翻式大改怎么标"没规范。实测(harrison 的 spec)大文档改一版要三处对账,读者认知负荷超标。 → 影响 refine 状态机 / Review Log 规范。

### Q12: eval 缝不缝进 design？→ 影响 ③

**定:AI 功能类设计强制带一节 eval 设计。** `[已确认·早期同意]`(非选型决策,沿用早期已确认,故不列备选)

评估维度 / 指标 / 用例集 / baseline 对比,参考分级判定 L1-L4(命中 Hit / 计划 Planned / 尝试 Attempted / 验证 Verified)。

**理由**:nocode 有 eval-harness skill,但和 design 阶段是两张皮。AI 功能的"对不对"单测覆盖不了,要评估体系。这和 ⑥ 同类——**都是"design 阶段该强制讨论的横切设计"**(⑥ 管可观测、③ 管效果评估)。 → 影响 select / refine 骨架(AI 功能类加 eval 章)。

## 目标设计

### 4.1 新架构总图(4 skill)

```
                        ┌───────────────────────────────────────┐
                        │  dev-design (薄协调器, ~100 行)         │
     用户 / devflow ───→│  持有: 总流程图 / 阶段状态机 / 路由 /    │
                        │        全流程确认策略 / 异常回退         │
                        └──┬──────────┬──────────┬───────────────┘
              调用 + 收结果 │          │          │
                 ┌──────────▼──┐ ┌─────▼──────┐ ┌─▼──────────────┐
                 │dev-design-  │ │dev-design- │ │dev-design-     │
                 │select       │ │refine      │ │render          │
                 │选方案        │ │详细设计+   │ │纯渲染           │
                 │→ Decision   │ │文档+唯一   │ │→ HTML+报告      │
                 │   Packet    │ │评审        │ │(不改输入文档)   │
                 └─────────────┘ └────────────┘ └────────────────┘
                  决策形成段       文档产出段       收口(渲染,可选)

协调器持有状态机:  select → refine → (可选)render → final gate
阶段 skill 只返回结果(Decision Packet / reviewed doc / html + 报告),
不自行管流程、不自行弹确认(被协调调用时返回 needs_user_input,由协调器统一弹)。
```

> **决策包 Decision Packet** = select 产出、refine 消费的**结构化交接契约**(不是一段自然语言摘要),字段详见 4.3。

### 4.2 14 步流程线映射 4 skill

| 段 | 步 | 落到 |
|---|---|---|
| 🟦 决策形成 | 1 澄清 / 2 探索 / 3 UI 需求理解 / 4 方案沟通 / 5 其他模块考虑 / 6 测试目标 TO | **dev-design-select** |
| 🟩 文档产出 | 7 落笔前核对 / 8 文档结构确认 / 9 架构审核 / 10 文档信息补全 / 11 文档落地 | **dev-design-refine** |
| 🟨 收口 | 12 评审(唯一一次) | **dev-design-refine** |
| | 13 是否渲染 HTML | **dev-design-render** |
| | 14 handoff | **dev-design(协调器)** |

协调器把 1→14 串成状态机,持有阶段状态 + 全流程确认策略(P5 的"唯一确认窗口"改为"一个计划内总窗口 + 明确列举的异常确认",不再兜不住)。

### 4.3 Decision Packet(决策包)schema

select 产出、refine 消费的**正式 handoff 契约**——不是一段自然语言摘要,而是带 required fields + 版本的结构化包(否则接缝问题只是从"自然语言漂移"变成"schema 漂移"):

```
DecisionPacket {
  version            // schema 版本号,防上下游字段漂移
  selectedApproach   // 选定方案
  alternatives[]     // 备选方案 + 否决理由 → 喂给 refine 决策章节做反方配平(①)
  constraints[]      // 约束
  domainDecisions[]  // 领域覆盖决策(含「可观测·基础日志」层, ⑥)
  openQuestions[]    // 未决项
  testObjectives[]   // 测试目标 TO 表
  verifyStrategy     // 验证策略
  evalSpec?          // AI 功能类必填: eval 设计(维度/指标/用例/baseline, ③)
  sources[]          // [Read path:line] / [SOURCE: url] 来源
}
requiredFields = [version, selectedApproach, constraints, domainDecisions, testObjectives]
```

**"局部决策 vs 方案级决策"判据**(refine 详细设计中遇到新决策时):改动了**数据流 / 模块边界 / 外部契约 / 关键约束**任一 → 返回 `replan_required`(含失效决策+证据+受影响章节),由协调器重新调 select;都没改 → refine 自己定(局部决策,如接口参数/模块内部实现)。**refine 在信息补全阶段每遇新决策即套用此判据**。这条判据把 P2(决策做/写分裂)钉死:方案级决策只属 select,refine 只能做局部决策。

### 4.4 Before / After 对比

```
Before(3 skill 往返)                     After(协调器 + 状态机)

A → B → A(回评审) → 岔 C                 select → refine → (render) → gate
dev-design 兼「选方案 + 协调」           dev-design 只协调(薄)
评审两遍(dev-design + refine)           评审一遍(refine 产出方审)
research 在 refine(边界重叠)             research 在 select
render 改已评审文档                      render 纯输出,不碰输入
可观测条件触发(漏 logger.info)          基础日志默认必做 + 生产监控按需
自然语言 handoff(易漏字段)              Decision Packet 契约(required + 版本)
"唯一确认窗口"承诺兜不住                 协调器持有确认策略:一个总窗口 + 列举的异常确认
```

### 4.5 各 skill 目标职责边界

| skill | 职责 | 边界(不做什么) | 本次改动 |
|---|---|---|---|
| **dev-design**(协调器) | 总流程图 / 状态机 / 路由 / 确认策略 / 异常回退 / handoff | 不做任何阶段的领域工作 | 从"选方案+协调"**瘦成纯协调**(~100 行) |
| **dev-design-select** | 探索 / UI 需求 / 方案对比选定 / 领域覆盖 / TO / eval,产出 Decision Packet | 不写设计文档、不评审 | **新建**;research 归此(B1);领域覆盖「可观测」分两层、基础日志必过(⑥);AI 功能类产出 evalSpec(③) |
| **dev-design-refine** | feat/bug/refactor 详细设计 + 写文档 + 唯一评审(架构审核前置) | 不选方案(方案级决策 `replan_required` 回 select) | 砍 research 场景(B1);接管**唯一评审**(P3);监控章拆「基础日志(必写)+ 生产监控(按需)」(⑥);加文档生命周期规范(② superseded 留痕 + 单一有效版);AI 功能类带 eval 设计节(③) |
| **dev-design-render** | 渲染 HTML + 渲染报告 | **不改输入文档**(评审后不可变, B2) | 纯化:产物关系由协调器/manifest 记录 |

## 迁移策略

> 分步落地,每步独立可回滚。skill 是文档——"回滚"= `git revert` 该步 commit;新结构先与旧并存、验证通过再切旧入口、最后删旧。原则:**先建新并验证,再切,最后删**。

### Step 1: 抽 dev-design-select(纯新增,零风险)

从 dev-design 复制"选方案"部分(现 Step1-7,**对应 14 步流程线的决策形成段 2-6 + 落笔前核对**)成新 skill,定义 Decision Packet 输出。**select 支持两种模式**:方案选择(feat/bug/refactor 的前置)与独立预研(research 模式,骨架从 refine 迁入,见 Step6)。dev-design 此时不动,select 并存但未接入。

- **文件**:`skills/dev-design-select/SKILL.md` (NEW) + references
- **验证**:select 单独可跑,产出合法 Decision Packet(requiredFields 齐)
- **回滚**:删 select 目录,dev-design 一个字没动

### Step 2: dev-design 瘦成薄协调器

删掉选方案 Step,改为持有状态机 + 路由,顺序调 select→refine→render。

- **文件**:`skills/dev-design/SKILL.md` (改)
- **验证**:协调器串起 select→refine,handoff 不缺字段
- **回滚**:revert 到 Step1(select 并存 + dev-design 旧版)

### Step 3: refine 接管唯一评审 + 架构审核前置

refine 收尾评审设为**唯一**评审;新增"架构审核"步(文档结构确认后、信息补全前);协调器只验 refine 返回的 review verdict,不再自己评审。同时 **refine 内部 Step 重编号**:通用流程步(建 task / 加载输入 / 结构确认)与场景模板步统一编号,消除"两个 Step2"(解决 P1)。

- **文件**:`refine/SKILL.md` (改) + `reviewer-template.md`
- **验证**:一份文档只评审一次;架构审核在信息补全之前;refine 内部无重复 Step 编号(P1)
- **回滚**:revert

### Step 4: render 纯化(B2)

去掉"追加可视化引用到设计文档",改为输出 HTML + 渲染报告,产物关系由协调器记录。

- **文件**:`render/SKILL.md` (改)
- **验证**:render 前后输入文档字节不变
- **回滚**:revert

### Step 5: 修盲区(触发词路由 B3 + 确认窗口 P5)

重划 select/refine 的 description 使意图不撞;协调器确认策略改"一个总窗口 + 明确列举的异常确认"。

- **文件**:各 SKILL frontmatter description + `manifest.json` triggers
- **验证**:"技术选型/重构方案/预研"意图路由到 select,不撞 refine
- **回滚**:revert

### Step 6: ④ 骨架收敛

删 `doc-types/{design-doc,prd,rfc,adr}.md` + `examples/example-*-{dogfood,business}.md`;改错位引用(SKILL:33/665/673-674、cards×2、reviewer-template:190、brainstorming rule);research 归 select(`example-research-skeleton.md` 迁入 select,作为其预研模式的骨架)。

- **文件**:见文件影响汇总
- **验证**:`rg` 扫全仓无残留引用指向已删文件(无死链)
- **回滚**:revert(旧 doc-types 从 git 恢复)

### Step 7: ⑥ 可观测性分层 + ③ eval 缝合

select 领域覆盖「可观测」分两层(基础日志必过);refine 监控章拆「基础日志(必写)+ 生产监控(按需)」;AI 功能类骨架加 eval 节。

- **文件**:select/refine SKILL + example skeleton + observability/eval reference
- **验证**:feat 骨架含"基础日志设计"必写节;AI 功能类骨架含 eval 节
- **回滚**:revert

### Step 8: ① 决策章节 + ② 生命周期 + ⑤ 术语

refine 决策章节改「结论先行速查表 + 反方配平 + [已确认]/[假定]」;加 superseded 留痕 + 单一有效版规范;写作准则加术语规范 + 文末术语表要求。

- **文件**:refine SKILL 写作准则 + 场景骨架 + reviewer-template
- **验证**:example 骨架体现速查表 + 配平 + 术语表(本设计文档自身即样板)
- **回滚**:revert

### Step 9: manifest 重新生成 + version major

更新 `rules/manifest.json`(dev-design/brainstorming triggers + 新 select skill);`node hooks/generate.mjs`;`plugin.json` version **major**。

- **文件**:manifest.json + 生成物(catalog/pretooluse) + plugin.json
- **验证**:`node hooks/generate.mjs --check` 一致;`node --test 'hooks/*.test.mjs'` 过
- **回滚**:revert

## 文件影响汇总

```
skills/dev-design-select/                              (NEW)  新阶段 skill(从 dev-design 抽选方案)
  ├── SKILL.md
  └── references/...
skills/dev-design/SKILL.md                            (改)   瘦成薄协调器(~100行)
skills/dev-design-refine/SKILL.md                     (改)   ①②③⑥ + 唯一评审 + 架构审核 + 砍 research
skills/dev-design-refine/references/
  ├── doc-types/{design-doc,prd,rfc,adr}.md           (删)   ④ 退役旧地层
  ├── examples/example-*-{dogfood,business}.md         (删)   ④(8 个文件)
  ├── example-{feat,bug,refactor}-skeleton.md          (改)   ⑥ 基础日志节 + ① 决策速查表 + ③ eval 节
  ├── example-research-skeleton.md                     (移)   research 骨架迁往 select
  ├── cards/{quick-view,prerequisites}.md              (改)   ④ 改挂场景骨架
  └── reviewer-template.md                             (改)   ① 配平维度 + ⑥/③ 维度
skills/dev-design-render/SKILL.md                     (改)   B2 纯化
rules/rule-superpowers-brainstorming.md               (改)   ④ 引用改场景骨架
rules/manifest.json                                   (改)   triggers 重划(B3)+ 注册 select skill
model/agent-catalog-*.md + hooks/pretooluse-rules.json (生成)  由 generate.mjs 重新生成,禁手改
.claude-plugin/plugin.json                            (改)   version major

合计:1 NEW skill + 4 改 SKILL + ~10 删(旧 doc-type 地层) + 若干 references/rule/manifest 改
```

## 验证策略

> 重构 skill 的核心是"证明流程不断链、不漏步"——等价于回归测试证明行为不变。各步的回滚见迁移策略,本节是跨步的整体验证。

| 验证项 | 手段 | 覆盖 |
|---|---|---|
| 生成物一致 | `node hooks/generate.mjs --check` | manifest→catalog/pretooluse 无漂移 |
| hook 测试 | `node --test 'hooks/*.test.mjs'` | 触发路由(B3) |
| vendor 一致 | `node scripts/vendor-sync.mjs --check` | — |
| 无死链 | `rg` 扫已删 doc-types/examples 的引用 | ④ 收敛无残留 |
| 流程走通(回归) | 手动走一遍 select→refine→render:handoff 不缺字段、不回跳、评审仅一次 | 全链 P1-P6 |
| Decision Packet 契约 | select 产出含 requiredFields;refine 遇方案级决策判 `replan_required` | 4.3 |
| ⑥ 落地 | feat 骨架含"基础日志设计"必写节 | ⑥ |
| ①③ 落地 | 骨架含决策速查表 + 反方配平;AI 功能类含 eval 节 | ①③ |

**流程质量指标(B4,挂待办)**:每任务确认次数 / 跨阶段回退次数 / handoff 缺字段次数 / 独立调用成功率——作为"验证重构长期有效"的观测项。本次**先定义、不强制采集**;采集机制(hook 埋点)后续单独立项,不阻塞本次落地。

## 术语与缩略语

| 统一格式 | 一句话解释 |
|---|---|
| 决策包 Decision Packet | select 产出、refine 消费的正式 handoff 契约(带 required 字段 + 版本号) |
| 测试目标 Test Objective - TO | 每条使用路径要验证什么的目标(不是具体测试用例) |
| 事前验尸 Pre-mortem | 假设方案已失败,倒推 top3 死因(对应事后复盘 post-mortem) |
| 信息架构 Information Architecture - IA | 页面怎么组织、放什么、导航怎么走 |
| 验收标准 Success Criteria - SC | 怎么算做成了的判定条件 |
| 业务流 Business Flow - BF | 一条业务逻辑的伪代码流程(带编号 BF1/BF2) |
| 领域驱动设计 Domain-Driven Design - DDD | 按业务实体拆域、高内聚低耦合的设计方法 |
| 端到端 End-to-End - E2E | 走完整链路的测试层级 |
| 用户界面 User Interface - UI | 用户看到、操作的界面 |
| 可观测性 Observability | 系统能否被观测(基础日志 / 生产监控三支柱) |
| 重新规划 replan_required | refine 遇方案级决策变更时返回,协调器据此回 select 重选 |
| 已确认 [CONFIRMED] | 决策由用户 / 评审拍板 |
| 假定 [ASSUMED] | 决策由 agent 自主定,待用户复核 |

## Review Log

### 第 1 轮 review(260703 · 自审 · 重档)

**独立性**:核心架构决策(Q1-Q6:合并/拆分/评审归一/research归属/render纯化/触发词路由)在方案形成期已经红蓝军 + Codex 异源独立审查;本轮为整份文档的完整性/一致性自审,未命中升档判据(reviewing skeleton §1a),自审收口。

**Findings**(无 Critical;3 Warning + 3 Suggestion + 1 Self-Audit):
- **W1** P1(Step 编号撞车)列为核心问题但方案未解决——迁移缺 refine 内部重编号步
- **W2** select 获得 research 能力的路径未讲清
- **W3** 14 步编号 vs dev-design 现有 Step 编号未对齐
- **S1** Q11/Q12 无选项对比
- **S2** replan 判据 refine 执行落点未说
- **S3** Decision Packet 等首次出现未 inline 解释
- **SA1** B4 问题清单列出但目标挂待办,范围声明不清

**用户决定**:全修(W1-W3 + S1-S3 + SA1 全部 fix)。

**修订摘要**:
- W1 → 迁移 Step3 加"refine 内部 Step 重编号(消除两个 Step2)"+ 验证加 P1 检查
- W2 → 迁移 Step1 加"select 两种模式(方案选择/预研)",Step6 注明 research 骨架迁入
- W3 → Step1 加"现 Step1-7 对应 14 步决策形成段 2-6 + 落笔前核对"映射
- S1 → Q11/Q12 加"非选型决策,沿用既定"标注
- S2 → 4.3 加"refine 在信息补全每遇新决策套此判据"
- S3 → 4.1 图后加 Decision Packet inline 解释
- SA1 → 现状 B4 行加"本次挂待办"
