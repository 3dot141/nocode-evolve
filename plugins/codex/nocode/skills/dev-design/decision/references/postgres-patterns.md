> 提取自 everything-claude-code v1.2.0 postgres-patterns skill (MIT)，PostgreSQL 场景特化

# PostgreSQL 设计速查

设计涉及 PostgreSQL 的 schema、索引、查询、RLS 时的速查参考。深度审查交给 `database-reviewer` agent。

## 索引速查

| 查询模式 | 索引类型 | 示例 |
|---|---|---|
| `WHERE col = value` | B-tree（默认） | `CREATE INDEX idx ON t (col)` |
| `WHERE col > value` | B-tree | `CREATE INDEX idx ON t (col)` |
| `WHERE a = x AND b > y` | 复合索引 | `CREATE INDEX idx ON t (a, b)` |
| `WHERE jsonb @> '{}'` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| `WHERE tsv @@ query` | GIN（全文） | `CREATE INDEX idx ON t USING gin (col)` |
| 时间序列范围 | BRIN | `CREATE INDEX idx ON t USING brin (col)` |

### 复合索引列序

等值列在前，范围列在后：

```sql
CREATE INDEX idx ON orders (status, created_at);
-- 命中: WHERE status = 'pending' AND created_at > '2024-01-01'
```

### 覆盖索引（避免回表）

```sql
CREATE INDEX idx ON users (email) INCLUDE (name, created_at);
-- SELECT email, name, created_at 不用回表
```

### 部分索引（更小）

```sql
CREATE INDEX idx ON users (email) WHERE deleted_at IS NULL;
-- 索引只含未删除行，体积更小
```

## 数据类型选择

| 用途 | 正确类型 | 避免 |
|---|---|---|
| ID | `bigint` | `int`、随机 UUID |
| 字符串 | `text` | `varchar(255)` |
| 时间戳 | `timestamptz` | `timestamp` |
| 金额 | `numeric(10,2)` | `float` |
| 标志位 | `boolean` | `varchar`、`int` |

## Row Level Security (RLS)

```sql
CREATE POLICY policy ON orders
  USING ((SELECT auth.uid()) = user_id);  -- 用 SELECT 包一层，避免每行重算
```

## 常用查询模式

**UPSERT：**
```sql
INSERT INTO settings (user_id, key, value)
VALUES (123, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO UPDATE SET value = EXCLUDED.value;
```

**游标分页（O(1)，优于 OFFSET 的 O(n)）：**
```sql
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;
```

**队列消费（避免并发抢同一行）：**
```sql
UPDATE jobs SET status = 'processing'
WHERE id = (
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at LIMIT 1
  FOR UPDATE SKIP LOCKED
) RETURNING *;
```

## 反模式检测

```sql
-- 查未建索引的外键
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- 查慢查询（需 pg_stat_statements）
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- 查表膨胀
SELECT relname, n_dead_tup, last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

## 连接池与配置

```sql
-- 连接上限（按 RAM 调整）
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET work_mem = '8MB';

-- 超时
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
ALTER SYSTEM SET statement_timeout = '30s';

-- 监控
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 安全默认
REVOKE ALL ON SCHEMA public FROM public;

SELECT pg_reload_conf();
```
