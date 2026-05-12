---
name: design-doc-writing
description: 写设计文档时使用。按业界主流 4 类 doc-type 主轴（PRD / RFC / Design Doc / ADR）选合适类型；Design Doc 内部按覆盖深度叠加 architecture + implementation layer。工作流含 write → review 循环（spawn design-doc-reviewer subagent，最多 3 轮）。当 superpowers:brainstorming 走到「写设计文档」环节时调用本 skill；当用户要求「写设计文档 / RFC / ADR / 提案 / 架构记录 / 重构方案 / 系统设计」时也用。即使用户没说"用模板"，只要要做的事是产出一份正式的设计性文档，就该用本 skill。不要用本 skill 写代码注释 / PR 描述 / commit message / README / changelog。
---

# 设计文档写作

把「已经讨论清楚的设计」落地成结构化的 markdown 文档。不负责讨论（brainstorming 的事），不负责实施（writing-plans / executing-plans 的事）——只负责**写**。

工作流：write → review → **用户逐条确认** → 修订 → 追加 Review Log。reviewer 只列问题，**不自动循环修订**——是否修、修哪些由用户决定。

## 何时使用

**应该用：**

- superpowers:brainstorming 流程走到 step 5（写设计文档）时
- 用户说「帮我写个 PRD / RFC / 设计文档 / ADR / 重构方案 / 系统设计 / 架构记录 / 提案」
- 你即将创建一个 `*-design.md` / `*-prd.md` / `*-rfc.md` / `*-adr.md` 性质的文件

**不要用：**

- 写代码注释、PR 描述、commit message、README、changelog
- 用户只是问「X 应该怎么做」——这是讨论阶段，先用 brainstorming
- 简单 bug 修复（用 superpowers:debugging）

## 输出路径

由 `rules/overlay-superpowers.md` 与 `rules/agent-about.md` 共同定义，默认：

```
docs/plans/{username}/yymmdd-<topic>-design.md
```

写之前确认 rule 当前值（user 可能已经改过）。

## 选 doc-type（主轴）

设计文档分 4 类，按**这份文档主要回答什么问题**选：

| 任务特征 | doc-type | 主要回答 | 长度 |
|---|---|---|---|
| 产品 / feature 立项，定义需求 | `prd` | what + why（用户痛点 + 目标） | 1-2 页 |
| 跨团队提案，需收 feedback | `rfc` | Is this right direction? | 3-10 页 |
| 实施前详细设计 | `design-doc` | How to build? | 5-15 页 |
| 单一架构决策记录 | `adr` | Why we decided X? | 1-2 页 |

选不准时优先 `design-doc`——它最通用且最 detailed。

判断小贴士：
- 用户角度还是工程角度？用户 → PRD；工程 → 后三个
- 需要跨团队对齐？→ RFC
- 只是记录一个决定？→ ADR
- 实施前详细设计？→ Design Doc

## Design Doc 内部：覆盖深度（layer 叠加）

仅 `design-doc` type 用——判断系统级 vs 小改动：

| 任务粒度 | 读什么 reference | layer 字段 |
|---|---|---|
| **小改动**：改某几个函数 / 加字段 / 调配置 | 只读 `references/layer-supplements/implementation.md` | `implementation` |
| **系统级**：新模块 / 新服务 / 子系统重新设计 | 读 `architecture.md` **+** `implementation.md`（叠加） | `architecture+implementation` |

**不是二选一**——架构层是叠加的。系统级文档必须**既有**架构思考（边界 / 组件 / 数据流 / 失败模式）**也有**实施细节（接口 / 数据 / 错误处理）。

## 工作流

```
1. 判断 doc-type（按上表）
2. Read references/doc-types/<type>.md 看主线节
3. (仅 design-doc) 判断覆盖深度，Read 对应 layer-supplements/*.md
4. Read references/examples/example-<type>.md 学习真实示例
5. (necessary) Read references/common.md（cross-cutting checklist）
6. 写初稿（frontmatter + 主线节 + 上半 / 下半结构）
7. spawn design-doc-reviewer subagent（输入：doc_path）
8. 用户确认环节（核心 gate，见下方）：
   - 默认：把 Report 完整呈现给用户，每条问题前编号，**逐条让用户勾选** fix / skip
   - 用户可一键说「全修 Critical+Warning」「全跳过」「我来给指示」走捷径
   - reviewer 已 ✅ Pass：跳过此步直接进 step 12
9. 据用户决定修订文档（in-place 改主体）；不在用户清单里的问题**不要顺手修**
10. 把本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`（无则新建）
11. 询问用户「再来一轮 review？」
    - 是 → 回 step 7
    - 否 → 进 step 12
12. 保存到输出路径
13. (by overlay) 调 design-doc-rendering skill 出 HTML
```

## 用户确认环节（step 8 细则）

reviewer 输出 Report 后，**不要自己挑哪些修哪些不修**。把决定权交给用户：

1. 把 Report 原样展示给用户（Critical / Warning / Suggestion 三档保留）
2. 给每条问题一个**短编号**（`C1 / C2 / W1 / S1 ...`），方便用户引用
3. 用 AskUserQuestion 或文字 prompt 让用户选：
   - 默认多选：勾选要修的编号
   - 提供快捷选项：「全修 Critical+Warning」「全跳过」「自由指示」
4. 用户确认前**不要动文档主体**——只能等

例外：reviewer Verdict 是 ✅ Pass 时跳过这一步，直接进 step 12。

## Review Log 格式

写到设计文档末尾，每轮 review 追加一条：

```markdown
## Review Log

### Review 1 — 2026-05-12

<!-- Reviewer Report 全文（含 Critical / Warning / Suggestion / Self-Audit / Verdict） -->

**用户决定**：fix C1, C2, W1；skip C3（理由：暂不在 scope）、W2、S1

**本轮修订**：
- C1：Problem statement 加了具体痛点（第 2 节）
- C2：Alternatives 方案 B 补量化否决理由（第 5 节）
- W1：「会话模块」改为 `auth/session.go::CreateSession`（第 7 节）

---

### Review 2 — 2026-05-12
...
```

Review Log 与文档主体同步演进——主体回答「为什么这样设计」，Log 留下「这份文档怎么演化来的」的审计轨迹。

## 状态机

各 doc-type 状态机：

- **PRD**：`draft → in-review → approved → implemented → archived`
- **RFC**：`open → accepted → implemented → superseded` / `open → withdrawn` / `open → rejected`
- **Design Doc**：`draft → in-review → approved → implemented → archived`（**living**，approved 后仍可修改）
- **ADR**：`proposed → accepted → superseded` / `proposed → rejected` / `accepted → deprecated`（**immutable**，accept 后绝不改）

注：ADR 一旦 accept 不可修改；改决策就写新 ADR + supersede 旧的。

## 写作准则

理解原则比死守章节更重要。每条附 ✅正例 / ❌反例。

### 1. 写"为什么"，不只是"是什么"

每个决策附理由。reviewer 看文档要的是**为什么这么选**，不是描述代码长什么样。

> ✅ 正例：「Auth 独立 package。这样 password hashing 的依赖（bcrypt）不被业务代码引入，减少攻击面。」  
> ❌ 反例：「Auth 独立 package。包含 user.go / session.go / token.go。」

### 2. 具体优于抽象

用真实路径、函数名、表名、数据 schema、指标值。

> ✅ 正例：「`POST /api/v1/orders/{id}/cancel`，body `{reason?: string}`，已发货返 409 + `{error: "order_not_cancellable", state: "shipped"}`」  
> ❌ 反例：「取消订单接口在已发货时拒绝请求。」

### 3. Non-Goals 与 Goals 同等重要

明确"不做什么"——防 scope creep。Non-Goals 必须具体，不能写「其他都不做」敷衍。

> ✅ 正例：「不做多语言；不做团队权限；不引入 Web UI」  
> ❌ 反例：「这次先做核心功能，其他需求后续再说」

### 4. Alternatives 真备选 + 真否决理由

不写 alternatives 等于"没考虑过"。每个备选要有具体否决理由。

> ✅ 正例：「方案 B：用 SQLite。否决：单进程写入瓶颈，QPS > 50 会卡」  
> ❌ 反例：「考虑过 SQLite，但 PostgreSQL 更好」

### 5. 删掉不适用的节

保留空标题或 N/A 比删掉更糟——告诉 reviewer「我没想过」。

> ✅ 正例：feature 简单时只有 TL;DR + 3 个主线节，不凑数  
> ❌ 反例：12 个标题，5 个写「N/A」「无变更」「暂无」

## Cross-cutting Concerns

design-doc 的下半部**必须**包含 cross-cutting checklist（详见 `references/common.md`）。每条要么有内容要么明示 N/A + 理由：

- Security / Privacy
- Monitoring / Observability
- Performance Budget
- Migration / Rollout
- Backwards Compatibility
- Documentation Updates

PRD / RFC / ADR 不强制，但鼓励。

## 常见反模式

- ❌ **章节空话**：「需要保证安全性、性能、可维护性」——等于没写。具体到「请求体 >1MB 拒绝」「P99 < 200ms」
- ❌ **"将来式"占位**（YAGNI）：「未来如果有 X 需求，可扩展为 Y」——删
- ❌ **抄需求**：把用户原话粘到背景节——背景要回答**为什么值得做**
- ❌ **避谈失败**：只写 happy path 反面。要列真实故障：网络断、磁盘满、并发写、依赖挂
- ❌ **跳过 reviewer**：不 spawn reviewer 直接交付——本工作流核心是 write → review → 用户确认
- ❌ **代用户拍板**：拿到 Report 就自己挑「这些重要那些不重要」开始改——用户确认环节是 hard gate，**问，不要猜**
- ❌ **吞掉 Review Log**：只 in-place 改主体，不 append 到末尾——审计轨迹断了，下次 review 不知道这版哪些是修过的
- ❌ **混淆 doc-type**：PRD 写 SQL schema / ADR 写百页 implementation / Design Doc 写不到 1 页——选错 type 的信号

## 看 examples 而不是自由发挥

每个 doc-type 在 `references/examples/example-<type>.md` 有完整真实示例（dogfood 本插件历史决策）。**先看 example 学习结构**，再按 doc-type reference 填内容。这比自由发挥可靠得多。
