---
description: 把当前会话提炼成项目级记忆，写入 .agents-personal/wiki/
argument-hint: [optional-topic]
---

# /project-wiki-distill：项目级记忆沉淀

把当前会话里值得跨会话保留的项目知识沉淀到 `<project>/.agents-personal/wiki/` 下。

## 入参（$ARGUMENTS）

- 无参：扫整个会话历史，自由识别 0~N 个值得沉淀的主题
- 带 `$ARGUMENTS`：聚焦该主题做沉淀，忽略其他内容

## 执行流程

### 1. Read 现有 wiki

```
<project>/.agents-personal/wiki/INDEX.md         # 看现有页面有哪些
<project>/.agents-personal/wiki/pages/*.md       # 按需，看具体内容
```

不存在则后续 `mkdir -p` 创建。

### 2. 提炼

从会话历史里挑出值得沉淀的内容。

**✅ 算值得沉淀：**

- 项目特有的设计决策（"为什么选 X 不选 Y"）
- 项目独有的约定 / 术语 / 缩写
- 关键模块的架构边界与不变量
- 反复踩过的坑 / 已有 ADR 的精炼摘要
- 跨多次会话需保持一致的事实

**❌ 不算：**

- 「今天我做了 X」一次性进度记录
- 通用知识（任何项目都适用的 best practice）
- 一次性 bug 修复（除非揭示出某个不变量被违反）
- 还在变化中的草案（未定型的内容）

如果整个会话里没有值得沉淀的内容，**报告"本次无沉淀"，停止**——不要写空文件凑数。

### 3. 整合判断

对每个识别出的主题，先 Read INDEX.md 的 description，判断与已有页的关系：

```
┌─ 强相关：同一系统/同一决策的不同侧面/演进 → 整合进该页
├─ 弱相关：提到但主题不同                  → 建新页 + 已有页加 see also
└─ 无关                                    → 建新页
```

#### 整合判断 examples

| 已有页 | 本次主题 | 决策 |
|---|---|---|
| rules-injection-overlay（hook 注入） | inject-rules.sh 扩展支持新 rule 类型 | ✅ 整合（同一系统延伸） |
| rules-injection-overlay | design-doc-writing skill 双轴架构 | ✅ 建新页（不同系统） |
| design-doc-skill-dual-axis | 给该 skill 加 ECC 正反例 | ✅ 整合（同一 skill 演进） |
| auth-token-storage（选 JWT） | 改用 session-based | ✅ 整合 + 改结构（标 superseded + 加 v2 决策） |

### 4. 写入

#### 新建页

```bash
mkdir -p <project>/.agents-personal/wiki/pages
```

文件名：`yymmdd-<slug>.md`（slug 是 kebab-case，3-5 个词，简短可读，全 wiki 内唯一）

#### 整合到已有页

- Read 已有页全文
- 把新内容**融合**到合适章节，**不是末尾 append paste**
- 必要时改章节结构（如「决策」拆为「v1 决策 + v2 修订」）
- frontmatter 加 `last_updated: <today_yymmdd>`
- 文件名（含原 yymmdd）保持不变

### 5. 派生 INDEX

扫 `pages/*.md` frontmatter，重写 `INDEX.md`（按 date 倒序，同日按 slug 字母序）。

### 6. 报告

```
沉淀了 N 项：
- 新建：pages/260509-design-doc-skill-dual-axis.md
- 整合：pages/260509-rules-injection-overlay.md (last_updated: 260512)
INDEX 已更新。
```

或：

```
本次会话没有值得沉淀的项目级知识——未写入文件。
```

## 文件契约

### Page frontmatter

```yaml
---
slug: design-doc-skill-dual-axis    # kebab-case，全 wiki 内唯一
title: design-doc-writing skill 的双轴设计
date: 260509                         # 首次创建日期，永远不变
last_updated: 260512                 # 最后整合日期；首次创建时不写
description: 一句话简介，让 AI 看 INDEX 时能判断"要不要 Read 这页"
related:                             # 可选：相关代码 / commit / PR
  - skills/design-doc-writing/
  - 5774427
---
```

### Page body 推荐结构

```md
# <title>

## 背景 / 演进过程
<来龙去脉>

## 决策与设计 / 核心机制
<内容主体>

## 关键设计选择
<决策点列表>

## 后续注意 / 关键链接（可选）
```

### INDEX.md 模板

```md
# Project Wiki

> 由 `/project-wiki-distill` 自动维护。AI 工作时遇到项目背景问题，先读 INDEX，按 description 决定是否 Read 具体页。

## Pages

### [<title>](./pages/<filename>)
**slug**: `<slug>` · **date**: `<yymmdd>` · **updated**: `<last_updated>`

<description>

---

最后更新：<today_yymmdd>
```

`updated` 段在 frontmatter 无 `last_updated` 时省略。

## 反模式

- ❌ **末尾 paste**：把新内容堆到 `## YYMMDD Update` 节——这是懒整合，不是整合
- ❌ **过度整合**：把弱相关内容塞进同一页 → 杂物间页面
- ❌ **永远新建**：每次都建新页绕过整合判断
- ❌ **写空文件**：会话没值得沉淀的内容时也建页凑数
- ❌ **slug 用日期**：slug 是主题标识，不带日期；日期在文件名里有

## 边界情况

| 场景 | 处理 |
|---|---|
| `.agents-personal/wiki/pages/` 不存在 | `mkdir -p`，不报错 |
| INDEX.md 不存在 | 视为空，正常写入 |
| 会话无可沉淀内容 | 报告并停止，**不写文件** |
| slug 冲突（同日同 topic） | 默认走整合更新；如用户明确想另开则提示加 `-2` 后缀 |
| INDEX 与 pages 不一致 | INDEX 是派生品，重写。pages 是 source of truth |
| 文件膨胀过大（>200 行） | 建议拆页 + 留 see also |

## 写完后

不要主动 push 或 commit——`.agents-personal/wiki/` 通常被 .gitignore（视为本地状态）。如果项目希望共享 wiki 内容，应手动从 wiki 提炼到正式文档（README / docs/）。
