# CLAUDE.md

本仓库是 Claude Code / Codex 双平台插件 `nocode` 的源码。在此仓库工作时遵守以下约束。

> 与 `AGENTS.md` 同义（软链接），供其他遵循 AGENTS.md 约定的工具读取。

## 工作流约束

### 1. 完成任务后 commit，并询问是否 push

每次任务执行完毕后, 询问用户是否 commit：

- 复核 `git status` / `git diff`，创建 commit（message 参考 `git log` 历史风格）。
- **不要自动 push**——commit 后向用户明确询问是否需要 `git push`，由用户确认后再执行。

### 2. 修改插件后，升级版本号

只要改动了插件业务源码、平台适配器或运行时文件，就视为插件更新，必须更新版本：

- 范围：`hooks/`、`model/`、`rules/`、`skills/`、`agents/`、`commands/`、`core/`、`adapters/`、`scripts/` 中参与插件运行或生成的文件，以及 `.mcp.json` 等平台运行时配置。
- 操作：编辑版本单源 `plugin/metadata.json` 的 `version`，按 SemVer 升级，再运行 `node scripts/compile.platform.mjs` 生成两个平台发布物，并把源码、版本与生成物包含在同一个 commit 里：
  - **patch**：bug fix / 文案修订
  - **minor**：新增 hook / skill / 兼容性增强
  - **major**：破坏性变更（路径改名、规则语义反转等）
- `plugins/claude/nocode/` 与 `plugins/codex/nocode/` 是生成物，**禁止手改**；marketplace 直接从 git 读取它们，不需要 tarball/npm 打包。

纯文档/元数据修订（README、本文件、AGENTS.md 等）不需要升版本，但仍遵守规则 1。

### 3. rule 改动：每文件自带 frontmatter，两条独立生成链

`model/agent-rule-catalog-*.md`（catalog 分片）、`hooks/pretooluse-rules.json` 已是**生成物，禁手改**。没有 manifest.json 这层中转——两条链各自独立单源：

- **触发路由**（catalog 里的一行）：改对应 `rules/rule-<id>.md` 顶部 frontmatter（`name` / `description` / `skip`，新增规则则新建文件）→ 跑 `node scripts/compile.rule.js` 重新生成 `model/agent-rule-catalog-*.md`
- **PreToolUse 硬拦截**（Bash 命令级拦截，与上面那条完全独立）：改 `scripts/compile.hooks.js` 内硬编码的规则数组 → 跑 `node scripts/compile.hooks.js` 重新生成 `hooks/pretooluse-rules.json`
- 一致性由 SessionStart 的 `node scripts/compile.rule.js --check` + `node scripts/compile.hooks.js --check` 兜底报警（漂移只 warn 不阻断 session）；修改后还要运行 `node scripts/compile.platform.mjs` 同步双平台发布物
- 测试：`node --test 'hooks/*.test.mjs'`

### 4. vendor 同步（commit 前）

`vendor/superpowers/` 存放上游 superpowers plugin 原版，`vendor-integration.json` 定义每个 skill 的分发规则（keep-as-skill / extract-references / skip）。

commit 前跑一次确保一致：

```bash
node scripts/vendor-sync.mjs --check   # 检查是否一致，不一致 exit 1
node scripts/vendor-sync.mjs           # 执行同步（copy/extract/remove）
node scripts/compile.platform.mjs --check # 检查 Claude/Codex 发布物是否与源码一致
```

- 上游更新时：替换 `vendor/superpowers/` 内容 → 更新 `vendor-integration.json` 的 upstream 字段 → 跑 `vendor-sync.mjs`
- 新增/调整分发规则时：改 `vendor-integration.json` → 跑 `vendor-sync.mjs`
- **不要手动 cp/rm vendor skill 到 skills/ 或 references/**——走脚本，保持单源

### 5. Skill 内 Step 编号必须为整数或字母后缀

Skill 的 SKILL.md 里每个步骤的编号用整数（`Step 1` / `Step 2`）或字母后缀（`Step 1a` / `6e`）。禁止用分数编号（`Step 0½` / `6d½`）——分数编号在搜索、引用、排序时都不方便。

新增步骤插入已有序列时，调整后续编号保持连续；或使用字母后缀（`Step 8a`）避免大面积重编号。

### 6. Skill 是自闭环单元，除 Reference 外只能读 Skill

SKILL.md 正文与私有 `references/` 只允许引用两类东西：**其它 Skill**（点名 handoff 或 `Skill()` 调用）和**参考材料**（自己的 `<skill>/references/`，或共享的 `skills/references/`）。

不得直接指路 `rules/rule-*.md`、`model/agent-*.md`、`hooks/`、非自身的 `scripts/` 等插件内部实现文件——这些是 SessionStart / PreToolUse 自动注入的路由与护栏层，skill 运行时不需要、也不该显式指路。skill 若确有信息依赖这类文件（如某变量定义在 `model/agent-about.md`），把内容摘一份进自己的 `references/`，或改成向对应 skill 的 handoff，不要跨层直接引用。

引用自己 `references/` 里的文件一律用**相对路径**（`references/xxx.md`），不要写成 `{CLAUDE_PLUGIN_ROOT}/skills/<skill-name>/references/xxx.md` 这类绝对路径——相对路径不写死这个 skill 在插件里的位置，skill 目录整体搬家时内部引用一个字都不用改。

一份参考材料该放共享 `skills/references/` 还是某个 skill 自己的 `references/`，看**内容是否已归属某个具体 skill 的领域**（存在一个 skill 本身就是它的方法论/流程底座，例如 `reviewing`）：归属某个 skill → 放该 skill 自己的 `references/`，其它 skill 要用只能点名 `Skill(nocode:<name>)` 调用，不直接指路它的 `references/`（哪怕知道确切路径也不行）；真正跨领域、没有单一归属 skill 的材料才留在共享 `skills/references/`，用 `{NOCODE_SKILL_REF}/xxx.md` 直接引用。

### 7. Codex 插件升级后必须整体重启

执行 `codex plugin add nocode@nocode-market` 安装或升级插件后，正在运行的 Codex App / remote-control daemon 可能仍持有旧版插件注册表、Skill 根目录和 Hook 配置。仅新建对话或 Session 不保证完成重新加载。

- 先保存并结束当前工作，再整体重启 Codex App；使用 remote-control 时重启对应 daemon / app-server。
- 重启完成后新建 Session，确认 SessionStart、Skills 和 Hook 均来自新版本。
- 如果日志或错误仍引用 `~/.codex/plugins/cache/.../nocode/<旧版本>/`，说明运行进程尚未完成重载。
- 整体重启会断开当前连接，不要在尚有未保存工作时执行。
