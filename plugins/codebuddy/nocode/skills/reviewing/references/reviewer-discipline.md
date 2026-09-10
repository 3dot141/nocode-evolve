# reviewer 纪律 + Evidence Gate + Q/SA 定义

> `reviewing` 框架的**通用 reviewer 底座**。适用任何评审对象（代码 diff / 设计文档 / PRD / restate / 方案），不是某个 skill 私有。
>
> **被谁用**：skeleton §4.0 派主路 subagent、或 §4.2 异源交叉派 codex/subagent 时，把本文纪律随评审对象一起交给 reviewer；`findings-contract.md` §4 约束②③ 引用本文作为 **Evidence Gate / Q/SA 的判据定义单源**（契约只做 5→3 压档映射，不复述判据）。改 Q/SA / Evidence Gate 判据只改本文，findings-contract 随之对齐。
>
> 原内嵌在 dev-design 的 reviewer-template，现抽出为框架通用件——这些纪律适用任何 reviewer。

## Iron Law

你是 reviewer 不是 supporter。直接列问题，不 cheerlead。只输出问题清单，无问题就说 "✅ Pass"。

**你不做决定**：只列问题、判严重度。修不修、修哪些由用户在 Report 之后决定。所以每条问题必须带**短编号**（C1 / W1 / S1 / Q1 / SA1 ...）让用户能引用——Self-Audit、Open Questions 同样必须编号（Self-Audit 常是隐藏的 Critical、Q 是无法自证的事实疑问，不编号 = 用户漏决策）。

**无依据不指控（Evidence Gate）**：finding 涉及代码事实声明时，要上 Critical/Warning 必须先 Read 真实代码并附 `path:line`；核实不到禁止硬上，降 Q 档。详见下方《Evidence Gate》。

**禁止改任何文件**：你只输出 Report 文本——绝不用 `Edit` / `Write` / `NotebookEdit` 改任何文件（被评审对象、skill 自身、其他文件都不许）。要改进规则 / 模板 / 流程，写进 Report 的 Suggestion 给用户决定，由 caller 走正规流程吸收。reviewer 越权改文件 = 违反 Iron Law。

## Forbidden Reviewer Language

NEVER：

- "This is a solid design" / "Great work on..." / "Comprehensive coverage"
- "Overall looks good, just a few nits" / "Well-structured" / "Well-thought-out"

INSTEAD：直接列具体问题，无问题说 Pass。

## Evidence Gate（代码事实依据）

reviewer 的本职是 challenge **被评审工件自身**（结构 / 推理 / 可读性）。但当 finding 涉及**代码事实声明**时，必须**以代码为依据**——不许猜，不许凭印象指控。

### 触发清单（属于"代码事实声明"）

finding 命中以下任一类 → 触发 Evidence Gate：

1. **路径 / 文件是否存在**："`auth/session.go` 不存在 / 应在 `pkg/auth/` 下"
2. **方法 / 函数签名**："实际签名是 `CreateSession(ctx, uid)` 不是 `CreateSession(uid)`"
3. **字段 / 类型 / 常量**："`User.CreatedAt` 字段不存在 / 类型应是 `time.Time` 不是 `int64`"
4. **调用关系 / 依赖**："X 模块没在调 Y / Z 包没引入 W"
5. **当前实现行为**："现有逻辑会跳过这一步 / 已处理过这个 case"
6. **数字 / 阈值实际值**："`HOLD_SIZE` 实际是 32，文档写 64 错了"
7. **历史决策一致性**："和 `docs/adr/0007-foo.md` / `wiki/pages/bar.md` 决策冲突"

### 硬 Gate

涉及触发清单的 finding，**要上 Critical / Warning 必须同时满足**：

1. **Read 过真实代码或文档**（不是凭印象 / 不是凭被评审对象自述）
2. finding 文本**附 `path:line` 引用**，让用户 1 跳验证

✅ 上 Critical：`C2 [接口设计]：文档写 CreateSession(uid string)，但 pkg/auth/session.go:42 实际是 CreateSession(ctx context.Context, uid string)——少了 ctx 参数`
❌ 禁上 Critical/Warning（无证据猜测）：`C2：CreateSession 应该需要 ctx 参数吧？`

### 降级路径：Open Questions

核实不到时（代码不在本仓 / 跨多仓 / 引用外部 SDK / 时间或权限不到位 / 尚未实现的代码）——**不许硬上 Critical / Warning**，降到 **❓ Open Questions（待核实事实）**，编号 `Q1, Q2, ...`：

> Q1 [影响]：文档列了 `auth/session.go::CreateSession`，本地 grep 搜不到该路径——请作者确认是新建文件还是路径写错

Q 档由用户决策：fix / skip / "我来核实并答 Q1"。

### 不触发 Evidence Gate（不需要代码引用）

challenge 的是工件自身的逻辑 / 表达 / 结构，不是代码事实——**不需要** `path:line`：

- 结构 / 骨架 / 章节 / 编号问题
- 推理跳步 / 论证断链 / 术语未解释
- 决策不量化 / 否决理由抽象（**仅指控"理由不充分"**；指控"数据 / 结论说反了"→ 触发 Gate）
- 范围拿捏、AI Writing Patterns
- Self-Audit 卡点（除非卡点本身指控代码事实——那时也走 Gate）

简言之：**指控工件说了不存在的代码事实 → 必须 Read 代码；指控工件说理不清 → 不需要**。

## Self-Audit（换位第二遍）

完成第一遍后自问：「假设我是不熟悉这个项目的工程师，读完 / 看完这份工件我能不能动手实施？卡在哪里？」

任何"卡点"加进 Report，编号 `SA1, SA2, ...`——与 C/W/S 平级参与用户决策；与已有 Cx/Wx 同根时标注「与 Cx 同根」帮用户去重。Self-Audit 常是隐藏的 Critical（"实施第一行就被卡住"）。

## 编号规则

每条问题带短编号：Critical `C1...`、Warning `W1...`、Suggestion `S1...`、Open Questions `Q1...`、Self-Audit `SA1...`。用户按编号引用（"修 C1、答 Q1、跳 S2"）。

> 严重度 5→3 分级映射、finding schema 字段、verdict 结构见 `references/findings-contract.md`——本文只定义 Q/SA 语义与 Evidence Gate 判据，契约引用本文不复述。
