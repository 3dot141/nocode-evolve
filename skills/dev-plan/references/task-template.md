# Plan 模板

三类模板：单个 task、checkpoint、整份 plan 文档。

---

## Task 模板

```markdown
## Task [N]: [标题] [Size: XS|S|M]
**描述**: 一段话说清这个 task 做什么、为什么。

**验收标准**:
- [ ] 条件 1（可观测、可判定）
- [ ] 条件 2

**covers**: [订单.P1, 订单.P2, 约束.1]   # 必填：本 task 覆盖的路径/约束 ID（见 path-conventions.md）

**验证命令**:
- `npm test -- --grep "xxx"`        # 预期输出: 1 passing
- `npm run build`                   # 预期输出: build succeeded

**文件**: (≤ 5 个)
- `src/foo.ts`
- `src/foo.test.ts`

**依赖**: Task N-1 / None

**真实改动**:
（贴出实际要敲的代码片段，不是伪代码，不是占位符。
 写不出来 = 还没想清楚，回 Plan Step 1。）
```

要点：
- `Size` 只能是 XS / S / M。L、XL 不允许，必须拆成多个 task。
- `covers` 必填——标注本 task 覆盖的路径/约束 ID（来自 restate 路径清单）。所有 task 的 covers 汇总后必须覆盖 restate 每条路径，否则 Plan Exit Gate 不通过。
- `验证命令` 要带预期输出——"跑这个，应该看到这个"。没有预期输出的命令无法判定通过。
- `真实改动` 是 HARD-GATE：不允许 `<your code here>` / `TODO` / `...`。

---

## Checkpoint 模板

每 2-3 个 task 插一个。

```markdown
## ✅ Checkpoint [C]: [覆盖 Task X-Y]
**全部测试**:
- `npm test`                        # 预期: all passing

**Build**:
- `npm run build`                   # 预期: build succeeded

**用户 Review**:
- [ ] demo 已交付内容（这几个 task 端到端能跑通什么）
- [ ] 用户确认继续 / 调整 / 回滚

**Rollback 点**: 此 checkpoint 之前所有 task 已各自 commit，出问题回退到这里。
```

---

## Plan 文档模板

```markdown
# Plan: [目标一句话]

> 来源：Define restate（成果物 / 验收标准 / 约束 / Out of Scope）

## 依赖图
- A (无依赖)
- B → 依赖 A
- C → 依赖 B

## 切片策略
- 垂直切片：[一条端到端可交付路径，例如 "用户能创建一条记录"]
- Risk-first：[最不确定的部分排在前面，写明为什么]

## 任务序列

## Task 1: ... [Size: S]
...

## Task 2: ... [Size: M]
...

## ✅ Checkpoint 1: 覆盖 Task 1-2
...

## Task 3: ... [Size: S]
...

## 退出条件
- [ ] 所有 task ≤ M
- [ ] 每个 task 零占位符，贴了真实代码 / 命令 / 预期输出
- [ ] 每 2-3 task 有 checkpoint
- [ ] 用户已确认
```
