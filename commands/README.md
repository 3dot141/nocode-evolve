# commands/

`nocode` 的用户入口定义单源。Claude/Codex adapter 都把每个未排除的入口 `.md` 编译为
`skills/<文件名>/SKILL.md`；Claude 仍可用 `/技能名` 显式触发，Codex 使用 Skill 调用。frontmatter 声明 `description` 和可选 `argument-hint`。全目录共 24 个入口 + 1 个 `sow-reference/` 辅助目录。

命名遵循三类惯例（`*hub` 聚合入口 / `*flow` 阶段制工作流 / `xx-yy` 子命令），详细的模式边界和写作约束见 `AGENTS.md`；本文件只给概览。

## 命令清单

### Hub（聚合入口，3 个）

统一入口，把子动作转发给对应 Skill 或独立命令；也可以跳过 hub 直接用独立命令。

| 命令 | 一句话用途 |
|---|---|
| `/nocodehub` | nocode 插件自维护聚合入口，分发 `write` / `dream` / `status` 3 个子动作 |
| `/personalhub` | `.agents-personal/` 管理聚合入口，分发 `init` / `write` / `search` / `check` / `tidy` / `snap` / `status` 7 个子动作 |
| `/projecthub` | 项目子目录 AGENTS.md + README.md 管理聚合入口，分发 `write` / `dream` / `search` / `check` / `init` / `status` 6 个子动作 |

> 注：飞书聚合入口 `larkhub` 已于 260705 迁为 skill 形态（`skills/larkhub/`），`/larkhub` 显式调用或被 Claude 主动路由均照旧，不再是 command。

### 操作型（直接执行写入/查询，16 个）

| 命令 | 一句话用途 |
|---|---|
| `/distill` | 把当前会话沉淀分流到 wiki / rules / agents / docs 七个出口（项目 wiki、跨项目 advisor、项目 rules、项目配置、子目录文档、插件 rules、skip） |
| `/sow` | 把当前会话围绕给定意图浓缩并归档到用户 vault，AI 判层（Inbox / Inputs / Outputs）+ 用户自然语言确认 |
| `/task` | MyJarvis 任务管理子系统单一入口，AI 解析自然语言意图分发到 8 个 sub-action（add / update / done / cancel / wrap-day / carry-over / breakdown / start-week） |
| `/recall` | 从 `.agents-personal/wiki/` 和用户 vault 中检索已沉淀内容，按置信度排序返回精简清单 |
| `/personal-distill` | `.agents-personal/` 的统一写入层（wiki + rules + AGENTS.md），被 `/distill` 调用，也可独立使用 |
| `/personal-init` | 在当前项目初始化 `.agents-personal/` 结构（变量覆盖 + wiki + rules），可选扫描仓库预填内容 |
| `/personal-recall` | 从 `.agents-personal/` 检索已沉淀内容（wiki + rules + AGENTS.md），按置信度排序 |
| `/project-distill` | 为指定目录写入/更新 AGENTS.md 和 README.md（入仓共享），被 `/distill` 调用，也可独立使用 |
| `/project-init` | 占位（TBD，待设计），当前提示替代方案 `/project-dream` / `/project-distill` |
| `/project-recall` | 搜索项目内所有子目录的 AGENTS.md / README.md 内容 |
| `/plugin-distill` | rule / skill 双轨写入——新增/融合一条插件 rule（三步联动），或委托 `skill-writing` 优化一个 skill |
| `/evolve` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/instinct-export` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/instinct-import` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/instinct-status` | 已停用：源码保留，但不发布到 Claude/Codex 生成产物 |
| `/eval` | eval-driven development 工作流管理（定义/检查/生成报告/列出 eval），转发到 `平台原生 Skill 调用` |

### 巡检型（scan → propose → confirm 自维护，5 个）

统一模式：先检测偏差 → 表格呈现候选 → 用户勾选 → 执行修复/委托对应写入命令。

| 命令 | 一句话用途 |
|---|---|
| `/plugin-dream` | 插件仓库自维护巡检——客观漂移（4 项：生成物/vendor/manifest 路径/孤儿 rule）+ 边界符合性（20 项：rule/skill/command 三类对象语义检查）两层检测 |
| `/personal-dream` | `.agents-personal/` 的自主维护：stale 检测 / prune / merge / promote / archive |
| `/project-dream` | 递归扫描选定目录树，为每个有意义的子目录批量生成/更新 AGENTS.md + README.md |
| `/personal-lint` | 检查当前项目 `.agents-personal/` 的健康状态（wiki 结构 + rules 完整性 + AGENTS.md 变量对齐） |
| `/project-lint` | 检查项目子目录 AGENTS.md 和 README.md 的健康状态（stale 引用 / 覆盖缺口 / 内容过时） |

## sow-reference/

`/sow` 命令专属的辅助文件，不是通用脚本库：

- `script.py` —— `/sow` 通过 `Bash` 调用的 frontmatter + 归档路径生成脚本。输入 `--layer` / `--intent` / `--title` / `--summary` 四个 CLI 参数 + `$USER_VAULT_PATH` 环境变量，输出固定格式的 frontmatter 文本 + 目标绝对路径（`TARGET_PATH:` 行），供 `/sow` 解析后落盘。
- `test_script.py` —— `script.py` 的源码单元测试，不进入发布物。
- `__pycache__/` —— Python 编译缓存，非源码。

## 与其它目录的关系

`commands/` 是入口 Skill 的作者态单源，不直接进入任一平台发布物。多数入口继续委托已有业务 Skill；体量较大的入口正文自身就是权威实现。生成后的同名 `skills/<name>/` 只存在于 `plugins/claude/nocode` 和 `plugins/codex/nocode`，不要在源码 `skills/` 下再手工复制一份。
