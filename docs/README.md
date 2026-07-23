# docs/

工程产出文档统一按流程与 topic 聚合。

| 子树 | 内容 | 布局 |
|---|---|---|
| `dev/` | 工程设计、实施计划、评审材料与配套资源 | `{username}/{yymmdd}-{serial}-{topic}/` |
| `pd/` | 产品调研、PRD、交互与视觉设计 | `{username}/{yymmdd}-{serial}-{topic}/` |

开发文档通常命名为 `{topic}-design.md` 与 `{topic}-plan.md`；同一 topic 的 HTML、图片和补充材料
与它们放在同一目录。日期格式为 `yymmdd`，序号为同日递增的两位数。

历史上的 `docs/plans/` 和 `docs/superpowers/` 已迁移到 `docs/dev/3dot141/`，不得继续写入或重新创建。
设计状态索引见 [`docs/dev/INDEX.md`](dev/INDEX.md)。
