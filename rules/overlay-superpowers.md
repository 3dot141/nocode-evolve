# superpowers skill 行为覆盖

执行下列 superpowers skill 时，本文规则覆盖 skill 内默认值。
若与 skill 内文冲突，**以本规则为准**。

## superpowers:brainstorming

### 输出路径

设计文档落地路径：

```
docs/plans/{username}/yymmdd-<topic>-design.md
```

- `{username}`、`yymmdd` 占位符见 `agent-about.md`
- `<topic>`：kebab-case 主题，简短可读

> 不再使用 skill 内默认的 `docs/plans/YYYY-MM-DD-<topic>-design.md`。

### 写作工作流

走到 step 5（写设计文档）时，**走完整 write → review → render 流程**：

1. **`nocode-evolve:design-doc-writing`** —— 生成 markdown 设计文档
   - 类型选择（按业界 4 类 doc-type 主轴：PRD / RFC / Design Doc / ADR）
   - Design Doc 内部按覆盖深度叠加 layer（系统级 = architecture + implementation）
   - Read examples + doc-types reference 学习结构
   - 输出 `docs/plans/{username}/yymmdd-<topic>-design.md`

2. **`design-doc-reviewer` subagent**（在 design-doc-writing 工作流内 spawn）
   - 独立 context 审查质量
   - 7 维度核心审查（含 Prose Quality）+ AI patterns 附带检查 + Self-Audit 两遍法
   - 输出分级 Review Report（Critical / Warning / Suggestion），每条带短编号（C1/W1/S1...）
   - **不自动循环修订**：Report 原样呈现给用户，逐条勾选 fix / skip（也可一键全修/全跳过/自由指示）
   - 据用户决定修订主体后，**本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`**
   - 是否再来一轮 review 由用户决定，不再有"最多 3 轮"硬限制

3. **`nocode-evolve:design-doc-rendering`** —— 渲染 single-file HTML 展示版
   - 输入：reviewer 通过的 markdown
   - 输出：同目录、同名、换后缀 `.html`
   - HTML 含 TOC / 折叠 / 暗黑模式 / 代码高亮 / 回到顶部 5 个交互

三步都要走：写 → 评审 + **用户逐条确认** + 追加 Review Log → 渲染。
不要省略 reviewer，不要代用户拍板 issue 修不修，不要绕过这两个 skill 直接写。
