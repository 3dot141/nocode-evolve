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
```

## 依赖图

```
T1 (csv 序列化工具)  ──┐
                       ├─→ T3 (export 端点) ─→ T4 (前端导出按钮)
T2 (query 去分页参数) ─┘
```

## Tasks

### T1 — CSV 序列化工具 [AFK] [S, 1 文件]

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

```tsx
// admin/orders/list.tsx:40 — 筛选栏加按钮
<Button onClick={() => download(`/api/orders/export?${currentFilterQuery()}`)}>导出</Button>
```
**验证**：手动点击，下载文件用 Excel 打开无乱码

## Checkpoint

T1+T2 完成后插 checkpoint：两个工具单测通过 + build 通过 → 再做 T3/T4（rollback 边界）。

## Step 6: Plan Validation

- **6a 需求覆盖**：跨页导出→T2+T3 ✅；BOM 不乱码→T1 ✅；权限复用→T3 ✅。三条 SC 全覆盖。
- **6b 任务可验证**：T1-T4 各有验证命令 ✅。
- **6c 依赖无环**：T1/T2 → T3 → T4，无环，底层先 ✅。

三项全过 → 进 Step 7 用户确认。

---

**这个示例的关键点**：每个 task 贴真实代码不是伪代码；sizing 全 ≤M；HITL（权限）vs AFK（工具）分清；每 task 有可跑的验证命令；Plan Validation 三项逐条核对到具体 task。
