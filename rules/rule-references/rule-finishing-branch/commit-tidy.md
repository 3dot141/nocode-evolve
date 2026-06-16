# Commit 整理建议 (option 1 + 2 共用)

PR / merge 前给用户列 commit 整理建议 + 完整命令, 用户**自跑或跳过**. agent 不自动跑 rebase (per spec Q4 决策).

## 触发

被门面 `rule-finishing-branch.md` 在 option 1 (merge) 或 option 2 (push+PR) 流程内调用. 进入 Gate Merge / Gate Title-Body 前.

## 主流程

```
1. 列 push range commit         agent 跑 git log
2. 按判定规则给建议             agent 判定 + 列建议
3. 给完整命令                   agent 输出 (用户复制运行)
4. 等用户响应                   "已整理" / "跳过"
5. 进 Gate Merge / Gate Title-Body         门面流程接管
```

## Step 1: 列 push range commit

```bash
# 在 worktree 内执行
base_branch="${BASE_BRANCH:-main}"   # 一般是 main / master / release
git log --oneline "$(git merge-base HEAD $base_branch)..HEAD"
```

## Step 2: squash 判定规则

agent 扫每个 commit 的 subject (短 sha 后第一行), 按下列规则建议:

| 模式 | 建议 |
|---|---|
| 连续 ≥2 个 commit 含关键字 `wip` / `tmp` / `fixup` / `fix typo` / `wip:` / `tmp:` / `WIP` / `TMP` (大小写不敏感) | **squash** 这一串合一个 |
| 单个 commit message 不符合 conventional commits (无 `<type>(<scope>):` 前缀, 如 `<type>` 为 `feat`/`fix`/`docs`/`refactor`/`test`/`chore`) | **reword** 改成规范格式 |
| 某 commit subject 是 "fix typo in X" / "address review comment Y" 且引用之前的 commit | **fixup** 到目标 commit |
| 都不命中 (commit 全部规范且独立有意义) | **不建议整理** — 不强迫 reword 一切 |

## Step 3: 给完整命令模板

### 命令: squash 连续 N 个 WIP commit

```bash
# 假设最近 4 个 commit 是 ["feat: 主体", "wip: 1", "wip: 2", "wip: 3"]
# 想把 3 个 wip 合到主体
git rebase -i HEAD~4
# 编辑器内:
#   pick   <sha1> feat: 主体
#   squash <sha2> wip: 1     ← pick → squash
#   squash <sha3> wip: 2     ← pick → squash
#   squash <sha4> wip: 3     ← pick → squash
# 保存后弹出 message 编辑界面, 删 wip 行只留主体 message
```

### 命令: autosquash (commit 已用 `--fixup` 标记)

```bash
# 创 fixup commit 标记
git add <changes>
git commit --fixup=<sha-of-target>

# 一次性 autosquash (无需手编辑 instruction)
git rebase -i --autosquash HEAD~N
# GIT_SEQUENCE_EDITOR=true 可以全自动接受默认 instructions (注意: 仍可能弹 message edit)
```

### 命令: reword 单个 commit

```bash
git rebase -i HEAD~N
# 编辑器内找到目标 commit 行:
#   reword <sha> 原 message       ← pick → reword
# 保存后弹出 message 编辑界面, 改写
```

### 命令: 列已 push 的 commit 仍在 origin (避免误改 published commit)

```bash
git log origin/<branch>..HEAD --oneline    # 仅本地未 push 的 commit, 这些可以安心 rebase
git log "$(git merge-base HEAD $base)..HEAD" --oneline   # PR range 全部, 含已 push (改了要 force-push)
```

> 若 commit 已 push 到 remote 然后 rebase 改了, 重 push 需要 `--force-with-lease` (Option 2 push 步会撞 non-ff, 走 Gate force-push 流程).

## Step 4: 输出 + 等用户响应

agent 输出格式:

```
当前 push range N 个 commit:
  abc123 feat: 主体
  def456 wip: 1
  ghi789 wip: 2

建议整理:
  - squash def456 + ghi789 合并到 abc123 (2 个 wip 触发判定)

复制运行:
  git rebase -i HEAD~3
  (编辑器内把 def456/ghi789 的 pick 改成 squash, 保存)

完成后回我 "好了" / "跳过", 进 [Gate Merge / Gate Title-Body].
```

等用户响应 "已整理 / 整理完成 / OK / 跳过 / 不动" 之一, 再进下一步.

## 不要

- **不要 agent 自动跑 rebase** — 交互式 rebase fail 会破坏 history; `GIT_SEQUENCE_EDITOR=true` 自动模式遇到 conflict 也会 hang, agent 没人工干预能力. 给命令让用户跑.
- **不要强迫用户整理** — "跳过 / 不整理" 是合法响应, agent 不二次劝诱
- **不要建议 reword "一切不符合 conventional commits 的 commit"** — 只对明显问题 commit (含 wip / typo / 引用之前) 建议; 其他 message 即便不规范也是历史现实, 让用户自己决定
- **不要在 commit-tidy 阶段加额外 lint** (commit-msg hook / branch name 校验等) — 那是 pre-commit hook 的事, 不在本流程
- **不要建议 squash 已 push 到 remote 的 commit** 除非 toolchain 是单仓直推且 force-push 安全 — 跨 fork PR (Bitbucket 上游 / GitHub PR) 已 push 的 commit rebase 会要求 force-push, 增加 Gate PR 复杂度. 建议: 整理只针对**未 push** 的 commit, 已 push 的留给 reviewer comment 触发的修订.
