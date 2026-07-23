# docs/ — 工程产出文档目录

> 设计、计划、调研和产品文档统一按插件当前路径变量落盘。

## 新文档路径

| 流程 | 根目录 | topic 目录 | 典型文件 |
|---|---|---|---|
| Product | `docs/pd/{username}/` | `{yymmdd}-{serial}-{topic}/` | `research-report.md`, `{topic}.prd.md`, `{topic}.ix.md`, `{topic}.vd.md` |
| Development | `docs/dev/{username}/` | `{yymmdd}-{serial}-{topic}/` | `{topic}-design.md`, `{topic}-plan.md` |

- `{serial}` 是同一用户名、同一天内递增的两位序号。
- 同一 topic 的 Design、Plan、HTML 和配套资源放在同一目录。
- 路径变量及覆盖优先级以 `model/agent-about.md` 为单源。
- 本项目 `.agents-personal/AGENTS.md` 只覆盖 `{username}=3dot141`，不再覆盖文档根目录。

## 历史文档

旧的 `docs/plans/` 与 `docs/superpowers/{specs,plans}/` 已按用户明确授权整体迁入
`docs/dev/3dot141/`。不要重新创建旧目录。

`docs/dev/INDEX.md` 保留 current / superseded / historical 状态索引。新增或变更设计状态时，
同步更新该索引；历史设计不得因迁移而删除。
