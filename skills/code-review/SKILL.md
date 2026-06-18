---
name: code-review
description: 多维度代码评审 + 简化 + 安全 + 统一 findings 分级。Use before merging any change, after completing a feature, or when reviewing code written by yourself, another agent, or a human. Use when devflow routes to Review stage, or when the user says "review 一下/看看代码/评审/check the code". Covers five axes (correctness, readability, architecture, security, performance), code simplification, and feedback discipline.
---

# code-review — 多维度代码评审

自评 + 独立交叉评 + 统一 findings 分级。对自己写的、另一个 agent 写的、人写的代码都适用。

产出：分级 findings 报告（Critical / Warning / Suggestion），用户逐条拍板。Critical 不可 override。

## Entry Gate

- [ ] Verify Gate 已过（验收标准逐条通过 + 证据齐全）
- [ ] Change sizing 已判断（~100 行好；~300 行可接受；~1000 行先建议 split）
- [ ] 评审范围 = 本次变更涉及的代码（不评历史遗留）

## Checklist (TaskCreate)

1. **Five-Axis Self-Review** — 正确性 → 可读性 → 架构 → 安全 → 性能
2. **Simplification Pass** — Chesterton's Fence + dead code
3. **Codex Cross-Review** — 独立交叉评（不可用则降级并明说）
4. **Findings Triage** — 统一 schema 分级，呈现给用户
5. **用户 approve** — Gate：Critical 全 fix + 用户逐条拍板 Warning

## 协议

### 7a. Five-Axis Self-Review

按五轴逐一过 diff（详细检查点见 `references/five-axis-guide.md`）：

| 轴 | 核心问题 | 高频缺陷 |
|---|---|---|
| 正确性 | 逻辑对吗？边界处理了吗？ | off-by-one / race / null 未防 |
| 可读性 | 不看作者解释能看懂吗？ | 命名含糊 / 嵌套过深 / 魔法数 |
| 架构 | 职责分对了吗？依赖方向？ | 循环依赖 / 与现有 pattern 不一致 |
| 安全 | 信任边界守住了吗？ | OWASP Top 10 / 注入 / 密钥硬编码 |
| 性能 | 不必要的开销？ | N+1 / unbounded fetch / 缺分页 |

安全详见 `references/security-checklist.md`。性能详见 `references/performance-checklist.md`。

### 7b. Simplification Pass

只针对本次变更，不改行为（详见 `references/simplification-guide.md`）。
- **Chesterton's Fence**：删代码前先 `git blame` 理解它为什么存在。不懂就不删
- **Rule of 500**：函数 > 50 行考虑拆，文件 > 500 行考虑拆。拆职责不拆行数
- **Dead code**：识别 → 列出 → 问用户 → 确认后再删

### 7c. Codex Cross-Review

自评有盲区。先探 codex 可用性（`rule-codex-review` 的 `setup --json`），不可用则降级自评 + 明说。
合并两路 findings：交集 = 高置信，对称差 = 各自盲点。

### 7d. Findings Triage

每条 finding 统一结构：`id`（C1/W1/S1）+ `axis` + `evidence`（file:line + 代码）+ `fix`（可操作的修法）+ `action`（Critical/Warning/Suggestion）。

| 级别 | 含义 | 谁拍板 |
|---|---|---|
| Critical | 阻塞 merge：安全漏洞/数据丢失/功能破坏 | 不可 override |
| Warning | 应修非致命 | 用户决定 fix/skip/defer |
| Suggestion | 改进/风格 | 记录不阻塞 |

### 7e. Feedback Discipline（收到外部 review 时）

- **禁语**：不说 "Great catch" / "Absolutely right"——performative 同意掩盖未验证
- **unclear → 全部停**：看不懂就停下问清楚，不做部分实现
- **YAGNI**：reviewer 说"加 X 以备将来" → grep 看现在用没用，没用就 push-back
- **push-back**：技术正确 > 社交舒适

**新依赖 5 问**（review 发现新增 import/package）：标准库能否解决？包多大？维护活跃？已知 CVE？License 兼容？答不全 = Warning。

## Exit Gate

- [ ] 所有 Critical 已 fix
- [ ] 用户对 Warning 逐条显式拍板
- [ ] fix 改了代码 → 已回 Build → Verify → 再 Review（回流规则）

## 核心反模式

| 反模式 | 正确做法 |
|---|---|
| "自己写的不用 review" | 自评盲区最大，这正是交叉评的理由 |
| Critical 降级成 Warning | Critical 不可 override |
| 删代码没查 git blame | Chesterton's Fence |
| reviewer 说啥照改 | 先验证再实现，错的要 push-back |
| fix 完直接合不再测 | 回流：改了代码必须回 Verify |

## Red Flags

- 五轴只过了正确性，安全/性能跳过
- finding 写成"感觉怪"——没有 file:line + evidence
- 1000 行 diff 直接开评，没先建议 split
- 对外部 reviewer 每条都"good point"全盘照改
