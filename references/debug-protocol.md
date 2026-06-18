# Debug Protocol — Build/Verify 横切调试流程

> 被 `build` 和 `verify` skill 引用。不是独立阶段，是遇阻时触发的横切能力。

## 触发条件

- Build 中测试失败 3 次修不好
- Build 中 build 失败
- Verify 中集成测试/e2e/性能测试失败
- 用户报告 bug
- Agent 发现异常行为

## 流程（融合 superpowers systematic-debugging + agent-skills debugging-and-error-recovery）

### D1. 复现

写出精确的重现步骤——不是"大概知道怎么触发"。

- 记录：环境 + 输入 + 操作步骤 + 预期结果 + 实际结果
- 无法复现 → 加日志/断点，收集更多信息后重试
- UI bug → 用 browser DevTools（Network/Console/Performance 面板）

### D2. 定位

- 最小化复现（剥离无关代码/数据）
- 二分法定位（git bisect / 逐步注释 / 分段排除）
- 缩小到具体文件+行号

### D3. 根因分析

**Iron Law：无根因不修。**

- 找到 root cause，不是表面症状
- 记录："根因是 X，因为 Y 证据表明 Z"
- 3 次尝试失败 → **停手，质疑架构假设**，上报用户
- 不猜、不碰运气、不换一种写法"试试看"

### D4. 写失败测试（TDD 集成）

- 先写测试复现 bug → 确认红
- 这个测试 = 回归防护网
- 没有测试的 fix = 没有证据的 fix

### D5. 修复

- 最小改动修 root cause
- 不顺手"改善"周边代码
- 不引入新抽象/新模式

### D6. 验证

- 新测试通过（红→绿）
- 全部已有测试通过
- Build 通过
- 端到端复现路径不再触发

## 退出 Checklist

- [ ] 根因已确认（不是猜测）
- [ ] 有回归测试覆盖 bug
- [ ] 全部测试通过
- [ ] Build 通过
- [ ] 端到端复现不再触发
- [ ] 没有引入新问题

全部勾选 → 退出 Debug，回到触发它的阶段（Build 或 Verify）继续。

## 子调用

| 调用 | 方式 | 降级 |
|---|---|---|
| systematic-debugging | `Skill(superpowers:systematic-debugging)` | 按上述 D1-D6 手动执行，明说 fallback |
| browser DevTools | agent-browser / computer-use | 手动浏览器检查，记录步骤 |

## Common Rationalizations

| 借口 | 反驳 |
|---|---|
| "先打个补丁，根因以后查" | 补丁掩盖根因，下次在更难找的地方爆发 |
| "这个 fix 看起来对" | "看起来"不是证据。测试跑一遍才是 |
| "改了几个地方，不知道哪个修好的" | 回滚到 fix 前，逐个应用变更，找出真正修好 bug 的那一个 |
| "bug 不再复现了，应该好了" | "不再复现" ≠ "已修复"。没有回归测试 = 没有证据 |
