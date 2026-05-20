# superpowers:using-git-worktrees 行为覆盖

执行 `superpowers:using-git-worktrees` skill 时，本文规则覆盖 skill 内默认值。
若与 skill 内文冲突，**以本规则为准**。

## 核心原则：worktree 一律落在项目**同级**目录，扁平命名

> 不再使用 skill 内默认的 `.worktrees/`（项目内）/ `worktrees/`（项目内）/ `~/.config/superpowers/worktrees/<project>/`（用户配置目录）。

**统一路径模板**：

```
<project-parent>/<project-name>-<branch-flat>/
```

- `<project-name>`：当前项目根的 basename（`basename "$(git rev-parse --show-toplevel)"`）
- `<branch-flat>`：分支名把 `/` 替换为 `_`（`feature/foo` → `feature_foo`）。其他字符不动。
- 没有"容器目录"——每个 worktree 自己就是 parent 的一个平级兄弟目录

### 路径推导（粘贴可用）

```bash
project_root="$(git rev-parse --show-toplevel)"
project_name="$(basename "$project_root")"
project_parent="$(dirname "$project_root")"
branch_flat="${BRANCH_NAME//\//_}"     # feature/foo → feature_foo
worktree_path="${project_parent}/${project_name}-${branch_flat}"

git worktree add "$worktree_path" -b "$BRANCH_NAME"
cd "$worktree_path"
```

> 注意：`-b` 后传的仍是**原始** `BRANCH_NAME`（含 `/`），git 分支名本身不变；只有**目录名**做扁平化。

### 示例

| 项目根 | branch (git 里) | 最终 worktree 路径（目录名扁平化）|
|---|---|---|
| `/Users/yes365/AI/nocode-evolve` | `feature/foo` | `/Users/yes365/AI/nocode-evolve-feature_foo` |
| `/Users/yes365/AI/nocode-evolve` | `bench-restructure` | `/Users/yes365/AI/nocode-evolve-bench-restructure` |
| `/Users/yes365/Work/Source/fx-tianwen` | `fix/login/redirect` | `/Users/yes365/Work/Source/fx-tianwen-fix_login_redirect` |

## 为什么要平级而不是项目内

避免「同项目内多份 working tree」导致的相互干扰：

- **IDE / LSP 索引**：项目内的 `.worktrees/<branch>/` 会被索引器扫到，等于同时加载两份相同代码，符号跳转混乱、内存暴涨
- **watcher / 构建工具**：`tsc --watch` / `vite` / `webpack` / `cargo watch` / `pytest-watch` 等监听项目根，会扫到 worktree 内的镜像副本，触发循环重建
- **`find` / `grep` / `rg` 误命中**：在主仓里搜代码常常把 worktree 里的旧分支版本一起捞出来
- **意外提交**：`.worktrees/` 没加进 `.gitignore` 时会被当成主仓子目录污染 `git status`
- **跨工具不一致**：部分工具假设「项目根下只有一份源码」，混入 worktree 后行为难预测

平级目录把这些副作用一刀切——主仓里只看得见自己的代码，每个 worktree 也只看得见自己。

## 为什么是扁平 `<project>-<branch>` 而不是容器 `<project>.worktrees/<branch>/`

- **路径短一层**，`cd` / IDE 打开都更直接
- **shell 补全友好**：在 parent 目录敲 `cd nocode-evolve<TAB>` 能同时列出主仓和所有 worktree，看一眼就知道有哪些分支在工作
- **不需要为容器目录做 `mkdir -p`**，git worktree add 直接落地
- 反过来"项目目录被 worktree 包围"也容易识别——同前缀视觉聚拢就够了，不必再多一层目录

## 覆盖关系（精确指出推翻 skill 内哪些段落）

skill `SKILL.md` 中下列默认行为**全部失效**，按本文执行：

| skill 内默认 | 本规则覆盖为 |
|---|---|
| 「Check Existing Directories」优先 `.worktrees` / `worktrees` | 跳过——不再检测项目内目录，直接用平级模板 |
| 「Check CLAUDE.md」找 worktree 目录偏好 | 跳过——本文已是 nocode-evolve 全局偏好，不再二次询问 |
| 「Ask User」三选一菜单 | 跳过——不询问，直接用平级模板 |
| 「Safety Verification」对 `.worktrees` / `worktrees` 做 `git check-ignore` 并改 `.gitignore` | 跳过——worktree 已在项目外，不需要 ignore，也不要往项目 `.gitignore` 里加东西 |
| 「Quick Reference」表中关于 `.worktrees/` / `worktrees/` 的 4 行 | 全部失效，按本文路径模板 |
| 「Creation Steps」中按 `LOCATION` 分支拼路径的逻辑 | 全部失效，按本文「路径推导」脚本拼 |

**保留**的 skill 内行为：

- 「Run Project Setup」（npm install / cargo build / pip install / go mod download 自动探测）
- 「Verify Clean Baseline」（跑测试确认起点干净，失败则报告 + 请示）
- 「Report Location」（最终报路径 + 测试状态）
- 「Common Mistakes」中除「Skipping ignore verification」「Assuming directory location」两条外的其余约束

## 关于 `.gitignore`

**不需要任何 .gitignore 改动**。worktree 目录在项目根**之外**，根本不在仓库扫描范围里。

> 不要为了"以防万一"往主仓 `.gitignore` 里追加 `../<project>-*/` 之类的条目——`.gitignore` 不支持指向仓库外的路径，加了也无效，只会让人困惑。

## 目录名冲突怎么办

`<parent>/<project>-<branch_flat>` 已经存在时：

1. 先确认是不是同分支的旧 worktree 残留（`git worktree list` 看注册情况）。
2. 是残留 → `git worktree remove` 清理后重建。
3. 是真正的命名冲突（同 parent 下另一项目恰好叫这个名）→ 报告冲突让用户决定，**不要**自己加后缀绕过。

## Worktree 创建后：cp 主仓 gitignored env / config

`git worktree add` 出来的 checkout 是**干净** checkout——只复制 tracked 内容，主仓本地的 gitignored 文件（`.env*` / `config.local.*` / 本地 secret / API token / 等）**不会**带过来. worktree 跑起依赖这些文件的命令前要从主仓 cp 过来.

### 触发场景

- 在 worktree 内跑命令报错：`env var missing` / `<configfile> 不存在` / 类似 secret/config 加载失败
- 主动准备跑依赖 env 的命令（dev / test / build / 跑 benchmark），提前 verify 配置就位
- 刚创建 worktree 第一次跑运行性命令时

### 标准动作

变量沿用本文「路径推导」段的 `project_root` / `worktree_path`.

1. **识别要 cp 的文件**——看主仓根 + 子包 `.gitignore` + 报错指向的路径：

   ```bash
   grep -rE "\.env|config\.local|secret" \
     "$project_root/.gitignore" "$project_root"/**/.gitignore 2>/dev/null
   ```

2. **cp 主仓 → worktree，保持完全相同的相对路径**：

   ```bash
   cp "$project_root/<rel-path>" "$worktree_path/<rel-path>"
   ```

3. **验证 worktree git status 仍 clean**（gitignored 文件 cp 后不应进 git status）：

   ```bash
   cd "$worktree_path"
   git status -s | grep -v "^??" | head    # 不应出现 cp 过来的文件
   ```

4. **worktree 的代码版本与主仓 env 文件 schema 不兼容**（主仓 env 滞后于代码改动）：改 worktree 副本即可，**不动主仓**（除非用户明确授权改主仓）. worktree 是隔离工作区，副本改动跟主仓互不影响.

### env cp 的不要

- 不要 `git add -f` 这些 gitignored 文件——会带 secrets 进 git
- 不要假设 worktree 自动有这些文件——`git worktree` 不复制 untracked
- 不要在本节钉死具体文件名 / token 名 / 仓库特定 schema——具体细节随项目演化，本节只描述"cp gitignored env files"模式；项目特异的 env file 清单走项目本地 rule
- 不要在 worktree 改主仓配置——主仓是 source of truth，真要更新主仓配置走主仓 working tree

## 不要

- 在项目内创建 `.worktrees/` 或 `worktrees/`——即便 skill 默认行为这样做，本规则覆盖
- 用 `~/.config/superpowers/worktrees/`——本规则也不走这条
- 引入 `<project>.worktrees/<branch>/` 之类的容器层——本规则就是扁平，不要回退到上一版的容器模型
- 用别的字符替换 branch 里的 `/`（如 `-`、`.`）——统一 `_`，保持可逆识别（`_` 不出现在 git 分支名的常见命名里，回推时不易歧义）
- 对 git 分支名本身做扁平化——只改目录名，`git worktree add -b` 仍传原始分支名
- 自己加随机后缀绕过目录名冲突——报告让用户决定
