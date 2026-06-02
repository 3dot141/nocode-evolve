---
type: design-doc
topic: git-worktree rule 确定性步骤抽取为幂等 setup 脚本（方案3 部分脚本化）
date: 260602
author: 3dot141
status: approved
last_updated: 260602
---

# Design Doc: worktree 补齐步骤脚本化（方案3 部分脚本化）

## 背景

`rules/rule-git-worktree.md`（~340 行）现在把三类性质不同的东西混在一份教学文档里，让 agent 每次建 worktree 都得读懂整段再逐条贴 bash：

- **A 类 — 纯确定性机械步骤**：路径推导、cp env/config、cp IDE（`.vscode`/`.idea`）、cp `node_modules`+增量 install、symlink `.agents-personal`、`git status` clean 校验、销毁时拆链+`worktree remove`。这些是几十行 inline bash，零判断、零项目假设。
- **B 类 — 需拍板的分叉点**：建分支前 fetch+算 `ahead`（`ahead>0` 要弹问用户三选 base）、env 文件"算不算要 cp"的边界判断、目录名冲突（残留 vs 真冲突）。
- **C 类 — 必须走 harness 工具**：`EnterWorktree(path=)` 切 cwd 并持久化。

**核心问题（主因）**：A 类机械步骤散在 rule 正文的教学 bash 里，agent 每次要把它读进上下文、理解、改写成 bash 逐段贴。三个具体代价：

1. **易漏步**：cp 分 env→IDE→node_modules→symlink→status 校验 5 段，漏一段不报错。上一个 commit（`c7df444`）刚加的 IDE cp 那段，如果 agent 读 rule 时跳过，worktree 就少了 `.vscode`/`.idea`——而这正是用户报的痛点。
2. **不可测**：inline bash 没法回归测试。cp IDE 的 `[ -e ]` 跳过逻辑、销毁"先拆链再 remove"的顺序，改坏了没有红线兜底。
3. **重复理解成本**：每次建 worktree 都重新读懂这套 bash 再贴，token 花在"把 rule 翻译成命令"上。

**附带问题（辅因）**：rule 正文越来越长，cp 三类占了一大半篇幅。`model/agent-catalog.md` 之前超 10000 字符阈值被 SessionStart 截断过（commit `9f917fb`）——rule 越长越逼近这类阈值，A 类 bash 是冗余大头。

**不解决的代价**：每次 worktree 创建都重复这套摩擦；每新增一类 cp（如这次的 IDE）都要改 rule 正文 + 让 agent 重新理解整段。

## 目标

- **A 类收进一个脚本**：`scripts/worktree-setup.mjs`，幂等、无项目假设、参数化。agent 在 `git worktree add` + `EnterWorktree` 之后调一次，完成 cp 三类 + symlink + status 校验，省去逐段贴 bash。
- **B 类脚本探测、agent 拍板**：脚本输出结构化 JSON 报告（cp 了哪些、status 是否 clean、有无需 agent 关注项），但**不替 agent 做任何不可逆决定**。
- **C 类死守 agent 层**：`EnterWorktree` 绝不进脚本——脚本是子进程，`cd` 退出即丢，且 commit `ce80aa9`（"删 canonical 脚本钉死的 cd"）已否决过"脚本钉 cd"这一反模式，不复活。
- **rule 正文瘦身**：删 A 类的**命令 bash**（cp 三类的 `cp`/`ln`/`find` 操作段），**保留各类"为什么"教学段**（如"cp 不 symlink"的理由、`-prune` 的解释）+ 一行指向脚本的指针。删的是"怎么敲命令"，留的是"为什么这么设计"。
- **A 类逻辑可测**：脚本的"决定做什么"层用 `node --test` 覆盖（对齐仓库现有 `hooks/*.test.mjs`），漏步/顺序错有红线。

非目标：本设计**不动** pre-create 的 fetch/ahead/base 选择与目录冲突判断——它们需要 agent 弹问、且发生在 worktree 还不存在时，不适合 post-create 脚本（见方案选型 Q2）。

## 架构

### 流程图

worktree 创建全流程，标出每步的执行主体（agent / 脚本 / git）和性质（A/B/C 类）：

```
[agent] 路径推导 (project_root / worktree_path)              ← 留 rule, 几行字符串拼接
   ↓
[agent] fetch + 算 ahead                                     ← B类: pre-create
   ↓
   ├─ ahead>0 ─→ [agent→user] 弹问选 base                    ← B类分叉, 不进脚本
   └─ ahead==0 / fetch失败 ─→ 静默
   ↓
[agent] 目录名冲突? ─→ 残留=remove重建 / 真冲突=报告用户      ← B类分叉, 不进脚本
   ↓
[git]   git worktree add -b <branch> <start_point>           ← A类单命令, 留 rule
   ↓
[agent] EnterWorktree(path=worktree_path)                    ← C类: 必须 harness 工具
   ↓
┌────────────────────────────────────────────────────────────────────┐
│ [脚本] node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs" \      │  ← A类全部 + B类探测
│            setup --project-root <p> --worktree-path <p>              │     post-create 补齐
│   · cp env/config (探测+cp)                                          │
│   · cp IDE (.vscode/.idea)                                           │
│   · cp node_modules + 增量 install (探测包管理器)                     │
│   · symlink .agents-personal                                        │
│   · git status clean 校验                                           │
│   → stdout: JSON 报告 (含 needsAttention[])                          │
└────────────────────────────────────────────────────────────────────┘
   ↓
[agent] 读 JSON, 有 needsAttention 才介入 (如 schema 不兼容)
   ↓
   ... 工作 ...
   ↓
[agent] ExitWorktree(action="keep")                          ← 先退出 worktree (rule:137), 否则 cwd 卡被删目录
   ↓
[脚本] node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs" \         ← A类: 拆链→remove 顺序钉死
           teardown --worktree-path <p>
```

### 文本总结

整体架构：把 worktree 生命周期切成 **pre-create（agent 主导）/ post-create 补齐（脚本主导）/ teardown（脚本主导）** 三段。新增 `scripts/worktree-setup.mjs` 只接管"补齐"和"销毁"两段的 A 类确定性步骤，对外是一个有 `setup` / `teardown` 两个 verb 的 CLI，输出 JSON 报告。

关键设计约束：

- **脚本分两层**：**计划层**（pure，决定"要 cp 哪些文件、组装什么 shell 命令"，可单测）+ **执行层**（`execFileSync` 跑 `cp`/`ln`/`git`，有副作用）。`--dry-run` 只跑计划层、输出 plan JSON 不碰文件系统——单测打计划层。这是"可测性"目标的落地机制。
- **脚本不做不可逆决定**：cp 是幂等的（`[ -e ]` 跳过已存在）；遇到"status 不 clean"/"env schema 可能不兼容"只写进 `needsAttention[]` 让 agent 判，不自己处理。
- **EnterWorktree 在脚本外**：脚本跑完时 cwd 已由 agent 切到 worktree，脚本拿 `--worktree-path` 显式定位、不依赖也不修改 cwd。

下一节展开新增脚本、改造 rule、改 manifest 三处的具体改动。

## 实现

### 影响

```
nocode-evolve/
├── scripts/
│   ├── worktree-setup.mjs                  (NEW)  setup/teardown 两 verb 的 CLI;
│   │                                              计划层(pure) + 执行层(execFileSync) 分离;
│   │                                              --dry-run 只输出 plan JSON
│   └── worktree-setup.test.mjs             (NEW)  node --test, 打计划层:
│                                                  ① cp 候选探测 ② 命令组装 ③ status 解析
│                                                  ④ 幂等跳过 ⑤ teardown 顺序
├── rules/
│   └── rule-git-worktree.md                 (改)  ① 删 cp 三类的命令 bash (cp/ln/find 操作段)
│                                                  ② 三类各留"为什么"教学 + 一行"调脚本"指针
│                                                     (字面样例见下「接口设计.rule 指针」)
│                                                  ③ 销毁节: inline 拆链+remove → 指向 teardown verb
│                                                  ④ EnterWorktree / 路径推导 / fetch-ahead 段保留不动
│                                                     (C类 + pre-create 不归脚本)
├── rules/
│   └── manifest.json                        (改)  git-worktree 的 summary: cp 三类描述
│                                                  → "建后调 worktree-setup.mjs 补齐(cp env/IDE/node_modules
│                                                     + symlink .agents-personal)"; pretooluse note 同步
├── hooks/
│   ├── agent-catalog.md (model/)            (改)  generate.mjs 重新生成 (禁手改)
│   ├── triggers.json                        (改)  generate.mjs 重新生成 (trigger 无变化, 可能不变)
│   └── pretooluse-rules.json                (改)  generate.mjs 重新生成 (note 变了)
└── .claude-plugin/
    └── plugin.json                          (改)  version minor 升 (行为等价的封装重构, 见 Q6)
```

> 注：`model/agent-catalog.md`、`hooks/triggers.json`、`hooks/pretooluse-rules.json` 是 `generate.mjs` 从 `manifest.json` 生成的产物，改 manifest 后跑 `node hooks/generate.mjs` 重新生成，不手改。

### 接口设计

#### 对外 API（CLI 契约）

脚本对 agent 暴露的就是 CLI。两个 verb：

| Verb | 必传 flags | 可选 flags | 行为 | stdout |
|---|---|---|---|---|
| `setup` | `--project-root <p>` `--worktree-path <p>` | `--dry-run` `--pkg-manager <npm\|pnpm\|yarn>` `--skip-install` | post-create 补齐：cp env/IDE/node_modules + symlink + status 校验 | JSON 报告 |
| `teardown` | `--worktree-path <p>` | `--dry-run` | 拆 `.agents-personal` symlink → `git worktree remove` | JSON 报告 |

`setup` 输出 JSON 报告 schema：

```json
{
  "verb": "setup",
  "worktreePath": "/Users/.../proj-feature_x",
  "copied": {
    "env":    ["有 .env.local 时列, 无则空数组"],
    "ide":    [".vscode", ".idea"],
    "nodeModules": ["node_modules", "packages/a/node_modules"]
  },
  "symlinked":  [".agents-personal"],
  "install":    { "status": "ran", "manager": "pnpm" },
  "_install_status_enum": "ran | skipped(--skip-install 或探测不到 lock) | no-node-modules",
  "gitStatusClean": true,
  "needsAttention": [
    "git status 不 clean: cp 的文件意外进了 tracking, 见 <文件>",
    "env schema 可能不兼容: <提示>"
  ]
}
```

- `--dry-run` 时输出同 schema，但 `copied`/`symlinked` 字段含义变为"将要执行的项"，并附 `plannedCommands: string[]`（计划层组装出的 shell 命令），不真执行。
- agent 约定：跑完 `setup` 只看 `needsAttention[]`——非空才介入；空则继续工作。
- **`--pkg-manager` 取值与回退**：不传时按 worktree 内 lock 文件 sniff（`pnpm-lock.yaml`→pnpm / `yarn.lock`→yarn / `package-lock.json`→npm）。**sniff 不到任何 lock → 跳过 install**（`install.status="skipped"`）并写一条 `needsAttention`（"未识别包管理器，install 已跳过，请手动对齐依赖"），不擅自 `npm install` 赌一把。枚举外的管理器（如 bun）只能由 agent 显式 `--pkg-manager` 传入才支持——脚本不内置 bun 探测，避免 hardcode 膨胀。

#### rule 指针字面样例（C2：rule 瘦身后正文保留的确切文本）

rule-git-worktree.md 删掉 cp 三类命令 bash 后，post-create 段落保留如下指针（变量 `project_root`/`worktree_path` 沿用 rule「路径推导」段已定义的同名变量）：

```bash
# worktree 建好 + EnterWorktree 之后, 一次性补齐 gitignored 运行物:
node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs" setup \
    --project-root "$project_root" --worktree-path "$worktree_path"
# 读 stdout JSON 的 needsAttention[]: 非空才介入(如 env schema 不兼容), 空则继续
```

销毁段保留：

```bash
# 销毁前先 ExitWorktree(action="keep") 退出 worktree, 再:
node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs" teardown \
    --worktree-path "$worktree_path"
```

`${CLAUDE_PLUGIN_ROOT}` 是插件运行时注入的根路径变量，与本仓既有约定一致（见 `rule-codex-review.md` 调 `codex-companion.mjs` 的形式）——agent cwd 在 worktree 时靠它绝对定位脚本，**不可写成裸 `node worktree-setup.mjs`**。

#### 内部接口（计划层 / 执行层切分）

```
// 计划层 (pure, 无副作用, 单测打这里)
function planEnvCopies(projectRoot): {rel: string}[]      // grep .gitignore 出 .env*/config.local*/secret 候选
function planIdeCopies(projectRoot, worktreePath): Cmd[]  // .vscode/.idea 存在且 worktree 无 → cp -Rc 命令
function planNodeModules(projectRoot, worktreePath): Cmd[]// find -prune 出的 node_modules → clonefile cp 命令
function planSymlink(projectRoot, worktreePath): Cmd|null // .agents-personal 存在且 worktree 无 → ln -s
function detectPkgManager(worktreePath): string           // 按 lock 文件 sniff: pnpm-lock/yarn.lock/package-lock
function parseGitStatus(stdoutRaw): {clean: bool, offenders: string[]}  // 解析 status -s, 滤 ?? 行

// 执行层 (副作用, dry-run 时不调)
function runCmd(cmd): void                                 // execFileSync 跑单条命令
function buildReport(plan, results): Report                // 组装 JSON 报告
```

类图：本设计是 CLI 脚本 + 文档改动，无类协作层次，不画。

### 业务流

**BF1 — setup 主流程（编排）**

```
function setup(projectRoot, worktreePath, opts):              // post-create 补齐主入口
    plan = {}                                                 // 计划层先全量算出"要做什么", 再执行
    plan.env   = planEnvCopies(projectRoot)                   // 探测 gitignored env 候选 (见 BF2)
    plan.ide   = planIdeCopies(projectRoot, worktreePath)     // .vscode/.idea (见 BF3 同型)
    plan.nm    = planNodeModules(projectRoot, worktreePath)   // node_modules clonefile (见 BF3)
    plan.link  = planSymlink(projectRoot, worktreePath)       // .agents-personal symlink
    if opts.dryRun:                                           // dry-run: 只输出计划, 不碰 FS
        return buildReport(plan, {plannedOnly: true})         // 含 plannedCommands[], 供单测/预览
    for cmd in flatten(plan):                                 // 执行层: 逐条跑 cp/ln
        runCmd(cmd)                                           // execFileSync, 失败抛 → 进 needsAttention
    if not opts.skipInstall and plan.nm非空:                  // 有 node_modules 才增量 install
        mgr = opts.pkgManager or detectPkgManager(worktreePath)// 未显式传则按 lock 文件 sniff
        if mgr == null:                                       // sniff 不到任何 lock 文件
            report.install = {status: "skipped"}              // 不擅自 npm install 赌一把
            report.needsAttention.push("未识别包管理器, install 已跳过, 请手动对齐依赖")
        else:
            runCmd(installCmd(mgr, worktreePath))             // npm/pnpm/yarn install 对齐本分支 lock
    status = parseGitStatus(gitStatusRaw(worktreePath))       // cp 后校验 worktree 仍 clean
    return buildReport(plan, {status})                        // status 不 clean → 进 needsAttention[]
```

**BF2 — env 文件探测（计划层，无项目假设）**

```
function planEnvCopies(projectRoot):                          // 探测要 cp 哪些 gitignored env/config
    ignoreFiles = glob(projectRoot, "**/.gitignore")          // 主仓根 + 子包所有 .gitignore
    patterns = [/(^|\/)\.env(\.[^/]+)?$/,                     // 锚定 .env / .env.local 文件名,
                /(^|\/)config\.local\./, /secret/i]           // 不用裸 /\.env/ 子串(会误命中 *.environment / development/)
                                                              // 仍是通用 pattern, 不 hardcode 项目特异文件名
                                                              // (rule 明确禁止钉死项目特异文件名)
    candidates = []
    for line in linesOf(ignoreFiles):                         // 扫 .gitignore 每行
        if matchesAny(line, patterns):                        // 命中 env/config/secret 特征
            for f in glob(projectRoot, line):                 // 展开成实际存在的文件
                if exists(f): candidates.push(relpath(f))     // 主仓真实存在才算候选
    return candidates                                         // agent 复核清单(报告里回显), 不替它判
```

**BF3 — IDE / node_modules clonefile cp（计划层 + 执行层）**

```
function planNodeModules(projectRoot, worktreePath):          // node_modules 同 IDE 用 clonefile
    srcs = find(projectRoot, "-type d -name node_modules -prune")  // -prune: 不下钻嵌套, 随父目录一起 cp
                                                              // (Q1: 沿用 rule-git-worktree.md:245 现有同款 find -prune,
                                                              //  已验证打印路径; 实现时如需显式可追 -print)
    cmds = []
    for src in srcs:
        rel = relpath(src, projectRoot)                       // 保持相同相对路径
        dst = join(worktreePath, rel)
        if exists(dst): continue                              // 幂等: worktree 已有则跳过
        cmds.push(["cp", "-Rc", src, dst])                    // clonefile 写时复制: 瞬时/近零空间
                                                              // 执行层 runCmd 里 -Rc 失败回退 cp -R
    return cmds
// planIdeCopies 同型: 对 [".vscode", ".idea"] 各判存在+幂等, 组 cp -Rc 命令
```

**BF4 — teardown（拆链→remove 顺序钉死）**

```
function teardown(worktreePath, opts):                        // 销毁主入口
    link = join(worktreePath, ".agents-personal")
    cmds = []
    if isSymlink(link):                                       // 只在确实是 symlink 时拆
        cmds.push(["rm", link])                               // 只删 symlink 自身, 不递归 target (主仓不动)
    cmds.push(["git", "worktree", "remove", worktreePath])    // 拆链后 remove 不再需要 --force
                                                              // (Q2 前提: worktree 无其他 untracked; 有则 remove 拒绝, 见异常表)
    if opts.dryRun: return buildReport({cmds}, {plannedOnly:true})
    for cmd in cmds: runCmd(cmd)                              // 顺序固定: 先 rm link 再 remove
    return buildReport({cmds}, {})                            // remove 失败(有其他 untracked)→ needsAttention
```

> teardown **只删工作目录, 保留 branch**。远程分支清理归 `rule-finishing-branch` 的 Gate RD，不在本脚本——保留 branch 的场景删远程会误删正要继续的分支。

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | cp 命令失败 | 目标路径无权限 / 磁盘满 | 该项记入 `needsAttention[]`，继续其余 cp（不中断整体补齐） | 吞（记报告） |
| BF1 | git status 不 clean | cp 的文件意外进 tracking（gitignore 没覆盖） | `gitStatusClean:false` + offenders 写 `needsAttention[]` | 吞（agent 判） |
| BF1 | 探测不到包管理器 | worktree 内无 lock 文件且未传 `--pkg-manager` | `install.status="skipped"` + 记 `needsAttention` | 吞（不擅自 install） |
| BF3 | `cp -Rc` 不被支持 | 非 APFS / Linux 无 reflink | 执行层捕获 → 回退 `cp -R`（慢但正确） | 吞（自动回退） |
| BF4 | `git worktree remove` 拒绝 | worktree 有其他 untracked / 改动 | 报告 `needsAttention`，不加 `--force` 强删 | 吞（agent 判） |
| BF1-BF4 | 必传 flag 缺失 | agent 漏传 `--worktree-path` | 启动即校验，打印 usage 退出非零 | 上抛（exit≠0） |

### 单测设计

**BF1 — setup 主流程**

- **case 1.1 dry-run 输出计划不碰 FS**
  - Given: 临时 fixture 仓含 `.vscode/`、一个 `node_modules`、`.agents-personal/`
  - When: `setup --dry-run` 被调
  - Then: 报告 `plannedCommands` 含 cp/ln 各命令；fixture 的 worktree 目录无任何新文件落地

- **case 1.2 幂等跳过已存在**
  - Given: worktree 已有 `.vscode/`
  - When: `planIdeCopies` 被调
  - Then: 返回的命令列表不含 `.vscode` 的 cp（`[ -e ]` 跳过生效）

- **case 1.3 cp 命令失败吞而不中断**（异常表 BF1 cp 失败行）
  - Given: 一条 cp 命令在执行层抛错（stub `runCmd` 对某条目抛），其余 cp 正常
  - When: `setup`（非 dry-run）被调
  - Then: 报告 `needsAttention` 含该失败项，其余 cp 仍执行完，进程不中断退出

- **case 1.4 探测不到包管理器跳过 install**（异常表 BF1 探测不到行）
  - Given: worktree 有 `node_modules` 但无任何 lock 文件，未传 `--pkg-manager`
  - When: `setup` 被调
  - Then: `install.status=="skipped"`，`needsAttention` 含"未识别包管理器"，不调 install 命令

**BF2 — env 文件探测**

- **case 2.1 命中 pattern**
  - Given: `.gitignore` 含 `.env.local`，主仓存在该文件
  - When: `planEnvCopies` 被调
  - Then: 候选含 `.env.local`

- **case 2.2 锚定 pattern 不误命中子串**（W3）
  - Given: `.gitignore` 含 `dist/`、`*.log`、`*.environment`、`development/`（后两项会被裸 `/\.env/` 子串误命中）
  - When: `planEnvCopies` 被调
  - Then: 候选不含 `dist`、`.log`、`.environment`、`development`（锚定 pattern `/(^|\/)\.env(\.[^/]+)?$/` 不误命中）

**BF3 — clonefile cp**

- **case 3.1 node_modules -prune 不重复嵌套**
  - Given: fixture 含 `node_modules/` 内部又嵌 `node_modules/`
  - When: `planNodeModules` 被调
  - Then: 命令只对顶层 `node_modules` 一条 cp（嵌套随父一起 copy，不单列）

- **case 3.2 `cp -Rc` 不支持时回退 `cp -R`**（异常表 BF3 行）
  - Given: 执行层 `runCmd` 跑 `cp -Rc` 抛"不支持 clonefile"错（stub 模拟非 APFS）
  - When: 该 cp 条目被执行
  - Then: 自动重试 `cp -R` 同源同目标，最终该目录被复制，不进 `needsAttention`

**BF4 — teardown 顺序**

- **case 4.1 先拆链再 remove**
  - Given: worktree 有 `.agents-personal` symlink
  - When: `teardown --dry-run` 被调
  - Then: `plannedCommands` 顺序为 `["rm", link]` 在前、`["git","worktree","remove",...]` 在后

- **case 4.2 无 symlink 不拆**
  - Given: worktree 无 `.agents-personal`
  - When: `teardown --dry-run` 被调
  - Then: 命令只含 `git worktree remove`，无 `rm`

- **case 4.3 解析 git status**
  - Given: `git status -s` 原始输出含 `?? foo`（untracked）与 ` M bar`（modified）
  - When: `parseGitStatus` 被调
  - Then: `clean:false`，offenders 含 `bar` 不含 `foo`（`??` 行被滤）

- **case 4.4 `worktree remove` 被拒绝**（异常表 BF4 行）
  - Given: 执行层 `git worktree remove` 抛错（worktree 有其他 untracked）
  - When: `teardown`（非 dry-run）被调
  - Then: 报告 `needsAttention` 含 remove 失败原因，不自动追加 `--force` 重试

## 方案选型

### Q1: 脚本语言 — node(.mjs) 还是 bash(.sh)？

**选项**: node（对齐仓库 `generate.mjs`，可 `node --test`，但 fs 副作用要 `execFileSync` 包系统命令）vs bash（cp/ln/find 是原语更直接，但测试要引 bats、仓库无此栈）
**定**: node。因"可测性"是本设计主收益之一，仓库已有 `hooks/*.test.mjs` 的 `node --test` 文化；clonefile（`cp -Rc`）node `fs.cpSync` 不支持 reflink，故 fs 操作统一 `execFileSync` shell out 到 `cp`/`ln`/`git`，纯逻辑（探测/组装/解析）留 node 可测。→ 影响 BF1-BF4 全部。

### Q2: setup 脚本边界 — post-create only 还是含 pre-create（fetch/ahead/冲突）？

**选项**: post-create only（只补齐 cp/symlink）vs 含 pre-create（脚本也跑 fetch+算 ahead+建分支）
**定**: post-create only。因 pre-create 的 `ahead>0` 要**弹问用户选 base**、目录冲突要**判残留 vs 真冲突**——都是不可逆决定，脚本不该替用户拍板；且它们发生在 worktree 还不存在时，`--worktree-path` 无从谈起。pre-create 留 rule + agent。→ 影响"非目标"声明 + 流程图分段。

### Q3: env 文件识别 — 脚本自动探测还是 agent 传 `--env-files`？

**选项**: 脚本扫 `.gitignore` 自动探测 vs agent 探测后传参 vs 脚本 hardcode 文件清单
**定**: 脚本探测（扫 `.gitignore`，用**锚定** pattern 匹配 `.env`/`.env.*`/`config.local.*`/`secret`，不用裸子串避免误命中 `*.environment` 之类）+ 报告回显清单让 agent 复核。因 hardcode 违反 rule"不钉死项目特异文件名"；让 agent 传参又把判断推回 agent、丧失脚本化收益。探测覆盖常规命名，边界 case 走 `needsAttention` 让 agent 补。→ 影响 BF2。

### Q4: 分叉点信号 — exit code 还是 JSON stdout？

**选项**: exit code 约定（如 exit 3=需弹问）vs JSON stdout 报告
**定**: JSON stdout。因 exit code 表达力低（要 agent 记一套码表），且本脚本是 post-create、没有"需弹问"的不可逆分叉，只有"需关注"信号；JSON 的 `needsAttention[]` 数组天然可携带多条 + 文字说明。→ 影响接口设计 JSON schema。

### Q5: teardown 进不进脚本？

**选项**: 进脚本（封装拆链→remove 顺序）vs 留 rule inline（就两行）
**定**: 进脚本。因"先拆 symlink 再 remove"的**顺序**是有红线的（顺序反了 `worktree remove` 会因 untracked symlink 拒绝或 `--force` 风险），脚本钉死顺序 + 单测覆盖比 rule 口头约束可靠。→ 影响 BF4。

### Q6: plugin.json version — major 还是 minor？

**选项**: major（rule 操作方式从"贴 bash"变"调脚本"）vs minor（最终行为等价，仅封装方式变）
**定**: minor，**2.10.0 → 2.11.0**。因 rule 语义没反转、worktree 最终状态完全一致，agent 行为是"等价封装"而非破坏性变更；新增脚本属能力增强。按 `CLAUDE.md` SemVer 约定（minor=兼容性增强）。→ 影响 plugin.json。

## 其他

### 部署

本次是 Claude Code 插件源码改动，无运行时部署：

- **灰度策略**: 无——插件直接拉 git，用户主动 update；不分批
- **回滚预案**: `git revert` 改动 commit + version patch 升；脚本是新增文件，回滚不影响既有 rule（rule 改动与脚本是同一 commit，一起 revert）
- **监控指标**: 无 metric——通过 dogfood（下次真实建 worktree 时验证脚本路径）+ `node --test` 通过率把关

## Review Log

### Review 1 — 2026-06-02

> Reviewer: general-purpose subagent（单路）。**codex 跨模型审稿降级**：`codex-companion.mjs setup --json` 返回 `ready:false`（CLI 已装但 `auth.loggedIn:false`，broker socket 拒连/未登录），按 `rule-codex-review` 场景 4 fallback 为仅 general-purpose 一路。

**Reviewer Report 全文**：

- **C1** `[流程图/影响/接口/Q1]` 脚本调用全文用裸 `node worktree-setup.mjs`，缺 `${CLAUDE_PLUGIN_ROOT}` 前缀。本仓既有脚本一律绝对定位（`rule-codex-review.md:10`）；agent cwd 已被 EnterWorktree 切到 worktree，裸名找不到文件——落地跑不通。
- **C2** `[影响]`（同 C1 根）rule 保留的"调脚本"指针没给确切字面文本（含 `${CLAUDE_PLUGIN_ROOT}` + 两个必传 flag + 变量来源）。
- **W1** `[接口/CLI 表]` `--pkg-manager` 枚举只列 npm/pnpm/yarn，bun 等未定义；异常表没覆盖"detectPkgManager 探测不到 lock"分支。
- **W2** `[BF1/单测]` 异常表 5 行里 3 行（cp 失败吞、`cp -Rc` 回退、`worktree remove` 拒绝）在单测设计节无对应 case，单测未闭环。
- **W3** `[Q3/BF2]` env pattern `/\.env/` 子串正则会误命中 `*.environment`/`development/`；单测没测过宽误命中；"覆盖 95%"无依据。
- **W4** `[目标/影响]` "砍掉 ~120 行 bash" 与"保留为什么教学"矛盾（cp 三类约 140 行含教学要留），数字无依据。
- **S1** `[JSON schema]` `install.ran/skipped` 语义重叠，建议合成 `install.status`。
- **S2** `[Q6]` 当前 version 已 2.10.0，建议 Q6 写 "2.10.0 → 2.11.0"。
- **S3** `[流程图]` teardown 时 agent 已不该在被删 worktree 里——应标 teardown 前先 `ExitWorktree`。
- **Q1** `[BF3]` `find ... -prune` 单用是否打印路径？实现时确认 `-prune -print` 或等价。
- **Q2** `[BF4]` "remove 不再需要 --force" 漏了原注释前提"（没别的 untracked）"。
- **SA1**（同 C1）最大实施阻塞=全文无可粘贴脚本调用样例。
- **SA2**（同 W2）异常表 3 行无单测 case，设计未闭环。
- **Verdict**: ❌ Has issues。

**用户决定**：全部采纳 — fix C1, C2, W1, W2, W3, W4, S1, S2, S3；answer Q1, Q2（SA1 随 C1/C2 修、SA2 随 W2 修）。

**本轮修订**：
- C1, C2, SA1：流程图 / 影响 / 接口 / Q1 的脚本调用统一加 `${CLAUDE_PLUGIN_ROOT}/scripts/worktree-setup.mjs`；接口设计新增「rule 指针字面样例」子节，给出 setup / teardown 两段可粘贴的 rule 正文文本。
- W1：接口节补 `--pkg-manager` sniff 回退规则（探测不到 lock → 跳过 install + needsAttention，不擅自 npm install；bun 等需显式传）；BF1 伪代码补 `mgr==null` 分支；异常表加「探测不到包管理器」行。
- W2, SA2：单测补 case 1.3（cp 失败吞）、1.4（探测不到包管理器跳过）、3.2（`cp -Rc` 回退 `cp -R`）、4.4（`worktree remove` 拒绝）——异常表每行现都有对应 case。
- W3：BF2 pattern 从裸 `/\.env/` 收紧为锚定 `/(^|\/)\.env(\.[^/]+)?$/`；Q3 删"95%"无依据数字；单测 case 2.2 扩为含 `*.environment`/`development/` 的不误命中断言。
- W4：目标节 + 影响节去掉"~120 行"误导数字，改为"删命令 bash、保留为什么教学段"。
- S1：JSON schema `install` 改 `{status, manager}`，status 枚举 `ran|skipped|no-node-modules`。
- S2：Q6 定句补 "2.10.0 → 2.11.0"。
- S3：流程图 teardown 前加 `[agent] ExitWorktree(action="keep")` 步骤。

**Open Questions 答复**：
- Q1：实现沿用 rule-git-worktree.md:245 现有同款 `find ... -prune`（已在生产用、验证打印路径）；已在 BF3 注释标明、并注"实现时如需显式可追 `-print`"。fix（注释补齐）。
- Q2：BF4 注释补"（前提: worktree 无其他 untracked; 有则 remove 拒绝, 见异常表）"，与异常表 BF4 行呼应。fix（注释补齐）。
