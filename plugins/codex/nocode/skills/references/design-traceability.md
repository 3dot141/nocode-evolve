# Design Traceability Protocol

Design、Plan、Build、Verify 共享的设计基线与设计项追踪协议。本文件只定义契约；项目事实始终只存在于唯一 approved Design 文档。

## 1. 不可变设计基线

Approved Design frontmatter 必须包含：

```yaml
status: approved
designRevision: 3
designDigest: sha256:<canonical-markdown-digest>
packetRevision: 2
```

- `designRevision`：规范性设计内容的单调递增修订号，从 1 开始。
- `designDigest`：当前规范性 Markdown 的 canonical SHA-256。canonicalization 至少统一换行，并排除 frontmatter 中的 `status` / digest 值、Review Log、render receipt 指针、时间戳等非规范性元数据；这样 `in-review → approved` 的生命周期切换不会在 verdict 生成后反向改变 digest。
- `packetRevision`：来源 Decision Packet 修订号，用于审计，不替代设计 revision。

任何 Plan / Build / Verify 产物都必须保存同一对基线字段：

```yaml
designRevision: 3
designDigest: sha256:...
```

开始阶段与交接阶段都重新读取 Design 核对。**规范性内容变更会递增 `designRevision` 并重算 `designDigest`，所有绑定旧基线的下游 Plan、Build 结果和 Verify evidence 立即失效**；必须从 Plan 重新生成覆盖关系，不能用“改动很小”继续执行旧计划。

## 2. 规范性设计项与稳定锚点

会影响代码、配置或验证结果，且能独立实施、验证、延期或判定不适用的内容，必须进入 Implementation Item Registry。典型 ID：

| 类型 | 示例 |
|---|---|
| Decision / Flow | `Q1` / `BF1` |
| API / Contract / Data | `API-1` / `CONTRACT-1` / `DATA-1` |
| Observability | `LOG-1` / `METRIC-1` / `ALERT-1` |
| Cross-cutting | `SEC-1` / `PERF-1` / `IDEM-1` |
| Migration / Eval / Test | `MIG-1` / `EVAL-1` / `TO-1` |
| Gate | `GATE-1` |

ID 一旦分配不可因排序重排或复用。每个规范性来源在正文有稳定 `sourceAnchor`：

```html
<!-- design-item: LOG-1 -->
```

标题可以润色，`sourceAnchor` 不随标题变更。背景、解释、被否决方案和非规范性示例不进入 Registry。

## 3. 四态 closure

每项必须且只能使用一种状态：

| 状态 | 含义 | 必填 |
|---|---|---|
| `required` | 本迭代必须实施 | 实现意图；Plan 中至少一个 task |
| `verify-only` | 不改代码但必须验证 | 验证方法 |
| `deferred` | 已确认延期 | 理由、确认人 / checkpoint、目标阶段 |
| `n/a` | 不适用 | 可复核判据 |

空状态、未知状态或缺必填补充均阻断阶段。`deferred` / `n/a` 不是默认逃生口。

## 4. 三张标准表

### 4.1 Implementation Item Registry

由 Design Writing 写回唯一 `docPath`：

```markdown
## 实施设计项清单

| ID | 类型 | 设计项 | sourceAnchor | 影响范围 | 状态 | 验证/理由 |
|---|---|---|---|---|---|---|
| LOG-1 | Log | task.created 结构化日志 | design-item: LOG-1 | coordinator | required | 集成测试检查事件与字段 |
```

完整性双向成立：

1. 每个规范性来源 `sourceAnchor` 都有且只有一个 Registry ID。
2. 每个 Registry ID 都能找到真实且匹配的 `sourceAnchor`。
3. 规范性内容不能只存在于未声明附件或第二份设计文档。

### 4.2 Design → Task Coverage Matrix

Plan header 先绑定基线：

```yaml
designRevision: 3
designDigest: sha256:...
```

每个 task 保留：

```markdown
**covers**
- 订单.P1

**designCovers**
- BF1
- LOG-1
```

- `covers`：Define 路径和约束。
- `designCovers`：当前 Design Registry 的 `required` ID。
- Standard 无 Design 时写 `designRevision: N/A (Standard)`、`designDigest: N/A (Standard)` 与 `designCovers: N/A (Standard)`。

Plan 必须以 Registry 为左表反向遍历：

| Design ID | Task / Verify | 处理方式 | 理由 |
|---|---|---|---|
| LOG-1 | Task 3 | implement | 跟随 coordinator 实现 |
| ALERT-1 | Verify | verify-only | 检查告警配置 |
| MIG-2 | — | deferred | 已记录用户确认 |

未知 ID、`required` orphan 或基线不匹配都阻断 Plan。

### 4.3 Design → Evidence Matrix

Verify header 同样绑定基线：

```yaml
designRevision: 3
designDigest: sha256:...
```

以 Registry 为左表记录本轮新鲜证据：

| Design ID | 结果 | 证据类型 | 证据 |
|---|---|---|---|
| LOG-1 | ✅ | test | 日志事件与脱敏字段测试 |
| SEC-1 | ✅ | inspection | diff 无敏感 payload |

`required` 和 `verify-only` 都必须有 test、inspection、demo 或 manual evidence。`deferred` / `n/a` 原样显示理由，不能伪装为通过。

## 5. 分阶段 Gate

### Design

- Decision 把已确认决策、领域覆盖、横切 placement 和 TO 标为 Registry 输入。
- Writing 写 `sourceAnchor` 与 Registry，双向检查无 orphan。
- `DesignReviewVerdict.reviewedRevision / reviewedDigest` 必须匹配当前基线。
- approved、verdict、Registry 或唯一文档任一不成立，不得交接。

### Plan

- Full 只消费 approved Design，并将 `designRevision / designDigest` 写入计划 header。
- 生成 Coverage Matrix 后再次核对 digest，防计划期间基线漂移。
- 旧基线、unknown ID、required orphan 阻断确认。

### Build

- 启动和每个 checkpoint 都核对计划、Design 的 `designRevision / designDigest` 完全一致。
- task scope 与 `designCovers` 锁定；实施方不能自行扩大覆盖。
- 每个结果报告 `completedDesignCovers / changedFiles / evidence / designRevision / designDigest`。
- 任一基线漂移立即停止并回 Plan。

### Verify

- 同时读取当前 Design、Coverage Matrix 和 Build result，四处基线必须一致。
- 对 `required` / `verify-only` 采集当前代码状态的新鲜证据。
- 输出绑定当前 `designRevision / designDigest` 的 Evidence Matrix。
- 缺证据或失败回 Build；基线漂移回 Plan。

## 6. 回退目标

| 失败 | 回退 |
|---|---|
| 规范内容在第二文档、Registry / sourceAnchor orphan、verdict 过期 | Design |
| Design 未 approved、Coverage Matrix 错、基线已变化 | Plan；必要时回 Design |
| task 漏报 / 冒领 designCovers，或结果基线错误 | Build 当前 task |
| required / verify-only 缺新鲜证据 | Build |

所有失败都点名 Design ID 和期望 / 实际基线；禁止只说“覆盖不完整”。
