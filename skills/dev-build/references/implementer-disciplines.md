# Implementer 执行纪律

Build 编排者在组装 implementer prompt 时注入本文件内容。这些纪律面向执行单个 task 的 subagent。

## Scope Lock

- 取 task，确认 ≤ 5 文件 + 验收标准。超过 → 报 BLOCKED，说明需回 Plan 拆
- **读 Plan task 的真实代码**：Plan Round 2 已填充测试代码 + 实现代码 + 验证命令，作为实现起点。不是照抄——实际代码库可能变化，需要适应（import 调整、API 变更、类型不匹配）
- **Source check**：Read 所有涉及代码/文档，标注 `[Read path:line]` / `[Doc URL]` / `[推断]`
- 框架 API 查官方文档确认。文档不可达 → 标 `UNVERIFIED` + 退回本地源码
- 只碰本 task 声明的文件。计划外发现用 **NOTICED BUT NOT TOUCHING** 模式：显式记录发现 + 位置 + 原因。具体：不顺手清理相邻代码、不重构只读文件的 import、不删不懂的注释、不加 spec 外"看起来有用"的功能、不现代化只读文件语法

## Test First (Iron Law)

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

1. **Red** — 写表达验收标准的测试，运行确认失败（失败原因是"功能没实现"不是"测试写错"）
2. **Green** — 写刚好够过绿的代码
3. **Refactor** — 行为不变降复杂度

已经写了产品代码再补测试？**删掉代码，从测试开始。** 没例外。

**回归测试有效性验证**：写完回归测试后走一遍完整红绿循环证明它真能抓 bug——写 → 跑(过) → 还原 fix → 跑(必须红) → 恢复 → 跑(过)。

**学派选择（outside-in vs inside-out）**：默认 **outside-in**——先写切片最外层的失败测试，下层用 fake 顶住，逐层向内替换真实现。当切片核心是纯领域逻辑（算法/状态机/计算）时切回 **inside-out**。按切片形状选，不是信仰。

**测试难写 = 设计难**：不知怎么测 → 先写期望 API / 先写断言；测试太复杂 → 设计太复杂，简化接口；必须 mock 一切 → 耦合太重，用依赖注入；setup 巨大 → 抽 helper 或简化设计

## Implement + Green

最少代码让测试变绿。不多写一行未被测试覆盖的逻辑。
Feature flags 包裹未完成功能。新功能默认关闭。

## Verify & Commit

test pass + build pass + 无回归，三项没全绿不许 commit。
commit message 说清 what + why。
**同一命令成功后不重复跑**——成功跑过的验证命令在代码未变前不要再跑。

**空壳自检**（commit 前必做）：检查本 task 产出的每个函数/方法是否有真实逻辑。空函数体、`throw new Error('not implemented')`、placeholder 注释（`// TODO`、`// implement later`）都算未完成——lint 和 typecheck 不管这些，但 spec review 会拦。发现空壳 → 填充完再 commit，或报 BLOCKED 说明为什么无法实现。

## 偏差分级处置

执行中发现实现路径和计划不完全对得上——不是所有偏差都要回 Plan：

| 偏差程度 | 信号 | 处置 |
|---|---|---|
| **小** — 路径不同但目标不变 | 换了个等价 API / 文件内位置微调 | 记录偏差理由（commit message 或 NOTICED），继续 |
| **中** — task scope 需调整 | 发现要多改 1-2 个文件 | 报 DONE_WITH_CONCERNS，说明 scope 变更。超出 ≤5 文件 → 升级为大偏差 |
| **大** — 设计假设错误 | 依赖的接口不存在 / 架构不可行 | 报 BLOCKED，说明需回 Design/Plan |

## 异常路径

| 触发 | 处理 |
|---|---|
| 同一测试修 3 次仍失败 | 报 BLOCKED，说明已尝试 3 次及失败原因 |
| 卡住/方向不确定 | 报 NEEDS_CONTEXT，写出不确定点 + 假设 + 需要什么信息 |
| 上下文冲突（spec 说 X 但代码是 Y） | 报 NEEDS_CONTEXT，列出冲突点 |

## pd-vd 视觉清点（有原型时注入）

- 前端 task 从原型文件读视觉参考，组件 `data-testid` 继承 `.vd.md` 定义的命名
- **样式完整性清点**（必做）：实现前先清点原型定义的视觉层——token（颜色/字体/间距）、组件样式（按钮变体/卡片/输入框/导航等）、交互状态（hover/active/disabled/empty/loading/error）、装饰层（纹理/渐变/阴影）。逐项确认 app 里有对应实现，缺哪补哪
