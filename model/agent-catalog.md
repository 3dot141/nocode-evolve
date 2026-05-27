# agent-catalog — nocode-evolve 插件级规则路由表

`rules/` 下触发式规则的索引. 渐进式加载: 会话开局自动注入 `model/*.md`; `rules/rule-*.md` 由本文件路由, 命中触发再 Read.

## 读取时机

会话开局本文件已在 context. 响应任何任务前扫一眼下方清单匹配触发. 命中: `Read ${CLAUDE_PLUGIN_ROOT}/rules/rule-<topic>.md`, 同一规则会话内只 Read 一次.

不要: 把本文件当具体规则执行 (它只给"什么时候读什么"); 跳过触发判断 Read 所有 rules (浪费 context); 新增条目触发条件含糊 ("看情况 / 需要时" 等于没触发).

---

## 规则清单

### superpowers-brainstorming
**触发**: 即将执行 `superpowers:brainstorming` skill, 或用户要求写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec, 或 brainstorming 走到 step 5
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-superpowers-brainstorming.md`
**摘要**: 写设计文档统一 worktree → write → review → render 四步, 落 `docs/superpowers/specs/{username}/yymmdd-<topic>-design.md` (按 doc-type: 设计规格→specs / 实现计划→plans / 草稿→sketches); 两条入口 (brainstorming step5 / 用户直接要求) 一致

### git-worktree
**触发**: 即将执行 `superpowers:using-git-worktrees` skill, 或用户要求创建 worktree, 或在 worktree 内跑命令报"env var missing / config 不存在"等需从主仓 cp gitignored 文件, 或 agent 在 worktree 找不到项目本地 `.agents-personal/` 路由
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-worktree.md`
**摘要**: worktree 落项目同级 `<project>-<branch_flat>/` (推翻 skill 默认 `.worktrees/` 等); 建前静默 fetch + 基于 upstream 最新 (本地 `ahead>0` 才弹问 base); 建后 cp env/config + symlink `.agents-personal/` 共享主仓; 销毁前先拆 symlink

### push-summary
**触发**: 用户 push 后说「总结 push 内容 / 给标题描述 / PR description / 沉淀这个 / 这次 push 包含什么」, 或英文等价问法
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-push-summary.md`
**摘要**: 输出 标题 + 描述, 描述 ≤ 200 字, 含基础内容 (覆盖 push range 全部 commit, 不漏) + 重点评测 (亮点 / 风险 / 未验证项)

### git-inspection
**触发**: 即将连续跑 ≥2 个 git read-only 命令 (status / diff / log / show / branch / ls-files / remote -v 等)
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-git-inspection.md`
**摘要**: read-only inspection 命令默认用 `&&` 串成一个 Bash call, 各段间插 `echo "---<label>"` 分隔, 减少 turn 浪费

### finishing-branch
**触发**: 即将执行 `superpowers:finishing-a-development-branch` skill, 或用户说「完成 worktree / 收尾 / 合并 / 提 PR / 创建 PR / 合并到 main / 合并到 release / 删 branch / discard worktree」
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-finishing-branch.md`
**摘要**: 覆盖 + 扩展 superpowers skill, 4 选项 (merge/PR/keep/discard); Gate 体系 M/TB/PR/D/RD (RD=删本地 branch 后清远程同名分支, option 1/4); gh 主, Bitbucket DC 读 bkt 附录; 子文件在 `rule-references/rule-finishing-branch/` 按 disposition 渐进式 Read

### codex-review
**触发**: `red-blue-deep` 判重档走到红军环节; 或完成分支 / 显式 review 请求 (review 一下 / 看这次改动有没有问题); 或我卡住 / 想要第二实现 / 独立诊断 / 把成块实现委派出去; 或 `design-doc-writing` 走到 review 环节审重档设计文档
**读**: `${CLAUDE_PLUGIN_ROOT}/rules/rule-codex-review.md`
**摘要**: 本机 Codex 当独立模型接四场景 (红蓝红军 / 代码 review 收尾 / 委派救援 / 设计文档审稿), 直接 Bash 调 `vendor/codex/scripts/codex-companion.mjs` 的 verb (`task` 只读 / `review` / `adversarial-review` / `task --write`); 先 `setup --json` 探, 不可用降级自做 + 明说; 禁改 vendored 文件

---

## 维护

新增 rule: 写 `rules/rule-<topic>.md` (kebab-case, 一个 topic 一文件) → 在「规则清单」追加 `### <topic>` + **触发** / **读** / **摘要** 三行段. 不改 `hooks/inject-rules.sh` (rule 不进 model 桶, sanity check 扫本文件确认路由).

孤儿 rule (在 `rules/` 但本文件没引用) SessionStart hook stderr 警告. 修法: 加进清单或删 rule 文件.
