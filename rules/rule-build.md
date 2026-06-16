# nocode-evolve:build 独立触发

devflow 外部独立触发 build skill 的约束。

## 触发条件

用户说「开始实现 / 写代码 / 执行计划 / build it / 动手 / 实现这个」，或已有计划需要执行。

## 做法

1. 确认有可执行的计划（plan 文件或用户明确的 task 列表）
2. `Skill(nocode-evolve:build)` — 走 slice 循环
3. 每个 slice: Scope Lock → Test First → Implement → Verify → Commit

## 关键约束

- **Iron Law**: 无失败测试不写生产代码
- **Scope Lock**: 每个 task ≤ 5 文件
- **Source-Driven**: 实现前 Read 涉及代码，标注来源
- 测试失败 3 次 → Debug 横切（参考 `references/debug-protocol.md`）

## 不要

- 不跳过测试直接写代码
- 不一口气改多个文件再跑测试——每个 slice 闭环
- 不碰计划外代码（Scope Discipline）
