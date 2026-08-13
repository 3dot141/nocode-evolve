# skills/references/ — 共享领域指南库

本目录是被 `{NOCODE_SKILL_REF}` 占位符引用的共享领域指南库，供多个 skill 按需 `Read`。**本目录不是 skill**——没有 SKILL.md，不会被 Claude Code 自动发现/加载，只能被其它 skill/agent/command 显式 `Read` 引入。

## `{NOCODE_SKILL_REF}` 占位符怎么生效

- SessionStart 时 `hooks/inject-nocode.sh` 把本目录的绝对路径写入 `NOCODE_SKILL_REF` 环境变量（默认值 `${CLAUDE_PLUGIN_ROOT}/skills/references`，可被外部环境覆盖），随后在往 context 注入各 skill/agent/command 正文时，把文本里字面出现的 `${NOCODE_SKILL_REF}` 占位符替换成这个实际路径（`hooks/inject-nocode.sh` 内两处：一处写变量本身，一处做占位符替换）。
- 所以 skill 正文里引用本目录文件一律写 **`` `{NOCODE_SKILL_REF}/xxx.md` `` **（花括号占位符语法），不要写死绝对路径，也不要写相对路径（skill 目录和本目录不一定有固定相对位置关系）。

## 改动前先找引用方

本目录任何一个文件被改动，影响面通常覆盖多个 skill/agent/command——**改前用 `rg` 找出所有引用方**，逐一确认改动不破坏对方的用法：

```bash
rg -l "NOCODE_SKILL_REF.*<文件名或子路径>" skills/ agents/ commands/ model/
```

已知会读本目录的至少有：`dev-design`、`dev-plan`、`dev-build`、`dev-review`、`dev-verify`、`pd-prd`、`pd-vd`、`brainstorming`、`red-blue-deep`、`skill-writing`、`nocodehub` 等 skill，以及 `model/agent-about.md`。

**`reviewing` 和专项 review 材料不属于本目录**：`reviewing` 是自包含 review 引擎，调用方使用平台原生 Skill 调用，不直接读取其私有 references。`dev-design`、`pd-prd`、`pd-vd` 的专项材料同样归各自 Skill 私有目录。

## 是否 vendor 管理

- 本目录**不是** `scripts/vendor-sync.mjs` 的 `extract-references` 落点——vendor 抽取出的独立参考文件（`plan-document-reviewer-prompt.md` / `testing-anti-patterns.md` / `code-reviewer-prompt.md` 等，供 subagent prompt 使用）落在仓库**顶层** `references/`，与 `skills/references/` 是两个不同目录，改动本目录文件前先确认没搞混路径。
- 但本目录**部分文件的内容**历史上由 `vendor/everything-claude-code/vendor-integration.json` 的 `absorb` 动作一次性合并进来过（如 `security-guide.md` 的 CSRF 章节、`architecture-principles.md` 的 code smell 判据、`frontend-guide.md` 的 React 模式、`api-design-guide.md` 的分层架构、`testing-guide.md` 的 mock 策略对比）。这些条目在对应 `vendor-integration.json` 里标 `"done": true`，是**一次性历史合并**，不是持续同步关系——可以正常继续编辑这些文件，不需要跑 `vendor-sync.mjs`，也不会被下次同步覆盖。
- 不确定某段内容的来源时，`rg <关键词> vendor/*/vendor-integration.json` 能查到是否有对应 `absorb` 记录。

## 新增指南文件

- 只有被 **≥2 个 skill** 共用的领域知识才放这里；单个 skill 专属的细节放该 skill 自己的 `<skill>/references/`（skill 私有目录，与本目录同名但是两回事）。
- 新文件遵循已有开头惯例：`# 标题` + 一行「共享 reference，多 skill 按需 Read。」定位说明，再进入正文。
- 写完后必须去消费方 skill 的 SKILL.md 里加 `Read {NOCODE_SKILL_REF}/<new-file>.md` 引用点——本目录文件不会被自动发现，没有引用点等于文件不存在。
- 改动本目录文件属于"改动被插件加载的文件"，按仓库 `CLAUDE.md` 规则 2 需要同步升级 `plugin/metadata.json` 的 version，并运行 `node scripts/package.platform.mjs`。
