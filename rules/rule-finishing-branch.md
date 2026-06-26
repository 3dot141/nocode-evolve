# nocode-evolve:finishing-a-development-branch 行为覆盖 + 扩展

执行 `nocode-evolve:finishing-a-development-branch` skill 时, 本文规则覆盖 + 扩展 skill 内默认值. 若与 skill 内文冲突, **以本规则为准**.

本文件是**门面** (~80 行): 触发 + 4 选项菜单 + 子文件路由表 + 工具栈检测. 真实指令在 `rule-references/rule-finishing-branch/` 子目录, agent 按 disposition 按需 Read.

## 触发

- **即将执行** `nocode-evolve:finishing-a-development-branch` skill (sp skill 内的自动调用 / `Skill` tool 显式 invoke)
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
| **1. Merge 回 base** | commit 整理 → 显示 merge 计划 → Gate Merge → 本地 merge → tests → cleanup worktree → (删 branch **前**捕获远程坐标) 删 branch → remote 分支清理 (Gate Remote-Delete) | Gate Merge + Gate Remote-Delete | `commit-tidy.md`, `remote-branch-cleanup.md` |
| **2. Push + 建 PR** | commit 整理 → 生成 title/body → Gate Title-Body → PR 计划 → Gate PR → push (含 non-ff fallback) → 建 PR → reviewer add → Gate Worktree-Cleanup (worktree 清理提示) | Gate Title-Body + Gate PR + Gate Worktree-Cleanup | `commit-tidy.md`, `pr-flow-gh.md`; 若 `toolchain == "bkt"` **额外** `pr-flow-bkt-appendix.md` |
| **3. Keep as-is** | 一行报告 worktree 路径; **不动**任何文件; 不删 branch | (无) | (无) |
| **4. Discard** | 显示将删 (branch / commits / worktree path) → typed `discard` 字面确认 → cleanup worktree → (force delete branch **前**捕获远程坐标) force delete branch → remote 分支清理 (Gate Remote-Delete) | Gate Discard + Gate Remote-Delete | `remote-branch-cleanup.md` (Gate Discard 在 sp skill 自带) |

按用户选项 Read 对应子文件, 由子文件接管细节.

> **(可选) 独立 Codex review**: option 2 在 push / 建 PR 前, 可加一道跨模型独立 review (见 `rule-codex-review` 场景二, 典型 `adversarial-review --base <target>`)——主动提议、用户点头再跑, 不强制、不阻断 Gate 流程; codex 不可用则跳过.

## Gate Summary

> RD 加入后 Gate 数已非 4, 标题不再带数字.

| Gate | 位置 | 内容 | 用户响应 |
|---|---|---|---|
| **Gate Merge** (Merge Plan) | option 1, commit 整理后 | "将 merge `<branch>` → `<base>`, 删 worktree `<path>`, 删 branch `<name>`" | OK → 执行; 改主意 → 回 4 选项菜单 |
| **Gate Title-Body** (Title/Body) | option 2, commit 整理后 | 草稿 title (≤50 字) + 完整 body markdown (引用 `rule-push-summary.md` 输出契约: ≤200 字, 基础内容 + 重点评测) | OK → 进 Gate PR; 改 → agent 重生成 → 再 Gate Title-Body (循环) |
| **Gate PR** (PR Plan) | option 2, Gate Title-Body 后 | `push: origin/<branch>` + `source: <owner>:<source-branch>` + `target: <owner>:<target-branch>` + `reviewer: <list>` | OK → 执行 push+create+reviewer; 改任一字段 → 局部更新 → 再 Gate PR (不重生成 title/body) |
| **Gate Discard** (Discard) | option 4 | "将删 branch `<name>` + commits `<list>` + worktree `<path>`" | typed `discard` **字面**才执行; 任何其他响应 (含 'yes' / 'y' / 'OK' / 'confirm') 都算否定, 回菜单 |
| **Gate Worktree-Cleanup** (Worktree Cleanup) | option 2, PR 创建 + reviewer 加完后, 仅当前在 worktree (非主仓) 时弹出 | "PR 已创建, 当前在 worktree `<path>`. ① 保留 worktree(默认) ② 清理 worktree (附 PR 合并后删远程分支的提示)" | ① 保留; ② 清理 worktree + 输出合并后删远程的工具栈相关提示 (细节见 `pr-flow-gh.md` / `pr-flow-bkt-appendix.md` Step 8) |
| **Gate Remote-Delete** (Remote Delete) | option 1/4, 删本地 branch 后、远程有对应分支时 (无分支/检查失败则不弹) | "删本地 branch 后远程仍有 `<remote>/<remote-branch>`, 删除远程分支? ① 保留(默认) ② 删除 (附远程独有 commit 警示/提示, 见 `remote-branch-cleanup.md`)" | 选 ② 才 `git push --delete`; ① 或任何其它响应一律保留 |

## 不要

- 不要重写 sp skill 4 选项菜单文案 / 顺序 / 编号 — overlay 只覆盖 3 段 (worktree provenance / option 2 占位符 / 单 gh 假设), 菜单层不动
- 不要假设 toolchain — 私域 git host **必须** askUser, 不擅自归类为 gh / bkt
- 不要自动 `git push --force` / `--force-with-lease` — non-ff 用户 typed `force` 字面才执行 (见 `pr-flow-gh.md` Step 5)
- 不要 `gh pr create` / `bkt api POST pull-requests` 时塞 `--reviewer` / `reviewers` 字段 — 单 user 错会让 PR 都建不出来. 拆"create 不带 reviewer + 单独 edit 加"
- 不要 `bkt api --method PUT` 改 PR 元数据 — PUT 全量替换会清 reviewer 数组. 一律 `bkt pr edit`
- 不要在 option 2 完成后立刻 merge — 终态是 PR 提交并加 reviewer, merge 走 review 流程或另一轮 finishing-branch (这次选 option 1)
- 不要在 option 2 **自动**清理 worktree — 必须经 Gate Worktree-Cleanup 用户选择; 默认保留 (用户需要 iterate on PR feedback); 选 ② / ③ 才清理
