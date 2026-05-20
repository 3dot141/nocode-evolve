# nocode-evolve

Harrison 的 Claude Code 个人插件：通过 SessionStart hook 注入**渐进式加载**的两层规则——
插件自带的 `model/*.md`（角色 / 工程准则 / 项目本地路由 / catalog）作为会话开局即注入的基线，
`rules/rule-*.md` 是触发式规则、由 agent 看 `model/agent-catalog.md` 命中触发后自行 Read，
再叠加项目根的 `.agents-personal/AGENTS.md` 做工程级定制。
另外预留 skills / agents / MCP 扩展位。

## 规则注入顺序

每次会话启动时，hook 跑两个 group：

1. `project` group: `<project_root>/.agents-personal/AGENTS.md` —— 项目本地路由表（存在时才注入）
2. `model` group: 顺序注入 `${CLAUDE_PLUGIN_ROOT}/model/` 下 4 个文件：
   - `agent-about.md` —— 角色 + 全局占位符（`{username}` 等）
   - `agent-karpathy.md` —— 12 条工程准则
   - `agent-personal.md` —— 项目本地 `.agents-personal/` 使用约定
   - `agent-catalog.md` —— `rules/rule-*.md` 触发式规则的路由表

`rules/` 下的触发式规则**不**进入会话开局 context；agent 看 catalog 决定按需 Read 哪条。

两段之间用 `---` 分隔，并在每段前用 HTML 注释标注来源，便于排查。
若 project group 文件不存在，该 group 静默退出，不污染上下文。

> 项目根由 `$CLAUDE_PROJECT_DIR` 决定（不存在则回退到 `$PWD`）。
> 想给某个工程定制规则，只需在该工程根目录建 `.agents-personal/AGENTS.md` 即可，无需改插件。
> **模板见 `examples/agents-personal/`** —— 复制到项目根、改占位符即可使用，含四章骨架（角色 / 行为准则 / 占位符 / 项目指令）与 `rules/<topic>.md` 拆分示例。

## 当前结构

```
nocode-evolve/
├── .claude-plugin/
│   ├── plugin.json                          # 插件清单
│   └── marketplace.json                     # GitHub marketplace 描述
├── hooks/
│   ├── hooks.json                           # SessionStart 注册 (project + model 两个 group)
│   └── inject-rules.sh                      # 注入脚本（jq 优先，python3 兜底；含 sanity check）
├── model/                                   # 会话开局即注入 (基线 + 路由表)
│   ├── agent-about.md                       # 角色 + 全局占位符
│   ├── agent-karpathy.md                    # 12 条工程准则
│   ├── agent-personal.md                    # 项目本地 .agents-personal/ 使用约定
│   └── agent-catalog.md                     # rules/ 触发式规则路由表
├── rules/                                   # 按需 Read (catalog 路由)
│   ├── rule-superpowers-brainstorming.md    # 覆盖 superpowers:brainstorming 写设计文档流程
│   ├── rule-git-worktree.md                 # 覆盖 superpowers:using-git-worktrees 路径策略
│   ├── rule-push-summary.md                 # push 后总结的输出格式
│   └── rule-git-inspection.md               # git read-only 命令合一 pattern
└── examples/
    └── agents-personal/                     # 项目本地 .agents-personal/ 模板（复制改占位符即可用）
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

- **不能直接挂载 `CLAUDE.md`**：plugin 根的 `CLAUDE.md` 不会被加载。本插件的 SessionStart hook 是官方推荐的等效方案，会把 `model/*.md` 内容（以及可选的项目级 `.agents-personal/AGENTS.md`）作为 `additionalContext` 注入。
- `version` 不写时会用 git commit SHA 作版本号——每次提交都视为新版本。
- 安装范围：`--scope user`（默认，跨项目）/ `--scope project`（团队共享，进 git）/ `--scope local`（仅本项目，gitignore）。
