# 方法卡：database-method（PostgreSQL 数据库专项清单）

> reviewing 框架方法库 · 领域方法 card。**适合**：SQL 查询 / schema 设计 / migration / 索引 / RLS / 连接与并发配置。是 `checklist` 方法在「数据库」对象上的领域维度载体——§4.3 选择表「数据库（SQL/schema/migration）→ checklist(database-method card)」。
>
> 改造自 `agents/database-reviewer.md`（PostgreSQL 专家，含 Supabase best-practice）。本卡保留完整领域清单，剥掉 agent frontmatter 与冗长写死示例。深度审查时仍可 `@database-reviewer` 薄壳直触本卡。
>
> **接线确认**：skeleton.md 方法选择表已含「数据库 SQL/migration → database-method」（批0 写入）。审到 SQL/migration（哪怕一行也是**重档**：不可逆 + 数据风险，见 skeleton §1 边界示例）时 selectMethods 据此选本卡，**不经 manifest 路由**。

**用法**：把被评审的 SQL / migration / schema diff 填入 `{DIFF}`，逐项遍历下方维度，每项标 ✅ 通过 / ⚠️ 疑点 / ❌ 问题，落到 `file:line`，按 findings 契约产出。

```
{DIFF}
```

先 `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md` 套通用流程（分档/独立交叉/分级/收口），`Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md` 套 findings 契约。本卡只提供第 3 步的领域维度。

---

## 一、维度 / 思路（领域维度表 — 逐项核查）

数据库 review 优先级：**Query Performance（CRITICAL）→ Security & RLS（CRITICAL）→ Schema Design（HIGH）→ 连接/并发/数据访问/监控**。每个维度都要显式标 ✅/⚠️/❌，「没问题」也标 ✅。

### 维度 1：Query Performance（查询性能 · CRITICAL）

| 子项 | 核查点 |
|---|---|
| **索引使用** | WHERE 列是否有索引？JOIN 列是否有索引？外键是否有索引（FK 默认不建索引）？索引类型是否合适？ |
| **查询计划** | 复杂查询跑 `EXPLAIN ANALYZE`；大表上有无 `Seq Scan`；行估算是否贴近实际 |
| **常见问题** | N+1 查询模式；缺复合索引；复合索引列顺序错误 |

**索引模式清单**（逐项核查）：

1. **WHERE / JOIN 列加索引** —— 大表上 100-1000x 提速。外键列必须显式 `CREATE INDEX`（PostgreSQL 不自动给 FK 建索引）。
2. **选对索引类型**：
   - **B-tree**（默认）：等值、范围 `= < > BETWEEN IN`
   - **GIN**：数组 / JSONB / 全文 `@> ? ?& ?| @@`
   - **BRIN**：大型时序表（按物理顺序排好的范围查询）
   - **Hash**：仅等值 `=`
   - 反例：用 B-tree 索引 JSONB containment（应 GIN）。
3. **复合索引**（多列查询 5-10x）：**等值列在前，范围列在后**。遵守**最左前缀规则**——`(status, created_at)` 能服务 `WHERE status=...` 和 `WHERE status=... AND created_at>...`，但**不能**单独服务 `WHERE created_at>...`。
4. **覆盖索引 / Index-Only Scan**（2-5x）：`INCLUDE (col...)` 把回表列放进索引，避免回表查找。
5. **部分索引**（5-20x 更小、写更快）：`WHERE deleted_at IS NULL`（软删）/ `WHERE status='pending'`（状态过滤）/ `WHERE sku IS NOT NULL`（非空值）。

### 维度 2：Security & RLS（安全与行级安全 · CRITICAL）

| 子项 | 核查点 |
|---|---|
| **RLS 启用** | 多租户表是否 `ENABLE ROW LEVEL SECURITY`（+ `FORCE`）？仅靠应用层 `WHERE user_id=...` 过滤一旦 bug 即全量泄露 |
| **RLS 策略写法** | 策略是否用 `(SELECT auth.uid())` 包裹？裸 `auth.uid() = user_id` 每行调一次函数（百万行调百万次），包 SELECT 后缓存只调一次（5-100x）|
| **RLS 列索引** | RLS 策略引用的列（如 `user_id`）是否有索引？ |
| **最小权限** | 是否避免 `GRANT ALL`？应用用户按 readonly/writer 分角色最小授权（如 writer 无 DELETE）？`REVOKE ALL ON SCHEMA public FROM public` 是否做？ |
| **数据保护** | 敏感数据是否加密？PII 访问是否审计？ |

> Supabase 模式：`CREATE POLICY ... TO authenticated USING (user_id = (SELECT auth.uid()))`，并 `CREATE INDEX ON tbl(user_id)`。

### 维度 3：Schema Design（schema 设计 · HIGH）

**数据类型选择**（逐项核查，反模式 → 正确）：

| 反模式 | 正确 | 原因 |
|---|---|---|
| `int` 做 ID | `bigint`（或 `bigint GENERATED ALWAYS AS IDENTITY`）| int 在 21 亿溢出 |
| `varchar(255)` 无约束理由 | `text` | 人为限制 |
| `timestamp` | `timestamptz` | 无时区会出 bug |
| `varchar` 存标志 | `boolean` | 类型错配 |
| `float` 存金额 | `numeric(p,s)` | 精度丢失 |

**约束**：主键定义齐；外键带合适 `ON DELETE`；该 `NOT NULL` 的列加上；用 `CHECK` 做校验。

**主键策略**：单库默认 `IDENTITY`；分布式用时间有序的 **UUIDv7**；**避免随机 `gen_random_uuid()` 做主键**（索引碎片化、插入分散）。

**表分区**：表 >100M 行 / 时序数据 / 需快速删旧数据时 `PARTITION BY RANGE`，删旧分区 `DROP TABLE` 瞬时（对比 DELETE 数小时）。

**命名**：`lowercase_snake_case`，避免引号包裹的混合大小写标识符（一旦带引号处处都要带）。

### 维度 4：Connection Management（连接管理）

- **连接数上限**：`(RAM_MB / 5MB每连接) - reserved`；`work_mem` × `max_connections` 不能超内存。
- **空闲超时**：`idle_in_transaction_session_timeout`、`idle_session_timeout` 设上。
- **连接池**：transaction 模式（多数应用）/ session 模式（预编译语句、临时表）；池大小 `(CPU核心 × 2) + spindle_count`。
- ⚠️ transaction-mode 池下用预编译语句会出问题。

### 维度 5：Concurrency & Locking（并发与锁）

1. **事务保持短小**：外部 API 调用放事务**外**，别在持锁期间做 HTTP 调用（锁应只持有毫秒级）。
2. **防死锁**：多行加锁用**一致的加锁顺序**（如 `ORDER BY id FOR UPDATE`），避免事务 A 锁 1→2、事务 B 锁 2→1 的交叉死锁。
3. **队列用 `SKIP LOCKED`**（worker 队列 10x 吞吐）：`FOR UPDATE SKIP LOCKED` 让 worker 跳过被锁行不互相等待。

### 维度 6：Data Access Patterns（数据访问模式）

- **批量插入**（10-50x）：多值 `INSERT ... VALUES (...),(...)` 一次往返；超大数据集用 `COPY`。
- **消除 N+1**：用 `WHERE col = ANY(ARRAY[...])` 或 `JOIN` 替代循环单查。
- **游标分页**（深翻页 O(1)）：`WHERE id > :last ORDER BY id LIMIT n` 替代大 `OFFSET`（OFFSET 199980 要扫 20 万行）。
- **UPSERT**：`INSERT ... ON CONFLICT (...) DO UPDATE` 原子化插入或更新，避免「先查后插」竞态。

### 维度 7：Monitoring & Diagnostics（监控诊断）

- **`pg_stat_statements`**：查最慢 / 最频繁查询。
- **`EXPLAIN ANALYZE`** 信号表：`Seq Scan` 大表 → 缺索引；`Rows Removed by Filter` 高 → 选择性差；`Buffers: read >> hit` → 未缓存；`Sort Method: external merge` → `work_mem` 太低。
- **统计信息**：高 churn 表 `ANALYZE` + 调 autovacuum scale_factor。

### 维度 8：JSONB Patterns

- **索引 JSONB**：containment `@>` 用 `USING gin (col)`；特定 key 用表达式索引 `((col->>'key'))`；仅需 `@>` 时 `jsonb_path_ops`（小 2-3x）。
- **全文搜索**：生成 `tsvector` 列 + GIN 索引，`@@ to_tsquery(...)`，`ts_rank` 排序。

---

## 反模式速查（Anti-Patterns to Flag）

逐类核对，命中即 finding：

**❌ 查询反模式**：生产代码 `SELECT *`；WHERE/JOIN 列缺索引；大表 OFFSET 分页；N+1；未参数化查询（SQL 注入风险）。
**❌ schema 反模式**：`int` 做 ID；无理由的 `varchar(255)`；不带时区的 `timestamp`；随机 UUID 做主键；混合大小写标识符。
**❌ 安全反模式**：`GRANT ALL` 给应用用户；多租户表缺 RLS；RLS 策略每行调函数（未包 SELECT）；RLS 列未索引。
**❌ 连接反模式**：无连接池；无空闲超时；transaction-mode 池配预编译语句；持锁期间调外部 API。

---

## 二、输出契约

产出 `findings[]`，映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- 每条 finding：`axis` = 维度名（`Query Performance` / `RLS` / `Schema Design` / `Concurrency` / `JSONB`……）；`location` 必填到 `file:line`（migration 文件 / SQL 行）；`evidence` = 反模式 SQL 摘录或 `EXPLAIN` 输出；`severity` = C/W/S；`fix` = Structural Remedy 优先（如「整列改 `bigint`」而非「这处转一下」）。
- **database 原生分级 → 统一 C/W/S**（findings-contract §3）：`CRITICAL`（缺 RLS / SQL 注入 / 大表全扫）→ critical；`HIGH`/`MEDIUM`（schema 类型错、缺复合索引）→ warning；零散反模式提示 → suggestion。
- 受 **Evidence Gate** 约束：代码事实类 critical/warning 缺 `location` → 降 `kind=open-question`（如「这表可能缺索引」无具体行 → 让作者确认）。
- `verdict`：有未处置 critical（缺 RLS、注入风险）→ `approved=false`。

**Review Checklist（放行前逐项确认）**：
- [ ] WHERE/JOIN 列均有索引；外键有索引
- [ ] 复合索引列顺序正确（等值在前、范围在后）
- [ ] 数据类型正确（bigint / text / timestamptz / numeric）
- [ ] 多租户表启用 RLS
- [ ] RLS 策略用 `(SELECT auth.uid())` 模式且策略列有索引
- [ ] 无 N+1 查询模式
- [ ] 复杂查询跑过 `EXPLAIN ANALYZE`
- [ ] 用小写标识符
- [ ] 事务保持短小

---

## 三、派发策略

| 模式 | 派 subagent | 调 codex | 说明 |
|---|---|---|---|
| **自评清单**（默认） | 否 | 否 | 主 agent 套上方维度逐项核查 SQL/migration |
| **异源交叉**（schema/migration 重档） | 是 | 可选 | 独立性档 = **同模型 / 异源**（§4.3）——SQL/migration 不可逆，重档时叠加独立 reviewer 复核 |

档位：任何 SQL/migration 默认**重档**（skeleton §1：「一段 SQL migration 哪怕只一行 → 重档，不可逆 + 数据风险」）。纯只读查询调优可降为自评单跑。异源交叉的 CLAIM 剥离 / codex 降级走框架公共能力（skeleton 步骤 5）。

**辅助诊断命令**（review 时可跑，验证假设）：
```bash
# 慢查询（需 pg_stat_statements）
psql -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
# 缺索引的外键
psql -c "SELECT conrelid::regclass, a.attname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.contype='f' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND a.attnum=ANY(i.indkey));"
# 索引使用情况 / 表膨胀
psql -c "SELECT indexrelname, idx_scan, idx_tup_read FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"
psql -c "SELECT relname, n_dead_tup, last_vacuum, last_autovacuum FROM pg_stat_user_tables WHERE n_dead_tup > 1000 ORDER BY n_dead_tup DESC;"
```

> 维度清单改造自 [Supabase Agent Skills](https://github.com/supabase/agent-skills)（MIT）+ `agents/database-reviewer.md`。
