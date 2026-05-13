# `.agents-personal/` 模板

项目本地 Agent 覆盖目录的范式参考，配合 `nocode-evolve` 插件使用。
镜像 `nocode-evolve/rules/agent-about.md` 的四章结构（角色 / 行为准则 / 占位符 / 项目指令）。

## 用法

```bash
# 在你的项目根目录
cp -r <plugin-root>/examples/agents-personal .agents-personal

# 然后：
# 1. 改占位符（搜索文件里所有 <TODO>）
# 2. 按需增删 rules/<topic>.md 文件
# 3. 在 AGENTS.md > 项目指令 加触发表入口
```

## 结构

```
.agents-personal/
├── AGENTS.md           # 路由表 + 项目级覆盖（每次会话注入）
├── rules/              # 按场景细分的指令文件（按需读取）
│   └── pr-create.md    # 示例：提 PR 流程
└── wiki/               # （可选）项目历史记忆，由 /wiki-update 维护
```

## 设计约定

参考 `nocode-evolve/rules/overlay-agents-personal.md`：

- **AGENTS.md 是路由表**：只列触发条件，不写细节
- **rules/<topic>.md 放细节**：命令模板、事实表、坑、示例。一个 topic 一个文件
- **触发条件够具体**：agent 读完能直接判 yes/no，禁止「看情况」「适当时候」类含糊表达

## 章节填充指引

| 章节 | 何时该写内容 | 何时保留章节空标题 |
|---|---|---|
| `# 角色配置` | 项目要覆盖 karpathy 某条准则时 | 默认保留「继承插件级」一行 |
| `# 行为准则` | 项目特定的**跨场景**行为偏好 | 没有就空着（**通用偏好上提到插件**） |
| `# 占位符覆盖` | 几乎总会写 `{username}` | 几乎永远有内容 |
| `# 项目指令` | 项目有命令模板/工具流程时 | 项目无特殊指令则空 |

通用偏好（每个项目都希望生效的，比如「输出文档后 echo 路径」）应放到**插件级** `agent-about.md` 的「行为准则」章节，不要在项目本地重复。

## 真实样例

`fx-data-server/.agents-personal/` 是本模板的真实落地（跨 fork PR via `bkt api`），可作对照。
