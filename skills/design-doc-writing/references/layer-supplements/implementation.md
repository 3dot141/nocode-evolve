# 开发层关注点

任务粒度在「具体功能/具体改动」时——你在改某几个函数、加某个 API、动某张表——文档应**额外**关注以下章节。

## 接口签名

新增/变更的接口（UI / API / CLI / 配置）的**具体形状**。给代码或 JSON，不要描述。

```ts
// 例：
POST /api/v1/orders/{id}/cancel
Request: { reason?: string }
Response 200: { id, cancelled_at, refund_id?: string }
Response 409: { error: "order_not_cancellable", state: "shipped" }
```

## 数据模型变更

新表、新字段、迁移脚本、索引。如确实无变更，明确写「无变更」——**不要省略此节**，省略 = 没考虑过。

## 错误处理

失败模式表。

| 场景 | 用户看到 | 系统行为 |
|---|---|---|

只列**真实可能发生**的失败，不列假想。

---

写开发层文档时，**减少**对系统级架构的描述——假设上游已有架构 ADR 或 system design 定了大方向。开发文档要让 reviewer 能精准 review 你这次改动的具体代码。
