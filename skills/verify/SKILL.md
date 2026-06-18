---
name: verify
description: Use when Build is complete and you need to verify the implementation works end-to-end. Use when devflow routes to Verify stage, or when the user says "验证一下/跑一下看看/确认能用/verify".
---

# verify — 证明它真的能用

Build 完成后的 **evidence** 门。无新鲜证据，不得宣称完成。"看起来对"不是证据，跑一下才是。跳任一步 = 把未验证的东西伪装成已验证——这是 dishonesty，不是低效。

> Leading word: **evidence**。每一项断言背后都要有一条可贴出来的命令 + 输出。没有输出 = 没有断言。

## Entry Gate

- [ ] Build Gate 已过（所有 task 完成 + 全测试通过 + build 通过）
- [ ] Design 测试目标可用（Full 场景）
- [ ] Define 验收标准可用

## Checklist (TaskCreate)

1. **证据收集** — 跑完整测试套件 + build，记录命令+输出+通过/失败三元组
2. **集成测试** — 跨模块契约 + 数据流端到端
3. **E2E/Browser**（有 UI 变更时）— golden path + 边界 case + 截图
4. **性能检查**（有性能需求时）— Lighthouse / benchmark / Core Web Vitals
5. **验收逐条核对** — Define 验收标准 + Design 测试目标逐条 ✅/❌ 附证据

## 协议

### 6a. 证据收集

- 跑**完整**测试套件（不只是本次 slice 的单测）
- Build/编译成功，输出干净（无 error/warning/stack trace）
- 每项证据：**命令 + 输出 + 通过/失败**（模板见 `references/evidence-template.md`）
- 证据必须新鲜——这次改动后重新跑出来的，不是记忆里的

### 6b. 集成测试

跨模块契约 + 数据流端到端 + API 契约验证（请求/响应 schema、状态码、错误路径）。
单测全绿 ≠ 功能能用。单测验"你以为的逻辑"，集成验"真实的系统"。

### 6c. E2E / Browser（有 UI 变更时）

启动 dev server → golden path + 边界 case → 截图/录屏作证据。
无障碍检查（键盘可达、对比度、ARIA）。详见 `references/e2e-guide.md`。
**无 UI 变更 → 标注跳过**。

### 6d. 性能检查（有性能需求时）

Core Web Vitals：LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1。详见 `references/performance-guide.md`。
**无性能需求 → 标注跳过**。

### 6e. 验收逐条核对

从 Define 验收标准 + Design 测试目标**逐条**核对，每条 ✅ 附证据 / ❌ 附原因。
任一条未通过 → 回 Build 修复，不许"差不多了先过"。

## Exit Gate

- [ ] 全部验证证据已收集（三元组齐全）
- [ ] 验收标准逐条通过
- [ ] 性能达标（有需求时）
- [ ] 后续 Review 可开始

## 核心反模式

| 反模式 | 正确做法 |
|---|---|
| "改动很小，不用全套测试" | 小改动照样炸全局 |
| "我看了代码，逻辑对的" | 读代码是推断，跑出来的输出才是证据 |
| "上次跑过了，没动那块" | "没动"是假设，重新跑 |
| "先报完成回头补验证" | "回头补"永远不来 |

## Red Flags

- 写了"完成/修好了/通过了"但贴不出命令+输出
- 只跑了 slice 单测，没跑完整套件
- 有 UI 变更但没截图
- 验收核对出现"大概通过/应该没问题"
