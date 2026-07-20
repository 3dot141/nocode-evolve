# agents/

本目录是 `nocode` 的 agent profile 定义源——Claude 发布物中每个 `.md` 文件对应一个可被 `Agent()` 工具以
`subagent_type: "nocode:<name>"` 派发的子代理（`nocode:` 前缀来自 `plugin/metadata.json` 的插件名）。Codex 发布物会把这些定义编译为私有 agent-profile references，由 adapter 选择等价调用方式。
在此目录新增/修改文件时遵守以下约束。

## Frontmatter 字段约定

每个 agent 文件头部 YAML frontmatter 目前包含：

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 与文件名（去 `.md`）一致，即 `subagent_type` 里 `nocode:` 后缀的那部分 |
| `description` | 是 | 单段文字，供 Claude Code 判断是否/何时自动派发该 agent |
| `tools` | 建议填 | 工具白名单，按最小权限选（见下）。省略时继承主对话可用的全量工具集——纯搜索/只读类 agent 建议显式收窄，不要依赖省略 |
| `model` | 可选 | 省略时使用 Claude Code 的默认模型策略（通常继承主对话模型）。仓库现有约定：需要重推理的 review/planning 类 agent（architect / code-reviewer / database-reviewer / security-reviewer / planner / tdd-guide）显式声明 `model: opus`；轻量检索派发类（`semble-search` / `recall-search`）不声明 |

**`description` 的两种写法**，按 agent 是否希望被模型自主触发来选：
- 需要模型看情况自动派发的（review 类）：用 `Use PROACTIVELY when...` / `MUST BE USED for...` 等显式触发语，越具体越好（列出触发场景关键词）。
- 只想被其他 skill/command 主动委派、不希望被模型抢跑的（`recall-search`）：用陈述句说明"谁会调它、为什么要隔离"，不用 PROACTIVELY 语言。

**`tools` 字段目前存在两种写法**，仓库里两种都在用，未强制统一：
- JSON 数组：`tools: ["Read", "Grep", "Glob"]`（architect / code-reviewer / database-reviewer / security-reviewer / planner / tdd-guide 用这种，6 个文件）
- 逗号分隔字符串：`tools: Bash, Read`（`semble-search` / `recall-search` 用这种，2 个文件）

新增 agent 时任选一种即可，两者 Claude Code 均可解析；同一文件内不要混用两种写法。

## 三种 agent 模式

目录内的 agent 按内容组织方式分三类，新增时先判断落在哪一类，再决定怎么写正文：

**1. 薄壳型（thin-shell）**——`architect` / `code-reviewer` / `database-reviewer` / `security-reviewer`。
这类 agent 是 review 场景的直触入口，**不在 agent 文件内联领域清单**（检查项、漏洞模式、Trade-off 框架等），
而是派发到 `skills/reviewing/references/` 共享框架：
- `skeleton.md` —— 通用 review 流程（分档 / 对象界定 / 选方法 / 独立交叉 / 分级 / 收口）
- `methods/<domain>-method.md` —— 领域检查清单（architecture / code-quality / database / security 等）
- `findings-contract.md` —— 统一 findings 输出契约

改这类 agent 覆盖的**评审内容**（比如新增一条安全检查项），去改
`skills/reviewing/references/methods/*.md`，不要往 agent 文件里塞领域清单——那会破坏单源，
导致同一份检查项在多处维护、彼此漂移不可控。agent 文件本身只维护"派发步骤"（读哪些 method card、
什么条件配哪张卡、是否要求异源交叉）。`{NOCODE_SKILL_REF}` 占位符 = `skills/references`（SessionStart 写入的 env）。

**2. 自包含型（self-contained）**——`planner` / `tdd-guide`。这类 agent 的方法论完整内联在文件内
（规划流程模板、TDD 红绿重构循环 + 测试清单），不引用 reviewing 框架，因为它们不是 review 场景。
新增同类 agent（不做评审、有自己完整方法论）时延续这个模式，不必强行套用 reviewing 框架，
但也不要图省事把评审类清单塞进来——先判断是不是 review 场景，是就走薄壳型。

**3. 检索工具型**——`semble-search` / `recall-search`。轻量、职责单一、多由其他 skill/command 主动派发
（而非模型自主判断触发），用于把搜索过程的噪音隔离在子 agent context 里，不污染主 agent 的上下文。
这类 agent 的 `description` 按上面的第二种写法写。

## Fallback 链声明惯例

工具/命令不可用时的降级路径**内联声明在 agent 定义文件正文里**，不走外部注册表或集中配置。
例如 `semble-search.md`：

> If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.

新增依赖外部 CLI/工具的 agent，照此惯例在正文就近声明 fallback，不要假设工具一定存在，
也不要另建一个全局 fallback 配置文件。

## 改动后必须升版本

`agents/` 属于 `CLAUDE.md` 规则 2 里"会被插件加载的文件"范围（`hooks/` / `model/` / `rules/` /
`skills/` / `agents/` / `commands/` / `.claude-plugin/` / `.mcp.json`）。**任何新增/修改/删除 agent 文件都视为插件更新**：

- 编辑 `plugin/metadata.json` 的 `version`、运行 `node scripts/compile.platform.mjs`，按 SemVer 套用到 agent 改动场景：
  - 新增一个 agent 文件 → **minor**（新增能力，向后兼容）
  - 改已有 agent 的正文措辞、派发步骤、工具面调整但不改变对外可见的能力边界 → **patch**
  - 改 `name`（等价于改 `subagent_type`，会破坏其他 skill/command 里对旧名字的引用）、
    删除某个 agent、或大幅收窄工具面导致既有用法失效 → **major**
- 版本变更和 agent 改动放进同一个 commit。
- 完成后复核 `git status` / `git diff` 创建 commit，**不要自动 push**——commit 后向用户明确询问是否需要 push。
- 纯文档修订（比如本文件、`README.md`）不需要升版本，但仍要走 commit + 询问 push 的流程。

## 其他约束

- `tools` 按最小权限声明：纯分析类给 `Read/Grep/Glob`；需要跑诊断命令（如 `git diff`）的加 `Bash`；
  确需直接写文件才加 `Write/Edit`。不要为图方便给全量工具集。
- 注意：当前 `database-reviewer` / `security-reviewer` 的 frontmatter 里带了 `Write, Edit`，
  但两者正文（薄壳派发步骤）都只描述"读 method card → 产出 findings + verdict"，没有描述写文件的场景——
  这可能是从旧版内联全量内容时期遗留的工具面，未随薄壳化收紧。touch 这两个文件时留意此处是否需要一并对齐到最小权限。
- 目录下出现的非 `.md` 杂散文件（例如运行时产生的 `*.log`）不属于 agent 定义，已被根 `.gitignore` 的
  `*.log` 规则排除，无需处理，也不要误当成 agent 清单的一部分。
