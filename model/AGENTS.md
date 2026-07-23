# model/ — SessionStart 常驻注入源文件

本目录内容通过 `hooks/inject-nocode.sh` 在每次会话开局注入 additionalContext，是插件"规则知识 (reactive)"层的落地位置。在此目录改动前，先确认改的是手工文件还是生成物——两者的改动流程完全不同。

## 文件分类——先看这张表，再动手

| 文件 | 性质 | 谁能改 |
|---|---|---|
| `agent-about.md` | 手工维护 | 直接 Edit |
| `agent-personal.md` | 手工维护 | 直接 Edit |
| `agent-karpathy.md` | 手工维护 | 直接 Edit |
| `agent-rule-catalog-1.md` / `agent-rule-catalog-2.md` / …`-5.md` | **生成物，禁手改** | 改对应 `rules/rule-*.md` 的 frontmatter → 跑 `node scripts/compile.rule.js` |

> 曾经的 `agent-catalog-using.md`（Skill 调用纪律 + Step 0 触发协议）已在 260704 内容精简中删除，对应 `model-catalog-using` segment 也已从 `hooks.json`/`inject-nocode.sh` 移除。它是本目录曾经唯一容易踩坑的命名——名字里有 "catalog"，容易被当成路由分片之一，但它讲的是纯手写文档，后缀 `-using` 不匹配 `agent-(rule-)?catalog(-\d+)?\.md` 这条生成物正则，永远不会被脚本生成或清理。以后新增手工文件避免蹭 `agent-catalog` 前缀，减少这种混淆。

反过来，`agent-rule-catalog-1.md`、`agent-rule-catalog-2.md`（以及未来可能出现的 `-3/-4/-5`）是各 `rules/rule-*.md` frontmatter 经 `node scripts/compile.rule.js` 渲染出来的路由分片，文件头部都带"本文件由脚本生成，禁手改"的标记。**任何时候不要直接 Edit 这些文件**——下次跑 compile（或 SessionStart 的 `--check` 漂移告警提示后手动跑）会覆盖你的手改，改动无声丢失。

## 改手工文件（about / personal / karpathy）

1. 直接 Edit 目标文件。
2. 改完必须升级 `plugin/metadata.json` 的 `version` 并运行 `node scripts/package.platform.mjs`——`model/` 整个目录都在平台发布物的 SessionStart 加载范围内，任何改动都算插件更新（仓库根 `CLAUDE.md` 规则 2，按 SemVer：patch=文案修订，minor=新增行为条款，major=语义反转）。纯文档修订除外。
3. 完成后 `git status` / `git diff` 复核，创建 commit（不要自动 push，commit 后问用户是否需要 push）。

## 改路由规则（agent-rule-catalog-N.md 数字分片）

**禁止直接 Edit 这些文件。** 正确流程：

1. 改对应 `rules/rule-<id>.md` 顶部的 frontmatter（`name` / `description` / `skip`，新增规则则新建文件）——**没有 manifest.json**，每个文件自带唯一真值。
2. 跑 `node scripts/compile.rule.js` 重新生成 `model/agent-rule-catalog-N.md` 分片。
   - 若同时改了 PreToolUse 硬拦截 pattern：那是完全独立的另一条链，改 `scripts/compile.hooks.js` 内硬编码的规则数组，跑 `node scripts/compile.hooks.js` 重新生成 `hooks/pretooluse-rules.json`。两条链不共享任何源文件。
3. 跑 `node --test 'hooks/*.test.mjs'` 验证。
4. 同一 commit 里升级 `plugin.json` 的 version（rule frontmatter 属于 `rules/`，生成物属于 `model/`，两者都在插件加载范围内，改动要合并进同一次版本升级，不要拆两次 commit 各升一次）。

`compile.rule.js` 按行切分完整路由（一条规则一行，不再有"桶"这层分组），单条规则不会被切断；单片字符数超过 `SHARD_LIMIT`（9000）就自动开新片。片数超过 `MAX_CATALOG_SHARDS`（当前 5）会直接 throw 报错——这种情况要先在 `hooks/hooks.json` + `hooks/inject-nocode.sh` 里加一个新的 `model-rule-catalog-N` segment，再调高 `MAX_CATALOG_SHARDS` 常量。当前仓库只用到 `agent-rule-catalog-1.md` 一片，`-2/-3/-4/-5` 是预留位，文件不存在时 `inject-nocode.sh` 静默跳过（不报错、不 warn）。

一致性有兜底但不阻断：SessionStart 第一个 segment 里会跑 `node scripts/compile.rule.js --check` + `node scripts/compile.hooks.js --check`，源与生成物不一致只 `warn`，不会挡住会话——**不要依赖这个兜底代替手动跑 compile**，warn 出现说明已经有人忘了重新生成。

## 新增 `model/*.md` 文件的义务

任何新文件（非 catalog 数字分片，比如再加一个 `agent-xxx.md`）想在 SessionStart 生效，必须同时改两处，否则文件虽然存在但永远不会被注入 session（`inject-nocode.sh` 的孤儿检查只 warn，不会帮你自动接上）：

1. `hooks/inject-nocode.sh` 的 `seg_file()` 函数加一个 `case` 分支，返回新文件路径；同时把新 segment 名加进 `MODEL_SEGMENTS` 列表（孤儿检查用）。
2. `hooks/hooks.json` 的 `SessionStart` 数组里加一条对应的 `${CLAUDE_PLUGIN_ROOT}/hooks/inject-nocode.sh <segment>` command。

两处必须在同一 commit 完成，并升级 `plugin.json` version。

## 红线

- 不手改任何 `agent-rule-catalog-<数字>.md`——对应 `rules/rule-*.md` 的 frontmatter 才是源，手改会在下次 compile 时被静默覆盖。
- 不要因为"只是文档小改"跳过版本升级——`model/` 全目录都在插件加载范围内，规则 2 没有例外（纯文档/元数据修订除外，参照仓库根 `CLAUDE.md`）。
- 加新 segment 只改 `seg_file()` 不改 `hooks.json`（或反之）——两处必须同步改，漏一处等于文件写了也永远注入不进去，且不会有报错提示（孤儿检查只 warn）。
- rule frontmatter 变了但没跑 `node scripts/compile.rule.js`——不要直接 commit，commit 前确认生成物已同步（`--check` 干净）。
- PreToolUse pattern 变了但没跑 `node scripts/compile.hooks.js`——同上，这是另一条独立链，`compile.rule.js --check` 干净不代表这条也干净。
