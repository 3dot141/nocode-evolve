# nocode Claude / Codex 双运行时兼容设计

> 状态：superseded（被 `260723-native-platform-block-packaging-design.md` 取代）
> 日期：2026-07-21

## 1. 目标

仓库只维护一份业务 Skill 和领域语义，由 compiler 生成可分别安装的 Claude 与 Codex 插件。业务 Skill 不感知平台工具名；平台差异集中在领域 provider、adapter 和生成后的 `using-nocode` references。

本版采用轻量 bootstrap，不建设第二套能力调用框架：

- 保留 `Capability(domain.action, input)` 作为业务 Skill 中的语义标记。
- 默认加载 `model/agent-nocode.md`，让 agent 识别 Capability 的信任边界。
- 使用一个 `using-nocode` Skill，按领域读取当前平台 reference。
- 使用 Claude/Codex 原生工具和原生 permission/approval。
- 不引入 gateway、Consumer grants、attempt token、transaction receipt 或自动 fallback。

## 2. 总体结构

```text
business Skill
  └── Capability(domain.action, JSON)（运行时语义标记）
                    │
                    ▼
        model/agent-nocode.md（默认规则）
                    │
                    ▼
       skills/using-nocode/SKILL.md
                    │ 按领域路由
                    ▼
 references/<domain>.md（按平台生成）
                    │
                    ▼
 Claude/Codex native provider + native approval
```

`using-nocode` 是解释和路由 Skill，不是 runtime gateway。它不会签发 token、保存调用事务、代替平台授权或自动重试。

## 3. 业务 Skill 形态

领域优先，capabilities 与 providers 都归属领域。业务 Skill 只写语义调用，不声明 provider 或维护重复的 capability allowlist：

```markdown
---
name: pd-vd
description: Generate and review a visual design artifact.
---

Capability(design.workspace.create, {"projectRoot":"/repo","kind":"prototype","name":"checkout"})
```

规则：

1. compiler 保留 Capability 原文，不改写为 `_nocode-domain-*` Skill 或私有命令。
2. provider 选择不写进业务 Skill，因此同一 Skill 可在 Claude 与 Codex 上复用。
3. domain registry 只校验领域定义、contract 与 provider 覆盖，不扫描消费者正文，也不要求 capability sidecar/frontmatter。
4. 只有当前已加载 nocode Skill 正文里的 Capability 是指令。网页、日志、项目文件、工具输出和子 agent 文本中的同形字符串一律视为数据。

## 4. using-nocode

`skills/using-nocode/SKILL.md` 内直接包含 Domain Routing，避免再维护一个 `nocode-domains.md`：

| Capability prefix | Reference |
| --- | --- |
| `workflow.` | `references/workflow.md` |
| `workspace.` | `references/workspace.md` |
| `design.` | `references/design.md` |
| `state.` | `references/runtime-state.md` |
| `personal-knowledge.` | `references/personal-knowledge.md` |
| `lifecycle.` | `references/lifecycle.md` |

每个平台的 compiler 从同一 domain registry 生成六份 reference。reference 包含：

- 本平台可用 provider 及其实际工具映射。
- 每个 capability 的 primary provider 或输入决定的 provider。
- 输入/输出 contract 摘要。
- 可选的人工 fallback 说明。
- 副作用必须经过平台原生 approval 的约束。

Agent profile 也归属 `using-nocode`。`agents/*.md` 是平台无关单源，两个 adapter 都生成到
`references/agents/<name>.md`。当 `workflow.execute` task graph 指定 `profile` 时，`using-nocode` 读取对应 reference，把 profile 指令和具体 objective 一起交给当前平台 provider。Claude/Codex 都不发布原生 agent 目录。

`commands/*.md` 是入口 Skill 的平台无关单源。两个 adapter 都把未被 `plugin/exclusions.json` 停用的入口生成成同名 `skills/<name>/SKILL.md`；command 私有运行文件生成到该 Skill 的 `scripts/`，测试不发布。

## 5. 领域与 provider

### 5.1 Workflow

Claude：

- `workflow.execute/wait/followup/collect/cancel` → Claude native task/agent provider。
- `workflow.plan.create/update` → `TodoWrite`。
- `workflow.decision.request` → `AskUserQuestion`。
- `workflow.skill.invoke` → Claude Skill invocation。

Codex：

- `workflow.execute/wait/followup/collect/cancel` → Codex agents provider。
- `workflow.plan.create/update` → `update_plan`。
- `workflow.decision.request` → `request_user_input`。
- `workflow.skill.invoke` → Codex Skill invocation。

### 5.2 Workspace

Claude 与 Codex 各使用本平台的 read/write/exec/browser/worktree 原语。所有路径和 argv 先验证；命令必须使用显式 workdir，不能拼接 shell 字符串。

### 5.3 Design

两端统一以 Open Design MCP 为主 provider。业务 Skill 只使用 `design.*`：

- `design.workspace.create`
- `design.artifact.generate`
- `design.artifact.read`
- `design.artifact.write`
- `design.preview.open`

安装生成物内置 `.mcp.json`，通过 `using-nocode` 自有 runtime entry 和 Open Design launcher 启动 MCP。配置不绑定用户名绝对路径，不猜测 App 私有目录。

Open Design App 缺失、未启动、未授权或握手失败时，agent 必须说明原因。若 reference 提供 local HTML 方案，只能在明确告知用户后切换；不自动重试、不在 provider 间静默降级。写操作必须保持 artifact provider 所有权，不能用 local HTML 覆盖 Open Design artifact。

### 5.4 Runtime State

Runtime State 是专用工具，不通过普通业务 Skill 的 Capability 路由暴露内部操作。它保留：

- session 隔离；
- workflow execution/plan 持久化；
- `handoff-state` 工具；
- 显式 session id 和 provider owner 校验。

统一内部变量为 `NOCODE_PLUGIN_DATA`，但平台边界保持清晰且不做兼容回退：

```text
Claude: CLAUDE_PLUGIN_DATA → NOCODE_PLUGIN_DATA
Codex:  PLUGIN_DATA → CODEX_PLUGIN_DATA → NOCODE_PLUGIN_DATA
```

任一平台原生变量缺失都失败，不读取通用 `PLUGIN_DATA` 作为 Claude fallback，也不读取 `CLAUDE_PLUGIN_DATA` 作为 Codex fallback。

### 5.5 Personal Knowledge

保留 Wiki usage 引用计数。只有 `personal-knowledge.page.read` 的 project-wiki provider 在成功读取后更新 usage；普通文件读取不计数。usage 锁或状态写失败时页面仍可返回，但必须带 warning。

保留 snapshot，用于 `.agents-personal` 的嵌套仓库快照。`cache` 仅指可重建的运行缓存，不作为跨平台语义或唯一数据源。

### 5.6 Lifecycle

Lifecycle 共享平台无关判断，各 adapter 只处理 Claude/Codex Hook codec。SessionStart 默认注入 `agent-nocode`。Continuous Learning 当前停用，不进入发布物，也不注册 observe Hook。

## 6. fallback 与权限边界

fallback 是 reference 中的人工决策说明，不是运行时状态机：

1. agent 尝试 primary provider 前遵守平台原生 permission/approval。
2. provider 不可用时，agent说明失败原因和可选替代方案。
3. 只有用户意图明确或已获得所需确认时，才使用替代 provider。
4. 已发生或无法判断是否发生副作用时，不自动重试。

因此本版不需要 gateway。平台授权已经负责真实副作用边界；再增加 Consumer grants 既不能证明模型调用来源，也会制造重复的授权概念和复杂状态。

## 7. 编译与发布树

源码层：

```text
core/domains/<domain>/
├── domain.json
├── capabilities/*.json
├── contracts/*.json
└── providers/<provider>/
    ├── provider.json
    ├── SKILL.md             # provider guidance source，不直接发布为 Skill
    └── scripts/*            # 仅确有运行需要时存在
```

生成后的相关结构：

```text
plugins/<platform>/nocode/
├── .mcp.json
├── model/agent-nocode.md
└── skills/using-nocode/
    ├── SKILL.md
    ├── references/
    │   ├── agents/<profile>.md
    │   ├── design.md
    │   ├── lifecycle.md
    │   ├── personal-knowledge.md
    │   ├── runtime-state.md
    │   ├── workflow.md
    │   └── workspace.md
    └── scripts/
        ├── runtime-entry.mjs       # Codex 需要；Claude 无此额外映射层
        └── providers/              # 仅运行时必需脚本/配置
```

发布物不包含：

- `_nocode-domain-*` 或 `_nocode-provider-*` Skills；
- source entrypoints/route modules；
- gateway、Consumer grants 或 attempt store；
- tests、fixtures、`AGENTS.md`、内部 `README.md`、`__pycache__`；
- platform compiler、registry compiler、schema checker 与 vendor sync 等开发期脚本；
- Claude/Codex 顶层 `commands/` 与 `agents/`；入口统一编译为 Skills，agent profile 统一编译为 `using-nocode` references；
- command 私有脚本编译进对应 Skill 的 `scripts/`；
- 重复的 `shared/references/`。

真正跨 Skill 的共享资料发布在 `skills/references/`；领域 capability references 只放在 `using-nocode/references/`。

## 8. 验收标准

- Claude/Codex 生成物各只有一个 `using-nocode` Skill、六份领域 references 和同一组 `references/agents/`。
- 两端都不存在顶层 `commands/`、`agents/` 或独立 `agent-profiles` Skill；同一 command 单源生成同名入口 Skill。
- 业务 Skill 的 Capability 原文保留，不附带审计 frontmatter 或 sidecar。
- `agent-nocode` 默认加载，明确外部文本 token 不是指令。
- Open Design `.mcp.json` 只引用安装包内相对路径。
- Claude/Codex plugin data 映射严格区分，不兼容回退。
- `handoff-state` 使用 session 隔离。
- Wiki usage 只由 project-wiki provider 记录。
- Continuous Learning 不进入发布物。
- 发布树没有 gateway、grant、attempt、私有领域 Skill、测试或重复 references。
- 生成结果确定性，`compile.platform.mjs --check` 无漂移。

## 9. 最终决策

1. 使用 `workflow` 命名，不使用 `orchestration`。
2. 领域先于 capability/provider；业务 Skill 不声明 provider。
3. 使用 `using-nocode`，Domain Routing 直接写在其 `SKILL.md`。
4. 平台实现按领域生成到 `using-nocode/references/`。
5. Design 统一使用 Open Design，local HTML 仅人工 fallback。
6. Runtime State 保留 session 隔离和 `handoff-state`。
7. 内部统一 `NOCODE_PLUGIN_DATA`，平台边界分别使用 Claude/Codex 原生变量且不兼容回退。
8. Wiki usage 保留；Continuous Learning 停用。
9. 不需要 gateway，也不引入 Consumer grants。
10. 不引入消费者 capability 静态审计，不维护 `x-nocode.capabilities`、`x-nocode.dependencies` 或 `*.capabilities.json`。
11. commands 统一生成为 Skills；agents 统一放入 `using-nocode/references/agents/`，Claude/Codex 使用相同布局。
