---
description: 把当前会话沉淀分流到 wiki/rules/agents/docs 七个出口（项目 wiki / 跨项目 advisor / 项目 rules / 项目配置 / 子目录文档 / 插件 rules / skip）
argument-hint: [optional-topic]
---

# /distill：会话沉淀分流命令

把当前会话里值得跨会话保留的内容沉淀到合适出口——AI 识别候选 + 自动贴分类标签 → 用户表格短码勾选/调整 → 七出口分发。

**设计文档**：`docs/plans/3dot141/260519-sediment-design.md`

**姊妹命令 / 关联**：
- `/sow`（必填意图、围绕主题浓缩并归档到 `$USER_VAULT_PATH/Memory/<layer>/`，v2 支持 Inbox/Inputs/Outputs 三层）—— `/distill` 在 cross-project 出口仅作 advisor，建议用户跑 `/sow`，不替执行、不替判层

---

## 入参（$ARGUMENTS）

- 无参：扫整个会话 context，自由识别 0~N 个值得沉淀的主题
- 带 `$ARGUMENTS`：聚焦该主题做沉淀，忽略其他内容

---

## 七个出口

| 出口标签 | 落地路径 | 动作 |
|---|---|---|
| `wiki:project` | `<proj>/.agents-personal/wiki/draft/` 或 `wiki/pages/` | 项目知识（架构/决策/调试/约定），两层目录 + 控制文件；走整合判断 |
| `wiki:cross-project` | （不写文件）| **advisor**：输出"建议跑 `/sow <intent>`" |
| `rules:project` | 融进现有 rule，或新建 `<proj>/.agents-personal/rules/<slug>.md` + 改 `AGENTS.md` 触发条件 | 当前指令，项目专属；**先整合判断**（融合优先），否则双写新建 |
| `agents:project` | `<proj>/.agents-personal/AGENTS.md` 对应分节 | 项目级偏好——变量覆盖 / 语气风格 / 命名惯例 / 协作约定等；直接写入 AGENTS.md，融合已有分节或新增分节 |
| `docs:subdir` | `<proj>/<dir>/AGENTS.md` 和/或 `README.md` | 子目录工程约束/文档，入仓共享；走 project-distill |
| `rules:plugin` | 融进现有 rule（含 `rule-references/` 子文件），或新建 `$NOCODE_EVOLVE_REPO/rules/rule-<slug>.md` + 改 `rules/manifest.json` 后 `node hooks/generate.mjs` 重新生成 catalog 分片 + 升 `plugin.json` | 当前指令，跨项目通用；**先整合判断**（融合优先），否则三步联动建新 |
| `skip` | （不写）| 列出原因供用户最后反悔 |

---

## sessionHistory 怎么取

`/distill` 是 markdown slash command，**没有官方"会话历史"入参**。沿用 `/sow` 模式：**AI 直接看当前 context window 里的对话内容**，不读任何外部历史文件。

- 短会话（context 未压缩）：AI 能完整扫到从会话起点到现在的所有轮次
- 长会话（context 已被自动压缩）：AI 只看得到 summary + 未滚出窗口的轮次

不为长会话特殊补救。若 context 高水位时跑命令导致沉淀质量降低，由用户感知"早点跑"或"带 topic 聚焦"。

---

## 执行流程

### 0. 静默 Lint

若 `<proj>/.agents-personal/` 已存在，调 `Skill(nocode-evolve:personal-lint)` 做健康检查。结果附在 Step 2 表格底部。不存在则跳过。

### 1. 扫会话 + 生成候选

按主题聚类（同主题合并），每个候选 AI 自动贴标签 + 生成完整 body：

```
候选 = { summary, label, slug, disposition, target_layer, path, body, target_dir, target_file }
  summary      ≤40 字摘要
  label        ∈ {wiki:project, wiki:cross-project, rules:project, agents:project, docs:subdir, rules:plugin, skip}
  slug         kebab-case 3-5 词
  disposition  新建 | 融合→<现有文件路径> | supersede→<现有文件路径> | promote→<draft 文件路径>（仅 wiki:project / rules:* 有意义；见下「整合判断」）；agents:project 固定为 融合→AGENTS.md 或 新增分节；docs:subdir 按目标文件是否已存在走新建/融合
  target_layer draft | pages（仅 wiki:project；首次出现→draft, 与 pages/ 强相关→pages, 与 draft/ 强相关→draft）
  section_type var | style | naming | convention | rules-trigger（仅 agents:project；标识写入 AGENTS.md 的哪种分节）
  target_dir   目标子目录路径，相对项目根（仅 docs:subdir；如 "hooks/"）
  target_file  agents | readme | both（仅 docs:subdir；默认 both）
  path         disposition=新建 时按 label+target_layer 算落盘路径；融合/supersede 时=目标现有文件路径；agents:project 固定为 AGENTS.md；docs:subdir 为 <target_dir>/AGENTS.md 或 README.md
  body         disposition=新建 时=完整文件正文（分发直接 write）；融合 时=要融进目标的内容片段
```

**整合判断（候选阶段就做，让表格诚实）**：对 `wiki:project` / `rules:project` / `agents:project` / `rules:plugin` 候选，先读对应索引判与现有内容关系，设 `disposition`：

| 出口 | 读的索引 | 强相关 → 融合目标 |
|---|---|---|
| `wiki:project` | `wiki/index.md`（全局索引） | 现有 `pages/<x>.md` 或 `draft/<x>.md` |
| `rules:project` | `AGENTS.md` 触发表 | 现有 `rules/<x>.md` |
| `agents:project` | `AGENTS.md` 各分节标题 | 已有分节（融合）或新增分节 |
| `rules:plugin` | `rules/manifest.json` 规则清单（单源） | 现有 `rules/rule-<x>.md`，**或其 `rule-references/<x>/<子文件>.md`** |

```
┌─ 强相关 + 补充（不推翻原有决策）       → disposition=融合→<现有文件>
├─ 强相关 + 矛盾（推翻原有决策/架构）    → disposition=supersede→<现有文件>（仅 wiki:project）
├─ draft/ 已丰富（2+ sources）           → disposition=promote→<draft 文件>（仅 wiki:project）
├─ 弱相关：提到但主题不同                → disposition=新建（+ 现有处加 see also，仅 wiki）
└─ 无关                                  → disposition=新建
```

> **融合优先**：rules 出口默认倾向融进现有 rule，避免 catalog / AGENTS.md 触发条目碎片化。判不准时宁可标融合让用户在表格里看到目标文件，再用 `N new` 翻成新建——比默认新建后 catalog 膨胀更易纠。各出口融合的落地细节见下方分发节。

**标签启发式**（仅作 AI 初始建议，用户可改）：

| 内容性质 | 默认标签 |
|---|---|
| 决策回溯 / 演进 / 术语定义 / 踩坑 | `wiki:*` |
| 命令模板 / 触发条件 / 工作流约定 | `rules:*` |
| 变量覆盖 / 语气风格偏好 / 命名惯例 / 协作约定 / 输出格式偏好 | `agents:project` |
| **某个子目录的工程约束 / 使用说明 / 目录级规则**（如"hooks/ 下禁手改生成物"） | `docs:subdir` |
| 项目特有业务术语 / 具体代码路径 | `*:project` |
| 跨项目通用 AI 行为 / skill 覆盖 | `*:plugin` (cwd 是 nocode-evolve 仓) 或 `wiki:cross-project` (cwd 不是) |
| 一次性进度 / 通用 best practice | `skip` |

**`agents:project` vs `docs:subdir` 区分**：
- 内容是**个人偏好 / 项目级配置**（变量 / 语气 / 命名） → `agents:project`（写到 `.agents-personal/AGENTS.md`，gitignored）
- 内容是**某个目录的工程约束**，所有协作者都应遵守 → `docs:subdir`（写到 `<dir>/AGENTS.md`，入仓共享）

**0 候选**：报"本次无可沉淀内容"，停。
**全 skip**：报"识别 N 项均建议跳过 + 原因"，停。

### 2. 表格呈现 + 编号选择

输出 Markdown 表格（列固定：`# / 摘要 / 存到 / 层 / 操作`），标签是 AI 内部路由，不暴露给用户：

```
| #  | 主题摘要                       | 存到           | 层     | 操作                                          |
|----|--------------------------------|----------------|--------|-----------------------------------------------|
| 1  | distill 命令分流机制设计      | 项目 wiki      | draft  | 新建 draft/260519-sediment-...md (stub)       |
| 2  | 存储架构补充                   | 项目 wiki      | pages  | 整合进 pages/storage-backend-...md            |
| 3  | 旧模型接入流程 v2              | 项目 wiki      | pages  | 取代 pages/old-onboarding.md，新建替代页      |
| 4  | fork-PR / cross-fork 教训      | 插件 rule      | —      | 融进 pr-flow-bkt-appendix.md                  |
| 5  | 一次性 bug 修复进度            | —              | —      | 跳过                                          |
```

「层」列仅 wiki:project 出口有意义（draft / pages），其他出口显示 `—`。

「存到」列的中文映射（AI 内部 label → 用户看到的）：

| AI 内部 label | 用户看到 |
|---|---|
| `wiki:project` | 项目 wiki |
| `wiki:cross-project` | 用户 vault (建议 /sow) |
| `rules:project` | 项目 rule |
| `agents:project` | 项目配置 (AGENTS.md) |
| `docs:subdir` | 子目录文档 (<dir>/) |
| `rules:plugin` | 插件 rule |
| `skip` | — |

表格下方用 `AskUserQuestion` 多选组件让用户勾选要执行的编号：

```
选要执行的编号（可多选）:
□ 1. distill 分流设计 → 项目 wiki (新建)
□ 2. fork-PR 教训 → 插件 rule (融进)
□ 3. catalog 联动 → 插件 rule (新建)
□ 4. bug 进度 → 跳过
```

用户勾选后直接执行选中项。未选 = 跳过。

**全 skip**：报"识别 N 项均建议跳过 + 原因"，停。

### 3. 跨仓写入二次确认（仅当 rules:plugin 且 cwd ≠ nocode-evolve 仓时）

```
项 #N (rules:plugin) 将写入 ~/AI/nocode-evolve/，确认？(yes/no)
```

no → 整次 distill 终止；yes → 进入分发。

### 4. 六出口分发

按 label 分发：

#### `wiki:project` 出口

调 `Skill(nocode-evolve:personal-distill)`，传入本出口的候选列表（含 disposition / body / target_layer）。personal-distill 负责完整的 wiki 写入协议（两层目录 / 整合判断 / frontmatter / index 重建 / log 追加）。

#### `wiki:cross-project` 出口（advisor）

不写文件。输出：

```
建议跑: /sow <ai 反推的意图候选>
原因: <这条为何跨项目>
```

**不替 `/sow` 校验 `$USER_VAULT_PATH`**——env 检查是 `/sow` 自己的责任，见 `skills/sow/SKILL.md` env 依赖节。（v1 env 名 `USER_WIKI_PATH` 已弃用，sow v2 改读 `USER_VAULT_PATH`）

**不替 `/sow` 判层**——sow v2 已支持三层（Inbox / Inputs / Outputs），advisor 仅推 `/sow <intent>`，由 sow 自判层 + 用户 NL 确认 loop。distill 不预估层、不绑层、不在 advisor 输出里附加层建议，职责保单一。

#### `rules:project` 出口

调 `Skill(nocode-evolve:personal-distill)`，传入本出口的候选列表（含 disposition / body / slug）。personal-distill 负责 rules 文件写入 + AGENTS.md 触发条目管理。

#### `agents:project` 出口

调 `Skill(nocode-evolve:personal-distill)`，传入本出口的候选列表（含 section_type / body）。personal-distill 负责 AGENTS.md 分节写入——融合已有分节或新增分节。

#### `docs:subdir` 出口

调 `Skill(nocode-evolve:project-distill)`，传入本出口的候选列表（含 target_dir / target_file / body）。project-distill 负责分析目标目录 + 写入 AGENTS.md 和/或 README.md。

与 `agents:project` 的落地路径完全不同：
- `agents:project` → `.agents-personal/AGENTS.md`（gitignored，个人配置）
- `docs:subdir` → `<dir>/AGENTS.md` + `README.md`（入仓，共享约束）

#### `rules:plugin` 出口（融合优先，否则三步联动）

按 `disposition` 走下方「rules:plugin 分发：融合路径 + 三步联动」节。

#### `skip` 出口

不写文件。报告里列出"被跳过的 N 项 + 原因"，给用户最后一次反悔机会。

### 5. 总报告

```
沉淀完成：
  ✓ 新建 wiki draft: draft/260616-new-model-onboarding.md (stub)
  ✓ 整合 wiki pages: pages/storage-backend-architecture.md (active, +交互卡片段)
  ✓ supersede wiki: pages/old-onboarding.md → pages/new-model-onboarding-checklist.md
  ✓ 改 rules:project: .agents-personal/rules/distill-shortcode.md + AGENTS.md
  ✓ 写 agents:project: AGENTS.md ## 语气风格 (新增分节)
  ✓ 写 agents:project: AGENTS.md {api_base_url} (融合进 ### 变量覆盖)
  ✓ advisor: /sow 沉淀今天讨论的 prompt 优化经验
  ✓ skip: 一次性 bug 修复（原因：无沉淀价值）
  📋 wiki/index.md 已更新, wiki/log.md 已追加 3 条

⚠ 融进 plugin rule: rules/rule-push-summary.md
  manifest: 已更新 push-summary 条目 triggers（本次融合扩了触发范围）并 generate 重新生成 catalog 分片  版本: 1.3.1 → 1.4.0 (minor)
⚠ 跨仓新建 plugin rule: ~/AI/nocode-evolve/rules/rule-distill-extension.md
  manifest+generate: rules/manifest.json 已加条目, generate 重新生成 catalog 分片  版本: 1.4.0 → 1.5.0 (minor)
  请到 nocode-evolve 仓 review + commit + 询问是否 push。

ℹ 健康检查（personal-lint）：0 error / 1 warn
  ⚠ 孤立页: draft/260512-local-dev-beta-feature-toggle.md
  → 结论：基本健康
```

---

> **wiki + rules 写入协议已搬到 `/personal-distill`**（`commands/personal-distill.md`）。distill 通过 `Skill(nocode-evolve:personal-distill)` 委派写入，不在本文件内重复。

---

## rules:plugin 分发：融合路径 + 三步联动

新架构下 `rules/` 不再分 axis（`overlay-` / `agent-` / `tool-` 命名前缀已废弃），所有触发式规则统一命名为 `rule-<slug>.md`，由 `rules/manifest.json`（单源）登记、`node hooks/generate.mjs` 生成进 `model/agent-catalog-*.md`（catalog 分片，完整路由常驻 context），agent 命中粗桶后按触发条件按需 Read。

按候选的 `disposition` 分两条路：**融合**（强相关，融进现有 rule）走下方「融合路径」；**新建**走「三步联动」。

### 融合路径（disposition=融合）

目标可能是顶层 `rules/rule-<x>.md`，**也可能是门面的子文件** `rules/rule-references/<x>/<子文件>.md`（如某 rule 按工具栈/场景拆了多个子文件，融合内容对应命中其中一个）。

1. **Read 目标文件全文** → 把 `body` 片段**融进合适章节**（必要时改章节结构，如新增 Workflow / Step 分支；**不是末尾 paste**）
2. **manifest 处理**（关键差异——不无脑新增条目；改的是单源 `rules/manifest.json`，不手改生成物 catalog 分片）：
   | 融合目标 | manifest 动作 |
   |---|---|
   | 顶层 `rule-<x>.md`，触发/摘要仍准确 | **不动** |
   | 顶层 `rule-<x>.md`，本次融合扩了 scope（触发范围变大） | **改 manifest 里那条** rule 的 triggers/summary，**不新增条目**；改后 `node hooks/generate.mjs` 重新生成 catalog 分片 |
   | `rule-references/` 子文件（门面 `rule-<x>.md` 已路由） | **不动**（门面 rule 已在 manifest 路由） |
3. **升 `plugin.json` 版本**：融合通常 `minor`（补充现有 rule 能力 = 兼容增强）或 `patch`（纯文案补充）；不默认像新建那样跳 minor
4. 报告："融进 `<目标路径>`，manifest [未动 / 已更新条目 `<slug>` 并 generate 重新生成 catalog 分片]，版本 `x → y`"

> 融合路径**不新增 manifest 条目、不新建文件**——这正是「融合优先」要省下的路由表面。

### 三步联动（disposition=新建）

#### Step 1: 写 rule 文件

文件路径：`${NOCODE_EVOLVE_REPO}/rules/rule-<slug>.md`。

slug 冲突 → **不直接 abort，转整合判断**：slug 已存在往往说明这就是融合目标。报"slug `rule-<slug>.md` 已存在——疑似融合目标，建议 `N fuse rules/rule-<slug>.md`（融进它）或 `N /<new-slug>`（确实是新主题，改名建新）"，回表格等用户。

`write(filePath, body)`。

### Step 2: 改 `rules/manifest.json`（单源）登记新 rule + 重新生成

新架构下 `rules/manifest.json` 是唯一真值源；`model/agent-catalog-*.md`（catalog 分片，完整路由常驻）是 `node hooks/generate.mjs` 的**生成物**——**禁手改生成物**，只改 manifest 再重新生成。manifest 没登记就等于 agent 触发不到（sanity check 会 stderr 警告）。

**实施策略（具体到 Edit 工具调用）**：

1. Read `${NOCODE_EVOLVE_REPO}/rules/manifest.json`，定位 `rules` 数组
2. 在数组末尾新增一条 rule 对象，挑合适的 `bucket`（必要时看 `buckets` 段），含 `id` / `bucket` / `trigger_desc`（触发）/ `read`（`${CLAUDE_PLUGIN_ROOT}/rules/rule-<slug>.md`）/ `summary`（摘要）/ 可选 `guard` / `pretooluse`：

```json
{
  "id": "<slug>",
  "bucket": "<bucket-id>",
  "trigger_desc": "<具体到能自识别的触发条件，不写\"看情况 / 需要时\">",
  "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-<slug>.md",
  "summary": "<一句话核心动作，让 agent 看了就知道这条 rule 干什么>"
}
```

3. 跑 `node hooks/generate.mjs` 重新生成 catalog 分片（`node hooks/generate.mjs --check` 验零漂移）

**触发条件写法约束**：必须具体到 agent 自己能判断命中——参考 manifest 里已有条目（如 push-summary 的 `trigger_desc`，不是"需要时读"）。

**不用 sed/awk**——JSON 多行匹配脆弱；Edit 工具的精确字符串匹配 + `generate.mjs` 重生成更可靠。

### Step 3: 升 `plugin.json` 版本

```
新增 rule        → minor   (默认；类比 CLAUDE.md:21-25 「新增 hook/skill/兼容性增强 = minor」)
改既有规则语义反转 → major
文案修订          → patch  (rarely)
```

`major` 需要会话里明确出现"反转既有规则"、"删除已部署规则"等破坏性信号。

Read `.claude-plugin/plugin.json` → bump version → Write 回去。

### 三步契约

- 三步**必须按顺序**：先写 rule 文件 → 再改 manifest 并 generate 重新生成 → 再升版本；任一步失败后续不执行
- **本逻辑内三步不回滚已成功步**（避免半成品状态更难恢复——文件保留比删了让用户从头来更易恢复）
- **但本项失败不影响其他候选项的分发**——与整体"非 transactional" 一致
- commit/push 不进本逻辑——CLAUDE.md 工作流约定 commit 由主交互完成

### 报告

```
已写入 plugin rule: rule-<slug>.md
manifest+generate: rules/manifest.json 已加条目, node hooks/generate.mjs 重新生成 catalog 分片
版本: <oldVersion> → <newVersion> (<bumpLevel>)
请到 nocode-evolve 仓 review + commit + 询问是否 push。
```

### 孤儿 rule 划界

如果发现 `nocode-evolve/rules/` 下有未被 `rules/manifest.json` 登记（故未进 catalog 分片）的孤儿文件——**不主动补**。归用户手动处理（inject-rules.sh sanity check 每 session stderr 警告，足够提示）。

理由：scope 控制——`/distill` 是沉淀命令，不是 manifest 整理工具。

在报告末尾仅做提示：

```
ℹ 发现孤儿 rule N 个：[rule-foo.md, ...]
   sanity check 已警告，请手动登记进 rules/manifest.json 后跑 generate, 或评估是否删除。
```

---

## 反模式

- ❌ **AI 自判直接写**——必须经过候选呈现 + 用户勾选
- ❌ **rules 永远新建**：明明是现有 rule 的延伸还新建 `rule-<slug>.md` + 加 catalog 条目 → catalog 膨胀 + 触发条件碎片化。强相关先融合（含融进 `rule-references/` 子文件）
- ❌ **融合还新增 catalog 条目**：融进现有 rule 时门面条目已覆盖，无脑再加一条 = 重复路由
- ❌ **末尾 paste**：整合 wiki 已有页 / 融进现有 rule 时不把新内容堆到 `## YYMMDD Update` 节——融进合适章节
- ❌ **跨仓写入不二次确认**：cwd ≠ nocode-evolve 仓而要写 plugin rule 时，不弹二次确认就动手
- ❌ **写 plugin rule 但忘了登记进 rules/manifest.json 并 generate 重新生成**——sanity check 警告等于白沉淀
- ❌ **写 plugin rule 但忘升 version**——CLAUDE.md 硬约束
- ❌ **AGENTS.md 加触发条件含糊**："需要时读 rules/foo.md" 等于没触发
- ❌ **agents:project 和 rules:project 混淆**：变量/语气/命名惯例/协作约定 → `agents:project`（写 AGENTS.md 分节）；触发条件/工作流指令 → `rules:project`（写 rules/ 文件 + AGENTS.md 触发条目）。区分标准：前者是偏好/配置，后者是 agent 行为指令
- ❌ **agents:project 和 docs:subdir 混淆**：个人偏好/项目级配置 → `agents:project`（写 `.agents-personal/AGENTS.md`，gitignored）；某个子目录的工程约束 → `docs:subdir`（写 `<dir>/AGENTS.md`，入仓共享）。区分标准：前者是个人的、后者是共享的
- ❌ **rules 文件名带日期**：rules 是当前指令不是历史记录，文件名只用 slug
- ❌ **在 distill 内部 commit / push**：只写文件，commit/push 由用户在主交互流程里处理
- ❌ **替 /sow 校验 env**：cross-project advisor 不检查 `$USER_VAULT_PATH`——是 /sow 自己的责任

---

## 边界情况

| 场景 | 处理 |
|---|---|
| 0 候选 | 报"本次无可沉淀内容"，停 |
| 全 skip | 报"识别 N 项均建议跳过 + 原因"，停 |
| `optionalTopicArg` 在会话里无对应内容 | 报"未找到 topic 相关内容"，停 |
| context 已被压缩到只剩 summary | 仍按可见内容尽力生成候选；表格脚注加 "⚠ context 部分被压缩，沉淀可能不完整" |
| `<proj>/.agents-personal/AGENTS.md` 不存在 | 三选一：(1)创建骨架 (2)跳过本项 (3)终止 distill |
| `agents:project` 候选写入的分节在 AGENTS.md 已存在 | 融合进已有分节（不新建重复分节） |
| `agents:project` 候选的变量名与已有变量冲突 | 展示新旧值对比，用户选保留哪个 |
| slug 冲突 (rules / wiki) | **转整合判断**（疑似融合目标）：在 AskUserQuestion 里加选项"融进已有 <path>" 和 "改名新建" |
| 融合目标是 `rule-references/` 子文件 | catalog 不动（门面已路由）；仅升版本 |
| `docs:subdir` 目标目录不存在 | 报"目标目录 `<dir>/` 不存在"，该项在表格里标灰 + 不可选 |
| `docs:subdir` 目标目录已有 AGENTS.md / README.md | project-distill 走更新逻辑（融合，不覆盖） |
| `$NOCODE_EVOLVE_REPO` 路径不存在 | 插件 rule 项在表格里标灰 + 不可选 |
| Step 1 写文件后 Step 2 改 manifest / generate 失败 | 不回滚 Step 1，报"写入了 rule 文件但 manifest 未登记，请手动改 manifest 后跑 generate" |
| Step 2 后 Step 3 改 plugin.json 失败 | 不回滚前两步，报"前两步完成但版本未升，请手动改 plugin.json" |
| nocode-evolve 仓有未提交改动 | 不阻断，报告里加一行"两边都要 commit" |
| `nocode-evolve/rules/` 下有孤儿文件 | 不主动补路由；报告末尾仅提示 |
| wiki/ 目录不存在（首次使用） | distill 自动创建骨架：`wiki/index.md` + `wiki/log.md` + `wiki/draft/` + `wiki/pages/` |
| 已有 `wiki/INDEX.md`（旧格式大写） | 重命名为 `index.md`（OKF §6） |
| 已有 pages/ 页无 maturity/topic/TLDR | 向后兼容 fallback：默认 active / Uncategorized / 用 description |
| `/distill --dream` 但 wiki/ 为空 | 报"wiki 无内容，dream 无需执行"，停 |
| dream scan 发现 related 路径全不存在 | 建议 archive（用户确认是否删除或标 superseded） |
| dream prune draft/ stub | `.agents-personal` 删除护栏生效，需二次确认 |
| promote 时 pages/ 已有同名文件 | 转融合判断（draft 内容融进已有 pages 页） |

---

## 写完后

不要主动 push 或 commit——按 CLAUDE.md 工作流，commit 由主交互流程在你完成所有沉淀后单独执行。

如本次涉及 `rules:plugin` 出口，提醒用户：
- `nocode-evolve` 仓有新文件（rule + manifest 改 + generate 生成物 catalog 分片 + plugin.json）
- 主仓如有 rules:project 改动也需要 commit
- 两边的 commit / push 由用户自己决定
