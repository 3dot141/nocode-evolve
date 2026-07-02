# CLAUDE.md

本仓库是 Claude Code 插件 `nocode` 的源码。在此仓库工作时遵守以下约束。

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

### 3. rule 改动走 manifest 单源

`model/agent-catalog-*.md`（catalog 分片）、`hooks/pretooluse-rules.json` 已是**生成物，禁手改**。增删改 rule：

- 改 `rules/manifest.json`（唯一真值源：buckets + rules，每条 rule 含 bucket / triggers / summary / guard / pretooluse）
- 跑 `node hooks/generate.mjs` 重新生成生成物（catalog 分片 + pretooluse-rules）
- 一致性由 SessionStart 的 `node hooks/generate.mjs --check` 兜底报警（漂移只 warn 不阻断 session）
- 测试：`node --test 'hooks/*.test.mjs'`

### 4. vendor 同步（commit 前）

`vendor/superpowers/` 存放上游 superpowers plugin 原版，`vendor-integration.json` 定义每个 skill 的分发规则（keep-as-skill / extract-references / skip）。

commit 前跑一次确保一致：

```bash
node scripts/vendor-sync.mjs --check   # 检查是否一致，不一致 exit 1
node scripts/vendor-sync.mjs           # 执行同步（copy/extract/remove）
```

- 上游更新时：替换 `vendor/superpowers/` 内容 → 更新 `vendor-integration.json` 的 upstream 字段 → 跑 `vendor-sync.mjs`
- 新增/调整分发规则时：改 `vendor-integration.json` → 跑 `vendor-sync.mjs`
- **不要手动 cp/rm vendor skill 到 skills/ 或 references/**——走脚本，保持单源

### 5. Skill 内 Step 编号必须为整数或字母后缀

Skill 的 SKILL.md 里每个步骤的编号用整数（`Step 1` / `Step 2`）或字母后缀（`Step 1a` / `6e`）。禁止用分数编号（`Step 0½` / `6d½`）——分数编号在搜索、引用、排序时都不方便。

新增步骤插入已有序列时，调整后续编号保持连续；或使用字母后缀（`Step 8a`）避免大面积重编号。
