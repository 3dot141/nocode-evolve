# dev-build-executing — 主 agent 自己顺序执行 plan 已写代码

对应 plan `Execution` 字段值 `executing`。不派 subagent，主 agent 自己逐 task 走完 plan 已经写好的 TDD steps，commit，进下一个 task。没有独立 spec/quality review——靠后续 dev-verify / dev-review 兜底。改编自上游 superpowers `executing-plans`。

## 协议

对每个 task，按 plan 里的顺序：

1. 标记 in_progress
2. **照着 plan 已写的步骤逐条执行**（plan 已经是 bite-sized TDD steps：写失败测试 → 跑确认失败 → 写实现 → 跑确认通过 → commit）。**plan 的代码是权威来源，不是从零发明**——全程遵守 `implementer-disciplines.md` 整份纪律（Scope Lock、Source check、Simplicity check、偏差分级、NOTICED BUT NOT TOUCHING），不只挑偏差分级那一节。代码库如果和 plan 编写时有漂移，按偏差分级处置，不擅自另起炉灶
3. 按 task 声明的验证命令跑验证，不跳过
4. 标记 completed

## 何时停下来问

**立即停止执行，当：**
- 卡住（缺依赖、测试跑不过、指令看不懂）
- plan 有严重缺口，没法开始这个 task
- 看不懂某条指令
- 验证反复失败

停下来问用户，不要猜、不要绕过去凑合做。

## Red Flags

- plan 有疑虑不提出来就动手
- 跳过验证步骤或不跑就标 completed
- 卡住了硬着头皮继续，不停下问
- 代码库和 plan 有明显漂移，擅自重新设计而不是先按偏差分级处置
