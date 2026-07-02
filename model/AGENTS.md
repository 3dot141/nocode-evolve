# model/ — SessionStart 常驻注入源文件

本目录内容通过 `hooks/inject-rules.sh` 在每次会话开局注入 additionalContext，是插件"规则知识 (reactive)"层的落地位置。在此目录改动前，先确认改的是手工文件还是生成物——两者的改动流程完全不同。

## 文件分类——先看这张表，再动手

| 文件 | 性质 | 谁能改 |
|---|---|---|
| `agent-about.md` | 手工维护 | 直接 Edit |
| `agent-personal.md` | 手工维护 | 直接 Edit |
| `agent-karpathy.md` | 手工维护 | 直接 Edit |
| `agent-catalog-using.md` | 手工维护（**注意：文件名带 "catalog" 但不是生成物**） | 直接 Edit |
| `agent-catalog-1.md` / `agent-catalog-2.md` / …`-5.md` | **生成物，禁手改** | 改 `rules/manifest.json` → 跑 `node hooks/generate.mjs` |

`agent-catalog-using.md` 是本目录唯一容易踩坑的命名——名字里有 "catalog"，容易被当成路由分片之一，但它讲的是"skill 调用纪律 + Step 0 触发协议"，是纯手写文档。`hooks/generate.mjs` 判断生成物的正则是 `agent-catalog(-\d+)?\.md`（纯数字后缀），`-using` 后缀不匹配，永远不会被脚本生成或清理。改它就跟改 `agent-about.md` 一样，直接 Edit 即可。

反过来，`agent-catalog-1.md`、`agent-catalog-2.md`（以及未来可能出现的 `-3/-4/-5`）是 `rules/manifest.json` 经 `node hooks/generate.mjs` 渲染出来的路由分片，文件头部都带"本文件由 generate.mjs 生成，禁手改"的标记。**任何时候不要直接 Edit 这些文件**——下次跑 generate（或 SessionStart 的 `--check` 漂移告警提示后手动跑）会覆盖你的手改，改动无声丢失。

## 改手工文件（about / personal / karpathy / catalog-using）

1. 直接 Edit 目标文件。
2. 改完必须升级 `.claude-plugin/plugin.json` 的 `version`——`model/` 整个目录都在插件 SessionStart 加载范围内，任何改动都算插件更新（仓库根 `CLAUDE.md` 规则 2，按 SemVer：patch=文案修订，minor=新增行为条款，major=语义反转）。纯文档/元数据修订除外。
3. 完成后 `git status` / `git diff` 复核，创建 commit（不要自动 push，commit 后问用户是否需要 push）。

## 改路由规则（agent-catalog-N.md 数字分片）

**禁止直接 Edit 这些文件。** 正确流程：

1. 改 `rules/manifest.json`（唯一真值源：`buckets` + `rules`，每条 rule 含 `bucket` / `triggers` / `summary` / `guard` / `pretooluse` 等字段）。
2. 跑 `node hooks/generate.mjs` 重新生成 `model/agent-catalog-N.md` 分片 + `hooks/pretooluse-rules.json` + `hooks/workflow-skills.json`（三者同源，一次生成全部覆盖）。
3. 跑 `node --test 'hooks/*.test.mjs'` 验证。
4. 同一 commit 里升级 `plugin.json` 的 version（manifest 属于 `rules/`，生成物属于 `model/`，两者都在插件加载范围内，改动要合并进同一次版本升级，不要拆两次 commit 各升一次）。

`generate.mjs` 按"桶"（bucket）切分完整路由，桶是最小切分粒度、不会切断单条 rule；单片字符数超过 `SHARD_LIMIT`（9000）就自动开新片。片数超过 `MAX_CATALOG_SHARDS`（当前 5）会直接 throw 报错——这种情况要先在 `hooks/hooks.json` + `hooks/inject-rules.sh` 里加一个新的 `model-catalog-N` segment，再调高 `MAX_CATALOG_SHARDS` 常量。当前仓库只用到 `agent-catalog-1.md` / `agent-catalog-2.md` 两片，`-3/-4/-5` 是预留位，文件不存在时 `inject-rules.sh` 静默跳过（不报错、不 warn）。

一致性有兜底但不阻断：SessionStart 第一个 segment 里会跑 `node hooks/generate.mjs --check`，manifest 与生成物不一致只 `warn`，不会挡住会话——**不要依赖这个兜底代替手动跑 generate**，warn 出现说明已经有人忘了重新生成。

## 新增 `model/*.md` 文件的义务

任何新文件（非 catalog 数字分片，比如再加一个 `agent-xxx.md`）想在 SessionStart 生效，必须同时改两处，否则文件虽然存在但永远不会被注入 session（`inject-rules.sh` 的孤儿检查只 warn，不会帮你自动接上）：

1. `hooks/inject-rules.sh` 的 `seg_file()` 函数加一个 `case` 分支，返回新文件路径；同时把新 segment 名加进 `MODEL_SEGMENTS` 列表（孤儿检查用）。
2. `hooks/hooks.json` 的 `SessionStart` 数组里加一条对应的 `${CLAUDE_PLUGIN_ROOT}/hooks/inject-rules.sh <segment>` command。

两处必须在同一 commit 完成，并升级 `plugin.json` version。

## 红线

- 不手改任何 `agent-catalog-<数字>.md`——`rules/manifest.json` 才是源，手改会在下次 generate 时被静默覆盖。
- 不要因为"只是文档小改"跳过版本升级——`model/` 全目录都在插件加载范围内，规则 2 没有例外（纯文档/元数据修订除外，参照仓库根 `CLAUDE.md`）。
- 不要假设 `agent-catalog-using.md` 是生成物而不敢手改，或反过来跑 generate 想"顺便"更新它——它不受 `hooks/generate.mjs` 管理，改了不会被覆盖，也不会被自动同步。
- 加新 segment 只改 `seg_file()` 不改 `hooks.json`（或反之）——两处必须同步改，漏一处等于文件写了也永远注入不进去，且不会有报错提示（孤儿检查只 warn）。
- rule 内容变了但没跑 `node hooks/generate.mjs`——不要直接 commit，commit 前确认生成物已同步（`--check` 干净）。
