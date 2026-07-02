# commands/ — Agent 工作指南

本目录是 Claude Code 插件 `nocode` 的 slash command 定义目录。每个 `.md` 文件对应一个 `/<文件名>` 命令，frontmatter 里的 `description`（可选 `argument-hint`）决定它是否出现在可用命令列表里、以及怎么展示。子目录 `sow-reference/` 是 `/sow` 专属的 Python 辅助脚本。

在本目录新增/修改文件前，先读完本文件的边界约束。

## 命名惯例三类 + 各自模式边界

沿用 `.agents-personal/AGENTS.md` 的全局命名表，落到 `commands/` 的实际情况如下：

| 模式 | 命名 | 含义 | 本目录现存 | 模式边界（硬约束） |
|---|---|---|---|---|
| `*hub` | 领域名 + hub（无连字符） | 聚合入口：flat 意图分发 | `nocodehub` / `personalhub` / `projecthub` / `larkhub` | **只转发，不写业务逻辑**：文件内容只能是「解析子动作 → 路由表 → 转发 `Skill()`」，或对纯只读统计（如 `status` 子动作）内联执行几行查询/展示代码。任何整合判断、校验分支、写入协议都必须留在被转发的 Skill/命令里，不要往 hub 文件里塞。`plugin-dream.md` 的 Layer2「command 对象」检测已经把这条编进巡检规则，改 hub 文件越界会被巡检出来。 |
| `*flow` | 领域名 + flow（无连字符） | 工作流：阶段制 sequential | **本目录目前没有任何 `*flow` 命令文件** | `devflow` / `pdflow` 只存在于 `skills/`，不要因为看到这两个名字就在 `commands/` 下新建 `devflow.md` / `pdflow.md`。如果确实需要给某个 flow 加一个用户可直接键入的入口，先确认是不是真的该独立成 command，还是复用 `Skill()` 引用即可。 |
| `xx-yy` | 连字符 | 子 skill / 子命令，domain-action 结构 | 数量最多：`personal-distill` / `personal-dream` / `personal-init` / `personal-lint` / `personal-recall`、`project-distill` / `project-dream` / `project-init` / `project-lint` / `project-recall`、`plugin-distill` / `plugin-dream`、`instinct-export` / `instinct-import` / `instinct-status` | domain 前缀要和它所属的 hub 对应（`personal-*` ↔ `personalhub`，`project-*` ↔ `projecthub`，`plugin-*` ↔ `nocodehub`）。新增某个 domain 下的子命令时，记得同步在对应 hub 的路由表里加一行。 |

**例外——无连字符的顶层通用命令**：`distill` / `sow` / `task` / `recall` / `eval` / `evolve` 六个不挂靠任何 domain 前缀。这是刻意的：它们是用户最高频直接键入的入口（`/distill`、`/sow` 等），不算三类命名惯例的违例。新增顶层命令前先确认它是否真的该独立于所有 domain，而不是该塞进某个 `xx-yy` 或已有 `*hub` 的子动作。

## command 与 skill 的分工

command（`.md`，frontmatter 至少含 `description`）是**用户键入的入口**。body 该做的事只有三种：

1. **转发到 `Skill(nocode:xxx)`**——绝大多数 hub / 操作型 / 巡检型命令走这条（`larkhub.md`/`distill.md`/`personalhub.md`/`projecthub.md`/`nocodehub.md`/`plugin-dream.md`/`plugin-distill.md`/`personal-dream.md`/`personal-distill.md` 等文件里都能看到 `Skill(...)` 调用）。
2. **内联执行简单只读逻辑**——如各 hub 的 `status` 子动作（读文件统计、跑只读检查命令）、`personalhub` 的 `snap` 直接跑 `scripts/personal-snapshot.mjs`。
3. **遗留例外**：`evolve.md` / `instinct-export.md` / `instinct-import.md` / `instinct-status.md` 直接 shell 出 `skills/continuous-learning-v2/scripts/instinct-cli.py`，不经过 `Skill()`。这是 `continuous-learning-v2` vendor 集成留下的历史写法，**新命令不要模仿**，新增分发一律走 `Skill()`。

**不要在 command 文件里塞多步业务判断**（整合判断 / 融合规则 / 复杂校验分支等）——那些属于 Skill 内部实现，command 只负责参数解析 + 路由。

**但要注意一个反直觉的事实**：`distill.md`、`sow.md`、`plugin-dream.md`、`project-dream.md`、`plugin-distill.md`、`personal-dream.md` 等几个文件体量很大、内含完整执行流程——它们既是命令入口，**也直接就是**对应 Skill 的权威实现（仓库里没有为它们建独立的 `skills/<name>/SKILL.md`）。判断方法：如果某个命令在别的 hub 路由表里被写成「转发到 `Skill(nocode:xxx)`」，而 `skills/` 下又找不到同名目录，不代表引用悬空——说明 `xxx` 对应的实现就是这份 `commands/xxx.md` 自己。改动这类文件时，要同时把它当"命令"和"实现"两个身份一起考虑，不要以为只是薄壳转发。

## 新增/改 command 后升 plugin.json 版本

`commands/` 在 `CLAUDE.md` 规则 2 的范围内——任何命令**功能性内容**的改动都算插件更新，必须在同一个 commit 里升 `.claude-plugin/plugin.json` 的 `version`（新增命令 = minor；文案/bug fix = patch；破坏性改名或语义反转 = major）。

**例外**：`commands/AGENTS.md` 和 `commands/README.md` 本身属于纯文档，按 `CLAUDE.md` 末段的豁免条款不需要升版本（但仍要 commit，仍不要自动 push）。

判定关键是"改的是不是会被 Claude Code 当插件命令加载的文件"：

- `commands/*.md`（真正的命令定义）→ 算，需要升版本。
- `commands/AGENTS.md`、`commands/README.md` → 不算，纯文档豁免。
- `commands/sow-reference/*.py` → 是 `sow.md` 通过 `Bash` 调用的辅助脚本，不是 Claude Code 直接加载的命令文件本身；如果改动只是脚本内部实现细节、不改变 `/sow` 的对外行为，可论证为 patch 甚至不升；如果改了行为（新增参数、改了 exit code 语义等），要按影响到命令产出从紧走升版本。判不准时倾向升版本。

## frontmatter 必须有 description

每个命令 `.md` 顶部必须有：

```yaml
---
description: ...
argument-hint: ...   # 多数命令有，纯占位/无参命令可省略或写 "(无参数)"
---
```

缺了 `description` 字段，这个命令**不会出现在可用命令列表里**。本目录已有一个活生生的反例：`eval.md` 完全没有 frontmatter（连开头的 `---` 都没有），因此实际上是失效、不可键入的死文件，只是仓库里还留着没清理。

- 新增命令时对照这个反例，别忘了加 frontmatter。
- 改现有命令时如果发现某个命令"用户说找不到"，第一步就查它的 frontmatter 是否完整、`description` 是否非空。
- `evolve.md` / `instinct-export.md` / `instinct-import.md` / `instinct-status.md` 用的是另一套 frontmatter 字段（`name` + `description` + `command` + `implementation`，没有 `argument-hint`）——这是 `continuous-learning-v2` 迁移遗留的格式，因为 `description` 字段仍在所以仍然有效，但**不要把它当新命令的模板**。新命令统一 follow `description` + `argument-hint` 两字段的标准格式（参照 `distill.md` / `project-dream.md` 等主流写法）。

## sow-reference/ 子目录

只服务 `sow.md` 一个命令：`script.py` 是 `/sow` 通过 `Bash` 调用的 frontmatter + 归档路径生成脚本，`test_script.py` 是对应单测，`__pycache__/` 是 Python 编译缓存。

这不是通用共享脚本库，**不要把其它命令的脚本往这里塞**。命令专属脚本请参照仓库已有约定：跨命令复用的脚本放仓库级 `scripts/`（如 `project-dream.md` 用的 `scripts/project-tree-detect.mjs`、`personal-dream.md` 用的 `scripts/personal-snapshot.mjs`）；只有当脚本严格属于单一命令、且体量不适合直接内联进 `.md` 时，才比照 `sow-reference/` 的先例建 `<command>-reference/` 子目录。

## 已知漂移 / 待办（供 `/plugin-dream` 巡检参考，不代表本文件要求你主动去修）

- `eval.md` 无 frontmatter，且引用路径没有走 `${CLAUDE_PLUGIN_ROOT}`，很可能是被 `skills/eval-harness`（`nocode:eval-harness`）取代后的遗留文件。若要修复，先确认是否该整体删除、把职责并入 `nocode:eval-harness`，而不是简单补一个 frontmatter 把它复活。
- `project-init.md` 是显式 TBD 占位（`description` 里写明"待设计"），当前输出指向 `project-dream` / `project-distill` 作为替代方案；`projecthub.md` 的 `init` 子动作路由同步指向这个占位输出。改 `projecthub.md` 或补齐 `project-init` 设计时，两处要一起改，避免其中一处漂移。

## 反模式

- ❌ 在 `*hub` 文件里写整合判断/校验分支等业务逻辑——越界，应转发给对应 Skill
- ❌ 在 `commands/` 新建 `xxx-flow.md`——`*flow` 只属于 `skills/`
- ❌ 新命令模仿 `evolve.md`/`instinct-*.md` 直接 shell 脚本、绕开 `Skill()`——那是历史遗留格式，不是推荐模板
- ❌ 新增/改命令后忘记同步升 `.claude-plugin/plugin.json` 的 version
- ❌ 新增命令忘记写 `description` frontmatter——参考 `eval.md` 的下场
- ❌ 把非 `/sow` 专属的脚本塞进 `sow-reference/`
