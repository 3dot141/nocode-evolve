---
type: design-doc
topic: codex-restart 状态检查与 daemon 重启脚本化
scenario: feat
date: 260723
author: 3dot141
status: approved
last_updated: 260723
---

# Design Doc: codex-restart 状态检查与 daemon 重启脚本化

## 背景

`skills/codex-restart/SKILL.md` 已定义 inspect-first、断连前即时确认、只使用官方 daemon
生命周期命令、永不操作 Claude 等安全边界，但状态检查和重启动作仍由 agent 临时拼装多条命令。
现状有四个缺口：

1. managed daemon、Remote Control、活动 `app-server proxy` 和插件状态没有统一机器可读输出；
2. `proxy` 是到 daemon control socket 的临时连接，不是独立服务，但当前流程没有计数或告警；
3. 固定确认文案把 daemon-only 与完整 Codex App 重启混在一起；
4. 当前会话同步等待 `codex app-server daemon restart` 时，restart 会等待活动请求结束，形成等待闭环。

现场试验确认：managed daemon 是持久服务，Remote Control 是 daemon 的配置能力，proxy 是活动连接；
完整 App 重启可由独立 Terminal 托管，但会引入 App/Terminal 生命周期和重连验证，不适合作为默认路径。

## 目标

- 新增一个 skill-owned ESM 脚本，统一执行只读检查并输出稳定 JSON。
- Skill 根据检查结果向用户展示 daemon、Remote Control、proxy、Codex App 和插件状态。
- 用户拒绝时不执行任何重启动作。
- 用户明确确认后，脚本以独立后台进程提交官方 daemon restart，然后 Skill 结束。
- 重启动作提交后不等待、不验证、不讨论连接是否中断；最终只声称“重启命令已提交”。
- 保留现有 bootstrap、Remote Control enable 和 pairing 流程，不改变它们的授权边界。

## 非目标

- 不自动退出或重开 Codex App。
- 不把 daemon-only 描述成完整插件、Skills 或 Hooks 重载。
- 不直接 kill/restart proxy，不使用 `kill`、`pkill` 或其他原始进程终止方式。
- 不操作 Claude。
- 不自动执行重连或事后验证；用户以后单独询问状态时再走只读检查。
- 不处理 Exa 或其他 MCP 的 OAuth、注册与 token 生命周期。

## 用户路径与成功标准

| 路径 | 成功标准 |
|---|---|
| P1 查看状态 | SC-1：输出稳定 JSON，区分 daemon mode/status、Remote Control、proxy 数量、App 状态和插件版本/path |
| P2 拒绝重启 | SC-2：没有启动任何 restart 子进程 |
| P3 确认重启 | SC-3：只用 argv 数组提交 `codex app-server daemon restart`；脚本返回 scheduled receipt 后结束 |
| P4 检查失败 | SC-4：字段返回 `unknown` 或结构化 error，不把未知误报为 stopped/disabled |
| P5 完整插件重载 | SC-5：明确转到手动退出/重开 App 的独立流程，不复用 daemon-only 成功声明 |
| P6 安全边界 | SC-6：不输出 token，不操作 Claude，不执行 raw kill，不直接结束 proxy |

关键例子：

> Given daemon 正在运行、Remote Control 已启用且存在 2 个 proxy；When 用户请求重启；
> Then Skill 展示“2 个活动连接会受影响”，取得即时确认后提交 daemon restart，并以
> “重启命令已提交”结束，不等待完成。

## 方案选型

### 方案 A：继续由 Skill 临时拼命令

改动最小，但输出解析、错误分类和 proxy 识别仍依赖每次 agent 临场实现，无法稳定测试。否决。

### 方案 B：Skill 控制交互，skill-owned 脚本控制机械操作

新增 `skills/codex-restart/scripts/codex-restart.mjs`。Skill 负责解释状态、提示后果和确认；
脚本负责检查、JSON schema、确认参数校验和后台提交官方 restart。采用本方案。

### 方案 C：独立 Terminal 自动退出并重开 Codex App

完整重载能力更强，但依赖 macOS App/Terminal、会中断宿主，并需要新的会话语义才能验证 Skills/Hooks。
保留为人工操作说明，不进入默认脚本。

## 架构

```text
[Skill / Agent]
  │
  ├─ codex-restart.mjs inspect
  │    └─ stdout: Status JSON
  │
  ├─ 展示状态与实际影响
  ├─ 用户明确确认
  │
  └─ codex-restart.mjs restart --confirmed
       ├─ 再执行最小只读快照
       ├─ detached spawn: codex app-server daemon restart
       ├─ stdout: {"action":"restart","status":"scheduled",...}
       └─ 进程退出；Skill 结束
```

`detached spawn` 的目的不是绕开官方生命周期，而是让官方 restart 命令不依赖当前 agent 请求存活：
脚本提交命令后立即返回，当前回复可以结束，restart 进程随后自行等待 daemon 允许重启。

## 文件影响

```text
skills/codex-restart/
├── SKILL.md                         (改：统一脚本入口、动态后果、daemon-only 收口)
├── agents/openai.yaml               (按新默认行为校准 prompt，若需要)
└── scripts/
    └── codex-restart.mjs            (新：inspect/restart CLI + 可导入逻辑)

hooks/
├── codex-restart.test.mjs           (新：脚本行为测试)
└── compile.platform.test.mjs        (改：Codex 包含脚本、Claude 排除脚本)

plugin/metadata.json                 (17.1.0 → 17.2.0)
plugins/claude/nocode/               (生成物)
plugins/codex/nocode/                (生成物)
```

脚本放在 Skill 自己的 `scripts/` 下，使 Skill 保持自闭环；Codex adapter 会递归发布 Skill 内容，
Claude adapter 继续按 `plugin/exclusions.json` 排除整个 `codex-restart`。

## 追加兼容性修复：全局 worktree 路径

实施准备时发现 `using-git-worktrees` Skill 仍优先选择
`~/.config/superpowers/worktrees/<project>/<branch>` 等旧容器路径，与仓库已生效的同级扁平路径约束冲突。
本迭代同时校准该全局 Skill：

- worktree 唯一路径为 `<project-parent>/<project-name>-<branch-flat>/`；
- `branch-flat` 将分支名中的 `/` 替换为 `_`；
- 不再建议 `.worktrees/`、`worktrees/` 或 `~/.config/superpowers/worktrees/`；
- 增加消费者回归测试，防止生成物或后续编辑恢复旧路径。

这是运行时 Skill 的兼容性修复，与 codex-restart helper 一并进入 `17.2.0`。

## CLI 契约

### `inspect`

```bash
node <skill-dir>/scripts/codex-restart.mjs inspect
```

stdout：

```json
{
  "schemaVersion": 1,
  "daemon": {
    "mode": "persistent",
    "status": "running",
    "version": "0.145.0",
    "pid": 59892
  },
  "remoteControl": {
    "enabled": true
  },
  "connections": {
    "proxyCount": 2
  },
  "app": {
    "status": "running"
  },
  "plugin": {
    "name": "nocode@nocode-market",
    "status": "installed, enabled",
    "version": "17.2.0",
    "path": "/path/to/plugins/codex/nocode"
  },
  "errors": []
}
```

约束：

- `remoteControlEnabled` 只读取并输出布尔值，不回显整个 settings 文件。
- 进程检查读取完整 argv 后在程序内分类，避免把 `rg`/检查脚本自身算作 proxy。
- App 检测失败返回 `status: "unknown"`；未知不等于 stopped。
- 单项检查失败写入 `errors[]`，不阻止其余只读检查完成。

### `restart --confirmed`

```bash
node <skill-dir>/scripts/codex-restart.mjs restart --confirmed
```

stdout：

```json
{
  "schemaVersion": 1,
  "action": "restart",
  "status": "scheduled",
  "proxyCount": 2
}
```

约束：

- 缺少 `--confirmed` 时非零退出，不启动 restart。
- `codexPath` 按 `process.env.CODEX_CLI_PATH || "codex"` 解析；使用
  `spawn(codexPath, ["app-server", "daemon", "restart"], {detached: true, stdio: "ignore"})`，
  等待子进程发出 `spawn` 事件后 `unref()` 并返回 receipt；不经过 shell，不拼接命令字符串。
- 子进程在 `spawn` 事件前发出 `error` 时视为“提交失败”，脚本非零退出，不返回 scheduled。
- receipt 只表示命令已提交，不表示 daemon 已重启成功。
- 不实现等待、轮询、日志跟踪或事后验证。

## Skill 流程

1. 状态类请求只执行 `inspect` 并报告，不创建重启计划。
2. 状态输出中将 daemon 与 Remote Control 分层展示，将 proxy 表述为活动连接。
3. 重启请求先执行 `inspect`，再按实际 proxy 数量和 Remote Control 状态生成影响提示。
4. 紧邻动作询问一次明确确认；早先的泛化“重启一下”不算确认。
5. 用户拒绝即结束。
6. 用户确认后执行 `restart --confirmed`。
7. receipt 为 scheduled 时只报告“重启命令已提交”，随后结束；不自动进入验证步骤。
8. 完整插件重载请求仍要求用户保存工作、手动 `Command-Q`、从独立 Terminal 重启 daemon 并重开 App。

## 错误处理

- `codex doctor --json` 非零但产生合法 JSON：解析 JSON，并保留总体 warning/fail；不把非零直接当无状态。
- daemon socket connection refused：daemon status 记为 stopped/unreachable，bootstrap mode 单独分类。
- settings 缺失或 JSON 无效：Remote Control 记为 unknown，不输出文件内容。
- plugin list 解析不到 nocode：plugin 记为 not-found，不阻止 daemon 状态展示。
- App 检测不可用：记为 unknown。
- detached spawn 在提交前同步失败：返回非零，Skill 报“未能提交重启命令”。
- detached 子进程提交后的实际失败不回传；这是 fire-and-forget 范围的明确取舍。

## 测试

`codex-restart.mjs` 同时提供 CLI 与可导入函数。命令执行器、文件读取器和进程列表均可注入，
测试不得真实重启 daemon。

至少覆盖：

1. daemon persistent/running 与 stopped/unreachable 解析；
2. Remote Control true/false/unknown；
3. 0、1、多个 proxy 的精确计数；
4. App running/stopped/unknown；
5. settings 敏感字段不会进入输出；
6. 缺少 `--confirmed` 时拒绝执行；
7. confirmed 时只提交官方 argv，且使用 detached/ignore/unref；
8. spawn 同步失败返回结构化错误；
9. Codex 发布树包含脚本，Claude 发布树不包含；
10. SKILL.md 不再把 daemon-only 确认文案与完整 App 重启绑定。
11. `using-git-worktrees` 只生成同级扁平 worktree 路径，不再引用旧容器。

验证命令：

```bash
node --test hooks/codex-restart.test.mjs hooks/compile.platform.test.mjs
node --test 'hooks/*.test.mjs'
node scripts/check-skills.mjs --root . --platform source
node scripts/vendor-sync.mjs --check
node scripts/package.platform.mjs
node scripts/package.platform.mjs --check
```

## 版本与提交

这是新增 Skill runtime helper 和兼容性能力，按 SemVer 升 minor：`17.1.0 → 17.2.0`。
源码、版本号和 `package.platform.mjs` 生成的 Claude/Codex 发布物进入同一个实现 commit。
设计文档先作为独立 docs commit 提交；实现完成后另建实现 commit，均不自动 push。

## 实施设计项清单

| ID | 类型 | 设计项 | 来源章节 | 影响范围 | 状态 | 验证/理由 |
|---|---|---|---|---|---|---|
| Q1 | Decision | Skill 负责交互，skill-owned ESM helper 负责机械操作 | 方案选型 | codex-restart | required | CLI 与 Skill 测试 |
| Q2 | Decision | daemon restart 使用官方命令 detached 提交，receipt 后结束 | 架构、CLI 契约 | restart CLI | required | spawn 参数与 receipt 测试 |
| Q3 | Decision | worktree 使用项目同级扁平路径 | 追加兼容性修复 | using-git-worktrees | required | workflow consumer 回归测试 |
| BF1 | Business Flow | 状态请求只 inspect 并动态展示影响 | Skill 流程 | inspect CLI、Skill | required | inspect 解析与 Skill 文案测试 |
| BF2 | Business Flow | 拒绝不重启；即时确认后才提交 restart | Skill 流程 | restart CLI、Skill | required | confirmation guard 测试 |
| CONTRACT-1 | Contract | inspect 输出稳定、可降级的 schemaVersion 1 JSON | CLI 契约 | inspect CLI | required | 字段、unknown、errors 测试 |
| CONTRACT-2 | Contract | scheduled receipt 只表示命令已提交 | CLI 契约 | restart CLI、Skill | required | receipt 与终止语义测试 |
| SEC-1 | Security | 不泄露 token，不操作 Claude，不 raw kill，不经过 shell | 非目标、CLI 契约 | helper、Skill | required | 敏感字段与 argv 检查 |
| LOG-1 | Log | 提交失败走 stderr/非零退出，成功只输出结构化 receipt | CLI 契约、错误处理 | helper CLI | required | CLI 成功/失败输出测试 |
| MIG-1 | Migration | minor 升级至 17.2.0 并同步双平台生成物 | 版本与提交 | metadata、发布树 | required | package check |
| TO-1 | Test Objective | 覆盖 daemon、Remote Control、proxy、App、plugin 状态解析 | 测试 | inspect tests | required | node:test |
| TO-2 | Test Objective | 覆盖确认保护、detached argv/unref 与 spawn error | 测试 | restart tests | required | node:test |
| TO-3 | Test Objective | Codex 发布脚本且 Claude 排除整个 Skill | 测试 | packaging tests | required | compile platform tests |
| TO-4 | Test Objective | 防止 worktree Skill 恢复旧容器路径 | 追加兼容性修复、测试 | workflow tests | required | workflow consumer test |

## Design Review Log

- 260723：方案 B 已由用户确认，默认范围为 daemon-only；完整 App 重启保留为人工独立流程。
- 260723：用户确认 restart 提交后立即结束，不等待、不验证、不讨论后续中断。
- 260723：实施准备中发现并复现全局 worktree 旧路径冲突；用户授权删除错误 worktree、
  改为同级扁平路径并同步修复全局 Skill。回归测试通过后纳入本设计的 Q3 / TO-4。
- 结论：`approved`。Registry 与规范性章节双向对应，无 deferred / n/a 项。

## 探索胶囊

- `scanBase`: `8eefebc`
- 高置信证据：
  - `skills/codex-restart/SKILL.md:8-20`：inspect-first、计划与状态类请求边界；
  - `skills/codex-restart/SKILL.md:84-127`：即时确认、daemon-only 与完整 App 路径；
  - `scripts/AGENTS.md:87-109`：argv 数组、ESM CLI/library 测试模式；
  - `scripts/worktree-setup.mjs`：计划/执行分层和 runner 注入模式；
  - `plugin/exclusions.json:29`：Codex-only 发布边界；
  - `hooks/compile.platform.test.mjs:321-415`：Claude 排除、Codex 包含 Skill 的打包契约；
  - 本地 Codex CLI 0.145.0 与现场重启试验：proxy 是临时连接，restart 等待活动请求结束。
- 外部资料限制：OpenAI 公共文档确认 Remote Control 是显式设备/工作区能力，但未公开 daemon
  生命周期 CLI；实现以当前本地 CLI 的公开 help/JSON 输出为准，并用 unknown/error 兼容变化。
