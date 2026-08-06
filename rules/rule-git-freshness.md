---
name: git-freshness
description: >-
  设计性动作 (设计文档/PRD/RFC/ADR/方案对比/技术选型/重构方案/架构设计)
  前, 或代码搜索 (semble-search / grep -r / rg / find / Explore) 前, 或
  ≥3 文件 Read 探源做方案分析前触发——跑 scripts/freshness-check.mjs 确认
  当前分支未过时于 base, 落后 ≥5 commit 或首次冷启动则停手三选; 同会话
  30min 内重复命中 gate 自动放行 (节流)。不触发: 开 worktree 那一刻
  (由 git-worktree 覆盖)、已知精确路径读单文件、单行 literal grep/文件名
  find、用户显式跳过、2h 内已查过缓存命中、gate 节流窗口内。
skip: false
---

# git-freshness — 设计 / 方案 / 代码搜索前确保基于最新远程

设计 / 方案 / 选型 / 重构 / **多文件代码搜索做方案分析**, 若建立在过时代码上 → 方案与现状脱节, 落地返工 / 搜索结果可能引用已删 / 重构代码. 动手前运行 `scripts/freshness-check.mjs` 拿差距, 必要时 gate 用户.

命令层的 `grep -r` / `rg` / 搜代码文件的 `find` 由 PreToolUse hook 每次命中时实际执行一次脚本；多个 matcher 命中同一 `git-freshness` rule 时按 rule ID 去重，一次 PreToolUse 最多执行一次。这里的“每次执行”不等于“每次 fetch”——脚本内部的 TTL cache 决定是否访问远程。

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
- 同一 worktree / 分支 **2h 内已查过 freshness** (cache TTL 命中 → 脚本毫秒返回, 不打扰)
- 同一 worktree / 分支 **30min 内已 gate 过** (gate 节流: 同会话窗口内重复命中 gate 条件 → 脚本降级放行, `gate_suppressed=true`, message 注明原触发原因)

## 门禁 — Hook 执行 / 行为入口一句调脚本

机械逻辑封装到 `scripts/freshness-check.mjs`。命令层搜索由 PreToolUse hook 调用；设计、语义搜索和多文件 Read 等无法由 Bash matcher 覆盖的行为入口，agent 一句调:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" --max-behind=5 --ttl=7200 --session="${NOCODE_SESSION_ID}"
```

`--session` 用于 gate 节流按会话记分（SessionStart 注入的 `NOCODE_SESSION_ID`；缺省时脚本退化读 env，再没有则 worktree 级节流）。PreToolUse hook 路径由 hook 自动从 payload 传 `session_id`，无需手工带。

输出 stdout JSON: `{ branch, base, behind, ahead, age_seconds, cache_hit, gate, gate_suppressed, message }`. exit code `0`=ok / `2`=gate.

脚本内部逻辑 (agent 无需手动跑这些, 脚本封装):

1. **base 分支推断** (优先级):
   - `git config branch.<branch>.nocode-base` (worktree 创建时写入, 记录真实分叉基线; 不随 `push -u` 漂移到 `origin/<feature-branch>`)
   - `git rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}` (当前分支 upstream, eg. `origin/release/x` 或 `origin/main`)
   - 无 upstream / detached → `git rev-parse --abbrev-ref origin/HEAD` (远端 default branch, 通常 `origin/main`)
   - 兜底 `origin/main`
2. **cache** (`git rev-parse --git-path nocode-freshness.json` — 每 worktree 独立, `.git/` 下不被 commit; 结构 v2: `entries` 按 `<branch>+<base>` 分条记 `last_fetch_ms/behind/ahead`):
   - 命中条件: 该 `branch+base` 有 entry + `(now - last_fetch_ms) < TTL (默认 2h)`
   - 命中 → 直接用 entry, 毫秒返回, **不 fetch**
3. **cache miss** → `git fetch origin <base 去 origin/ 前缀>` (静默) → 重算 `behind = HEAD..base` / `ahead = base..HEAD` → 写回该 branch+base 的 entry
4. **离线** (fetch 失败) → stderr WARN + 用旧 entry (如有) 或视为 freshness unknown, `gate=ok` 不阻塞 (冷启动除外)
5. **冷启动** (该 `branch+base` 在 cache 里从无 entry — 机器/分支首次, 或升级后旧 v1 格式作废) → `coldStart=true`, **无条件 gate 一次** (不论 fetch 成败 / behind 多少); fetch 成功写 entry 后, 下次同组合转常规
6. **gate 节流** (`--gate-ttl`, 默认 1800s): 命中 gate 条件时, 若该 entry 在窗口内已实际 gate 过, 且调用方无 session 或 session 与记录一致 → 降级 `gate=ok` + `gate_suppressed=true` (message 注明原触发原因); 否则正常 gate 并把 `last_gate_ms` / `gate_session` 写回 entry。解决「选 b 接受当前状态后 behind≥5 每次搜索都拦」的重复打扰。离线冷启动无 entry 可写, 不参与节流 (仍每次拦, 直到联网建立基线)

## Gate 行为 (脚本输出 `gate: "gate"` 时)

脚本 `gate: "gate"` (exit 2) 有两个触发源: **(1) 冷启动** — 当前 branch+base 在 cache 从无记录 (机器 / 分支首次), 无条件 gate 一次; **(2) behind 超阈** — `behind >= 5`. 两者都 exit 2 + `message` 含三选, **但都受 30min gate 节流约束**（窗口内同会话重复命中 → `gate=ok` + `gate_suppressed=true`，脚本 message 注明原触发原因，agent 直接放行即可，无需再三选）。Hook 将结果转成 block 决策；行为入口由 agent **停手**, 把 `message` 原样转述给用户, 等回复后再动手. 不替用户拍板.

```
<branch> behind <base> N commits (>= 5, ahead=M). 三选:
  a) pull --rebase 后继续 (推荐, 防过时方案; ahead>0 可能冲突)
  b) 接受当前状态继续 (你签 off 落后可能影响判断)
  c) 跳过 (取消本次动作)
```

`ahead>0` 时 pull --rebase 可能要解冲突 — 脚本 message 已含提醒.

## 性能预算

- **cache 命中** (绝大多数 2h 内调用): 读 JSON + 比时间, ~5-20ms
- **cache miss** (跨 2h): `git fetch` 一次, ~500-2000ms (网络); 之后 2h 内不再 fetch
- **冷启动** (该 branch+base 首次): fetch + gate 一次, 用户拍板后续; 写 entry 后下次转常规
- **gate 节流命中** (30min 窗口内同会话重复命中 gate 条件): 读 JSON 比时间, 毫秒放行
- **离线**: stderr warn + 用旧 entry, 不阻塞 (冷启动无 entry 则仍 gate)

## 机制化局限 (诚实标注)

本 rule 同时有命令层与 behavior 层触发：

- 命令层：`grep -r` / `rg` / 搜代码文件的 `find` 由 PreToolUse 每次实际执行脚本，不依赖 agent 读完提醒后再补跑。
- behavior 层：“即将设计 / 语义搜索 / 多文件 Read”不是单条 Bash 命令，PreToolUse 无法覆盖，仍靠 catalog Step 0 工序 + agent 主动调用。

Codex 当前 PreToolUse codec 只能把 block 编码成安全 system message，不能像 Claude 一样返回 `permissionDecision: deny`；因此脚本会在原命令前真实执行，但 gate 的平台级硬阻断仍受 Codex hook 协议限制。
