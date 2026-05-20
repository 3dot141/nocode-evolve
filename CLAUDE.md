# CLAUDE.md

本仓库是 Claude Code 插件 `nocode-evolve` 的源码。在此仓库工作时遵守以下约束。

> 与 `AGENTS.md` 同义（软链接），供其他遵循 AGENTS.md 约定的工具读取。

## 工作流约束

### 1. 完成任务后 commit，并询问是否 push

每次任务执行完毕后：

- 复核 `git status` / `git diff`，创建 commit（message 参考 `git log` 历史风格）。
- **不要自动 push**——commit 后向用户明确询问是否需要 `git push`，由用户确认后再执行。

### 2. 修改插件后，升级版本号

只要改动了被插件加载的文件，就视为插件更新，必须更新版本：

- 范围：`hooks/`、`model/`、`rules/`、`skills/`、`agents/`、`commands/`、`.claude-plugin/`、`.mcp.json` 等会被 Claude Code 作为插件读取的文件。
- 操作：编辑 `.claude-plugin/plugin.json` 的 `version`，按 SemVer 升级，并把版本变更包含在同一个 commit 里：
  - **patch**：bug fix / 文案修订
  - **minor**：新增 hook / skill / 兼容性增强
  - **major**：破坏性变更（路径改名、规则语义反转等）
- 仓库本身就是分发物（marketplace 直接读 git），不需要额外的"打包"产物。

纯文档/元数据修订（README、本文件、AGENTS.md 等）不需要升版本，但仍遵守规则 1。
