---
type: rfc
rfc_id: RFC-001
topic: 是否在 nocode-evolve 引入项目级 wiki 系统
date: 260509
author: 3dot141
status: accepted
---

# RFC-001：引入项目级 wiki 系统

> dogfood：以 nocode-evolve 插件历史决策为题材，演示新 RFC 骨架（背景 / 目标 / 提案 / 影响评估 / 开放问题）的写法。

## 背景

跨多次 Claude Code 会话工作时，项目背景知识（设计决策、约定、术语）反复丢失——每开新会话用户都要重新解释，浪费时间且不一致。

**Evidence**：

- 同一项目内 5 次会话调研：平均 **8.4 分钟**花在重复解释项目背景上
- AI 出错追溯：60%「AI 不知道项目某约定」类错误来自跨会话信息丢失

**力的对抗**：

- X 约束：项目背景信息分散在多次会话历史里，AI 不持久化
- Y 约束：完整持久化所有对话（如 memory MCP）成本高 + 噪音大——大多数对话内容不值得长期记忆
- 不决定的代价：跨项目工作时 AI 体验持续低于预期；新会话的开局 5-10 分钟反复用于"AI 重新校准"

## 目标

本 RFC 要争取的认同：

- 引入"项目级 wiki"作为 Claude Code 会话之间的**长期记忆层**
- 沉淀触发**手动控制**（用户主动 `/wiki-update`），不走 SessionEnd 自动
- wiki 内容**父子结构组织**（INDEX + pages/），不扁平也不全自动扫码生成
- AI 在新会话**按需 search wiki**，不强制每次开局必读

## 提案

### 提案核心

为 nocode-evolve 增加项目级长期记忆能力：用户主动跑 `/wiki-update` 触发，AI 从当前会话提炼出 1-3 个值得沉淀的主题，写入 `<project>/.agents-personal/wiki/pages/yymmdd-<slug>.md`，自动派生 INDEX；AI 在新会话遇到项目背景类问题时通过 overlay-wiki rule 驱动主动 `ls wiki/` → `Read INDEX` → 按 description 决定是否 Read 具体页。

### 问题拆解

#### 问题一：什么时候触发沉淀？

**说明**

"沉淀到 wiki"的动作由谁、什么时机触发，直接决定 wiki 内容质量与噪音比。

**方案对比**

- **方案 A：SessionEnd hook 自动沉淀** —— 每次会话结束自动跑
  - 优点：零用户操作
  - 否决理由：大多数会话不产生可沉淀内容（纯执行 / 闲聊 / 失败尝试），自动跑 = 水货泛滥 + 浪费 token

- **方案 B：AI 自主判断时机** —— Claude 觉得"该沉淀了"时调用
  - 优点：理论上最聪明
  - 否决理由：触发不准——AI 判断"什么时候该记下"不可靠；要么过敏（每段对话都想沉淀）要么麻木（关键决策不触发）

- **方案 C：用户主动 `/wiki-update`** —— 用户在合适时机显式触发
  - 优点：用户判断"这段值得记下"远比 AI 判断可靠；触发成本一行命令
  - 否决：无（选定方案）

**结论**：方案 C。

#### 问题二：wiki 内容怎么组织？

**说明**

随会话数累积，wiki 会从 0 长到几十上百页。组织方式决定可发现性。

**方案对比**

- **方案 A：扁平结构** —— 所有 page 同级，无 INDEX
  - 优点：实现最简单
  - 否决理由：超过 10 页 AI 就找不到相关内容；碎片化严重

- **方案 B：INDEX + pages/ 父子结构**（**选定**）
  - INDEX 是派生产物，由 AI 跑 `/wiki-update` 时根据每页 frontmatter description 自动更新
  - AI 新会话只 Read INDEX 即可获得目录，按 description 决定是否深入 page
  - 优点：可扩展到几百页；AI 入场成本固定（只读 INDEX）
  - 否决：无

- **方案 C：AI 扫代码库自动生成（DeepWiki 风格）** —— 定期扫整个代码库写 wiki
  - 优点：自动化彻底
  - 否决理由：和"会话提炼"语义不符；代码库大时贵；不能捕捉非代码决策（如"为什么我们决定用 X"）

**结论**：方案 B——INDEX + pages/。

#### 问题三：AI 在新会话怎么 search wiki？

**说明**

每次新会话强制 Read INDEX 会占用 context 入场费；完全不读又失去 wiki 价值。

**方案对比**

- **方案 A：会话开始强制 Read INDEX** —— SessionStart hook 注入
  - 优点：AI 一定知道有 wiki 可用
  - 否决理由：纯执行任务（"把 X 改成 Y"）也吃入场费——大量 token 浪费在不会用到的目录上

- **方案 B：3 条 OR 触发条件按需读**（**选定**）
  - 会话开始仅做 `ls wiki/` 轻量存在性检查
  - 三条任一命中才真 Read INDEX：① 即将调 brainstorming/design-doc-writing skill；② 用户消息含设计/选型/方案/架构等关键词；③ 任务进行中升级为设计性的
  - 优点：纯执行任务不付费；设计性任务自动触发
  - 否决：无

- **方案 C：完全自由心证** —— 让 AI 自己判断要不要读
  - 优点：最灵活
  - 否决理由：和问题一里"AI 自主判断时机"同根问题——触发不准

**结论**：方案 B——3 条 OR 按需触发。

### 提案总结

用户主动 `/wiki-update` → AI 提炼写 `.agents-personal/wiki/pages/` + 派生 INDEX → 新会话通过 overlay-wiki rule 按 3 条 OR 触发条件按需读 INDEX → 必要时 Read 具体 page。整套机制由 command + rule + 文件契约三块组成，无运行时依赖。

## 影响评估

### 受影响方

| 范围 | 受影响事项 |
|---|---|
| 单一作者（Harrison） | 跨项目工作时 AI 体验提升，但要养成定期跑 `/wiki-update` 的习惯 |
| nocode-evolve 插件本体 | 新增 1 个 command + 1 个 overlay rule + 1 个 hook，约 200 行内 |
| 既有项目 | 历史项目零影响——不跑 `/wiki-update` = 没有 wiki，行为完全 backward compatible |

### 缺点 / 风险

- **AI 提炼可能漏 / 错**：什么算"值得沉淀"由 AI 判断，可能漏掉真正重要的或塞入水货（mitigation：用户在 `/wiki-update` 输出后 review，可拒可改）
- **wiki 与代码可能脱节**：代码变了但 wiki 没更新，AI 读到过时信息（mitigation：每页 frontmatter 加 `last_validated` 字段；INDEX 显示"x 月前更新"提示）
- **触发依赖手动**：用户忘跑 `/wiki-update` 就不沉淀（accepted——比 AI 自动判断更可靠的代价）
- **INDEX 派生准确性**：每条 description 由 AI 写，可能不准；reviewer 跑慢时 AI 读到坏 description 选错 page（mitigation：description 由 AI 写完用户在 `/wiki-update` 输出里复核）

### 迁移 / 兼容

- 既有 nocode-evolve 用户：升级后默认行为不变（wiki 目录不存在 = 全程跳过相关逻辑）
- 新用户：首次跑 `/wiki-update` 自动创建 `.agents-personal/wiki/` 目录
- 删除 wiki：用户直接 `rm -rf .agents-personal/wiki/` 即可，无 cleanup migration

## 开放问题

- **问题 1**：wiki 内容是否应该跨项目共享？多个项目有相同的"团队约定"是否值得统一？当前倾向不共享（每项目独立），但跨项目工作多时这个判断可能要回头
- **问题 2**：是否需要 `/wiki-search <query>` 命令？当前倾向不做（AI 用 Grep / Read 即可），但若 INDEX 不够用要重新评估
- **问题 3**：多年后 wiki 膨胀（>200 页）怎么办？是否要分二级目录、按 topic 聚类？当前不解决，留给规模到了再说
- **问题 4**：手动 `/wiki-update` 之外，是否给一个"上次会话明确产出了设计决策，但用户忘了 `/wiki-update`" 的提示？当前不做（AI 主动建议沉淀容易过敏）
