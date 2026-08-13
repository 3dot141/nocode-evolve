---
type: feat
status: confirmed
sourceLog: ./design.log.md
artifacts:
  design: ./design.md
  render: ./design.html
---

# Devflow / Dev Design Redesign

## Panorama

目标：把 devflow 收敛为只判断 `bug / feat / refactor` 的薄编排层，把 Define 与 Design 合并为一个先 grilling、后成图、再交付 `design.md` 的 `dev-design`。

```text
User request
     |
     v
+---------------------------+
| devflow                   |  DES-001
| type + active Log + route |
+-------------+-------------+
              |
              v
+---------------------------+
| dev-design                |
|                           |
|  grill one decision       |  DES-003
|  persist Round + LOG IDs  |  DES-002 / DES-004
|  close type decision tree |  DES-005 / DES-006 / DES-007
|  write design.md + DES IDs|  DES-008 / DES-009
|  self-check + confirm     |  DES-012
+-------------+-------------+
              |
              +--------------------------+
              | user asks for rendering  |
              v                          |
        nocode:open-design                |
        -> design.html                    |  DES-011
        -> Mermaid fallback               |
                                         |
              +--------------------------+
              v
        Log Handoff
              |
     +--------+---------+
     |                  |
   Bug             Feat / Refactor
     |                  |
   Debug              Plan
     |                  |
   dev-design           |
   repair               |
     |                  |
   Build or Plan <-------+
     |
   Verify -> Review -> Land               DES-014
```

本次实现的主要风险不是功能缺失，而是旧的 8 阶段 / 4 场景、Decision Packet、revision / digest、Registry 和 render receipt 仍被其它 Skill 或测试引用。迁移必须把运行时消费者和契约测试一起改到新模型，不能只重写两个入口文件。

## 1. Goal and Scope

### DES-001 — Thin devflow

- kind: behavior
- statement: `devflow` 只解析活动 Log、按证据判断 `bug / feat / refactor`、调用 `dev-design`、遵循同 Log Handoff、处理回流或任务结束；不维护 8 阶段看板、场景复杂度、内部 plan 或专业 Gate。
- sourceLogRefs: D-001, D-024, D-059, D-060, D-061, D-062

### DES-002 — One stable task directory

- kind: artifact
- statement: 新任务使用 `docs/dev/{username}/{yymmdd}-{serial}-{topic}/`，固定包含 `design.log.md`、`design.md` 和按需 `design.html`；已有精确路径优先，目录创建后不重命名。
- sourceLogRefs: D-031, D-034, D-051, D-063, D-064

### Out of scope

- 不重写 Debug、Plan、Build、Verify、Review、Land 各自的领域方法。
- 不增加 ADR、receipt、manifest、revision、digest 或第二套 Registry。
- 不规定 Open Design 内部使用的 HTML / CSS / SVG / 布局技术。
- 不升级插件版本号；版本由用户单独决定。
- 暂不处理设计变化后旧 `design.html` 的删除或 stale 标记。

## 2. Before and After

### Before

```text
devflow
  -> Define
  -> Env
  -> Design(decision -> writing -> render-choice)
  -> Plan
  -> Build
  -> Verify
  -> Review
  -> Land

Routing: Full / Standard / Fix / Mini
Design: Decision Packet + revision + digest + Registry + verdict + receipt
```

主要问题：编排层复制阶段细节；Define / Design 重叠；先给产物再追问；沟通过程依赖会话记忆；同一设计被 Packet、文档、Registry、digest 和 receipt 多次表达。

### After

```text
devflow
  -> active design.log.md
  -> bug | feat | refactor
  -> dev-design
  -> current Handoff target

dev-design
  -> one-question grilling
  -> append-only Round + synchronized current views
  -> type closure
  -> design.md + DES IDs
  -> minimum self-check
  -> one confirmation + Handoff
```

## 3. Communication and Log Contract

### DES-003 — Persist before the next question

- kind: process
- statement: 每轮必须先把问题、推荐与理由写入 waiting Round；用户回答后补齐八段 Round，同步当前视图并关闭本轮，才能提出下一题。每轮只向用户问一个决策问题；环境事实由 agent 调查，不重复询问用户。
- sourceLogRefs: D-003, D-004, D-005, D-012, D-067

### DES-004 — Six-view Log with immutable LOG IDs

- kind: contract
- statement: `design.log.md` 固定包含 Header、Current Log Items、Decision Tree、Terms、Handoff、Round Log。LOG ID 采用 `LOG-###`，永不删除或改变原义；变化用新 ID 和 supersedes。证据绑定 Log Item / Round，不建 Evidence Registry。
- sourceLogRefs: D-006, D-025, D-026, D-027, D-038, D-065, D-066, D-068

```text
Header
  task / status / type / currentNode / createdAt / artifacts

Current Log Items
  kind / status / statement / sourceRounds / evidence
  designDisposition(required|n/a) / relations

Decision Tree
  node / status / sourceLogIds / dependsOn / note

Terms
Handoff
Round Log (append-only)
```

Round 固定八段：Background / Evidence、Question、Agent Recommendation + Reason、User Answer、Log Item Changes、Term Changes、Flow Impact、Next Node。

## 4. Type-specific Decision Flows

### DES-005 — Bug two-pass design

- kind: behavior
- statement: Bug 先闭合权威预期、actual、复现契约、影响、验收与 Debug 调查义务，生成问题基线 DES ID 后进入 Debug；Debug 证据回到同一 Log，再由 dev-design 形成修复基线。单一闭环修复直达 Build，其余进入 Plan。
- sourceLogRefs: D-013, D-014, D-015, D-016, D-017, D-039

```text
B0 type gate -> B1 authority -> B2 expected/actual -> B3 repro contract
  -> B4 impact -> B5 acceptance -> B6 investigation obligations
  -> Debug
  -> root-cause evidence -> repair alternatives -> propagation
  -> regression / rollback -> Build or Plan
```

### DES-006 — Feat full-flow design

- kind: behavior
- statement: Feat 从真实结果、角色、当前流程和竞品开始，闭合范围、领域模型、用户 / 业务 / 系统流程、规则、状态、方案、边界、契约、跨域协作、发布迁移和验收，再进入 Plan。
- sourceLogRefs: D-018, D-019, D-020, D-021, D-022, D-040, D-041

```text
F0 outcome -> F1 actors -> F2 current flow -> F3 benchmark
  -> scope -> domain/state/rules -> user/business/system flows
  -> options -> boundaries/contracts/cross-domain
  -> release/migration -> acceptance/evidence closure -> Plan
```

### DES-007 — Refactor Before / After / Invariants / Migration

- kind: behavior
- statement: Refactor 允许具体的代码不优雅作为动机，但必须点名结构、期望质量和停止条件；闭合 Before、必须保持、方案对比、After、迁移 / 兼容 / 回滚、删除 Gate 和验证，再进入 Plan。
- sourceLogRefs: D-018, D-023, D-042

```text
R0 type gate -> R1 motivation -> R2 Before -> R3 invariants
  -> benchmark -> target quality -> alternatives -> After
  -> migration / compatibility / rollback -> cleanup gate
  -> verification closure -> Plan
```

外部对标：默认给出内部知识方案；联网只在用户明确要求时进行。联网材料记录 URL、页面时间和访问时间；内部知识标记为内部数据源，并记录数据源时间或明确 unavailable。

## 5. Design Document Contract

### DES-008 — One type-specific design.md with embedded panorama

- kind: artifact
- statement: 三类任务统一生成 `design.md`，type 写在元数据中；开头是一屏 ASCII panorama，正文使用类型专属结构。panorama 不再是独立文件，用户只确认一次完整设计基线。
- sourceLogRefs: D-035, D-040, D-041, D-042, D-043, D-044, D-050, D-051

文档按关系选图：流程 / 分支用流程图，边界 / 依赖 / 数据所有权用架构图，跨参与者顺序 / 超时 / 重试 / 并发用时序图；状态图、数据流图、ER 图仅在承重时增加。规范图默认 ASCII，并标注相关 DES ID。

### DES-009 — LOG to DES two-layer traceability

- kind: contract
- statement: `design.log.md` 通过 LOG ID 保存“为什么”；`design.md` 通过不可变 `DES-###` 保存“需要调查、实现、保持或验证什么”。每个 design-required LOG ID 必须映射到 DES ID 或明确 n/a；每个 DES ID 必须有 sourceLogIds。所有下游只消费 `design.md` 与 DES ID。
- sourceLogRefs: D-036, D-037, D-038

```text
LOG-###  --sourceLogIds-->  DES-###
 why                         obligation
                              |
             +----------------+----------------+
             v                v                v
          Plan task        Build result     Verify evidence
```

本设计 Log 在新模板生效前已使用 D-xxx；本文件的 `sourceLogRefs` 是一次性迁移兼容。实现后的新任务只允许 sourceLogIds 指向 LOG-###。

### DES-010 — Type-specific diagrams remain semantic

- kind: quality
- statement: 图不是装饰；流程 / 结构 DES ID 必须能在图中定位，相关失败与恢复必须覆盖。图和正文冲突时不得 Handoff，必须回 grilling 修正规范 ASCII 图。
- sourceLogRefs: D-043, D-044, D-049

## 6. Rendering

### DES-011 — On-demand Open Design HTML with Mermaid fallback

- kind: integration
- statement: 默认只生成 `design.md`。用户明确要求渲染时，dev-design 调用 `nocode:open-design`，输入当前 `design.md`，输出同目录单文件 `design.html`；允许在线依赖，不锁版本。Open Design 不可用时才回退 Mermaid。
- sourceLogRefs: D-045, D-046, D-047, D-048, D-053, D-054, D-055, D-056

渲染不得新增、删除或改写设计事实；具体 HTML、SVG、CSS 或布局技术不属于 dev-design 契约。旧 HTML 的 stale 管理暂缓，且 HTML 永不参与确认或下游 Handoff。

## 7. Confirmation and Handoff

### DES-012 — Minimum self-check and one confirmation

- kind: gate
- statement: 请求用户确认前必须证明决策树闭合、design-required LOG 覆盖完整、DES 可追溯、关键图与正文无冲突。任一失败回 grilling。通过后只追加一个 design-confirmation Log Item，并在同 Log 形成 Handoff。
- sourceLogRefs: D-029, D-049, D-052

Handoff 使用已确认的最小语义：From、To、Reason、Read、Preserve、Open。Read 指向 `design.md` 和本阶段 DES ID；Open 只能包含已接受的非阻塞项。

## 8. Skill Layout and Migration

### DES-013 — One public dev-design; remove dev-define and nested playbooks

- kind: structure
- statement: 删除 `skills/dev-define/`，不保留 redirect。`dev-design/SKILL.md` 只保留主干；细节迁入共享 `grilling / writing / handoff / render` 和三类 `questions / closure / document` references。旧 decision / writing 嵌套 SKILL 退出运行时。
- sourceLogRefs: D-002, D-008, D-009, D-010, D-011, D-041, D-057, D-058

```text
skills/dev-design/
├── SKILL.md
└── references/
    ├── grilling.md
    ├── writing.md
    ├── handoff.md
    ├── render.md
    ├── bug/{questions,closure,document}.md
    ├── feat/{questions,closure,document}.md
    └── refactor/{questions,closure,document}.md
```

### DES-014 — Downstream stages consume DES IDs without legacy baseline machinery

- kind: migration
- statement: Plan、Build、Verify、Review、Land 和 Bug Debug handoff 读取同一 `design.md` 与相关 DES ID；删除 Standard / Full 分支、revision / digest、Implementation Item Registry 及旧矩阵命名。设计基线变化时回原 dev-design Log，局部实现自由不回流。
- sourceLogRefs: D-030, D-031, D-032, D-033, D-034, D-036, D-037

Build 保留两种合法入口：Plan 任务序列；或 Bug 修复设计确认后的单一闭环直接 Build。所有实现结果报告完成的 DES ID、改动文件和新鲜测试证据。

## 9. Verification Objectives

### DES-015 — Contract tests and platform packages prove the migration

- kind: verification
- statement: 更新契约测试，证明 devflow 只有三类 / 五步、dev-define 不存在、dev-design 主干精简且 references 完整、LOG / DES 双向覆盖、旧 revision / digest / Registry / Packet / receipt 路径不再由工程工作流消费，并验证平台发布物与源码一致。
- sourceLogRefs: D-041, D-057, D-058, D-059, D-069

最低验证：

1. `node --test 'hooks/*.test.mjs'`
2. `node scripts/compile.rule.js --check`
3. `node scripts/compile.hooks.js --check`
4. `node scripts/vendor-sync.mjs --check`
5. `node scripts/package.platform.mjs`
6. `node scripts/package.platform.mjs --check`
7. 搜索运行时源码，确认无 `dev-define`、旧 dev-design 私有 SKILL 路径、`designRevision`、`designDigest`、Implementation Item Registry、Decision Packet 或 render receipt 残留消费者。

## 10. LOG / DES Coverage

| DES ID | Historical source refs | Implementation surface |
|---|---|---|
| DES-001 | D-001, D-024, D-059–D-062 | `skills/devflow/SKILL.md` |
| DES-002 | D-031, D-034, D-051, D-063, D-064 | dev-design path / grilling references |
| DES-003 | D-003–D-005, D-012, D-067 | `references/grilling.md` |
| DES-004 | D-006, D-025–D-027, D-038, D-065–D-068 | Log template / grilling / writing |
| DES-005 | D-013–D-017, D-039 | bug references + Debug handoff |
| DES-006 | D-018–D-022, D-040, D-041 | feat references |
| DES-007 | D-018, D-023, D-042 | refactor references |
| DES-008 | D-035, D-040–D-044, D-050, D-051 | writing + type documents |
| DES-009 | D-036–D-038 | shared traceability + all consumers |
| DES-010 | D-043, D-044, D-049 | type documents + self-check |
| DES-011 | D-045–D-048, D-053–D-056 | render reference + Open Design handoff |
| DES-012 | D-029, D-049, D-052 | writing / handoff references |
| DES-013 | D-002, D-008–D-011, D-041, D-057, D-058 | Skill directories and docs |
| DES-014 | D-030–D-037 | Plan / Build / Verify / Review / Land contracts |
| DES-015 | D-041, D-057–D-059, D-069 | tests, generated packages, checks |

All confirmed decisions D-001 through D-069 are either represented by a DES obligation above or are process context included in the same section. Deferred D-054 remains explicitly out of scope.
