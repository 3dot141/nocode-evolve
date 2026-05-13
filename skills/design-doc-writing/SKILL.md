---
name: design-doc-writing
description: 写设计文档时使用。按业界主流 4 类 doc-type 主轴（PRD / RFC / Design Doc / ADR）选合适类型，每个 doc-type 有自己的"背景→...→后果"线性骨架。工作流含 write → review 循环（spawn design-doc-reviewer subagent，用户逐条确认）。当 superpowers:brainstorming 走到「写设计文档」环节时调用本 skill；当用户要求「写设计文档 / RFC / ADR / 提案 / 架构记录 / 重构方案 / 系统设计」时也用。即使用户没说"用模板"，只要要做的事是产出一份正式的设计性文档，就该用本 skill。不要用本 skill 写代码注释 / PR 描述 / commit message / README / changelog。
---

# 设计文档写作

把"已经讨论清楚的设计"落地成结构化的 markdown 文档。不负责讨论（brainstorming 的事），不负责实施（writing-plans / executing-plans 的事）——只负责**写**。

工作流：write → review → 用户逐条确认 → 修订 → 追加 Review Log。reviewer 只列问题，**不自动循环修订**——是否修、修哪些由用户决定。

## 何时使用

**应该用：**

- superpowers:brainstorming 走到 step 5（写设计文档）时
- 用户说「帮我写个 PRD / RFC / 设计文档 / ADR / 重构方案 / 系统设计 / 架构记录 / 提案」
- 你即将创建 `*-design.md` / `*-prd.md` / `*-rfc.md` / `*-adr.md` 性质的文件

**不要用：**

- 写代码注释、PR 描述、commit message、README、changelog
- 用户只是问「X 应该怎么做」——这是讨论阶段，先用 brainstorming
- 简单 bug 修复（用 superpowers:debugging）

## 输出路径

由 `rules/overlay-superpowers.md` 与 `rules/agent-about.md` 共同定义，默认：

```
docs/plans/{username}/yymmdd-<topic>-design.md
```

写之前确认 rule 当前值。

## 选 doc-type

设计文档分 4 类，按**这份文档主要回答什么问题**选：

| 任务特征 | doc-type | 主要回答 | 长度 |
|---|---|---|---|
| 产品 / feature 立项，定义需求 | `prd` | what + why（用户痛点 + 目标） | 1-2 页 |
| 跨团队提案，需收 feedback | `rfc` | Is this right direction? | 3-10 页 |
| 实施前详细设计 | `design-doc` | How to build? | 5-15 页 |
| 单一架构决策记录 | `adr` | Why we decided X? | 1-2 页 |

选不准时优先 `design-doc`——最通用且最 detailed。

## 各 doc-type 骨架（速记）

详见 `references/doc-types/<type>.md`。线性递进，无元结构标签：

- **design-doc**：背景 → 目标 → 架构（架构图 / 流程图 / 问题拆解 / 架构总结）→ 实现（影响文件 / 逻辑 X）
- **PRD**：背景 → 目标 → 用户场景 → 验收标准
- **RFC**：背景 → 目标 → 提案（问题拆解 + 总结）→ 影响评估 → 开放问题
- **ADR**：背景 → 决策（说明 / 方案对比 / 结论）→ 后果

## 工作流

```
1. 判断 doc-type（按上表）
2. Read references/doc-types/<type>.md（学骨架 + 写作要点）
3. Read references/examples/example-<type>.md（看真实示例）
4. 写初稿
5. Dispatch reviewer subagent（接通方式：`general-purpose` + template）：
   a. Read `skills/design-doc-writing/references/reviewer-template.md`
   b. 把模板内容里的 `{DOC_PATH}` 替换为当前文档路径
   c. 调用 Task tool（subagent_type=`general-purpose`，description=`"Review design doc"`，prompt=上一步替换后的全文）
   d. subagent 返回 Review Report 后进入 step 6
6. 用户确认环节（核心 gate，见下方）：
   - 默认：把 Report 完整呈现给用户，每条问题前编号，**逐条让用户勾选** fix / skip
   - 用户可一键说「全修 Critical+Warning」「全跳过」「我来给指示」走捷径
   - reviewer 已 ✅ Pass：跳过此步直接进 step 10
7. 据用户决定修订文档（in-place 改主体）；不在用户清单里的问题**不要顺手修**
8. 把本轮 Report 全文 + 用户决定 + 修订摘要 append 到文档末尾 `## Review Log`（无则新建）
9. 询问用户「再来一轮 review？」
   - 是 → 回 step 5
   - 否 → 进 step 10
10. 保存到输出路径
11. (by overlay) 调 design-doc-rendering skill 出 HTML
```

## 用户确认环节（step 6 细则）

reviewer 输出 Report 后，**不要自己挑哪些修哪些不修**。把决定权交给用户：

1. 把 Report 原样展示给用户（Critical / Warning / Suggestion 三档保留）
2. 给每条问题一个**短编号**（`C1 / C2 / W1 / S1 ...`），方便用户引用
3. 用 AskUserQuestion 或文字 prompt 让用户选：
   - 默认多选：勾选要修的编号
   - 提供快捷选项：「全修 Critical+Warning」「全跳过」「自由指示」
4. 用户确认前**不要动文档主体**——只能等

例外：reviewer Verdict 是 ✅ Pass 时跳过这一步，直接进 step 10。

## Review Log 格式

写到设计文档末尾，每轮 review 追加一条：

```markdown
## Review Log

### Review 1 — 2026-05-12

<!-- Reviewer Report 全文（含 Critical / Warning / Suggestion / Self-Audit / Verdict） -->

**用户决定**：fix C1, C2, W1；skip C3（理由：暂不在 scope）、W2、S1

**本轮修订**：
- C1：架构.问题一 补主因 vs 辅因划分
- C2：实现.逻辑二 加异常子节
- W1：路径补全到包名

---

### Review 2 — 2026-05-12
...
```

Review Log 与文档主体同步演进——主体回答"为什么这样设计"，Log 留下"这份文档怎么演化来的"的审计轨迹。

## 状态机

各 doc-type 状态机：

- **PRD**：`draft → in-review → approved → implemented → archived`
- **RFC**：`open → accepted → implemented → superseded` / `open → withdrawn` / `open → rejected`
- **Design Doc**：`draft → in-review → approved → implemented → archived`（**living**，approved 后仍可修改）
- **ADR**：`proposed → accepted → superseded` / `proposed → rejected` / `accepted → deprecated`（**immutable**，accept 后绝不改）

注：ADR 一旦 accept 不可修改；改决策就写新 ADR + supersede 旧的。

## 写作准则（核心）

理解原则比死守章节更重要。每条附 ✅ 正例 / ❌ 反例。

### 1. 入口段必须自洽

新骨架默认无 TL;DR——文档从「背景」起步即可。
若加了 Summary / TL;DR / 提要 一类入口段，**绝不能引用全文才会出现的概念 / 缩写**——读者读完入口段必须能 grasp 核心，不需回头查。

> ✅「把 design-doc 模板从'上下半结构'改成'背景 → 架构 → 实现'线性骨架。」  
> ❌「把 design-doc 从 layer × intent 双轴改为 doc-type 主轴 + reviewer 跑 humanizer 风格附带检查。」（layer、intent、humanizer 都是文中才出现的术语）

### 2. 章节标题用内容实体，不用元结构标签

「上半」「下半」「Human Review」「Agent Implementation」一律不用——这些是告诉读者"这一节是给谁看的"的标签，消耗注意力但不传递信息。直接用内容实体名：背景 / 目标 / 架构 / 实现 / 决策 / 后果。

> ✅ `## 架构` `## 实现`  
> ❌ `## 上半：Human Review` `## 下半：Agent Implementation`

### 3. 节间承上启下

每节开头一句承接上一节的结论，读者跳读时能 trace 论证链。

> ✅ 架构.架构总结末尾："基于以上 3 个问题的结论，整体架构为 X"；实现节开头："按架构总结，本节展开 X 的 3 条业务流。"  
> ❌ 架构节末尾戛然而止；实现节直接讲第一个文件改动

### 4. pain point 分主次

「背景」节列多条问题时，必须**显式标注主因 vs 辅因**。允许一句话定主因（"核心问题是 X；附带还有 Y、Z"），不允许平铺 5 条 bullet 让读者自己排序。

> ✅「核心问题：每次新会话项目背景丢失。附带的 wiki 缺自动维护、跨项目共享难——本 doc 不解决。」  
> ❌「问题：1. 重复配置 2. 缺一致性 3. 项目记忆丢失 4. 文档质量参差」（4 条平铺，不知道哪条最痛）

### 5. 架构问题 ↔ 实现逻辑 默认 1:1 映射

「架构.问题拆解」每个问题，**默认**对应「实现.逻辑 X」一条业务流，命名直接引用。

允许例外：实现层有架构层未讨论的细节性逻辑（如「内部缓存策略」「事件 dispatch 走 visitor」）——独立成「逻辑 Y」，命名暗示其性质，并在节首一句话说明"本逻辑未在架构讨论，因为是实施层细节"。

> ✅ 架构.问题一: 输出违规怎么拦 → 实现.逻辑一: 输出违规拦截链路  
> ✅ 实现.逻辑三: 内部缓存策略（细节性，未在架构讨论；跨多问题且属实施层）  
> ❌ 架构讨论 3 个问题，实现凭空 5 条逻辑，没说哪条对应哪个问题

### 6. 项目内部术语首次出现 inline 解释

业界通用名词（HTTP / PostgreSQL / TDD / retry / callback）不解释；**项目内自创词或缩写**（dogfood / two-half / humanizer / 自定义 component 名）首次出现必须一句话 inline 解释或链接 glossary，后续可直接用。

> ✅「dogfood（用自己产出的工具实测）本插件历史决策……」  
> ❌ 通篇用 humanizer / layer-supplements 却没告诉读者这是什么

### 7. 小黄鸭式讲解：把每一步的"为什么"讲透

把读者当成完全没看过这个项目的小黄鸭——每个决策、每个跳跃、每个数字都要 explain。遇到「显然」「众所周知」「不言而喻」→ 信号说明跳步了，回去补"为什么"。

数字 / 阈值 / 模块名 / 行号 都要交代来源——不允许 magic number。

> ✅「`HOLD_SIZE = 64` 字符。来源：入口点最长 `NumberFormatConfig.percentage(`（30 字符）+ LLM token chunk 平均 3-5 字符 × 容差 → 64 字符滑窗才能稳定捕获跨 chunk 拼接。」  
> ❌「`HOLD_SIZE = 64`（显然够用）。」

### 8. 费曼式简化：用最简单的话讲复杂概念

如果一句话讲不清楚某个概念，说明你也没真懂——回去搞懂再写。复杂机制用类比 / 简单例子 / 一行伪代码讲明白，**先讲直觉、再补细节**，不要一上来堆术语。

检验：能教一个**从没接触过项目的同事**吗？如果一份 design doc 拿给他读完，他能复述出问题 / 解法 / 权衡 → pass。复述不出来 → 你写得不够清楚。

> ✅「sanitizer 像污水处理栅——chunk 进来先囤 64 字符的桶里；符合 DSL 入口点特征（`Query.from(` 等）的整段丢弃；普通字符 overflow 后正常下游送给 SSE。」  
> ❌「sanitizer 基于 sliding-window heuristic entry-point detection 实现 hold-and-scan 流式预处理管道。」

## 实现的边界：design-doc vs plan

design-doc 的「实现」节止于：

- **业务流（必须是伪代码）**：`function`/`method` 签名 + 函数体行，含主路径 + 异常路径。**不是**文件结构树、**不是**层次列表、**不是**散文描述
- **关键契约**：public 方法签名、关键字段、对外暴露状态
- **异常与失败模式**：每条逻辑特有异常（场景 / 触发 / 处理 / 上抛 or 吞）
- （细节性逻辑）**实现选择**：非显然的实施层决策（visitor / Strategy 等），超 3 段就该升格到架构.问题拆解

**业务流伪代码硬规则**：

- 必须用 `function` / `method` 签名 + 函数体行（每行一句意图）
- **每行都要有 `//` 注释**，讲清"这行干什么 / 为什么这么做"——小黄鸭式讲解，不允许"显然"
- 命名用真实类名 / 方法名（如 `AgentLoop.callLlmForTurn`），不用 placeholder
- 涉及数字 / 阈值时注释里讲清来源（如 `// HOLD_SIZE=64，来源：最长入口点 30 字符 + chunk 容差`）

**对的写法**（每行带注释）：

```
function callLlmForTurn(messages, ctx):              // 完成一轮 LLM 对话，messages 已含历史
    try:
        return callLlmOnce(messages)                 // 正常调 LLM 一次返回响应
    catch OutputViolationException as e:             // 业务异常：sanitizer 检测到 DSL 泄漏抛的
        log.warn("DSL violation: {}", e.type)        // 记录违规类型，便于事后追溯
        messages.add(buildCorrection(e.releasedTail)) // 把"已流出尾部"塞进新一轮 prompt
                                                      // 让 LLM 知道用户屏幕停在哪、好接着写
        return callLlmOnce(messages)                 // 重新调一次 LLM，让它改写
    catch (ReasoningLengthExceeded | TimeOut) as e:  // 系统异常（长度超 / 超时）
        throw e                                       // 不在本逻辑 scope，上抛给外层处理
```

**错的写法**（这是文件层次描述，属于「影响文件」节）：

```
NinesAgent.java
  ├─ setContentStreamHandler 包装
  └─ finally 块 flush
AgentLoop.java
  ├─ instanceof 白名单
  └─ catch + 注入
```

留给 plan（writing-plans skill）：

- class 内部具体实现（私有方法 / 循环 / retry 退避算法 / null 检查）
- TDD 步骤化清单（先写哪个测试 → 再写哪段实现）
- 每步验证命令

**判据**：design doc 让 reviewer 能 challenge "**设计**是否合理"，但不需要"逐行能照抄成代码"。后者是 plan 的工作。

## 「影响文件」节硬格式

多模块 ASCII 树 + (改)/(NEW) + ① ② ③ 编号要点。例：

```
fx-agent-workspace-api/                                ← API 模块
└── src/main/java/com/fanruan/core/agent/workspace/observe/
    └── AgentEvent.java                 (改)  新增 OutputViolation record

fx-agent-workspace/                                    ← impl 模块
└── src/main/java/com/fanruan/core/agent/workspace/agent/
    ├── loop/
    │   ├── OutputViolationException.java   (NEW)
    │   └── AgentLoop.java                  (改)  ① 1802 行 instanceof 白名单加 OutputViolationException
    │                                              ② callLlmForTurn 加 catch
    │                                              ③ 新增 injectOutputViolationCorrection 方法
    └── nines/
        ├── NinesContentSanitizer.java      (NEW)
        └── NinesPrompts.java               (改)  事前防御硬规则
```

要求：路径完整到包名（不缩略）；同一文件多处改动用 ①②③ 编号；行号 / 函数名能给就给。

## 架构图 / 流程图

默认 ASCII，**可选**——内容简单时省略，命名/结构 writer 自决。

mini cheat sheet：

- **组件**：方框 `┌─┐ │ │ └─┘` 或 `+---+`
- **依赖**：`→` 或 `↓`
- **时序流程**：节点 + `↓` 串联
- **粒度**：组件 ≤ 7 个、流程节点 ≤ 10 个，超了拆图或退抽象层

## 常见反模式

- ❌ **入口段堆未定义术语**：读者必须读完全文才懂 TL;DR / Summary
- ❌ **元结构标签作 H2**：上半 / 下半 / Human Review / Agent Implementation
- ❌ **章节戛然而止**：下一节换话题不交代来源——论证链断
- ❌ **pain point 平铺不分主次**：5 条 bullet 让读者自己排重要性
- ❌ **架构问题数 ≠ 实现逻辑数 且无说明对应关系**：reviewer 拼不起 decision-implementation 映射
- ❌ **项目内自创词不解释**：dogfood / humanizer / 双轴 / two-half 通篇出现
- ❌ **plan 内容塞 design doc**：class 内部循环 / TDD 步骤 / 具体 catch 块写法
- ❌ **影响文件不给行号 / 函数名 / 改动编号**：reviewer 不知道哪一处具体改
- ❌ **章节空话**：「需要保证安全性、性能」「值得一提」「未来可扩展」
- ❌ **跳过 reviewer**：不 spawn reviewer 直接交付
- ❌ **代用户拍板**：拿到 Report 自己挑修——用户确认是 hard gate
- ❌ **吞 Review Log**：只 in-place 改主体不 append——审计轨迹断
- ❌ **混淆 doc-type**：PRD 写 SQL schema / ADR 写百页 implementation / Design Doc 写不到 1 页

## 看 examples 不要自由发挥

每个 doc-type 在 `references/examples/example-<type>.md` 有完整真实示例（dogfood 本插件历史决策）。**先看 example 学结构，再按 doc-type reference 填内容**——比自由发挥可靠得多。
