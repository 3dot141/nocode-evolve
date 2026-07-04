---
name: signoz-cli
version: "0.2.0"
description: Query traces, logs, and metrics from SigNoz using the signoz CLI. Use when debugging observability data, checking alert rules, listing services, or running PromQL/ClickHouse SQL queries against a SigNoz instance. Also use when the user says "查日志/看链路/看监控/排查报错/trace/查SigNoz/看服务状态".
metadata:
  short-description: SigNoz CLI for traces/logs/metrics queries
  compatibility: claude-code
  wraps-cli: "@jcit/signoz (npm)"
  upstream-skill: m1heng/just-cli-it (skills/signoz-cli, MIT)
  install: "npm i -g @jcit/signoz (requires Node.js >= 22, macOS or Linux)"
---

# signoz CLI

Query traces, logs, and metrics from [SigNoz](https://signoz.io) directly in your terminal.

## Install

```bash
npm i -g @jcit/signoz
```

## Authentication (按环境模板化变量 + 每次显式 flag)

本 skill 的约定：用户可能同时管多套 SigNoz（生产 / 测试 / staging / dev ...），凭据按环境名分组以**模板变量**形式 export：

```
SIGNOZ_<ENV>_URL    SIGNOZ_<ENV>_TOKEN
```

`<ENV>` 是大写环境名占位符——例如 `SIGNOZ_PROD_URL` / `SIGNOZ_TEST_URL` / `SIGNOZ_STAGING_URL`，用户自己决定有哪些环境。

**每次 `signoz` 调用必须显式带 `--url` 和 `--token` flag**，按目标环境从对应变量取值。不依赖 `signoz auth login` 写入 keychain，也不依赖单一 `SIGNOZ_URL`/`SIGNOZ_TOKEN`——目的是同一个 shell 里能无缝切多环境。

### Routing 规则（决定 `<ENV>` 是什么）

调用前先确定目标环境：

| 用户表达 | `<ENV>` |
|---|---|
| 明说 "prod / 生产 / production / 线上" | `PROD` |
| 明说 "test / 测试" | `TEST` |
| 明说 "staging / 预发" | `STAGING` |
| 明说其他环境名（dev / qa / ...） | 大写后取该名 |
| **没明说** | **先口头确认一次**，不要默认猜 |

### 命令模板

```bash
# 通用模式（<ENV> 替换为目标环境名，例如 PROD / TEST / STAGING）
signoz <subcmd> --url "$SIGNOZ_<ENV>_URL" --token "$SIGNOZ_<ENV>_TOKEN" [其他 flag]

# 具体例子
signoz query --url "$SIGNOZ_PROD_URL" --token "$SIGNOZ_PROD_TOKEN" --promql '...' --since 1h
```

> 用引号包变量，避免 URL/token 含特殊字符时出问题。

### 故障排查

- 命令报 401：用 `echo "${SIGNOZ_<ENV>_URL:?未设置}"` / `echo "${SIGNOZ_<ENV>_TOKEN:+已设置}"` 确认变量存在（不要 echo token 本身）
- 变量在 Bash 工具里读不到：变量需要写在**非交互 shell 也加载**的位置。zsh 用户用 `~/.zshenv`（√），不要放 `~/.zshrc`（×，非交互 shell 不读）；bash 用户视配置可能是 `~/.bash_profile` / `~/.profile` / `~/.bashrc`，确认你的 shell 加载顺序

## Timezone (默认 Asia/Shanghai)

本 skill 默认所有时间按 **Asia/Shanghai (UTC+8)** 处理. 仅影响两个边界:

- **ISO 输入**: `--since` / `--until` 给 ISO 8601 时, 默认带 `+08:00` offset, 例如 `2024-01-15T00:00:00+08:00`. 不要省略 offset 凭 CLI 猜.
- **SQL 输出展示**: ClickHouse 时间函数 (`fromUnixTimestamp64Nano` / `toDateTime` / `toStartOfInterval`) 都显式传 `'Asia/Shanghai'`, `ts` 列直接是上海时间, 让 `INTERVAL 1 DAY` 这种按上海日界对齐.

不影响:

- **Duration 相对量** (`--since 1h`): "1 小时前"是相对当前时刻, tz-independent, 不变.
- **底层存储**: DB 里 `timestamp` (UInt64 ns) / `unix_milli` (Int64 ms) 都是 Unix epoch, tz-independent, 不变.
- **`{{start_ns}}` 等注入变量**: 都是 epoch 数值, 不带 tz.

需要 UTC 输出: 把 SQL 里 `'Asia/Shanghai'` 改 `'UTC'` (或删除该参数走服务器默认).

## Commands

### query — Unified query API

Query traces, logs, and metrics. Supports three input modes (mutually exclusive):

| Flag | Description |
|------|-------------|
| `--promql <expr>` | PromQL expression |
| `--sql <query>` | ClickHouse SQL query (use `{{start_ms}}` etc. for time injection — see below) |
| `-f, --file <path>` | Load full query_range JSON body from file |

Time range, output, and auth options:

| Flag | Default | Description |
|------|---------|-------------|
| `--since <time>` | `1h` | Start time — duration ago (`1h`, `30m`, `7d`) or ISO date |
| `--until <time>` | `now` | End time — `now`, duration ago, or ISO date |
| `--step <seconds>` | `60` | Step interval in seconds (PromQL only, must be a positive number) |
| `--request-type <type>` | `time_series` | SQL/file result type: `time_series`, `scalar`, `raw`, or `trace` |
| `--format <format>` | `json` | Output: `json`, `table`, or `text` |

> **Duration = "ago"**: `--since 1h` means "1 hour ago". `--until 1d` means "1 day ago" (not "for 1 day"). So `--since 7d --until 1d` queries from 7 days ago to 1 day ago.

> **SQL time injection**: Use `{{start_ms}}`/`{{end_ms}}` (milliseconds), `{{start_ns}}`/`{{end_ns}}` (nanoseconds), or `{{start_s}}`/`{{end_s}}` (seconds) in your SQL. These are replaced with the values from `--since`/`--until` before the query is sent.

#### PromQL limitations

> **Delta-temporality metrics are not queryable via PromQL.** SigNoz's PromQL engine only supports Cumulative and Gauge metrics. Many SigNoz internal metrics (e.g. `signoz_calls_total`, `signoz_latency.*`) use Delta temporality and will return empty results. Use `--sql` for Delta metrics instead.

> **OTel dot-separated metric names** (e.g. `http.client.request.duration.bucket`) are not valid PromQL identifiers. Use the `{__name__="..."}` selector syntax instead of bare metric names.

To check a metric's temporality, use the `metrics` command (see below) or:

```bash
signoz metrics                          # List all metrics with temporality
signoz metrics | jq '.[] | select(.promql == "no")'  # Show Delta-only metrics
```

#### PromQL examples

```bash
# OTel metric with dot-separated name (Cumulative — works)
signoz query --promql '{__name__="http.client.request.duration.bucket"}' --since 1h
```

#### ClickHouse SQL examples

```bash
# Count logs from the last 24 hours — {{start_ns}}/{{end_ns}} injected from --since
signoz query --since 24h --sql "
  SELECT toStartOfInterval(fromUnixTimestamp64Nano(timestamp, 'Asia/Shanghai'), INTERVAL 1 HOUR) AS ts,
         count(*) AS value
  FROM signoz_logs.distributed_logs_v2
  WHERE timestamp >= {{start_ns}} AND timestamp <= {{end_ns}}
    AND ts_bucket_start >= {{start_s}} - 1800 AND ts_bucket_start <= {{end_s}}
  GROUP BY ts ORDER BY ts
"

# Load a saved query from file with custom time range
signoz query -f my-query.json --since 7d --until 1d
```

#### File format for `-f`

The JSON file should follow the SigNoz v5 `query_range` body format (`schemaVersion`/`requestType`/`compositeQuery.queries[]`, each query having `type` + `spec`). The `start` and `end` fields are overridden by `--since`/`--until`.

### metrics — Discover available metrics

List all metrics with their temporality, type, and PromQL compatibility:

```bash
signoz metrics                          # JSON list of all metrics
signoz metrics --format table           # Quick scan as table
```

Output fields: `name`, `temporality` (Cumulative/Delta/Unspecified), `type` (Sum/Gauge/Histogram), `unit`, `promql` (yes/no).

Use this to determine which metrics can be queried via PromQL (Cumulative/Gauge only) and the exact metric name format.

### alerts — List alert rules

```bash
signoz alerts                  # JSON output (default)
signoz alerts --format table   # Table output
```

### services — List services

```bash
signoz services                # JSON output (default)
signoz services --format table # Table output
```

## API Endpoints

The CLI talks to these SigNoz API endpoints:

| Command | Method | Endpoint |
|---------|--------|----------|
| `query` | POST | `/api/v5/query_range` |
| `metrics` | POST | `/api/v5/query_range` (SQL against `distributed_metadata`) |
| `alerts` | GET | `/api/v1/rules` |
| `services` | GET | `/api/v1/services/list` |

Default base URL: `http://localhost:3301` (SigNoz local dev).

## Auth Header

SigNoz uses a custom auth header `SIGNOZ-API-KEY` (not `Authorization: Bearer`). This is handled automatically by the CLI.

## Duration Format

Units: `s`/`m`/`h`/`d`（秒/分/时/天），语义均为 "X ago from now"（同上）。ISO 8601 也可用，见 Timezone 节。

## ClickHouse SQL Reference for SigNoz

> 完整 SQL 约定、表结构、查询模板、属性访问方式见 `references/clickhouse-sql.md`。使用 `--sql` 时 Read 该文件。

关键要点速查（详见 reference）：
- 始终用 `distributed_*` 表，Logs/Traces 必加 `ts_bucket_start` 过滤
- 结果列命名：时间列 `ts`，值列 `value`
- 属性访问用 Map 列：`attributes_string['http.method']`

## Troubleshooting

| Error | Fix |
|-------|-----|
| "No API token configured" | 确认调用时显式传了 `--url` / `--token`，且对应的 `SIGNOZ_<ENV>_URL` / `SIGNOZ_<ENV>_TOKEN` 已 export |
| Connection refused | Check that SigNoz is running at the configured URL |
| 401 Unauthorized | Verify your API token is valid |
| Query timeout | Add `ts_bucket_start` filter to your SQL WHERE clause |
| Empty results with `--sql` | Use `{{start_ms}}`/`{{end_ms}}` etc. in your SQL WHERE clause — see time injection docs above |
| PromQL returns empty / `series: null` | Metric may use Delta temporality (not supported by PromQL engine) — use `--sql` instead. Or metric uses OTel dot-separated name — use `{__name__="metric.name"}` syntax |
| invalid --step value | `--step` must be a positive number in seconds (e.g., `60`, not `1m`) |
