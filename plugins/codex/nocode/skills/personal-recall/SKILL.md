---
name: personal-recall
description: "从 .agents-personal/ 检索已沉淀内容（wiki + rules + AGENTS.md），返回按置信度排序的清单"
---

> Codex 入口：原命令参数统一称为“用户本次调用参数”。

# /personal-recall：.agents-personal/ 内容检索

只搜 `.agents-personal/`（wiki + rules + AGENTS.md），不搜 vault。和 `/recall` 的关系：recall 搜两个源（personal + vault），personal-recall 只搜 personal。

## 入参

`用户本次调用参数` 必填——搜索关键词。

无参数时报错：`请输入关键词。用法：/personal-recall <keyword>`

## 执行

### 1. 关键词扩展

把用户关键词拆为两组（和 recall-search agent 同样的双轨结构）：

**salientTerms**（核心词）：原始关键词 + 核心实体
**expandedQueries**（变体词）：中文同义 / 英文译名 / 中英混合。上限 5 个。长且具体的查询（≥4 实义词）跳过扩展。

### 2. 搜索

对每个变体在 `.agents-personal/` 下搜索：

```bash
rg -il --glob '*.md' '<variant>' .agents-personal/
```

搜索范围：
- `wiki/draft/*.md` + `wiki/pages/*.md` — 知识页
- `rules/*.md` — 指令文件
- `AGENTS.md` — 变量覆盖和触发表

合并去重，记录 hitCount。候选 >30 个按 hitCount 降序取 top 30。

### 3. 元数据提取

对每个候选 `Read(file, limit=40)` 提取：
- **wiki 页**：title（frontmatter title → slug → 文件名）、summary（description → TLDR）、tags、maturity
- **rules 文件**：title（H1）、summary（第一段）
- **AGENTS.md**：按分节结构化提取——命中的分节标题 + 分节类型（变量覆盖 / 命名惯例 / 语气风格 / 协作约定 / Rules 触发条目）+ 上下文行。变量命中时展示 `{name} = value` 全行

### 4. 打分 + 排序

综合判断相关度（0-1 置信度）：标题命中最高，tags 次之，summary 再次，正文最低。核心词优先于变体词。按置信度降序取 top ≤10。

### 5. 输出

```
📂 .agents-personal/
| # | 标题 | 内容总结 | 路径 | 置信度 |
|---|------|---------|------|--------|
| 1 | ... | ≤30字 | wiki/pages/... | 0.95 |
| 2 | ... | ≤30字 | rules/... | 0.78 |
| 3 | 语气风格 | ≤30字 | AGENTS.md ## 语气风格 | 0.72 |
| 4 | {api_base_url} | https://... | AGENTS.md ## 变量覆盖 | 0.65 |
```

AGENTS.md 命中时，路径列显示 `AGENTS.md ## <分节名>` 方便定位。

0 结果时："未找到与 '<keyword>' 相关的内容。"

用户可以说"打开第 N 个"，主 agent Read 对应文件。
