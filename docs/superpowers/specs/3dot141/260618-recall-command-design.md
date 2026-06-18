---
type: design-doc
topic: /recall command — 从 wiki 和 vault 检索已沉淀内容
date: 260618
author: 3dot141
status: draft
---

# Design Doc: /recall — 沉淀内容检索命令

## 背景

**核心问题**: sow/distill 体系只有写入没有读取。两个数据源各有缺口：

- **wiki**（`.agents-personal/wiki/`）：AI 有被动查阅路径（遇设计/选型场景自动读 `index.md`），但用户没有主动检索入口。AI 查阅依赖触发条件命中——不命中就查不到。
- **vault**（`$USER_VAULT_PATH/Memory/`）：写进去之后完全没有检索能力。靠用户自己在 Obsidian 里手动翻目录。AI 工作时也不查 vault——跨项目沉淀的经验无法回流到当前会话。

**附带问题**: 沉淀越积越多（wiki 几十页、vault 上百篇），按主题找需要逐个翻 index 或目录，成本越来越高。两个数据源都是 gitignored 的本地数据（wiki 在 `.agents-personal/`，vault 在用户 home 下），不同 worktree / 机器上内容可能不同，没有集中索引。

不解决的代价: 沉淀变成"只进不出的黑洞"——用户对 `/sow` `/distill` 的投入感渐低，因为"写了也找不到"。

## 目标

- 用户跑 `/recall <keyword>` → 几秒内拿到相关条目清单（≤10 条，按置信度降序）
- 每条清单含 { 标题, 内容总结(≤30字), 路径, 置信度 }
- 搜索委派 subagent，主 agent context 不被搜索过程（rg 输出、文件解析）污染
- 多语言关键词自动扩展（中英文 + 同义词），保证召回覆盖率
- wiki 和 vault 结果分区展示，用户能分辨来源

## 架构

### 流程图

```
用户输入 /recall <keyword>
       ↓
command 加载 → 主 agent spawn subagent (agentType: recall-search)
       ↓
subagent: AI 扩展关键词 → 3-5 个变体 (中英文 / 同义词 / 缩写)
       ↓
每个变体跑 rg -il (wiki 目录 + vault 目录)
       ↓
合并去重 → 候选文件列表
       ↓
逐文件: 提取标题 (wiki 从 frontmatter / vault 从 body H1) + tags + summary + 正文首段
       ↓
AI 综合打分 (直接输出 0-1 置信度): 标题命中 > tags > summary > body × 变体命中数
       ↓
取 top ≤10
       ↓
按 wiki / vault 分区格式化 → 返回精简清单给主 agent
```

### 架构图

```
+------------------+     spawn      +-------------------+
|   Main Agent     |────────────────|   recall-search   |
|  (context 干净)   |    精简清单     |    Subagent       |
|                  |◄───────────────|                   |
+------------------+                +-------------------+
                                      │         │
                                 Bash(rg)    Read(frontmatter)
                                      │         │
                              ┌───────┴─────────┴───────┐
                              │                         │
                     .agents-personal/wiki/    $USER_VAULT_PATH/Memory/
                     (有 index.md 索引)        (按 layer/yymm/ 目录)
```

### 文本总结

整体架构是 command + subagent 两层分工。`commands/recall.md` 定义入口格式和 spawn 指令，`agents/recall-search.md` 定义 subagent 的搜索行为。subagent 拿到用户关键词后分三步走：AI 扩展关键词（覆盖中英文变体）→ rg 批量召回候选文件 → 逐文件解析 frontmatter 后 AI 综合打分排序。最终 subagent 只返回 ≤10 条精简清单，主 agent 按需 Read 具体文件。

核心约束：rg 做召回（快、支持正则、中英文通吃）；AI 做排序（理解语义、字段加权、中文无需分词器）；subagent 做隔离（搜索过程不进主 agent context）。

## 实现

### 影响

```
nocode-evolve/
├── commands/
│   └── recall.md                    (NEW)  slash command 定义 (入参校验 / spawn 指令 / 出参格式)
├── agents/
│   └── recall-search.md             (NEW)  subagent 类型 (搜索 + 打分的完整 prompt)
└── .claude-plugin/
    └── plugin.json                  (改)   version minor 升 (新增 command + agent = 兼容增强)
```

无脚本、无依赖——搜索和打分全由 subagent AI 完成，不需要额外的 .mjs 脚本或 npm 包。

### 接口设计

#### Command 入参 / 出参

入参：`/recall <keyword>`，keyword 必填，支持一个或多个词。无参数时 command 报错 + 用法提示，不 spawn subagent。

出参（subagent 返回、主 agent 展示给用户的清单格式）：

路径约定：wiki 相对项目根（`.agents-personal/wiki/...`），vault 相对 vault 根（`Memory/...`）。

```
📂 Wiki (.agents-personal/wiki/)
| # | 标题            | 内容总结                   | 路径                                                  | 置信度 |
|---|-----------------|---------------------------|-------------------------------------------------------|--------|
| 1 | worktree 隔离原则 | git worktree 建在项目同级... | .agents-personal/wiki/pages/worktree-isolation.md      | 0.95   |
| 2 | 分支管理约定      | 所有分支走 worktree 不裸开... | .agents-personal/wiki/draft/260610-branch-convention.md | 0.82   |

📂 Vault ($USER_VAULT_PATH/Memory/)
| # | 标题            | 内容总结                       | 路径                                              | 置信度 |
|---|-----------------|-------------------------------|----------------------------------------------------|--------|
| 3 | git worktree 踩坑记 | worktree 内 env 需从主仓复制... | Memory/05-Outputs/2606/260615-git-worktree-踩坑.md | 0.78   |
```

vault 的标题从 body `# <title>` H1 提取（vault frontmatter 无 `title` 字段，详见 BF3）。

无结果时：`未找到与 "<keyword>" 相关的沉淀内容。`

#### 内部接口

**recall-search subagent**（`agents/recall-search.md`）对外契约：

```yaml
name: recall-search
description: 搜索 wiki 和 vault 中的已沉淀内容，返回按置信度排序的精简清单。用于 /recall command 委派搜索，避免搜索过程污染主 agent context。
tools: Bash, Read
```

- 输入：主 agent spawn 时传入的 prompt，含用户原始关键词 + 两个搜索目录路径
- 输出：subagent 的 final text = markdown 分区清单（即上方出参格式）
- 工具权限：`Bash`（跑 rg / grep）、`Read`（读 frontmatter + 正文）

**command → subagent spawn 契约**：

本仓库现有 command（sow/distill/task）均为 inline 执行，`/recall` 是首个 spawn subagent 的 command。command.md 里的 spawn 指令写法：

```markdown
调用 Agent 工具 spawn recall-search subagent：
- agentType: recall-search
- prompt 模板:

  搜索关键词: <$ARGUMENTS>
  Wiki 目录: <当前项目>/.agents-personal/wiki/
  Vault 目录: $USER_VAULT_PATH/Memory/
  
  按 agents/recall-search.md 定义的流程执行搜索，返回精简清单。
```

路径解析：wiki 路径由主 agent 在 spawn 前拼接（`<project-root>/.agents-personal/wiki/`）；vault 路径直接传 `$USER_VAULT_PATH/Memory/`（env 变量在 subagent 进程中可见）。subagent 负责检查目录是否存在。

### 业务流

**BF1 — 关键词扩展（subagent AI 能力）**

```
function expandKeywords(userKeyword):                      // AI 把用户关键词扩展为 3-5 个搜索变体
    variants = [userKeyword]                                // 始终保留原始关键词
    if containsChinese(userKeyword):                        // 中文输入
        variants.push(englishTranslation)                   // 加英文翻译 (如 "工作树" → "worktree")
        variants.push(chineseSynonyms)                      // 加中文同义词 (如 "工作树" → "分支隔离")
    else:                                                   // 英文输入
        variants.push(chineseTranslation)                   // 加中文翻译 (如 "worktree" → "工作树")
        variants.push(englishVariants)                      // 加英文变体/缩写 (如 "worktree" → "git worktree")
    return variants.slice(0, 5)                             // 上限 5 个，每个都要跑一遍 rg
```

**BF2 — rg 召回候选文件**

```
function rgRecall(variants, wikiDir, vaultDir):             // 对每个变体跑 rg，收集候选文件
    searchDirs = []                                         // 待搜目录列表
    if exists(wikiDir):                                     // .agents-personal/wiki/ 存在才搜
        searchDirs.push(wikiDir)
    if isDir(vaultDir):                                     // $USER_VAULT_PATH/Memory/ 存在才搜
        searchDirs.push(vaultDir)
    if searchDirs.empty():                                  // 两者都不可用
        return error("无可搜索的数据源")                       // 上抛，报错退出

    candidates = {}                                          // file → { hitCount, hitVariants[] }
    for variant in variants:
        for dir in searchDirs:
            // rg -il: 忽略大小写 + 只输出文件名; --glob '*.md' 只搜 markdown
            files = bash("rg -il --glob '*.md' '{variant}' {dir}")
            for file in files:
                candidates[file].hitCount += 1               // 该文件被几个变体命中了
                candidates[file].hitVariants.add(variant)    // 记录命中了哪些变体
    return candidates                                        // 去重后的候选集
```

**BF3 — 元数据提取 + AI 打分**

两个数据源的 frontmatter 结构不同，title 取法不一样：

| 字段 | wiki (distill 写入) | vault (sow 写入) |
|------|---------------------|-------------------|
| title | frontmatter `title` 或 `slug` | **无** `title` 字段——从 body `# <title>` H1 提取 |
| summary | frontmatter `description` | frontmatter `summary` |
| tags | frontmatter `tags[]` | frontmatter `tags[]` |
| 正文 | TLDR 行（`**TLDR**: ...`） | body 第一段（无 TLDR） |

```
function parseAndScore(candidates, userKeyword):             // 逐文件提取元数据，AI 综合打分
    scoredResults = []
    for file, meta in candidates:
        source = isUnderWiki(file) ? "wiki" : "vault"
        content = Read(file, limit=40)                       // 前 40 行：vault frontmatter ~8 行 + H1 + 首段
                                                             // wiki frontmatter ~10 行 + TLDR + 首段
                                                             // 来源：sow 骨架最短 Inbox ~15 行正文，40 行余量充足

        fm = extractYamlFrontmatter(content)                 // 解析 --- ... --- 之间的 YAML

        // title 提取——两源策略不同
        if source == "wiki":
            title = fm.title ?? fm.slug ?? basename(file)    // wiki frontmatter 有 title/slug 字段
        else:
            title = extractH1FromBody(content)               // vault 无 title 字段，从 body `# <title>` 提取
                    ?? basename(file)                         // fallback 到文件名（极端情况）

        // summary 提取——字段名不同
        if source == "wiki":
            summary = fm.description ?? extractTLDR(content)  // wiki 优先 frontmatter description，再找 TLDR 行
        else:
            summary = fm.summary ?? ""                        // vault frontmatter 有 summary 字段

        tags = fm.tags ?? []                                  // 两源都有 tags 字段
        bodySnippet = extractFirstParagraph(content)          // 兜底：正文第一段

        // AI 综合打分（直接输出 0-1 置信度），考虑:
        //   标题命中权重最高（不论来源），tags 次之，summary 再次，正文最低
        //   多变体命中的文件更相关（hitVariants.size / totalVariants）
        //   语义相关：即使没精确命中，内容主题与 userKeyword 是否相关
        confidence = aiJudgeRelevance(
            userKeyword, title, tags, summary, bodySnippet,
            meta.hitVariants                                  // 命中了哪些变体
        )

        scoredResults.push({
            title,
            summary: truncate(summary || bodySnippet, 30),    // 内容总结 ≤30 字
            path: relativePath(file, source),                 // wiki → .agents-personal/wiki/... / vault → Memory/...
            confidence,
            source
        })

    return scoredResults
        .sort(byConfidenceDesc)                               // 置信度降序
        .slice(0, 10)                                         // 取 top 10
```

**BF4 — 分区格式化输出**

```
function formatOutput(results, userKeyword):                 // 按 wiki/vault 分区输出 markdown 表格
    wikiResults = results.filter(r => r.source == "wiki")
    vaultResults = results.filter(r => r.source == "vault")

    output = ""
    seq = 1                                                  // 全局编号，跨分区连续
    if wikiResults.length > 0:
        output += "📂 Wiki (.agents-personal/wiki/)\n"
        output += toTable(wikiResults, seq)                  // | # | 标题 | 内容总结 | 路径 | 置信度 |
        seq += wikiResults.length
    if vaultResults.length > 0:
        output += "\n📂 Vault (Memory/)\n"
        output += toTable(vaultResults, seq)
    if results.length == 0:
        output = "未找到与 \"" + userKeyword + "\" 相关的沉淀内容。"

    return output                                            // subagent final text = 此文本
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| — | keyword 为空 | 用户 `/recall` 无参数 | command 层报错 + 用法提示，不 spawn subagent | 上抛 |
| BF2 | rg 不可用 | macOS 未装 rg | fallback `grep -ril`，输出注明"rg 不可用，用 grep fallback" | 吞 (降级) |
| BF2 | wiki 目录不存在 | 项目无 `.agents-personal/wiki/` | 跳过 wiki 搜索，输出注明；只搜 vault | 吞 |
| BF2 | vault env 未设 | `$USER_VAULT_PATH` 未设或不是目录 | 跳过 vault 搜索，输出注明；只搜 wiki | 吞 |
| BF2 | 两个数据源都不可用 | wiki 不存在 + vault 未设 | 报错"无可搜索的数据源"，退出 | 上抛 |
| BF2 | 0 候选 | rg 所有变体都没匹配 | 输出"未找到相关内容"，BF3-4 不执行 | 吞 |
| BF3 | frontmatter 缺失 | 文件无 YAML frontmatter | wiki: title fallback 到文件名; vault: title 从 body H1 提取，H1 也没有则 fallback 到文件名。summary fallback 到正文前 30 字 | 吞 |
| BF3 | vault 无 H1 | vault 文件 body 无 `# <title>` 行 | fallback 到文件名（如 `260615-git-worktree-踩坑`） | 吞 |
| BF3 | 文件过大 | 单文件 >1000 行 | Read limit=40 已限制，只读前 40 行（来源：vault 最短骨架 Inbox ~15 行正文，40 行余量充足） | 吞 |
| BF3 | 候选文件 >30 个 | 关键词太泛导致大量命中 | 先按 hitCount 降序取 top 30 再进 AI 打分，避免 subagent 读太多文件 | 吞 (截断) |

### 单测设计

**BF1 — 关键词扩展**

注：BF1 的关键词扩展由 AI 完成，以下 case 是行为冒烟测试（验证 AI 会扩展、会跨语言），不是可写成 hard assert 的确定性断言。

- **case 1.1 英文关键词扩展**
  - Given: keyword = "worktree"
  - When: expandKeywords 执行
  - Then: 返回含 "worktree" + 至少一个中文变体 (如 "工作树"), 总数 3-5

- **case 1.2 中文关键词扩展**
  - Given: keyword = "分支隔离"
  - When: expandKeywords 执行
  - Then: 返回含 "分支隔离" + 至少一个英文变体 (如 "worktree" 或 "branch isolation")

- **case 1.3 多词关键词**
  - Given: keyword = "git worktree setup"
  - When: expandKeywords 执行
  - Then: 返回含原词 + 拆分变体 + 中文翻译, 不超 5 个

**BF2 — rg 召回**

- **case 2.1 主路径: 两源都有匹配**
  - Given: wiki/ 有 2 文件含 "worktree", vault/Memory/ 有 1 文件含 "worktree"
  - When: rgRecall 对所有变体执行
  - Then: candidates 含 ≥3 文件, 各自 hitCount 反映命中变体数

- **case 2.2 单源可用**
  - Given: wiki/ 存在, $USER_VAULT_PATH 未设
  - When: rgRecall 执行
  - Then: 只搜 wiki/, 输出注明 vault 跳过

- **case 2.3 rg fallback**
  - Given: rg 不在 PATH
  - When: rgRecall 执行
  - Then: 改用 grep -ril, 候选集结构不变

- **case 2.4 空结果**
  - Given: 所有变体在两个目录都没匹配
  - When: rgRecall 执行
  - Then: candidates 为空

**BF3 — 解析 + 打分**

- **case 3.1 标题命中排最高**
  - Given: 文件 A title 含 "worktree", 文件 B 仅 body 含 "worktree"
  - When: parseAndScore 执行
  - Then: A.confidence > B.confidence

- **case 3.2 多变体命中加分**
  - Given: 文件 A 命中 "worktree" + "工作树" (2 变体), 文件 B 只命中 "worktree"
  - When: parseAndScore 执行
  - Then: A.confidence ≥ B.confidence

- **case 3.3 vault title 从 body H1 提取**
  - Given: vault 文件 frontmatter 无 title 字段，body 有 `# git worktree 踩坑记`
  - When: parseAndScore 执行
  - Then: title = "git worktree 踩坑记"（从 H1 提取），不是文件名

- **case 3.5 frontmatter 完全缺失降级**
  - Given: 某文件无 frontmatter 也无 H1
  - When: parseAndScore 执行
  - Then: title = 文件名, summary = 正文前 30 字, 打分正常

- **case 3.4 候选过多截断**
  - Given: 35 个候选文件
  - When: parseAndScore 执行
  - Then: 先按 hitCount 取 top 30 再打分, 最终返回 ≤10 条

**BF4 — 格式化输出**

- **case 4.1 分区展示**
  - Given: results 含 wiki 3 条 + vault 2 条
  - When: formatOutput 执行
  - Then: 两个分区表格, wiki 在前 vault 在后, 编号 1-5 连续

- **case 4.2 空结果**
  - Given: results 为空
  - When: formatOutput 执行
  - Then: 输出"未找到与 '<keyword>' 相关的沉淀内容。"

## 方案选型

### Q1: 打分排序用 AI 还是 MiniSearch?

**选项**: AI 打分 (subagent 读完 frontmatter 后综合判断) vs MiniSearch BM25+ (vendor 内嵌, Node.js 脚本做字段加权) vs 纯 rg 命中次数排序 (最简单)

**定**: AI 打分。三点原因：(1) 项目无 package.json，MiniSearch 需要 vendor 内嵌或新建依赖管理，与现有"脚本独立、零依赖"风格不符；(2) 中文是 MiniSearch 的硬伤——默认空格分词，需自定义 bigram tokenizer 增加复杂度；(3) AI 天然理解语义，"worktree" 能匹配讲"分支隔离策略"的文档——纯词频匹配做不到。纯命中次数太粗，标题命中 1 次 vs 正文命中 10 次分不出权重。→ 影响 BF3

### Q2: 搜索逻辑放脚本还是全在 subagent?

**选项**: Node.js 脚本 (rg + 解析 + 打分一站式) vs subagent 全包 (rg 用 Bash, 解析用 Read, 打分用 AI) vs 混合 (脚本做 rg + 解析, subagent 做打分)

**定**: subagent 全包。不需要额外脚本文件、不需要依赖。subagent 用 Bash 跑 rg、Read 读文件、AI 打分——三步用已有工具覆盖。脚本的唯一优势是排序确定性，但 ≤10 条结果的轻微排序波动对用户无感。→ 影响实现.影响（无 scripts/ 新文件）

### Q3: 中文搜索怎么处理?

**选项**: rg 正则 (中文字符天然支持) + AI 扩展关键词 vs 依赖分词库 (jieba / nodejieba) vs MiniSearch 自定义 bigram tokenizer

**定**: rg 正则 + AI 扩展关键词。rg 本身支持中文字面匹配不需要分词；AI 在 BF1 把中文关键词扩展为英文变体（反之亦然），用多轮 rg 覆盖双语匹配。不引入分词库。→ 影响 BF1

### Q4: subagent 注册为自定义类型还是用 general-purpose?

**选项**: 自定义 `recall-search` agent (agents/recall-search.md) vs general-purpose + 长 prompt (command 内嵌搜索指令)

**定**: 自定义 agent。搜索 prompt 内容稳定、每次调用相同，注册为 agent 类型后 command 里引用 agentType 即可，不用在 command 里内嵌大段 prompt。注意：这是本仓库首个由 command spawn subagent 的用法——现有三个 command（sow/distill/task）均为 inline 执行。agent 注册格式参照 `agents/semble-search.md`（含 name/description/tools 三字段）。→ 影响 agents/recall-search.md

## 其他

### 部署

无运行时部署。新增 2 个文件（command + agent），修改 plugin.json 版本（minor）：

- **灰度策略**: 无——插件拉 git，用户主动 update
- **回滚预案**: 删除 `commands/recall.md` + `agents/recall-search.md`，降版本
- **监控指标**: 无运行时 metric；通过用户反馈监控搜索质量

---

## Review Log

### Review 1 — 260618

**Reviewer**: general-purpose subagent（codex 不可用，降级为单路）

**Critical**:
- **C1** [`BF3`]: vault 文件 frontmatter 无 `title` 字段（sow 写入的 8 个字段不含 title），title 只在 body `# <title>` H1。BF3 的 title fallback 链对 vault 全部退化成文件名，与出参示例矛盾。
- **C2** [`BF3`]: 字段加权 title×5 对 vault 永远不触发（vault 无 title 字段），跨源打分不可比。

**Warning**:
- **W1** [`Q4 + 接口设计`]: 仓库无现有 command spawn subagent 先例 + agent frontmatter 缺 `description` 字段。
- **W2** [`BF3`]: "TLDR 行"注释只对 wiki 成立，vault 无 TLDR。
- **W3** [`BF3`]: `Read(file, limit=50)` 常量未验证。

**Suggestion**: S1 (gitignored 未提) / S2 (路径相对根不一致) / S3 (AI 行为断言是软约束)

**Open Questions**:
- **Q1**: vault 搜整个 Memory/ 还是只限 01/02/05？
- **Q2**: command 怎么把 wiki/vault 路径传给 subagent？

**Self-Audit**: SA1 (spawn 写法无范例) / SA2 (打分与归一化重复) / SA3 (C1 修后联动确认)

**用户决定**: 全修 C1 C2 W1 W2 W3 S1 S2 S3 SA1 SA2 SA3；Q1=搜整个 Memory/；Q2=补 spawn 契约

**本轮修订**:
- C1: BF3 重写——vault title 从 body `# <title>` H1 提取；wiki/vault 字段提取分表说明；异常表加 "vault 无 H1" 行；单测加 case 3.3 "vault title 从 H1 提取" + case 3.5
- C2: BF3 注释改为"标题命中权重最高（不论来源）"，去掉固定 ×5 数值（AI 综合判断，两源标题取法已统一）
- W1: agent frontmatter 补 `description` 字段；Q4 方案选型说明"首个 spawn subagent 的 command"；接口设计补 command→subagent spawn 契约 + 路径传递方式
- W2: BF3 summary 提取注释改为 wiki 用 description/TLDR、vault 用 summary 字段
- W3: Read limit 改 40 行并补来源说明（vault 最短骨架 Inbox ~15 行正文，40 行余量充足）
- S1: 背景段补 `.agents-personal/` 是 gitignored 的本地数据
- S2: 出参路径统一——wiki 相对项目根（`.agents-personal/wiki/...`），vault 相对 vault 根（`Memory/...`）；BF3 path 注释同步
- S3: BF1 单测加说明"行为冒烟测试，非确定性 hard assert"
- SA1: 接口设计补 spawn 契约示例（与 W1 合并修）
- SA2: 流程图合并"打分"与"归一化"为一步（AI 直接输出 0-1）；BF3 注释同步
- SA3: Read limit=40 覆盖 vault H1（frontmatter 后第一行正文），已确认

**Open Questions 答复**:
- Q1: 用户确认搜整个 `$USER_VAULT_PATH/Memory/`，不限定 01/02/05 子目录
- Q2: 接口设计已补 spawn 契约——wiki 路径由主 agent 拼接，vault 路径传 env 变量
