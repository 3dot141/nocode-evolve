---
name: git-worktree
description: >-
  新建分支 / 开 worktree 时触发——原则: 所有分支都走 worktree, 不在主仓裸开
  branch。也触发于: worktree 内跑命令报 env/config 缺失需要从主仓 cp
  gitignored 文件; agent 在 worktree 里找不到项目本地 .agents-personal/
  路由; 从当前仓库进入另一个物理 git repo 去改文件 (关联仓库场景, 用相同
  分支名建 worktree, 已有同名分支则复用)。不触发: 已有的 main/master
  主干上工作。
skip: false
---

# nocode:using-git-worktrees 行为覆盖

创建 worktree 使用 `git worktree add "<absolute-worktree-path>" -b "<BRANCH_NAME>" "<optional-base-ref>"`；创建成功后使用 `EnterWorktree` 进入同一绝对路径。

执行 `nocode:using-git-worktrees` skill 时，本文规则覆盖 skill 内默认值。
若与 skill 内文冲突，**以本规则为准**。

## 顶层原则：每个分支都要 worktree——不在主仓裸开 branch

**所有新建分支一律走 worktree，不在主仓直接 `git checkout -b` / `git switch -c` / `git branch <new>` 起裸分支。** 一个 worktree 本质就是「分支 + 独立工作目录」，把「建分支」和「建 worktree」合成同一个动作——要分支，就建 worktree。

- **为什么**：裸分支与主仓共用同一份 working tree，切分支即原地改工作目录——IDE / LSP 重新索引、watcher / 构建工具触发重跑、未提交改动跨分支串味。worktree 给每个分支独立目录，AI 多分支并行调试时互不干扰（机制论证见下文「为什么要平级而不是项目内」）。
- **范围**：适用于**所有**新建分支，不留默认例外。真要临时裸开一个分支（快速验证 / 一次性 hotfix），需用户**显式**说「不要 worktree / 就在主仓建」才跳过——模糊信号（「快速看看 / 简单弄一下」）不算授权，拿不准就问。
- **拦截强度**：pretooluse 命中 `git checkout -b` / `git switch -c` / `git branch <new>` 时**注入提醒**（inject，不阻断）——提示改走 `git worktree add` 平级路径。命令仍会执行，但 agent 应据提醒回到 worktree 流程，而不是无视。
- **主分支例外**：`main` / `master` 本就住在主仓，不受此约束；本原则只管**新建**分支，不管已有的主干。

下面的路径模板 / 创建后补齐 / 销毁等全部是「建 worktree 这一个动作怎么做对」的细节。

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

# base ref 推断 (优先级: upstream remote → @{u} → origin/HEAD → origin/main)
if git remote get-url upstream >/dev/null 2>&1; then
    base_ref="$(git rev-parse --abbrev-ref upstream/HEAD 2>/dev/null)"   # 空则先 git remote set-head upstream -a 再取
    base_ref="${base_ref:-upstream/main}"
else
    base_ref="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)"   # 如 origin/main；无 tracking / detached 则空
    base_ref="${base_ref:-$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null)}"
    base_ref="${base_ref:-origin/main}"
fi
git rev-parse --verify "$base_ref" >/dev/null 2>&1 || base_ref=""   # 纯本地仓库解析不出 → base 回落本地 HEAD

# 建分支前：默认静默 fetch + 基于 base_ref 最新（防 base 滞后远程导致返工）
start_point=""
if [ -n "$base_ref" ]; then
    git fetch "${base_ref%%/*}" 2>/dev/null \
        || echo "WARN: fetch 失败（离线？）—— 未拉最新，base 回落本地 HEAD"
    ahead="$(git rev-list --count "$base_ref..HEAD" 2>/dev/null || echo 0)"   # 本地独有（未进 base）commit 数
    [ "$ahead" -eq 0 ] && start_point="$base_ref"   # 本地无独有 commit → 静默基于远程最新（纯落后/已最新都无损失）
    # ahead>0（本地有独有 commit）→ start_point 留空, 走「何时弹问 base」, 不要在此静默基于远程
fi

# 使用已确认的 branch / absolute path / start-point 创建。
git worktree add "$worktree_path" -b "$BRANCH_NAME" "${start_point:-HEAD}"

# 记录 freshness base (freshness-check.mjs 最高优先级读此 config, 不随 push -u 漂移)
[ -n "$base_ref" ] && git -C "$worktree_path" config branch."$BRANCH_NAME".nocode-base "$base_ref"

# 创建成功后按上方平台块进入或绑定同一个绝对路径。
```

> 注意：`-b` 后传的仍是**原始** `BRANCH_NAME`（含 `/`），git 分支名本身不变；只有**目录名**做扁平化。

### 基于最新远程建分支：默认静默 fetch，仅本地有独有 commit 时弹问

worktree 的新分支 base 应跟上远程，避免长在过时代码上、与已合并改动撞车返工。`git worktree add -b <branch>` 不指定 start-point 时默认基于主仓**当前 HEAD**——本地 HEAD 一旦滞后远程，整个 worktree 就长在旧代码上。规则：

- **base ref 推断优先级**：`upstream` remote 存在 → `upstream/HEAD`（fork 场景）；否则 `@{u}` → `origin/HEAD` → `origin/main`。fetch 也 fetch base 所在的 remote。
- **默认静默**：建分支前 `git fetch`，基于 `base_ref` 最新 commit 建——不弹问，零摩擦。
- **判弹问只看 `ahead`（本地独有 commit 数 = `git rev-list --count $base_ref..HEAD`）**，不看 behind：
  - `ahead == 0`（纯落后 / 已最新）→ **静默基于远程最新**。本地没有独有 commit，基于远程零损失，不打扰。
  - `ahead > 0`（本地有未进 base 的领先 commit）→ **弹问**。基于远程最新会让这些本地 commit 不在 base 里，必须让用户三选：① 基于远程 base_ref 最新（放弃本地领先作为 base）② 基于当前本地 HEAD（保留本地领先）③ 指定其他 start-point。
- **fetch 失败 / base_ref 解析不出（纯本地仓库）/ detached HEAD**：不阻塞，warn + 回落本地 HEAD 继续，回复里明确告知"未拉最新，base=本地 HEAD"。

> 为什么 upstream remote 优先于 `@{u}`：fork 工作流里 `@{u}` 通常指向 origin（你的 fork），fork 的 main 常滞后真正的上游——基准应取 upstream remote 的默认分支，否则静默 fetch origin 拉不到真正的最新。fork 的 origin/main 只做 upstream 的 fast-forward 镜像、push 中转，不参与 base 推断。

> 为什么用 `ahead` 而非"behind 很多"：纯落后时基于远程最新永远无损（你没有独有 commit 会被丢），不必拿模糊阈值打扰用户；真正需要拍板的只有"本地有独有 commit 时 base 选谁"这一种分歧。

### 示例

| 项目根 | branch (git 里) | 最终 worktree 路径（目录名扁平化）|
|---|---|---|
| `/Users/yes365/AI/nocode-evolve` | `feature/foo` | `/Users/yes365/AI/nocode-evolve-feature_foo` |
| `/Users/yes365/AI/nocode-evolve` | `bench-restructure` | `/Users/yes365/AI/nocode-evolve-bench-restructure` |
| `/Users/yes365/Work/Source/fx-tianwen` | `fix/login/redirect` | `/Users/yes365/Work/Source/fx-tianwen-fix_login_redirect` |

## 跨物理分仓：关联仓库用**相同分支名**建 worktree

前面讲的是「单个仓库内，每个分支一个 worktree」。当一次工作牵涉**物理上分开的多个 git repo**（不是 monorepo 子包，是各自独立 `.git` 的仓库）时，本节把同一原则延伸到跨仓库。

### 「关联仓库」定义

从**当前仓库**的工作流程中，需要进入**另一个**物理 git repo 去**修改**（Edit / Write / 在那个 repo 跑改动命令）——那个 repo 就是本次工作的「关联仓库」。

- 判定只看「是否去改」：只是进关联仓库**只读查看**（Read / grep / 看 log）**不算**，不触发本节。
- 一次工作可有多个关联仓库（前端 + 后端 + 公共库各一个独立 repo）。

### 约定：关联仓库同样走 worktree，分支名与当前**一致**

关联仓库的改动同样不在它的主仓裸改 / 裸开分支——为这次跨仓库改动建 worktree，且：

- **分支名与当前仓库当前工作分支相同**（branch 一致），作为跨仓库追踪同一组改动的锚点，便于两边 PR 关联、收尾时对齐。
- **目录仍按各自仓库的模板**落 `<linked-repo-parent>/<linked-repo-name>-<branch_flat>/`——前缀是**关联仓库自己**的 basename，不是当前仓库的。所以目录名不会完全相同，相同的只有 branch 段。

示例：当前在 `A` 仓库的 `feature/foo` 分支工作，要去 `B` 仓库改：

| 仓库 | 分支（git 里） | worktree 路径 |
|---|---|---|
| 当前 `A` | `feature/foo` | `/parent/A-feature_foo/` |
| 关联 `B` | `feature/foo`（**同名**） | `/parent/B-feature_foo/` |

### 复用优先：关联仓库已有同名工作就进入，不重复新建

进入关联仓库 `B` 前先 `git -C <B-root> worktree list` / 查 B 的分支：

- **B 已有与当前分支同名的分支 / worktree** → 直接进入复用，**不**再新建（避免在 B 已活跃的分支上硬开新分支）。
- **B 没有** → 按上面模板用当前仓库的分支名在 B 新建 worktree。创建流程、`worktree-setup.mjs` 补齐、`.agents-personal` symlink 全部照单仓库流程，只是「路径推导」段的 `project_root` 换成 B 的根。
- **B 正在别的分支活跃工作** → 不打断它；只为本次跨仓库改动新建同名 worktree（独立目录，互不干扰），除非 B 已有同名分支可复用。

### 跨仓库的不要

- 不要在关联仓库的主仓 / 当前分支上直接改——跟「不在主仓裸开分支」同理，跨仓库也要隔离。
- 不要为了「目录名完全一致」去改命名模板 / 加统一前缀——相同的是**分支名**，目录前缀各自 repo 的 basename。
- 不要让关联仓库的分支名与当前仓库分叉（除非用户**显式**要不同名）——同名是跨仓库追踪的锚点。
- 关联仓库本就该停在 `main`、不新建分支时（如只去同步、不改），按顶层「main 例外」不强制 worktree。

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
- **shell 补全友好**：在 parent 目录敲 `cd nocode<TAB>` 能同时列出主仓和所有 worktree，看一眼就知道有哪些分支在工作
- **不需要为容器目录做 `mkdir -p`**，git worktree add 直接落地
- 反过来"项目目录被 worktree 包围"也容易识别——同前缀视觉聚拢就够了，不必再多一层目录

## 覆盖关系（精确指出推翻 skill 内哪些段落）

skill `SKILL.md` 中下列默认行为**全部失效**，按本文执行：

| skill 内默认 | 本规则覆盖为 |
|---|---|
| 「Check Existing Directories」优先 `.worktrees` / `worktrees` | 跳过——不再检测项目内目录，直接用平级模板 |
| 「Check CLAUDE.md」找 worktree 目录偏好 | 跳过——本文已是 nocode 全局偏好，不再二次询问 |
| 「Ask User」三选一菜单 | 跳过——不询问，直接用平级模板 |
| 「Safety Verification」对 `.worktrees` / `worktrees` 做 `git check-ignore` 并改 `.gitignore` | 跳过——worktree 已在项目外，不需要 ignore，也不要往项目 `.gitignore` 里加东西 |
| 「Quick Reference」表中关于 `.worktrees/` / `worktrees/` 的 4 行 | 全部失效，按本文路径模板 |
| 「Creation Steps」中按 `LOCATION` 分支拼路径的逻辑 | 全部失效，按本文「路径推导」脚本拼 |

**保留**的 skill 内行为：

- 「Run Project Setup」（npm install / cargo build / pip install / go mod download 自动探测）——JS 项目由本文脚本的从零 install 覆盖，非 JS 项目保留 skill 自动探测
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

## Worktree 创建后: 切到 worktree 工作目录

`git worktree add` 不改 shell cwd——命令跑完, agent / 用户仍在主仓. Claude Code 的 Bash tool 每次 call 结束**会把 cwd 重置回主仓** (transcript 里看到 `Shell cwd was reset to ...` 就是这个), 所以"每次 Bash 都重新 cd"是真实摩擦, 不是错觉.

后续所有动作 (cp env / link personal / run setup / verify baseline / git 操作) 都该在 worktree **内**执行, 必须把 cwd 切过去**并让切换持久化**.

### 标准：原生创建 + 平台原生进入

```
1. `git worktree add "<absolute-worktree-path>" -b "<BRANCH_NAME>" "<optional-base-ref>"`
2. Claude 使用原生会话进入；Codex 为后续操作绑定绝对 `workdir`
```

为什么必须两步：

- `git worktree add` 只按业务层给出的绝对路径创建，不隐式切换 session。
- Claude 原生进入只接受已存在的 worktree，不创建、不删除；Codex 使用显式 workdir。
- 退出时传主 worktree 的绝对路径；不能用 `.`，否则当前 workspace 身份不明确。

### 触发

任何成功执行 `git worktree add` 之后, 第一件事就是切 cwd 并让切换持久化.

### 标准动作

变量沿用「路径推导」段的 `worktree_path`.

**强制动作**：执行文件顶部当前平台对应的进入/绑定指令。Claude 可持久化 session cwd；Codex 将每次后续操作绑定到显式 `workdir`。

### 不要

- 不要省略路径、传 `.`，或把进入当创建；创建和进入是两个独立动作
- 不要把 `git -C "$worktree_path" <cmd>` 当常规用法——偶发 OK, 常态化 cwd 跟参数路径分裂, 容易把主仓 working tree 改坏
- 不要假设创建会自动切换；创建成功后必须显式进入相同绝对路径
- 不要切过去后又 cd 回主仓做事——后续动作链 (cp env / link personal / setup / baseline) 应一气在 worktree 内做完
- Codex 后续调用不得遗漏绝对 `workdir`

## Worktree 创建后：调 worktree-setup.mjs 补齐 gitignored 运行物

`git worktree add` 出来的是**干净** checkout——只复制 tracked 内容，主仓本地 gitignored 的运行物**不会**带过来。

**人机分工 (v3.32+)**：
- **脚本确定性自动**：IDE (`.vscode` / `.idea`) cp / 从零 `install` (按 lock 文件探测包管理器) / symlink `.agents-personal` / `git status` clean 校验
- **agent 判断 + 显式 cp**：env / config / 项目本地 local 配置 — 脚本列**全部 gitignored 文件作 candidates** (safety filter 只跳目录/>5MB/明显 deps)，agent 用项目上下文自己判断哪些 cp，显式跑 `cp`

> **不再从主仓 cp `node_modules`**。跨分支时主仓 node_modules 版本与 worktree 分支的 lock 文件不匹配，且 build tool 预构建缓存（`.vite/deps` 等）不会被 install 刷新，导致难排查的运行时错误。pnpm/yarn 有全局 store，从零 install 主要是建硬链接，速度可接受。

进入 worktree 的 capability 返回成功回执后调一次脚本即可（变量沿用本文「路径推导」段，支持 `--key=value` 或 `--key value`）：

```bash
node "${QODER_PLUGIN_ROOT}/scripts/worktree-setup.mjs" setup \
    --project-root "$project_root" --worktree-path "$worktree_path"
# 可选: --pkg-manager npm|pnpm|yarn (不传按 lock sniff) / --skip-install / --dry-run (只输出计划不执行)
```

脚本输出 JSON 报告；agent 检查 **`envCandidates[]` + `needsAttention[]`**——前者要 agent 判断 cp 哪些，后者非空才介入：

- `envCandidates[]` (v3.6.3+)：**agent 主导** — 列出 .gitignore 提到 + 实际存在 + 非目录 + ≤5MB 的全部文件。agent 用项目上下文判：
  - **应 cp**：`.env*` / `*.local.*` / `conf/config.yaml` / `secrets.json` 等 local 配置 / 凭证 → 显式 `cp <projectRoot>/<rel> <worktreePath>/<rel>`
  - **不该 cp**：build/cache 残留 / 运行时 data / 临时文件 → skip
  - 拿不准时优先 cp (cp 多一点 ≪ 漏 cp 关键导致 worktree 跑不起来)
- `copied` / `symlinked`：实际 cp 的 IDE 与 symlink 的 `.agents-personal`
- `install.status`：`ran`(从零 install 跑了) / `skipped`(`--skip-install` 或无 lock 文件) / `failed`(install 报错)
- `gitStatusClean`：false 时 offenders 也进 `needsAttention`（cp 物意外进 tracking）
- `needsAttention[]`：cp 失败 / status 不 clean / 未识别包管理器 / **envCandidates 非空时提示 agent 主导判断**——逐条人判

脚本只做**幂等、可逆**的补齐（`[ -e ]` 跳过已存在；遇分歧只报告不擅自决定）。下面各节讲**为什么这么补**——脚本是"怎么做"，规则正文留"为什么"。

### env / config — 为什么 cp 独立副本

主仓本地 gitignored 的 `.env*` / `config.local.*` / secret / API token 等，worktree 跑依赖它们的命令前要补。用 **cp 独立副本**而非 symlink：worktree 改 env schema **不该回污主仓**，cp 出来各自独立。

- **触发**：worktree 内跑命令报 `env var missing` / config 加载失败；或准备跑 dev/test/build/benchmark 前。
- **脚本职责 (v3.6.3+)**：扫 `.gitignore` 列**所有 gitignored 文件**到 `envCandidates[]` (safety filter：跳目录/>5MB/明显 deps 如 node_modules/.idea/.vscode/.DS_Store)。**不自动 cp**，不再 hardcoded keyword 启发式 — 避免漏 cp 项目特异命名 (如 `conf/config.yaml` / 自定义 secret store)。
- **agent 职责**：看 `envCandidates[]`，用项目上下文 (config 加载入口的 `parseYaml(readFileSync(...))` / framework 惯例 / 文件名语义) 判定哪些是 local 配置需 cp，显式跑 `cp`。拿不准时优先 cp (worktree 多 1-2MB 文件 ≪ 跑不起来调试)。
- **schema 不兼容**：worktree 代码与主仓 env schema 对不上时，改 worktree 副本即可，**不动主仓**（除非用户授权）——worktree 是隔离工作区。

#### env cp 的不要

- 不要 `git add -f` 这些 gitignored 文件——会带 secrets 进 git
- 不要假设 worktree 自动有这些文件——`git worktree` 不复制 untracked
- 不要在本节钉死具体文件名 / token 名 / 仓库特定 schema——具体细节随项目演化，本节只描述"cp gitignored env files"模式；项目特异的 env file 清单走项目本地 rule
- 不要在 worktree 改主仓配置——主仓是 source of truth，真要更新主仓配置走主仓 working tree

### IDE / 调试配置（`.vscode` / `.idea`）

IDE 的 run/debug 配置目录（VS Code 的 `.vscode/`、JetBrains 的 `.idea/`）常被 gitignored，`git worktree add` 不带过来——worktree 里用 IDE 打开就没有 launch / run config，要手动重配很烦。从主仓 cp 一份独立副本即可。

> 为什么 cp 不 symlink：`.idea/workspace.xml` 等存的是 **per-project IDE 状态**（打开的文件、窗口布局、模块路径）。symlink 会让两个 worktree 共享一份，JetBrains 把它们当同一 project、互相覆盖状态、索引冲突。run config 用 `$PROJECT_DIR$` 宏，cp 到 worktree 后自解析到新根，配置照常可用——cp 是对的。

- **触发**：刚创建 worktree、准备用 IDE 打开 / 跑 debug；主仓存在 `.vscode/` 或 `.idea/`（gitignored、worktree add 没带过来）。
- **脚本动作**：对 `.vscode` / `.idea` 各做整目录 clonefile cp（幂等：worktree 已有则跳过），`copied.ide` 回显实际 cp 的目录。

#### IDE 配置 cp 的不要

- 不要 symlink `.vscode` / `.idea`——IDE 会把两 worktree 当同一 project、workspace state 互相覆盖；要独立副本
- 不要 cp 已 tracked 的目录——worktree add 已带过来，`[ -e "$dst" ]` 守卫负责跳过
- 不要在**部分 tracked**（如 `.vscode/settings.json` tracked、`launch.json` gitignored）时整目录 cp——整目录守卫会因 tracked 文件使 `.vscode` 已存在而跳过、漏掉 gitignored 的那几个；这种项目按 env/config 那样 cp 单个 gitignored 文件
- 不要把这些当必须——主仓没有 `.vscode` / `.idea` 就整段跳过

### node_modules — 从零 install，不从主仓 cp

脚本**不 cp 主仓的 `node_modules`**，直接按 lock 文件探测包管理器（pnpm-lock → pnpm / yarn.lock → yarn / package-lock → npm）跑从零 install。

- **为什么不 cp**：worktree 的分支通常与主仓不同，`package.json` / lock 版本不一致。cp 过来的 `node_modules` 是"错的起点"——包本体可以靠增量 install 修正，但 build tool 的预构建缓存（`.vite/deps` 等）不会被 install 刷新，导致运行时加载到旧版本预构建产物、报莫名其妙的导出缺失。调试成本远超从零 install 省的时间。
- **pnpm/yarn 从零 install 并不慢**：有全局 content-addressable store，install 主要是建硬链接，不重新下载。
- **包管理器**：脚本按 lock 文件 sniff；无 lock 文件 → `install.status="skipped"`（非 JS 项目或无依赖）。

#### node_modules 的不要

- 不要从主仓 cp `node_modules` 到 worktree——跨分支版本不匹配 + build cache 过时，省的时间全还给调试
- 不要对包管理器想当然——主仓用 pnpm / yarn 就用对应 install，别一律 `npm`

## Worktree 创建后：link `.agents-personal/` 到主仓（symlink 共享）

`.agents-personal/` 是项目本地针对 agent 的配置（路由表 + 项目本地 wiki/历史 + 项目本地 rules/当前指令），设计上 gitignored, 跟 env / config 一样 `git worktree add` 不会带过来. 但与 env 不同的是, `.agents-personal/` 应 **跨 worktree 共享** —— 主仓改 wiki / rules / AGENTS.md 后 worktree 立刻可见, 不需要"同步副本".

实现: 用 **symlink** 而非 cp.

- **触发**：刚创建 worktree、准备让 agent 在内工作；或 worktree 内开新会话发现 agent 找不到项目本地路由 / wiki / rules；主仓 `.agents-personal/` 存在。
- **脚本动作**：`ln -s` 主仓 `.agents-personal/` 到 worktree（幂等：已存在则跳过），`symlinked` 回显。

为什么 symlink 而不是 cp:

- **单一来源**: 主仓改了 worktree 立刻看到, 零同步开销
- **零 hook 改造**: SessionStart hook 仍按 `${QODER_PROJECT_DIR}/.agents-personal/AGENTS.md` 读取, symlink 透明转发到主仓
- **/distill 写回主仓**: 在 worktree 内跑 `/distill` 落 `wiki:project` / `rules:project` 时, 经 symlink 实际写主仓——符合"主仓是 source of truth"语义
- **gitignored 状态保留**: worktree 的 `.gitignore` 是 tracked 跟过来的, 里头仍 ignore `.agents-personal/`, symlink 自动落进 ignore, `git status` 不污染

### 销毁 worktree 前必读

`git worktree remove` 默认会因 `.agents-personal/` symlink 是 untracked 而**拒绝执行**, 提示 "contains modified or untracked files, use --force". 即便加 `--force`, POSIX rm 对 dir symlink 只删 symlink 自身**不**递归 target——实测 macOS BSD rm + git worktree --force 不会误删主仓 `.agents-personal/`. 双重安全.

但为了**显式控制 + 跨平台稳健**, 用 teardown verb——它封装"先拆 `.agents-personal` symlink（只删 symlink 自身、target 不动）→ `git worktree remove`"的固定顺序（顺序反了 remove 会因 untracked symlink 拒绝）。销毁前先进入主 worktree 的绝对路径（否则 cwd 卡在被删目录里）：

```bash
# 先按平台原生方式进入/绑定 `<absolute-main-worktree-path>`，再：
node "${QODER_PLUGIN_ROOT}/scripts/worktree-setup.mjs" teardown \
    --worktree-path "$worktree_path"
# remove 被拒绝(有其他 untracked)→ 进 needsAttention, 不自动 --force; 人工判后再处理
```

> **不要在销毁 worktree 时顺手清理远程分支.** worktree 移除只删工作目录、**保留 branch** (本节「目录名冲突怎么办」重建复用、通用销毁皆如此). 远程分支清理是**删 branch** 的附属动作, 归 `nocode:dev-land` skill 的全景计划远程分支处置 (Merge / Discard 删本地 branch 后触发), 不归 worktree 移除——在保留 branch 的场景删远程会误删正要继续的分支.

### 想要分支化 personal 配置时

99% 场景 worktree 共享主仓 personal 即可. 偶尔需要"这个 worktree 测试不同的 AGENTS.md / rules" 时, 升级路径:

```bash
rm "$worktree_path/.agents-personal"                       # 拆链
cp -R "$project_root/.agents-personal" "$worktree_path/"   # cp 一份独立副本
# 之后改 worktree 内副本不影响主仓
```

升级是单向的——cp 后想退回共享要先清副本再 ln, 注意.

### link `.agents-personal/` 的不要

- 不要 cp 一份就完事——主仓 wiki 更新 worktree 看不见, 用户会困惑
- 不要硬链接 (`ln` 不带 `-s`)——目录不支持硬链, 而且失去"指向主仓"的明确语义
- 不要把 `.agents-personal/` 入 git track 来绕过这个机制——personal 设计上是 user/team local, 不该入 history
- 不要在销毁 worktree 时直接 `git worktree remove --force` 而不先拆链——虽然实测安全, 但 displayed 给人的"工具 follow symlink 删 target"印象会让协作者不放心; 显式拆链消除歧义

## 不要

- 在项目内创建 `.worktrees/` 或 `worktrees/`——即便 skill 默认行为这样做，本规则覆盖
- 用 `~/.config/superpowers/worktrees/`——本规则也不走这条
- 引入 `<project>.worktrees/<branch>/` 之类的容器层——本规则就是扁平，不要回退到上一版的容器模型
- 用别的字符替换 branch 里的 `/`（如 `-`、`.`）——统一 `_`，保持可逆识别（`_` 不出现在 git 分支名的常见命名里，回推时不易歧义）
- 对 git 分支名本身做扁平化——只改目录名，`git worktree add -b` 仍传原始分支名
- 自己加随机后缀绕过目录名冲突——报告让用户决定
