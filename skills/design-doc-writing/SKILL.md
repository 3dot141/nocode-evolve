---
name: design-doc-writing
description: 写设计文档时使用。按"开发维度（架构层/开发层）"和"业务维度（做功能/重构/选型/复杂 bug）"两个正交维度选关注点，组装一份按需展开的 markdown 文档。当 superpowers:brainstorming 走到"写设计文档"环节时调用本 skill；当用户要求"写设计文档"「RFC」「ADR」「重构方案」「系统设计」「架构记录」时也用。即使用户没说"用模板"，只要要做的事是产出一份正式的设计性文档，就该用本 skill。不要用本 skill 写代码注释、PR 描述、commit message、README、changelog。
---

# 设计文档写作

把「已经讨论清楚的设计」落地成结构化的 markdown 文档。不负责讨论（那是 brainstorming 的事），不负责实施（那是 writing-plans / executing-plans 的事）——只负责**写**。

## 何时使用

**应该用：**

- superpowers:brainstorming 流程走到 step 5（写设计文档）时
- 用户说「帮我写个设计文档 / RFC / ADR / 重构方案 / 系统设计 / 架构记录」
- 你即将创建一个 `*-design.md` / `*-adr.md` / `*-refactor.md` 性质的文件

**不要用：**

- 写代码注释、PR 描述、commit message、README、changelog（这些都不是设计文档）
- 用户只是问「X 应该怎么做」——这是讨论阶段，先用 brainstorming
- 简单 bug 修复（用 superpowers:debugging）

## 输出路径

由 `rules/overlay-superpowers.md` 与 `rules/agent-about.md` 共同定义，默认：

```
docs/plans/{username}/yymmdd-<topic>-design.md
```

写之前确认 rule 当前值（user 可能已经改过）。

## 选关注点

设计文档**没有死板的类型**——按两个正交维度判断该写什么。

### 维度 1：开发维度（粒度）

你在哪一层思考？

| 粒度 | 选关注点文件 |
|---|---|
| **架构层**：系统/模块/服务级——需要画框图、定边界、考虑跨进程通信 | `references/layer/architecture.md` |
| **开发层**：具体功能/具体改动——改某几个函数、加某个 API、动某张表 | `references/layer/implementation.md` |

判断小窍门：粗到一句话能讲清=开发层；需要画框图=架构层。

### 维度 2：业务维度（任务性质）

你在做什么类型的事？

| 类型 | 选关注点文件 |
|---|---|
| **做新功能 / 扩展能力** | `references/intent/feature.md` |
| **重构 / 改造老代码** | `references/intent/refactor.md` |
| **多方案选型 / 技术决策**（ADR 用这个） | `references/intent/decision.md` |
| **复杂 bug 修复**（少见） | `references/intent/bugfix.md` |

bugfix 通常用 superpowers:debugging skill，**不写设计文档**——只在跨多模块/需阶段性回滚/事故复盘时才用本 skill。

### 通用配件

`references/common.md` 列了跨维度都可能用到的章节：备选方案、测试策略、监控、安全、性能预算、迁移、时间、风险、待确认。**按需挑**。

## 工作流

1. **判断两个维度**：
   - layer：架构 / 开发
   - intent：feature / refactor / decision / bugfix
2. **Read** `references/layer/<层>.md` 和 `references/intent/<业务>.md`
3. （可选）**Read** `references/common.md`，挑通用配件
4. **组装**文档：
   - frontmatter（type 写成 `<layer>-<intent>`，如 `architecture-feature`、`implementation-refactor`、`architecture-decision`）
   - TL;DR 一句话
   - intent 主线节（顺序按 intent 文件）
   - layer 补充节（架构 or 开发关注点）
   - 通用配件（按需）
5. **自检**：
   - 写出来的每节都有具体内容（真实组件名 / 文件路径 / 函数名 / 链接，不要泛泛）
   - 不适用的节**直接不写**——保留空标题或 N/A 比删掉更糟
   - 简单任务可能就是 TL;DR + 2-3 节，**宁可短**，不要硬凑节数
6. **保存**到输出路径

## 文档骨架

不论选了什么组合，文档基本结构都是：

```markdown
---
type: <layer>-<intent>     # 如 architecture-feature
topic: <一句话>
date: YYMMDD
author: {username}
status: draft               # draft | approved | implemented | obsolete
---

# <标题>

> **TL;DR**：一句话。

## <intent 主线节 1>
## <intent 主线节 2>
...

## <layer 补充节 1>
## <layer 补充节 2>
...

## <通用配件>               # 按需，不需要就不写
...
```

## 写作准则

理解原则比死守章节更重要。每条附 ✅正例 / ❌反例对照——例子比抽象描述更能内化。

### 1. 写"为什么"，不只是"是什么"

每个决策附理由。reviewer 看文档要的是判断你**为什么这么选**，不是听你描述代码长什么样——代码自己会说。

> ✅ 正例：「Auth 模块独立 package。这样 password hashing 的依赖（bcrypt）不会被业务代码引入，减少攻击面。」  
> ❌ 反例：「Auth 模块独立 package。包含 user.go、session.go、token.go 三个文件。」

### 2. 具体优于抽象

用真实文件路径、函数名、表名、数据 schema、指标值。具体让 reviewer 能精准提问，抽象只能笼统点头。

> ✅ 正例：「`POST /api/v1/orders/{id}/cancel`，body `{reason?: string}`，已发货返回 409 + `{error: "order_not_cancellable", state: "shipped"}`」  
> ❌ 反例：「取消订单接口在订单已发货时拒绝请求。」

### 3. 显式列取舍和被否决方案

不写出来 = 你没考虑过 = reviewer 会问「为什么不用 X」让你返工。一句话讲清「考虑过 X，否决因为 Y」是最便宜的防御。

> ✅ 正例：「选 PostgreSQL。考虑过 SQLite（否决，单进程写入瓶颈，预期 QPS > 50 会卡）和 MySQL（否决，团队没人熟）。」  
> ❌ 反例：「我们使用 PostgreSQL。」

### 4. 删掉不适用的节

保留空标题或 N/A 比删掉更糟——它在告诉 reviewer「我没想过这个」。删除是判断，留空是逃避。

> ✅ 正例：feature 文档只有「背景动机 / 用户故事 / 验证」三节，60 行左右  
> ❌ 反例：feature 文档 12 个标题，「数据模型变更：无变更」「监控：暂无」「安全：N/A」「性能：暂无」「迁移：N/A」5 节空话

### 5. 宁可短

硬凑节数会稀释信号。reviewer 阅读 30 行有内容的文档比 200 行半空文档更准。文档价值在 reviewer 多快看到关键决策。

> ✅ 正例：简单 feature 文档 3 节、200 字，一眼审完  
> ❌ 反例：同样的简单 feature 12 节、2000 字、5 节空话——reviewer 翻 5 屏才看到关键决策

## 常见反模式

写文档时容易掉的坑——每条反例配上对应正例。

### 1. 章节空话

> ❌ 反例：「需要保证安全性、性能和可维护性」  
> ✅ 正例：「请求体超过 1MB 拒绝；P99 < 200ms；auth 独立 package 不引业务依赖」

### 2. "将来式"占位（违反 YAGNI）

> ❌ 反例：「未来如果有多语言需求，可以扩展为按 locale 路由」  
> ✅ 正例：「当前只支持英文。多语言需求出现时重新设计——现在不预留。」

### 3. 抄需求

背景节不是复述用户的话，要回答「**为什么**值得做」「不做的代价」。

> ❌ 反例：「用户希望能看到订单的物流状态。」  
> ✅ 正例：「客服周均 12 单『我的包裹到哪了』咨询，每单平均 3 分钟。前端加物流详情页可估算每月省 ~36 小时客服时间。」

### 4. 避谈失败

错误处理只写 happy path 的反面。

> ❌ 反例：「如有错误，返回错误信息给用户。」  
> ✅ 正例：「网络中断 → 客户端 30s 超时 → 重试 3 次（指数退避）+ 幂等键防重；DB 主库挂 → 切只读 → 写请求返 503」
