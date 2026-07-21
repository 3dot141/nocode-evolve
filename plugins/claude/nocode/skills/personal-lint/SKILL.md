---
name: personal-lint
description: "检查当前项目 .agents-personal/ 的健康状态（wiki 结构 + rules 完整性 + AGENTS.md 变量对齐）"
argument-hint: [--all]
---

# /personal-lint：.agents-personal/ 健康检查

检查当前项目的 `.agents-personal/` 是否健康——wiki 结构完整、rules 引用正确、AGENTS.md 变量和插件当前定义对齐。

被 `/personal-distill`（写入前检查）和 `/personal-dream`（维护扫描）调用，也可独立跑。

## 入参

- 无参数：检查当前项目
- `--all`：扫描所有装过插件的项目（从 `~/.nocode/personal-history/` 枚举）

## 执行

### 1. 前置检查

确认 `.agents-personal/` 存在。不存在 → 报 "未初始化，跑 `/personal-init`" 并停。

### 2. 检查项

#### wiki 结构（需要 `wiki/` 目录存在，不存在则跳过这组）

| # | 检查 | 严重度 | 做法 |
|---|---|---|---|
| W1 | index.md 与实际文件不一致 | error | 扫 draft/ + pages/ 实际文件，对比 index.md 条目；多余条目 / 遗漏文件均报 |
| W2 | 孤立页（无 Related Pages 引用） | warn | 扫 pages/ 每页的 Related Pages 节，找没被任何其他页引用的 |
| W3 | 过大页（>800 词） | info | `wc -w` 每页 body（去掉 frontmatter） |
| W4 | 缺 TLDR 或 TLDR ≠ description | warn | 对比 frontmatter description 和 body 中 `**TLDR**:` 行 |
| W5 | draft/ 中 >30 天未 promote 的 stub | info | 按 frontmatter `created` + 当前日期算天数 |
| W6 | pages/ 中 >90 天未 last_updated | info | 按 frontmatter `last_updated`（无则 `created`）算 |
| W7 | superseded_by 目标不存在 | error | `maturity: superseded` 页的 `superseded_by` 指向的 slug 在 pages/ 里找不到 |
| W8 | pages/ 页 body 引用 draft/ 页 | warn | `grep -l 'draft/' pages/*.md` |
| W9 | 总页数 ≥30 且平铺模式 | warn | draft/ + pages/ 文件数 ≥30 且无 index/ 子目录 |

#### rules 完整性（需要 `rules/` 目录或 AGENTS.md 中有触发条目）

| # | 检查 | 严重度 | 做法 |
|---|---|---|---|
| R1 | AGENTS.md 触发条目指向不存在的 rules/ 文件 | error | 解析 AGENTS.md 的 `**读**: rules/<slug>.md` 行，检查文件存在 |
| R2 | rules/ 有文件但 AGENTS.md 无对应触发条目 | warn | 扫 rules/ 文件，检查 AGENTS.md 是否有引用 |

#### AGENTS.md 变量对齐

| # | 检查 | 严重度 | 做法 |
|---|---|---|---|
| V1 | 变量名不在插件当前列表 | warn | 调 `node "${CLAUDE_PLUGIN_ROOT}/scripts/personal-lint.mjs" --json`，取 staleVars |

### 3. 输出

```
ℹ .agents-personal/ 健康检查：N error / M warn / K info
  ✗ [W1] INDEX 多余条目: 260511-old-page.md（文件已不存在）
  ✗ [R1] AGENTS.md 触发条目 rules/old-rule.md 不存在
  ⚠ [W2] 孤立页: 260512-local-dev-beta-feature-toggle.md
  ⚠ [V1] 旧变量: {pd_vis_output} — 不在插件当前列表
  ℹ [W5] draft/ 有 >30 天 stub: 260512-xxx.md
  → 结论: <三档结论>
```

**结论三档**:

| 条件 | 结论 |
|---|---|
| 0 error + 0 warn + 0 info | `→ 结论: .agents-personal/ 状态健康 ✓` |
| 0 error + N warn/info | `→ 结论: 基本健康，N 个注意项` |
| ≥1 error | `→ 结论: 有 N 个结构性问题，建议修复 ✗`（列一句话修复建议） |

### 4. --all 模式

扫描 `~/.nocode/personal-history/` 所有项目（调 `scripts/personal-lint.mjs`），对能解析到活路径的项目逐个跑完整检查。输出按项目分组。
