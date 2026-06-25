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

<!-- {pd_research_output} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/research-report.md -->
<!-- {pd_prd_output} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.prd.md -->
<!-- {pd_vis_output} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.ui.md -->
<!-- {pd_vis_prototype} = docs/pd/{username}/{yymmdd}-{serial}-{topic}/{topic}.ui-prototype.html -->
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

Phase 2 完成后直接进入扫描。扫描只读不写，结果呈现给用户确认后再写入。

### Step 3a: 检测（只读）

扫描项目 `docs/` 目录（`find docs -maxdepth 3 -type d` + 采样文件名），识别：

| 检测项 | 方法 |
|---|---|
| 目录布局 | 有无 `superpowers/`、`plans/`、`pd/`、`dev/` 等子目录 |
| username 子目录 | 目录名是否匹配人名/github-id pattern |
| 日期格式 | 采样文件名提取日期部分（`YYYY-MM-DD` vs `yymmdd`） |
| serial 使用 | 是否有 `yymmdd-01-` 格式 |
| 文件后缀 | `-design.md` / `-plan.md` / 无后缀 |

同时检测项目根的 `CLAUDE.md` / `AGENTS.md`：
- 有无已定义的变量（如 `{username}`）
- 有无 `@./AGENTS.md` 导入关系

### Step 3b: 呈现 + 确认

把检测结果和推断出的变量覆盖值呈现给用户：

```
检测到 docs 布局: docs/superpowers/{specs,plans}/3dot141/（旧 superpowers 布局）
  - 日期格式: yymmdd
  - 无 serial
  - design 后缀: -design.md
  - plan 后缀: 无

推断变量覆盖:
  {username} = 3dot141
  {dev_design_output} = docs/superpowers/specs/{username}/{yymmdd}-{topic}-design.md
  {dev_plan_output} = docs/superpowers/plans/{username}/{yymmdd}-{topic}.md
  ... (列出全部 8 个)

确认写入 AGENTS.md？可逐条修改。
```

用 AskUserQuestion 确认：
1. **确认写入** — 按上述覆盖值写入 AGENTS.md
2. **修改后写入** — 用户给出修改意见，调整后再写入
3. **跳过** — 保持 AGENTS.md 为注释模板，不覆盖

### Step 3c: 写入

用户确认后，将变量覆盖写入 `.agents-personal/AGENTS.md`。

## Phase 4: 仓库深度扫描 + wiki 知识提取

遍历整个仓库，为每个值得记录的子系统/模块识别一条 wiki 候选。探索阶段用并行 subagent，各自写临时文件，主 agent 只读摘要拼确认清单，用户确认后再写入 wiki。

### Step 4a: 仓库探索（并行 subagent + 临时文件）

先在主 agent 做一次快速预扫（`ls -d */` + 检测 package.json/pom.xml/go.mod 等），确定项目类型和子系统列表。然后按维度派 subagent **并行**探索，每个 subagent 把结果写到 scratchpad 临时文件，**不回传大段内容到主 context**。

**预扫（主 agent，几条 Bash）**:
- 顶层目录列表
- 技术栈标志文件（package.json / pom.xml / go.mod / pyproject.toml / Cargo.toml）
- monorepo 标志（pnpm-workspace.yaml / lerna.json / workspaces）
- 子系统列表（monorepo packages / src 下模块目录 / Maven modules）

**并行 subagent（每个写 scratchpad/{label}.md）**:

| subagent | 探索范围 | 产出文件 |
|---|---|---|
| `overview` | 技术栈 + 顶层结构 + 入口文件 + 构建方式 | `scratchpad/overview.md` |
| `module-{name}` (每个子系统 1 个) | 入口文件 + README + 导出接口 + 上下游 | `scratchpad/module-{name}.md` |
| `data-layer` (有 ORM/DB 才派) | 数据模型 + 存储选型 + 关键 entity | `scratchpad/data-layer.md` |
| `api-surface` (有路由才派) | 端点分组 + 认证 + 请求响应 | `scratchpad/api-surface.md` |
| `infra` (有 Docker/K8s/CI 才派) | 部署拓扑 + 环境配置 + CI/CD | `scratchpad/infra.md` |
| `conventions` (有 lint/formatter 才派) | 代码规范 + 提交规范 + 分支策略 | `scratchpad/conventions.md` |

每个 subagent 的 prompt 模板：
```
探索 {项目路径} 的 {维度}，产出结构化摘要。
写到 {scratchpad}/{label}.md，格式：
  # {主题}
  ## TL;DR — 一句话
  ## 详情 — 结构化内容
  ## related — 关键文件路径列表
不要回传内容到对话，直接写文件。
```

subagent 全部完成后，主 agent 读每个临时文件的前几行（TL;DR）拼候选清单。

### Step 4b: 呈现候选清单 + 确认

基于 4a 的探索结果，列出计划生成的 wiki draft 清单（不写文件），呈现给用户：

```
计划生成 N 条 wiki draft:

| # | 文件名 | 主题 | 内容摘要 |
|---|---|---|---|
| 1 | project-overview.md | 项目概览 | Node.js + React 18 + pnpm monorepo |
| 2 | jsy-core.md | jsy-core 模块 | 核心数据层，导出 SDK client |
| 3 | data-layer.md | 数据层 | MongoDB + Prisma，12 个 collection |
| 4 | api-surface.md | API 层 | REST API，3 组路由 |
| 5 | dev-conventions.md | 开发约定 | ESLint + Prettier + conventional commits |

勾选要生成的编号（默认全选）:
```

**必出候选（至少 1 条）**:

| draft | 内容 |
|---|---|
| `project-overview.md` | 一句话定位 + 技术栈 + 顶层结构 + 构建运行方式 |

**按需候选（每个识别到的子系统/维度 1 条）**:

| draft 命名 | 触发条件 | 内容 |
|---|---|---|
| `{module-slug}.md` | 每个子系统/package/module | 职责 + 对外接口 + 上下游依赖 + 关键文件 |
| `data-layer.md` | 检测到 ORM/数据库 | 数据模型概览 + 存储选型 + 关键 entity/table |
| `api-surface.md` | 检测到 API 路由 | 主要端点分组 + 认证方式 + 请求响应约定 |
| `infra-deploy.md` | 检测到 Docker/K8s/CI | 部署拓扑 + 环境配置 + CI/CD 流程 |
| `dev-conventions.md` | 检测到 lint/formatter/commit 规范 | 代码规范 + 提交规范 + 分支策略 |

冲突提示：如果 `wiki/draft/` 或 `wiki/pages/` 已有同名文件，在清单中标注 `⚠ 已存在`，用户可选覆盖 / 跳过 / 合并。

用 AskUserQuestion 多选让用户勾选要生成的编号（默认全选）。

### Step 4c: 写入

用户确认后，按勾选的清单生成 wiki draft 文件。每条格式统一：

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

### Step 4d: 更新 index.md + log.md

写入完成后：
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
