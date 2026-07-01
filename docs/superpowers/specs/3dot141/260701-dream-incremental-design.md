---
type: design-doc
topic: dream-incremental
date: 260701
author: 3dot141
status: draft
---

# Design Doc: dream 命令族增量化改造

> 场景：feat ｜ 分支：feat/dream-incremental

## 背景

**核心问题**：`project-dream` / `personal-dream` / `plugin-dream` 三个自维护巡检命令，每次执行都对全部目标文件做一次全量深度检查——`personal-dream` 每次都重新深查 wiki 里的每一页，`plugin-dream` 每次都逐个 rule/skill/command 全过一遍。随着 wiki 页面和 rule 数量增长，成本线性上升，且没有任何区分"这次跟上次比到底变了什么"的机制。

**附带问题**：`personal-dream` 现有 prune/stale 判据（[Read commands/personal-dream.md:28-32]：draft >30 天未整合 + sources 仍为 1 触发 prune，related 代码路径变化/不存在触发 stale/archive）已经不是单纯"看时间"，但缺"这条内容有没有真的被用过"这个维度——一条 wiki 页哪怕从没被任何会话引用过，只要它的 related 路径还在、没超过 30 天，现有判据也不会把它标进候选；反过来常用但暂时没更新的页面也可能被年龄类判据误伤。**(W2 修正：原「背景」把现有判据说成只看时间不准确，已按代码事实改写)**

**为什么现在做**：本会话在研究 OpenAI Codex CLI 的记忆巩固机制（内部代号 `morpheus`）时，发现它用"git-backed workspace diff 驱动增量处理"解决了同样的问题——这个思路可以直接套到本仓库自己的 dream 命令族上。

## 调研

**代码现状**：
- [Read scripts/personal-snapshot.mjs:36-69] 已有"外部裸仓库 + `--work-tree` 指向目标目录"的模式：`git --git-dir=<bareDir> --work-tree=<physicalDir>`，不在被追踪目录里放 `.git`。由 SessionStart hook（[Read hooks/hooks.json:49]）每次会话自动 `git add -A -f` + commit 一次全量快照。`projectId()`（[Read personal-snapshot.mjs:29-34]）用 realpath+md5 hash 处理跨项目命名。
- [Read scripts/freshness-check.mjs] git config 存 baseline 引用的模式（`branch.<branch>.nocode-evolve-base` + JSON cache + TTL + cold-start gate），已在 `rule-git-worktree.md` 场景验证。
- [Read rules/rule-git-worktree.md] worktree 场景下 `.agents-personal/` 是 symlink 回主仓的；`resolvePersonalDir` 走 realpath 处理这个场景，已有测试覆盖（[Read hooks/personal-snapshot.test.mjs]）。
- [Read commands/personal-dream.md] 现有 Phase 1(Scan)/Phase 2(Propose)/Phase 3(Execute) 三段式，Phase 1 对 `wiki/draft/` + `wiki/pages/` 每页做深度检查，无增量。
- [Read commands/plugin-dream.md] Layer1(客观漂移，机械命令：`generate.mjs --check` / `vendor-sync.mjs --check`)+Layer2(边界符合性，逐 rule/skill/command 语义检查)两层检测，均无增量。
- [Read commands/project-dream.md] 递归扫描任意目标目录（入参 `dir-path`，默认项目根，**不保证是 git 仓库**），批量生成 AGENTS.md/README.md，一次性操作无历史积累概念。

**外部方案**：
- [SOURCE: 本会话对 OpenAI Codex CLI 源码的研究] Codex 的 Phase 2 全局记忆巩固子代理（内部代号 `morpheus`）把记忆目录当 git 仓库，用 `gix` 库对比"上次巩固 baseline"与当前工作区算 diff，只处理变更部分；巩固完 reset 成单一 commit（不保留历史）；子代理沙箱化（无网络、写权限限本目录、禁止递归委派）。

**已有决策**：wiki 与 `docs/` 下均无相关既有决策，无需说明推翻理由。

## 方案选择

### Q1: personal-dream 的 baseline 追踪机制怎么选？→ 影响 PersonalHistory 域全部设计

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 复用 personal-snapshot 现成 bare repo | 读已在跑的 `~/.nocode/personal-history/<id>/` 历史 | 零新增基础设施，`.agents-personal/` 里不会多出可见的 `.git` | 与 personal-snapshot 产生新耦合 |
| **B. `.agents-personal/` 独立嵌套 `.git`** | 目录自己 `git init` | 贴近 Codex 原版，自包含 | 会与 personal-snapshot 的 `git add -A -f` 冲突（嵌套 `.git` 被当成 gitlink）|
| C. mtime/hash 表 | 类似 freshness-check.mjs 的 JSON cache | 最简单，不引入 git 概念 | 拿不到内容级 diff，等于重新发明轮子 |

**选 B**。方案 A 更省事，但用户判断"贴近 Codex 原版、personal-dream 自包含"的价值更高，拍板选 B。

### Q2: 嵌套 `.git` 与 personal-snapshot 的冲突怎么处理？→ 影响 PersonalHistory 域架构

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. personal-snapshot 的 `git add` 排除嵌套 `.git` 路径 | 轻改，两套机制并存 | 改动小 | `.agents-personal/` 长期有两套历史系统 |
| **B. 统一成一套——personal-snapshot 也改用嵌套 `.git`** | 彻底重写 personal-snapshot，不再用外部 bare repo | 只有一套历史机制，不冗余 | 影响所有装了插件的项目；需要迁移脚本 |

**选 B**。用户明确接受范围扩大——两套机制长期并存的维护成本高于一次性迁移成本。

### Q3: 合并后的 commit 策略怎么定？→ 影响 BF2（巩固扫描）

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. squash 到单 commit（照抄 Codex） | 每次巩固完重置成一个 commit | 贴近原版 | **销毁 personal-snapshot 的完整备份历史**——这正是它存在的意义 |
| **B. 保留完整历史，dream baseline 用移动 git ref 标记** | `refs/dream/last-baseline` 指向"上次处理到哪"，diff 后往前移，不动 commit 历史 | 两个诉求（完整备份 + 增量 diff）同时满足 | 需要维护一个额外的 ref |

**选 B**。方案 A 与 personal-snapshot 的核心目的直接冲突，用户否决。

### Q4: 已有历史（4 个项目的 bare repo）怎么处理？→ 影响迁移策略

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 不迁移，旧 bare repo 变孤儿 | 新逻辑生效后不再更新旧目录 | 实现最简单 | 旧备份历史与新机制割裂，用户想找旧记录要知道去两个地方翻 |
| **B. 写迁移脚本导入旧历史** | 检测到旧 bare repo 存在 + 新嵌套仓库不存在时自动迁移 | 备份连续性不丢 | 需要写迁移+校验逻辑 |

**选 B**。按 `{NOCODE_SKILL_REF}/migration-guide.md` 的 Churn Rule："如果你拥有被废弃的基础设施，你就有责任迁移你的用户"——不能把用户晾在一边。

### Q5: status.md 引用频率怎么真正采集？→ 影响 UsageTracking 域

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 依赖"读了必引用"的语义约定 | agent 自觉记录 | 不用新增机制 | markdown prompt 层面钩不住，不可靠，agent 可能直接 Read 不触发任何记录 |
| B. 只追踪 dream 自己深查时的读取 | dream 扫描时顺手记 | 不需要新 hook | 语义从"日常被使用了多少次"变成"被 dream 深查到过几次"，弱得多 |
| **C. 新增 PostToolUse hook 拦截 Read** | hook 层面精确捕捉命中路径的 Read 调用 | 真正可靠地捕捉日常引用 | 需新增 hook 脚本 + 注册项，插件需升版本 |

**选 C**。用户判断"真正采集到有意义的引用信号"比"不新增机制"更重要。

### Q6a: plugin-dream 的 baseline 存哪？→ 影响 PluginRepo 域

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| **A. git config，key 按 `branch.<branch>.xxx` 隔离** | 完全复用 `rule-git-worktree.md` 已验证的 `branch.<branch>.nocode-evolve-base` 模式 | 与现有模式一致，天然按分支/worktree 隔离，多分支互不覆盖 | 无（这是已验证模式的直接复用）|
| B. git config，全局 key（不按分支隔离）| 单个 key 存最近一次 baseline | 实现最简单 | **多 worktree/分支同时跑 `/plugin-dream` 会互相覆盖 baseline，导致跨分支 diff 错乱**（红军评审 C8 指出） |
| C. JSON state 文件 | 类似 freshness-check.mjs 的 cache 结构 | 不依赖 git config | 引入额外文件，且仍需自己处理分支隔离，不比 A 简单 |

**选 A**。同时检查 `git status --porcelain`（working tree 未提交改动）——这条是修复 Define 阶段红军评审指出的"未 commit 改动会被漏检"缺口。

### Q6b: project-dream 目标目录非 git 仓库时怎么处理？→ 影响 ProjectTree 域

| 方案 | 思路 | 优势 | 代价 |
|---|---|---|---|
| A. 零打扰 bare repo | 不问用户，在 `~/.nocode/` 下建外部仓库跟踪任意目标目录（类比 personal-snapshot 原模式）| 不打扰用户，不碰目标目录 | 与 Define 阶段已确认的交互设计不一致，需要重新征求用户同意才能改 |
| **B. 交互式询问（Define 阶段已确认）** | AskUserQuestion 问是否要 `git init`，基准目录二选一：(a) 传入的 `dir-path` 本身 (b) 若能推断出更大项目的根则选那里 | 用户明确知情、可控 | 需要一次交互，不是全自动 |

**选 B**。用户在 Define 阶段已明确保留这个交互设计，未采纳方案 A。

## 领域划分

### 拆分思路

从 restate 的路径清单出发，识别四类变更边界互不干扰的实体：

```
personal-dream 的持续积累历史  → 嵌套 git 仓库 + snapshot + 迁移 → PersonalHistory 实体
plugin-dream 的主仓库 baseline  → git config + commit sha        → PluginBaseline 实体
project-dream 的任意目标目录    → 可选 git 仓库 + 交互式 init     → ProjectTreeBaseline 实体
wiki 页引用频率                 → hook + 聚合表                   → UsageRecord 实体
```

验证变更独立性：

```
改 PersonalHistory 的迁移逻辑 → 不影响 plugin-dream / project-dream / usage tracking ✓
改 PluginRepo 的 working-tree 检测 → 不影响其余三个域 ✓
改 UsageTracking 的 hook matcher → 不影响其余三个域 ✓
→ 四个域相对独立；PersonalHistory 与 UsageTracking 有两条跨域边（W3 修正，补全第二条）：
  1. 文件级：status.md 是 PersonalHistory 嵌套仓库里的文件，但写入由 UsageTracking 的 hook 驱动
  2. 类级：UsageTracking.StatusWriter 直接调用 PersonalHistory.RepoLock（同一份仓库的锁，
     不能各用各的锁，否则锁不住）——这条耦合比文件级更强，意味着以后改 RepoLock 的接口签名，
     会直接牵连 UsageTracking，不是完全独立
```

### 域清单

| 域 | 核心实体 | 路径 ID 范围 | 变更独立性 |
|---|---|---|---|
| PersonalHistory | 嵌套 Git 仓库（snapshot 历史 + dream baseline ref）| 命令.P1-P3, 系统.1, 系统.5, 系统.6 | 迁移/并发锁只影响自己 |
| PluginRepo | Git Config Baseline | 命令.P4-P6, 系统.2, 系统.4 | 改动局限于 plugin-dream 一个命令 |
| ProjectTreeBaseline | 目标目录 + 可选 Git 仓库 | 命令.P7-P9, 系统.3 | 改动局限于 project-dream 一个命令 |
| UsageTracking | Wiki Page Usage Record（status.md）| 跨域.1 | hook 独立文件，不碰其余三域 |
| 跨域 | — | 跨域.2, 跨域.3, 跨域.4 | PersonalHistory ↔ UsageTracking 交叉 |

### 总图（域间关系）

```
┌────────────────────┐                      ┌───────────────────┐
│  PersonalHistory    │                      │  UsageTracking     │
│  嵌套 Git 仓库       │  跨域.4 usage 记录    │  Wiki Page Usage   │
│                     │ ←─────────────────── │                    │
│  命令.P1 首次+迁移   │   写进 status.md      │  跨域.1 Read 拦截  │
│  命令.P2 增量        │                      │                    │
│  命令.P3 无变化秒回   │                      └───────────────────┘
│  跨域.3 related变化   │
│  系统.1/5/6          │
└─────────┬───────────┘
          │ 跨域.2 删除护栏仍要拦
          ↓
     （无新交互，护栏行为不变）

┌────────────────────┐                      ┌───────────────────┐
│    PluginRepo        │                      │ ProjectTreeBaseline │
│  Git Config Baseline │                      │  目标目录+可选Git   │
│                     │                      │                    │
│  命令.P4-P6          │                      │  命令.P7-P9        │
│  系统.2/4            │                      │  系统.3            │
└────────────────────┘                      └───────────────────┘

约束.1: 增量机制只影响扫描范围/深度，不改变用户确认流程
约束.2: 首次运行零配置自动初始化
约束.3: project-dream 明确排除段落级遗忘和引用频率优先级
约束.4: 本次不实现 /schedule 并发调度协调，只写设计说明（并发锁≠调度协调，见"部署注意事项"）
```

四个域中 PluginRepo 与 ProjectTreeBaseline 相对简单（复用已验证的 git config 模式 / 保留既有交互设计），下面重点展开 PersonalHistory 与 UsageTracking。

## 系统交互场景设计

> 纯后端改动，无 UI。"交互场景"= 命令调用链 / hook 触发链。

### 端到端总流程图

```
SessionStart（任意会话开始）
  ↓
personal-snapshot 触发 [BF-Snapshot]
  ↓
[.agents-personal/.git 存在?]
  ├─ 否，且旧 bare repo 存在 → 迁移 [BF-Migrate] → 建嵌套仓库 → snapshot commit
  ├─ 否，且旧 bare repo 不存在 → git init → snapshot commit
  └─ 是 → 直接 snapshot commit

用户 Read 任意文件（日常会话中）
  ↓
PostToolUse hook 拦截 [BF-UsageHook]
  ↓
[路径命中 .agents-personal/wiki/(pages|draft)/?]
  ├─ 否 → 直接放行，无额外开销
  └─ 是 → 更新 status.md 对应行（计数+1，最后引用时间刷新）

用户跑 /personal-dream
  ↓
[refs/dream/last-baseline 存在?]
  ├─ 否（首次）→ 全量深检查 [场景1]
  └─ 是 → git diff <ref> HEAD -- . ':!wiki/status.md' [场景2]
           ├─ 无变化 → 秒回"状态良好"
           └─ 有变化 → 只深查变更文件（含 related 代码路径变化触发的页）

用户跑 /plugin-dream
  ↓
[git config nocode-evolve.plugin-dream-baseline 存在?]
  ├─ 否（首次）→ 全量 Layer1+Layer2 [场景3]
  └─ 是 → diff baseline..HEAD + git status --porcelain
           ├─ 都无变化 → 秒回"无需维护"
           └─ 有变化 → 只深查 Layer2 改动文件

用户跑 /project-dream <dir-path>
  ↓
[dir-path 是 git 仓库?]
  ├─ 否 → AskUserQuestion 问是否 git init [场景4]
  └─ 是 → 按 baseline 增量扫描（同 P1-P3 逻辑）
```

### 场景 1：personal-dream 首次运行（含迁移检测）[命令.P1]

对应总流程 "SessionStart 触发 personal-snapshot → 迁移/建仓 → 首次 dream 深检查" 段。

**交互流程**（**Q1 澄清**：`git init` 后没有任何 commit，`HEAD` 还不存在——下一步的 `diffSinceBaseline` 已经改成先调用 `SnapshotWriter.snapshot()`（见 C5 修正），这一步在空仓库上跑 `add -A -f` + commit，天然建出第一个 commit，`refs/dream/last-baseline` 才有地方可指）：

```
/personal-dream 执行
  ↓
检测 .agents-personal/.git 是否存在
  ├─ 不存在 → 检测 ~/.nocode/personal-history/<projectId>/ 是否存在旧 bare repo
  │            ├─ 存在 → 触发迁移 [BF-Migrate]（导入历史 → snapshot 吸收漂移 → 应用 → 旧repo改名.migrated，已含首个 commit）
  │            └─ 不存在 → git init 建空仓库（此时无 HEAD）
  └─ 存在 → 跳过初始化
  ↓
调用 diffSinceBaseline（内部先 snapshot 落一次 commit，此时 HEAD 保证存在）
  ↓
全量深检查 wiki/draft + wiki/pages（现有行为不变）
  ↓
建立 refs/dream/last-baseline 指向当前 HEAD
```

**消费域接口**：PersonalHistory 域.`ensureNestedRepo()` + `migrateIfNeeded()`

**文件影响**：`commands/personal-dream.md`（改）、`scripts/personal-snapshot.mjs`（重写）、新增迁移脚本

**验证**：
- [ ] 集成：全新项目（无旧 bare repo）→ 直接 git init 成功
- [ ] 集成：老项目（有旧 bare repo）→ 迁移成功 + 旧目录改名 + 历史可追溯
- [ ] 集成：迁移中途 fetch 失败 → 不改动现状，只 warn

### 场景 2：personal-dream 增量运行 [命令.P2, 命令.P3, 跨域.3]

对应总流程 "已有 baseline → diff → 深查/秒回" 段。

**交互流程**：

```
读取 refs/dream/last-baseline
  ↓
git diff <ref> HEAD -- . ':!wiki/status.md'（排除 status.md 自身，防止诊污染）
  ↓
[diff 为空?]
  ├─ 是 → 秒回"状态良好，无需维护"[命令.P3]
  └─ 否 → 解析变更文件列表
           ↓
         对每个变更 wiki 页做深查 [命令.P2]
           ↓
         额外检查：未变的 wiki 页里，related: 指向的主仓代码路径是否变化 [跨域.3]
           ├─ 变化 → 该页也纳入深查
           └─ 不变 → 跳过
           ↓
         Phase 2/3（Propose/Execute）沿用现有流程，不变
           ↓
         [Phase 3 执行有系统性失败（如写入报错/护栏确认中途取消）?]
           ├─ 是 → 不前移 baseline，这些文件下次 diff 仍会出现（C6 修正）
           └─ 否（用户显式跳过的候选不算失败）→ refs/dream/last-baseline 移到当前 HEAD
```

**消费域接口**：PersonalHistory 域.`diffSinceBaseline()` + `advanceBaseline()`

**文件影响**：`commands/personal-dream.md`（改，Phase 1 逻辑）

**验证**：
- [ ] 单测：diff 为空 → 秒回分支
- [ ] 集成：diff 非空 → 只深查变更文件列表
- [ ] 集成：wiki 页未变但 related 路径变化 → 仍被纳入深查

### 场景 3：plugin-dream 运行（含 working tree 检测）[命令.P4-P6]

**交互流程**：

```
读取 git config branch.<当前分支>.nocode-evolve-plugin-dream-baseline  // 按分支隔离（C7）
  ↓
[不存在，或 baseline 指向的 commit 不可达?]
  ├─ 是（首次或已损坏）→ 全量 Layer1+Layer2 检查 → 记录当前 commit 为 baseline
  └─ 否 →
      commit_diff = git diff <baseline>..HEAD --name-only（限定监控范围内文件）
      dirty = git status --porcelain（同范围）
      ↓
      [commit_diff 为空 且 dirty 为空?]
        ├─ 是 → 秒回"无需维护"[命令.P6]
        └─ 否 → 合并两者变更文件列表 → 只深查 Layer2 对应文件 [命令.P5]
                 Layer1（generate.mjs --check / vendor-sync.mjs --check）始终全量跑
                 （机械命令本身够快，不需要增量优化）
```

**监控范围**（本次扩大，见 Q6a 决策；W7 修正后覆盖本设计自身新增文件）：`rules/` `skills/` `commands/` `hooks/` `scripts/` `rules/manifest.json` `.claude-plugin/plugin.json`

**消费域接口**：PluginRepo 域.`diffSinceBaseline()` + `checkDirty()`

**文件影响**：`commands/plugin-dream.md`（改）

**验证**：
- [ ] 单测：commit 无变化 + working tree clean → 秒回
- [ ] 集成：working tree 有未提交改动 → 判定"有变化"，不遗漏

### 场景 4：project-dream 运行（含非 git 目录交互）[命令.P7-P9]

**交互流程**：

```
/project-dream <dir-path>
  ↓
[dir-path 是 git 仓库?]
  ├─ 否 → AskUserQuestion:"这个目录不是 git 仓库，要不要初始化一个来支持后续增量扫描？"
  │        ├─ 用户选"要" → 追问基准目录：(a) dir-path 本身 (b) 推断出的上层项目根
  │        │                └─ git init 后按场景1/2逻辑处理
  │        └─ 用户选"不要" → 降级为全量扫描（不支持增量，不阻断命令本身）
  └─ 是 → 按场景1/2逻辑处理（首次全量 / 增量 diff）
  ↓
[命令.P9] 完全无变化 → 秒回"无需生成"
```

**消费域接口**：ProjectTreeBaseline 域.`detectGitRepo()` + `initIfConfirmed()`

**文件影响**：`commands/project-dream.md`（改）

**验证**：
- [ ] 集成：非 git 目录 + 用户选"要" + 选(a) → 在 dir-path 本身 git init
- [ ] 集成：非 git 目录 + 用户选"不要" → 全量扫描，不报错
- [ ] 单测：完全无变化 → 秒回

### 场景 5：wiki 页面 Read → usage 记录 [跨域.1, 跨域.4]

**交互流程 + 时序**：

```
任意会话                PostToolUse hook              status.md
 │  Read 任意文件         │                              │
 │ ─────────────→        │                              │
 │                        │ 路径前缀匹配                  │
 │                        │ .agents-personal/wiki/       │
 │                        │ (pages|draft)/                │
 │                        │                              │
 │                        │  ├─ 不匹配 → 直接返回，无开销   │
 │                        │  └─ 匹配 → 定位 slug           │
 │                        │           ─────────────→      │
 │                        │           更新该行：           │
 │                        │           计数+1, 最后引用时间  │
 │                        │           ←─────────────      │
 │  Read 正常返回          │                              │
 │ ←─────────────        │                              │
```

**消费域接口**：UsageTracking 域.`recordUsage(path)`

**文件影响**：新增 hook 脚本、`hooks/hooks.json`（改，注册 PostToolUse）

**验证**：
- [ ] 单测：命中路径 → status.md 对应行计数+1
- [ ] 单测：不命中路径（非 wiki 文件）→ 直接跳过，无副作用
- [ ] 集成：hook 性能——1000 次非 wiki Read 调用总耗时对比有无 hook 的差异 <5%

## 领域层设计

### PersonalHistory 域

**核心实体**：嵌套 Git 仓库（`.agents-personal/.git`），承载 snapshot 全历史 + `refs/dream/last-baseline` 指针
**本次新增/改造**：`personal-snapshot.mjs` 重写、迁移脚本、并发锁、`refs/dream/last-baseline` 管理

**域内模块关系图**：

```
┌──────────────────────────────────────────────────────────┐
│                     PersonalHistory 域                      │
│                                                            │
│                    ┌───────────────┐                      │
│                    │   RepoLock     │                      │
│                    │   [并发锁]      │                      │
│                    └───┬───┬───┬───┘                      │
│           acquire/release 被下面三者各自调用（W3/C2 修正）    │
│              ┌──────────┼───────────┐                     │
│              ↓          ↓           ↓                     │
│  ┌───────────────┐┌───────────┐┌──────────────────┐       │
│  │ SnapshotWriter ││Migration  ││ BaselineTracker    │       │
│  │ [BF-Snapshot]  ││Runner     ││ [BF-Diff]          │       │
│  │                ││[BF-Migrate]││                    │       │
│  └───────────────┘└───────────┘└──────────────────┘       │
│         ↑ MigrationRunner 迁移后调用 SnapshotWriter 落首个 commit │
└──────────────────────────────────────────────────────────┘
```

#### RepoLock 模块

**类接口**：

```typescript
class RepoLock {
  acquire(personalDir: string, timeoutMs: number): LockHandle | null
  release(handle: LockHandle): void
}
```

应对 pre-mortem 死因 2（多 worktree 共享 `.agents-personal/` 并发写坏嵌套仓库）。加锁范围：任何对 `.agents-personal/.git` 的写操作（snapshot commit / 迁移 / baseline ref 移动），**由 `SnapshotWriter.snapshot()`、`MigrationRunner.migrate()`、`BaselineTracker.advanceBaseline()` 三处显式调用**（见各自伪代码），不是只声明不落地。

**（C1 修正）锁文件位置从 `.git/` 内移到 `.agents-personal/` 根**：原设计把锁文件放 `repoPath/.git/dream.lock`，但 RepoLock 真正要保护的场景——两个 worktree 同时判定"`.git` 不存在"并发触发 `git init`/迁移——恰好发生在 `.git` 还不存在的时候，锁文件所在目录本身不存在，写锁会直接失败。`.agents-personal/` 目录本身是 dream 命令的 Enter Gate 前提（不存在则命令直接报错退出，见 `commands/personal-dream.md`），所以锁文件放在这一层，不管 `.git` 建没建都能用。

**（C1 修正）用原子操作代替 exists-then-write**：`fs.open` 的 `'wx'` flag 在目标文件已存在时会直接抛错，不会像"先 `exists()` 检查再 `writeFile()`"那样在两个进程间留出竞态窗口。

伪代码：

```
function RepoLock.acquire(personalDir, timeoutMs):
  mkdirSync(personalDir, { recursive: true })        // 确保目录存在，不管 .git 建没建都能写锁
  lockFile = personalDir + '/.dream.lock'             // 放 .agents-personal/ 根，不依赖 .git 存在
  start = now()
  while (now() - start) < timeoutMs:
    try:
      fd = fs.openSync(lockFile, 'wx')                // 'wx'：文件已存在则原子失败，无 exists-then-write 竞态窗口
      fs.writeSync(fd, String(currentPid))
      fs.closeSync(fd)
      return { path: lockFile }
    catch e:
      if e.code != 'EEXIST':
        throw e                                       // 非"文件已存在"的错误（如磁盘只读）直接抛出，不静默吞掉
      sleep(50ms)                                      // 锁被别的进程占着，轮询等待
  return null                                          // 超时未拿到锁，调用方按"跳过本次"处理

function RepoLock.release(handle):
  rmSync(handle.path)
```

超时设 2 秒——本地文件系统操作足够快，2 秒还没释放大概率是异常持锁（进程崩溃留下的孤儿锁文件）。此时调用方（snapshot / dream / migrate）跳过本次操作并 warn，不阻塞用户会话。孤儿锁清理：`release` 失败于进程崩溃场景（没机会执行）不做自动过期删除——2 秒超时后调用方跳过即可，不需要额外的锁失效检测机制。

#### MigrationRunner 模块

**BF-Migrate — 从旧 bare repo 迁移到嵌套仓库**：

**（C4 修正）不再做"内容必须匹配"的校验**：原设计要求临时仓库（从旧 bare repo 历史重建的工作区）与真实 `.agents-personal/` 磁盘内容逐文件一致，校验不过就中止。但旧 bare repo 只在"上一次 SessionStart"提交过快照，上一次会话到本次触发迁移之间的正常编辑（wiki 更新 / `/distill` 输出）必然造成两者不一致——这个校验在活跃项目上几乎总会失败，等于迁移永远跑不通。改为：**只导入历史，不校验内容匹配；导入完立即对当前磁盘真实状态做一次新的 snapshot commit**——这一步天然把"旧 bare repo commit 之后到现在"的所有正常漂移，当成迁移后的第一条新记录接上，不需要也不应该要求它跟旧 HEAD 一致。

**（C4 修正）应用步骤改为"先在临时位置完整构建好，一次性原子替换"**：原设计"先 mv `.git`、再处理旧 bare repo"两步之间如果第二步失败，真实目录已经被改成嵌套仓库但函数还报 `failed`，与"失败不改动现状"的承诺矛盾。改为：**新 `.git` 在临时目录构建完（含导入历史 + 迁移后首个 snapshot commit）才做替换，替换本身是单个 `mv` 操作**（文件系统 rename，在同一个卷内是原子操作，不会出现"替换到一半"的中间态）；只有 `mv` 之后才处理旧 bare repo 改名，即使这步失败，`.agents-personal/.git` 也已经是完整可用状态，不影响正确性，只是旧 bare repo 没能及时改名（下次 SessionStart 会重新检测到"迁移已完成、旧 bare repo 还在"，直接补做改名，不重复迁移）。

流程图：

```
检测 ~/.nocode/personal-history/<projectId>/ 是否存在
  ↓
存在 → RepoLock.acquire(personalDir) → 拿不到锁 → 跳过本次，下次 SessionStart 再试
  ↓ 拿到锁
在临时目录 git init 建新仓库
  ↓
git fetch <旧bare repo路径>                      // 只拉历史，不改动旧仓库
  ↓
把 FETCH_HEAD 设为临时仓库的分支指针（不 reset 工作区，不要求内容匹配）
  ↓
mv 临时仓库的 .git → 真实 .agents-personal/.git（单次 rename，原子）
  ↓
对当前磁盘真实内容跑一次 SnapshotWriter.snapshot()  // 吸收迁移前的正常漂移，成为迁移后第一条新 commit
  ↓
[.agents-personal/.git 已就绪?]
  ├─ 是 → mv 旧 bare repo 目录 → 加 .migrated 后缀（不删除）
  └─ 否（.git 已就绪但改名这步失败）→ warn，下次 SessionStart 检测到"已迁移+旧repo还在"直接补改名
  ↓
RepoLock.release()
```

伪代码：

```
function MigrationRunner.migrate(projectDir, oldBareDir):
  personalDir = projectDir + '/.agents-personal'
  handle = RepoLock.acquire(personalDir, 2000)
  if !handle:
    return { status: 'skipped_locked' }               // 拿不到锁，下次 SessionStart 再试，不阻塞本次会话
  try:
    tmpDir = mkdtemp()
    execSync(`git init ${tmpDir}`)
    execSync(`git --git-dir=${tmpDir}/.git fetch ${oldBareDir}`)   // 旧 bare repo 本身就是合法的 git remote
    execSync(`git --git-dir=${tmpDir}/.git update-ref refs/heads/main FETCH_HEAD`)
                                                                     // 只导入历史指针，不 reset 工作区、不要求内容匹配
    mv(tmpDir + '/.git', personalDir + '/.git')                    // 单次 rename，原子操作
    SnapshotWriter.snapshot(personalDir)                            // 用当前真实磁盘状态提交一次新 commit，吸收迁移前的漂移
    try:
      mv(oldBareDir, oldBareDir + '.migrated')
    catch e:
      warn(`旧 bare repo 改名失败，下次 SessionStart 会补做: ${e.message}`)
                                                                     // .git 已迁移完成，这步失败不影响正确性
    return { status: 'migrated' }
  catch e:
    warn(`迁移失败: ${e.message}`)                                  // fetch 失败等场景；不阻断 session
    return { status: 'failed' }
  finally:
    RepoLock.release(handle)
    rmSync(tmpDir)
```

#### SnapshotWriter 模块（personal-snapshot.mjs 重写部分）

**类接口**（原 `ensureBareRepo`/`bareRepoPath` 替换为）：

```typescript
function ensureNestedRepo(personalDir: string): boolean   // 幂等，返回是否新建
function snapshot(personalDir: string): { status: string, timestamp?: string }
```

原 `git()` 辅助函数的 `--git-dir=<bare> --work-tree=<physical>` 参数组合，改为 `--git-dir=<personalDir>/.git --work-tree=<personalDir>`——`snapshot()` 内部逻辑（`add -A -f` + `diff --cached --quiet` 判断变化 + commit）基本不变，只是 git-dir 换了位置。

伪代码（**C2 修正**：接入 `RepoLock`）：

```
function SnapshotWriter.snapshot(personalDir):
  handle = RepoLock.acquire(personalDir, 2000)
  if !handle:
    return { status: 'skipped_locked' }               // 拿不到锁就跳过这次快照，不阻塞用户会话
  try:
    execSync(`git --git-dir=${personalDir}/.git --work-tree=${personalDir} add -A -f`)
                                                        // git-dir 恰好等于 work-tree 内的 .git 时，git 本身会自动跳过
                                                        // 顶层 .git 目录，不需要额外 pathspec 排除（已实测验证，S1 修正）
    hasChanges = !gitQuiet(personalDir, 'diff --cached --quiet')
    if !hasChanges:
      return { status: 'no_changes' }
    ts = formatTimestamp()
    execSync(`git --git-dir=${personalDir}/.git commit -m "auto: ${ts}"`, commitConfig)
    return { status: 'committed', timestamp: ts }
  finally:
    RepoLock.release(handle)
```

#### BaselineTracker 模块

**类接口**：

```typescript
function diffSinceBaseline(personalDir: string): string[] | null   // null = 首次或 baseline 不可达，走全量分支
function advanceBaseline(personalDir: string, hadFailures: boolean): void  // 处理完成后移动 refs/dream/last-baseline
```

**BF-Diff — 增量判断**（**C5 修正**：先落定当前状态再 diff；**C3 修正**：baseline 不可达时降级，不抛未捕获异常）：

`/personal-dream` 调用本函数前，先跑一次 `SnapshotWriter.snapshot(personalDir)`——本次会话内尚未被 SessionStart 提交的 wiki 改动，在这里被提交进 HEAD，diff 才能看到"这次会话刚做的修改"，不会因为改动还没落 commit 就被误判"无变化"。

伪代码：

```
function diffSinceBaseline(personalDir):
  SnapshotWriter.snapshot(personalDir)                          // 先把当前磁盘状态落成 commit，确保 HEAD 是最新的
  ref = 'refs/dream/last-baseline'
  try:
    if !refExists(personalDir, ref):
      return null                                                // null 表示"首次"，调用方走全量分支
    files = execSync(`git --git-dir=${personalDir}/.git diff --name-only ${ref} HEAD -- . ':!wiki/status.md'`)
                                                                  // 排除 status.md：它自己的更新不算"有变化"（否则永远无法秒回）
    return files.split('\n').filter(Boolean)
  catch e:
    warn(`baseline 不可达（可能已损坏）: ${e.message}`)            // ref 存在但指向的 commit 已丢失/仓库损坏
    return null                                                  // 按"首次"处理，走全量分支兜底，不让异常冒泡中断命令

function advanceBaseline(personalDir, hadFailures):
  if hadFailures:
    return                                                       // Phase 3 执行有失败项时不前移，下次 diff 仍能看到这些文件重新处理
  handle = RepoLock.acquire(personalDir, 2000)
  if !handle:
    return                                                       // 拿不到锁就跳过本次前移，不阻塞；下次运行 diff 范围略大，不会漏检
  try:
    execSync(`git --git-dir=${personalDir}/.git update-ref refs/dream/last-baseline HEAD`)
  finally:
    RepoLock.release(handle)
```

**（C6 修正）说明 `hadFailures` 语义**：用户在 Phase 2 显式勾选"跳过"某个候选，是真实的用户决策（"这条我不处理"），不算失败，baseline 照常前移。`hadFailures` 特指 Phase 3 执行阶段的**系统性失败**（比如文件写入报错、删除护栏确认中途取消导致操作没完成）——这类情况前移 baseline 会让下次 diff 看不到这些还没真正处理完的文件，所以不前移，让它们留在下次的变更范围里重新出现。

**域级接口**：

数据契约：

```
refs/dream/last-baseline           # git ref，指向"上次 dream 处理完成"时的 commit
.agents-personal/.git/dream.lock   # 并发锁文件，内容为持有者 pid
```

**域文件影响**：

```
scripts/
  └── personal-snapshot.mjs        (改，大改)  ① ensureNestedRepo() 替换 ensureBareRepo()
                                               ② snapshot() 内部 git-dir 参数调整
                                               ③ 新增迁移检测入口
scripts/
  └── personal-migrate.mjs         (NEW)  MigrationRunner 完整实现
scripts/
  └── repo-lock.mjs                (NEW)  RepoLock 实现，被 snapshot/dream 共用
commands/
  └── personal-dream.md            (改)  Phase 1 接入 BaselineTracker
hooks/
  └── personal-snapshot.test.mjs   (改，大改)  覆盖嵌套仓库+迁移+并发锁场景
```

**域验证**：
- [ ] 单测：`ensureNestedRepo` 幂等（已存在则跳过）
- [ ] 单测：`diffSinceBaseline` 首次返回 null，走全量分支
- [ ] 单测：`diffSinceBaseline` 排除 `wiki/status.md` 自身变化
- [ ] 集成：`MigrationRunner` 全流程（有旧仓库/无旧仓库/校验失败三种分支）
- [ ] 集成：`RepoLock` 并发场景——两个进程同时 `acquire`，一个成功一个等待或超时

**安全**：迁移脚本操作 `~/.nocode/personal-history/`，路径一律 `path.resolve` 后校验在预期根目录下，防止路径穿越。
**性能**：锁超时 2 秒，避免异常持锁长期阻塞用户会话。

---

### UsageTracking 域

**核心实体**：Wiki Page Usage Record（`status.md` 里的一行）
**本次新增**：PostToolUse hook 拦截 Read + status.md 聚合表读写

**域内模块关系图**：

```
┌────────────────────────────────┐
│         UsageTracking 域          │
│                                  │
│  ┌───────────────┐              │
│  │ ReadInterceptor│              │
│  │ [BF-UsageHook] │              │
│  └───────┬───────┘              │
│          │                      │
│  ┌───────┴───────┐              │
│  │ StatusWriter   │              │
│  │ [跨域.4]        │              │
│  └───────────────┘              │
└────────────────────────────────┘
```

#### ReadInterceptor 模块

**类接口**：PostToolUse hook 脚本，接收工具调用事件（工具名 + 参数）。

**BF-UsageHook — 拦截 Read 判断是否命中**：

伪代码（**W2/W4 修正**：明确 `cwd` 来源 + 用 realpath 解析后再匹配，兼容 symlink/相对路径）：

```
function onPostToolUse(event):
  if event.tool_name != 'Read':
    return                                          // 非 Read 调用直接跳过，零开销
  if !event.tool_input.file_path.includes('wiki'):
    return                                          // 廉价子串预筛（无 fs 调用），过滤掉绝大多数无关 Read，
                                                     // 只有路径里带 "wiki" 字样的才继续往下做 realpath 解析
  projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
                                                     // 与 personal-snapshot.mjs 现有约定一致（见 scripts/personal-snapshot.mjs:93）
  personalDir = resolvePersonalDir(projectDir)        // 内部 realpathSync，worktree 场景下 symlink 解析回主仓真实路径
  if !personalDir:
    return                                            // 没有 .agents-personal/，跳过
  filePath = realpathSync(resolve(event.tool_input.file_path))
                                                     // 先转绝对路径再 realpath，兼容相对路径输入和 symlink 输入
  personalWikiPrefix = personalDir + '/wiki/'
  if !filePath.startsWith(personalWikiPrefix):        // 两边都已 realpath，字符串前缀匹配可靠，不用正则
    return                                            // 非 wiki 路径跳过
  if !(filePath.includes('/pages/') || filePath.includes('/draft/')):
    return                                            // 只关心 pages/draft 下的页面文件，索引文件(index.md)不计入
  key = filePath.slice(personalWikiPrefix.length).replace(/\.md$/, '')
                                                     // 用相对路径（含 draft/ 或 pages/ 前缀）做 key，不只取 basename slug
                                                     // 避免 draft/260701-foo.md 与 pages/foo.md 被合并成同一行（W5 修正）
  StatusWriter.recordUsage(key)
```

选了"字符串前缀匹配"（见 Pre-mortem 死因 3 应对）——避免给每次 Read 调用增加正则解析开销；`realpathSync` 只在命中 wiki 路径的极少数调用里执行，不影响非 wiki Read 的性能。

#### StatusWriter 模块

**类接口**：

```typescript
function recordUsage(key: string): void   // key = 相对 wiki/ 的路径（含 draft/ 或 pages/ 前缀，不带 .md），如 "draft/260701-foo" / "pages/foo"
```

**跨域.4 — 更新 status.md 聚合表**（不是追加，是按 `key` 更新已有行或新增一行）：

伪代码：

```
function StatusWriter.recordUsage(key):
  handle = RepoLock.acquire(personalDir, 2000)          // 复用 PersonalHistory 域的并发锁——同一份仓库（W3：两域间的类级耦合，见「拆分思路」跨域边说明）
  if !handle:
    return                                              // 拿不到锁就跳过这次记录，不阻塞用户的 Read
  try:
    rows = parseStatusMd(personalDir + '/wiki/status.md')  // 解析现有表格
    row = rows.find(r => r.key == key)
    if row:
      row.count += 1
      row.lastReferenced = today()
    else:
      rows.push({ key, count: 1, lastReferenced: today() })
    writeStatusMd(personalDir + '/wiki/status.md', rows)
  finally:
    RepoLock.release(handle)
```

**域级接口**：

数据契约（`status.md` schema，**W5 修正**：key 改用相对路径而非裸 slug，避免 draft/pages 或不同子目录同名页面被合并成一行）：

```markdown
# Wiki Usage Status

> 由 PostToolUse hook 自动维护，记录每个 wiki 页被 Read 的次数与最后引用时间。
> 与 log.md（追加式操作日志）不同——本文件是聚合表，同一 key 只有一行，更新计数而非追加。

| key | 引用次数 | 最后引用时间 |
|---|---|---|
| pages/project-overview | 12 | 260701 |
| draft/260701-hooks-system | 3 | 260628 |
```

**域文件影响**：

```
hooks/
  └── usage-tracker.mjs            (NEW)  ReadInterceptor + StatusWriter 实现
hooks/
  └── hooks.json                   (改)   新增独立 PostToolUse 条目，matcher: "Read"（W6 修正）
hooks/
  └── usage-tracker.test.mjs       (NEW)  matcher 命中/不命中 + 聚合更新测试
.agents-personal/wiki/
  └── status.md                    (NEW，运行时生成)  聚合表骨架
```

**（W6 修正）hooks.json 注册方式**：新增一个独立的 PostToolUse 条目，`matcher` 精确写 `"Read"`（不是通配符 `"*"`），这样非 Read 工具调用在 hook 分发层面就不会触发这个脚本，不需要脚本内部再判断一次工具名。`hooks.json` 里已有 `continuous-learning-v2` 注册的 `matcher: "*"` 通配符 PostToolUse hook（[Read hooks/hooks.json:83-92]）——两者是同一事件下的两个独立条目，Claude Code 按注册顺序依次触发每个匹配的 hook，互不共享执行上下文，一个抛异常不会阻断另一个继续跑；本设计新增的 hook 只做本地文件读写，不依赖前一个 hook 的输出，两者数据层面无交集。

**域验证**：
- [ ] 单测：非 Read 工具调用 → 直接跳过
- [ ] 单测：Read 非 wiki 路径 → 跳过
- [ ] 单测：Read wiki 页 → 对应行计数+1
- [ ] 单测：Read 新页（status.md 里没有的 key）→ 新增一行
- [ ] 集成：与 PersonalHistory 域共享同一把 `RepoLock`，不会死锁
- [ ] 集成：与既有 `continuous-learning-v2` 的 wildcard PostToolUse hook 共存，各自独立执行，互不影响对方结果

**性能**：hook matcher 在 `hooks.json` 层面精确指定 `"Read"`，非 Read 调用不会触发本脚本；脚本内部先做廉价子串预筛（`includes('wiki')`，无 fs 调用）再决定要不要 `realpathSync`，1000 次非 wiki Read 调用增加的耗时应 <5%（对应场景5验证项）。

---

### PluginRepo 域（简述——复用已验证模式，改动小）

**核心实体**：Git Config Baseline
**本次新增**：working tree 检测

**类接口**：

```typescript
function diffSinceBaseline(pluginRoot: string): { commitDiff: string[], dirtyFiles: string[] } | null
```

伪代码（**C7 修正**：git config key 按分支隔离，与 `freshness-check.mjs` 的 `branch.<branch>.nocode-evolve-base` 模式一致；**C3 修正**：baseline 不可达时降级；**W7 修正**：监控范围补上本设计自己新增的文件）：

```
function diffSinceBaseline(pluginRoot):
  branch = execSync(`git rev-parse --abbrev-ref HEAD`)
  baseline = execSync(`git config branch.${branch}.nocode-evolve-plugin-dream-baseline`, allowFail=true)
                                                        // key 按 branch 隔离，不用全局 key——避免多 worktree/分支互相覆盖（C7）
  if !baseline:
    return null                                        // 首次，走全量分支
  monitoredPaths = ['rules/', 'skills/', 'commands/', 'hooks/', 'scripts/',
                     'rules/manifest.json', '.claude-plugin/plugin.json']
                                                        // hooks/ 与 scripts/ 从"只列 generate.mjs/vendor-sync.mjs 两个文件"
                                                        // 放宽到整个目录——本设计自己新增的 usage-tracker.mjs / personal-migrate.mjs /
                                                        // repo-lock.mjs 都在这两个目录下，不该被增量优化漏检（W7）
  try:
    commitDiff = execSync(`git diff --name-only ${baseline}..HEAD -- ${monitoredPaths.join(' ')}`)
    dirtyFiles = execSync(`git status --porcelain -- ${monitoredPaths.join(' ')}`)  // 捕捉未 commit 改动
    return { commitDiff: parse(commitDiff), dirtyFiles: parse(dirtyFiles) }
  catch e:
    warn(`plugin-dream baseline 不可达（可能因 rebase 丢失）: ${e.message}`)
    return null                                        // 降级为全量分支，不让异常冒泡中断命令（C3）
```

**域文件影响**：`commands/plugin-dream.md`（改，Layer2 接入增量判断，Layer1 不变）

**域验证**：
- [ ] 单测：commit 无变化 + working tree clean → 判定无变化
- [ ] 集成：working tree 有未提交改动 → 判定有变化

---

### ProjectTreeBaseline 域（简述——沿用 Define 阶段确认的交互设计）

**核心实体**：任意目标目录 + 可选 Git 仓库

**类接口**：

```typescript
function detectGitRepo(dirPath: string): boolean
function promptInitIfNeeded(dirPath: string): { initialized: boolean, gitRoot?: string }
```

**（C8 修正，Plan 阶段 red-blue 复审再修正）baseline ref 按目标路径隔离**：`personal-dream` 用单个 `refs/dream/last-baseline` 是因为它只有一个固定目标（`.agents-personal/`）。但 `project-dream` 的 `dir-path` 是任意目标，同一个 git 仓库下可能先后跑 `/project-dream src` 再跑 `/project-dream docs`——如果两次都用同一个 ref，先跑的会把 baseline 推到 HEAD，后跑的不同目录会被误判"完全无变化"。

最初按"仓库内相对路径分层"设计的 ref 名（`refs/dream/last-baseline/' + relative(gitRoot, dirPath)`）有两个真实 bug（Plan 阶段独立评审发现）：① `dirPath === gitRoot`（`/project-dream` 不传参数、默认扫项目根——这是**最常见**的调用方式）时 `relative()` 返回空字符串，拼出 `refs/dream/last-baseline/`（尾部斜杠，`git check-ref-format` 直接拒绝）；② 即便绕开①，先建了裸 ref `refs/dream/last-baseline` 再建 `refs/dream/last-baseline/src` 会撞 git 的 D/F 冲突（同一路径不能既是叶子又是父目录）。

改为**扁平化命名，不建 ref 路径层级**：

```
refName(dirPath, gitRoot):
  rel = relative(gitRoot, dirPath)              // dirPath === gitRoot 时 rel === ''（空串，不是路径分隔符问题）
  suffix = rel === '' ? '_root' : rel.replace(/[\/\\]/g, '_')
  return 'refs/dream/last-baseline__' + suffix   // 双下划线分隔，整个 ref 名是单层，没有 '/'，不会有 D/F 冲突
// 例：dirPath=/repo,     gitRoot=/repo → refs/dream/last-baseline__root
// 例：dirPath=/repo/src, gitRoot=/repo → refs/dream/last-baseline__src
// 例：dirPath=/repo/docs,gitRoot=/repo → refs/dream/last-baseline__docs
```

`diffSinceBaseline`/`advanceBaseline` 复用 `BaselineTracker` 同款逻辑，只是 ref 名参数化为上面这个函数的返回值，不再硬编码 `refs/dream/last-baseline`。

**（Plan 阶段修正）`detectGitRepo`/`promptInitIfNeeded` 需要真实脚本承载**：这两个类接口此前被当作纯 markdown prompt 里的内联判断，没有对应脚本/测试文件，验证强度是四个域里最弱的一处。改为落到 `scripts/project-tree-detect.mjs`（与 `BaselineTracker`/`PluginRepo.diffSinceBaseline` 补文件的先例一致），含"上层项目根"推断算法的具体定义：从 `dirPath` 逐级向上找最近的 `.git` 目录，找到即为 `gitRoot`；若一路到文件系统根都没有 `.git`，则"上层项目根"退化为 `dirPath` 本身（即选项(a)(b)在这种情况下等价，AskUserQuestion 只呈现选项(a)）。

**域文件影响**：`commands/project-dream.md`（改，接入非 git 目录的 AskUserQuestion 交互 + 按目标路径隔离的 baseline 判断）

**域验证**：见系统交互场景 4 的验证项。

## 文件影响汇总

```
scripts/
  ├── personal-snapshot.mjs         (改，大改)  PersonalHistory 域
  ├── personal-migrate.mjs          (NEW)        PersonalHistory 域
  ├── repo-lock.mjs                 (NEW)        PersonalHistory 域（也被 UsageTracking 域复用）
  ├── dream-baseline.mjs            (NEW)        PersonalHistory 域（通用 diff，被 project-dream 参数化复用）
  ├── plugin-dream-baseline.mjs     (NEW)        PluginRepo 域
  └── project-tree-detect.mjs       (NEW)        ProjectTreeBaseline 域

hooks/
  ├── personal-snapshot.test.mjs    (改，大改)  PersonalHistory 域
  ├── repo-lock.test.mjs            (NEW)        PersonalHistory 域
  ├── personal-migrate.test.mjs     (NEW)        PersonalHistory 域
  ├── dream-baseline.test.mjs       (NEW)        PersonalHistory 域
  ├── plugin-dream-baseline.test.mjs(NEW)        PluginRepo 域
  ├── project-tree-detect.test.mjs  (NEW)        ProjectTreeBaseline 域
  ├── usage-tracker.mjs             (NEW)        UsageTracking 域
  ├── usage-tracker.test.mjs        (NEW)        UsageTracking 域
  └── hooks.json                   (改)         UsageTracking 域（注册 PostToolUse）

commands/
  ├── personal-dream.md             (改)  PersonalHistory 域
  ├── plugin-dream.md               (改)  PluginRepo 域
  └── project-dream.md              (改)  ProjectTreeBaseline 域

.claude-plugin/
  └── plugin.json                   (改)  版本号升级（新增 hook + 重写脚本属于 minor 升级）

合计：13 NEW + 7 改（Plan 阶段红蓝复审发现原表遗漏了独立于命令文件之外的可复用逻辑模块文件，已补全）
```

## 验证策略汇总

> 各域单测/集成见各域小节。本节是跨域的端到端场景。

| TO | 覆盖 | 层级 | 说明 |
|---|---|---|---|
| TO-1 | 命令.P1, 约束.2 | 集成 | 首次跑 `/personal-dream`（含检测旧 bare repo 触发迁移分支）全量深检查 |
| TO-2 | 命令.P2 | 集成 | 有变化时只深查变更文件 |
| TO-3 | 命令.P3 | 单测 | 无变化秒回 |
| TO-4 | 命令.P4, 约束.2 | 集成 | 首次跑 `/plugin-dream` 全量检查 + 记录 baseline |
| TO-5 | 命令.P5, 系统.4 | 集成 | commit 变化或 working tree 未提交改动都判定"有变化" |
| TO-6 | 命令.P6 | 单测 | 秒回 |
| TO-7 | 命令.P7, 系统.3 | 集成 | 非 git 目录时 AskUserQuestion 交互 |
| TO-8 | 命令.P8 | 集成 | 部分子目录变化只重新生成变化的 |
| TO-9 | 命令.P9 | 单测 | 完全无变化秒回 |
| TO-10 | 跨域.1 | 集成 | PostToolUse hook 拦截 Read → status.md 更新 |
| TO-11 | 跨域.3 | 集成 | wiki 页 related 路径变化触发重新深查 |
| TO-12 | 跨域.2, 约束.1 | 手动 | 删除护栏二次确认行为不变 |
| TO-13 | 跨域.4 | 集成 | SessionStart snapshot 与 dream baseline ref 移动互不干扰 |
| TO-14 | 系统.1 | 单测 | 嵌套仓库损坏/丢失降级全量扫描 |
| TO-15 | 系统.2 | 单测 | plugin-dream baseline 因 rebase 丢失降级全量扫描 |
| TO-16 | 系统.5 | 集成 | 迁移失败不改动现状，只 warn |
| TO-17 | 系统.6 | 集成 | 并发锁——两进程同时操作，一个等待/明确报告冲突 |
| TO-18 | 约束.3 | 人工核对 | `project-dream` 不包含段落级遗忘/引用频率优先级逻辑 |

不测项：`/schedule` 定时并发调度协调（约束.4 排除，见下节说明）；跨机器多用户并发（本地工具场景，风险低）。

## 部署注意事项

**发布方式**：本次改动全部是插件文件（`scripts/` `hooks/` `commands/`），随插件版本发布即生效，无需额外部署步骤。

**版本升级**：涉及新增 hook（`usage-tracker.mjs` + `hooks.json` 注册项）与重写现有脚本（`personal-snapshot.mjs`），按 CLAUDE.md 规则属于 **minor** 版本升级。

**迁移触发时机**：迁移逻辑挂在 personal-snapshot 现有的 SessionStart 触发点上，每个项目各自在下次打开会话时自动触发一次性迁移，不需要用户手动操作。

**回滚预案**：旧 bare repo 迁移成功后重命名加 `.migrated` 后缀保留在原位置，不删除——如果新机制出问题，可以手动把 `<id>.migrated` 改回 `<id>` 并回退插件版本来恢复旧行为。

**`/schedule` 并发协调（约束.4，本次不实现，仅说明）**：本次实现的 `RepoLock` 只保护"同一时刻不要有两个进程同时对同一个嵌套 `.git` 做写操作"这个更细粒度的原子性问题——这是本次必须做的（不做会导致数据损坏）。而"定时任务与用户手动触发会不会同时跑"是更高层的调度协调问题，仍然留到接入 `/schedule` 时再设计（`RepoLock` 已经为它打好了地基，届时只需要在调度层加一层"是否已有任务在跑"的判断，不需要重新设计并发保护）。

## 监控设计（简化版）

本次改动是本地 CLI 工具，不是生产服务，不需要 Metrics/Traces 体系。唯一需要的可观测性是**迁移失败时的诊断信息**：

**诊断日志格式**（迁移失败时 stderr 输出）：

```json
{
  "event": "personal-migrate.failed",
  "projectId": "nocode-evolve-7d7397b9",
  "oldBareDir": "~/.nocode/personal-history/nocode-evolve-7d7397b9",
  "reason": "content_mismatch | fetch_failed | reset_failed",
  "detail": "<具体错误信息>"
}
```

跟 `personal-snapshot.mjs` 现有的 stderr warn 风格一致，不引入新的日志系统。

## Review Log

**Review 1**（异源双路交叉：Claude checklist review + Codex 红军独立攻击，均已 Read/实测核实相关代码事实）

发现 8 Critical + 8 Warning + 3 Suggestion + 1 Open Question + 4 Self-Audit，蓝红两路对以下 4 项独立命中同一根因（高置信）：RepoLock 非原子/保护窗口失效、迁移校验在活跃项目上必然误判失败、baseline 不可达时缺降级处理、Q6 决策论证不完整。

用户决定：全修 Critical + Warning，跳过 Suggestion。

修订内容：
- **C1**：RepoLock 改用 `fs.openSync(path, 'wx')` 原子操作代替 exists-then-write；锁文件从 `.git/dream.lock` 移到 `.agents-personal/.dream.lock`（不依赖 `.git` 已存在）
- **C2**：`SnapshotWriter.snapshot()` / `MigrationRunner.migrate()` / `BaselineTracker.advanceBaseline()` 三处伪代码补上实际的 `RepoLock.acquire`/`release` 调用
- **C3**：`diffSinceBaseline`（PersonalHistory 与 PluginRepo 两处）加 try/catch，baseline 不可达时降级返回 `null` 走全量分支，不让异常冒泡
- **C4**：迁移流程改为"只导入历史 + 应用后立即 snapshot 吸收漂移"，去掉"内容必须逐文件匹配"的校验；应用步骤改为"临时目录构建完整后单次原子 `mv`"，避免半迁移状态
- **C5**：`diffSinceBaseline` 调用前先 `SnapshotWriter.snapshot()`，把本次会话内未提交的改动先落成 commit 再 diff
- **C6**：`advanceBaseline` 新增 `hadFailures` 参数，Phase 3 有系统性失败时不前移 baseline（用户主动跳过不算失败，仍会前移）
- **C7**：`plugin-dream` baseline 的 git config key 改为 `branch.<branch>.nocode-evolve-plugin-dream-baseline`，按分支隔离
- **C8**：`project-dream` 的 baseline ref 名按目标目录的仓库内相对路径参数化（`refs/dream/last-baseline/<relative-path>`），不再共用单一 ref
- **W1/W8**：Q6 拆成 Q6a（plugin-dream）+ Q6b（project-dream），补齐表格化方案对比
- **W2/W4**：`ReadInterceptor` 明确 `cwd` 遵循 `CLAUDE_PROJECT_DIR || process.cwd()` 约定，文件路径先 `realpathSync` 解析再匹配前缀（兼容 symlink/相对路径），加子串预筛保持性能
- **W3**：「拆分思路」补上 UsageTracking→PersonalHistory 的 RepoLock 类级耦合说明
- **W5**：`status.md` 的 key 从裸 slug 改为含 `draft/`/`pages/` 前缀的相对路径，避免同名页面/跨目录碰撞
- **W6**：`hooks.json` 新增条目的 `matcher` 精确写 `"Read"`（非通配符），并说明与既有 `continuous-learning-v2` wildcard hook 的独立性
- **W7**：`plugin-dream` 监控范围从"两个具体文件"放宽为 `hooks/` `scripts/` 整目录，覆盖本设计自身新增的文件
- **Q1**（Open Question）：在场景 1 澄清首次运行时 `diffSinceBaseline` 内置的 snapshot 调用会先建出首个 commit，解决 `HEAD` 不存在的疑虑

跳过（Suggestion）：S1（git add 排除 `.git` 的理由已在修订后的伪代码里同步去掉不准确表述，顺带处理）、S2（`branch` 未用变量已随 MigrationRunner 伪代码重写移除）、S3（省略"架构设计"节——本次是纯 CLI/hook 改动，域间关系图已承担架构视角，接受不作说明性标注）。

修订后未再触发新一轮异源交叉——本轮修订均为收窄/修正已识别问题，不引入新的架构决策点。
