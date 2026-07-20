# Example: 五轴过 diff，产出分级 findings

场景：评审一段新增的「按用户 ID 拉取订单」改动。下面演示五轴逐轴过一段真实 diff，产出带 evidence 的 findings。

---

## 被评审的 diff

```diff
+ // src/api/orders.js
+ async function getOrders(req, res) {
+   const userId = req.query.userId;
+   const orders = await db.query(
+     `SELECT * FROM orders WHERE user_id = ${userId}`
+   );
+   for (const o of orders) {
+     o.user = await db.query(`SELECT * FROM users WHERE id = ${o.userId}`);
+   }
+   res.json(orders);
+ }
```

## 五轴逐轴过

- **正确性**：`userId` 未校验空值，`undefined` 会拼进 SQL。边界未处理。
- **可读性**：命名 OK，结构清晰，无 finding。
- **架构**：直接在 handler 里拼 SQL，数据访问没下沉到 repository 层——与现有 `src/repos/` pattern 不一致。
- **安全**：`${userId}` 字符串拼接 = SQL 注入。Critical。
- **性能**：循环里逐条查 user = N+1。

## Findings 报告

### ❌ Critical
- **C1** [安全] `src/api/orders.js:5`：`WHERE user_id = ${userId}` 字符串拼接 SQL，存在注入（`userId=1 OR 1=1` 可拉全表）。
  **fix（Structural Remedy）**：改参数化查询 `db.query('SELECT * FROM orders WHERE user_id = ?', [userId])`；同时把查询下沉到 `src/repos/orderRepo.js`，handler 只调 `orderRepo.findByUser(userId)`，从结构上杜绝 handler 拼 SQL。

### ⚠️ Warning
- **W1** [性能] `src/api/orders.js:8`：循环内逐条查 user = N+1，100 单触发 100 次查询。
  **fix**：一次 `JOIN` 或批量 `WHERE id IN (...)` 取回所有 user 再在内存关联。

### 💡 Suggestion
- **S1** [正确性] `src/api/orders.js:3`：`userId` 缺空值校验，建议入口处 `if (!userId) return res.status(400)`。

## 呈现顺序

C1（安全）放最前——correctness + security 优先。一个注入漏洞比三个 nit 重要：**这个 C1 就是这次 review 的核心**。用户逐条拍板：C1 必修（不可 override），W1/S1 用户决定。

修了 C1 改了代码 → 回 Build → Verify → 再 Review。
