---
type: implementation-feature
topic: wiki-update 命令——项目级记忆沉淀
date: 260509
author: 3dot141
status: approved
---

# `/wiki-update`：项目级记忆沉淀命令

> **TL;DR**：用户主动调用 `/wiki-update [topic]`，AI 从当前会话提炼项目级知识，写入 `<project>/.agents-personal/wiki/pages/yymmdd-<slug>.md`，自动派生 INDEX；写之前由 AI 自主判断是否与已有页整合。

## 背景与动机

nocode-toolkit 已有「全局规则注入」「设计文档撰写」两类能力，但缺**项目级长期记忆**：

- 跨多次会话的设计决策、约定、术语，AI 不会自动记住
- `.agents-personal/AGENTS.md` 适合写硬性规则，不适合积累「来龙去脉」式知识
- 项目背景每开新会话都要重讲，浪费时间且不稳定

不做的代价：每次新会话都要重新解释项目背景；AI 无法跨会话保持一致的设计判断；项目历史决策的"为什么"逐渐丢失。

成功判据：

- 跑过几次 `/wiki-update` 后，新开会话的 AI 能 Read INDEX → 按 description 主动 Read 相关页 → 直接进入"已有上下文"状态
- AI 在沉淀时能正确判断「整合到已有页」vs「新建页」，不产生大量碎片或杂物间页面

## 用户故事 / 使用场景

**场景 1：会话末做沉淀**

> 跑了 2 小时，把一个新 skill 的双轴设计聊完了。Harrison 输入 `/wiki-update` → AI 扫会话，识别 1 个主题（"design-doc-skill 双轴设计"），建 `pages/260509-design-doc-skill-dual-axis.md`，写入决策来龙去脉，重生成 INDEX。

**场景 2：定向沉淀某个主题**

> Harrison 想专门沉淀 hook 注入机制：`/wiki-update rules-injection-overlay` → AI 聚焦该主题提炼，建对应页面（或更新已有页面）。

**场景 3：整合到已有页**

> 上次会话沉淀过 `260509-design-doc-skill-dual-axis`（讲双轴架构）。本次会话讨论了"给该 skill 加 ECC 正反例对照"。Harrison `/wiki-update` → AI 检索 INDEX 发现强相关已有页 → Read 该页 → 在「写作准则」章节融入 ECC 演进 → 更新 last_updated → 重生成 INDEX。

**场景 4：新会话使用 wiki**

> 几天后开新会话，Harrison 问"这个项目的设计文档怎么写"。AI（受 SessionStart 注入的 overlay-wiki rule 提示）→ `ls .agents-personal/wiki/` → Read INDEX → 看到 `design-doc-skill-dual-axis` 页相关 → Read 该页 → 直接给出"按本项目约定，应该用 design-doc-writing skill，按 layer × intent 选关注点……"。

## 验证

dogfood 优先：

- **本仓库自测**：在 nocode-toolkit 仓库跑 `/wiki-update`，提炼当前这一长串关于 design-doc-writing skill / wiki-update 设计的对话，看能否切分为 2-3 页合理的内容
- **空项目测试**：在没有 `.agents-personal/` 的项目跑，确认 mkdir 行为
- **整合测试**：同一主题连跑两次（中间换个新角度讨论），第二次应是更新已有页而非新建
- **跨会话验证**：合上当前会话，下次开新会话提相关问题，看 AI 是否会主动 search wiki

人工验收点：

- INDEX 派生准确（每个 page 对应一条，按日期倒序）
- frontmatter 字段完整（slug/title/date/description/related）
- AI 整合判断合理（按 examples 中的标准）

## 接口签名

### Command 形式

```
/wiki-update [optional-topic]
```

- 无参：AI 自由扫会话识别 0~N 个主题
- 带 topic：AI 聚焦该主题提炼

### 文件契约

**Page**（`<project>/.agents-personal/wiki/pages/yymmdd-<slug>.md`）：

```md
---
slug: design-doc-skill-dual-axis
title: design-doc-writing skill 的双轴设计
date: 260509
last_updated: 260512    # 可选，无更新则省略
description: skill 用 layer × intent 两个正交维度组装设计文档；含写作准则与反模式。
related:                # 可选，相关代码/commit/PR 路径
  - skills/design-doc-writing/
  - 5774427
---

# <title>

## 背景
<来龙去脉>

## 决策与设计
<内容主体>

## 关键链接 / 后续注意（可选）
```

**INDEX**（`<project>/.agents-personal/wiki/INDEX.md`，自动派生，按 date 倒序）：

```md
# Project Wiki

> 由 `/wiki-update` 自动维护。AI 工作时遇到项目背景问题，先读 INDEX，按 description 决定是否 Read 具体页。

## Pages

### [<title>](./pages/<filename>)
**slug**: `<slug>` · **date**: `<yymmdd>` · **updated**: `<last_updated>`

<description>

最后更新：<yymmdd>
```

## 数据模型变更

无数据库变更——纯文件系统操作。

新增目录结构（被使用的项目侧）：

```
<project>/.agents-personal/wiki/
├── INDEX.md            # 派生
└── pages/
    └── yymmdd-<slug>.md
```

新增文件（插件侧）：

```
nocode-toolkit/
├── commands/
│   └── wiki-update.md   # slash command 定义
└── rules/
    └── overlay-wiki.md  # 告诉 AI wiki 存在 + 按需 search 流程
```

## 错误处理

| 场景 | 处理 |
|---|---|
| `.agents-personal/wiki/pages/` 不存在 | `mkdir -p`，不报错 |
| INDEX.md 不存在 | 视为空，正常写入 |
| 会话无值得沉淀的内容 | 报「本次无沉淀」，**不写空文件** |
| slug 重名（同日同主题） | 默认走"整合更新"路径；用户明确想另开页则提示加 `-2` 后缀 |
| INDEX 与 pages frontmatter 不一致 | INDEX 是派生品——直接重写。pages 是 source of truth |
| 同会话多次 `/wiki-update` | 每次重扫会话；slug 已存在则更新 |
| 整合判断失误（错塞页 / 错建页） | 用户用 `/wiki-update` 重做时可指定 topic，AI 重新评估 |

## AI 自主整合判断

AI 在写之前对每个识别出的主题做整合决策：

```
Read INDEX → 按 description 找主题语义相关的已有页 →

  ┌─ 强相关：同一系统/同一决策的不同侧面/演进 → 整合进该页
  ├─ 弱相关：提到但主题不同                  → 建新页 + 已有页加 see also
  └─ 无关                                    → 建新页
```

**整合时的纪律**：

- Read 已有页全文后**融合**，而非末尾 paste
- 必要时改章节结构（如「决策」拆为「v1 决策 + v2 修订」）
- 文件名首次创建日期不动（`yymmdd-<slug>` 保留），加 `last_updated` 字段
- 当 page 膨胀过大（>200 行）→ 建议拆页 + 留 see also

**判断 examples**（写进 `commands/wiki-update.md`，让 AI 校准）：

| 已有页 | 本次主题 | 决策 |
|---|---|---|
| rules-injection-overlay（hook 注入） | inject-rules.sh 扩展支持新 rule 类型 | 整合（同一系统延伸） |
| rules-injection-overlay | design-doc-writing skill 双轴架构 | 建新页（不同系统） |
| design-doc-skill-dual-axis（双轴） | 给该 skill 加 ECC 正反例 | 整合（同一 skill 演进） |
| auth-token-storage（选 JWT） | 改用 session-based | 整合 + 改结构（原决策标 superseded，新决策为主章节） |

**反模式**：

- ❌ 末尾 paste：把新内容堆到「## 2026-05-12 Update」节——这是懒整合，不是整合
- ❌ 过度整合：把弱相关内容塞进同一页 → 杂物间
- ❌ 永远新建：每次都建新页绕过整合判断

## 备选方案与取舍

考虑过的备选方案：

- **方案 B：skill 替代 command**——AI 在判断"该沉淀了"时自动调用。**否决**：触发不准，用户不知道什么时候会被记下；用户对"什么值得沉淀"判断比 AI 准。
- **方案 C：SessionEnd hook 自动总结**——会话结束自动跑。**否决**：每会话都跑贵且产生水货（多数会话不产生能沉淀的内容）。
- **方案 D：AI 扫代码库自动生成（DeepWiki 风格）**——执行时扫整个代码库生成。**否决**：和"会话提炼"语义不符；代码库大时贵；产物多说话。
- **方案 E：完全自由生长（无父子结构）**——每次会话扁平地建一页。**否决**：多次会话后碎片化严重，需要"整理"机制。
- **方案 F：单一大页面（PROJECT.md）**——一个文件多章节。**否决**：内容多时变万言 markdown，AI 一次读贵，且不像 LLM wiki。

最终：用 command 显式触发 + 父子结构（INDEX + pages/）+ AI 自主整合判断 + rule 注入告诉 AI 按需 search。
