---
description: 递归扫描选定目录树，为每个有意义的子目录批量生成/更新 AGENTS.md + README.md
argument-hint: [dir-path]
---

# /project-dream：递归批量生成子目录文档

选定一个目录，递归扫描它和所有子目录，为每个有意义的子目录生成/更新 AGENTS.md + README.md。

## 入参

`/project-dream [dir-path]`
- `dir-path`：起始目录（默认项目根）

## 执行流程

### Step 1: 递归扫描

从指定目录开始，递归列出所有子目录。

```bash
find <dir-path> -type d ! -path '*/.git/*' ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/build/*' ! -path '*/coverage/*' ! -path '*/__pycache__/*' ! -path '*/.agents-personal/*' ! -name '.*' | sort
```

**跳过的目录**（不生成文档）：
- `.git` / `.github` / `.vscode` / `.idea` / `.claude`
- `node_modules` / `dist` / `build` / `coverage` / `__pycache__`
- `.agents-personal`
- 其他隐藏目录（`.` 开头）
- 空目录（无文件，仅含子目录不算空）

**有意义的判断**——至少满足一条：
- 含源码文件（.js / .ts / .py / .go / .rs / .md / .mjs 等）
- 含配置文件（package.json / tsconfig.json / Makefile 等）
- 已有 AGENTS.md 或 README.md（需更新检查）
- 有明确的模块职责（是 monorepo package / skill 目录 / 独立子系统）

### Step 2: 呈现候选清单

列出计划处理的目录，标注当前状态：

```
计划处理 N 个目录：

| # | 目录 | AGENTS.md | README.md | 操作 |
|---|---|---|---|---|
| 1 | hooks/ | · | · | 新建两者 |
| 2 | rules/ | · | · | 新建两者 |
| 3 | vendor/ | + | · | 新建 README |
| 4 | skills/ | · | · | 新建两者 |
| 5 | skills/dev-build/ | · | · | 新建两者 |
| ...

勾选要处理的编号（默认全选）:
```

用 AskUserQuestion 多选让用户勾选要处理的目录。

### Step 3: 批量执行

对每个勾选的目录执行 project-distill 逻辑（Step 1-4）。

**执行策略**：

```
勾选目录数 ≤ 3？
     │
     ├─ 是 ──→ 顺序执行，每个目录即时展示 + 确认
     │
     └─ 否 ──→ 并行 subagent
                │
                ├─ 每个 subagent 分析 1 个目录
                ├─ 生成内容写到 scratchpad 临时文件
                ├─ 主 agent 读 scratchpad 汇总
                └─ 一次性展示清单 → 用户确认 → 批量写入
```

并行 subagent prompt 模板：
```
分析目录 {project_root}/{dir_path}，生成 AGENTS.md 和 README.md 内容。

1. ls -la 列出目录内容
2. 读关键文件（入口 / 配置 / 已有文档）
3. 理解职责和约束
4. 按规范生成 AGENTS.md（agent 约束）和 README.md（人类文档）

把结果写到 {scratchpad}/{dir_flat}.md，格式：
  # {dir_path}
  ## AGENTS.md
  <完整内容>
  ## README.md
  <完整内容>

不要回传内容到对话，直接写文件。
```

### Step 4: 总报告

```
project-dream 完成：

  处理 8 / 12 个目录：
    + hooks/       AGENTS.md (新建) + README.md (新建)
    + rules/       AGENTS.md (新建) + README.md (新建)
    + vendor/      README.md (新建)  [AGENTS.md 已存在, 未动]
    + skills/      AGENTS.md (新建) + README.md (新建)
    + model/       AGENTS.md (新建) + README.md (新建)
    + scripts/     AGENTS.md (新建) + README.md (新建)
    + commands/    AGENTS.md (新建) + README.md (新建)
    + agents/      AGENTS.md (新建) + README.md (新建)

  跳过 4 个：
    · .git/              系统目录
    · node_modules/      依赖目录
    · dist/              构建产物
    · .agents-personal/  私有资源
```
