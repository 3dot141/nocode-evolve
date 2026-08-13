---
description: rule / skill 双轨写入——新增/优化 plugin rule（三步联动/融合）或委托 skill-writing 优化 skill
argument-hint: <描述> | (被 /distill 传结构化候选)
---

本文所说“调用 `<skill>` Skill”使用 `/skill:<skill>`；“结构化决策”在回合末写出完整问题与 2–3 个互斥选项，等待用户下一条消息。


> 本文写“结构化决策”时，必须使用当前平台原生决策工具，传入完整问题与 2–3 个互斥选项；示例只展示单项形状，真实调用需带齐本步骤列出的选项。

# /plugin-distill：plugin rule / skill 写入

统一入口，处理两类插件自维护写入：新增/融合一条 `rules/rule-<slug>.md`（frontmatter 自带触发定义）登记的 plugin rule，或委托优化一个 `skills/` 下的 skill。被 `/distill` 的 `rules:plugin` 出口调用（传结构化候选），也可独立调用（传 NL 描述）。

## 用法

`/plugin-distill <描述>` — 独立调用，NL 描述你要新增/优化的 rule 或 skill
被 `/distill` 调用时严格从 `arguments.payload.candidates[]` 接收结构化候选 `{id, disposition, target?, body, description?, ...}`；`disposition ∈ {create, merge, skip}`。

## 权威依据

改动涉及版本号 / commit-push / rule 改动流程时，现读 `${NOCODE_EVOLVE_REPO}/CLAUDE.md` 原文为准，不在本文件摘抄固化。

## 执行

### Step 1: 判类型

- 被 `/distill` 调用（逐个读取 `arguments.payload.candidates[]`）：
  - `disposition=merge` → 从同一 candidate 的 `target` 读取 fuseTarget，走「融合路径」
  - `disposition=create` → 走「三步联动」
  - `disposition=skip` → 不写入并报告跳过
  - 缺字段或其它枚举 → 报协议错误停止，不从展示文案猜值
- 独立调用（NL 描述）：
  - 判断描述内容是 rule 类（触发条件/工作流指令）还是 skill 类（创建/优化一个 skill 的能力）
  - 拿不准 → `结构化决策`：`rule` / `skill` / `两者都涉及`，不猜测
  - rule → 判 slug 是否已存在（走「融合路径」或「三步联动」），skill → 走「skill 委托」

### 融合路径（disposition=融合，或独立调用判定为融合现有 rule）

目标可能是顶层 `rules/rule-<x>.md`，也可能是门面的子文件 `rules/rule-references/<x>/<子文件>.md`。

1. Read 目标文件全文 → 把 body 融进合适章节（不是末尾 paste，必要时改章节结构）
2. frontmatter 处理：
   - 顶层 rule，触发边界仍准确 → 不动
   - 顶层 rule，本次融合扩了触发范围 → 改该文件自身 frontmatter 的 `description`（把新边界写进同一句话）；改后跑 `node scripts/compile.rule.js`
   - `rule-references/` 子文件 → 不动（门面 rule 已路由，子文件没有独立 frontmatter）
3. 升 `plugin.json` 版本：融合通常 `minor`（扩了能力）或 `patch`（纯文案）——判据现读 CLAUDE.md 规则2，不自行发明
4. 报告：`融进 <目标路径>，frontmatter [未动 / 已更新 description 并 compile.rule.js 重新生成 catalog]，版本 x → y`

### 三步联动（disposition=新建，或独立调用判定为新建 rule）

1. **写 rule 文件（含 frontmatter）**：`slug` 从描述/候选提取；`filePath = ${NOCODE_EVOLVE_REPO}/rules/rule-<slug>.md`。冲突检查：文件系统里已存在 `rule-<slug>.md` → 不 abort、不静默覆盖，`结构化决策`：融进已有文件 / 改名新建。未命中才 `Write`，内容顶部带 frontmatter：
   ```yaml
   ---
   name: <slug>
   description: >-
     <具体到能自识别的触发条件 + 不触发边界，不写"看情况/需要时">
   skip: false
   ---
   ```
   > `description` **必填**且要自成一句——它同时是渲染进常驻 catalog 表格的唯一内容（不再有单独的
   > `trigger_short`/`trigger_desc` 两层），漏写或写得太粗会让 catalog 那一行失去筛选价值。
2. **跑生成器**：`node scripts/compile.rule.js`，再跑 `node scripts/compile.rule.js --check` 验零漂移。
3. **升版本**：新增 rule → `minor`（默认）；语义反转既有规则 → `major`（需会话里明确出现"反转既有规则"信号）；纯文案 → `patch`（少见）。判据现读 `${NOCODE_EVOLVE_REPO}/CLAUDE.md` 规则2 原文，不自行发明或简化。Read `plugin/metadata.json` → bump → Write 回，再运行 `node scripts/package.platform.mjs`

三步契约：必须按顺序；任一步失败后续不执行；三步内不回滚已成功步（文件保留比删了更易恢复）；commit/push 不进本逻辑。

报告：
```
已写入 plugin rule: rule-<slug>.md（含 frontmatter）
compile: node scripts/compile.rule.js 重新生成 catalog
版本: <old> → <new> (<bumpLevel>)
请到 nocode 仓 review + commit，push 需询问。
```

### skill 委托

1. 从描述推导信号词（`create a skill` / `improve this skill` / `fix trigger accuracy`），让 `skill-writing` 的 Entry Routing 自判 Create/Edit/Description-only，不替它选模式
2. 调用 `skill-writing` Skill，传入 `arguments={"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}`。skill-writing 走到 Phase 7（描述优化）收敛即可，Phase 8 Package（打包 `.skill` 分发）对本仓无意义（marketplace 直接读 git），明确不需要
3. **Gate**：只有 skill 文件确有改动（对比委托前后的 `git status`/`git diff` 有实际变更）才继续；委托中止 / 用户放弃 / 无改动 → 报告"skill 未改动"，**不升版本**
4. 有改动 → 升 `plugin.json` 版本（`minor`，判据同上现读 CLAUDE.md）——**skill-writing 本身不碰 plugin.json，这一步必须自己补**
5. 报告：`skill 已更新: <skillPath>，版本: <old> → <new> (minor)，请 review + commit，push 需询问`

## 孤儿 rule 划界

不主动补未登记的孤儿 rule（scope 控制）——归 `/nocodehub dream` 主动巡检（职责相反，dream 主动扫）。

## 不要

- AI 自判直接写——被 `/distill` 调用时信任其已完成候选呈现+用户勾选；独立调用时拿不准分类要问不要猜
- rules 永远新建——强相关先融合
- 弱相关点名其他 skill / command / rule——仅执行链硬依赖（handoff / 必须调用的框架 / 路由消歧「X 不归本条,走 Y」）才点名；不引用对方内部结构（Step 编号 / 小节名）当"参考模式"
- 末尾 paste——融进合适章节
- 忘了写 frontmatter 或忘升版本
- skill 委托后无条件升版本——必须 gate 在"确有改动"
