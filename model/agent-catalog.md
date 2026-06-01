# agent-catalog — nocode-evolve 插件级规则路由表

> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成。**禁手改**——改 rule 改 manifest 后重新生成。

## 读取时机

会话开局本文件已在 context。响应任何任务前扫一眼下方**粗桶**匹配触发: 先命中桶(粗触发宽, 易命中), 再在桶内子规则里按 `触发` 选具体 rule → `Read` 对应文件。同一规则会话内只 Read 一次。命中桶但落在「负例」描述里 → 不触发。

---

## 规则清单（按粗桶分组）

### 桶: Git 生命周期 (git-lifecycle)
**粗触发**: 任何把本地改动推进到分支 / 远端协作状态的请求 (提 PR / push / 合并 / 收尾 / worktree)
**不含 (负例)**: 纯只读查询: 列 PR / 看分支 / 看 status / 看 log

#### finishing-branch
**触发**: 即将执行 superpowers:finishing-a-development-branch skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 删 branch / discard worktree」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-finishing-branch.md`
**摘要**: 覆盖+扩展 superpowers skill, 4 选项 (merge/PR/keep/discard); Gate 体系 M/TB/PR/D/RD; gh 主, Bitbucket DC 读 bkt 附录
**关键约束(上浮)**: Bitbucket 用 bkt 不裸 curl; reviewer 用 bkt pr edit 不 PUT。

### 桶: 记忆与沉淀 (memory)
**粗触发**: 总结 / 沉淀 / 归档会话产出 / push 内容
**不含 (负例)**: 一次性事实查询

#### push-summary
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤200字, 含基础内容(覆盖 push range 全 commit) + 重点评测(亮点 / 风险 / 未验证项)
**也属**: git-lifecycle

