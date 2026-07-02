# scripts/

nocode 插件的可执行脚本层。以 `.mjs`（ESM，`node --test` 原生测试）为主，另有 `context-bar.sh`
（终端 statusline）和 `prototype-verify.mjs` 委托的 `_prototype-verify-impl.py`（Playwright 原型
验证）。服务对象：SessionStart hook、PreToolUse 规则、`/plugin-dream` `/personal-dream`
`/project-dream` `/personal-lint` 等命令的机械检测与安全 git 操作。

## 脚本清单

| 脚本 | 用途 | 调用方 | 测试文件 |
|---|---|---|---|
| `vendor-sync.mjs` | 按 `vendor-integration.json` 把 vendor 内容同步到 `skills/`/`agents/`/`commands/`/`references/`（copy/extract/absorb/skip 四种分发规则） | CLAUDE.md（commit 前）、`commands/nocodehub.md`、`commands/plugin-dream.md` | 无专属单测，`--check` 自检 |
| `freshness-check.mjs` | 检查当前分支与 base（`nocode-base` config → upstream → `origin/HEAD` → `origin/main`）的 behind/ahead，供 `rule-git-freshness` gate | `hooks/pretooluse-rules.json`、`rules/rule-git-freshness.md`、`model/agent-about.md` | 无专属单测 |
| `plugin-dream-baseline.mjs` | `/plugin-dream` 的增量 baseline 判断（git config 按分支隔离存储上次巡检点） | `commands/plugin-dream.md` | `hooks/plugin-dream-baseline.test.mjs` |
| `dream-baseline.mjs` | 通用 git baseline diff 库，供 `/personal-dream` `/project-dream` 共用 | `commands/personal-dream.md`、`commands/project-dream.md` | `hooks/dream-baseline.test.mjs` |
| `project-tree-detect.mjs` | `/project-dream` 目标目录树的 git 检测 + baseline ref 命名 | `commands/project-dream.md` | `hooks/project-tree-detect.test.mjs` |
| `worktree-setup.mjs` | worktree 创建后补齐（env/IDE 配置/node_modules symlink）、销毁前清理 | `rules/rule-git-worktree.md`、`skills/agents-launcher/`、`skills/devflow/` | `worktree-setup.test.mjs`（同目录） |
| `git-exec.mjs` | 共享安全 git 子进程调用（`execFileSync` 参数数组，防 shell 注入） | 供其他脚本 `import`，非直接调用 | `hooks/git-exec.test.mjs` |
| `personal-lint.mjs` | 扫描所有装了插件的项目，检查 `.agents-personal/AGENTS.md` 变量名是否与插件当前定义匹配 | `commands/personal-lint.md`（也被 distill/personal-dream/personalhub 通过 `Skill(nocode:personal-lint)` 间接调用） | 无专属单测 |
| `personal-migrate.mjs` | 旧外部 bare repo → `.agents-personal/` 内嵌 git 仓库的迁移 runner（幂等） | `personal-snapshot.mjs` 内部自动调用；CLI 仅供手动 demo | `hooks/personal-migrate.test.mjs` |
| `personal-snapshot.mjs` | SessionStart 自动给 `.agents-personal/` 打快照 commit | `hooks/hooks.json`（SessionStart）、`hooks/usage-tracker.mjs`、`commands/personal-dream.md`、`commands/personalhub.md` | `hooks/personal-snapshot.test.mjs` |
| `prototype-verify.mjs` | Playwright 原型验证（全页截图 + 交互脚本），委托 `_prototype-verify-impl.py` | `skills/pd-vd/`、`skills/dev-verify/` | 无自动化单测（需 `python3` + `playwright`） |
| `_prototype-verify-impl.py` | `prototype-verify.mjs` 的 Python 实现细节（`playwright.sync_api`） | 仅被 `prototype-verify.mjs` 调用 | 无 |
| `repo-lock.mjs` | `.agents-personal/` 嵌套仓库的并发写保护（原子锁文件 + PID/mtime 双重 staleness 判定） | 供 `dream-baseline`/`personal-migrate`/`personal-snapshot`/`usage-tracker` `import` | `hooks/repo-lock.test.mjs` |
| `context-bar.sh` | 终端 statusline 渲染（模型名/目录/git 状态/context 用量条），独立于插件自动化链路 | 用户手动配置到 `~/.claude/settings.json` 的 `statusLine.command` | 无 |
| `codex-companion.mjs` | symlink → `../vendor/codex/scripts/codex-companion.mjs`，codex 跨模型 review companion | 实际调用方（`rule-codex-review.md` 等）直接写 vendor 完整路径，不经过此 symlink | 见 `vendor/codex/` |

> 单测大多落在 `hooks/*.test.mjs`（历史原因，早于 `scripts/` 目录独立出来），只有
> `worktree-setup.mjs` 的测试留在同目录。改脚本前看 `AGENTS.md` 的调用关系表，避免漏改调用方。

## 常用命令

```bash
# 跑本目录脚本相关的全部单测（hooks/ + scripts/ 两处）
node --test hooks/*.test.mjs scripts/*.test.mjs

# 单独跑某个脚本的测试
node --test hooks/git-exec.test.mjs

# vendor 同步检查（commit 前）
node scripts/vendor-sync.mjs --check
node scripts/vendor-sync.mjs

# 分支新鲜度检查
node scripts/freshness-check.mjs --max-behind=5 --ttl=7200

# plugin-dream 增量 baseline（查看 / 推进到当前 HEAD）
node scripts/plugin-dream-baseline.mjs "$CLAUDE_PLUGIN_ROOT"
node scripts/plugin-dream-baseline.mjs --set "$CLAUDE_PLUGIN_ROOT"

# project-dream 目标目录的 git 检测
node scripts/project-tree-detect.mjs detect <dir-path>
node scripts/project-tree-detect.mjs find-root <dir-path>

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
