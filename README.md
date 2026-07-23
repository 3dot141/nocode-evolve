# NoCode

Harrison 的 Claude Code / Codex 双平台工程工作流插件。仓库只维护一份业务语义，通过平台 adapter 确定性生成两个可独立安装的插件。

```text
共享业务源码
skills / commands / rules / model / hooks
                         │
                 static packager
                         │
              ┌──────────┴──────────┐
              │                     │
       Claude adapter         Codex adapter
              │                     │
plugins/claude/nocode   plugins/codex/nocode
```

核心原则：

- `skills/`、`commands/`、`rules/`、`model/` 与平台无关的 Hook 判断是业务单源。
- Markdown 中用成对 platform block 写 Claude/Codex 原生工具差异；共享正文保留业务流程与 handoff payload。
- `adapters/claude/`、`adapters/codex/` 负责 manifest、命令 Skill 化、路径变量与 Hook codec。
- `platform/claude/`、`platform/codex/` 只保存必须不同的非 Markdown runtime overlay。
- `plugins/claude/nocode/`、`plugins/codex/nocode/` 是只读生成物，禁止手改。
- `plugin/metadata.json` 是 name/version/author/license 单源。

## 平台行为

Claude/Codex 发布物共享 Skills，只在原生工具、Hook codec 和平台变量上做静态差异化：

- `commands/*.md` 作为共享入口源码，同时编译为 Claude/Codex 同名 skills，例如 `task`。
- agent 调度直接写在所属 Skill 的平台块中，不再维护 profile/router 中间层。
- `disable-model-invocation: true` 编译为相应 skill 的 `agents/openai.yaml`，设置 `policy.allow_implicit_invocation: false`。
- SessionStart 上下文在 Claude 输出 `additionalContext`，在 Codex 输出 `systemMessage`。
- PreToolUse 的领域判断共用；Claude 可硬 `deny`，Codex 当前 codec 以醒目的 `systemMessage` fail-open 提醒，不伪装成已拦截。
- Claude 与 Codex 都在 SessionStart 通过 `runtime/plugin-data-entry.mjs` 初始化 session 隔离状态；没有 Stop handoff guard。
- Wiki 引用计数只由显式 `wiki-read` 入口更新；两个平台都不再通过通用 Read Hook 猜测页面读取。
- Continuous Learning 源码保留但默认排除，不进入两套发布物，也不注册 observation Hook。
- 旧 `vendor/codex/` companion 已被平台原生 review agent 取代，默认不进入 Claude 或 Codex 发布物。

## 目录结构

```text
nocode-evolve/
├── plugin/metadata.json                 # 插件元数据与版本单源
├── adapters/
│   ├── claude/                          # Claude manifest/content renderer
│   ├── codex/                           # Codex manifest/component/hook renderer
│   └── shared/                          # 双平台入口 Skill renderer
├── platform/{claude,codex}/runtime/     # 平台 runtime overlay
├── skills/ commands/                    # workflow 与入口业务源码
├── rules/ model/ references/            # 规则、会话上下文与参考材料源码
├── hooks/                               # hook 注册源、平台 codec、测试
├── scripts/package.platform.mjs         # 双平台静态 packager
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

Codex 只会加载 `plugins/codex/nocode/`，不会读取 Claude 发布物或 Claude-only Hook 协议。

安装或升级后需要整体重启 Codex App；如果通过 remote-control 使用 Codex，则重启对应 daemon / app-server，然后再新建 Session。已运行的进程可能继续持有旧版插件注册表、Skill 根目录和 Hook 配置，仅新建对话或 Session 不保证重新加载成功。

重启前先保存当前工作，因为连接会中断。重启后应确认 SessionStart、Skills 和 Hook 均来自新版本；如果日志或报错仍引用 `~/.codex/plugins/cache/.../nocode/<旧版本>/`，说明旧进程尚未完成重载。

### Open Design

Claude 与 Codex 统一通过 `open-design` Skill 的封装 CLI 按需使用 Open Design。插件不注册全局 Open Design MCP，也不会在普通 Session 启动时探测或连接 Open Design。

Open Design App 需要单独安装。Nocode 不自动安装 App、不修改 App 数据，也不猜测未声明的本地服务地址或私有目录；只有任务实际使用 Open Design 时，Skill 才通过打包 CLI 连接或启动 headless daemon。App、授权或布局不可用时，agent 明确报告缺失能力，不伪造成功结果。

## 开发与校验

任何参与插件运行或生成的文件发生变化时：

1. 按 SemVer 更新 `plugin/metadata.json`。
2. 运行静态 packager 更新两个发布物。
3. 运行所有生成链检查与测试。

```bash
node scripts/compile.rule.js
node scripts/compile.hooks.js
node scripts/package.platform.mjs

node scripts/compile.rule.js --check
node scripts/compile.hooks.js --check
node scripts/vendor-sync.mjs --check
node scripts/package.platform.mjs --check
node scripts/check-skills.mjs --root . --platform source
node scripts/check-skills.mjs --root plugins/claude/nocode --platform claude
node scripts/check-skills.mjs --root plugins/codex/nocode --platform codex
node --test hooks/*.test.mjs scripts/*.test.mjs
```

只检查或生成单个平台时可传 `--platform claude` 或 `--platform codex`。未知参数返回 exit 2；`--check` 发现 missing/changed/extra 文件返回 exit 1。

## 规则生成链

两条规则链保持独立单源：

- 触发路由：编辑 `rules/rule-<id>.md` 的 frontmatter，运行 `node scripts/compile.rule.js`，生成 `model/agent-rule-catalog-*.md`。
- PreToolUse 硬规则：编辑 `scripts/compile.hooks.js` 中的规则数组，运行 `node scripts/compile.hooks.js`，生成 `hooks/pretooluse-rules.json`。

静态 packager 消费上述业务源码和生成物，再产生两个安装目录。不要手工编辑任一层生成文件。

## 发布 smoke checklist

静态校验通过后，发布前还应在目标客户端各做一次人工 smoke：

- Claude：从 `.claude-plugin/marketplace.json` 隔离安装，确认入口 Skills、SessionStart 与 Open Design MCP。
- Codex：从 `.agents/plugins/marketplace.json` 隔离安装，确认入口 Skills、SessionStart 与 Open Design MCP。
- 两端验证 Open Design、原生 plan/decision/agent/worktree、handoff-state、Wiki usage、session/data isolation 与 Continuous Learning 缺席。
- 两端确认 `runtime/plugin-data-entry.mjs` 将各自隔离数据根直接映射到 `NOCODE_PLUGIN_DATA`。

真实客户端结果记录在 `docs/superpowers/smoke/`；静态测试或 manifest validator 不能替代安装与会话 smoke。

## License

本插件代码以 [MIT](./LICENSE) 授权。`vendor/` 下第三方内容保留各自原始协议。
