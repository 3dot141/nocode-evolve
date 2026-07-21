# agents/

本目录是 `nocode` 的平台无关 agent profile 单源。Claude/Codex 发布物都把每个 `.md` 编译到
`skills/using-nocode/references/agents/<name>.md`；`using-nocode` 再把 profile 与具体任务交给当前平台的 workflow provider。两端都不把本目录发布为原生 agent 目录。
在此目录新增/修改文件时遵守以下约束。

## Frontmatter 字段约定

每个 agent 文件头部 YAML frontmatter 目前包含：

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 与文件名（去 `.md`）一致，也是 task graph 的 `profile` 值 |
| `description` | 是 | 单段文字，供 `using-nocode` 判断何时选择该 profile |
| `tools` | 建议填 | 最小工具面提示；最终可用工具由当前平台 workflow provider 与权限边界决定 |
| `model` | 可选 | 模型偏好提示；不保证平台一定支持或采用该值 |

`description` 用陈述句说明谁会委派该 profile、任务边界和隔离目的。profile 由业务 Skill 显式选择，不依赖模型根据 description 自主触发。

**`tools` 字段目前存在两种写法**，仓库里两种都在用，未强制统一：
- JSON 数组：`tools: ["Read", "Grep", "Glob"]`（planner / tdd-guide）
- 逗号分隔字符串：`tools: Bash, Read`（`semble-search` / `recall-search` 用这种，2 个文件）

新增 profile 时任选一种即可；同一文件内不要混用两种写法。它们是跨平台 provider hints，不是原生 Claude/Codex agent 配置。

## 两种 agent 模式

目录内的 agent 按内容组织方式分两类，新增时先判断落在哪一类，再决定怎么写正文。评审方法统一归属
`skills/reviewing/`，不要为架构、代码质量、数据库或安全评审新增只会转发到 reviewing 的薄壳 profile。

**1. 自包含型（self-contained）**——`planner` / `tdd-guide`。这类 agent 的方法论完整内联在文件内
（规划流程模板、TDD 红绿重构循环 + 测试清单），不引用 reviewing 框架，因为它们不是 review 场景。
新增同类 agent（不做评审、有自己完整方法论）时延续这个模式。

**2. 检索工具型**——`semble-search` / `recall-search`。轻量、职责单一、多由其他 skill/command 主动派发
（而非模型自主判断触发），用于把搜索过程的噪音隔离在子 agent context 里，不污染主 agent 的上下文。
这类 agent 的 `description` 按上面的第二种写法写。

## Fallback 链声明惯例

工具/命令不可用时的降级路径**内联声明在 agent 定义文件正文里**，不走外部注册表或集中配置。
例如 `semble-search.md`：

> If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.

新增依赖外部 CLI/工具的 agent，照此惯例在正文就近声明 fallback，不要假设工具一定存在，
也不要另建一个全局 fallback 配置文件。

## 改动后必须升版本

`agents/` 属于 `CLAUDE.md` 规则 2 里"参与插件生成的文件"范围（`hooks/` / `model/` / `rules/` /
`skills/` / `agents/` / `commands/` / `.claude-plugin/` / `.mcp.json`）。**任何新增/修改/删除 agent 文件都视为插件更新**：

- 编辑 `plugin/metadata.json` 的 `version`、运行 `node scripts/compile.platform.mjs`，按 SemVer 套用到 agent 改动场景：
  - 新增一个 agent 文件 → **minor**（新增能力，向后兼容）
  - 改已有 agent 的正文措辞、工具面调整但不改变对外可见的能力边界 → **patch**
  - 改 `name`（会破坏 task graph 和其它 Skill 对旧 profile 名称的引用）、
    删除某个 agent、或大幅收窄工具面导致既有用法失效 → **major**
- 版本变更和 agent 改动放进同一个 commit。
- 完成后复核 `git status` / `git diff` 创建 commit，**不要自动 push**——commit 后向用户明确询问是否需要 push。
- 纯文档修订（比如本文件、`README.md`）不需要升版本，但仍要走 commit + 询问 push 的流程。

## 其他约束

- `tools` 按最小权限声明：纯分析类给 `Read/Grep/Glob`；需要跑诊断命令（如 `git diff`）的加 `Bash`；
  确需直接写文件才加 `Write/Edit`。不要为图方便给全量工具集。
- 目录下出现的非 `.md` 杂散文件（例如运行时产生的 `*.log`）不属于 agent 定义，已被根 `.gitignore` 的
  `*.log` 规则排除，无需处理，也不要误当成 agent 清单的一部分。
