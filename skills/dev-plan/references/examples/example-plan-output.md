# Example: 完整 Plan 输出

演示一份合格的实现计划——header + 依赖图 + task（贴真实代码 + sizing + HITL/AFK + 验证命令）+ checkpoint + Step 6 Plan Validation。基于"订单列表 CSV 导出"需求。

## Plan Document Header

```markdown
# 订单导出 Implementation Plan

**Goal**: 运营在订单列表页导出当前筛选结果为 CSV
**Architecture**: 新增 GET /api/orders/export 复用现有 query 逻辑，流式写 CSV
**Tech Stack**: Express + 现有 orders/query.ts + csv-stringify
**Design Doc**: N/A (Standard 场景)
**Test Objectives**: 跨页导出全量 / UTF-8 BOM 不乱码 / 权限复用列表页
**Execution**: subagent-lite
**Design Coverage**: N/A (Standard)
```

## 依赖图

```
T1 (csv 序列化工具)  ──┐
                       ├─→ T3 (export 端点) ─→ T4 (前端导出按钮)
T2 (query 去分页参数) ─┘
```

## Tasks

### T1 — CSV 序列化工具 [AFK] [S, 1 文件]

**designCovers**: N/A (Standard)

```ts
// src/util/csv.ts
export function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  const bom = '﻿';                          // Excel 不乱码
  const header = cols.join(',');
  const body = rows.map(r => cols.map(c => escapeCell(r[c])).join(',')).join('\n');
  return bom + header + '\n' + body;
}
```
**验证**：`npm test -- csv.test.ts` → 期望含逗号/引号的字段被正确转义

### T2 — query 支持取消分页 [AFK] [S, 1 文件]

**designCovers**: N/A (Standard)

```ts
// api/orders/query.ts:88 — 加一个 unbounded 选项
function buildQuery(filter: Filter, opts?: { unbounded?: boolean }) {
  const q = baseQuery(filter);
  if (!opts?.unbounded) q.limit(100).offset(filter.page * 100);
  return q;
}
```
**验证**：`npm test -- query.test.ts` → unbounded 时不带 LIMIT

### T3 — export 端点 [HITL, 权限确认] [M, 2 文件]

**designCovers**: N/A (Standard)

**领域指南消费**：碰权限校验 → 读 `{NOCODE_SKILL_REF}/security-guide.md` 的 Broken Access Control 段，确认中间件复用而非重开一套校验逻辑

```ts
// api/orders/export.ts
router.get('/export', requireOrderRead, async (req, res) => {  // 复用列表页权限中间件
  const rows = await buildQuery(parseFilter(req.query), { unbounded: true });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=orders-${stamp()}.csv`);
  res.send(toCsv(rows, ORDER_EXPORT_COLS));
});
```
**HITL 原因**：权限中间件选择需确认（`requireOrderRead` 是否覆盖导出场景）
**验证**：`curl -s '/api/orders/export?status=paid' | head -1` → 期望 BOM + 表头

### T4 — 前端导出按钮 [AFK] [S, 1 文件]

**designCovers**: N/A (Standard)

```tsx
// admin/orders/list.tsx:40 — 筛选栏加按钮
<Button onClick={() => download(`/api/orders/export?${currentFilterQuery()}`)}>导出</Button>
```
**验证**：手动点击，下载文件用 Excel 打开无乱码

## Checkpoint

T1+T2 完成后插 checkpoint：两个工具单测通过 + build 通过 → 再做 T3/T4（rollback 边界）。

## Step 6: Round 1 骨架自查

主会话按骨架自查清单逐条过（不调 red-blue-deep、不派 subagent/Codex）。

**自查问题**：「这份计划的骨架合理吗？切片策略、依赖图、risk-first 排序、task 粒度、restate 覆盖？」

**自查结论**（示例摘要）：

> **骨架基本合理** —— 垂直切片 T1→T4 各自可独立验证，依赖方向清晰；但发现两个真问题：
> 1. T1 `escapeCell` 对 null/Date 类型没有测试覆盖，T3 集成时才暴露 → 骨架补一条 T1 测试路径
> 2. T3 `unbounded: true` 全量查询无内存/超时限制，是隐藏风险点 → T3 标为 risk，备注流式写入/分批查询备选
>
> 错误处理（T4 导出失败反馈）属 Standard 场景 MVP follow-up，不纳入当前骨架。

**结论落地**：质疑 1、2 已修正到骨架。

## Step 8: Round 2 自查 + Plan Validation

#### 8a. Checklist 核查 + 跨 task 一致性自查

主会话就地核查完整计划（用户显式要求「红蓝军 / 深审」时才调 `平台原生 Skill 调用`）。

**自查问题**：「这份填充了真实代码的计划拿去执行可行吗？代码/测试/设计一致性/执行顺序？」

**自查结论**（示例摘要）：

> **计划可行** —— API 签名、import 路径、测试命令均核对通过；但发现一个真问题：
> T1 `escapeCell` 实现没处理 `undefined`——`r[c]` 不存在时 `.toString()` 会报错
> → 修正为 `(r[c] ?? '').toString()`
>
> 另两条候选质疑（parseFilter 额外参数 / buildQuery 签名变更影响）核对后不成立：parseFilter 用白名单 pick，opts 可选参数不影响现有 caller。

**结论落地**：质疑 1 已修正到 T1 代码。

#### 8b-8e. Plan Validation

**8b 需求覆盖**：跨页导出→T2+T3 ✅；BOM 不乱码→T1 ✅；权限复用→T3 ✅。三条 SC 全覆盖。
**8c 路径覆盖**：路径→task 映射表已产出，无漏路径 ✅。
**8d Design → Task Coverage Matrix**：Standard 场景无 Design Registry；显式 `N/A (Standard)` ✅。
**8e 任务可验证**：T1-T4 各有验证命令 ✅。
**8f 依赖无环**：T1/T2 → T3 → T4，无环，底层先 ✅。

全过 → 进 Step 9 用户确认。

---

**这个示例的关键点**：每个 task 贴真实代码不是伪代码；sizing 全 ≤M；HITL（权限）vs AFK（工具）分清；每 task 有可跑的验证命令；两轮自查审视计划决策质量（每条给判断 + 依据，成立的质疑落实到骨架/代码修正；用户显式要求才升 red-blue-deep）；Plan Validation 四项逐条核对到具体 task。
