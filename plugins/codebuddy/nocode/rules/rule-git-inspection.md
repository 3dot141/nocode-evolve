---
name: git-inspection
description: >-
  连续要跑 ≥2 个 git 只读命令 (status/diff/log/show/branch/ls-files/
  remote -v 等) 时触发, 默认用 && 串成一个 Bash call, 减少 turn 浪费。
  不触发: 命令间有运行时依赖、需要看到中间失败步骤之后的输出、步骤之间
  需要用户决策。
skip: false
---

# git inspection — 多步合一

## 原则

git 的 read-only inspection 命令（`status` / `diff` / `diff --cached` / `log` / `show` / `branch` / `ls-files` / `remote -v` / `pwd` / `ls`）之间**一般没有运行时依赖**——上一步的输出不会决定下一步要不要跑.

散开成多次 Bash call 浪费 turn + 丢失上下文连续性. **默认把多步 inspection 用 `&&` 串成一个 bash call.**

## 典型 pattern

**commit 前最小 sanity**：
```bash
git status -s && echo "---staged" && git diff --cached --stat
```

**branch state + 远端跟踪**：
```bash
git branch -vv && git remote -v && git log --oneline -5
```

**确认当前位置 + 状态**（worktree 跨目录 add / 调研前）：
```bash
pwd && git status -s
```

**两个 commit 对比**：
```bash
git show --stat <sha-a> && echo "===" && git show --stat <sha-b>
```

**合命令时插 `echo "---<label>"` 隔开输出段**，单一长 stdout 才能分辨各段属于哪条命令.

## 何时**不**合命令

- 命令之间有运行时依赖（上一步输出影响下一步选择）
- 任一步 fail 但 fail-fast 不合适（`&&` chain 中间 fail 会跳过后续，想看全部用 `;` 或分开）
- 步骤之间需要 user 决策

## 反例

❌ 4 次 Bash call：
```
ls
git status -s
pwd
git diff HEAD <path>
```

✅ 1 次：
```bash
pwd && ls && git status -s && echo "---" && git diff HEAD <path>
```
