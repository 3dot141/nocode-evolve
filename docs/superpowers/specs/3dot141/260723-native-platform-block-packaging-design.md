# nocode 原生平台块与静态打包设计

> 状态：approved / implementation pending
>
> 日期：2026-07-23
>
> 取代：`260720-codex-semantic-compatibility-design.md`
>
> 版本影响：major（删除 Capability/profile/provider 运行时语义）

## 1. 罗盘

### 1.1 目标

把当前

```text
业务 Skill
  → Capability(domain.action)
    → using-nocode
      → domain reference
        → provider
          → profile
            → 平台原生工具
```

收敛为：

```text
共享业务 Skill（含少量明文平台块）
                  │
            静态过滤 + 打包
             ┌────┴────┐
          Claude      Codex
          原生工具     原生工具
```

业务作者在源码中直接看见 Claude/Codex 的真实调用。打包器只选择目标平台的文本和文件，不理解业务语义，不参与运行时路由。

### 1.2 已确认约束

1. 业务方法论、规则和 Skill 仍只维护一份。
2. 允许生成 Claude/Codex 两份发布物，但不允许编译器演化成业务 DSL 或运行时框架。
3. 删除 `Capability(...)`、profile 路由、provider registry 和统一 execution receipt。
4. 两个平台使用各自原生工具、原生句柄、原生等待和原生权限机制。
5. 平台差异必须在源码中明文可见，不能藏在多跳 reference 或 registry 后面。
6. `plugins/claude/nocode/` 与 `plugins/codex/nocode/` 继续作为提交进 git 的生成物，marketplace 分发方式不变。
7. 现有 `agents-launcher` 在主工作区中的在途改动不属于本设计范围。

### 1.3 成功标准

- 业务源码中不再出现可执行语义的 `Capability(...)`。
- 不再存在 `search.semantic`、`implementation.general` 等抽象 profile 路由键。
- 不再需要 `using-nocode` 才能理解如何调用当前平台工具。
- 打开任一 Skill 源文件，可以在一个位置读到任务规则和两端原生调用。
- 打包器不读取 capability contract、provider manifest 或 domain registry。
- Claude 生成物不含 Codex 原生工具指令；Codex 生成物不含 Claude 原生工具指令。
- 两端发布物仍可确定性生成并通过 drift check。

### 1.4 非目标

- 不统一 Claude/Codex 的原生 agent 生命周期。
- 不创造新的 `agent.spawn`、`plan.update` 等宏来替代 Capability。
- 不为所有工具操作增加统一 JSON receipt。
- 不保留仅为理论上第三个平台准备的扩展点。
- 不把普通 Read、Write、Shell、计划或提问包装成插件内部接口。
- 不在本次重写业务方法论本身；只改变其平台执行表达。

## 2. 方案比较与决策

### 2.1 方案 A：源码内静态平台块

业务正文保持共享，只在原生工具调用处写 Claude/Codex 两段明确指令。打包时保留目标平台段。

优点：

- 平台行为肉眼可见。
- 没有运行时翻译。
- 没有抽象名字与真实工具名字的映射问题。
- 共享正文不重复。

代价：

- 少数 Skill 会出现两段相似的原生调用说明。
- 平台块需要严格、简单的语法和校验。

**决策：采用。**

### 2.2 方案 B：抽象宏替换

源码写 `{{agent.spawn}}`、`{{plan.update}}`，打包器替换成原生调用。

拒绝原因：宏会重新获得输入 schema、fallback、result contract 和 provider 选择，最终复长成 Capability。

### 2.3 方案 C：两套完整 Skill

Claude/Codex 分别维护完整业务 Skill。

拒绝原因：方法论正文会重复，规则修订必然漂移。

## 3. 总体架构

```text
┌──────────────────────────────────────────────────────┐
│ Shared source                                        │
│                                                      │
│ skills / rules / model / commands / hooks / scripts │
│ Markdown 中仅原生调用处允许 platform block           │
└───────────────────────┬──────────────────────────────┘
                        │
                package.platform.mjs
                 只做机械转换：
                 - 过滤平台块
                 - 复制共享文件
                 - 覆盖平台文件
                 - 生成 manifest/policy
                 - 校验/设置文件模式
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
 plugins/claude/nocode/   plugins/codex/nocode/
 Claude 原生调用            Codex 原生调用
```

运行时不存在 nocode gateway。Skill 直接调用平台已提供的工具。

## 4. 平台块

### 4.1 语法

平台块只允许出现在 Markdown：

```markdown
需要派发独立任务时：

<!-- nocode:platform claude -->
使用 Claude 原生 Agent/Task。保存平台返回的任务句柄，并按原生方式等待或补充指令。
<!-- /nocode:platform -->

<!-- nocode:platform codex -->
调用 `spawn_agent`。保存 agent id；使用 `wait_agent` 等待，使用 `followup_task` 补充指令。
<!-- /nocode:platform -->
```

块外内容是共享正文。打包 Claude 时删除 Codex 块及其标记，反之亦然。

### 4.2 语法限制

- 平台名只允许 `claude`、`codex`。
- 块必须闭合。
- 块不允许嵌套。
- 不支持布尔表达式、版本判断、feature flag 或自定义平台名。
- 不支持在 JSON、JavaScript、shell 中插入平台块。
- 一个差异点优先写相邻的 Claude/Codex 两块，避免散到不同章节。
- 块内直接写原生工具，不允许再写抽象宏。

违反任一条，打包直接失败并报告源文件与行号。

### 4.3 使用边界

平台块只用于真实的平台原生差异：

- agent 派发、等待、续派和取消；
- Skill 调用；
- 计划管理；
- 结构化用户提问；
- worktree/session 进入行为；
- 少量平台专属 Hook 说明。

普通业务判断、prompt、验证规则、文件读写和 shell 命令不使用平台块。

## 5. 平台静态文件

Markdown 之外的平台差异使用显式 overlay，不塞进平台块：

```text
platform/
├── claude/
│   ├── .claude-plugin/plugin.json.template
│   ├── .mcp.json.template
│   ├── hooks/
│   └── runtime/
└── codex/
    ├── .codex-plugin/plugin.json.template
    ├── .mcp.json.template
    ├── hooks/
    └── runtime/
```

overlay 只承载平台不得不不同的内容：

- manifest 结构；
- 插件根和 plugin-data 原生环境变量；
- Hook payload/result codec；
- context 注入预算；
- Codex `agents/openai.yaml` policy；
- MCP 启动参数。

共享 Hook 领域判断继续放 `hooks/`，平台目录只保留 codec/entry。不得把业务路由放进 overlay。

## 6. 打包器边界

`compile.platform.mjs` 重构后改名为 `package.platform.mjs`。名称明确表达“打包”，避免继续向语义编译器扩张。

允许做：

1. 从显式 allowlist 复制共享源码。
2. 对 Markdown 执行平台块过滤。
3. 把目标平台 overlay 覆盖到输出树。
4. 从 `plugin/metadata.json` 渲染 manifest 版本与公共元数据。
5. 为 Codex 生成平台要求的 Skill policy 文件。
6. 排除测试、AGENTS/README、缓存和开发期脚本。
7. 按源文件 executable bit 设置目标模式；普通文件只保证无执行位，不假设宿主 `umask=022`。
8. 比较期望树和已提交生成物，支持 `--check`。

禁止做：

- 解析 Skill 业务步骤；
- 解析或路由 Capability；
- 解析 profile；
- 选择 provider 或 fallback；
- 生成 task graph；
- 合成 execution receipt；
- 读取用户运行时状态；
- 根据工具是否存在改变输出语义；
- 自动把一种平台工具名翻译成另一种。

打包器对业务内容唯一理解是“这段 Markdown 属于哪个平台”。

## 7. 原生执行规则

### 7.1 Agent

业务 Skill 直接描述任务：

```text
目标 / 范围 / 可写路径 / 必须返回的证据 / 完成条件
```

随后在平台块内使用原生调用。

- Codex 使用 `spawn_agent`、`wait_agent`、`followup_task`、`interrupt_agent`。
- Claude 使用当前可用的原生 Agent/Task 操作。
- 平台原生 agent 工具不可用时，Skill 明文规定“主会话执行并说明未获得隔离”，不经过通用 fallbackPolicy。
- 多 agent 并行只由业务规则决定，不交给通用 DAG runtime。

### 7.2 Prompt reference

可以保留复用 prompt，但它只是文本：

```text
skills/<owner>/references/<role>-prompt.md
```

它不拥有 profile id，不参与自动路由。调用方必须显式 Read 自己的 reference，并把内容与具体任务一起传给 agent。

现有 `agents/*.md` 按所有权迁移：

- `recall-search` → recall 所属 Skill reference；
- 搜索 prompt →实际消费它的搜索/研究 Skill reference；
- planner/tdd-guide → 对应设计或 Build Skill reference；
- 无消费者的 profile 删除。

### 7.3 Plan、提问与 Skill 调用

这些操作直接写原生平台块：

- Codex：`update_plan`、`request_user_input`、Skill invocation。
- Claude：原生 task/plan、`AskUserQuestion`、Skill invocation。

不再创建 `planRef` 抽象来模拟两端完全相同。业务只要求“计划状态可见且及时更新”，具体句柄由原生平台管理。

## 8. 删除与保留

### 8.1 删除

- `core/domains/**/capabilities/*.json`
- 仅用于 capability/provider 路由的 contracts
- domain registry 与 provider selection
- workflow provider registry
- `Capability(...)` 调用协议
- `using-nocode` 路由 Skill 及六份生成 reference
- `profile` 字段与抽象 profile 名
- 通用 workflow execution registry
- `execute/wait/collect/followup/cancel` 统一 receipt
- `fallbackPolicy`
- 为普通 workspace read/write/exec 建立的 provider 包装

### 8.2 保留但移位

- Hook 的平台无关判断 → `hooks/lib/`
- Claude/Codex Hook codec → `platform/<platform>/hooks/`
- session/plugin-data 必需脚本 → `platform/<platform>/runtime/` 或共享 `scripts/runtime/`
- Open Design launcher → 作为真实 MCP 启动脚本保留，不称 provider
- project wiki/snapshot 实现 → 作为所属 Skill 的脚本保留
- 路径、argv、安全校验等纯函数 → 按真实消费者放 `scripts/lib/` 或 Skill 私有 scripts
- 平台发布物 drift check

保留代码的判据是“移除 provider 命名后仍有直接运行价值”，不是“过去属于 core/domain”。

## 9. 数据流与失败处理

### 9.1 打包时

```text
读取 metadata
  → 枚举共享 allowlist
  → 校验/过滤 Markdown 平台块
  → 合并目标平台 overlay
  → 生成 manifest/policy
  → 设置文件模式
  → 写输出或执行 drift check
```

任何未知块、未闭合块、目标路径逃逸、重复 overlay 冲突或生成物漂移都 fail loud。

### 9.2 运行时

```text
Skill 业务判断
  → 当前平台原生工具
  → 当前平台原生结果/句柄
  → Skill 继续执行
```

不存在 nocode execution store。失败语义以当前平台工具返回为准，Skill 只规定业务层应如何处理。

## 10. 迁移顺序

### Phase 1：建立静态打包骨架

- 为平台块 parser/filter 写测试。
- 建 `platform/claude`、`platform/codex` overlay。
- 让新打包器在尚未迁移业务调用前生成与当前发布物等价的基本文件树。
- 修正现有权限测试：验证脚本执行位和普通文件无执行位，不硬编码 `0644`，兼容 `umask=077`。

### Phase 2：迁移 Workflow 原生操作

按操作类型批量迁移，不按文件零散迁移：

1. Skill invoke；
2. plan create/update；
3. decision request；
4. agent execute/wait/followup/cancel。

每完成一类，增加 Claude/Codex 生成物语法检查。

### Phase 3：移除 profile 与 using-nocode

- 把仍有消费者的 agent prompt 迁入所属 Skill。
- 把 agent objective 写成自足任务。
- 删除 profile 名和 `using-nocode` agent references。
- 删除全局“语义搜索必派 agent”规则，搜索策略由实际 Skill/主 agent 决定。

### Phase 4：移除其余 Capability domain

- workspace 调用改原生工具；
- design 调用改 Open Design 真实工具或明确的 local fallback；
- personal knowledge 改所属 Skill 直调脚本；
- lifecycle/runtime-state 仅保留 Hook 和 session 真正需要的代码。

### Phase 5：删除旧架构

- 删除 domain registry、provider manifests、废弃 contracts 和 execution state；
- 删除旧 adapter 语义 renderer；
- 将 `compile.platform.mjs` 切换/改名为 `package.platform.mjs`；
- 更新仓库文档、AGENTS、测试、marketplace 路径和版本。

每个 Phase 都必须保证双发布物可生成，不能先整体删除再一次性补齐。

## 11. 测试策略

### 11.1 静态打包测试

- 平台块正确选择 Claude/Codex 内容。
- 未闭合、嵌套、未知平台块失败并带文件/行号。
- 块外共享文本逐字节保持。
- 输出树确定性。
- overlay 不能路径逃逸。
- `--check` 能发现 changed/missing/extra。
- `umask=077` 下权限测试通过。

### 11.2 语法隔离测试

- Claude 生成物不含 `spawn_agent|wait_agent|followup_task|request_user_input|update_plan`。
- Codex 生成物不含 `AskUserQuestion|TaskCreate|TaskUpdate|EnterWorktree` 等 Claude 专属指令。
- 两端生成物都不含 `Capability(`、抽象 profile 或 platform block 标记。

### 11.3 行为回归

- SessionStart 注入与规则 catalog。
- PreToolUse/Stop/PostToolUse codec。
- agent 派发、等待、失败与降级的代表性 Skill。
- plan、用户确认、Skill handoff。
- Open Design 启动与明确 fallback。
- personal wiki/snapshot。
- worktree 创建和进入。

### 11.4 客户端 smoke

Claude/Codex 各至少执行：

1. 普通问答，不触发 agent；
2. 一个明确并行 agent 任务；
3. 一个计划更新；
4. 一个用户决策；
5. 一个 Hook 拦截；
6. 一次 Open Design 或明确不可用降级。

## 12. 风险与缓解

### 风险 1：平台块泛滥

缓解：只允许原生工具差异使用；新增平台块的 review 必须回答“为什么共享正文不能表达”。

### 风险 2：两端说明漂移

缓解：相邻双块、生成物语法检查、两端 smoke；不通过抽象宏隐藏差异。

### 风险 3：大规模迁移期间行为回归

缓解：按操作类型分 Phase；每个 Phase 保持双发布物可运行；旧架构只在消费者归零后删除。

### 风险 4：删除统一 receipt 后丢失状态能力

缓解：只有确有跨回合恢复需求的业务单独保留状态；普通 agent/plan 使用平台原生句柄，不为了理论统一维护全局 execution store。

### 风险 5：打包器重新膨胀

缓解：把“禁止做”清单写进打包器测试和 AGENTS；任何需要理解 Skill 业务语义的需求默认拒绝，改在源 Skill 明文表达。

## 13. 验收清单

- [ ] 平台块语法与失败行为有测试。
- [ ] 新打包器只执行 §6 allowlist。
- [ ] 所有业务 `Capability(...)` 消费者迁移完成。
- [ ] profile 和 `using-nocode` 删除。
- [ ] capability/provider/domain registry 删除。
- [ ] Claude/Codex 生成物语法隔离通过。
- [ ] Hook、Open Design、personal knowledge、worktree 代表性回归通过。
- [ ] `node scripts/vendor-sync.mjs --check` 通过。
- [ ] 平台发布物 drift check 通过。
- [ ] Claude/Codex 客户端 smoke 完成。
- [ ] 版本按 major 升级，源码、生成物与版本同 commit。

## 14. 最终决策

1. 保留双发布物，允许静态打包。
2. 打包器是机械过滤器，不是运行时抽象层。
3. 使用源码内明文 `claude|codex` 平台块。
4. 非 Markdown 差异使用显式平台 overlay。
5. 删除 Capability、profile、provider、using-nocode 和统一 execution receipt。
6. 业务 Skill 直接使用平台原生工具与原生句柄。
7. 可复用 agent 内容只是所属 Skill 的 prompt reference，不是路由实体。
8. 迁移按操作类型分阶段，消费者清零后再删除旧架构。
