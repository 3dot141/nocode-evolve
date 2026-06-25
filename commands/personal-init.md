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

## Phase 3: 仓库扫描 + 预填（可选）

结构创建完成后，用 AskUserQuestion 问用户：

> 要不要扫描仓库预填 wiki 和变量？
> 1. **扫描并预填**（推荐）— 检测现有 docs 布局、技术栈、项目结构，自动填充 AGENTS.md 变量和 wiki 初始内容
> 2. **跳过** — 保持空壳，后续手动填或靠 /distill 积累

用户选跳过 → 直接到完成报告。选扫描 → 执行以下步骤：

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

### Step 3b: 检测技术栈

快速扫描项目根部文件，识别技术栈：

| 文件 | 说明 |
|---|---|
| `package.json` | Node.js / 前端 — 读 dependencies 提取框架（React/Vue/Next.js 等） |
| `pom.xml` / `build.gradle` | Java — 读 groupId + 主要依赖 |
| `go.mod` | Go — 读 module path |
| `pyproject.toml` / `requirements.txt` | Python — 读主要依赖 |
| `Cargo.toml` | Rust |
| monorepo 标志 (`pnpm-workspace.yaml` / `lerna.json` / `workspaces`) | 识别 monorepo + 列出 packages |

### Step 3c: 检测项目结构

```bash
# 顶层目录概览
ls -d */ | head -20

# 入口文件
ls src/index.* src/main.* src/app.* 2>/dev/null

# 关键配置
ls *.config.* .env.example docker-compose* Dockerfile* 2>/dev/null
```

### Step 3d: 生成 wiki 初始内容

基于 3b + 3c 的结果，生成 **1 个 wiki draft stub**：

**`wiki/draft/project-overview.md`**:

```markdown
---
maturity: stub
created: {yymmdd}
source: /personal-init scan
---

# 项目概览

## 技术栈

(根据 Step 3b 检测结果填充)

## 项目结构

(根据 Step 3c 检测结果填充：顶层目录 + 各目录职责一句话)

## 构建 & 运行

(根据 package.json scripts / Makefile / README 提取)
```

同时更新 `wiki/index.md`：

```markdown
## Drafts

- [project-overview](draft/project-overview.md) — 项目技术栈与结构概览 (stub, /personal-init 自动生成)
```

### Step 3e: 检测现有 CLAUDE.md / AGENTS.md

如果项目根有 `CLAUDE.md` 或 `AGENTS.md`：
- 读取内容，检查有没有已定义的变量（如 `{username}`）
- 有 → `.agents-personal/AGENTS.md` 的覆盖应与之一致，不冲突
- 有 `@./AGENTS.md` 导入关系 → 在报告中提示用户

## 完成报告

创建完成后输出：

```
.agents-personal/ 初始化完成:
- AGENTS.md: 变量覆盖（注释模板 / 已按扫描结果填充）
- wiki/: index.md + log.md + draft/ + pages/
- rules/: 空目录，/distill 会填充
- .gitignore: 已确认包含 .agents-personal/

[如果做了扫描]:
- 检测到布局: docs/superpowers/{specs,plans}/（旧布局），已覆盖变量
- 检测到技术栈: Node.js + React 18 + pnpm monorepo
- wiki/draft/project-overview.md: 已生成 stub（技术栈 + 项目结构）
```
