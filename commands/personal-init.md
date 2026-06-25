---
description: 在当前项目初始化 .agents-personal/ 结构（变量覆盖 + wiki + rules），可选扫描仓库预填内容
argument-hint: (无参数)
---

# /personal-init: 初始化项目本地 agent 资源

在当前项目根目录创建 `.agents-personal/` 完整结构，让 agent 能在该项目里使用 wiki 记忆、rule 指令、变量覆盖。

## Phase 1: 前置检查

1. 确认 cwd 是 git 仓库根（`git rev-parse --show-toplevel`）
2. 检查 `.agents-personal/` 是否已存在：
   - **已存在** → 报告现有结构，问用户要补缺还是跳过（不覆盖已有文件）
   - **不存在** → 继续

3. 检查 `.gitignore` 是否已包含 `.agents-personal/`：
   - 没有 → 追加一行 `.agents-personal/`
   - 有 → 跳过

## Phase 2: 创建结构

```
.agents-personal/
├── AGENTS.md
├── rules/
└── wiki/
    ├── index.md
    ├── log.md
    ├── draft/
    └── pages/
```

### AGENTS.md 模板

```markdown
# Project Agent Config

> 本文件是 agent 在本项目的路由表 + 变量覆盖。优先级高于插件默认值。
> 参考: model/agent-about.md「全局占位符」+「文档产出路径变量」

## 变量覆盖

<!-- 取消注释并修改需要覆盖的变量。未覆盖的走插件默认值。 -->

<!-- {username} = your-github-username -->

### 文档产出路径

<!-- {pd_research_output} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/research-memo.md -->
<!-- {pd_prd_output} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.prd.md -->
<!-- {pd_vis_output} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.design.md -->
<!-- {pd_vis_prototype} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/prototype-{topic}.html -->
<!-- {dev_design_output} = docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-design.md -->
<!-- {dev_plan_output} = docs/dev/{username}/{yymmdd}-{serial}-{topic}/{topic}-plan.md -->
<!-- {dev_verify_output} = docs/dev/{username}/{yymmdd}-{serial}-{topic}/verify-report.md -->
<!-- {dev_review_output} = docs/dev/{username}/{yymmdd}-{serial}-{topic}/review-log.md -->

## Rules

<!-- /distill 沉淀时自动填充。格式: -->
<!-- ### <rule-slug> -->
<!-- **触发**: ... -->
<!-- **读**: rules/<rule-slug>.md -->
```

### wiki/index.md 模板

```markdown
# Wiki Index

> 项目知识索引。由 /distill 维护，手动编辑也可以。

## Pages

(暂无成熟页)

## Drafts

(暂无草稿)
```

### wiki/log.md 模板

```markdown
# Wiki Log

> 操作日志。每次 wiki 读写追加一行。

| 时间 | 操作 | 页面 | 备注 |
|---|---|---|---|
```

## Phase 3: 仓库扫描 + 变量填充

Phase 2 完成后直接进入扫描，不问用户。wiki 已有内容时冲突项逐条确认。

### Step 3a: 检测现有 docs 布局

扫描项目 `docs/` 目录（`find docs -maxdepth 3 -type d` + 采样文件名），识别：

| 检测项 | 方法 | 产出 |
|---|---|---|
| 目录布局 | 有无 `superpowers/`、`plans/`、`pd/`、`dev/` 等子目录 | 判断是旧布局还是新布局 |
| username 子目录 | 目录名是否匹配人名/github-id pattern | 填 `{username}` 覆盖 |
| 日期格式 | 采样文件名提取日期部分（`YYYY-MM-DD` vs `yymmdd`） | 调整路径模板的日期段 |
| serial 使用 | 是否有 `yymmdd-01-` 格式 | 是否保留 `{serial}` 段 |
| 文件后缀 | `-design.md` / `-plan.md` / 无后缀 | 调整路径模板的后缀 |

根据检测结果，**取消注释并填充 AGENTS.md 的变量覆盖**，覆盖为项目实际使用的路径格式。

### Step 3b: 检测现有 CLAUDE.md / AGENTS.md

如果项目根有 `CLAUDE.md` 或 `AGENTS.md`：
- 读取内容，检查有没有已定义的变量（如 `{username}`）
- 有 → `.agents-personal/AGENTS.md` 的覆盖与之保持一致
- 有 `@./AGENTS.md` 导入关系 → 在报告中提示用户

## Phase 4: 仓库深度扫描 + wiki 知识提取

遍历整个仓库，为每个值得记录的子系统/模块生成一条 wiki draft。目标：新人（或新会话的 agent）读完这批 wiki 能理解项目全貌。

### Step 4a: 仓库探索

并行收集信息（用 subagent 或串行均可，视仓库大小定）：

**技术栈识别**:

| 文件 | 说明 |
|---|---|
| `package.json` | Node.js / 前端 — 读 dependencies 提取框架 |
| `pom.xml` / `build.gradle` | Java — 读 groupId + 主要依赖 |
| `go.mod` | Go — 读 module path |
| `pyproject.toml` / `requirements.txt` | Python |
| `Cargo.toml` | Rust |
| monorepo 标志 (`pnpm-workspace.yaml` / `lerna.json` / `workspaces`) | 识别 monorepo + 列出 packages |

**项目结构**:
- 顶层目录 + 各目录职责推断（`ls -d */` + 读各目录下的 README 或入口文件）
- 入口文件（`src/index.*`、`src/main.*`、`src/app.*`、`cmd/`）
- 关键配置（`*.config.*`、`.env.example`、`docker-compose*`、`Dockerfile*`）

**子系统识别**:
- monorepo → 每个 package/module 是一个子系统
- 非 monorepo → 按顶层目录分（`src/modules/`、`src/services/`、`packages/`、Maven modules 等）
- 每个子系统：读入口文件 + README + 导出接口，推断职责

**架构线索**:
- 数据层：有无 ORM/数据库配置（prisma、typeorm、JPA、SQLAlchemy 等）
- API 层：有无路由定义（Express/Koa/Spring Controller/FastAPI 等）
- 消息/事件：有无 MQ/Event 配置（Kafka、RabbitMQ、Redis pub/sub 等）
- 部署：Docker/K8s/CI 配置

### Step 4b: 生成 wiki drafts

基于 4a 的探索结果，生成 N 条 wiki draft。每条一个主题，每条独立成文。

**必出（至少 1 条）**:

| draft | 内容 |
|---|---|
| `project-overview.md` | 一句话定位 + 技术栈 + 顶层结构 + 构建运行方式 |

**按需生成（每个识别到的子系统/维度 1 条）**:

| draft 命名 | 触发条件 | 内容 |
|---|---|---|
| `{module-slug}.md` | 每个子系统/package/module | 职责 + 对外接口 + 上下游依赖 + 关键文件 |
| `data-layer.md` | 检测到 ORM/数据库 | 数据模型概览 + 存储选型 + 关键 entity/table |
| `api-surface.md` | 检测到 API 路由 | 主要端点分组 + 认证方式 + 请求响应约定 |
| `infra-deploy.md` | 检测到 Docker/K8s/CI | 部署拓扑 + 环境配置 + CI/CD 流程 |
| `dev-conventions.md` | 检测到 lint/formatter/commit 规范 | 代码规范 + 提交规范 + 分支策略 |

每条 draft 格式统一：

```markdown
---
maturity: stub
created: {yymmdd}
source: /personal-init scan
related:
  - path/to/key/file1
  - path/to/key/file2
---

# {主题}

## TL;DR

(一句话总结)

## 详情

(扫描提取的结构化内容)
```

### Step 4c: 冲突处理

如果 `wiki/draft/` 或 `wiki/pages/` 已有同名文件：
- 用 AskUserQuestion 逐条确认：覆盖 / 跳过 / 合并（读已有内容 + 新扫描结果合成）
- 不静默覆盖已有 wiki 内容

### Step 4d: 更新 index.md + log.md

所有 draft 写完后：
- 重建 `wiki/index.md`（扫描 draft/ + pages/ 全部文件的 frontmatter）
- 追加 `wiki/log.md`（每条新建的 draft 一行记录）

## 完成报告

```
.agents-personal/ 初始化完成:
- AGENTS.md: 变量覆盖已按仓库实际布局填充
- .gitignore: 已确认包含 .agents-personal/
- rules/: 空目录，/distill 会填充

wiki 知识提取:
- 生成 N 条 draft:
  ✓ project-overview.md — Node.js + React 18 + pnpm monorepo
  ✓ jsy-core.md — 核心数据层，导出 SDK client + 数据模型
  ✓ jsy-web.md — 主站前端，Vite MPA 多入口
  ✓ data-layer.md — MongoDB + Prisma，12 个核心 collection
  ✓ api-surface.md — REST API，3 组路由（auth/data/admin）
  ✓ dev-conventions.md — ESLint + Prettier 160 宽 + conventional commits
- wiki/index.md 已重建
- wiki/log.md 已追加 N 条
[冲突项]: (如有) 跳过 2 条已存在的 wiki
```
