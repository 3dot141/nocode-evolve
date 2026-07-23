# nocodehub Implementation Plan

**Goal**: 新建 `commands/nocodehub.md` + `plugin-distill.md` + `plugin-dream.md`，改 `commands/distill.md` 委托调用，实现插件自维护聚合入口。
**Architecture**: 三命令域（nocodehub 聚合路由 / plugin-distill rule+skill写入 / plugin-dream 两层巡检），单文件 `commands/*.md` 模式，无 `skills/` 目录。
**Tech Stack**: Markdown 命令文件 + 现有 `hooks/generate.mjs`/`scripts/vendor-sync.mjs`/`rules/manifest.json` 基础设施。
**Design Doc**: `docs/dev/3dot141/260701-02-nocodehub/nocodehub-design.md`（Review Log Round 1 approved）
**Test Objectives**: TO-1~TO-7（见设计文档「验证策略汇总」），走查为主 + `generate --check`/`vendor-sync --check`/`hooks/*.test.mjs` 兜底
**Execution**: workflow-sequential（6 个 task 依赖链紧密，本次改动小，顺序执行足够快，无需并行调度开销）

## 依赖图（Round 1 red-blue-deep 修正后）

```
Task1(plugin-distill.md) ──┬──→ Task2(distill.md委托改造) ──→ CP1(SC-5验证)
                            │
Task3a(plugin-dream L1) ∥ Task1
        │
        ↓
Task3b(plugin-dream L2,依赖3a) ──→ CP1b(dream完整可用)
        │
Task1 + Task3b ──→ Task4(nocodehub.md) ──→ CP2(三命令齐全)
        │
        ↓
     Task5(plugin.json 升版本) ──→ CP3(全局验证)
```

## Task 1: commands/plugin-distill.md（NEW）

**Files**: Create `commands/plugin-distill.md`
**covers**: 插件维护.P1, 插件维护.P4(被委派对象), SC-1a, SC-1b, SC-1c, SC-1d, 约束.5
**设计文档段落**: plugin-distill 域（BF1-BF3，含 Review C1/W1/W4 修正）
**HITL/AFK**: AFK

**内容**（完整文件正文）：

```markdown
---
description: rule / skill 双轨写入——新增/优化 plugin rule（三步联动/融合）或委托 skill-writing 优化 skill
argument-hint: <描述> | (被 /distill 传结构化候选)
---

# /plugin-distill：plugin rule / skill 写入

统一入口，处理两类插件自维护写入：新增/融合一条 `rules/manifest.json` 登记的 plugin rule，或委托优化一个 `skills/` 下的 skill。被 `/distill` 的 `rules:plugin` 出口调用（传结构化候选），也可独立调用（传 NL 描述）。

## 用法

`/plugin-distill <描述>` — 独立调用，NL 描述你要新增/优化的 rule 或 skill
被 `/distill` 调用时接收结构化候选 `{summary, disposition, target?, body, bucket?, triggerDesc?, ...}`

## 权威依据

改动涉及版本号 / commit-push / rule 改动流程时，现读 `${NOCODE_EVOLVE_REPO}/CLAUDE.md` 原文为准，不在本文件摘抄固化。

## 执行

### Step 1: 判类型

- 被 `/distill` 调用（输入带 `disposition` 字段）：
  - `disposition` 以"融合"开头（格式 `融合→<现有文件路径>`）→ 解析 `→` 后的路径为 fuseTarget，走「融合路径」（不能只做精确相等判断，会丢 target）
  - 否则（"新建"）→ 走「三步联动」
- 独立调用（NL 描述）：
  - 判断描述内容是 rule 类（触发条件/工作流指令）还是 skill 类（创建/优化一个 skill 的能力）
  - 拿不准 → `AskUserQuestion`：`rule` / `skill` / `两者都涉及`，不猜测
  - rule → 判 slug 是否已存在（走「融合路径」或「三步联动」），skill → 走「skill 委托」

### 融合路径（disposition=融合，或独立调用判定为融合现有 rule）

目标可能是顶层 `rules/rule-<x>.md`，也可能是门面的子文件 `rules/rule-references/<x>/<子文件>.md`。

1. Read 目标文件全文 → 把 body 融进合适章节（不是末尾 paste，必要时改章节结构）
2. manifest 处理：
   - 顶层 rule，触发/摘要仍准确 → 不动
   - 顶层 rule，本次融合扩了触发范围 → 改 manifest 里那条的 `triggers`/`trigger_desc`，不新增条目；改后跑 `node hooks/generate.mjs`
   - `rule-references/` 子文件 → 不动（门面 rule 已路由）
3. 升 `plugin.json` 版本：融合通常 `minor`（扩了能力）或 `patch`（纯文案）——判据现读 CLAUDE.md 规则2，不自行发明
4. 报告：`融进 <目标路径>，manifest [未动 / 已更新条目 <slug> 并 generate 重新生成 catalog 分片]，版本 x → y`

### 三步联动（disposition=新建，或独立调用判定为新建 rule）

1. **写 rule 文件**：`slug` 从描述/候选提取；`filePath = ${NOCODE_EVOLVE_REPO}/rules/rule-<slug>.md`。slug 冲突（manifest 已有同名）→ 不 abort，`AskUserQuestion`：融进已有 `rule-<slug>.md` / 改名新建。`Write(filePath, body)`
2. **改 `rules/manifest.json` + 重新生成**：数组末尾新增一条：
   ```json
   {
     "id": "<slug>", "bucket": "<bucket-id>",
     "trigger_desc": "<具体到能自识别的触发条件，不写\"看情况/需要时\">",
     "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-<slug>.md",
     "summary": "<一句话核心动作>"
   }
   ```
   > 实际 manifest schema 比这更完整（还有 `also_buckets`/`trigger_type`/`triggers`/`action`/`depends_on`/`severity`/`lifecycle_stage`），新写条目必填上面 5 个字段（对齐既有 `/distill` 行为，不扩大改动面），其余字段留空或按新增内容合理推断——这是继承自既有实现的字段覆盖范围，不在本次修正。
   跑 `node hooks/generate.mjs`，再跑 `node hooks/generate.mjs --check` 验零漂移
3. **升版本**：新增 rule → `minor`（默认）；语义反转既有规则 → `major`（需会话里明确出现"反转既有规则"信号）；纯文案 → `patch`（少见）。判据现读 `${NOCODE_EVOLVE_REPO}/CLAUDE.md` 规则2 原文，不自行发明或简化。Read `.claude-plugin/plugin.json` → bump → Write 回

三步契约：必须按顺序；任一步失败后续不执行；三步内不回滚已成功步（文件保留比删了更易恢复）；commit/push 不进本逻辑。

报告：
```
已写入 plugin rule: rule-<slug>.md
manifest+generate: rules/manifest.json 已加条目, node hooks/generate.mjs 重新生成 catalog 分片
版本: <old> → <new> (<bumpLevel>)
请到 nocode-evolve 仓 review + commit，push 需询问。
```

### skill 委托

1. 从描述推导信号词（`create a skill` / `improve this skill` / `fix trigger accuracy`），让 `skill-writing` 的 Entry Routing 自判 Create/Edit/Description-only，不替它选模式
2. `Skill(nocode-evolve:skill-writing, <intent> + <signalWord>)`。skill-writing 走到 Phase 7（描述优化）收敛即可，Phase 8 Package（打包 `.skill` 分发）对本仓无意义（marketplace 直接读 git），明确不需要
3. **Gate**：只有 skill 文件确有改动（对比委托前后的 `git status`/`git diff` 有实际变更）才继续；委托中止 / 用户放弃 / 无改动 → 报告"skill 未改动"，**不升版本**
4. 有改动 → 升 `plugin.json` 版本（`minor`，判据同上现读 CLAUDE.md）——**skill-writing 本身不碰 plugin.json，这一步必须自己补**
5. 报告：`skill 已更新: <skillPath>，版本: <old> → <new> (minor)，请 review + commit，push 需询问`

## 孤儿 rule 划界

不主动补未登记的孤儿 rule（scope 控制）——归 `/nocodehub dream` 主动巡检（职责相反，dream 主动扫）。

## 不要

- AI 自判直接写——被 `/distill` 调用时信任其已完成候选呈现+用户勾选；独立调用时拿不准分类要问不要猜
- rules 永远新建——强相关先融合
- 末尾 paste——融进合适章节
- 忘了登记 manifest 或忘升版本
- skill 委托后无条件升版本——必须 gate 在"确有改动"
```

**验证方式**（Round1修正②：不依赖驱动完整 `/distill` 会话流程，手工构造 candidate 直接走查）：
- GWT-1（新建）：手工构造 `{disposition: "新建", body: "<test rule content>", ...}`，人工审读「三步联动」段落逻辑对照此输入的预期行为（写哪个文件路径、manifest 加什么条目、报告长什么样），确认与设计文档 BF2 一致
- GWT-2（融合冲突）：手工构造 `{disposition: "融合→rules/rule-push-summary.md", body: "<补充内容>"}`，人工审读「融合路径」段落逻辑，确认正确解析出 target 路径（不是精确匹配裸"融合"丢 target——这是 Review C1 修的 bug）

**Commit**: `git add commands/plugin-distill.md && git commit -m "feat: 新增 plugin-distill 命令——rule/skill 双轨写入聚合"`

---

## Task 2: commands/distill.md（改，4 处）

**Files**: Modify `commands/distill.md`
**covers**: 插件维护.P4, SC-5, 约束.2
**依赖**: Task 1（plugin-distill.md 必须先存在）
**HITL/AFK**: AFK

**改动 ①**（出口一览表，约 line 33）：

原文（"动作"列）：
```
融进现有 rule（含 `rule-references/` 子文件），或新建 `$NOCODE_EVOLVE_REPO/rules/rule-<slug>.md` + 改 `rules/manifest.json` 后 `node hooks/generate.mjs` 重新生成 catalog 分片 + 升 `plugin.json`
```
改为：
```
委托 `Skill(nocode-evolve:plugin-distill)` 处理（融合优先，否则三步联动；rule/skill 双轨）
```

**改动 ②**（出口说明段，约 line 198-200）：

原文：
```
#### `rules:plugin` 出口（融合优先，否则三步联动）

按 `disposition` 走下方「rules:plugin 分发：融合路径 + 三步联动」节。
```
改为：
```
#### `rules:plugin` 出口（委托 plugin-distill）

调 `Skill(nocode-evolve:plugin-distill)`，传入本出口的候选列表（含 disposition / body / target / bucket / triggerDesc 等）。plugin-distill 负责完整的融合判断 + 三步联动写入协议（rule 文件 + manifest 登记 + generate + 版本升级），本文件不再重复维护该逻辑。
```

**改动 ③**（三步联动主段，约 line 237-333，整节替换）：

原文：整节 `## rules:plugin 分发：融合路径 + 三步联动`（含融合路径子节、三步联动子节、报告示例、孤儿 rule 划界）

改为：
```
## rules:plugin 分发（已迁移到 plugin-distill）

`rules:plugin` 出口的融合判断 + 三步联动写入协议已整体搬到 `Skill(nocode-evolve:plugin-distill)`（`commands/plugin-distill.md`）——单一权威实现，本文件不再重复。委托方式见上方「`rules:plugin` 出口」节。

孤儿 rule 划界（distill 不主动补，归 `/nocodehub dream` 巡检）等边界情况同样已在 `plugin-distill.md` 里维护。
```

**改动 ④**（总报告示例段，约 line 220-224，`### 5. 总报告` 节内的 rules:plugin 示例行）：

原文（示例块内两行）：
```
⚠ 融进 plugin rule: rules/rule-push-summary.md
  manifest: 已更新 push-summary 条目 triggers（本次融合扩了触发范围）并 generate 重新生成 catalog 分片  版本: 1.3.1 → 1.4.0 (minor)
⚠ 跨仓新建 plugin rule: ~/AI/nocode-evolve/rules/rule-distill-extension.md
  manifest+generate: rules/manifest.json 已加条目, generate 重新生成 catalog 分片  版本: 1.4.0 → 1.5.0 (minor)
  请到 nocode-evolve 仓 review + commit + 询问是否 push。
```
改为（措辞对齐委托后的报告来源，内容不变，仅说明来自 plugin-distill 转述）：
```
⚠ 融进 plugin rule（经 plugin-distill）: rules/rule-push-summary.md
  manifest: 已更新 push-summary 条目 triggers（本次融合扩了触发范围）并 generate 重新生成 catalog 分片  版本: 1.3.1 → 1.4.0 (minor)
⚠ 跨仓新建 plugin rule（经 plugin-distill）: ~/AI/nocode-evolve/rules/rule-distill-extension.md
  manifest+generate: rules/manifest.json 已加条目, generate 重新生成 catalog 分片  版本: 1.4.0 → 1.5.0 (minor)
  请到 nocode-evolve 仓 review + commit + 询问是否 push。
```

**验证方式**（CP1，最高风险检查点）：
1. `node hooks/generate.mjs --check` — 改动不涉及 manifest，应仍零漂移
2. 人工审读改动后的 distill.md 全文，确认 rules:plugin 出口从候选到委托的链路完整（没有丢失"候选带 disposition/body/target 等字段"这一信息传递），对照设计文档「回归风险」节的提醒逐条核对
3. GWT-1/GWT-2（同 Task1 的验证，此处从"委托入口"视角复核一遍：distill.md 的候选格式确实是 `融合→<path>` 而不是裸"融合"，对照 Task1 已修的 C1 bug 确认两边字段格式对得上）

**Commit**: `git add commands/distill.md && git commit -m "refactor: distill.md rules:plugin 出口改为委托 plugin-distill，消除逻辑双源"`

---

## Task 3a: commands/plugin-dream.md（NEW，Layer 1 客观检测部分）

**Files**: Create `commands/plugin-dream.md`（首次落盘，仅含 Layer1 + 文件骨架）
**covers**: 插件维护.P2（部分）, SC-2（部分）, 约束.5
**可与 Task 1 并行**（无共享文件）
**HITL/AFK**: AFK

**内容**（初版骨架 + Layer1，frontmatter 和整体结构一次写全，Layer2 表格占位标注"见 Task3b 补充"）：

```markdown
---
description: 插件仓库自维护巡检——客观漂移(4项) + 边界符合性(19项)两层检测，候选清单+用户勾选+执行修复
argument-hint: (无参数)
---

# /plugin-dream：插件仓库自维护巡检

检查 nocode-evolve 插件仓库自身（rules/skills/commands/manifest）与预期状态的偏差，提议修复动作，用户确认后执行。独立于 `/plugin-distill`——distill 管写入，dream 管巡检维护。

## 执行流程

### Phase 1: Scan（两层检测）

#### Layer 1 — 客观漂移（机械可测，跑现成命令）

| 检测 | 命令/判据 | 修复类型 |
|---|---|---|
| 生成物漂移 | `node hooks/generate.mjs --check`，exit 1 = 漂移 | 自动：重跑 `node hooks/generate.mjs` |
| vendor 漂移 | `node scripts/vendor-sync.mjs --check`，exit 1 = 不一致 | 自动：重跑 `node scripts/vendor-sync.mjs` |
| manifest 失效路径 | 遍历 `rules/manifest.json` 的 `read` 字段，排除空串/括号说明串（如 `(skill, 无 rule 文件)`）/非 `/rules/` 路径（如指向 `model/` 的），归一化 `${CLAUDE_PLUGIN_ROOT}/` 前缀后 `test -e` | 护栏：补文件或删条目（二次确认） |
| 孤儿 rule | `ls rules/*.md` 归一化路径 ∖ manifest `read` 字段归一化后的登记集合（两侧路径归一化必须一致，否则会把全部 rule 误判孤儿） | 护栏：登记进 manifest 或删除（二次确认） |

#### Layer 2 — 边界符合性（见下方，本 Task 先占位，Task3b 补充完整矩阵）

<!-- PLACEHOLDER: Task3b 填充 rule/skill/command/通用 19 项检测表 -->

### Phase 2: Propose（呈现候选 + 用户确认）

<!-- PLACEHOLDER: Task3b 补充完整 Propose/Execute 逻辑 -->
```

**验证方式**：`node hooks/generate.mjs --check` 和 `node scripts/vendor-sync.mjs --check` 在当前仓库真实跑一遍，确认命令本身可执行、退出码语义符合文档描述（已在 Env 阶段 baseline 验证过一次，此处复核）。

**Commit**: 不单独 commit（Task3b 紧接着补完整文件，一次性 commit）

---

## Task 3b: commands/plugin-dream.md（续写，Layer 2 语义检测 + Propose/Execute）

**Files**: Modify `commands/plugin-dream.md`（替换 Task3a 的占位段）
**covers**: 插件维护.P2（完整）, SC-2（完整）, 约束.4（superseded → 已被设计文档 D2 定义取代，本 task 落地 D2）
**依赖**: Task 3a
**HITL/AFK**: AFK

**内容**（替换占位段为完整 Layer2 + Phase2/3）：

```markdown
#### Layer 2 — 边界符合性（语义，按对象类型分组读文件判断；单文件级判据，不跨文件推理，保证结论可复现）

**rule 对象**（逐个 `rules/rule-*.md` + 对应 manifest 条目）：

| 检测 | 判什么 |
|---|---|
| 重复/重叠 | 跟其他 rule 的触发/职责是否重叠——该融合没融合（distill 融合优先原则） |
| 触发质量 | `trigger_desc` 是否具体可自判命中，不是"需要时读"这类空话 |
| 触发负例 | `trigger_desc`/`triggers` 有没有负例划边界 |
| summary 时效 | manifest `summary` 是否仍准确反映 rule 文件当前内容 |
| 字段完整 | `id/bucket/trigger_desc/read/summary` 齐全，`bucket` 在 `buckets` 定义内 |
| read 路径规范 | 仅对 rule 文件型 `read` 检查——用 `${CLAUDE_PLUGIN_ROOT}` 前缀；空 `read`/括号说明串/`model/` 路径不算违规，跳过 |
| 模式边界 | 是当前指令，文件名不含日期、不含历史叙述 |

**skill 对象**（逐个 `skills/*/SKILL.md`；深度判断——是否符合原理/调用正确/专业性——委托 `nocode-evolve:skill-writing` 做只读评估，本命令不重新发明判据）：

| 检测 | 判什么 |
|---|---|
| 符合原理 | 单一职责、有 Enter/Exit Gate、刚性/弹性标注 |
| 调用正确 | 委派/handoff 链成立，引用的 skill/命令存在不悬空 |
| 专业/非空壳 | 内容非敷衍占位 |
| description 触发准确 | `Use when` + 反例（Not for）齐全 |
| Step 编号规范 | 整数或字母后缀，禁分数编号（CLAUDE.md 规则5） |
| workflow 防跳步登记 | workflow 类 skill 是否登记在 `rules/manifest.json` 的 `workflow_skills` |
| 引用路径有效 | `{NOCODE_SKILL_REF}`/references/rule 文件引用不悬空 |
| 硬交接完整 | workflow skill 末步有 handoff 调下一阶段 |

**command 对象**（逐个 `commands/*.md`）：命名惯例（`*hub`/`*flow`/`xx-yy`）/ 模式边界（hub 只转发不写业务逻辑）。

**通用**（跨对象）：版本联动（改了插件加载文件但 `plugin.json` 没升）/ 内容 stale（引用路径或机制已变没跟着更新）。

> 语义检测规模提示：本仓 skill 数量较多，逐 skill 跑满 8 项判断成本不低——可按对象类型分组跑（先 rule 组，再 skill 组），或用户指定范围（如"只查 rule"/"只查 skill"）缩小单次扫描面，不强制全量。

### Phase 2: Propose（呈现候选 + 用户确认）

汇总 Layer1 + Layer2 全部候选，表格呈现：

```
| # | 对象 | 检测 | 动作 | 理由 |
|---|---|---|---|---|
| 1 | rules/rule-foo.md | O3 manifest失效路径 | 补文件/删条目 | read 指向的文件已不存在 |
| 2 | skills/bar/SKILL.md | S4 description触发不准 | 建议优化(委托skill-writing) | description 缺 Use when |
```

`AskUserQuestion` 多选让用户勾选要执行的编号。0 候选 → 报"状态良好"。

### Phase 3: Execute（按类型分派）

- **自动类**（O1/O2）：直接重跑对应命令
- **护栏类**（O3/O4，涉及删除）：回显路径 + 原因 + 影响，二次确认后执行
- **建议式**（Layer2 全部）：不自动改——rule 类委托 `Skill(nocode-evolve:plugin-distill)`，skill 类委托 `Skill(nocode-evolve:skill-writing)`，由用户在委托流程里最终拍板

### 完成报告

```
plugin-dream 完成：
  ✓ O1: generate 重新生成 catalog 分片（漂移已修复）
  ✓ O3: rules/rule-foo.md 的失效路径已补 → path/to/target.md
  → 委托: skills/bar/SKILL.md description 优化，转 Skill(skill-writing)
  ✗ 跳过: #4（用户未勾选）

ℹ 状态：0 error / 1 warn（含未处理的 Layer2 建议）
```

## 和 SessionStart 自动 sanity check 的关系

`hooks/inject-rules.sh` 已在 SessionStart 跑 `generate.mjs --check`，但只 warn 不阻断、不修复。`/plugin-dream` 是开发者主动触发的交互式扫描 + 提议修复 + 可执行，两者互补不重复。

## 不要

- 不自动执行任何删除——O3/O4 的删除类动作走护栏二次确认
- 不对 Layer2 语义类问题自作主张改文件——只提议、委托对应写入命令，不越权
- 不跨文件推理下结论——每项 Layer2 检测限单文件级判据，保证结论可复现
```

**验证方式**（CP1b，dream 完整可用检查点）：
- 人工制造 O3 案例：临时在 `rules/manifest.json` 加一条指向不存在文件的 rule 条目（验证后立刻撤销，不真实污染仓库），人工审读 Layer1 检测逻辑段落，确认能正确识别（路径归一化后 diff，不会漏判）
- 人工审读 Layer2 每类检测表述是否与设计文档 23 项矩阵一致（逐项核对无遗漏）

**Commit**: `git add commands/plugin-dream.md && git commit -m "feat: 新增 plugin-dream 命令——两层23项自维护巡检"`

---

## Task 4: commands/nocodehub.md（NEW）

**Files**: Create `commands/nocodehub.md`
**covers**: 插件维护.P0, 插件维护.P1（路由）, 插件维护.P2（路由）, 插件维护.P3, SC-3, SC-4, 约束.1
**依赖**: Task 1（plugin-distill 存在） + Task 3b（plugin-dream 完整存在）
**HITL/AFK**: AFK

**内容**（完整文件正文）：

```markdown
---
description: nocode-evolve 插件自维护聚合入口（hub），分发到 3 个子动作（write/dream/status）
argument-hint: <sub-action> [args]
---

# /nocodehub：插件自维护聚合入口

统一入口，聚合插件自身（rules/skills/manifest/commands）的维护动作。每个子动作也可以直接用独立命令调用。

## 与 personalhub / projecthub 的区别

| | personalhub | projecthub | nocodehub |
|---|---|---|---|
| 管什么 | `.agents-personal/`（私有知识库） | 项目子目录的 AGENTS.md + README.md | nocode-evolve 插件自身（rules/skills/manifest/commands） |
| 入仓 | gitignored | 版本控制，共享 | 版本控制，共享（插件仓库本身） |
| 受众 | 仅当前用户的 agent | 所有协作者的 agent + 人类 | nocode-evolve 插件的维护者 |
| 文件 | wiki/ + rules/ + AGENTS.md | 各子目录的 AGENTS.md + README.md | commands/rules/skills/manifest.json |

## 用法

`/nocodehub <sub-action> [args]`

## 子动作路由

| 子动作 | 做什么 | 转发到 | 独立命令 |
|---|---|---|---|
| `write` | 新增/优化 plugin rule 或 skill | `Skill(nocode-evolve:plugin-distill)` | `/plugin-distill` |
| `dream` | 插件仓库自维护巡检（客观漂移+边界符合性） | `Skill(nocode-evolve:plugin-dream)` | `/plugin-dream` |
| `status` | 概览当前插件健康状态 | 内联执行（见下方） | — |

## 执行

### 解析子动作

从 `$ARGUMENTS` 取第一个词作为子动作，剩余部分作为子动作的参数传递。

无参数或不识别的子动作 → 输出用法表格：

```
/nocodehub <sub-action>

  write    新增/优化 plugin rule 或 skill
  dream    插件仓库自维护巡检
  status   概览插件当前健康状态
```

### write / dream

调对应的 `Skill()`，把剩余参数传进去。

### status

内联执行，输出插件当前状态概览：

1. 读 `.claude-plugin/plugin.json` 的 `version`（精确）
2. 读 `rules/manifest.json` 的 `rules` 数组长度（精确，rule 数）
3. 统计 `skills/*/SKILL.md` 数量（精确，skill 数）
4. 跑 `node scripts/vendor-sync.mjs --check`（展示级，人工核验）
5. 跑 `node --test 'hooks/*.test.mjs'`（展示级，测试通过/失败数）
6. 跑 `node hooks/generate.mjs --check`（展示级，漂移状态）

输出格式：

```
📦 nocode-evolve 插件状态

  版本:    5.1.2
  rule 数: 25
  skill 数: 38
  vendor 同步: ✓ 一致
  测试:    ✓ 60/60 通过
  漂移:    ✓ 零漂移

  → 结论: 状态健康
```

（vendor 同步/测试/漂移三项若有异常，建议跑 `/nocodehub dream` 巡检具体问题。）
```

**验证方式**（CP2，三命令齐全检查点）：
- TO-1 走查：`/nocodehub`（无参）和 `/nocodehub foobar`（未知子动作）均应输出用法表格
- TO-5 走查：`/nocodehub status` 实际执行 6 个读取/命令步骤，人工核对版本号/rule数/skill数与真实文件内容一致

**Commit**: `git add commands/nocodehub.md && git commit -m "feat: 新增 nocodehub 聚合入口——参考 personalhub/projecthub 模式"`

---

## Task 5: .claude-plugin/plugin.json（改，升版本）

**Files**: Modify `.claude-plugin/plugin.json`
**covers**: 约束.3, Quality Bar
**依赖**: Task 1-4 全部完成
**HITL/AFK**: AFK

**内容**：Read 当前 `version`（5.1.2），按 CLAUDE.md 规则2 判据（新增 3 个命令文件 = "新增 skill/hook/兼容性增强" → minor），bump 为 `5.2.0`，Write 回。

**验证方式**（CP3，全局验证检查点）：
1. `node hooks/generate.mjs --check` — 全程零漂移（本次改动不涉及 manifest.json 内容，只涉及 commands/ 新增和 distill.md 改动，不应产生 catalog 漂移）
2. `node scripts/vendor-sync.mjs --check` — 一致（本次改动不涉及 vendor/）
3. `node --test 'hooks/*.test.mjs'` — 60 个既有测试全过（本次改动不修改 hooks/ 下任何脚本逻辑，纯新增 commands + 改 distill.md + 改版本号，不应影响任何既有测试）
4. `git status` 确认改动范围精确匹配：3 个 NEW（nocodehub.md/plugin-distill.md/plugin-dream.md）+ 2 个改（distill.md/plugin.json）

**Commit**: `git add .claude-plugin/plugin.json && git commit -m "chore: 升级插件版本 5.1.2 → 5.2.0 (minor)——新增 nocodehub 聚合入口"`

---

## 路径 → Task 映射表（8c 路径覆盖）

| 路径/约束 | 覆盖 Task |
|---|---|
| 插件维护.P0 | Task 4 |
| 插件维护.P1 | Task 1（写入逻辑）+ Task 4（路由） |
| 插件维护.P2 | Task 3a + Task 3b（检测逻辑）+ Task 4（路由） |
| 插件维护.P3 | Task 4 |
| 插件维护.P4 | Task 1（被委派对象）+ Task 2（委托改造） |
| 约束.1 | Task 4 |
| 约束.2 | Task 1 + Task 2 |
| 约束.3 | Task 5 |
| 约束.4（superseded→D2） | Task 3b |
| 约束.5 | Task 1 + Task 3a/3b |

**8b 需求覆盖**：SC-1a/1b/1c/1d → Task1；SC-2 → Task3a+3b；SC-3 → Task4；SC-4 → Task4；SC-5 → Task2。全部 ≥1 task 覆盖 ✅

**8d 可验证**：每 task 均有验证方式（走查步骤/命令），见各 task「验证方式」。

**8e 依赖无环**：Task1→Task2；Task1∥Task3a→Task3b→Task4（依赖Task1+Task3b）→Task5。拓扑排序合法，无环 ✅
