# dev-design 文档协议优化 — 设计定稿

> status: confirmed
> type: feat（DEC-001）
> 源决策: DEC-001 ~ DEC-004（design.log.md）

## 目标骨架（feat 开发半场）

```text
# 开发设计
## 全景                          ← 功能链清单 + 链间依赖（ASCII）
## 功能 N：<功能链名>
### 背景                         ← 为什么（2-3 行）
### 目标                         ← 可验收结果（2-3 行）
### 全景                         ← 本链结构 ASCII（前后端贯穿一张图）
### 流程                         ← 本链控制流/时序 ASCII
### N.x 子功能块
  **接口**                       ← 格式化代码块；无契约变更显式标注
  **伪代码**                     ← 结构化格式；文案改动也须具体
  **影响文件**                   ← 文件树（# 注释变更点）
### 问题                         ← 本组 Open / 用户决策 / 协作点
### 影响文件（功能 N 汇总）       ← 组级文件树
# 总览
## 架构                          ← 系统级 ASCII 总图（跨功能组）
## 文件                          ← 全仓总树 + NEW/MODIFY/DELETE/PRESERVE + 新增目录清单
```

## 分层规则

- 组织维度 = 功能链（前后端贯穿、含外部协作前置），禁止按端/仓分组
- 流程图与问题上移组层；块内流程图仅当块有独立控制流（bug 修复机制、refactor 迁移交互）
- 影响文件三层层级：block 树 → 组汇总 → 总表，碰撞在总表暴露
- 单一功能组的小任务骨架全套（DEC-004 分歧 1：不豁免）

## 三类同构

| type | 组维度 | 组背景 / 组目标 | 组流程 |
|---|---|---|---|
| feat | 功能链 | 问题动机 / 可验收结果 | 端到端控制流 |
| bug | 故障机制 | 机制 + Debug 证据回链 / 修复验收 | fault-before / repair-after |
| refactor | 结构变更组 | 引 Before 动机（不重复）/ 引目标质量与停止条件 | Before→After 迁移交互 |

三者尾部均加 Closing overview（总览 / 架构 / 文件）。

## 格式规范（writing.md 固化）

1. 全景与流程图 = ASCII
2. 文件清单 = ASCII 文件树 + 变更类型标注 + `#` 短注释
3. 接口 / 伪代码 = 带语言标注（ts / tsx / text）的围栏代码块 + 真实结构化格式
4. 最小视图原则（引 visual-forms.md）

## 改动文件

```text
skills/dev-design/
├── SKILL.md                        MODIFY  Step 2 block 追加措辞
├── references/writing.md           MODIFY  block 三件套/三层文件树/格式规范/self-check
├── references/feat/document.md     MODIFY  功能组结构 + Closing overview
├── references/bug/document.md     MODIFY  机制分组对齐
├── references/refactor/document.md MODIFY  变更组对齐
├── references/feat/closure.md      MODIFY  检查项措辞
├── references/bug/closure.md       MODIFY  检查项措辞
└── references/refactor/closure.md  MODIFY  检查项措辞
```

验证：新协议反向回检 260819-02（fx-data-agents）design.md——七轮返工的最终形态应能被新协议一次产出。

DES：本任务为纯 skill 文档修订、单一 commit 交付，不拆 DES（无可独立验证的下游义务分片）。
