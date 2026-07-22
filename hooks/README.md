# hooks/

## 职责

本目录同时承载 Hook 的业务判断、平台 codec、Claude 注册源与测试。`scripts/compile.platform.mjs` 从这里生成 Claude Code / Codex 各自可加载的 `hooks/hooks.json` 和运行脚本。

边界如下：

```text
输入规范化
    │
    ▼
领域判断（平台无关）
    │
    ├── Claude codec → deny / additionalContext / Stop decision
    └── Codex codec  → systemMessage / unsupported lifecycle fallback
```

## 关键文件

| 文件 | 作用 |
|---|---|
| `hooks.json` | Hook 注册源：仅保留一个 SessionStart `model-nocode` 注入；compiler 按平台改写命令路径。其它 hook 实现保留为未注册模块，供测试或后续显式恢复。 |
| `lib/pretool-decision.mjs` | 平台无关的命令规范化、规则匹配与 `deny`/`inject` 领域决策。 |
| `lib/hook-codecs.mjs` | `detectPlatform` 及 SessionStart、PreToolUse、Stop 的平台输出 codec。 |
| `pretooluse-guard.mjs` | 读取输入、调用领域判断，再通过当前平台 codec 输出。 |
| `session-context.mjs` | 从 stdin 读取纯文本，并编码为 Claude `additionalContext` 或 Codex `systemMessage`。 |
| `inject-nocode.sh` | 定位并读取 model/project segment；JSON 编码交给 `session-context.mjs`，同时兼容 `PLUGIN_ROOT` 与 `CLAUDE_PLUGIN_ROOT`。 |
| `wiki-read.test.mjs` | 双平台显式 Wiki page read + usage 计数、锁降级、worktree identity 与 provider 生成集成。 |
| `pretooluse-rules.json` | 生成物，源为 `scripts/compile.hooks.js` 中硬编码的命令规则。 |

## 平台行为

Claude：

- SessionStart 返回 `hookSpecificOutput.additionalContext`。
- 未注册的 PreToolUse 实现中，block 规则返回 `permissionDecision: deny`，inject 规则返回 `additionalContext`。
- 仅注册 SessionStart `model-nocode` 注入；不自动初始化 runtime state，也不注册 PreToolUse、PostToolUse 或 Stop。

Codex：

- SessionStart 返回 `systemMessage`。
- 未注册的 PreToolUse 实现使用完全相同的领域判断，但当前 Hook 输出能力不能表达 Claude 的硬 `deny`。block 命中时输出带“当前 Codex Hook 无法硬阻断，请不要执行”的 `systemMessage`，明确 fail-open，不伪造拦截成功。
- 仅注册 SessionStart `model-nocode` 注入；不自动初始化 runtime state，也不注册 PreToolUse、PostToolUse 或 Stop。

平台默认由运行时环境识别：`NOCODE_PLATFORM` 可显式指定；否则存在 `PLUGIN_ROOT` 时视为 Codex，回退为 Claude。生成的 Codex Hook 命令使用 `${PLUGIN_ROOT}`，Claude 使用 `${CLAUDE_PLUGIN_ROOT}`。业务状态脚本只读取 `NOCODE_PLUGIN_DATA`；平台变量的映射只发生在 provider/adapter 边界。

## 生成链

规则路由与 Bash 硬拦截仍是两条独立单源：

```text
rules/rule-*.md frontmatter
    └─ node scripts/compile.rule.js
       └─ model/agent-rule-catalog-*.md

scripts/compile.hooks.js 内规则数组
    └─ node scripts/compile.hooks.js
       └─ hooks/pretooluse-rules.json
```

随后平台编译器把 Hook 源编译进两个发布物：

```text
hooks/ + adapters/{claude,codex}/
    └─ node scripts/compile.platform.mjs
       ├─ plugins/claude/nocode/hooks/
       └─ plugins/codex/nocode/hooks/
```

## 测试

```bash
node scripts/compile.rule.js --check
node scripts/compile.hooks.js --check
node scripts/compile.platform.mjs --check
node scripts/check-skills.mjs --root . --platform source
node --test hooks/*.test.mjs scripts/*.test.mjs
```

测试覆盖领域判断、两个 codec、domain registry/contract、session/handoff/plan state、显式 Wiki usage、Open Design fallback、Continuous Learning exclusion、确定性编译与单一 SessionStart 注册约束。
