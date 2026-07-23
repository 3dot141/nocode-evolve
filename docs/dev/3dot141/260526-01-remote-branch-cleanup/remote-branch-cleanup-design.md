---
type: design-doc
topic: finishing-branch 删本地 branch 后清理远程同名分支 (Gate RD)
date: 260526
author: 3dot141
status: in-review
last_updated: 260526
---

# Design Doc: 远程分支清理 (Gate RD)

## 背景

**核心问题**：`rule-finishing-branch.md` 的收尾流程里，选项1（Merge 回 base）和选项4（Discard）都会**删本地 branch**，但**远程同名分支没人管**——分支若曾 `push` 过 / 开过 PR，本地删完后 `origin/<branch>` 留成 stale 分支，越积越多，得事后手动 `git push origin --delete` 清理。具体表现：

- 选项1 Merge：本地把 feature 合进 `main` 后删本地 branch，远程 `origin/feature` 还在，下次 `git branch -r` 一堆已合并的死分支。
- 选项4 Discard：丢弃工作 force 删本地 branch，远程那份残留更没意义，但流程不提醒，用户常忘。

**附带澄清**（本 doc 一并钉死，防未来误改）：`rule-git-worktree.md` 里另有两处 worktree 移除——「目录名冲突怎么办」(L111-117，清残留后**重建复用同名分支**) 与「销毁 worktree 前必读」(L243-252，通用销毁子过程)——这两处**只删 worktree、保留 branch**，远程清理逻辑**不该**挂到那里，否则重建复用场景会误删正要继续的远程分支。

> 注：下文为行文简洁，统称这两处为"worktree-移除-但保留-branch 场景"；它们在 `rule-git-worktree.md` 里**没有 #1/#2 编号标签**，实施时按上面的真实节名定位。

不解决的代价：远程分支墓地越堆越大，且"删本地就该顺手清远程"这个语义散落在用户脑子里、没固化进规则；未来有人想"补全删除逻辑"时容易错挂到 worktree 移除处。

## 目标

- 删本地 branch 后**自动探测其对应的远程分支并询问清理**（默认同名；本地分支 upstream 指向不同名远程分支时，按 upstream 实际指向解析），把"本地删了远程留 stale"的缺口补上。
- 触发面精确收敛到**真正删本地 branch 的两个触点**（选项1 Merge / 选项4 Discard），worktree-移除-但保留-branch 的场景一律不碰。
- 远程删除**默认保留**（要用户明确选才删），且 Merge 场景带"远程独有 commit"安全护栏，杜绝静默丢 commit。
- 把"远程清理 ≠ worktree 移除"的语义固化进 `rule-git-worktree.md`，防未来误挂。

## 架构

### 流程图

Gate RD 在收尾流程里的落点（★ 为新增）：

```
finishing-branch 4 选项菜单
   │
   ├─ 选项1 Merge ── commit-tidy → Gate M → 本地 merge → tests
   │                  → cleanup worktree → 删本地 branch
   │                  → ★ remote-branch-cleanup 子过程 (Gate RD) ★
   │
   ├─ 选项2 PR ───── ... → push → create PR        (不删 branch, 无 Gate RD)
   │
   ├─ 选项3 Keep ─── 一行报告路径                    (不动, 无 Gate RD)
   │
   └─ 选项4 Discard ─ Gate D (typed discard)
                      → cleanup worktree → force 删本地 branch
                      → ★ remote-branch-cleanup 子过程 (Gate RD) ★
```

子过程内部串行决策：

```
[删本地 branch 前] 捕获远程坐标 (remote 名 + remote-branch 名) ─┐
                                            ↓
[删本地 branch 后] git ls-remote --heads <remote> refs/heads/<remote-branch>
                                            ↓
                              远程有这分支?
                          ┌────── 否 ──────┐
                          ↓                ↓
                  网络/权限失败?         静默跳过 (不打扰)
                  warn + 跳过 (不阻塞)
                          │
                          是 → 算"远程独有 commit"护栏 (Merge/Discard 分支)
                              ↓
                          Gate RD (AskUserQuestion, 默认保留; 有独有 commit 则警示数+sha)
                          ┌──── 选删 ────┐──── 选保留(默认) ────┐
                          ↓                                      ↓
                  git push <remote> --delete <branch>    一行报告"已保留"
```

### 文本总结

整体设计：在 `rule-finishing-branch` 的「门面 + 子文件」架构里**新增一个共享子文件** `remote-branch-cleanup.md`，作为**删本地 branch 的附属子过程**。门面在选项1 / 选项4 的删 branch 步骤后路由到它；它负责"捕获远程坐标 → 删后查远程 → 算安全护栏 → Gate RD 询问 → 执行删或保留"五步。关键约束：① 只在真正删本地 branch 时触发；② 远程删除默认保留；③ Merge 场景算"未合并进 base 的远程独有 commit"作护栏（Discard 同样计算，但仅作信息提示，不阻塞）。下一节展开文件影响、子文件契约、三条业务流。

## 实现

### 影响

承上：改动集中在 `rules/` 两个规则文件 + 一个新子文件 + 版本号。

```
nocode-evolve/
├── rules/
│   ├── rule-finishing-branch.md                        (改)  ① Step3 路由表: option1/4 行「主要动作」改为
│   │                                                          "...删本地 branch → remote 分支清理 (Gate RD)";
│   │                                                          须体现"删 branch 前先捕获远程坐标"的时序
│   │                                                          (不能只在删后加调用); 「Read 子文件」列加
│   │                                                          remote-branch-cleanup.md
│   │                                                        ② 章节标题 `## 4 Gate Summary` → `## Gate Summary`
│   │                                                          (RD 加入后 "4" 不再准确, 去掉数字); 表内加 Gate RD 行
│   │                                                          (位置/内容/用户响应)
│   ├── rule-references/rule-finishing-branch/
│   │   └── remote-branch-cleanup.md                     (NEW) 子过程全文: 前置条件 → 5 步流程
│   │                                                          (捕获远程坐标 / ls-remote 查 / 安全护栏 /
│   │                                                           Gate RD / 执行) → 不要清单
│   └── rule-git-worktree.md                             (改)  「销毁 worktree 前必读」节加一条「不要」:
│                                                              远程分支清理属于删 branch (Gate RD),
│                                                              不属于 worktree 移除;「目录名冲突怎么办」/
│                                                              「销毁 worktree 前必读」两处移除不碰远程
└── .claude-plugin/
    └── plugin.json                                     (改)  version 2.3.0 → 2.4.0 (minor: 新增子文件 + 行为增强)
```

### 接口设计

本设计是规则文档（agent 行为约定），无 HTTP/RPC 对外 API、无 DB schema。仅有**内部接口**——子文件被门面调用的契约。

#### 对外 API

无对外 API 变更（纯规则文档）。

#### 数据模型

无 DB 变更。

#### 内部接口

`remote-branch-cleanup.md` 子文件契约：

- **触发点**：`rule-finishing-branch.md` 门面在选项1（Merge）或选项4（Discard）**删完本地 branch 后**路由到本子文件。其它选项 / worktree 移除场景**不**路由。
- **输入（隐式上下文，非函数参数）**：
  - `<remote>` + `<remote-branch>`：删 branch **前**从本地分支 upstream 捕获的远程坐标——`<remote>` = `branch.<name>.remote`，`<remote-branch>` = `branch.<name>.merge` 去掉 `refs/heads/` 前缀（即本地分支**实际推送到的**远程分支名，未必同名）。无 upstream → 回落 `<remote>=origin` + `<remote-branch>=<本地 branch 名>`。
  - `<mode>`：Merge / Discard。
  - `<base>`：base 分支名。**来源**：sp skill「finishing-a-development-branch」Step3「Determine Base Branch」在 4 选项菜单**之前**已确定，对所有选项（含 Discard）可用；detached / 无法确定 base 时，安全护栏降级（见 BF3）。
- **输出**：Gate RD 用户决策（删 / 保留）→ 对应执行（`git push <remote> --delete <remote-branch>` / 不动）+ 一行结果报告。
- **Gate RD 交互契约**（AskUserQuestion）：
  - **问题**："删本地 branch 后，远程仍有 `<remote>/<remote-branch>`。是否一并删除远程分支？"
  - **选项**：① 保留远程分支（**默认**，列首）② 删除远程分支。
  - **commit 警示文案**：`lostCommits` 非空 → 选项②描述附"删除会移除 N 个未合并进 base 的远程独有 commit：`<sha1> <sha2> ...`（最多列 5 个，超出标 `+M more`；这些 commit 可能仍被其他 ref 引用）"；`lostCommits == UNKNOWN` → 附"未能核实远程独有 commit（fetch 失败）"；空 → 选项②描述附"远程已全含于 base，删除零损失"。
  - **判定**：用户选②（删除）才执行 push --delete；选①或任何其它响应一律视为保留。
- **门面侧改动**：Step3 路由表两行 + Gate Summary 表新增 Gate RD 行（章节标题去掉数字 "4"）。Gate 命名延续既有序列（M / TB / PR / D → 新增 **RD** = Remote Delete）。

### 业务流

**BF1 — 选项1/4 集成点：捕获 remote → 删本地 branch → 调子过程**

```
function finishLocalBranchDeletion(branch, mode, base):       // mode ∈ {Merge, Discard}; 门面在删 branch 处调
    // 删 branch *前* 捕获远程坐标 — 删后 branch.<name>.* 配置即消失, 时序必须前置
    remote = gitConfig("branch." + branch + ".remote")        // upstream 的 remote 名 (如 origin)
    mergeRef = gitConfig("branch." + branch + ".merge")        // upstream 指向的远程 ref (如 refs/heads/bar)
    if remote is empty:                                        // 分支从没设过 upstream (没 push 过)
        remote = "origin"                                      // 回落默认远程
        remoteBranch = branch                                  // 回落同名 (后续 ls-remote 查不到就静默跳过)
    else:
        remoteBranch = stripPrefix(mergeRef, "refs/heads/")    // 取本地分支*实际推送到的*远程分支名, 未必同名
    deleteLocalBranch(branch, mode)                            // Merge: git branch -d; Discard: git branch -D (force)
    remoteBranchCleanup(remote, remoteBranch, mode, base)      // 进 BF2 子过程 (传远程坐标, 非本地 branch 名)
```

**BF2 — remote-branch-cleanup 子过程：查远程 → 护栏 → Gate RD → 执行**

```
function remoteBranchCleanup(remote, remoteBranch, mode, base):  // 删本地 branch 后的远程清理 (传远程坐标)
    // 用 refs/heads/<remoteBranch> 精确 ref, 避免 ls-remote 通配匹配到 feature-x / feature/x-2 等
    result = run("git ls-remote --heads " + remote + " refs/heads/" + remoteBranch)
    if result.exitCode != 0:                                   // 网络断 / 无权限 / remote 不存在
        warn("远程检查失败(" + remote + "), 跳过远程清理, 收尾不阻塞")  // 只 warn 一行, 不卡收尾流程
        return                                                 // 异常吞掉, 收尾照常完成
    if result.stdout is empty:                                 // 远程没有这个分支
        return                                                 // 静默跳过, 不打扰 (常见: 纯本地分支 / 已被别人删)
    // 精确 ref 查询正常只返一行 "<sha>\trefs/heads/<remoteBranch>"; 取该行首列
    remoteSha = parseSha(matchExactRef(result.stdout, "refs/heads/" + remoteBranch))
    lostCommits = computeRemoteOnlyCommits(remote, remoteBranch, base, mode)  // 进 BF3 算安全护栏
    choice = askGateRD(remote, remoteBranch, lostCommits)      // Gate RD: AskUserQuestion, 默认"保留"
    if choice == "delete":                                     // 用户明确选删才执行
        push = run("git push " + remote + " --delete " + remoteBranch)
        if push.exitCode != 0:                                 // protected branch / 权限不足 / 已被删
            report("远程分支删除失败: " + push.stderr + " — 收尾已完成, 可手动 git push " + remote + " --delete " + remoteBranch)
        else:
            report("已删除远程分支 " + remote + "/" + remoteBranch)
    else:                                                      // 默认/选保留
        report("远程分支 " + remote + "/" + remoteBranch + " 已保留")
```

**BF3 — 远程独有 commit 安全护栏（Merge 真护栏 / Discard 信息提示）**

> 语义澄清：本函数算的是"**未合并进 base 的远程独有 commit**"（远程 tip 可达、base 不可达），**不**等于"删远程后全仓库不可达/永久丢失"——这些 commit 可能仍被其他 branch / tag 引用。Gate RD 文案据此措辞，不绝对化为"丢失"。
> - **Merge**：base 已含本次合并工作，这些独有 commit 是 base 没覆盖到的，删远程后从远程消失 → **警示**（用户可能想保留 PR 残留 / 别人的 push）。
> - **Discard**：用户已 typed `discard` 表达"整支丢弃"，这些独有 commit 是被丢弃分支在远程的残留，删除符合意图 → **仅信息提示**，不阻塞、默认仍保留。
> - 两个模式算法相同，差异只在 Gate RD 文案语气（警示 vs 提示）。

```
function computeRemoteOnlyCommits(remote, remoteBranch, base, mode):  // 算"未合并进 base 的远程独有 commit"
    if base is unresolved:                                      // detached / sp Step3 没能定 base
        return UNKNOWN                                          // 无基准可比, 降级提示, 不假装精确
    fetch = run("git fetch " + remote + " refs/heads/" + remoteBranch)  // 拉远程 tip 到本地, 才能 rev-list 比对对象
    if fetch.exitCode != 0:                                     // fetch 失败 (离线)
        return UNKNOWN                                          // 降级: 无法确认, Gate RD 文案标"未能核实远程独有 commit"
    // 远程 tip 可达、base 不可达的 commit = 删远程后从远程消失的那部分
    shas = run("git rev-list " + base + "..FETCH_HEAD")         // 注意方向: base..tip = tip 有而 base 没有的
    return shas                                                 // 空 = 远程已全含于 base, 删除零损失
```

### 异常与失败模式

| BF | 异常/场景 | 触发 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | 分支无 upstream 配置 | 分支从没 push 过 | 远程坐标回落 `<remote>=origin` + `<remote-branch>=本地名`；BF2 ls-remote 查不到则静默跳过 | 吞（继续） |
| BF2 | ls-remote 网络/权限失败 | 离线 / 无 remote 访问权 | warn 一行 + 跳过远程清理，**不阻塞**收尾 | 吞 |
| BF2 | 远程无对应分支 | 纯本地分支 / 已被他人删 | 静默跳过（不算异常，不打扰） | — |
| BF2 | `push --delete` 失败 | protected branch / 权限不足 / 已被删 | 报错因 + 提示手动删命令；收尾已完成不回滚 | 上抛（报告） |
| BF3 | fetch 失败 | 离线 | 降级 UNKNOWN，Gate RD 文案标"未能核实远程独有 commit"，仍让用户决策 | 吞 |
| BF3 | base 无法解析 | detached / sp Step3 没定 base | 降级 UNKNOWN，同上文案，仍让用户决策 | 吞 |

### 单测设计

> 规则文档无传统单测；以下为**行为验证场景**（Given/When/Then），实施后据此手验或写成验证脚本。

**BF1 — 集成点：捕获 + 删 + 调用**

- **case 1.1 主路径（有 upstream）**
  - Given：选项1 Merge，分支 `feature/x` 有 upstream `origin/feature/x`，已合并进 base
  - When：走到删本地 branch 步骤
  - Then：删 branch 前先读到 `remote=origin`，删本地 branch 后调用 remoteBranchCleanup

- **case 1.2 无 upstream 回落**
  - Given：选项4 Discard，分支 `tmp/y` 从没 push 过（无 upstream 配置）
  - When：走到删本地 branch 步骤
  - Then：`remote` 回落为 `origin`，删本地 branch 后调用 remoteBranchCleanup

**BF2 — 子过程主流程**

- **case 2.1 远程无分支 → 静默跳过**
  - Given：`tmp/y` 在 origin 上不存在
  - When：remoteBranchCleanup 执行
  - Then：ls-remote 输出空，直接 return，**不弹 Gate RD**，无多余输出

- **case 2.2 远程有分支 → Gate RD 默认保留**
  - Given：`feature/x` 在 origin 上存在，base 已全含其 commit（lostCommits 空）
  - When：remoteBranchCleanup 执行，用户在 Gate RD 选默认/保留
  - Then：不执行 push --delete，报告"远程分支 origin/feature/x 已保留"

- **case 2.3 远程有分支 → 用户选删**
  - Given：同 2.2，用户在 Gate RD 选删
  - When：remoteBranchCleanup 执行
  - Then：执行 `git push origin --delete feature/x`，报告"已删除远程分支"

- **case 2.4 网络失败不阻塞**
  - Given：离线，ls-remote 非零退出
  - When：remoteBranchCleanup 执行
  - Then：warn 一行，return，收尾流程仍判为完成

- **case 2.5 push --delete 失败**
  - Given：远程分支受保护，用户选删
  - When：执行 push --delete 失败
  - Then：报错因 + 提示手动删命令，不回滚已删的本地 branch

**BF3 — 安全护栏**

- **case 3.1 Merge 远程有独有 commit → 警示语气**
  - Given：Merge 模式，`origin/feature/x` 比 base 多 2 个 commit（别人 push 过）
  - When：computeRemoteOnlyCommits 执行
  - Then：返回 2 个 sha，Gate RD 删除选项附**警示**文案"删除会移除 2 个未合并进 base 的远程独有 commit: `<sha1> <sha2>`（可能仍被其他 ref 引用）"

- **case 3.2 Merge 远程全含于 base → 无警示**
  - Given：Merge 模式，远程 tip 已全部合并进 base
  - When：computeRemoteOnlyCommits 执行
  - Then：返回空，Gate RD 删除选项附"远程已全含于 base，删除零损失"，默认仍保留

- **case 3.3 Discard 远程有独有 commit → 信息提示语气**
  - Given：Discard 模式，`origin/tmp/y` 比 base 多 1 个 commit
  - When：computeRemoteOnlyCommits 执行
  - Then：返回 1 个 sha，Gate RD 删除选项附**信息提示**（非阻塞、默认仍保留），文案不绝对化为"丢失"

- **case 3.4 Discard 远程全含于 base → 无提示**
  - Given：Discard 模式，远程 tip 已全含于 base
  - When：computeRemoteOnlyCommits 执行
  - Then：返回空，Gate RD 默认仍保留

- **case 3.5 fetch 失败降级**
  - Given：离线，fetch 非零退出
  - When：computeRemoteOnlyCommits 执行
  - Then：返回 UNKNOWN，Gate RD 文案标"未能核实远程独有 commit"，仍让用户决策

- **case 3.6 base 无法解析降级**
  - Given：detached HEAD / sp Step3 未能确定 base
  - When：computeRemoteOnlyCommits 执行
  - Then：直接返回 UNKNOWN（不 fetch），Gate RD 文案标"未能核实远程独有 commit"，仍让用户决策

## 方案选型

### Q1: 远程清理逻辑挂到哪些删除触点？

**选项**：只挂删本地 branch 的两处（选项1/4） vs 全挂（含 `rule-git-worktree.md`「目录名冲突怎么办」/「销毁 worktree 前必读」两处 worktree 移除） vs 仅挂 Discard
**定**：只挂选项1/4。因那两处 worktree 移除只删 worktree、保留 branch（重建复用同名分支），挂上去会误删正要继续的远程分支；远程清理本质是"删 branch"的附属动作，不是"删 worktree"。→ 影响 BF1。

### Q2: 共享逻辑放哪（架构）？

**选项**：新建共享子文件 `remote-branch-cleanup.md`（方案A） vs 内联进 commit-tidy / 各 option 流程（方案B） vs 写进门面新增段（方案C）
**定**：方案A。因门面是 ~80 行定位、方案C 撑爆；方案B 在选项1/4 重复两份且 commit-tidy 语义不符。子文件完全贴合现有「门面 + 子文件」架构，两 option 复用一份。→ 影响 影响节 + 内部接口契约。

### Q3: 删远程的确认方式 + 安全护栏？

**选项**：默认保留 + 独立询问 + 远程独有 commit 检查（A） vs 默认保留 + 独立询问、不检查 commit（B） vs 折叠进现有 Gate（Discard 的 typed discard / Merge 的 Gate M）（C）
**定**：A。因 Merge 场景远程可能有本地没有的 commit，不检查会静默丢（B 的硬伤）；远程删除不可单独反悔，折叠进现有 Gate（C）会让一次确认背两个不可逆动作、风险耦合。独立 AskUserQuestion 默认保留 + commit 检查最稳。→ 影响 BF2 / BF3。

### Q4: 确认用 typed 字面还是 AskUserQuestion？

**选项**：typed 字面（仿 Gate D 的 `discard` / non-ff 的 `force`） vs AskUserQuestion 默认保留
**定**：AskUserQuestion 默认保留。因 typed 字面用于"误触代价极高且常规默认是不做"的场景（force-push 覆写、discard 全盘丢）；Gate RD 默认就是保留（最安全态），选删是显式正向动作，AskUserQuestion 的默认项已提供足够防误触，无需再加 typed 摩擦。→ 影响 BF2 askGateRD。

## 其他

### 部署

无运行时部署——Claude Code 插件源码改动，通过 `plugin.json` version 升级触发用户端 marketplace（直接读 git）更新：

- **灰度策略**：无——用户主动 `update` 拉 git，不分批。
- **回滚预案**：主仓 `git revert` 对应 commit + 再升 version（patch）；用户端 git checkout 上一版。
- **监控指标**：无 metric（插件无运行时）；通过用户反馈 / GitHub issue 监控。

## Review Log

### Review 1 — 260526（Codex 跨模型独立审稿，rule-codex-review 场景四）

<!-- Reviewer: 本机 Codex (codex-cli 0.129.0)，只读，按 reviewer-template.md 7 维度 + Evidence Gate 执行 -->

**Critical**
- **C1** [`### 业务流 / BF3`]：Discard 模式 `base` 语义未定义清——接口说 base 是"Merge 护栏用"，但 BF3 对 Merge/Discard 都跑 `rev-list base..FETCH_HEAD`；Discard 本就 force 删分支，"远程相对 base 多出的 commit"到底是预期丢弃残留、需警示风险、还是阻止删除条件没定。单测也只覆盖 Merge，无 Discard base 比对 case。

**Warning**
- **W1** [`### 业务流 / BF3`]：`rev-list base..FETCH_HEAD` 方向对，但文档把它等同"删远程会丢的 commit"过度精确——实际是"未进入 base 的远程独有 commit"，若仍被其他 branch/tag 引用，"会丢失 N commit"会误导。
- **W2** [`### 影响 / 内部接口`]：门面章节名是 `## 4 Gate Summary`，表内只 M/TB/PR/D 四个；加 RD 后 "4" 自相矛盾，须改章节名或说明。
- **W3** [`### 影响 / Q1`]：文档用 `#1/#2` 指代 worktree 移除场景，但 `rule-git-worktree.md` 无 #1/#2 标签（残留清理 L111-117「目录名冲突怎么办」、通用销毁 L243-252「销毁 worktree 前必读」），实施者定位不到。
- **W4** [`### 业务流 / BF2-BF3`]：`ls-remote`/`fetch` 用未限定 `<branch>`，未要求 `refs/heads/<branch>` 精确 ref，`parseSha` 多行未处理。

**Suggestion**
- **S1** [`### 接口设计`]：补 Gate RD 完整交互契约（选项文案/默认项/UNKNOWN 文案/显示几个 sha/哪些响应算 delete）。
- **S2** [`### 单测设计 / BF3`]：补 Discard 专属测试（远程相对 base 有 commit/全含/base 不可解析）。
- **S3** [`### 业务流 / BF1`]：把"捕获 remote 必须在删 branch 前"也写进门面改动点，防实现者漏删前捕获。

**Open Questions**
- **Q1** [`### 接口设计 / BF1`]：upstream 不同名时（`branch.foo.merge=refs/heads/bar`）清理 `origin/foo` 还是 `origin/bar`？BF1 只捕获 remote 名、未捕获 upstream branch 名。
- **Q2** [`### 业务流 / BF3`]：Discard 的 `base` 从哪来？门面 Discard 行未列 base。

**Self-Audit**
- **SA1**（与 C1 同根）：Discard 文案/逻辑卡点——`lostCommits` 是"危险警示"还是"确认丢弃残留"未定。
- **SA2**（与 W2 同根）：Gate Summary 标题改 5 还是保留+说明 RD 是子 Gate。

**Verdict**：Needs revision before implementation.

---

**用户决定**：全修 + 采纳 Q1/Q2 我的答复——fix C1, W1, W2, W3, W4, S1, S2, S3；answer Q1, Q2；SA1/SA2 随 C1/W2 一并解决。

**本轮修订**：
- C1 + SA1：BF3 加语义澄清段——Merge=警示、Discard=信息提示（不阻塞、默认保留），两模式算法相同仅文案语气差异；单测补 Discard 专属 case 3.3/3.4。
- W1：「文本总结」③ + BF3 措辞改"未合并进 base 的远程独有 commit"，加"可能仍被其他 ref 引用"，不绝对化为"丢失"。
- W2 + SA2：影响节 + 内部接口标注章节标题 `## 4 Gate Summary` → `## Gate Summary`（去掉数字）。
- W3：背景「附带澄清」+ 影响节 rule-git-worktree 行 + 方案选型 Q1 全部改用真实节名「目录名冲突怎么办」/「销毁 worktree 前必读」+ 行号，删 #1/#2 临时编号并加注说明。
- W4：BF2 改 `refs/heads/<remoteBranch>` 精确 ref + `matchExactRef` 取单行；BF3 fetch 同步精确 ref。
- S1：内部接口新增「Gate RD 交互契约」整段（问题/选项/三态 commit 文案/判定）。
- S2：单测 BF3 补 case 3.3（Discard 有 commit 提示语气）/3.4（Discard 全含）/3.6（base 不可解析）。
- S3：影响节 rule-finishing-branch ① 显式要求"删 branch 前先捕获远程坐标"的时序。

**Open Questions 答复**：
- **Q1**：清理本地分支**实际推送到的**远程分支 = 从 upstream `branch.<name>.merge` 解析的 remote-branch 名（未必同名），无 upstream 才回落同名。已改 BF1 捕获 `<remote>` + `<remote-branch>` 两个值，全链路（BF2/BF3/接口/异常表）传远程坐标而非本地名。
- **Q2**：base 来自 sp skill「finishing-a-development-branch」Step3「Determine Base Branch」——在 4 选项菜单**之前**已确定，对所有选项（含 Discard）可用；detached/无法定 base 时 BF3 降级 UNKNOWN（case 3.6 + 异常表新增行）。已写入内部接口 `<base>` 来源说明。
