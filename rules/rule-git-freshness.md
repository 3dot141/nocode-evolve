# git-freshness — 设计 / 方案动作前确保基于最新远程代码

设计 / 方案 / 选型 / 重构若**建立在过时代码上** → 方案与现状脱节、落地时返工。动手设计前先确保当前分支 == 远程最新。

## 与 `rule-git-worktree` 的边界（防重叠）

两条 rule 都做"fetch + 基于最新",但**场景互斥，不重复触发**：

| 场景 | 谁负责 |
|---|---|
| **走 worktree 的设计**（`rule-superpowers-brainstorming` step1 开 worktree） | `rule-git-worktree` —— 建分支前已 `fetch` + 基于 `@{u}` 最新建,本 rule **不触发** |
| **不走 worktree / 就地在当前分支设计** | **本 rule 接管** —— 当前分支 fetch + 拉到最新 |

判据:**已经开 / 将开 worktree → 不走本 rule**(那条链的 fetch 已覆盖);否则走本 rule。

## 门禁步骤（就地场景，粘贴可用）

```bash
# 设计 / 方案动作前: 确保当前分支基于最新远程
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)   # 如 origin/main
if [ -z "$upstream" ]; then
    echo "WARN: 无 upstream / detached → 未拉最新, 基于本地 HEAD 设计 (回复点名告知)"   # 不阻断
else
    git fetch "${upstream%%/*}" 2>/dev/null || echo "WARN: fetch 失败 (离线?) → 基于本地 HEAD, 回复点名告知"
    behind=$(git rev-list --count "HEAD..@{u}" 2>/dev/null || echo 0)   # 落后远程的 commit 数
    ahead=$(git rev-list --count "@{u}..HEAD" 2>/dev/null || echo 0)    # 本地独有 (未 push) commit 数
    if [ "$behind" -eq 0 ]; then
        : # 已是最新 (behind=0) → 直接开始设计, 零摩擦
    elif [ "$ahead" -eq 0 ]; then
        git pull --rebase   # 纯落后, 无本地独有 commit → 安全拉到最新
    else
        # ahead>0 && behind>0: 本地有未 push commit 且落后远程 → pull --rebase 可能冲突
        echo "本地 ahead=$ahead behind=$behind: 有未 push commit + 落后远程。弹问用户三选: ① pull --rebase (可能要解冲突) ② 基于本地 HEAD 设计 (接受可能过时) ③ 先手动处理再来"
    fi
fi
```

与 `rule-git-worktree` 的 fetch 逻辑同源(都看 `ahead`/`behind`),差别:本 rule 动作是**当前分支 `pull --rebase` 到最新**,worktree rule 是**基于 `@{u}` 建新分支**。

## 触发 / 不触发

**触发**: 即将开始**设计性**动作 —— 写设计文档 / PRD / RFC / ADR、方案对比、技术选型、重构方案、架构设计 —— 且**不走 worktree**(就地在当前分支)。

**不触发**:
- 开 / 将开 worktree（`rule-git-worktree` 的 fetch 已覆盖）
- 纯执行 / 查询 / 小 bugfix（非设计性,不值得每次 fetch 打断）
- 已在本会话内 fetch 过且无新远程改动

## 机制化局限（诚实标注）

本 rule 是 **behavior 触发**(像 `git-inspection`)——"即将设计"不是一条 Bash 命令,**PreToolUse 拦不到**,UserPromptSubmit regex 也只能命中部分设计类措辞。所以它主要靠 catalog 路由 + 设计类词 hook 提醒 + agent 自觉,**深度负载下不保证必触发**。这是 behavior 触发 rule 的固有上限(见 RFC-001 深度遵守命题),非本 rule 独有。
