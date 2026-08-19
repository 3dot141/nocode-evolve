# Header
- task: devflow 续跑逻辑——终态 Log 不续跑，新输入开新 Log 完整新一轮
- status: active
- type: feat
- predecessor: 无（同仓前序任务 260819-01 是不同主题）
- createdAt: 2026-08-19T22:20:00+0800
- artifacts:
  - log: ./design.log.md
  - design: ./design.md

# Decisions

## DEC-001
- 描述: 任务分类
- 内容: feat——devflow 家族新增「完成后新输入 → 新 Log」的续跑规则与 predecessor 回链机制。
- 后果: 无
- 过程: 用户指令（红蓝军评估中断，直接拍板）。
- 引用: [ROUND-001]

## DEC-002
- 描述: 终态 Log 不续跑，新输入开新 Log
- 内容: Log Header status 为终态（landed/cancelled/terminated）即上一轮 design/plan/build 已走完：新输入不在旧 Log 续跑、不追加设计内容，而是创建新 design.log.md 完整走新一轮 devflow（classify → design → plan → build）。新 Log Header 记 `predecessor` 回链旧 Log；旧 Log 追加 `Event N — successor` 指针。active Log + 同主题新输入 → 续跑（现状不变）；active Log 但新输入是独立新成果（实际完工未 land）→ 先关闭旧 Log（task-end Event + status），再开新 Log。
- 后果: 波及 devflow/SKILL.md（Step 1 resume 规则 + Step 5 关闭语义 + Invariants）、grilling.md（Header 加 predecessor 字段）、handoff.md（关闭即终态）、dev-design/SKILL.md（终态 Log 防御线）。
- 过程: 用户先提「同 Log 新 cycle」，随即自问「或者用新的 design.log.md」，红蓝军评估启动后用户中断拍板「直接用新的，相当于完整来一轮新的 devflow，如果之前的已经走完 build」。
- 引用: [ROUND-001]

# ROUND

## ROUND-001 — closed
### 背景
260819-02（fx-data-agents）实战暴露续跑语义模糊：任务完成后新输入，resume 还是重启无规则。现状：devflow Step 1「有 current Handoff 且无新证据 → resume Step 4」、Step 5「New outcomes create new Logs」但无「完成后新输入」的明确规则；grilling.md Header 有 status 终态字段但无消费方。
### 问题
完成后新输入：同一 Log 新 cycle（A）还是新 Log + 回链（B）？
### 方案
A：同 Log cycle 字段 + 编号延续 + design.md 重生。B：新 Log + predecessor 回链。
### 回答
用户拍板 B：「不考虑了，直接用新的，相当于完整来一轮新的 devflow，如果之前的已经走完 build」。完成判定落 Header status 终态；active 但实际完工的走先关后开路径。形成 DEC-002。
