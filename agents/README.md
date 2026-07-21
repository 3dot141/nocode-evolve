# agents/

`nocode` 的平台无关 agent profile 单源。编译后，Claude/Codex 都把这些文件放在
`skills/using-nocode/references/agents/`，再由 `using-nocode` 的 workflow domain 选择各平台执行方式。

## 与 skills 的区别

| | `agents/` | `skills/` |
|---|---|---|
| 本质 | 可被 workflow provider 使用的任务角色说明 | 教主 agent"怎么做"的流程指令（`SKILL.md`） |
| 触发方式 | `workflow.execute` task graph 的 `profile` 选中后，由 `using-nocode` 读取 reference 并委派 | 主 agent 按 Skill 步骤执行，可显式或隐式触发 |
| 典型用途 | 需要隔离 context（避免搜索/评审过程的中间噪音污染主对话）、需要不同 model（比如评审用 opus）、或需要并行跑多个独立子任务 | 需要标准化流程但不需要隔离 context 的场景（比如 devflow 各阶段的编排） |
| 调用形态 | `[provider-neutral workflow boundary]` | `[provider-neutral skill boundary]` |

一句话：**agent 是"派个人去干活"，skill 是"教你怎么干活"**。

## Agent 清单

| 名字 | 用途 | 工具面 | model | 风格 |
|---|---|---|---|---|
| `planner` | 复杂功能/重构的实现计划专家——需求拆解、分阶段步骤、风险与依赖识别 | Read, Grep, Glob | opus | 自包含 |
| `tdd-guide` | TDD 方法论执行——测试先行、红绿重构循环、80%+ 覆盖率把关 | Read, Write, Edit, Bash, Grep | opus | 自包含 |
| `semble-search` | 语义代码搜索——按意图/符号定位实现，优先于 Grep/Glob 用于探索式提问 | Bash, Read | 默认 | 检索工具 |
| `recall-search` | 检索 wiki/vault 中已沉淀内容，供 `/recall` command 委派，避免搜索过程污染主 agent context | Bash, Read | 默认 | 检索工具 |

评审类能力不再维护重复的 agent 薄壳，统一由 `reviewing` Skill 及其领域方法 references 提供。现有 profile 分为
**自包含型**（planner/tdd-guide）和**检索工具型**（semble-search/recall-search）；具体约定见同目录 `AGENTS.md`。

## 调用方式

```
[provider-neutral workflow boundary]
```

调用方在 `workflow.execute` 的 task graph 里填写 `profile: "<agent-name>"`。`using-nocode` 读取对应 reference，
把 profile 指令和具体 objective 一起交给 Claude Task 或 Codex agents provider；不可用时只按 workflow reference 中明确列出的方式降级。

## 新增/修改前必读

改这个目录下任何文件都要在同一个 commit 里升级 `plugin/metadata.json` 的 `version`，并运行 `node scripts/compile.platform.mjs`
（`CLAUDE.md` 规则 2：`agents/` 属于插件加载的文件范围）。具体版本分类规则、frontmatter 字段写法、
两种 agent 模式的判断标准、fallback 声明惯例，见同目录 `AGENTS.md`。
