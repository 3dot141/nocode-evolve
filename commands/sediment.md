---
description: 把当前会话沉淀分流到 wiki/rules 五个出口（项目 wiki / 跨项目 advisor / 项目 rules / 插件 rules / skip）
argument-hint: [optional-topic]
---

# /sediment：会话沉淀分流命令

把当前会话里值得跨会话保留的内容沉淀到合适出口——AI 识别候选 + 自动贴分类标签 → 用户表格短码勾选/调整 → 五出口分发。

**设计文档**：`docs/plans/3dot141/260519-sediment-design.md`

**姊妹命令 / 关联**：
- `/sow`（必填意图、围绕主题浓缩并归档到 `$USER_VAULT_PATH/Memory/<layer>/`，v2 支持 Inbox/Inputs/Outputs 三层）—— `/sediment` 在 cross-project 出口仅作 advisor，建议用户跑 `/sow`，不替执行、不替判层

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
| `rules:plugin` | `$NOCODE_EVOLVE_REPO/rules/rule-<slug>.md` + 改 `model/agent-catalog.md` 加路由条目 + 升 `plugin.json` | 当前指令，跨项目通用；**三步联动** |
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
| 2  | rules 沉淀的 catalog 联动启发式 | rules:plugin     | rules/rule-...md + catalog + 版本 |
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

**不替 `/sow` 校验 `$USER_VAULT_PATH`**——env 检查是 `/sow` 自己的责任，见 `commands/sow.md` env 依赖节。（v1 env 名 `USER_WIKI_PATH` 已弃用，sow v2 改读 `USER_VAULT_PATH`）

**不替 `/sow` 判层**——sow v2 已支持三层（Inbox / Inputs / Outputs），advisor 仅推 `/sow <intent>`，由 sow 自判层 + 用户 NL 确认 loop。sediment 不预估层、不绑层、不在 advisor 输出里附加层建议，职责保单一。

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

⚠ 跨仓写入 plugin rule: ~/AI/nocode-evolve/rules/rule-sediment-extension.md
  catalog: model/agent-catalog.md 已追加路由条目  版本: 0.39.0 → 0.40.0 (minor)
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

新架构下 `rules/` 不再分 axis（`overlay-` / `agent-` / `tool-` 命名前缀已废弃），所有触发式规则统一命名为 `rule-<slug>.md`，由 `model/agent-catalog.md` 路由，agent 在会话中按触发条件按需 Read。

### Step 1: 写 rule 文件

文件路径：`${NOCODE_EVOLVE_REPO}/rules/rule-<slug>.md`。

slug 冲突 → abort："slug 冲突: `rule-<slug>.md`，请用 `N /<new-slug>` 改 slug 后重试"。

`write(filePath, body)`。

### Step 2: 改 `model/agent-catalog.md` 加路由条目

新架构下不再有 hook 桶联动——rule 文件不进 `MODEL_FILES` 桶，而是由 catalog 表格路由触发。catalog 没列就等于 agent 触发不到（sanity check 会 stderr 警告）。

**实施策略（具体到 Edit 工具调用）**：

1. Read `${NOCODE_EVOLVE_REPO}/model/agent-catalog.md`，定位「规则清单」段（`## 规则清单` 标题下）
2. 找到清单最后一条规则段（即最后一个 `### <topic>` + **触发** + **读** + **摘要** 三行块），其后紧跟分隔线 `---`
3. 用 Edit 工具在最后一条规则段与 `---` 之间插入新段，格式：

```markdown
### <slug>
**触发**: <具体到能自识别的触发条件，不写"看情况 / 需要时">
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-<slug>.md`
**摘要**: <一句话核心动作，让 agent 看了就知道这条 rule 干什么>
```

**触发条件写法约束**：必须具体到 agent 自己能判断命中——参考已有条目（如 push-summary 写"用户 push 后说『总结 push 内容 / 给标题描述 / PR description』"，不是"需要时读"）。

**不用 sed/awk**——markdown 段落多行匹配脆弱；Edit 工具的精确字符串匹配更可靠。

### Step 3: 升 `plugin.json` 版本

```
新增 rule        → minor   (默认；类比 CLAUDE.md:21-25 「新增 hook/skill/兼容性增强 = minor」)
改既有规则语义反转 → major
文案修订          → patch  (rarely)
```

`major` 需要会话里明确出现"反转既有规则"、"删除已部署规则"等破坏性信号。

Read `.claude-plugin/plugin.json` → bump version → Write 回去。

### 三步契约

- 三步**必须按顺序**：先写 rule 文件 → 再改 catalog → 再升版本；任一步失败后续不执行
- **本逻辑内三步不回滚已成功步**（避免半成品状态更难恢复——文件保留比删了让用户从头来更易恢复）
- **但本项失败不影响其他候选项的分发**——与整体"非 transactional" 一致
- commit/push 不进本逻辑——CLAUDE.md 工作流约定 commit 由主交互完成

### 报告

```
已写入 plugin rule: rule-<slug>.md
catalog: model/agent-catalog.md 已追加路由条目
版本: <oldVersion> → <newVersion> (<bumpLevel>)
请到 nocode-evolve 仓 review + commit + 询问是否 push。
```

### 孤儿 rule 划界

如果发现 `nocode-evolve/rules/` 下有未被 `model/agent-catalog.md` 引用的孤儿文件——**不主动补**。归用户手动处理（inject-rules.sh sanity check 每 session stderr 警告，足够提示）。

理由：scope 控制——`/sediment` 是沉淀命令，不是 catalog 整理工具。

在报告末尾仅做提示：

```
ℹ 发现孤儿 rule N 个：[rule-foo.md, ...]
   sanity check 已警告，请手动加入 model/agent-catalog.md 路由表或评估是否删除。
```

---

## 反模式

- ❌ **AI 自判直接写**——必须经过候选呈现 + 用户勾选
- ❌ **末尾 paste**：wiki:project 整合已有页时不把新内容堆到 `## YYMMDD Update` 节
- ❌ **跨仓写入不二次确认**：cwd ≠ nocode-evolve 仓而要写 plugin rule 时，不弹二次确认就动手
- ❌ **写 plugin rule 但忘了改 model/agent-catalog.md 路由表**——sanity check 警告等于白沉淀
- ❌ **写 plugin rule 但忘升 version**——CLAUDE.md 硬约束
- ❌ **AGENTS.md 加触发条件含糊**："需要时读 rules/foo.md" 等于没触发
- ❌ **rules 文件名带日期**：rules 是当前指令不是历史记录，文件名只用 slug
- ❌ **在 sediment 内部 commit / push**：只写文件，commit/push 由用户在主交互流程里处理
- ❌ **替 /sow 校验 env**：cross-project advisor 不检查 `$USER_VAULT_PATH`——是 /sow 自己的责任

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
| Step 1 写文件后 Step 2 改 catalog 失败 | 不回滚 Step 1，报"写入了 rule 文件但 catalog 未改，请手动加路由条目" |
| Step 2 后 Step 3 改 plugin.json 失败 | 不回滚前两步，报"前两步完成但版本未升，请手动改 plugin.json" |
| nocode-evolve 仓有未提交改动 | 不阻断，报告里加一行"两边都要 commit" |
| `nocode-evolve/rules/` 下有未被 catalog 引用的孤儿文件 | 不主动补路由；报告末尾仅提示 |
| 用户给的 # 越界（短码） | 报"#7 不存在，当前候选 1-5"，不动 candidates |
| 短码无法识别 | 报"语法不识别，请用短码"，等用户重打——不接受自然语言 |

---

## 写完后

不要主动 push 或 commit——按 CLAUDE.md 工作流，commit 由主交互流程在你完成所有沉淀后单独执行。

如本次涉及 `rules:plugin` 出口，提醒用户：
- `nocode-evolve` 仓有新文件（rule + catalog 改 + plugin.json）
- 主仓如有 rules:project 改动也需要 commit
- 两边的 commit / push 由用户自己决定
