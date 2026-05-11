---
type: design-doc
layer: implementation
topic: design-doc-writing skill 从扁平双轴重构为 doc-type 主轴
date: 260511
author: 3dot141
status: approved
last_updated: 260511
---

# Design Doc：design-doc-writing skill 重构

> 完整版见 `docs/plans/3dot141/260511-design-doc-skill-refactor-design.md`。本 example 是精简版，展示 design-doc 的「上半 + 下半」结构。

## 上半：Human Review

### TL;DR

把 design-doc-writing skill 从 `layer × intent` 双轴改为 `doc-type` 主轴（PRD/RFC/Design Doc/ADR）+ 新增 reviewer subagent + 用 humanizer 风格做附带 AI patterns 检查。layer 退为 design-doc 内部的覆盖深度选择。

### Problem Statement

当前 skill 用 `intent` 维度（feature/refactor/decision/bugfix），与业界主流 PRD/RFC/Design Doc/ADR 4 类不对齐：
- `*-feature` 像 PRD 又像 Design Doc，模糊
- `*-decision` 实际是 ADR，但加 layer 维度产生 `implementation-decision` 这种不存在的组合
- `*-bugfix` 业界基本不写 design doc

此外缺：write/review 循环 / Non-Goals 强制 / lifecycle 状态机 / examples / "两半结构"AI 适配。

### Goals
- 文档分类与业界 4 类对齐
- 加 reviewer subagent 提升 single-pass 质量
- frontmatter 含 lifecycle 状态机
- examples/ 提供 4 类示例（dogfood 本插件历史决策）

### Non-Goals
- ❌ 不动 design-doc-rendering skill（HTML 渲染独立工作良好）
- ❌ 不做新旧格式自动迁移（旧 doc 只有 1 份，手动改 / 直接删）
- ❌ 不引入 Docusaurus 等文档站点
- ❌ 不公开 marketplace 发布

### Alternatives Considered

- **完全去 layer**：丢了"系统级 vs 小改动"的有用区分。否决。
- **保留双轴 + 加 prd 成 5 类**：和业界 4 类共识仍不对齐。否决。
- **不做 reviewer**：业界领先 skill 都有（lemieux/kk/arkhe）。否决。

### Trade-offs

- 重构成本：~100 min 工作量，9 新文件 + 3 大改 + 4 移动 + 5 删除
- 中间断态风险：用"先建后删" 4 phase 顺序避免
- 学习成本：新模型 + 旧 brainstorm 习惯有切换成本

## 下半：Agent Implementation

### Component / Module Design

```
skills/design-doc-writing/
├── references/doc-types/         # 取代 intent/
├── references/layer-supplements/ # 重命名自 layer/
├── references/examples/          # 新增 4 份示例
└── agents/design-doc-reviewer.md # 新增
```

### API Contracts / Function Signatures

frontmatter schema：

```yaml
# 旧
type: <layer>-<intent>

# 新
type: prd | rfc | design-doc | adr
layer: implementation | architecture+implementation   # 可选，仅 design-doc
last_updated: YYMMDD   # 可选，living doc 更新时
superseded_by: ADR-NNN # 仅 ADR
```

reviewer subagent 契约：

```
输入：doc_path / iteration (1-3) / previous_report (optional)
输出：分级 Critical / Warning / Suggestion + Self-Audit + Verdict
```

### Data Model

无数据库变更——纯文件系统重组。

### Error Handling

| 场景 | 处理 |
|---|---|
| AI 选 doc-type 不确定 | fallback 到 design-doc（最通用） |
| reviewer 3 轮仍 Critical | 输出"Max iterations reached"，建议人工 |
| 旧 frontmatter 格式 (`implementation-feature`) | reviewer 报 Critical 建议迁移 |

### Testing Strategy

- hook 注入验证（4 rule 仍正常）
- 用新 skill dogfood 写一份测试 design doc
- AI 选 type 准确性（≥3/4 准确）

### Cross-cutting Concerns Checklist

- [x] **Security**: N/A（纯文件结构变更，无外部接入）
- [x] **Monitoring**: N/A（无运行时组件）
- [x] **Performance**: N/A（skill 调用 latency 不变）
- [ ] **Migration**: 手动迁移 1 份旧 design doc（或直接删）
- [ ] **Backwards Compatibility**: 旧 frontmatter 由 reviewer 报 Critical
- [ ] **Documentation Updates**: 同步 CLAUDE.md / README.md（如有引用）
