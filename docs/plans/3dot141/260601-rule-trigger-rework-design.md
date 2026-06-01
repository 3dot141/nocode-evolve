---
type: rfc
rfc_id: RFC-001
topic: rule 体系触发率改造——从扁平 catalog 转向"粗桶分层 + 单源 manifest + 机制化注入"
date: 260601
author: 3dot141
status: open
---

# RFC-001: rule 体系触发率改造

> 设计概览。本文回答"触发率该往哪个方向改"，不展开接口 / 代码 —— 那是后续 Design Doc 的事。

## 背景

nocode-evolve 的 rule 体系当前是**三层渐进加载**：`model/agent-catalog.md`（扁平路由表，会话开局常驻 context）→ `rules/rule-*.md`（命中再 Read）→ `rules/rule-references/`（钻取再 Read）；另有 `hooks/trigger-resurface.mjs`（UserPromptSubmit hook，用 `triggers.json` 的 regex 命中用户消息就注入"该触发 X"提醒）。

**核心问题：rule 触发率太低 —— 该加载某 rule 的时刻，agent 经常没去加载。** 围绕这个核心，有三条互相独立的成因，必须分开治：

**主因假设（最痛，待验证）：触发率瓶颈可能在"深度负载下的遵守失败"，而非"组织失败"。** 单点 evidence —— `docs/plans/3dot141/260526-rule-trigger-eval-design.md:183` 记录 `finishing-branch` 在 clean-room route-recall **6/6 满分**、真实主会话仍触发失败，提示"组织 / 路由描述写好了也未必保证遵守"。

**但这是假设、不是定论**，两条限制必须摆明：① evidence 只有 `finishing-branch` **单个 case**，不足以外推到整个 rule 体系；② 该后记自己留了 caveat —— clean-room catalog-only 召回**不代表**主会话行为、真正的"遵守 trace eval"留到 v2 未做（`260526-rule-trigger-eval-design.md:167-169`）。因此本 RFC 把它当**假设驱动**：若假设成立，单靠"把 rule 重组得更漂亮"治不好触发率 —— 该假设的证伪 / 证实手段见「影响评估 · 迁移 / 兼容」。

「深度负载」指长会话 / 大 context（`260526:185` 给的操作性定义是真实 200k token 深度负载），下同。

**辅因一：入口召回面太窄。** 当前 `triggers.json` 是精确 regex，措辞稍变就漏 —— 例如 worktree 的 regex 是 `(创建|建|新建|开|搞).{0,3}worktree` 加反向式 `worktree.{0,3}(创建|新建)`（`hooks/triggers.json:51-54`），只覆盖"创建"语境；catalog 文本另覆盖"worktree 内 env/config 缺失"等场景（`model/agent-catalog.md:20-23`）。但"切到那个 worktree""在 worktree 里报错了"这类**操作进行中**的语境仍全不命中。

**辅因二：双源漂移，且比表面更深。** `trigger-resurface.mjs` 读 `triggers.json`，注释要求"与 catalog 触发行保持一致"，但无强制。已漂两层：① **措辞漂** —— catalog 里 brainstorming 摘要写落 `specs/`，`triggers.json` 的 note 还写 `plans/`；② **规则集合本身错位** —— `model/agent-catalog.md` 列 6 条（含 `git-inspection`）、`hooks/triggers.json` 也 6 条（含 `red-blue-deep`），但**不是同一组**：`git-inspection` 在 catalog 有、triggers 没有；`red-blue-deep` 在 triggers 有、catalog 无独立条目。两边各有一条对方缺的 —— 集合都对不齐，是比措辞漂更硬的"必须单源"证据。

**力的对抗**：召回（写宽触发条件多命中）vs 精度（写宽了会滥触发）—— 当前体系选了精度、牺牲召回。而主因揭示第三个力：组织质量 vs 深度遵守 —— 把组织做到满分（6/6）也不保证遵守。改造必须同时回应这三个力，不能只动一处。

> **决策溯源**：本方向经红蓝军 + Codex 跨模型交叉验证得出。期间推翻了两个最初设想 —— ①「上 OWL/RDF 全量 ontology 形式化」（6 条 rule 严重过度工程）②「挖深 wiki 树 1→1.1→1.1.1」（深树对 agent 是更长的自主钻取链，掉率连乘，反而降触发率）。Codex 攻破了"层级 = 只优化检索不碰触发"的绝对化判断 —— 见提案问题一。

## 目标

争取对**改造方向**的认同（不是争取某段代码）：

1. 认同触发率是**三环问题**（入口召回 / 入口精度 / 深度遵守），不是单一的"组织问题"，因此不能靠"把 rule 重写成 ontology 或深 wiki 树"单点解决。
2. 认同地基是**单一 policy manifest**（一份源派生多通道），而非继续手写多份易漂移的真值。
3. 认同**机制化注入（PreToolUse）**是深度遵守的必要兜底，且拦截靶应是"真实绕过点"而非泛泛的命令。

## 提案

### 提案核心

把 rule 体系从"扁平 catalog + 手写双份触发源 + 靠 agent 自觉钻取"，改造成**「粗桶分层信息架构 + 单一 policy manifest 派生多通道 + 关键 guard 上浮父节点 + PreToolUse 机制化拦截」**。预期变化：入口召回随粗桶变宽而升、双源漂移被单源结构性消除、深度负载下的关键约束不再依赖 agent 自觉钻取就能生效。

### 问题拆解

#### 问题一：入口召回低 —— 扁平精确 regex vs 粗桶分层

**说明**：当前每条 rule 各自维护精确触发条件，召回面是 6 个窄点的并集，措辞稍变即漏。

**方案对比**：
- **A. 维持扁平、堆更多 regex 变体**：召回随 pattern 数线性补，但永远追不全自然语言的措辞空间；且 pattern 越多越难维护。
- **B. 粗桶分层重做顶层信息架构**（采纳）：catalog 顶层改成少数粗桶（如 `Git-lifecycle / Review / Design / Memory`），父桶触发条件写得宽 —— 例如"任何把本地分支推进到远端协作状态的请求"一句覆盖"创建 PR / 提交推送 / origin-upstream / 收尾一下"。命中粗桶比命中一堆精确点容易，召回直接升。**代价是精度**：粗桶会把"列一下当前 PR"也吸进来，所以父节点必须配**负例 + 二级分类器**，不能只写目录 —— 见问题二。

**结论**：选 B。这一条修正了最初"层级只优化检索、不碰触发"的误判 —— **层级若重做的是顶层触发面（而非只下沉细节），就直接提入口召回。**

#### 问题二：粗桶会滥触发 —— 靠精度换召回的回补

**说明**：问题一把召回拉宽，必然牺牲精度。需要在父桶内回补精度，否则宽桶变成噪音源。

**方案对比**：
- **A. 父桶只写目录（无负例）**：召回高但 precision 崩，"列 PR""看一眼分支"都误触发，提醒噪音化后 agent 学会忽略 —— 比不触发更糟。
- **B. 父桶配负例 + 二级分类器**（采纳）：父桶 metadata 带显式负例（"不含：纯查询 / 只读列举"）+ 命中粗桶后用一层轻分类（关键词或语义）路由到具体子 rule。

**结论**：选 B。召回（宽父桶）与精度（负例 + 分类器）是同一枚硬币两面，必须成对设计。

#### 问题三：深度负载遵守失败 —— 靠自觉 vs 机制化

**说明**：对应背景的主因假设。6/6 clean-room 满分但真实失败，**提示**组织再好也未必兜得住深度负载下的"知道却没做"（该提示的证伪手段见迁移节）。注意 guard 上浮与 PreToolUse 是**正交的两件事**（一个改文本组织、一个加运行时拦截），各自可独立采纳 / 否决，故拆成两个子问题分别对比。

**方案对比**

*子问题 3a — 关键约束放在哪一层？*
- **A1. 全文留在叶子，靠 agent 钻取到底才触发**：clean-room 已满分、真实仍失败 —— 此路被 evidence 否决（注：此否决同样受主因假设约束，见 C1）。
- **A2. 关键 guard 上浮父节点（采纳）**：把每条 rule 的关键禁止项 / 决策点上浮到父节点文本 —— `rules/rule-finishing-branch.md:5` 已是门面、禁 `bkt api --method PUT` 改 PR 元数据写在父文件 `## 不要` 节（`:85`），"不钻到叶子也已生效"，化解深树的连乘掉率。

*子问题 3b — 要不要运行时机制化拦截？*
- **B1. 不加，仅靠 UserPromptSubmit 注入提醒**：只能看用户说什么，看不到 agent 实际要跑的命令；且会被非用户文本误触发（实测：系统通知被当消息扫中触发词）。
- **B2. 加 PreToolUse 拦真实绕过点（采纳）**：PreToolUse（Claude Code 工具调用前的 hook 时机）能看 agent **真要干什么** —— 拦 `curl .../pull-requests`、`bkt api --method PUT`、`gh pr create`、`git push` 接 PR 意图，命中即处理。**「阻断」还是「强注入后放行」的取舍未定，见开放问题 Q2。**

**结论**：3a 选 A2、3b 选 B2 —— 两者独立成立、可分阶段落地（见迁移节），不必捆绑。guard 上浮降低对钻取的依赖，PreToolUse 兜真实绕过；且 PreToolUse 的靶要对准真实绕过点而非泛命令（如最初设想的只盯 `git worktree`）。

#### 问题四：四处真值如何不漂移 —— 手写多份 vs 单源派生

**说明**：改造后真值更多了（catalog 摘要 + UserPromptSubmit 触发 + PreToolUse 规则 + eval fixture），手写多份漂移风险更高。

**方案对比**：
- **A. 各自手写 + sanity check 校验一致**：能报错但不防漂，且校验逻辑本身要维护。
- **B. 单一 policy manifest 派生**（采纳）：一份 YAML/JSON 作唯一真值源，**生成** catalog 摘要、UserPromptSubmit 触发词、PreToolUse 阻断规则、eval fixture 初稿。结构上只有一个源，无第二处可漂。

**结论**：选 B。这是整套改造的地基 —— 也是最初"ontology 单一结构化源"直觉的正确落地形态（一份 manifest 足够，不必上 OWL）。

### 提案总结

四个问题串成一条线：**单源 manifest（地基）** 派生出 **粗桶分层的 catalog（治召回，问题一二）** + **PreToolUse 规则（治深度遵守，问题三）** + **eval fixture（持续验证）**。召回靠粗桶变宽、精度靠负例分类器回补、遵守靠 guard 上浮 + PreToolUse 兜底、一致性靠单源结构性保证。四环各治一个力，缺一不可。

## 影响评估

### 受影响方

- **rule 作者 / 维护者（你自己，单人）**：写 rule 的入口从"改 markdown + 手动同步 triggers.json"变成"改 manifest，重新生成"。日常加 rule 的心智模型变了。
- **会话开局 context**：catalog 从手写变生成物，注入内容形态变（粗桶 + 摘要）。
- **agent 运行时**：多一条 PreToolUse 通道，工具调用前可能被注入提醒 / 阻断。

### 缺点 / 风险

- **生成管线 = 新故障源**：manifest 写错 / 生成器挂 → 注入坏 catalog 或坏 PreToolUse 规则，且 debug 时看到的是生成物不是源头，排查链变长。
- **PreToolUse 误拦**：靶子写宽了会拦正常命令（如合法 `git push`），打断正常流程；写窄了又漏真实绕过点。精度调参有持续成本。
- **粗桶分类器的精度天花板**：负例 + 轻分类器仍可能误判，需 eval 闭环长期校。
- **迁移一次性成本**：现有 6 条 rule + triggers.json 要重构进 manifest，catalog 要重写成粗桶结构。
- **manifest 治不了 rule 正文**：正文（21k 字的 worktree 规则等）仍是 markdown，manifest 只管触发 + 路由 metadata。改造收益不覆盖正文质量。

### 迁移 / 兼容

- manifest 与现有三层加载可**并存过渡**：先让 manifest 生成 catalog/triggers（替换手写），跑通后再增量加 PreToolUse 通道，不必一次切换。
- `rule-eval` skill 已有的触发率 eval 作为**召回回归基线**（防止改造把已满分的 route-recall case 改退步）。
- **但召回 eval 测不到真实遵守失败** —— 该后记明确"测不到真实失败"（`260526-rule-trigger-eval-design.md:185`）。因此主因假设（背景）与 PreToolUse 方案（问题三 3b）必须配一类**能观察实际 tool bypass 的验收**才闭环：在真实 / 仿真深度负载会话里埋点，统计"agent 实际跑了 `gh pr create` / `bkt api --method PUT` / 裸 `curl .../pull-requests` 等绕过点、却未先加载对应 rule"的发生率，作为 PreToolUse 通道的核心验收指标，并据此证伪 / 证实背景的主因假设。缺这条，主因、方案、影响评估无法被同一套 evidence 验证。

## 开放问题

- **Q1**：粗桶的二级分类器用什么实现？纯关键词 / 规则表够不够，还是必须上轻量语义匹配（embedding）？后者引入新依赖，ROI 是否值当 6~N 条 rule 的规模？
- **Q2**：PreToolUse 拦真实绕过点时，**默认动作是"阻断"还是"强注入提醒后放行"**？阻断更强但误拦代价高（打断合法操作），注入更软但可能仍被深度负载忽略。
- **Q3**：manifest 的 schema 粒度 —— 多薄算够？只覆盖"触发 + 路由 + PreToolUse 靶"，还是连"关键 guard 文本"也纳入派生（让 guard 上浮也由 manifest 驱动）？
- **Q4**：粗桶顶层分类（`Git-lifecycle / Review / Design / Memory`）是否就是对的切法？会不会有 rule 天然跨桶（如 codex-review 既属 Review 又被 design-doc 调用）？跨桶 rule 怎么挂？

## Review Log

### Review 1 — 2026-06-01

**双路交叉验证**（general-purpose subagent + Codex 跨模型并行各跑一遍，合并取交集=高置信、对称差=盲点）。

**general-purpose Report**：无 Critical。Warning：worktree regex 引用不准、6 条/6 类集合实为错位（git-inspection vs red-blue-deep）、两层"父"歧义。Suggestion + Self-Audit 多为术语首现未解释 / 背景密度过高 / 提案核心过载。Verdict: ❌ Has issues（无 Critical）。

**Codex Report**：`Request changes`，2 Critical —— C1 主因从单 case 外推到全系统、且忽略 `260526:167-169` 自承的 caveat；C2 验证不闭环（回归依赖的 eval 自承"测不到真实失败" `260526:185`，而提案核心 PreToolUse 兜的就是真实绕过）。Warning：worktree regex 不准、"单源结构性消漂"过满（生成物 stale）、方案对比弱备选 / 捆绑、文档内三/四环计数不自洽、风险缺处置。Verdict: Request changes。

**交叉结论**：对称差即盲点 —— Codex 的 C1/C2（evidence 被过度外推、验证不闭环）是 general-purpose 完全没抓到的，且成立。这是双跑避同源盲区的直接收益。

**用户决定**：fix C1, C2, W1, W2(问题三拆 a/b), W3(集合错位)；skip W4-W7、S1-S6；Q2-Q4 留作 RFC 开放问题（不在本轮答）；S/SA 留下一轮。

**本轮修订**：
- **C1**：背景「主因」改为「主因假设（待验证）」，摆明两条限制（单 case 不可外推 + 引 `260526:167-169` caveat），结论改为假设驱动，证伪手段指向迁移节。
- **C2**：迁移节补「能观察实际 tool bypass 的验收」—— 埋点统计 agent 实际跑绕过点却未加载 rule 的发生率，作为 PreToolUse 核心验收 + 主因假设的证伪/证实手段。
- **W1**：worktree regex 照抄真实 `(创建|建|新建|开|搞).{0,3}worktree` + 反向式（`triggers.json:51-54`），并补 catalog 另覆盖 env 缺失场景。
- **W2**：问题三方案对比拆成正交子问题 3a（约束放哪层 → guard 上浮）/ 3b（要不要 PreToolUse），各自独立对比，阻断 vs 注入取舍移交 Q2。
- **W3**：辅因二补「规则集合错位」第二层漂移（git-inspection / red-blue-deep 两边各缺一条），作为更硬的"必须单源"证据。
- **附带（C1 同根，顺带）**：因 C1 收窄引用了「深度负载」，顺手补了一句操作性定义（对应 reviewer SA2）——超出严格清单但为 C1 自洽所必需，特此标注。

**未处理（保留）**：W4（manifest 生成物生命周期 → 部分由 Q2 承接）、W5（两层"父"歧义）、W6（三/四环计数）、W7（风险处置）、S1-S6、SA1/SA3/SA4。下一轮 review 或转 Design Doc 时处理。
