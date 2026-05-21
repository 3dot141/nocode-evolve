---
type: design-doc
topic: /sow 从单出口扩展到 Inbox / Inputs / Outputs 三层, AI 判层 + 用户 NL 确认
date: 260521
author: 3dot141
status: draft
---

# Design Doc: /sow 多层出口 (Inbox / Inputs / Outputs)

## 背景

**核心问题**: 现有 `/sow` 命令 (v1) 把当前会话围绕用户意图浓缩成一份**long-form 草稿**, 单点归档到 `$USER_WIKI_PATH/yymm/yymmdd-<title>.md` (v1 env 名 `USER_WIKI_PATH`, 默认指向 `~/AI/MyJarvis/Memory/05-Outputs`). 但**用户 vault 的 PARA 结构 (`Memory/README.md:17-23`) 显示沉淀有三种形态**——`01-Inbox` (剪藏入口, 流转池) / `02-Inputs` (已分类素材中间台) / `05-Outputs` (long-form 草稿). 现 sow 只覆盖 Outputs, 另外两种形态用户只能手动落盘.

具体表现 (从 `commands/sow.md:36-43` 现有实现读到):

**主因**:
- sow 强制四段式骨架 (背景 / 关键决策 / 关键权衡 / 后续未决), 这是 Outputs 形态. Inbox 的"流水账 + 临时剪藏" 与 Inputs 的"素材 + 我的批注" 形态被硬塞进四段式时 AI 只能编"本次未触及"占位段, 产物质量低——**这是用户用 sow 写不了 Inbox/Inputs 的直接技术原因**.

**辅因**:
- sow 强制 AI veto: **≥3 轮实质讨论 + ≥1 被采纳决策**, 否则不写. 这是 long-form 草稿的合理门槛, 但**Inbox 定位本来就是"单条剪藏 / 杂项捕捉"**——一句话想法 + 一段引用就够, 走 sow 永远被 veto 拦. (即便骨架问题解决, 此门槛仍拦.)
- v1 用 env 名 `$USER_WIKI_PATH` 指向 `05-Outputs` 子目录, 在概念上把 sow 绑死在 Outputs 层——env 名取自"用户 wiki", 实际只指一个子目录, 命名跟语义不匹配 (v2 一并修复: 改名 `USER_VAULT_PATH` 指 vault 根, sow 内部硬编 `Memory/` 前缀, 跨命令可复用同一 env). (这条单独看不痛, 但跟主因+第一辅因同时改时, 不一并改会留接口割裂.)

**附带问题** (本 doc 不解决):
- 用户 vault 内部从 Inbox → Inputs → Outputs → Cards → Projects 的"升级/迁移"流程目前手工, 没有自动化承接命令——本 doc 仅扩 sow 写入能力, 不动 vault 内部生命周期.
- `/sediment` 命令的 `wiki:cross-project` advisor 出口 (`commands/sediment.md:117-126`) 现在仅推荐 "建议跑 `/sow <intent>`", 不指明层. 本 doc 加边界注但不让 sediment 替判层 (职责分离, 见方案选型 Q5).

不解决的代价: 用户日常会话很多是中低浓度 (单条想法 / 一段素材 + 几句批注), 这些内容当前 sow 拒收, 用户只能跳出会话手动落 Inbox/Inputs, 沉淀链路断裂——会话内有意图想沉淀但 sow 帮不上忙, 反而劝退使用.

## 目标

- `/sow <intent>` 支持写入三层 (Inbox / Inputs / Outputs), 覆盖 PARA 中前三层沉淀诉求
  - **不做**: `03-Cards` (Zettelkasten 原子卡, 命名/拆分逻辑独立) 与 `04-Projects` (项目工作单元, 走项目结构) 不在 sow scope; `01-Inbox/<yymm>/YYYY-MM-DD.md` 一日多条目流水账格式也不在 sow scope (sow 永远建单条 `yymmdd-<title>.md`)
- **AI 判层 + 用户单候选 NL 确认 loop**: AI 基于 intent + 会话浓度推荐一层, 用户用自然语言指令 (`go` / `换 inbox` / `title 改成 X` / `cancel`) 改 candidate, AI 解析后 re-propose, loop 到 `go` 或 `cancel`
- **分层 veto, 严格度递减**: Outputs 保持现 ≥3 轮实质讨论+决策门槛, Inputs ≥1 轮实质讨论门槛, Inbox 无门槛 (只要 intent 非空就写). **"实质讨论"概念全文统一**, 沿用 `sow.md:36-43` 现有定义 (排除"纯执行指令 / 纯短问答").
- **三层三套 body 骨架**: Outputs 四段式不变, Inputs 两段 (原始材料 + 我的批注), Inbox 一段 (一句话原因 + 原内容). 各层骨架与 example 见接口设计.内部接口节.
- **env 改名 + 反转 + 上移**: 弃用 `USER_WIKI_PATH` (v1 env 名, 指 Memory 子目录), 引入 `USER_VAULT_PATH` 指 vault 根 (`~/AI/MyJarvis`). sow 内部硬编 `Memory/` 前缀 + `--layer` 子目录, 算路径 `$USER_VAULT_PATH/Memory/<layer-dir>/<yymm>/<yymmdd>-<title>.md`. 跨命令复用同一 env (未来 `/task` 加 `Flow/` 前缀, `/sediment` 仍各走自家路径); **`plugin.json` 单次 major bump** 覆盖 sow + sediment (`0.41.0 → 1.0.0`)
- `/sediment` 仅追加文档化边界注 (advisor 不替判层), 不动 advisor 输出逻辑

## 架构

### 架构图

无运行时多组件——本 doc 是单一 slash command 内部流程改造 + 辅助脚本扩展. 架构层关注点是**AI ↔ script.py ↔ 文件系统**的协作契约.

### 流程图

`/sow <intent>` 调用链 (改造后):

```
用户: /sow <intent>
   ↓
1. 校验: $ARGUMENTS 非空 + $USER_VAULT_PATH 设且是目录 + `<vault>/Memory/{01-Inbox, 02-Inputs, 05-Outputs}` 三子目录都存在
   ↓
2. AI 判层 (基于 intent + 会话浓度)
   ├─ 长讨论 + 决策 → Outputs
   ├─ ≥1 轮素材讨论 → Inputs
   └─ 杂项捕捉 → Inbox
   分层 veto: AI 想升层但门槛不够 → 自动降层
   ↓
3. AI 生成单候选 (反推 title / 写 summary / 按层骨架写 body)
   ↓
4. propose 给用户:
     建议层 / Path / Title / Summary / Body 预览 (前 200 字)
     回复: go / 换<层> / 改 title / cancel
   ↓
5. NL loop:
     用户 NL → AI 解析 → 改 candidate → re-propose
     解析失败 → "没听懂, 请重述"
     loop until go / cancel
   ↓
6. 调 script.py --layer X --intent Y --title Z --summary W
   stdout: frontmatter + TARGET_PATH 行
   ↓
7. AI Write target_path (frontmatter + body)
   ↓
8. 报告: "沉淀到 <vault 相对路径> (permalink: posts/xxxx)"
```

### 时序图

无——单方文件改动, AI 与 script.py 是顺序调用 (非异步), 不需要时序图.

### 文本总结

整体架构: sow v2 从"单出口单门槛单骨架"演化为"三出口三门槛三骨架". 关键决策:

- **判层职责放 AI 不放命令参数**: 用户调用入口保持 `/sow <intent>` 单一形式 (不引入 `inbox` / `inputs` 子命令), AI 用会话浓度启发式判层, 用户在 NL loop 里有否决权.
- **三层用同一脚本 + 同一文件骨架接口** (frontmatter / body 双段), 路径与 frontmatter 字段按 layer 参数分支——script.py 是"无意识工具", 复杂度集中在 sow.md 提示词.
- **env 改名 + 反转 + 上移**: `$USER_VAULT_PATH` 指 vault 根 (`~/AI/MyJarvis`), 跨命令复用; sow 内部硬编 `MEMORY_SUBDIR = "Memory"` + `LAYER_DIR_MAP = {inbox: 01-Inbox, inputs: 02-Inputs, outputs: 05-Outputs}` 作为脚本常量, 不暴露给用户配置. 路径拼接: `$USER_VAULT_PATH/Memory/<layer-dir>/<yymm>/<yymmdd>-<title>.md`.

下一节展开 sow.md / script.py / test_script.py / sediment.md / plugin.json 的具体改动.

## 实现

### 影响

```
nocode-evolve/
├── commands/
│   ├── sow.md                                (改)  全文重写流程节:
│   │                                                ① 入参/env 段说明 $USER_VAULT_PATH 指 vault 根 (v1 USER_WIKI_PATH 弃用)
│   │                                                ② 流程节加入 "AI 判层" 步骤 + 分层 veto 表
│   │                                                ③ 加入 "三层三套 body 骨架" 模板
│   │                                                ④ 加入 "NL 确认 loop" 协议 (输入语义 + 解析失败回应)
│   │                                                ⑤ 边界情况节追加 layer / Memory 根缺子目录场景
│   ├── sow-reference/
│   │   ├── script.py                         (改)  ① 加 --layer 必填参数, 校验 ∈ {inbox, inputs, outputs}
│   │   │                                            ② LAYER_DIR_MAP 常量 (layer → 目录名)
│   │   │                                            ③ 路径算法改 <root>/<layer-dir>/<yymm>/<yymmdd>-<title>.md
│   │   │                                            ④ frontmatter tags 按 layer 分: inbox+clip / inputs+source / outputs+ai-distill
│   │   │                                            ⑤ env 校验扩展: root + 三子目录都存在
│   │   └── test_script.py                    (改)  ① 加三 layer 路径计算 case
│   │                                                ② 加缺 --layer 参数报错 case
│   │                                                ③ 加 layer 取值非法 (e.g. `cards`) 报错 case
│   │                                                ④ 加 Memory 根缺子目录报错 case
│   │                                                ⑤ 加按 layer frontmatter tags 差异断言
│   └── sediment.md                           (改)  wiki:cross-project 出口节追加边界注:
│                                                  "sow v2 已支持三层 (Inbox/Inputs/Outputs), advisor 仅推
│                                                   /sow + intent, 由 sow 自判层. sediment 不替判层."
├── .claude-plugin/
│   └── plugin.json                           (改)  version major bump (env 语义反转 = 破坏性变更)
└── model/
    └── agent-about.md                        (改, 可选) 全局占位符表加 $USER_VAULT_PATH 默认值说明 (vault 根, 跨命令共享)
```

### 接口设计

按面分 3 段——sow 无 HTTP/RPC, 用文件系统 + CLI 替代:

#### 对外 API (slash command + script CLI)

**`/sow` slash command** 入参与现状一致, 仅 env 含义反转:

| 项 | 改前 (v1) | 改后 (v2) |
|---|---|---|
| `$ARGUMENTS` | 一句话意图描述 (必填) | 同 |
| env 名 | `USER_WIKI_PATH` (指 `~/AI/MyJarvis/Memory/05-Outputs` 子目录) | **`USER_VAULT_PATH`** (指 `~/AI/MyJarvis` vault 根, 跨命令复用); v1 `USER_WIKI_PATH` 弃用, sow v2 不读 |
| 路径拼接 | env 直接拼 `<env>/yymm/<title>.md` | env 加 `Memory/<layer-dir>/yymm/<title>.md` (`Memory/` 由 sow 内部硬编, 不暴露 env) |
| 退出 | 报告"沉淀到 X" | 加报告 "层: <inbox/inputs/outputs>" 前缀 |

**`script.py` CLI** 参数 + stdout 契约:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `--layer` | enum: inbox / inputs / outputs | 是 | 新增, 决定子目录映射 + frontmatter tags |
| `--intent` | string | 是 | 用户原话意图, 写入 body blockquote |
| `--title` | string | 是 | AI 反推 + 清洗后的 title |
| `--summary` | string | 是 | ≤30 字 summary |

stdout 格式 (与 v1 一致, 仅 `tags` 字段值按 layer 变):

```
---
aliases: []
draft: false
tags: [<layer-tags>]
summary: "..."
source: chat-distill
created_date: YYYY-MM-DD HH:MM
modified_date: YYYY-MM-DD HH:MM
permalink: posts/<32-hex>
---

TARGET_PATH: <绝对路径>
```

退出码 (v2 重定义 exit 3 语义; 与 v1 兼容性: exit 0/1/2 不变, exit 3 从"mkdir 失败"扩为"目录相关错误"涵盖原失败模式, exit 4 新增):

| code | 场景 | AI 行为 |
|---|---|---|
| 0 | 成功 | 解析 stdout, Write 落盘 |
| 1 | 路径冲突 (目标文件已存在). Inbox 高频场景下 sow.md prompt 在 NL loop 前**先在 candidate 阶段加自动序号尝试** (`<title>-2.md` / `-3.md`, 最多 3 次), 自动序号 ≤3 次仍失败才进 exit 1; outputs/inputs 直接进 exit 1 不自动加序号 (长文档冲突极少, 应让用户改 title) | 转告 stderr, 让用户改 title 后 re-propose |
| 2 | env 错 ($USER_VAULT_PATH 未设 / 不是目录) | 转告 + export 示例 (`export USER_VAULT_PATH=~/AI/MyJarvis`) |
| 3 | **目录相关错误** (新语义, 涵盖两种): (a) Memory 根缺 `01-Inbox` / `02-Inputs` / `05-Outputs` 任一子目录; (b) `<yymm>/` 子目录 `makedirs` 失败 (权限 / 磁盘满). 子类型用 stderr message 区分 (`missing subdir: ...` vs `mkdir failed: ...`) | 转告 stderr (含子类型 + 路径 + 建议) |
| 4 | --layer 参数缺 / 非法 (新增) | 报"AI 内部错: prompt 漏传 layer". 修复指引: 重新跑 `/sow`; 若复现请抓 log + 报 issue 给插件维护者 (不该在用户侧重现) |

#### 数据模型 (文件路径 + frontmatter schema)

三层目录与文件命名 (来源 `Memory/README.md` 收纳规则):

```
$USER_VAULT_PATH/                              (= ~/AI/MyJarvis, vault 根, env 配)
└── Memory/                                    (Memory/ 前缀由 sow 内部硬编, 不进 env)
    ├── 01-Inbox/<yymm>/<yymmdd>-<title>.md   ← layer=inbox  (流水账 YYYY-MM-DD.md 不进 sow scope)
    ├── 02-Inputs/<yymm>/<yymmdd>-<title>.md  ← layer=inputs
    └── 05-Outputs/<yymm>/<yymmdd>-<title>.md ← layer=outputs
```

`<title>` 命名约束跟现状一致 (`commands/sow.md:49-51`): 5-25 显示字符, 允许中文/字母/数字/空格/`-`, 禁止字符 `/ \ : * ? " < > |` 与换行 → AI 统一换 `_`.

**三层 frontmatter `tags` 字段**: 三层共用 `[ai-distill]` (与 v1 一致), **不按 layer 加额外 tag**.

依据: grep 用户 vault `~/AI/MyJarvis/Memory/01-Inbox/` `02-Inputs/` `05-Outputs/` 现有 `.md` frontmatter, `tags:` 字段大多为空, 无既有 `clip` / `source` 等 layer-specific 命名惯例; 强行引入新 tag 反而污染 vault tag 命名空间. layer 信息已经在文件路径里反映 (`01-Inbox/...` vs `02-Inputs/...` vs `05-Outputs/...`), tag 不重复表达.

其它 frontmatter 字段 (aliases / draft / summary / source / created_date / modified_date / permalink) 三层共用 v1 schema, 不分层.

> 注: `inputs` 的 README (`Memory/02-Inputs/README.md:21`) 建议 `type` 字段进 frontmatter, 但本 doc 不进——sow 浓缩出来的素材未必有明确单一 type, 强加字段反而引导 AI 编. 用户日后手工补 `type` 即可.

#### 内部接口 (AI ↔ script.py 协作契约)

AI 在 sow.md 流程节生成的**单候选数据结构** (传给 script + 写入文件):

```
Candidate {
    layer:    "inbox" | "inputs" | "outputs"   // AI 判 + 用户可改
    intent:   <原话, 逐字>                       // 不 paraphrase, 写入 body blockquote
    title:    <反推 + 清洗>                      // 5-25 字符, 见数据模型节
    summary:  <≤30 字>                           // 写入 frontmatter
    body:     <按 layer 骨架写>                  // 三套, 见下方
}
```

**body 骨架按 layer 切换**:

**Outputs 骨架** (与 v1 一致, 四段式):

```markdown
# <title>
> **intent**: <原话>
> 由 /sow 从会话浓缩生成于 YYYY-MM-DD HH:MM

## 背景
## 关键决策 / 设计
## 关键权衡
## 后续 / 未决
```
(任一段未触及写 "本次会话未触及" 占位.)

**Inputs 骨架** (新, 两段):

```markdown
# <title>
> **intent**: <原话>
> 由 /sow 从会话浓缩生成于 YYYY-MM-DD HH:MM

## 原始材料
<限定: 仅写"用户在会话里粘贴 / 引用的外部资料" — URL / 引用块 / 截图 OCR 文本 / 论文片段 / 代码片段. AI 自己的输出不算原始材料. 若会话里没有明确外部资料 → AI 应判 Inbox 不判 Inputs (强行落 Inputs 等于编)>

## 我的批注
<用户对原始材料的评价 / 提炼 / 联想, 从会话里抽用户原话>
```

**Inbox 骨架** (新, 一段):

```markdown
# <title>
> **intent**: <原话>
> 由 /sow 从会话浓缩生成于 YYYY-MM-DD HH:MM
> 一句话: <AI 反推, 为什么抢下来>

<限定: 用户 $ARGUMENTS 触发的会话最近 N 轮的"逐字引用" — 不浓缩、不 paraphrase. 格式随意, H2/H3 自由. 若会话仅一两句没什么"原文" → AI 写一段 intent 的扩展即可, 不强行凑长度>
```

**判层 few-shot examples** (作为 sow.md prompt 的样板 + reviewer 验证判层合理性的 ground truth, 实施时由 sow.md 内嵌而非外部文件):

**Example A — Inbox**
- 会话: 用户在闲聊里突然说"我刚想到一个 idea: 用 LLM 判 PR commit message 风格". AI 回复了 2 句技术可行性, 用户说"嗯先记下来", 没继续展开.
- intent: `/sow 记一下用 LLM 判 PR commit 风格的 idea`
- AI 判: **Inbox**. 因无外部资料 + 无决策 + 无长讨论, 只是"先扔池子".
- body 落点: 标题"用 LLM 判 PR commit 风格 idea"; 一句话"灵感来源 + 想做但没立马做"; 引用用户原句两句.

**Example B — Inputs**
- 会话: 用户贴了 Karpathy 一篇博客 URL, AI 读完总结了 5 点, 用户挑了 2 点说"这两点跟我现在的 X 项目能对上", 简单批了句"第 4 点关于 RL 我反对". 没立项动手.
- intent: `/sow 沉淀 Karpathy 博客读后感, 跟 X 项目对照`
- AI 判: **Inputs**. 因有明确外部资料 (URL) + 用户做了分类 + 批注, 但未到长讨论决策程度.
- body 落点: 「原始材料」节贴 URL + 用户挑的 2 点原文; 「我的批注」节写用户的对照 + 反对意见.

**Example C — Outputs**
- 会话: 用户和 AI 5 轮讨论 sow 多层设计, 中间有 3 个决策点 (env 反转 / 分层 veto / 三套 body), 每点用户说了"好"/"就这样".
- intent: `/sow 沉淀今天讨论的 sow 多层设计`
- AI 判: **Outputs**. 因 ≥3 轮实质讨论 + 多个决策被采纳.
- body 落点: 走四段式骨架 (背景 / 关键决策 / 关键权衡 / 后续未决).

**NL parser 协议** (AI 在 sow.md 提示词内实现, 非独立模块. **scope: 仅支持改 layer / title 两类字段**, 改 summary / body 不支持——这两个字段是 AI 浓缩产物, 用户想改请 `cancel` 后重跑 `/sow` 用更精准的 intent. 这条限制写进 propose 屏幕里给用户看见, 免反复试):

| 用户 NL 输入 | AI 解析为 | 动作 |
|---|---|---|
| `go` / `好` / `就这样` | confirm | 调 script + Write + 报告, 退出 loop |
| `cancel` / `算了` / `不写了` | abort | 不写, 报"取消", 退出 loop |
| `换 inbox` / `改成 inputs` / `走 outputs` | layer=X | 改层 → 跑分层 veto → 重生 body 骨架 → re-propose |
| `title 改成 X` / `叫 Y 吧` | title=X | 改 title → re-propose (path 一并重算) |
| `summary 改成 X` / `重写 body` / `body 加一段 Y` | 越界请求 | AI 回 "sow 只支持改 layer/title; summary/body 是 AI 浓缩产物, 想改请 `cancel` 后用更具体 intent 重跑 `/sow`". 不退出 loop. |
| 其它 (无法稳定解析) | 解析失败 | AI 回 "没听懂, 请用 `go` / `换<层>` / `改 title <X>` / `cancel`", 不退出 loop |

### 业务流

**BF1 — /sow 主流程 (AI 判层 + NL 确认 loop)**

```
function sowMain($ARGUMENTS):                          // 主入口: /sow <intent> 调用栈
    if not $ARGUMENTS:                                  // 意图必填, 见 sow.md:17 不变
        report "请说明本次要沉淀什么. 用法: /sow <意图>"   // 用户可见报错 + 用法提示
        return                                          // 命令终止, 不写文件
    if not envValid($USER_VAULT_PATH):                   // env 改名 + 上移到 vault 根, 校验范围扩到 vault + Memory + 3 子目录
        report "$USER_VAULT_PATH 未设 / 不是 vault 根, 见 README"  // 含 export 示例 (`export USER_VAULT_PATH=~/AI/MyJarvis`)
        return                                          // 命令终止, 不写文件
    memoryRoot = $USER_VAULT_PATH / "Memory"             // sow 内部硬编 Memory/ 前缀, 不进 env
    if not subdirsExist(memoryRoot, ["01-Inbox", "02-Inputs", "05-Outputs"]):  // 三子目录必须就位
        report "<memoryRoot> 缺子目录: <list>, 建议 mkdir <paths>"  // 列出缺哪个让用户手建
        return                                          // 缺子目录不自动创建, 防止 typo 错根

    candidate = generateCandidate($ARGUMENTS)           // AI 抽取 + 反推, 见 BF2
    while true:                                          // NL 确认 loop, 出口仅 confirm / abort
        propose(candidate)                              // 屏幕展示 layer / path / title / summary / body 预览
        userInput = readUserMessage()                   // 等用户下一条消息, 走 Claude 标准交互
        action = parseNL(userInput)                     // 见接口设计.内部接口表
        if action.type == "confirm":                    // 用户 go / 好 / 就这样
            break                                       // 退 loop, 走落盘流程
        elif action.type == "abort":                    // 用户 cancel / 算了 / 不写了
            report "取消, 未写入"                          // 用户可见状态
            return                                       // 命令终止, 不写文件
        elif action.type == "layer":                    // 用户改层 (换 inbox / 改成 outputs 等)
            candidate.layer = action.layer              // 临时改层后跑 veto + 重生 body
            if vetoFailed(candidate.layer):              // 见 BF3 分层 veto
                report "你选 <layer> 但 veto 不过, 自动降到 <fallback>"  // 屏幕显式注明降层原因
                candidate.layer = fallback              // 见 BF3 fallbackLayer 链
            candidate.body = rewriteByLayer(...)        // 重生 body 骨架, 见接口设计.内部接口
            continue                                    // 回 loop 头, re-propose
        elif action.type == "title":                    // 用户改 title
            candidate.title = sanitize(action.title)    // 清洗禁字符, 见 sow.md:50
            continue                                    // 回 loop 头, path 一并重算
        elif action.type == "out_of_scope":             // 用户想改 summary / body (越界)
            report "sow 只支持改 layer/title; summary/body 想改请 cancel 后重跑"
            continue                                    // 不退出 loop, 等用户重打
        else:                                           // 任何无法稳定解析的输入
            report "没听懂, 请用 go / 换<层> / 改 title <X> / cancel"
            continue                                    // 不退出 loop, 等用户重打

    result = runScript(candidate)                       // 调 script.py, 见 BF4
    if result.exit != 0:                                // 任一非 0 退出码
        report result.stderr                            // 转告退出码语义 (见对外 API 退出码表)
        return                                          // 命令终止, 不写文件
    Write(result.targetPath, result.frontmatter + "\n" + candidate.body)  // AI 工具落盘
    report "沉淀到 <vault 相对路径> (层: <layer>, permalink: posts/xxxx)"   // 含 layer 前缀, 与 v1 区分
```

**BF2 — AI 判层 + 候选生成**

```
function generateCandidate($intent):                    // 单候选生成, 不进 N 候选模式
    scope = filterSessionByIntent($intent)              // 按 intent 文本筛会话, 不相关的忽略
    layer = inferLayer($intent, scope)                  // 浓度启发式 (见 examples A/B/C 锚定):
                                                         //   ≥3 轮实质讨论 + ≥1 决策被采纳 → outputs
                                                         //   ≥1 轮实质讨论 + 含外部资料(URL/引用块) → inputs
                                                         //   其它(短想法 / 杂项捕捉) → inbox
                                                         // "实质讨论" 沿用 sow.md:36-43 定义
    if vetoFailed(layer, scope):                         // 分层 veto, 见 BF3
        oldLayer = layer                                 // 留底用于 propose 提示
        layer = fallbackLayer(layer)                    // outputs→inputs→inbox, inbox 永不 veto
        markFallbackReason(oldLayer, layer)              // propose 时屏幕注明 "原想 X 因 veto 降到 Y"

    title = deriveTitle($intent, scope, layer)          // 反推 title (不复述 intent 原文)
                                                         // 5-25 字符 + 清洗禁字符, sow.md:49-50
    summary = writeSummary(scope, layer)                // ≤30 字, 围绕 intent 做了什么 + 结论
    body = writeBodyByLayer(layer, $intent, scope)      // 三套骨架, 见接口设计.内部接口
    return Candidate(layer, $intent, title, summary, body)  // 单候选数据结构
```

**BF3 — 分层 veto + 自动降层**

```
function vetoFailed(layer, scope):                      // 主入口: 判 layer 在 scope 下是否过门槛
    if layer == "inbox":                                 // Inbox 是流转池, 杂项捕捉不该被拦
        return false                                    // intent 非空就放过, 无任何门槛
    if layer == "inputs":                                // Inputs 是分类素材, 至少有"一来一回"才算
        return scope.substantialRounds < 1              // ≥1 轮实质讨论 (排除纯执行 /sow / 纯短答)
    if layer == "outputs":                              // Outputs 是 long-form 草稿, 沿用 v1 双条件
        return (scope.substantialRounds < 3             // ≥3 轮实质讨论
                or not scope.hasAdoptedDecision)        // 且 ≥1 决策被采纳
                                                         // hasAdoptedDecision 判据 (沿用 sow.md:36-43):
                                                         //   用户明确说 "好/同意/确认/就这样/选 X"
                                                         //   或后续讨论基于该结论展开
                                                         // (判据完全主观, 由 AI 启发式判, 不机器可数)

function fallbackLayer(layer):                          // 降层链: outputs → inputs → inbox
    if layer == "outputs": return "inputs"              // outputs veto 不过先试 inputs
    if layer == "inputs":  return "inbox"               // inputs veto 不过最终落 inbox
    // inbox 永不 veto, 链条在此收口, 不需要 case
```

**BF4 — script.py 多 layer 路径与 frontmatter**

```
function scriptMain(--layer, --intent, --title, --summary):  // CLI 入口, 4 个参数都必填
    if --layer not in LAYER_DIR_MAP:                          // LAYER_DIR_MAP = {inbox: "01-Inbox",
        exit(4, "unknown layer: " + --layer)                  //   inputs: "02-Inputs", outputs: "05-Outputs"}
    if not envValid():                                         // $USER_VAULT_PATH 设且是目录
        exit(2, "env error: $USER_VAULT_PATH unset or not a dir")
    vault = $USER_VAULT_PATH                                   // env 是 vault 根, 不是 Memory 根
    MEMORY_SUBDIR = "Memory"                                  // sow 内部硬编 Memory/ 前缀, 不进 env
    memoryRoot = vault / MEMORY_SUBDIR                        // 拼出 Memory 根, 例 ~/AI/MyJarvis/Memory
    for dir in LAYER_DIR_MAP.values():                         // 三子目录全部得在 (sow 不自动建子目录)
        if not exists(memoryRoot / dir):                       // 缺哪个就报哪个 (相对 memoryRoot 而非 vault)
            exit(3, "missing subdir: " + str(memoryRoot / dir)) // stderr 给完整路径方便用户 mkdir

    yymm = today().strftime("%y%m")                           // 月份分组, 如 2605
    yymmdd = today().strftime("%y%m%d")                       // 文件名前缀, 如 260521
    targetPath = memoryRoot / LAYER_DIR_MAP[--layer] / yymm / f"{yymmdd}-{--title}.md"
                                                               // 完整路径如 <vault>/Memory/01-Inbox/2605/260521-X.md
    if exists(targetPath):                                     // 同日同 title 重跑 → 冲突
        exit(1, "path conflict: " + targetPath)               // AI 转告用户改 title
    try:                                                       // 包 try/except 区分 exit 1 与 mkdir 失败
        makedirs(targetPath.parent, exist_ok=True)             // yymm/ 不存在自动建, 已存在不报
    except OSError as e:                                       // 权限不足 / 磁盘满 / 路径非法
        exit(3, "mkdir failed: " + str(e) + ", path=" + str(targetPath.parent))
                                                               // 复用 exit 3 (目录相关错误), stderr 区分子类型

    tags = ["ai-distill"]                                      // 三层共用 (W6 决议: 不按 layer 分 tag)
    frontmatter = buildFrontmatter(tags, --summary, ...)      // permalink hash / 时间戳算法不变
    print(frontmatter)                                        // stdout 前段 = frontmatter
    print(f"\nTARGET_PATH: {targetPath}")                     // stdout 末行 = target path 哨兵
    exit(0)                                                   // 成功
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | `$ARGUMENTS` 空 | 用户 `/sow` 无参 | 报"请说明意图", 不写 | 上抛 (命令终止) |
| BF1 | env 缺 / 非目录 | `$USER_VAULT_PATH` 未 set / 指向不存在 | 报错 + `export USER_VAULT_PATH=~/AI/MyJarvis` 示例, 不写 | 上抛 |
| BF1 | Memory 子目录缺 | `$USER_VAULT_PATH/Memory/01-Inbox` 等任一不存在 | 报错 + 列出缺哪个完整路径 + 建议 mkdir, 不写 | 上抛 |
| BF1 | NL 解析失败 | 用户输入非 go/换层/改 title/cancel | 回"没听懂", **不退出 loop** | 吞 |
| BF1 | 用户 cancel | NL loop 内回 cancel/算了 | 报"取消, 未写入" | 上抛 (正常终止) |
| BF2 | scope 过滤后空 | intent 与会话完全不相关 | 仍降到 Inbox (无 veto 兜底), 但 propose 注明"会话与 intent 关联弱" | 吞 |
| BF3 | 用户在 NL loop 强选 Outputs 但 veto 不过 | 用户改层后跑 veto 失败 | propose 注明"你选 outputs 但 veto 不过, 自动降到 X", **不开 force 口子** | 吞 (降层) |
| BF4 | script.py exit 1 路径冲突 | outputs/inputs 同日同 title 重跑直接报; inbox 由 sow.md prompt 先尝试自动序号 (`-2.md` / `-3.md` ≤3 次), 仍冲突才进 exit 1 | AI 转告 stderr, 让用户改 title 后 NL 内 re-propose | 上抛 |
| BF4 | script.py exit 2 env 错 | $USER_VAULT_PATH 未设 / 不是目录 (BF1 漏过) | 双重防御, AI 转告 + export 示例 | 上抛 |
| BF4 | script.py exit 3 缺子目录 | `<vault>/Memory/` 存在但 `01-Inbox` / `02-Inputs` / `05-Outputs` 任一缺 (BF1 漏过) | AI 转告 stderr (子类型 `missing subdir` + 完整路径) + 建议 mkdir | 上抛 |
| BF4 | script.py exit 3 mkdir 失败 (新) | makedirs(yymm/) 权限不足 / 磁盘满 / 路径非法字符 | AI 转告 stderr (子类型 `mkdir failed`) + 建议检查权限或磁盘 | 上抛 |
| BF4 | script.py exit 4 layer 非法 | AI prompt 漏传 / 串错 | 报 AI 内部错: 重跑 /sow; 若复现请抓 log + 报 issue 给插件维护者 | 上抛 |
| BF1-BF4 共享 | intent 含 prompt injection | 用户 intent 字符串带"忽略上面指令"等 | 按字面理解为意图描述, **不执行**, 逐字写入 body blockquote | 吞 (规避) |

### 单测设计

**BF1 — /sow 主流程 (AI 判层 + NL 确认 loop)**

主流程含 AI 判断 + 用户 NL 交互, 自动测试边界:**伪代码逻辑的可测部分**走 script.py 单测 (BF4), AI 提示词部分走**手动场景脚本** (写在文档末尾"验证场景"节, 不进 test_script.py 自动化).

- **case 1.1 主路径**: 三层各跑通一次
  - Given: 三场景会话 (低浓度杂项 / 中浓度素材讨论 / 高浓度长讨论 + 决策)
  - When: 跑 `/sow <intent>` + 用户 `go`
  - Then: 文件落对应层 (Inbox / Inputs / Outputs), frontmatter tags 正确

- **case 1.2 NL loop 改层**
  - Given: AI 判 Inputs, 用户回 `换 outputs`
  - When: AI 跑 veto, 假设 veto 过
  - Then: re-propose 显示 Outputs path + 四段式 body 预览; 用户 `go` 后落 Outputs

- **case 1.3 NL loop 改层但 veto 不过**
  - Given: AI 判 Inbox, 用户回 `换 outputs`, scope 仅 1 轮无决策
  - When: AI 跑 outputs veto
  - Then: 屏幕注明"自动降到 inputs", candidate.layer == "inputs"

- **case 1.4 cancel**
  - Given: candidate 已生成
  - When: 用户回 `算了`
  - Then: 不写文件, 报"取消"

**BF2 — AI 判层 + 候选生成**

(AI 行为, 走手动验证场景, 不进自动化单测)

- **case 2.1 浓度启发式正确性**
  - 给定三场景对话样例 (`docs/plans/3dot141/260521-sow-multi-layer-plan.md` 实施时补具体样本)
  - 预期 AI 判层与样例标注一致

**BF3 — 分层 veto + 自动降层**

- **case 3.1 outputs veto 不过降 inputs**
  - Given: scope 含 2 轮实质讨论, 1 个决策 (轮次不足 3)
  - When: 跑 outputs veto
  - Then: vetoFailed == true, fallbackLayer == "inputs"

- **case 3.2 inputs veto 不过降 inbox**
  - Given: scope 含 0 轮实质讨论 (纯执行)
  - When: 跑 inputs veto
  - Then: vetoFailed == true, fallbackLayer == "inbox"

- **case 3.3 inbox 永不 veto**
  - Given: 任意 scope, 任意 intent
  - When: 跑 inbox veto
  - Then: vetoFailed == false

**BF4 — script.py 多 layer 路径**

- **case 4.1 主路径**: 三 layer 路径计算
  - Given: `--layer inbox/inputs/outputs --intent X --title Y --summary Z`, env 与三子目录就位
  - When: 跑 script.py
  - Then: stdout TARGET_PATH 分别落 `<root>/01-Inbox/yymm/yymmdd-Y.md` / `02-Inputs/...` / `05-Outputs/...`; frontmatter `tags` 字段分别为 `[ai-distill, clip]` / `[ai-distill, source]` / `[ai-distill]`

- **case 4.2 异常 - 缺 --layer**
  - Given: 仅传 `--intent --title --summary`
  - When: 跑 script.py
  - Then: argparse 报错 exit 非 0

- **case 4.3 异常 - layer 非法值**
  - Given: `--layer cards`
  - When: 跑 script.py
  - Then: exit 4, stderr "unknown layer"

- **case 4.4 异常 - Memory 根缺子目录**
  - Given: env 指 root, root 存在, `02-Inputs` 不存在
  - When: 跑 `--layer inputs`
  - Then: exit 3, stderr 含 `02-Inputs`

- **case 4.5 异常 - 路径冲突**
  - Given: 目标文件已存在
  - When: 跑 script.py
  - Then: exit 1, stderr 含 target path

- **case 4.6 异常 - mkdir 失败 (exit 3 子类型 `mkdir failed`)**
  - Given: env 指 root, 三子目录就位, 但 layer 目录无写权限 (e.g. `chmod 0500 02-Inputs`)
  - When: 跑 `--layer inputs`, yymm 子目录还不存在
  - Then: exit 3, stderr 含 `mkdir failed` 子类型与失败路径
  - 备注: 替代 v1 `test_mkdir_failure_exit_3`, 行为兼容但 stderr message 更精确 (区分 `missing subdir` 与 `mkdir failed` 两子类型)

## 方案选型

### Q1: env 怎么改? (4 选项, Review 2 修订)

**选项**:
- A 反转 `USER_WIKI_PATH` 指 Memory 根 (`~/AI/MyJarvis/Memory`); env 名不变, 含义变 (Review 1 决议).
- B 加 `USER_WIKI_INBOX_PATH` / `USER_WIKI_INPUTS_PATH` 三 env 平铺.
- C 加 `USER_WIKI_MEMORY_ROOT` 旧 env 标 deprecated 双轨.
- **D 改名 + 上移**: 弃用 `USER_WIKI_PATH` (v1), 引入 **`USER_VAULT_PATH`** 指 vault 根 (`~/AI/MyJarvis`). sow 内部硬编 `Memory/` 前缀, 跨命令复用同一 env (未来 `/task` 内部加 `Flow/` 前缀, 等).

**定**: **D**. 因:
- 用户 vault `~/AI/MyJarvis` 下有 `Flow / Knowledge / Memory / Meta` 四个顶层目录, Memory 仅其一. v1 env 名 "wiki" 也跟 Memory 不准 (Memory 含 wiki 但不只 wiki).
- 选 A 仍把 sow 绑死在 Memory 子树, 跨命令配 env 时重复劳动 (未来 `/task` 需要 `USER_TASK_PATH=~/AI/MyJarvis/Flow/05-Tasks` 等多 env).
- 选 D 让 vault 成为单一可移植单元 (跨设备同步 / 备份 / 切 vault 只改一个 env), 命令内部自管子目录.
- 否决 B/C 理由与 Review 1 同 (B 多 env 配置门槛, C 双轨永续维护).
- 代价: env 改名要求用户 zshrc 同步改一次 (个人插件成本可接受).
- → 影响 BF1 env 校验 (加 Memory 子目录), BF4 script.py 路径计算 (vault → memoryRoot 两步); 升 plugin.json major.

### Q2: AI 判层后用户确认 UI 形态?

**选项**: A 单候选 + NL 自由输入 loop / B 三候选 (Inbox/Inputs/Outputs body 全生成) 并列让用户挑 / C 单候选 + 短码 (`go / inbox / outputs / cancel`)
**定**: A. 因 (B) 三 body token 成本 3x, 大部分场景中 2/3 浪费; (C) 短码哲学跟 sediment 同 (N 候选多操作), 但 sow 是单候选少操作, NL 容错低. NL 也跟用户原始表达更近. → 影响 BF1 NL loop 协议, 接口设计.内部接口表.

### Q3: AI veto 跟多出口的冲突解?

**选项**: A 分层 veto, 严格度递减 (outputs ≥3 轮+决策, inputs ≥1 轮, inbox 无) / B veto 仅限 outputs, inbox/inputs 不 veto / C 完全取消 veto, 全靠用户确认
**定**: A. 因 (B) AI 想避 outputs veto 会主动降到 inbox 写, 实际造假 ("降级逼进斗"); (C) 丢"AI 不越权"护栏, 讨论太水 AI 也走 inbox 编. 分层 veto 让每层门槛跟定位匹配, AI 想升层也升不上. → 影响 BF3 vetoFailed 判定, 异常表"用户在 loop 强选 outputs"行.

### Q4: body 骨架三层共用还是分套?

**选项**: A 三层三套骨架 (outputs 四段 / inputs 两段 / inbox 一段) / B 三层共用四段式 (空段写"本次未触及") / C 只判 H1 + frontmatter, body 完全交 AI 随机应变
**定**: A. 因 (B) Inbox 文件会变成 3 段"本次未触及" + 1 段原内容, 违反 Inbox 轻量定位, 实质抑制使用; (C) Outputs 现有四段式是奇奇决定, 丢了反封装, 年度入库结构乱. 三套骨架跟三层定位匹配. → 影响接口设计.内部接口 body 骨架表.

### Q5: sediment 跟 sow 多出口怎么对齐?

**选项**: A sediment 只推 `/sow + intent`, 不插层推荐 (advisor 输出不变) / B sediment advisor 多输出"预估层" / C sediment 加三个出口 (sow:inbox / sow:inputs / sow:outputs) 自判层
**定**: A. 因 (B) sediment 也要学三层启发式, sow 也要学, 职责交叉容易不一致; (C) sow 独立调用 (不经 sediment) 时层能力丢. 选 A 让 sediment 专注"该跨项目沉淀"判断, sow 专注"层 + body" 判断, 边界清. → 影响 sediment.md 仅追加边界注. **plugin.json 版本变更与 sow 改动合并入同一次 commit, 单次 major bump (`0.41.0 → 1.0.0`) 覆盖两边**——不分两次升版本.

## 其他

### 部署

本次改动是 Claude Code 插件源码修改 + 用户 env 重配, 走 plugin marketplace 升级 + 用户操作两步.

- **版本号变更**: `.claude-plugin/plugin.json` `version` 从 `0.41.0` 升到 `1.0.0` (major bump, env 语义反转 = 破坏性变更). 注: 由 `0.x` 阶段进入 `1.x` 也是社区惯例上的"项目稳定线"信号, 与本次破坏性变更一致.
- **灰度策略**: 无——插件直接拉 git, 用户主动 update; 个人插件无分批
- **回滚预案**: 用户端 git checkout 上一个 main commit (=升级前 commit) + 把 zshrc 中 `USER_VAULT_PATH` (v2) 改回 `USER_WIKI_PATH=~/AI/MyJarvis/Memory/05-Outputs` (v1 含义). v2 引入的 `USER_VAULT_PATH` 可保留不读不影响 v1. 主仓 `git revert` 后再升一次 major (从 `1.0.0` → `2.0.0`, 不退回到 `0.41.x`, 避免版本号倒退)
- **监控指标**: 无 metric——插件无运行时. 通过 GitHub issue / 用户反馈监控. **关键回归指标 (人工观察)**: 升级后第一次跑 `/sow <intent>` 应有 propose + NL loop 出现, 而非直接落盘 (v1 行为)
- **升级 checklist** (用户视角):
  1. `git pull` 主仓
  2. zshrc / 环境 export: `export USER_VAULT_PATH=~/AI/MyJarvis` (新引入, 指 vault 根). v1 `USER_WIKI_PATH` v2 不读, 保留不影响, 想删可删
  3. 确认 `$USER_VAULT_PATH/Memory/01-Inbox` / `02-Inputs` / `05-Outputs` 三子目录都存在 (旧用户应有, 新用户走 `mkdir`)
  4. 跑一次 `/sow 测试沉淀` 验证 propose 流程

### 已知限制

- **多次 `/sow` 同会话切层会内容冗余**: 用户先 `/sow A` 落 Outputs, 再 `/sow B` 同会话落 Inputs, 两个文件 body 都从同一段会话浓缩, 内容大量重叠. v2 不告警 (超 scope); 用户感知后自行整合. 未来若高频出现可考虑加"近 30 分钟内已跑过 sow, 确认继续?"提示, 不入本 doc.
- **`scope.hasAdoptedDecision` 启发式不稳**: 不同会话 AI 可能对"是否有采纳决策"判出相反结果, 加上分层降级链, 最终落层可能不确定. 沿用 v1 sow.md:36-43 现状 (判据本身就主观), 未来可量化关键词集合 (如必须命中 `好/同意/确认/就这样/选 X` 之一) 收紧, 不入本 doc.
- **`USER_VAULT_PATH` 跨命令共享的耦合代价**: env 一次设置多命令读, 是优势; 但也意味着单命令对 env 含义的破坏性改动 (改名 / 改语义 / 改前缀) 会影响所有读它的命令. 未来加新命令 (`/task` 等) 时, 内部硬编子目录前缀的约定要在 plugin-level 文档 (例如 `model/agent-about.md` 全局占位符表) 集中维护, 防止命令各加各的散落. 本 doc 仅添加 sow 的 `Memory/` 前缀, 未引入 plugin-level 多命令子目录公约——下次新命令进来时再单独立设计文档.

---

## Review Log

### Review 1 — 2026-05-21

**Reviewer Report 全文** (general-purpose subagent 输出):

#### ❌ Critical
- **C1** [BF4 退出码语义冲突]: 现 `script.py` exit 3 是「`os.makedirs` 失败」, 有对应 test `test_mkdir_failure_exit_3`. 设计文档把 exit 3 重定义为「Memory 根缺子目录」, 但 BF4 还保留 `makedirs(targetPath.parent, exist_ok=True)`——这步失败时走哪个 exit code 没说. 实施时第一行单测就坏.
- **C2** [BF1-BF4 伪代码注释覆盖不达标]: reviewer skill 明文「每行必有 `//` 注释」, 实际 BF1 多个执行行 (`return` / `report ...` / `break` 等) 裸露.
- **C3** [「实质讨论」vs「素材讨论」概念漂移]: 同一阈值在目标节 / BF2 注释 / BF3 / Q3 选项混用两个不同名词, AI 实施时按哪个不明.

#### ⚠️ Warning
- **W1** 背景节 3 条 bullets 缺主因/辅因标注.
- **W2** Q5 版本 bump 表述歧义 (单 plugin.json 一次只能 bump 一次).
- **W3** 目标 plugin 版本号没给 (`0.41.0 → ?`).
- **W4** Inputs body 骨架「原始材料」语义模糊: sow 浓缩自会话非剪藏外部资料, 无明确外部链接时填什么?
- **W5** Inbox body 骨架「原内容」语义模糊: sow 没"剪藏原文", AI 该写啥?
- **W6** `tags` 选 `clip` / `source` 无依据.
- **W7** Inbox 高频写入 vs exit 1 路径冲突: 同日多次落 Inbox 都让用户改 title 不友好.

#### 💡 Suggestion
- **S1** BF2 case 2.1 引用占位 plan 文件路径.
- **S2** 「架构图」H3 实际是流程图, 标题与内容不对应.
- **S3** Q1/Q2/Q4 否决理由部分混抽象词 ("永续"/"丢了反封装"/"年度入库结构乱").
- **S4** "Inbox 流水账 YYYY-MM-DD.md 不进 sow scope" 只在数据模型表旁注, 建议提至范围节.
- **S5** exit 4 文案"AI 内部错不该发生"略弱.

#### ❓ Open Questions
- **Q1** 背景节 `Memory/README.md:18-23`, 实际 `:17-23` 起步.
- **Q2** `Memory/02-Inputs/README.md:21` reviewer 自核 ✓ 可忽略.
- **Q3** `commands/sediment.md:118-126`, 实际起 `:117` (H4 标题).

#### Self-Audit
- **SA1** Inputs / Inbox 在 sow 语境下"什么会话该跑哪个", `inferLayer` 缺 examples.
- **SA2** NL loop 出口边界未声明用户回"改 summary"/"重写 body"怎样.
- **SA3** `scope.hasAdoptedDecision` 判据完全主观, 不同会话可能判出相反结果.
- **SA4** 多次 `/sow` 同会话切层导致内容冗余, 设计未讨论.

**Verdict**: ❌ Has issues — 22 条 finding.

---

**用户决定**: fix C1, C2, C3, W1-W7, SA1-SA4; answer Q1, Q3 (校准行号); skip Q2 (reviewer 自核 ✓), S1, S2, S3, S4, S5.

**本轮修订**:

- **C1** [BF4 exit code]: 把 exit 3 语义扩为「目录相关错误」涵盖原 mkdir 失败 + 新缺子目录两子类型, stderr message 区分 `missing subdir` / `mkdir failed`. BF4 伪代码加 try/except 包 makedirs. 异常表加一行 "exit 3 mkdir 失败". 单测加 case 4.6 mkdir 失败. 见接口设计.对外 API 退出码表、BF4、异常表、单测设计.
- **C2** [伪代码注释覆盖]: 重写 BF1-BF4 伪代码, 补齐裸行注释. BF1 涉及最多 (20+ 行新加注释), BF2/BF3/BF4 加 case 注释 + 收口注释. 见实现.业务流.
- **C3** [「实质讨论」vs「素材讨论」概念漂移]: 全文统一用「实质讨论」 (沿用 `sow.md:36-43` 定义). BF2 inferLayer 注释明确浓度启发式三档判据, BF3 vetoFailed 收口标注定义. 见目标节、BF2、BF3.
- **W1** [背景主因/辅因]: 背景 3 条具体表现拆为「主因」(强制四段式骨架阻塞 Inbox/Inputs) + 「辅因」(veto 拦 + env 命名不匹配) 两组, 显式标 H4-like 加粗标签. 见背景.
- **W2** + **W3** [单次 bump + 目标版本号]: 目标节明确"`plugin.json` 单次 major bump 覆盖 sow + sediment 两边改动 (`0.41.0 → 1.0.0`)". Q5 末尾改写为"不分两次升版本". 部署节加版本号变更行 + 进入 `1.x` 阶段说明 + 回滚走 `1.0.0 → 2.0.0` 不退版本. 见目标、Q5、部署.
- **W4** + **W5** + **SA1** [body 骨架 source + few-shot examples]: Inputs 骨架「原始材料」节加限定"仅写用户在会话里粘贴/引用的外部资料, AI 输出不算, 无外部资料 → 判 Inbox 不判 Inputs". Inbox 骨架「原内容」节加限定"用户 $ARGUMENTS 触发会话最近 N 轮的逐字引用, 不浓缩/不 paraphrase". 在内部接口节末尾加 3 个 few-shot examples (A=Inbox / B=Inputs / C=Outputs) 锚定判层 ground truth. 见接口设计.内部接口.
- **W6** [`tags` 选择依据]: 实测 grep `~/AI/MyJarvis/Memory/01-Inbox/2508/` `02-Inputs/` `05-Outputs/2604/` 现有 `.md` frontmatter, `tags:` 字段大多为空, 无既有 `clip`/`source` 命名惯例. 据此**三层共用 `[ai-distill]` 不分层**, BF4 伪代码同步去掉 `TAGS_BY_LAYER`. 见接口设计.数据模型、BF4.
- **W7** [Inbox 高频冲突 fallback]: 退出码表 exit 1 行说明 "inbox 由 sow.md prompt 在 NL loop 前先尝试自动序号 `-2.md` / `-3.md` 最多 3 次, 仍冲突才进 exit 1; outputs/inputs 直接 exit 1". 异常表同步. 见接口设计.对外 API、异常表.
- **SA2** [NL loop 边界]: 内部接口 NL parser 表加一行 "summary/body 越界请求 → 报指引让用户 cancel 后重跑". BF1 case 加 `out_of_scope` action 分支. 见接口设计.内部接口、BF1.
- **SA3** [`hasAdoptedDecision` 主观性]: BF3 vetoFailed 注释明确判据 (沿用 sow.md:36-43: "好/同意/确认/就这样/选 X 之一关键词或后续讨论基于该结论展开"). "已知限制"节再点一次主观性 + 未来量化方向. 见 BF3、已知限制.
- **SA4** [同会话多次 sow 冗余]: 加"已知限制"节列为已知问题, 不入本 doc 实施 scope. 见已知限制.

**Open Questions 答复**:

- **Q1**: fix — 把 `Memory/README.md:18-23` 校准为 `Memory/README.md:17-23` (`:17` 是收纳规则 bullet 列表起始行). 见背景.
- **Q2**: skip — reviewer 自核 ✓, 无需处理.
- **Q3**: fix — 把 `commands/sediment.md:118-126` 校准为 `commands/sediment.md:117-126` (`:117` 是 H4 `#### wiki:cross-project 出口（advisor）` 标题行). 见背景.

**本轮 finding 跳过项 + 理由**:
- S1 (本 doc 嵌 inline plan example): 跳 — 判层 examples 已通过 W4/W5/SA1 合并修复给出 3 个, 已覆盖样本需求, 不再单独加 plan 占位说明.
- S2 (架构图 H3 名实不符): 跳 — 当前架构图节明确写"无运行时多组件", 流程图节是正确归位, H3 标题修订属可读性优化但不影响理解, 留待下轮.
- S3 (否决理由量化): 跳 — 当前理由读者可推断, 进一步量化不影响实施.
- S4 (流水账提至范围节): 跳 — 已在目标节"不做"列表加了`01-Inbox/<yymm>/YYYY-MM-DD.md` 流水账格式不入 sow scope, 等价于范围节澄清.
- S5 (exit 4 修复指引): 已合并修入退出码表 exit 4 行 ("重新跑 /sow; 若复现请抓 log + 报 issue"), 不再 skip 仅文案优化部分.

---

### Review 2 — 2026-05-21

**触发**: 用户在 design-doc-writing skill step 9 (再来一轮 review?) AskUserQuestion 的 Other 通道提出新优化 — env 不仅反转语义指 Memory 根, 而是改名 + 上移到 vault 根 (`~/AI/MyJarvis`), 跨命令复用同一 env. 属用户提议的设计深化, 非 reviewer subagent 重审; 在同一 Review Log 下加节而非重置 brainstorming (保持 living document 历史完整).

**用户决定** (AskUserQuestion 两子问):
- env 改名: `USER_VAULT_PATH` (从 `USER_WIKI_PATH` 改名 — 名字准, 跨命令复用语义清).
- 改动层级: 算 reviewer cycle 第二轮修订 (同 Review Log 下加节).

**本轮修订**:
- 背景节 (核心问题 + 辅因 3): 标 v1 env 名为 `USER_WIKI_PATH`; 辅因 3 加 v2 修复说明 (改名 `USER_VAULT_PATH` 指 vault 根 + Memory/ 前缀 sow 内部硬编).
- 目标节 env 行: "env 语义反转" 改为 "env 改名 + 反转 + 上移"; 含 env 改名 + Memory/ 前缀 + 跨命令复用 + 单次 major bump.
- 流程图 校验那行: 校验范围改 `<vault>/Memory/{01-Inbox, 02-Inputs, 05-Outputs}`.
- 架构.文本总结: env 描述改 vault 根 + `MEMORY_SUBDIR` 常量.
- 实现.影响.sow.md ①: env 描述更新 (vault 根, v1 USER_WIKI_PATH 弃用).
- 实现.影响.agent-about.md: 全局占位符表 env 含义跨命令共享说明.
- 实现.接口设计.对外 API 命令 args 表: 加 "env 名" 行 (USER_WIKI_PATH 弃用 / USER_VAULT_PATH 新引入) + "路径拼接" 行 (Memory/ 前缀 sow 内部硬编).
- 实现.接口设计.对外 API 退出码 2 行: 加 `export USER_VAULT_PATH=~/AI/MyJarvis` 示例.
- 实现.接口设计.数据模型: 路径模板加 vault 根 + Memory/ 子前缀双层目录树.
- 实现.业务流 BF1 伪代码: env 校验改 vault, 加 `memoryRoot = $USER_VAULT_PATH / "Memory"` 步骤, 三子目录校验基于 memoryRoot.
- 实现.业务流 BF4 伪代码: 加 `vault = $USER_VAULT_PATH` + `MEMORY_SUBDIR = "Memory"` + `memoryRoot = vault / MEMORY_SUBDIR` 三步; 三子目录校验 + targetPath 拼接都改基于 memoryRoot; missing subdir stderr 给完整路径.
- 实现.异常与失败模式表: BF1 env 行 export 示例改 `USER_VAULT_PATH`; BF1 缺子目录行路径改 `$USER_VAULT_PATH/Memory/<dir>`; BF4 exit 3 缺子目录行 stderr 完整路径.
- 方案选型 Q1 重写: 4 选项 A/B/C/D, 选 **D (改名 + 上移)**, 列 vault 多顶层 + 跨命令配 env 重复 + 单一可移植单元 三条理由.
- 其他.部署.回滚预案: zshrc env 回滚改回 `USER_WIKI_PATH` 兼容 v1, v2 `USER_VAULT_PATH` 可保留不读.
- 其他.部署.升级 checklist: step 2 改为 `export USER_VAULT_PATH=~/AI/MyJarvis`, v1 `USER_WIKI_PATH` 不读但保留不影响.
- 已知限制: 加 "USER_VAULT_PATH 跨命令共享的耦合代价" 条 — 未来加新命令时子目录前缀公约 (例如 `model/agent-about.md` 全局占位符表) 集中维护伏笔.

**Review 2 未跑 reviewer subagent**: 本轮变更涉及 env 名 / 路径模板 / Q1 / 部署 / 已知限制等节, 仍在 Review 1 reviewer 已审查维度内 (设计意图 / 决策站得住 / 接口设计 / 内部一致性), 没引入新章节 / 新业务流 / 新单测——改动是同一设计的 env 一层语义抽高. 跳 reviewer 第二轮; 若用户后续要再跑 reviewer 可单独 dispatch.

