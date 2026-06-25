---
type: design-doc
topic: .agents-personal/ 版本快照 — SessionStart 自动 commit 到外部 bare repo
date: 260625
author: 3dot141
status: draft
last_updated: 260625
---

# Design Doc: .agents-personal/ 版本快照

## 背景

**核心问题**: `.agents-personal/` 是项目本地的 AI 知识目录（wiki 历史记忆 + rules 工作指令），gitignored 不入项目仓库。目前**误删不可恢复**——一次 `rm -rf` 就丢掉所有积累的设计决策、踩坑记录、个人规则。

现有保护机制只有 PreToolUse 的 `personal-deletion-guard`（`rules/manifest.json` 的 `personal-deletion-guard` rule），它在 agent 执行 `rm`/`mv` 前 inject 提醒——但这是 agent 层的软护栏，挡不住用户手动误删、脚本误操作、或磁盘故障。

**附带问题**（本 doc 一并解决）: distill/sow 产出的 wiki 和 rules 没有变更历史，无法追溯"上次写了什么、这次改了什么"，superseded 页面的演进链也无据可查。

不做的代价: 内容越积越多，风险越来越大。一次误操作 = 数周/数月的知识沉淀归零。

## 目标

- 每次新会话启动时，自动检测 `.agents-personal/` 是否有变更，有则 commit 到外部 bare repo——**用户无感**
- bare repo 在 `.agents-personal/` **外部**（`~/.nocode/personal-history/<project-id>/`），目录内不放 `.git/`——IDE 不困惑、`rm -rf .agents-personal` 不连带丢 git 历史
- worktree 场景（symlink 指向主仓同一目录）正确工作，不冲突不重复
- 脚本错误不阻断 session 启动（warn 到 stderr + exit 0）

## 架构

### 流程图

SessionStart hook 调用 `personal-snapshot.mjs` 的决策流程:

```
SessionStart hook 触发
       ↓
personal-snapshot.mjs 启动
       ↓
检测 PERSONAL_DIR 是否存在
       ↓ 不存在
exit 0 (fast path, <1ms)
       ↓ 存在
resolve symlink → 拿到物理路径
       ↓
计算 PROJECT_ID (basename-md5_8)
       ↓
BARE_DIR = ~/.nocode/personal-history/<PROJECT_ID>/
       ↓
BARE_DIR 存在?
       ↓ 不存在              ↓ 存在
git init --bare          (跳过)
       ↓                    ↓
git add -A -f (全量)      git add -A -f (增量，绕过 ignore)
       ↓
git diff --cached --quiet?
       ↓ 无变更              ↓ 有变更
exit 0 (no-op)           git commit -m "auto: YYMMDD-HHMM"
                               ↓
                          exit 0 (committed)
```

### 文本总结

整体架构是"单脚本 + 外部 bare repo"模式。`scripts/personal-snapshot.mjs` 作为一条新的 SessionStart hook 命令独立运行，通过 `git --git-dir=<bare> --work-tree=<physical-dir>` 操作外部 bare repo，与项目本身的 git 仓库完全隔离。关键约束: 脚本不输出 `additionalContext`（不往 session 注入内容），错误不阻断 session。

## 实现

### 影响

```
nocode-evolve/
├── scripts/
│   └── personal-snapshot.mjs          (NEW)  核心脚本: 检测 + init + snapshot
├── hooks/
│   ├── hooks.json                     (改)  ① SessionStart 数组末尾加一条
│   │                                         node ${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs
│   └── personal-snapshot.test.mjs     (NEW)  单测文件
└── .claude-plugin/
    └── plugin.json                    (改)  version minor 升级 (3.40.0 → 3.41.0)
```

### 接口设计

无对外 API 变更。无数据模型变更。

##### 内部接口

`personal-snapshot.mjs` 的 CLI 接口（对齐 `freshness-check.mjs` 风格）:

```
node personal-snapshot.mjs [--dry-run] [--json]
```

| Flag | 默认 | 说明 |
|---|---|---|
| `--dry-run` | false | 只报告不执行 git 操作 |
| `--json` | false | JSON 格式输出到 stdout |

环境变量:

| 变量 | 来源 | 说明 |
|---|---|---|
| `CLAUDE_PROJECT_DIR` | Claude Code 注入 | 当前项目目录，用于定位 `.agents-personal/` |
| `HOME` | 系统 | 用于定位 `~/.nocode/` |

Exit codes: `0` = 成功（含 no-op）。脚本不使用非零 exit code，所有错误 warn 到 stderr + exit 0。

内部函数:

```javascript
function resolvePersonalDir(projectDir)            // 拼接 + resolve symlink，返回物理路径或 null
function projectId(physicalProjectDir)             // basename(dir) + '-' + md5_8(dir)
function bareRepoPath(historyRoot, id)             // path.join(historyRoot, id)
function ensureBareRepo(bareDir)                   // 不存在则 mkdir -p + git init --bare -b main
function git(bareDir, workTree, cmd)               // execSync `git --git-dir=... --work-tree=... ${cmd}`
function gitQuiet(bareDir, workTree, cmd)           // 同 git() 但 allowFail，返回 exit code == 0
function snapshot(bareDir, workTree, dryRun)        // add -A -f → diff --cached --quiet → commit
function formatTimestamp()                          // 返回 YYMMDD-HHMMSS 格式字符串
```

hook 路径（`hooks.json` 注入的命令）不传任何 flag，走默认行为。`--dry-run` 和 `--json` 仅供测试和手动调用。

### 业务流

**BF1 — 检测与 resolve .agents-personal/**

```
function resolvePersonalDir(projectDir):          // 入口: 拿到物理路径或判定跳过
    personalDir = path.join(projectDir, '.agents-personal')
    if !fs.existsSync(personalDir):               // 该项目没有 .agents-personal/
        return null                               // 调用方收到 null 直接 exit 0
    stat = fs.lstatSync(personalDir)              // lstat 不跟 symlink, 判它本身是不是 symlink
    if stat.isSymbolicLink():                     // worktree 场景: symlink 指向主仓
        resolved = fs.realpathSync(personalDir)   // resolve 到物理路径
        return resolved                           // 后续所有操作基于物理路径
    return personalDir                            // 非 symlink, 直接用
```

**BF2 — 首次初始化 bare repo**

```
function ensureBareRepo(bareDir):                 // 入口: 确保 bare repo 存在
    if fs.existsSync(bareDir):                    // 已初始化过
        return                                    // 直接返回
    fs.mkdirSync(bareDir, { recursive: true })    // ~/.nocode/personal-history/<id>/ 逐级创建
    git(bareDir, null, 'init --bare -b main')     // 初始化空 bare repo，显式指定分支名
                                                  // 避免依赖用户 init.defaultBranch config
    // 首次 commit 由 BF3 的 snapshot() 统一处理
    // git init --bare 后首次 add + commit 就是 initial snapshot
```

**BF3 — 增量快照**

```
function snapshot(bareDir, workTree, dryRun):     // 入口: 检测变更并 commit
    // -f 绕过 core.excludesfile 和 .gitignore —— snapshot 必须全量备份，
    // 否则被 ignore 的文件恢复时才发现没备份（虚假安全感比没备份更危险）
    git(bareDir, workTree, 'add -A -f')           // 强制全量加入，不受 ignore 规则影响
    // --quiet: 无变更 exit 0, 有变更 exit 1
    hasChanges = !gitQuiet(bareDir, workTree, 'diff --cached --quiet')
    if !hasChanges:                               // 上次快照以来没变过
        return { status: 'no_changes' }           // 调用方输出 "no changes" 然后 exit 0
    if dryRun:                                    // --dry-run 模式
        return { status: 'dry_run', changes: true }
    timestamp = formatTimestamp()                  // YYMMDD-HHMMSS 格式, 如 "260625-143022"
                                                  // 秒级粒度避免同分钟内两次 SessionStart 撞 message
    git(bareDir, workTree, `commit -m "auto: ${timestamp}"`)
    return { status: 'committed', timestamp }     // 调用方输出 "committed" 然后 exit 0
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | PERSONAL_DIR 不存在 | 项目没有 .agents-personal/ | return null → exit 0 | 吞 |
| BF1 | realpathSync 失败 | symlink 指向已删除的目标 | warn "broken symlink" → exit 0 | 吞 |
| BF2 | mkdirSync 权限失败 | ~/.nocode/ 目录无写入权限 | warn "cannot create history dir" → exit 0 | 吞 |
| BF2 | git init --bare 失败 | git 未安装 / 版本过低 | warn "git not available" → exit 0 | 吞 |
| BF3 | git add -A 失败 | 文件锁 / 权限问题 | warn + exit 0 | 吞 |
| BF3 | git commit 失败 | 空 user.name/user.email config | 用 `-c user.name=snapshot -c user.email=snapshot@local` 覆盖 | 吞 |

所有异常统一处理策略: **warn 到 stderr + exit 0，不阻断 session**。快照是"尽力而为"的保护网，不是关键路径。

### 单测设计

测试用 `node --test`，每个 case 创建 tmpdir 隔离，不污染真实环境。

**BF1 — 检测与 resolve**

- **case 1.1 主路径 — 无 .agents-personal/**
  - Given: tmpdir 下没有 .agents-personal/
  - When: 脚本运行
  - Then: exit 0，无 git 操作，stdout 含 `"status":"skipped"`（--json 模式）

- **case 1.2 主路径 — 有 .agents-personal/ (非 symlink)**
  - Given: tmpdir/.agents-personal/ 存在且有文件
  - When: 脚本运行
  - Then: 走 BF2/BF3 流程

- **case 1.3 symlink 场景**
  - Given: tmpdir/.agents-personal → 另一个目录（模拟 worktree）
  - When: 脚本运行
  - Then: resolve 到物理路径，project-id 基于物理路径计算

- **case 1.4 断裂 symlink**
  - Given: tmpdir/.agents-personal → 不存在的路径
  - When: 脚本运行
  - Then: warn 到 stderr，exit 0

**BF2 — 首次初始化**

- **case 2.1 主路径 — 首次 init + initial commit**
  - Given: .agents-personal/ 有 3 个文件，~/.nocode/ 下无对应 bare repo
  - When: 脚本运行
  - Then: bare repo 创建，`git log` 显示 1 个 commit 含 3 个文件

- **case 2.2 幂等 — bare repo 已存在**
  - Given: bare repo 已存在（之前初始化过）
  - When: 脚本运行
  - Then: 不重复 init，直接走 BF3

**BF3 — 增量快照**

- **case 3.1 有变更 — 新增文件**
  - Given: bare repo 已有 initial commit，.agents-personal/ 新增了 1 个文件
  - When: 脚本运行
  - Then: 新 commit，`git log` 显示 2 个 commit

- **case 3.2 有变更 — 修改文件**
  - Given: bare repo 已有 commit，.agents-personal/ 某文件内容改了
  - When: 脚本运行
  - Then: 新 commit，`git diff HEAD~1` 显示该文件变更

- **case 3.3 无变更**
  - Given: bare repo 已有 commit，.agents-personal/ 没有任何变化
  - When: 脚本运行
  - Then: 无新 commit，exit 0

- **case 3.4 --dry-run**
  - Given: .agents-personal/ 有变更
  - When: 脚本以 --dry-run 运行
  - Then: 不执行 git commit，报告 `"status":"dry_run"`

- **case 3.5 project-id 确定性**
  - Given: 同一物理路径
  - When: 两次调用
  - Then: project-id 相同，写入同一个 bare repo

## 方案选型

### Q1: project identifier 用什么算法?

**选项**: md5(realpath) 全量（如 `a1b2c3d4e5f6...`，32 字符，不可读） vs basename-md5_8（如 `my-project-a1b2c3d4`，可读且唯一）vs 纯 basename（如 `my-project`，可读但可能冲突）
**定**: basename-md5_8。因纯 md5 不可读（用户 `ls ~/.nocode/personal-history/` 看不出哪个是哪个项目），纯 basename 会冲突（两个项目都叫 `app`）。`basename-md5_8` 兼顾可读性和唯一性，8 位 hex 碰撞概率约 1/43 亿。

### Q2: git user.name/email 怎么处理?

**选项**: 依赖全局 gitconfig（可能没配置） vs 每次 commit 用 `-c` 覆盖 vs 在 bare repo 里 `git config` 一次
**定**: 每次 commit 用 `-c user.name=snapshot -c user.email=snapshot@local` 覆盖。因不依赖用户 gitconfig 状态，不修改 bare repo 配置，幂等无副作用。→ 影响 BF3。

### Q3: hooks.json 新命令放在 SessionStart 数组的哪个位置?

**选项**: 放在 inject-rules.sh 全部执行完之后（数组末尾） vs 放在最前面（数组开头）
**定**: 放末尾。因快照不影响 rule 注入，放末尾保证 rule 注入先完成。脚本无网络调用、无长循环，hang 概率为零，放末尾是纯防御性布局。

## 其他

### 部署

无运行时部署。本次改动是 Claude Code 插件源码文件修改:

**Retention**: 暂不做 prune/gc。bare repo 存的是纯文本文件的增量 commit，git 自带压缩（packfile），常规使用下年增长量在 KB~MB 级。等实际观察到空间问题再加 retention 策略（如 `git gc --aggressive` 或保留 N 天 squash）。这是显式决策，不是遗漏。

- **灰度策略**: 无——插件直接拉 git，用户主动 update
- **回滚预案**: git revert + patch 升版本；用户已有的 bare repo 不受影响（独立于插件）
- **监控指标**: 无 metric——脚本 stderr 的 warn 日志可人工排查

---

## Review Log

### Review 1 — 260625

**Reviewer**: general-purpose subagent（codex 不可用，降级单路）

**Verdict**: ❌ Has issues

**Finding 清单**:
- C1: `git add -A` 继承 `core.excludesfile` 和 `.gitignore`，可能静默漏快照
- W1: bare repo 无 retention/prune 设计
- W2: 背景引用 `manifest.json:170` 行号错误
- W3: `--dry-run`/`--json` 只在测试用，doc 没澄清
- W4: 内部函数清单与业务流签名不一致（缺 `ensureBareRepo`/`formatTimestamp`，`snapshot` 签名不匹配）
- S1: timestamp 分钟粒度可能撞 message
- S2: Q3 "防 hang" 理由略冗余
- Q1: `git --git-dir + --work-tree` 跨目录 add 实际范围待验证
- Q2: worktree session 里 `CLAUDE_PROJECT_DIR` 取值待验证
- SA1: 与 C1 同根
- SA2: `formatTimestamp` 漏列（与 W4 同根）
- SA3: `git init --bare` 默认分支名未固定

**用户决定**: 全修 C+W+SA；S1-S2 顺手修；Q1-Q2 留到实施时端到端验证

**本轮修订**:
- C1: BF3 `git add -A` 改为 `git add -A -f`，绕过 ignore 规则确保全量备份；流程图同步
- W1: 「其他」节新增 Retention 显式决策段（暂不做 prune，接受增长）
- W2: 背景节行号引用改为按 rule id 引用（不带行号，避免漂移）
- W3: 内部接口节末尾补充说明"flag 仅供测试/手动调用，hook 走默认无参"
- W4: 内部函数清单补 `ensureBareRepo`/`gitQuiet`/`formatTimestamp`，`snapshot` 签名统一为含 `dryRun` 参数
- S1: timestamp 从 `YYMMDD-HHMM` 改为 `YYMMDD-HHMMSS`（秒级粒度）
- S2: Q3 决策理由补"脚本无网络/无长循环，hang 概率为零"
- SA2: 随 W4 一并修
- SA3: BF2 `git init --bare` 改为 `git init --bare -b main`
