---
name: pilot
description: 工程任务流程领航. 可被 model 主动调起, 也可用户 /调 进入, 给"当前阶段判断 + 下一步建议 + 备选", 用户拍板, 不替用户执行. agent 视角: 复杂 / 多步 / 跨阶段任务 (跨文件 + 状态未知 / 需要 commit / PR / 设计文档 / 评审 / 用户说"整个/整体/全流程") 时, 主动调起本 skill 给流程建议并停下等用户拍板. 不用于简单单步任务.
---

# nocode-evolve:pilot — 工程任务流程领航

> 工程任务驾驶舱。**model 命中复杂多步任务时主动调起**, 用户也可 **`/调`** 进入。给建议不替执行。

## 协议 (被调起时严格按此走)

### Step 1: 先判「这任务要不要流程建议」

如果用户的任务是 **简单 / 明确单步**(改个变量名 / 修个小 bug / 查个事实 / 改一行文案),**直接回**:

> "这是单步任务, 直接做即可, 无需流程编排。"

然后**退出**, 不强吐方案、不画流程图。

只有 **复杂 / 多步 / 不确定下一步 / 要规划整体** 时才走 Step 2-4。

### Step 2: 判当前阶段

据下方生命周期地图, 看会话情境 (已经做了什么、在哪一步), 判 agent 当前处于哪个阶段。

### Step 3: 输出建议

格式:

```
当前在 X 阶段 (依据: 已做了 A、B)
建议下一步: Y (对应 skill/rule: Z, 理由: …)
备选: W (如果你要跳/回退/并行做别的)
```

### Step 4: 停下来让用户拍板

**不自动执行**下一步。等用户说 "OK, 做 Y" 或 "我要做 W" 或调整方向后再动手。

---

## 生命周期地图 (软序, 地图非轨道; 按情境跳 / 回退 / 并行)

| 阶段 | 对应 skill / 规则 | 何时进 / 产出 |
|---|---|---|
| **0 理解 / 设计** | `superpowers:brainstorming` → `nocode-evolve:design-doc-writing` (含 render 环节) | 需求不清 / 要设计文档 → 设计 spec |
| **1 隔离环境** | `superpowers:using-git-worktrees` (+ `rule-git-worktree`) | 要动代码 / 新分支 → worktree |
| **2 实现** | `superpowers:test-driven-development` / `subagent-driven-development` | 设计已定 → TDD 实现 |
| **3 验证 / 评审** | `superpowers:requesting-code-review` (+ `rule-codex-review`) | 实现完, 提交前 → 评审 |
| **4 收尾 / 沉淀** | `superpowers:finishing-a-development-branch` (+ `rule-finishing-branch` / `rule-push-summary`) | 评审过 → 合并 + 总结 |
| **⟳ 横切 (任意阶段)** | `nocode-evolve:red-blue-deep` (评估拍板) | 需要时随时调 |

> 规则细节不在此重复 —— 常驻 `model/agent-catalog-*.md` 已含完整 rule 路由 (触发 / 读 / 摘要 / guard);项目本地资源 (`.agents-personal/`) 的检索约定常驻 `model/agent-personal.md`;`git-inspection` / `git-freshness` 这两条 behavior 常驻 `model/agent-about.md` 的「常驻 git 习惯」节。需要时 Read 对应 rule 文件。

---

## 例子 (协议怎么用)

### 例 1: 简单任务 (Step 1 直接放行)

用户: `/pilot 帮我把 user_id 改成 userId`

→ 你回:

> "这是单步重命名任务, 直接做即可, 无需流程编排。建议: 跨文件 grep + Edit。"

退出。

### 例 2: 复杂任务 (走 Step 2-4)

用户: `/pilot 我要给插件加个新 skill 叫 X`

→ 你回:

> **当前在 0 理解/设计 阶段** (依据: 还没设计 spec, X 的用途/触发不明)
> **建议下一步**: `superpowers:brainstorming` 走清楚 X 的用途/触发, 然后 `nocode-evolve:design-doc-writing` 出 spec; 然后进 1 隔离环境 (worktree) → 2 实现 + TDD → 3 review → 4 finishing-branch
> **备选**: 如果 X 是琐碎 skill (单一动作, 无 trade-off), 可跳过 brainstorming 直接进 1 隔离 + 2 实现

然后停下, 等用户拍板。

---

## 不要

- **只在复杂多步任务触发**: 简单单步别调起 (Step 1 必判); 用户也可主动 `/调`。
- **简单任务别强加流程**: Step 1 必判, 简单就放行。
- **不替用户执行**: 给建议后停下, 等用户拍板。
- **不重复规则细节**: 路由表在常驻 catalog 分片, 这里只给阶段/建议, 不抄 rule 内容。
