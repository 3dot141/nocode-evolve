---
name: design
description: 从确认的问题定义到具体解法。Use when Define stage is complete and the task needs architecture/approach decisions before implementation. Use when devflow routes to Design stage, or when the user says "设计方案/怎么做/选什么技术/架构设计/方案对比". Takes Define's restate as input, explores approaches via brainstorming, selects solution, then delegates to design-doc-writing for documentation. For Full-scene tasks — Standard scene skips Design and goes directly to Plan.
---

# nocode-evolve:design — 从问题到解法

> Define 回答"做什么"，Design 回答"怎么做"。
>
> 输入：Define 产出的 restate（问题边界 + 验收标准 + 场景分类）
> 输出：确认的方案 + 设计文档
>
> Brainstorming 是 Design 的核心工作方式——用来发散解法空间（有哪些架构选择？各自权衡是什么？哪种方案最匹配约束？）。Define 里的 brainstorming 探索问题本身，Design 里的 brainstorming 探索解法。

## Checklist（强制 TaskCreate）

进入 Design 后，你必须为以下步骤各建一条 task，按顺序完成：

1. **确认输入** — 检查 Define restate 存在且已确认
2. **探索项目上下文** — Read 相关代码，了解现状
3. **方案探索** — 提出 2-3 方案 + 权衡 + 推荐
4. **用户选方案** — Gate：用户显式选择
5. **方案←→目标对齐** — 回检 restate，确认不冲突
6. **测试目标** — 从 restate + 方案推导测试目标
7. **写设计文档** — 调 design-doc-writing

## 协议

### Step 1: 确认输入

检查 Define 的 restate 是否存在且用户已确认。

- 有 restate → 进 Step 2
- 没有 restate → 建议先跑 `Skill(nocode-evolve:define)`
- restate 模糊（缺 Success Criteria 或 Out of Scope）→ 指出缺什么，建议回 Define 补齐

### Step 2: 探索项目上下文

读相关代码、现有架构、已有实现，理解现状。不凭记忆，亲眼看。

- Read 受影响的文件、关键 caller、共享工具
- 了解现有约定和模式（命名、分层、已有类似实现）
- 每个判断标注来源（与 Build 统一格式）：
  - `[Read path:line]` — 直接读到的事实
  - `[Doc URL]` — 官方文档确认
  - `[推断]` — 没有直接依据的推断（必须显式标，不许伪装成事实）

### Step 3: Brainstorm — 方案探索

用发散思维探索解法空间。这里是 brainstorming 作为方法的主场：

**3a. 列出候选方案（2-3 个）**

每个方案：
- 一句话概括核心思路
- 优势（在什么条件下它最好）
- 代价（实现成本 / 维护负担 / 引入的复杂度）
- 适用条件（什么情况下选它）

不凑数——如果只有一条合理路径，说明为什么其他路径不可行，不硬造第二个方案。

**3b. 给出推荐 + 推荐理由**

推荐要落到 restate 的约束和验收标准上：这个方案最匹配哪条约束、最直接满足哪条验收标准。

**3c. 对比矩阵（可选）**

方案 ≥ 3 个或维度 ≥ 3 个时，用表格对比。不要用长段文字并列描述。

### Step 4: 用户选方案

Gate：用户显式选择。

- "都行"/"随你" → 不算确认。重新提两个具体选项，说清各自的核心取舍
- 用户选了但附带修改（"选 A 但把 X 换成 Y"）→ 记录修改，确认最终方案
- 用户全部否决 → 回 Step 3 重新探索，问用户否决的原因

### Step 5: 方案←→目标对齐检查

选定方案后，回检 Define 的 restate：

- 方案没有改变目标边界 → 进 Step 6
- 方案发现新约束 / 需要调整范围 / 某条验收标准不可行 → 告知用户具体哪里冲突，建议回 Define 修正 restate
- 最多 2 轮回检。仍不稳定 → 停下，说明问题和方案之间的根本矛盾

### Step 6: 测试目标

方案确认后、写设计文档前，定义测试目标。测试目标回答"怎么证明这个设计是对的"，给后续 Build（TDD 写什么测试）和 Verify（验收怎么跑）提供方向。

**6a. 从 restate 推导测试目标**

每条 Success Criteria 对应至少一条测试目标：

```
Success Criteria: "搜索响应 < 200ms (p95)"
→ 测试目标: 性能测试 — 模拟 100 并发查询，验证 p95 < 200ms
```

**6b. 从方案推导可测性约束**

选定方案里有没有难测的部分？提前标出来：

- 需要 mock 的外部依赖
- 需要特定环境才能验证的行为（如并发、网络超时）
- 状态机 / 多步流程的关键路径和边界 case

**6c. 测试层级建议**

按方案复杂度建议测试层级分布（不是死规矩，是方向）：

| 层级 | 覆盖什么 | 何时必要 |
|---|---|---|
| 单测 | 单个函数/模块的逻辑正确性 | 始终 |
| 集成测试 | 模块间交互 / API 契约 | 跨模块改动 |
| E2E | 用户视角的完整流程 | 用户可见行为改变 |

### Step 7: 写设计文档

调 `Skill(nocode-evolve:design-doc-writing)`，输入为选定方案 + restate + 测试目标。

design-doc-writing 接管后续：doc-type 选择 → 写 → review → render。测试目标写入设计文档的「单测设计」节。

### 产出

- 确认的方案选型（用户显式选择）
- 测试目标（从 restate + 方案推导）
- 设计文档（由 design-doc-writing 产出）
- 方案←→目标的对齐记录

后续消费：
- **Plan** 基于设计文档拆任务，测试目标指导 slice 划分
- **Build** 基于测试目标写 TDD 测试用例，基于设计文档写实现
- **Verify** 基于验收标准 + 测试目标逐条核对

## Common Rationalizations

| 借口 | 反驳 |
|---|---|
| "方案很明显，不用对比" | 你觉得明显可能是因为只想到了一种。花 2 分钟列替代方案，确认它们确实不如你的默认选择 |
| "先写着看，边写边设计" | 那叫 spike，不叫设计。spike 的产出是信息不是代码——跑完回来走 Design |
| "用户说了用 X 方案" | 用户指定了方案不等于跳过 Design。验证指定方案的可行性 + 补全缺失的设计细节仍是 Design 的活 |
| "这个改动太小不需要设计" | 小改动走 Standard 场景（跳 Design 直接 Plan）。进了 Design 就是因为场景判定它需要设计 |
| "代码读过了不用再看" | "读过"不等于"刚看过"。隔了几轮工具调用就重新 Read |

## Red Flags

- 只提了一个方案就让用户确认（除非明确说明了为什么没有替代方案）
- 方案对比只说优势不说代价（在做推销不是在做设计）
- 方案选完没有回检 restate（目标←→解法脱钩的温床）
- 用户否决方案后直接放弃，不问否决原因（浪费了最有价值的信息）
- 方案描述里引用了没有 Read 过的代码（在猜不是在设计）

## Verification Checklist

- [ ] Define 的 restate 已存在且用户已确认
- [ ] 项目上下文已通过 Read 真实代码了解（不凭记忆）
- [ ] 提出了 ≥ 2 方案或明确说明了为什么只有一条路
- [ ] 每个方案有优势、代价、适用条件
- [ ] 给出了推荐 + 推荐理由（落到 restate 约束）
- [ ] 用户显式选择了方案（不是"都行"）
- [ ] 选定方案回检过 restate，确认不冲突
- [ ] 测试目标已从 restate + 方案推导，覆盖每条 Success Criteria
- [ ] 可测性约束已标出（需要 mock 的依赖、难测的部分）
- [ ] 调了 design-doc-writing 写设计文档（含测试目标）
