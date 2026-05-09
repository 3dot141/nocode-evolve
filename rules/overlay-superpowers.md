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

走到 step 5（写设计文档）时，**调用 `nocode-toolkit:design-doc-writing` skill**，由它处理：

- 类型选择（feature-design / adr / refactor-plan / system-design）
- 模板加载与章节填写
- 自检准则

不要自由发挥章节结构，也不要绕过该 skill 直接写。
