# superpowers skill 行为覆盖

执行下列 superpowers skill 时，本文规则覆盖 skill 内默认值。
若与 skill 内文冲突，**以本规则为准**。

## superpowers:brainstorming

### 输出路径

设计文档落地路径由 `{dev_design_output}` 变量定义（见 `model/agent-about.md`「文档产出路径变量」）。

### 写作工作流

**触发写设计文档时都走完整 worktree → write → review → render 流程** —— 不分入口：brainstorming 走到 step 5，**或用户直接要求写 PRD / RFC / 设计文档 / ADR（绕过 brainstorming）**，两条路径一致：

1. **`superpowers:using-git-worktrees`** —— 写设计文档前先开 worktree（两条入口都开，不是 brainstorming step 5 专属）
   - 分支名建议 `design/<topic>`，`<topic>` 沿用上面输出路径中的 kebab-case 主题
   - worktree 路径按 `rules/rule-git-worktree.md` 落到项目同级 `<project>-<branch-flat>/`（例：`design/foo-bar` → `<parent>/<project>-design_foo-bar/`）
   - 后续 write / review / render 三步都在新 worktree 内执行——主仓 working tree 不被设计文档草稿污染，便于并行多份设计 / 多 IDE 窗口对照
   - 例外：用户显式声明「在主仓写 / 不要 worktree / 就地写」→ 跳过本步，但要回复里点名告知"按你的要求跳过 worktree，直接在主仓 <branch> 写"

2. **`nocode-evolve:design-doc-writing`** —— 生成 markdown 设计文档
   - 类型选择（按业界 4 类 doc-type 主轴：PRD / RFC / Design Doc / ADR）
   - 每个 doc-type 一套线性骨架（背景 → 目标 → ... → 后果，无元结构标签）
   - Design Doc 骨架：背景 / 目标 / 架构（架构图 / 流程图 / 时序图 / 文本总结）/ 实现（影响 / 接口设计 / 业务流 BFx / 异常与失败模式 / 单测设计）/ 方案选型（Q→选项→定 三行）/ 其他（部署 …）
   - Read examples + doc-types reference 学习结构
   - 输出路径按 `{dev_design_output}` 变量（落在 step 1 创建的 worktree 内）

3. **`design-doc-reviewer` subagent**（在 design-doc-writing 工作流内通过 `Task(general-purpose)` + `references/reviewer-template.md` dispatch）
   - 独立 context 审查质量
   - 7 维度核心审查（含「骨架可读性」专门检查新骨架）+ AI patterns 附带检查 + Self-Audit 两遍法
   - 输出分级 Review Report（Critical / Warning / Suggestion），每条带短编号（C1/W1/S1...）
   - **不自动循环修订**：Report 原样呈现给用户，逐条勾选 fix / skip（也可一键全修/全跳过/自由指示）
   - 据用户决定修订主体后，**本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`**
   - 是否再来一轮 review 由用户决定，不再有"最多 3 轮"硬限制
   - **默认交叉验证**：这轮独立审稿默认 `design-doc-reviewer` (general-purpose) subagent + Codex 跨模型**并行双跑**（见 `rule-codex-review` 场景四）——一份稿两个模型审，避开 Claude 自审同源盲区，交集=高置信、对称差=盲点；codex 不可用才降级为仅 general-purpose 并明说 fallback。仅琐碎 / 文案改动可降档单跑 gp。Report 分级 / 逐条确认 / Review Log 流程不变

4. **`design-doc-writing` 内部 render 环节** (见 `skills/design-doc-writing/references/rendering/RENDERING.md`) —— 渲染 single-file HTML 展示版
   - 输入：reviewer 通过的 markdown
   - 输出：同目录、同名、换后缀 `.html`
   - HTML 含 TOC / 折叠 / 暗黑模式 / 代码高亮 / 回到顶部 5 个交互

四步都要走：开 worktree → 写 → 评审 + **用户逐条确认** + 追加 Review Log → 渲染。
不要省略 worktree（除非用户显式弃用），不要省略 reviewer，不要代用户拍板 issue 修不修，不要绕过这些 skill 直接写。
