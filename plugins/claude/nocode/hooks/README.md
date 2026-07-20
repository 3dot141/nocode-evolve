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
| `hooks.json` | Claude 完整注册源：SessionStart、PreToolUse、PostToolUse、Stop。平台编译器会按 Codex 能力移除不支持的 Stop 与 Claude-only usage tracker，并改写插件根变量。 |
| `lib/pretool-decision.mjs` | 平台无关的命令规范化、规则匹配与 `deny`/`inject` 领域决策。 |
| `lib/hook-codecs.mjs` | `detectPlatform` 及 SessionStart、PreToolUse、Stop 的平台输出 codec。 |
| `pretooluse-guard.mjs` | 读取输入、调用领域判断，再通过当前平台 codec 输出。 |
| `session-context.mjs` | 从 stdin 读取纯文本，并编码为 Claude `additionalContext` 或 Codex `systemMessage`。 |
| `inject-nocode.sh` | 定位并读取 model/project segment；JSON 编码交给 `session-context.mjs`，同时兼容 `PLUGIN_ROOT` 与 `CLAUDE_PLUGIN_ROOT`。 |
| `handoff-stop-guard.mjs` | Claude Stop 防跳步收口。Codex 无同构生命周期能力，生成发布物不注册它。 |
| `usage-tracker.mjs` | Claude Read 后的个人 wiki 引用计数。Codex 发布物当前不注册它。 |
| `pretooluse-rules.json` | 生成物，源为 `scripts/compile.hooks.js` 中硬编码的命令规则。 |

## 平台行为

Claude：

- SessionStart 返回 `hookSpecificOutput.additionalContext`。
- PreToolUse 的 block 规则返回 `permissionDecision: deny`，inject 规则返回 `additionalContext`。
- 注册 Stop handoff guard 与 Read usage tracker。

Codex：

- SessionStart 返回 `systemMessage`。
- PreToolUse 使用完全相同的领域判断，但当前 Hook 输出能力不能表达 Claude 的硬 `deny`。block 命中时输出带“当前 Codex Hook 无法硬阻断，请不要执行”的 `systemMessage`，明确 fail-open，不伪造拦截成功。
- 不注册 Stop handoff guard 与 Claude-only usage tracker；能力差异记录在 `core/capabilities/contract.json`。

平台默认由运行时环境识别：`NOCODE_PLATFORM` 可显式指定；否则存在 `PLUGIN_ROOT` 时视为 Codex，回退为 Claude。生成的 Codex Hook 命令使用 `${PLUGIN_ROOT}`，Claude 使用 `${CLAUDE_PLUGIN_ROOT}`。

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
node --test 'hooks/*.test.mjs'
```

测试覆盖领域判断、两个 codec、平台 capability contract、确定性编译、代表性快照，以及原有 SessionStart/PreToolUse/PostToolUse/Stop 回归行为。
