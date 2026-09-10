# worktree 准备（改动停在 base/长期分支 → 建 feature worktree 迁移，Step 3 fallback 细则）

**默认路径：改动直接提交**——已在 feature worktree / feature 分支上 → 就地 commit（Step 2c 工作目录统一 commit），不建任何 worktree。本文件只覆盖 fallback：land 时发现当前停在 base/长期分支（main / release / master）且工作树有未提交改动——就地提交会把 feature 改动 commit 到长期分支，才需要建 worktree 把改动装进 feature 分支。

## 为什么不在当前 worktree 裸 `checkout -b`

裸开分支会把 base/长期分支的 worktree 切到 feature 分支——长期分支现场被占用。一分支一 worktree：feature 分支要有自己的 worktree，本文件是该原则在 land 场景的落地流程。

## 材料收集阶段（SKILL.md Step 2c，进全景前）

**base 新鲜度检测**——当前分支就是 base，改测 base 相对远程的落后：

```bash
remote=$(git config branch."$BASE".remote); remote="${remote:-origin}"
git fetch "$remote" 2>/dev/null
behind=$(git rev-list --count HEAD.."$remote/$BASE" 2>/dev/null || echo "?")
```

- behind > 0 → 全景风险项 `⚠ base behind N`，附一句「新 worktree 基于本地 HEAD；如需基于远程最新，在全景回应中说明」
- **不静默 fetch 换 base**——stash 迁移以本地 HEAD 为 diff 基准，静默换 base 会引入 apply 冲突风险；该决策交全景

## 执行阶段（全景确认后，先于文档同步）

### 1. 建 worktree（平级路径，目录名扁平）

```bash
repo_name=$(basename "$MAIN_ROOT")            # MAIN_ROOT 已由 SKILL.md Step 2a 解析
branch_flat="${BRANCH//\//_}"                 # feature/foo → feature_foo，仅目录名
worktree_path="$(dirname "$MAIN_ROOT")/${repo_name}-${branch_flat}"

git -C "$MAIN_ROOT" worktree add "$worktree_path" -b "$BRANCH" "$BASE"
# $BRANCH 用原始分支名（含 /）——扁平化只作用于目录名，git 分支名不变
# $BASE = 当前所在的 base 分支（改动基于它的本地 HEAD）
```

### 2. 回写 nocode-base（闭环 SKILL.md Step 2e 单源解析）

```bash
git -C "$worktree_path" config branch."$BRANCH".nocode-base "$BASE"
```

> 写本地 base 分支名而非 `origin/<base>`：改动基于本地 HEAD，diff / merge-base 以本地名为锚不漂移。Step 2e 第一优先级读此 config；漏写 = 退化到 `@{upstream}`。

### 3. 进入新 worktree（平台原生）

Claude 用 `EnterWorktree(path)` 持久化切换；Codex 后续操作绑定该绝对路径为 workdir；Pi 全部命令使用绝对路径。进入后到清理完成，不在主仓与原 worktree 之间来回切。

### 4. stash 迁移未提交改动

```bash
# 原 worktree：
git stash push -u -m "land-$BRANCH"
sha=$(git stash list --format='%H' -n 1)     # 记下 stash SHA——stash 栈跨 worktree 共享，禁裸 pop
# 新 worktree：
git -C "$worktree_path" stash apply "$sha"
# 确认迁移完整（status 对齐）后回原 worktree：
git stash drop "$sha"
```

### 5. 后续动作全在新 worktree

文档同步 / commit 整理 / push / PR 全部在 `$worktree_path` 内执行；原 worktree 留在 base 分支不动。合并后按三件套清理正常 remove 新 worktree；**原 worktree 永不进入清理范围**。

## 短命 worktree 边界

land 建的 worktree 生命周期 = stash 迁移 → git 操作 → README 写入 → 合并清理，全程**不跑依赖 install、不 cp env / IDE 配置**——上述动作不需要它们，补齐留给需要长期工作的场景。例外：disposition 为 Keep（worktree 保留）时，全景提示「保留后如需继续开发，依赖 / env 补齐自行处理」。

## 不要

- 不要在当前 worktree 裸 `checkout -b` / `switch -c`——切走长期分支现场，一分支一 worktree
- 不要用 `_` 以外的字符替换分支名里的 `/`（目录名统一 `_`，可逆识别）
- 不要把 git 分支名本身扁平化——`worktree add -b` 仍传原始分支名
- 不要静默 fetch 换 base——stash apply 以本地 HEAD 为基准，换 base 引入冲突风险；落后差距进全景风险项
- 不要漏 nocode-base 回写——Step 2e 第一优先级读它，漏写 = 单源断裂
- 不要给短命 worktree 跑 install / env cp——Keep 场景例外，全景提示即可
- 不要把原 worktree 加进清理范围——只清新建的 feature worktree
