# superpowers skill 行为覆盖

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

2. **`nocode:dev-design-refine`** —— 生成 markdown 设计文档
   - 场景选择（feat / bug / refactor 三种场景模板；预研 / 技术选型走 `dev-design-select`）
   - 每种场景一套骨架（feat：领域划分 → 交互场景 → 域设计 → 汇总；bug：现象 → 根因 → 修复 → 验证；refactor：现状 → 目标 → before/after → 迁移）
   - Read `references/example-{feat,bug,refactor}-skeleton.md` 学习结构
   - 输出路径按 `{dev_design_output}` 变量（落在 step 1 创建的 worktree 内）

3. **评审**（dev-design-refine 工作流的 Review 环节 · 自审为主，维度用 `references/reviewer-template.md`）
   - 主路自审：当前会话按 reviewer-template 做 7 维度核心审查（含「骨架可读性」专门检查新骨架）+ AI patterns 附带检查 + Self-Audit 两遍法，不派 subagent、不调 codex
   - 输出分级 Review Report（Critical / Warning / Suggestion），每条带短编号（C1/W1/S1...）
   - **不自动循环修订**：Report 原样呈现给用户，逐条勾选 fix / skip（也可一键全修/全跳过/自由指示）
   - 据用户决定修订主体后，**本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`**
   - 是否再来一轮 review 由用户决定，不再有"最多 3 轮"硬限制
   - **升档交叉验证**（自审有异议才走，reviewing skeleton §1a）：自审出无法自行裁决的 finding / 结论有争议 / 用户显式要求深审 → 升档**单跑 Codex**（见 `rule-codex-review` 场景四，不预先探活，直接尝试），避开 Claude 自审同源盲区；codex 调用报错才 fallback 改跑 `design-doc-reviewer` (general-purpose) subagent 单路，并明说 fallback。Report 分级 / 逐条确认 / Review Log 流程不变

4. **`dev-design-render`** (见 `skills/dev-design-render/SKILL.md`) —— 把设计文档 ASCII 图渲染成 HTML 可视化
   - 输入：reviewer 通过的 markdown
   - 输出：同目录、同名、换后缀 `.html`
   - HTML 含 TOC / 折叠 / 暗黑模式 / 代码高亮 / 回到顶部 5 个交互

四步都要走：开 worktree → 写 → 评审 + **用户逐条确认** + 追加 Review Log → 渲染。
不要省略 worktree（除非用户显式弃用），不要省略评审（自审是最低门槛），不要代用户拍板 issue 修不修，不要绕过这些 skill 直接写。
