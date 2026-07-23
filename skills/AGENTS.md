# skills/ — Claude Code skill 源码目录

本目录是 nocode 插件的 skill 集合。`skills/<name>/SKILL.md` 由 Claude Code 在会话中按需自动发现并加载执行。

> 范围说明：`skills/.claude/` 是隐藏目录，与本插件无关，不管；`skills/references/` 是被多个 skill 共享引用的领域指南库，本身**不是 skill**（没有 SKILL.md），有自己独立的 AGENTS.md/README.md，见仓库内 `skills/references/AGENTS.md`。

## 目录自动发现，不需要额外注册

Claude Code 自动发现本目录下每个含 `SKILL.md` 的子目录，**新增 skill 不需要额外注册**——包括 devflow/pdflow 及其阶段 skill（dev-define / dev-design / dev-plan / dev-build / dev-verify / dev-review / dev-land / dev-land / pd-research / pd-prd / pd-ix / pd-vd 等），Claude Code 原生的 skill description 已经承载路由信息，插件层不再维护一份独立的 workflow skill 白名单。

## 新增 / 修改 skill 的工序

1. **走 `平台原生 Skill 调用`**，不要跳过 baseline 直接手写 SKILL.md。核心是 TDD 流程：Phase 3 用 subagent（+ codex 跨模型）跑 pressure scenario，先看到失败，再写 SKILL.md 针对性修 —— "It's just a reference doc" / "太简单不用测" 都是跳过 baseline 的常见借口，不成立。
2. **SKILL.md frontmatter 只有 `name` + `description` 两个字段**，不加其它元数据键。`description` 只写触发条件（"Use when..." / "当用户说..."），**不写工作流摘要**——摘要会让 Claude 只看 description 就照做，跳过正文细节。与其它 skill 有职责重叠时，用 "Not for X（use Y）" / "不负责 X（走 Y）" 显式排他划界（例：`dev-design` description 结尾 "Not for writing code comments, README, or commit messages"）。
3. **Step 编号只能是整数（`Step 1`）或字母后缀（`Step 1a` / `6e`）**，禁止分数编号（`Step 0½`）——仓库 `CLAUDE.md` 规则 5。新步骤插入已有序列时优先用字母后缀，避免大范围重编号；只有确实需要连续重排时才整体重编号。
4. **workflow 类 skill**（Multi-step 顺序执行 + 排序/副作用敏感）SKILL.md 必须含：Step 0 workflow.plan.create（任务一次性建全）、每个 Step 的 Enter/Exit Gate、Global Exit Gate；Gate 必须客观可判（yes/no / 有无数字），不能是主观词。模板见 `skill-writing/writing-skills/workflow-skill-template.md`。
5. skill 自评/自审步骤（review / verify / check / validate 自己刚产出的东西）要挂评审方法论：多维度结构化评审调 `平台原生 Skill 调用`——传评审对象 + 本 skill 自己的领域维度（内联或指向自己的 `references/xxx-review.md`）+ 可选方法，引擎内部处理分档/选方法/升档/降级/findings 归一，不要在新 skill 里重造一遍"维度清单→自评→交叉→分级→收口"流程，也不要直接 `Read` reviewing 的内部文件（它已是自包含 skill，见规则 7）；轻量单点自检可以只走自审（不进框架）。
6. SKILL.md 超过 500 行时，把细节挪到 `<skill>/references/`（skill 私有参考目录，与共享的 `skills/references/` 是两回事，见下条）。若某段领域知识对 ≥2 个 skill 都有用，考虑放进共享的 `skills/references/`（走该目录自己的 AGENTS.md 流程）。
7. **Skill 是自闭环单元，除 Reference 外只能读 Skill**：SKILL.md 正文与私有 `references/` 只能引用其它 Skill（点名 handoff 或 `平台原生 Skill 调用` 调用）或参考材料（自己的 `references/`、共享的 `skills/references/`）；不得直接指路 `rules/rule-*.md`、`model/agent-*.md`、`hooks/`、非自身 `scripts/` 等插件内部实现文件（仓库 `CLAUDE.md` 规则 6）。引自己的 `references/` 用相对路径（`references/xxx.md`），不要写成 `{CLAUDE_PLUGIN_ROOT}/skills/<skill-name>/references/xxx.md`；一份材料已归属某个具体 skill 的领域（如 `reviewing`）时，其它 skill 要用只能点名 `平台原生 Skill 调用` 调用，不直接指路它的 `references/`——只有没有单一归属 skill 的材料才留在共享 `skills/references/` 直接引用。`/plugin-dream` 的 Layer 2 skill 对象检测会扫这一项。
8. **SKILL.md 给 agent，README.md 给人**：归属说明、变更历史、设计理由这类人类可读内容放该 skill 的 README.md，不要塞进 SKILL.md 污染 agent context。
9. 改完后：升级 `plugin/metadata.json` 的 `version`，运行 `node scripts/package.platform.mjs`（`skills/` 属于"被插件加载的文件"范围，CLAUDE.md 规则 2）——新增 skill/兼容性增强 → minor；纯 bug fix/文案修订 → patch；破坏性改名/语义反转 → major，与本次改动放同一个 commit。
10. commit 前如果改动涉及 vendor 来源 skill，先看下一条。

## vendor 来源 skill 禁手改

部分 skill 由上游 vendor 项目分发而来，分发规则记在各自的 `vendor-integration.json`（`vendor/superpowers/vendor-integration.json`、`vendor/everything-claude-code/vendor-integration.json`）：`keep-as-skill` 原样复制到 `skills/`、`extract-references` 抽取指定文件到顶层 `references/`（注意不是 `skills/references/`）、`absorb` 把上游内容一次性合并进现有文件后标 `done`、`fork` 本仓改造版留在 `skills/`（sync 只校验存在、永不从 vendor 覆盖，上游更新需人工 diff 合并）、`skip` 不同步。

当前 `keep-as-skill` 的 vendor 来源 skill：
- superpowers：`brainstorming`、`systematic-debugging`、`receiving-code-review`、`dispatching-parallel-agents`
- everything-claude-code：`eval-harness`、`continuous-learning-v2`、`strategic-compact`

当前 `fork` 的 vendor 来源 skill（本仓改造版，直接改 `skills/` 内容）：
- superpowers：`using-git-worktrees`（创建改走 `git worktree add -b`，进入走 `平台原生 agent/plan/decision 工具`）

`keep-as-skill` 的目录**不要手动改内容再指望保留**——上游更新后跑 `node scripts/vendor-sync.mjs` 会按规则重新分发/覆盖，手改内容会被覆盖丢失。小范围行为定制可以走 rule overlay；定制大到需要改 Skill 正文流程时，把该 Skill 的 action 升级为 `fork` 再改。`brainstorming` 与 `using-git-worktrees` 都是本地 fork，行为直接由各自 SKILL.md 定义。

commit 前跑 `node scripts/vendor-sync.mjs --check` 确认一致（不一致 exit 1），必要时跑不带 `--check` 的版本执行同步。规则详见仓库 `CLAUDE.md` 规则 4 和 `vendor/AGENTS.md`。

## 与 commands/、agents/ 的关系

- `commands/*.md` 是入口 Skill 的作者态单源。Claude/Codex adapter 都把它编译成 `skills/<name>/SKILL.md`，因此不要在源码 `skills/` 再维护同名副本。
- **`*hub` 聚合入口是载体无关的角色**：多数 hub 是 command（`nocodehub` / `personalhub` / `projecthub`），但 skill 也可承载（`larkhub` = `skills/larkhub/SKILL.md`）。skill 形态的 hub 同样遵守「只转发不写业务逻辑」约束，由 `/plugin-dream` 跨 command/skill 的 hub 检测统一覆盖（惯例权威定义见 `commands/AGENTS.md`）。选 skill 形态的动机通常是要挂 `references/` 等目录特性；否则 command 单文件更轻。
- agent 调度写在所属 Skill 的成对 platform block 中：Claude 使用原生 Agent/Task 工具，Codex 使用 `spawn_agent`/`wait_agent` 等原生协作工具；不再维护独立 profile/router。
