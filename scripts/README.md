# scripts/

nocode 插件的可执行脚本层。以 `.mjs`（ESM，`node --test` 原生测试）为主，另有 `context-bar.sh`
（终端 statusline）和 `prototype-verify.mjs` 委托的 `_prototype-verify-impl.py`（Playwright 原型
验证）。服务对象：SessionStart hook、PreToolUse 规则、`/nocodehub dream` `/personalhub tidy`
`/projecthub dream` `/personalhub check` 等入口的机械检测与安全 git 操作。

## 脚本清单

| 脚本 | 用途 | 调用方 | 测试文件 |
|---|---|---|---|
| `compile.rule.js` | 单源生成器：glob `rules/rule-*.md` 的 frontmatter（`name`/`description`/`skip`）→ 编译扁平版 `model/agent-rule-catalog-N.md` | `hooks/inject-nocode.sh`（SessionStart `--check`）、`skills/nocodehub/references/write.md`、`skills/nocodehub/references/dream.md` | `hooks/compile.rule.test.mjs` |
| `compile.hooks.js` | 独立生成器：规则硬编码在脚本内 → 编译 `hooks/pretooluse-rules.json`，与 `compile.rule.js` 那条链完全独立 | `hooks/inject-nocode.sh`（SessionStart `--check`）、`skills/nocodehub/references/dream.md` | `hooks/compile.hooks.test.mjs` |
| `package.platform.mjs` | 合并共享源码、Markdown platform block 与 runtime overlay，确定性生成 Claude/Codex 发布树 | release gate | `hooks/compile.platform.test.mjs`、`hooks/platform-contract.test.mjs` |
| `vendor-sync.mjs` | 按 `vendor-integration.json` 把 vendor 内容同步到 `skills/`/`agents/`/`commands/`/`references/`（copy/extract/absorb/skip 四种分发规则） | CLAUDE.md（commit 前）、`skills/nocodehub/references/status.md`、`skills/nocodehub/references/dream.md` | 无专属单测，`--check` 自检 |
| `check-skills.mjs` | 静态检查 Skill 路由、reference、frontmatter、平台语法与 Codex metadata budget | release gate | `hooks/check-skills.test.mjs` |
| `freshness-check.mjs` | 检查当前分支与 base（`nocode-base` config → upstream → `origin/HEAD` → `origin/main`）的 behind/ahead，供 `rule-git-freshness` gate | `hooks/pretooluse-rules.json`、`rules/rule-git-freshness.md`、`model/agent-about.md` | 无专属单测 |
| `plugin-dream-baseline.mjs` | `/nocodehub dream` 的增量 baseline 判断（git config 按分支隔离存储上次巡检点） | `skills/nocodehub/references/dream.md` | `hooks/plugin-dream-baseline.test.mjs` |
| `dream-baseline.mjs` | 通用 git baseline diff 库，供 `/personalhub tidy` 与 projecthub 私有运行时门面共用 | `skills/personalhub/references/tidy.md`、`skills/projecthub/scripts/dream-baseline.mjs` | `hooks/dream-baseline.test.mjs` |
| `worktree-setup.mjs` | worktree 创建后补齐（env/IDE 配置/node_modules symlink）、销毁前清理 | `rules/rule-git-worktree.md`、`skills/agents-launcher/`、`skills/devflow/` | `worktree-setup.test.mjs`（同目录） |
| `git-exec.mjs` | 共享安全 git 子进程调用（`execFileSync` 参数数组，防 shell 注入） | 供其他脚本 `import`，非直接调用 | `hooks/git-exec.test.mjs` |
| `personal-lint.mjs` | 扫描所有装了插件的项目，检查 `.agents-personal/AGENTS.md` 变量名是否与插件当前定义匹配 | `skills/personalhub/references/check.md`（也被 distill 与 write/tidy/status actions 间接调用） | 无专属单测 |
| `personal-migrate.mjs` | 旧外部 bare repo → `.agents-personal/` 内嵌 git 仓库的显式迁移 runner（幂等） | 仅手动 CLI；SessionStart 不读取或迁移旧历史 | `hooks/personal-migrate.test.mjs` |
| `personal-snapshot.mjs` | SessionStart 自动给 `.agents-personal/` 打快照 commit | `hooks/hooks.json`（SessionStart）、`scripts/wiki-read.mjs`、`skills/personalhub/references/tidy.md`、`skills/personalhub/references/snap.md` | `hooks/personal-snapshot.test.mjs` |
| `prototype-verify.mjs` | Playwright 原型验证（全页截图 + 交互脚本），委托 `_prototype-verify-impl.py` | `skills/pd-vd/`、`skills/dev-verify/` | 无自动化单测（需 `python3` + `playwright`） |
| `_prototype-verify-impl.py` | `prototype-verify.mjs` 的 Python 实现细节（`playwright.sync_api`） | 仅被 `prototype-verify.mjs` 调用 | 无 |
| `repo-lock.mjs` | `.agents-personal/` 嵌套仓库的并发写保护（原子锁文件 + PID/mtime 双重 staleness 判定） | 供 `dream-baseline`/`personal-migrate`/`personal-snapshot`/`wiki-read` `import` | `hooks/repo-lock.test.mjs` |
| `wiki-read.mjs` | 显式读取 Wiki page 并在成功后原子更新 usage；直接文件读取不计数 | commands / personal knowledge Skills | `hooks/wiki-read.test.mjs` |
| `session-state.mjs` / `handoff-state.mjs` | session 隔离与 handoff 状态实现 | SessionStart、显式 handoff 操作 | 对应 `hooks/*state.test.mjs` |
| `context-bar.sh` | 终端 statusline 渲染（模型名/目录/git 状态/context 用量条），独立于插件自动化链路 | 用户手动配置到 `~/.claude/settings.json` 的 `statusLine.command` | 无 |
| `codex-companion.mjs` | legacy symlink → `../vendor/codex/scripts/codex-companion.mjs` | 已由平台原生 review 流程取代，不进入默认发布物 | 见 `vendor/codex/UPGRADE.md` |

> 单测大多落在 `hooks/*.test.mjs`（历史原因，早于 `scripts/` 目录独立出来），只有
> `worktree-setup.mjs` 的测试留在同目录。改脚本前看 `AGENTS.md` 的调用关系表，避免漏改调用方。

## 常用命令

```bash
# rule catalog / PreToolUse 规则两条独立编译链
node scripts/compile.rule.js --check
node scripts/compile.rule.js
node scripts/compile.hooks.js --check
node scripts/compile.hooks.js

# 跑本目录脚本相关的全部单测（hooks/ + scripts/ 两处）
node --test hooks/*.test.mjs scripts/*.test.mjs

# 单独跑某个脚本的测试
node --test hooks/git-exec.test.mjs

# vendor 同步检查（commit 前）
node scripts/vendor-sync.mjs --check
node scripts/vendor-sync.mjs

# skill 路由/断链/污染检查（折叠前护栏 + commit 前 lint）
node scripts/check-skills.mjs --root . --platform source

# 分支新鲜度检查
node scripts/freshness-check.mjs --max-behind=5 --ttl=7200

# plugin-dream 增量 baseline（查看 / 推进到当前 HEAD）
node scripts/plugin-dream-baseline.mjs "$CLAUDE_PLUGIN_ROOT"
node scripts/plugin-dream-baseline.mjs --set "$CLAUDE_PLUGIN_ROOT"

# projecthub dream 目标目录的 git 检测
node skills/projecthub/scripts/project-tree-detect.mjs detect <dir-path>
node skills/projecthub/scripts/project-tree-detect.mjs find-root <dir-path>

# .agents-personal/ 变量健康检查
node scripts/personal-lint.mjs --json

# 原型验证（需 pip install playwright）
node scripts/prototype-verify.mjs <prototype-dir>
node scripts/prototype-verify.mjs <prototype-dir> --interactions interactions.json
```

## 目录内约定

- 全部 `.mjs` 用 ESM，CLI 入口与 library 用法（`import { fn } from './x.mjs'`）共存于同一文件，
  靠 `process.argv[1] === fileURLToPath(import.meta.url)` 区分。
- git 子进程调用统一走 `git-exec.mjs`（`execFileSync` 参数数组，不拼 shell 字符串）——历史上手写
  字符串拼接在 `plugin-dream-baseline.mjs`（分支名注入）和 `personal-snapshot.mjs`（路径含空格
  失败）上出过真实事故，现已收敛为单一实现。`freshness-check.mjs` 是唯一还留着独立 `execSync`
  helper 的脚本（早于 `git-exec.mjs` 引入）。
- 详细的"改动前必须做什么"（调用关系摸排、对应测试、版本号、vendor 同步）见同目录 `AGENTS.md`。
