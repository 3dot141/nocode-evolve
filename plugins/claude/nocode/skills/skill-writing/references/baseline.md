# Baseline — RED：先看着 agent 失败（Iron Law 实证）

```
NO SKILL WITHOUT A FAILING BASELINE FIRST — ALL SKILL TYPES, NO EXCEPTIONS.
```

对所有类型生效——纪律型、技巧型、模式型、参考型。"它只是参考文档"是跳过 baseline 的第一大借口——参考文档一样有缺口，baseline 测试才能暴露它们。

**为什么**：没见过 agent 在无 skill 时怎么失败，你就是在猜要教什么。猜出来的 skill 治的是想象中的病。

## 按类型设计测试场景

| 类型 | 场景设计 | 最少场景数 |
|---|---|---|
| **纪律型**（TDD、debugging、verification） | 压力场景（时间 + 沉没成本 + 权威） | ≥3 |
| **技巧型**（condition-based-waiting、root-cause-tracing） | 应用 + 变体 + 信息缺失 | ≥3 |
| **模式型**（flatten-with-flags、information-hiding） | 识别 + 应用 + 反例 | ≥3 |
| **参考型**（API 文档、命令参考） | 检索 + 应用 + 覆盖 | ≥2 |

## 场景来源：Scenario Discovery Matrix

先填矩阵再选场景，不要自由联想。扫全部 7 轴、标出适用格、跳过的格给理由，然后用矩阵里的 Phase 3 Selection Rules 选出**覆盖矩阵各轴的最小正交集**。

矩阵与选取规则见 `../writing-skills/scenario-discovery-matrix.md`。

## 执行步骤

每个场景：

1. 用场景 prompt 派一个 subagent，**不加载 skill**
2. 逐字记录：它做了什么选择？用了什么合理化借口？哪些压力触发了违规？
3. 给每个失败标上暴露它的矩阵格（如 "Axis 3: Rationalization + Axis 4: Sunk cost"）
4. 结果存入 workspace

压力场景设计细则见 `../writing-skills/testing-skills-with-subagents.md`。

## Codex 交叉 baseline

至少 1 个场景同时跑 codex，暴露跨模型差异的失败模式：

```
codex 可用? (setup --json)
     │
     ├─ 可用 ──→ 跑 ≥1 场景 → 与 subagent 失败模式对比
     │              - 两边都失败 = 高置信失败模式
     │              - 只有一边失败 = 模型特有盲区，仍算有效 baseline 失败
     │
     └─ 不可用 ──→ 只用 subagent（声明 "codex 不可用，跳过交叉 baseline"）
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task \
  "<场景 prompt，与 subagent 相同，不加载 skill>"
```

## 通过判据

- [ ] 场景选自已填矩阵（每个覆盖 ≥1 任务类型 + ≥1 失败模式 + ≥1 上下文/边界格）
- [ ] 达到类型最少场景数
- [ ] **至少一个可复现的 baseline 失败**——所有场景跑完仍零失败，要么换角度/加压重设计场景，要么停下宣布"暂不构成做 skill 的理由"。只跑场景不够，Iron Law 要求**观察到的失败**。从 schema/代码分析推断出的缺口是新场景的假设，不是观察到的失败——先跑成场景再计数。
- [ ] 失败模式带矩阵标签记录（具体行为 + 合理化借口）
- [ ] 结果已存 workspace
