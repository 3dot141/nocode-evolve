# Go 开发配方

> 提取自 everything-claude-code v1.2.0 golang-patterns/golang-testing/go-reviewer/go-build-resolver (MIT)，Go 项目场景特化

通用 TDD / 测试原则见 `{NOCODE_PLUGIN_ROOT}/skills/references/testing-guide.md`。本文是 Go 栈专用配方：惯用法 → 测试 → 审查要点 → 构建排错。

---

## 一、惯用法

### 核心原则

- **简单优于聪明**：代码应该一眼看懂，不玩花活。
- **让零值可用**：类型设计成零值即可用（`bytes.Buffer`、`sync.Mutex`），避免 nil map panic。
- **接收接口，返回结构体**：函数参数用接口，返回具体类型。
- **错误是值**：当作一等公民处理，不是异常。
- **提前返回**：先处理错误，happy path 不缩进。

### 错误处理

```go
// 包装错误带上下文
func LoadConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("load config %s: %w", path, err)
    }
    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config %s: %w", path, err)
    }
    return &cfg, nil
}

// 哨兵错误 + 自定义错误类型
var ErrNotFound = errors.New("resource not found")

type ValidationError struct {
    Field, Message string
}
func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

// 用 errors.Is / errors.As 检查
if errors.Is(err, sql.ErrNoRows) { ... }
var ve *ValidationError
if errors.As(err, &ve) { ... }
```

绝不用 `_` 丢弃错误（除非确实是 best-effort cleanup 且注明）。

### 并发

```go
// errgroup 协调多 goroutine
func FetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([][]byte, len(urls))
    for i, url := range urls {
        i, url := i, url
        g.Go(func() error {
            data, err := fetch(ctx, url)
            if err != nil { return err }
            results[i] = data
            return nil
        })
    }
    if err := g.Wait(); err != nil { return nil, err }
    return results, nil
}
```

- `context.Context` 作第一个参数，用于取消和超时。
- 防 goroutine 泄漏：用 buffered channel + `select { case ch<-data: case <-ctx.Done(): }`。
- mutex 一定 `defer mu.Unlock()`。

### 结构与组织

- **Functional Options 模式**：`NewServer(addr, WithTimeout(...), WithLogger(...))`。
- **依赖注入**而非包级全局状态（不要 `var db *sql.DB` + init）。
- **接口定义在使用方**（consumer package），不在 provider。
- 包名短、小写、无下划线（`user` 不是 `userService`）。
- 标准布局：`cmd/` 入口、`internal/` 私有、`pkg/` 公共 API。

### 性能

```go
// 已知大小预分配
results := make([]Result, 0, len(items))

// 循环里别拼字符串，用 strings.Builder 或 strings.Join
return strings.Join(parts, ",")

// 高频分配用 sync.Pool
var bufferPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
```

---

## 二、测试

### 表驱动测试（标准模式）

```go
func TestParseConfig(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    *Config
        wantErr bool
    }{
        {"valid", `{"host":"localhost","port":8080}`, &Config{Host:"localhost", Port:8080}, false},
        {"invalid JSON", `{invalid}`, nil, true},
        {"empty", "", nil, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseConfig(tt.input)
            if tt.wantErr {
                if err == nil { t.Error("expected error, got nil") }
                return
            }
            if err != nil { t.Fatalf("unexpected error: %v", err) }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("got %+v; want %+v", got, tt.want)
            }
        })
    }
}
```

### 测试辅助

```go
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil { t.Fatalf("open db: %v", err) }
    t.Cleanup(func() { db.Close() })
    return db
}
```

- `t.Helper()` 标记辅助函数。
- `t.Cleanup()` 注册清理。
- `t.TempDir()` 临时目录自动清理。
- `t.Parallel()` 并行独立测试（注意捕获 range 变量）。

### Benchmark / Fuzz

```go
func BenchmarkProcess(b *testing.B) {
    data := generateTestData(1000)
    b.ResetTimer()
    for i := 0; i < b.N; i++ { Process(data) }
}
// go test -bench=. -benchmem ./...

func FuzzParseJSON(f *testing.F) {
    f.Add(`{"name":"test"}`)
    f.Fuzz(func(t *testing.T, input string) {
        var v map[string]any
        if json.Unmarshal([]byte(input), &v) != nil { return }
        if _, err := json.Marshal(v); err != nil {
            t.Errorf("Marshal failed after Unmarshal: %v", err)
        }
    })
}
// go test -fuzz=FuzzParseJSON -fuzztime=30s
```

### Golden File（测复杂输出）

存 `testdata/*.golden`，`-update` flag 更新：

```go
var update = flag.Bool("update", false, "update golden files")
// got := Render(input); 比对 testdata/<name>.golden
```

### 接口 Mock

定义接口 → 生产实现 + Mock 实现（带 `XxxFunc` 字段），测试注入 Mock。

### 常用命令

```bash
go test ./...              # 全部
go test -race ./...        # 竞态检测
go test -cover ./...       # 覆盖率
go test -run TestAdd ./... # 单个
go test -count=10 ./...    # flaky 检测
```

覆盖率目标：核心逻辑 100%、公共 API 90%+、一般代码 80%+、生成代码排除。

---

## 三、审查要点

按严重度分级：

**CRITICAL（阻断）**
- SQL/命令/路径注入（字符串拼接进 query、`os/exec`、用户控制路径）
- 忽略错误（`result, _ := ...`）、错误没包装上下文
- 硬编码 secret、`InsecureSkipVerify: true`、MD5/SHA1 做安全用途

**HIGH**
- goroutine 泄漏、竞态（跑 `go build -race`）、unbuffered channel 死锁
- mutex 没 `defer Unlock`、context 没传播
- 函数 > 50 行、嵌套 > 4 层、包级可变状态、长函数裸返回

**MEDIUM**
- 字符串拼接没用 Builder、slice 没预分配、receiver 指针/值不一致
- N+1 查询、缺连接池
- 导出函数缺 godoc、错误信息大写带标点（应小写无标点）

**反模式**：init() 滥用、`interface{}` 代替泛型、类型断言不带 ok、循环里 defer。

审查标准：CRITICAL/HIGH 阻断合并，MEDIUM 可带注意合并。

---

## 四、构建排错

**最小、外科手术式的改动**——只修错误，不重构。

### 诊断顺序

```bash
go build ./...                          # 1. 编译
go vet ./...                            # 2. vet
staticcheck ./... 2>/dev/null || true   # 3. 静态分析
go mod verify && go mod tidy -v         # 4. 模块
```

### 常见错误

| 错误 | 修法 |
|---|---|
| `undefined: X` | 缺 import / 拼写 / 未导出（首字母小写） |
| `cannot use x (type A) as B` | 类型转换 / 指针值不匹配 |
| `X does not implement Y` | 补缺失方法，注意 receiver 指针 vs 值 |
| `import cycle not allowed` | 共享类型抽到独立包 / 用接口破环 |
| `cannot find package` | `go get pkg@ver` / `go mod tidy` |
| `declared but not used` | 删除 / 用 `_` |
| `cannot assign to struct field in map` | 用 `map[string]*T` 或 copy-modify-reassign |

### 模块问题

```bash
go mod why -m package        # 为什么选这个版本
go get package@v1.2.3        # 指定版本
go clean -modcache           # checksum 不匹配时清缓存
```

### 停止条件

同一错误修 3 次仍在 / 修复引入更多错误 / 需要架构改动 / 循环依赖需重构包 → 停手报告，别 `//nolint` 蒙混，别随意改函数签名。
