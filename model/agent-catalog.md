# agent-catalog — nocode-evolve 插件级粗桶路由

> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成。**禁手改**——改 rule 改 manifest 后重新生成。

## 读取时机

会话开局本文件已在 context。响应任何工程任务前扫下方**粗桶**: 命中任一桶 → 调 `Skill(nocode-evolve:route)` 拿完整路由表(各 rule 触发 / 读哪个文件 / guard)与项目本地资源(.agents-personal wiki/rules)检索约定。纯只读查询 / 纯事实问答不触发。

## 粗桶

- **Git 生命周期 (git-lifecycle)**: 任何把本地改动推进到分支 / 远端协作状态的请求 (提 PR / push / 合并 / 收尾 / worktree)
  - 不含(负例): 纯只读查询: 列 PR / 看分支 / 看 status / 看 log
- **评审 (review)**: 对已有改动或设计求评审 / 挑错 / 独立验证 / 第二实现
  - 不含(负例): 纯执行: 直接改代码而未求评审
- **设计与文档 (design)**: 写设计文档 / PRD / RFC / ADR / 重构方案 / 技术 spec
  - 不含(负例): 写代码注释 / commit message / README / changelog
- **记忆与沉淀 (memory)**: 总结 / 沉淀 / 归档会话产出 / push 内容
  - 不含(负例): 一次性事实查询

命中任一桶 → `Skill(nocode-evolve:route)`。同一会话 route 加载一次即可。
