# agent-catalog (续片)

> 接上一片 catalog. 同源生成, 禁手改.

### 桶: 记忆与沉淀 (memory)
**粗触发**: 总结 / 沉淀 / 归档会话产出 / push 内容 / 项目本地资源 (.agents-personal/) 操作
**不含 (负例)**: 一次性事实查询

#### push-summary
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤200字, 含基础内容(覆盖 push range 全 commit) + 重点评测(亮点 / 风险 / 未验证项)
**也属**: git-lifecycle
**生命周期**: 4 收尾

#### personal-deletion-guard
**触发**: 即将 rm / mv / find -delete / Write 覆盖 / Edit 大段删 在 .agents-personal/ 或 $USER_VAULT_PATH/ 下任何文件或子目录 (subagent 同理); 删除护栏规则文本常驻 model/agent-personal.md, 本 rule 提供 PreToolUse 硬兜底
**读**: `${CLAUDE_PLUGIN_ROOT}/model/agent-personal.md`
**摘要**: .agents-personal/ + $USER_VAULT_PATH 内容是用户沉淀的项目历史 + 当前指令, gitignored 不可恢复, 删除前必须二次确认 (rm/mv/find-delete 均视为删除等价物). PreToolUse 在命令层兜底拦 (inject 提醒, 不 block 留余地给用户授权)
**生命周期**: cross

