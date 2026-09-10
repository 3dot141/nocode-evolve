# /projecthub check：子目录文档健康检查

检查项目子目录文档的健康状态。

## 入参

`/projecthub check [dir-path]`
- 有参数：只检查指定目录
- 无参数：检查整个项目

## 检查项

### E1: stale 引用（Error）

AGENTS.md 或 README.md 中引用的文件路径实际不存在（已删除/重命名）。

检测方式：提取文档中所有 `path/to/file` 格式的路径引用，逐个 `test -e` 验证。

### E2: 内容与目录不符（Error）

AGENTS.md 的「结构」节描述的文件/子目录与实际目录内容严重不符。

检测方式：解析「结构」节提到的文件名，与 `ls` 输出对比。

### W1: 覆盖缺口（Warn）

有意义的子目录缺少 AGENTS.md 和 README.md。

检测方式：扫描项目子目录（同 projecthub dream 的有意义判断），标记两者都缺的。

### W2: 半覆盖（Warn）

目录有 AGENTS.md 但没有 README.md，或反过来。

### W3: 内容过短（Warn）

AGENTS.md 或 README.md 少于 5 行（可能是占位未填充）。

### I1: 可更新（Info）

目录结构有变化（新增/删除了文件），文档可能需要更新但不一定过时。

## 输出格式

```
项目子目录文档健康检查：

  E [E1] module-a/AGENTS.md:8 — 引用 generate-catalog.mjs 不存在（已改名 generate.mjs）
  E [E2] scripts/AGENTS.md — 提到 deploy.sh 但目录下无此文件
  W [W1] commands/ — 无 AGENTS.md 也无 README.md
  W [W2] model/ — 有 AGENTS.md 无 README.md
  W [W3] scripts/README.md — 仅 3 行，可能未完成
  I [I1] module-a/ — 新增 worker.mjs，文档未提及

  结论: 2 error / 3 warn / 1 info
```

指定目录时只检查该目录及其子目录。

## 修复建议

每个 Error 和 Warn 附带修复建议：

```
  E [E1] module-a/AGENTS.md:8 — 引用 generate-catalog.mjs 不存在
    → 建议: /projecthub write module-a/ 更新文档

  W [W1] commands/ — 无文档
    → 建议: /projecthub write commands/
```
