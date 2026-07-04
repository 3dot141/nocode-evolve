# agent-catalog — nocode 插件级规则路由 (常驻完整路由)

> 本文件由 `hooks/generate.mjs` 从 `rules/manifest.json` 生成. **禁手改**——改 rule 改 manifest 后重新生成.
> 完整路由常驻 context (不再用 route skill 中转). 超 SHARD_LIMIT 自动切片 agent-catalog-2.md 等.

## 触发协议 (强制工序, 非"自觉")

**Step 0 — 每条用户消息收到后, 在动手前先扫下方各粗桶的 trigger_summary 一次**: 命中桶 → 桶内按 `触发` 选具体 rule → `Read` 对应 `rules/rule-*.md`; 命中但落「负例」→ 不触发; 全不命中 → 直接动作. 这是工序不是自觉, 不因任务大小/mid-task 而省.

完整版(Fork/subagent 触发降级细则 + 何时主动调用 /devflow + 何时主动建议 /distill·/sow·/task)见同一 SessionStart 更早注入的 `model/agent-catalog-using.md`, 已注入过不在此重复.

---

## 规则清单 (按粗桶分组, 完整路由)

### 桶: Git 生命周期 (git-lifecycle)
**粗触发**: 任何把本地改动推进到分支 / 远端协作状态的请求 (提 PR / push / 合并 / 收尾 / worktree)
**不含 (负例)**: 纯只读查询: 列 PR / 看分支 / 看 status / 看 log

- **push-summary**: push 后要总结内容 / 给 PR 标题描述 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
- **git-worktree**: 新建分支/开 worktree, 或 worktree 内缺 env/config → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-worktree.md`
- **git-inspection**: 连续跑 ≥2 个 git 只读命令 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-inspection.md`
- **git-freshness**: 设计/方案/代码搜索前确认分支未过时 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`
- **lark-project**: project.feishu.cn 链接/Meego 工作项, 或 PR 合并后要流转飞书状态

### 桶: 评审 (review)
**粗触发**: 对已有改动或设计求评审 / 挑错 / 独立验证 / 第二实现
**不含 (负例)**: 纯执行: 直接改代码而未求评审

- **codex-review**: 红蓝独立审查/review收尾/委派救援/设计文档审稿要用 Codex → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
- **git-freshness**: 设计/方案/代码搜索前确认分支未过时 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`

### 桶: 设计与文档 (design)
**粗触发**: 写设计文档 / PRD / RFC / ADR / 重构方案 / 技术 spec / 技术选型 / 方案对比 / 架构设计
**不含 (负例)**: 写代码注释 / commit message / README / changelog

- **superpowers-brainstorming**: brainstorming 收尾写设计文档, 或直接要写 PRD/RFC/设计文档 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md`
- **codex-review**: 红蓝独立审查/review收尾/委派救援/设计文档审稿要用 Codex → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
- **git-freshness**: 设计/方案/代码搜索前确认分支未过时 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-freshness.md`

### 桶: 记忆与沉淀 (memory)
**粗触发**: 总结 / 沉淀 / 归档会话产出 / push 内容 / 项目本地资源 (.agents-personal/) 操作
**不含 (负例)**: 一次性事实查询

- **push-summary**: push 后要总结内容 / 给 PR 标题描述 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
- **personal-deletion-guard**: 要 rm/mv/大段删 .agents-personal/ 或 vault 下内容 → 读 `${CLAUDE_PLUGIN_ROOT}/model/agent-personal.md`

### 桶: 飞书/Lark (lark)
**粗触发**: 完整读取飞书文档（含图片）/ 飞书项目管理 (project.feishu.cn / Meego 工作项读取 / 流转 / 搜索)
**不含 (负例)**: 飞书云文档低层 API 操作 (走外部 lark-doc skill); 知识空间管理 (走外部 lark-wiki skill); 飞书任务管理 (走外部 lark-task skill)

- **lark-project**: project.feishu.cn 链接/Meego 工作项, 或 PR 合并后要流转飞书状态

### 桶: Figma 设计稿读取 (figma)
**粗触发**: 读取 Figma 设计稿节点属性 (字号 / 颜色 / 间距 / 圆角), 用户给 figma.com 链接要求提取设计值 / 对齐 UI 实现
**不含 (负例)**: 只看用户贴的设计稿截图 (不需要 API); Figma 原型预览链接 (无 inspect 需求)

- **figma-design-read**: 给 figma.com 链接要提取设计值 → 读 `${CLAUDE_PLUGIN_ROOT}/rules/rule-figma-design-read.md`

