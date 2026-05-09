# 决策 / 选型（取代经典 ADR）

在多个方案里做选择时，文档主线节——经典 ADR 4 段式（Michael Nygard）：

## Context

我们面对什么问题？为什么这个决策**现在**必须做？

> 写「力的对抗」——一边是 X 约束（业务/技术），另一边是 Y 约束（资源/时间），不决定的代价是什么。

## Decision

我们决定做什么？**主动语态、现在时态**——「我们将使用 PostgreSQL」，不是「考虑使用 PostgreSQL」。

## Consequences

之后会怎样？正面 + 负面 + 中性都要写。

- **正面**：xxx
- **负面**：xxx（最容易回避，**必写**——decisions have trade-offs）
- **中性**：xxx

## Alternatives Considered

至少列 2 个其他方案 + 否决理由。每个：方案 → 优点 → 否决理由。

- **方案 B**：xxx。优点：yyy。否决因为 zzz。
- **方案 C**：xxx。优点：yyy。否决因为 zzz。

---

frontmatter 提示：

- `type` 写成 `architecture-decision` 或 `implementation-decision`
- 可加 `adr_id: ADR-NNN` 字段（在 `docs/plans/{username}/` 目录下递增取最大编号 +1）
- `status`: `proposed` | `accepted` | `superseded by ADR-XXX` | `deprecated`

注意：决策文档已把「Alternatives Considered」放主线，**不要**再去 `common.md` 重复挑「备选方案」节。
