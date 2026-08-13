# commands/ — Agent 工作指南

本目录是 `nocode` 的入口 Skill 定义单源。Claude/Codex 发布物都由 adapter 把每个未排除的入口 `.md` 编译成同名 `skills/<name>/SKILL.md`；源码不再直接发布为原生 `commands/`。frontmatter 里的 `description` 和可选 `argument-hint` 会进入生成的 Skill。子目录 `sow-reference/` 的运行文件会生成到 `skills/sow/scripts/`，测试不发布。

在本目录新增/修改文件前，先读完本文件的边界约束。

## 命名惯例三类 + 各自模式边界

沿用 `.agents-personal/AGENTS.md` 的全局命名表，落到 `commands/` 的实际情况如下：

| 模式 | 命名 | 含义 | 本目录现存 | 模式边界（硬约束） |
|---|---|---|---|---|
| `*hub` | 领域名 + hub（无连字符） | 聚合入口：flat 意图分发 | **本目录没有 `*hub` command**；源码 Skill：`skills/larkhub/`、`skills/personalhub/`、`skills/nocodehub/`、`skills/projecthub/` | **只转发，不写业务逻辑**：主入口只能做「解析子动作 → 路由表 → 加载私有 reference / 转发 Skill」。任何整合判断、校验分支、写入协议都必须留在被路由的 reference 或 Skill 里。 |
| `*flow` | 领域名 + flow（无连字符） | 工作流：阶段制 sequential | **本目录目前没有任何 `*flow` 命令文件** | `devflow` / `pdflow` 只存在于 `skills/`，不要因为看到这两个名字就在 `commands/` 下新建 `devflow.md` / `pdflow.md`。如果确实需要给某个 flow 加一个用户可直接键入的入口，先确认是不是真的该独立成 command，还是复用 `平台原生 Skill 调用` 引用即可。 |
| `xx-yy` | 连字符 | 子 skill / 子命令，domain-action 结构 | `instinct-export` / `instinct-import` / `instinct-status` | domain 前缀要和它所属的 hub 对应。personal/plugin/project 子能力已收进各自 hub 的私有 `references/`，不要重新创建同名公开入口。 |

**例外——无连字符的顶层通用命令**：`distill` / `sow` / `task` / `recall` / `eval` / `evolve` 六个不挂靠任何 domain 前缀。这是刻意的：它们是用户最高频直接键入的入口（`/distill`、`/sow` 等），不算三类命名惯例的违例。新增顶层命令前先确认它是否真的该独立于所有 domain，而不是该塞进某个 `xx-yy` 或已有 `*hub` 的子动作。

**`*hub` 是载体无关的角色（command 或 skill 均可承载）**：hub 的本质是「聚合入口 + flat 意图分发 + 只转发不写业务逻辑」。当前四个 hub 都是源码 Skill；`personalhub`、`nocodehub`、`projecthub` 用私有 `references/` 隐藏子能力。

## 入口 Skill 与业务 Skill 的分工

本目录的 `.md` 是**入口 Skill 的生成源**，frontmatter 至少含 `description`。body 该做的事只有三种：

1. **转发到 `平台原生 Skill 调用`**——如 `distill.md` / `eval.md`。
2. **内联执行简单只读逻辑**——如 `recall.md` 的查询与展示。
3. **遗留例外**：`evolve.md` / `instinct-export.md` / `instinct-import.md` / `instinct-status.md` 直接 shell 出 `skills/continuous-learning-v2/scripts/instinct-cli.py`，不经过 `平台原生 Skill 调用`。这是 `continuous-learning-v2` vendor 集成留下的历史写法，**新命令不要模仿**，新增分发一律走 `平台原生 Skill 调用`。

**不要在薄入口里塞多步业务判断**（整合判断 / 融合规则 / 复杂校验分支等）——那些属于业务 Skill，薄入口只负责参数解析 + 路由。

`distill.md`、`sow.md` 等文件体量较大、内含完整执行流程；它们本身就是对应生成 Skill 的权威实现。personal/plugin/project 维护流程则以三个 hub 的私有 `references/` 为单源。

## 新增/改 command 后升 plugin.json 版本

`commands/` 在 `CLAUDE.md` 规则 2 的范围内——任何命令**功能性内容**的改动都算插件更新，必须在同一个 commit 里升 `plugin/metadata.json` 的 `version` 并重新生成双平台发布物（新增命令 = minor；文案/bug fix = patch；破坏性改名或语义反转 = major）。

**例外**：`commands/AGENTS.md` 和 `commands/README.md` 本身属于纯文档，按 `CLAUDE.md` 末段的豁免条款不需要升版本（但仍要 commit，仍不要自动 push）。

判定关键是"改的是不是会被 Claude Code 当插件命令加载的文件"：

- `commands/*.md`（入口 Skill 定义源）→ 算，需要升版本。
- `commands/AGENTS.md`、`commands/README.md` → 不算，纯文档豁免。
- `commands/sow-reference/*.py` → 编译到两端 `skills/sow/scripts/`；如果改动影响入口行为，按影响升级版本。

## frontmatter 必须有 description

每个命令 `.md` 顶部必须有：

```yaml
---
description: ...
argument-hint: ...   # 多数命令有，纯占位/无参命令可省略或写 "(无参数)"
---
```

缺了 `description` 字段，这个命令**不会出现在可用命令列表里**。历史上 `eval.md` 曾经是这条规则的活生生反例（完全没有 frontmatter，连开头的 `---` 都没有，实际失效不可键入）——2026-07-03 已修复补齐，现在仍以此为例说明后果，别再犯同样的错。

- 新增命令时对照这个案例，别忘了加 frontmatter。
- 改现有命令时如果发现某个命令"用户说找不到"，第一步就查它的 frontmatter 是否完整、`description` 是否非空。
- `evolve.md` / `instinct-export.md` / `instinct-import.md` / `instinct-status.md` 用的是另一套 frontmatter 字段（`name` + `description` + `command` + `implementation`，没有 `argument-hint`）——这是 `continuous-learning-v2` 迁移遗留的格式，因为 `description` 字段仍在所以仍然有效，但**不要把它当新命令的模板**。新命令统一 follow `description` + `argument-hint` 两字段的标准格式（参照 `distill.md` / `eval.md` 等主流写法）。

## sow-reference/ 子目录

只服务 `sow.md` 一个命令：`script.py` 是 `/sow` 通过 `Bash` 调用的 frontmatter + 归档路径生成脚本，`test_script.py` 是对应单测，`__pycache__/` 是 Python 编译缓存。

这不是通用共享脚本库，**不要把其它命令的脚本往这里塞**。跨入口复用的脚本放仓库级 `scripts/`；严格归属单一 Skill 的脚本放该 Skill 自己的 `scripts/`（如 `skills/projecthub/scripts/project-tree-detect.mjs`）。只有当脚本严格属于单一 command、且体量不适合直接内联进 `.md` 时，才比照 `sow-reference/` 的先例建 `<command>-reference/` 子目录。

## 已知漂移 / 待办（供 `/nocodehub dream` 巡检参考，不代表本文件要求你主动去修）

- `skills/projecthub/references/init.md` 是显式 TBD 占位，当前输出指向 `projecthub dream` / `projecthub write` 作为替代方案。补齐 init 设计时同时更新 `skills/projecthub/SKILL.md` 的路由说明。

> `eval.md` 曾经是缺 frontmatter 的 vendor 孤儿文件（无法出现在命令列表里），2026-07-03 的 `/nocodehub dream` 巡检修复：补齐 frontmatter 并改造为转发 `平台原生 Skill 调用`，不再重复内联 `.claude/evals/` 那套遗留机制。

## 反模式

- ❌ 在 `*hub` 文件里写整合判断/校验分支等业务逻辑——越界，应转发给对应 Skill
- ❌ 在 `commands/` 新建 `xxx-flow.md`——`*flow` 只属于 `skills/`
- ❌ 新命令模仿 `evolve.md`/`instinct-*.md` 直接 shell 脚本、绕开 `平台原生 Skill 调用`——那是历史遗留格式，不是推荐模板
- ❌ 新增/改命令后忘记同步升 `plugin/metadata.json` 的 version，或忘记运行 `node scripts/package.platform.mjs`
- ❌ 新增命令忘记写 `description` frontmatter——参考 `eval.md` 的下场
- ❌ 把非 `/sow` 专属的脚本塞进 `sow-reference/`
