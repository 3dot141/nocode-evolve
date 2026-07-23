---
type: design-doc
topic: /sediment 命令——把会话沉淀分流到 wiki/rules 五个出口（含 plugin 层三步联动）
date: 260519
author: 3dot141
status: draft
---

# Design Doc：`/sediment` 沉淀分流命令

## 背景

**核心问题**：现有沉淀机制只覆盖 wiki 一侧——`/project-wiki-distill` 写项目历史记忆、`/user-wiki-distill` 写跨项目个人浓缩长文档。rules 侧（`<project>/.agents-personal/rules/` + `<project>/AGENTS.md` 触发条件，以及插件层 `nocode-evolve/rules/`）**完全靠手写**，没有命令支持。`rules/overlay-agents-personal.md §2` 关于"产生指令值得沉淀时主动建议用户手写"的设计，让 AI 在会话里识别出沉淀点后只能口头提示，落地这一步常被遗忘。

**附带问题**（一并解，但不是 driver）：

1. **两个 wiki 命令记忆负担大**：用户要记 `/project-wiki-distill`（项目专属）vs `/user-wiki-distill`（必填意图 + 跨项目）的边界，容易要么用错命令，要么干脆不沉淀。
2. **plugin 层 rules 沉淀涉及三步联动**：`hooks/inject-rules.sh` 用桶机制注入（PROJECT_FILES / BASELINE_FILES / OVERLAYS_FILES），新增 plugin rule 必须显式加进某个桶，否则 `inject-rules.sh:43-56` 的 sanity check 只会在 stderr 警告、**不阻塞 session**、**不进 context**——等于白沉淀。再加上 `CLAUDE.md` 硬约束"动了 plugin 文件必须升 `plugin.json` 版本"，三步漏一步就坏。
3. **`/user-wiki-distill` 命名表达不直观**：这个命令本质是"带意图、围绕主题浓缩"，"user-wiki" 这个后缀让人误以为它是 wiki 系列分支。

不解决的代价：rules 永远是手写的"二等公民"，会话里识别出的"项目级指令值得沉淀"基本沉淀不下来；plugin 层沉淀因为联动多，要么不做、要么漏步骤。

## 目标

- **一个命令入口** `/sediment` 覆盖 wiki + rules 全量沉淀决策
- **半自动分流**：AI 扫会话识别候选 + 自动贴出口标签 + 用户表格短码改 → 再执行；用户保留兜底权
- **plugin 层三步联动一次完成**：写 rule 文件、改 `inject-rules.sh` 的桶、升 `plugin.json` 版本——命令内串联，不让用户记
- **保留 `/sow`（原 `/user-wiki-distill`）独立**：必填意图、AI 不自判 N 份的反越权设计不变；`/sediment` 在识别到"跨项目可复用"内容时仅作 advisor 提示

## 架构

### 流程图

```
/sediment [topic?]
       ↓
扫会话 → AI 按主题聚类（B1：同主题合并）→ N 个候选
       ↓
每个候选 AI 自动贴标签 ∈ {wiki:project, wiki:cross-project,
                          rules:project, rules:plugin, skip}
       ↓
表格呈现 + 短码交互循环
   ┌──────────────────────────────────────┐
   │ # 主题摘要 | 建议标签 | 落地路径     │
   │ 短码: go / -N / N plug / N wiki ...  │
   └──────────────────────────────────────┘
       ↓ (用户回 `go`)
跨仓写入二次确认（仅 rules:plugin 且 cwd ≠ nocode-evolve 仓时）
       ↓
五出口分发：
  ├─ wiki:project        → <proj>/.agents-personal/wiki/  （沿用 project-wiki-distill 整套）
  ├─ wiki:cross-project  → advisor 提示跑 `/sow <intent>`（不写文件）
  ├─ rules:project       → <proj>/.agents-personal/rules/<slug>.md
  │                        + 编辑 <proj>/.agents-personal/AGENTS.md 加触发条件
  ├─ rules:plugin        → $NOCODE_EVOLVE_REPO/rules/<slug>.md
  │                        + 改 hooks/inject-rules.sh 桶
  │                        + 升 plugin.json version (minor)
  └─ skip                → 不写
       ↓
总报告
```

### 问题拆解

#### 问题一：分流的决策权放谁

说明：候选识别后，"这条该走哪个出口"由谁决定？AI 全自动？用户全选？还是 AI 提议+用户兜底？

方案对比：

- **方案 A：AI 全自动**——AI 一次性识别 + 分流 + 写盘，最后报告。优点：一句话搞定。**否决**：AI 判错 wiki/rules 边界（这是事实记录 vs 当前指令）后果是写错地方，且 cross-project 提示如果埋在最终报告里，用户大概率扫一眼就过、错过提示。
- **方案 B：半自动**——AI 列候选 + 贴建议标签，用户表格短码勾选/调整后执行。
- **方案 C：用户全选**——AI 只列候选，用户逐条告诉 AI 归处。**否决**：与"一个命令搞定"初衷冲突，操作冗余。

结论：选方案 B。AI 用启发式（决策/演进 → `wiki:*`；命令模板/触发条件 → `rules:*`；项目特有术语 → `*:project`；跨项目 AI 行为 → `*:plugin` 或 `wiki:cross-project`）贴初始标签，用户用短码调整。AI 误判不会直接落地；用户参与度也限于"看一眼+几个短码"。

#### 问题二：候选列表怎么呈现 + 用户怎么改

说明：方案 B 决定后，UI 形态有三种主流选择，UX 差异大。

方案对比：

- **方案 A：`AskUserQuestion` multiSelect**——每个候选作为一个 option，用户勾选。**否决**：multiSelect 只能表达"要不要"，改分类要分两轮问；候选多到 5+ 时 UI 拥挤。
- **方案 B：Markdown 表格 + 二轮对话短码**——AI 输出表格，用户回 `go` / `2 plug` / `- 2,5` 之类短码调整，AI 重绘 → loop until `go`。
- **方案 C：临时 plan 文件**——AI 写 `.sediment-plan.md`，用户编辑后再跑 `/sediment confirm`。**否决**：多一步开/关文件，简单场景太重。

结论：选方案 B。短码精简到 6 条（见「实现.逻辑二」）；兼容自然语言（"第 2 改成 plugin"）作兜底，解析不出报"语法不识别"。

#### 问题三：候选粒度——单点还是主题聚类

说明：一次会话讨论了多个相关决策时，是每条决策一项，还是按主题聚成一项？

方案对比：

- **方案 A：强制单点**——每条决策一项。**否决**：一次设计讨论会拆成 5-10 项轰炸用户；且单点经常缺上下文（孤立看"用 advisor 模式"不知道在说什么）。
- **方案 B：AI 主题聚类**——同主题合并为一条。与现 `/project-wiki-distill` 的"自由识别 0-N 个主题"逻辑一致。

结论：选方案 B。粒度由 AI 按会话内容判定；用户在表格里看到的是"主题摘要"，需要拆细可以用 `2 /<new-slug>` 改 slug 或语义指示 AI 拆。

#### 问题四：`rules:plugin` 出口的三步联动怎么保证不漏

说明：plugin 层 rule 沉淀涉及：(a) 写 `nocode-evolve/rules/<slug>.md`，(b) 编辑 `hooks/inject-rules.sh` 把新文件加进某个桶（PROJECT_FILES / BASELINE_FILES / OVERLAYS_FILES），(c) 升 `plugin.json` 的 `version`。漏 (b) 的话 sanity check 只 stderr 警告不阻断、新 rule 不进 session context；漏 (c) 违反 CLAUDE.md 硬约束。

方案对比：

- **方案 A：写完文件后报 reminder**，让用户自己改桶 + 升版本。**否决**：reminder 容易被忽略，且这两步操作纯机械，没有用户判断价值。
- **方案 B：命令内串联三步**——AI 一次完成写文件 + 改 hook 桶 + 升版本；桶分类按 axis 自动启发式（`agent-*` → BASELINE，`overlay-*` → OVERLAYS，其余主动问用户）。
- **方案 C：拆出独立子命令** `/sediment-plugin-finalize`。**否决**：割裂操作；用户在 `/sediment` 报告后还要记得跑下一个命令。

结论：选方案 B。命令内三步原子完成；桶分类 AI 按命名前缀建议、模糊情况主动问；版本默认 `minor`（新增 rule = 新增能力），破坏性变更（如改既有规则的语义反转）由 AI 在 prompt 里识别后建议 `major`。**commit / push 不进 sediment 内部**——按 CLAUDE.md 约定由主交互流程处理。

#### 问题五：跨项目可复用的 wiki 内容怎么走

说明：会话里产出的某条历史记忆如果"不止本项目用得到"（如 AI 工作流的通用经验），是写哪？

方案对比：

- **方案 A：吞掉 `/sow`**——`/sediment` 在 cross-project 分支直接写 `$USER_WIKI_PATH/yymm/`。**否决**：`/sow` 的核心反模式是"AI 不自判 0/N 份"，意图必填；让 `/sediment` 替写就违反了这个反越权设计，可能跨项目沉淀质量稀释。
- **方案 B：advisor**——`/sediment` 识别出"这条跨项目"，输出"建议跑 `/sow <ai 反推的意图候选>`"，不替写文件。
- **方案 C：不处理这一支**——`/sediment` 只管项目层。**否决**：用户记不住"这条该用哪个命令"是核心痛点之一，不该把这层判断丢回给用户。

结论：选方案 B。`/sediment` 识别 + 给意图候选 + 让用户 copy-改-跑；`/sow` 反越权设计保留。

### 架构总结

基于问题 1-5 的结论：`/sediment` 是一个"半自动的分流入口"——AI 扫会话主题聚类、贴出口标签初稿，用户表格短码改，确认后五出口分发。其中 `wiki:project` 沿用 `/project-wiki-distill` 整套逻辑（`/project-wiki-distill` 被吞掉删除）；`wiki:cross-project` 走 advisor 不替执行（保留 `/sow` 独立）；`rules:project` 双写（rule 文件 + AGENTS.md 触发条件）；`rules:plugin` 三步联动（rule 文件 + hook 桶 + plugin.json 版本）；`skip` 列原因不写。下一节展开各文件改动与四条逻辑的实现细节。

## 实现

### 影响文件

```
nocode-evolve/
├── commands/
│   ├── sediment.md                       (NEW)  本命令主文件，约 250-300 行：入参 + 流程 + 各出口落地
│   │                                              + 短码表 + 内嵌精简版 wiki:project 规则（吞 project-wiki-distill）
│   ├── sow/                              (改自 user-wiki-distill/，目录重命名)
│   │   ├── sow.md                        ① 命令名 `/user-wiki-distill` → `/sow`（文件名同步 sow.md）
│   │                                     ② frontmatter description 同步改名
│   │                                     ③ 原 line 11「姊妹命令：/project-wiki-distill」改为
│   │                                          「上游命令：/sediment（识别到跨项目内容时会建议跑本命令）」
│   │                                     ④ 原 line 57-58 调用脚本的命令行
│   │                                          `python3 commands/user-wiki-distill/script.py ...` 改为
│   │                                          `python3 commands/sow/script.py ...`
│   │                                          注：脚本接口与命令名解耦——`--intent / --title / --summary`
│   │                                          三个 flag 名不变
│   │   ├── script.py                     (脚本代码本身不改，仅随目录重命名搬位置)
│   │   └── test_script.py                (同 script.py)
│   └── project-wiki-distill.md           (删)   逻辑被 /sediment 吞掉
├── rules/
│   └── overlay-agents-personal.md        (改)   ① 全文 `/project-wiki-distill` 三处（line 14 「由用户跑 X 维护」、
│                                                  line 56 「沉淀走 X」、line 60 §1「关于沉淀」末段）替换为 `/sediment`
│                                              ② §2 line 108-110 「关于沉淀」语义重写：
│                                                  原文是"建议用户写进 .agents-personal/rules/<topic>.md"
│                                                  改为"建议用户跑 /sediment——命令会自动判断走 wiki:project
│                                                  还是 rules:project 出口"
├── hooks/
│   └── inject-rules.sh                   (改, 仅 rules:plugin 出口触发时)
│                                              桶机制本身不动；仅在「逻辑四 Step 2」追加
│                                              新 rule 文件到 PROJECT_FILES / BASELINE_FILES
│                                              / OVERLAYS_FILES 三选一桶变量末尾
└── .claude-plugin/
    └── plugin.json                       (改)   version 0.35.1 → 0.36.0 (minor：新增 sediment 命令)
```

注意：`/sediment` 命令本身**不实施**到任何 `.sh` 或 `.py`——它是 markdown 命令（slash-command），通过 prompt 指挥 AI 完成所有动作。本 design doc 的「实现」节描述的是 **prompt 应该让 AI 做什么**，不是脚本代码。

### 逻辑一：候选生成（扫会话 + 主题聚类 + 贴标签 + 生成 body）

**对应**：问题一 + 问题三

**前置说明：`sessionHistory` 怎么取**

`/sediment` 是 markdown slash command，不是脚本——它没有 Claude Code 官方的"会话历史"入参。沿用 `/user-wiki-distill` 现成做法：**AI 直接看当前 context window 里的对话内容**，不读任何外部历史文件。这意味着：

- 短会话（context 未压缩）：AI 能完整扫到从会话起点到现在的所有轮次
- 长会话（context 已被自动压缩）：AI 只看得到 summary + 当前未滚出窗口的轮次——压缩前的细节可能丢失

`/sediment` 不为长会话做特殊补救（不去读 transcript 文件、不调外部记忆）。若用户在 context 高水位时跑 `/sediment` 而沉淀质量降低，由用户自己感知"早一点跑"或"带 topic 聚焦"。

**业务流**

```
function generateCandidates(optionalTopicArg):                  // /sediment 主入口的第一步
                                                                 // sessionHistory 不是入参——AI 直接看 context
    relevantTurns = scanContext(optionalTopicArg)                // 在 AI 当前 context window 里筛轮次
                                                                  // 带参时仅保留与 topic 相关的；不带参则全量
    themes = clusterByTheme(relevantTurns)                       // AI 按主题聚类（B1 模式）
                                                                  // 同主题决策合并成一条，不强制单点
    candidates = []
    forEach theme in themes:
        summary = oneLineSummary(theme)                           // ≤40 字摘要
        label = pickLabel(theme)                                  // 启发式贴标签（见下方"标签启发式"）
        slug = deriveSlug(theme)                                  // kebab-case 3-5 词
        path = computePath(label, slug)                           // 按 label 算出最终落盘路径
        body = renderBody(theme, label)                           // 现在就生成最终文件正文：
                                                                  //   wiki:* → 按 wiki page body 结构
                                                                  //   rules:* → 按 rules topic body 结构
                                                                  // 落盘阶段 write(path, body) 直接用，不再二次生成
        candidates.append({ summary, label, slug, path, body })

    return candidates

// 标签启发式（AI 内部使用，不需要 hard-coded）：
//   if 决策回溯/演进/术语定义/踩坑      → wiki:*
//   if 命令模板/触发条件/工作流约定     → rules:*
//   if 项目特有业务术语/具体代码路径    → *:project
//   if 跨项目通用 AI 行为/skill 覆盖    → *:plugin (cwd 是 nocode-evolve 仓)
//                                       或 wiki:cross-project (cwd 不是)
//   if 一次性进度/通用 best practice    → skip
```

**关键契约**

- 候选在前置阶段就附带完整 `{ summary, label, slug, path, body }`——后续呈现/分发不再回头补字段
- `body` 字段在候选阶段就生成，避免分发阶段还要回去看会话上下文——分发只剩"决定写哪 + 写什么"两件事
- `optionalTopicArg` 传入时，与 topic 无关的轮次完全忽略；不传时全量扫 context
- "聚类粒度"由 AI 自决，但需要保证摘要≤40 字、用户能 grasp"这条在说什么"

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| 0 候选 | 会话全是一次性进度 / 通用 best practice | 报"本次无可沉淀内容"，停 | 上抛到用户 |
| 全 skip 候选 | AI 识别到主题但全部判 skip | 报"识别 N 项均建议跳过 + 原因"，停 | 上抛到用户 |
| `optionalTopicArg` 在会话里无对应内容 | 用户带参但 topic 不在会话中 | 报"未找到 topic 相关内容"，停 | 上抛到用户 |
| context 已被压缩到只剩 summary | 长会话 | AI 仍按可见内容尽力生成候选；在表格脚注里加 "⚠ context 部分被压缩，沉淀可能不完整" | 上抛到用户 |

### 逻辑二：候选呈现与短码交互

**对应**：问题二

**业务流**

```
function interactWithUser(candidates):                          // 第二步：呈现表格 + 短码循环
    while true:
        renderTable(candidates)                                 // Markdown 表格：# / 摘要 / 标签 / 路径
        printShortcodeHelp()                                    // 6 条短码说明（见下方"短码表"）
        userInput = readUserReply()

        if userInput == "go" or userInput == "done":
            break                                                // 退出循环进入执行阶段

        parsed = parseShortcode(userInput)                       // 严格按短码语法解析
        if parsed == null:                                       // 短码不识别
            print("语法不识别，请用短码：go / -N / N plug / N wiki / N rules / N /slug")
            continue                                              // 不走自然语言 fallback——markdown command
                                                                  // 里 AI 解析 NL 精度不可控，可能错解意图
                                                                  // （"改 2 和 3" 容易被理解为"删"）

        applyChange(candidates, parsed)                          // in-place 改 candidates，下轮重绘

    return candidates

// 短码表（精简版，严格语法）：
//   go              全按建议执行（同 done）
//   - 2,5           跳过 #2 #5 后执行其他
//   2 plug          第 2 升 plugin 层（rules:proj → rules:plug 或 wiki:proj → wiki:cross）
//   2 wiki          第 2 切到 wiki 轴（保持 scope）
//   2 rules         第 2 切到 rules 轴
//   2 /foo-bar      改第 2 的 slug
```

**关键契约**

- 表格列固定：`# / 摘要 / 标签 / 路径`；不增列不减列
- 短码"位置数字 + 操作词"模式；不引入键值对语法（如 `2.label=...` 太重）
- **不接受自然语言**——短码不识别就报错，要求用户重打。理由：在 markdown command 上下文里让 AI 解析自由文本，失败模式不是 binary 的"懂/不懂"，而是"懂错"——容错收益远低于误执行风险
- `2 plug` 的语义按当前 label 自动推断："切到 plugin 等价语义"——rules 轴是 `rules:plug`，wiki 轴是 `wiki:cross-project`

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| 用户给的 # 越界 | `7 plug` 但只有 5 项 | 报"#7 不存在，当前候选 1-5"，不动 candidates | 上抛到用户 |
| 用户改完所有项为 skip 仍 `go` | 全 skip | 提示"全 skip 等价 0 候选，确认继续？(yes/no)"，no 退出 | 上抛到用户 |
| 短码无法识别 | 用户写自然语言或拼错短码 | 报"语法不识别，请用短码：go / -N / N plug / N wiki / N rules / N /slug"，等用户重打 | 上抛到用户 |

### 逻辑三：五出口分发

**对应**：问题一 + 问题五（cross-project advisor）

**业务流**

```
function dispatch(candidates):                                  // 第三步：按标签分发到各出口
    confirmed = filterNonSkip(candidates)                       // skip 项不进入分发

    if hasPluginCandidates(confirmed) and cwd != nocodeEvolveRepo:  // 跨仓写入二次确认
        if not askYesNo("项 #X 将写入 ~/AI/nocode-evolve/，确认？"):
            return                                              // 用户拒绝，整次 sediment 终止

    forEach c in confirmed:
        switch c.label:
            case "wiki:project":
                writeWikiProject(c)                             // 按内嵌的 wiki:project 规则执行
                                                                 // （见下方"内嵌的 wiki:project 规则"）
            case "wiki:cross-project":
                emitAdvisorPrompt(c)                            // 不写文件，只输出"建议跑 /sow <intent>"
            case "rules:project":
                writeProjectRule(c)                             // 见"项目层 rules 双写"
            case "rules:plugin":
                writePluginRule(c)                              // 见逻辑四
            // skip 已在前一步过滤

    printSummaryReport(candidates)                              // 总报告

// wiki:project 出口（内嵌规则）：
function writeWikiProject(c):
    indexPath = `<proj>/.agents-personal/wiki/INDEX.md`
    if exists(indexPath):
        decision = decideIntegration(c, indexPath)               // 三档：整合 / 新建+ see also / 新建
                                                                  // 决策规则见下方"内嵌的 wiki:project 规则"
    else:
        decision = "new"                                          // 首次沉淀，必为新建
    applyDecision(c, decision)                                    // 写 pages/<slug>.md 或合并到现有页
    rebuildIndex(indexPath)                                       // 派生 INDEX：扫 pages frontmatter

// 项目层 rules 双写：
function writeProjectRule(c):
    write(`<proj>/.agents-personal/rules/${c.slug}.md`, c.body)  // 文件名只用 slug，不带日期
                                                                  // rules 是当前指令不是历史记录
    agentsPath = `<proj>/.agents-personal/AGENTS.md`
    if not exists(agentsPath):
        askUser("AGENTS.md 不存在，怎么办？(1)创建骨架 (2)跳过 (3)终止")
        // 详见下方"异常表"
    insertTriggerEntry(agentsPath, c.topic, c.slug)              // 在合适分组下加触发条目
                                                                  // 分组归属 AI 提议、用户能改

// Advisor prompt 格式（简化版——env 校验交给 /sow 自己处理）：
function emitAdvisorPrompt(c):
    intent = derivIntent(c.theme)                                // 反推一句"想抽取什么内容"
    print(`建议跑: /sow ${intent}`)
    print(`原因: ${c.crossProjectReason}`)
    // 注：不在这里校验 $USER_WIKI_PATH 是否设置——这是 /sow 自己的责任
    // 见 commands/sow/sow.md 的 env 依赖节。advisor 模式 = "我不写、你跑下条命令"，
    // 替 /sow 校验属于越权
```

**内嵌的 wiki:project 规则**（精简版，从原 `/project-wiki-distill` 吞过来）：

整合判断决策树：

```
对每个 wiki:project 候选，看 INDEX.md 已有 description：
  ┌─ 强相关：同一系统/同一决策的不同侧面/演进 → 整合进该页
  ├─ 弱相关：提到但主题不同                  → 建新页 + 已有页加 see also
  └─ 无关                                    → 建新页
```

Page frontmatter schema:

```yaml
---
slug: <kebab-case-unique>
title: <一句话标题>
date: <yymmdd>             # 首次创建日期，永远不变
last_updated: <yymmdd>     # 整合时更新；首次创建时不写
description: <一句话简介>
---
```

INDEX.md 派生：扫 `pages/*.md` frontmatter，按 date 倒序、同日 slug 字母序重写整个 INDEX。

反模式（继承自原 project-wiki-distill）：

- ❌ 末尾 paste 整合（懒整合，不是整合）
- ❌ 写空文件凑数
- ❌ slug 用日期（slug 是主题标识，不带日期）

详细写作要点见原 `commands/project-wiki-distill.md` 的 git 历史（删除前的 commit 保留完整规则）。

**关键契约**

- `wiki:project` 出口的整合判断 / frontmatter / INDEX 派生**完全沿用** project-wiki-distill 历史逻辑——`sediment.md` 实施时把上述精简规则直接内嵌进 prompt，不再依赖 `project-wiki-distill.md` 文件存在
- `wiki:cross-project` 输出 advisor 必须包含 intent 候选——让用户能直接 copy 改用，不要只丢一句"建议跑 /sow"
- `wiki:cross-project` advisor **不替 /sow 校验 env**——`$USER_WIKI_PATH` 是否设置由 `/sow` 自己处理（见 `commands/sow/sow.md` env 依赖节）
- `rules:project` 的 AGENTS.md 触发条目必须"具体到 AI 自识别"——遵循 `rules/overlay-agents-personal.md §2 AGENTS.md 触发条件写法`
- `rules:plugin` 详见逻辑四
- 整体执行不是 transactional——某项写失败不回滚已成功项，但报告里要明确列出失败项与原因

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| `<proj>/.agents-personal/AGENTS.md` 不存在 | 项目首次沉淀 rules | 三选一：(1)创建骨架（含路由表说明 + 该项触发条目）(2)跳过这一项 (3)终止 sediment | 上抛到用户 |
| `rules:project` slug 冲突 | 同 slug 已存在 | 报错让用户改 slug：`N /<new-slug>` | 上抛到用户 |
| `wiki:project` slug 冲突 | 同日同 topic | 走整合判断（见上方"内嵌规则"） | 内部处理 |
| `$NOCODE_EVOLVE_REPO` 路径不存在 | env 错指或仓库未克隆 | `rules:plugin` 标签在表格里降级 disabled + 标灰 | 上抛到用户 |

### 逻辑四：plugin 出口三步联动

**对应**：问题四

本逻辑独立成节是因为 `rules:plugin` 涉及三步原子动作 + 一处全局副作用（plugin.json 版本），复杂度足以单独讨论，且这部分逻辑**不在架构 problem 1-5 直接展开**，属于实施层细节。

**业务流**

```
function writePluginRule(c):                                    // rules:plugin 出口的三步联动
    // Step 1: 写 rule 文件
    axis = pickAxis(c)                                          // {agent, overlay, tool}
                                                                 // 启发式：内容是行为基线 → agent
                                                                 //         覆盖第三方 skill 默认 → overlay
                                                                 //         工具调用约定 → tool
                                                                 // 模糊时主动问用户
    fileName = `${axis}-${c.slug}.md`                           // 命名沿用 nocode-evolve/rules/ 现有风格
    filePath = `${NOCODE_EVOLVE_REPO}/rules/${fileName}`
    if exists(filePath):
        abort("slug 冲突: " + fileName + "，请用 N /<new-slug> 改 slug 后重试")
    write(filePath, c.body)

    // Step 2: 改 hooks/inject-rules.sh 把新文件加进对应桶
    bucket = pickBucket(axis)                                   // axis=agent → BASELINE_FILES
                                                                 // axis=overlay → OVERLAYS_FILES
                                                                 // axis=tool 或其他 → 主动问用户
    appendToBucket(filePath = `${NOCODE_EVOLVE_REPO}/hooks/inject-rules.sh`,
                   bucket,
                   newEntry = `"${PLUGIN_ROOT}/rules/${fileName}"`)
                                                                 // 实施策略（具体到 Edit 工具调用）：
                                                                 // 1. Read inject-rules.sh，定位 `${bucket}=(` 段
                                                                 // 2. 找到该桶最后一个数组元素整行（如 `  "${PLUGIN_ROOT}/rules/overlay-gitworktree.md"`）
                                                                 // 3. Edit: old_string = 该行整行
                                                                 //          new_string = 原行 + "\n  " + newEntry
                                                                 // 4. 保持桶变量结尾的 `)` 行不动
                                                                 // 不用 sed/awk——Edit 工具明确语义更可靠

    // Step 3: 升 plugin.json 版本
    bumpLevel = pickBumpLevel(c)                                // 启发式：新增 rule → minor
                                                                 //         改既有规则语义反转 → major
                                                                 //         文案修订 → patch (rarely)
    bumpVersion(`${NOCODE_EVOLVE_REPO}/.claude-plugin/plugin.json`, bumpLevel)

    // Report:
    print(`已写入 plugin rule: ${fileName}`)
    print(`桶: ${bucket}`)
    print(`版本: ${oldVersion} → ${newVersion} (${bumpLevel})`)
    print(`请到 nocode-evolve 仓 review + commit + 询问是否 push。`)
                                                                 // 不替用户 commit
                                                                 // 按 CLAUDE.md 工作流由主交互处理
```

**关键契约**

- 三步必须按顺序：先写文件 → 再改桶 → 再升版本；任一步失败后续不执行
- **本逻辑内三步不回滚已成功步**（避免半成品状态更难恢复，详见异常表）；**但本项失败不影响其他候选项的分发**——与「逻辑三契约」"整体非 transactional" 一致
- **`appendToBucket` 用 Claude Code 的 Edit 工具实施**——old_string 锚定该桶最后一个数组元素整行，new_string 是原行 + "\n  " + 新条目。理由：sed/awk 对 bash 数组字面量的多行匹配脆弱；Edit 工具的精确字符串匹配更可靠
- 桶选择启发式按 axis 给默认，但**模糊情况必须主动问**——不静默选 PROJECT_FILES（这个桶语义是"项目路由"，乱填会破坏 hook 拆桶设计）
- **孤儿 rule 划界**：`/sediment` 只补**本次创建的** plugin rule 的桶条目；如果发现 `nocode-evolve/rules/` 下有未分桶的孤儿文件（如 `tool-git-inspection.md` 历史遗留——inject-rules.sh sanity check 每 session stderr 警告但不阻断），**不主动补**——归用户手动处理。理由：scope 控制——`/sediment` 是沉淀命令，不是 hook 整理工具
- 版本默认 `minor`——**类比依据**：`CLAUDE.md:21-25` 列了"新增 hook / skill / 兼容性增强 = minor"；rule 是 plugin 提供的"自动注入能力"，与 hook / skill 同属"插件能力扩展"层级，故 rule 新增 = minor。`major` 需要 AI 在 prompt 里识别"破坏性变更"信号（如会话明确说"反转既有规则"、"删除已部署规则"）
- commit/push 不进本逻辑——CLAUDE.md 工作流约定 commit 由主交互完成

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| Step 1 写文件后 Step 2 改 hook 失败 | hook 脚本格式预期外（被人手改过、桶变量重命名） | **不回滚 Step 1**（文件保留——比删了让用户从头来更易恢复），报"写入了 rule 文件但 hook 桶未改，请手动加" | 上抛到用户 |
| Step 2 后 Step 3 改 plugin.json 失败 | json 格式异常 | **不回滚前两步**，报"前两步完成但版本未升，请手动改 plugin.json" | 上抛到用户 |
| axis 启发式判不出 | 内容跨多维度 | 主动问用户：`axis: (1) agent (2) overlay (3) tool` | 上抛到用户 |
| 桶选 PROJECT_FILES | 仅当用户明确选 | 接受但提醒"PROJECT_FILES 桶语义是项目路由，确认？(yes/no)" | 上抛到用户 |
| nocode-evolve 仓有未提交改动 | 跨仓写入时 | 不阻断，报告里加一行"主仓也有未提交改动 + 插件仓有新文件，两边都要 commit" | 上抛到用户 |
| `nocode-evolve/rules/` 下有未分桶孤儿文件 | 历史遗留（如 `tool-git-inspection.md`） | **不主动补桶**——超出 `/sediment` 职责范围；在报告末尾加 "ℹ️ 发现孤儿 rule N 个：[...]，sanity check 已警告，请手动处理"（仅提示） | 上抛到用户 |

---

## Review Log

### Review 1 — 2026-05-19

<details>
<summary><b>Reviewer Report 全文</b></summary>

**Doc**: `docs/dev/3dot141/260519-01-sediment/sediment-design.md`
**Type**: design-doc

#### ❌ Critical

- **C1** [`### 影响文件` `overlay-agents-personal.md` 改动描述]：自报"§1 两处 + §2 关键词替换"与源码不符。核 `rules/overlay-agents-personal.md:108-110` 后，§2 「关于沉淀」**没出现** `/project-wiki-distill` 字样。需要改的应当是含 `/project-wiki-distill` 的 §1 末段，以及 §2 同名节的**语义重写**。
- **C2** [`### 实现` 全局]：**`sessionHistory` 怎么取没说**——slash command 没官方"会话历史"入参；没明示沿用 AI context window 看法、也没说长会话被压缩后怎么办，实施时第一行就卡住。
- **C3** [`### 影响文件` × `### 逻辑三.关键契约`]：**"删 project-wiki-distill" 与 "在删除前先把规则节抽出来内嵌进 sediment.md" 自相矛盾**；project-wiki-distill.md 约 180 行全抽进去会变 ~400 行（与自报"约 200 行"冲突）。

#### ⚠️ Warning

- **W1** [`## 背景`]：`inject-rules.sh:44-56` 行号错位——实际 sanity check 从 line 43 起。
- **W2** [`### 影响文件`]：`hooks/inject-rules.sh` 标 (不改) 与「逻辑四 Step 2」冲突。
- **W3** [`### 逻辑四 Step 2`]：`appendToBucket` 实现策略缺失。
- **W4** [`### 流程图` + `### 逻辑三 异常表`]：孤儿 rule 未覆盖（`rules/tool-git-inspection.md` 实际不在任何桶里）。
- **W5** [`### 逻辑三.业务流`]：`callProjectWikiDistillLogic(c)`——markdown command 不是函数，没 import 机制。
- **W6** [`### 逻辑三 异常表` 末行]：`$USER_WIKI_PATH` 校验没必要由 sediment 替 sow 做。
- **W7** [`### 逻辑二.业务流` `parseNaturalLanguage`]：NL fallback 在 markdown command 里精度无法保证，可能错解意图。

#### 💡 Suggestion

- **S1** 流程图加短码示例
- **S2** 问题二.方案对比 否决理由量化
- **S3** 影响文件 sow/ ① 拆细
- **S4** 标签启发式拆 wiki/rules 与 project/plugin 两轴
- **S5** axis 集合 {agent, overlay, tool} 来源显式声明

#### ❓ Open Questions

- **Q1** sow.md ③ /sow 与 /sediment 关系如何描述
- **Q2** sow/script.py 调用路径是否被 ① 覆盖
- **Q3** "新增 rule = minor" 依据

#### Self-Audit

- **SA1（与 C2 同根）** sessionHistory 来源
- **SA2（与 C3 同根）** callProjectWikiDistillLogic 调法
- **SA3** `c.body` 字段哪来
- **SA4（与 SA3 同根）** writePluginRule 同
- **SA5** sow/script.py 的 argparse flag 是否改
- **SA6** 「逻辑三契约」"不 transactional" vs 「逻辑四契约」"三步不回滚" 措辞容易混

#### Verdict
❌ Has issues

</details>

**用户决定**：fix C1, C2, C3, W1, W2, W3, W4, W5, W6, W7, SA3, SA5, SA6（SA1/SA2/SA4 与 C2/C3/SA3 同根，处理 C/SA3 时一并解）；answer Q1, Q2, Q3；skip S1-S5。

**本轮修订**：

- **C1**：「影响文件」`overlay-agents-personal.md` 行的描述对齐源码——① 改为"全文 `/project-wiki-distill` 三处（line 14/56/60）"，② 改为"§2 line 108-110 「关于沉淀」**语义重写**"（不是关键词替换）
- **C2 / SA1**：「逻辑一」加「前置说明：`sessionHistory` 怎么取」节——沿用 `/user-wiki-distill` 模式（AI 直接看 context window），不读外部历史；长会话压缩时不补救，在表格脚注加"⚠ context 部分被压缩"提示。同步把业务流 `function generateCandidates(sessionHistory, ...)` 改为 `function generateCandidates(optionalTopicArg)`，内部用 `scanContext()` 而非 `filterRelevant(sessionHistory, ...)`
- **C3 / SA2 / W5**：「逻辑三业务流」`callProjectWikiDistillLogic(c)` 改为 `writeWikiProject(c)`；新增「内嵌的 wiki:project 规则」节（精简版，约 30 行——整合判断决策树 + frontmatter schema + INDEX 派生 + 3 条反模式），不再抽 180 行规则进 sediment.md；「影响文件」`sediment.md` 自报行数改为"约 250-300 行"
- **W1**：`inject-rules.sh:44-56` → `:43-56`
- **W2**：「影响文件」`hooks/inject-rules.sh` 标 `(改, 仅 rules:plugin 出口触发时)` + 行内说明
- **W3**：「逻辑四 Step 2」`appendToBucket` 加 4 步实施策略（Read → 定位末元素 → Edit old/new_string → 保留 `)` 行）；「关键契约」加一条解释"用 Edit 不用 sed/awk"的理由
- **W4**：「逻辑四关键契约」加"孤儿 rule 划界"——只补本次创建的，孤儿不主动补；「异常表」加孤儿场景行
- **W6**：「逻辑三业务流」`emitAdvisorPrompt` 注释说明"不替 /sow 校验 env"；「异常表」删除 `$USER_WIKI_PATH` 未设那行；「关键契约」加一条"不替 /sow 校验"
- **W7**：「逻辑二业务流」砍 `parseNaturalLanguage` fallback——短码不识别直接报错重打；「关键契约」加"不接受自然语言"+ 理由；「异常表」"自然语言解析有歧义"行改为"短码无法识别"
- **SA3 / SA4**：「逻辑一业务流」候选 dict 加 `body` 字段（`renderBody(theme, label)` 在候选阶段生成）；「关键契约」加"body 字段在候选阶段就生成"
- **SA5**：「影响文件」`sow/` 节 ④ 加"脚本接口与命令名解耦——`--intent / --title / --summary` 三个 flag 名不变"
- **SA6**：「逻辑四关键契约」加"本逻辑内三步不回滚但本项失败不影响其他候选项的分发——与逻辑三契约一致"

**Open Questions 答复**：

- **Q1**：选"上游 advisor 关系"。`sow.md` line 11 改为「上游命令：/sediment（识别到跨项目内容时会建议跑本命令）」。已写入「影响文件」`sow/sow.md ③`
- **Q2**：选"不覆盖，单列一条"。「影响文件」`sow/sow.md` 节新增 ④ 项，明确 `python3 commands/user-wiki-distill/script.py ...` → `python3 commands/sow/script.py ...`；脚本接口（flag 名）与命令名解耦不动
- **Q3**：选"类比新增 hook/skill/兼容性增强"。「逻辑四关键契约」补一条引用 `CLAUDE.md:21-25` 的类比依据

