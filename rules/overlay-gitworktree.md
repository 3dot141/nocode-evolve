# superpowers:using-git-worktrees 行为覆盖

执行 `superpowers:using-git-worktrees` skill 时，本文规则覆盖 skill 内默认值。
若与 skill 内文冲突，**以本规则为准**。

## 核心原则：worktree 一律落在项目**同级**目录

> 不再使用 skill 内默认的 `.worktrees/`（项目内）/ `worktrees/`（项目内）/ `~/.config/superpowers/worktrees/<project>/`（用户配置目录）。

**统一路径模板**：

```
<project-parent>/<project-name>.worktrees/<branch-name>/
```

即：跟当前项目根目录 **平级**，新建一个 `<project>.worktrees/` 容器目录，所有该项目的 worktree 都丢这里按分支分子目录。

### 路径推导（粘贴可用）

```bash
project_root="$(git rev-parse --show-toplevel)"
project_name="$(basename "$project_root")"
project_parent="$(dirname "$project_root")"
worktree_container="${project_parent}/${project_name}.worktrees"
worktree_path="${worktree_container}/${BRANCH_NAME}"

mkdir -p "$worktree_container"
git worktree add "$worktree_path" -b "$BRANCH_NAME"
cd "$worktree_path"
```

### 示例

| 项目根 | branch | 最终 worktree 路径 |
|---|---|---|
| `/Users/yes365/AI/nocode-evolve` | `feature/foo` | `/Users/yes365/AI/nocode-evolve.worktrees/feature/foo` |
| `/Users/yes365/Work/Source/fx-tianwen` | `bench-restructure` | `/Users/yes365/Work/Source/fx-tianwen.worktrees/bench-restructure` |

## 为什么要平级而不是项目内

避免「同项目内多份 working tree」导致的相互干扰：

- **IDE / LSP 索引**：项目内的 `.worktrees/<branch>/` 会被索引器扫到，等于同时加载两份相同代码，符号跳转混乱、内存暴涨
- **watcher / 构建工具**：`tsc --watch` / `vite` / `webpack` / `cargo watch` / `pytest-watch` 等监听项目根，会扫到 worktree 内的镜像副本，触发循环重建
- **`find` / `grep` / `rg` 误命中**：在主仓里搜代码常常把 worktree 里的旧分支版本一起捞出来
- **意外提交**：`.worktrees/` 没加进 `.gitignore` 时会被当成主仓子目录污染 `git status`
- **跨工具不一致**：部分工具假设「项目根下只有一份源码」，混入 worktree 后行为难预测

平级目录把这些副作用一刀切——主仓里只看得见自己的代码，每个 worktree 也只看得见自己。

## 覆盖关系（精确指出推翻 skill 内哪些段落）

skill `SKILL.md` 中下列默认行为**全部失效**，按本文执行：

| skill 内默认 | 本规则覆盖为 |
|---|---|
| 「Check Existing Directories」优先 `.worktrees` / `worktrees` | 跳过——不再检测项目内目录，直接用平级模板 |
| 「Check CLAUDE.md」找 worktree 目录偏好 | 跳过——本文已是 nocode-evolve 全局偏好，不再二次询问 |
| 「Ask User」三选一菜单 | 跳过——不询问，直接用平级模板 |
| 「Safety Verification」对 `.worktrees` / `worktrees` 做 `git check-ignore` 并改 `.gitignore` | 跳过——worktree 已在项目外，不需要 ignore，也不要往项目 `.gitignore` 里加东西 |
| 「Quick Reference」表中关于 `.worktrees/` / `worktrees/` 的 4 行 | 全部失效，按本文路径模板 |

**保留**的 skill 内行为：

- 「Run Project Setup」（npm install / cargo build / pip install / go mod download 自动探测）
- 「Verify Clean Baseline」（跑测试确认起点干净，失败则报告 + 请示）
- 「Report Location」（最终报路径 + 测试状态）
- 「Common Mistakes」中除「Skipping ignore verification」「Assuming directory location」两条外的其余约束

## 容器目录是否要进 `.gitignore`

**不需要**。`<project>.worktrees/` 在项目根**之外**，根本不在仓库扫描范围里，无需 ignore。

> 反过来：**不要**为了"以防万一"往主仓 `.gitignore` 里追加 `../<project>.worktrees/` 之类的条目——`.gitignore` 不支持指向仓库外的路径，加了也无效，只会让人困惑。

## 不要

- 在项目内创建 `.worktrees/` 或 `worktrees/`——即便 skill 默认行为这样做，本规则覆盖
- 用 `~/.config/superpowers/worktrees/`——本规则也不走这条
- 在 parent 目录已有同名 `<project>.worktrees/` 时硬塞冲突分支——按分支名子目录隔离即可，分支重名时报告冲突让用户决定
- 多项目共用一个 `worktrees/` 顶层——按项目分组（`<project>.worktrees/`），不要把不同项目的 worktree 混在一起
