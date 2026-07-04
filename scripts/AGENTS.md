# scripts/ — Agent 工作指令

本目录是 nocode 插件的可执行脚本层：被 `hooks/`、`rules/`、`commands/`、`skills/` 通过
`node "${CLAUDE_PLUGIN_ROOT}/scripts/xxx.mjs"`（CLI）或 `import()`（library）两种方式消费。
改动前务必确认调用方不会因签名变化而破坏——很多脚本是多个 command/rule 共用的底层库，
改坏一个函数签名可能同时炸掉 `/personal-dream`、`/project-dream`、`/plugin-dream` 三条线。

## 调用关系（改前必读）

| 脚本 | 调用方 | 调用方式 |
|---|---|---|
| `compile.rule.js` | `hooks/inject-nocode.sh`（SessionStart `--check`）、`commands/plugin-distill.md`（新增/融合 rule 后重新生成）、`commands/plugin-dream.md`（Layer1 客观漂移） | CLI |
| `compile.hooks.js` | `hooks/inject-nocode.sh`（SessionStart `--check`）、`commands/plugin-dream.md`（Layer1 客观漂移）；与 `compile.rule.js` 互不依赖，独立编译 `hooks/pretooluse-rules.json` | CLI |
| `vendor-sync.mjs` | CLAUDE.md（commit 前工作流）、`commands/nocodehub.md`、`commands/plugin-dream.md`（Layer1 客观漂移） | CLI |
| `freshness-check.mjs` | `hooks/pretooluse-rules.json`、`rules/rule-git-freshness.md`、`model/agent-about.md` + `agent-rule-catalog-1/2.md`、`rules/rule-git-worktree.md`（写入 git config 供其读取）、`skills/dev-finish-branch` | CLI |
| `plugin-dream-baseline.mjs` | `commands/plugin-dream.md`（Layer0 判范围 + Layer2 `--set` 推进 baseline） | CLI；内部 import `git-exec.mjs` |
| `dream-baseline.mjs` | `commands/personal-dream.md`、`commands/project-dream.md` | 动态 `import()`；内部依赖 `repo-lock.mjs` + `git-exec.mjs` |
| `project-tree-detect.mjs` | `commands/project-dream.md` | CLI（`detect` / `find-root` / `ref-name` 三子命令） |
| `worktree-setup.mjs` | `rules/rule-git-worktree.md`（setup/teardown）、`skills/agents-launcher/SKILL.md`、`skills/devflow/SKILL.md` | CLI |
| `git-exec.mjs` | `plugin-dream-baseline.mjs` / `dream-baseline.mjs` / `personal-migrate.mjs` / `personal-snapshot.mjs`（内部 import，共享 git 子进程执行） | library only，不建议直接当 CLI 跑 |
| `personal-lint.mjs` | `commands/personal-lint.md`；`commands/distill.md` / `commands/personal-distill.md` / `commands/personal-dream.md` / `commands/personalhub.md` 均通过 `Skill(nocode:personal-lint)` 间接触发 | CLI + Skill 包装 |
| `personal-migrate.mjs` | `personal-snapshot.mjs` 内部 `ensureNestedRepo()` 自动调用；无 command 直调，CLI 仅供手动 demo | library（内部）+ CLI（手动） |
| `personal-snapshot.mjs` | `hooks/hooks.json`（SessionStart 每次自动跑）、`hooks/usage-tracker.mjs`（import `resolvePersonalDir`）、`commands/personal-dream.md`、`commands/personalhub.md` | hook 自动 + CLI + library |
| `prototype-verify.mjs` | `skills/pd-vd/SKILL.md` + `references/*`、`skills/dev-verify/SKILL.md` | CLI，委托 `_prototype-verify-impl.py`（需 python3 + playwright） |
| `repo-lock.mjs` | `dream-baseline.mjs` / `personal-migrate.mjs` / `personal-snapshot.mjs` / `hooks/usage-tracker.mjs`（内部 import） | library only |
| `context-bar.sh` | 不在插件自动化链路内——`hooks/hooks.json` 没有 statusLine 挂载点；供用户手动配置到个人 `~/.claude/settings.json` 的 `statusLine.command` | 独立脚本 |
| `codex-companion.mjs` | symlink → `../vendor/codex/scripts/codex-companion.mjs`；实际调用方（`rules/rule-codex-review.md`、`skills/references/reviewing/`）都直接写 vendor 完整路径，**不经过这个 symlink** | 仓内未见直接引用，改动前先确认 vendor 同步状态 |

被两个以上调用方共用的脚本（`git-exec.mjs` / `repo-lock.mjs` / `dream-baseline.mjs` / `personal-snapshot.mjs`）
是高风险改动点——改导出函数签名前用 `grep -rn "scripts/<name>.mjs"` 摸清全部调用方（含 `hooks/*.test.mjs`
和各 `commands/*.md` 里的动态 `import()`），缺一个都可能导致其他 hook/command 运行时失败。SessionStart hook
（`personal-snapshot.mjs`）失败是静默的，不会立刻在对话里暴露，改完务必手动验证。

## 改动前后必做

### 1. 跑对应测试

单测大多落在 `hooks/*.test.mjs`（历史原因，早于 `scripts/` 目录独立出来），只有
`worktree-setup.mjs` 的测试留在同目录 `worktree-setup.test.mjs`：

| 脚本 | 测试文件 | 命令 |
|---|---|---|
| `compile.rule.js` | `hooks/compile.rule.test.mjs` | `node --test hooks/compile.rule.test.mjs` |
| `compile.hooks.js` | `hooks/compile.hooks.test.mjs` | `node --test hooks/compile.hooks.test.mjs` |
| `git-exec.mjs` | `hooks/git-exec.test.mjs` | `node --test hooks/git-exec.test.mjs` |
| `repo-lock.mjs` | `hooks/repo-lock.test.mjs` | `node --test hooks/repo-lock.test.mjs` |
| `dream-baseline.mjs` | `hooks/dream-baseline.test.mjs` | `node --test hooks/dream-baseline.test.mjs` |
| `plugin-dream-baseline.mjs` | `hooks/plugin-dream-baseline.test.mjs` | `node --test hooks/plugin-dream-baseline.test.mjs` |
| `project-tree-detect.mjs` | `hooks/project-tree-detect.test.mjs` | `node --test hooks/project-tree-detect.test.mjs` |
| `personal-migrate.mjs` | `hooks/personal-migrate.test.mjs` | `node --test hooks/personal-migrate.test.mjs` |
| `personal-snapshot.mjs` | `hooks/personal-snapshot.test.mjs` | `node --test hooks/personal-snapshot.test.mjs` |
| `worktree-setup.mjs` | `scripts/worktree-setup.test.mjs` | `node --test scripts/worktree-setup.test.mjs` |
| `vendor-sync.mjs` | 无专属单测，自带 `--check` 自检 | `node scripts/vendor-sync.mjs --check` |
| `freshness-check.mjs` / `personal-lint.mjs` / `prototype-verify.mjs` / `context-bar.sh` | 无自动化测试 | 人工验证 |

全量跑一次（覆盖 `scripts/` 相关的所有 hooks 单测 + 本目录单测）：

```bash
node --test hooks/*.test.mjs scripts/*.test.mjs
```

### 2. 改了脚本行为，同样要升插件版本

`scripts/` 本身不在 CLAUDE.md 规则 2 显式列出的目录清单里（`hooks/`、`model/`、`rules/`、
`skills/`、`agents/`、`commands/`、`.claude-plugin/`、`.mcp.json`），但这里的脚本是那些目录的
**运行时依赖**：`personal-snapshot.mjs` 直接被 SessionStart hook 调用，其余脚本被 `rules/`、
`commands/`、`skills/` 里的指令文本以命令行 / `import()` 形式内嵌引用。改了脚本的实际行为，
效果等同于改了引用它的插件文件——同样要按 CLAUDE.md 规则 2 升级 `.claude-plugin/plugin.json`
的 `version`（patch/minor/major 判断标准不变），并把版本变更放进同一个 commit。

`context-bar.sh` 例外：它不在插件自动化链路内（见上表），改动不受此约束，但仍要遵守规则 1
（commit + 询问是否 push）。

### 3. 涉及 vendor 的改动，commit 前跑 vendor-sync

如果改动涉及 `vendor/` 或 `vendor-integration.json`，按 CLAUDE.md 规则 4：

```bash
node scripts/vendor-sync.mjs --check   # 检查是否一致，不一致 exit 1
node scripts/vendor-sync.mjs           # 执行同步（copy/extract/absorb/skip）
```

不要手动 cp/rm vendor 内容到 `skills/`/`agents/`/`references/`——走脚本，保持单源。

## 安全约定：git 子进程调用禁止手拼 shell 字符串

`git-exec.mjs` 是本目录**唯一**允许拼装 git 命令行参数的地方，导出 `git()` / `gitQuiet()` /
`gitArgs()` / `parsePorcelain()` 四个函数，内部统一用 `execFileSync('git', [...args])`——参数以
数组形式传递，不经过 shell，分支名/路径/commit sha 无论含什么字符（空格、`$()`、反引号、分号）
都只是一个 argv 元素，不会被 shell 解释，天然不需要任何转义逻辑。

**新脚本需要跑 git 子命令时，必须 `import { git, gitQuiet, parsePorcelain } from './git-exec.mjs'`
复用，禁止自己写 `execSync(\`git ${cmd}\`)` 或手工字符串拼接/转义。**

这不是风格偏好，是有真实事故的（见 `git-exec.mjs` 文件头注释）：

- `plugin-dream-baseline.mjs` 曾用字符串拼接 `` `branch.${branch}...` `` 塞进 `execSync`，精心
  构造的分支名（如 `` pwn;touch${IFS}/tmp/x ``）可触发任意命令执行（已用 PoC 复现，现已改用
  `git-exec.mjs`）。
- `personal-snapshot.mjs` 曾对 `--git-dir=` / `--work-tree=` 完全不加引号，项目路径含空格时
  100% 失败（已复现修复）。

例外：`freshness-check.mjs` 内部仍保留一份独立的 `` execSync(`git ${cmd}`) `` helper（早于
`git-exec.mjs` 引入，未回填统一）。读它/改它时留意这个历史差异——新增逻辑优先考虑迁移到
`git-exec.mjs`，而不是继续在旧 helper 上叠加新的拼接代码。

## 其他约定

- 全部 `.mjs` 用 ESM（`import`/`export`），CLI 入口靠
  `process.argv[1] === fileURLToPath(import.meta.url)`（或等价写法）与 library 用法
  （`import { fn } from './x.mjs'`）共存于同一文件。改动时两条路径都要过一遍，不要只测 CLI
  忘了 library 消费方（反之亦然）。
- `_prototype-verify-impl.py` 只被 `prototype-verify.mjs` 用
  `execFileSync('python3', [...])` 调用，不要单独跑或单独改语义——改了要同步
  `prototype-verify.mjs` 的参数透传（`--interactions` / `--out` / `--viewport`）。
- `worktree-setup.mjs` 内部分层：计划层（`plan*`/`parse*`/`detect*`，只读 fs，单测覆盖）与执行层
  （`run`/`copyWithFallback`/`setup`/`teardown`，有副作用，`execFileSync` 跑 cp/ln/git）分离。新增
  逻辑要遵守这个分层，不确定的场景写进 `needsAttention[]` 交给 agent 判断，不要在脚本里做不可逆决定。
