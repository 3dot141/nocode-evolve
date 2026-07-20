# nocode Claude / Codex 双运行时架构设计

> 状态：implemented（客户端安装 smoke manual pending）
>
> 日期：2026-07-20
>
> 当前版本基线：13.12.3
>
> 目标版本：14.0.0（分发路径与运行时抽象发生破坏性变化）

## 1. 罗盘

### 1.1 目标

把当前以 Claude Code 插件约定为中心的 `nocode`，重构为一套平台无关的工程经验源码，并从同一份源码确定性生成两个可独立安装的插件：

- Claude Code plugin
- Codex plugin

最终必须满足：

1. workflow、rule、skill、agent profile、hook 领域判断只维护一份业务语义。
2. Claude/Codex 的工具名、插件目录、Hook JSON、agent/command 发现机制只存在于各自 adapter。
3. 用户安装哪个平台插件，运行时就只加载该平台实现，不把另一平台的工具语法塞进上下文。
4. 两个平台的能力不强行伪装成完全一致；能力缺口通过 `unsupported + fallback` 显式表达。
5. 两个发布物均直接来自 git 中已提交的生成目录，不增加 tarball/npm 打包流程。

### 1.2 成功标准

- Common Core 中不存在无条件执行的 Claude/Codex 专属工具调用。
- `node scripts/compile.platform.mjs --check` 能证明两个插件发布物与 Common Core、adapter 一致。
- Claude 用户原有核心行为通过回归 fixture 保持一致。
- Codex 能独立安装，只发现 Codex 版本的 Skill、Hook 与提示词。
- 同一 capability contract fixture 可分别驱动 Claude/Codex adapter，并得到各自合法输出。
- `commands/`、`agents/`、Hook output codec 的平台差异不再泄漏到通用 workflow。
- 两个生成 manifest 的 name/version 来自同一元数据源，无法独立漂移。

### 1.3 非目标

- 不追求两个平台 UI、工具列表、并行度和生命周期事件完全相同。
- 不在插件安装时写入用户全局 `~/.codex/agents/` 或 `~/.claude/` 配置。
- 不重写 `vendor/codex/`；它仍是 Claude 平台可选的异源 reviewer 实现。
- 不在本次引入 MCP server。
- 不在本次解决 Codex 缺少 Claude `TaskCreate.metadata.handoff` 同构能力的问题；只定义 capability fallback。
- 不把所有 Markdown workflow 改成重量级 YAML/JSON 工作流引擎。

## 2. 现状问题

当前仓库同时混合了三类内容：

1. **领域语义**：devflow、pdflow、reviewing、rule、安全决策、个人知识流程。
2. **Claude 表达**：`Skill()`、`Agent()`、`TaskCreate`、`AskUserQuestion`、`EnterWorktree`、commands/agents 自动发现。
3. **Claude 协议**：`.claude-plugin/plugin.json`、Claude Hook 输入输出、`CLAUDE_ENV_FILE`。

导致：

- 36 个公开 Skill 中至少 26 个直接出现 Claude 专属工具语法。
- 24 个用户 command 与 8 个 agent 依赖 Claude 插件发现机制。
- Hook 的领域判断和 Claude JSON 返回结构写在同一个函数里。
- `rule-codex-review` 在 Claude 中代表“调另一个模型”，若原样进入 Codex 会变成递归调用自身。
- 为兼容 Codex 临时增加 runtime mapping，只能把翻译负担交给模型，无法保证每次正确执行。

根因不是“缺一个 Codex manifest”，而是领域语义和平台实现没有边界。

## 3. 方案比较与决策

### 3.1 方案 A：单份 Skill + SessionStart 运行时映射

做法：继续让 Skill 使用 Claude 工具名，在 Codex SessionStart 注入工具映射。

优点：

- 迁移量最小。
- 现有目录基本不动。

缺点：

- 每次执行依赖模型正确翻译抽象。
- Claude/Codex 条件判断继续散落在 Skill 正文。
- 另一平台语法仍占上下文。
- commands/agents/Hook codec 仍需额外补丁。

结论：只适合作为短期兼容垫片，不作为目标架构。

### 3.2 方案 B：通用源码 + 平台 adapter + 编译期双发布物

做法：Common Core 使用语义 capability；编译器将模板渲染为 Claude/Codex 两套插件目录。

优点：

- 平台边界确定，可静态检查。
- 运行时只加载自己的语法。
- commands/agents/hooks 的结构差异能由 renderer 自然吸收。
- 两个平台可以在保持共同语义的同时选择不同 fallback。

缺点：

- 需要迁移目录和增加生成链。
- 生成物变多，必须严格禁止手改。
- 首次迁移规模较大。

结论：**选定方案**。

### 3.3 方案 C：两套完全独立插件，只共享测试

做法：Claude/Codex 各自维护完整 Skill、Rule、Hook。

优点：平台自由度最高。

缺点：

- workflow 内容重复。
- 修复和规则演化必然漂移。
- review、devflow 等大型方法论维护成本翻倍。

结论：拒绝。

## 4. 总体架构

```text
                         ┌─────────────────────────┐
                         │       Common Core       │
                         │                         │
                         │ workflows / rules       │
                         │ skill templates         │
                         │ command definitions     │
                         │ agent profiles          │
                         │ hook domain decisions   │
                         │ references              │
                         └────────────┬────────────┘
                                      │
                               Capability Contract
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
          ┌─────────▼─────────┐               ┌─────────▼─────────┐
          │  Claude Adapter   │               │   Codex Adapter   │
          │                   │               │                   │
          │ content renderer  │               │ content renderer  │
          │ component mapper  │               │ component mapper  │
          │ hook codec        │               │ hook codec        │
          │ env resolver      │               │ env resolver      │
          │ fallback policy   │               │ fallback policy   │
          └─────────┬─────────┘               └─────────┬─────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                           compile.platform.mjs
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
          ┌─────────▼─────────┐               ┌─────────▼─────────┐
          │ plugins/claude/   │               │ plugins/codex/    │
          │ nocode/           │               │ nocode/           │
          │                   │               │                   │
          │ .claude-plugin/   │               │ .codex-plugin/    │
          │ skills/commands/  │               │ skills/           │
          │ agents/hooks/     │               │ hooks/            │
          └───────────────────┘               └───────────────────┘
```

核心原则：

- Common Core 是唯一业务语义单源。
- Adapter 是唯一平台知识单源。
- `plugins/*` 是只读生成物。
- Marketplace 只负责选择对应发布物。

## 5. 目录结构

下面先给出逻辑归属。首个可发布版本不强制把数百个现有业务文件物理搬进 `core/`：`skills/`、`commands/`、`agents/`、`rules/`、`model/` 继续留在仓库根并作为 Common Core 的业务源码，`core/` 首先承载 capability contract 与平台无关定义。编译器通过显式 source allowlist 消费这些目录。这样平台边界由 contract、adapter 和生成物保证，不把双平台兼容与一次无业务收益的大规模路径迁移绑在同一个 major diff 中。

当业务调用点全部迁为语义 capability 后，是否把这些根目录机械移动到 `core/` 是独立的仓库整理任务，不影响插件运行时、发布物结构或接口契约。

```text
nocode-evolve/
├── plugin/
│   └── metadata.json                    # name/version/author/license 单源
│
├── core/
│   ├── capabilities/
│   │   ├── contract.json                # capability 名、输入、结果、fallback 契约
│   │   └── README.md
│   ├── model/                            # 目标逻辑归属；首版可映射仓库根 model/
│   │   ├── agent-about.md.tmpl
│   │   ├── agent-personal.md.tmpl
│   │   └── agent-karpathy.md.tmpl
│   ├── rules/                            # 目标逻辑归属；首版可映射仓库根 rules/
│   │   └── rule-*.md.tmpl
│   ├── skills/                           # 目标逻辑归属；首版可映射仓库根 skills/
│   │   ├── <name>/SKILL.md.tmpl
│   │   └── <name>/references/**
│   ├── commands/                         # 目标逻辑归属；首版可映射仓库根 commands/
│   │   ├── <name>.md.tmpl
│   │   └── <name>-assets/**
│   ├── agents/                           # 目标逻辑归属；首版可映射仓库根 agents/
│   │   └── <name>.md.tmpl
│   ├── hooks/
│   │   ├── pretool-decisions.mjs
│   │   ├── stop-decisions.mjs
│   │   └── usage-observer.mjs
│   └── references/
│       └── **
│
├── adapters/
│   ├── claude/
│   │   ├── capabilities.mjs
│   │   ├── renderers.mjs
│   │   ├── hook-codec.mjs
│   │   ├── env.mjs
│   │   ├── fallbacks.mjs
│   │   └── manifest.template.json
│   └── codex/
│       ├── capabilities.mjs
│       ├── renderers.mjs
│       ├── hook-codec.mjs
│       ├── env.mjs
│       ├── fallbacks.mjs
│       └── manifest.template.json
│
├── plugins/                              # 全部生成，禁止手改
│   ├── claude/nocode/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── skills/
│   │   ├── commands/
│   │   ├── agents/
│   │   ├── hooks/
│   │   ├── scripts/
│   │   └── vendor/
│   └── codex/nocode/
│       ├── .codex-plugin/plugin.json
│       ├── skills/
│       ├── hooks/
│       ├── scripts/
│       └── vendor/                       # 只复制 Codex 平台确实需要的资源
│
├── .claude-plugin/
│   └── marketplace.json                 # Claude marketplace，source=plugins/claude/nocode
├── .agents/plugins/
│   └── marketplace.json                 # Codex marketplace，source=plugins/codex/nocode
│
├── scripts/
│   ├── compile.platform.mjs
│   ├── compile.rule.js
│   ├── compile.hooks.js
│   └── vendor-sync.mjs
└── hooks/
    └── *.test.mjs                       # 继续作为统一测试入口
```

说明：

- `plugins/claude/nocode`、`plugins/codex/nocode` 虽是生成物，但提交进 git，marketplace 仍直接从 git 分发；末级目录名与 manifest 的 `name: nocode` 一致。
- `.claude-plugin/` 根目录只保留 marketplace；真实 Claude plugin manifest 移到 `plugins/claude/nocode/.claude-plugin/`。
- 当前约束中所有版本检查路径需随 major migration 更新。

## 6. Capability Contract

### 6.1 为什么需要语义接口

Markdown Skill 不是可链接的程序库，不能真的调用 TypeScript interface。这里的“接口”由两部分组成：

1. 模板中的有限语义宏。
2. Node adapter 对这些宏和 Hook domain result 的确定性渲染。

Core 不写：

```text
Agent(...)
spawn_agent(...)
```

而写：

```text
{{agent.dispatch profile="code-reviewer" prompt=review_prompt}}
```

编译后才出现平台具体语法。

### 6.2 首版 capability 集合

#### Skill

```text
skill.invoke(name, arguments)
skill.available(name)
```

#### Agent

```text
agent.dispatch(profile, prompt, isolation, background)
agent.wait(handle)
agent.parallel(jobs)
```

#### Plan / Task

```text
plan.create(items)
plan.update(item, status)
plan.list()
plan.mark_handoff(item)
```

#### User interaction

```text
user.ask(question, options, multi_select)
user.confirm(summary, artifact_path)
```

#### Files and shell

```text
files.read(path)
files.search(query, scope)
files.patch(path, change)
shell.exec(command, cwd, background)
shell.wait(handle)
```

#### Workspace

```text
workspace.create_worktree(path, branch)
workspace.enter(path)
workspace.current()
```

#### Lifecycle hooks

```text
hook.add_session_context(content)
hook.pre_tool_decision(effect, reason, context)
hook.post_tool_observe(event)
hook.stop_decision(effect, reason)
```

### 6.3 Capability result

每个 adapter capability 必须返回概念上的统一结果：

```json
{
  "status": "supported | degraded | unsupported",
  "implementation": "平台实现说明",
  "fallback": "unsupported/degraded 时的执行策略"
}
```

Core workflow 必须为 `degraded` 和 `unsupported` 定义下一步，不能默认所有平台都有 Claude 等价工具。

### 6.4 首版平台映射

| Capability | Claude Adapter | Codex Adapter | Codex fallback |
|---|---|---|---|
| `skill.invoke` | `Skill(nocode:x)` | 原生 Skill 加载 / `$x` | 读当前已加载 Skill 指令 |
| `agent.dispatch` | `Agent()` | `spawn_agent` | 主会话执行并声明降级 |
| `agent.wait` | Agent result / background monitor | `wait_agent` | 同步执行 |
| `plan.create/update` | Task family | `update_plan` | 文本 checklist |
| `plan.mark_handoff` | Task metadata | 计划项文本标记 | Stop gate 不依赖该标记 |
| `user.ask` | `AskUserQuestion` | `request_user_input` | 回合末尾文本提问 |
| `files.*` | Read/Grep/Glob/Edit/Write | Codex 原生工具 | shell + `rg` + patch |
| `workspace.enter` | `EnterWorktree(path)` | command `workdir`/cwd | 每条命令显式 cwd |
| `shell.background` | background Bash/Monitor | unified exec session | 同步 shell |

## 7. 内容模型与渲染

### 7.1 Skill

Core Skill 保留自然语言 Markdown，只把真正的平台动作写成语义宏。普通方法论、检查清单、reference 路由不模板化。

原则：

- 不把整个 Skill 变成 DSL。
- 只模板化平台能力边界。
- 平台 renderer 不改写业务正文。
- 编译后 Skill 必须自闭环，只能读取自己的 references 或生成后的共享 references。

### 7.2 Commands

Common Core 中的 command 是“显式用户入口定义”，不是 Claude 文件格式本身。

Claude renderer：

- 一条 command definition 生成一个 `commands/<name>.md`。
- 保留现有 `/nocode:<name>` 使用方式。

Codex renderer：

- 高频独立 workflow 可生成独立 Skill。
- personal/project/plugin 子动作生成少量 hub Skill，子协议放 hub 私有 references。
- 不机械生成 24 个冗长 Skill；renderer 根据 command metadata 的 `codex_exposure` 决定 `standalone | hub | hidden`。

建议首版：

```text
standalone: distill, recall, sow, task, eval
hub: personalhub, projecthub, nocodehub, instinct
hidden: 仅被 hub 调用的子命令
```

### 7.3 Agent profiles

Common agent profile 包含：

```text
name
description
role intent
instructions
required capabilities
preferred isolation
preferred model class（非具体模型名）
fallback
```

Claude renderer：生成现有 `agents/*.md` frontmatter 和正文。

Codex renderer：

- 不写用户 `.codex/agents/`。
- 生成到拥有它的 workflow Skill 私有 `references/agents/`。
- `agent.dispatch` 时选择 Codex `explorer | worker | default` 并注入 profile。
- 将来 Codex plugin 支持分发 custom agents 时，只替换 renderer。

### 7.4 Rules

Rule frontmatter 继续是路由单源：

```yaml
name:
description:
skip:
```

Rule body 使用 capability 宏。现有 `compile.rule.js` 调整为消费 `core/rules/`，生成平台无关 catalog 数据；`compile.platform.mjs` 再把 catalog 路径和加载语法渲染进两个插件。

`rule-codex-review` 是平台策略特例：

- Claude：可用 vendored Codex Companion，属于异模型/异 harness。
- Codex：默认 `spawn_agent` 只是同模型隔离，必须如实标注。
- Codex 若显式配置 Claude reviewer provider，可由 adapter 暴露真正异源 capability。

### 7.5 References

Core reference 按领域归属不变。编译器负责复制到生成 Skill 的合法内部路径，并重写相对链接。

禁止：

- 生成后的 Skill 逃逸读取 `plugins/<other-platform>`。
- Skill 直接读取 core、adapter 或非自身 scripts。
- 平台 renderer 用绝对开发机路径写进生成物。

## 8. Hook 架构

### 8.1 两层模型

Hook 分为：

```text
Domain Decision -> Platform Codec
```

领域层返回统一 effect：

```text
allow
deny
remind
observe
continue
stop
```

示例：

```json
{
  "effect": "remind",
  "reason": "命令命中危险操作规则",
  "context": "执行前先读取对应 rule"
}
```

Claude codec：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "..."
  }
}
```

Codex codec：

```json
{
  "systemMessage": "..."
}
```

### 8.2 SessionStart

Common 决定需要加载哪些逻辑段；adapter 决定：

- 插件根目录环境变量。
- 项目根目录解析。
- additional context 编码。
- 单条输出预算。
- 哪些平台 bootstrap 必须常驻。

Codex 不再加载 Claude 工具映射，因为生成 Skill 已经是 Codex 语法；SessionStart 只注入跨 Skill 的全局行为基线和 rule catalog。

### 8.3 PreToolUse

`pretool-decisions.mjs` 只负责匹配规范化命令并返回 effect。Claude/Codex codec 分别输出平台结构。

同一组安全 pattern 继续来自 `scripts/compile.hooks.js`，但生成结果改为平台无关 decision table，再由各插件包装。

### 8.4 Stop

Stop 领域目标是“存在唯一未完成 handoff 时继续工作”，但状态来源不属于通用能力。

首版：

- Claude adapter：继续 replay Task transcript。
- Codex adapter：`unsupported`，fail-open，不假装实现。
- Common workflow：即使 Stop gate 不可用，也在最终计划项中保留 Handoff 语义。

Codex Stop v2 另行设计为显式状态文件，不进入本次 major migration。

### 8.5 PostToolUse usage tracking

- Claude adapter 保留 `Read` telemetry。
- Codex adapter 明确 unsupported/no-op。
- 该能力只用于统计，永远不是安全或正确性边界。

## 9. 编译链

### 9.1 输入

```text
plugin/metadata.json
core/**
adapters/claude/**
adapters/codex/**
vendor integration outputs
```

### 9.2 输出

```text
plugins/claude/nocode/**
plugins/codex/nocode/**
```

### 9.3 编译阶段

1. 读取并验证 plugin metadata、capability contract。
2. 校验所有 Core 宏都有两个 adapter 映射或显式 unsupported。
3. 编译 rule catalog 中间数据。
4. 渲染 Claude Skills/Commands/Agents/Model/Rules/Hooks。
5. 渲染 Codex Skills/Agent references/Model/Rules/Hooks。
6. 复制各平台允许的 scripts、references、vendor 文件。
7. 生成两个 manifest。
8. 计算 Skill metadata budget 和 SessionStart budget。
9. 清理残留生成文件。
10. `--check` 比较期望树与已提交生成树。

### 9.4 生成物纪律

- `plugins/**` 文件头或 companion manifest 标明 generated source。
- 禁止手改 `plugins/**`。
- 改生成物必须回到 core/adapter 源，再运行编译器。
- `--check` 检查内容漂移、缺文件和残留文件。
- 生成顺序和文件排序必须确定，避免无意义 diff。

### 9.5 与现有生成链关系

保留两条已有独立单源：

- rule frontmatter -> catalog
- PreToolUse rules array -> decision table

`compile.platform.mjs` 是外层发布物编译器，不合并这两条源，也不引入统一 manifest 反向控制它们。

## 10. 加载与分发

### 10.1 Claude

```text
.claude-plugin/marketplace.json
  -> source: ./plugins/claude/nocode
  -> plugins/claude/nocode/.claude-plugin/plugin.json
```

只发现 Claude 生成物：commands、agents、skills、hooks。

### 10.2 Codex

```text
.agents/plugins/marketplace.json
  -> source: ./plugins/codex/nocode
  -> plugins/codex/nocode/.codex-plugin/plugin.json
```

只发现 Codex Skills 和 Hooks。

### 10.3 按需加载层次

1. **安装时**：marketplace 选择平台发布物。
2. **SessionStart**：只注入平台 bootstrap + 必要全局规则。
3. **Skill discovery**：只加载该平台 Skill metadata。
4. **Skill invoke**：命中后加载正文。
5. **Reference**：Skill 按需加载自己的 reference。
6. **Agent profile**：只有发生 dispatch 时才加载对应 profile。

另一平台 adapter、manifest、工具语法不进入当前平台上下文。

## 11. 环境和可写状态

Adapter 统一抽象：

```text
plugin.root
plugin.data
project.root
session.id
transcript.path
```

映射：

- Claude：`CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA`、`CLAUDE_PROJECT_DIR`。
- Codex：`PLUGIN_ROOT`、`PLUGIN_DATA`、Hook payload `cwd`；兼容变量只能作为 fallback，不能作为 Codex 主契约。

所有持久状态写 `plugin.data`，不写插件缓存目录。Core 不直接读取环境变量，由 adapter 解析后传入。

## 12. 版本与发布

`plugin/metadata.json` 是版本单源：

```json
{
  "name": "nocode",
  "version": "14.0.0",
  "author": {
    "name": "Harrison",
    "url": "https://github.com/3dot141"
  },
  "license": "MIT"
}
```

两个 manifest 均由它生成。

本次为 major 的原因：

- 插件实体从仓库根移动到 `plugins/<platform>`。
- 原来“仓库根源码即插件实体”变为 Common Core 源 / 生成发布物两层。
- 版本单源位置变化。
- rule/skill 的运行时调用语义发生平台抽象。

迁移完成后，日常规则：

- 修改 core/adapter/发布所需 scripts -> bump `plugin/metadata.json`。
- 同一 commit 提交 metadata、源和两个生成物。
- 纯 README/AGENTS/design 文档不 bump。

## 13. 测试策略

### 13.1 Contract tests

对每个 capability 使用同一输入 fixture，分别断言：

- Claude 输出合法。
- Codex 输出合法或明确 unsupported。
- fallback 非空。

### 13.2 Compiler tests

- 相同输入两次编译字节一致。
- `--check` 能发现修改、缺失、残留生成物。
- Core 出现未知宏时失败。
- 任一 adapter 漏 capability 时失败，除非声明 unsupported + fallback。
- 所有生成链接保持在插件根目录内。

### 13.3 Snapshot tests

选择高风险代表：

- `devflow`
- `dev-build`
- `dev-review`
- `pdflow`
- `rule-codex-review`
- PreToolUse deny/remind
- Stop handoff
- command hub
- agent profile dispatch

分别保存 Claude/Codex 生成 snapshot。

### 13.4 Existing regression

保留并迁移：

```bash
node --test 'hooks/*.test.mjs'
node scripts/compile.rule.js --check
node scripts/compile.hooks.js --check
node scripts/vendor-sync.mjs --check
```

新增：

```bash
node scripts/compile.platform.mjs --check
node scripts/check-skills.mjs --check --platform claude
node scripts/check-skills.mjs --check --platform codex
```

### 13.5 Real smoke tests

Claude：

- marketplace 安装。
- command/agent/skill 发现。
- SessionStart。
- PreToolUse deny/remind。
- Stop handoff。

Codex：

- marketplace 安装。
- Skill metadata budget。
- Skill invoke。
- subagent dispatch/fallback。
- Hook trust。
- PreToolUse deny/remind。
- Stop fail-open。
- `codex-review` 不递归运行 Codex Companion。

## 14. 迁移策略

### Stage 1：建立 contract 和编译器骨架

- 不移动现有插件。
- 用少量代表 Skill/Hook 验证双渲染可行。
- 输出到临时 fixture，不用于发布。

Gate：devflow、PreToolUse、agent dispatch 三条链能双渲染。

### Stage 2：Claude adapter 等价迁移

- 把现有 Claude 行为逐步迁入 core + Claude adapter。
- 生成 `plugins/claude/nocode`。
- 用 snapshot 对比当前根插件，先实现行为等价。

Gate：Claude 全量 regression 通过。

### Stage 3：Codex adapter

- 实现 Codex capability mapping。
- 渲染 Codex Skills、agent references 和 Hooks。
- 明确所有 unsupported/fallback。

Gate：Codex 静态检查和本地 smoke 通过。

### Stage 4：切换 marketplace

- Claude marketplace source 改为 `plugins/claude/nocode`。
- Codex marketplace source 指向 `plugins/codex/nocode`。
- 根旧插件文件只在同一 major commit 中移除。
- 更新 CLAUDE.md、README 和维护脚本路径。

Gate：两个 marketplace 从干净 clone 均能安装。

### Stage 5：发布 14.0.0

- 全量生成链 check。
- 双平台 smoke receipt。
- 单一 major commit。
- 用户确认后 push。

## 15. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 模板宏过多，Markdown 变成难维护 DSL | 首版只模板化平台动作；正文仍是 Markdown |
| Claude 等价迁移引入行为回归 | 先做 Claude snapshot，再实现 Codex |
| 两套生成物体积增大 | git 分发优先稳定；后续再评估去重，不提前优化 |
| 生成物被手改 | 文件标识 + `--check` + AGENTS 规则 + review gate |
| Codex capability 快速变化 | 平台知识集中 adapter；替换实现不改 core |
| Skill metadata 超预算 | Codex renderer 合并低频 commands 为 hub，并做预算 check |
| reference 链接在复制后断裂 | 编译器构建文件图并验证所有相对引用 |
| `vendor/codex` 被错误带进 Codex 插件 | 发布 allowlist；Codex smoke 检查无递归调用 |
| major migration diff 过大 | 五阶段 Gate；最后一次切 marketplace，不提前发布中间态 |

## 16. 已拍板决策

1. 采用 Common Core + Claude/Codex adapter + 编译期双发布物。
2. 运行时只加载对应平台生成物。
3. 发布物提交进 git，仓库继续直接分发。
4. 不维护两套独立业务正文。
5. 不以 SessionStart 工具映射作为长期主方案。
6. capability 必须支持 `supported/degraded/unsupported + fallback`。
7. commands、agents 先抽象为通用定义，再由平台决定组件形态。
8. Hook 领域判断与平台 codec 分离。
9. 本次按 major 发布，目标版本 14.0.0。

## 17. 待终审问题

当前没有阻塞架构的问题。实现计划阶段仍需细化但不改变架构的事项：

- 首版语义宏的精确语法和 parser。
- Codex standalone command Skill 与 hub Skill 的最终名单。
- Stage 2 Claude snapshot 的代表样本和全量边界。
- 旧根目录到 `core/` 的逐批迁移顺序。
