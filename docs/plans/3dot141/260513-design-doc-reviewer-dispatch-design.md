---
type: design-doc
topic: 修复 design-doc-reviewer dispatch 链路（plugin agent → general-purpose template）
date: 260513
author: 3dot141
status: draft
last_updated: 260513
---

# Design Doc：修复 design-doc-reviewer dispatch 链路

## 背景

**主因**：`design-doc-writing` skill 的 step 5（spawn design-doc-reviewer subagent）**当前调用即失败**——reviewer persona 文件存在但 dispatch 链路断。

**辅因约束**（取舍方案时要同时满足，但不是问题本身）：reviewer 不应出现在 `/agents` 列表里被用户误触；persona/检查项要保持单源（不要在多文件间漂移）。

具体报错：

```
Error: Agent type 'design-doc-reviewer' not found.
Available agents: claude, claude-code-guide, Explore, general-purpose, Plan, statusline-setup
```

根因：reviewer persona 文件存在于 `skills/design-doc-writing/agents/design-doc-reviewer.md`，但 Claude Code 仅从三个固定位置自动注册 subagent——

1. 插件根 `agents/`
2. project `.claude/agents/`
3. user `~/.claude/agents/`

`skills/<name>/agents/` 不在注册路径里，所以这个 reviewer 文件**写了但从未生效**。

参照 superpowers v5（PR #1299）的演进——它原本也有 `agents/code-reviewer.md` plugin agent，v5.0 主动删除，改为"skill + dispatch general-purpose with prompt template"模式。release note 原话：

> Single source of truth — the persona/checklist that previously lived in both `agents/code-reviewer.md` and the skill's placeholder template (and drifted independently) is now one file.

本 doc 的解法**直接复用 superpowers v5 的模式**，同时满足主因（链路通）与两条辅因约束（不污染 `/agents` + 单源）。

不解决的代价：design-doc-writing 工作流的 review 环节**永久断**，每份产出文档都要人审或绕开 reviewer——`overlay-superpowers.md` 规定的"三步都要走：写 → 评审 + 用户逐条确认 → 渲染"承诺无法兑现。

## 目标

- `design-doc-writing` skill step 5 端到端跑通：能 dispatch 出 reviewer subagent 并拿到 Report
- reviewer **不出现在 `/agents` 列表**——不引入新的 plugin agent
- reviewer persona/检查项**保持单源**——只在一个文件里维护
- 仓库现有 `references/` 子目录约定不破坏
- 改完后，对本 design doc 自身跑一次 dispatch 作为端到端验证

明确不做：

- 不重写 reviewer 主体内容（约 200 行检查项已被用户验证可用，是本次 dispatch bug 的无辜旁观者；最终 template 文件约 220 行，差额是新增头部注释与末尾输入节）
- 不引入新的 plugin agent
- 不动 `rules/agent-about.md` 的红蓝军准则（reviewer 内部的 "Forbidden Reviewer Language" 已是红蓝军行为的具象化）

## 架构

### 组件关系

参与 dispatch 链路的组件与它们的依赖关系：

```
[主对话 Claude (design-doc-writing 工作流)]
      │
      │ Read & substitute
      ↓
[references/reviewer-template.md]  ──┐
                                     │ (内容作为 prompt 主体)
                                     ↓
                          [Task tool (subagent_type=general-purpose)]
                                     │
                                     │ spawn 独立 context
                                     ↓
                          [general-purpose subagent]
                                     │
                                     │ 自行 Read 设计文档
                                     ↓
                          [docs/plans/.../target-doc.md]
                                     │
                                     │ 输出 Report
                                     ↓
                          [主对话: 把 Report 转交用户]
```

要点：主对话**不直接持有** reviewer 逻辑——template 文件是单一源；subagent 不直接接收文档内容——通过路径自取。这两层间接性保证了"主对话上下文不被 reviewer 工作量污染"+"调用方接口极窄"。

### 流程对比

修复前 vs 修复后：

| 阶段 | 修复前（断链） | 修复后（template dispatch） |
|---|---|---|
| step 5 触发 | `spawn design-doc-reviewer` | `Read template + 替换 placeholder` |
| 调用结果 | ❌ `Agent type 'design-doc-reviewer' not found` | Task tool 接受 `general-purpose` + prompt |
| subagent 运行 | 不存在 | ✅ 独立 context |
| 用户感知 | 工作流断、被迫人审或绕过 | 透明，主对话收到 Report 转交 |
| reviewer 文件位置 | `skills/<name>/agents/`（未注册路径） | `skills/<name>/references/`（dispatch template） |

### 问题拆解

#### 问题一：如何接通 dispatch 链路（不引入 plugin agent）

**说明**：reviewer 当前作为"未注册的 agent 文件"存放，必须让它能被实际调用。两种合规路径：注册为 plugin agent（移到插件根 `agents/`）；或不再当 agent 用、改为 general-purpose 的 prompt template。

**方案对比**：

| 方案 | 调用语法 | 出现在 /agents | persona 单源 | 仓库结构改动 |
|---|---|---|---|---|
| A. plugin agent（移到插件根 `agents/`） | `Task(design-doc-reviewer)` | ❌ 必出现 | ✅ | 新增插件根 `agents/` 目录 |
| B. general-purpose + template（superpowers v5 模式） | `Task(general-purpose, prompt=...)` | ✅ 不出现 | ✅ | 仅 references/ 内重组 |

否决 A 的理由：用户明确"不希望出现在 `/agents`"——这是硬约束，A 不可能绕过（Claude Code 没有 `hidden: true` 字段，详见前期 claude-code-guide subagent 调研）。

**结论**：选 B。superpowers v5 上游也是同样取舍。

#### 问题二：reviewer template 文件放哪个目录

**说明**：B 方案下 reviewer 不再是 agent，是 dispatch template。当前位置 `skills/design-doc-writing/agents/design-doc-reviewer.md` 的 `agents/` 子目录名暗示是 plugin agent，命名失真。

**方案对比**：

| 方案 | 路径 | 与既有约定一致 | 命名准确性 |
|---|---|---|---|
| references/ 子目录 | `skills/design-doc-writing/references/reviewer-template.md` | ✅ 与 references/doc-types、references/examples 同档 | ✅ "template" 直白 |
| skill 根目录 | `skills/design-doc-writing/reviewer-template.md` | ❌ 仓库 SKILL.md 同级不放素材 | ✅ |
| 保持 agents/ | `skills/design-doc-writing/agents/design-doc-reviewer.md` | ❌ `skills/<name>/agents/` 不在 Claude Code 注册路径，命名约定与系统行为错配 | ❌ 名实不符 |

**结论**：references/ 子目录。仓库已建立"SKILL.md 引用的辅助素材都在 references/"的约定，新文件遵循约定降低维护者推断成本。

#### 问题三：template 文件 frontmatter 如何处理

**说明**：现有 frontmatter 是 agent 用途的 `name` + `description`——在 B 方案下这两个字段不被任何系统识别（不会注册成 agent，Claude 也不会按 description 自动委派）。

**方案对比**：

| 方案 | 形态 | 误导风险 |
|---|---|---|
| 普通 markdown 段落注释（文件开头一两句话说明） | `> 本文件是 design-doc-writing skill step 5 的 dispatch template，被 SKILL.md Read 后整段塞进 Task prompt。Placeholder: {DOC_PATH}。` | ✅ 零误导 |
| 自定义 frontmatter（`purpose` / `placeholders` / `caller`） | YAML 元数据 | ⚠️ 看起来像被系统识别，实际是死字段 |
| 保留原 agent frontmatter | `name: design-doc-reviewer` | ❌ 严重误导：新维护者会以为这是 plugin agent |

**结论**：普通 markdown 段落注释。最直白、零误导、无需读者推断"这个 frontmatter 字段被谁消费"。

#### 问题四：dispatch 时传哪些 placeholder

**说明**：调用方（design-doc-writing SKILL.md）和 subagent 之间需要约定接口。placeholder 越少，接口越窄，调用方负担越小。

**方案对比**：

| 方案 | placeholder 集 | 调用方负担 | reviewer 自给能力损失 |
|---|---|---|---|
| 最小集 | `{DOC_PATH}` | 仅传路径 | 无——reviewer 自己 Read 文档 frontmatter 取 doc-type，自己 Read 末尾 Review Log 取历史 |
| 中等集 | `{DOC_PATH}` + `{DOC_TYPE}` | 传路径 + type | 让 reviewer 失去"按文档真实状态判断 type"的能力 |
| 完整集 | path + type + previous_log + 整段 frontmatter YAML 块 | 调用方要预处理 | 把 reviewer 内的 Read 步骤外包出去，违反单一职责 |

**结论**：最小集 `{DOC_PATH}`。reviewer 工作流第 1 步本就是"Read 设计文档全文 + frontmatter"，doc-type、Review Log 都从文件自身解析，无需调用方先验注入。

### 架构总结

基于问题 1-4 的结论，整体方案为：

1. **移动 + 改名**：`skills/design-doc-writing/agents/design-doc-reviewer.md` → `skills/design-doc-writing/references/reviewer-template.md`，删除空 `agents/` 子目录
2. **改造文件头部**：删除原 agent frontmatter，改为一段 markdown 注释说明文件用途与 `{DOC_PATH}` placeholder
3. **追加 `## 输入` 节**：在文件末尾说明 `{DOC_PATH}` placeholder 的填充约定
4. **改写 SKILL.md step 5**：从"spawn subagent"改为"Read template → 替换 placeholder → Task(general-purpose)"三步
5. **同步 overlay**：`rules/overlay-superpowers.md` 第 32 行对 design-doc-reviewer 的描述加一句"通过 general-purpose subagent + reviewer-template.md dispatch"，避免规则文档与实际机制脱节
6. **升版本**：`plugin.json` `0.26.0` → `0.27.0`（minor）

reviewer 主体内容（Iron Law / Forbidden Language / 7 维度审查 / 附带检查 / Self-Audit / 输出格式 / 重复 review 说明）**逐字保留**——本次修复不动业务逻辑。

## 实现

按架构总结 6 步逐文件展开。架构 4 个问题与实现 3 条逻辑**不 1:1**，映射关系如下：

**问题二、三、四（位置 / frontmatter / placeholder）合并到「逻辑一：reviewer template 文件改造」**——它们都是"对同一个文件的不同维度改造"，分开成三个逻辑会让 doc 重复说同一个文件的多次写入操作。问题四的 placeholder 决策具体落在逻辑一的 `buildInputSection()` 步骤（template 末尾追加 `## 输入` 节，仅含 `{DOC_PATH}` 一个 placeholder）+ 逻辑二的关键契约（调用方接口只需 path 字符串）。

**逻辑二、三独立成节是实施层细节**——「逻辑二：SKILL.md step 5 改写」与「逻辑三：overlay + plugin.json 同步」与逻辑一分属不同文件、可以并行编辑、回滚边界也独立。架构层未单独讨论，因为它们是问题一总方向（接通 dispatch 链路）的落地展开，不引入新决策。

### 影响文件

```
skills/design-doc-writing/                                    ← 本 skill 内部重组
├── SKILL.md                              (改)  ① step 5 改写为 dispatch 三步法
│                                              ② 文档其余 step 不动
├── agents/                               (DEL) 子目录删除（移空后）
│   └── design-doc-reviewer.md            (MV)  → references/reviewer-template.md
└── references/
    ├── doc-types/                              (不动)
    ├── examples/                               (不动)
    ├── layer-supplements/                      (不动)
    ├── common.md                               (不动)
    └── reviewer-template.md              (NEW) ① 顶部新增 3 行 markdown 注释段
                                                ② 主体 ~200 行原样保留（删原 frontmatter 4 行）
                                                ③ 末尾追加「## 输入」节 ~5 行带 {DOC_PATH}
                                                ④ 最终文件约 220 行

rules/
└── overlay-superpowers.md                (改)  第 32 行 design-doc-reviewer 描述加 dispatch 机制说明

.claude-plugin/
└── plugin.json                           (改)  version: 0.26.0 → 0.27.0
```

### 逻辑一：reviewer template 文件改造

#### 业务流（伪代码）

```
function migrateReviewerToTemplate():                          // 把 agent 文件改造成 dispatch template
    src = "skills/design-doc-writing/agents/design-doc-reviewer.md"  // 当前 agent 用途位置
    dst = "skills/design-doc-writing/references/reviewer-template.md" // 新 template 位置
    content = read(src)                                        // 读全文（实际约 219 行）
    body = stripFrontmatter(content)                           // 删除 frontmatter
                                                                // 解析方式：读到第二个 `---` 为止
                                                                // （原文件 frontmatter 是 name + description 两字段）
    header = buildMarkdownNotice()                             // 构建头部说明段落
                                                                // 内容：本文件是 dispatch template，
                                                                //       被 SKILL.md step 5 整段塞进 Task prompt，
                                                                //       placeholder 仅 {DOC_PATH}
    footer = buildInputSection()                               // 构建 ## 输入 节
                                                                // 内容：「## 输入\n要 review 的文档：{DOC_PATH}\n
                                                                //        Read 该路径完整内容（含 frontmatter 与末尾
                                                                //        Review Log 若存在），按上面工作流走。」
                                                                // 仅 {DOC_PATH} 一个 placeholder（见问题四结论）：
                                                                // reviewer 自己 Read 文档解析 doc-type / Review Log，
                                                                // 调用方不预处理
    write(dst, header + "\n\n" + body + "\n\n" + footer)       // 拼接写入新位置
    gitMove(src, dst, preserve_history=true)                   // 实际落地用 `git rm` + `git mv`
                                                                // 保留 git blame 历史轨迹；避免 fs 层 rm+create 切断 blame
    rmdir("skills/design-doc-writing/agents/")                 // 删空目录（避免误导维护者）
```

#### 关键契约

- **文件路径**：`skills/design-doc-writing/references/reviewer-template.md`
- **placeholder**：`{DOC_PATH}` —— 字符串，要 review 的文档绝对路径或相对仓库根的相对路径
- **文件结构约定**：头部注释段 → 原主体约 200 行（Iron Law / Forbidden Language / 工作流 / 核心审查 / 附带检查 / Self-Audit / 输出格式 / 关于重复 review）→ 末尾 `## 输入` 节
- **headless 调用**：本文件**整段**作为 prompt 时即可执行，不依赖任何外部上下文

#### 异常与失败模式

| 场景 | 触发 | 处理 |
|---|---|---|
| migration 时旧文件不存在 | 历史 commit 已删除原 agent 文件 | 视为已迁移，跳过 rm 步骤 |
| `agents/` 子目录残留其他文件 | 未来可能有人放别的 agent 进去 | rmdir 失败时不强制——告警保留目录 |

### 逻辑二：SKILL.md step 5 改写

#### 业务流（伪代码）

```
function rewriteSkillStep5():                                  // 把 step 5 从断链改为可执行 dispatch
    skill_md = "skills/design-doc-writing/SKILL.md"
    old_line = "5. spawn design-doc-reviewer subagent（输入：doc_path）"
                                                                // 字面唯一匹配的旧 step 5 文字
    new_block = """
5. Dispatch reviewer subagent（接通方式：general-purpose + template）：
   a. Read `skills/design-doc-writing/references/reviewer-template.md`
   b. 把 template 内容里的 `{DOC_PATH}` 替换为当前文档路径
   c. 调用 Task tool：
      - subagent_type: general-purpose
      - description: "Review design doc"
      - prompt: <上一步替换后的 template 全文>
   d. subagent 返回 Review Report 后，进入 step 6 用户逐条确认环节
"""
    content = read(skill_md)                                   // 读 SKILL.md 全文
    assert old_line in content                                 // 前置校验：旧文本必须字面存在
                                                                // 假设 SKILL.md step 5 当前完全是该行
                                                                // （编辑前 grep 校验）；若不匹配 fail-fast，
                                                                // 提示人工 inspect（避免静默失败）
    content = content.replace(old_line, new_block.strip())     // 单点替换 step 5
                                                                // 其他 step（1-4、6-11）不动
    write(skill_md, content)                                   // 写回
```

#### 关键契约

- **触发位置**：`skills/design-doc-writing/SKILL.md` 「## 工作流」代码块内
- **接口**：调用方（主 Claude）只需要知道当前文档的 path 字符串（**placeholder 集 = `{DOC_PATH}` 单一项，见问题四决策**）
- **dispatch 接口**：标准 Task tool 调用，不依赖 plugin 注册的 subagent name
- **subagent 返回**：Review Report markdown 文本（含 C1/W1/S1 编号格式或 Pass verdict），调用方原样转交 user

#### 异常与失败模式

| 场景 | 触发 | 处理 |
|---|---|---|
| template 文件读取失败 | references/reviewer-template.md 被误删 | Task 调用前 fail-fast，提示用户文件缺失 |
| subagent 返回非预期格式（无 C1/W1/S1 编号且非 Pass） | Claude 没严格按 template 输出格式 | 主对话照旧把内容呈现给用户，由用户判断是否要求重 review |
| `{DOC_PATH}` 替换边界 | 路径含 `{ }` / 空格 / 中文 / 引号 | 字符串字面替换无需转义；template 内除 `{DOC_PATH}` 外无其他 `{XXX}` 形式（编辑前 grep 验证），不会误替换 |
| dispatch subagent 调用失败 | quota 用尽 / context 超限 / Task tool 错误 | Task tool 报错冒泡给主对话，向用户报告失败原因，**无自动降级**（不退回到主 context 跑 reviewer——会污染上下文，违反 B 模式核心价值） |

### 逻辑三：overlay + plugin.json 同步

#### 业务流（伪代码）

```
function syncOverlayAndVersion():                              // 让外部规则文档与实际 dispatch 机制一致
    overlay = "rules/overlay-superpowers.md"
    plugin_manifest = ".claude-plugin/plugin.json"

    // 步骤 1：overlay 第 32 行加注释
    content = read(overlay)
    old = "2. **`design-doc-reviewer` subagent**（在 design-doc-writing 工作流内 spawn）"
    new = "2. **`design-doc-reviewer` subagent**（在 design-doc-writing 工作流内通过 `Task(general-purpose)` + `references/reviewer-template.md` dispatch）"
    content = content.replace(old, new)                        // 单点替换，仅澄清机制
    write(overlay, content)

    // 步骤 2：plugin.json 版本升 minor
    manifest = readJson(plugin_manifest)
    manifest.version = "0.27.0"                                // 0.26.0 → 0.27.0
                                                                // 判据：CLAUDE.md 工作流约束 #2 规定
                                                                //   patch = bug fix / 文案修订
                                                                //   minor = 新增 hook/skill / 兼容性增强
                                                                // 本次改动涉及：
                                                                //   - 文件位置移动（用户感知层：reviewer 文件路径变了）
                                                                //   - SKILL.md step 5 工作流文字改写（公开机制变更）
                                                                //   - overlay 文档同步（外部规则面变更）
                                                                // 性质上是 "bug fix + 机制公开层变更"
                                                                // → 倾向 minor（重于纯 patch 文案修订）
    writeJson(plugin_manifest, manifest)
```

#### 关键契约

- **原子提交约束**（核心不变量）：**逻辑一的 template 改造 + 逻辑二的 SKILL.md step 5 改写必须同一个 commit 落地**。任一方未做都会让 dispatch 链路完全断：
  - template 移走但 SKILL.md 仍引用旧路径 → Read 时 file not found
  - SKILL.md 改了但 template 没建 → Read 新路径时 file not found
- overlay 第 32 行**只动一句话**——加机制描述，其他不动
- plugin.json **只动 version 字段**——不动 description / keywords / 其他元数据
- **commit 边界**：本次实施总共 2 个 commit
  - commit 1：4 个修复文件（template / SKILL.md / overlay / plugin.json）+ 本 design doc——单原子提交保证仓库任何中间状态自洽
  - commit 2：本文档末尾 append `## Review Log`（dogfood 反馈记录），doc-only 修订

#### 异常与失败模式

| 场景 | 触发 | 处理 |
|---|---|---|
| 用户拒绝某步改动 | review 阶段对某文件改动有异议 | 单 commit 拆分；但逻辑一 + 逻辑二必须保持原子（见关键契约） |
| commit 后 push 前发现链路仍不通 | 端到端验证失败 | 见下方「验证」节，本地排查不 push |
| Review Log append 引入新问题 | 修订过程引入回归 | commit 2 之前再跑一次 dispatch 验证（成本低，独立 context） |

### 验证

按以下顺序执行，**每步都是必经**：

1. **实施 commit 落地**（commit 1）
   - 4 处文件修改 + 本 design doc 一次性 commit
   - commit message 风格参考 `git log` 最近记录
2. **端到端 dispatch 验证**
   - test fixture：本 design doc 自身（`docs/plans/3dot141/260513-design-doc-reviewer-dispatch-design.md`）
   - 手动模拟 step 5 三步：Read template → 替换 `{DOC_PATH}` → 调用 Task tool（general-purpose）
3. **Report 格式校验**
   - **基本校验（任何 Verdict 都必须满足）**：含 `## Review Report` / `**Doc**` / `**Type**` / `## Verdict` 四块 header
   - **若 Verdict 是 `❌ Has issues`**：额外要求问题清单按 Critical / Warning / Suggestion 三档分档，每条带 `C1` / `W1` / `S1` 短编号
   - **若 Verdict 是 `✅ Pass`**：额外要求含 "✅ Pass — 没有发现 Critical / Warning" 行
4. **append Review Log**（commit 2）
   - 把本次 Report 全文 + 用户决定 + 修订摘要 append 到本文档末尾 `## Review Log`
   - 单独一个 doc-only commit（message: `docs: append review log for design-doc-reviewer dispatch fix`）
5. **判定**
   - 步骤 3 基本校验通过 → dispatch 链路修复完成
   - 步骤 3 基本校验失败 → 链路本身有问题，回到逻辑一/二/三排查
   - 报告格式不完美（编号缺失 / Pass 行缺失）但基本校验通过 → reviewer template 内容需要补强，**记入下一轮 follow-up，本次修复不在 scope**

本验证流程本身是 dogfood——用修好的 dispatch 链路 review 这份 design doc，把 Report 追加到本文件 `## Review Log` 节。

## Review Log

### Review 1 — 2026-05-13

**Reviewer Report 全文**：

```markdown
## Review Report

**Doc**: /Users/yes365/AI/nocode-evolve/docs/plans/3dot141/260513-design-doc-reviewer-dispatch-design.md
**Type**: design-doc

### ❌ Critical (3 条)

- **C1** [`## 实现` 节首段]：问题四的 placeholder 决策没有任何业务流真正展开它——`buildInputSection()` 注释提到 `{DOC_PATH}` 但没说"为什么只有这一个 placeholder"。问题四结论实际落地点在逻辑二 step 5 改写（调用方只传 path），但逻辑二关键契约也没把这点回扣到问题四。违反核心审查 #5「内部一致性」+ #4「关键契约」。
- **C2** [`### 逻辑三.异常与失败模式`]：表里"用户拒绝某步改动"行写"该 commit 拆分；但 SKILL.md + template 必须同步"——这是**最关键的不变量**，应升级到「关键契约」节明文写出。当前位置 + 形态读者很容易扫过去。
- **C3** [`### 验证` 节]：5 步流程未交代 commit 时机与 Review Log append 关系。建议明确：(a) 修复 commit 先落地；(b) 用修好的链路跑 dispatch；(c) Review Report append 到 `## Review Log`；(d) 再 commit 一次（doc-only 修订）。

### ⚠️ Warning (8 条)

- **W1** [`## 背景` 节末 + `## 目标` 节首]：4 段散文未显式标主因 vs 辅因。
- **W2** [`### 架构图` ASCII 块]：架构图实为流程图（与下面的流程图职责重叠）。
- **W3** [`### 问题二.方案对比`]：表里"保持 agents/"行"既有约定一致"列理由放错位置。
- **W4** [`### 逻辑一.业务流` 伪代码]：`stripFrontmatter` 注释"5 行"是 magic number，没说来源。
- **W5** [`### 逻辑二.业务流` 伪代码]：字符串字面 replace 不鲁棒，全角/半角差异会静默失败。
- **W6** [`### 逻辑三.业务流` 伪代码]：`0.27.0` 选 minor 而非 patch 的判据不够明确。
- **W7** [`## 目标` "明确不做" + 影响文件树]：198 行数字与实际新文件 223 行差 25 行未解释。
- **W8** [`### 验证` step 3 校验项]：Pass 场景下"必含编号"不成立。

### 💡 Suggestion (5 条)

- **S1** [整篇]：doc 总长 333 行对工程量略重（元评论）。
- **S2** [`### 流程图`]：修复前 vs 修复后用对比表比 ASCII 更紧凑。
- **S3** [`## 实现` 节首段]：段落墙（4-5 句无 break），建议拆两段。
- **S4** [`### 问题四.方案对比`]："frontmatter dump"术语未解释。
- **S5** [`### 验证` 节末尾"注"]：dogfood 闭环应升格为正式 step。

### Self-Audit（4 项卡点）

- placeholder 替换的转义/冲突边界（路径含 `{` `}` 会怎样？）
- commit 边界（几个 commit？append Review Log 是否同 commit？）
- dispatch 失败的降级路径未写
- 业务流 `rmdir` / `delete` 用 git mv 还是 fs mv？

## Verdict
❌ Has issues — 见上方编号清单，用户决定修哪些。
```

**用户决定**：全修 C + W + S + Self-Audit（S1 是元评论无需修，实际修 19 项）。

**本轮修订**：

- **C1**：逻辑一 `buildInputSection` 注释加问题四回扣 + 逻辑二关键契约加"placeholder 集 = `{DOC_PATH}` 单一项，见问题四决策"
- **C2**：逻辑三关键契约首位升格为"原子提交约束（核心不变量）"，明文写出 template + SKILL.md 任一未做都会断链的两种场景
- **C3**：验证节重写为 5 步流程（commit 1 → dispatch → 格式校验 → commit 2 → 判定），明确 commit 边界
- **W1**：背景节首两段重写为"**主因** / **辅因约束**"显式标注
- **W2**：架构节重写，删除原"架构图"（实为流程图），改为"组件关系"图（展示参与组件 + 依赖）+ "流程对比"表（修复前 vs 修复后）
- **W3**：问题二方案对比表"保持 agents/"行的"既有约定一致"列改为"`skills/<name>/agents/` 不在 Claude Code 注册路径，命名约定与系统行为错配"
- **W4**：逻辑一 `stripFrontmatter` 注释改为"读到第二个 `---` 为止"+ 说明原文件 frontmatter 是 name + description 两字段
- **W5**：逻辑二业务流加 `assert old_line in content` 前置校验 + 注释说明"fail-fast，避免静默失败"
- **W6**：逻辑三业务流 `version` 行注释展开 minor 判据（涉及文件位置移动 + 工作流文字 + overlay 同步 → 重于纯 patch 文案修订）
- **W7**：目标节"明确不做"第 1 条改为"约 200 行...最终 template 文件约 220 行（差额是头部注释 + 末尾输入节）"；架构总结去掉硬数字"198 行"；影响文件树加 ① ② ③ ④ 编号 + 最终约 220 行说明；逻辑一关键契约同步改"约 200 行"
- **W8**：验证 step 3 拆成基本校验（任何 Verdict 都需满足）+ Has issues 补充校验 + Pass 补充校验
- **S2**：流程图改为对比表（"阶段 / 修复前 / 修复后"三列）
- **S3**：实现节首段拆两段（"问题二三四合并到逻辑一的原因" / "逻辑二三独立的原因"）
- **S4**：问题四方案对比表"完整集"行 placeholder 集改为"path + type + previous_log + 整段 frontmatter YAML 块"
- **S5**：验证节明确 5 步流程，dogfood 闭环升格为正式 step（commit 2 单独 doc-only）
- **SA1**：逻辑二异常表加"`{DOC_PATH}` 替换边界"行（template 内除 `{DOC_PATH}` 外无其他 `{XXX}` 形式，编辑前 grep 验证）
- **SA2**：逻辑三关键契约加"commit 边界"段，明确 2 个 commit（实施 + Review Log）
- **SA3**：逻辑二异常表加"dispatch subagent 调用失败"行（quota / context 超限 → Task tool 报错给主对话，无自动降级）
- **SA4**：逻辑一业务流改为 `gitMove(src, dst, preserve_history=true)` + 注释"保留 git blame 历史轨迹"

**跳过**：

- **S1**：doc 总长 333 行——元评论，作为 dogfood 第一次完整跑 design-doc 骨架可接受

