# Description — 触发准确性优化

skill 写好了但触发不准 = 白写。description 的唯一职责是让 skill 在该触发时触发、不该触发时沉默。

## 前置（description-only 单步进入时）

- [ ] 现有 SKILL.md 已加载并过目
- [ ] 触发查询集已定义（≥10 应触发 + ≥10 不应触发）
- [ ] 已测当前 description 的基线触发率（hit/miss）

## 流程

生成 20 条触发 eval 查询（8-10 应触发 + 8-10 不应触发），用 `../skill-creator/assets/eval_review.html` 给用户过目。

```
claude CLI 可用?
     │
     ├─ 可用 ──→ ../skill-creator/scripts/run_loop.py 自动优化
     │           （60/40 切分、每查询 3 次、最多 5 轮迭代）
     │
     └─ 不可用 ──→ 手动轮次：改 description → 测 5+5 查询 → 数触发率
```

用最优结果更新 frontmatter description。

## 通过判据

- [ ] 20 条触发查询测完（8-10 应 + 8-10 不应）
- [ ] description 已更新为最优版本
- [ ] 触发准确率达标
