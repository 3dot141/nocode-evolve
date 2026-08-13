# commands/

`nocode` 的用户入口定义单源。Claude/Codex adapter 都把每个未排除的入口 `.md` 编译为
`skills/<文件名>/SKILL.md`；Claude 仍可用 `/技能名` 显式触发，Codex 使用 Skill 调用。frontmatter 声明 `description` 和可选 `argument-hint`。全目录共 10 个入口 + 1 个 `sow-reference/` 辅助目录。

命名遵循三类惯例（`*hub` 聚合入口 / `*flow` 阶段制工作流 / `xx-yy` 子命令），详细的模式边界和写作约束见 `AGENTS.md`；本文件只给概览。

## 命令清单

### Hub（均为源码 Skill）

`larkhub`、`personalhub`、`nocodehub`、`projecthub` 均位于 `skills/`。personal、plugin、project 三类维护能力只公开各自 hub，子动作实现放在私有 `references/`，不再发布独立 command。

### 操作型（直接执行写入/查询，10 个）

| 命令 | 一句话用途 |
|---|---|
| `/distill` | 把当前会话沉淀分流到 wiki / rules / agents / docs 七个出口（项目 wiki、跨项目 advisor、项目 rules、项目配置、子目录文档、插件 rules、skip） |
| `/sow` | 把当前会话围绕给定意图浓缩并归档到用户 vault，AI 判层（Inbox / Inputs / Outputs）+ 用户自然语言确认 |
| `/task` | MyJarvis 任务管理子系统单一入口，AI 解析自然语言意图分发到 8 个 sub-action（add / update / done / cancel / wrap-day / carry-over / breakdown / start-week） |
| `/recall` | 从 `.agents-personal/wiki/` 和用户 vault 中检索已沉淀内容，按置信度排序返回精简清单 |
| `/evolve` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/instinct-export` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/instinct-import` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/instinct-status` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/eval` | eval-driven development 工作流管理（定义/检查/生成报告/列出 eval），转发到 `平台原生 Skill 调用` |
| `/prototype-verify` | 验证已物化的本地交互原型并生成截图与报告 |

## sow-reference/

`/sow` 命令专属的辅助文件，不是通用脚本库：

- `script.py` —— `/sow` 通过 `Bash` 调用的 frontmatter + 归档路径生成脚本。输入 `--layer` / `--intent` / `--title` / `--summary` 四个 CLI 参数 + `$USER_VAULT_PATH` 环境变量，输出固定格式的 frontmatter 文本 + 目标绝对路径（`TARGET_PATH:` 行），供 `/sow` 解析后落盘。
- `test_script.py` —— `script.py` 的源码单元测试，不进入发布物。
- `__pycache__/` —— Python 编译缓存，非源码。

## 与其它目录的关系

`commands/` 是入口 Skill 的作者态单源，不直接进入任一平台发布物。多数入口继续委托已有业务 Skill；体量较大的入口正文自身就是权威实现。生成后的同名 `skills/<name>/` 只存在于 `plugins/claude/nocode` 和 `plugins/codex/nocode`，不要在源码 `skills/` 下再手工复制一份。
