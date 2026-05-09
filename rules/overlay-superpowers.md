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

### 文档模板

写设计文档前，**必须先 Read** 模板：

```
${CLAUDE_PLUGIN_ROOT}/resources/brainstorming-design-template.md
```

按模板的章节顺序与标题层级填充，不要自由发挥章节结构。
模板中标记为「可选」的章节按需保留，其余必填。
