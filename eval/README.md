# eval/

rule-eval：测 nocode 插件规则路由的**触发率**——给定一句该/不该触发某条 rule 的话术，
在模拟"深陷另一任务动量"的压力场景下，量化 agent 是否仍能正确路由
（momentum-aware route-recall）。这是"措辞质量"守门层，不测 skill 执行质量
（那是 `../benchmark/` 的职责）。

## 目录结构

| 路径 | 内容 |
|---|---|
| `cases/<rule-id>.md` | 单条 rule 的正/负样本 fixture（`primary_route` + 正负样本 + action-id 词表） |
| `preambles/cold.md` | 冷启动情境铺垫（无前序任务） |
| `preambles/mid-task-momentum.md` | 任务动量情境铺垫（模拟深陷另一任务、注意力被占满的压力场景） |

设计依据：`../docs/plans/3dot141/260526-rule-trigger-eval-design.md`
（判分公式、fixture 格式、失败分型、混淆矩阵的唯一来源）。

## 如何跑

入口命令 `/rule-eval [<rule-id> | --all]` 定义在 `.claude/commands/rule-eval.md`——
**这是仓库本地 dev 工具，被 `.gitignore` 忽略，不随插件分发**，clone 一份干净仓库不会
自带它。只有本仓库本地开发环境（自己在 `.claude/commands/` 下放了这份文件）才能直接跑；
其他人要复现得照设计文档手动重建"读 catalog + preamble + fixture → 派 subagent →
exact-match 判分"这套流程。

流程概览：

1. 读 `model/agent-about.md` + `agent-personal.md` + `agent-karpathy.md` +
   全部 `model/agent-catalog-*.md` 分片（重建 SessionStart 上下文）
2. 读目标 `eval/cases/<rule-id>.md`（正/负样本 + preamble_profiles）
3. 对每条样本 × 每个 preamble，派一个隔离 subagent（不透露期望答案），要求输出 JSON
   `{primary_route, secondary_routes, read_files, will_do_actions, reason}`
4. 机械 exact-match 判分：route-recall（≥0.8 PASS）+ steal 率（>0.1 WARNING）+
   intent-signal（意图信号，非真遵守）
5. 出报告：分 rule 列 route-recall / steal / intent-signal + 逐 miss 证据

> 已知漂移：`rules/rule-*.md（原 rules/manifest.json，已废弃改为逐文件 frontmatter）` 现在用 `dev-*` 前缀命名 rule（如 `dev-build`），但
> `eval/cases/` 里的 6 个 fixture 还是旧的短 id（`build`）。用之前先核对
> `model/agent-catalog-*.md` 里当前的真实 rule id，必要时同步更新 fixture，否则判分会
> 假阴性。详见 `AGENTS.md`。

## 如何加 case

1. 在 `eval/cases/` 下新建 `<rule-id>.md`，头部写 `primary_route` /
   `acceptable_alternates` / `preamble_profiles` / `default_intent`（`must_action_ids`
   / `forbidden_action_ids`）+ action-id 词表注释。
2. `## positive` 下列该触发的话术；`## negative` 下按分型标签
   （`[other-rule-primary]` / `[near-miss]` / `[explicit-exclusion]` / `[tool-only]`）
   列不该触发的话术，每种分型至少 2 条。
3. 如需新的情境铺垫，在 `eval/preambles/` 加一份，并在 fixture 的 `preamble_profiles`
   里登记。
4. 当前只覆盖了 `rules/rule-*.md（原 rules/manifest.json，已废弃改为逐文件 frontmatter）` 24 条规则中的 6 条（build / define / design /
   finish-branch / plan / verify）；给新规则或改动较大的规则补 fixture 是欢迎的。
