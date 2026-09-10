# personalhub status：状态概览

只读检查 `.agents-personal/`；不得借 status 自动修复或写入内容。

## 执行

1. 检查 `.agents-personal/` 是否存在；不存在则报告“未初始化，可运行 `/personalhub init`”并结束。
2. 统计 wiki 的 draft/pages 页数与最近更新时间。
3. 统计 rules 文件数、AGENTS.md 触发条目数、变量覆盖数和自定义分节。
4. 完整读取并执行 `references/check.md`，但只展示 error/warn 数量与结论。
5. 展示 `log.md` 最近 5 条记录；文件不存在时明确写“暂无记录”。

输出标题为 `📂 .agents-personal/ 状态`，并依次包含 wiki、rules、AGENTS、健康和最近操作。
