---
type: design-doc
topic: nocodehub
date: 260701
author: 3dot141
status: draft
---

# Design: nocodehub — 插件自维护聚合入口

> 骨架说明：本文用 `dev-design-refine` 的 **feat 模板（DDD 域→边→节点变体）**，非通用 design-doc 6 节骨架（背景/目标/架构/实现/方案选型/其他）。本设计对象是命令/工具（无 UI、无数据库、无生产运行时），"域"落为三个命令各自的变更边界，详见「领域划分」节的拆分依据。

## 背景

**核心问题**：nocode-evolve 插件自身的维护动作（新增/融合一条 plugin rule、优化一个 skill、巡检整个插件仓库找漂移）目前散落在 `CLAUDE.md` 的文字规则和 `commands/distill.md` 的 `rules:plugin` 内联逻辑里，靠人记着手动跑。`.agents-personal/`（personalhub）和项目子目录文档（projecthub）都已有聚合入口，插件自身缺一个对等入口。

**触发**：用户直接要求"参考 personalhub 生成一个 nocodehub"。

restate 见 `restate-nocodehub.md`（Define 阶段产出，5 条使用路径 P0-P4 已绑 SC，define-review 交叉审通过）。

## 调研

**代码现状**（Read worktree `/Users/yes365/AI/nocode-evolve-feat-nocodehub`）：

- hub 骨架 [Read commands/personalhub.md:1-86 / commands/projecthub.md:1-102]：frontmatter（`description` 含"聚合入口（hub），分发到 N 个子动作"+ `argument-hint`）→ `## 用法` → `## 子动作路由`（4 列表：子动作/做什么/转发到/独立命令）→ `## 执行`（解析子动作："取 `$ARGUMENTS` 第一个词作为子动作" + 无参/未知子动作输出用法表格 + 批量 `Skill()` 委派 + `status` 内联）。projecthub 额外有「与 personalhub 区别」对照表。
- write 委派模式 [Read commands/personal-distill.md:10-31]：write 类是独立 `commands/*.md`，hub 只转发参数不解析语义。personal-distill 是**双入口**（被 `/distill` 调传结构化候选 / 用户独立调传 NL 意图）。
- 三步联动逻辑 [Read commands/distill.md:237-333]：待抽取的完整逻辑——融合路径（`disposition=融合`，不新增 manifest 条目、不新建文件）+ 三步联动（`disposition=新建`：写 rule 文件 → 改 `manifest.json` 登记 + `generate` → 升 `plugin.json`；三步强制顺序、不回滚、commit 不进本逻辑）。slug 冲突转整合判断。`${NOCODE_EVOLVE_REPO}` 定位跨仓写入，manifest `read` 字段用 `${CLAUDE_PLUGIN_ROOT}`。
- 单文件模式确认 [Bash `ls skills/ | grep -E "personal|project"`]：只命中 `lark-project`（子串误命中）——`personal-*`/`project-*` 全系命令均为单文件 `commands/*.md`，无对应 `skills/` 目录。
- 当前 `plugin.json` version = **5.1.2** [Read .claude-plugin/plugin.json:4]（worktree 版本，晚于会话早期读到的主仓 5.1.1）。

**dream 检测素材** [Read commands/personal-dream.md:14-84]：Scan(`test -e` 实测不凭记忆)→Propose(表格+`AskUserQuestion`多选)→Execute(删除类走护栏二次确认)→完成报告，三段骨架最佳蓝本。4 类客观漂移全部机械可测：`generate.mjs --check`（exit 1=漂移）/`vendor-sync.mjs --check`（exit 1=不一致）/manifest `read` 字段 `test -e`（排除空串/括号说明/`model/` 路径）/`ls rules/*.md` ∖ manifest 登记集合（孤儿，实测当前 0 孤儿，`rules/rule-references/` 目录当前不存在需容错）。SessionStart `hooks/inject-rules.sh:65-66` 已跑 `generate --check` 但只 warn 不修复——dream 互补而非重复。

**已有决策对齐** [Read skills/skill-writing/SKILL.md]：刚性 skill，Entry Routing 三模式（Create/Edit/Description-only），传信号词自判。**关键缺口**：skill-writing 只管 skill 内容本身，全文 grep 零命中 `plugin.json`/`version`/`manifest` 插件维护语义——委托后 plugin-distill 必须自己补版本号联动。`skills/` 目录自动发现，新增 skill 不需注册；仅 workflow 类 skill 需登记 `manifest.json` 的 `workflow_skills`。P8 Package（打包 `.skill` 分发）对本仓无意义——marketplace 直接读 git，可跳过。

**外部方案**：不适用——插件内部命令约定的设计，无外部可比对象，参照对象全在仓库内（已覆盖在上面）。

## 方案选择

### Q1: 三步联动逻辑的单源位置？→ 影响 P4, SC-5

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| **A1. 物理移动**（选定） | `distill.md:237-333` 整段搬进 `plugin-distill.md`，`distill.md` 改成一句委托调用 | 真正单源，SC-5 要求的"distill.md 不再含三步细节"直接满足 | 改动面稍大（distill.md 4 处引用点都要改） |
| A2. 反向引用 | 逻辑留 `distill.md`，`plugin-distill.md` 指过去 | 改动面小 | 委托方向拧巴——`nocodehub write` 反而依赖 `distill`，语义倒置 |

**选 A1**。

### Q2: plugin-distill 的 rule/skill 双轨怎么组织？→ 影响 P1, SC-1a-d

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| **B1. 单命令双分支**（选定） | `plugin-distill` 入口先判 rule 还是 skill（拿不准问用户），rule 走三步联动，skill 委托 `skill-writing` 后自补版本号 | 符合 restate 双轨定义，hub 只转发不解析 | 一个命令两分支，文件稍长 |
| B2. 拆两处 | skill 类在 `nocodehub write` 层直接路由 `skill-writing`，plugin-distill 只管 rule | 各自单一职责 | `nocodehub` 要解析语义，违反 hub"只转发"惯例；两处入口分散 |

**选 B1**。

### Q3: plugin-dream 的检测载体？→ 影响 P2, SC-2

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| **C1. 纯 markdown 编排**（选定） | `plugin-dream.md` 写清 Scan 跑哪些：`generate --check` + `vendor-sync --check`（现成命令）+ inline node 查 manifest 路径/孤儿 + agent 读文件做语义判断 | 零新增维护物，仿全系 `*-dream` 惯例 | manifest 检测那段是 inline 而非固化脚本，可测性略弱于脚本 |
| C2. 配套 scan 脚本 | 新增 `scripts/plugin-dream-scan.mjs` 固化检测输出 JSON | 可测性强 | 新增维护物 + 要写 `.test.mjs` + 违反纯 markdown 惯例 + YAGNI（O1/O2 本就是现成命令） |

**选 C1**。

### Q4: dream 的检测范围——只测客观漂移，还是也测"是否符合边界和预期"？→ 影响 P2, 约束.4（Design 阶段决策，用户指令覆盖，见下）

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| D1. 只测客观漂移（restate 原定，约束.4） | dream 仅 O1-O4 机械检测 | 范围小，实现快，无语义误报风险 | 用户在 Design 阶段明确指出不够——rule 重复、skill 是否符合原理/调用正确/专业性都测不出 |
| **D2. 两层检测（选定）** | Layer 1 客观 4 项 + Layer 2 语义 19 项（按对象类型 rule/skill/command/通用拆分） | 覆盖用户要求的边界符合性检查，且每项单文件级判据 + 建议式修复控制膨胀风险 | 19 项语义检测无量化验证手段（见「验证策略汇总」不测项） |

**选 D2**——本条与 Q1-Q3 不同：不是纯技术权衡，是用户在 Design 阶段review 现场直接推翻了 restate 约束.4 的既有决定（"仅限启发式，不做语义级判断"），D1 是原定方案而非我方推荐的"备选"。详见「回检 restate」节的 supersede 记录。

## 领域划分 + 总图

### 拆分思路

```
"生成插件自维护聚合入口" → 三个各自独立可调用的命令
  → 聚合路由怎么转发 → nocodehub 域
  → rule/skill 怎么写入 → plugin-distill 域
  → 全仓怎么巡检 → plugin-dream 域
```

变更独立性验证：

```
加新 hub 子动作 → 只改 nocodehub 路由表 → plugin-distill/dream 不动 ✓
改三步联动细节（如 manifest schema 变了）→ 只改 plugin-distill → nocodehub/dream 不动（dream 的 O3 检测逻辑跟着 manifest schema 走，是引用不是耦合）✓
加新 dream 检测项 → 只改 plugin-dream → nocodehub/distill 不动 ✓
```

三个域没有共享可变状态，域间只有单向委派/建议关系——拆分成立。

### 域清单

| 域 | 核心职责 | 路径 ID 范围 |
|---|---|---|
| nocodehub 域 | 聚合路由 + status 内联 | 插件维护.P0, P3 |
| plugin-distill 域 | rule/skill 双轨写入（三步联动 + 融合路径 + skill 委托） | 插件维护.P1, P4 |
| plugin-dream 域 | 客观漂移 + 边界符合性两层巡检 | 插件维护.P2 |

### 总图（域间关系）

```
┌─────────────┐  委派 write   ┌──────────────────┐
│  nocodehub   │ ────────────→ │  plugin-distill   │
│   (聚合路由)  │  委派 dream   │  (rule/skill写入) │
│  [P0, P3]    │ ──┐           └─────────┬─────────┘
└──────────────┘   │                     │ skill 分支委托
                    │                     ↓
                    │           ┌──────────────────┐
                    │           │  skill-writing    │ (既有 skill，域外)
                    │           └──────────────────┘
                    ↓
          ┌──────────────────┐  Layer2 建议式修复
          │  plugin-dream     │ ─────────────────→ plugin-distill / skill-writing
          │  (漂移+边界巡检)  │
          │  [P2]             │
          └──────────────────┘

┌──────────────┐  legacy 委派  ┌──────────────────┐
│ distill.md   │ ────────────→ │  plugin-distill   │  [P4，跨域路径]
│ (rules:plugin)│              └──────────────────┘
└──────────────┘

约束.1: nocodehub 只转发不写业务逻辑
约束.2/.3: 三步联动须遵守 CLAUDE.md 规则2/3
约束.5: 全系判据现读 ${NOCODE_EVOLVE_REPO}/CLAUDE.md，不摘抄固化
```

## 架构设计

无前端/数据库/网络服务——这是插件内命令文件间的调用关系，"架构"落为文件 + 脚本的调用图。

```
┌───────────────────────────────────────────────────────┐
│                    commands/                             │
│                                                          │
│  ┌───────────────┐        ┌──────────────────┐        │
│  │ nocodehub.md   │───────→│ plugin-distill.md │        │
│  │ (NEW,聚合)     │        │ (NEW,写入)         │        │
│  └───────┬───────┘        └─────────┬──────────┘        │
│          │                          │ 判 rule/skill      │
│          │                    ┌─────┴──────┐            │
│          ↓                    ↓            ↓            │
│  ┌───────────────┐    ┌──────────┐  Skill(skill-writing) │
│  │ plugin-dream.md│    │ rule 三步│                       │
│  │ (NEW,巡检)     │    │ 联动     │                       │
│  └───────┬───────┘    └────┬─────┘                       │
│          │                 │                              │
│          │                 ↓                              │
│          │         rules/manifest.json (改)                │
│          │         rules/rule-<slug>.md (NEW)              │
│          │         .claude-plugin/plugin.json (改,升版本)  │
│          │                                                │
│  ┌───────┴────────────────────────────┐                  │
│  │  跑现成校验脚本(不改动,只读检测)      │                  │
│  │  hooks/generate.mjs --check         │                  │
│  │  scripts/vendor-sync.mjs --check    │                  │
│  └─────────────────────────────────────┘                  │
│                                                            │
│  commands/distill.md (改：rules:plugin 分支改委托调用)      │
└───────────────────────────────────────────────────────┘
```

**调用链**：用户键入 `/nocodehub <sub-action>` → nocodehub 解析子动作 → `Skill()` 委派到 plugin-distill 或 plugin-dream（或 status 内联执行）→ 各自读写目标文件（`rules/*.md`、`skills/*/SKILL.md`、`rules/manifest.json`、`.claude-plugin/plugin.json`）→ 跑校验脚本确认零漂移 → 报告结果，等用户 review/commit。

## 系统交互场景设计（边）

> 无 UI，"表现层"变为"系统调用链"——每个场景是一次命令调用的完整链路，不是前端交互。

### 端到端调用链总图

```
用户键入命令
  ↓
[P0] 无参/未知子动作
  ↓ 有效子动作
  ├─ write  → [P1] plugin-distill 判类 → rule三步联动 / skill委托
  ├─ dream  → [P2] plugin-dream 两层扫描 → 候选清单 → 用户勾选 → 执行修复
  └─ status → [P3] 内联汇总展示

独立入口（不经 nocodehub）：
  /distill 识别 rules:plugin 候选 → [P4] 委托 plugin-distill
```

### 场景 P0：用法发现

**调用流程**：
```
/nocodehub                     （无参）
/nocodehub foobar               （未知子动作）
  ↓
NocodeHub.route() 解析 $ARGUMENTS 第一词
  ↓
未匹配 write/dream/status
  ↓
输出用法表格（纯文本缩进列表，仿 personalhub:32-44）
```

**消费接口**：无外部调用，纯本地解析。

**文件影响**：`commands/nocodehub.md` 内联逻辑，无独立文件。

**验证**：走查——`/nocodehub` 和 `/nocodehub foobar` 均输出用法表格（TO-1）。

### 场景 P1：write 新增/优化 rule 或 skill

**调用流程**：
```
/nocodehub write <描述>  或  /plugin-distill <描述>
  ↓
PluginDistill.route() 判类（结构化候选带 disposition / NL 意图判信号词）
  ↓
拿不准 → AskUserQuestion(['rule','skill','两者都涉及'])   [SC-1a]
  ↓
├─ rule  → RuleBranch（三步联动 或 融合路径）              [SC-1b, SC-1c]
└─ skill → SkillBranch（委托 skill-writing，自补版本号）   [SC-1d]
  ↓
报告：版本变化 x→y + "请 review + commit，push 需询问"
```

**消费接口**：`Skill(nocode-evolve:skill-writing)`（skill 分支）；本地文件读写（rule 分支）。

**文件影响**：`rules/rule-<slug>.md`（NEW，rule 新建时）/ `rules/manifest.json`（改，登记或改条目）/ `.claude-plugin/plugin.json`（改，升版本）/ `skills/<name>/SKILL.md`（改或 NEW，委托 skill-writing 产出）。

**验证**：走查两个 GWT——新建不存在 slug（验证写文件+manifest+generate+版本 minor）、slug 冲突（验证转整合判断融进已有 rule 不新建）。

### 场景 P2：dream 全仓巡检

**调用流程**：
```
/nocodehub dream  或  /plugin-dream
  ↓
Layer 1 客观扫描：O1(generate --check) + O2(vendor-sync --check) + O3(manifest失效路径) + O4(孤儿rule)
  ↓
Layer 2 语义扫描：rule对象 R1-R7 + skill对象 S1-S8 + command对象 C1-C2 + 通用 G1-G2
  ↓
候选清单表 | # | 对象 | 检测 | 动作 | 理由 |
  ↓
AskUserQuestion 多选勾选
  ↓
执行：自动类(O1/O2重跑) / 护栏类(O3/O4删除二次确认) / 建议式(Layer2委托plugin-distill或skill-writing)
  ↓
完成报告 + 更新（若涉及）
```

**消费接口**：`node hooks/generate.mjs [--check]` / `node scripts/vendor-sync.mjs [--check]` / 建议式修复时 `Skill(nocode-evolve:plugin-distill)` 或 `Skill(nocode-evolve:skill-writing)`。

**文件影响**：视用户勾选而定，可能触达 `rules/*.md`、`rules/manifest.json`、`skills/*/SKILL.md`（均通过委托 plugin-distill/skill-writing 间接改动，dream 本身不直接写业务文件，除 O3/O4 的直接护栏删除操作）。

**验证**：走查——人工制造漂移案例（manifest 里加一条指向不存在文件的 rule）验证 O3 被扫出；人工制造语义问题（空 description 的 skill）验证 S4 被扫出。

### 场景 P3：status 总览

**调用流程**：
```
/nocodehub status
  ↓
读 plugin.json version + manifest.json rule 数 + skills/ 目录数（精确校验）
  ↓
跑 vendor-sync --check + generate --check + node --test hooks（展示级，不强制精确匹配）
  ↓
渲染输出（仿 personalhub status 格式）
```

**消费接口**：本地文件读取 + 只读校验命令，无写操作。

**文件影响**：无，纯读取展示。

**验证**：走查——版本号/rule 数/skill 数与实际文件内容比对一致。

### 场景 P4：legacy /distill 委托

**调用流程**：
```
/distill 识别到 rules:plugin 候选
  ↓
用户勾选执行
  ↓
distill.md 不再内联三步联动 → Skill(nocode-evolve:plugin-distill) 传候选
  ↓
plugin-distill 按候选 disposition 走融合或三步联动（同 P1 rule 分支）
```

**消费接口**：`Skill(nocode-evolve:plugin-distill)`。

**文件影响**：`commands/distill.md`（改，4 处引用点：出口一览表 line 33 / 出口说明段 line 198-200 / 三步联动主段 line 237-333 替换为委托说明 / 报告示例段的措辞对齐）。

**验证**：走查两 GWT（同 P1），确认 `/distill` 端到端行为与抽取前一致——这是 SC-5 的核心验证点。

## 领域层设计（节点）

### nocodehub 域

**核心职责**：解析子动作 + 转发，`status` 内联执行。不写业务逻辑（约束.1）。

**域内结构**：

```
┌──────────────────────────────────┐
│           nocodehub 域             │
│                                  │
│  ┌────────────────┐             │
│  │ route()         │             │
│  │ 解析$ARGUMENTS  │             │
│  └───┬────┬────┬───┘             │
│      │    │    │                 │
│      ↓    ↓    ↓                 │
│   write dream status(内联)        │
└──────────────────────────────────┘
```

**BF7 — 路由**：

```
function NocodeHub.route(args):
  [subAction, ...rest] = parseFirstToken(args)      // 取 $ARGUMENTS 第一个词，仿 personalhub:28-30
  switch subAction:
    case 'write':                                    // 转发 plugin-distill
      return Skill('nocode-evolve:plugin-distill', rest)
    case 'dream':                                     // 转发 plugin-dream
      return Skill('nocode-evolve:plugin-dream', rest)
    case 'status':
      return renderStatus()                           // 内联，见 BF8
    default:                                           // 无参或未识别
      return renderUsageTable()                        // SC-4
```

**BF8 — status 内联**：

```
function renderStatus():
  version = Read('.claude-plugin/plugin.json').version         // 精确校验 (SC-3)
  ruleCount = Read('rules/manifest.json').rules.length          // 精确校验 (SC-3)
  skillCount = countDirs('skills/*/SKILL.md')                    // 精确校验 (SC-3)
  vendorOk = exec('node scripts/vendor-sync.mjs --check').ok     // 展示级，人工核验
  testOk = exec("node --test 'hooks/*.test.mjs'").allPass        // 展示级
  driftOk = exec('node hooks/generate.mjs --check').ok           // 展示级
  return render({version, ruleCount, skillCount, vendorOk, testOk, driftOk})
```

**域级接口**：

对内委派：

| 子动作 | 委派到 |
|---|---|
| `write` | `Skill(nocode-evolve:plugin-distill)` |
| `dream` | `Skill(nocode-evolve:plugin-dream)` |
| `status` | 内联（本域） |

**域文件影响**：

```
commands/
  └── nocodehub.md              (NEW)  路由表 + status 内联
```

**域验证**：走查 TO-1（无参/未知）+ TO-5（status 精确性）。

**安全/性能**：无外部输入、无认证、无高负载——跳过。

---

### plugin-distill 域

**核心职责**：rule/skill 双轨写入（三步联动、融合路径、skill 委托），承接 `distill.md` 抽取的完整逻辑 + `nocodehub write` 委派 + 独立调用。

**域内结构**：

```
┌───────────────────────────────────────────────┐
│              plugin-distill 域                   │
│                                                 │
│  ┌──────────┐                                 │
│  │ route()   │  判 rule/skill（BF1）             │
│  └─┬────┬───┘                                 │
│    │    │                                     │
│    ↓    ↓                                     │
│ ┌──────┐ ┌───────────┐                        │
│ │RuleBr│ │SkillBranch │                        │
│ │anch  │ │ (BF3)      │──→ Skill(skill-writing) │
│ │(BF2) │ └───────────┘                        │
│ └──┬───┘                                       │
│    │                                           │
│    ├─ 融合路径 ──→ Read目标+Merge+条件性manifest │
│    └─ 三步联动 ──→ 写文件→改manifest+generate→升版本│
└───────────────────────────────────────────────┘
```

**BF1 — 入口分类**：

```
function PluginDistill.route(input):
  if input.disposition given:                        // 被 /distill 调用，候选已带 disposition
    // disposition 实际格式是 "融合→<现有文件路径>" 或 "新建"（distill.md 候选 schema），
    // 不是裸 "融合"——必须解析前缀 + 提取 target，精确相等判断会丢掉 target（Review C1）
    if input.disposition.startsWith('融合'):
      classify = 'fuse'
      fuseTarget = parseFuseTarget(input.disposition)   // 提取 "→" 后的现有文件路径
    else:
      classify = 'rule-new'
  else:                                                // 独立调用，NL 意图
    signal = detectIntent(input.description)           // 关键词判断：rule / skill / 模糊
    if signal == 'ambiguous':
      classify = AskUserQuestion(['rule','skill','两者都涉及'])   // 拿不准问用户（SC-1a，不猜测）
    else:
      classify = signal
  if classify in ['rule-new','fuse']:
    return RuleBranch.execute(input, classify)         // BF2
  else:
    return SkillBranch.execute(input)                  // BF3
```

**BF2 — RuleBranch（融合路径 + 三步联动，搬自 `distill.md:237-333`，A1 物理移动）**：

```
function RuleBranch.execute(input, classify):
  if classify == 'fuse':
    target = input.fuseTarget ?? resolveFuseTarget(input)  // 优先用 BF1 解析出的 target（disposition 场景）；
                                                              // NL 独立调用场景现场解析（顶层 rule-<x>.md 或 rule-references/<x>/<子文件>.md）
    body = Read(target)
    merged = mergeIntoSection(body, input.body)         // 融进合适章节,不是末尾paste
    Write(target, merged)
    if scopeExpanded(input):                            // 本次融合扩了触发范围
      updateManifestTriggers(target.slug, input.triggers)  // 改manifest里那条,不新增条目
      exec('node hooks/generate.mjs')                    // 重新生成catalog分片
    bumpVersion(scopeExpanded(input) ? 'minor' : 'patch') // 判据读 CLAUDE.md 规则2(约束.5)
    return report('融进', target, versionDelta)
  else:  // rule-new
    slug = deriveSlug(input)
    if manifestHasSlug(slug):                            // slug冲突不abort
      return AskUserQuestion(['fuse existing rule-'+slug, 'rename and create new'])  // 转整合判断
    filePath = `${NOCODE_EVOLVE_REPO}/rules/rule-${slug}.md`
    Write(filePath, input.body)                           // Step1: 写rule文件
    appendManifestEntry({                                 // Step2a: 登记(read用${CLAUDE_PLUGIN_ROOT})
      id: slug, bucket: input.bucket,
      trigger_desc: input.triggerDesc,                     // 必须具体可自判,不写"需要时读"
      read: `\${CLAUDE_PLUGIN_ROOT}/rules/rule-${slug}.md`,
      summary: input.summary
    })
    exec('node hooks/generate.mjs')                        // Step2b: 重新生成catalog分片
    exec('node hooks/generate.mjs --check')                // 验零漂移
    bumpVersion('minor')                                    // Step3: 升版本(约束.5读CLAUDE.md判据)
    return report('已写入', filePath, versionDelta)          // 含review+commit+询问push提醒(QualityBar)
```

三步契约（沿用 `distill.md:306-311`）：**必须按顺序**，任一步失败后续不执行；**三步内不回滚已成功步**（半成品文件保留比删了更易恢复）；commit/push 不进本逻辑。

**BF3 — SkillBranch**：

```
function SkillBranch.execute(input):
  signalWord = deriveSignalWord(input)                    // 'create a skill'/'improve this skill'/'fix trigger accuracy'
  result = Skill('nocode-evolve:skill-writing', input.intent + signalWord)  // 传信号词,让其Entry Routing自判(SC-1d)
  // skill-writing走到P7描述优化收敛即可,P8 Package对本仓无意义(marketplace直读git),明确跳过
  if !result.filesChanged:                                 // gate: 委托中止/用户放弃/无实际改动 → 不升版本(Review W1)
    return report('skill未改动(用户中止或无变更)')
  bumpVersion('minor')                                      // 关键: skill-writing不碰plugin.json,这里必须自补(探索确认的缺口)
  return report('skill已更新', result.skillPath, versionDelta)
```

**域级接口**：

对外（被两处调用，双入口）：

| 调用方 | 输入形态 |
|---|---|
| `/distill` rules:plugin 出口 | 结构化候选 `{summary, disposition, target, body, ...}` |
| `nocodehub write` / 独立 `/plugin-distill` | NL 意图描述 |

数据契约：manifest rule 条目实际 schema 比 `distill.md:276-286` 文档化的三步联动模板更完整（Review W4 核实，`rules/manifest.json` 抽样条目为证）——`{id, bucket, also_buckets[], trigger_type, trigger_desc, triggers[], action, read, summary, guard, depends_on[], severity, lifecycle_stage, pretooluse[]}`。三步联动写新条目时**必填** `id/bucket/trigger_desc/read/summary`（对齐既有 distill.md 行为，不扩大改动面），`also_buckets/triggers/depends_on/pretooluse` 缺省为空数组，`trigger_type`/`action`/`severity`/`lifecycle_stage` 缺省留空或按新增内容合理推断（非本次抽取范围要修的既有 gap，此处如实标注不再假装字段列表已完整）。

对内委托：`Skill(nocode-evolve:skill-writing)`（skill 分支）。

**域文件影响**：

```
commands/
  └── plugin-distill.md          (NEW)  BF1-BF3 完整逻辑
  └── distill.md                 (改)   ① 出口表 line 33 措辞对齐
                                        ② line 198-200 出口说明改指向委托
                                        ③ line 237-333 三步联动主段替换为"委托 Skill(plugin-distill)"说明
                                        ④ line 220-224/315-320 报告示例段措辞对齐（与文件影响汇总一致，Review W6）
rules/
  └── rule-<slug>.md              (NEW,运行时产出,非本次构建)
  └── manifest.json                (改,运行时产出)
.claude-plugin/
  └── plugin.json                  (改,运行时产出 + 本次构建自身也需按CLAUDE.md规则2升版本)
```

**域验证**：走查两 GWT（新建 slug / slug 冲突融合）+ `generate --check` 零漂移。

**安全**：写文件路径均来自 `${NOCODE_EVOLVE_REPO}`/`${CLAUDE_PLUGIN_ROOT}` 变量而非用户直接拼接路径，无路径穿越风险（沿用 distill.md 既有约定）。

---

### plugin-dream 域

**核心职责**：两层巡检——Layer 1 客观漂移（机械可测） + Layer 2 边界符合性（语义判断，按对象类型拆分）。

**域内结构**：

```
┌─────────────────────────────────────────────┐
│              plugin-dream 域                   │
│                                               │
│  ┌───────────────┐   ┌──────────────────┐   │
│  │ scanObjective()│   │ scanSemantic()     │   │
│  │  O1-O4 (BF4)   │   │ R1-7,S1-8,C1-2,G1-2│   │
│  └───────┬───────┘   │  (BF5)             │   │
│          │            └─────────┬──────────┘   │
│          └──────────┬───────────┘              │
│                      ↓                          │
│              ┌───────────────┐                 │
│              │ proposeAndExec │  (BF6)           │
│              │ ute()          │                 │
│              └───────────────┘                 │
└─────────────────────────────────────────────┘
```

**Layer 1 客观漂移检测（4 项，全机械，跑现成命令）**：

| ID | 检测 | 命令/判据 | 修复类型 |
|---|---|---|---|
| O1 | 生成物漂移 | `node hooks/generate.mjs --check` exit 1 | 自动：重跑 `generate.mjs` |
| O2 | vendor 漂移 | `node scripts/vendor-sync.mjs --check` exit 1 | 自动：重跑 `vendor-sync.mjs` |
| O3 | manifest 失效路径 | 遍历 `read` 字段 `test -e`（排除空串/括号说明串/`model/`路径） | 护栏：补文件或删条目（二次确认） |
| O4 | 孤儿 rule | `ls rules/*.md` ∖ manifest `read` 登记集合 | 护栏：登记或删除（二次确认） |

**Layer 2 边界符合性检测（19 项，语义，agent 读文件对照规范）**：

*rule 对象（7 项）*：

| ID | 检测 | 依据 |
|---|---|---|
| R1 | 重复/重叠：rule 间职责/触发是否重叠 → 该融合没融合 | `distill.md` 融合优先，防 catalog 膨胀 |
| R2 | 触发质量：`trigger_desc` 是否具体可自判命中 | 约定"不写'需要时读'" |
| R3 | 触发负例：`trigger_desc`/`triggers` 有无负例划边界 | catalog 已有负例模式 |
| R4 | summary 时效：manifest `summary` 是否仍准确反映 rule 文件当前内容 | rule 改了 summary 没跟 |
| R5 | 字段完整：`id/bucket/trigger_desc/read/summary` 齐全，`bucket` 在 `buckets` 定义内 | manifest schema |
| R6 | read 路径规范：**仅对 rule 文件型 `read`** 检查是否用 `${CLAUDE_PLUGIN_ROOT}` 前缀；空 `read`（如 dev-finish-branch 走 `action` 不走 `read`）、括号说明串（如 red-blue-deep 的 `(skill, 无 rule 文件)`）、`model/` 路径（如 personal-deletion-guard 指向 `model/agent-personal.md`）**不算违规，跳过检测**（Review W5，与 O3 的排除逻辑一致） | 路径约定 |
| R7 | 模式边界：是当前指令，文件名不含日期、不含历史叙述 | `distill.md` 反模式 |

*skill 对象（8 项）*：

| ID | 检测 | 依据 |
|---|---|---|
| S1 | 符合原理：单一职责、有 Enter/Exit Gate、刚性/弹性标注 | skill-writing 设计原则 |
| S2 | 调用正确：委派/handoff 链成立，引用的 skill/命令存在不悬空 | 跨 skill 引用完整性 |
| S3 | 专业/非空壳：内容非敷衍占位 | skill-writing 质量 |
| S4 | description 触发准确：`Use when` + 反例齐全 | skill-writing Phase7 |
| S5 | Step 编号规范：整数或字母后缀，禁分数编号 | **CLAUDE.md 规则5** |
| S6 | workflow 防跳步登记：workflow 类 skill 登记在 `manifest.workflow_skills` | 防跳步 Hook A |
| S7 | 引用路径有效：`{NOCODE_SKILL_REF}`/references/rule 文件不悬空 | 引用完整性 |
| S8 | 硬交接完整：workflow skill 末步有 handoff 调下一阶段 | `agent-catalog-using`「进了 skill 就走完」 |

*command 对象（2 项）*：C1 命名惯例（`*hub`/`*flow`/`xx-yy`）/ C2 模式边界（hub 只转发不写业务逻辑）。

*通用（2 项）*：G1 版本联动（改插件加载文件但 `plugin.json` 没升）/ G2 内容 stale（引用路径/机制已变没更新）。

**BF4 — Layer 1 客观扫描**：

```
function PluginDream.scanObjective():
  o1 = exec('node hooks/generate.mjs --check')                       // exit1=漂移
  o2 = exec('node scripts/vendor-sync.mjs --check')                  // exit1=不一致
  o3 = manifest.rules
        .filter(r => r.read && !r.read.startsWith('('))               // 排除括号说明串(如red-blue-deep)
        .filter(r => r.read.includes('/rules/'))                      // 排除model/路径(如personal-deletion-guard)
        .filter(r => !fileExists(resolveVar(r.read)))                  // test -e失败即漂移
  o4 = listFiles('rules/*.md')                                          // 孤儿=实际文件∖manifest登记(路径归一化后diff)
        .map(f => normalizeToRelative(f))                                // 'rules/rule-x.md' 形态
        .diff(manifest.rules
               .map(r => r.read)
               .filter(read => read && !read.startsWith('('))            // 排除括号说明串
               .map(read => normalizeToRelative(resolveVar(read))))      // ${CLAUDE_PLUGIN_ROOT}/rules/rule-x.md → rules/rule-x.md
                                                                            // 同 O3 的 resolveVar，两处路径解析必须一致(Review W2：先前版本漏了此步，会把全部rule误判为孤儿)
  return [o1, o2, ...o3, ...o4].filter(isDrift).map(toCandidate)
```

**BF5 — Layer 2 语义扫描**：

```
function PluginDream.scanSemantic():
  ruleFindings = manifest.rules.flatMap(r => checkR1toR7(r))          // 单文件级判据,不跨文件推理
  skillFindings = listSkillDirs().flatMap(s => checkS1toS8(s))        // S1-S3深度判断只读委托skill-writing评估
  commandFindings = listCommands().flatMap(c => checkC1C2(c))
  generalFindings = checkVersionLinkage_G1() + checkContentStale_G2()
  return [...ruleFindings, ...skillFindings, ...commandFindings, ...generalFindings].map(toCandidate)
```

**BF6 — Propose + Execute（仿 `personal-dream.md:14-84` 三段骨架）**：

```
function PluginDream.run():
  candidates = scanObjective() + scanSemantic()                       // Scan
  if candidates.isEmpty():
    return report('状态良好')
  table = renderCandidateTable(candidates)                            // | # | 对象 | 检测 | 动作 | 理由 |
  selected = AskUserQuestion(table, multiSelect=true)                 // Propose
  for c in selected:                                                  // Execute
    if c.kind == 'auto':      exec(c.fixCommand)                      // O1/O2
    elif c.kind == 'guarded':  confirmDeletion(c) && apply(c)          // O3/O4,删除护栏二次确认
    elif c.kind == 'suggest':  delegate(c)                             // Layer2:委托plugin-distill(rule)或skill-writing(skill)
  return report(executed, skipped)
```

**域级接口**：

对内委托：`Skill(nocode-evolve:plugin-distill)`（rule 类语义修复）/ `Skill(nocode-evolve:skill-writing)`（skill 类语义修复）。

对外调用：`node hooks/generate.mjs [--check]` / `node scripts/vendor-sync.mjs [--check]`（只读检测部分）。

**域文件影响**：

```
commands/
  └── plugin-dream.md            (NEW)  BF4-BF6 完整逻辑,含23项检测矩阵
```

**域验证**：走查——人工制造 O3 案例（manifest 加一条指向不存在文件的 rule）验证扫出；人工制造 S4 案例（空 description 的 skill）验证扫出。

**安全**：O3/O4 及 Layer2 涉及删除的修复动作走 `.agents-personal`/rule 文件删除同等护栏（回显路径+原因+影响，二次确认）。无外部输入/认证/敏感数据。

**性能**：Layer 2 单文件级判据、不跨文件推理，保证结论可复现；23 项全跑可能较重，允许按对象类型分组跑（仿 `project-dream` >3 项走并行 subagent 的模式，本次不强制）。

## 文件影响汇总

```
commands/
  ├── nocodehub.md               (NEW)  nocodehub 域，路由表+status内联
  ├── plugin-distill.md          (NEW)  plugin-distill 域，rule/skill双轨写入
  ├── plugin-dream.md            (NEW)  plugin-dream 域，两层23项检测
  └── distill.md                 (改)   ① 出口表line33 ② 出口说明line198-200 ③ 三步联动主段line237-333改委托 ④ 报告示例措辞对齐

rules/manifest.json               (改,运行时)   plugin-distill rule分支产出
rules/rule-<slug>.md              (NEW,运行时)  plugin-distill rule分支产出
skills/<name>/SKILL.md            (改/NEW,运行时) plugin-distill skill分支委托skill-writing产出
.claude-plugin/plugin.json        (改)   ① 本次构建自身按CLAUDE.md规则2升版本(minor:新增3命令)
                                          ② 运行时:write/dream触发的后续版本变化(非本次构建范围)

合计（本次构建静态文件）：3 NEW + 2 改（distill.md + plugin.json）
```

## 验证策略汇总

> 命令是 markdown 文件，无单测可跑，验证以端到端走查为主 + 现有一致性 check 兜底。各域内单元验证见各域小节。

| TO | 覆盖路径 | 覆盖约束 | 层级 | 说明 |
|---|---|---|---|---|
| TO-1 | 插件维护.P0 | 约束.1 | 走查 | `/nocodehub` 无参/未知子动作 → 用法表格 (SC-4) |
| TO-2 | 插件维护.P1 | 约束.2, .5 | 走查 | `write` 判 rule → 三步联动 (SC-1a/b/c) |
| TO-3 | 插件维护.P1 | — | 走查 | `write` 判 skill → 委托 skill-writing + 自补版本 (SC-1d) |
| TO-4 | 插件维护.P2 | 约束.4(superseded) | 走查 | `dream` 两层23项检测 → 候选清单 → 勾选修复 (SC-2) |
| TO-5 | 插件维护.P3 | — | 走查 | `status` 版本/rule数/skill数精确一致 (SC-3) |
| TO-6 | 插件维护.P4 | 约束.2 | 走查+GWT | `/distill` 委托 plugin-distill；两 GWT 不回归 (SC-5) |
| TO-7 | 全局 | 约束.2, .3 | check | `generate --check` 零漂移 + `node --test hooks/*.test.mjs` 全过 (Quality Bar) |

**不测项**：dream Layer 2 语义判断的"准确率"不做量化测试（语义判断无金标准），只验"能扫出人工制造的明显问题"。风险：语义误报/漏报，接受——建议式修复由用户把关，不自动执行。

**路径覆盖状态**：P0-P4 + 约束.1/.2/.3/.5 全部 ✅（详见 restate 及 scratchpad 设计草稿的覆盖状态表）。

## 回检 restate — 约束.4 supersede

Design 阶段用户明确要求推翻 restate 约束.4（"dream skill 检测仅限启发式，不做语义级判断"）——用户要求 skill 检测覆盖"是否符合原理 / 调用是否正确 / 是否专业"（对应 Layer 2 的 S1/S2/S3，均为语义判断）。

**处理**：约束.4 标记 **superseded**（被本设计文档的 Design 决策取代），dream Layer 2 明确包含语义判断，但每项给单文件级判据 + 建议式修复（不自动改）以控制此前担心的"膨胀成复杂审计器"的风险。SC-2 相应从"4 类客观漂移"演进为"23 项（客观4 + 语义19）"。

## 发布注意事项

> 本仓无生产运行时（marketplace 直接读 git），无需部署/监控设计，只需版本与发布纪律。

- **版本策略**：本次构建新增 3 个命令文件 + 改动 `distill.md` = 插件更新，按 CLAUDE.md 规则2 属于"新增 skill/hook/兼容性增强" → **minor**。构建完成后 Read/Write `.claude-plugin/plugin.json` 一次性升版本（不是每个 write/dream 运行时都升——那是运行时行为，已在各域 BF 里覆盖）。
- **commit 边界**：`nocodehub`/`plugin-distill`/`plugin-dream` 命令运行时（用户实际使用这些命令时）Never 自动 commit/push——这是两层边界（见 restate 约束.5 的澄清），与"本次实现任务完成后按 CLAUDE.md 规则1 收尾 commit"是两回事，不冲突。
- **权威依据**：全系判据现读 `${NOCODE_EVOLVE_REPO}/CLAUDE.md` 原文，本文档不摘抄固化其内容（约束.5）。
- **回归风险**：`distill.md` 抽取是本次改动的最高风险点（SC-5）——Build 阶段需对两个 GWT（新建/融合）逐条走查，不能只看代码"看起来对"。

## Review Log

**Round 1**（260701）：双路异源交叉审查——Claude general-purpose subagent（checklist，reviewer-template 7 维度）+ Codex（red-blue-adversarial，同一准则，CLAIM 剥离）。分档：重档（跨模块 + 含架构/选型决策）。

**Findings 归一**（按 `[location, axis]` 去重，交集标高置信）：

| id | 来源 | severity | 摘要 | 处置 |
|---|---|---|---|---|
| C1 | 红军(Codex) | Critical | BF1 disposition 精确匹配 `=='融合'`，实际候选格式是 `融合→<target>`，会丢 target | ✅ fixed |
| W1 | 红军+蓝军（双源交集） | Warning | BF3 SkillBranch 无条件升版本，未 gate 在"确有改动"上 | ✅ fixed |
| W2 | 红军+蓝军（双源交集） | Warning | BF4 O4 孤儿检测缺路径归一化，会把全部 rule 误判孤儿（与"调研 0 孤儿"矛盾） | ✅ fixed |
| W3 | 蓝军（已核实为真） | Warning | scratchpad restate 是过期版本，文档大量 cross-ref（P0/P4/SC-1a-d/约束.4-.5）找不到对应 | ✅ fixed（重写 restate scratchpad） |
| W4 | 红军（已核实：既有 gap） | Warning | manifest 写入字段列表不完整，比实际 schema 少 6 个字段 | ✅ fixed（补字段说明 + 标注继承 gap） |
| W5 | 红军 | Warning | R6 read 路径规范检查误伤空 read/说明串/model 路径 | ✅ fixed |
| W6 | 蓝军 | Warning | distill.md 改动点数目矛盾（3 vs 4） | ✅ fixed（补第④点） |
| W7 | 蓝军 | Warning | Q4 破坏 Q1-Q3 的 Q→选项→定 格式 | ✅ fixed（补对比表 + 说明用户指令覆盖） |
| S1-S6 | 双路 | Suggestion | 否决理由量化/BF编号顺序/dream验证深度/术语精度/无Out of Scope节 等 | 用户决定跳过（不影响正确性，留后续迭代） |
| Q1 | 红军（已核实：既有约定） | Open Question | `${NOCODE_EVOLVE_REPO}` 全仓无显式定义来源 | 不算本次缺陷，非阻塞 |

**用户决定**：C1 + W1-W7 全修，Suggestion 全部跳过。

**修订摘要**：BF1 改为解析 `disposition` 前缀提取 target；BF2 融合分支复用解析出的 target；BF3 增加 `filesChanged` gate；BF4 O4 检测增加双向路径归一化；manifest 数据契约补齐实际字段并标注哪些是继承自 distill.md 的既有 gap；R6 增加排除条件；distill.md 文件影响补第④处报告示例段；Q4 补 D1/D2 对比表；重写 `restate-nocodehub.md` scratchpad 为最终确认版（含 P0-P4/SC-1a-d/约束.4-.5）。

**Verdict（Round 1 后）**：无未处置 Critical，approved=true，可进入 Plan 阶段。
