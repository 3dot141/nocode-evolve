---
description: 在当前项目初始化 .agents-personal/ 结构（变量覆盖 + wiki + rules）
argument-hint: (无参数)
---

# /personal-init: 初始化项目本地 agent 资源

在当前项目根目录创建 `.agents-personal/` 完整结构，让 agent 能在该项目里使用 wiki 记忆、rule 指令、变量覆盖。

## 前置检查

1. 确认 cwd 是 git 仓库根（`git rev-parse --show-toplevel`）
2. 检查 `.agents-personal/` 是否已存在：
   - **已存在** → 报告现有结构，问用户要补缺还是跳过（不覆盖已有文件）
   - **不存在** → 继续

3. 检查 `.gitignore` 是否已包含 `.agents-personal/`：
   - 没有 → 追加一行 `.agents-personal/`
   - 有 → 跳过

## 创建结构

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

## 完成报告

创建完成后输出：

```
.agents-personal/ 初始化完成:
- AGENTS.md: 变量覆盖模板（全部注释状态，按需取消注释）
- wiki/: index.md + log.md + draft/ + pages/
- rules/: 空目录，/distill 会填充
- .gitignore: 已确认包含 .agents-personal/
```
