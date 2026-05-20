# agent-catalog —— nocode-evolve 插件级规则路由表

本文件列出 `rules/` 下所有触发式规则的触发条件 + 摘要. 渐进式加载: agent 在会话开局**只**自动注入 `model/*.md` (about / karpathy / personal / catalog); `rules/rule-*.md` 按触发命中再 Read.

## 读取时机

- **会话开局**: 本文件随 model 桶自动注入, 已在 context 内, 不必再 Read
- **响应任何任务前**: 扫一眼下方规则清单, 判断有无触发条件匹配当前任务
- **触发命中**: `Read ${CLAUDE_PLUGIN_ROOT}/rules/rule-<topic>.md` 拿完整内容, 按其执行
- **同一会话内同一规则只 Read 一次**, 后续轮次不重复 Read

## 不要

- 把本文件当作具体规则执行——本文件**只**给出"什么时候读什么", 具体动作必须 Read 对应 rule
- 跳过触发判断, 一上来 Read 所有 rules——浪费 context, 违背渐进式加载初衷
- 触发条件含糊——新增条目时必须给具体陈述, 不写"看情况 / 需要时"

---

## 规则清单

### superpowers-brainstorming
**触发**: 即将执行 `superpowers:brainstorming` skill, 或用户要求写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec, 或 brainstorming 走到 step 5
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md`
**摘要**: 覆盖 brainstorming step 5 "写设计文档"环节, 工作流改成 worktree → write → review → render 四步, 设计文档落 `docs/plans/{username}/yymmdd-<topic>-design.md`

### git-worktree
**触发**: 即将执行 `superpowers:using-git-worktrees` skill, 或用户要求创建 worktree, 或在 worktree 内跑命令报"env var missing / config 不存在"等需从主仓 cp gitignored 文件
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-worktree.md`
**摘要**: worktree 一律落项目同级 `<project>-<branch_flat>/`, 推翻 skill 默认的 `.worktrees/` 等三种路径; 含 env / config 文件 cp 标准动作

### push-summary
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」, 或英文等价问法
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤ 200 字, 含基础内容 (覆盖 push range 全部 commit, 不漏) + 重点评测 (亮点 / 风险 / 未验证项)

### git-inspection
**触发**: 即将连续跑 ≥2 个 git read-only 命令 (status / diff / log / show / branch / ls-files / remote -v 等)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-inspection.md`
**摘要**: read-only inspection 命令默认用 `&&` 串成一个 Bash call, 各段间插 `echo "---<label>"` 分隔, 减少 turn 浪费

---

## 维护

新增 rule 时:

1. 新建 `rules/rule-<topic>.md` (一个 topic 一个文件, 命名 kebab-case)
2. 在本文件「规则清单」下追加一段, 含 **触发** / **读** / **摘要** 三行
3. **不**改 `hooks/inject-rules.sh` MODEL_FILES 桶——rule 文件不进 model 层, sanity check 会扫本文件确认 rule 已被路由

孤儿 rule (在 `rules/` 下但本文件没引用) 会在 SessionStart hook stderr 警告——agent 触发不到这种 rule, 修法: 加进本文件清单, 或者删 rule 文件.
