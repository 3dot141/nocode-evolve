# docs/ — 工程产出文档目录

> 设计文档、实施计划、调研报告等 agent 产出物的落地目录。三个子树跨了插件文档路径约定的新旧两代，读之前先分清"新文档往哪写"和"旧目录为什么还在"。

## 新文档往哪写

新文档路径由 `model/agent-about.md`「文档产出路径变量」表决定，不是写死的路径：

| 变量 | 插件默认值 | 对应 skill |
|---|---|---|
| `{pd_research_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/research-report.md` | pd-research |
| `{pd_prd_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.prd.md` | pd-prd |
| `{pd_ix_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.ix.md` | pd-ix |
| `{pd_vd_output}` | `docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.vd.md` | pd-vd |
| `{dev_design_output}` | `docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-design.md` | dev-design / brainstorming |
| `{dev_plan_output}` | `docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-plan.md` | dev-plan |

变量可在 `<project>/.agents-personal/AGENTS.md` 或 `<project>/CLAUDE.md`/`AGENTS.md` 逐条覆盖，解析优先级见 `model/agent-about.md`「变量解析优先级」（`.agents-personal/AGENTS.md` > 项目 `CLAUDE.md`/`AGENTS.md` > 插件默认值）。

**本仓库的特例**：本仓库（nocode 插件自己的源码仓）的 `.agents-personal/AGENTS.md`（gitignored，不入库，只在本地生效）把 `{dev_design_output}` / `{dev_plan_output}` 等变量覆盖回了旧的 `docs/superpowers/specs/` / `docs/superpowers/plans/` 布局——所以当前这个仓库里新写的 dev 类设计文档、计划实际落在 `docs/superpowers/`，不是插件默认的 `docs/dev/`。`docs/dev/3dot141/` 下唯一的一份文档（`260625-01-path-driven-chain/`）来自实现"文档产出路径变量"这个功能本身那次改动，是插件默认布局在本仓库落地的孤例，不代表当前惯例——不要把它当模板参照着继续往 `docs/dev/` 写。

## 旧目录不迁移、不删

`docs/plans/` 和 `docs/superpowers/{specs,plans}/` 是插件级已废弃路径。`model/agent-about.md` 全局约定原话：

> 旧路径 `docs/superpowers/specs/` · `docs/superpowers/plans/` · `docs/nocode/prds/` · `docs/plans/` 已废弃。既有文档不迁移，新文档按产出路径变量走。

具体到这个目录：

- **不要**把 `docs/plans/` 下的文档挪到 `docs/dev/`——原样留着，不做迁移性改动。
- **不要**删旧文档——历史设计决策有参考价值，删除等于丢上下文；这条原则与 `.agents-personal/` 删除护栏同源：历史内容删不删由用户拍板，agent 不替用户判定弃用。
- `docs/superpowers/specs/INDEX.md` 有一套 current / superseded / historical 三态标注机制，专门防止 agent 顺手读到过时设计当 source of truth。改动 `docs/superpowers/specs/` 下任何文档的状态（新设计取代旧设计、设计已实施），同步更新这份 INDEX，不要另建重复的索引文件。
- `docs/dev/` 目前没有配套 INDEX，新增文档靠目录名自解释（`{yymmdd}-{serial}-{topic}/`），暂不需要额外索引；如果 `docs/dev/` 以后文档量上来，可以参照 `docs/superpowers/specs/INDEX.md` 的三态模式补一份。
