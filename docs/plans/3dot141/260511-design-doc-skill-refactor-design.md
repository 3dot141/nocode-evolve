---
type: implementation-refactor
topic: design-doc-writing skill 从扁平双轴重构为 doc-type 主轴 + reviewer subagent
date: 260511
author: 3dot141
status: approved
---

# design-doc-writing skill：从双轴模板到 doc-type 主轴 + reviewer 重构

> **TL;DR**：当前 skill 用 `layer × intent` 双轴，与业界 PRD/RFC/Design Doc/ADR 共识不对齐。重构为 4 个 doc-type 为主轴，layer 退为 design-doc 内部"系统级则叠加 architecture+implementation"的覆盖深度选择。新增 `design-doc-reviewer` subagent：6 维度核心审查（设计意图/决策依据/完整性/可执行/一致性/范围）+ humanizer 风格 AI 模式作附带检查 + 两遍法（self-audit）。overlay-superpowers.md step 5 加 write → review → revise 循环（最多 3 轮）。

## 现状（Pain Point）

调研主流共识（Docsio、Pretzer、Pragmatic Engineer、Abnormal AI、Thariq Shihipar 等多源）后，identified 5 个结构性差距：

### 1. doc-type 错位

`intent` 维度（feature/refactor/decision/bugfix）和业界标准 PRD/RFC/Design Doc/ADR 不对齐：

| 我们的命名 | 真实对应 | 问题 |
|---|---|---|
| `*-feature` | 像 PRD 又像 Design Doc | "feature" 不是文档类型 |
| `*-refactor` | Implementation/Migration Plan | 业界有专门类别 |
| `*-decision` | ADR | 但加 layer 维度产生 `implementation-decision` 这种几乎不存在的组合 |
| `*-bugfix` | 业界不写 design doc（用 incident retro） | 大多数 bug 不该有 design doc |

### 2. 未为 AI 重新设计格式

Abnormal AI 团队的关键反思（2026-03 文章）：

> "我们试图复用既有 design doc 模板给 AI，**失败了**。We had to redesign the format for AI, not just inject AI into the format we had."

他们的解决方案是"两半结构"：上半（人 review）+ 下半（agent implementation）。我们当前 references 是给人看的版本套了一层 AI 指引，没有显式的两半区分。

### 3. 没有 write/review 循环

业界领先 skill 都用 write/review subagent loop：
- `lemieux/rfc-skills`：rfc-writer + rfc-reviewer subagents
- `kk plugin` (serpro69)：专门 `review-design` skill
- `arkhe-claude-plugins`：`adr-critic`、`rfc-critic` agents

我们当前只写不审。

### 4. Goals / Non-Goals 不强制

业界 design doc 标配——"明确说出我们要做 X，**我们不做 Y**"。我们 references/intent/feature.md 没把 Non-Goals 提到主线节。

### 5. 缺 lifecycle 状态机

业界共识：
- ADR：proposed → accepted → superseded（accept 后**绝不改**，只 supersede）
- Design Doc：draft → in review → approved → implemented → archived（living during project）
- RFC：open → accepted → withdrawn

我们 frontmatter 有 `status` 字段但没明确定义状态机，更没区分 ADR 是 immutable vs design doc 是 living。

### 补充信号

当前仓库只有 1 份 design doc（`260509-wiki-update-command-design.md`）——dogfood 不充分。本次重构是机会同时建立 4 类 example，让后续 AI 看 examples 学习而不是只靠 SKILL.md 章节描述。

## 目标状态

```
skills/design-doc-writing/
├── SKILL.md                          # 主轴：4 doc-types；layer 退为 design-doc 内部深度
├── references/
│   ├── doc-types/                    # 取代原 intent/
│   │   ├── prd.md                    # 产品需求：what + why
│   │   ├── rfc.md                    # 提案 + 跨团队 feedback
│   │   ├── design-doc.md             # 详细设计，"两半结构 + 系统级 layer 叠加"
│   │   └── adr.md                    # 单一决策记录
│   ├── layer-supplements/            # 仅 design-doc 用
│   │   ├── architecture.md           # 系统级才叠加
│   │   └── implementation.md         # 所有 design-doc 都用
│   ├── common.md                     # cross-cutting concerns 必考虑 checklist
│   └── examples/                     # 4 份真实示例（dogfood）
│       ├── example-prd.md
│       ├── example-rfc.md
│       ├── example-design-doc.md
│       └── example-adr.md
└── agents/
    └── design-doc-reviewer.md        # 独立 reviewer subagent
```

frontmatter schema 演进：

```diff
- type: <layer>-<intent>           # 如 implementation-refactor
+ type: <doc-type>                 # prd | rfc | design-doc | adr
+ layer: <layer>                   # 可选，仅 design-doc 用
                                   # 单值 "implementation" 或叠加 "architecture+implementation"
+ last_updated: YYMMDD             # 整合更新时记录（仅 living 类型）
+ superseded_by: ADR-XXX           # 仅 ADR 用，accept 后被替代
```

reviewer 工作流（写在 SKILL.md + overlay-superpowers.md）：

```
1. design-doc-writing 产出初稿
2. spawn design-doc-reviewer subagent（独立 context）
3. reviewer 按 6 维度核心 + 附带检查 + self-audit 输出问题清单
4. writer 据 Critical + Warning 修订（Suggestion 可选）
5. 重跑 reviewer，最多 3 轮
6. 通过后调 design-doc-rendering skill 出 HTML
```

reviewer 核心审查 6 维度（按重要性排序）：

1. **设计意图是否清晰**——Problem 30 秒读懂？Goals 反映 Problem 的解法？Non-Goals 有实质意义？
2. **决策是否站得住脚**——关键选择有 evidence 还是拍脑袋？Alternatives 否决理由经得起推敲？Trade-offs 是真权衡还是 favorable framing？
3. **设计是否完整**——边界/依赖/失败模式/数据流/测试/cross-cutting 都考虑了吗？
4. **实施层面是否可执行**——下半部是具体文件/函数/数据 shape，还是抽象描述？
5. **内部一致性**——Goals 与方案对得上？章节互相不打架？frontmatter 与正文一致？
6. **范围是否合理**——过度设计 vs 欠考虑？文档长度与项目规模匹配？

附带检查（humanizer 风格，10 类抽样，非 critical）：significance inflation / filler phrases / AI vocabulary / vague attributions / generic conclusions / forced rule of three / copula avoidance / 章节空话 / 抄需求 / 抽象描述。

Self-Audit（humanizer 两遍法）：第一遍 checklist 完后，自问"假设我刚加入项目，读完仍不清楚什么？"

## 不属于本次重构

- 不动 `design-doc-rendering` skill（HTML 渲染层独立工作良好）
- 不动 `wiki-update` / `overlay-wiki` / `agent-about` 等其他 rule / skill
- 不动 `hooks/inject-rules.sh`（rules 自动扫描机制）
- 不引入新文档分发系统（如 Docusaurus）
- 不做迁移工具——旧 design doc 只有 1 份（`260509-wiki-update-command-design.md`），由用户决定直接删
- 不重命名插件（这是另一个独立任务）

## 迁移路径

按"先建后删"避免中间断态，每 phase 完后 git status clean，中间不发布。

| Phase | 动作 | 完成判据 |
|---|---|---|
| **1: 新建** | doc-types/ + examples/ + agents/ + layer-supplements/ 9 个新文件 | 与现有 intent/ 并存，hook 注入仍正常 |
| **2: 重写核心** | SKILL.md + common.md + overlay-superpowers.md | 工作流引用新结构 |
| **3: 删除旧** | intent/ + layer/ 原位 + 旧 design doc | 旧文件全清，仓库结构干净 |
| **4: 收尾** | plugin.json 0.10.1 → 0.11.0 + commit + push | 远端同步 |

## 回滚预案

任意 phase 失败：
- `git revert` 对应 commit（不涉及 DB / 外部 state）
- 旧 `intent/` + `layer/` 内容在 git history 可恢复
- `plugin.json` 降回 0.10.1

完全失败：废弃整个 refactor branch，回到 `0c2ea13`（design-doc-rendering 加 vibe rendering 后的状态）。

## 验证方式

完成后必跑：

1. **hook 注入验证**：执行 `inject-rules.sh` 看 4 个 rule 是否仍注入（agent-about / agent-guidelines / overlay-superpowers / overlay-wiki）
2. **dogfood 验证**：开新会话用新 skill 写一份测试 design doc，看：
   - AI 是否能正确选 doc-type
   - reviewer 是否真能产出 Critical 反馈（不只是 Pass）
   - write → review → revise 循环是否能跑通且收敛
3. **example 完整性**：4 个 example 都存在，frontmatter 字段齐全
4. **AI 选 type 准确性**：给 AI 4 个任务描述，看是否能正确选 PRD/RFC/Design Doc/ADR（目标 ≥3/4 准确）

## 接口签名

### `agents/design-doc-reviewer.md` subagent 契约

**输入**（spawn 时传入）：

```yaml
doc_path: <absolute path to design doc>
iteration: <1-3>
previous_report: <optional: 上一轮的 Review Report，迭代时可参考>
```

**输出**（markdown 格式 review report）：

```markdown
## Review Report
**Doc**: <path>
**Type**: <doc-type>
**Iteration**: <N> of 3

### ❌ Critical (must fix)
- ...

### ⚠️ Warning (should fix)
- ...

### 💡 Suggestion (optional)
- ...

### Self-Audit (2nd pass)
- ...

## Verdict
[Approved | Not approved — fix Critical + Warning, re-submit]
```

### `overlay-superpowers.md` step 5 改造

```diff
- 1. 调 design-doc-writing skill → markdown
- 2. 调 design-doc-rendering skill → HTML

+ 1. 调 design-doc-writing skill → markdown 初稿
+ 2. 进入 review loop：
+    a. spawn design-doc-reviewer subagent，传入 doc_path + iteration=N
+    b. reviewer 输出 Review Report
+    c. 若 Verdict=Approved：跳到步骤 3
+    d. 若 Verdict=Not approved 且 N<3：根据 Critical+Warning 修订 → N++ → 重跑
+    e. 若 N=3 仍 Not approved：报告"Max iterations，建议人工"，停止
+ 3. 调 design-doc-rendering skill → HTML
```

## 数据模型变更

frontmatter schema 变更已在「目标状态」节列出。

文件结构变更（已在「目标状态」节列出目录树）。

**无数据库变更**——纯文件系统重组。

## 错误处理

| 场景 | 处理 |
|---|---|
| AI 选 doc-type 不确定 | SKILL.md 给 fallback 规则：默认 design-doc（最通用） |
| reviewer 3 轮仍输出 Critical | 报告"Max iterations reached"，建议人工或简化 scope |
| writer 修订未真正 fix（reviewer 重复指出同一问题） | iteration 计数继续累加，3 轮强制停 |
| 重构期间有旧 frontmatter 格式（`type: implementation-feature`）的文档 | reviewer 检查 frontmatter，发现旧格式时报 Critical，建议迁移 |
| examples/ 文件中 frontmatter 与 doc-type 实际不符 | reviewer 拒绝该 example，要求修订 |

## 备选方案与取舍

考虑过的方案（按否决理由排序）：

- **保留双轴扩成 5 类**（加 prd 形成 prd/feature/refactor/decision/bugfix）。**否决**：和业界 4 类共识仍不对齐，layer×intent 笛卡尔积仍产生奇怪组合（`prd-architecture` / `bugfix-architecture`）。

- **完全去掉 layer**（只保留 4 doc-types）。**否决**：丢了"系统级（需架构思考）vs 小改动（只需实施细节）"的有用区分。系统级 design doc 不画框图就跑不通。

- **不做 reviewer subagent**（保持 single-pass）。**否决**：业界领先 skill（lemieux/rfc-skills、kk、arkhe）都有 reviewer loop，是质量差距的重要来源；humanizer 也强调两遍法的必要性。

- **reviewer 用 humanizer 全部 29 模式**（与 humanizer 1:1）。**否决**：技术文档场景不需要那么严——bold/em dash/title case 在 markdown 中是合理表达。缩减到 10 类核心模式，且降级为 warning/suggestion（非 critical）。

- **不重构，做表面补丁**（加 Non-Goals 节、明确 lifecycle，但保留双轴）。**否决**：双轴的 intent 错位是结构性问题，补丁救不了；后续 examples 写起来仍然别扭。

最终选：4 doc-types 主轴 + layer 退为深度 + reviewer subagent + 缩减版 humanizer patterns。

## 时间预算

按 phase 估算：

| Phase | 工作量 | 时间 |
|---|---|---|
| 1 新建 9 文件 | doc-types ×4 + examples ×4 + reviewer agent + 移动 layer-supplements | ~60 min |
| 2 重写 3 大改 | SKILL.md + common.md + overlay-superpowers.md | ~30 min |
| 3 删除旧 | intent/ + layer/ + 旧 design doc | ~5 min |
| 4 收尾 | 升版本 + commit + push | ~5 min |

**总计：约 100 分钟。**

注：examples/ 4 份可能拖时间——用本插件历史决策作为 dogfood 素材（PRD 写"nocode-toolkit"产品定义、RFC 写"是否引入 wiki 系统"、design-doc 写本次重构本身、ADR 写"reviewer 采用 humanizer 两遍法"）能复用现有思考，加速。
