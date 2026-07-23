---
type: design-doc
topic: /user-wiki-distill 把会话浓缩成长文档归档到用户 vault Outputs 层
date: 260514
author: 3dot141
status: draft
---

# Design Doc：/user-wiki-distill 命令设计

## 背景

**核心问题**：现有 `/project-wiki-distill` 把项目级会话沉淀写到 `<project>/.agents-personal/wiki/`，只覆盖了「per-project 历史记忆」一类诉求。**另一类诉求没被任何命令覆盖**——把当前会话围绕用户指定的意图浓缩成一份完整长文档，归档到用户的个人知识库（vault）的 AI 产物层。

具体场景：用户在 Claude Code 会话里和 AI 讨论了某个跨项目的设计/分析/决策（如本次的 user-wiki-distill 设计本身），讨论结束后想保留一份「完整叙事的归档文档」而非切碎的项目级 wiki 页。目前用户只能手动复制粘贴到 vault，再手写 frontmatter（含算 32 位 permalink hash、拼 `yymm` 路径、起 title、写时间戳），重复劳动且易拼错。

**附带问题**（本 doc 不解决）：
- vault 内部的 wiki ingest / promote / 切原子页流程目前不存在——MyJarvis 早期的 `super-jarvis` / `myjarvis-brain` skill 已废弃（前者改名后者也过时），distill 产物的「后续生命周期」没有任何自动化承接
- 用户 vault 的目录约定（`Memory/05-Outputs/yymm/yymmdd-<title>.md`）和 MyJarvis 强绑定，非 MyJarvis 用户用本命令需自行配置 env 指向类似结构的目录

不解决的代价：用户每次想沉淀一份长文档都要手工产出 8 字段 frontmatter，permalink hash 大概率算错或忘填，时间戳格式偏差，最终 vault 里 distill 产物和手写文档格式不一致——无法用统一规则（Obsidian search / Bases 过滤）找回。

## 目标

- 用户在 Claude Code 会话末尾跑 `/user-wiki-distill <意图>` → 自动产出一份完整长文档归档到 `$USER_WIKI_PATH/yymm/yymmdd-<title>.md`
- 产出 frontmatter 与 MyJarvis Memory/Outputs 现有文档**字段一致**（aliases / draft / tags / summary / created_date / modified_date / permalink），额外新增 `source: chat-distill` 标记 AI 产物
- 决策权全部归用户：意图必填（无参报错），AI 仅在「会话相关实质内容不足」时 veto——判据**清单固定**为 2 条 OR（相关讨论<3 轮 或 无被采纳决策），AI 不会引入第三条软信号；但每条信号本身仍需 AI 读 session history 后软启发判断（不是机器可数指标）
- python 脚本承担所有「非创造性纯格式化」工作（permalink uuid / 时间戳 / yymm 路径 / yaml 拼装），AI 只做「内容抽取 + title 反推 + summary 概括 + body 浓缩」
- 命令通用性：不硬编码 MyJarvis 路径，通过 `$USER_WIKI_PATH` env 解耦——MyJarvis 用户 `export USER_WIKI_PATH=~/AI/MyJarvis/Memory/05-Outputs`，其它 vault 用户指向各自的 AI 产物根目录即可

## 架构

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│ Claude Code Session                                     │
│                                                         │
│  User: /user-wiki-distill <intent>                      │
│                       ↓                                 │
│  AI: 抽取 / 反推 title / 写 summary / 写 body 四段式     │
│                       ↓                                 │
│  Bash: python commands/user-wiki-distill/script.py \    │
│          --intent <...> --title <...> --summary <...>   │
│                       ↓                                 │
│  Script: 算 frontmatter + path + 检冲突                 │
│                       ↓ stdout (两段)                    │
│  AI: 拼 frontmatter + body → Write 工具落文件           │
│                       ↓                                 │
│  AI: 报告 "沉淀到 <相对路径>（permalink: posts/xxxx）"  │
└─────────────────────────────────────────────────────────┘
                       ↓ (写入 vault)
┌─────────────────────────────────────────────────────────┐
│ $USER_WIKI_PATH (e.g. ~/AI/MyJarvis/Memory/05-Outputs)  │
│                                                         │
│  2605/                                                  │
│  └── 260514-user-wiki-distill命令设计.md  (NEW)         │
└─────────────────────────────────────────────────────────┘
```

### 流程图

```
开始
  ↓
检 $ARGUMENTS ──空→ 报错"请说明意图" → 停
  ↓ 非空
检 $USER_WIKI_PATH env ──空 / 目录不存在→ 报错 → 停
  ↓ 已设 + 目录存在
AI veto 判断 ──实质内容不足→ 报告"内容不足" → 停
  ↓ 内容足
AI: 围绕 intent 抽取 + 反推 title + 写 summary + 写 body 四段式
  ↓
Bash: python script.py --intent ... --title ... --summary ...
  ↓
Script: 算 created_date / yymm 路径 / permalink / mkdir -p
  ↓
Script: check 路径冲突 ──存在→ stderr exit 1 → AI 转告用户 → 停
  ↓ 不冲突
Script stdout: frontmatter 字符串 + 目标路径
  ↓
AI: 拼 "frontmatter + body" → Write 工具落文件
  ↓
AI: 报告 "沉淀到 <相对路径>（permalink: posts/xxxx）"
结束
```

### 问题拆解

#### 问题一：命令的语义边界——project 版的扩展 vs vault 对接 vs 完整 ingest

说明：起点是「基于 MyJarvis 重构生成一个 user-wiki-distill」——但「用户级」至少有三种可能语义，产物形态、文件契约、未来扩展空间都不同，必须先选一条。

方案对比：

- 方案 A：**对称扩展**。和 project 版同结构（`INDEX.md` + `pages/yymmdd-<slug>.md`），写到 `~/.agents-personal/wiki/`，沉淀「跨项目的用户偏好/做事方式」——否决：用户的实际需求是把会话作为完整长文档归档到 vault，不是积累扁平 wiki 池。
- 方案 B：**vault 对接 Outputs 层**。产出整篇长文档归档到 `$USER_WIKI_PATH/yymm/<file>`，frontmatter 与 vault 现有 Outputs 一致，命令负责"浓缩+归档"一步到位。
- 方案 C：**完整 ingest + promote 三层**。命令兼三层：写 `Memory/99-Wiki/` 草稿 + 提供 promote 子命令到 `Knowledge/99-Wiki/`——否决：vault 内部 wiki ingest 流程目前没有任何自动化承接（`super-jarvis` / `myjarvis-brain` 已废），让一个通用插件命令包圆「通用 wiki 操作」等于强行替代不存在的 skill，过度设计。

结论：选方案 B。命令职责严格限定在「会话 → 长文档 → Outputs 层」一步，写完即终态；后续 promote / 切原子页等由人在回路决定（用户手动或未来其它命令承接）。

#### 问题二：vault 路径如何获取——硬编码 vs env vs 参数 vs 配置文件

说明：方案 B 选定后，命令要写到 `<vault>/yymm/...`，`<vault>` 从哪里来？决策影响通用性边界——命令是 MyJarvis 专用工具还是通用插件。

方案对比：

- 方案 A：**env `$USER_WIKI_PATH` 指向 Outputs 根**目录（不是 vault 根），命令内部只拼 `$USER_WIKI_PATH/yymm/<file>`。
- 方案 B：硬编码 `~/AI/MyJarvis/Memory/05-Outputs`——否决：插件变成单用户专用，marketplace 分发后别人无法使用。
- 方案 C：每次调用 `--vault-path` 参数传入——否决：调用摩擦大，用户每次都要记路径。
- 方案 D：独立配置文件 `~/.config/nocode-evolve/vault.toml`——否决：增加独立配置机制，与现有 env 占位符约定（`rules/agent-about.md`）风格不一致。

env 为何指 Outputs 根而非 vault 根：变量名 `USER_WIKI_PATH` 表达「用户的 AI 沉淀根」——MyJarvis 用户 `export USER_WIKI_PATH=~/AI/MyJarvis/Memory/05-Outputs`，非 MyJarvis 用户可指任意目录（如 `~/Documents/ai-distill`）；命令不依赖任何 vault 内部结构（如 `Memory/05-Outputs/` 这种命名），通用性最好。

结论：选方案 A。env `$USER_WIKI_PATH` 指 Outputs 根，命令按 `yymm/yymmdd-<title>.md` 约定拼路径；env 未设时**报错并提示在 shell rc export**，不假设默认值——避免写错地方。

#### 问题三：拍板权归属——AI 自判 vs 用户必填意图

说明：会话末尾跑 distill 时，「该不该写 / 写什么主题 / 写多少份」的决策权归谁？AI 自判简单但容易产垃圾或漏写；用户必填意图增加输入摩擦但拍板权清晰。

方案对比：

- 方案 A：**AI 自判 0/1/N 份**。无参时 AI 扫会话识别"值得沉淀"主题，输出 N 份独立文档——否决两点：(1)「值得沉淀」是软指标，AI 自识别不稳定（不同 AI 实例判断不一致）；(2) 一次产 N 份违背 B 路线「长文档归档」语义，等于退回 wiki 切片。
- 方案 B：**`$ARGUMENTS` 必填意图**，AI 围绕意图筛会话内容浓缩 1 份。AI 仅在「会话里关于该意图的实质内容不足」时 veto——判据**清单固定**为 2 条 OR（相关讨论轮次<3 或 无被采纳决策），AI 不引入第三条软信号；每条信号本身仍需 AI 软启发判断。
- 方案 C：**双参数显式拆 `--title / --intent`**——否决：title 由 AI 从「意图+实际抽到内容」反推更准（用户写意图时还不知道 AI 会抽出什么），双参数让用户做了不该做的事。

结论：选方案 B。意图必填消除「AI 主观判该不该写 / 写什么主题」这两类宏观决策；AI 残留的拍板权只剩「内容不足时 veto」一窄场景，且**判据清单固定**（2 条 OR，不允许 AI 加第三条）——AI 仍需软启发判断每条信号（"轮次"、"决策"读 history 后裁定），不是机器可数；但**判据 surface 不可扩展**，与"AI 自判 0/N 份"那种开放裁量本质不同。

#### 问题四：frontmatter 生成机制——AI 硬编 vs python 脚本

说明：MyJarvis Outputs 现有文档 frontmatter 含 7 字段（本 doc 新增 `source` 共 8 字段），其中 4 个是「非创造性纯格式化」工作（permalink uuid、`created_date`、`modified_date`、`yymm` 路径）——AI 在会话里手编每次都可能出小错（permalink hash 拼错位数 / 日期格式偏差 / yymm 拼错），且没有任何创造性可言。

方案对比：

- 方案 A：**AI 在 prompt 模板里硬编全部 frontmatter**——否决：permalink 用 md5 算 AI 容易拼错 32 位 hex、日期格式不稳、跑出来的 frontmatter 与 vault 现有不一致。
- 方案 B：**python 脚本承担 frontmatter 生成**（permalink uuid / 时间戳 / yymm 路径 / yaml 格式化），脚本 stdout 输出 frontmatter 字符串 + 目标路径；AI 用 Write 工具落文件。
- 方案 C：**脚本生成 frontmatter 并直接落文件**，AI 不参与文件 I/O——否决：AI 失去对最终产物的可观察性（用户审 diff 时看到 subprocess 副作用而非 Write tool 调用），调试不方便。

AI 仍负责 Write 而非脚本的理由：AI 的标准动作是 Read/Write/Edit；脚本只做纯函数计算，文件 I/O 走 AI 标准工具——故障可观察（Write 前 AI 能 inspect frontmatter 内容）、人在回路（用户审 diff 看到 Write tool 调用而非 Bash 副作用）。

结论：选方案 B。脚本承担 frontmatter 计算和路径拼接，stdout 双段输出（frontmatter 字符串 + 目标路径）；AI 拼装「frontmatter + body 四段式」用 Write 落文件。脚本职责轻、纯函数易测；AI 职责创造性高，二者切分清晰。

### 架构总结

基于问题 1-4 的结论：命令走 vault 对接路线（不做项目级扩展，不做完整 ingest 流程）；vault 路径靠 `$USER_WIKI_PATH` env 解耦 MyJarvis 内部结构；拍板权归用户（意图必填），AI 仅在「内容不足」时 veto（判据清单固定 2 条 OR，单条仍需 AI 软启发）；frontmatter 生成切分给 python 脚本（纯函数），AI 负责内容字段 + Write 落文件。下一节展开各文件改动与逻辑实现。

## 实现

### 影响文件

```
nocode-evolve/
├── commands/
│   ├── project-wiki-distill.md             (留)  扁平 md 不动；不强制对称改成目录结构
│   └── user-wiki-distill/                  (NEW) 命令独立子目录
│       ├── user-wiki-distill.md            (NEW) ① frontmatter 含 description + argument-hint
│       │                                          ② "入参" 节：$ARGUMENTS 必填语义 + 无参报错
│       │                                          ③ "执行流程" 节：env 检查 → AI veto → 抽取 → 调脚本 → Write 落文件 → 报告
│       │                                          ④ "AI veto 判据" 节：相关轮次<3 OR 无被采纳决策
│       │                                          ⑤ "body 四段式骨架" 节：背景/决策/权衡/未决
│       │                                          ⑥ "边界情况" 表：env 缺失/目录不存在/yymm 子目录/文件冲突/python 缺失
│       └── script.py                       (NEW) ① CLI 全 named flag（--intent / --title / --summary）
│                                                  ② 算 created_date/modified_date（YYYY-MM-DD HH:MM）
│                                                  ③ 从 created_date 取 yymm（4 位）和 yymmdd（6 位）
│                                                  ④ 算 permalink = posts/<md5(title+"|"+created_date)[:32]>
│                                                  ⑤ 拼目标路径 $USER_WIKI_PATH/{yymm}/{yymmdd}-{title}.md，mkdir -p 子目录
│                                                  ⑥ check 路径冲突，存在则 stderr 报错 + exit 1
│                                                  ⑦ stdout 双段：frontmatter 字符串 + 目标路径
└── .claude-plugin/
    └── plugin.json                         (改)  version 0.27.1 → 0.28.0 (minor 新增 command)
```

### 逻辑一：env + 意图校验与 AI veto（对应问题三）

**业务流**

```
function userWikiDistillEntry($ARGUMENTS, $USER_WIKI_PATH):  // 命令主入口，AI 在会话内执行
    if isEmpty($ARGUMENTS):                          // 意图必填：用户输入 /user-wiki-distill 不带参
        report("请说明本次要沉淀什么。用法：/user-wiki-distill <意图描述>")
        return                                       // 停止，不写文件，不进入下一步

    if isEmpty($USER_WIKI_PATH):                     // env 必设：首次用 / shell rc 未配置
        report("未设 $USER_WIKI_PATH。请在 shell rc 里 export USER_WIKI_PATH=<Outputs 根目录>")
        return                                       // 不假设默认路径，避免悄悄写错地方

    if not dirExists($USER_WIKI_PATH):               // 目录必须存在（不自动创建）
        report("$USER_WIKI_PATH 指向的目录不存在：" + $USER_WIKI_PATH)
        return                                       // 不自动 mkdir 根目录，避免拼写错时新建无意义目录

    veto = checkVeto($ARGUMENTS, sessionHistory)     // AI veto：判据清单固定 2 条 OR
                                                      // 每条信号由 AI 软启发判断，不是机器可数
    if veto.shouldVeto:                              // 内容不足时拒绝写
        report("会话关于「" + $ARGUMENTS + "」实质讨论不足（"
               + veto.reason + "），未生成文档。建议补充意图或继续讨论后重调。")
        return                                       // 停止，不写文件

    proceedToExtract()                               // 全部通过，进入逻辑二：内容抽取

function checkVeto(intent, history):                 // AI veto 判据：仅 2 条 OR，AI 不引入第三条
                                                      // 每条信号本身是 AI 读 history 后的软启发裁定
                                                      // 不要求机器可数——可数的只是判据清单本身（2 条）

    relevantTurns = aiEstimateRelevantTurns(history, intent)
                                                      // AI 启发式估计：扫 session history，软判断
                                                      //   "和 intent 相关 + 实质讨论" 的轮次有多少
                                                      // 排除：纯执行指令（"帮我跑 X"）、纯短问答（"X 是什么"）
                                                      // 一"轮" = 用户消息 + AI 答复消息 1 对
                                                      // 不同 AI 实例可能略数偏差 1-2，可接受
    if relevantTurns < 3:                             // 阈值 3：来源——1 轮提问 + 1 轮答复 + 1 轮确认/迭代
                                                      // 最少三轮才构成可浓缩的设计/分析叙事；少于则太单薄
        return {shouldVeto: true, reason: "相关讨论<3 轮"}

    decisionPoints = aiExtractAcceptedDecisions(history, intent)
                                                      // AI 启发式找：会话里被用户采纳的设计/结论
                                                      // 采纳信号（任一）：用户明确说"好/同意/选 X"
                                                      //                / 后续讨论基于该结论展开
                                                      //                / 用户对该结论无反对继续推进
    if decisionPoints.isEmpty():                      // 散乱讨论无定型结论 → 没有可浓缩的素材
        return {shouldVeto: true, reason: "无被采纳决策"}

    return {shouldVeto: false}                        // 两条 OR 都不触发 → 不 veto，继续写
```

**关键契约**

- AI veto 判据**仅这 2 条 OR**——AI 不允许引入第三条软信号（"未来读者能复用"、"足够丰富"等开放裁量）。判据 surface 不可扩展；单条信号本身仍需 AI 软启发判断
- "轮次"定义统一为「用户消息 + AI 答复消息 1 对」——不同 AI 实例数法允许偏差 1-2
- env 未设时**不假设默认路径**（不 fallback 到 `~/.agents-personal/wiki/` 等）——避免悄悄写错地方
- 意图描述原话需**逐字保留**——后续 body 头部要引用，不能 paraphrase / 改写

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| `$ARGUMENTS` 为空 | 用户输入 `/user-wiki-distill` 不带参 | 报错 + 用法提示 | 不写文件，AI 报告用户 |
| `$USER_WIKI_PATH` env 未设 | 用户首次用 / shell rc 未配置 | 报错 + export 示例 | 不写文件，AI 报告用户 |
| `$USER_WIKI_PATH` 目录不存在 | env 设了但路径错 / vault 未挂载 | 报错 + 建议修正 env 或创建目录 | 不写文件，AI 报告用户 |
| 会话相关轮次<3 | 用户跑了短问答会话就调 | AI veto 报告 + 建议补意图或继续会话 | 不写文件，AI 报告用户 |
| 会话无被采纳决策 | 散乱讨论无定型 | AI veto 报告 + 建议先收敛结论 | 不写文件，AI 报告用户 |

### 逻辑二：AI 内容抽取与提炼（对应问题三 + 问题四的 AI 侧）

**业务流**

```
function extractAndDistill(intent, history):                  // AI 提炼阶段，逻辑一通过后进入
    relevantContent = filterByIntent(history, intent)         // 用 intent 文字筛会话内容
                                                              // 比对方法：消息内容是否提及/讨论 intent 描述的主题
                                                              // 不相关部分（跑题、纯执行指令、调试日志）一律忽略

    title = inferTitle(intent, relevantContent)               // 从"意图 + 实际抽到内容"反推 title
                                                              // 长度 5-25 显示字符（中文按 1 字符算）
                                                              // 允许：中文/字母/数字/空格/-
                                                              // 反映内容实际重点而非复述意图；术语保留原文
                                                              // 例：intent="沉淀今天讨论的 user-wiki-distill 设计"
                                                              //     title="user-wiki-distill 设计"（不译"user-wiki-distill"）

    summary = writeSummary(intent, relevantContent)           // ≤30 字概括"围绕意图做了什么 + 得出什么结论"
                                                              // 不是流水账描述；后续 Obsidian search/Bases 找回入口

    body = writeBodyFourSections(intent, relevantContent)     // 四段式骨架展开（见下方函数）

    return {title, summary, body, intent}                     // 交给逻辑三调脚本

function writeBodyFourSections(intent, relevantContent):     // 四段式：背景 / 决策 / 权衡 / 未决
    return template:
        "# {title}\n\n"
        "> **intent**: {intent_verbatim}\n"                   // 用户原话逐字保留，不改写
        "> 由 /user-wiki-distill 从会话浓缩生成于 {now}\n\n"
        "## 背景\n"
        "{为什么有这次讨论，会话起点 / 触发因素}\n\n"
        "## 关键决策 / 设计\n"
        "{N 个决策点，每个含「是什么 + 为什么」}\n\n"
        "## 关键权衡\n"
        "{考虑过的替代方案 + 为何没选，红蓝军式对抗而非平铺优缺点}\n\n"
        "## 后续 / 未决\n"
        "{下一步动作 + 未决问题列表}\n"
```

**关键契约**

- `title` 约束：
  - 长度：5-25 个**显示字符**（中文按 1 字符算，英文术语按 ascii 字符算）
  - 允许字符：中文 / 字母 / 数字 / 空格 / `-`
  - 禁止字符：`/ \ : * ? " < > |` 以及换行（路径敏感 + yaml 敏感）
  - 内容要求：**不复述 intent 原文**，反映会话**实际**重点；术语保留原文（如 `user-wiki-distill`），不强行翻译成纯中文
- `summary`：≤30 字，回答「围绕意图做了什么 / 得出什么结论」，非"会话主题概述"
- `body` 必须四段齐——任一段空缺，AI 应主动写"本次会话未触及"声明而非删段（保持骨架稳定）
- intent 原话**逐字保留**到 body 头部 blockquote，禁止 paraphrase / 改写——读者溯源不需要回看会话

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| AI 反推 title 含敏感字符 | title 含 `/`、`\`、`:`、换行 等禁止字符 | AI 自动清洗：**统一替换为下划线 `_`**（不删除——保留长度和位置信息，确保同一 raw title 总产相同 cleaned title，从而 hash 计算 idempotent）；中文/字母/数字/空格/`-` 原样保留 | AI 内部处理，不上抛 |
| relevantContent 太少（虽过 veto） | veto 阈值踩线（恰好 3 轮 / 一个决策） | 四段中"权衡"或"未决"可能为空——AI 在该段写"本次会话未触及"，不删段 | AI 内部处理 |
| intent 含 prompt injection | 用户意图里夹「忽略前面指令」之类 | AI 按字面理解为意图描述，**不执行**；逐字写入 body blockquote | AI 内部处理 |
| AI 抽到的内容跨意图边界 | 会话主题漂移混合多个话题 | 严格按 intent 文字筛，与 intent 无关的内容**不写入** body；宁可短不可漂 | AI 内部处理 |

### 逻辑三：python 脚本 frontmatter 生成（对应问题四的脚本侧）

**业务流**

```
function script_main(args):                                      // 脚本 CLI 入口，AI 通过 Bash 调用
    intent = args.intent                                         // 用户原话意图（仅 audit 用，不写入 frontmatter）
    title = args.title                                           // AI 反推 + 清洗后的 title（5-25 显示字符）
    summary = args.summary                                       // AI 写的 ≤30 字概括
    user_wiki_path = os.environ.get("USER_WIKI_PATH")            // env 必读
    if not user_wiki_path:                                       // 防御：AI 应已校验，但脚本独立调用时也要稳
        print("ERROR: $USER_WIKI_PATH 未设", file=sys.stderr)
        sys.exit(2)                                              // exit 2：env 错（区别于 exit 1 路径冲突）

    now = datetime.now()                                         // 当下时间，不做时区转换（用户 shell 时区即真相）
    created_date = now.strftime("%Y-%m-%d %H:%M")                // 格式来源：vault 现有样本（如 260227-工作流设计.md）
    modified_date = created_date                                 // 首次创建 = 修改时间

    yymm = now.strftime("%y%m")                                  // 4 位月份，如 "2605"——目录分组
    yymmdd = now.strftime("%y%m%d")                              // 6 位年月日，如 "260514"——文件名前缀

    permalink_seed = title + "|" + created_date                  // hash 输入：title + 完整时间戳
                                                                  // 加 "|" 分隔避免不同 title+date 拼接产生同 hash
                                                                  // （如 title="A"+date="B|C" vs title="A|B"+date="C"）
    permalink = "posts/" + md5(permalink_seed.encode()).hexdigest()[:32]
                                                                  // 截 32 位与 vault 现有样本格式对齐
                                                                  // 样本：permalink: posts/294e4b74b81db1aa5e05f1166ced1207

    yymm_dir = os.path.join(user_wiki_path, yymm)                // 月份子目录
    os.makedirs(yymm_dir, exist_ok=True)                         // 不存在则建，存在不报错（idempotent）

    target_path = os.path.join(yymm_dir, f"{yymmdd}-{title}.md") // 目标文件路径

    if os.path.exists(target_path):                              // 冲突检查：同日同 title 重跑
        print(f"ERROR: 已存在 {target_path}。请改 title 后重试，或人工删除原文件再跑。",
              file=sys.stderr)
        sys.exit(1)                                              // exit 1：路径冲突

    frontmatter = render_frontmatter(                            // 拼 yaml frontmatter 字符串
        aliases=[],                                              // 空列表（沿用 vault 现有惯例）
        draft=False,                                             // 沿用 brain 模板，distill 产物视为已完成草稿
        tags=["ai-distill"],                                     // 方便 Obsidian 过滤所有 AI 产物
        summary=summary,                                         // 来自 AI
        source="chat-distill",                                   // 借鉴自 brain skill 的 source 字段约定
                                                                  // 标记"AI 从会话浓缩"，区别于手写 long-form
        created_date=created_date,
        modified_date=modified_date,
        permalink=permalink,
    )                                                             // 字段顺序与 vault 现有样本对齐

    # stdout 输出格式固定，便于 AI 零歧义解析：
    #   第一行起：完整 frontmatter（多行，--- 包围 + 末尾 --- 行）
    #   空白行 × 1
    #   最后一行：固定前缀 "TARGET_PATH: " 后接绝对路径
    print(frontmatter, end="")                                   // frontmatter 内含末尾 ---\n，不再补
    print()                                                       // 空行：唯一分隔符
    print(f"TARGET_PATH: {target_path}")                         // 带前缀的路径行，AI 按前缀识别
    sys.exit(0)                                                  // 成功；AI 用 Write 落文件
```

**关键契约**

- 脚本职责严格限于「纯函数计算」——读 env、算时间戳/hash、拼路径、检冲突、拼 yaml；**不读 / 不写**任何文件（`mkdir -p` 子目录是 idempotent 操作，不算"写文件"）
- **stdout 输出协议**（AI 解析零歧义）：
  - 第 1 行起：完整 frontmatter，多行，`---` 开头 + `---\n` 结尾
  - 紧跟 1 个空行（唯一分隔符）
  - 最后 1 行：`TARGET_PATH: <绝对路径>`（**带固定前缀**）
  - AI 解析规则：按行扫，遇到以 `TARGET_PATH: ` 开头的行即为路径行；该行之前去除末尾空行后即为 frontmatter（保留末尾 `---` 行）；路径行 = `line[len("TARGET_PATH: "):]`
  - 不依赖"双换行"或"行号"——固定前缀杜绝歧义
- frontmatter 字段顺序固定：`aliases / draft / tags / summary / source / created_date / modified_date / permalink`——与 vault 现有样本对齐
- permalink hash 算法固定：`md5(title + "|" + created_date)[:32]`——同 title 同时刻调两次产相同 hash（防御性，实际不会发生因为路径冲突先报错）
- exit code 语义固定：`0` 成功 / `1` 路径冲突 / `2` env 错 / `3` 目录创建失败——AI 据此区分错误类型

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| `$USER_WIKI_PATH` env 未设 | AI 漏检 / 脚本被外部直接调用 | stderr 报错 + `exit 2` | 上抛给 AI 转告用户 |
| 目标文件已存在 | 同日同 title 重跑 | stderr 报错 + `exit 1` + 建议改 title 或删原文件 | 上抛给 AI 转告用户 |
| `yymm/` 子目录创建失败 | 权限不足 / 磁盘满 | stderr 抛 `OSError` 原文 + `exit 3` | 上抛给 AI 转告用户 |
| title 含非法路径字符 | AI 上游清洗失败漏过 | 脚本不二次校验（信任 AI），路径拼出来后 `os.makedirs` 或 `os.path.exists` 触发 `OSError` | 上抛给 AI |
| `python3` 不在 PATH | 用户机器无 python | Bash 调用报 `command not found` | 上抛给 AI 转告用户安装 python3 |

### 逻辑四：AI 落文件与报告（对应问题四的 AI 侧 + 整体收尾）

**业务流**

```
function finalizeAndReport(script_stdout, body):                 // AI 收尾阶段
    # 按逻辑三关键契约的 stdout 协议解析：
    target_line = findLineStartingWith(script_stdout, "TARGET_PATH: ")
                                                                  // 扫脚本输出找 TARGET_PATH: 前缀的行
    target_path = target_line[len("TARGET_PATH: "):].strip()      // 切掉前缀得绝对路径
    frontmatter = script_stdout[:start_of(target_line)].rstrip("\n") + "\n"
                                                                  // 前缀之前的内容 = frontmatter
                                                                  // rstrip + 补一个 \n 确保末尾恰好 ---\n

    full_content = frontmatter + "\n" + body                      // 拼装：frontmatter 末尾 ---\n
                                                                  // 加一个空行作为 frontmatter/body 分界
                                                                  // body 头部 # title H1 紧跟空行

    Write(target_path, full_content)                              // 用 AI 标准 Write 工具
                                                                  // 调试时 transcript 能看到完整 Write 调用
                                                                  // 不用 Bash echo / cat 重定向（subprocess 副作用）

    relative_path = relativize(target_path, $USER_WIKI_PATH)      // vault 相对路径，报告更短可读
                                                                  // 如 "2605/260514-user-wiki-distill命令设计.md"
    permalink = extractPermalink(frontmatter)                     // 从 frontmatter 文本提 permalink 值
                                                                  // 用于报告，便于用户 grep 找回

    report("沉淀到 " + relative_path + "（permalink: " + permalink + "）")
                                                                  // 一行报告，不冗余；不建议"要不要 promote"
```

**关键契约**

- Write 工具落文件**一次到位**——不分多次 Write 或 Edit 追加（避免部分写入风险）
- 报告格式固定一行：「沉淀到 `<vault 相对路径>`（permalink: `posts/xxxx`）」——便于用户快速 grep / 复制
- **不在报告里建议下一步**（"要不要 promote 到 Knowledge"等）——人在回路，命令做完即停；后续操作由用户主动发起

**异常与失败模式**

| 场景 | 触发条件 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|
| Write 工具失败 | 权限不足 / 磁盘满（极少见） | AI Write 工具自身报错信息原文转告 | 上抛给用户 |
| 脚本 stdout 解析失败 | 脚本输出格式 bug：找不到 `TARGET_PATH: ` 前缀行 | AI fallback：直接把脚本 stdout / stderr 全文转告用户，**不写文件**——脚本应升级修 bug | 上抛给用户 |
| 脚本非零 exit | 路径冲突 / env 错 / 目录失败 | AI 把脚本 stderr 原文转告用户，**不写文件** | 上抛给用户 |
| AI 拼装时 frontmatter 与 body 间缺空行 | AI 拼装 bug | Write 写出的文件仍有效（Obsidian 容错），但格式偏差——AI Write 前应自检确保 frontmatter 以 `---\n` 结尾 + 后续紧跟 body | AI 内部自检 |

---

## Review Log

### Review 1 — 2026-05-14

**Reviewer**: `design-doc-reviewer` 通过 `general-purpose` subagent dispatch（reviewer-template.md）

**Report 摘要**：

#### ❌ Critical (4)

- **C1** [`### 逻辑一.业务流` `checkVeto`]：声称"判据**可观察**"，但 `countRelevantTurns` / `extractDecisions` 实际是 AI 主观判断。**目标节 + 问题三结论 + 逻辑一注释三处声明不一致**——要么落到机器可数信号，要么诚实降级"AI 软启发"
- **C2** [`### 逻辑二.关键契约` title 规则]：「3-6 字中文短语」与「允许中文/字母/数字/`-`」互相打架。doc 自身的例子 `user-wiki-distill 设计` 违反前者——示例和契约自相矛盾
- **C3** [`### 逻辑二.异常与失败模式` 第一行]：title 含敏感字符的清洗写「替换为下划线或删除」——二选一未定，清洗策略不同 → 同一 raw title 产不同 hash，影响 idempotency
- **C4** [`### 逻辑三.关键契约` stdout 格式 + `### 逻辑四.业务流`]：脚本 stdout "frontmatter（含 `---` 包围）+ 单行目标路径"，AI 解析规则只写"按双换行或行号解析"——但 frontmatter 内部含 `---\n` 行，分隔含糊。**契约必须固化具体分隔符**

#### ⚠️ Warning (10)

- **W1** [架构 → 实现衔接]：架构问题 4 个但只有问题 3/4 进了逻辑节，问题 1-2 落「影响文件」目录结构，doc 未显式说明
- **W2** [`checkVeto` 阈值]：`relevantTurns < 3` 的"轮次"定义不清
- **W3** [`permalink_seed` 防御性声明]：hash 实际未提供防冲突保障（路径冲突按 yymmdd-title.md 日粒度判），声明误导
- **W4** [字段顺序对齐 vault]：未贴 vault 样本作对照锚
- **W5** [路径冲突恢复 SOP]：title 是 AI 反推的，用户没有直接"改 title 后重试"入口
- **W6** [`tags=["ai-distill"]` 硬编码]：问题拆解未讨论 tag 来源（AI 推断 vs 用户传 vs 脚本固定）
- **W7** [body 四段式自创]：与手写 Outputs 是否对齐未声明
- **W8** [user-wiki-distill.md 边界情况表与异常表重叠]：未说清两处关系
- **W9** [背景节主辅因标注]：核心 1 条 + 附带 2 条，刚好踩在 ≥3 条 bullet 强制标主辅边界
- **W10** [veto 术语跨节漂移]：「相关讨论」「实质讨论」「被采纳决策」三处措辞略不同

#### 💡 Suggestion (5)

- **S1** [架构图]：只画 happy path，可加 on-error 横向分支
- **S2** [问题四方案 C 否决理由]：「调试不方便」可量化
- **S3** [`inferTitle` 例子]：与 C2 修订同步
- **S4** [Write 注释「人在回路」]：slash command 流程下用户未必走 diff review
- **S5** [架构图风格]：可考虑对比表或 Mermaid

#### Self-Audit (4 个新读者卡点)

- **A1**：脚本 yaml 序列化用 `yaml.safe_dump` 还是手拼？summary 含 `:` 或 `#` 会破 yaml
- **A2**：AI 怎么数"实质讨论轮次"？session history 工具能力假设未声明
- **A3**：命令子目录形式（`commands/user-wiki-distill/user-wiki-distill.md`）vs 扁平 `project-wiki-distill.md`——Claude Code 是否两种都支持？需要 manifest 注册吗？
- **A4**：`script.py` 的 shebang / 调用方式（`python3 script.py` vs 直接 `./script.py`）？

**Verdict**: ❌ Has issues — 优先建议修 C1（声明 vs 实现矛盾）和 C4（stdout 协议含糊）。

---

**用户决定**：**修 Critical (C1-C4)**；W1-W10 / S1-S5 / A1-A4 全部 **skip**。

**本轮修订**：

- **C1**：统一术语为「AI 启发式判据」，三处同步——
  - 目标节第 3 条：「可观察判据」→「判据**清单固定**为 2 条 OR（AI 不引入第三条软信号），但每条信号本身仍需 AI 软启发判断（不是机器可数指标）」
  - 问题三结论：澄清「拍板权窄场景 + 判据 surface 不可扩展」与「单条信号仍 AI 软启发」的双重语义
  - 架构总结：括号注语同步
  - 逻辑一 `checkVeto` 业务流：函数名重命名 `countRelevantTurns / extractDecisions` → `aiEstimateRelevantTurns / aiExtractAcceptedDecisions`，注释明确"AI 启发式估计"角色；补 turn 定义（用户+AI 消息对 = 1 轮）+ 接受偏差 1-2 的容忍
  - 关键契约第一条：「禁止主观信号」→「不允许引入第三条软信号 / 判据 surface 不可扩展 / 单条仍需 AI 软启发」
- **C2**：title 字符规则统一为单条契约——
  - 长度 5-25 显示字符（中文按 1 字符算）
  - 允许：中文 / 字母 / 数字 / 空格 / `-`
  - 禁止：`/ \ : * ? " < > |` 与换行
  - 术语保留原文（不强行翻译 `user-wiki-distill` 之类）
  - 逻辑二 `inferTitle` 注释同步更新规则与例子说明
- **C3**：title 敏感字符清洗 → **统一替换为下划线 `_`**（不删除）——理由：保留长度与位置信息，保证 hash idempotency；表项重写说明
- **C4**：脚本 stdout 协议固化——
  - 逻辑三业务流 print 改为：`print(frontmatter, end="") + print() + print(f"TARGET_PATH: {target_path}")`
  - 关键契约第二条改写为「以 `TARGET_PATH: ` 前缀的行为分隔锚」+ 明确 AI 解析规则
  - 逻辑四业务流加 `findLineStartingWith` 解析步骤示意 + 路径切片 + frontmatter 回拼
  - 异常表"stdout 解析失败"条目同步具体化（找不到前缀行 → 不写文件 + 转告 stderr）

**未触及**：W1-W10 / S1-S5 / A1-A4 全部由用户决策 skip——未修改文档主体。
