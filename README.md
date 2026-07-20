# nocode

Harrison 的 Claude Code / Codex 双平台工程工作流插件。仓库只维护一份业务语义，通过平台 adapter 确定性生成两个可独立安装的插件。

```text
业务源码（Common Core）
skills / commands / agents / rules / model / hooks domain logic
                         │
                capability contract
                         │
              ┌──────────┴──────────┐
              │                     │
       Claude adapter         Codex adapter
              │                     │
plugins/claude/nocode   plugins/codex/nocode
```

核心原则：

- `skills/`、`commands/`、`agents/`、`rules/`、`model/` 与平台无关的 hook 判断是业务单源。
- `core/capabilities/contract.json` 明确两个平台每项能力的 `supported`、`degraded` 或 `unsupported` 状态及 fallback。
- `adapters/claude/`、`adapters/codex/` 是平台协议单源，负责 manifest、内容语法、组件映射与 Hook codec。
- `plugins/claude/nocode/`、`plugins/codex/nocode/` 是只读生成物，禁止手改。
- `plugin/metadata.json` 是 name/version/author/license 单源。

## 平台行为

Claude 发布物保留现有 commands、agents、skills 与完整 Hook 行为。Codex 发布物按平台能力做静态转换：

- Claude slash commands 编译为 Codex 同名 skills，例如 `/task` 对应 `task` skill。
- Claude agent 定义编译为 `agent-profiles` skill 的私有 references，不依赖用户全局 agent 配置。
- `disable-model-invocation: true` 编译为相应 skill 的 `agents/openai.yaml`，设置 `policy.allow_implicit_invocation: false`。
- SessionStart 上下文在 Claude 输出 `additionalContext`，在 Codex 输出 `systemMessage`。
- PreToolUse 的领域判断共用；Claude 可硬 `deny`，Codex 当前 codec 以醒目的 `systemMessage` fail-open 提醒，不伪装成已拦截。
- Claude Stop handoff guard 在 Codex 没有同构生命周期能力，因此 Codex 发布物不注册该 Hook，并按 capability contract 降级。
- `vendor/codex/` 是 Claude 调用异源 reviewer 的实现，不会进入 Codex 发布物，避免自递归。

## 目录结构

```text
nocode-evolve/
├── plugin/metadata.json                 # 插件元数据与版本单源
├── core/capabilities/                   # 平台能力契约
├── adapters/
│   ├── claude/                          # Claude manifest/content renderer
│   └── codex/                           # Codex manifest/component/hook renderer
├── skills/ commands/ agents/            # workflow、入口与 agent profile 业务源码
├── rules/ model/ references/            # 规则、会话上下文与参考材料源码
├── hooks/                               # hook 注册源、领域判断、平台 codec、测试
├── scripts/compile.platform.mjs         # 双平台确定性编译器
├── plugins/
│   ├── claude/nocode/                   # Claude 发布物（生成，禁手改）
│   └── codex/nocode/                    # Codex 发布物（生成，禁手改）
├── .claude-plugin/marketplace.json      # Claude marketplace 入口
└── .agents/plugins/marketplace.json     # Codex marketplace 入口
```

## 安装

### Claude Code

开发期直接挂载生成物：

```bash
claude --plugin-dir /Users/yes365/AI/nocode-evolve/plugins/claude/nocode
```

通过本地 marketplace 持久安装（在 Claude Code 内执行）：

```text
/plugin marketplace add /Users/yes365/AI/nocode-evolve
/plugin install nocode@nocode-market
```

GitHub marketplace：

```text
/plugin marketplace add 3dot141/nocode-evolve
/plugin install nocode@nocode-market
```

### Codex

通过本地 marketplace 安装：

```bash
codex plugin marketplace add /Users/yes365/AI/nocode-evolve
codex plugin add nocode@nocode-market
```

通过 GitHub marketplace 安装：

```bash
codex plugin marketplace add 3dot141/nocode-evolve
codex plugin add nocode@nocode-market
```

Codex 只会加载 `plugins/codex/nocode/`，不会读取 Claude 发布物中的 commands、agents 或 Claude-only Hook 协议。

## 开发与校验

任何参与插件运行或生成的文件发生变化时：

1. 按 SemVer 更新 `plugin/metadata.json`。
2. 运行平台编译器更新两个发布物。
3. 运行所有生成链检查与测试。

```bash
node scripts/compile.rule.js
node scripts/compile.hooks.js
node scripts/compile.platform.mjs

node scripts/compile.rule.js --check
node scripts/compile.hooks.js --check
node scripts/vendor-sync.mjs --check
node scripts/compile.platform.mjs --check
node scripts/check-skills.mjs --root plugins/claude/nocode --platform claude
node scripts/check-skills.mjs --root plugins/codex/nocode --platform codex
node --test 'hooks/*.test.mjs'
```

只检查或生成单个平台时可传 `--platform claude` 或 `--platform codex`。未知参数返回 exit 2；`--check` 发现 missing/changed/extra 文件返回 exit 1。

## 规则生成链

两条规则链保持独立单源：

- 触发路由：编辑 `rules/rule-<id>.md` 的 frontmatter，运行 `node scripts/compile.rule.js`，生成 `model/agent-rule-catalog-*.md`。
- PreToolUse 硬规则：编辑 `scripts/compile.hooks.js` 中的规则数组，运行 `node scripts/compile.hooks.js`，生成 `hooks/pretooluse-rules.json`。

平台编译器消费上述业务源码和生成物，再产生两个安装目录。不要手工编辑任一层生成文件。

## 发布 smoke checklist

静态校验通过后，发布前还应在目标客户端各做一次人工 smoke：

- Claude：从 `.claude-plugin/marketplace.json` 安装，确认 slash command / skill / agent 可发现，SessionStart 有规则上下文，危险 Bash 命中时被硬拦截。
- Codex：从 `.agents/plugins/marketplace.json` 安装，确认同名 command skills 与 `agent-profiles` 可发现，SessionStart 有规则上下文，危险 Bash 命中时出现明确的 fail-open 警告。
- 两端分别确认运行时只加载本平台发布物，不暴露另一平台组件目录。

本次双运行时架构迁移已覆盖生成、静态检查与官方 manifest validator；实际客户端安装 smoke 标记为 **manual pending**，不要用 validator 结果冒充真实 UI/会话验证。

## License

本插件代码以 [MIT](./LICENSE) 授权。`vendor/` 下第三方内容保留各自原始协议。
