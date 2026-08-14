---
type: feat
status: confirmed
sourceLog: ./design.log.md
artifacts:
  design: ./design.md
---

# Design grilling：产品收口后再按块写开发

## 产品

### 全景

把 GitHub grilling 的面试原则拷进 `dev-design`。先聊清楚「设计是什么」，确认全景和功能树；再读代码，按最佳设计写怎么达到。`design.log.md` 只保留 DEC 与 ROUND。三种类型仍是三份成稿协议，共用落盘顺序。

```text
请求
  → 产品段 grill（不读代码）
  → 展示 全景 + 功能树 → 确认
  → 开发段：读代码
  → 全景 + 架构 + 流程
  → 按功能：流程图 + 接口 + 伪代码 + 问题
  → 写完 design.md → 确认 → Handoff
```

Plan 这轮不加 grill。不新增 `/grill-me`，不另起 ADR / `CONTEXT.md`。

| 做 | 不做 |
|---|---|
| 拷 grilling 原则进 Design | Plan grill |
| 产品段先于开发段 | 用户口令 `/grill-me` |
| 开发功能带流程图 | 产品功能带流程图 |
| Log = DEC + ROUND | 八段 Round、F0–F14 主树 |
| feat / refactor / bug 三份 document | 三种合成一份模板 |
| 最佳设计；撞对外契约单独问 | 默认以兼容或快选方案 |

### 功能 1 — 面试原则挂在 Design

拷 [mattpocock/skills grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) 的原则，不拷它的产品形态（frontier 整轮、无持久化、ADR）。

- 为**这件事**长决策树，不按类型问卷往下问。
- 一次只问一个能拍板的问题，带推荐方案。
- 事实自己查；决定才问用户。
- 先入库再提问；未确认理解前不写方案章、不动手。
- 默认一问一答。不把 GitHub 的 frontier 整轮设成默认。

### 功能 1.1 — 产品段：聊清楚设计是什么

不读代码。Grill 目标是共享理解：给谁、解决什么、做哪些、不做哪些、成功长什么样。

收口展示只有：

- 全景
- 功能树（功能 1 / 1.1 / 2，无流程图）

产品段未确认，不准读代码，不准写开发章。

### 功能 2 — 开发段：现在怎么达到

产品确认之后才读现有实现。标准是**最佳设计**，不是最少改现有、也不是最快能交。

开发展示：

- 全景、架构、流程
- 每个功能：流程图、接口、伪代码、问题

若最佳设计要打破已有对外契约或数据形态：停下来单独问，推荐最佳方案并写明让步代价。法规、已对外承诺、不可逆数据丢失仍须点明；是否让步由用户拍。

### 功能 3 — Log 只记 DEC 与 ROUND

`design.log.md` 的主内容是 DEC 列表和 ROUND 列表。DEC 是当前有效结论的索引；细节和问答在 ROUND。

### 功能 4 — 三种成稿仍分开

`feat/document.md`、`refactor/document.md`、`bug/document.md` 继续决定各类型必有章节。共用落盘顺序，章节名按类型：

| 类型 | 上半本 | 下半本 |
|---|---|---|
| feat | 产品：全景 + 功能树 | 开发：架构 / 流程 / 按功能 |
| refactor | Before：动机、范围、现状结构、不变量 | After：目标结构、迁移 / 按结构块 |
| bug | 问题：预期、actual、复现、影响、调查义务 | 修复：根因之后的方案 / 按修复块 |

Bug 上半本不得写修复方案；Debug 回来再写下半本。

### 功能 5 — 写 `design.md` 的顺序

产品 ROUND 闭合 → 写上半本 → 确认上半本 → 开发按块闭合并追加 → 整份检查 → 确认全文 → Handoff。未确认的 DEC 不进文档。

---

## 开发

### 全景

```text
skills/references/grilling-loop.md     面试原则（单源）
skills/dev-design/references/grilling.md   路径、DEC/ROUND、入库
skills/dev-design/SKILL.md             产品段 → 开发段 → 落盘
skills/dev-design/references/{feat,bug,refactor}/
    questions.md   改为上半本/下半本覆盖检查，不再生成下一问
    document.md    章节骨架按类型改名
    closure.md     双向覆盖跟上新骨架
design.log.md      Header + DEC + ROUND + Handoff（薄）
design.md          上半本 + 下半本
```

Plan、devflow 路由、Env-before-Build（260813）、DEC/DES 追溯契约不改语义。

### 架构

```text
                    grilling-loop.md
                    （怎么问）
                          |
            +-------------+-------------+
            |                           |
     grilling.md                   类型 document
     （怎么记）                    （写成什么样）
            |                           |
            +-------------+-------------+
                          |
                    dev-design SKILL
                    产品段 / 开发段 / 落盘
```

- 原则放共享 `skills/references/`，避免 Plan 将来若引用时跨 skill 私有 references（AGENTS.md 规则 6）。本轮 Plan 不调用它。
- 不新增对用户暴露的 grilling Skill。
- `questions.md` 不再是提问脚本，只做漏项检查。

### 流程

```text
打开 / 恢复 Log
  → 产品段：选树上最早能拍板的问题
  → 写 waiting ROUND（背景、问题、方案；回答空）
  → 用户回答 → 填回答、更新 DEC、闭 ROUND
  → 产品树空 → 写入并确认上半本
  → 读代码
  → 开发段同样一问一 ROUND
  → 每闭合一个功能/结构块/修复块 → 追加该节（含流程图）
  → 下半本齐 → closure + 四项检查
  → 确认全文 + Handoff
撞对外契约：本轮只问这一件（推荐最佳 + 代价）
证据改变设计语义：回同一 Log 重开节点
```

### 功能 1 — 面试原则

#### 流程图

```text
请求 + 已确认 DEC
        │
        v
   长这件事的树     事实自己查（产品段不读代码）
        │
        v
   取一个能拍板的问题
        │
        v
   waiting ROUND → 问用户 → 填回答
        │
        +-- 未闭合 --> 改树，下一问
        |
        v
   段空 --> 展示该段大纲 --> 确认
```

#### 接口

`skills/references/grilling-loop.md` 必须写清：

- 树从本任务长出，不从 F/B/R 编号长出。
- 每轮只问一个决定；方案必须是可反驳的推荐，禁止「请确认」。
- 产品段禁止为「系统里现在有什么」去读实现；定位不到子系统时只准问一个定位问题。
- 开发段必须先读与该功能相关的实现，再给方案。
- 选方案时不得用「改动小 / 出得快 / 兼容现有」作为推荐理由。这些只许写在代价里。
- 对外契约冲突：单独一 ROUND，方案写最佳设计，内容写代价，等回答。
- 不可用对话填的观感问题：记入该功能的「问题」，不编造接口。

`dev-design/SKILL.md` Step 2 改为「按当前段跑 grilling-loop」，不再写「读 questions.md 选最早 F 节点」。

#### 伪代码

```text
phase = 产品 | 开发 | bug.问题 | bug.修复 | refactor.Before | refactor.After
tree = build_tree(request, confirmed_DECs, phase)
loop:
  if phase in 开发段: investigate_repo(tree.current)
  q = first_decidable(tree)
  persist ROUND waiting {背景, 问题, 方案, 回答: 空}
  ask_and_stop()
  on reply:
    ROUND.回答 = 原文（不得缩成「用户已确认」）
    upsert DEC {描述, 内容, 过程, 引用}
    close ROUND
    reshape tree
until tree.empty
show_outline(phase)
wait_confirm()
```

#### 问题

- 旧任务 Log 仍是六段 + 八段 Round。本任务只约束新 Log；不迁移历史文件。
- `hooks/dev-design-contract.test.mjs` 与 `eval/cases/dev-design.md` 仍锁旧短语，实现时必须改测试，不得为过测试保留 F0–F14 提问主路径。

### 功能 2 — 产品段与开发段

#### 流程图

```text
产品确认
    │
    v
读代码（仅开发段）
    │
    v
开发全景 / 架构 / 流程
    │
    v
功能 N ──流程图──接口──伪代码──问题──写入 design.md
    │
    +-- 还有功能 --> 下一功能
    |
    v
closure
```

#### 接口

上半本确认前，`design.md` 可以不存在或只有 frontmatter + 产品章草稿；开发章不得出现。

开发段每个功能节固定四块，缺一块不得标该功能已闭合：

1. 流程图（实现/控制流，不是产品功能树）
2. 接口（契约、错误、权限/幂等等该有的语义；符号须有仓库证据或调查 DES）
3. 伪代码（关键控制流）
4. 问题（未闭合点、要用户拍的点、不可grill的观感）

#### 伪代码

```text
write_upper(type):
  feat      -> # 产品 + 全景 + 功能树
  refactor  -> # Before + 动机/范围/现状/不变量
  bug.问题  -> # 问题 + 预期/actual/复现/影响/调查
confirm_upper()
if bug.问题: handoff Debug; return
write_lower_incrementally()
```

#### 问题

- 产品功能树的粒度：以用户可独立理解的能力为准，不按文件或模块拆。
- 开发「流程」是系统主路径；功能「流程图」是该功能怎么走。两张图不要合成一张。

### 功能 3 — DEC / ROUND

#### 流程图

```text
提问前                 回答后
ROUND-00N waiting      ROUND-00N closed
  背景                   背景
  问题                   问题
  方案                   方案
  回答: （空）            回答: 用户原文
                       DEC-00X.内容 = 有效结论
                       DEC-00X.引用 += ROUND-00N
```

#### 接口

Log 固定薄头尾 + 两份主列表：

```markdown
# Header
- task:
- status: active | landed | cancelled | terminated
- type: bug | feat | refactor
- phase: 产品 | 开发 | 问题 | 修复 | Before | After
- current: 功能 1.1 | …
- createdAt:
- artifacts:

# Decisions

## DEC-001
- 描述: 一句话，这是什么决定
- 内容: 当前有效结论
- 过程: 提出 / 修订 / 确认
- 引用: [ROUND-001, ROUND-002]

# ROUND

## ROUND-001 — waiting | closed
### 背景
### 问题
### 方案
### 回答

# Handoff
```

规则：

- ID 仍零填充：`DEC-001`、`ROUND-001`。语义变更发新 DEC 并在「过程」写明取代关系；不复用旧 ID 改意思。
- 提问前必须已经写入 waiting ROUND（背景、问题、方案；回答空）。
- 「回答」写用户原决定内容，禁止只写「用户已确认」。
- DEC 不复述 ROUND 全文。「内容」必须能单独被 `design.md` 引用。
- 删除固定六段里的 Decision Tree、Terms 专章、八段字段名。术语若出现，写进相关 DEC「内容」或 ROUND「背景」。
- Header / Handoff 留下，供 devflow 路由。Handoff 字段保持 260813：`To: Debug | Plan | Env` 等。
- 非决策流水用极短 ROUND 或继续用 `Event N` 仅限 stage-transition / returned-evidence；Event 不映射 DES。

取代现协议中的：`kind`、`status` 多枚举、`designDisposition`、`relations`、`### 正文`、`sourceEntries`/`evidence` 独立栏、Round 的 Decision Changes / Term Changes / Flow Impact / Next Node。覆盖关系改由「过程」+「引用」表达；证据写在 ROUND「背景」。

#### 伪代码

```text
ask(q, recommendation, evidence):
  append ROUND-n waiting
  ROUND.背景 = evidence
  ROUND.问题 = q
  ROUND.方案 = recommendation
  ROUND.回答 = ""
  sync_file()
  return ask_user()

accept(answer):
  ROUND.回答 = answer
  dec.内容 = extract_current_meaning(answer, ROUND.方案)
  dec.过程 = append("ROUND-n 确认" | "ROUND-n 修订")
  dec.引用 += ROUND-n
  ROUND.status = closed
```

#### 问题

- 一份 ROUND 可以形成多个 DEC；一个 DEC 可以引用多份 ROUND。
- `writing.md` / `design-traceability.md` 里 `sourceDecisionIds`、`sourceEntries` 字面量实现时改成指向「引用」；语义不变。

### 功能 4 — 三份 document

#### 流程图

```text
document.md(type)
  上半本标题 + 必有小节
  下半本标题 + 每块四件套
  文末 DEC/DES 覆盖表（仍用 writing.md）
```

#### 接口

`feat/document.md` 必有：产品全景、功能树、开发全景、架构、流程、每功能四件套、DEC/DES 表。原先 1–13 条并入两章，不另保留「按 F 域写一节」。

`refactor/document.md` 必有：Before 全景（含 Before 结构）、不变量、After 架构、迁移流程、每结构块四件套。

`bug/document.md` 必有：问题全景、expected/actual、复现与调查 DES；修复段 before/after 流程、每修复块四件套。问题段禁止修复伪代码。

`questions.md` / `closure.md` 按上半本/下半本覆盖项改写，去掉「下一问 = 最早未闭 F 节点」。

`writing.md` 的 realization view、接口证据深度、影响文件规则并入「每块四件套」；不再要求单独的 realization view 第三套标题，避免和功能节双源。

#### 伪代码

```text
section_complete(block):
  has(流程图) and has(接口) and has(伪代码) and has(问题)
  接口符号有证据或调查 DES
  图与伪代码关系一致
```

#### 问题

- 旧 `writing.md` 很长。落地时把重复的 realization 模板收进类型 document，避免三处各写一套。
- 条件透镜（DDD / 横切）仍是触发才写，不是固定章。

### 功能 5 — 落盘与检查

#### 流程图

```text
上半本确认 ──开发追加──> 四项检查 ──全文确认──> Handoff
                 │
                 失败 → 重开对应功能 ROUND
```

#### 接口

四项检查改为：

1. 当前类型的上半本、下半本覆盖项闭合（原「类型决策树闭合」）。
2. 每个需设计的 DEC 有 DES 或明确不进入设计的理由。
3. 每个 DES 至少引用一个 DEC。
4. 关键图（开发全景、功能流程图）与正文关系一致。

Handoff 仍一次确认全文 + 下一 Skill。上半本确认不是 Handoff。

#### 伪代码

```text
if any(check) fails: reopen(block); return Step 2
set design.md status = confirmed
handoff.ConfirmedBy = ROUND-n
```

#### 问题

- 上半本确认要不要单独 ROUND：要。记一次 ROUND，DEC 写「上半本已确认」，不产生 DES。
- Bug 问题段确认后 Handoff Debug，与 260803 两段式一致。

---

## Preserve

- Plan 仍只映射 DES，确认后 Handoff Env（260813），本任务不加 grill。
- DEC / DES 不可变 ID、supersede、同一任务目录、dev-design 唯一写设计事实。
- 先入库再问、一次一问；eval 信号 `persist-waiting-round`、`ask-one-question` 保留，断言字面跟着新标题改。
- 不升级插件版本，除非用户另说。`plugins/*` 禁止手改；改 skill 后跑 `node scripts/package.platform.mjs`。

## Out of scope

- 历史 `design.log.md` 迁移
- 把 grilling 做成用户命令
- frontier 整轮默认
- Plan / Verify / Review 方法重写
- 自动升级版本号

## DEC / DES 覆盖

| Decision ID | Design disposition | DES IDs / n/a reason |
|---|---|---|
| DEC-001 | required | DES-001 |
| DEC-002 | required | DES-002 |
| DEC-003 | required | DES-003 |
| DEC-004 | required | DES-004 |
| DEC-005 | required | DES-005 |
| DEC-006 | required | DES-006 |
| DEC-007 | required | DES-002, DES-005 |
| DEC-008 | n/a | Plan 本轮不实现 grill |
| DEC-009 | required | DES-007 |

### DES-001 — 共享 grilling 原则

- kind: contract
- statement: `skills/references/grilling-loop.md` 是面试原则单源；`dev-design` 引用它；不新增用户可调 Skill。
- sourceDecisionIds: DEC-001

### DES-002 — 产品段先于开发段

- kind: behavior
- statement: 产品段（或类型上半本）未确认前不得读实现、不得写开发章；开发段按最佳设计写到达路径，对外契约冲突单独 ROUND。
- sourceDecisionIds: DEC-002, DEC-007

### DES-003 — DEC 与 ROUND 日志

- kind: contract
- statement: 新 Log 以 Header、Decisions、ROUND、Handoff 为固定结构；DEC 字段为描述/内容/过程/引用；ROUND 字段为背景/问题/方案/回答。
- sourceDecisionIds: DEC-003

### DES-004 — 三份 document 换骨架

- kind: artifact
- statement: feat/refactor/bug 的 `document.md` 改为上半本+下半本；开发/After/修复的每块必须含流程图、接口、伪代码、问题。
- sourceDecisionIds: DEC-004

### DES-005 — 按确认进度写 design.md

- kind: process
- statement: 上半本确认后才写或公开下半本；每闭合一块追加一节；全文四项检查通过后才请求整份确认。
- sourceDecisionIds: DEC-005, DEC-007

### DES-006 — 提问源改为任务树

- kind: behavior
- statement: `questions.md` 与 SKILL Step 2 不再按 F/B/R 编号生成下一问；这些文件改为上半本/下半本覆盖检查。
- sourceDecisionIds: DEC-006

### DES-007 — 契约测试与 eval 跟随

- kind: verification
- statement: 更新 `hooks/dev-design-contract.test.mjs`、相关 workflow/benchmark/eval 断言，锁新 Log 字段和新的两段流程；保留一次一问与先入库。
- sourceDecisionIds: DEC-009

## Key Decisions

1. **Grill 只服务 Design。** Plan 映射 DES，本轮不加面试。
2. **先产品后开发。** 代码后移到开发段；产品段先达成「设计是什么」。
3. **流程图只出现在开发功能。** 产品侧是功能树，不是流程图。
4. **Log 减到 DEC + ROUND。** 详情在 ROUND；DEC 可单独引用。
5. **三种 document 保留。** 共用落盘顺序，标题按类型。
6. **最佳设计，撞约单问。** 兼容和快不是推荐理由。
7. **一问一答 + 先入库。** 不采用 GitHub frontier 整轮默认。

## 实现切分

1. **原则 + Log 协议 + 测试字面** — `grilling-loop.md`、`grilling.md`、contract tests  
2. **SKILL 两段 + 三份 questions/closure/document + writing.md 去重**  
3. **eval / benchmark 案例 + `package.platform.mjs`**
