---
title: agents-launcher 声明式服务拓扑设计
scenario: feat
topic: agents-launcher-declarative-topology
author: 3dot141
status: approved
date: 2026-07-30
---

# agents-launcher 声明式服务拓扑设计

## 罗盘（轻量 Restate）

### Outcome

把 `agents-launcher` 中硬编码的 workspace 服务集合、启动顺序和依赖重启关系收敛为一份类似 Compose 的 YAML 拓扑。launcher 解析拓扑后执行启动、反向停止和运行期级联重启；`web` 依赖的 `agents` 形成新稳定实例后，launcher 自动重启 `web`。

### Success Criteria

- SC-1：`ui`、`agents`、`full` 与 `--no-<service>` 的现有服务范围保持兼容。
- SC-2：启动按拓扑顺序执行，依赖的 readiness 条件未满足时不启动下游。
- SC-3：launcher 托管 `agents + web` 时，`agents` 的监听实例发生变化且恢复稳定健康后，`web` 恰好重启一次。
- SC-4：配置错误、未知 adapter、未知服务引用和拓扑环在任何进程变更前 fail-loud。
- SC-5：per-service 命令、目录、环境变量、kill 与健康探测知识仍由现有 CLI/adapter 持有，不在 YAML 重复。

### Constraints

- 插件发布物运行时不能依赖用户额外安装 npm 包。
- `dev-orchestrator.mjs` 保持纯跨服务编排；`agents-cli.mjs`、`web-cli.mjs`、`server-cli.mjs` 继续作为域知识单源。
- YAML 只接受受限、版本化 schema，不执行任意 shell，不接受自定义 tag、alias 或未知字段。
- 不自动升级插件版本号；业务源码改动后必须重新生成 Claude、Codex、Qoder 发布物。

### Out of Scope

- 不实现 Docker Compose 的容器、网络、volume、build、deploy 等完整规范。
- 不引入 PM2/systemd daemon，也不把 launcher 变成生产进程管理器。
- 不把 worktree 解析、敏感配置准备或交互确认改写成通用 YAML workflow。
- 不改变“只 web / 只 agents”裁剪所表达的 launcher 所有权边界。
- 不热加载运行中的 YAML；配置变更在下一次显式启动/restart 时生效。

## 背景

核心问题不是“缺少一种配置格式”，而是 launcher 目前无法表达并执行服务之间的运行期关系：

- `lib/cli.mjs` 把 `ui`、`agents`、`full` 三组服务写死为 JS 对象。
- `dev-orchestrator.mjs` 用四段 `if` 固定启动顺序，用另一段组合 kill 命令。
- `agents` 由 `tsx watch` 托管。源码变化时，外层 `pnpm dev:server` 进程可能不退出，但真正监听 `:8070` 的子进程已经更换。
- `web` 同时通过 `AGENTS_LOCAL_SERVER` 访问 agents 服务、通过 `AGENTS_LOCAL_SRC` 读取 agents 源码。agents 形成新运行实例后，继续保留旧 web 进程会让两者生命周期失配。

因此，主目标是建立一个可信的“关系事实源”：它既能生成初次启停顺序，也能声明 `agents` 新实例是否应传播重启到 `web`。YAML 只是这个事实源的载体。

附带问题是当前启停知识分散。该问题只在跨服务关系层解决；命令、路径、端口和仓库准备仍留在现有 per-service CLI，避免借机重写已经稳定的域逻辑。

## 调研

- workspace 集合当前硬编码在 `skills/agents-launcher/lib/cli.mjs`，启动顺序当前硬编码在 `dev-orchestrator.mjs`。
- 现有 `tcpOpen`、`httpOk`、`pidOnPort`、`waitHealthy` 可以复用，但没有运行期 supervisor。
- `agents` 使用 `tsx watch`；只监听 launcher 启动的顶层 ChildProcess 不能识别内部监听子进程替换。
- 历史设计要求零外部依赖 Node ECMAScript Module - ESM、orchestrator 纯编排、per-service 知识留在 CLI。
- Compose 的 `depends_on.restart: true` 只传播 Compose 显式操作，不覆盖运行时自动重启；本设计必须使用不混淆的自有字段。
- `yaml` 2.9.0 是无传递依赖的 YAML 1.2 parser，提供严格解析、重复 key 检查、源码错误位置和 alias 上限。

## 端到端设计图

`identity` 是当前监听实例身份（首版为监听进程标识 Process Identifier - PID）；`generation` 是稳定 identity 每次变化后递增的本轮代际。有向无环图 Directed Acyclic Graph - DAG 用于保证依赖可排序。

```text
agents-launcher.yml
        │
        ▼
严格 YAML Loader ──→ Schema Validator ──→ Topology Planner
                                              │
                         ┌────────────────────┴───────────────────┐
                         ▼                                        ▼
                 启停执行器（DAG）                         运行期 Supervisor
                         │                               health + identity generation
                         └────────────────────┬───────────────────┘
                                              ▼
                                      Adapter Registry
                          ┌───────────┬───────────┬───────────┐
                          ▼           ▼           ▼           ▼
                       docker      agents       server       web
                                      │           │           │
                                      ▼           ▼           ▼
                                现有 per-service CLI / lib/server
```

### 路径

1. 启动：选择 workspace → 应用 `--no-*` 裁剪 → 校验子图 → 拓扑排序 → 逐服务 start + readiness。
2. 停止：选择同一子图 → 按拓扑逆序 stop。
3. 单服务：未选中的 optional dependency 不自动纳入 launcher 所有权。
4. 级联：上游形成新稳定 generation → 计算配置允许的下游闭包 → 拓扑顺序重启，每个事件每个服务最多一次。
5. 配置失败：解析、schema、引用或环错误 → 在任何副作用前退出。
6. 恢复：上游抖动时合并事件，只对最新稳定 generation 执行级联。

## 方案选择

业务流 Business Flow - BF 是后文可独立验证的运行路径。single-flight 表示同一时刻只允许一个级联事务运行。

### 决策速查表

| # | 决策点 | 已确认选择 | 状态 | 影响 |
|---|---|---|---|---|
| Q1 | 配置载体与解析边界怎么选？ | 窄 YAML + vendored `yaml@2.9.0` | `[已确认·用户]` | BF1、CONTRACT-1、SEC-1 |
| Q2 | YAML 与服务实现的职责边界怎么划？ | topology-only YAML + allowlisted adapters | `[已确认·用户]` | BF2、BF3、CONTRACT-2/3 |
| Q3 | 如何识别 agents 新实例并传播重启？ | identity generation + health 迟滞 + single-flight | `[已确认·用户]` | BF4、PERF-1、LOG-1 |

### Q1 / Round 1 — 配置载体与解析边界怎么选？→ 影响 BF1

| 选项 | 推荐度 | 推荐原因 | 主要代价/风险 | 改选条件 |
|---|---:|---|---|---|
| A. 窄 YAML + vendored `yaml` parser | 5 | 符合用户期望；schema 可读；parser 无传递依赖且诊断完整；发布时不要求用户安装依赖 | 发布物增加 vendored parser 与许可证；需维护上游版本 | 若插件包体成为硬约束，改选 B |
| B. 声明式 `.mjs` 对象 | 4 | 原生 ESM、零 parser、类型结构直观 | 配置可执行代码，失去数据文件边界；不符合 Compose-like 使用预期 | 若明确拒绝任何 vendored 代码，改选 B |
| C. 自写 YAML 子集 parser | 1 | 表面上零第三方代码 | YAML 边界、错误定位、安全和兼容性都变成自有维护责任 | 仅在 schema 退化成 JSON 子集时考虑 |

**选择**：A（`validated`，`[已确认·用户]`）。

**传播结果**：

- YAML loader 成为独立模块；parser 以固定版本和许可证随 skill 发布。
- 使用严格 YAML 1.2 解析；拒绝 alias、自定义 tag、重复 key 和多文档输入。
- 解析后仍必须执行独立 schema 校验；YAML parser 不承担领域语义校验。
- YAML 不包含可执行命令，避免把数据文件变成新的 shell 注入面。

**证据**：

- `docs/dev/3dot141/260702-01-launcher-service-clis/launcher-service-clis-plan.md:3-4`
- `scripts/lib/platform-packager.mjs:70`
- [yaml 官方文档](https://eemeli.org/yaml/)
- [Docker Compose 启动顺序文档](https://docs.docker.com/compose/how-tos/startup-order/)

### Q2 / Round 2 — YAML 与服务实现的职责边界怎么划？→ 影响 BF2、BF3

| 选项 | 推荐度 | 推荐原因 | 主要代价/风险 | 改选条件 |
|---|---:|---|---|---|
| A. 拓扑 YAML + allowlisted adapter registry | 5 | 延续 orchestrator 纯编排与 per-service 单源；配置可校验且不能执行任意命令 | 需要把异构 CLI 包成统一 adapter contract | 若所有服务被统一迁入同一进程框架才重新评估 |
| B. YAML 同时声明 command/cwd/kill/health shell | 2 | 表面更像 Compose，新增服务无需写 adapter | 与现有 CLI 重复事实；扩大 shell 注入面；复杂服务仍需代码 hooks | 只有 launcher 变成通用第三方工具时考虑 |
| C. 通用事件/动作规则 DSL | 2 | 理论上能表达任意级联 | 解释器、调试和失败语义显著膨胀，超出四个本地服务的需求 | 出现三个以上无法由依赖边表达的真实用例后再考虑 |

**选择**：A（`validated`，`[已确认·用户]`）。

**配置草案**：

```yaml
schema_version: 1

supervision:
  interval_ms: 1000
  stable_successes: 2
  failure_threshold: 2

workspaces:
  ui: [agents, web]
  agents: [docker, agents, web]
  full: [docker, agents, server, web]

services:
  docker:
    adapter: docker
    lifecycle: oneshot

  agents:
    adapter: agents
    lifecycle: service
    depends_on:
      docker:
        condition: service_completed_successfully
        required: false

  server:
    adapter: server
    lifecycle: service
    depends_on:
      agents:
        condition: service_healthy
        required: false

  web:
    adapter: web
    lifecycle: service
    depends_on:
      agents:
        condition: service_healthy
        required: false
        propagate_restart: true
      server:
        condition: service_healthy
        required: false
```

**字段语义**：

- `workspaces` 是服务范围单源，替代 `lib/cli.mjs` 内硬编码的 `WORKSPACES`。
- `adapter` 只能引用 JS registry 中已注册的 adapter；YAML 不能提供模块路径或命令。
- `condition` 首版只支持 `service_healthy` 与 `service_completed_successfully`。
- `required: false` 表示依赖未被当前 workspace/`--no-*` 选中时不自动接管它；若被选中，仍参与排序和 readiness gate。
- `propagate_restart: true` 是本 launcher 的运行期 generation 传播语义，不冒充 Compose 的 `restart: true`。
- `lifecycle: oneshot` 的节点执行完成后不进入运行期 PID supervisor。

**Adapter Contract**：

```js
{
  start(context): Promise<{ handles?: unknown[] }>,
  stop(context): Promise<void>,
  status(context): Promise<{
    healthy: boolean,
    identity?: string
  }>
}
```

adapter wrapper 只统一契约，真实行为继续委托现有 CLI：

- `agents` → `agentsCli.start/killCommands/status`
- `web` → `webCli.start/killCommands/status`
- `server` → `serverCli.start/killCommands/serverStatus`
- `docker` → `serverCli.infra` + 基础设施组合状态

现有 worktree、env、CSS、GraalVM、Docker 临时脚本等准备仍是启动前 preflight，不进入通用拓扑 schema。

**传播结果**：

- 配置成为服务集合与跨服务关系的唯一事实源。
- `PORTS`、探测方式和域命令不迁入 YAML，避免第二事实源。
- planner 必须在副作用前校验 schema、未知 adapter、未知引用和 DAG 环。
- stop 使用同一拓扑的逆序，不维护另一份停止顺序。

**证据**：

- `skills/agents-launcher/dev-orchestrator.mjs:11-13,150-192`
- `skills/agents-launcher/agents-cli.mjs:22-66`
- `skills/agents-launcher/web-cli.mjs:47-124`
- `skills/agents-launcher/lib/server/boot.mjs:116`
- [Compose Specification：depends_on](https://github.com/compose-spec/compose-spec/blob/main/spec.md#depends_on)
- [systemd unit 依赖关系](https://github.com/systemd/systemd/blob/main/man/systemd.unit.xml)

### Q3 / Round 3 — 如何识别 agents 新实例并传播重启？→ 影响 BF4

| 选项 | 推荐度 | 推荐原因 | 主要代价/风险 | 改选条件 |
|---|---:|---|---|---|
| A. 监听 launcher ChildProcess `exit/close` | 1 | 实现简单 | `tsx watch` 父进程可常驻，无法识别真正监听服务已更换 | 仅适用于无 wrapper 的普通 child |
| B. 监听 health `down → up` | 3 | 跨平台且不依赖 PID | 短暂网络抖动会误判；很快的重启可能没采到 down | 服务没有稳定 identity 时作为降级 |
| C. identity generation + 带迟滞 health | 5 | 能识别 `tsx watch` 内部子进程替换；能用稳定窗口过滤抖动；显式 restart 也可直接产生 generation | 需要运行期 supervisor、单飞和事件去重 | 目标平台无法取得监听 identity 时降级到 B |

**选择**：C（`validated`，`[已确认·用户]`）。

**服务状态**：

```text
unobserved
    │ 初次连续健康，只建立 baseline，不传播
    ▼
healthy(identity=A)
    │ 达 failure_threshold
    ▼
degraded(last=A)
    │ 观察到 identity=B 且达 stable_successes
    ▼
healthy(identity=B, generation+1)
    │
    └── emit dependency.generation_changed
```

补充规则：

1. 单次探测失败不改变稳定状态。
2. `healthy(A) → healthy(A)` 不传播；同一实例短暂异常恢复不算重启。
3. launcher 显式重启服务时，由执行器在新实例 readiness 通过后直接递增 generation，不依赖轮询碰巧捕获。
4. ChildProcess `exit/close` 只作为立即触发一次探测的加速信号，不单独证明新 generation。
5. `agents` adapter 的 identity 使用 `:8070` 监听 PID；其它 service 由各自 adapter 返回 identity。
6. `oneshot` 节点不进入 generation supervisor。

**级联事务**：

```text
上游 generation N 稳定
        │
        ▼
沿 propagate_restart=true 计算 selected-service 下游闭包
        │
        ▼
等待所有必要上游 readiness
        │
        ▼
反向拓扑 stop 下游闭包
        │
        ▼
正向拓扑 start + readiness 下游闭包
        │
        ▼
记录 eventId + 新 baseline，每服务每事件最多一次
```

- 初次启动只建立 baseline，不导致 web 二次启动。
- `--no-web` 后 web 不在 selected-service 子图中，因此不参与级联。
- 上游尚未恢复时保留当前 web，报告 degraded；不在健康未知时盲目重启下游。
- 同一上游连续产生多个候选 identity 时，旧候选被新候选取代；只对最新稳定 generation 执行。
- 级联事务 single-flight。若执行期间又出现新 generation，当前事务完成后重新计算，而不是并发停启。
- 下游重启失败时记录结构化失败并停止本次传播；不杀掉已经恢复的上游，也不进入无限自动重试。

**传播结果**：

- 新增纯状态机模块，轮询、sleep、clock、adapter status 都可注入测试。
- 级联是图上的边级策略，不在 `agents` 或 `web` CLI 内互相调用。
- 下游重启必须复用 adapter，最终仍调用 `webCli.start()`，保留 Vite cache 清理和 `BROWSER=none`。

**证据**：

- `skills/agents-launcher/lib/probe.mjs:7-35`
- `skills/agents-launcher/lib/proc.mjs:6-41`
- `skills/agents-launcher/agents-cli.mjs:22-27,59-66`
- `skills/agents-launcher/web-cli.mjs:111-124`
- [Docker HEALTHCHECK 状态机](https://docs.docker.com/reference/dockerfile/#healthcheck)
- [PM2 readiness 机制](https://pm2.keymetrics.io/docs/usage/signals-clean-restart/)

## 领域划分 + 总图

### 拆分依据

本功能只有一个限界上下文 Bounded Context - BC：`agents-launcher`。`agents`、`web` 和 `server` 是被管理的外部进程，不是 launcher 内共享的领域实体；launcher 只持有它们的 service ID、依赖边和观测 identity。

上下文内部按两个核心实体拆分：

| 域 | 聚合根 Aggregate Root - AR | 子实体/值对象 | 变更边界 |
|---|---|---|---|
| 拓扑域 Topology | `ServiceTopology` | `ServiceNode`、`DependencyEdge`、`WorkspaceProjection`、`ServicePlan` | 新增 workspace、服务或关系时只改 YAML/schema/planner |
| 生命周期域 Lifecycle | `ServiceRuntime` | `ObservedService`、`GenerationEvent`、`CascadeTransaction` | 改健康迟滞、事件合并或重启事务时不改 YAML parser |
| 适配边界 Integration | 无聚合根；这是防腐层 | `ServiceAdapter` | per-service 命令/端口变化只改对应 adapter 或原 CLI |

拆分成立的验证：

```text
新增 workspace       → 拓扑域变化，生命周期状态机不变
调整稳定采样次数      → 生命周期域变化，YAML 结构不变
web 启动命令变化      → web-cli / web adapter 变化，拓扑与状态机不变
新增 agents→web 传播 → 只改 YAML 边；runtime 复用同一闭包算法
```

### 域关系总图

```text
┌─────────────────────────────────────────────────────────────┐
│                    agents-launcher BC                       │
│                                                             │
│  ┌──────────────────────┐                                   │
│  │ 拓扑域 Topology       │                                   │
│  │                      │                                   │
│  │ YAML Loader          │                                   │
│  │ Schema Validator     │                                   │
│  │ Workspace Projection │                                   │
│  │ DAG Planner          │                                   │
│  └──────────┬───────────┘                                   │
│             │ SelectedTopology + ServicePlan                │
│             ▼                                               │
│  ┌──────────────────────┐     ┌───────────────────────────┐ │
│  │ 生命周期域 Lifecycle  │────→│ 适配边界 Adapter Registry │ │
│  │                      │     │                           │ │
│  │ ServiceRuntime       │     │ docker / agents          │ │
│  │ GenerationSupervisor │     │ server / web             │ │
│  │ CascadeTransaction   │     └────────────┬──────────────┘ │
│  └──────────────────────┘                  │                │
└────────────────────────────────────────────┼────────────────┘
                                             │ 委托既有行为
             ┌───────────────────────────────┼───────────────┐
             ▼                               ▼               ▼
       agents-cli.mjs                  web-cli.mjs      server-cli.mjs
             │                               │               │
             ▼                               ▼               ▼
       agents :8070                    Vite :10001       server/Docker
```

依赖方向固定为：

```text
YAML → 拓扑域 → 生命周期域 → Adapter Registry → 既有 CLI
```

下层不反向 import 上层；现有 CLI 不读取 YAML、不感知依赖图，也不直接调用彼此。

## 架构与契约

### 模块架构

```text
dev-orchestrator.mjs
  │ ① load config，解析 CLI，执行现有 preflight
  ▼
lib/launcher-config.mjs ──→ lib/topology.mjs
  │                         │
  │ ValidatedConfig         │ ServicePlan
  └─────────────────────────┤
                            ▼
                    lib/service-runtime.mjs
                      │             │
                      │             └── lib/supervisor.mjs
                      ▼
                    lib/service-adapters.mjs
                      │
                      └── agents-cli / web-cli / server-cli
```

职责约束：

- `launcher-config.mjs` 只做读取、YAML 安全解析、schema 规范化和 adapter 引用校验。
- `topology.mjs` 是纯函数，只做 workspace 投影、optional dependency 处理、DAG 校验、拓扑排序和传播闭包。
- `service-runtime.mjs` 执行 plan，持有 child handle 和级联 single-flight，不知道具体命令。
- `supervisor.mjs` 是纯状态机外加可注入轮询；它只产出 generation event，不直接 stop/start。
- `service-adapters.mjs` 是唯一把统一契约翻译为现有 CLI 调用的地方。
- `dev-orchestrator.mjs` 保留路径确认、agents config 检查、外部 infra 预检、web env/CSS 等现有 preflight。

### YAML 数据契约 CONTRACT-1

配置文件固定为 `skills/agents-launcher/agents-launcher.yml`。schema v1 只允许以下字段：

| 路径 | 类型 | 必填 | 约束 |
|---|---|---:|---|
| `schema_version` | integer | 是 | 必须精确为 `1` |
| `supervision.interval_ms` | integer | 是 | `>= 100`；避免高频 `lsof` 忙轮询 |
| `supervision.stable_successes` | integer | 是 | `>= 1`；样例值 `2` 表示连续两次稳定才接受 identity |
| `supervision.failure_threshold` | integer | 是 | `>= 1`；样例值 `2` 表示一次失败不改变稳定状态 |
| `workspaces.<id>` | unique string array | 是 | service ID 必须存在；数组顺序仅作同级稳定排序 |
| `services.<id>.adapter` | string | 是 | 必须命中代码中的 adapter allowlist |
| `services.<id>.lifecycle` | enum | 是 | `service` 或 `oneshot` |
| `depends_on.<id>.condition` | enum | 是 | `service_healthy` 或 `service_completed_successfully` |
| `depends_on.<id>.required` | boolean | 是 | `false` 时未选中的依赖不扩张 launcher 所有权 |
| `depends_on.<id>.propagate_restart` | boolean | 否 | 默认 `false`；只控制新 generation 的下游传播 |

任何层级的未知字段均报错。以下字段即使语法合法也不在 schema 内：`command`、`cwd`、`env`、`module`、`script`、`shell`、`ports`。

解析管线：

```text
read UTF-8
  ↓
parseAllDocuments(strict YAML 1.2 core schema)
  ↓
必须恰好一个 document，且 document.errors 为空
  ↓
AST visit：拒绝 Alias；拒绝非 YAML core tag
  ↓
toJS(maxAliasCount=0)
  ↓
递归 exact-key schema validation
  ↓
adapter/workspace/reference/DAG validation
  ↓
deep-freeze ValidatedConfig
```

`yaml@2.9.0` 的 browser distribution 原样放入 `skills/agents-launcher/vendor/yaml/`，同时保留 `LICENSE`、上游版本、tarball integrity 和来源 URL。选择 browser distribution 是因为它是原生 ESM 且不依赖 Node package resolution；插件发布物只需复制目录，不要求运行者 `npm install`。

加载接口：

```js
export function loadLauncherConfig(options = {}) {
  // 读取 options.path；测试可注入 readFile 与 parseAllDocuments
  // 完成 YAML 语法、AST 安全和 exact-key schema 校验
  // 校验 service.adapter 均存在于 options.adapterNames
  // 返回不可变的 ValidatedConfig 与 sourcePath
}
```

错误使用统一前缀 `[topology]`，尽可能携带配置路径与 YAML 行列；不得附带完整配置内容或环境变量。

### 拓扑计划契约 CONTRACT-2

`buildServicePlan(config, { workspace, disabled })` 返回：

```js
{
  workspace: 'ui',
  selected: ['agents', 'web'],
  omittedOptionalDependencies: [],
  startOrder: ['agents', 'web'],
  stopOrder: ['web', 'agents'],
  propagationEdges: [
    { upstream: 'agents', downstream: 'web' }
  ]
}
```

规划规则：

1. 从 `workspaces[workspace]` 建立初始 selected set。
2. 应用 `--no-<service>`，只删除，不自动加入任何服务。
3. selected service 的依赖也被选中时，保留排序/readiness 边。
4. 依赖未选中且 `required:false` 时，记录 `omittedOptionalDependencies` 后忽略该边。
5. 依赖未选中且 `required:true` 时，规划失败；失败发生在任何 adapter 调用前。
6. 对 selected 子图执行 Kahn 拓扑排序；同级节点按 workspace 声明顺序稳定排序。
7. `stopOrder` 必须是 `startOrder` 的精确逆序，不维护第二套顺序。
8. 传播边只保留两端都 selected 且 `propagate_restart:true` 的边。

`ui`、`agents`、`full` 的兼容投影：

| workspace | selected | startOrder |
|---|---|---|
| `ui` | `agents, web` | `agents → web` |
| `agents` | `docker, agents, web` | `docker → agents → web` |
| `full` | `docker, agents, server, web` | `docker → agents → server → web` |

在 `full` 中，`agents → web` 与 `server → web` 同时约束 web，因此 web 始终最后启动；只有 `agents → web` 带 restart propagation。

### Adapter 契约 CONTRACT-3

统一接口：

```js
{
  lifecycle: 'service' | 'oneshot',
  async start(context) {
    // 启动或完成一次性动作，返回本次创建的 ChildProcess handle 数组
    // 不在 adapter 内等待其它 service；跨服务 readiness 由 runtime 处理
    return { handles: [] };
  },
  async stop(context) {
    // 幂等停止本 service；重复调用不得因为“已停止”而失败
  },
  async status(context) {
    // healthy 表示 condition 已满足；identity 是当前监听实例身份
    return { healthy: false, identity: null };
  }
}
```

adapter 对照表：

| adapter | start | stop | status / identity |
|---|---|---|---|
| `agents` | `agentsCli.start()` | 逐条执行 `agentsCli.killCommands()` | `agentsCli.status()`；健康时 identity=`:8070` listener PID |
| `web` | `webCli.start()` | `webCli.killCommands()` | `webCli.status()`；identity=`:10001` listener PID |
| `server` | `serverCli.start()` | `serverCli.killCommands()` | HTTP `:8081` + listener PID |
| `docker` | `serverCli.infra()` | 正常 stop 为 no-op；仅 `dockerDownOnExit` teardown 执行 compose down | `oneshot`：`infra()` resolve 即 completed |

`web` 的每一次 start，包括级联重启，都必须经过 `webCli.start()`；因此 Vite cache 清理、`JSY_DEV_MODE=vite` 和 `BROWSER=none` 不会被新 runtime 绕过。

`--css-watch` 是 launcher 本轮的辅助进程，不是 topology service。它在初次 preflight 后只启动一次，handle 交给 runtime 的 auxiliary handle 集合，退出时随 launcher 清理；web 级联重启不得再次创建 CSS watcher。

`docker` 的 `oneshot` 指 launcher 的启动动作完成，不代表 Docker 容器随 launcher 进程退出。这样保留当前 `--stop` 和失败退出不停止 Docker 的诊断语义。

### CLI 兼容契约 CONTRACT-4

保留：

- 默认 `--workspace=ui`。
- `--workspace=ui|agents|full`。
- `--no-web|--no-agents|--no-server|--no-docker`。
- `--dry-run`、`--css-watch`、`--docker-down-on-exit`、`--yes`、`--status`、`--stop`。
- `--status` 仍输出 web、agents、server、pg、minio 五行。
- `--stop` 仍不默认停止 Docker。

变化：

- workspace 合法值和初始服务集合从 YAML 读取，`parseArgs()` 接收已验证的 workspace/service catalog。
- `--dry-run` 新增输出配置来源、start/stop order、被裁剪 optional dependency 和传播边。
- 主启动成功后，若 selected graph 有传播边，launcher 保持 supervisor 轮询；没有传播边时不创建 interval。

## 表现层设计：系统交互场景

### 端到端业务流

```text
CLI invocation
  ↓
[BF1] 加载并验证完整拓扑
  ├─ 失败 → 输出定位信息并退出；零 stop/start 副作用 [GATE-1]
  └─ 成功
      ↓
  [BF2] workspace/--no-* 投影 + preflight
      ↓
  [BF3] reverse stop → topological start → readiness
      ↓
  建立 supervisor baseline
      ↓
  agents identity 是否形成新稳定 generation？
      ├─ 否 → 继续观测
      └─ 是
          ↓
      [BF4] 计算传播闭包 → reverse stop → forward start/readiness
          ↓
      标记 eventId 完成，继续观测
```

### BF1 — 配置加载与无副作用失败

调用时序：

```text
dev-orchestrator      launcher-config       YAML parser       topology
      │                      │                   │                │
      │ load(path, adapters) │                   │                │
      ├─────────────────────→│                   │                │
      │                      │ parseAllDocuments │                │
      │                      ├──────────────────→│                │
      │                      │ AST + diagnostics │                │
      │                      │←──────────────────┤                │
      │                      │ schema/reference/DAG validate      │
      │                      ├───────────────────────────────────→│
      │                      │ ValidatedConfig                    │
      │←─────────────────────┤←───────────────────────────────────┤
      │ parse CLI + build plan│
```

伪代码：

```js
function loadLauncherConfig({ path, adapterNames, readFile, parseAllDocuments }) { // 入口只接收数据与 allowlist
  const source = readFile(path, 'utf8'); // 读取 UTF-8，不执行配置内容
  const documents = parseAllDocuments(source, STRICT_YAML_OPTIONS); // 使用 YAML 1.2 core 严格模式
  assertSingleDocument(documents, path); // 多文档会让“哪份配置生效”不明确，因此拒绝
  assertNoParserErrors(documents[0], path); // 在领域校验前先报告语法与重复 key
  assertSafeAst(documents[0]); // 拒绝 alias 和自定义 tag，避免隐式展开与非标准构造
  const raw = documents[0].toJS({ maxAliasCount: 0 }); // AST 安全检查后转普通 JS 数据
  const config = validateExactSchema(raw, adapterNames); // 递归拒绝未知字段并校验引用
  assertAcyclic(config.services); // 完整配置的环在进程副作用前失败
  return deepFreeze({ sourcePath: path, ...config }); // 后续阶段只能消费不可变结果
} // 返回后才允许进入 stop/start
```

异常优先级固定为：YAML 语法 → schema/未知字段 → adapter/service/workspace 引用 → DAG 环。一次错误只报告当前最高优先级，避免后续错误建立在无效结构上。

### BF2 — workspace 投影与 preflight

```text
ValidatedConfig + argv
  ↓
parseArgs(workspaceCatalog, serviceCatalog)
  ↓
buildServicePlan(workspace, disabled)
  ↓
输出 topology.loaded + plan.created
  ↓
现有路径确认、config.yaml、Docker script、web env、CSS preflight
  ↓
[dry-run?]
  ├─ 是 → 输出完整计划后退出
  └─ 否 → 进入 BF3
```

配置校验先于 preflight，因为 preflight 可能写 `.env.local` 或构建 CSS；SC-4 要求拓扑错误在这些副作用之前暴露。仓库路径解析与交互确认仍在 `dev-orchestrator.mjs`，因为它们不是通用服务拓扑的一部分。

伪代码：

```js
function prepareLaunch(config, argv) { // 把已验证配置与 CLI 输入收敛成一份无副作用计划
  const catalog = topologyCatalog(config); // workspace 与 service 合法值只从 YAML 导出
  const args = parseArgs(argv, catalog); // 解析旧 CLI flags，不在此启动或停止进程
  const plan = buildServicePlan(config, args); // 裁剪 optional dependency 并计算 DAG 顺序
  emit('topology.loaded', summarizeConfig(config, args)); // 只记录版本、路径和 selected service
  emit('plan.created', summarizePlan(plan)); // 输出 start/stop order 与传播边供 dry-run/诊断
  return { args, plan }; // orchestrator 拿到完整计划后才允许进入 imperative preflight
} // 任何异常都在副作用边界外上抛
```

### BF3 — 初次启停与 readiness

`full` workspace 的调用时序：

```text
ServiceRuntime       docker adapter      agents adapter      server adapter      web adapter
      │ stop(web)────────────────────────────────────────────────────────────────────→│
      │ stop(server)─────────────────────────────────────────────→│                    │
      │ stop(agents)───────────────────────────→│                  │                    │
      │ start(docker)───────→│                  │                  │                    │
      │ completed───────────←│                  │                  │                    │
      │ start(agents)──────────────────────────→│                  │                    │
      │ status until healthy(identity=A)───────→│                  │                    │
      │ start(server)────────────────────────────────────────────→│                    │
      │ status until healthy─────────────────────────────────────→│                    │
      │ start(web)───────────────────────────────────────────────────────────────────→│
      │ status until healthy(identity=W1)────────────────────────────────────────────→│
      │ seed supervisor baseline agents=A                                               │
```

执行规则：

1. 初次清理使用 `plan.stopOrder`，但 normal stop 下 docker adapter 为 no-op。
2. 每个 start 完成后，根据所有已选中入边的 `condition` 等待 readiness。
3. 任一步 start/readiness 失败，按已启动 service 的逆序清理；Docker 保留供排查。
4. 所有服务 ready 后才建立 supervisor baseline；baseline 不发 generation event。
5. ChildProcess handle 进入 runtime handle map，signal teardown 与级联 stop 复用同一停止入口。

伪代码：

```js
async function ServiceRuntime.startSelected() { // 执行拓扑域产出的确定性计划
  await this.stopSelected({ includeDocker: false }); // 先按逆序清理上一轮，保留 Docker 诊断语义
  for (const serviceId of this.plan.startOrder) { // 依赖节点必然排在 dependent 之前
    await this.waitSelectedDependencies(serviceId); // 只等待当前 selected graph 中保留的入边条件
    const result = await this.adapters[serviceId].start(this.context); // 所有副作用只经 allowlisted adapter
    this.registerHandles(serviceId, result.handles ?? []); // 保存 launcher 本轮创建的 child 供统一关闭
    await this.waitServiceCondition(serviceId); // service 等健康，oneshot 等 start promise 成功完成
  } // 任一异常由外层按已启动集合逆序清理
  await this.supervisor.seed(this.plan.propagationSources); // 全部 ready 后建立 generation 0 baseline
  this.phase = 'running'; // baseline 完成才对外宣告 runtime 可监督
} // 初次 seed 不触发 BF4
```

### BF4 — agents 新 generation 级联 web

调用时序：

```text
Supervisor         agents adapter       ServiceRuntime       web adapter
    │ tick status        │                    │                    │
    ├───────────────────→│                    │                    │
    │ healthy, pid=B     │                    │                    │
    │←───────────────────┤                    │                    │
    │ tick status        │                    │                    │
    ├───────────────────→│                    │                    │
    │ healthy, pid=B     │                    │                    │
    │←───────────────────┤                    │                    │
    │ generation_changed(agents,1,eventId)   │                    │
    ├────────────────────────────────────────→│                    │
    │                                         │ stop(web)          │
    │                                         ├───────────────────→│
    │                                         │ start(web)         │
    │                                         ├───────────────────→│
    │                                         │ healthy,pid=W2     │
    │                                         │←───────────────────┤
    │ accept explicit baseline web=W2         │                    │
    │←────────────────────────────────────────┤                    │
    │ cascade.completed                       │                    │
```

级联算法：

```js
async function runCascade(event, selectedTopology) { // event 已代表一个稳定的新上游 generation
  const targets = propagationClosure(event.serviceId, selectedTopology); // 只沿显式 propagate_restart 边
  const stopOrder = selectedTopology.stopOrder.filter((id) => targets.has(id)); // 下游先停，避免反向依赖
  const startOrder = selectedTopology.startOrder.filter((id) => targets.has(id)); // 依赖先起，恢复正向顺序
  emit('cascade.started', { eventId: event.id, targets: [...targets] }); // 先记录事务边界供诊断
  await assertUpstreamsReady(targets); // 上游未恢复时不动仍可工作的下游
  for (const id of stopOrder) await stopService(id); // 同一 eventId 每个 target 最多停一次
  for (const id of startOrder) await startAndWaitReady(id); // 每个 target 经原 adapter 启动并等待健康
  synchronizeBaselines(startOrder, { emit: false }); // 级联内被重启的传播源不再产生重复事件
  rememberCompleted(event.id, targets); // eventId 去重状态只在整个事务成功后提交
  emit('cascade.completed', { eventId: event.id, targets: [...targets] }); // 记录成功终点与耗时
} // 失败由外层记录 cascade.failed，且不杀已恢复的上游
```

`agents → web` 首版只有一个 target，但实现使用传递闭包，保证以后仅通过 YAML 增加 `A → B → C` 时仍能得到 `stop: C,B`、`start: B,C`。

### BF5 — 停止、信号与失败退出

| 触发 | 行为 |
|---|---|
| `--stop` | 加载/验证拓扑，投影 selected graph，按 stopOrder 停止；不启动 supervisor |
| `SIGINT/SIGTERM` | 停 supervisor，阻止新级联，等待当前 stop/start 原子段结束，再按 stopOrder teardown |
| 主启动失败 | 停止本轮已启动的 service；Docker 保留 |
| 级联下游失败 | 记录 `cascade.failed`，终止本 event，不无限 retry，不停止上游 |
| agents 长期不健康 | 状态进入 degraded；web 保持现状，不触发级联 |

signal handler 不直接并发执行第二套 kill 循环，而是调用 `ServiceRuntime.close()`。`close()` 使用同一个 single-flight 锁，防止信号与级联同时操作 web。

关闭伪代码：

```js
async function ServiceRuntime.close({ downDocker = false } = {}) { // signal、失败退出和显式 stop 共享入口
  if (this.closePromise) return this.closePromise; // 重复信号复用同一个关闭事务
  this.phase = 'closing'; // 先阻止 supervisor 接收新的 generation event
  this.closePromise = this.withOperationLock(async () => { // 等当前级联到安全点，禁止并发 stop/start
    await this.supervisor.stop(); // 清 timer 并等待未决 tick settle
    await this.stopSelected({ includeDocker: downDocker }); // 按同一 plan.stopOrder 做幂等 teardown
    await this.stopAuxiliaryHandles(); // CSS watcher 等只在整体关闭时清理，不参与 web 级联
    this.phase = 'closed'; // 所有 adapter stop 尝试结束后进入终态
  }); // 锁内不创建无限 retry
  return this.closePromise; // 调用方可等待退出完成
} // 单个 stop 错误记录后继续 best-effort 清理剩余服务
```

### 异常与失败模式

| 所属 BF | 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|---|
| BF1 | YAML 语法或重复 key | parser 返回 errors | 输出路径+行列，终止加载，零副作用 | 上抛到 CLI 入口并 exit 1 |
| BF1 | 未知字段/adapter/service、self-edge、DAG 环 | schema/topology validation 失败 | 输出最先失败的领域路径，禁止 preflight | 上抛到 CLI 入口并 exit 1 |
| BF2 | workspace 不存在 | argv 引用 catalog 外值 | 输出 YAML 中可选 workspace | 上抛到 CLI 入口并 exit 1 |
| BF2 | required dependency 被 `--no-*` 删除 | selected projection 缺必需依赖 | plan 构建失败，不执行 preflight | 上抛到 CLI 入口并 exit 1 |
| BF2 | 现有 repo/config/infra preflight 失败 | 路径、config 或中间件不满足 | 保留现有 fail-loud 文案，不进入 runtime | 上抛到 CLI 入口并 exit 1 |
| BF3 | adapter start 抛错 | 命令无法 spawn 或 oneshot 失败 | 逆序清理本轮已启动 service，Docker 保留 | 清理后上抛并 exit 1 |
| BF3 | readiness 超时 | adapter status 在期限内未 healthy | 与 start 失败相同，日志标 service/stage | 清理后上抛并 exit 1 |
| BF4 | agents 单次 health 失败 | 未达 `failure_threshold` | 只累计失败，不改稳定状态 | 吞掉该观测，不发事件 |
| BF4 | agents 长期 degraded | 达失败阈值但没有新稳定 identity | 记录 state change，保持 web 现状 | 吞掉轮询错误，继续监督 |
| BF4 | web 级联 stop/start/readiness 失败 | adapter 或 health 失败 | 记录 `cascade.failed`，结束该 event，不停止 agents | 吞到 runtime 边界，不退出 launcher |
| BF4 | 级联中又出现新 generation | 新 event 到达 single-flight | 覆盖 pending upstream generation，当前事务后再 drain | 合并，不并发执行 |
| BF5 | signal 与级联同时发生 | SIGINT/SIGTERM 到达 | 进入 closing，拒绝新 event，等待 operation lock 后 teardown | 正常退出；不抛第二次关闭 |
| BF5 | 某 service stop 失败 | kill command 非零或 child 已消失 | 记录 service/stage/error，继续清理其余 service | best-effort 吞掉，最终报告 |

### 单测设计

#### BF1 — 配置加载

- Case BF1.1 合法单文档
  - Given：schema v1、四个合法 adapter 与无环依赖。
  - When：调用 `loadLauncherConfig()`。
  - Then：返回 deep-frozen config，且保留 source path。
- Case BF1.2 YAML 安全拒绝矩阵
  - Given：多文档、alias、自定义 tag、重复 key 各一份 fixture。
  - When：逐份加载。
  - Then：均在 schema/runtime 前失败，并包含路径或行列信息。
- Case BF1.3 领域引用失败
  - Given：未知字段、未知 adapter、未知 service、自依赖和二节点环。
  - When：加载配置。
  - Then：逐项 fail-loud，fake adapter 调用次数为零。

#### BF2 — 投影与 preflight 边界

- Case BF2.0 未知 workspace
  - Given：argv 指定 YAML catalog 中不存在的 workspace。
  - When：调用 `parseArgs()`。
  - Then：错误列出 YAML 中的合法 workspace，plan 与 preflight 均未执行。
- Case BF2.1 workspace 兼容
  - Given：正式 YAML 与 `ui/agents/full`。
  - When：分别构建 plan。
  - Then：selected set 与旧 `WORKSPACES` 完全一致。
- Case BF2.2 optional dependency 裁剪
  - Given：`ui --no-agents`，web→agents 为 `required:false`。
  - When：构建 plan。
  - Then：web 保留、agents 不被重新加入，省略边进入诊断列表。
- Case BF2.3 required dependency 缺失
  - Given：fixture 中 web→agents 为 `required:true` 且禁用 agents。
  - When：构建 plan。
  - Then：plan 失败，preflight spy 未调用。
- Case BF2.4 dry-run
  - Given：合法 full plan 与所有副作用 spy。
  - When：执行 dry-run 路径。
  - Then：输出 config/start/stop/propagation，write/kill/start 调用均为零。
- Case BF2.5 preflight 失败
  - Given：合法 topology，但 repo path、agents config 或外部 infra 任一不满足。
  - When：执行对应 imperative preflight。
  - Then：沿用既有 fail-loud 错误，runtime adapter 的 stop/start 调用均为零。

#### BF3 — 初次启停

- Case BF3.1 full 正常路径
  - Given：四个 fake adapter 均按首次 status 变 healthy。
  - When：执行 `startSelected()`。
  - Then：trace 精确为 reverse stop 后 `docker→agents→server→web` start/readiness。
- Case BF3.2 start 失败
  - Given：server adapter start 抛错，docker/agents 已成功。
  - When：执行 `startSelected()`。
  - Then：只逆序清理 agents，Docker 保留，web 从未启动。
- Case BF3.3 readiness 超时
  - Given：agents 一直 unhealthy。
  - When：执行 `startSelected()`。
  - Then：抛出 agents readiness timeout，server/web 未启动。
- Case BF3.4 baseline
  - Given：agents 首次连续两次 healthy(identity=A)。
  - When：seed supervisor。
  - Then：generation=0，级联 event 数为零。

#### BF4 — generation 与级联

- Case BF4.1 新 identity
  - Given：baseline A，随后 `unhealthy×2 → healthy(B)×2`。
  - When：逐 tick 驱动 supervisor。
  - Then：只发一次 agents generation 1，web stop/start 各一次。
- Case BF4.2 同 identity 恢复
  - Given：baseline A，随后 `unhealthy×2 → healthy(A)×2`。
  - When：逐 tick 驱动 supervisor。
  - Then：回 healthy(A)，不产生 generation event。
- Case BF4.3 快速重启未采到 down
  - Given：baseline A，随后直接 `healthy(B)×2`。
  - When：逐 tick 驱动 supervisor。
  - Then：产生一次 generation event。
- Case BF4.4 候选与 single-flight
  - Given：B 未稳定前出现 C，且 cascade g1 期间出现稳定 g2。
  - When：完成所有 tick 与 operation promise。
  - Then：B 被丢弃、C 成为稳定 identity；级联不并发，最终消费最新 generation。
- Case BF4.5 下游失败
  - Given：web restart readiness 超时。
  - When：运行 cascade。
  - Then：agents stop 次数为零、无无限 retry，并输出一次 `cascade.failed`。
- Case BF4.6 上游长期 degraded
  - Given：baseline A 后，agents 持续 unhealthy 且没有新稳定 identity。
  - When：运行超过 `failure_threshold` 的多个 tick。
  - Then：只产生一次 degraded 状态变化，web stop/start 均为零，supervisor 继续可观测。

#### BF5 — 关闭

- Case BF5.1 signal 与级联竞态
  - Given：web cascade 正处在 operation lock，连续触发两次 close。
  - When：释放级联并等待 close promises。
  - Then：只执行一次逆序 teardown，无并发 adapter 操作。
- Case BF5.2 stop best-effort
  - Given：web stop 抛错、agents stop 成功。
  - When：执行 close。
  - Then：agents 仍被停止，web 错误被记录，close 到达 closed。

## 领域层设计

### 生命周期域：ServiceRuntime 模块

`ServiceRuntime` 持有：

```js
{
  plan,
  adapters,
  handlesByService,
  auxiliaryHandles,
  phase: 'idle' | 'starting' | 'running' | 'cascading' | 'closing' | 'closed',
  cascadePromise,
  pendingGenerationEvents,
  settledEventsByUpstream
}
```

外部方法：

| 方法 | 作用 |
|---|---|
| `stopSelected({ includeDocker })` | 按 plan.stopOrder 幂等停止 |
| `startSelected()` | 按 plan.startOrder 启动并等待 readiness |
| `startSupervisor()` | seed baseline，并只监控传播源 |
| `requestCascade(event)` | 合并事件并串行 drain |
| `registerAuxiliaryHandle(handle)` | 登记 CSS watcher 等非 topology child，仅在整体 close 时清理 |
| `close({ downDocker })` | 停轮询，等待当前事务安全点后逆序 teardown |

runtime 不保存 PID 文件或持久化 generation；launcher 每次运行从 generation 0 建立新 baseline。该状态只需要在本轮开发会话内正确。

### GenerationSupervisor 模块

每个被监控 service 的状态：

```js
{
  phase: 'unobserved' | 'healthy' | 'degraded',
  stableIdentity: null,
  candidateIdentity: null,
  candidateSuccesses: 0,
  consecutiveFailures: 0,
  generation: 0
}
```

状态转换：

```text
unobserved
  │ healthy(identity=A) 连续 stable_successes 次
  ▼
healthy(A, generation=0) ───────────────┐
  │ failure 连续 failure_threshold 次   │ healthy(identity=B) 连续稳定
  ▼                                    │
degraded(last=A)                       │
  │ healthy(A) 连续稳定                 │
  ├──────────────────────→ healthy(A)   │
  │                                     ▼
  └─ healthy(B) 连续稳定 ───────→ healthy(B, generation+1)
                                      │
                                      └─ emit generation_changed
```

`healthy(A) → healthy(B)` 即使没有采到中间 down，也按候选 identity 连续稳定后产生 generation；这覆盖快速重启。`degraded(A) → healthy(A)` 只表示同一实例恢复，不传播。

tick 伪代码：

```js
async function tickService(serviceId) { // 每个 interval 对同一 service 最多执行一次
  const observed = await adapters[serviceId].status(context); // adapter 同时返回 health 与 listener identity
  const state = states.get(serviceId); // 状态完全在内存，测试可逐 tick 驱动
  if (!observed.healthy) return recordFailure(state); // 达阈值才进入 degraded，单次失败不翻转
  if (!observed.identity) return recordInvalidObservation(state); // 传播源缺 identity 时告警且不猜 generation
  const transition = recordHealthy(state, observed.identity); // 累计同 identity 的连续成功
  if (!transition.generationChanged) return; // baseline、同 PID 恢复和未稳定候选均不传播
  onGenerationChanged({ serviceId, generation: state.generation }); // 只把领域事件交给 runtime
} // tick 自身永不直接 stop/start 下游
```

轮询纪律：

- 只监控 selected graph 中至少有一条传播出边的 service；当前只有 `agents`。
- interval tick 未完成时跳过下一次 tick，不允许同一 supervisor 堆积 Promise。
- ChildProcess `exit/close` 只触发一次尽快 tick；它不是 generation 事实。
- `stop()` 清理 timer 并等待当前 tick settle，防止测试和退出留下悬挂任务。

### 级联 single-flight

```text
event agents:g1 ──┐
                  ├─ pending map 只保留各 upstream 最新 generation
event agents:g2 ──┘
                         │
                    cascadePromise 存在？
                      ├─ 是 → 当前事务后再 drain
                      └─ 否 → 立即 drain
```

同一 `eventId + target` 已完成时跳过。不同 generation 是不同事件；如果 agents 在第一次 web 重启期间再次形成稳定 generation，第一次事务完成后允许针对最新 generation 再执行一次。这避免丢失真实重启，同时禁止并发 stop/start。

级联失败是终态而不是 retry 信号：runtime 从 pending map 移除当前 event，在 `settledEventsByUpstream` 把该 upstream 的最新结果记为 `failed`，记录一次 `cascade.failed` 后结束 drain。相同或更低 generation 不会自动重新入队；只有更高 generation 的新 event，或用户重新启动整个 launcher，才会进行新的尝试。该 map 每个 upstream 只保留最新一项，因此不会随 watch 次数增长。

#### 生命周期域文件影响与验证

```text
skills/agents-launcher/lib/
├── supervisor.mjs                    (NEW) generation 纯状态机与可注入轮询
├── supervisor.test.mjs               (NEW) baseline、迟滞、identity、tick 并发
├── service-runtime.mjs               (NEW) plan 执行、handle、cascade、close
└── service-runtime.test.mjs          (NEW) fake adapter 顺序、失败与竞态
```

验证以 BF3、BF4、BF5 的 Given/When/Then 为主；所有 clock、sleep、status 与 adapter 均注入，不依赖真实端口。

### 拓扑域：ServiceTopology 聚合

`ServiceTopology` 是已验证配置的内存只读表示。它的约束在构造时一次性成立：

- service ID、workspace ID 唯一且格式为 `^[a-z][a-z0-9-]*$`。
- 每个 workspace 至少含一个 service，且没有重复 service ID。
- 每条 dependency 指向存在且不同于自己的 service。
- `service_completed_successfully` 只允许指向 `lifecycle: oneshot`。
- `service_healthy` 只允许指向 `lifecycle: service`。
- 完整 service graph 无环。
- 每个传播源的 adapter 必须声明 `supportsIdentity:true`。

`ServiceTopology` 不接收 command、路径或端口，因此它无法产生进程副作用。

#### 传播闭包

`propagationClosure(upstream, plan)` 从 upstream 的传播出边进行 DFS/BFS，只把 downstream 加入 target set，不把触发源自己加入。遍历使用 plan.startOrder 作为稳定顺序，最终 stop/start 顺序分别由全局 order 过滤得到，而不是依赖遍历碰巧的顺序。

示例：

```text
A ─propagate→ B ─propagate→ C
└─propagate→ D

plan.startOrder = [A, B, C, D]
targets(A)      = {B, C, D}
stop            = [D, C, B]
start           = [B, C, D]
```

即使传播子图存在重复可达路径，set 与 `eventId + target` 去重保证每个 target 每个 event 最多一次。

#### 拓扑域文件影响与验证

```text
skills/agents-launcher/
├── agents-launcher.yml               (NEW) 关系事实源
└── lib/
    ├── launcher-config.mjs           (NEW) parser 与 exact schema
    ├── launcher-config.test.mjs      (NEW) 解析/安全/引用 fixtures
    ├── topology.mjs                  (NEW) 投影、DAG、闭包
    └── topology.test.mjs             (NEW) 顺序、环、optional、传播
```

验证以 BF1、BF2 为主；测试必须同时证明合法输出与所有失败都发生在 adapter 调用前。

### 适配边界：Integration

`createServiceAdapters({ repos, ports, options, io })` 返回冻结的 registry。`io` 注入 `runToEnd`、`spawnPrefixed`、probes 和 logger，使集成测试不需要真实仓库与端口。

adapter wrapper 只做三件事：

1. 把统一 context 映射成现有 CLI 参数。
2. 把现有 `{ up, pid }` 规范化成 `{ healthy, identity }`。
3. 把 ChildProcess handle 返回 runtime。

它不复制：

- `agentsCli.killCommands()` 的 `pkill telemetry/preload.ts` 与 `:8070` 兜底。
- `webCli.start()` 的 Vite cache 与环境变量。
- `serverCli.start()` 的 infra、GraalVM 与隔离 env。
- `serverCli.killCommands()` 的 Gradle、容器和端口三层停止。

跨上下文引用方向：

| launcher 字段 | 指向 | 传递方式 | 不允许 |
|---|---|---|---|
| `serviceId` | adapter registry | allowlisted key | YAML module path |
| `identity` | 外部监听进程 | adapter status 返回字符串 | 读取/共享外部进程对象 |
| `handles[]` | launcher 创建的 ChildProcess | 仅本轮内存引用 | 写入 YAML 或持久化 |
| repo path | per-service CLI | context 参数 | 写入拓扑 schema |

外部三仓的数据、配置和实体都不进入 launcher 领域模型，因而不存在跨仓共享实体或直读对方存储。

#### 适配边界文件影响与验证

```text
skills/agents-launcher/lib/
├── service-adapters.mjs              (NEW) 四个 adapter wrapper
└── service-adapters.test.mjs         (NEW) 现有 CLI 委托与 status 规范化
```

验证使用注入 spy：断言参数、调用次数、返回 handle 和 identity 规范化；不重复测试 per-service CLI 内部命令构造。

## 兼容、迁移与发布

### 原子切换 MIG-1

本次不保留“YAML 优先、失败回退旧 JS”的双读阶段。原因是双读会留下两个服务集合与顺序事实源，配置错误反而静默跑旧行为，直接违背 SC-4。

切换顺序在同一个实现变更中完成：

```text
加入 vendored parser + agents-launcher.yml
  ↓
加入 loader/schema/topology tests
  ↓
parseArgs 改为消费 config catalog
  ↓
runtime/adapters/supervisor 接管启停
  ↓
删除 cli.mjs 的 WORKSPACES 与 dev-orchestrator 固定 Step 1/2/3
  ↓
三平台发布物重生成并做 package --check
```

回滚按 git commit 原子回滚整个变更；不在运行时维护 fallback。YAML 不热加载，所以运行中的 launcher 不受文件半写状态影响。

### 发布物

`scripts/lib/platform-packager.mjs` 会递归复制 skill 内非测试文件；因此以下运行时内容会自然进入 Claude、Codex、Qoder：

- `agents-launcher.yml`
- 新增 `.mjs` runtime 模块
- `vendor/yaml/browser/**`
- `vendor/yaml/LICENSE`
- `vendor/yaml/NOTICE.md`

测试文件按既有 `*.test.mjs` 过滤，不进入发布物。实现后必须运行 `node scripts/package.platform.mjs`，不能手改 `plugins/*/nocode/`。

`NOTICE.md` 记录：

| 字段 | 值 |
|---|---|
| package | `yaml` |
| version | `2.9.0` |
| source | `https://www.npmjs.com/package/yaml/v/2.9.0` |
| tarball integrity | `sha512-2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA==` |
| vendored subset | `browser/**`, `LICENSE` |

### 操作兼容性

| 场景 | 旧行为 | 新行为 |
|---|---|---|
| 默认启动 | agents → web | 相同，由 `ui` topology 生成 |
| `--workspace=agents` | docker → agents → web | 相同，由 DAG 生成 |
| `--workspace=full` | docker → agents → server → web | 相同，由 DAG 生成 |
| `--no-agents` | 不接管 agents，仍可起 web | 相同，optional edge 被裁剪 |
| `--no-docker` + agents | 检查外部 pg/minio | 相同，保留 imperative preflight |
| `--stop` | 停 selected services，保留 Docker | 相同，docker normal stop 为 no-op |
| agents runtime restart | launcher 无感 | agents 新稳定 generation 后重启 web 一次 |

## 文件影响汇总

```text
skills/agents-launcher/
├── agents-launcher.yml                  (NEW)  schema v1 拓扑单源 [CONTRACT-1]
├── dev-orchestrator.mjs                 (改)   ① 配置先验加载
│                                               ② 调用 plan/runtime
│                                               ③ 保留现有 preflight 与 status 输出
├── lib/
│   ├── cli.mjs                          (改)   删除 WORKSPACES，消费 config catalog [CONTRACT-4]
│   ├── cli.test.mjs                     (改)   workspace/--no-* 兼容测试
│   ├── launcher-config.mjs              (NEW)  YAML 安全解析 + exact schema [BF1]
│   ├── launcher-config.test.mjs         (NEW)  YAML/schema/引用失败矩阵
│   ├── topology.mjs                     (NEW)  投影、DAG、顺序、传播闭包 [BF2]
│   ├── topology.test.mjs                (NEW)  workspace/环/optional/闭包
│   ├── service-adapters.mjs             (NEW)  allowlisted adapter registry [CONTRACT-3]
│   ├── service-adapters.test.mjs        (NEW)  CLI 委托与 status 规范化
│   ├── service-runtime.mjs              (NEW)  plan 执行、readiness、级联 single-flight [BF3/BF4/BF5]
│   ├── service-runtime.test.mjs         (NEW)  fake adapter 端到端顺序与失败语义
│   ├── supervisor.mjs                   (NEW)  generation 迟滞状态机 [Q3]
│   └── supervisor.test.mjs              (NEW)  baseline/抖动/identity/single tick
└── vendor/yaml/
    ├── browser/**                       (NEW)  yaml@2.9.0 原生 ESM browser distribution
    ├── LICENSE                          (NEW)  上游许可证
    └── NOTICE.md                        (NEW)  版本、来源、integrity、vendored subset

docs/dev/3dot141/
├── 260730-01-agents-launcher-declarative-topology/
│   └── agents-launcher-declarative-topology-design.md (改) 本设计单一事实源
└── INDEX.md                              (改)   设计生命周期索引

plugins/claude/nocode/skills/agents-launcher/**  (生成) package.platform.mjs
plugins/codex/nocode/skills/agents-launcher/**   (生成) package.platform.mjs
plugins/qoder/nocode/skills/agents-launcher/**   (生成) package.platform.mjs
```

手写范围限定为上表列出的配置、runtime/test 模块和三个既有入口文件；第三方 browser distribution 保持上游原文。生成物不计入手写文件数。

## 安全与性能

### 安全 SEC-1

- YAML 是只读数据；schema 不含命令、模块路径、环境变量或任意文件路径。
- parser 使用 YAML 1.2 core schema；拒绝 alias、自定义 tag、多文档与重复 key。
- adapter 名只匹配 registry 自有 key，不能由配置拼接 import 路径。
- 所有 config/reference/DAG 错误先于 `.env.local`、CSS build、kill、start。
- 结构化日志只记录 service ID、状态、generation、PID identity、eventId 和耗时；不记录 env、config body 或命令中的敏感参数。
- vendored 文件保留许可证、版本和 tarball integrity，后续升级必须显式 review。

### 性能 PERF-1

- 默认 `interval_ms=1000`，`stable_successes=2`、`failure_threshold=2`。这给一次瞬时探测失败一个采样缓冲，并让新 identity 约 2 秒内确认；它不是生产 SLO，可由 YAML 调整。
- 只探测带传播出边的 selected upstream；当前每秒只额外执行一次 agents health + PID 探测。
- interval 不重入；慢 tick 会丢弃下一拍，而不是积压。
- DAG 与闭包规模只有四个服务，但实现复杂度仍是 `O(V+E)`，不通过嵌套全排列找顺序。
- settled event 去重按 upstream 只保留最新结果；pending generation 也按 upstream 覆盖，内存不随 watch 次数无限增长。

## 部署与运维边界

- 这是本地开发 launcher，不创建 daemon、不注册系统启动项。
- 不增加生产 Metrics、Alert、Trace；console 结构化日志足够支持本地故障定位。
- YAML 变更在下一次 launcher invocation 生效；运行时修改文件不会重排当前进程。
- 真实 smoke 会操作相邻 agents/web worktree 与本地端口，Verify 前必须再次获得用户操作许可。
- 本功能不是 AI 功能，`isAIFeature=false`，不需要 eval 设计。

发布策略：

| 项目 | 设计 |
|---|---|
| 灰度 | 不适用按流量灰度：这是随插件版本安装的本地 CLI。合并前以 fake adapter 集成测试和获准本地 smoke 作为门禁 |
| 回滚 | 回滚包含 YAML、runtime、vendor 与三平台生成物的同一 git commit；不保留运行时双读 |
| 监控 | 本地观察 `topology.loaded`、`plan.created`、`service.state_changed`、`cascade.*`；无生产 dashboard |
| 阻断条件 | 全量 launcher 测试、vendor sync check、三平台 package check 任一失败均不得交付 |

## 对齐、失败预演与领域覆盖

### 罗盘回检

三轮选择满足罗盘：workspace 与顺序由 YAML 单源产生；CLI 域知识未迁入 YAML；`agents → web` 通过显式边级策略传播；`--no-*` 继续定义 launcher 本轮所有权。

### Pre-mortem

假设方案三个月后失败，最可能是：

1. **YAML 演化成第二套 workflow/命令语言。**
   - 应对：schema 只允许 `workspaces/services/adapter/lifecycle/depends_on/supervision`；未知字段报错；禁止 command、cwd、env、module path 和 shell。
2. **短暂探测抖动触发 web 重启风暴。**
   - 应对：identity generation + 成功/失败阈值；级联 single-flight；eventId 去重；只监控存在 `propagate_restart` 出边且被选中的上游。
3. **vendored parser 漂移或引入解析安全问题。**
   - 应对：固定上游版本并保留 LICENSE/来源记录；拒绝 alias、自定义 tag、多文档和重复 key；parser 与 schema fuzz/fixture 测试；升级走显式 review。

### 领域覆盖

| 领域 | 决策 |
|---|---|
| 架构 | YAML → loader/validator → planner/supervisor → allowlisted adapters；CLI 保持域单源 |
| 测试 | 纯 loader、DAG 和 supervisor 状态机单测；orchestrator 注入 adapter 的集成测试；现有 59 条基线继续通过 |
| 安全 | YAML 不执行代码或 shell；禁止 alias/custom tag；拒绝未知 key/adapter；配置错误在副作用前失败 |
| API/契约 | 保留现有 workspace 与 `--no-*` CLI；新增内部 schema v1 与 adapter contract |
| 性能 | 仅轮询有传播出边的 selected upstream；默认 1 秒，状态机工作串行且不阻塞日志转发 |
| 前端 | 无产品 UI 改动；web 仍通过 `webCli.start()` 清 Vite cache 后启动 |
| 可观测 | 基础结构化日志必做；生产 Metrics/Alert 不适用于本地 launcher |
| 迁移 | YAML 与 graph engine 同一变更切换；删除硬编码 `WORKSPACES`/固定顺序，不保留双读 fallback |

## 可观测设计

### 基础日志设计 LOG-1

必须记录：

- `topology.loaded`：schema version、workspace、selected services、配置路径。
- `plan.created`：拓扑启动序、停止序、被裁剪的 optional dependency。
- `service.state_changed`：service、previous/new state、identity（只记录 PID/模式，不记录 env）。
- `cascade.started`：eventId、upstream、generation、targets。
- `cascade.completed`：eventId、targets、耗时。
- `cascade.failed`：eventId、失败 service、stage、error；不输出敏感配置。

## 红蓝军自查

**对象**：窄 YAML 拓扑 + adapter registry + generation supervisor。

**维度**：正确性、单源边界、YAGNI、解析安全、失败语义、跨平台性、可测试性。

### 红军质疑与缓解

| 质疑 | 结论 | 缓解 |
|---|---|---|
| 四个服务不值得引入 YAML | Warning，但不推翻 | 用户需要可维护依赖；YAML 必须真实替代 workspace/顺序硬编码，不做装饰配置 |
| vendored parser 对一个小文件过重 | Warning | 选择零传递依赖、固定版本的官方 parser；若包体成为硬约束，明确改选 `.mjs`，不自写 parser |
| YAML 与 adapter 会形成双重服务定义 | Warning | YAML 只拥有关系；adapter 只拥有行为；启动时强制 service↔adapter 引用完整性校验 |
| Compose-like 字段容易让人误解 restart 语义 | 已修复 | 不使用 Compose 的 `restart: true`，改名 `propagate_restart` 并写明 generation 语义 |
| 同步 `lsof` 高频轮询会增加开销 | Suggestion | 只监控存在传播出边的服务；保留可配置 interval；性能测试设调用次数与事件循环预算 |

### Verdict

**推荐采用**，独立性为主会话 self-review。成立条件是：YAML 保持窄拓扑、parser 随插件固定分发、传播使用 generation 状态机、硬编码旧拓扑同批删除。若任何一项退化为“YAML 和 JS 各维护一份”或“YAML 执行任意命令”，则应改回 `.mjs` 拓扑对象而不是继续扩 DSL。

## 测试目标

测试目标 Test Objective - TO 描述必须被证明的行为，不规定 Plan 中的具体测试代码组织。

| ID | 层级 | 目标 |
|---|---|---|
| TO-1 | 单测 | 合法 YAML 被解析为规范化 schema；语法错误、多文档、alias、自定义 tag、重复 key、未知字段均 fail-loud |
| TO-2 | 单测 | 未知 adapter、未知 service 引用、自依赖和 DAG 环在任何 adapter 调用前失败 |
| TO-3 | 单测 | `ui/agents/full` 投影与现有服务集合一致，`--no-web/--no-agents/--no-server/--no-docker` 只裁剪本轮所有权 |
| TO-4 | 单测 | planner 给出确定性启动序与精确逆序停止序；未选中的 `required:false` dependency 不被自动加入 |
| TO-5 | 单测 | 初次 `healthy(identity=A)` 只建立 baseline，不产生级联事件 |
| TO-6 | 单测 | `A → degraded → B healthy×2` 只产生一次 generation 事件，web 只 stop/start 一次 |
| TO-7 | 单测 | `A healthy → A degraded → A healthy` 不产生 generation 事件；单次探测失败不改变稳定状态 |
| TO-8 | 单测 | 多个候选 identity 在稳定前连续出现时只消费最新 generation；并发事件被 single-flight 合并 |
| TO-9 | 单测 | 传播只沿 `propagate_restart:true` 的 selected-service 边计算传递闭包，stop 逆序、start 正序，每个 target 每个 eventId 最多一次 |
| TO-10 | 单测 | 上游长期不恢复时不重启下游；下游重启失败时不停止上游、不无限重试，并输出 `cascade.failed` |
| TO-11 | 集成 | adapter registry 正确委托现有 CLI；web 级联重启仍经过 `webCli.start()` 的 Vite cache 清理与 `BROWSER=none` |
| TO-12 | 集成 | `--dry-run` 输出 YAML 来源、selected services、启动/停止顺序和传播边，不启动或停止任何进程 |
| TO-13 | 回归 | 现有 agents-launcher 测试全部通过；`--status` 输出与 stop 的 Docker 默认保留语义不回归 |
| TO-14 | 性能 | 只轮询存在传播出边的 selected upstream；注入 100 次 tick 时无额外服务探测、无并行未决 tick |
| TO-15 | 安全/审查 | vendored parser 固定版本、带 LICENSE；日志和错误不包含 env/config secret；YAML 中不存在 command/module path |
| TO-16 | 手工 smoke | 真实 `tsx watch` 触发 agents 监听 PID 更新后，日志出现单个 cascade event，`:10001` 获得新 PID且最终 healthy |
| TO-17 | 打包 | `vendor parser + agents-launcher.yml + runtime modules` 同步进入 Claude/Codex/Qoder 发布物，`package.platform.mjs --check` 无漂移 |

### 覆盖状态

| 路径/约束 | 测试目标 |
|---|---|
| 启动与 readiness | TO-3, TO-4, TO-11, TO-12 |
| 反向停止 | TO-4, TO-9, TO-13 |
| 单服务裁剪 | TO-3, TO-4, TO-9 |
| agents → web 级联 | TO-5, TO-6, TO-7, TO-8, TO-9, TO-16 |
| 配置失败前无副作用 | TO-1, TO-2 |
| 上游/下游失败恢复 | TO-8, TO-10 |
| 零安装依赖与发布 | TO-15, TO-17 |
| 性能与可观测 | TO-10, TO-12, TO-14, TO-15 |

### Verify Strategy

1. 纯函数优先：loader、schema、DAG、generation 状态机全部通过注入 clock/sleep/status/adapter 测试。
2. 集成层不启动真实仓：使用 fake adapter 记录 prepare/start/stop/status 顺序，验证 orchestrator 契约。
3. per-service CLI 继续由现有测试保护，不在 graph 测试重复其域内逻辑。
4. 最后执行一次获用户允许的真实 `ui` smoke，触发 `tsx watch` 并观察 PID/日志/端口。
5. 运行全量 launcher 测试、vendor sync check 与三平台 package check。

不测项：不做生产 daemon、容器编排或浏览器功能 E2E；风险由 launcher 局部边界和真实进程 smoke 覆盖。

## 实施设计项清单

下表是下游 Plan、Build、Verify 的唯一追踪单源。`required` 项必须由实现 task 承接；`verify-only` 项不要求新增独立实现，但必须采集本轮新鲜证据。

| ID | 类型 | 设计项 | 来源章节 | 影响范围 | 状态 | 验证/理由 |
|---|---|---|---|---|---|---|
| Q1 | Decision | 使用窄 YAML 与 vendored `yaml@2.9.0` browser distribution | 方案选择 / Q1 | loader、vendor、发布物 | required | TO-1、TO-15、TO-17 |
| Q2 | Decision | YAML 只持有拓扑，行为经 allowlisted adapter 委托既有 CLI | 方案选择 / Q2 | schema、adapter、CLI | required | TO-2、TO-11 |
| Q3 | Decision | 用 identity generation + health 迟滞识别重启并 single-flight 传播 | 方案选择 / Q3 | supervisor、runtime | required | TO-5 至 TO-10、TO-14、TO-16 |
| BF1 | Business Flow | 配置安全加载、exact schema 与副作用前失败 | 表现层设计：系统交互场景 / BF1 | launcher-config、topology | required | TO-1、TO-2 |
| BF2 | Business Flow | workspace/flags 投影、plan 与现有 preflight 衔接 | 表现层设计：系统交互场景 / BF2 | cli、orchestrator、topology | required | TO-3、TO-4、TO-12 |
| BF3 | Business Flow | selected graph 逆序停止、正序启动与 readiness | 表现层设计：系统交互场景 / BF3 | runtime、adapters | required | TO-4、TO-11、TO-13 |
| BF4 | Business Flow | 新 generation 触发传播闭包级联事务 | 表现层设计：系统交互场景 / BF4 | supervisor、runtime | required | TO-6、TO-8、TO-9、TO-10 |
| BF5 | Business Flow | stop/signal/启动失败/级联失败的统一关闭语义 | 表现层设计：系统交互场景 / BF5 | runtime、orchestrator | required | TO-10、TO-13 |
| CONTRACT-1 | Contract | schema v1 exact-key YAML 数据契约 | 架构与契约 / YAML 数据契约 | config、loader | required | TO-1、TO-15 |
| CONTRACT-2 | Contract | selected plan、optional dependency 与确定性 DAG 顺序 | 架构与契约 / 拓扑计划契约 | topology、cli | required | TO-2、TO-3、TO-4 |
| CONTRACT-3 | Contract | start/stop/status/identity adapter 统一接口 | 架构与契约 / Adapter 契约 | service-adapters、现有 CLI | required | TO-11 |
| CONTRACT-4 | Contract | 保留 workspace、flags、status、stop 外部 CLI | 架构与契约 / CLI 兼容契约 | cli、orchestrator | required | TO-3、TO-12、TO-13 |
| LOG-1 | Log | 六类结构化 topology/plan/state/cascade 日志且不含 secret | 可观测设计 / 基础日志设计 LOG-1 | config、runtime、supervisor | required | TO-10、TO-12、TO-15 |
| SEC-1 | Security | 禁止 alias/tag/多文档/未知 key/任意命令与动态 adapter import | 安全与性能 / 安全 | parser、schema、adapter registry | required | TO-1、TO-2、TO-15 |
| PERF-1 | Performance | 只监督传播源、tick 不重入、闭包 `O(V+E)` | 安全与性能 / 性能 | supervisor、topology | required | TO-14 |
| MIG-1 | Migration | 同一变更原子切换 YAML 并删除旧硬编码，无双读 fallback | 兼容、迁移与发布 / 原子切换 | cli、orchestrator、config | required | TO-3、TO-13、TO-17 |
| GATE-1 | Gate | config/schema/reference/DAG 全部通过前禁止 preflight/stop/start | 表现层设计：系统交互场景 / BF1 | orchestrator 入口 | required | TO-1、TO-2、TO-12 |
| TO-1 | Test Objective | YAML 语法与安全拒绝矩阵 | 测试目标 | launcher-config tests | required | `node --test .../launcher-config.test.mjs` |
| TO-2 | Test Objective | adapter/reference/self-edge/cycle 在副作用前失败 | 测试目标 | config/topology tests | required | fake adapter 调用计数必须为 0 |
| TO-3 | Test Objective | workspace 与 `--no-*` 兼容投影 | 测试目标 | cli/topology tests | required | 精确对象/数组断言 |
| TO-4 | Test Objective | 确定性启动序与逆序停止序 | 测试目标 | topology tests | required | 顺序精确断言 |
| TO-5 | Test Objective | 初次健康只建立 baseline | 测试目标 | supervisor tests | required | event 数为 0 |
| TO-6 | Test Objective | `A→degraded→B×2` 只级联一次 | 测试目标 | supervisor/runtime tests | required | web stop/start 各 1 |
| TO-7 | Test Objective | 同 identity 恢复和单次失败不传播 | 测试目标 | supervisor tests | required | event 数为 0 |
| TO-8 | Test Objective | 候选 identity 与并发事件合并 | 测试目标 | supervisor/runtime tests | required | 只消费最新稳定 generation |
| TO-9 | Test Objective | 传播闭包及 stop/start 顺序、每 target 去重 | 测试目标 | topology/runtime tests | required | 传递图 fake adapter trace |
| TO-10 | Test Objective | 上游/下游失败不误杀、不无限重试并有失败日志 | 测试目标 | runtime tests | required | 调用次数与 `cascade.failed` 断言 |
| TO-11 | Test Objective | adapter 委托既有 CLI，web start 保留 cache/env 行为 | 测试目标 | service-adapters tests | required | 注入 spy 精确断言 |
| TO-12 | Test Objective | dry-run 展示完整 plan 且零进程副作用 | 测试目标 | orchestrator/runtime integration | required | fake io 调用计数为 0 |
| TO-13 | Test Objective | 现有 launcher 回归及 status/stop Docker 语义 | 测试目标 | 全量 launcher suite | verify-only | 运行本轮全量 `node --test` |
| TO-14 | Test Objective | 100 ticks 只探测传播源且无并发 tick | 测试目标 | supervisor tests | required | probe 次数与最大并发为 1 |
| TO-15 | Test Objective | vendor/license/integrity、日志脱敏、schema 无命令字段 | 测试目标 | tests + inspection | required | fixture 拒绝测试与 diff inspection |
| TO-16 | Test Objective | 真实 `tsx watch` PID 更换后 web 单次重启 | 测试目标 | local smoke | verify-only | 获用户允许后记录 PID、eventId 与端口健康 |
| TO-17 | Test Objective | 三平台发布物与源码一致 | 测试目标 | packaging | verify-only | `node scripts/package.platform.mjs --check` |

### Registry 双向检查

- 规范性决策 Q1-Q3、业务流 BF1-BF5、契约 CONTRACT-1 至 CONTRACT-4、横切项 LOG/SEC/PERF/MIG/GATE 和 TO-1 至 TO-17 均已登记。
- 每个 Registry ID 都能回到上表“来源章节”；没有只存在于附件或第二设计文件的规范性内容。
- `required` 均有实现意图；`verify-only` 均给出验证方法；没有 `deferred` 或缺理由的 `n/a` 项。

## Decision Packet

### version

`1`

### selectedApproach

**[已确认·用户] 选定方案**：在 `skills/agents-launcher/agents-launcher.yml` 维护窄服务拓扑；由严格 loader、schema validator 和 DAG planner 生成启停计划；由 generation supervisor 观察明确声明传播关系的上游；所有副作用经 allowlisted adapter registry 委托现有 per-service CLI。

**端到端路径**：

```text
加载并完整校验配置
  → workspace/flags 投影 selected-service 子图
  → preflight
  → 逆序清理旧 selected services
  → 拓扑正序启动并逐项 readiness
  → 建立 generation baseline
  → 只监督带 propagate_restart 出边的上游
  → 新 generation 稳定后执行下游级联事务
  → SIGINT/SIGTERM 时按逆序 teardown
```

**决策轮次**：

| Round | 前沿 | 候选与推荐度 | 已确认选择 | 关键证据 | 改选条件 | 影响路径/组件 |
|---|---|---|---|---|---|---|
| 1 | 配置载体与 parser | 窄 YAML+vendor 5；`.mjs` 4；自写 parser 1 | 窄 YAML + `yaml` 2.9.0 browser distribution | `yaml` 官方文档；插件 skills 整树打包；零外部安装约束 | 包体成为硬约束时改 `.mjs` | loader、发布物、配置失败路径 |
| 2 | 配置与域代码边界 | topology+adapter 5；command YAML 2；事件 DSL 2 | YAML 只持有关系，adapter 持有行为 | 既有 orchestrator 纯编排与 CLI 单源决策 | launcher 变为独立通用产品时重评 | schema、planner、adapter registry、preflight |
| 3 | 重启事实源与传播 | child exit 1；health 边沿 3；identity generation 5 | generation + health 迟滞 + single-flight | `tsx watch` 语义；现有 `pidOnPort/httpOk`；Compose 不覆盖内部重启 | 无 identity 平台降级 health down→up | supervisor、级联事务、日志、失败恢复 |

完整设计图、候选代价和传播结果见前文「端到端设计图」与「决策账本」。

### alternatives

| 备选 | 推荐度 | 否决理由 | 保留价值/改选条件 |
|---|---:|---|---|
| 只为 `agents → web` 写硬编码 monitor | 2 | 能修当前症状，但 workspace、顺序和后续传播继续散落在代码中，不满足声明式维护目标 | 若确认永远只有这一条关系且拒绝 YAML |
| 声明式 `.mjs` 拓扑对象 | 4 | 技术上最轻，但配置可执行且不符合用户提出的 Compose-like YAML | vendored parser 包体不可接受时首选回退 |
| 完整 Compose-like 命令 DSL | 2 | 重复 CLI 域知识，扩大安全和调试面，仍无法复用 Compose runtime | launcher 被独立产品化并需任意仓使用时重做设计 |
| 直接采用 PM2/concurrently | 2 | 能托管进程但缺依赖健康与边级传播；PM2 还带 daemon、许可证和大量依赖成本 | 未来需要持久 daemon、集群或系统启动时重评 |

### constraints

1. YAML 是跨服务关系单源；不得与 JS 硬编码 workspace/顺序并存。
2. per-service 命令、路径、端口和健康实现不进入 YAML。
3. plugin 运行时不能要求用户安装 npm/Python/Docker 之外的新工具；parser 必须随发布物固定分发。
4. `--no-*` 不自动扩张 launcher 所有权；optional dependency 未选中时只记录 skip。
5. 配置与拓扑必须在任何 stop/start 副作用前完整验证。
6. 不自动升级 `plugin/metadata.json` 版本。
7. 源码与 Claude/Codex/Qoder 生成物同一 commit；生成物禁止手改。

### isAIFeature

`false`

### domainDecisions

#### architecture

- [已确认·用户] `agents-launcher.yml` 为窄拓扑单源。
- [已确认·用户] `launcher-config.mjs` 负责解析/规范化，`topology.mjs` 负责纯 DAG，`supervisor.mjs` 负责 generation 状态机，`service-adapters.mjs` 负责统一既有 CLI。
- [已确认·用户] `dev-orchestrator.mjs` 只负责 CLI 输入、preflight 和调用 engine。

#### testing

- [已确认·用户] loader/DAG/supervisor 必须可注入，无真实进程即可确定性测试。
- [已确认·用户] 真实 `tsx watch` 只留一个获用户允许后的手工 smoke，不把外部三仓作为单测前提。

#### security

- [已确认·用户] 禁止 alias、自定义 tag、多文档、重复 key、未知 key、命令和模块路径。
- [已确认·用户] adapter 名必须来自代码 allowlist；错误与日志不得打印 env/config secret。

#### api

- [已确认·用户] 保留 `--workspace=ui|agents|full`、`--no-*`、`--dry-run`、`--status`、`--stop` 的外部 CLI。
- [已确认·用户] schema v1 只支持两种 condition 与边级 `propagate_restart`。

#### performance

- [已确认·用户] 只监督带传播出边且被选中的上游；默认 `interval_ms=1000`，同一时刻每个 supervisor 只有一个未决 tick。

#### frontend

- `n/a`：无产品前端改动；只重启本地 Vite 进程。

#### observability

**basicLogging**：

- [已确认·用户] 实现 `topology.loaded`、`plan.created`、`service.state_changed`、`cascade.started/completed/failed` 六类结构化日志。
- `n/a`：本地 launcher 不增加生产 Metrics、Alert 或 Trace。

#### migration

- [已确认·用户] 同一变更中切换到 YAML 并删除旧 `WORKSPACES` 与命令式固定顺序；不提供双读 fallback。
- [已确认·用户] schema 缺失或无效时 fail-loud，不回退旧硬编码行为。

### openQuestions

- 无方案级未决项。
- 延后：是否让 `server → web` 也传播 restart，等出现真实故障需求后只改 YAML 边，不扩 runtime。
- 操作确认：真实 smoke 会重启正在运行的本地服务，Verify 阶段执行前另行确认。

### testObjectives

采用前文 TO-1 至 TO-17。它们覆盖配置安全、DAG、CLI 兼容、generation 识别、传播闭包、失败策略、性能、真实 smoke 与三平台打包。

### verifyStrategy

采用“纯状态机单测 → fake adapter 集成 → per-service 回归 → 获准真实 smoke → vendor/package checks”的五层策略；不以外部三仓或浏览器作为普通单测前提。

### sources

- `skills/agents-launcher/dev-orchestrator.mjs:35-42,82-97,120-192`
- `skills/agents-launcher/lib/cli.mjs:1-32`
- `skills/agents-launcher/lib/probe.mjs:7-35`
- `skills/agents-launcher/lib/proc.mjs:6-41`
- `skills/agents-launcher/agents-cli.mjs:22-66`
- `skills/agents-launcher/web-cli.mjs:27-32,47-49,111-124`
- `skills/agents-launcher/lib/server/boot.mjs:69-138`
- `skills/agents-launcher/lib/server/infra.mjs:130`
- `docs/dev/3dot141/260702-01-launcher-service-clis/launcher-service-clis-plan.md:3-4,1988-1993`
- [Compose Specification](https://github.com/compose-spec/compose-spec/blob/main/spec.md)
- [Docker：Control startup and shutdown order](https://docs.docker.com/compose/how-tos/startup-order/)
- [Dockerfile HEALTHCHECK](https://docs.docker.com/reference/dockerfile/#healthcheck)
- [yaml 官方文档](https://eemeli.org/yaml/)
- [PM2 application declaration](https://pm2.keymetrics.io/docs/usage/application-declaration/)

### docPath

`docs/dev/3dot141/260730-01-agents-launcher-declarative-topology/agents-launcher-declarative-topology-design.md`

## Review Log

### 2026-07-30 — Round 1（主会话八维自查）

用户决定：`C & W 修`。

| ID | 分级 | Finding | 用户决定 | 修订结果 |
|---|---|---|---|---|
| C1 | Critical | Registry 来源章节使用旧标题，存在追踪 orphan | fix | Q/BF/LOG/GATE 全部改为当前真实章节名 |
| C2 | Critical | 三条异常路径缺 Given/When/Then | fix | 增加 BF2.0、BF2.5、BF4.6 |
| W1 | Warning | Adapter Contract 的 `handle` 与 `handles[]` 不一致 | fix | 统一为 `handles?: unknown[]` |
| W2 | Warning | failed cascade event 的出队/重试语义不明确 | fix | 按 upstream 保存最新 settled result；失败不自动重试 |
| W3 | Warning | 缺文末术语表 | fix | 增加「术语与缩略语」 |
| S1 | Suggestion | 未记录 PID 快速复用的漏判风险 | skip | 按用户选择不改正文 |
| SA1 | Self-Audit | Decision Packet 保留旧“决策账本”交叉引用 | skip | 按用户选择不改正文 |

修订后定向核验：34 个 Registry source heading 全部可解析、文末 H2 为术语表、`git diff --check` 通过。当前 Critical=0、Warning=0、Open Questions=0；S1 与 SA1 作为已接受的文档残余风险保留。

**Review verdict**：`approved: true`。用户于 2026-07-30 明确回复 `approved`，不再进行第二轮 review。

## 术语与缩略语

| 术语 | 含义 |
|---|---|
| 聚合根 Aggregate Root - AR | 上下文内实体一致性与身份边界；本文为 `ServiceTopology`、`ServiceRuntime` |
| 抽象语法树 Abstract Syntax Tree - AST | YAML parser 生成、可遍历检查 alias/tag 的结构 |
| 限界上下文 Bounded Context - BC | 一套领域语言的边界；本文只有 `agents-launcher` 一个 BC |
| 广度优先搜索 Breadth-First Search - BFS | 计算传播可达节点的一种图遍历 |
| 业务流 Business Flow - BF | 可独立实现和验证的一条运行路径 |
| 命令行界面 Command-Line Interface - CLI | `dev-orchestrator.mjs` 暴露的参数与操作入口 |
| 层叠样式表 Cascading Style Sheets - CSS | web 使用的样式产物；可选 watcher 是辅助进程 |
| 有向无环图 Directed Acyclic Graph - DAG | 能进行确定性拓扑排序的依赖图 |
| 深度优先搜索 Depth-First Search - DFS | 计算传播可达节点的另一种图遍历 |
| 领域专用语言 Domain-Specific Language - DSL | 面向特定问题的配置/编程语言；本设计明确不扩成动作 DSL |
| 端到端 End-to-End - E2E | 穿过完整系统边界的验证层级 |
| ECMAScript Module - ESM | Node 使用的原生 `.mjs` 模块格式 |
| 进程标识 Process Identifier - PID | 操作系统中的进程身份；首版 service identity 来源 |
| 成功标准 Success Criterion - SC | 罗盘中的可验收结果 |
| 服务级目标 Service-Level Objective - SLO | 生产服务量化目标；本文的本地轮询阈值不是 SLO |
| 测试目标 Test Objective - TO | 必须被证明的行为目标 |
| 用户界面 User Interface - UI | 本设计无产品 UI 改动，只管理本地 web 进程 |
| You Aren't Gonna Need It - YAGNI | 不为尚未出现的需求提前扩展实现 |
| identity | 当前被观测的监听实例身份 |
| generation | stable identity 每次变化后递增的本轮代际 |
| single-flight | 同一时刻只允许一个级联事务运行 |
