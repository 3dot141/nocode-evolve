# benchmark/

devflow-benchmark：用 Executor→Evaluator 隔离评测法，给 nocode 插件的 8 个核心工作流 skill
（define / design / plan / build / verify / code-review / devflow / caveman）的**输出质量**
打分，驱动 skill 优化迭代。

## 目录结构

| 路径 | 内容 |
|---|---|
| `cases/<skill>/<skill>-cases.json` | 该 skill 的 base case 集（`evaluate.mjs` 实际加载的文件） |
| `cases/<skill>/<skill>-ext-cases.json` | 补充例（happy + edge + hard，未接入自动化脚本） |
| `cases/<skill>/<skill>-hard-cases.json` | 对抗例（诱导违反 Iron Law/Scope Lock，未接入自动化脚本） |
| `cases/pipeline/pipeline-001.json` | 跨阶段集成 case（Define→Design→Plan 接力） |
| `fixtures/` | 预留的外部素材目录（diff / 注入 bug 代码 / 模拟会话），当前为空 |
| `splits/train.json` / `splits/val.json` | `split.mjs` 生成的 70/30 训练/验证切分（只存 case_id 列表） |
| `scripts/evaluate.mjs` | case 加载 + executor/evaluator prompt 组装 + 分数汇总 |
| `scripts/split.mjs` | 按 skill 分层抽样生成 train/val 切分 |

设计依据：`docs/dev/3dot141/260619-01-devflow-benchmark/devflow-benchmark-design.md`
（评分维度、锚点、通过标准、防污染规则的唯一来源）。

## 如何跑

```bash
# 列出某 skill 的全部 case
node benchmark/scripts/evaluate.mjs define --list

# 输出该 skill 全部 case 的 executor prompt（供派 subagent 执行）
node benchmark/scripts/evaluate.mjs define

# 重新生成 train/val 切分
node benchmark/scripts/split.mjs
```

脚本只负责 case 组装，不直接调用模型——实际的 Executor（跑 skill）和 Evaluator（打分）
由调用方在 Claude Code 会话里现场派生 subagent 完成，判分模板见 `evaluate.mjs` 里的
`buildEvaluatorPrompt()`。

> 注意：`build` / `code-review` / `plan` 三个 skill 的 base case 文件是 `{cases:[...]}`
> 包装对象而非裸数组，当前 `evaluate.mjs --list` 对这三者会报错（已知问题，见 AGENTS.md）。

## 如何加 case

1. 在 `cases/<skill>/<skill>-cases.json` 里追加一条，字段：`case_id` / `category` / `input`
   / `context` / `expected_signals` / `anti_signals` / `primary_dimensions`（对齐设计文档里
   该 skill 的维度表，如 verify 的 `V1`-`V5`）/ `difficulty`。
2. `expected_signals` / `anti_signals` 只给 Evaluator 看，不要泄漏进 `input`/`context`。
3. 需要外部素材（diff、代码片段、模拟会话）的 case，把素材放进 `fixtures/`，case 里引用路径。
4. 加完 case 后跑一次 `node benchmark/scripts/split.mjs` 让新 case 进入 train/val 切分。
