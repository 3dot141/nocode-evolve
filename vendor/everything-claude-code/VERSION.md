# Vendor: everything-claude-code

| 字段 | 值 |
|---|---|
| 上游仓库 | https://github.com/arabicapp/everything-claude-code |
| 版本 | 1.2.0 |
| commit | 1db756552cb3278b7243b44a0fa9bd679e375585 |
| 拉取日期 | 2026-06-26 |
| 协议 | MIT |
| 排除 | .git/ tests/ assets/ node_modules/ *.png *.svg |

## 内容概览

| 类型 | 数量 | 说明 |
|---|---|---|
| skills | 16 | 技术栈模式 + 工作流质量 + Agent 工程 |
| agents | 12 | 专职 agent（architect/reviewer/tdd-guide 等） |
| commands | 23 | 用户命令（/tdd /verify /eval /plan 等） |
| rules | 8 | 编码风格/git/安全/测试/性能等 |
| contexts | 3 | dev/research/review 上下文 |
| hooks | 1 | hooks.json |
| mcp-configs | 1 | mcp-servers.json |

## Skills 清单

### 技术栈模式库
| skill | 内容 |
|---|---|
| coding-standards | TS/JS/React/Node 编码规范（KISS/DRY/YAGNI） |
| backend-patterns | 后端架构：REST API/Repository/DB 优化 |
| frontend-patterns | React/Next 前端模式：组合/复合组件/性能 |
| golang-patterns | Go 写法约定（简洁性/错误包装） |
| golang-testing | Go 测试：表驱动/子测试/benchmark/fuzz |
| postgres-patterns | PostgreSQL 索引/Schema/RLS（Supabase） |
| clickhouse-io | ClickHouse OLAP：MergeTree/查询优化 |
| project-guidelines-example | 项目专属 skill 模板 |

### 工作流/质量
| skill | 内容 |
|---|---|
| tdd-workflow | 强制 TDD，80%+ 覆盖率 |
| verification-loop | 收尾 6 阶段验证（build→type→lint→test→security→diff） |
| security-review | 10 项安全清单（Next.js+Supabase+Solana） |
| eval-harness | Eval 驱动开发（EDD），pass@k 指标 |

### Agent 工程
| skill | 内容 |
|---|---|
| strategic-compact | 逻辑边界建议手动 /compact |
| iterative-retrieval | 4 阶段循环检索（dispatch→evaluate→refine→loop） |
| continuous-learning | 会话结束提取可复用模式（v1） |
| continuous-learning-v2 | hook + Haiku agent 产出带置信度 instinct（v2） |

## Agents 清单

| agent | 定位 |
|---|---|
| architect | 架构设计 |
| planner | 任务规划 |
| code-reviewer | 代码审查 |
| security-reviewer | 安全审查 |
| database-reviewer | 数据库审查 |
| tdd-guide | TDD 引导 |
| build-error-resolver | 构建报错修复 |
| go-build-resolver | Go 构建报错修复 |
| go-reviewer | Go 代码审查 |
| e2e-runner | E2E 测试执行 |
| doc-updater | 文档更新 |
| refactor-cleaner | 重构清理 |
