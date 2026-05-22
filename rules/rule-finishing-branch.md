# superpowers:finishing-a-development-branch 行为覆盖 + 扩展

执行 `superpowers:finishing-a-development-branch` skill 时, 本文规则覆盖 + 扩展 skill 内默认值. 若与 skill 内文冲突, **以本规则为准**.

本文件是**门面** (~80 行): 触发 + 4 选项菜单 + 子文件路由表 + 工具栈检测. 真实指令在 `rule-references/rule-finishing-branch/` 子目录, agent 按 disposition 按需 Read.

## 触发

- **即将执行** `superpowers:finishing-a-development-branch` skill (sp skill 内的自动调用 / `Skill` tool 显式 invoke)
- **或用户说**「完成 worktree / 收尾 / 合并 worktree / 提 PR / 创建 PR / 合并到 main / 合并到 release / 删 branch / discard worktree」, 中英文同义等价 (containing "finish branch" / "create PR" / "submit PR" / "merge worktree" / "discard branch" 等)

**不触发**:
- 单纯问 "我在哪个 branch / worktree 状态如何 / 当前 PR 列表" — 查询不进收尾流程
- 已经在 PR review 阶段 / PR 已合并 — 那是 review-receiving / merge-after 场景

## Step 0: 工具栈检测 + skill overlay 启用

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
remote_url=$(git -C "$MAIN_ROOT" remote get-url origin)
```

按 `$remote_url` 子串判 toolchain:

| 匹配 | toolchain |
|---|---|
| 含 `"bitbucket."` (cloud + 自建 DC, 通用 hostname 特征) | `bkt` |
| 含 `"github.com"` (云 + GHE 也含 `github` 子串) | `gh` |
| 否则 (私域 git host: GitLab self-hosted / Gitea / 公司内部仓库) | **askUser** "工具栈不确定 (remote=$remote_url), 选 [gh / bkt / 跳过 PR]" |

> v1 仅覆盖 `gh` + `bkt` 两个工具栈. GitLab `glab` / Gitea / SourceHut 等不在 v1 — 私域 git host 走 askUser 兜底, 不擅自归类.

Read `rule-references/rule-finishing-branch/skill-overlay.md` 加载与 sp skill 的覆盖关系大表 (worktree provenance 扩展 + option 2 占位符替换 + option 2 单 gh 假设替换).

## Step 1: Verify Tests

sp skill 自带行为, 不改: tests fail → hard stop, 不进 4 选项菜单. 用户先修 tests 再重跑 finishing 流程.

## Step 2: Present 4 选项菜单

sp skill 默认文案 + 顺序 + 编号不改:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work
```

**Detached HEAD**: sp skill 给 reduced 3 选项 (无 merge), 本规则不改.

## Step 3: 按选项分发 — 子文件路由表

| Option | 主要动作 | 涉及 Gate | Read 子文件 (按需) |
|---|---|---|---|
| **1. Merge 回 base** | commit 整理 → 显示 merge 计划 → Gate M → 本地 merge → tests → cleanup worktree → 删 branch | Gate M | `commit-tidy.md` |
| **2. Push + 建 PR** | commit 整理 → 生成 title/body → Gate TB → PR 计划 → Gate PR → push (含 non-ff fallback) → 建 PR → reviewer add | Gate TB + Gate PR | `commit-tidy.md`, `pr-flow-gh.md`; 若 `toolchain == "bkt"` **额外** `pr-flow-bkt-appendix.md` |
| **3. Keep as-is** | 一行报告 worktree 路径; **不动**任何文件; 不删 branch | (无) | (无) |
| **4. Discard** | 显示将删 (branch / commits / worktree path) → typed `discard` 字面确认 → cleanup worktree → force delete branch | Gate D | (无, Gate D 在 sp skill 自带) |

按用户选项 Read 对应子文件, 由子文件接管细节.

## 4 Gate Summary

| Gate | 位置 | 内容 | 用户响应 |
|---|---|---|---|
| **Gate M** (Merge Plan) | option 1, commit 整理后 | "将 merge `<branch>` → `<base>`, 删 worktree `<path>`, 删 branch `<name>`" | OK → 执行; 改主意 → 回 4 选项菜单 |
| **Gate TB** (Title/Body) | option 2, commit 整理后 | 草稿 title (≤50 字) + 完整 body markdown (引用 `rule-push-summary.md` 输出契约: ≤200 字, 基础内容 + 重点评测) | OK → 进 Gate PR; 改 → agent 重生成 → 再 Gate TB (循环) |
| **Gate PR** (PR Plan) | option 2, Gate TB 后 | `push: origin/<branch>` + `source: <owner>:<source-branch>` + `target: <owner>:<target-branch>` + `reviewer: <list>` | OK → 执行 push+create+reviewer; 改任一字段 → 局部更新 → 再 Gate PR (不重生成 title/body) |
| **Gate D** (Discard) | option 4 | "将删 branch `<name>` + commits `<list>` + worktree `<path>`" | typed `discard` **字面**才执行; 任何其他响应 (含 'yes' / 'y' / 'OK' / 'confirm') 都算否定, 回菜单 |

## 不要

- 不要重写 sp skill 4 选项菜单文案 / 顺序 / 编号 — overlay 只覆盖 3 段 (worktree provenance / option 2 占位符 / 单 gh 假设), 菜单层不动
- 不要假设 toolchain — 私域 git host **必须** askUser, 不擅自归类为 gh / bkt
- 不要自动 `git push --force` / `--force-with-lease` — non-ff 用户 typed `force` 字面才执行 (见 `pr-flow-gh.md` Step 5)
- 不要 `gh pr create` / `bkt api POST pull-requests` 时塞 `--reviewer` / `reviewers` 字段 — 单 user 错会让 PR 都建不出来. 拆"create 不带 reviewer + 单独 edit 加"
- 不要 `bkt api --method PUT` 改 PR 元数据 — PUT 全量替换会清 reviewer 数组. 一律 `bkt pr edit`
- 不要在 option 2 完成后立刻 merge — 终态是 PR 提交并加 reviewer, merge 走 review 流程或另一轮 finishing-branch (这次选 option 1)
- 不要清理 option 2 的 worktree — sp skill Step 6 已说 "Do NOT clean up worktree" for option 2, 用户需要 iterate on PR feedback
