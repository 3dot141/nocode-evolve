# nocode Codex 语义兼容补救设计

> 状态：approved（等待实施计划与实现）
>
> 日期：2026-07-20
>
> 目标版本：14.0.0
>
> 前置设计：`260720-claude-codex-dual-runtime-design.md`
>
> 本文取代前置设计中“扁平 capability contract + Markdown 字符串 renderer 已足以完成双运行时迁移”的结论。前置设计保留为历史背景，提交 `689cc25` 只作为 draft implementation，不是可发布版本。

## 1. 罗盘

### 1.1 问题

当前分支已经能确定性生成 Claude 与 Codex 两套插件，manifest、目录结构、基础 Hook codec 和静态检查也能通过。但生成成功只证明“文件形状合法”，没有证明“业务流程在目标平台可执行”。

已确认的代表问题：

- Codex 产物包含 `claude-design` Skill，但真实实现依赖 `mcp__claude_design__*` 和 DesignSync；复制 Skill 没有带来底层能力。
- `pd-vd`、`dev-design` 和共享文档渲染仍含 Claude Design、Artifact、`artifact-design` 等 Claude 专属语义。
- `research-workflow` 仍调用 Claude `Workflow()`，Codex 没有同名调度能力。
- capability contract 只覆盖 Skill、agent、plan 和 Hook 等十项基础动作，没有覆盖外部设计服务、文档发布、workflow、个人知识和可写状态。
- Codex `Stop` 已有官方生命周期能力，但当前 adapter 仍按旧假设删除 Stop Hook。
- Continuous Learning 自动采集大量 observation，却没有产生 instinct/evolved 输出；Codex 版本还沿用 Claude 数据目录和 payload 假设。
- 静态 checker 只检查少数残留词，不能证明 provider、MCP、外部 Skill 或运行时变量真实可用。
- 真实 Claude/Codex 客户端安装 smoke 仍是 manual pending。

根因不是“还缺几个替换规则”，而是当前架构以 capability 为扁平词汇表、以 adapter 为文本替换器，没有先建立领域，再由领域拥有 capabilities、providers、contracts 和 tests。

### 1.2 目标

1. 把双运行时架构改为领域优先：Domain → Capabilities / Providers / Contracts / Tests。
2. 业务 Skill 只描述领域语义，不直接调用平台工具或 provider。
3. Claude 与 Codex 的视觉设计和文档可视化统一使用 Open Design，失败时降级为本地 HTML。
4. workflow 领域统一表达任务图；Claude、Codex 和主会话分别提供执行 provider。
5. runtime-state 领域统一向业务暴露 `NOCODE_PLUGIN_DATA`，平台原生变量只存在于 provider/adapter 边界。
6. handoff 状态按 session 显式保存，Stop Hook 不再解析 transcript。
7. 个人 Wiki 读取与引用计数统一走 `wiki-read`，不依赖 Claude `Read` Hook。
8. 全量审计 Skills、Commands、Agents、Hooks 和 Scripts 的平台及外部能力依赖。
9. 无 provider、无 fallback、又未显式 excluded 的能力在编译期失败。
10. 真实双客户端 smoke 成为发布 Gate，不再以 validator 或静态测试替代运行验收。

### 1.3 成功标准

- 业务源码中的每个外部动作都能追溯到一个领域 capability。
- 每个 capability 在目标平台都有 primary provider、fallback 或显式 exclusion。
- 业务源码不包含可执行的 Claude/Codex 专属工具调用。
- Open Design 在 Claude/Codex 中使用同一领域 provider 和同一结果 contract。
- Open Design 未安装、未启动或未授权时，声明了 fallback 的设计流程能自动产出本地 HTML 和降级回执。
- Claude workflow provider、Codex agents provider 与 inline provider 返回同一结果 contract。
- 所有业务状态脚本只读取 `NOCODE_PLUGIN_DATA`。
- handoff Stop 在两个平台都使用 session 状态文件，不依赖 transcript 格式。
- `wiki-read` 在两个平台都使用同一个入口完成“读取页面 + best-effort 引用计数”，计数更新自身使用原子写。
- Continuous Learning 不进入默认双平台发布物，也不注册 observation Hook。
- 编译器能拒绝未声明 capability、悬空 provider、缺 fallback、provider 环、平台工具泄漏和非法状态变量访问。
- Claude/Codex 的真实安装、Open Design、HTML fallback、workflow、handoff、Wiki usage 和状态隔离 smoke 全部通过。

### 1.4 非目标

- 不自动安装 Open Design App。
- 不为 Open Design 新建设置 UI；安装、探测和降级只补充 README。
- Open Design launcher 首版不猜测 Windows/Linux 的安装结构，只正式支持 macOS。
- 不把 Markdown 业务流程重写成通用 YAML 工作流引擎。
- 不让 runtime-state 接管 `.agents-personal`、Open Design 项目或目标项目自己的缓存。
- 不自动迁移或删除旧 plugin data、`~/.claude/homunculus`、`.agents-personal` 历史。
- 不在本次重新设计 Continuous Learning；它作为后续独立议题。
- 不在本文阶段修改插件代码、重写 git 历史或 push。

## 2. 方案比较与决策

### 2.1 方案 A：增强字符串 renderer

继续向 `adapters/codex/content.mjs` 增加替换：Claude Design → Open Design、Artifact → Open Design、Workflow → agents。

优点是改动小。缺点是只能处理已知词汇，无法验证实际工具、MCP、状态目录和输入输出语义；复杂流程也不能通过字符串替换保证行为一致。

结论：拒绝。

### 2.2 方案 B：领域能力图 + Provider Adapter

先定义领域；领域拥有 capability、provider、contract 和 test。业务消费者依赖 capability，编译器为目标平台解析 provider 链。

优点：

- 能静态证明能力闭环。
- 平台工具集中在 provider 内。
- fallback、exclusion 和动态 preflight 有统一语义。
- 可以逐领域迁移，保留单份业务正文。

代价是需要做一次全量能力审计，并升级现有编译器。

结论：选定。

### 2.3 方案 C：两套独立业务插件

Claude/Codex 各自维护完整 Skill，只共享脚本和测试。平台表达最直接，但大型业务正文必然分叉，长期维护成本最高。

结论：拒绝。

## 3. 总体架构

```text
业务源码
Skills / Commands / Agents / Hooks / Scripts
        │
        │ 只依赖 Domain Capability
        ▼
core/domains/
├── design/
├── workflow/
├── runtime-state/
├── personal-knowledge/
├── lifecycle/
└── workspace/
        │
        │ Domain 自己解析 provider / fallback
        ▼
Platform Compiler
├── Claude adapter
└── Codex adapter
        │
        ▼
plugins/claude/nocode/
plugins/codex/nocode/
```

职责顺序固定为：

```text
Domain 定义领域边界
Capability 定义领域能做什么
Provider 定义如何实现领域能力
Contract 定义输入、输出和错误
Adapter 处理平台装配与原生协议
Compiler 解析依赖并生成发布物
```

全局层只保留领域索引和编译编排，不维护扁平 provider 大表。

## 4. 领域模型

### 4.1 标准目录

```text
core/domains/<domain>/
├── domain.json
├── capabilities/
│   └── <capability>.json
├── contracts/
│   └── <contract>.schema.json
├── entrypoints/
│   └── <capability>/
│       ├── SKILL.md
│       └── route.mjs
├── providers/
│   └── <provider>/
│       ├── provider.json
│       ├── SKILL.md
│       └── scripts/
└── tests/
```

每个单元必须能独立回答：

- Domain：负责什么，不负责什么？
- Capability：输入、结果和错误是什么？
- Provider：实现哪些 capability，支持哪些平台？
- Contract：消费者不读 provider 内部时能否理解结果？
- Tests：provider 是否满足领域 contract？

`entrypoints/` 是 capability 的唯一运行时入口；它根据已编译的 provider 链进行 preflight、输入/输出 schema 校验和 fallback，不包含业务方法论。

### 4.2 领域规则

- 一个 capability 只能归属一个领域。
- 一个 provider 只能由一个领域拥有。
- provider 可以依赖其它领域的 capability，但不能直接调用其它领域的 provider。
- 业务消费者可以依赖多个领域 capability，但不能依赖 provider。
- 禁止建立 `common`、`utils`、`misc` 领域。
- 只有出现新的外部边界、共享 contract 或多 provider 需求时才新增领域；不为每个 Skill 单独建领域。
- 领域依赖必须是有向无环图。

### 4.3 Capability 声明

业务 Skill 在 frontmatter 列出依赖：

```yaml
---
name: pd-vd
description: ...
x-nocode:
  capabilities:
    - design.artifact.generate
    - design.artifact.read
    - workspace.browser.verify
---
```

完整业务正文继续保留视觉方法、Gate、步骤、质量标准和 handoff，只把平台动作改成有限语义 token：

```text
Capability(design.artifact.generate)
Capability(design.artifact.read)
```

约束：

- 正文使用的 capability 必须在 frontmatter 声明。
- 声明不存在的 capability 是编译错误。
- 声明但未使用默认 warning。
- `x-nocode` 是源码元数据；生成物可按平台 schema 保留或移除。
- 平台 renderer 只解析明确 token 和 adapter 模板，不自由改写普通业务正文。

### 4.4 消费者声明与审计范围

不同源码类型使用确定性的声明位置：

| 消费者 | capability 声明 |
|---|---|
| `skills/**/*.md`、`commands/**/*.md`、`agents/**/*.md`、`rules/**/*.md`、非生成 `model/**/*.md` | 文件 frontmatter 的 `x-nocode.capabilities` |
| 发布根下任意层级的 `*.mjs/js/cjs/ts/sh/bash/py/rb` 可执行文件 | 同目录同名 `<file>.capabilities.json` sidecar；如 `foo.py.capabilities.json` |
| 由 rule/compiler 生成的 catalog、Hook JSON 和平台产物 | 继承源文件的声明，只做生成物泄漏检查，不反向建第二份单源 |
| 顶层 `references/`、`skills/references/` 与 `skills/**/references/` | 被动参考材料，不单独声明；仍扫描平台可执行语法，出现调用则失败并要求上移到消费者 |

审计包含 `skills/`、`commands/`、`agents/`、`rules/`、`model/`、`hooks/`、`scripts/`、顶层 `references/` 及上述根下的嵌套脚本与 references。扫描由发布 allowlist 驱动，不只按顶层目录或两种 JavaScript 扩展名。`docs/`、`tests/`、`vendor/` 和明确标记的 fixture 不是发布消费者；对它们只做秘密与生成物漂移类通用检查。

### 4.5 Provider 解析

以 `pd-vd` 为例：

```text
pd-vd
  requires design.artifact.generate
        ↓
design domain
        ↓
primary: open-design
fallback: local-html
        ↓
生成目标平台的 design domain entry
```

编译后由平台 adapter 把领域入口渲染为对应 Skill 调用表达；业务源码不知道 `$open-design`、MCP 工具名或 HTML provider 细节。

每个 capability 编译为一个私有领域 Skill：

```text
skills/_nocode-domain-<domain>-<action>/SKILL.md
skills/_nocode-domain-<domain>-<action>/scripts/route.mjs
```

`Capability(domain.action, <json-input>)` 只被改写为目标平台对该私有 Skill 的显式调用。`route.mjs` 从编译后的领域 resolution 读取 primary/fallback，按以下固定算法执行：

1. `route.mjs select` 校验 capability 输入 schema。
2. 它按 resolution 顺序执行 provider preflight，输出唯一 selected provider 及已校验输入。
3. primary unavailable 时，只有 capability 声明 fallback 才能选 fallback；否则返回 `provider_unavailable`。
4. 领域 entry Skill 按 selected provider 的生成指令执行平台工具，再将结果交给 `route.mjs validate`。
5. `validate` 校验 provider 输出 schema，将 provider 错误映射为领域错误，并返回统一 receipt；不向消费者暴露 provider 私有 payload。

provider Skill 的平台工具调用仍由 agent 执行；router 只负责可确定的选择、校验与回执，不伪装成可直接执行 MCP 的 Node 进程。

provider 每次尝试都必须返回 attempt envelope：

```json
{
  "attemptId": "opaque-id",
  "status": "succeeded | failed",
  "committed": false,
  "retrySafe": true,
  "result": null,
  "error": null
}
```

`validate` 对执行期失败使用 capability 的 `fallbackOn` 策略：

- `preflight-unavailable`：只在调用前降级。
- `failed-before-commit`：除 preflight 外，只在 envelope 明确 `committed=false && retrySafe=true` 时尝试下一 provider。
- `never`：不降级。

`committed=true` 或无法判定时禁止自动重试/跨 provider 降级，返回 `PROVIDER_OUTCOME_AMBIGUOUS` 与可用的 `resultRef`，要求读取/核对现有产物。create/generate 可使用 `failed-before-commit`；read/preview 可重试；write 默认 `never`。这保证 handshake/授权在未写入前失败可转 HTML，但已可能生成的产物不会被重复创建。

## 5. 首版领域

### 5.1 Design

负责设计 workspace、设计产物和预览，不负责 agent 调度、插件状态或文件系统原语。

Capabilities：

```text
design.workspace.create
design.artifact.generate
design.artifact.read
design.artifact.write
design.preview.open
```

Providers：

```text
open-design
local-html
```

### 5.2 Workflow

负责执行有依赖关系的任务图，不负责 research、review、build 等业务规则。

Capabilities：

```text
workflow.skill.invoke
workflow.execute
workflow.wait
workflow.followup
workflow.collect
workflow.cancel
workflow.plan.create
workflow.plan.update
workflow.decision.request
```

Providers：

```text
claude-native
codex-agents
inline
claude-control
codex-control
```

### 5.3 Runtime State

只负责 nocode 插件 session 状态。

Capabilities：

```text
state.session.open
state.session.close
state.execution.create
state.execution.read
state.execution.update
state.execution.cleanup
state.handoff.open
state.handoff.complete
state.handoff.abandon
state.handoff.status
state.cleanup
```

Providers：

```text
claude-plugin-data
codex-plugin-data
```

### 5.4 Personal Knowledge

负责项目 `.agents-personal` 的页面读取、引用计数和版本快照。

Capabilities：

```text
personal-knowledge.page.read
personal-knowledge.usage.record
personal-knowledge.snapshot
```

Provider：

```text
project-wiki
```

### 5.5 Lifecycle

负责生命周期事件和平台 Hook codec，不拥有业务状态。

Capabilities：

```text
lifecycle.session-start
lifecycle.plan-change
lifecycle.pre-tool
lifecycle.post-tool
lifecycle.stop
```

Providers：

```text
claude-hooks
codex-hooks
```

### 5.6 Workspace

负责本地文件、命令和浏览器验证等基础执行能力。

Capabilities：

```text
workspace.read
workspace.write
workspace.exec
workspace.browser.verify
workspace.worktree.current
workspace.worktree.create
workspace.worktree.enter
```

Providers：

```text
claude-workspace
codex-workspace
```

### 5.7 旧 Contract 迁移表

`core/capabilities/contract.json` 不再作为新架构的扁平单源。其全部现有 capability 必须按下表迁移后才能删除：

| 旧 capability | 新归属 | 说明 |
|---|---|---|
| `skill.invoke` | `workflow.skill.invoke` | 调用另一个业务 Skill；领域私有 entry Skill 的编译调用属 adapter 内部，不再次声明 |
| `agent.dispatch` | `workflow.execute` | 单任务作为只含一个 task 的 graph |
| `agent.wait` | `workflow.wait` | 等待 execution handle |
| `plan.create` | `workflow.plan.create` | 创建带结构化 marker 的计划项 |
| `plan.update` | `workflow.plan.update` | 更新计划项与 handoff 状态输入 |
| `user.ask` | `workflow.decision.request` | 流程中需要用户选择才能继续的 decision gate |
| `workspace.enter` | `workspace.worktree.enter` | 切换或显式绑定已验证 worktree |
| `hook.session_context` | `lifecycle.session-start` | SessionStart codec 与上下文装配 |
| `hook.pretool_decision` | `lifecycle.pre-tool` | PreToolUse codec 与平台决策语义 |
| `hook.stop_decision` | `lifecycle.stop` | 两平台都使用官方 Stop 能力与 session handoff 状态 |

审计时新发现的 worktree create/current 使用分别归属 `workspace.worktree.create/current`。普通文件、shell 和浏览器是 workspace 原语；网络/MCP/外部 Skill 只有形成共享 contract 或多 provider 时才新建领域，否则必须作为现有领域 provider 依赖或显式 exclusion。不为每条命令新建 capability。

## 6. Design 领域实现

### 6.1 统一 Open Design

Claude 和 Codex 都使用 Open Design，不再保留 Claude Design、DesignSync 或 Claude Artifact 交付线。

三种产物共享同一 provider：

```text
kind: design-system
kind: prototype
kind: document
```

统一结果 contract：

```json
{
  "provider": "open-design",
  "workspace": {
    "type": "project",
    "ref": "opaque-id"
  },
  "artifact": {
    "kind": "prototype",
    "localPath": "path/to/artifact",
    "previewUrl": "https://..."
  },
  "degraded": false,
  "degradedFrom": null,
  "warnings": []
}
```

Local HTML fallback 返回同构结果：

```json
{
  "provider": "local-html",
  "workspace": {
    "type": "directory",
    "ref": "path/to/output"
  },
  "artifact": {
    "kind": "prototype",
    "localPath": "path/to/prototype.html",
    "previewUrl": null
  },
  "degraded": true,
  "degradedFrom": "open-design",
  "reason": "Open Design app not found",
  "warnings": []
}
```

调用方只消费 contract，不按 provider 分支读取私有字段。

`contracts/design-result.schema.json` 规定顶层必填字段为 `provider`、`workspace`、`artifact`、`degraded`、`degradedFrom` 和 `warnings`。`workspace` 必须含 `type/ref`；`artifact` 在 workspace-only 操作可为 `null`，非空时必须含 `kind/localPath/previewUrl`。`previewUrl` 与 `degradedFrom` 可为 `null`；`reason` 在 `degraded=true` 时必填。

各 capability 的输入和 fallback 固定为：

| Capability | 必填输入 | Primary | Fallback |
|---|---|---|---|
| `design.workspace.create` | `projectRoot`, `kind`, `name` | Open Design project | local output directory；`failed-before-commit` |
| `design.artifact.generate` | `workspaceRef`, `kind`, `brief`, `outputDir` | Open Design artifact | local HTML artifact；`failed-before-commit` |
| `design.artifact.read` | 完整 `artifactRef` receipt | receipt 所属 provider | 仅在 receipt 有可读 `localPath` 时用 local reader |
| `design.artifact.write` | 完整 `artifactRef` receipt，`content` 或 `patch` | receipt 所属 provider | 无跨 provider fallback；`never` |
| `design.preview.open` | 完整 `artifactRef` receipt | receipt 所属 provider | 仅在 receipt 有可打开 `localPath` 时用 local browser/file preview |

`artifactRef` 首版只接受完整、经 schema 校验的 receipt，不接受裸 provider ID，也不引入 ID registry。read/write 不会把 Open Design 产物悄悄改为 HTML；read/preview 的 local fallback 只消费 receipt 中已物化的 `localPath`，不改变产物所属 provider。create/generate 仅在未 commit 时可选新 provider。领域错误统一返回 `code`、`capability`、`provider`、`retryable`、`message`、`detailsRef`，`detailsRef` 不含敏感 payload。

### 6.2 MCP 配置所有权

Open Design provider 拥有 MCP 源模板：

```text
core/domains/design/providers/open-design/mcp.template.json
core/domains/design/providers/open-design/scripts/launch.mjs
```

平台发现要求 `.mcp.json` 位于最终插件根目录，因此 compiler 负责提升并渲染：

```text
plugins/claude/nocode/.mcp.json
plugins/codex/nocode/.mcp.json
plugins/<platform>/nocode/scripts/open-design-launch.mjs
```

如果平台 manifest 需要显式声明 MCP 配置路径，由对应 adapter 生成。业务 Domain 不直接维护平台 manifest。

### 6.3 macOS Launcher

MCP 配置不写用户绝对路径，而是调用 provider launcher。launcher 首版探测顺序：

1. `NOCODE_OPEN_DESIGN_APP_PATH` 指定的 App 路径。
2. `/Applications/Open Design.app`。
3. `~/Applications/Open Design.app`。

找到 App 后，launcher 按 layout contract v1 校验：

```text
Helper: Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper
CLI:    Contents/Resources/app/prebundled/daemon/daemon-cli.mjs
argv:   [<CLI absolute path>, "mcp"]
env:    ELECTRON_RUN_AS_NODE=1
        OD_DATA_DIR=~/Library/Application Support/Open Design/namespaces/<namespace>/data
        OD_SIDECAR_IPC_PATH=/tmp/open-design/ipc/<namespace>/daemon.sock
```

namespace 默认为 `release-stable`，可用 `NOCODE_OPEN_DESIGN_NAMESPACE` 覆盖；覆盖值只允许字母、数字、点、下划线和连字号。`.mcp.json` 不复制上述用户路径，而是经平台 entry 调用生成的 `open-design-launch.mjs`；entry 解析 plugin root 并传入 launcher。

launcher 以 stdio 启动 MCP server，并将失败归一为 `OD_APP_NOT_FOUND`、`OD_LAYOUT_UNSUPPORTED`、`OD_DATA_DIR_UNAVAILABLE`、`OD_IPC_UNAVAILABLE`、`OD_HANDSHAKE_FAILED` 或 `OD_AUTH_REQUIRED`。App 更新后若不再满足 layout v1，必须返回 `OD_LAYOUT_UNSUPPORTED` 并降级，不搜索 App 内其它相似文件。它不得：

- 下载或安装 Open Design。
- 写死用户名。
- 修改 Open Design 用户项目。
- 在结构不完整时猜测其它内部路径。

单元测试用临时 fake App 覆盖上述布局、缺 Helper、缺 CLI、非法 namespace 和不可用 IPC；真实 smoke 再覆盖 handshake 与授权。

### 6.4 Preflight 与降级

```text
Capability(design.artifact.generate)
        ↓
open-design preflight
    ├─ available
    │    → Open Design MCP
    │    → 生成并拉取 artifact
    │    → 正常 receipt
    └─ unavailable
         → local-html provider
         → degraded receipt
```

未安装、未启动、未授权、MCP handshake 失败都归一为结构化 provider error。只有 capability 声明了 fallback 时才自动降级；没有 fallback 时流程暂停并返回 setup 指引。

README 只补充安装要求、自动探测、非标准路径覆盖、连接检查、HTML 降级和 receipt 解释，不新增安装 UI。

## 7. Workflow 领域实现

### 7.1 通用任务图

业务 Skill 定义任务内容和依赖，不定义平台调度工具：

```json
{
  "tasks": [
    {
      "id": "search-docs",
      "objective": "查官方文档",
      "profile": "researcher",
      "dependsOn": [],
      "writeScope": "none"
    },
    {
      "id": "verify",
      "objective": "对抗验证结论",
      "profile": "reviewer",
      "dependsOn": ["search-docs"],
      "writeScope": "none"
    }
  ],
  "maxParallel": 2,
  "fallbackPolicy": "inline"
}
```

`fallbackPolicy` 为必填枚举 `inline | none`。任务还可声明 `timeoutMs` 和 `continueOnError`，未声明时分别使用领域默认超时与 `false`。`writeScope` 是并行安全约束；非 `none` 的重叠写集不得并行。

### 7.2 Provider 映射

```text
claude-native
  → Claude Workflow()

codex-agents
  → spawn_agent / wait_agent / followup_task

inline
  → 主会话按依赖顺序执行
```

动态降级：

```text
首选 provider 不可用
    ↓
任务允许串行 fallback？
    ├─ 是 → inline
    └─ 否 → unavailable，流程暂停
```

统一结果：

```json
{
  "provider": "codex-agents",
  "executionId": "opaque-execution-id",
  "status": "completed",
  "tasks": [
    {
      "id": "search-docs",
      "status": "completed",
      "resultRef": "opaque-ref",
      "error": null
    }
  ],
  "degraded": false,
  "degradedFrom": null
}
```

research 决定搜什么，reviewing 决定评审标准，workflow 只负责执行。存在共享写状态的任务默认不并行。

Capability contract：

| Capability | 输入 | 输出/语义 |
|---|---|---|
| `workflow.execute` | 上述 graph | 立即返回带 `executionId` 的 execution receipt；同步 inline 可直接为终态 |
| `workflow.wait` | `executionId`, 可选 `timeoutMs` | 返回当前 receipt；超时为非终态 `running`，不伪报失败 |
| `workflow.followup` | `executionId`, `taskId`, `instruction` | 只能作用于 `running` 任务，返回更新后 receipt |
| `workflow.collect` | `executionId` | 聚合终态任务输出；未终态时返回 `WORKFLOW_NOT_COMPLETE` |
| `workflow.cancel` | `executionId`, 非空 `reason` | 要求 provider 取消未终态任务，保存各任务实际终态；provider 不支持时返回 `WORKFLOW_CANCEL_UNAVAILABLE` |

execution 状态为 `pending | running | completed | partial | failed | cancelled`；task 状态为 `pending | running | completed | failed | skipped | cancelled`。任一任务失败且 `continueOnError=false` 时，其下游为 `skipped`，execution 为 `failed`；允许继续且至少一项失败时为 `partial`。`collect` 返回按 task ID 稳定排序的 `resultRef/error`，不拼接未受控 transcript。

同领域的流程控制原语使用小 contract：

| Capability | 输入 | 结果 |
|---|---|---|
| `workflow.skill.invoke` | `skill`, `arguments` | `status`, `resultRef` |
| `workflow.plan.create` | `items[]` （每项含 `id`, `subject`, `status`, 可选 handoff marker） | 平台 plan reference |
| `workflow.plan.update` | `id`, `status`, 可选 `subject` | 更新后 item receipt；只在平台成功后触发 lifecycle plan-change |
| `workflow.decision.request` | `question`, 2–3 个互斥 `options`，可选 `allowFreeform` | `selectedOption` 或 `freeform`；无结构化工具时降级为当前回合末尾的单个简短问题 |

`claude-control` 与 `codex-control` provider 实现各自平台的 Skill/plan/decision 装配；`inline` 只承接 task graph 与无平台调度工具时的主会话执行，不伪造结构化用户回答。

### 7.3 Execution Registry

Workflow 拥有 execution schema，但通过 `state.execution.create/read/update/cleanup` capability 持久化：

```text
NOCODE_PLUGIN_DATA/sessions/<session-id>/workflow/<execution-id>.json
```

registry 记录：

```json
{
  "executionId": "uuid",
  "sessionId": "opaque-session-id",
  "provider": "codex-agents",
  "status": "running",
  "providerHandle": {
    "workflowId": null,
    "agentIds": ["opaque-agent-id"]
  },
  "tasks": [],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

`providerHandle` 是 provider 私有字段，只由同 provider 的 wait/followup/collect 读取，不返回给业务消费者。Claude 保存 Workflow handle，Codex 保存 task→agent ID 映射，inline 保存当前 task cursor 和结果 reference。

`workflow.execute` 在调度第一个任务前创建 registry；后续操作必须同时匹配当前 session ID 与 execution ID，禁止跨 session 查找。更新使用与 handoff 相同的 per-execution lock、临时文件、fsync 和 atomic rename；锁超时 fail closed。session close 只清理已终态且超过保留期的 execution，running execution 保留并报告。`state.session.close` 不直接取消外部 agent/workflow；取消必须先走 workflow provider 的 cancel/terminal 流程。

## 8. Runtime State 与 Lifecycle

### 8.1 三层变量映射

平台原生层：

```text
Claude：CLAUDE_PLUGIN_DATA
Codex： PLUGIN_DATA
```

nocode 平台层：

```text
Claude：CLAUDE_PLUGIN_DATA
Codex： CODEX_PLUGIN_DATA
```

nocode 领域层：

```text
Claude/Codex：NOCODE_PLUGIN_DATA
```

数据流：

```text
Claude runtime
CLAUDE_PLUGIN_DATA
        ↓
claude-plugin-data provider
NOCODE_PLUGIN_DATA
```

```text
Codex runtime
PLUGIN_DATA
        ↓
Codex adapter
CODEX_PLUGIN_DATA
        ↓
codex-plugin-data provider
NOCODE_PLUGIN_DATA
```

规则：

- 只有 Codex adapter 可以读取原生 `PLUGIN_DATA`。
- Codex adapter 必须创建 `CODEX_PLUGIN_DATA`；缺少原生值时失败。
- 只有 runtime-state provider 可以读取 `CLAUDE_PLUGIN_DATA` 或 `CODEX_PLUGIN_DATA`。
- handoff 等业务脚本只读取 `NOCODE_PLUGIN_DATA`。
- 映射是严格平台装配，不做兼容 fallback。
- 两个平台的原生根目录不同，因此统一业务变量不会合并数据。

所有生成的 Hook、MCP 和领域脚本通过平台 entry 启动。entry 校验原生变量、设置平台变量和 `NOCODE_PLUGIN_DATA` 后再启动目标程序；普通业务 shell 不假设平台变量全局存在。

### 8.2 Session Handoff 状态

状态路径：

```text
NOCODE_PLUGIN_DATA/sessions/<session-id>/handoff.json
```

结构：

```json
{
  "sessionId": "opaque-session-id",
  "workspace": "/repo/path",
  "handoffs": [
    {
      "id": "dev-build-to-review:2",
      "logicalId": "dev-build-to-review",
      "generation": 2,
      "subject": "交接 dev-review",
      "status": "active",
      "openedAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "closedAt": null,
      "closeReason": null
    }
  ]
}
```

`handoff-state` 提供：

```text
open
complete
abandon
status
cleanup
```

业务计划使用稳定 marker：

```text
[handoff:dev-build-to-review] 交接 dev-review
```

marker 中的是稳定 `logicalId`，状态文件中的是实例 ID `<logicalId>:<generation>`。同一 session 首次 `open` 使用 generation 1；前一代已 completed/abandoned 后再次 `open` 自增 generation。同 logicalId 存在 active 代时，`open` 只幂等返回该实例，不并行创建新代。

Lifecycle 的 plan-change provider 只读取当前计划工具调用的结构化输入：

```text
Claude：TaskCreate / TaskUpdate
Codex： update_plan
```

它不读取 transcript。状态机为：

```text
missing --open--> active --complete--> completed
                     \--abandon----> abandoned
```

- `open` 仅在包含 marker 的计划变更已成功被平台接受后执行；同 logicalId active 重试幂等，前一代终态后可创建下一 generation。
- `complete` 来自带同一 marker 的计划项成功转为 completed，或业务流程显式调用；它只作用于该 logicalId 的 active generation，重试幂等。
- `abandon` 必须显式携带 `logicalId` 和非空 `reason`，将该 logicalId 的 active generation 转为 abandoned。这是用户放弃交接的唯一路径。
- 工具调用失败、计划项被删除、整份计划被替换或 marker 消失时，active 状态保留并返回 warning；不推断 complete/abandon。
- `cleanup` 只删除超过保留期的 completed/abandoned session，不删 active。

`handoff-state` 对每个 session 使用独占 lock file，所有变更按“读取→校验 transition→写同目录临时文件→fsync→atomic rename”执行。lock 有界重试，超时返回 `STATE_LOCK_TIMEOUT` 并 fail closed。父/子 agent 共用平台 session ID 和同一把锁；子 agent 不自建 session 目录。缺 session ID 时禁止回退到 workspace/global 目录。

### 8.3 Stop

```text
Stop(session_id)
    ↓
state.handoff.status
    ├─ 存在 active handoff
    │    → 返回继续完成交接的提示
    └─ 不存在 active handoff
         → 允许停止并清理已完成 session 状态
```

Claude/Codex provider 分别编码官方支持的 Hook 输出。Codex 不再无条件删除 Stop Hook。transcript 只可用于诊断，不是状态真源。

异常退出留下的 active handoff 不自动删除；用户需要放弃未完成 handoff 时必须显式调用 `abandon` 并提供原因，避免把真实未完成状态当垃圾清理。

### 8.4 SessionStart 上下文预算

Claude 与 Codex 使用各自 provider 的输出格式和 token 预算。compiler 按目标平台 token 预算验证每个 segment：

- 预算内：正常生成。
- 可安全拆分：确定性分片。
- 单项本身超限：编译失败并点名来源。

不再共用 Claude 的字符阈值，也不依赖客户端运行时把超长输出保存到磁盘后只给模型预览。

## 9. Personal Knowledge

### 9.1 数据所有权

个人知识继续属于项目：

```text
<project>/.agents-personal/
├── .git/
└── wiki/
    ├── pages/
    ├── draft/
    └── status.md
```

它不进入 `NOCODE_PLUGIN_DATA`。

### 9.2 Wiki Read 与 Usage

两端统一通过 `wiki-read.mjs`：

```text
personal-knowledge.page.read
    ↓
读取目标页面
    ↓ 成功
personal-knowledge.usage.record
    ↓
加锁更新 wiki/status.md
    ↓
返回页面内容
```

规则：

- 页面不存在或读取失败不计数。
- 读取与计数由同一 capability 入口编排，但不是一个跨文件事务。
- 更新沿用现有短超时锁，通过临时文件 + atomic rename 保证 `status.md` 单次写入原子；计数失败不阻塞页面读取，但必须返回 warning。
- nocode 业务 Skill 读取个人 Wiki 必须使用该 capability。
- 删除 Claude 专属 `PostToolUse(Read)` usage tracker 注册。
- 用户或 agent 绕过 nocode 直接 `cat`/`sed` 页面时不计数；不解析任意 shell 命令猜测读取行为。

### 9.3 Snapshot

`personal-knowledge.snapshot` 继续对项目内 `.agents-personal/.git` 做版本快照。它不写 plugin data。旧 `~/.nocode/personal-history` 只保留为现有手动迁移来源，本设计不自动迁移。

## 10. Continuous Learning

Continuous Learning 当前链路只有采集稳定发生，分析和消费没有形成有效闭环；本机已有大量 observation/archive，但没有生成 instinct 或 evolved 输出。它不应作为双运行时迁移的默认负担。

处理：

- 源码保留，便于后续独立设计。
- 双平台编译策略标记 `excluded`。
- 生成物不包含 `continuous-learning-v2` Skill、observer Hook 与 instinct/evolve commands。
- 不读取、迁移或删除 `~/.claude/homunculus`。
- 若未来恢复，必须新建 learning 领域，重新定义采集隐私、payload codec、分析执行、成本、产出和验收。

## 11. 领域编译器

### 11.1 阶段

```text
1. discoverDomains
2. validateDomainStructure
3. indexConsumers
4. validateCapabilityUsage
5. resolveProviders(platform)
6. buildPlatformTree
7. validateGeneratedArtifact
8. writeResolutionReceipt
```

### 11.2 全量消费者审计

扫描：

```text
skills/
commands/
agents/
rules/
model/
hooks/
scripts/
references/ + skills/references/ + skills/**/references/
上述发布根下的嵌套 *.mjs/js/cjs/ts/sh/bash/py/rb
```

审计对象包括：

- 平台工具调用。
- MCP/app/connector。
- 外部 Skill。
- agent/workflow 调度。
- Hook 生命周期。
- 平台环境变量。
- 持久状态写路径。
- 浏览器、网络和本地命令依赖。

任何依赖都必须归属领域 capability。

### 11.3 平台词汇隔离

业务消费者不得执行：

```text
Claude Design / DesignSync
Artifact(...)
Workflow(...)
spawn_agent / wait_agent
mcp__open_design__*
CLAUDE_PLUGIN_DATA / CODEX_PLUGIN_DATA / PLUGIN_DATA
```

允许出现的位置：

```text
core/domains/<domain>/providers/<provider>/
adapters/<platform>/
```

文档讨论某个平台名不构成错误；checker 检查的是可执行语法、变量访问和 provider 调用，而不是简单禁止单词“Claude”或“Codex”。

### 11.4 编译错误

以下情况必须失败：

- capability 不存在或归属领域错误。
- 正文使用 capability 但未声明。
- 目标平台无 provider、无 fallback 且未 excluded。
- provider 声明能力但不满足输入/输出 contract。
- provider 依赖图有环。
- provider 引用的 MCP/脚本/Skill 不在生成 allowlist。
- 业务消费者出现平台工具或平台数据变量。
- 生成产物出现另一平台 provider。
- SessionStart segment 超出目标平台预算。

### 11.5 Resolution Receipt

每个平台生成：

```text
plugins/<platform>/nocode/capability-resolution.json
```

示例：

```json
{
  "platform": "codex",
  "domains": {
    "design": {
      "design.artifact.generate": {
        "primary": "open-design",
        "fallback": "local-html"
      }
    },
    "workflow": {
      "workflow.execute": {
        "primary": "codex-agents",
        "fallback": "inline"
      }
    }
  },
  "excluded": {
    "continuous-learning-v2": {
      "reason": "disabled pending independent redesign"
    }
  }
}
```

receipt 是生成结果，不是新的配置单源；单源仍在各领域定义。

## 12. 错误与降级语义

统一错误分类：

```text
contract_error     源码/领域定义错误，编译失败
platform_error     adapter 无法装配平台能力，编译失败
provider_unavailable 外部 provider 当前不可用，按 capability `fallbackOn` 尝试 fallback
provider_failed    provider 已启动但执行失败，按 attempt envelope 与 `fallbackOn` 决定降级/暂停
state_error        平台状态目录或 session 状态不可用，涉及 handoff 时 fail closed
```

规则：

- 编译错误不能通过运行时 warning 掩盖。
- 动态 provider unavailable 只有声明 fallback 时才降级。
- Open Design 失败转 local HTML 时必须返回 degraded receipt。
- workflow provider 不可用且允许串行时转 inline。
- handoff 状态写入失败时不得假装已记录；Stop 保护链按 fail closed 报错并要求用户处理。
- Wiki usage 计数失败是非关键错误：页面内容仍返回，同时报告 warning。
- 所有 provider 错误禁止包含 token、授权 header、带凭证 URL 或原始敏感 payload。

## 13. 测试与验收

### 13.1 Domain Contract Tests

每个领域覆盖：

- capability ID 唯一。
- provider 声明完整。
- 输入/输出 schema 兼容。
- fallback 存在且无环。
- platform support 与实现一致。

### 13.2 Compiler Negative Tests

至少覆盖：

```text
业务 Skill 直接写 Workflow()             → FAIL
业务 Skill 出现 mcp__open_design__*       → FAIL
Capability 未声明                        → FAIL
capability 没 provider/fallback/excluded → FAIL
业务脚本直接读取 PLUGIN_DATA              → FAIL
Codex adapter 未建立 CODEX_PLUGIN_DATA    → FAIL
provider 依赖成环                         → FAIL
嵌套 Python/Shell 脚本缺 sidecar         → FAIL
committed/unknown 的 provider 失败被自动降级 → FAIL
```

领域正向测试还必须覆盖：Workflow registry 拒绝跨 session handle，Design write 不跨 provider，handoff 同 logicalId 在终态后生成下一 generation，以及 registry/handoff 并发写不丢失更新。

### 13.3 Generated Artifact Tests

分别检查：

- manifest schema。
- `.mcp.json` 和 Open Design launcher。
- capability resolution receipt。
- Skill metadata budget。
- Hook schema 与 trust 提示。
- SessionStart token budget。
- 平台词汇隔离。
- generated tree 无漂移。
- Claude 产物不含 Codex provider，Codex 产物不含 Claude provider。

### 13.4 真实客户端 Smoke

Claude/Codex 均在干净安装环境执行：

1. 从各自 marketplace 安装。
2. 确认 Skills/Commands 可发现。
3. 审查并信任 Hooks。
4. 确认 SessionStart 基础上下文完整。
5. 执行 Open Design 正常路径。
6. 停止或隔离 Open Design，验证 local HTML fallback。
7. Claude 执行 `claude-native` workflow，Codex 执行 `codex-agents` workflow，确认任务图、等待与收集结果。
8. 在 `NOCODE_SMOKE=1` 的受控 smoke harness 中分别将 `claude-native` 和 `codex-agents` preflight 置为 unavailable，验证两端都转 inline；生产运行时不接受该强制开关。
9. 创建 active handoff，验证 Stop 要求继续。
10. complete handoff，验证允许停止。
11. 通过 `wiki-read` 读取页面，确认 `status.md` 计数加一。
12. 确认两平台写入各自原生数据根，业务脚本只看到 `NOCODE_PLUGIN_DATA`。
13. 确认默认产物不包含 Continuous Learning Skill、observer Hook 或 instinct/evolve command。

Smoke 回执：

```json
{
  "platform": "codex",
  "install": "passed",
  "openDesign": "passed",
  "htmlFallback": "passed",
  "workflowPrimary": {
    "provider": "codex-agents",
    "status": "passed"
  },
  "workflowInlineFallback": "passed",
  "handoff": "passed",
  "wikiUsage": "passed",
  "stateIsolation": "passed",
  "continuousLearningExcluded": "passed"
}
```

Claude receipt 的 `workflowPrimary.provider` 必须为 `claude-native`，Codex 必须为 `codex-agents`；两份 receipt 都必须单独记录 inline fallback，不允许用一个模糊 `workflow: passed` 合并。

发布 Gate：

- validator 不能替代真实安装和运行。
- UI 步骤允许人工执行，但必须保存实际回执。
- 不允许以 `manual pending` 标记 `implemented`。
- 两个平台 receipt 全部 passed 后才能切换最终 marketplace 并发布。

## 14. 迁移策略

### Stage 1：领域骨架与失败测试

建立六个领域目录和 compiler 骨架。先让现有业务源码因未声明依赖、平台工具泄漏和缺 provider 而失败。

Gate：领域结构、依赖图和 negative tests 生效。

### Stage 2：关键领域迁移

按依赖顺序：

```text
workspace
    ↓
design + workflow
    ↓
runtime-state + lifecycle
    ↓
personal-knowledge
```

完成 Claude Design/Artifact/Workflow/transcript replay/Read usage Hook 的替换，并明确 Continuous Learning exclusion。

Gate：代表流程只通过 capability 调用外部能力。

### Stage 3：全量消费者审计

逐个审计 Skills、Commands、Agents、Hooks 和 Scripts。没有 provider、fallback 或 exclusion 的消费者不得进入生成物。

Gate：业务范围内平台语法扫描为零，所有 dependency 都有领域归属。

### Stage 4：替换旧编译链

移除全文自由替换、旧扁平 contract 和“整目录复制即兼容”的假设，保留确定性生成、双发布物、版本单源和 `--check`。

Gate：新 compiler 可独立生成并验证两个插件。

### Stage 5：双客户端验收

执行全量测试和真实 smoke。任一平台失败，版本状态保持 candidate，禁止发布。

Gate：两个 smoke receipt 全部 passed。

### Stage 6：整理 14.0.0

当前 `689cc25` 视为 draft implementation。最终实现和验收通过后，经用户确认再把迁移整理为单一、可审查的 14.0.0 migration commit。

commit 前：

```text
vendor sync check
所有生成链 check
全量自动测试
Claude/Codex smoke receipt
git diff --check
```

不自动 push；展示最终状态和证据后询问用户。

## 15. 数据安全与回滚

- 不自动读取、迁移或删除 `~/.claude/homunculus`。
- 不自动迁移旧 plugin data。
- 不修改或删除 Open Design 用户项目。
- 不删除 `.agents-personal` 历史。
- local HTML fallback 只写明确的交付目录。
- provider 日志和 receipt 不保存凭证或带 token URL。
- 14.0.0 未通过 Gate 时，用户继续使用 main 的 13.12.3。

## 16. 已拍板决策

1. 新设计是原双运行时架构的语义兼容补救，不重写整个产品方向。
2. 采用领域优先架构：Domain → Capabilities / Providers / Contracts / Tests。
3. 业务正文保留完整方法论，只把平台动作改成 capability token。
4. Claude/Codex 统一使用 Open Design；不可用时自动降级本地 HTML。
5. nocode 内置 Open Design `.mcp.json`，由 macOS launcher 自动发现 App。
6. Open Design 配置只补充 README，不建设安装 UI。
7. 任务调度领域命名为 workflow。
8. Claude workflow 用 native provider，Codex 用 agents provider，两端都有 inline fallback。
9. runtime-state 业务统一使用 `NOCODE_PLUGIN_DATA`。
10. Claude 原生变量为 `CLAUDE_PLUGIN_DATA`；Codex 原生 `PLUGIN_DATA` 先由 adapter 规范为 `CODEX_PLUGIN_DATA`，再映射到领域变量。
11. 平台变量缺失直接失败，不做兼容 fallback。
12. handoff 按 session 隔离，通过 `handoff-state` 显式保存。
13. Stop Hook 读取状态文件，不解析 transcript。
14. 所有 plugin persistent state 不自动迁移。
15. Wiki usage 保留，两端统一通过 `wiki-read` 读取，计数使用 best-effort 原子更新。
16. `.agents-personal` snapshot 继续属于项目，不进入 plugin data。
17. Continuous Learning 从默认双平台发布物停用，留作独立议题。
18. 缺 provider、fallback 或 exclusion 时编译失败。
19. 做全量 capability 审计，不只修已发现的三个案例。
20. 双客户端真实 smoke 是发布 Gate。
21. `689cc25` 是 draft，最终整理为正确的单一 14.0.0 migration commit。

## 17. 实施计划输入

实施计划必须把本设计拆成可独立验证的阶段，并确保：

- 先测试 compiler/contract 的拒绝行为，再迁业务内容。
- 每次迁移一个领域后运行领域测试和双平台生成检查。
- provider 脚本、业务 Skill 和生成物不在同一步混写而无法定位回归。
- 真实 smoke 在最终 history 整理前完成。
- 任何 git history rewrite、commit 合并或 push 都在用户明确确认后执行。
