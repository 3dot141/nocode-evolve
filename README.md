# nocode-evolve

Harrison 的 Claude Code 个人插件：通过 SessionStart hook 注入两层规则——
插件自带的 `rules/agent-guidelines.md` 作为跨项目默认行为准则，再叠加项目根的 `.agents-personal/AGENTS.md` 做工程级定制。
另外预留 skills / agents / MCP 扩展位。

## 规则注入顺序

每次会话启动时，hook 依次拼接：

1. `${CLAUDE_PLUGIN_ROOT}/rules/agent-guidelines.md` —— 跨项目共享的 agent 行为准则
2. `<project_root>/.agents-personal/AGENTS.md` —— 当前项目的自定义规则（存在时才注入，可覆盖/补充上一层）

两段之间用 `---` 分隔，并在每段前用 HTML 注释标注来源，便于排查。
若两个文件都不存在，hook 静默退出，不污染上下文。

> 项目根由 `$CLAUDE_PROJECT_DIR` 决定（不存在则回退到 `$PWD`）。
> 想给某个工程定制规则，只需在该工程根目录建 `.agents-personal/AGENTS.md` 即可，无需改插件。

## 当前结构

```
nocode-evolve/
├── .claude-plugin/
│   ├── plugin.json          # 插件清单
│   └── marketplace.json     # GitHub marketplace 描述
├── hooks/
│   ├── hooks.json           # SessionStart 注册
│   └── inject-rules.sh      # 注入脚本（jq 优先，python3 兜底）
└── rules/
    └── agent-guidelines.md  # 跨项目 agent 行为准则正文
```

## 安装方式

### 方式 A：本地直接挂载（开发期）
```bash
claude --plugin-dir /Users/yes365/AI/nocode-evolve
```
仅当前会话生效，改完文件重启即可。

### 方式 B：本地 marketplace（持久化，本机所有项目）
```bash
# 在 Claude Code 内执行（注意是 slash 命令）
/plugin marketplace add /Users/yes365/AI/nocode-evolve
/plugin install nocode-evolve@nocode-evolve
```

### 方式 C：GitHub marketplace（跨设备同步）
1. 把本目录推到 `https://github.com/3dot141/nocode-evolve`
2. 在 Claude Code 内：
   ```
   /plugin marketplace add 3dot141/nocode-evolve
   /plugin install nocode-evolve@nocode-evolve
   ```

## 日常操作

| 操作 | 命令 |
|---|---|
| 启用 / 禁用 | `/plugin enable nocode-evolve@nocode-evolve` / `/plugin disable ...` |
| 改完热加载 | `/reload-plugins` |
| 校验清单 | `/plugin validate` |
| 查看加载详情 | `claude --debug` 启动 |
| 卸载 | `claude plugin uninstall nocode-evolve@nocode-evolve --scope user` |

## 后续扩展（按需加目录即可，无需改 plugin.json）

### 加 Skills
```
skills/
└── my-skill/
    └── SKILL.md          # frontmatter 必填 description
```
安装后调用名为 `/nocode-evolve:my-skill`。

`SKILL.md` 模板：
```markdown
---
description: 一句话说清这个 skill 何时被调用
---
（正文：步骤、规则、示例）
```

### 加 Agents（子代理）
```
agents/
└── reviewer.md           # frontmatter 含 name/description/tools
```

### 加 MCP 服务器
在插件根新建 `.mcp.json`：
```json
{
  "mcpServers": {
    "my-server": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/server.js"] }
  }
}
```

### 加更多 Hooks
往 `hooks/hooks.json` 里追加 `PostToolUse` / `FileChanged` 等事件即可。脚本里用 `${CLAUDE_PLUGIN_ROOT}` 引用插件根目录。

## 重要限制（设计依据）

- **不能直接挂载 `CLAUDE.md`**：plugin 根的 `CLAUDE.md` 不会被加载。本插件的 SessionStart hook 是官方推荐的等效方案，会把 `rules/agent-guidelines.md` 内容（以及可选的项目级 `.agents-personal/AGENTS.md`）作为 `additionalContext` 注入。
- `version` 不写时会用 git commit SHA 作版本号——每次提交都视为新版本。
- 安装范围：`--scope user`（默认，跨项目）/ `--scope project`（团队共享，进 git）/ `--scope local`（仅本项目，gitignore）。
