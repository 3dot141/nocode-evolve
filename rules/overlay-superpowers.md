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

走到 step 5（写设计文档）时，**依次链式调用两个 skill**：

1. **`nocode-toolkit:design-doc-writing`** —— 生成 markdown 设计文档
   - 类型选择（按 layer × intent 双轴）
   - 章节填写与自检
   - 输出 `docs/plans/{username}/yymmdd-<topic>-design.md`

2. **`nocode-toolkit:design-doc-rendering`** —— 渲染 single-file HTML 展示版
   - 输入：上一步刚写的 markdown
   - 输出：同目录、同名、换后缀 `.html`
   - HTML 含 TOC / 折叠 / 暗黑模式 / 代码高亮 / 回到顶部 5 个交互

两步都要走，不要省略 HTML 渲染。
不要自由发挥章节结构，也不要绕过这两个 skill 直接写。
