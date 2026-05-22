# superpowers:finishing-a-development-branch skill 行为覆盖

执行 `superpowers:finishing-a-development-branch` skill 时, 本文规则覆盖 skill 内默认值. 若与 skill 内文冲突, **以本规则为准**.

被门面 `rules/rule-finishing-branch.md` 在 Step 0 加载. 单独触发: 当 agent 走偏 sp skill 默认 (worktree provenance 不识别 / PR title-body 用占位符 / option 2 直跑 gh) 时, Read 本文档对齐.

## 推翻段 (精确指出推翻 skill 内哪 3 段)

skill `SKILL.md` 中下列默认行为**全部失效**, 按本文执行:

| skill 内默认 (含位置) | 本规则覆盖为 |
|---|---|
| **Step 6 Cleanup Workspace** 的 worktree provenance check (识别 `.worktrees/` / `worktrees/` / `~/.config/superpowers/worktrees/` 才清理, 否则当 harness-owned 不动) | **扩展识别表**为四种路径模式: 原三种 **或** plugin `<project>-<branch_flat>/` 平级路径 (per `rules/rule-git-worktree.md`). 平级路径示例: `/Users/yes365/AI/nocode-evolve-feature_foo`. option 1/4 触发 cleanup 时认这四种任一, 不再当 harness-owned. |
| **Step 5.Option 2 Push and Create PR** 的 PR title/body 默认占位符 (`gh pr create --title "<title>" --body "..." `, body 是 `## Summary\n<2-3 bullets>\n## Test Plan\n- [ ] <verification steps>`) | 改调 `rules/rule-push-summary.md` 输出契约: 标题 ≤50 字 (提炼最大变更轴), 描述 ≤200 字 (中文按字, 含基础内容 + 重点评测两小节). 由 `pr-flow-gh.md` 实现 Step 1 「生成 title/body」段. |
| **Step 5.Option 2** 直接 `gh pr create --title <t> --body <b>` 单工具假设 | 改按 BF0 工具栈检测分支 — `toolchain == "gh"` 走 `gh pr create` (default + GHE), `toolchain == "bkt"` 走 cross-fork JSON body POST (见 `pr-flow-bkt-appendix.md`), 私域 git host 走 askUser 兜底. |

## 保留段 (skill 默认行为不改)

- **Step 1 Verify Tests** (tests fail → hard stop, 不进 4 选项菜单)
- **Step 2 Detect Environment** (`GIT_DIR == GIT_COMMON` vs linked worktree 判定)
- **Step 3 Determine Base Branch** (`git merge-base HEAD main / master` 或问用户)
- **Step 4 Present Options** 4 选项菜单文案 (`1. Merge back / 2. Push and create PR / 3. Keep / 4. Discard`) — **不改文案不改顺序**
- **Step 5.Option 1 Merge Locally** 的 `cd MAIN_ROOT → git checkout base → git pull → git merge <feature> → 跑 tests → 失败不 cleanup` 主流程 (含 commit 整理步, 由 `commit-tidy.md` 扩展)
- **Step 5.Option 3 Keep As-Is** 全部 (一行报告, 不动 worktree)
- **Step 5.Option 4 Discard** 的 typed `discard` 字面确认 Gate (Gate D — sp skill 自带, 本 overlay 不改)
- **Step 6 Cleanup** 的命令链 (`cd MAIN_ROOT → git worktree remove → git worktree prune`) — 仅 provenance 段被推翻段扩展
- **Common Mistakes** 大部分约束 (含 "Cleaning up worktree for Option 2" — 永远不删 PR 路径的 worktree)
- **Red Flags** 全部 (含 "Never force-push without explicit request" — Option 2 push non-ff 时遵守, 见 `pr-flow-gh.md` Step 5 异常)

## 不要

- 不要重写 sp skill 4 选项菜单文案 / 顺序 / 编号——只覆盖上方 3 段, 其余原样不动
- 不要把 plugin `<project>-<branch_flat>/` 平级模式 commit 进 sp skill 源文件——上游 sp 不识别我们的 worktree 命名, overlay 是 plugin 端的 graft (类比 `rules/rule-git-worktree.md` 的覆盖模式)
- 不要绕过 typed `discard` 字面 Gate——sp skill 自带, overlay 保留, 任何"yes / y / OK" 都算否定
- 不要在 overlay 内塞 commit 整理 / PR 流程具体命令——那是 `commit-tidy.md` / `pr-flow-gh.md` / `pr-flow-bkt-appendix.md` 的事, overlay 只列覆盖关系表
