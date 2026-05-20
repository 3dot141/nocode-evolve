# Design Doc (Detailed Design Document)

详细设计文档——回答 **"how will we build this?"**, 工程团队实施前的 alignment.

## 何时用 Design Doc

- 实施前对一个 feature / system / 改造进行详细设计
- 工程团队内部 alignment (不像 RFC 那样跨团队)
- 需要在写代码前讨论 trade-offs
- **不是** 单一架构决策 (用 ADR)
- **不是** 产品需求 (用 PRD)

## 骨架

线性递进, 无元结构标签. 详细写作要点见 SKILL.md《写作准则》.

```
## 背景            (核心痛点 + 主因/辅因划分)
## 目标            (本 doc 要达成什么, 可量化最好)
## 架构
### 架构图         (ASCII, 可选 — 组件静态依赖)
### 流程图         (ASCII, 可选 — 单一链路串行)
### 时序图         (ASCII, 可选 — 多角色异步/RPC 协作)
### 文本总结       (一段话讲整体架构决策, 承接「实现」)
## 实现
### 影响            (多模块 ASCII 树 + (改)/(NEW) + ①②③ 改动要点)
### 接口设计        (关键签名/字段/状态 + 类图 [多类协作时画])
### 业务流          (按 BF1/BF2/... 编号, 每条 = 类名 + 伪代码 主路径+异常路径, 每行 // 注释)
### 异常与失败模式   (表: 所属 BF / 场景 / 触发 / 处理 / 上抛吞)
### 单测设计        (按 BF 分组列 case, Given/When/Then 三行/case)
## 方案选型         (重大决策的沟通记录, 每项 Q→选项→定 三行)
## 其他
### 部署            (灰度策略 / 回滚预案 / 监控指标; 详细 runbook 留给 ops doc)
```

**关键约束**:

- 实现 5 子节按维度拆 (影响 / 接口设计 / 业务流 / 异常 / 单测设计), 不再按"逻辑 X 三件套"分块. **业务流统一用 BF1/BF2/... 编号**, 异常表与单测节通过 BF 编号交叉引用, reviewer 读异常表能找到对应业务流.
- 「实现.接口设计」按面分 3 段 (按需): **对外 API** (HTTP/RPC, 前后台对接) / **数据模型** (DB schema + 多表关联画 ER 图) / **内部接口** (类签名 + 类图). 简单设计可省任一段; 涉及前后台对接必有对外 API 段, 涉及多表关联必画 ER 图.
- 「架构.文本总结」必须有 — 把图的视觉信息文字化, reviewer 不该靠看图猜架构.
- 「实现.业务流」必须伪代码 (function/method 签名 + 函数体行), 不是文件结构树、不是层次列表、不是散文; 文件层次属「影响」节.
- 「实现.单测设计」按业务流主路径+异常路径列 case, **不写代码** (不写 `@Test` / mock setup / assertion 语法); TDD 步骤化清单留给 plan.
- 「方案选型」每项 Q→选项→定 三行紧凑, 不展开 trade-off 长论证; 需要详细论证升格写 ADR.
- 「其他.部署」只写策略 (灰度比例 / 回滚条件 / 关键监控指标), 具体命令 / K8s manifest / Ansible playbook 留给 ops doc 或 plan.

## 各节写作要点

### 背景

回答**为什么这件事值得做**. 列具体痛点, **显式标出主因 vs 辅因**——不要平铺 5 条 bullet 让读者自己排序.

不要复述用户原 prompt; 不要写"现状描述"流水账. 痛点要具体到 file path / metric / bug ID / 行号 / 真实场景.

### 目标

本 doc 要达成的终态. 可量化最好 ("P99 < 200ms"、"配置时间从 30 min 降到 5 min").

不允许"灵活、可扩展、易维护"凑数.

### 架构

#### 架构图 / 流程图 / 时序图

可选. ASCII 形式. **总分两层**:

- **总图** (本节): 聚焦组件关系 (架构图) / 主链路 (流程图) / 跨角色交互 (时序图), 让 reviewer 30 秒 grasp 全局. **组件 ≤ 7, 流程节点 ≤ 10, 时序角色 ≤ 5**——超了说明本层过载, 拆细节到子图.
- **子图** (在「实现.业务流.BFx」节下): 单条业务流如果有局部状态机 / 多分支 / 详细 sequence, 纯文字读不下去时画.

三种图选用:

- **架构图** — 组件间静态依赖. 例: `[Gateway] → [Auth] → [Service] → [DB]`. 触发: 新增 / 调整模块边界
- **流程图** — 单一请求从输入到输出的串行决策. 例: `input → 校验 → 路由 → 处理 → 输出`. 触发: 多分支判断 / 状态转换
- **时序图** — 多角色随时间的消息往复. 例: 客户端 / 服务端 / DB 的请求-响应序列. 触发: 异步 / RPC / 跨服务 / 多角色协作

简单设计可整个跳过三层.

#### 文本总结

一段话把图的视觉信息**文字化成整体决策**, 承接「实现」节. 不要让 reviewer 自己从图里推断架构.

格式建议: "整体架构为 X. 关键组件 A/B/C 各负责 Y/Z/W, 通过 [机制 P] 协作. 核心约束: [一两条]."

### 实现

#### 影响

ASCII 树 + (改)/(NEW) + 编号要点. **路径完整到包名**, 不缩略. 同一文件多改动用 ① ② ③ 编号. 详见 SKILL.md《影响节硬格式》.

#### 接口设计

新引入或修改的**对外暴露面**, 按面分 3 段 (按需展开, 简单设计可省任一段):

##### 对外 API (前后台对接 / 跨服务)

HTTP / RPC / GraphQL 接口, 给前端 / 移动端 / 上游服务调. 用表格式列出:

| Method | Path | Request | Response | 错误码 | 备注 |
|---|---|---|---|---|---|
| POST | `/sso/callback` | `samlResponse: string, relayState: string` (form) | 302 + Set-Cookie JWT | 401 SAML 验证失败 / 302 fallback | 涉及 BF1 |
| POST | `/mfa/verify` | `{userId, code}` | `{success: bool, token?: string}` | 401 错码 / 423 锁定 | 涉及 BF4 |

或 OpenAPI / proto 片段, 但只列**关键端点**——不抄全 spec.

**硬规则**:
- 涉及**前后台对接 / 跨服务调用**必须有本段 (业务流伪代码里出现的 endpoint 必须在此汇总)
- 鉴权方式必须标 (JWT cookie / Bearer / API key)
- 关键错误码必须列 (≠ "see error response")
- 详细 OpenAPI 完整 spec → 留给独立 API doc, 本段只列骨架

纯内部库 / 无对外接口的重构 → 本段可省, 一行写"无对外 API 变更".

##### 数据模型 (DB schema + 表关联)

DDL + 表关联视图. 单表用 `CREATE TABLE` 列字段 + 索引 + 约束:

```sql
CREATE TABLE user_identities (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    idp_provider    VARCHAR(64) NOT NULL,
    external_id     VARCHAR(255) NOT NULL,
    UNIQUE (idp_provider, external_id),
    UNIQUE (user_id, idp_provider)
);
```

多表关联时**必须画 ER 图** (ASCII), 让 reviewer 一眼看清外键关系:

```
   users                  user_identities                organizations
+-----------+         +--------------------+          +---------------+
| id (PK)   |◄────────┤ user_id (FK)       │          | id (PK)       |
| email     |    1:N  | idp_provider       │          | name          |
| name      |         | external_id        │      ┌──►| sso_enabled   |
+-----------+         | organization_id(FK)├──────┘   +---------------+
                      | status             │  N:1
                      +--------------------+
                      UNIQUE(idp_provider, external_id)
                      UNIQUE(user_id, idp_provider, organization_id)
```

**硬规则**:
- 涉及**多表外键关联**必须有 ER 图; 单表 schema 可不画
- 关键索引 + UNIQUE 约束必须标 (隐式约束容易被 reviewer 漏看)
- 迁移涉及 breaking change (改类型 / 删字段) 必须显式标记 + 在「方案选型」加一项 Q (rollback 策略)
- 详细 migration 脚本 (Flyway / Liquibase) → 出现在「影响」节文件树, 不抄进本段

纯内存计算 / 无 DB 变更的重构 → 本段可省.

##### 内部接口 (类 / 模块签名 + 类图)

新引入或修改的类 / 模块的 public 方法签名 + 关键字段 / 状态 + 类图.

```java
class SamlHandler {
    Response handleSsoInit(String orgId, String relayState);
    Response handleSsoCallback(String samlResponse, String relayState);
}
class JwtIssuer  { String issue(User user); }
```

**类图触发**: 涉及 ≥3 个新类协作 / 有继承层次 / 有 Visitor / Strategy / Observer 等需要静态视图才说清的 pattern. 单类或纯函数式逻辑不画.

类图示例:

```
+------------------+        +---------------------+
|  AgentLoop       |--uses->| ContentSanitizer    |
+------------------+        +---------------------+
        |                            ^
        | throws                     | implements
        v                            |
+------------------+         +---------------------+
| OutputViolation- |         | NinesContent-       |
| Exception        |         | Sanitizer           |
+------------------+         +---------------------+
```

#### 业务流

按 **BF1 / BF2 / ...** 编号, 每条 BF 对应一条核心业务路径. 每条业务流用 `function`/`method` 签名 + 函数体行写出主路径 + 异常路径. 停在"足以让 reviewer 判断设计合理"的粒度, 不进 class 内部细节 (后者留给 plan).

**业务流伪代码硬规则**:

- 必须 `function` / `method` 签名 + 函数体行 (每行一句意图)
- **每行都要有 `//` 注释** — 小黄鸭式讲解, 不允许"显然". 简单流程注释可短, 复杂逻辑 / 数字阈值必须讲来源
- 命名用真实类名 / 方法名 (如 `AgentLoop.callLlmForTurn`), 不用 placeholder
- 涉及数字 / 阈值时注释里讲清来源 (如 `// HOLD_SIZE=64, 来源: 最长入口点 30 字符 + chunk 容差`)

格式示例:

```markdown
**BF1 — LLM 一轮对话含 sanitizer 重试**

function AgentLoop.callLlmForTurn(messages, ctx):        // 完成一轮 LLM 对话, messages 已含历史
    try:
        return callLlmOnce(messages)                     // 正常调 LLM 一次返回响应
    catch OutputViolationException as e:                 // 业务异常: sanitizer 检测到 DSL 泄漏抛的
        log.warn("DSL violation: {}", e.type)            // 记录违规类型, 便于事后追溯
        messages.add(buildCorrection(e.releasedTail))    // 把"已流出尾部"塞进新一轮 prompt
                                                          // 让 LLM 知道用户屏幕停在哪、好接着写
        return callLlmOnce(messages)                     // 重新调一次 LLM, 让它改写
    catch (ReasoningLengthExceeded | TimeOut) as e:      // 系统异常 (长度超 / 超时)
        throw e                                           // 不在本逻辑 scope, 上抛给外层处理

**BF2 — sanitizer 滑窗扫描**
...
```

跨多业务流共享的横切逻辑 (如"权限校验在所有调用都先跑") — 独立成 BF, 命名暗示其性质 (如 BF0 — 权限预检).

#### 异常与失败模式

汇总表, 含 **所属 BF** 列, 让 reviewer 从业务流追到异常:

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | OutputViolationException | sanitizer 检测到 DSL 入口点 | log + 注入 correction prompt 重试一次 | 吞 (重试成功) / 上抛 (重试仍违规) |
| BF1 | ReasoningLengthExceeded | LLM 上下文超长 | 不处理 | 上抛 |
| BF2 | SanitizerOverflowException | 滑窗满 + 入口点匹配 | 截留尾部, 抛 OutputViolation 让 BF1 处理 | 上抛 |

跨多 BF 共享的异常 (如"网络超时所有调用都可能") — 加单独一行, "所属 BF" 列填 "BF1-BF3 共享".

#### 单测设计

按 BF 分组, 每组下列 case. 每条 case 用 **Given / When / Then** 三行写, **不写代码** (不写 `@Test` annotation / mock setup / assertion 语法):

```markdown
**BF1 — LLM 一轮对话含 sanitizer 重试**

- **case 1.1 主路径**
  - Given: messages 已含历史, ctx 正常, LLM 输出不含 DSL 入口点
  - When: callLlmForTurn 被调
  - Then: 返回 LLM 响应, callLlmOnce 被调 1 次

- **case 1.2 DSL 违规重试成功**
  - Given: messages 已含历史, LLM 首次输出含 `Query.from(`, 第二次输出干净
  - When: callLlmForTurn 被调
  - Then: callLlmOnce 被调 2 次, 第二次 messages 多了 buildCorrection 内容, 返回干净响应

- **case 1.3 DSL 违规重试仍失败**
  - Given: LLM 两次输出都含 DSL 入口点
  - When: callLlmForTurn 被调
  - Then: 第二次 OutputViolationException 上抛
```

颗粒度准则:

- **必须覆盖**: 每条 BF 的主路径 + 每个异常分支 (异常表里出现的每行)
- **可省**: 内部分支细节 (private 方法的 if/else)
- **不写代码**: 不写 `@Test` / mock 工具具体 API / assertion 语法 — TDD 步骤化清单 (先写哪个 test 再写哪段实现) 留给 plan

### 方案选型

把设计过程中的**重大决策**用 Q→选项→定 三行模板沉淀, 给 reviewer 看"为什么是这个方案而不是别的". 不在这里展开 trade-off 长论证, 只留**沟通记录**.

格式:

```markdown
### Q1: <一句话问题>
**选项**: A (一句话特征) vs B (一句话特征) vs C (一句话特征)
**定**: 选 X. 因 Y (一句话否决其他的理由).
```

数量按设计复杂度——简单 1-2 项, 复杂 4-6 项. **6 项以上 review 是否过度记录** — 微小决策不必入档.

如果某项 Q 需要详细论证 / 多张力对比 / 局部状态机 — 升格写成独立 ADR (新文档 + supersede 链接), 不在本节膨胀.

示例:

```markdown
### Q1: sanitizer 用滑窗还是状态机?
**选项**: 64 字符滑窗 (实现简单, 可能漏长入口点) vs 状态机 (准, 但代码量 3x)
**定**: 滑窗. 因实测最长入口点 30 字符, 64 字符容差覆盖 99.7% case; 漏的 case 走异常上抛回退, 不阻塞主路径.

### Q2: 违规重试几次?
**选项**: 不重试直接上抛 / 重试 1 次 / 重试到成功
**定**: 重试 1 次. 因 LLM 二次纠错命中率 ~85% (依据: 实测 200 次违规样本), 多次重试边际收益低且拖延响应.

### Q3: messages 传值还是传引用?
**选项**: 传值 (每轮 deep copy 安全) vs 传引用 (省内存但要小心 mutation)
**定**: 传引用. 因 LLM 消息历史可能上 KB, deep copy 每轮翻倍 GC 压力; mutation 通过 `messages.add` 单点收口管控.
```

### 其他

#### 部署

策略性决策, 不是详细 runbook:

- **灰度策略**: 比例 / 分组 / 时长. 例: "1% → 24h → 10% → 24h → 50% → 24h → 100%, 按用户 ID 哈希分组"
- **回滚预案**: 触发条件 + 回滚操作. 例: "P99 > 500ms 持续 5 min 或 5xx 率 > 1% → 自动回滚到 v1.2.3, runbook 见 `ops/rollback-AgentLoop.md`"
- **监控指标**: 新增的 metric 名 + 阈值. 例: "metric: `agent.sanitizer.violation_rate`, 阈值 > 5% 触发 PagerDuty P2"

详细 runbook (具体命令 / K8s manifest / Ansible playbook) 留给 ops doc 或 plan.

可省: 无部署变更的纯库内重构 — 一行写 "无部署变更" 即可.

## 状态机

```
draft → in-review → approved → implemented → archived
```

注: design doc 是 **living document** — approved 后实施中仍可修改 (反映实际实施变化), 完成后归档.

与 ADR 不同: ADR 一旦 accept 就 immutable, design doc 允许 in-place 修订.

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

## 长度参考

5-15 页常见; 小改动 2-3 页; 系统级 10-20 页. 超过 20 页考虑拆分.

## 写作纪律

- 「背景」必含主因/辅因划分
- 「架构.文本总结」必须有 — 把图的视觉信息文字化, reviewer 不该靠看图猜架构
- 「实现」5 子节顺序固定: 影响 → 接口设计 → 业务流 → 异常 → 单测设计; 子节名不可改
- 「实现.接口设计」按面分 3 段 (按需): 对外 API / 数据模型 / 内部接口; 涉及前后台对接必有「对外 API」段, 涉及多表关联必有「数据模型.ER 图」
- 「实现.业务流」必须 BF 编号 + 伪代码 + 每行 `//` 注释
- 「实现.异常与失败模式」表必须含 "所属 BF" 列, 与业务流编号对齐
- 「实现.单测设计」必须按 BF 分组 + Given/When/Then 三行/case, 不写代码
- 「方案选型」每项必须 Q→选项→定 三行, 不展开长论证
- 「其他.部署」只写策略 (灰度 / 回滚 / 监控), 不写命令脚本
- 不写 TL;DR / 上半 / 下半 / Cross-cutting Checklist / 全局 Alternatives / 全局 Trade-offs
- 不把 plan 内容 (class 内部 / TDD 步骤 / 具体 catch 块写法) 塞进 design doc
- 不把 ops doc 内容 (具体 K8s manifest / Ansible playbook) 塞进部署节
