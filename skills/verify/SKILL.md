---
name: verify
description: 证明功能真的能用，不只是测试通过。Use when Build stage is complete and you need to verify the implementation actually works end-to-end. Use when devflow routes to Verify stage, or when the user says "验证一下/跑一下看看/确认能用/verify". Enforces evidence-based verification — "seems right" is never sufficient.
---

# nocode-evolve:verify — 证明它真的能用

> Build 完成后的证据门。底子是 superpowers verification-before-completion——证据门最硬的一道。

## Iron Law（铁律）

**无新鲜证据，不得宣称完成。**

- "看起来对" 不是证据。**跑一下** 才是。
- 跳任一步 = 撒谎。不是"省时间"，是把未验证的东西伪装成已验证。
- 证据必须**新鲜**——这一次改动后重新跑出来的，不是记忆里的、上次的、推断的。
- 收集证据**之前**不许说"完成 / 修好了 / 通过了 / 应该可以了"。

每一项断言背后都要有一条可贴出来的命令 + 输出。没有输出 = 没有断言。

## 子流程

### 6a. Evidence Collection（证据收集）

- 跑**完整**测试套件（全部，不只是本次 slice 的单测）
- Build / 编译成功
- 输出**干净**——无 error、无 warning、无 stack trace
- 每一项证据记录三元组：**命令 + 输出 + 通过/失败**
- 模板见 `references/evidence-template.md`

> 单测全绿 ≠ 功能能用。单测验的是"我以为的逻辑"，集成/e2e 验的是"真实的系统"。

### 6b. Integration Test（集成测试）

- 跨模块集成测试——模块边界的契约对不对
- 数据流端到端——数据从入口流到出口是否正确
- API 契约验证——请求/响应 schema、状态码、错误路径

### 6c. E2E / Browser Test（有 UI 变更时）

- 启动 dev server
- 走 **golden path** + **边界 case**（从 Define 验收标准逐条推导，不是凭感觉挑）
- **截图 / 录屏** 作为证据落盘
- 无障碍检查（键盘可达、对比度、ARIA）
- **无 UI 变更 → 整步跳过**
- 详见 `references/e2e-guide.md`

### 6d. Performance Check（有性能需求时）

- Lighthouse / profiling / benchmark
- Core Web Vitals 阈值：**LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1**
- **无性能需求 → 整步跳过**
- 详见 `references/performance-guide.md`

### 6e. Manual Verification Checklist（验收逐条核对）

- 从 Define 的验收标准**逐条**核对
- 每条标注 **✅ 通过（附证据）** / **❌ 未通过（附原因）**
- 任一条未通过 → **回 Build 修复**，不许"差不多了先过"

## 异常路径

| 情况 | 去向 |
|---|---|
| 集成测试 / e2e / 性能 失败 | **Debug 横切**（`Skill(superpowers:systematic-debugging)`），定位根因后回 Build |
| 验收标准未满足 | **回 Build 补实现**，带上具体未达条款 |
| 测试套件有 flaky | 不许当作"通过"。隔离 flaky 项并标记，证据里如实记录 |

## 子调用

| 子调用 | 方式 | 降级 |
|---|---|---|
| /verify skill | `Skill(verify)`（harness 现有） | 手动启动 app + 观察行为，记录步骤与结果 |
| agent-browser | `Skill(agent-browser)` | 手动开浏览器测试，逐步骤记录 + 截图 |
| browser-testing-with-devtools | 参考 `references/e2e-guide.md` | 手动 DevTools 检查（Console / Network / Performance 面板） |

## Gate

**全部满足才过：**

1. 全部验证证据已收集（命令 + 输出 + 通过/失败 三元组齐全）
2. 验收标准逐条通过（每条 ✅ 附证据）
3. 性能达标（如 Define 有性能要求；无则不卡）

过 Gate 后进入 Review。未过 Gate **不许** 宣称完成、不许 commit、不许开 PR。

## Common Rationalizations（常见借口）

| 借口 | 反驳 |
|---|---|
| "改动很小，不用全套测试" | 小改动照样炸全局。全套测试几分钟，回滚事故几小时 |
| "我看了代码，逻辑是对的" | 读代码是推断，不是证据。跑出来的输出才是证据 |
| "单测过了就行" | 单测验你以为的逻辑，集成/e2e 验真实系统。两码事 |
| "上次跑过了，没动那块" | "没动" 是假设。依赖、配置、环境都可能漂移。重新跑 |
| "warning 不影响功能" | warning 是未来 error 的预告。输出不干净 = 证据不干净 |
| "时间紧，先报完成回头补验证" | "回头补" 永远不来。未验证就报完成 = 撒谎，代价由用户承担 |

## Red Flags（危险信号）

- 写出 "完成 / 修好了 / 通过了 / 应该可以了"，但贴不出对应的命令 + 输出
- 证据是"记忆里的"或"上次的"，不是这次改动后新鲜跑出来的
- 只跑了本次改动的 slice 单测，没跑完整套件
- 有 UI 变更却没有任何截图 / 录屏
- 验收标准核对表里出现"大概通过 / 应该没问题"这类模糊措辞
- 测试有 error/warning，但被当作"通过"略过

## Verification Checklist（勾选式）

- [ ] 完整测试套件已跑，全绿（不只是 slice 单测）
- [ ] Build / 编译成功，输出干净（无 error/warning）
- [ ] 每项证据有 命令 + 输出 + 通过/失败 三元组（见 evidence-template）
- [ ] 集成测试 + 数据流端到端 + API 契约已验证
- [ ] 有 UI 变更：e2e 走了 golden path + 边界 case，截图已落盘（无 UI 则标注跳过）
- [ ] 有性能需求：度量已跑，Core Web Vitals 达标（无则标注跳过）
- [ ] Define 验收标准逐条核对，每条 ✅ 附证据 / ❌ 附原因
- [ ] 所有断言都有新鲜证据支撑——没有"看起来对"
