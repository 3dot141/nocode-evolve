---
type: design-doc
topic: design-doc-writing skill 从"上下半结构"重构为"问题驱动线性骨架"
date: 260512
author: 3dot141
status: implemented
last_updated: 260512
---

# Design Doc：design-doc-writing skill 问题驱动重构

> 这是 example，dogfood 本次 skill 重构本身。演示新骨架在真实场景下的写法——读者学结构时直接对照本文件即可。

## 背景

**核心问题**：旧骨架（上半 Human Review / 下半 Agent Implementation）让产出的 markdown 设计文档**逻辑难追**——读者读完无法快速 trace 决策链。具体表现：TL;DR 引用未定义术语（layer / intent / humanizer 等内部缩写）、上下半元标签消耗注意力、章节间无承上启下、pain point 平铺 5 条不分主次。

**附带问题**（本 doc 一并解，但不是 driver）：reference 文件层次叠加（doc-types/ + layer-supplements/）增加 writer 判断成本、Cross-cutting Checklist 6 项硬清单容易被 N/A 敷衍。

不解决的代价：每份产出文档读起来烧脑，reviewer 评审耗时翻倍，用户实际抱怨"格式好丑"。

## 目标

- 产出文档**跳读可懂**——任意章节不依赖后文术语
- **元标签全去**，H2 章节名是内容实体（背景 / 架构 / 实现）
- **架构决策 ↔ 实现逻辑 1:1 默认映射**，reviewer 可机器 cross-check 双边节数
- 4 类 doc-type reference + 3 类 example（design-doc / PRD / ADR）全部重写完成

## 架构

### 架构图

无——本 doc 是 skill 内部文件结构调整，无运行时组件交互。架构层关注点是**文件职责切分**。

### 流程图

writer 视角调用本 skill 的工作流：

```
判断 doc-type (PRD/RFC/Design Doc/ADR)
       ↓
Read references/doc-types/<type>.md
       ↓
Read references/examples/example-<type>.md
       ↓
写初稿
       ↓
spawn design-doc-reviewer subagent
       ↓
Report 原样呈现 → 用户逐条确认
       ↓
据用户决定修订 + 追加 Review Log
       ↓
(by overlay) design-doc-rendering 渲染 HTML
```

### 问题拆解

#### 问题一：如何避免"上下半"元标签

说明：旧骨架用 `## 上半：Human Review` / `## 下半：Agent Implementation` 作 H2，告诉读者"这一节是给谁看的"。读者第一次看会想"上半是什么、我现在是 human 吗"——元标签消耗注意力但不传递内容。

方案对比：

- 方案 A：保留"上下半"但改名为更直观的词（如「设计 / 实现」作 audience 标签）——否决：仍是元结构标签，本质相同。
- 方案 B：完全去元标签，直接用内容实体（背景 / 架构 / 实现）作 H2。
- 方案 C：在 frontmatter 加 `audience` 字段区分目标读者——否决：增加 schema，读者要先看 frontmatter 才知道下面是给谁看的。

结论：选方案 B。直接以"内容是什么"命名章节，读者跳读不需先理解元结构约定。

#### 问题二：如何让 Alternatives / Trade-offs 不脱节

说明：旧骨架把 Alternatives 列成全局节——读者看到 5 个备选并列，不知道哪个对应哪个具体决策。Trade-offs 同样脱节。

方案对比：

- 方案 A：保留全局 Alternatives 节，但要求每条标记关联决策——否决：增加 cross-ref 维护成本，作者容易漏标。
- 方案 B：把 Alternatives 局部化到每个具体问题——「架构.问题 X」自带「说明 / 方案对比 / 结论」三件套。
- 方案 C：彻底删除 Alternatives 概念——否决：丢失"考虑过哪些方案"的设计 evidence，reviewer 无法 challenge 决策依据。

结论：选方案 B。每个问题自带方案对比，reviewer 评估单个决策不跳节。

#### 问题三：实现节如何承接架构节

说明：旧"下半"列了 6 节并列（Component / API Contracts / Data Model / Error Handling / Testing / Cross-cutting），与上半的 Goals / Alternatives 无承接关系。reviewer 拼不起 decision-implementation 映射。

方案对比：

- 方案 A：实现节按代码模块组织——否决：跨多个决策的模块容易碎片化，单文件改动散落多节。
- 方案 B：实现节按「逻辑 X」组织，每条逻辑默认对应架构.问题 X，命名引用；允许细节性逻辑独立成节。
- 方案 C：实现节合并入架构节（每个问题里写实施细节）——否决：单节过长，主路径与代码细节混在一起。

结论：选方案 B。命名引用让 reviewer 可机器 cross-check 双边一致性；细节性逻辑独立成节保留灵活度。

### 架构总结

基于问题 1-3 的结论：骨架变为「背景 → 目标 → 架构 → 实现」线性递进；架构层用「问题拆解」结构化决策，每问题自带三件套；实现层用「逻辑 X」与架构问题默认 1:1 映射，并支持细节性逻辑独立成节。下一节展开本骨架在 skill 仓库各文件中的落地。

## 实现

### 影响文件

```
nocode-evolve/
├── skills/design-doc-writing/
│   ├── SKILL.md                          (改)  全文重写：删 layer 概念 + Cross-cutting 节；
│   │                                              新增「边界 / 影响文件硬格式 / ASCII cheat sheet / 6 条逻辑可读性准则」
│   ├── references/
│   │   ├── doc-types/
│   │   │   ├── design-doc.md             (改)  新骨架：背景 / 目标 / 架构 (架构图/流程图/问题拆解/架构总结) / 实现 (影响文件/逻辑X)
│   │   │   ├── prd.md                    (改)  新骨架：背景 / 目标 / 用户场景 / 验收标准
│   │   │   ├── rfc.md                    (改)  新骨架：背景 / 目标 / 提案 / 影响评估 / 开放问题
│   │   │   └── adr.md                    (改)  新骨架：背景 / 决策 (说明/方案对比/结论) / 后果
│   │   ├── examples/
│   │   │   ├── example-design-doc.md     (改)  按新骨架重写——即本文件
│   │   │   ├── example-prd.md            (改)  按新 PRD 骨架重写
│   │   │   ├── example-adr.md            (改)  按新 ADR 骨架重写
│   │   │   └── example-rfc.md            (留)  暂沿用旧版（RFC 骨架变动较小）
│   │   ├── layer-supplements/            (留)  layer 概念已去，目录保留作 deprecated reference；后续清理
│   │   └── common.md                     (留)  Cross-cutting Checklist 不再强制，文件保留作可选 reference
│   └── agents/
│       └── design-doc-reviewer.md        (改)  ① 7 维度核心审查（新增"骨架可读性"维度）
│                                              ② Structural 检查项按新 frontmatter / 骨架更新
│                                              ③ Critical 边界明确："元标签作 H2" 上 Critical
├── rules/
│   └── overlay-superpowers.md            (改)  reviewer 维度数描述同步更新
└── .claude-plugin/
    └── plugin.json                       (改)  version 0.20.0 → 0.21.0 (minor)
```

### 逻辑一：骨架重写（对应问题一 + 问题二 + 问题三）

**业务流**

```
SKILL.md
  ├─ 工作流 step 列表：判断 doc-type → Read references → 写初稿 → reviewer → 用户确认 → 修订 → 渲染
  ├─ 写作准则 6 条（依次解决问题一/二/三 + pain point 主次 + 术语解释 + 节间承接）
  └─ 边界声明：design-doc 止于伪代码 + 契约 + 异常；class 内部 + TDD 步骤进 plan

references/doc-types/<type>.md
  ├─ 该 type 的骨架代码块（H2 / H3 列表）
  ├─ 各节写作要点（一段话讲该节回答什么）
  └─ 写作纪律 + 长度参考 + frontmatter schema
```

**关键契约**

- SKILL.md 与 doc-types/*.md 职责切分：SKILL.md 讲**跨类型**的写作原则 + 工作流；doc-types/*.md 讲**特定类型**的骨架 + 写作要点
- 各 doc-type frontmatter schema 是 hard contract，reviewer 按此做 structural 检查
- design-doc frontmatter 删除 `layer` 字段——新骨架下「架构」「实现」是内置二级节，覆盖深度由 writer 在「问题拆解」节数 + 「逻辑 X」详细度调节

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| writer 选错 doc-type | 把 RFC 类需求写成 ADR | reviewer 按 schema 检查时报 Critical `type mismatch` | reviewer 上抛 |
| 旧 frontmatter 残留 `layer` 字段 | 历史 design doc | reviewer 报 Warning `deprecated field`，建议手动迁移 | reviewer 上抛 |
| writer 用旧骨架（上半/下半） | 模型 cache 未刷新 | reviewer 「元标签作 H2」上 Critical | reviewer 上抛 |

### 逻辑二：example 重写（对应问题二 + 问题三的演示需求）

**业务流**

```
example-design-doc.md（即本文件）
  └─ dogfood 本次重构本身
     ├─ 演示问题拆解三件套（本文件含 3 个问题）
     ├─ 演示影响文件 ASCII 多模块树
     ├─ 演示逻辑 X 的三子节（业务流 / 关键契约 / 异常与失败模式）
     └─ 演示节间承上启下 / 主因辅因 / 术语 inline 解释

example-prd.md
  └─ dogfood：nocode-evolve 整体作为 PRD
     ├─ 演示用户场景结构化（角色 / 触发 / 当前流程 / 期望流程 / 痛点定位）
     └─ 演示验收标准 + 明确排除

example-adr.md
  └─ dogfood：本次重构里的某个具体决策（如"去掉 layer 概念"）
     ├─ 演示方案对比简短写法（每方案 1-3 行）
     └─ 演示后果含负面
```

**关键契约**

- 每份 example 必须**完整**——不省略章节、不写 "...略..." 占位
- 每份 example 顶部 1-2 行注释，告诉 writer "这是 dogfood 哪个真实决策"
- example 与 doc-types reference 的骨架**保持同步**——reference 改了 example 必须跟

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| example 与 reference 骨架不一致 | reference 改了 example 没跟 | reviewer 检查 example 自身是否符合自家 reference；不符上 Critical | reviewer 上抛 |
| example 内部术语未解释 | dogfood 内容用了项目内自创词 | 第一次出现 inline 解释（如本文件首段就解释 dogfood） | writer 在写时处理 |

### 逻辑三：reviewer 维度重写

本逻辑**默认对应问题三**（实现节如何承接架构节）的 reviewer 检查侧，但实际还覆盖了问题一、问题二的检查——属于 N:M 映射，故在节首声明。

**业务流**

```
design-doc-reviewer.md
  ├─ 核心审查从 6 维度扩为 7 维度
  │   ├─ 新增维度：「骨架可读性」——专门覆盖新 6 条逻辑可读性准则
  │   │   ├─ 入口段是否自洽（不引未定义术语）
  │   │   ├─ 章节是否用内容实体名（非元标签）
  │   │   ├─ 节间是否承上启下
  │   │   ├─ pain point 是否分主次
  │   │   ├─ 架构问题 ↔ 实现逻辑是否映射
  │   │   └─ 项目内自创词是否首次解释
  │   └─ 既有 6 维度（意图清晰 / 决策站得住 / 设计完整 / 实施可执行 / 一致性 / 范围）保留
  ├─ Structural 检查项按新 frontmatter / 骨架更新
  └─ Critical 边界明确：骨架可读性问题"实际影响读者理解"时上 Critical
```

**关键契约**

- 输出格式不变（C1 / C2 / W1 / S1 编号体系保留）
- 用户确认环节不变（hard gate，不自动循环）
- 维度数从 6 → 7，overlay-superpowers.md 描述同步更新

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| 旧 design doc 用旧骨架 | 历史文档 | reviewer 按新维度评，但允许 writer 在 Review Log 标 `legacy structure, 不迁移` | writer 上抛到用户 |
| 7 维度同时报 Critical | 文档质量太差 | reviewer 全列；用户决定一次性大改 vs 重写 | reviewer 上抛 |
| reviewer 自身误判 | 模型不稳定 | 用户在 Review Log 标 `false-positive, skipped` | writer 上抛到用户 |

---

> 本 example 演示结束。真实 design doc 在此处追加 `## Review Log` 节（含 reviewer Report + 用户决定 + 修订摘要），example 不带 Review Log 以保持骨架清晰。
