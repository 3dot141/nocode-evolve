# 全局环境与占位符

本文件声明 nocode-toolkit 内其他 rule / resource 中可能引用的占位符与全局变量。
其他 rule 看到这些占位符（如 `{username}`），按本文件**默认值**解析；**如果工程内有同名定义，优先用工程内的**——见下方「变量解析优先级」。

## 占位符（默认值）

| 占位符 | 默认值 | 说明 |
|---|---|---|
| `{username}` | `3dot141` | 用户标识，默认 GitHub username。用于路径分目录、归属标记等。 |

## 变量解析优先级

某个占位符在多处定义时，按以下顺序取值——**先命中即用，覆盖后续**：

1. **`<project>/.agents-personal/AGENTS.md`**——项目本地针对 agent 的覆盖（最高优先级）
2. **`<project>/CLAUDE.md` 或 `<project>/AGENTS.md`**——项目根的规范文件（人 + AI 共读）
3. **本文件（`rules/agent-about.md`）**——插件默认值（兜底）

工程内显式定义的值，**永远覆盖**本文件默认值。

> 示例：本文件默认 `{username} = 3dot141`；若项目 `.agents-personal/AGENTS.md` 写了「`{username} = team-x`」，则本会话所有引用 `{username}` 的地方解析为 `team-x`。

> 注：本"优先级"仅约定**值的解析顺序**，不影响 rule 整体的注入顺序（hook 仍是 plugin global → project local 串接）。

## 全局约定

- 默认主分支：`main`
- 设计文档根目录：`docs/plans/{username}/`
- 时间格式：`yymmdd`（6 位无分隔符，如 `260511`）

> 新增全局约定/占位符时追加到本文件，避免散落各 rule。
