# examples/

插件级示例/模板目录，给"使用 nocode 插件的人"抄一份起点用的，不是插件运行时会读取的路径。

## 这是什么

当前只有一个子目录：`agents-personal/`——`.agents-personal/`（项目本地 agent 配置目录）的分发模板。`.agents-personal/` 是每个使用 nocode 插件的项目里，用来覆盖插件默认变量（`{username}` 等）、放项目专属 `rules/<topic>.md`、存项目历史记忆 `wiki/` 的地方；它本身会进项目的 `.gitignore`，是个人本地配置，不入库共享。

## 怎么用

```bash
# 在你的项目根目录
cp -r <plugin-root>/examples/agents-personal .agents-personal

# 然后:
# 1. 改占位符（搜索文件里所有 <TODO>）
# 2. 按需增删 rules/<topic>.md 文件
# 3. 在 AGENTS.md > 项目指令 加触发表入口
```

更省事的路径：直接跑 `/personal-init` 命令，让 agent 扫描仓库自动生成变量覆盖和 wiki 草稿。两条路径产出的目录结构目前不完全一样，差异见 `AGENTS.md` 里记录的已知漂移。

## 目录内容

| 文件 | 作用 |
|---|---|
| `agents-personal/AGENTS.md` | 模板：四章路由表（角色配置 / 行为准则 / 占位符覆盖 / 项目指令） |
| `agents-personal/README.md` | 模板自带的说明文档——讲的是"怎么用这份模板"，不是"这个 examples 顶层目录是什么" |
| `agents-personal/rules/pr-create.md` | 模板：一个 `rules/<topic>.md` 的具体示例（提 PR 场景，含触发条件写法、echo 确认 gate 等范式） |
