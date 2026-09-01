---
name: git-freshness
description: >-
  设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计)
  前, 或代码搜索 (semble-search / grep -r / rg / find / Explore) 前, 或
  ≥3 文件 Read 探源做方案分析前触发——跑 scripts/freshness-check.mjs 确认
  当前分支未过时于 base, 落后 ≥5 commit 或首次冷启动则停手三选; 同会话
  2h 内已检查过自动跳过 (会话级, 跨会话不共享)。不触发: 开 worktree 那一刻
  (由 git-worktree 覆盖)、已知精确路径读单文件、单行 literal grep/文件名
  find、用户显式跳过、同会话检查窗口内。
skip: false
---

# git-freshness — 设计 / 方案 / 代码搜索前确保基于最新远程

设计 / 方案 / 选型 / 重构 / **多文件代码搜索做方案分析**, 若建立在过时代码上 → 方案与现状脱节, 落地返工 / 搜索结果可能引用已删 / 重构代码. 动手前运行 `scripts/freshness-check.mjs` 拿差距, 必要时 gate 用户.

命令层的 `grep -r` / `rg` / 搜代码文件的 `find` 由 PreToolUse hook 每次命中时实际执行一次脚本；多个 matcher 命中同一 `git-freshness` rule 时按 rule ID 去重，一次 PreToolUse 最多执行一次。这里的“每次执行”不等于“每次 fetch”——脚本内部的 TTL cache 决定是否访问远程；behind/ahead 每次实时本地 `rev-list` 计算，不落缓存（分支追平后立即归零，无冻结陈旧值）。

## 与 `rule-git-worktree` 的边界 (防重叠)

| 场景 | 谁负责 |
|---|---|
| **开 worktree 那刻** (`git worktree add` 前 fetch + 基于 `@{u}` 最新建分支) | `rule-git-worktree` — 本 rule **不触发** |
| **就地在当前分支设计** (不走 worktree) | **本 rule** — 当前分支 vs upstream / origin/HEAD freshness |
| **worktree 内长期工作 / 多次代码搜索 / 设计** (worktree 已开, 内部第二次以上) | **本 rule** (worktree 内 base 是它的 upstream, 可能 `origin/release/x` 非 main; `rule-git-worktree` 的 fetch 只覆盖**创建时刻**, 长期工作仍可能 stale) |

判据: `git worktree add` **那一刻** → 走 worktree rule; **之后**任何就地 / worktree 内动作 → 走本 rule.

## 触发 / 不触发

**触发** (任何一项命中):

- 即将做设计性动作 (写设计文档 / PRD / RFC / ADR / 方案对比 / 技术选型 / 重构方案 / 架构设计)
- 即将做**代码搜索**（语义搜索 workflow / 精确文本搜索 / 文件名搜索 / 多文件探索）
- 即将做**多文件 Read** 分析方案 (≥3 文件 Read 探源)

**不触发** (明确豁免):

- 开 / 将开 worktree 那刻 (`rule-git-worktree` fetch 已覆盖)
- 已知精确路径 Read 单文件
- 单行 literal Bash grep / 文件名 Glob find
- 用户显式说"直接搜 / 不要 fetch / 跳过 freshness"
- 离线 (`fetch` 失败 → 脚本自动 warn + 继续, 不阻塞) — **但冷启动 (当前 branch+base 从无 cache 记录) 例外, 仍 gate 一次, 见下「Gate 行为」**
- **同会话 2h 内已检查过** (会话跳过: 同一 `--session` 窗口内检查过一次——ok / gate 均算——后续调用直接跳过执行, `session_skipped=true`, 毫秒返回不打扰)
- 同一 worktree / 分支 **2h 内已 fetch 过** (fetch cache TTL 命中 → 不重新访问远程; behind 仍每次实时计算)

## 门禁 — Hook 执行 / 行为入口一句调脚本

机械逻辑封装到 `scripts/freshness-check.mjs`。命令层搜索由 PreToolUse hook 调用；设计、语义搜索和多文件 Read 等无法由 Bash matcher 覆盖的行为入口，agent 一句调:

```bash
node "${QODER_PLUGIN_ROOT}/scripts/freshness-check.mjs" --max-behind=5 --ttl=7200 --session="${NOCODE_SESSION_ID}"
```

`--session` 用于**会话级跳过**（SessionStart 注入的 `NOCODE_SESSION_ID`）。会话 = 一次完整的上下文生命周期：同一 claude 实例的全部轮次（含 compact 压缩延续）同一 ID；`/clear`、新开窗口、重启、并行另一实例 = 新会话。同会话检查过一次（ok / gate 均算）→ 窗口内后续调用直接跳过；**跨会话不共享**——新会话第一次仍完整检查（fetch 判定 + 实时 behind + gate 判定）。缺省时脚本退化读 env，再没有则跳过不生效（无法识别“同会话”，每次完整执行）。PreToolUse hook 路径由 hook 自动从 payload 传 `session_id`，无需手工带。

输出 stdout JSON: `{ branch, base, behind, ahead, age_seconds, cache_hit, cold_start, gate, session_skipped, message }`. exit code `0`=ok / `2`=gate.

脚本内部逻辑 (agent 无需手动跑这些, 脚本封装):

1. **base 分支推断** (优先级):
   - `git config branch.<branch>.nocode-base` (worktree 创建时写入, 记录真实分叉基线; 不随 `push -u` 漂移到 `origin/<feature-branch>`)
   - `git rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}` (当前分支 upstream, eg. `origin/release/x` 或 `origin/main`)
   - 无 upstream / detached → `git rev-parse --abbrev-ref origin/HEAD` (远端 default branch, 通常 `origin/main`)
   - 兜底 `origin/main`
2. **cache** (`git rev-parse --git-path nocode-freshness.json` — 每 worktree 独立, `.git/` 下不被 commit; 结构 v3: `{ v: 3, entries: { "<branch>+<base>": { last_fetch_ms, last_check_ms, last_check_session } } }`; v2 及更旧 (含冻结 behind/ahead 字段) 读到即作废 → 触发一次冷启动重建):
   - **fetch 命中**: 该 `branch+base` 有 entry + `(now - last_fetch_ms) < TTL (默认 2h)` → 不重新 fetch
   - **会话跳过**: entry 的 `last_check_session` 与本次 session 一致 + `(now - last_check_ms) < TTL` → 直接 ok 跳过执行 (不 fetch、不 rev-list)
3. **behind / ahead 实时计算**: 每次执行都本地 `rev-list --count HEAD..base` / `base..HEAD` (毫秒级)——fetch 缓存只表示"远端 ref 何时同步过", 不冻结落后量; 分支被 pull/push 追平后 behind 立即归零
4. **cache miss (fetch 层)** → `git fetch origin <base 去 origin/ 前缀>` (静默) → 写回 `last_fetch_ms`
5. **离线** (fetch 失败) → stderr WARN + 沿用旧 entry 的 fetch 时刻, behind 仍实时算, `gate=ok` 不阻塞 (冷启动除外)
6. **冷启动** (该 `branch+base` 在 cache 里从无 entry — 机器/分支首次, 或升级后旧格式作废) → `coldStart=true`, **无条件 gate 一次** (不论 fetch 成败 / behind 多少); fetch 成功写 entry 后, 下次同组合转常规
7. **检查记录写回**: 每次完整检查 (ok / gate 均算) 写 `last_check_ms` / `last_check_session`——gate 也算检查过 (用户即将三选, 同会话后续不再打扰)。离线冷启动无 entry 可写, 不写 (仍每次拦, 直到联网建立基线)

## Gate 行为 (脚本输出 `gate: "gate"` 时)

脚本 `gate: "gate"` (exit 2) 有两个触发源: **(1) 冷启动** — 当前 branch+base 在 cache 从无记录 (机器 / 分支首次), 无条件 gate 一次; **(2) behind 超阈** — `behind >= 5` (实时值, 无冻结). 两者都 exit 2 + `message` 含三选。**同会话**后续命中 → `gate=ok` + `session_skipped=true` 毫秒返回, agent 直接放行无需再三选; **跨会话不共享**——新会话第一次命中仍完整检查、该 gate 的 gate（各自确认一次）。Hook 将结果转成 block 决策；行为入口由 agent **停手**, 把 `message` 原样转述给用户, 等回复后再动手. 不替用户拍板.

```
<branch> behind <base> N commits (>= 5, ahead=M). 三选:
  a) pull --rebase 后继续 (推荐, 防过时方案; ahead>0 可能冲突)
  b) 接受当前状态继续 (你签 off 落后可能影响判断)
  c) 跳过 (取消本次动作)
```

`ahead>0` 时 pull --rebase 可能要解冲突 — 脚本 message 已含提醒.

## 性能预算

- **会话跳过命中** (同会话 2h 内已检查过, 最常见路径): 读 JSON + 比时间, ~5-20ms, 不 fetch 不 rev-list
- **fetch 命中 + 非同会话**: 读 JSON + 2 次本地 `rev-list`, ~20-50ms
- **fetch miss** (跨 2h): `git fetch` 一次, ~500-2000ms (网络); 之后 2h 内不再 fetch
- **冷启动** (该 branch+base 首次): fetch + gate 一次, 用户拍板后续; 写 entry 后下次转常规
- **离线**: stderr warn + 沿用旧 entry, 不阻塞 (冷启动无 entry 则仍 gate)

## 机制化局限 (诚实标注)

本 rule 同时有命令层与 behavior 层触发：

- 命令层：`grep -r` / `rg` / 搜代码文件的 `find` 由 PreToolUse 每次实际执行脚本，不依赖 agent 读完提醒后再补跑。
- behavior 层：“即将设计 / 语义搜索 / 多文件 Read”不是单条 Bash 命令，PreToolUse 无法覆盖，仍靠 catalog Step 0 工序 + agent 主动调用。

Codex 当前 PreToolUse codec 只能把 block 编码成安全 system message，不能像 Claude 一样返回 `permissionDecision: deny`；因此脚本会在原命令前真实执行，但 gate 的平台级硬阻断仍受 Codex hook 协议限制。
