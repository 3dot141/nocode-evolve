# Reference: prerequisites (前置假设锚点)

前置假设 reference——把"runner / 基础设施 / 依赖"这种**实施前必须明确的底层假设**集中在一节，避免散落到各业务流（BF1/BF2/...）或方案选型节里反复说。

> 本 reference 是 `dev-design-refine` 的**可选增强**——适合实施依赖外部基础设施 / 待开发能力的 design-doc。与 doc-type 主轴正交（Design Doc / RFC 类型可在「目标」节后加 prerequisites 锚点节）。**不替代 doc-type 选择**。

## 何时用这张卡片

**强烈推荐**：
- 评测体系 / runner / pipeline——需要明确"trace 怎么拿、agent 怎么启动、数据集怎么准备"
- 新建模块依赖外部基础设施（DB / cache / message queue / 其他服务）
- 实施依赖未上线的能力（待开发的 API / 待迁移的 schema）

**不要用**：
- 已有完整基础设施的 feature 类设计（就是改改业务逻辑）—— 没有"前置"问题
- 单纯的算法优化 / refactor

## 为什么需要这个锚点

reviewer 反复指出的痛点：「trace 怎么拿？」「agent 怎么启动？」「workspace 怎么准备？」—— 这些不是设计问题，是**实施基底问题**。

如果散落到各业务流（BF1/BF2/...）里：
- 每个 BF 都要重复说"trace 来自 LangChain callback"
- 用户读 BF 时被基底说明打断
- 基底说明和 BF 业务逻辑混在一起，难抽离

`prerequisites` reference 集中讲：每条假设独立成节，明示"这是实施前必须定的基底，不属于设计决策"。

## 输出骨架

放在 `## 目标` / `## 骨架` 之后、`## 架构` 之前：

```markdown
## 前置假设

实施前需先明确以下基础设施假设；这些是 <runner/系统> 跑通的前提，不是评测算法本身但缺了就动不了。

### 假设 1：<topic>（回应 SAx / Wx）

<现状描述：项目里这块基础设施目前是什么状态>

**v1 方案**：<具体怎么做，含技术选型 + 关键 schema>

```code
关键代码 / schema 示例
```

### 假设 2：...

### 假设 N：...
```

## 填充规则

1. **每条假设独立成节**（H3）—— 命名按"它解决什么基底问题"
2. **必含「v1 方案」**：明示"这是 v1 起步选择，不是终态"
3. **可选「替代方案」+「为什么不选」**：如果有多个候选，简短列出
4. **可选「与 reviewer 反馈的对应」**：reviewer 指出过 SAx/Wx 时，节标题或末尾标注"回应 SAx"
5. **关键 schema / 代码片段**：写假设时如果涉及 schema 或调用链，给一段示例代码——让实施者一眼看到"该用什么字段"

## 例子（评测体系前置假设）

```markdown
## 前置假设

实施前需先明确以下基础设施假设；这些是 runner 跑通的前提，不是评测算法本身但缺了就动不了。

### 假设 1：trace / API 字段如何获取（SA2）

editor 实际经过 LangChain wrapper 调 Anthropic SDK，原始 `usage.cache_read_tokens` 等字段需要在 LangChain callback 层旁路截获。

**v1 方案**：新建 `traceCollector.ts` 实现 LangChain `BaseCallbackHandler`，在 `handleLLMEnd` 钩子里把原始 `LLMResult.llmOutput` 完整 dump 到自建 trace 对象。

自建 trace 对象 schema（与 LangGraph checkpoint **独立**）：

\```ts
interface EvalTrace {
  startAt: number;
  firstTokenAt: number;
  endAt: number;
  iterations: ReActIteration[];
  toolCalls: ToolCall[];
  apiResponses: RawLLMOutput[];
  lastAssistantMessage: string;
}
\```

### 假设 2：评测环境如何启动 agent（SA3）

editor 装配需要 `tenantId / userId / projectId / fineAuthToken`。

**v1 方案**：用 `eval-tenant / eval-user` 固定 mock 账号；`fineAuthToken` 用本地开发环境 token；每个 case 通过 `workspace-fixture.ts` 注入数据集为 `.table` 资源；case run 完后清理 workspace。
```

## 关键约束

- **位置**：在 `goal` / `quick-view` 之后、`architecture` 之前——不要放到「实现」节（太晚）
- **数量**：3-6 条假设最合适。超过 6 条 = 设计还没收敛，先回去 brainstorming
- **不展开实施细节**：「v1 方案」给方向 + 关键 schema 即可，具体代码留给 plan
- **明示是 v1 默认值**：每条假设都标"v1 方案"——读者知道这不是终态

## 反例

❌ **没有 v1 方案，只列问题**：「假设 1：trace 怎么拿？还没定」—— 这归 Open Questions / 「方案选型」节里的「未决决策」处理，不是 `prerequisites`
❌ **过度展开**：每条假设写 3 屏 schema —— 留给 plan 或独立 ADR
❌ **把设计决策塞进来**：「假设 2：rubric 按客观/主观切」—— 这是设计决策，归「方案选型」节

## 与 design-doc 主轴章节的关系

- 上游：「背景」（why this matters）+「目标」（what we want）
- 下游：「实现」节的业务流（BF1/BF2/...）可以引用前置假设的字段（不需要再说"trace 从哪里来"）
- 平级：Open Questions / 「方案选型」节的「未决决策」处理"还没定的事"，`prerequisites` 处理"已经定了的实施基底"——两者互补不重叠

> 与 `references/doc-types/design-doc.md` 主骨架的关系：prerequisites 插在「目标」与「架构」之间（如有 `quick-view` 锚点节则在其后）作为**实施基底锚点节**，让「架构」与「实现」节可直接引用其字段。
