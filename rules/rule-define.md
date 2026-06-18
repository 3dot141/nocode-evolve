# nocode-evolve:define 独立触发

devflow 外部独立触发 define skill 的约束。

## 触发条件

用户说「澄清需求 / 做什么 / 目标是什么 / interview me / 定义目标 / 需求不清楚 / clarify」，或任务描述缺少 who/why/what success looks like。

## 做法

1. `Skill(nocode-evolve:define)` — 走完整 Define 流程
2. 产出 restate + 场景分类
3. 如果场景不是 Mini，建议用户进入 devflow 走后续阶段（Full 场景走 Design，Standard 走 Plan）

## 边界

- Define 用 brainstorming 发散问题空间（真问题是什么？隐藏约束？），不延伸到解法选择
- 解法探索、方案对比、架构设计属于 Design 阶段（`nocode-evolve:design`）
- Define 不判断"实现路径是否显而易见"——场景分类决定是否经过 Design

## 不要

- 不在 define 之前就开始写代码/计划
- 不跳过场景分类——后续路由依赖它
- 不在 define 里做方案选型——那是 design 的事
