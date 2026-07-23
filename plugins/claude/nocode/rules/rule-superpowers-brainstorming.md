---
name: superpowers-brainstorming
description: >-
  即将执行 nocode:brainstorming skill, 或用户直接要求写 PRD/RFC/设计
  文档/ADR (绕过 brainstorming) 时触发——两条入口都走同一条 worktree →
  write → review → render 四步链, 本文件覆盖 skill 内默认值 (冲突以本
  文件为准)。不触发: 纯实现、已有设计文档的执行、README/注释/提交说明等
  非设计文档写作。
skip: false
---

# superpowers skill 行为覆盖

用户显式要求独立评审时调用 `Skill(nocode:reviewing)`。


执行下列 superpowers skill 时，本文规则覆盖 skill 内默认值。
若与 skill 内文冲突，**以本规则为准**。

## nocode:brainstorming

### 输出路径

设计文档落地路径由 `{dev_design_output}` 变量定义（见 `model/agent-about.md`「文档产出路径变量」）。

### 写作工作流

**触发写设计文档时都走完整 worktree → write → review → render 流程** —— 不分入口：brainstorming 走到 step 5，**或用户直接要求写 PRD / RFC / 设计文档 / ADR（绕过 brainstorming）**，两条路径一致：

1. **`nocode:using-git-worktrees`** —— 写设计文档前先开 worktree（两条入口都开，不是 brainstorming step 5 专属）
   - 分支名建议 `design/<topic>`，`<topic>` 沿用上面输出路径中的 kebab-case 主题
   - worktree 路径按 `rules/rule-git-worktree.md` 落到项目同级 `<project>-<branch-flat>/`（例：`design/foo-bar` → `<parent>/<project>-design_foo-bar/`）
   - 后续 write / review / render 三步都在新 worktree 内执行——主仓 working tree 不被设计文档草稿污染，便于并行多份设计 / 多 IDE 窗口对照
   - 例外：用户显式声明「在主仓写 / 不要 worktree / 就地写」→ 跳过本步，但要回复里点名告知"按你的要求跳过 worktree，直接在主仓 <branch> 写"

2. **`nocode:dev-design`** —— 设计流程协调器（decision → writing → render 三阶段）
   - decision 阶段：探索 + 多方案对比 + 领域覆盖 + 测试目标 → 产出 Decision Packet
   - writing 阶段：消费 Packet → feat/bug/refactor 详细设计 + 唯一评审
   - 场景选择（feat / bug / refactor 三种场景模板）
   - Read `references/example-{feat,bug,refactor}-skeleton.md` 学习结构
   - 输出路径按 `{dev_design_output}` 变量（落在 step 1 创建的 worktree 内）

3. **评审**（dev-design writing 阶段的 Review 环节，维度用 `references/design-doc-review.md`）
   - 评审：**默认主会话逐维自查**（design-doc-review 维度核心审查 + AI patterns 附带检查 + Self-Audit），不调 reviewing 引擎、不派 subagent/Codex；用户显式要求（「审一下 / 深审 / 独立审」）才按上方平台语法调用 reviewing，传入设计文档绝对路径、全部设计审查维度、AI patterns、self-audit、checklist、完整 Context Capsule 和 independent 深度；文档命中敏感面（认证 / 数据迁移 / 资金 / 对外接口 / 不可逆决策）→ 一句话建议升审，用户点头才派
   - 输出分级 Review Report（Critical / Warning / Suggestion），每条带短编号（C1/W1/S1...）
   - **不自动循环修订**：Report 原样呈现给用户，逐条勾选 fix / skip（也可一键全修/全跳过/自由指示）
   - 据用户决定修订主体后，**本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`**
   - 是否再来一轮 review 由用户决定，不再有"最多 3 轮"硬限制

4. **render 阶段** —— 渲染前 Read 共享 reference `{NOCODE_SKILL_REF}/doc-render.md`，照其四步（结构分析 → design plan → 渲染发布 → 验证 receipt）执行
   - PRD / RFC / ADR 与技术设计文档**同一协议**——不因产物类型或入口不同另起渲染方式
   - 细节（图 DOM 化 / 不取保守档 / 内容忠实 ≠ 呈现镜像 / favicon / receipt）全在 doc-render 协议内，本 rule 不复制、以其为准

四步都要走：开 worktree → 写 → 评审 + **用户逐条确认** + 追加 Review Log → 渲染。
不要省略 worktree（除非用户显式弃用），不要省略评审（默认自查是最低门槛，跳过的是"自动派独立 reviewer"不是评审本身），不要代用户拍板 issue 修不修，不要绕过这些 skill 直接写。
