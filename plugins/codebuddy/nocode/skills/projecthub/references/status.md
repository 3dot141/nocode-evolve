# /projecthub status：覆盖率概览

只读统计项目一级子目录的 AGENTS.md + README.md 覆盖率；不得借 status 自动生成、更新或修复文档。

## 执行

1. 扫描项目所有一级子目录，排除 `.git` / `node_modules` / `dist` / `build` / `coverage` / `.agents-personal` / 隐藏目录。
2. 对每个目录检查 AGENTS.md 和 README.md 是否存在。
3. 汇总全覆盖、半覆盖和未覆盖数量，并列出详情。

```bash
find . -maxdepth 1 -type d ! -name '.*' ! -name node_modules ! -name dist ! -name build ! -name coverage | sort
```

输出格式：

```
项目子目录文档覆盖率

  总目录数:  12
  全覆盖:    3 (AGENTS.md + README.md)
  仅 AGENTS: 2
  仅 README: 1
  未覆盖:    6

  详情:
    ++ hooks/          AGENTS.md + README.md
    ++ rules/          AGENTS.md + README.md
    ++ vendor/         AGENTS.md + README.md
    +· skills/         仅 AGENTS.md
    +· model/          仅 AGENTS.md
    ·+ examples/       仅 README.md
    ·· commands/       无文档
    ·· agents/         无文档
    ·· scripts/        无文档
```
