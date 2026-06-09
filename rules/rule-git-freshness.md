# git-freshness — 设计 / 方案 / 代码搜索前确保基于最新远程

设计 / 方案 / 选型 / 重构 / **多文件代码搜索做方案分析**, 若建立在过时代码上 → 方案与现状脱节, 落地返工 / 搜索结果可能引用已删 / 重构代码. 动手前先用 `scripts/freshness-check.mjs` 一句拿差距, 必要时 gate 用户.

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
- 即将做**代码搜索** (`Agent(subagent_type: "semble-search")` / Bash `grep -r` / `rg` / `find` 找实现 / `Explore` agent)
- 即将做**多文件 Read** 分析方案 (≥3 文件 Read 探源)

**不触发** (明确豁免):

- 开 / 将开 worktree 那刻 (`rule-git-worktree` fetch 已覆盖)
- 已知精确路径 Read 单文件
- 单行 literal Bash grep / 文件名 Glob find
- 用户显式说"直接搜 / 不要 fetch / 跳过 freshness"
- 离线 (`fetch` 失败 → 脚本自动 warn + 继续, 不阻塞) — **但冷启动 (当前 branch+base 从无 cache 记录) 例外, 仍 gate 一次, 见下「Gate 行为」**
- 同一 worktree / 分支 **2h 内已查过 freshness** (cache TTL 命中 → 脚本毫秒返回, 不打扰)

## 门禁 — 一句调脚本

机械逻辑封装到 `scripts/freshness-check.mjs`, agent 一句调:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/freshness-check.mjs" --max-behind=5 --ttl=7200
```

输出 stdout JSON: `{ branch, base, behind, ahead, age_seconds, cache_hit, gate, message }`. exit code `0`=ok / `2`=gate.

脚本内部逻辑 (agent 无需手动跑这些, 脚本封装):

1. **base 分支推断** (优先级):
   - `git config branch.<branch>.nocode-evolve-base` (worktree 创建时写入, 记录真实分叉基线; 不随 `push -u` 漂移到 `origin/<feature-branch>`)
   - `git rev-parse --abbrev-ref --symbolic-full-name HEAD@{u}` (当前分支 upstream, eg. `origin/release/x` 或 `origin/main`)
   - 无 upstream / detached → `git rev-parse --abbrev-ref origin/HEAD` (远端 default branch, 通常 `origin/main`)
   - 兜底 `origin/main`
2. **cache** (`git rev-parse --git-path nocode-evolve-freshness.json` — 每 worktree 独立, `.git/` 下不被 commit; 结构 v2: `entries` 按 `<branch>+<base>` 分条记 `last_fetch_ms/behind/ahead`):
   - 命中条件: 该 `branch+base` 有 entry + `(now - last_fetch_ms) < TTL (默认 2h)`
   - 命中 → 直接用 entry, 毫秒返回, **不 fetch**
3. **cache miss** → `git fetch origin <base 去 origin/ 前缀>` (静默) → 重算 `behind = HEAD..base` / `ahead = base..HEAD` → 写回该 branch+base 的 entry
4. **离线** (fetch 失败) → stderr WARN + 用旧 entry (如有) 或视为 freshness unknown, `gate=ok` 不阻塞 (冷启动除外)
5. **冷启动** (该 `branch+base` 在 cache 里从无 entry — 机器/分支首次, 或升级后旧 v1 格式作废) → `coldStart=true`, **无条件 gate 一次** (不论 fetch 成败 / behind 多少); fetch 成功写 entry 后, 下次同组合转常规

## Gate 行为 (脚本输出 `gate: "gate"` 时)

脚本 `gate: "gate"` (exit 2) 有两个触发源: **(1) 冷启动** — 当前 branch+base 在 cache 从无记录 (机器 / 分支首次), 无条件 gate 一次; **(2) behind 超阈** — `behind >= 5`. 两者都 exit 2 + `message` 含三选. **停手**, 把 `message` 原样转述给用户, 等回复后再动手. 不替用户拍板.

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
- **离线**: stderr warn + 用旧 entry, 不阻塞 (冷启动无 entry 则仍 gate)

## 机制化局限 (诚实标注)

本 rule 是 **behavior 触发** — "即将搜代码 / 设计"不是单条 Bash 命令, **PreToolUse 拦不到** (主搜索通道 `Agent(subagent_type: "semble-search")` 不经 Bash matcher). 主要靠 catalog Step 0 工序 + agent 自觉跑脚本. cache 机制大幅降低重复 fetch 成本 (2h 内 0 网络开销), 是性能上的兜底, 但不是触发上的硬保证.

> 历史: v2.x 版本 git-freshness 只覆盖"就地设计 + 主仓"场景; v3.5.1 起扩到代码搜索 + worktree 内长期工作, base 分支推断支持非 main 派生 (eg. release). v3.9.0 加冷启动拦截 (branch+base 首次无条件 gate 一次) + cache 升级为 per-branch+base entries map (v1 单条格式作废).
