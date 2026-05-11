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
   - 6 维度核心审查 + AI patterns 附带检查 + Self-Audit 两遍法
   - 输出分级 Review Report（Critical / Warning / Suggestion）
   - writer 据 Critical + Warning 修订，最多 3 轮
   - 3 轮仍有 Critical 时报告"Max iterations，建议人工"

3. **`nocode-evolve:design-doc-rendering`** —— 渲染 single-file HTML 展示版
   - 输入：reviewer 通过的 markdown
   - 输出：同目录、同名、换后缀 `.html`
   - HTML 含 TOC / 折叠 / 暗黑模式 / 代码高亮 / 回到顶部 5 个交互

三步都要走，不要省略 review 循环或 HTML 渲染。
不要自由发挥章节结构，也不要绕过这两个 skill 直接写。
