# skills/ — Claude Code skill 源码目录

本目录是 nocode 插件的 skill 集合。`skills/<name>/SKILL.md` 由 Claude Code 在会话中按需自动发现并加载执行。

> 范围说明：`skills/.claude/` 是隐藏目录，与本插件无关，不管；`skills/references/` 是被多个 skill 共享引用的领域指南库，本身**不是 skill**（没有 SKILL.md），有自己独立的 AGENTS.md/README.md，见仓库内 `skills/references/AGENTS.md`。

## 目录自动发现，但 workflow 类要登记

Claude Code 自动发现本目录下每个含 `SKILL.md` 的子目录，**新增 skill 不需要额外注册**。

例外：如果新 skill 是 **workflow 类**（承载 devflow/pdflow 的某个阶段，或本身就是流程领航入口），必须在 `rules/manifest.json` 顶层的 `workflow_skills` 数组里登记 `nocode:<skill-name>`，然后跑 `node hooks/generate.mjs` 重新生成 `hooks/workflow-skills.json`（防跳步 Hook A 消费的白名单，同样是生成物，禁手改）。

当前登记的 16 个 workflow 类 skill：`nocode:devflow`、`nocode:pdflow`（两个流程领航入口）+ 10 个 `dev-*` 阶段 skill（dev-define / dev-design / dev-design-refine / dev-design-render / dev-plan / dev-build / dev-verify / dev-review / dev-land / dev-finish-branch）+ 4 个 `pd-*` 阶段 skill（pd-research / pd-prd / pd-ix / pd-vd）。

不登记的情况：工具类、方法论类 skill，以及 `reviewing`（它是被各专项 review `Read` 引入的方法论底座，不进 manifest、不抢触发，见其 SKILL.md 里的边界说明）。

## 新增 / 修改 skill 的工序

1. **走 `Skill(nocode:skill-writing)`**，不要跳过 baseline 直接手写 SKILL.md。核心是 TDD 流程：Phase 3 用 subagent（+ codex 跨模型）跑 pressure scenario，先看到失败，再写 SKILL.md 针对性修 —— "It's just a reference doc" / "太简单不用测" 都是跳过 baseline 的常见借口，不成立。
2. **SKILL.md frontmatter 只有 `name` + `description` 两个字段**，不加其它元数据键。`description` 只写触发条件（"Use when..." / "当用户说..."），**不写工作流摘要**——摘要会让 Claude 只看 description 就照做，跳过正文细节。与其它 skill 有职责重叠时，用 "Not for X（use Y）" / "不负责 X（走 Y）" 显式排他划界（例：`dev-design` description 结尾 "Not for writing code comments, README, or commit messages"）。
3. **Step 编号只能是整数（`Step 1`）或字母后缀（`Step 1a` / `6e`）**，禁止分数编号（`Step 0½`）——仓库 `CLAUDE.md` 规则 5。新步骤插入已有序列时优先用字母后缀，避免大范围重编号；只有确实需要连续重排时才整体重编号。
4. **workflow 类 skill**（Multi-step 顺序执行 + 排序/副作用敏感）SKILL.md 必须含：Step 0 TaskCreate（任务一次性建全）、每个 Step 的 Enter/Exit Gate、Global Exit Gate；Gate 必须客观可判（yes/no / 有无数字），不能是主观词。模板见 `skill-writing/writing-skills/workflow-skill-template.md`。
5. skill 自评/自审步骤（review / verify / check / validate 自己刚产出的东西）要挂评审方法论：多维度结构化评审引入 `reviewing` 框架——`Read {NOCODE_SKILL_REF}/reviewing/skeleton.md` + `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md`，不要在新 skill 里重造一遍"维度清单→自评→交叉→分级→收口"流程；轻量单点自检可以只走自审（不进框架）。
6. SKILL.md 超过 500 行时，把细节挪到 `<skill>/references/`（skill 私有参考目录，与共享的 `skills/references/` 是两回事，见下条）。若某段领域知识对 ≥2 个 skill 都有用，考虑放进共享的 `skills/references/`（走该目录自己的 AGENTS.md 流程）。
7. **Skill 是自闭环单元，除 Reference 外只能读 Skill**：SKILL.md 正文与私有 `references/` 只能引用其它 Skill（点名 handoff 或 `Skill()` 调用）或参考材料（自己的 `references/`、共享的 `skills/references/`）；不得直接指路 `rules/rule-*.md`、`model/agent-*.md`、`hooks/`、非自身 `scripts/` 等插件内部实现文件（仓库 `CLAUDE.md` 规则 6）。`/plugin-dream` 的 Layer 2 skill 对象检测会扫这一项。
8. **SKILL.md 给 agent，README.md 给人**：归属说明、变更历史、设计理由这类人类可读内容放该 skill 的 README.md，不要塞进 SKILL.md 污染 agent context。
9. 改完后：升级 `.claude-plugin/plugin.json` 的 `version`（`skills/` 属于"被插件加载的文件"范围，CLAUDE.md 规则 2）——新增 skill/兼容性增强 → minor；纯 bug fix/文案修订 → patch；破坏性改名/语义反转 → major，与本次改动放同一个 commit。
10. commit 前如果改动涉及 vendor 来源 skill，先看下一条。

## vendor 来源 skill 禁手改

部分 skill 由上游 vendor 项目分发而来，分发规则记在各自的 `vendor-integration.json`（`vendor/superpowers/vendor-integration.json`、`vendor/everything-claude-code/vendor-integration.json`）：`keep-as-skill` 原样复制到 `skills/`、`extract-references` 抽取指定文件到顶层 `references/`（注意不是 `skills/references/`）、`absorb` 把上游内容一次性合并进现有文件后标 `done`、`skip` 不同步。

当前 `keep-as-skill` 的 vendor 来源 skill：
- superpowers：`brainstorming`、`using-git-worktrees`、`systematic-debugging`、`receiving-code-review`、`dispatching-parallel-agents`
- everything-claude-code：`eval-harness`、`continuous-learning-v2`、`strategic-compact`

这些目录**不要手动改内容再指望保留**——上游更新后跑 `node scripts/vendor-sync.mjs` 会按规则重新分发/覆盖，手改内容会被覆盖丢失。要定制这些 skill 的行为，走 rule overlay 叠加在上面（例：`using-git-worktrees` 有 `rule-git-worktree` overlay，`brainstorming` 有 `rule-superpowers-brainstorming` overlay），不要改 skill 源文件本身。

commit 前跑 `node scripts/vendor-sync.mjs --check` 确认一致（不一致 exit 1），必要时跑不带 `--check` 的版本执行同步。规则详见仓库 `CLAUDE.md` 规则 4 和 `vendor/AGENTS.md`。

## 与 commands/、agents/ 的关系

- `commands/*.md` 是用户 `/slash` 命令入口，很多命令是某个 skill 的显式触发面（例：`/nocodehub` 聚合本仓自维护相关 skill 的动作，`/distill` 分流到对应 distill 类 skill）。skill 是能力实现，command 是可选的用户显式入口——skill 本身也能被 model 通过 description 里的触发词自动调起，不依赖 command 存在。
- `agents/*.md` 是 subagent 定义（`architect`、`code-reviewer`、`database-reviewer`、`security-reviewer`、`planner`、`tdd-guide` 等），被部分 skill（`dev-review`、`dev-design`、`dev-plan`、`dev-build`）用 Agent/Task 工具派发调用，属于 skill 执行时使用的资源，不是 skill 本身。
