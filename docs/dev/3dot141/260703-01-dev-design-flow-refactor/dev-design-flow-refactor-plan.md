# dev 设计流程重构 Implementation Plan

**Goal**: 把 dev 设计流程从 3 个职责纠缠的 skill 重构为「薄协调器 + select/refine/render 四 skill」,含 ①②③④⑤⑥ 六项改进。
**Architecture**: dev-design 瘦成薄协调器(持状态机/路由/确认策略);新建 dev-design-select 产出 Decision Packet;refine 详细设计+文档+唯一评审;render 纯渲染不改输入。
**Tech Stack**: Claude Code skill(markdown 指令) + rules/manifest.json(单源生成) + hooks/generate.mjs + plugin.json。
**Design Doc**: `docs/dev/3dot141/260703-01-dev-design-flow-refactor/dev-design-flow-refactor-design.md`
**Test Objectives**: `generate.mjs --check` / `node --test hooks/*.test.mjs` / `vendor-sync.mjs --check` / `rg` 扫死链 / 手动走 4-skill 流程
**Commit 策略**: 方案 A —— 所有 task 改完**最后 squash 成一个 `7.0.0` commit**(符合 CLAUDE.md 规则2「改插件同 commit 升版本」)。中途回滚靠 build checkpoint 的 `git reset`,不做 task 级 commit。
**Execution**: executing

> 本计划已过 Round2 窄化 red-blue(强制重档,Codex 异源独立审查),按 Codex 重排主链修订。修订说明见文末 Review Log。
> 重构对象是 skill 文档(非运行时代码),无 TDD red-green;"验证"= generate/rg/手动走流程。

## 依赖图(严格串行主链)

```
S1a(select主体) → S1b(完整阶段协议) → S1c(research完整迁移·含删refine)
  → S6(骨架死链收敛·语义锚点) → S3(refine消费契约+唯一评审+架构审核+重编号)
  → S7(可观测/eval 三边落地) → S8(决策章节+生命周期+术语)
  → 【契约 checkpoint】 → S4(render纯化) → S2+S5(切协调器+固化确认/路由)
  → S9(原子切入口:manifest+generate+路由测试+version) → 【最终 checkpoint】
```

**为什么串行**(Codex 独立审查结论):S6 先于 S3(死链收敛要在大重编号前,否则 S6 的行号定位失效);S3 消费契约要在 S1b 完整协议之后;S2 切协调器要在上下游协议(S1b/S3)就绪之后,否则 CP 验的是假兼容。

## 任务序列

### T1 · S1a 抽 dev-design-select 主体 〔风险高〕
- **Files**: Create `skills/dev-design-select/SKILL.md` + `references/`;参照 `skills/dev-design/SKILL.md` Step1-7
- **covers**: 迁移 Step1 · B 架构 select
- **规格**: 迁 dev-design 现 Step1-7 领域流程(探索/UI需求/方案对比选定/领域覆盖/TO),**暂不切入口**(description 先建但 dev-design 仍在跑)。落笔前核对**留 select**做「Decision Packet 完整性核对」(与 refine 的「文档落笔前核对」分成两个 gate,见 T5)
- **验证**: select/SKILL.md 存在;不含"写文档/评审"职责
- **回滚**: 删 select 目录

### T2 · S1b 完整阶段协议 〔风险最高〕
- **Files**: Modify `select/SKILL.md`(阶段协议节)
- **covers**: 设计 §4.3 · P2 判据 · 盲区(replan envelope / StageResult / version)
- **规格**(Codex 要求补全,不只字段名):
  - **Decision Packet schema** + **条件必填规则**:`domainDecisions.observability.basicLogging` 所有适用场景必填;`evalSpec` 在 `isAIFeature=true` 必填;空数组/空占位视为缺失;不支持的 version 返回错误
  - **requiredFields 扩**:除原 5 项,补 `alternatives`(S8 决策章节要)、`verifyStrategy`(refine 验证章要)、`openQuestions`(信息补全要)——固定存在允许空数组 或 明确条件必填
  - **StageResult 枚举**:`completed | needs_user_input | replan_required`
  - **replan envelope schema**:原 Packet/revision + 失效决策 + 证据 + 受影响章节 + 恢复到哪个状态
  - **needs_user_input 统一结构**:返回结构 + 恢复状态 + 重复确认去重规则
- **验证**: schema 含条件必填规则(非仅字段名);replan/needs_user_input envelope 完整
- **回滚**: revert

### T3 · S1c research 完整迁移 〔含删 refine〕
- **Files**: Move `refine/references/example-research-skeleton.md` → `select/references/`;Modify `select/SKILL.md`(加 research 模式)、**`refine/SKILL.md`(删 research 场景/分支/description)**
- **covers**: B1 · W2
- **规格**: select 支持"方案选择 + 独立预研(research)"两模式;**从 refine 删除 research 场景**;research skeleton 迁入 select;**独立 research 终止状态 = 直接交付 research Packet 终止**(不自动进 refine,由用户决定下一步)`[假定]`
- **验证**: `ls select/references/example-research-skeleton.md` 存在;`rg "research" refine/SKILL.md` 无残留(此 task 自己删,验证可满足)
- **回滚**: 移回 + 恢复 refine research 节

### T4 · S6 骨架死链收敛(先于重编号)
- **Files**: Delete `refine/references/doc-types/{design-doc,rfc,adr,prd}.md` + `examples/example-{design-doc,rfc,adr,prd}-{dogfood,business}.md`;Modify `refine/SKILL.md`、`cards/{quick-view,prerequisites}.md`、`reviewer-template.md`、`rules/rule-superpowers-brainstorming.md`——**改引用一律用语义锚点(节标题),不用行号**(S3 大重编号后行号会失效)
- **covers**: 迁移 Step6 · ④
- **规格**: 删旧 doc-type 地层;所有指向已删文件的引用改指场景骨架。brainstorming rule 改的是 rule 正文引用(非 manifest 元数据),与 S9 改 manifest triggers 不同真值源,不冲突
- **验证**: `rg "doc-types|example-.*-(dogfood|business)" skills/ rules/` = 0 死链
- **回滚**: revert(git 恢复删除文件)

### T5 · S3 refine 消费契约 + 唯一评审 + 架构审核 + 重编号 〔核心〕
- **Files**: Modify `refine/SKILL.md`, `reviewer-template.md`
- **covers**: P1 · P3 · 契约消费(Codex 阻断1)· 架构审核
- **规格**(Codex 补:refine 消费侧):
  - **消费 Decision Packet**:接收并**校验 version + requiredFields**;字段映射到文档章节;`evalSpec` 条件必填校验
  - **信息补全阶段应用 replan 判据**:遇方案级决策(改数据流/边界/契约/约束)→ 返回结构化 `replan_required`(按 T2 envelope)
  - **标准化 review verdict**(协调器只验这个,不重复评审)
  - **架构审核**步(结构确认后、信息补全前)
  - **内部 Step 重编号**:通用流程步 vs 场景模板步统一,消除两个 Step2(字母后缀)
  - refine 的**文档落笔前核对**gate(与 select 的 Packet 完整性核对分开)
- **验证**: refine 消费+校验 Packet;一份文档评审一次;无重复 Step2;replan 返回符合 envelope
- **回滚**: revert

### T6 · S7 可观测/eval 内容落地(producer+consumer+skeleton 三边)
- **Files**: Modify `select/SKILL.md`(领域覆盖可观测层+产出 evalSpec)、`refine/SKILL.md`(监控章)、`example-{feat,bug,refactor}-skeleton.md`(基础日志+eval节)
- **covers**: ⑥ · ③(契约条件 T2 已定,这步只补能力+模板)
- **规格**: select 领域覆盖「可观测」分两层(基础日志必过+生产监控条件)、AI 场景产出 evalSpec;refine 监控章拆两层;skeleton 加基础日志必写节 + AI 类 eval 节。**三边(producer/consumer/skeleton)同步,消除 T2 契约声明与能力落地之间的假通过窗口**
- **验证**: feat skeleton 含"基础日志"节;select 产出的 Packet 在 AI 场景含非空 evalSpec
- **回滚**: revert

### T7 · S8 决策章节 + 生命周期 + 术语
- **Files**: Modify `refine/SKILL.md`(写作准则)、`example-{feat,bug,refactor}-skeleton.md`(决策速查表)、`reviewer-template.md`(配平+术语维度)
- **covers**: ① · ② · ⑤
- **规格**: ① 决策章节消费 Packet 的 `alternatives`(反方配平)+ 结论先行速查表 + `[已确认]/[假定]`;② superseded 留痕 + 单一有效版;⑤ 术语规范 + 文末术语表;reviewer-template 加对应维度
- **验证**: skeleton 含速查表+配平(消费 alternatives)+术语表
- **回滚**: revert
- **▶ 契约 checkpoint**(原 CP1 挪此,Codex 阻断2):手动跑 `select→refine`,测 **5 条路径**:①正常 Packet ②缺 required field ③AI 场景缺 evalSpec ④schema version 不支持 ⑤refine 触发方案级变更回 select(replan)

### T8 · S4 render 纯化
- **Files**: Modify `render/SKILL.md`
- **covers**: B2 · 盲区(产物记录)
- **规格**: 删「追加## 可视化到设计文档」;输出 HTML + **render receipt(渲染回执)**;**产物关系由协调器记录**(记录结构在 S2 定,manifest 不承担运行产物索引)
- **验证**: render 后设计文档 `git diff` 为空;产出 receipt
- **回滚**: revert

### T9 · S2+S5 切换协调器 + 固化确认/路由 〔上下游协议已就绪才切〕
- **Files**: Modify `dev-design/SKILL.md`(协调器)、`select/refine/render` description
- **covers**: 迁移 Step2/5 · P5 · P6 · B3 · 盲区(产物记录结构/replan 处理)
- **规格**:
  - dev-design 删现 Step1-7,改持状态机(`select→refine→render→gate`)+ 路由 + **确认策略(单一所有者,S5 不重复定)**:"一个总窗口 + 列举异常"
  - 协调器**处理 replan_required**(覆盖旧 Packet + 递增 revision + 保留决策历史)、统一 `needs_user_input` 弹窗、**记录 render 产物关系**结构
  - **删旧 Step 时扫描残留**:`rg "Step ?[1-9]|Step8c|Step9" dev-design/SKILL.md` 确认 Gate/TaskCreate/handoff 无指向已删旧步的引用
  - S5 部分:重划 description(select/refine 意图互斥),**只改 description + 定路由矩阵,不改 manifest**(manifest 留 S9 原子做)
- **验证**: dev-design 无选方案逻辑、无旧 Step 残留引用;确认策略单一处定义;description 意图不撞
- **回滚**: revert
- **▶ CP-流程**(改名,不过度承诺):4 skill 切换完,手动走 `select→refine→render` 正常链路 + replan 回退

### T10 · S9 原子切入口(manifest+generate+路由测试+version)
- **Files**: Modify `rules/manifest.json`;Run `node hooks/generate.mjs`;Modify `.claude-plugin/plugin.json`
- **covers**: 迁移 Step9 · B3 triggers · version
- **规格**(Codex:原子完成,manifest 唯一所有者):
  - manifest.json:改 dev-design trigger(协调器)、**注册 dev-design-select rule**、改 brainstorming 引用、triggers 重划(B3 路由 + research 归 select 的触发词)
  - 跑 generate.mjs 重新生成 catalog/pretooluse(禁手改生成物)
  - plugin.json version → `7.0.0`(major)
- **验证**: `generate.mjs --check` 一致;`node --test hooks/*.test.mjs` 过(**补用例:select rule 路由 / research 归 select / select↔refine 意图排他**);`vendor-sync --check` 过
- **回滚**: revert
- **▶ 最终 checkpoint**(真实路由在此才能验):generate 后手动验路由(技术选型→select、写文档→refine 不撞)+ 全流程走通 + `git` squash 成一个 `7.0.0` commit

## 路径覆盖映射(Plan Validation §8c)

| 来源 | task |
|---|---|
| 迁移 Step1-9 | T1/T2/T3(S1a/b/c) · T4(S6) · T5(S3) · T6(S7) · T7(S8) · T8(S4) · T9(S2+S5) · T10(S9) |
| ①→T7 · ②→T7 · ③→T6 · ④→T4 · ⑤→T7 · ⑥→T6 |
| P1→T5 · P2→T2(契约)+T5(消费) · P3→T5 · P5→T9 · P6→T9 · B1→T3/T4 · B2→T8 · B3→T9/T10 · B4→挂待办 |
| Codex 阻断1(消费者)→T5 · 阻断2(CP)→契约checkpoint · 阻断3(串行链)→依赖图 · 阻断4(commit)→方案A |

全覆盖,无漏(B4 显式挂待办)。依赖无环(线性主链)。每 task 有验证命令。

## Review Log

### Round2 窄化 red-blue(260703 · 强制重档 · Codex 异源)
- **蓝军**(主会话)判"跨 task 一致性大体成立",被独立审查实质修正。
- **Codex 独立审查**发现 4 阻断(消费者缺失/CP假验证/依赖图不全/commit违约)+ 多个高中风险(假通过窗口/requiredFields不足/S1c验证自满足不了/所有权重复)。
- **落地**:按 Codex 重排主链重写任务序列(S1a→S1b→S1c→S6→S3→S7→S8→契约CP→S4→S2+S5→S9);补契约消费(T5)/条件必填+envelope(T2)/语义锚点(T4)/去重(T9)/原子 manifest(T10);commit 采**方案 A**(用户拍板,squash 一个 7.0.0);独立 research 终止=直接交付 `[假定]`。
