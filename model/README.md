# model/

`model/` 存放插件 SessionStart hook 注入到每个会话开局的常驻 context——nocode 插件"规则知识 (reactive)"层的物理落地位置。内容通过 `hooks/inject-nocode.sh` 读出、包成 `additionalContext` 注入会话，agent 不需要主动 Read 这些文件就已经"知道"里面的内容。

## 这个目录解决什么问题

Claude Code 插件的 `CLAUDE.md`（挂在插件根目录下）不会被自动加载——这是官方限制，插件不像项目那样能靠根 `CLAUDE.md` 自动生效。SessionStart hook 是官方推荐的等效替代方案：把角色设定、行为基线、完整规则路由拆成若干 `.md` 文件放进 `model/`，hook 在会话开局把每个文件内容读出来，当作 `additionalContext` 注入。

为什么要拆成多个文件而不是拼一个大文件：hook 的 `additionalContext` 按**单个 command 的字符数**截断，阈值 10000（Claude Code 官方文档定值，硬编码不可配）。早期版本把多个 model 文件合并成一条 command 输出，一旦超阈值就被整坨截断存盘，注入内容悄悄丢失还不报错。现在拆成"每个文件一条 command"后，各段独立判阈值，只要单文件不超 10000 字符就安全注入。

## 文件角色一览

| 文件 | 角色 | 维护方式 |
|---|---|---|
| `agent-about.md` | 角色设定 + 本插件工作模型总览 + 输出语言（全程中文，含思考）+ 行为基线（陌生代码先 zoom-out / 推理外化 rubber-duck / 语气规范 / 方案类工作核对真实代码 / 评估类提问调红蓝军 / 代码搜索走 semble-search / 常驻 git 习惯 / 偏离 rule 需显式授权 / 用户离场信号 / AskUserQuestion payload 自足）+ 全局占位符（`{username}` 等）+ 文档产出路径变量 + 变量解析优先级 | 手工维护 |
| `agent-personal.md` | 项目本地 `.agents-personal/` 的检索约定（wiki 何时查、AGENTS.md+rules 何时查）+ 删除护栏（`.agents-personal/` 和 `$USER_VAULT_PATH` 下 rm/mv/覆盖前必须二次确认，不可恢复） | 手工维护 |
| `agent-karpathy.md` | 12 条工程准则模板（Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution / Fail Loud 等），`agent-about.md` 声明"行为基线遵循本文件" | 手工维护 |
| `agent-rule-catalog-1.md` | catalog 唯一分片（体量小，当前不需要续片）：扁平表格，每行一条规则（文件相对地址 + description），不再分桶 | **生成物**，源 = 各 `rules/rule-*.md` 顶部 frontmatter |
| `agent-rule-catalog-2.md` / `-3.md` / `-4.md` / `-5.md` | 预留分片，路由内容超过单片 `SHARD_LIMIT`（9000 字符）时由 `scripts/compile.rule.js` 自动新开，当前不存在 | 生成物（按需生成） |

> `agent-catalog-using.md`（Skill 调用纪律 + Step 0 触发协议，吸收自 superpowers `using-superpowers` skill）已在 260704 model/*.md 内容精简中删除，对应 SessionStart segment 也已一并移除（不再是"静默注入空内容"，而是彻底不调用）。`vendor/superpowers/vendor-integration.json` 里 `using-superpowers` 的分发规则已同步改成 `action: skip` 并注明这段历史。

## 生成物与手工文件的分界

一句话判断法：文件名是否匹配正则 `agent-(rule-)?catalog(-\d+)?\.md`（纯数字后缀，如 `-1` `-2`）。匹配 → 生成物，源头是各 `rules/rule-*.md` 的 frontmatter，只能通过 `node scripts/compile.rule.js` 改动；不匹配 → 手工文件，直接 Edit。

> 命名陷阱提醒：曾经的 `agent-catalog-using.md` 就是这条规则里的反直觉例子——名字里有 "catalog"，容易被误认成路由分片的一员，但它的后缀是 `-using` 不是数字，天然不匹配上面的正则，脚本从不生成它也从不删它，是一份纯手写文档。以后新增手工文件时避免蹭 `agent-catalog` 前缀命名，减少这种混淆。

```
rules/rule-*.md 各自的 frontmatter  ──node scripts/compile.rule.js──▶  model/agent-rule-catalog-1.md
   (单一真值源, 每文件自带)                                            ...（按需 -2/-3/-4/-5）

scripts/compile.hooks.js 内硬编码的规则数组 (独立链，不读 rules/ 任何文件) ──▶  hooks/pretooluse-rules.json
```

一致性由 SessionStart 时的 `node scripts/compile.rule.js --check` + `node scripts/compile.hooks.js --check` 兜底：源和生成物一旦漂移只 `warn`，不阻断 session（把决定权留给维护者，不强制卡住每次开局）。

> 早期版本用 `rules/manifest.json` 当唯一真值源、按"桶"分组渲染 catalog，`hooks/generate.mjs` 是当时唯一的生成器。这套机制已废弃——manifest 和桶概念都已移除，改成每个 `rules/rule-<id>.md` 自带 frontmatter，`scripts/compile.rule.js`/`scripts/compile.hooks.js` 两条独立编译链取代原来的单一 `generate.mjs`。

## 注入顺序与截断机制

`hooks/hooks.json` 的 `SessionStart` 数组按固定顺序调用 `hooks/inject-nocode.sh <segment>`，每次调用是一条独立 command，各自独立判 10000 字符阈值。以 `hooks.json` + `inject-nocode.sh` 的当前实际内容为准，顺序如下：

| 顺序 | segment | 对应文件 |
|---|---|---|
| 1 | `model-about` | `model/agent-about.md` |
| 2 | `model-personal` | `model/agent-personal.md` |
| 3 | `model-karpathy` | `model/agent-karpathy.md` |
| 4 | `model-rule-catalog-1` | `model/agent-rule-catalog-1.md` |
| 5 | `model-rule-catalog-2` | `model/agent-rule-catalog-2.md`（不存在，静默跳过） |
| 6 | `model-rule-catalog-3` | `model/agent-rule-catalog-3.md`（不存在，静默跳过） |
| 7 | `model-rule-catalog-4` | `model/agent-rule-catalog-4.md`（不存在，静默跳过） |
| 8 | `model-rule-catalog-5` | `model/agent-rule-catalog-5.md`（不存在，静默跳过） |
| 9 | `project` | `<project>/.agents-personal/AGENTS.md`（存在才注入；这是被打开项目的本地文件，不属于本目录，`$CLAUDE_PROJECT_DIR` 决定项目根，取不到则回退 `$PWD`） |

之后 `hooks.json` 还会额外跑一条 `node scripts/personal-snapshot.mjs`，那是独立脚本、不经过 `inject-nocode.sh`，不属于本目录的注入链，此处不展开。

> **与仓库根 `README.md` 的口径差异**：根 README 的 segment 列表描述可能与本文件存在滞后——以本文件和 `hooks/hooks.json` / `hooks/inject-nocode.sh` 的实际内容为准。当前是 9 次 `inject-nocode.sh` 调用（8 个 `model-*` segment + 1 个 `project` segment），catalog 分片 segment 已从 `model-catalog-N` 改名为 `model-rule-catalog-N`，`model-catalog-using` segment 随 `agent-catalog-using.md` 删除已一并移除。

`inject-nocode.sh` 在第一个 segment（`model-about`）里顺带做三件事，只执行一次、不在后续 segment 重复：

1. **导出环境变量**：把 `CLAUDE_PLUGIN_ROOT` / `NOCODE_SKILL_REF` 写入 `CLAUDE_ENV_FILE`，供后续 Bash tool 调用使用（hook 进程内能拿到 `CLAUDE_PLUGIN_ROOT`，但 Bash tool 默认拿不到，得靠这一步搭桥）。
2. **漂移检查**：跑 `node scripts/compile.rule.js --check` + `node scripts/compile.hooks.js --check`，源与生成物不一致 → warn（不阻断）。
3. **孤儿检查**：`model/*.md` 里任何文件如果没在 `seg_file()` 注册对应 segment → warn（文件存在但注入不到 session）；`rules/rule-*.md` 如果没被任何 `agent-rule-catalog-*.md` 引用 → warn（agent 命中不到，规则形同虚设）；另外还会检查 `references/skill-integration-map.md` 的 `last_verified` 是否超 90 天（上游漂移提醒）。

## 与其他目录的关系

- `rules/rule-*.md` —— 每个文件顶部 frontmatter 是对应 catalog 条目的唯一真值源，改路由从这里改，不改 `model/agent-rule-catalog-*.md`。
- `scripts/compile.rule.js` —— 单源生成器：各 rule 的 frontmatter → catalog 分片；也是 SessionStart `--check` 漂移检查用的同一份脚本。
- `scripts/compile.hooks.js` —— 独立生成器：硬编码规则 → `hooks/pretooluse-rules.json`，与本目录内容无关。
- `hooks/inject-nocode.sh` —— 本目录内容注入 session 的执行脚本，`seg_file()` 是 segment → 文件的映射单源。
- `hooks/hooks.json` —— 声明 `SessionStart` 的 segment 调用顺序（以及 `PreToolUse` / `PostToolUse` 等其他 hook 事件，不在本目录范围）。
- `rules/rule-*.md` —— 按需 `Read` 的具体规则内容，不常驻 context；`agent-rule-catalog-*.md` 分片里的每条规则命中后才指向对应的 `rules/rule-*.md`。

## 改动须知

改本目录任何文件都算插件更新，按仓库根 `CLAUDE.md` 规则升级 `.claude-plugin/plugin.json` 的 `version`。手工文件（`agent-about.md` / `agent-personal.md` / `agent-karpathy.md`）直接 Edit；`agent-rule-catalog-N.md` 数字分片改对应 `rules/rule-*.md` 的 frontmatter 后跑 `node scripts/compile.rule.js` 重新生成，不手改。详细操作步骤（含红线清单）见同目录 `AGENTS.md`。
