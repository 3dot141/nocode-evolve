# Product Flow — 独立产品流设计

> Status: draft
> Author: 3dot141
> Date: 260623

## 背景

核心问题：nocode-evolve 的 devflow 从 Define 阶段起步，假设"做什么"已经有人拍了——但很多时候开发者自己也需要搞清楚问题空间。当前 Define 和 Design 阶段缺少对代码现状和外部已有方案的系统性探索，容易闭门造车。

具体表现：
- Define 几乎无探索——Step 3 只说"代码能答的先 grep"，没有主动扫描代码库现状，完全没有网络调研
- Design Step 1 有"探索项目上下文"，但只读代码 + wiki + ADR，没有竞品分析、开源方案搜索、社区调研

附带问题（本 doc 不解决）：Design 阶段的技术方案探索增强（下一轮单独做）。

## 目标

为 nocode-evolve 新建独立的产品流（Product Flow），包含 Research（发散探索）和 PRD（收敛成文档）两个阶段。产品流与 devflow 通过文档衔接，不耦合。

量化验收：
1. Research skill 可独立调起，产出结构化调研备忘
2. PRD skill 可独立调起，产出 `.prd` 文档到 `docs/nocode/prds/{username}/`
3. 两个 skill 可串联使用（Research 产出喂 PRD）
4. devflow Full 场景能建议"先走产品流"
5. `node hooks/generate.mjs --check` 通过（manifest 单源一致）

## 架构

### 架构图

```
┌─────────────────────────────────────────────────────┐
│                    触发入口                          │
│  用户: "调研/research/竞品分析"  devflow: Full 建议   │
│  用户: "写 PRD/产品设计"                              │
└──────────┬──────────────────────┬────────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────┐    ┌─────────────────────┐
│  research skill │    │     prd skill        │
│  (发散探索)      │    │  (收敛成文档)         │
│                 │    │                      │
│ 并行 agent:     │    │ 1. 加载 research memo │
│  - 竞品分析     │    │ 2. clarify gate      │
│  - 代码现状     │    │ 3. 起草 PRD          │
│  - 市场/社区    │    │ 4. user story 确认   │
│  - 已有方案     │    │ 5. 自审              │
│                 │    │ 6. 用户确认          │
│ 产出:           │    │                      │
│ research-memo.md│───▶│ 产出:                │
│ (同目录, 前缀区分)│  │ xxx.prd.md.md           │
└─────────────────┘    └──────────┬───────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │   devflow Define     │
                       │   Read .prd 作为输入  │
                       └─────────────────────┘
```

### 文本总结

两个独立 skill 构成产品流：research 做发散探索（并行多切面 agent），prd 做收敛综合（结构化文档写作）。两者通过 research-memo.md 文件传递（不依赖会话上下文）。产品流与 devflow 完全解耦——devflow 在 Full 场景建议"先走产品流"，但不强制；Define 能读到 .prd 文件就用，没有也正常工作。

## 实现

### 影响

```
nocode-evolve/
├── skills/
│   ├── research/
│   │   └── SKILL.md                    (NEW)  Research skill 完整协议
│   └── prd/
│       └── SKILL.md                    (NEW)  PRD writing skill 完整协议
├── rules/
│   ├── rule-research.md                (NEW)  薄壳指向 skill
│   ├── rule-prd.md                     (NEW)  薄壳指向 skill
│   └── manifest.json                   (改)   ① 加 research rule 条目
│                                              ② 加 prd rule 条目
├── skills/devflow/
│   └── SKILL.md                        (改)   ③ Full 场景建议加产品流提示
├── model/
│   └── agent-catalog-*.md              (生成) generate.mjs 重新生成
├── hooks/
│   └── pretooluse-rules.json           (生成) generate.mjs 重新生成
├── .claude-plugin/
│   └── plugin.json                     (改)   ④ version bump
└── docs/nocode/prds/                   (NEW)  PRD 输出目录
```

### 接口设计

#### Research Skill 内部接口

```
research skill 对外暴露:
  触发: 用户说"调研/research/竞品分析/市场调研/看看已有方案"
  输入: topic (一句话描述调研对象)
  输出: research-memo.md (结构化调研备忘, 存 docs/nocode/prds/{username}/)
```

#### PRD Skill 内部接口

```
prd skill 对外暴露:
  触发: 用户说"写 PRD/产品需求/产品设计", 或 research 完成后衔接
  输入: research-memo.md (可选) + 用户描述
  输出: xxx.prd.md (结构化 PRD 文档, 存 docs/nocode/prds/{username}/)
```

#### Manifest Rule Schema

```json
{
  "id": "research",
  "bucket": "workflow",
  "also_buckets": [],
  "trigger_type": "regex+skill",
  "trigger_desc": "用户说调研/research/竞品分析/市场调研/看看已有方案/看看别人怎么做, 或 devflow Full 场景建议先走产品流",
  "triggers": ["调研", "research", "竞品分析", "市场调研", "看看.{0,4}(已有|别人|其他)", "产品调研"],
  "action": "Read rules/rule-research.md",
  "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-research.md",
  "summary": "独立产品流 Research 阶段: 并行多切面探索(竞品/代码/市场/已有方案), 产出 research-memo.md; 可独立调起也可串联 prd skill",
  "lifecycle_stage": "0 设计"
}

{
  "id": "prd",
  "bucket": "design",
  "also_buckets": ["workflow"],
  "trigger_type": "regex+skill",
  "trigger_desc": "用户说写 PRD/产品需求/产品设计/产品 brief, 或 research 完成后衔接, 或 devflow Full 场景建议",
  "triggers": ["写.{0,2}PRD", "产品需求", "产品设计", "产品.{0,2}brief", "写.{0,2}需求文档"],
  "action": "Read rules/rule-prd.md",
  "read": "${CLAUDE_PLUGIN_ROOT}/rules/rule-prd.md",
  "summary": "独立产品流 PRD 阶段: 读 research-memo(可选) + clarify gate + 写结构化 .prd 文档(6 核心要素 + 扩展字段); [TBD]/[ASSUMED] 双标注; Go/No-Go 结尾",
  "lifecycle_stage": "0 设计"
}
```

### 业务流

#### BF1: Research 探索流

```
function research(topic):
  // Step 1: 定范围 — 确认调研切面
  facets = askUserQuestion(
    "要调研哪些切面？",
    options: ["竞品分析", "代码现状", "市场/社区", "已有方案"],
    multiSelect: true,
    default: all_selected  // 默认全选, 用户可取消
  )

  // Step 2: 并行探索 — 每个切面 spawn 专职 agent
  results = parallel(facets.map(facet => () =>
    agent(buildFacetPrompt(facet, topic), {
      label: `research:${facet.key}`,
      schema: FACET_RESULT_SCHEMA  // {findings: [], sources: []}
    })
  ))

  // Step 3: 综合 — 汇总各切面结论
  memo = synthesize(results)
  // memo 包含: feature matrix + positioning map (mermaid) + 关键发现 + Go/No-Go
  // 每条发现带 [SOURCE: url/path] 引用

  // Step 4: Go/No-Go — 给出调研结论
  verdict = askUserQuestion(
    "基于调研, 建议: " + memo.goNoGo,
    options: ["Go — 继续", "No-Go — 放弃", "需要更多调研"]
  )

  // 写文件
  writeMemo(memo, "docs/nocode/prds/{username}/research-memo-{topic}.md")
  return memo
```

#### BF2: PRD 写作流

```
function writePrd(researchMemo, userDescription):
  // Step 1: 加载输入
  if researchMemo exists:
    context = readFile(researchMemo)  // 有 memo 时 AI 提议默认值
  else:
    context = userDescription  // 没有时靠用户描述

  // Step 2: Clarify gate — 暴露歧义
  // 先给每个字段带理由的默认值, 让用户改 (不问空白)
  clarifications = []
  for field in [Problem, UserStories, Appetite, Solution, NoGos]:
    proposed = generateDefault(field, context)  // "提议默认值"模式
    confirmed = askUserQuestion(
      field.name + ": " + proposed.value,
      options: ["确认", "要改"]  // 改比答空白快
    )
    clarifications.push({field, value: confirmed})

  // Step 3: 起草 PRD — 按模板逐节写
  // 每个 AI 生成的值标 [ASSUMED], 用户未决定的标 [TBD], 已确认的标 [CONFIRMED]
  draft = generatePrd(clarifications, context)

  // Step 4: User Stories 确认 — 逐条展示
  for story in draft.userStories:
    decision = askUserQuestion(
      story.text,
      options: ["确认 [CONFIRMED]", "修改", "删除"]
    )
    story.status = decision

  // Step 5: 自审 — 五维检查
  selfReview(draft, dimensions: [
    "完整性: 6 核心字段都有内容?",
    "一致性: Problem ↔ User Stories ↔ Success Metrics 对齐?",
    "可测性: 每条 Success Metric 可量化?",
    "边界: No-Gos 覆盖了容易蔓延的方向?",
    "假设标注: [ASSUMED] 都标了? 没有隐藏假设?"
  ])

  // Step 6: 用户最终确认
  finalDecision = askUserQuestion(
    "PRD 草稿完成",
    options: ["确认", "要修改", "重来"]
  )

  writePrd(draft, "docs/nocode/prds/{username}/{date}-{topic}.prd")
  return draft
```

#### BF3: devflow 衔接流

```
function devflowFullSuggestion(taskDescription):
  // 在 devflow Define Step 1 判 Full 场景后
  existingPrd = findFile("docs/nocode/prds/{username}/*.prd")

  if existingPrd:
    // 有 PRD, Define 直接读它
    return "已有 PRD: " + existingPrd + ", Define 将以此为输入"
  else:
    // 没有 PRD, 建议先走产品流
    suggestion = askUserQuestion(
      "Full 场景建议先做产品调研。要先走产品流吗？",
      options: [
        "走产品流 (research → prd)",
        "只做 research (不写 PRD)",
        "跳过, 直接 Define"
      ]
    )
    return suggestion
```

### 异常与失败模式

| 所属 BF | 场景 | 触发 | 处理 | 上抛/吞 |
|---|---|---|---|---|
| BF1 | 网络搜索失败 | Exa/WebSearch 不可用 | 跳过该切面, 标注"[网络不可用, 跳过]" | 吞(降级) |
| BF1 | 代码搜索失败 | semble-search 不可用 | 降级 Bash grep, 标注 fallback | 吞(降级) |
| BF1 | 用户选 0 个切面 | multiSelect 全不选 | 提示至少选一个 | 吞(重试) |
| BF2 | 无 research memo | 用户直接调 prd 没先 research | 降级为问答模式, 明说"无调研数据" | 吞(降级) |
| BF2 | 用户否决全部 user story | 全删 | 回 Step 2 重新 clarify | 吞(重试) |
| BF3 | 多个 .prd 文件 | 目录下有多个 PRD | 列出让用户选哪个 | 吞(交互) |

### 单测设计

| 所属 BF | Case | Given | When | Then |
|---|---|---|---|---|
| manifest | manifest 新增 research rule | manifest.json 含 research 条目 | `node hooks/generate.mjs --check` | exit 0, catalog 含 research 摘要 |
| manifest | manifest 新增 prd rule | manifest.json 含 prd 条目 | `node hooks/generate.mjs --check` | exit 0, catalog 含 prd 摘要 |
| manifest | trigger 正则匹配 | 用户消息 "帮我调研一下竞品" | 匹配 manifest triggers | 命中 research rule |
| manifest | trigger 负例不误命中 | 用户消息 "调试一下这个 bug" | 匹配 manifest triggers | 不命中 research rule |

## 方案选型

**Q1: 产品流用几个 skill？**
- 选项 A: 两个独立 skill (research + prd) — 可独立调起, 一阶段一 skill
- 选项 B: 一个合并 skill (product-flow) — 简单但不可独立
- **定**: A — "只调研不写 PRD"是真实场景 + 与项目已有 pattern 一致。→ 影响 BF1, BF2

**Q2: PRD 文档模板用什么？**
- 选项 A: Shape Up Pitch 5 要素 — 轻量
- 选项 B: 传统重型 PRD (20+ section) — 全面但过重
- 选项 C: Pitch 扩展 6 要素 + 补充字段 — 平衡
- **定**: C — 在 Pitch 基础上加 User Stories + Competitive Analysis + Success Metrics + Open Questions, 既不过重也不遗漏关键字段。→ 影响 BF2

**Q3: Research 怎么做并行探索？**
- 选项 A: 顺序执行各切面 — 简单但慢
- 选项 B: 并行 agent 各切面 — 快但复杂
- **定**: B — 各切面独立无依赖, 并行不增加复杂度, 参考 CrewAI 专职 agent 模式。→ 影响 BF1

**Q4: 假设标注用什么？**
- 选项 A: 单一 `[ASSUMPTION]`
- 选项 B: `[TBD]` + `[ASSUMED]` 双标注
- **定**: B — TBD (用户未决) ≠ ASSUMED (AI 编的合理值), 区分更精确。来源: brandonsgitstub PRD skill。→ 影响 BF2

## 其他

### 部署

- 版本号: 3.32.0 → 3.33.0 (minor: 新增 skill)
- 无灰度需求 (插件通过 git 分发)
- 验证: `node hooks/generate.mjs --check` + `node --test 'hooks/*.test.mjs'`
