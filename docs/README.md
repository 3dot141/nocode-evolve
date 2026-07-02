# docs/

工程产出文档：设计文档 / 实施计划 / 调研报告，按 skill 的产出路径变量落盘。三个子树对应插件文档路径约定的新旧两代，外加本仓库自己的一处本地覆盖。

## 子树一览

| 子树 | 内容 | 布局 | 状态 |
|---|---|---|---|
| `dev/` | dev-design / dev-plan 产出的设计文档、计划 | `{username}/{yymmdd}-{serial}-{topic}/{topic}-design.md`（每个 topic 一个目录，序号支持同日多个 topic） | **插件当前默认布局**，本仓库仅 1 份样本（见下方「归档现状」） |
| `plans/` | 早期设计文档 + 实施计划 | `{username}/{yymmdd}-{topic}-design.md` / `{yymmdd}-{topic}-plan.md`（扁平，无 serial，design 和 plan 混放同一目录） | **已废弃**，不再新增，既有文档保留不迁移 |
| `superpowers/` | 设计 spec（`specs/`）+ 实施计划（`plans/`） | `specs 或 plans/{username}/{yymmdd}-{topic}-design.md`；`specs/INDEX.md` 维护 current / superseded / historical 三态 | **插件级已废弃，但本仓库本地覆盖仍在持续使用**（见下） |

## 归档现状

- `docs/dev/3dot141/260625-01-path-driven-chain/path-driven-chain-design.md`——目前 `docs/dev/` 下唯一文档，正是实现"文档产出路径变量"这个功能本身时产出的设计文档。之后本仓库没再往 `docs/dev/` 写新东西。
- `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 持续在更新，最新文档到 260702（`260702-launcher-service-clis.md`）。原因是本仓库本地的 `.agents-personal/AGENTS.md`（gitignored，不入库）把 `{dev_design_output}` / `{dev_plan_output}` 覆盖回了这套旧布局。这是"本项目特例"——插件默认给别的项目用的是 `docs/dev/` / `docs/pd/`，但插件自己的这个开发仓库还在沿用自己更早定的 `docs/superpowers/` 布局。
- `docs/plans/` 是比 `docs/superpowers/` 更早一代的布局（不带 `superpowers/` 前缀），已经完全停止新增。`docs/superpowers/specs/INDEX.md` 的 historical 表里有一条明确点名了它——"旧 `docs/plans/` 路径（无 `superpowers` 前缀），不迁移"。
- `docs/superpowers/specs/INDEX.md` 是唯一带状态跟踪的索引，读 `docs/superpowers/specs/` 下的设计文档前先看它一眼，避免把已被取代（superseded）的方案当成当前权威依据。

## 命名规律速查

- 日期格式统一 `yymmdd`（如 `260511`）
- `docs/dev/`：`{yymmdd}-{serial}-{topic}/` 目录 + 目录内 `{topic}-design.md` / `{topic}-plan.md`
- `docs/plans/`：扁平 `{yymmdd}-{topic}-design.md` / `{yymmdd}-{topic}-plan.md`，同一目录混放
- `docs/superpowers/`：`specs/{yymmdd}-{topic}-design.md`（部分文件不带 `-design` 后缀）+ `plans/{yymmdd}-{topic}.md`，spec 和 plan 分成两个子目录，`specs/INDEX.md` 管状态
