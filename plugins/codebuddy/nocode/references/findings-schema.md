# Findings Schema — Design + Code Review 统一格式

> 被 `design-doc-writing` 和 `code-review` 两个 skill 共同引用。所有评审 findings 用同一格式，确保全流程一致。

## Finding 结构

```
- id: <prefix><number>  (C1 / W2 / S3 / Q1 / A1)
- type: Critical / Warning / Suggestion / OpenQuestion / SelfAudit
- axis: <检查维度>
- evidence: 具体位置 + 问题描述
- fix: 建议修复方式
- action: fix / skip / defer / accept / answer (用户决定)
```

## Type 定义

| Type | 含义 | 前缀 | Gate 行为 |
|---|---|---|---|
| **Critical** | 阻塞合入——安全漏洞/数据丢失/功能破坏 | C | blocker 类不可 override；非 blocker 类可 accept with rationale |
| **Warning** | 有问题但不阻塞——代码质量/架构/性能 | W | 用户决定 fix/skip/defer |
| **Suggestion** | 建议——风格/可选优化 | S | 记录，不阻塞 |
| **OpenQuestion** | 未解答的问题——需要更多信息才能判断 | Q | 必须 answer 才过 Gate |
| **SelfAudit** | 自审发现——作者自己标注的待处理项 | A | 必须处理（fix or acknowledge） |

## Critical 的 Override 策略

| Critical 子类 | 可否 override |
|---|---|
| 安全漏洞（注入/XSS/SSRF/认证绕过） | **不可 override** |
| 数据丢失/损坏 | **不可 override** |
| 合规问题 | **不可 override** |
| 功能破坏（但有临时 workaround） | 可 accept with rationale |
| 破坏性迁移（但有回滚方案） | 可 accept with rationale |

Override 时必须在 Review Log 记录 rationale。

## Axis 枚举

### Design Review 维度

| Axis | 检查什么 |
|---|---|
| feasibility | 能按描述实现吗？技术可行性 |
| clarity | 读者能看懂吗？歧义/遗漏 |
| consistency | 与现有架构冲突吗？ |
| security | 引入新攻击面吗？ |
| scalability | 会成为瓶颈吗？ |

### Code Review 维度

| Axis | 检查什么 |
|---|---|
| correctness | 逻辑/边界/错误处理/race condition |
| readability | 命名/结构/复杂度 |
| architecture | 职责/依赖方向/抽象层级 |
| security | OWASP/三层边界/AI-LLM |
| performance | N+1/unbounded/pagination/re-render |
| simplification | Chesterton's Fence/dead code/Rule of 500 |
| dependency | 新依赖的必要性/大小/维护/CVE/license |

## 示例

```markdown
- **C1** [correctness]: `hooks/generate.mjs:42` — `buckets` 遍历假设 `items` 字段存在，但 manifest schema 实际用 `rules`。运行时会跳过所有 rule 生成。
  fix: 改为 `b.rules || b.items || []`
  action: fix

- **W1** [readability]: `skills/build/SKILL.md:85` — "5a/5b/5c/5d" 编号与 devflow 阶段编号 "阶段 5" 混淆。
  fix: 改为 "a/b/c/d" 无数字前缀
  action: skip (风格偏好，不阻塞)

- **Q1** [feasibility]: Design Doc 引用了 `FeatureX` API，但 codebase 中没有这个 API 的定义。是计划新建还是笔误？
  action: answer
```
