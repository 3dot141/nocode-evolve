# agents/

`nocode` 插件的 subagent 定义目录——Claude Code `Agent()` 工具里 `subagent_type: "nocode:<name>"` 的发现源。
每个 `.md` 文件是一个独立的子代理：有自己的系统提示词、可选的工具白名单、可选的模型覆盖，
运行在与主对话隔离的独立 context 里，跑完把结果返回给派发方。

## 与 skills 的区别

| | `agents/` | `skills/` |
|---|---|---|
| 本质 | 可被**派发**的独立执行单元——有自己的 context、工具面、可选 model | 教主 agent"怎么做"的流程指令（`SKILL.md`），不独立起 context |
| 触发方式 | 主 agent 判断后用 `Agent()` 工具起一个新 subagent，跑完拿到结果 | 主 agent 自己按 skill 里的步骤走，全程留在主 context |
| 典型用途 | 需要隔离 context（避免搜索/评审过程的中间噪音污染主对话）、需要不同 model（比如评审用 opus）、或需要并行跑多个独立子任务 | 需要标准化流程但不需要隔离 context 的场景（比如 devflow 各阶段的编排） |
| 调用形态 | `Agent(subagent_type: "nocode:code-reviewer", prompt: "...")` | `Skill(skill: "nocode:dev-review")` |

一句话：**agent 是"派个人去干活"，skill 是"教你怎么干活"**。

## Agent 清单

| 名字 | 用途 | 工具面 | model | 风格 |
|---|---|---|---|---|
| `architect` | 架构评审入口——系统设计、可扩展性、技术选型决策；也用于新功能/重构的架构设计提案 | Read, Grep, Glob | opus | 薄壳（派发到 reviewing 框架） |
| `code-reviewer` | 代码评审入口——质量/安全/性能/最佳实践，改完代码后建议必用 | Read, Grep, Glob, Bash | opus | 薄壳 |
| `database-reviewer` | PostgreSQL 专项评审——查询优化、schema 设计、RLS 安全、性能（含 Supabase 最佳实践） | Read, Write, Edit, Bash, Grep, Glob | opus | 薄壳 |
| `security-reviewer` | 安全漏洞评审——OWASP Top 10、密钥泄露、注入、SSRF、不安全加密 | Read, Write, Edit, Bash, Grep, Glob | opus | 薄壳 |
| `planner` | 复杂功能/重构的实现计划专家——需求拆解、分阶段步骤、风险与依赖识别 | Read, Grep, Glob | opus | 自包含 |
| `tdd-guide` | TDD 方法论执行——测试先行、红绿重构循环、80%+ 覆盖率把关 | Read, Write, Edit, Bash, Grep | opus | 自包含 |
| `semble-search` | 语义代码搜索——按意图/符号定位实现，优先于 Grep/Glob 用于探索式提问 | Bash, Read | 默认 | 检索工具 |
| `recall-search` | 检索 wiki/vault 中已沉淀内容，供 `/recall` command 委派，避免搜索过程污染主 agent context | Bash, Read | 默认 | 检索工具 |

"风格"三分类的具体约定（薄壳型怎么派发、自包含型怎么写、检索工具型怎么隔离）见同目录 `AGENTS.md`。
简单说：**薄壳型**（architect/code-reviewer/database-reviewer/security-reviewer）统一派发到
`skills/references/reviewing/` 共享评审框架，不在 agent 文件里重复内联检查清单；**自包含型**
（planner/tdd-guide）把方法论完整写在 agent 文件内；**检索工具型**（semble-search/recall-search）
职责单一、多由其他 skill/command 主动委派，而不是模型自主判断触发。

## 调用方式

```
Agent(subagent_type: "nocode:code-reviewer", description: "评审本次改动", prompt: "...")
```

`subagent_type` 前缀 `nocode:` 来自插件名（`.claude-plugin/plugin.json` 的 `name` 字段），
安装插件后 Claude Code 会自动以 `<plugin>:<agent-name>` 的形式注册每个 `agents/*.md`。
具体 prompt 该怎么写（要不要带上下文、是否要求独立验证）参考各 agent 文件里的"派发步骤"小节，
以及仓库根 `README.md` 里关于插件整体架构的说明。

## 新增/修改前必读

改这个目录下任何文件都要在同一个 commit 里升级 `.claude-plugin/plugin.json` 的 `version`
（`CLAUDE.md` 规则 2：`agents/` 属于插件加载的文件范围）。具体版本分类规则、frontmatter 字段写法、
三种 agent 模式的判断标准、fallback 声明惯例，见同目录 `AGENTS.md`。
