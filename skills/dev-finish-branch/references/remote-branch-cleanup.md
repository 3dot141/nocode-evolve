# 删本地 branch 后清理远程分支 (Gate Remote-Delete, option 1 + 4 共用)

删本地 branch 后, 远程若留 stale 分支没人管. 本子过程探测并询问清理.

## 触发

被 `dev-finish-branch` skill 在 **option 1 (Merge) / option 4 (Discard) 删完本地 branch 后**调用. 其它场景**不**调:

- option 2 (PR) / option 3 (Keep) 不删本地 branch
- `rule-git-worktree.md`「目录名冲突怎么办」/「销毁 worktree 前必读」两处 worktree 移除只删 worktree、保留 branch —— 远程清理是"删 branch"的附属动作, 不是"删 worktree"

## 关键时序: 删 branch 前先捕获远程坐标

`branch.<name>.remote` / `branch.<name>.merge` 配置在 `git branch -d/-D` 后即消失. 必须在删本地 branch **之前**捕获 (沿用门面 option 1/4 的 `$BRANCH`):

```bash
# === 删本地 branch 之前执行 ===
remote=$(git config "branch.$BRANCH.remote")              # upstream remote 名, 如 origin
merge_ref=$(git config "branch.$BRANCH.merge")            # upstream 指向的远程 ref, 如 refs/heads/bar
if [ -z "$remote" ]; then
    remote="origin"; remote_branch="$BRANCH"              # 无 upstream: 回落 origin + 同名
else
    remote_branch="${merge_ref#refs/heads/}"              # 取实际推送到的远程分支名 (未必同名)
fi
# ... 门面原有的"删本地 branch"动作在此 (option 1: git branch -d / option 4: git branch -D) ...
```

> 为什么取 `branch.<name>.merge` 而非本地名: 本地 `foo` 可能 track `origin/bar` (改过 upstream). 要清理的是它**实际推送到的**远程分支, 不能假设同名.

## 流程 (删本地 branch 之后)

### Step 1: 查远程是否有该分支

```bash
git ls-remote --heads "$remote" "refs/heads/$remote_branch"   # 精确 ref, 不通配; 直查远程, 不信滞后 tracking ref
```

- exit ≠ 0 (网络断 / 无权限 / remote 不存在) → **warn 一行 + 跳过, 不阻塞收尾**:
  `echo "远程检查失败($remote), 跳过远程清理, 收尾不阻塞"` → return
- 输出空 (远程没这分支; 常见: 纯本地分支 / 已被别人删) → **静默跳过**, 不打扰 → return
- 有 (输出 `<sha>\trefs/heads/<remote_branch>` 一行) → 进 Step 2

### Step 2: 算远程独有 commit (安全护栏)

算"未合并进 base 的远程独有 commit" (远程 tip 可达、base 不可达):

```bash
# base 来自 dev-finish-branch Step 3 Disposition (4 选项菜单前已定)
if [ -z "$BASE_BRANCH" ]; then                  # detached / 没能定 base
    lost="UNKNOWN"                              # 无基准可比, 降级
else
    if git fetch "$remote" "refs/heads/$remote_branch" 2>/dev/null; then
        lost=$(git rev-list "$BASE_BRANCH..FETCH_HEAD")   # 方向: base..tip = tip 有而 base 没有的
    else
        lost="UNKNOWN"                          # fetch 失败 (离线), 降级
    fi
fi
```

> 方向必须 `base..FETCH_HEAD`. 这是"未合并进 base 的远程独有 commit", **不**等于"删远程后全仓库不可达/永久丢失"—— 它们可能仍被其他 branch/tag 引用. 文案据此措辞, 不绝对化.

语气分 mode:

- **Merge**: base 已含本次合并工作, 这些独有 commit 是 base 没覆盖的, 删远程后从远程消失 → **警示**
- **Discard**: 用户已 typed `discard` 表"整支丢弃", 这些是被丢弃分支的远程残留, 删除符合意图 → **仅信息提示**, 不阻塞、默认仍保留
- 两 mode 算法相同, 差异只在 Gate Remote-Delete 文案语气

### Step 3: Gate Remote-Delete — 询问是否删远程

AskUserQuestion, **默认保留** (列首):

```
[Gate Remote-Delete] 删本地 branch 后, 远程仍有 <remote>/<remote_branch>. 删除远程分支?
  ① 保留远程分支 (默认)
  ② 删除远程分支 <commit 文案>
```

`<commit 文案>` 三态:

- `lost` 非空 → "删除会移除 N 个未合并进 base 的远程独有 commit: `<sha1> <sha2> ...`" (最多列 5 个, 超出标 `+M more`; 附"可能仍被其他 ref 引用")
- `lost == UNKNOWN` → "未能核实远程独有 commit (fetch / base 不可用)"
- `lost` 空 → "远程已全含于 base, 删除零损失"

判定: 用户选 ② 才删; 选 ① 或任何其它响应一律保留.

### Step 4: 执行

```bash
# 选 ② 删除:
git push "$remote" --delete "$remote_branch"
#   成功 → 报 "已删除远程分支 $remote/$remote_branch"
#   失败 (protected branch / 权限不足 / 已被删) → 报错因 + "收尾已完成, 可手动 git push $remote --delete $remote_branch"
#                                              不回滚已删的本地 branch
# 选 ① 保留 → 报 "远程分支 $remote/$remote_branch 已保留"
```

## 不要

- 不要在 option 2 (PR) / option 3 (Keep) 调本子过程 —— 它们不删本地 branch
- 不要在 worktree 移除 (目录名冲突清残 / 通用销毁) 调 —— 那里保留 branch, 删远程会误删复用分支
- 不要假设远程分支与本地同名 —— 用 upstream `branch.<name>.merge` 解析实际远程分支名
- 不要在删本地 branch 后才读 `branch.<name>.remote/merge` —— 配置随分支删除消失, 必须删前捕获
- 不要默认删远程 —— 默认保留, 选 ② 显式才删 (远程删除不可单独反悔)
- 不要因远程检查失败阻塞收尾 —— warn + 跳过, 收尾照常完成
- 不要用裸 `<branch>` 查 ls-remote —— 用 `refs/heads/<branch>` 精确 ref, 防通配误匹配
- 不要把"未合并进 base 的远程独有 commit"绝对化为"永久丢失" —— 可能仍被其他 ref 引用
