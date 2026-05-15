# Design Doc（Detailed Design Document）

详细设计文档——回答 **"how will we build this?"**，工程团队实施前的 alignment。

## 何时用 Design Doc

- 实施前对一个 feature / system / 改造进行详细设计
- 工程团队内部 alignment（不像 RFC 那样跨团队）
- 需要在写代码前讨论 trade-offs
- **不是** 单一架构决策（用 ADR）
- **不是** 产品需求（用 PRD）

## 骨架

线性递进，无元结构标签。详细写作要点见 SKILL.md《写作准则》。

```
## 背景            (核心痛点 + 主因/辅因划分)
## 目标            (本 doc 要达成什么)
## 架构
### 架构图         (ASCII，可选)
### 流程图         (ASCII，可选)
### 问题拆解
#### 问题一 <名字>
说明：...
方案对比：...
结论：...
#### 问题二 ...
### 架构总结       (把各问题结论串成整体决策一段话)
## 实现
### 影响文件
   <多模块 ASCII 树，文件后标 (改)/(NEW) + ① ② ③ 改动要点>
### 逻辑一 <名字>  (默认对应 架构.问题一)
**业务流**       (类名 + 伪代码 主路径)
**关键契约**     (public 方法签名 / 字段 / 状态)
**异常与失败模式**  (本逻辑特有异常，含场景/触发/处理/上抛吞)
### 逻辑二 ...
```

**关键约束**：

- 「架构.问题拆解」每个问题对应「实现.逻辑 X」一条，命名引用；允许"细节性逻辑"独立成节但须在节首说明
- 「实现.逻辑 X」内部并列三子节（业务流 / 关键契约 / 异常与失败模式）；reviewer 评估单个逻辑不跳节
- 不再有 TL;DR / Non-Goals 必填 / Cross-cutting Checklist 必填 / 全局 Alternatives / 全局 Trade-offs 等硬约束——相关信息已分散到各问题的"方案对比 + 结论"
- 「实现」节止于伪代码 + 公共契约 + 异常；class 内部、TDD 步骤、具体 catch 块写法**留给 plan**

## 各节写作要点

### 背景

回答**为什么这件事值得做**。列具体痛点，**显式标出主因 vs 辅因**——不要平铺 5 条 bullet 让读者自己排序。

不要复述用户原 prompt；不要写"现状描述"流水账。痛点要具体到 file path / metric / bug ID / 行号 / 真实场景。

### 目标

本 doc 要达成的终态。可量化最好（"P99 < 200ms"、"配置时间从 30 min 降到 5 min"）。

不允许"灵活、可扩展、易维护"凑数。

### 架构

#### 架构图 / 流程图

可选。ASCII 形式。**总分两层**：

- **总图**（本节）：聚焦组件关系（架构图）/ 主链路（流程图），让 reviewer 30 秒 grasp 全局。**组件 ≤ 7，流程节点 ≤ 10**——超了说明本层过载，应该把细节下沉到子图
- **子图**（在「问题 X」节下）：单一问题如果有局部交互细节 / 状态机 / 多分支，纯文字读不下去时画——见下方「问题拆解」节

简单设计可整个跳过两层。

#### 问题拆解

**核心节**。把架构层的设计决策拆成 N 个具体问题，每个问题独立讨论：

```
#### 问题一 <名字>
说明：这是什么问题、为什么需要回答
方案对比：方案 A / B / C 的关键差异（trade-off）
结论：选 X，因为 Y（具体否决其他方案的理由）
**子图（如需）**：本问题的局部状态机 / 子流程 / 局部交互
```

**子图触发判据**（不强制——简单问题不画）：

- 问题"结论"段写完后回看，reviewer 要在脑里画一个状态机或 sequence 才能懂 → 加子图
- 问题涉及 3+ 张力同时拍板（如"session + SLO + fallback"合并） → 加子图
- 单问题方案对比涉及多分支跳转（A 通向 X、B 通向 Y） → 加子图

反之：单 schema 表 / 单纯文字论证 / 单层算法选择 → 不画

数量取决于复杂度——简单设计 1-2 个，复杂系统 4-6 个。**3 个以上就该 review 是否过度拆**。

#### 架构总结

一段话把各问题的结论串成整体决策："基于问题 1-N 的结论，整体架构为……"。承接「实现」节。

### 实现

#### 影响文件

ASCII 树 + (改)/(NEW) + 编号要点。**路径完整到包名**，不缩略。同一文件多改动用 ① ② ③ 编号。详见 SKILL.md《影响文件节硬格式》。

#### 逻辑 X

每条逻辑并列 3-4 子节：

- **业务流（必须是伪代码）**：用 `function`/`method` 签名 + 函数体行写出主路径 + 异常路径。停在"足以让 reviewer 判断设计合理"的粒度，不进 class 内部细节。**不是文件结构树、不是层次列表、不是散文描述**——文件层次属于「影响文件」节。
- **关键契约**：新引入或修改的类的 public 方法签名、关键字段、对外状态。
- **异常与失败模式**：本逻辑特有异常的表格——场景 / 触发条件 / 处理方式 / 上抛 or 吞。
- （仅细节性逻辑）**实现选择**：非显然的实施层决策（用了 visitor / Strategy / pattern X），1-3 段说选了什么 + 为什么。超 3 段就升格到架构.问题拆解。

业务流伪代码示例（**每行必带 `//` 注释**——小黄鸭式讲解，不假设读者懂）：

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

数字 / 阈值出现在伪代码或注释里时，必须**注明来源**（如 `// HOLD_SIZE=64，来源：最长入口点 30 字符 + chunk 容差`），不允许 magic number。

跨多逻辑共享的异常（如"权限不足在所有调用都可能"）——单开一条「逻辑：权限校验」处理，归到细节性逻辑。**不立"全局异常基线"节**。

## 状态机

```
draft → in-review → approved → implemented → archived
```

注：design doc 是 **living document**——approved 后实施中仍可修改（反映实际实施变化），完成后归档。

与 ADR 不同：ADR 一旦 accept 就 immutable，design doc 允许 in-place 修订。

## frontmatter

```yaml
---
type: design-doc
topic: <一句话讲设计>
date: YYMMDD
author: <username>
status: draft   # draft | in-review | approved | implemented | archived
last_updated: YYMMDD   # 实施中修订时更新
---
```

无 `layer` 字段——新骨架下「架构」与「实现」是内置二级节，覆盖深度由 writer 在「问题拆解」节数 + 「逻辑 X」详细度调节，不需要 frontmatter 显式声明。

## 长度参考

5-15 页常见；小改动 2-3 页；系统级 10-20 页。超过 20 页考虑拆分。

## 写作纪律

- 「背景」必含主因/辅因划分
- 「架构.问题拆解」每问题必含 说明 / 方案对比 / 结论 三件套
- 「实现.逻辑 X」必含 业务流 / 关键契约 / 异常与失败模式 三子节
- 影响文件 ASCII 树带 (改)/(NEW) + 编号要点 + 行号 / 函数名（能给则给）
- 不写 TL;DR / 上半 / 下半 / Cross-cutting Checklist
- 不把 plan 内容（class 内部 / TDD 步骤）塞进 design doc
