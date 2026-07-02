# AGENTS.md — benchmark/

## 这是什么

`devflow-benchmark`：对 nocode 插件的 8 个核心工作流 skill
（define / design / plan / build / verify / code-review / devflow / caveman）
做**离线输出质量评测**——不是测规则路由触发率（那是 `eval/` 的职责，两者互不重叠）。

方法论：Executor / Evaluator 隔离评分。Executor（被测 skill，实际由主 agent 派 Claude Code
subagent 跑）只看 `input` + `context`；Evaluator（另一个独立 subagent）额外拿到 rubric
（`expected_signals` / `anti_signals` / `primary_dimensions`）对 transcript 逐维度打 0-5 分。
目的是驱动类 SkillOpt 的 skill 优化循环，评分不是给人看的报告，是决定"这版 skill 改动是否
达标"的 gate 输入。

设计依据全部在 `docs/superpowers/specs/3dot141/260619-devflow-benchmark-design.md`
（每个 skill 的评分维度锚点表 0/3/5 分、防污染规则、正例:边界:反例 ≈5:3:2 配比、
train/val 70/30 切分规则、通过标准）。**改 case 或加新维度前先读这份文档**，不要凭空造维度 ID。

## 跑评测的命令入口

```bash
# 列出某 skill 的全部 case
node benchmark/scripts/evaluate.mjs <skill> --list

# 输出该 skill 全部 case 的 executor prompt（JSON，只含 input+context，不含 rubric）
node benchmark/scripts/evaluate.mjs <skill>

# 重新生成 train/val 切分（70/30 分层抽样，固定种子 42，可重复）
node benchmark/scripts/split.mjs
```

`<skill>` ∈ `define design plan build verify code-review devflow caveman`。

脚本本身**不调用模型**——真正的 Executor / Evaluator 是由调用方（主 agent）在跑 benchmark 时
现场派生的 Claude Code subagent。`evaluate.mjs` 只负责 case 加载 / prompt 组装 /
分数汇总（`buildEvaluatorPrompt` 里贴了完整的评分铁律 prompt 模板，可直接复用）。

### 已知问题：case 文件两种 JSON 结构混用

`cases/<skill>/<skill>-cases.json`（脚本实际加载的 base 文件）目前有两种格式：

- **裸数组**（`define` / `design` / `devflow` / `verify` / `caveman`）—— `evaluate.mjs` 正常工作。
- **包装对象** `{skill, version, dimensions, cases:[...]}`（`build` / `code-review` / `plan`）——
  `evaluate.mjs` 的 `loadCases()` 直接 `JSON.parse` 后当数组用，对这 3 个 skill 跑
  `--list` 会抛 `TypeError: cases.forEach is not a function`（已用
  `node benchmark/scripts/evaluate.mjs build --list` 验证复现）。

`split.mjs` 用 `Array.isArray(raw) ? raw : raw.cases` 做了兼容，不受影响。**新增/改
`evaluate.mjs` 时记得同样兼容两种格式，或者把 build/code-review/plan 的 base 文件拍平成
裸数组以统一格式**——目前两者都没做，属于遗留不一致。

### `-ext-cases.json` / `-hard-cases.json` 未接入自动化

每个 skill 目录下的补充例（`*-ext-cases.json`，happy+edge+hard 补充）和对抗例
（`*-hard-cases.json`，专门诱导 agent 违反 Iron Law / Scope Lock 的 case）目前**没有任何脚本
加载**——`evaluate.mjs` 和 `split.mjs` 都只读 `${skill}-cases.json` 这一个 base 文件名。
这些补充 case 是已经写好但未接入 pipeline 的数据，谁要用得手动 `Read` JSON 后自己派 subagent
跑，或者先扩展 `evaluate.mjs` 让它能吃多个文件。

## 新增 case 的格式约定

- 必填字段：`case_id`（`<skill>-NNN` 或 `<skill>-ext-NNN` / `<skill>-hard-NNN`）/ `category`
  （`happy_path` / `edge` / `negative` / `positive` / `adversarial` 等）/ `input` / `context`
  / `expected_signals` / `anti_signals` / `primary_dimensions`（引用该 skill 在设计文档里定义的
  维度 ID，如 define 的 `D1`-`D5`、build 的 `B1`-`B5`、code-review 的 `CR1`-`CR5`）/ `difficulty`。
- **防污染铁律（不能违反）**：`expected_signals` / `anti_signals` / `primary_dimensions`（rubric）
  只能出现在 Evaluator 看到的 case 子集里，绝不能泄漏进 Executor 收到的 prompt——
  `evaluate.mjs` 的 `buildExecutorPrompt()` 只挑 `input` + `context` 就是为此，写新 case 时
  不要在 `input`/`context` 里意外把评分线索透给 Executor（比如把锚点措辞原样写进 context）。
- `cases/pipeline/pipeline-NNN.json` 结构不同：顶层 `stages[]` 数组，每个 stage 对应
  Define→Design→Plan 中的一环，带 `handoff_to_next` 说明衔接点，考的是**跨阶段传递**
  （restate 有没有被下一阶段引用、测试目标有没有被分配到 plan slice），不是单 skill 维度打分。
- devflow-benchmark 设计文档里列的是 9 个 skill（含 `handoff`），但 `handoff` skill 已在插件
  里删除（commit `1ee8678`，"compact 自定义指令已覆盖"），所以 `cases/` 下没有 `handoff/`
  目录，`split.mjs` 的 `SKILLS` 常量也只列 8 个——这是有意为之，不是漏做，不要补回去。

## 哪些是生成物 / 固定 fixture，不要乱动

- `splits/train.json` / `splits/val.json`：`split.mjs` 的**确定性生成物**（种子固定=42）。
  手改没有意义——要变结果就改某个 skill 的 case 数量或 `split.mjs` 里的比例后重新跑脚本。
  `train` 供迭代优化时反复看；`val` 按设计文档 3.2 节要求**只在 gate 决策时跑一次**，
  不能被"优化过程"提前看到（防止过拟合到 val 集）。
- `fixtures/` 目录**当前是空的**（在 git 里也没有任何被跟踪的文件）。它是设计文档里预留给
  "diff / 注入 bug 的代码 / 模拟会话"等 verify、code-review case 需要引用的外部素材目录，
  还没有人往里填内容。新增需要外部素材（而非纯文本 input）的 case 时应该把素材放这里，
  用相对路径从 `cases/*.json` 里引用，不要把大段代码/diff 内联进 case JSON。
- `scripts/evaluate.mjs`、`scripts/split.mjs` 是评测/切分逻辑本体，改动会影响所有 skill
  的判分口径，改之前建议先确认设计文档里的判分公式和通过标准（3.5/5 均分线、2.0 底线、
  10% 误触发率上限、主考维度 4.0 门槛）没有被破坏。
