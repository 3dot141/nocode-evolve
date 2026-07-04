# model/

`model/` 存放插件 SessionStart hook 注入到每个会话开局的常驻 context——nocode 插件"规则知识 (reactive)"层的物理落地位置。内容通过 `hooks/inject-rules.sh` 读出、包成 `additionalContext` 注入会话，agent 不需要主动 Read 这些文件就已经"知道"里面的内容。

## 这个目录解决什么问题

Claude Code 插件的 `CLAUDE.md`（挂在插件根目录下）不会被自动加载——这是官方限制，插件不像项目那样能靠根 `CLAUDE.md` 自动生效。SessionStart hook 是官方推荐的等效替代方案：把角色设定、行为基线、完整规则路由拆成若干 `.md` 文件放进 `model/`，hook 在会话开局把每个文件内容读出来，当作 `additionalContext` 注入。

为什么要拆成多个文件而不是拼一个大文件：hook 的 `additionalContext` 按**单个 command 的字符数**截断，阈值 10000（Claude Code 官方文档定值，硬编码不可配）。早期版本把多个 model 文件合并成一条 command 输出，一旦超阈值就被整坨截断存盘，注入内容悄悄丢失还不报错。现在拆成"每个文件一条 command"后，各段独立判阈值，只要单文件不超 10000 字符就安全注入。

## 文件角色一览

| 文件 | 角色 | 维护方式 |
|---|---|---|
| `agent-about.md` | 角色设定 + 本插件工作模型总览 + 输出语言（全程中文，含思考）+ 行为基线（陌生代码先 zoom-out / 推理外化 rubber-duck / 语气规范 / 方案类工作核对真实代码 / 评估类提问调红蓝军 / 代码搜索走 semble-search / 常驻 git 习惯 / 偏离 rule 需显式授权 / 用户离场信号 / AskUserQuestion payload 自足）+ 全局占位符（`{username}` 等）+ 文档产出路径变量 + 变量解析优先级 | 手工维护 |
| `agent-personal.md` | 项目本地 `.agents-personal/` 的检索约定（wiki 何时查、AGENTS.md+rules 何时查）+ 删除护栏（`.agents-personal/` 和 `$USER_VAULT_PATH` 下 rm/mv/覆盖前必须二次确认，不可恢复） | 手工维护 |
| `agent-karpathy.md` | 12 条工程准则模板（Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution / Fail Loud 等），`agent-about.md` 声明"行为基线遵循本文件" | 手工维护 |
| `agent-catalog-using.md` | Skill 调用纪律 + Step 0 触发协议（吸收自 superpowers `using-superpowers` skill，融合 nocode catalog 触发协议）——命中桶后怎么 `Read` rule、多 skill 命中的调用顺序（流程类先/实现类后）、"进了 skill 就走完不跳步"的三条硬约束、用户指令优先级 | **手工维护**（文件名含 "catalog" 但不是生成物，见下方说明） |
| `agent-catalog-1.md` | catalog 唯一分片（体量小，当前不需要续片）：Step 0 触发协议头 + 何时主动调 `/devflow` + 何时建议 `/distill`·`/sow`·`/task` + 6 个桶（Git 生命周期 / 评审 / 设计与文档 / 记忆与沉淀 / 飞书Lark / Figma），每条 rule 只有一行索引（`trigger_short` + 读路径指针），不是完整展开 | **生成物**，源 = `rules/manifest.json` |
| `agent-catalog-2.md` / `-3.md` / `-4.md` / `-5.md` | 预留分片，路由内容超过单片 `SHARD_LIMIT`（9000 字符）时由 `generate.mjs` 自动新开，当前不存在 | 生成物（按需生成） |

## 生成物与手工文件的分界

一句话判断法：文件名是否匹配正则 `agent-catalog(-\d+)?\.md`（纯数字后缀，如 `-1` `-2`）。匹配 → 生成物，源头是 `rules/manifest.json`，只能通过 `node hooks/generate.mjs` 改动；不匹配 → 手工文件，直接 Edit。

`agent-catalog-using.md` 是这条规则里唯一反直觉的例子——名字里有 "catalog"，容易被误认成路由分片的一员，但它的后缀是 `-using` 不是数字。`hooks/generate.mjs` 里负责清理残留分片的 `findStaleCatalogShards()` 用的就是上面那条正则，`-using` 后缀天然不匹配，脚本从不生成它也从不删它。它是一份纯手写的 skill 使用纪律文档，历史上蹭了 "catalog" 前缀的命名习惯，实质和 `agent-about.md` 这类文件同级。

```
rules/manifest.json  ──node hooks/generate.mjs──▶  model/agent-catalog-1.md
   (单一真值源)                                      ...（按需 -2/-3/-4/-5）
                                                      hooks/pretooluse-rules.json
```

一致性由 SessionStart 时的 `node hooks/generate.mjs --check` 兜底：manifest 和生成物一旦漂移只 `warn`，不阻断 session（把决定权留给维护者，不强制卡住每次开局）。

## 注入顺序与截断机制

`hooks/hooks.json` 的 `SessionStart` 数组按固定顺序调用 `hooks/inject-rules.sh <segment>`，每次调用是一条独立 command，各自独立判 10000 字符阈值。以 `hooks.json` + `inject-rules.sh` 的当前实际内容为准，顺序如下：

| 顺序 | segment | 对应文件 |
|---|---|---|
| 1 | `model-about` | `model/agent-about.md` |
| 2 | `model-personal` | `model/agent-personal.md` |
| 3 | `model-karpathy` | `model/agent-karpathy.md` |
| 4 | `model-catalog-using` | `model/agent-catalog-using.md` |
| 5 | `model-catalog-1` | `model/agent-catalog-1.md` |
| 6 | `model-catalog-2` | `model/agent-catalog-2.md`（不存在，静默跳过） |
| 7 | `model-catalog-3` | `model/agent-catalog-3.md`（不存在，静默跳过） |
| 8 | `model-catalog-4` | `model/agent-catalog-4.md`（不存在，静默跳过） |
| 9 | `model-catalog-5` | `model/agent-catalog-5.md`（不存在，静默跳过） |
| 10 | `project` | `<project>/.agents-personal/AGENTS.md`（存在才注入；这是被打开项目的本地文件，不属于本目录，`$CLAUDE_PROJECT_DIR` 决定项目根，取不到则回退 `$PWD`） |

之后 `hooks.json` 还会额外跑一条 `node scripts/personal-snapshot.mjs`，那是独立脚本、不经过 `inject-rules.sh`，不属于本目录的注入链，此处不展开。

> **与仓库根 `README.md` 的口径差异**：根 README 目前写"7 个 segment"（列出 `model-about / model-personal / model-karpathy / model-catalog-1 / 2 / 3 / project`），是 `model-catalog-using` segment 和 `catalog-4/-5` 预留位加入之前的旧描述，没有跟着同步。以本文件和 `hooks/hooks.json` / `hooks/inject-rules.sh` 的实际内容为准——当前是 10 次 `inject-rules.sh` 调用（9 个 `model-*` segment + 1 个 `project` segment）。

`inject-rules.sh` 在第一个 segment（`model-about`）里顺带做三件事，只执行一次、不在后续 segment 重复：

1. **导出环境变量**：把 `CLAUDE_PLUGIN_ROOT` / `NOCODE_SKILL_REF` 写入 `CLAUDE_ENV_FILE`，供后续 Bash tool 调用使用（hook 进程内能拿到 `CLAUDE_PLUGIN_ROOT`，但 Bash tool 默认拿不到，得靠这一步搭桥）。
2. **漂移检查**：跑 `node hooks/generate.mjs --check`，manifest 与生成物不一致 → warn（不阻断）。
3. **孤儿检查**：`model/*.md` 里任何文件如果没在 `seg_file()` 注册对应 segment → warn（文件存在但注入不到 session）；`rules/rule-*.md` 如果没被任何 `agent-catalog-*.md` 引用 → warn（agent 命中不到，规则形同虚设）；另外还会检查 `references/skill-integration-map.md` 的 `last_verified` 是否超 90 天（上游漂移提醒）。

## 与其他目录的关系

- `rules/manifest.json` —— catalog 分片的唯一真值源，改路由从这里改，不改 `model/agent-catalog-*.md`。
- `hooks/generate.mjs` —— 单源生成器：manifest → catalog 分片 + `pretooluse-rules.json`；也是 SessionStart `--check` 漂移检查用的同一份脚本。
- `hooks/inject-rules.sh` —— 本目录内容注入 session 的执行脚本，`seg_file()` 是 segment → 文件的映射单源。
- `hooks/hooks.json` —— 声明 `SessionStart` 的 segment 调用顺序（以及 `PreToolUse` / `PostToolUse` 等其他 hook 事件，不在本目录范围）。
- `rules/rule-*.md` —— 按需 `Read` 的具体规则内容，不常驻 context；`agent-catalog-*.md` 分片里的每条 rule 命中后才指向对应的 `rules/rule-*.md`。

## 改动须知

改本目录任何文件都算插件更新，按仓库根 `CLAUDE.md` 规则升级 `.claude-plugin/plugin.json` 的 `version`。手工文件（`agent-about.md` / `agent-personal.md` / `agent-karpathy.md` / `agent-catalog-using.md`）直接 Edit；`agent-catalog-N.md` 数字分片改 `rules/manifest.json` 后跑 `node hooks/generate.mjs` 重新生成，不手改。详细操作步骤（含红线清单）见同目录 `AGENTS.md`。
