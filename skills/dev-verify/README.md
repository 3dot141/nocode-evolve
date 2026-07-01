# dev-verify

Build 完成后的 evidence 门——证明改动真的能用，不是"看起来对"。devflow 第 6 阶段。

## 在 devflow 中的位置

```
... Build → dev-verify → Review ...
              ↑ 你在这里
```

## 设计决策：删除 Step 7（反向审计 / PRD 回查）

`260701` 的 devflow 多层 review 收敛审查中删除。

**原来的设计**：Step 7 拿 **PRD 原始路径清单**（不是 Design 的 TO 表）回扫代码/测试覆盖，理由是"Design 阶段推导 TO 表时如果漏看了某条路径，TO 表里也不会有这条，只对照 TO 表会跟着漏"——所以要越过所有衍生产物，直接回到最原始的 PRD 文档核对。

**为什么删**：这套逻辑成立，但导致 Verify 和 Review（原 Step 6 Path Coverage Check）各自独立回查一次同一份 PRD 清单，产出近乎同构的覆盖率报告——是两处重复劳动，而不是两道独立防线（详见 dev-review/README.md）。

**现在怎么办**：Step 6（验收逐条核对）的核对基准是 Define 产出的 restate（路径 + 约束 + SC）。restate 本身是不是完整覆盖了 PRD，这个问题不再由 Verify/Review 兜底，而是前移到：
- **Design 阶段**（3d 方案←→目标对齐）——设计方案产出后回检 restate 是否有冲突/遗漏
- **Plan 阶段**（Step 8c 路径覆盖）——所有 task 的 `covers` 字段汇总后必须覆盖 restate 每条路径，Plan Exit Gate 卡这道

**代价（显式承认）**：如果 Define 阶段产出 restate 时本身就漏看了 PRD 里的某条路径，devflow 里不再有任何一处会回头去比对 PRD 原文发现这个遗漏——Design/Plan 阶段的对齐检查比对的都是 restate 及其衍生物，不是 PRD 原文。这是用户在权衡"防遗漏的最后一道防线" vs "两处重复回查 PRD 的成本"后做出的选择：如果 restate 阶段的漏项风险在实践中确实较高，可以考虑把这道 PRD 回查加回 Define 阶段（restate 产出时就对照 PRD 原文核对一次），而不是加回 Verify/Review。

## 下游消费者

- `dev-review` — Step 6（Path Coverage Check）已删除，不再消费本 skill 的产出（历史行为，见上）
