# 远程分支处置 (Merge / Discard 路径, 全景计划的材料提供者 + 执行细则)

删本地 branch 后, 远程若留 stale 分支没人管。本文件供 Merge / Discard 路径：材料收集阶段算好「远程坐标 + 独有 commit」，全景计划里一行展示处置决策（**默认保留**），执行阶段按决策删/留。

## 适用范围

- **Merge / Discard 路径** → 用本文件（默认**保留**远程——本地合并无平台记录背书，删除不可单独反悔）
- **PR 路径不用本文件** → 远程处置在 `prflow.md`（默认**删除**——source 分支专为 PR 而生，平台 PR 页面永久保留分支记录）
- `rule-git-worktree.md` 的 worktree 移除（目录名冲突清残 / 通用销毁）只删 worktree 保留 branch —— 远程处置是"删 branch"的附属动作，不适用

## 材料收集阶段（SKILL.md Step 2e，删任何东西之前）

### 捕获远程坐标

`branch.<name>.remote` / `branch.<name>.merge` 配置在 `git branch -d/-D` 后即消失，必须此刻捕获：

```bash
remote=$(git config "branch.$BRANCH.remote")              # upstream remote 名, 如 origin
merge_ref=$(git config "branch.$BRANCH.merge")            # upstream 指向的远程 ref, 如 refs/heads/bar
if [ -z "$remote" ]; then
    remote="origin"; remote_branch="$BRANCH"              # 无 upstream: 回落 origin + 同名
else
    remote_branch="${merge_ref#refs/heads/}"              # 实际推送到的远程分支名 (未必同名)
fi
```

> 为什么取 `branch.<name>.merge` 而非本地名: 本地 `foo` 可能 track `origin/bar` (改过 upstream)。要处置的是它**实际推送到的**远程分支。

### 查远程是否有该分支

```bash
git ls-remote --heads "$remote" "refs/heads/$remote_branch"   # 精确 ref, 不通配; 直查远程, 不信滞后 tracking ref
```

- exit ≠ 0 (网络断 / 无权限) → 全景该行写「远程检查失败, 跳过远程处置」, 不阻塞
- 输出空 (远程没这分支) → 全景**省略**远程分支行, 不打扰
- 有 → 算独有 commit（下一步）

### 算远程独有 commit (安全护栏)

```bash
if [ -z "$BASE_BRANCH" ]; then                  # detached / 没能定 base
    lost="UNKNOWN"
else
    if git fetch "$remote" "refs/heads/$remote_branch" 2>/dev/null; then
        lost=$(git rev-list "$BASE_BRANCH..FETCH_HEAD")   # 方向: base..tip = tip 有而 base 没有的
    else
        lost="UNKNOWN"                          # fetch 失败 (离线), 降级
    fi
fi
```

> 方向必须 `base..FETCH_HEAD`。这是"未合并进 base 的远程独有 commit"，**不**等于"删远程后永久丢失"——可能仍被其他 ref 引用。文案据此措辞，不绝对化。

## 全景计划行（材料 → 展示）

```
远程分支  <remote>/<remote_branch>: 保留（默认）；改「删」则删（<commit 文案>）
```

`<commit 文案>` 三态：

- `lost` 非空 → "删除会移除 N 个未合并进 base 的远程独有 commit: `<sha1> ...`" (最多列 5 个, 超出标 `+M more`; 附"可能仍被其他 ref 引用")
- `lost == UNKNOWN` → "未能核实远程独有 commit (fetch / base 不可用)"
- `lost` 空 → "远程已全含于 base, 删除零损失"

语气分 mode（算法相同，只差文案）：

- **Merge**: 独有 commit 是 base 没覆盖的内容，删了从远程消失 → **警示语气**
- **Discard**: 用户 typed `discard` 已表"整支丢弃"，远程残留删除符合意图 → **仅信息提示**，默认仍保留

## 执行阶段（删本地 branch 之后）

```bash
# 全景选了「删」:
git push "$remote" --delete "$remote_branch"
#   成功 → 报 "已删除远程分支 $remote/$remote_branch"
#   失败 (protected / 权限不足 / 已被删) → 报错因 + "收尾已完成, 可手动 git push $remote --delete $remote_branch"
#                                        不回滚已删的本地 branch
# 全景默认「保留」→ 报 "远程分支 $remote/$remote_branch 已保留"
```

## 不要

- 不要在 PR / Keep 路径调本文件 — PR 的远程处置在 prflow（默认删，语义相反），Keep 什么都不删
- 不要在 worktree 移除 (目录名冲突清残 / 通用销毁) 调 — 那里保留 branch，删远程会误删复用分支
- 不要假设远程分支与本地同名 — 用 `branch.<name>.merge` 解析实际远程分支名
- 不要在删本地 branch 后才捕获坐标 — 配置随分支删除消失，材料收集阶段就捕获
- 不要默认删远程 (Merge / Discard 路径) — 默认保留，全景显式改「删」才删
- 不要因远程检查失败阻塞收尾 — 全景标注 + 跳过，收尾照常完成
- 不要用裸 `<branch>` 查 ls-remote — 用 `refs/heads/<branch>` 精确 ref，防通配误匹配
- 不要把"未合并进 base 的远程独有 commit"绝对化为"永久丢失" — 可能仍被其他 ref 引用
