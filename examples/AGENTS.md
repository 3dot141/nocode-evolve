# examples/ — 插件示例模板目录

> 本目录存放面向"插件使用者"的示例/模板文件，不是插件加载路径——不出现在 SessionStart 注入、hooks、skills 触发链路里，纯粹是文档性质的参考物。

## 目录结构

```
examples/
└── agents-personal/       # `.agents-personal/` 项目本地覆盖目录的分发模板
    ├── AGENTS.md           # 模板本身：四章结构（角色配置/行为准则/占位符覆盖/项目指令）
    ├── README.md           # 模板本身：用法说明 + 结构图 + 章节填充指引
    └── rules/
        └── pr-create.md    # 模板本身：一个"提 PR"场景的 rules/<topic>.md 示例
```

**注意边界**：`examples/agents-personal/` 内部三个文件是**示例产物本身**——它们的内容就是要给用户项目复制过去用的模板文本（第一人称视角是"某个具体项目的 agent 配置"），不是"关于这个示例目录的说明文档"。改这三个文件时，把自己当成在编辑"一份要发给用户的模板"，不要往里面混入"这是 examples 目录"之类的元说明。也不要把它们和本文件（描述 `examples/` 这个顶层目录本身的 AGENTS.md）搞混。

## 约束：改动要与 personal-init 命令的初始化结构保持同步

`examples/agents-personal/` 是 `commands/personal-init.md`（`/personal-init` 命令，技能面板里对应 `nocode:personal-init`）实际生成结构的**人工维护镜像**。命令本身不读这个示例目录来生成文件——两者是两份独立维护的内容，靠人工对齐，没有自动化兜底。

**改 `examples/agents-personal/` 前，先读一遍 `commands/personal-init.md` 的 Phase 2（创建结构）+ AGENTS.md 模板段落**，确认当前命令实际产出的结构长什么样，再同步改示例；反过来，改 `commands/personal-init.md` 的产出结构后，也要回来同步这份示例，否则示例会继续教用户一份已经过时的模板。

### 已知漂移（写本文档时核对发现，未修复，如实记录供后续同步参考）

| 项 | `commands/personal-init.md` 实际产出 | `examples/agents-personal/` 示例 |
|---|---|---|
| 目录结构 | `AGENTS.md` + `rules/` + `wiki/`（`index.md` / `log.md` / `draft/` / `pages/`） | 只有 `AGENTS.md` + `README.md` + `rules/`，**没有 `wiki/`** |
| `AGENTS.md` 章节 | 扁平两段：`## 变量覆盖`（含「文档产出路径」子项）+ `## Rules` | 四章：`# 角色配置` / `# 行为准则` / `# 占位符覆盖` / `# 项目指令`，镜像插件级 `model/agent-about.md` 的四章结构 |
| 变量清单 | 6 个：`{username}` + 5 个文档产出路径变量（`pd_research_output` / `pd_prd_output` / `pd_ix_output` / `pd_vd_output` / `dev_design_output` / `dev_plan_output`） | 只示范 `{username}` 一项，没有文档产出路径变量的示例行 |
| wiki 维护命令名 | README.md 里写"由 `/project-wiki-distill` 维护" | `/project-wiki-distill` 命令已经不存在（先并入 `/sediment`，现在是 `nocode:personal-distill`），是过时的命令名 |

本仓库自己 dogfood 的 `.agents-personal/`（在仓库根，gitignored 不入库）用的正是 `personal-init` 生成的那套扁平结构 + `wiki/`，也印证了两者当前确实不一致。要修复这个漂移，应该以 `commands/personal-init.md` 的实际产出为准，把示例往它上面对齐——四章结构目前只存在于示例里，不是当前命令会生成的东西。

## 谁在读这个目录

- 人类：`README.md` 教怎么 `cp -r` 到自己项目当起点，也可以直接跑 `/personal-init` 让 agent 扫描仓库自动生成（两条路径产出的结构不同，见上表）。
- agent：目前没有任何 skill/hook 主动读取 `examples/` 下的内容，纯人工参考，不会被自动加载进 context。
