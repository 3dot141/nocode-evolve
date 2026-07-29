# Design Traceability Protocol

Design、Plan、Build、Verify 共享的设计项追踪协议。它只定义跨阶段契约，不保存任何项目的设计事实；项目事实始终只存在于该项目唯一的 approved Design 文档。

## 1. 规范性设计项

会影响代码、配置或验证结果，而且能独立实施、验证、延期或判定不适用的内容，必须进入 Implementation Item Registry。典型类型：

| 类型 | ID 示例 | 适用内容 |
|---|---|---|
| Decision | `Q1` | 已确认且影响实现的方案决策 |
| Business Flow | `BF1` | 主路径或可独立验证的业务流 |
| API / Contract | `API-1` / `CONTRACT-1` | 外部接口或跨阶段契约 |
| Data | `DATA-1` | schema、持久化与数据约束 |
| Log | `LOG-1` | 可独立实施或验证的日志事件/规则 |
| Metric / Alert | `METRIC-1` / `ALERT-1` | 指标与告警 |
| Security / Performance | `SEC-1` / `PERF-1` | 横切约束 |
| Migration | `MIG-1` | 兼容、迁移与回滚 |
| Eval / Test Objective | `EVAL-1` / `TO-1` | AI 评估和测试目标 |
| Gate | `GATE-1` | 阶段阻断条件 |

ID 使用“语义前缀 + 连续整数”。已有 Q、BF、TO 等 ID 原样复用；ID 分配后不可复用或因排序变化而重排。类型不是封闭枚举，但新增前缀必须说明现有类型为什么不能表达。

背景、解释、被否决方案和非规范性示例不进入 Registry。

## 2. 四态 stage closure

每个 Registry 项必须且只能使用一种状态：

| 状态 | 含义 | 必填补充 |
|---|---|---|
| `required` | 本迭代必须实施 | Design 写实现意图；Plan 时至少一个下游 task |
| `verify-only` | 不要求改代码，但必须验证 | 明确验证方法 |
| `deferred` | 已确认延期 | 原因 + 用户确认 |
| `n/a` | 对本场景不适用 | 判定依据 |

空状态、未知状态、`verify-only` 无方法、`deferred` 无确认或 `n/a` 无依据，均为 Design Gate 失败；进入 Plan 后，`required` 无 task 也成为 Gate 失败。`deferred` 和 `n/a` 不是“默认不做”的出口。

## 3. 三张标准表

### 3.1 Implementation Item Registry

由 Design writing 写回唯一 `docPath`：

```markdown
## 实施设计项清单

| ID | 类型 | 设计项 | 来源章节 | 影响范围 | 状态 | 验证/理由 |
|---|---|---|---|---|---|---|
| LOG-1 | Log | task.created 结构化日志 | 基础日志设计 | coordinator | required | 集成测试检查事件与字段 |
```

完整性必须双向成立：

1. 每个规范性来源章节都能正向找到至少一个 Registry ID。
2. 每个 Registry ID 都能反向找到真实来源章节。
3. 规范性内容不能只存在于未声明附件或第二份补充设计文档。

### 3.2 Design → Task Coverage Matrix

Plan task 保留两个不同字段：

```markdown
**covers**
- 订单.P1

**designCovers**
- BF1
- LOG-1
```

- `covers`：Define 路径和约束。
- `designCovers`：Design Registry 中由该 task 承接的 `required` ID。
- Standard 无 Design 时写 `designCovers: N/A (Standard)`。

Plan 必须以 Registry 为左表反向遍历，而不是只汇总 task 已声明的 ID：

```markdown
| Design ID | Task / Verify | 处理方式 | 理由 |
|---|---|---|---|
| LOG-1 | Task 3 | implement | 跟随 coordinator 实现 |
| ALERT-1 | Verify | verify-only | 人工检查告警配置 |
| MIG-2 | — | deferred | 用户确认下一迭代处理 |
```

判定顺序：

1. Design frontmatter `status` 必须是 `approved`。
2. Full Design 必须有 Registry；旧文档没有 Registry 时回 Design 回填，不静默降级。
3. task 的 `designCovers` 不得引用未知 ID。
4. 每个 `required` ID 至少被一个 task 覆盖，否则是 orphan，阻断 Plan。
5. 其余三态必须满足各自必填补充。

### 3.3 Design → Evidence Matrix

Verify 以 Design ID 为左表记录新鲜证据：

```markdown
| Design ID | 结果 | 证据类型 | 证据 |
|---|---|---|---|
| LOG-1 | ✅ | test | 日志事件与脱敏字段测试 |
| SEC-1 | ✅ | inspection | diff 中无敏感 payload 字段 |
```

`required` 和 `verify-only` 都必须有本轮 test、inspection、demo 或 manual evidence。`deferred`、`n/a` 原样带入并显示理由，不能伪装成通过。任一必验 ID 失败或缺证据，Verify 回 Build。

## 4. 分阶段 Gate

### Design

- Decision 把已确认决策、领域覆盖和测试目标标为 Registry 输入。
- Writing 汇总 Registry，检查 Registry ↔ 来源章节双向无 orphan。
- review verdict 通过后，同步把同一 `docPath` 的 frontmatter 设为 `approved`。
- verdict、frontmatter、单一文档完整性或 Registry 任一不成立，Design 不得交接。

### Plan

- Full 场景只消费 approved Design。
- 从 Registry 反向构造 Design → Task Coverage Matrix。
- `required` orphan、未知 ID 或四态必填项缺失都阻断确认。
- Standard 场景显式记录 `designCovers: N/A (Standard)`。

### Build

- task scope 和 `designCovers` 在执行中保持锁定，实施方不得自行改覆盖范围。
- 每个 task 结果显式报告完成的 `designCovers`、改动文件和测试证据。
- 编排者汇总所有完成 task；Plan 中存在但没有任何完成结果报告的 `required` ID，Build Gate 失败。

### Verify

- 同时读取 Registry、Coverage Matrix 和 Build result。
- 对每个 `required` / `verify-only` ID 运行或采集新鲜证据。
- 输出 Design → Evidence Matrix；缺证据或失败项回 Build。
- Design evidence 是新增维度，不替代 Define SC、路径与约束验收。

## 5. 回退目标

| 失败 | 回退 |
|---|---|
| 规范内容在补充文档、状态不明、Registry 无来源 | Design |
| Design 未 approved、required orphan、task 引用未知 ID | Plan；必要时回 Design |
| task 完成结果漏报或冒领 `designCovers` | Build 当前 task |
| required / verify-only 缺新鲜证据 | Build |

所有失败信息必须点名对应 Design ID；禁止只返回“覆盖不完整”。
