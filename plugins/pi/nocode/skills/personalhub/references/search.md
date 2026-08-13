本文所说“调用 `<skill>` Skill”使用 `/skill:<skill>`；“结构化决策”在回合末写出完整问题与 2–3 个互斥选项，等待用户下一条消息。


# /personalhub search：.agents-personal/ 内容检索

只搜 `.agents-personal/`（wiki + rules + AGENTS.md），不搜 vault。和 `/recall` 的关系：recall 搜两个源（personal + vault），personalhub search 只搜 personal。

## 入参

`$ARGUMENTS` 必填——搜索关键词。

无参数时报错：`请输入关键词。用法：/personalhub search <keyword>`

## 执行

### 1. 关键词扩展

把用户关键词拆为两组（和 recall-search agent 同样的双轨结构）：

**salientTerms**（核心词）：原始关键词 + 核心实体
**expandedQueries**（变体词）：中文同义 / 英文译名 / 中英混合。上限 5 个。长且具体的查询（≥4 实义词）跳过扩展。

扩展词必须短而多样；原始关键词始终保留。搜索前检查目录是否存在，不存在则跳过并在结果中注明；没有任何可用数据源时报错退出。`rg` 不可用时可退到 `grep -ril --include='*.md'`，并明确标注降级。

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

对每个候选提取元数据。`wiki/pages/` 与 `wiki/draft/` 候选用 `node "${NOCODE_PLUGIN_ROOT}/scripts/wiki-read.mjs" --project-root "$PWD" --path "<wiki-page-path>" --session-id "<current-session-id>"` 读取并计数；rules/ 和 AGENTS.md 继续普通 Read：
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

用户可以说"打开第 N 个"。若结果是 wiki page，主 agent 必须再次通过 `wiki-read.mjs` 的 JSON stdout 内容打开；rules/ 或 AGENTS.md 才直接 Read。
