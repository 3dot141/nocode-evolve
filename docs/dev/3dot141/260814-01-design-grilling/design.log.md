# Header
- task: 加强 dev-design grilling，并明确产品/开发两段成稿
- status: active
- type: feat
- phase: 开发
- current: landed
- createdAt: 2026-08-14
- artifacts:
  - log: ./design.log.md
  - design: ./design.md

# Decisions

## DEC-001
- 描述: 面试原则的来源与边界
- 内容: 拷 GitHub grilling 的原则进 Design（决策树、一次一问、推荐方案、事实自查、确认前不动手）。不拷 frontier 整轮、不新增 `/grill-me`、不另起 ADR / CONTEXT.md。
- 过程: ROUND-001 确认
- 引用: [ROUND-001]

## DEC-002
- 描述: 产品段与开发段的顺序
- 内容: 先聊清楚设计是什么，再展示全景和功能树；确认后才读代码，谈现在怎么达到。产品段不读实现。
- 过程: ROUND-002、ROUND-003、ROUND-004 修订后确认
- 引用: [ROUND-002, ROUND-003, ROUND-004]

## DEC-003
- 描述: Log 记什么
- 内容: Log 只以 DEC 与 ROUND 为主。DEC 含描述、内容、过程、引用 ROUND。ROUND 含背景、问题、方案、回答。详情在 ROUND。
- 过程: ROUND-005、ROUND-006、ROUND-007 确认
- 引用: [ROUND-005, ROUND-006, ROUND-007]

## DEC-004
- 描述: 三种设计文档
- 内容: feat / refactor / bug 三份 document 保留。共用「上半本确认 → 按下半本按块写」的落盘顺序；标题分别为 产品/开发、Before/After、问题/修复。
- 过程: ROUND-008 确认
- 引用: [ROUND-008]

## DEC-005
- 描述: 写 design.md 的时机
- 内容: 上半本 ROUND 闭合后写入并确认；开发按块闭合后追加流程图、接口、伪代码、问题；全文检查后再确认 Handoff。
- 过程: ROUND-009 确认
- 引用: [ROUND-009]

## DEC-006
- 描述: 下一问从哪长
- 内容: 下一问从这件事的树长出。类型 questions.md 改为覆盖检查，不再按 F0–F14 / B / R 编号提问。
- 过程: 会话中确认；写入本 Log
- 引用: [ROUND-001, ROUND-008]

## DEC-007
- 描述: 选方案的标准与撞约
- 内容: 以最佳设计为准，不以兼容或快为推荐理由。要打破已有对外契约或数据形态时，单独一 ROUND 问用户。
- 过程: ROUND-002 选 C
- 引用: [ROUND-002]

## DEC-008
- 描述: Plan 是否 grill
- 内容: Plan 本轮不加 grill，仍只把 DES 映射为任务。
- 过程: 用户在范围讨论中确认
- 引用: [ROUND-001]

## DEC-009
- 描述: 测试跟随新协议
- 内容: 契约测试与 eval 改为锁新字段和两段流程，不得为过测试保留类型问卷主路径。保留一次一问和先入库。
- 过程: 写入设计时形成
- 引用: [ROUND-001]

# ROUND

## ROUND-001 — closed
### 背景
当前 `dev-design` Step 2 按 feat/bug/refactor 的 questions.md 提问；`grilling.md` 是入库协议。`dev-plan` 无 grill。用户认为两边 grill 不够，后改为只加强 Design。
### 问题
grill 原则从哪来，Plan 要不要一起改？
### 方案
直接拷 GitHub grilling 当基础原则；Design 用它。Plan 暂时不用。
### 回答
同意。Plan 先不加 grill。

## ROUND-002 — closed
### 背景
曾建议功能清单也先读代码。用户后来说应先产品后开发。撞上对外契约时选了每次单独问（C）。
### 问题
最佳设计和现有公开契约冲突时怎么办？
### 方案
每次撞车单独问，推荐最佳方案并写出让步代价。
### 回答
C。

## ROUND-003 — closed
### 背景
用户纠正：产品先聊清楚设计是什么，再展示全景、业务、业务流；开发再读代码谈怎么达到。
### 问题
产品段展示什么？是否先读代码？
### 方案
产品段不读代码；先 grill「设计是什么」，再展示收口材料。开发段才读代码。
### 回答
不是业务流，是功能。全景 + 功能 1 / 1.1。开发再：全景、架构、流程，然后按功能写接口、伪代码、问题。

## ROUND-004 — closed
### 背景
用户补充功能还要有流程图，并说 design.log 也要优化。
### 问题
流程图挂在产品还是开发？Log 还用不用 F 树当主视图？
### 方案
当时误放到产品功能上；Log 建议改成产品/开发两章当当前真相。
### 回答
1. 流程图是开发时候的功能流程图，不是产品。2. Log 记录 DEC 和 ROUND，格式要明确。

## ROUND-005 — closed
### 背景
用户给出 DEC 与 ROUND 的字段意向。
### 问题
DEC / ROUND 各写哪些字段？
### 方案
DEC：描述、内容。ROUND：背景、问题。
### 回答
DEC：描述、内容、过程、引用 ROUND，详情在 ROUND。ROUND：背景、问题、方案。

## ROUND-006 — closed
### 背景
ROUND 有方案后，用户答复还没有格子。曾问「答案之后写哪」，造成费解。
### 问题
用户的回答记在 ROUND 的哪一截？
### 方案
在方案后加一截，waiting 时为空。
### 回答
加入回答。

## ROUND-007 — closed
### 背景
ROUND 四截已定：背景、问题、方案、回答。
### 问题
是否按此作为 Log 主格式？
### 方案
是。DEC 四字段 + ROUND 四截。去掉八段 Round 和 Decision Tree 主树。
### 回答
（本轮随 ROUND-005/006 已确认字段；本条归档格式。）

## ROUND-008 — closed
### 背景
仓库已有 feat/refactor/bug 三份 document.md。新两章骨架不能吃掉类型差异。Bug 仍是问题基线 → Debug → 修复基线。
### 问题
三种设计文档还要不要？
### 方案
保留三份协议。共用落盘顺序，章节名按类型：产品/开发、Before/After、问题/修复。
### 回答
好。

## ROUND-009 — closed
### 背景
需要固定何时写 design.md，避免边聊边在文档里补猜测。
### 问题
写设计文档时流程是什么？
### 方案
上半本确认后再写下半本；每闭合一块追加流程图、接口、伪代码、问题；未确认 DEC 不进文档。
### 回答
接受该落盘顺序（在确认三种文档之后一并成立）。

# Handoff

From: dev-design
To: Env
ConfirmedBy: ROUND-009
Reason: 用户要求直接执行；产品与开发协议已写入 skill 源码并完成打包。
Read:
  design: ./design.md
  designIds: [DES-001, DES-002, DES-003, DES-004, DES-005, DES-006, DES-007]
Preserve: []
Open: []
