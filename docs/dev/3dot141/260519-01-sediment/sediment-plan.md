# `/sediment` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把会话沉淀分流到 5 个出口（wiki:project / wiki:cross-project advisor / rules:project / rules:plugin / skip）的 `/sediment` 命令，吃掉 `/project-wiki-distill`，把 `/user-wiki-distill` 改名 `/sow`。

**Architecture:** Markdown slash command（`commands/sediment.md`）通过 prompt 指挥 AI 完成所有动作；无脚本代码。AI 扫当前 context window 识别候选 → 表格呈现 + 短码交互 → 五出口分发。plugin 层出口涉及三步联动（写 rule 文件 + 改 `hooks/inject-rules.sh` 桶 + 升 `plugin.json` 版本），命令内串联。

**Tech Stack:** Markdown commands、Python（`/sow` 脚本不改）、bash hook 脚本（仅在 sediment 运行时由 AI 用 Edit 工具改）。

**Design doc:** `docs/dev/3dot141/260519-01-sediment/sediment-design.md`

---

## 文件改动总览

| 文件 | 动作 | 说明 |
|---|---|---|
| `commands/user-wiki-distill/` | rename → `commands/sow/` | 目录改名 |
| `commands/sow/user-wiki-distill.md` | rename → `commands/sow/sow.md` | 文件名同步 |
| `commands/sow/sow.md` | edit | 4 处：命令名 / 上游关系 / 脚本路径 / frontmatter desc |
| `commands/sow/script.py` | unchanged | 代码不变，仅随目录搬位置 |
| `commands/sow/test_script.py` | unchanged | 同 script.py |
| `commands/sediment.md` | NEW | 主命令文件 |
| `commands/project-wiki-distill.md` | delete | 逻辑被 sediment 吞掉 |
| `rules/overlay-agents-personal.md` | edit | 4 处：line 14/56/60 替换 + §2 line 108-110 语义重写 |
| `.claude-plugin/plugin.json` | edit | version 0.35.1 → 0.36.0 |

---

## Task 1: Rename `commands/user-wiki-distill/` → `commands/sow/`

**Files:**
- Rename: `commands/user-wiki-distill/` → `commands/sow/`
- Rename: `commands/sow/user-wiki-distill.md` → `commands/sow/sow.md`

- [ ] **Step 1: 用 git mv 重命名目录**

Run:
```bash
cd /Users/yes365/AI/nocode-evolve
git mv commands/user-wiki-distill commands/sow
```

Expected: 静默成功（git mv 不输出）。

- [ ] **Step 2: 用 git mv 重命名命令文件**

Run:
```bash
git mv commands/sow/user-wiki-distill.md commands/sow/sow.md
```

Expected: 静默成功。

- [ ] **Step 3: 验证目录结构**

Run:
```bash
ls commands/sow/
```

Expected:
```
script.py
sow.md
test_script.py
```

不应出现 `user-wiki-distill.md`。

---

## Task 2: 修改 `commands/sow/sow.md` 内容

**Files:**
- Modify: `commands/sow/sow.md`

四处修改：① 标题/命令名；② frontmatter description；③ line 11 "姊妹命令" → "上游命令"；④ 调用脚本的命令行 path。

- [ ] **Step 1: 改命令名（标题 + 正文）**

Read `commands/sow/sow.md` 找到第 6 行附近的标题。

Edit:
- old_string: `# /user-wiki-distill：会话浓缩成长文档归档到用户 vault Outputs 层`
- new_string: `# /sow：会话浓缩成长文档归档到用户 vault Outputs 层`

- [ ] **Step 2: 改 frontmatter description（如包含 user-wiki-distill 命名）**

Read frontmatter 段。若 description 仍含 "user-wiki-distill" 字样，按语义改名为 sow；否则 skip（现有 description "把当前会话围绕给定意图浓缩成一份长文档..." 与命令名解耦，可不动）。

- [ ] **Step 3: 改 line 11 "姊妹命令"为"上游命令"**

Edit:
- old_string: `姊妹命令：/project-wiki-distill（沉淀项目级历史记忆，写到 \`<project>/.agents-personal/wiki/\`）。`
- new_string: `上游命令：/sediment（识别到跨项目可复用内容时会建议跑本命令；本命令独立处理"带意图浓缩归档"语义）。`

- [ ] **Step 4: 改脚本调用行路径**

Edit:
- old_string:
```
python3 commands/user-wiki-distill/script.py \
    --intent "<用户原话意图>" \
    --title "<AI 反推 + 清洗后的 title>" \
    --summary "<AI 写的 ≤30 字 summary>"
```
- new_string:
```
python3 commands/sow/script.py \
    --intent "<用户原话意图>" \
    --title "<AI 反推 + 清洗后的 title>" \
    --summary "<AI 写的 ≤30 字 summary>"
```

注：脚本接口（`--intent / --title / --summary` 三个 flag 名）与命令名解耦，不动。

- [ ] **Step 5: 全文 grep 残留**

Run:
```bash
grep -n "user-wiki-distill" commands/sow/sow.md
```

Expected: 仅剩"设计文档"链接行（`docs/dev/3dot141/260514-01-user-wiki-distill/user-wiki-distill-design.md`——这是历史 design doc 文件名，保留不动；其他位置应无残留）。

如发现其他位置仍有 `user-wiki-distill` 字样（除上述历史 design doc 链接外），按语义判断改成 `sow` 或保留（视上下文）。

---

## Task 3: 验证 `commands/sow/test_script.py` 仍然通过

**Files:**
- Test: `commands/sow/test_script.py`

- [ ] **Step 1: 跑测试**

Run:
```bash
cd /Users/yes365/AI/nocode-evolve
python3 -m pytest commands/sow/test_script.py -v 2>&1 | tail -20
```

Expected: 所有测试通过（PASS）。脚本代码不变，路径搬位置后 import 应仍 work。

如失败：检查 test_script.py 是否硬编码了 `commands/user-wiki-distill/` 路径。如有，把 `user-wiki-distill` 改为 `sow`。

---

## Task 4: 创建 `commands/sediment.md`（NEW，主命令文件）

**Files:**
- Create: `commands/sediment.md`

- [ ] **Step 1: 写入 sediment.md 全文**

Write to `commands/sediment.md` 以下内容：

````markdown
---
description: 把当前会话沉淀分流到 wiki/rules 五个出口（项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip）
argument-hint: [optional-topic]
---

# /sediment：会话沉淀分流命令

把当前会话里值得跨会话保留的内容沉淀到合适出口——AI 识别候选 + 自动贴分类标签 → 用户表格短码勾选/调整 → 五出口分发。

**设计文档**：`docs/dev/3dot141/260519-01-sediment/sediment-design.md`

**姊妹命令 / 关联**：
- `/sow`（必填意图、围绕主题浓缩长文档归档到 `$USER_WIKI_PATH`）—— `/sediment` 在 cross-project 出口仅作 advisor，建议用户跑 `/sow`，不替执行

---

## 入参（$ARGUMENTS）

- 无参：扫整个会话 context，自由识别 0~N 个值得沉淀的主题
- 带 `$ARGUMENTS`：聚焦该主题做沉淀，忽略其他内容

---

## 五个出口

| 出口标签 | 落地路径 | 动作 |
|---|---|---|
| `wiki:project` | `<proj>/.agents-personal/wiki/pages/<slug>.md` | 历史记忆，项目专属；走整合判断 |
| `wiki:cross-project` | （不写文件）| **advisor**：输出"建议跑 `/sow <intent>`" |
| `rules:project` | `<proj>/.agents-personal/rules/<slug>.md` + 改 `<proj>/.agents-personal/AGENTS.md` 加触发条件 | 当前指令，项目专属；双写 |
| `rules:plugin` | `$NOCODE_EVOLVE_REPO/rules/<axis>-<slug>.md` + 改 `hooks/inject-rules.sh` 桶 + 升 `plugin.json` | 当前指令，跨项目通用；**三步联动** |
| `skip` | （不写）| 列出原因供用户最后反悔 |

---

## sessionHistory 怎么取

`/sediment` 是 markdown slash command，**没有官方"会话历史"入参**。沿用 `/sow` 模式：**AI 直接看当前 context window 里的对话内容**，不读任何外部历史文件。

- 短会话（context 未压缩）：AI 能完整扫到从会话起点到现在的所有轮次
- 长会话（context 已被自动压缩）：AI 只看得到 summary + 未滚出窗口的轮次

不为长会话特殊补救。若 context 高水位时跑命令导致沉淀质量降低，由用户感知"早点跑"或"带 topic 聚焦"。

---

## 执行流程

### 1. 扫会话 + 生成候选

按主题聚类（同主题合并），每个候选 AI 自动贴标签 + 生成完整 body：

```
候选 = { summary, label, slug, path, body }
  summary  ≤40 字摘要
  label    ∈ {wiki:project, wiki:cross-project, rules:project, rules:plugin, skip}
  slug     kebab-case 3-5 词
  path     按 label 算出的最终落盘路径
  body     最终文件正文（在候选阶段就生成，分发阶段直接 write）
```

**标签启发式**（仅作 AI 初始建议，用户可改）：

| 内容性质 | 默认标签 |
|---|---|
| 决策回溯 / 演进 / 术语定义 / 踩坑 | `wiki:*` |
| 命令模板 / 触发条件 / 工作流约定 | `rules:*` |
| 项目特有业务术语 / 具体代码路径 | `*:project` |
| 跨项目通用 AI 行为 / skill 覆盖 | `*:plugin` (cwd 是 nocode-evolve 仓) 或 `wiki:cross-project` (cwd 不是) |
| 一次性进度 / 通用 best practice | `skip` |

**0 候选**：报"本次无可沉淀内容"，停。
**全 skip**：报"识别 N 项均建议跳过 + 原因"，停。

### 2. 表格呈现 + 短码交互

输出 Markdown 表格（列固定：`# / 摘要 / 标签 / 路径`），下方附短码提示：

```
| #  | 主题摘要                       | 建议标签         | 落地路径                          |
|----|--------------------------------|------------------|-----------------------------------|
| 1  | sediment 命令分流机制设计      | wiki:project     | wiki/pages/260519-sediment-...md |
| 2  | rules 沉淀的桶联动启发式       | rules:plugin     | rules/overlay-...md + 桶 + 版本   |
| 3  | 一次性 bug 修复进度            | skip             | —                                 |

短码：
  go              全按建议执行（同 done）
  - 2,5           跳过 #2 #5 后执行其他
  2 plug          第 2 升 plugin 层（rules:proj → rules:plug 或 wiki:proj → wiki:cross）
  2 wiki          第 2 切到 wiki 轴（保持 scope）
  2 rules         第 2 切到 rules 轴
  2 /foo-bar      改第 2 的 slug
```

读用户回复 → 解析短码 → in-place 改 candidates → 重绘表格 → loop until `go` 或 `done`。

**不接受自然语言**——短码不识别就报错"语法不识别，请用短码：go / -N / N plug / N wiki / N rules / N /slug"，等用户重打。理由：AI 解析 NL 的失败模式不是"懂/不懂" binary，而是"懂错"，容错收益远低于误执行风险。

**全 skip 后用户仍 `go`**：提示"全 skip 等价 0 候选，确认继续？(yes/no)"，no 退出。

### 3. 跨仓写入二次确认（仅当 rules:plugin 且 cwd ≠ nocode-evolve 仓时）

```
项 #N (rules:plugin) 将写入 ~/AI/nocode-evolve/，确认？(yes/no)
```

no → 整次 sediment 终止；yes → 进入分发。

### 4. 五出口分发

按 label 分发：

#### `wiki:project` 出口

按下方「内嵌的 wiki:project 规则」执行——整合判断 / frontmatter / 派生 INDEX。

#### `wiki:cross-project` 出口（advisor）

不写文件。输出：

```
建议跑: /sow <ai 反推的意图候选>
原因: <这条为何跨项目>
```

**不替 `/sow` 校验 `$USER_WIKI_PATH`**——env 检查是 `/sow` 自己的责任，见 `commands/sow/sow.md` env 依赖节。

#### `rules:project` 出口

双写：

1. `write(<proj>/.agents-personal/rules/<slug>.md, body)`——文件名只用 slug，不带日期（rules 是当前指令不是历史记录）
2. `edit(<proj>/.agents-personal/AGENTS.md)` 在合适分组下加触发条目：

```markdown
## <topic 标题>
**触发**：<具体到能自识别的触发条件——遵循 overlay-agents-personal.md §2 写法>
**读**：rules/<slug>.md
```

**AGENTS.md 不存在时**：询问用户：

```
项 #N (rules:project) 需要 .agents-personal/AGENTS.md，文件不存在。怎么办？
  (1) 由 sediment 创建骨架（含路由表说明 + 该项触发条目）
  (2) 跳过这一项（不写 rules 文件，让我先手建 AGENTS.md）
  (3) 终止整次 sediment
```

骨架模板：

```markdown
# AGENTS.md

> 项目本地针对 agent 的指令路由表。触发条件在这里，详细指令在 rules/<topic>.md。

## <第一条触发条件标题>
**触发**：<具体到能自识别>
**读**：rules/<slug>.md
```

#### `rules:plugin` 出口（三步联动）

见下方「rules:plugin 三步联动」节。

#### `skip` 出口

不写文件。报告里列出"被跳过的 N 项 + 原因"，给用户最后一次反悔机会。

### 5. 总报告

```
沉淀完成：
  ✓ 新建 wiki: pages/260519-sediment-design.md
  ✓ 改 rules:project: .agents-personal/rules/sediment-shortcode.md + AGENTS.md
  ✓ advisor: /sow 沉淀今天讨论的 prompt 优化经验
  ✓ skip: 一次性 bug 修复（原因：无沉淀价值）

⚠ 跨仓写入 plugin rule: ~/AI/nocode-evolve/rules/overlay-sediment-extension.md
  桶: OVERLAYS_FILES  版本: 0.36.0 → 0.37.0 (minor)
  请到 nocode-evolve 仓 review + commit + 询问是否 push。
```

---

## 内嵌的 wiki:project 规则

精简版，从原 `/project-wiki-distill` 吞过来。完整规则见 `commands/project-wiki-distill.md` 的 git 历史（在删除前的 commit）。

### 整合判断决策树

对每个 wiki:project 候选，先 Read INDEX.md description，判断与已有页关系：

```
┌─ 强相关：同一系统/同一决策的不同侧面/演进 → 整合进该页
├─ 弱相关：提到但主题不同                  → 建新页 + 已有页加 see also
└─ 无关                                    → 建新页
```

整合 examples：

| 已有页 | 本次主题 | 决策 |
|---|---|---|
| rules-injection-overlay（hook 注入） | inject-rules.sh 扩展支持新 rule 类型 | ✅ 整合（同一系统延伸） |
| rules-injection-overlay | design-doc-writing skill 双轴架构 | ✅ 建新页（不同系统） |
| auth-token-storage（选 JWT） | 改用 session-based | ✅ 整合 + 改结构（标 superseded + 加 v2 决策） |

### 文件命名

```
<project>/.agents-personal/wiki/pages/yymmdd-<slug>.md
```

`<slug>`：kebab-case，3-5 个词，简短可读，全 wiki 内唯一，**不带日期**（日期在文件名里有）。

### Page frontmatter

```yaml
---
slug: <kebab-case-unique>
title: <一句话标题>
date: <yymmdd>             # 首次创建日期，永远不变
last_updated: <yymmdd>     # 整合时更新；首次创建时不写
description: <一句话简介，让 AI 看 INDEX 时能判断"要不要 Read 这页">
related:                   # 可选：相关代码 / commit / PR
  - skills/design-doc-writing/
---
```

### Page body 推荐结构

```markdown
# <title>

## 背景 / 演进过程
<来龙去脉>

## 决策与设计 / 核心机制
<内容主体>

## 关键设计选择
<决策点列表>

## 后续注意 / 关键链接（可选）
```

### 整合操作

- Read 已有页全文
- 把新内容**融合**到合适章节，**不是末尾 append paste**
- 必要时改章节结构（如「决策」拆为「v1 决策 + v2 修订」）
- frontmatter 加 `last_updated: <today_yymmdd>`
- 文件名（含原 yymmdd）保持不变

### INDEX 派生

扫 `pages/*.md` frontmatter，按 date 倒序、同日 slug 字母序，重写 INDEX.md。

INDEX 模板：

```markdown
# Project Wiki

> 由 `/sediment` 自动维护。AI 工作时遇到项目背景问题，先读 INDEX，按 description 决定是否 Read 具体页。

## Pages

### [<title>](./pages/<filename>)
**slug**: `<slug>` · **date**: `<yymmdd>` · **updated**: `<last_updated>`

<description>

---

最后更新：<today_yymmdd>
```

`updated` 段在 frontmatter 无 `last_updated` 时省略。

### 反模式

- ❌ **末尾 paste**：把新内容堆到 `## YYMMDD Update` 节——懒整合，不是整合
- ❌ **过度整合**：把弱相关内容塞进同一页 → 杂物间页面
- ❌ **永远新建**：每次都建新页绕过整合判断
- ❌ **写空文件**：会话没值得沉淀的内容时也建页凑数
- ❌ **slug 用日期**：slug 是主题标识，不带日期；日期在文件名里

---

## rules:plugin 三步联动

### Step 1: 写 rule 文件

axis 启发式判定：

```
内容是行为基线 / 角色配置        → agent
覆盖第三方 skill 默认行为        → overlay
工具调用约定 / git 检查约束等    → tool
```

模糊时**主动问用户**（不静默归 tool 兜底）：

```
此 rule 该归哪个 axis？
  (1) agent   行为基线 / 角色
  (2) overlay 覆盖第三方 skill 默认
  (3) tool    工具调用约定
```

文件路径：`${NOCODE_EVOLVE_REPO}/rules/<axis>-<slug>.md`。

slug 冲突 → abort："slug 冲突: `<axis>-<slug>.md`，请用 `N /<new-slug>` 改 slug 后重试"。

`write(filePath, body)`。

### Step 2: 改 `hooks/inject-rules.sh` 把新文件加进对应桶

bucket 启发式：

| axis | bucket |
|---|---|
| `agent` | `BASELINE_FILES` |
| `overlay` | `OVERLAYS_FILES` |
| `tool` 或其他 | **主动问用户**（不静默选 PROJECT_FILES） |

**实施策略（具体到 Edit 工具调用）**：

1. Read `${NOCODE_EVOLVE_REPO}/hooks/inject-rules.sh`，定位 `${bucket}=(` 段
2. 找到该桶最后一个数组元素整行（如 `  "${PLUGIN_ROOT}/rules/overlay-gitworktree.md"`）
3. 用 Edit 工具：
   - `old_string` = 该行整行
   - `new_string` = 原行 + `\n  "${PLUGIN_ROOT}/rules/<axis>-<slug>.md"`
4. 保持桶变量结尾的 `)` 行不动

**不用 sed/awk**——bash 数组字面量多行匹配脆弱；Edit 工具的精确字符串匹配更可靠。

**桶选 PROJECT_FILES 时**：仅当用户明确选，接受但提醒"PROJECT_FILES 桶语义是项目路由，乱填会破坏 hook 拆桶设计。确认？(yes/no)"。

### Step 3: 升 `plugin.json` 版本

```
新增 rule        → minor   (默认；类比 CLAUDE.md:21-25 「新增 hook/skill/兼容性增强 = minor」)
改既有规则语义反转 → major
文案修订          → patch  (rarely)
```

`major` 需要会话里明确出现"反转既有规则"、"删除已部署规则"等破坏性信号。

Read `.claude-plugin/plugin.json` → bump version → Write 回去。

### 三步契约

- 三步**必须按顺序**：先写文件 → 再改桶 → 再升版本；任一步失败后续不执行
- **本逻辑内三步不回滚已成功步**（避免半成品状态更难恢复——文件保留比删了让用户从头来更易恢复）
- **但本项失败不影响其他候选项的分发**——与整体"非 transactional" 一致
- commit/push 不进本逻辑——CLAUDE.md 工作流约定 commit 由主交互完成

### 报告

```
已写入 plugin rule: <axis>-<slug>.md
桶: <bucket>
版本: <oldVersion> → <newVersion> (<bumpLevel>)
请到 nocode-evolve 仓 review + commit + 询问是否 push。
```

### 孤儿 rule 划界

如果发现 `nocode-evolve/rules/` 下有未分桶的孤儿文件（如 `tool-git-inspection.md` 历史遗留）——**不主动补**。归用户手动处理（inject-rules.sh sanity check 每 session stderr 警告，足够提示）。

理由：scope 控制——`/sediment` 是沉淀命令，不是 hook 整理工具。

在报告末尾仅做提示：

```
ℹ 发现孤儿 rule N 个：[tool-git-inspection.md, ...]
   sanity check 已警告，请手动加入对应桶或评估是否删除。
```

---

## 反模式

- ❌ **AI 自判直接写**——必须经过候选呈现 + 用户勾选
- ❌ **末尾 paste**：wiki:project 整合已有页时不把新内容堆到 `## YYMMDD Update` 节
- ❌ **跨仓写入不二次确认**：cwd ≠ nocode-evolve 仓而要写 plugin rule 时，不弹二次确认就动手
- ❌ **写 plugin rule 但忘了改 inject-rules.sh 的桶**——sanity check 警告等于白沉淀
- ❌ **写 plugin rule 但忘升 version**——CLAUDE.md 硬约束
- ❌ **AGENTS.md 加触发条件含糊**："需要时读 rules/foo.md" 等于没触发
- ❌ **rules 文件名带日期**：rules 是当前指令不是历史记录，文件名只用 slug
- ❌ **在 sediment 内部 commit / push**：只写文件，commit/push 由用户在主交互流程里处理
- ❌ **替 /sow 校验 env**：cross-project advisor 不检查 `$USER_WIKI_PATH`——是 /sow 自己的责任

---

## 边界情况

| 场景 | 处理 |
|---|---|
| 0 候选 | 报"本次无可沉淀内容"，停 |
| 全 skip | 报"识别 N 项均建议跳过 + 原因"，停 |
| `optionalTopicArg` 在会话里无对应内容 | 报"未找到 topic 相关内容"，停 |
| context 已被压缩到只剩 summary | 仍按可见内容尽力生成候选；表格脚注加 "⚠ context 部分被压缩，沉淀可能不完整" |
| `<proj>/.agents-personal/AGENTS.md` 不存在 | 三选一：(1)创建骨架 (2)跳过本项 (3)终止 sediment |
| `rules:project` slug 冲突 | 报错让用户改 slug：`N /<new-slug>` |
| `wiki:project` slug 冲突 | 走整合判断 |
| `$NOCODE_EVOLVE_REPO` 路径不存在 | `rules:plugin` 标签在表格里降级 disabled + 标灰 |
| Step 1 写文件后 Step 2 改 hook 失败 | 不回滚 Step 1，报"写入了 rule 文件但 hook 桶未改，请手动加" |
| Step 2 后 Step 3 改 plugin.json 失败 | 不回滚前两步，报"前两步完成但版本未升，请手动改 plugin.json" |
| axis 启发式判不出 | 主动问用户 (1)agent (2)overlay (3)tool |
| 桶选 PROJECT_FILES | 接受但提醒确认 |
| nocode-evolve 仓有未提交改动 | 不阻断，报告里加一行"两边都要 commit" |
| `nocode-evolve/rules/` 下有未分桶孤儿文件 | 不主动补桶；报告末尾仅提示 |
| 用户给的 # 越界（短码） | 报"#7 不存在，当前候选 1-5"，不动 candidates |
| 短码无法识别 | 报"语法不识别，请用短码"，等用户重打——不接受自然语言 |

---

## 写完后

不要主动 push 或 commit——按 CLAUDE.md 工作流，commit 由主交互流程在你完成所有沉淀后单独执行。

如本次涉及 `rules:plugin` 出口，提醒用户：
- `nocode-evolve` 仓有新文件（rule + hook 改 + plugin.json）
- 主仓如有 rules:project 改动也需要 commit
- 两边的 commit / push 由用户自己决定
````

- [ ] **Step 2: 验证文件创建**

Run:
```bash
ls -la commands/sediment.md
wc -l commands/sediment.md
```

Expected: 文件存在；行数约 350-400 行（含 frontmatter + 各节）。

- [ ] **Step 3: grep 关键节标题确认完整**

Run:
```bash
grep -n "^##" commands/sediment.md
```

Expected: 列出 7-9 个 H2 章节：入参 / 五个出口 / sessionHistory 怎么取 / 执行流程 / 内嵌的 wiki:project 规则 / rules:plugin 三步联动 / 反模式 / 边界情况 / 写完后。

---

## Task 5: 删除 `commands/project-wiki-distill.md`

**Files:**
- Delete: `commands/project-wiki-distill.md`

- [ ] **Step 1: git rm**

Run:
```bash
cd /Users/yes365/AI/nocode-evolve
git rm commands/project-wiki-distill.md
```

Expected: 输出 `rm 'commands/project-wiki-distill.md'`。

- [ ] **Step 2: 验证文件不存在**

Run:
```bash
ls commands/project-wiki-distill.md 2>&1
```

Expected: `ls: commands/project-wiki-distill.md: No such file or directory`。

---

## Task 6: 修改 `rules/overlay-agents-personal.md`

**Files:**
- Modify: `rules/overlay-agents-personal.md`

四处修改：① line 14；② line 56；③ line 60（§1 关于沉淀末段）；④ line 108-110（§2 关于沉淀末段，语义重写）。

- [ ] **Step 1: 替换 line 14 的命令引用**

Edit:
- old_string: `由用户跑 \`/project-wiki-distill\` 维护。`
- new_string: `由用户跑 \`/sediment\`（统一沉淀分流命令）维护——命令会自动判断该项内容走 wiki 还是 rules 出口。`

- [ ] **Step 2: 替换 line 56 的命令引用**

Edit:
- old_string: `- 试图自己写 wiki——沉淀走 \`/project-wiki-distill\`，AI 主动写 wiki 容易过度`
- new_string: `- 试图自己写 wiki——沉淀走 \`/sediment\`，AI 主动写 wiki 容易过度`

- [ ] **Step 3: 替换 line 60（§1 关于沉淀末段）**

Edit:
- old_string: `如果你发现本会话产生了**值得沉淀**的项目级知识（新设计决策、新约定、新踩过的坑），主动建议用户跑 \`/project-wiki-distill\`，但不要替用户决定。`
- new_string: `如果你发现本会话产生了**值得沉淀**的项目级知识（新设计决策、新约定、新踩过的坑），主动建议用户跑 \`/sediment\`——命令会自动识别候选并贴 wiki:project / rules:project 等标签，由用户用短码勾选。不要替用户决定。`

- [ ] **Step 4: §2 line 108-110 语义重写**

Edit:
- old_string: `如果本会话产生了**值得沉淀**的项目级指令（新约定、新命令、新踩坑后的标准做法），主动建议用户写进 \`.agents-personal/rules/<topic>.md\` 并在 AGENTS.md 加一行触发条件。如果只是一次性背景，建议走 wiki 而非 rules。`
- new_string: `如果本会话产生了**值得沉淀**的项目级指令（新约定、新命令、新踩坑后的标准做法），主动建议用户跑 \`/sediment\`——命令会自动给候选贴 \`rules:project\` 标签，落地时双写 \`.agents-personal/rules/<topic>.md\` + AGENTS.md 触发条件。如果只是一次性背景，命令会自动判 \`wiki:project\` 走历史记忆侧。`

- [ ] **Step 5: 验证替换**

Run:
```bash
grep -n "project-wiki-distill" rules/overlay-agents-personal.md
```

Expected: 输出为空（无残留）。

```bash
grep -n "/sediment" rules/overlay-agents-personal.md
```

Expected: 至少 4 行命中（line 14 / 56 / 60 / 108-110 改写后的内容）。

---

## Task 7: 升 `plugin.json` 版本

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: 改版本号 0.35.1 → 0.36.0**

Edit:
- old_string: `"version": "0.35.1",`
- new_string: `"version": "0.36.0",`

- [ ] **Step 2: 验证 JSON 合法**

Run:
```bash
python3 -c "import json; print(json.load(open('.claude-plugin/plugin.json'))['version'])"
```

Expected: `0.36.0`。

---

## Task 8: 最终验证 + 状态盘点

- [ ] **Step 1: 检查 git status**

Run:
```bash
cd /Users/yes365/AI/nocode-evolve
git status --short
```

Expected: 看到以下变更：
- `R  commands/user-wiki-distill/{script.py,test_script.py} -> commands/sow/{script.py,test_script.py}`
- `R  commands/user-wiki-distill/user-wiki-distill.md -> commands/sow/sow.md`
- `M  commands/sow/sow.md`
- `A  commands/sediment.md`
- `D  commands/project-wiki-distill.md`
- `M  rules/overlay-agents-personal.md`
- `M  .claude-plugin/plugin.json`
- 以及本会话之前生成的 design doc 和 plan 文件

- [ ] **Step 2: 检查 commands/ 目录最终结构**

Run:
```bash
ls -la commands/
ls -la commands/sow/
```

Expected:
- `commands/` 含 `sediment.md` + `sow/` 目录
- 无 `project-wiki-distill.md`
- 无 `user-wiki-distill/`
- `commands/sow/` 含 `sow.md` / `script.py` / `test_script.py`

- [ ] **Step 3: grep 残留 user-wiki-distill 引用**

Run:
```bash
grep -rn "user-wiki-distill" commands/ rules/ hooks/ --include="*.md" --include="*.sh" --include="*.json" 2>&1
```

Expected: 仅剩 design doc 历史文件名引用（`docs/dev/3dot141/260514-01-user-wiki-distill/user-wiki-distill-design.md`，作为 sow.md 里的设计文档链接保留）。其他场所无残留。

- [ ] **Step 4: grep 残留 project-wiki-distill 引用**

Run:
```bash
grep -rn "project-wiki-distill" commands/ rules/ hooks/ --include="*.md" --include="*.sh" --include="*.json" 2>&1
```

Expected: 仅剩 `commands/sediment.md` 中的"see git history"引用（设计明确允许）。其他无。

- [ ] **Step 5: 跑 inject-rules.sh sanity check（确认没误伤 plugin rules 体系）**

Run:
```bash
CLAUDE_PLUGIN_ROOT=$(pwd) bash hooks/inject-rules.sh baseline 2>&1 | head -5
```

Expected: 输出 JSON-encoded session context（stdout）；stderr 仅警告已存在的孤儿 `tool-git-inspection.md`（这是历史遗留，不在本次 scope）。

---

## 最终 commit（由主交互流程执行，不由 subagent 自动 commit）

完成所有 task 后，由主交互流程统一 commit：

```bash
git add commands/sediment.md commands/sow/ commands/project-wiki-distill.md \
        rules/overlay-agents-personal.md .claude-plugin/plugin.json \
        docs/dev/3dot141/260519-01-sediment/sediment-design.md \
        docs/dev/3dot141/260519-01-sediment/sediment-design.html \
        docs/dev/3dot141/260519-01-sediment/sediment-plan.md
git status
git commit -m "$(cat <<'EOF'
feat(command): 新增 /sediment 统一沉淀分流命令，吞掉 /project-wiki-distill；/user-wiki-distill 改名 /sow

- commands/sediment.md (NEW): 半自动 5 出口分流 (wiki:project / wiki:cross-project advisor / rules:project / rules:plugin / skip)
- commands/sow/ (改自 user-wiki-distill/): 目录与文件改名，命令名 + 上游关系 + 脚本调用路径同步
- commands/project-wiki-distill.md (删): 逻辑被 sediment 吞掉
- rules/overlay-agents-personal.md: §1/§2 沉淀指引指向 /sediment
- plugin.json: 0.35.1 → 0.36.0 (minor)
EOF
)"
```

**不自动 push**——按 CLAUDE.md 工作流，commit 后询问用户是否 push。

---

## 设计自检（plan 自己的 self-review）

- [x] 所有任务对应 design doc 节都有覆盖
- [x] 无 TBD / TODO / placeholder
- [x] 文件路径具体到包名
- [x] 每条 edit 含 exact old_string / new_string
- [x] 数字阈值（版本号 0.35.1 → 0.36.0）来源清楚
- [x] 每个 task 末尾有验证步骤
- [x] commit 不在 subagent 内部进行——由主交互统一 commit
