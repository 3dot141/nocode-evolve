本文所说“调用 `<skill>` Skill”使用 `/skill:<skill>`；“结构化决策”在回合末写出完整问题与 2–3 个互斥选项，等待用户下一条消息。


> 本文写“结构化决策”时，必须使用当前平台原生决策工具，传入完整问题与 2–3 个互斥选项；示例只展示单项形状，真实调用需带齐本步骤列出的选项。

# /projecthub dream：递归批量生成子目录文档

选定一个目录，递归扫描它和所有子目录，为每个有意义的子目录生成/更新 AGENTS.md + README.md。

## 入参

`/projecthub dream [dir-path]`
- `dir-path`：起始目录（默认项目根）

## 执行流程

### Step 0: git 仓库检测 + baseline 增量判断

若未传 `dir-path` 参数，取当前项目根（`${NOCODE_PROJECT_DIR:-$(pwd)}`）。

> **安全捕获约定（Review 复审 C2 修复）**：`<dir-path>` 来自用户输入，绝不能直接拼进任何 bash 命令的双引号字符串——**双引号不会阻止 `$(...)`/反引号命令替换**，Round 2 曾经把它改成环境变量赋值 `VAR="<dir-path>"` 但这个修复并不彻底（已复现：`DREAM_DIR_PATH="/tmp/$(touch poc)" bash -c '...'` 里的 `$(touch poc)` 依然会被执行，即使整段在双引号内）。本文件下面所有需要用到 `<dir-path>`（以及从脚本输出解析得到的 `<gitRoot>`/`<refName>`/最终选定的目录，防御性同等处理，因为它们最终也来自用户可影响的路径）的 bash 代码块，一律先用 **heredoc + 加引号的定界符**（`<<'DREAM_EOF'`）把原始值读进 shell 变量再引用——定界符加引号后，heredoc body 不做任何 shell 展开（不认 `$()`、不认反引号、不认变量替换、不认转义），是真正安全的写法；随后引用 `"$VAR"` 只是取变量的字面值，不会重新解释其中的内容。因为 Bash 工具的 shell 状态不跨调用持久化，**每个**需要这些值的独立 bash 代码块都要各自重新做一次 heredoc 捕获，不能假设前一个代码块里设的变量还在。

调用 `project-tree-detect.mjs` 判断 `<dir-path>` 是否在 git 仓库内：

```bash
DIR_PATH=$(cat <<'DREAM_EOF'
<dir-path>
DREAM_EOF
) && node "${NOCODE_PLUGIN_ROOT}/skills/projecthub/scripts/project-tree-detect.mjs" detect "$DIR_PATH"
```

输出形如 `{ "dirPath": "...", "isGitRepo": true|false, "gitRoot": "..."|null }`。

**分支 A：`isGitRepo` 为 `false`（非 git 目录）**

用 `结构化决策` 询问：

> 这个目录不是 git 仓库，要不要初始化一个来支持后续增量扫描？

选项：**要** / **不要**

- 用户选 **不要** → `INCREMENTAL=false`，`SCAN_ROOTS=(<dir-path>)`，直接跳到 Step 1（全量扫描，不阻断命令本身，跳过下面的 baseline 判断）。
- 用户选 **要** → 调用：

  ```bash
  DIR_PATH=$(cat <<'DREAM_EOF'
  <dir-path>
  DREAM_EOF
  ) && node "${NOCODE_PLUGIN_ROOT}/skills/projecthub/scripts/project-tree-detect.mjs" find-root "$DIR_PATH"
  ```

  输出 `{ "dirPath": "...", "upperRoot": "...", "sameAsDirPath": true|false }`。

  - 若 `sameAsDirPath` 为 `true`（两个候选退化为同一个）→ 不再追问第二个选项，直接确认在 `<dir-path>` 初始化，`gitRoot = <dir-path>`。
  - 若 `sameAsDirPath` 为 `false` → 用 `结构化决策` 二选一：

    | 选项 | 说明 |
    |---|---|
    | (a) 就用 `<dir-path>` 本身 | 只把 `<dir-path>` 纳入版本追踪 |
    | (b) 用 `<upperRoot>`（推断出的上层项目根） | 把整个上层项目纳入版本追踪，`<dir-path>` 只是其中一个子目录 |

    `gitRoot = <选定目录>`（`<dir-path>` 或 `<upperRoot>`）。

  执行 `git init`（同样用 heredoc 捕获选定目录）：

  ```bash
  GIT_ROOT=$(cat <<'DREAM_EOF'
  <选定目录, 即 gitRoot>
  DREAM_EOF
  ) && git init -b main "$GIT_ROOT"
  ```

  `git init` 完成后仓库没有任何 commit（unborn HEAD）——若不处理，后面 `advanceBaseline` 对着零 commit 仓库跑 `update-ref ... HEAD` 会失败，baseline 永远建立不起来。**git init 完成后，在此处显式补一次初始 commit**：

  ```bash
  GIT_ROOT=$(cat <<'DREAM_EOF'
  <选定目录, 即 gitRoot>
  DREAM_EOF
  ) && git -C "$GIT_ROOT" add -A && git -C "$GIT_ROOT" -c user.name=project-dream -c user.email=project-dream@local commit -q -m "init" --allow-empty
  ```

  （`--allow-empty` 兜底目录本身是空的情况；有文件时正常把现有内容纳入首个 commit。）完成后 HEAD 已存在，继续走下面「分支 B」。

**分支 B：`isGitRepo` 为 `true`（含刚 git init 完成的情况）**

`gitRoot` 取自上一步 `detect`（或分支 A 里 git init 时选定的目录）。计算 baseline ref 名：

```bash
DIR_PATH=$(cat <<'DREAM_EOF'
<dir-path>
DREAM_EOF
) && GIT_ROOT=$(cat <<'DREAM_EOF2'
<gitRoot>
DREAM_EOF2
) && node "${NOCODE_PLUGIN_ROOT}/skills/projecthub/scripts/project-tree-detect.mjs" ref-name "$DIR_PATH" "$GIT_ROOT"
```

输出 `{ "refName": "refs/dream/last-baseline__..." }`——`<dir-path>` 等于 `<gitRoot>` 时得到 `__root-<hash>` 后缀；子目录得到可读前缀 + 抗碰撞 hash 后缀（`refName()` 内部对相对路径原始字符串取 hash 保证唯一性）。同一仓库下对不同 `<dir-path>` 各自算出独立的 ref 名，互不覆盖、不冲突。

调用 `dream-baseline.mjs` 做增量 diff（不传 `prepareFn`——project-dream 场景不需要 personal-dream 专属的整树 snapshot；用 `pathspec` 把 diff 限定在 `<dir-path>` 范围内，避免子目录场景误报整仓库其他部分的变化）。`gitRoot`/`dirPath`/`refName` 先各自 heredoc 捕获进 shell 变量，再原样传给 `DREAM_*` 环境变量（此时变量值已经是安全的字面字符串，`DREAM_GIT_ROOT="$GIT_ROOT"` 这一步不会重新解释里面的内容），JS 里用 `process.env` 读取，全程不拼进 JS 字符串字面量：

```bash
GIT_ROOT=$(cat <<'DREAM_EOF'
<gitRoot>
DREAM_EOF
) && DIR_PATH=$(cat <<'DREAM_EOF2'
<dir-path>
DREAM_EOF2
) && REF_NAME=$(cat <<'DREAM_EOF3'
<refName>
DREAM_EOF3
) && DREAM_GIT_ROOT="$GIT_ROOT" DREAM_DIR_PATH="$DIR_PATH" DREAM_REF_NAME="$REF_NAME" node -e "
import('${NOCODE_PLUGIN_ROOT}/skills/projecthub/scripts/dream-baseline.mjs').then(({ diffSinceBaseline }) => {
  const gitRoot = process.env.DREAM_GIT_ROOT;
  const dirPath = process.env.DREAM_DIR_PATH;
  const refName = process.env.DREAM_REF_NAME;
  const result = diffSinceBaseline(gitRoot + '/.git', gitRoot, refName, { pathspec: dirPath, includeDirty: true, excludePaths: ['.dream.lock'] });
  console.log(JSON.stringify({ changedFiles: result }));
});
"
```

`includeDirty: true`：project-dream 不传 `prepareFn`，不会像 personal-dream 那样自动把 working tree 提交干净——用户在 `<dir-path>` 下编辑了文件但还没 commit 是正常状态，纯 commit 层 diff 看不到这些改动会导致漏扫描，必须叠加 `git status --porcelain` 结果。`excludePaths: ['.dream.lock']`：`advanceBaseline`（Step 3a）的 `RepoLock` 锁文件默认落在 `gitRoot` 根，正常情况下 `acquire`/`release` 瞬时配对不会被 diff 看到，但异常崩溃导致锁文件残留时，若不排除会被当成"变更文件"纳入结果造成自我污染式误判（Step 3a 已进一步改为把锁文件放进 `<gitRoot>/.git` 内部，这里的排除是双重保险）。

输出 `{ "changedFiles": string[] | null }`：

- `changedFiles === null`（首次运行）→ `SCAN_ROOTS=(<dir-path>)`，等同于原有全量行为。
- `changedFiles` 为空数组 → 完全无变化——直接输出：

  ```
  projecthub dream: <dir-path> 自上次运行以来无变化，无需生成。
  ```

  命令到此结束，不进入 Step 1。
- `changedFiles` 非空数组 → 是相对 `<gitRoot>` 的路径列表。取每个文件的 `dirname`，与 `<gitRoot>` 拼接得到绝对目录，去重后再去掉已被其祖先目录覆盖的子目录，剩下的最上层目录集合就是 `SCAN_ROOTS`。

无论走分支 A 还是分支 B，只要没有在「无变化秒回」处提前结束，都带着 `SCAN_ROOTS`（以及分支 B 场景下的 `gitRoot`/`refName`，供 Step 3a 使用）进入 Step 1。

### Step 1: 递归扫描

从指定目录开始，递归列出所有子目录。同 Step 0 的安全捕获约定——`<scan-root>` 先 heredoc 捕获进变量再引用，不直接拼进 `find` 命令文本：

```bash
SCAN_ROOT=$(cat <<'DREAM_EOF'
<scan-root>
DREAM_EOF
) && find "$SCAN_ROOT" -type d ! -path '*/.git/*' ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/build/*' ! -path '*/coverage/*' ! -path '*/__pycache__/*' ! -path '*/.agents-personal/*' ! -name '.*'
```

对 `SCAN_ROOTS`（由 Step 0 给出）里的每个 `<scan-root>` 各跑一次，结果合并去重后排序。全量模式下 `SCAN_ROOTS` 只有一个元素——原始的 `<dir-path>`，行为与增量能力接入前完全一致；增量模式下 `SCAN_ROOTS` 是 Step 0 对 diff 结果收窄后的多个目录，扫描范围更小，Step 2/3 后续流程不变。

**跳过的目录**（不生成文档）：
- `.git` / `.github` / `.vscode` / `.idea` / `.claude`
- `node_modules` / `dist` / `build` / `coverage` / `__pycache__`
- `.agents-personal`
- 其他隐藏目录（`.` 开头）
- 空目录（无文件，仅含子目录不算空）

**有意义的判断**——至少满足一条：
- 含源码文件（.js / .ts / .py / .go / .rs / .md / .mjs 等）
- 含配置文件（package.json / tsconfig.json / Makefile 等）
- 已有 AGENTS.md 或 README.md（需更新检查）
- 有明确的模块职责（是 monorepo package / skill 目录 / 独立子系统）

### Step 2: 呈现候选清单

列出计划处理的目录，标注当前状态：

```
计划处理 N 个目录：

| # | 目录 | AGENTS.md | README.md | 操作 |
|---|---|---|---|---|
| 1 | hooks/ | · | · | 新建两者 |
| 2 | rules/ | · | · | 新建两者 |
| 3 | vendor/ | + | · | 新建 README |
| 4 | skills/ | · | · | 新建两者 |
| 5 | skills/dev-build/ | · | · | 新建两者 |
| ...

勾选要处理的编号（默认全选）:
```

用 结构化决策 多选让用户勾选要处理的目录（每个 option 自带「目录路径 + 拟做动作」，不依赖上方清单渲染——工具调用间文本可能被吞）。

### Step 3: 批量执行

对每个勾选的目录完整读取 `references/write.md`，并执行其中 Step 1-4。

**执行策略**：

```
勾选目录数 ≤ 3？
     │
     ├─ 是 ──→ 顺序执行，每个目录即时展示 + 确认
     │
     └─ 否 ──→ 并行 subagent
                │
                ├─ 每个 subagent 分析 1 个目录
                ├─ 生成内容写到 scratchpad 临时文件
                ├─ 主 agent 读 scratchpad 汇总
                └─ 一次性展示清单 → 用户确认 → 批量写入
```

并行 subagent prompt 模板（subagent 是全新上下文，模板第 0 步必须先让它完整读取两份规范文件——AGENTS.md 内容规范在 write.md、README 书写方案在共享 readme-writing.md，单源不给会按各自默认风格漂移）：
```
分析目录 {project_root}/{dir_path}，生成 AGENTS.md 和 README.md 内容。

0. 完整读取 {plugin_root}/skills/projecthub/references/write.md 与 {plugin_root}/skills/references/readme-writing.md
   （{plugin_root} = 插件根，主 agent 组装本 prompt 时解析为绝对路径）
   —— AGENTS.md 内容规范与执行流程以 write.md 为单源；
   README 书写方案（总分结构、分层流水线图、逐节下钻）以 readme-writing.md 为单源
1. ls -la 列出目录内容
2. 读关键文件（入口 / 配置 / 已有文档）
3. 理解职责和约束，归纳功能清单（README 写作逐项对照）
4. 按 write.md 规范生成 AGENTS.md（agent 约束）和 README.md（人类文档）

把结果写到 {scratchpad}/{dir_flat}.md，格式：
  # {dir_path}
  ## AGENTS.md
  <完整内容>
  ## README.md
  <完整内容>

不要回传内容到对话，直接写文件。
```

### Step 3a: 前移 baseline

若 Step 0 判定为增量模式（即成功拿到了 `gitRoot`/`refName`——不论是走「本来就是 git 仓库」还是「刚 git init」的分支）：

`<gitRoot>`/`<refName>` 同 Step 0 先 heredoc 捕获再经环境变量传入，不拼进 JS 字符串字面量。`${HAD_FAILURES}` 是本命令自己算出的布尔字面量（`true`/`false`），非用户输入，直接插值不受此约束。锁文件用 `dream-baseline.mjs` 导出的 `projectLockDir(gitRoot)`（即 `<gitRoot>/.git`）而不是默认的仓库根——落在 `.git` 内部天然不出现在用户的 `git status` 里，不会被误提交（Review 复审 W3 修复）：

```bash
GIT_ROOT=$(cat <<'DREAM_EOF'
<gitRoot>
DREAM_EOF
) && REF_NAME=$(cat <<'DREAM_EOF2'
<refName>
DREAM_EOF2
) && DREAM_GIT_ROOT="$GIT_ROOT" DREAM_REF_NAME="$REF_NAME" node -e "
import('${NOCODE_PLUGIN_ROOT}/skills/projecthub/scripts/dream-baseline.mjs').then(({ advanceBaseline, projectLockDir }) => {
  const gitRoot = process.env.DREAM_GIT_ROOT;
  const refName = process.env.DREAM_REF_NAME;
  advanceBaseline(gitRoot + '/.git', refName, ${HAD_FAILURES}, { lockDir: projectLockDir(gitRoot) });
});
"
```

- Step 3 批量执行全部成功（用户主动不勾选的目录不算失败）→ `HAD_FAILURES=false`，baseline 前移到当前 HEAD。
- Step 3 中有目录因写入失败等**系统性错误**未能完成（不是用户主动不勾选）→ `HAD_FAILURES=true`，baseline 不前移，这些目录下次 `/projecthub dream` 的 diff 里会重新出现。

若 Step 0 判定为全量模式（非 git 目录且用户选择「不要」）→ 跳过本步骤，没有 baseline 可前移。

### Step 4: 总报告

```
projecthub dream 完成：

  处理 8 / 12 个目录：
    + hooks/       AGENTS.md (新建) + README.md (新建)
    + rules/       AGENTS.md (新建) + README.md (新建)
    + vendor/      README.md (新建)  [AGENTS.md 已存在, 未动]
    + skills/      AGENTS.md (新建) + README.md (新建)
    + model/       AGENTS.md (新建) + README.md (新建)
    + scripts/     AGENTS.md (新建) + README.md (新建)
    + commands/    AGENTS.md (新建) + README.md (新建)
    + agents/      AGENTS.md (新建) + README.md (新建)

  跳过 4 个：
    · .git/              系统目录
    · node_modules/      依赖目录
    · dist/              构建产物
    · .agents-personal/  私有资源
```

## 增量模式与秒回（P7-P9）

- Step 0 分支 A 的「不要」选项 = 全量模式：每次都跑 Step 1-4，不产生/不依赖任何 `refs/dream/last-baseline__*`，行为与增量能力接入前完全一致。
- Step 0 分支 B 判定 `changedFiles` 为空数组 = 秒回：命令在 Step 0 内直接结束，Step 1-4 完全不会执行。
- Step 0 分支 B 判定 `changedFiles` 为 `null` / 非空数组 = 增量模式：Step 1 只扫描 `SCAN_ROOTS`（收窄后的目录集合），Step 3a 负责按执行结果前移或跳过 baseline。
- 同一仓库下对不同 `dir-path`（如 `.` 和 `src`）分别运行 `/projecthub dream`，各自拿到独立的 `refName`，互不覆盖、互不冲突。
