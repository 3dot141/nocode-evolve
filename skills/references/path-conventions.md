# 路径与 ID 约定

共享 reference，PRD / Define / Design / Plan / Review / Verify 按需 Read。

## ID 体系

| 类型 | 格式 | 例子 | 分配者 |
|---|---|---|---|
| 用户故事 | `US-{N}` | US-1, US-2 | PRD |
| 业务领域 | 中文名 | 订单、支付、物流 | PRD（按需定义，非固定枚举） |
| 领域内路径 | `{领域}.P{N}` | 订单.P1, 支付.P3 | PRD（领域内递增） |
| 跨领域路径 | `跨域.{N}` | 跨域.1 | PRD（全局递增） |
| 系统路径 | `系统.{N}` | 系统.1 | PRD（全局递增） |
| 约束 | `约束.{N}` | 约束.1 | PRD（全局递增） |
| 验收标准 | `SC-{N}` | SC-1 | **Define 独占**，PRD 不分配 |
| 测试目标 | `TO-{N}` | TO-1 | Design |
| 实施设计项 | `{TYPE}-{N}` | LOG-1 / SEC-1 / MIG-1 | Design Registry |

**铁律**：ID 一经分配不可复用、不可重排。删除的 ID 留空，不回收。改措辞不改 ID。

## 路径格式

### 使用路径（outcome 级别，不锁交互）

```
- {领域}.P{N}: {一句话描述} [{角色}] [CONFIRMED/ASSUMED/TBD]
  来源: US-{X}
  {触发/前置} → {关键步骤} → {结果}
  | 异常: {异常场景}
  | 边界: {在哪结束、和哪个领域交界}
```

- 角色：单角色写 `[买家]`；多角色差异写 `[买家: 自助 | 客服: 代操作]`
- `来源: US-{X}` 标注由哪条用户故事展开（可多条），下游可反查 US 覆盖

### 跨领域路径（串联已有领域路径）

```
- 跨域.{N}: {一句话描述} [{角色}] [CONFIRMED/ASSUMED/TBD]
  {领域}.P{X} → {领域}.P{Y} → {领域}.P{Z}
  | 异常: 任一环节失败的回退链
```

### 系统路径（无用户入口）

```
- 系统.{N}: {一句话描述} [CONFIRMED/ASSUMED/TBD]
  {触发条件} → {处理步骤} → {结果}
  | 异常: {异常场景}
```

### 约束（跨路径不变量）

```
- 约束.{N}: {业务规则描述} [CONFIRMED/ASSUMED/TBD]
```

## 标注状态

路径和约束统一使用三态标注：

- `[CONFIRMED]` — 用户已确认
- `[ASSUMED]` — AI 推断，需用户核验
- `[TBD]` — 用户还没决定

## 下游消费协议

| 阶段 | 消费什么 | 产出什么 | 关键 Gate |
|---|---|---|---|
| PRD | — | 路径 + 领域 + 约束（含 ID + 状态 + US 来源） | 合批确认 |
| vis | PRD 使用路径 | 交互级路径（保留 ID）+ 页面状态覆盖 | 路径覆盖核对 |
| Define | PRD 路径 + 领域 | SC(独占分配) + 路径↔SC 绑定 | 每条路径绑 SC |
| Design | restate 路径 + SC | TO 表 + verify 策略 + Implementation Item Registry（落盘设计文档） | Registry ↔ 来源章节双向无 orphan |
| Plan | TO + 路径 + approved Registry | task（必填 `covers` + `designCovers`） | 每条路径被 task 覆盖；每个 required Design ID 被 task 覆盖 |
| Build | task + covers + designCovers | 代码 + 测试 + completed designCovers | required Design ID 全部由完成 task 报告 |
| Review | PRD 路径 + TO + diff | 路径覆盖报告 | Spec 轴路径级检查 |
| Verify | verify 策略 + PRD 路径 + Design Registry | 证据 + 反向审计报告 + Design → Evidence Matrix | 逐层验证 + PRD 回扫 + required/verify-only 逐项证据 |

设计项 ID、四态、三张表和分阶段 Gate 的单源见 `{NOCODE_SKILL_REF}/design-traceability.md`。
