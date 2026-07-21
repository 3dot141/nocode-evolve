> 提取自 everything-claude-code v1.2.0 clickhouse-io skill (MIT)，ClickHouse 场景特化

# ClickHouse 设计速查

ClickHouse 是列式 OLAP 数据库，为大数据集上的快速分析查询优化。设计分析型表、查询、物化视图时参考本文。

## 表设计

### MergeTree（最常用）

```sql
CREATE TABLE analytics (
    date Date,
    entity_id String,
    volume UInt64,
    trades UInt32,
    created_at DateTime
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, entity_id)
SETTINGS index_granularity = 8192;
```

### ReplacingMergeTree（去重）

数据可能有重复（多源写入）时用：

```sql
CREATE TABLE events (
    event_id String,
    user_id String,
    event_type String,
    timestamp DateTime
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, event_id, timestamp)
PRIMARY KEY (user_id, event_id);
```

### AggregatingMergeTree（预聚合）

维护聚合指标，写入用 `*State()`，查询用 `*Merge()`：

```sql
CREATE TABLE stats_hourly (
    hour DateTime,
    entity_id String,
    total_volume AggregateFunction(sum, UInt64),
    unique_users AggregateFunction(uniq, String)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, entity_id);

SELECT hour, entity_id,
    sumMerge(total_volume) AS volume,
    uniqMerge(unique_users) AS users
FROM stats_hourly
GROUP BY hour, entity_id;
```

## 查询优化

**过滤先走索引列：**
```sql
-- ✅ 先用 ORDER BY 里的列过滤
WHERE date >= '2025-01-01' AND entity_id = 'x' AND volume > 1000

-- ❌ 先过滤非索引列
WHERE volume > 1000 AND name LIKE '%foo%' AND date >= '2025-01-01'
```

**用 ClickHouse 原生聚合函数：**
```sql
SELECT toStartOfDay(created_at) AS day,
    sum(volume) AS total,
    uniq(user_id) AS uniques,           -- 比 count(DISTINCT) 高效
    quantile(0.95)(size) AS p95          -- 比 percentile 高效
FROM trades
WHERE created_at >= today() - INTERVAL 7 DAY
GROUP BY day;
```

## 物化视图（实时聚合）

写入 trades 自动维护 stats_hourly：

```sql
CREATE MATERIALIZED VIEW stats_hourly_mv
TO stats_hourly
AS SELECT
    toStartOfHour(timestamp) AS hour,
    entity_id,
    sumState(amount) AS total_volume,
    uniqState(user_id) AS unique_users
FROM trades
GROUP BY hour, entity_id;
```

## 性能监控

```sql
-- 慢查询
SELECT query_id, query, query_duration_ms, read_rows, memory_usage
FROM system.query_log
WHERE type = 'QueryFinish' AND query_duration_ms > 1000
  AND event_time >= now() - INTERVAL 1 HOUR
ORDER BY query_duration_ms DESC LIMIT 10;

-- 表大小
SELECT database, table,
    formatReadableSize(sum(bytes)) AS size, sum(rows) AS rows
FROM system.parts WHERE active
GROUP BY database, table ORDER BY sum(bytes) DESC;
```

## 设计原则

**分区**：按时间分（月或日）；别太多分区（影响性能）；分区键用 DATE。

**排序键（ORDER BY）**：最常过滤的列在前；考虑基数（高基数在前）；顺序影响压缩率。

**数据类型**：用最小够用的类型（UInt32 优于 UInt64）；重复字符串用 `LowCardinality`；分类值用 `Enum`。

**避免**：`SELECT *`（指定列）；`FINAL`（查询前先 merge）；过多 JOIN（分析场景反范式化）；小批量频繁写（批量写入）。

**写入**：批量插入而非循环单条插入——单条插入在 ClickHouse 里极慢。
