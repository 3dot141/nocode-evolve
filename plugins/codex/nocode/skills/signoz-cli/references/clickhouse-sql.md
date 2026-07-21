# ClickHouse SQL Reference for SigNoz

This section documents SigNoz-specific ClickHouse SQL conventions that differ from standard SQL. **You must follow these conventions when using `--sql`.**

## Tables and Timestamp Formats

Each signal type uses different tables and timestamp formats:

| Signal | Database.Table | Timestamp Column | Format | Filter Example |
|--------|---------------|-----------------|--------|----------------|
| **Logs** | `signoz_logs.distributed_logs_v2` | `timestamp` | UInt64 **nanoseconds** | `timestamp >= 1711234567000000000` |
| **Traces** | `signoz_traces.distributed_signoz_index_v3` | `timestamp` | DateTime64(9), **must quote** | `timestamp >= '1711234567000000000'` |
| **Metrics** | `signoz_metrics.distributed_samples_v4` | `unix_milli` | Int64 **milliseconds** | `unix_milli >= 1711234567000` |

> Always use `distributed_*` tables (not local tables like `logs_v2` or `signoz_index_v3`).

## Required: `ts_bucket_start` Filter (Logs & Traces)

Logs and Traces tables have `ts_bucket_start` (UInt64, epoch **seconds**) in their primary key. **Always include it** for query performance — without it, queries may be extremely slow or time out.

```sql
WHERE timestamp >= {startNano} AND timestamp <= {endNano}
  AND ts_bucket_start >= {startSeconds - 1800} AND ts_bucket_start <= {endSeconds}
```

The `-1800` (30 min) buffer on `ts_bucket_start` ensures edge-case rows aren't missed.

## Result Column Naming Convention

SigNoz expects specific column names in ClickHouse SQL results:

| Column | Requirement |
|--------|-------------|
| Time | Must be named **`ts`**, type DateTime/DateTime64 |
| Value | Named `value`, `__result`, `__value`, `result`, or `res` (auto-detected if only one numeric column) |
| Labels | All String columns become series labels (used for groupBy) |

## Complete Query Templates

### Logs — Count by severity (last 1 hour)

```bash
signoz query --since 1h --sql "
  SELECT toStartOfInterval(fromUnixTimestamp64Nano(timestamp, 'Asia/Shanghai'), INTERVAL 1 MINUTE) AS ts,
         severity_text,
         count(*) AS value
  FROM signoz_logs.distributed_logs_v2
  WHERE timestamp >= {{start_ns}} AND timestamp <= {{end_ns}}
    AND ts_bucket_start >= {{start_s}} - 1800 AND ts_bucket_start <= {{end_s}}
  GROUP BY ts, severity_text
  ORDER BY ts
"
```

Key log columns: `severity_text` (INFO/ERROR/...), `severity_number`, `body` (message), `trace_id`, `span_id`, `scope_name`.

### Traces — P99 latency by service (last 1 hour)

```bash
signoz query --since 1h --sql "
  SELECT toStartOfInterval(toTimeZone(timestamp, 'Asia/Shanghai'), INTERVAL 1 MINUTE) AS ts,
         resource_string_service\$\$name AS service,
         quantile(0.99)(duration_nano) / 1e6 AS value
  FROM signoz_traces.distributed_signoz_index_v3
  WHERE timestamp >= '{{start_ns}}' AND timestamp <= '{{end_ns}}'
    AND ts_bucket_start >= {{start_s}} - 1800 AND ts_bucket_start <= {{end_s}}
  GROUP BY ts, service
  ORDER BY ts
"
```

Key trace columns: `name` (span name), `kind_string`, `duration_nano` (Float64, nanoseconds), `status_code` (0=unset, 1=ok, 2=error), `has_error` (Bool), `resource_string_service$$name` (service name — note `$$` encodes `.`).

### Metrics — Average metric value (last 1 hour)

```bash
signoz query --since 1h --sql "
  SELECT toStartOfInterval(toDateTime(intDiv(unix_milli, 1000), 'Asia/Shanghai'), INTERVAL 1 MINUTE) AS ts,
         avg(value) AS value
  FROM signoz_metrics.distributed_samples_v4
  WHERE metric_name = 'http_requests_total'
    AND unix_milli >= {{start_ms}} AND unix_milli < {{end_ms}}
  GROUP BY ts
  ORDER BY ts
"
```

## Attribute Access (Map Columns)

Non-materialized attributes are stored in Map columns, not regular columns:

```sql
-- String attributes
attributes_string['http.method']
resources_string['service.name']
scope_string['otel.library.name']

-- Numeric / Boolean attributes
attributes_number['http.status_code']
attributes_bool['error']

-- Check existence
mapContains(attributes_string, 'http.method')
```

> **`$$` encoding**: Materialized columns encode `.` as `$$`. For example, `service.name` → `resource_string_service$$name`. Use materialized columns when available for better performance.

## Additional Tables

| Database | Table | Purpose |
|----------|-------|---------|
| `signoz_logs` | `distributed_logs_v2_resource` | Log resource attributes (join via `resource_fingerprint`) |
| `signoz_traces` | `distributed_traces_v3_resource` | Trace resource attributes |
| `signoz_traces` | `distributed_top_level_operations` | Top-level operation lookup |
| `signoz_metrics` | `distributed_metadata` | Metric metadata (name, temporality, type, unit) |
| `signoz_metrics` | `distributed_time_series_v4` | Metric time series metadata (fingerprints, labels) |
| `signoz_metrics` | `distributed_samples_v4_agg_5m` | 5-minute pre-aggregated metrics |
| `signoz_metrics` | `distributed_samples_v4_agg_30m` | 30-minute pre-aggregated metrics |

Use `GLOBAL IN` (not `IN`) when joining with resource tables in distributed queries.
