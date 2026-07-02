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

1. **写 rule 文件**：`slug` 从描述/候选提取；`filePath = ${NOCODE_EVOLVE_REPO}/rules/rule-<slug>.md`。冲突检查须覆盖两层——manifest 已登记同名，**或** 文件系统里已存在 `rule-<slug>.md`（哪怕未登记，即孤儿 rule，`/plugin-dream` 的 O4 检测对象）：任一命中 → 不 abort、不静默覆盖，`AskUserQuestion`：融进已有 `rule-<slug>.md` / 改名新建。仅当两层都未命中才 `Write(filePath, body)`（Review P2：原逻辑只查 manifest，会静默覆盖孤儿 rule 文件内容，是真实数据丢失风险）
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
请到 nocode 仓 review + commit，push 需询问。
```

### skill 委托

1. 从描述推导信号词（`create a skill` / `improve this skill` / `fix trigger accuracy`），让 `skill-writing` 的 Entry Routing 自判 Create/Edit/Description-only，不替它选模式
2. `Skill(nocode:skill-writing, <intent> + <signalWord>)`。skill-writing 走到 Phase 7（描述优化）收敛即可，Phase 8 Package（打包 `.skill` 分发）对本仓无意义（marketplace 直接读 git），明确不需要
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
