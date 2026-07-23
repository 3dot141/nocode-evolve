---
type: design-doc
topic: 融合 writing-skills + skill-creator + SkillOpt 为统一 skill-writing skill
date: 260626
author: 3dot141
status: draft
last_updated: 260626
---

## 背景

核心问题：当前写 skill 有两个来源不同的工具——superpowers 的 `writing-skills`（TDD 方法论驱动）和 marketplace 的 `skill-creator`（eval 基础设施驱动），功能互补但各自不完整。用户要么只用其中一个丢掉另一半能力，要么同时装两个但不知道什么时候用哪个。

附带问题（本 doc 不解决）：
- skill 发现/触发率优化是更大的生态问题，不在本设计范围
- 上游 superpowers / skill-creator 各自迭代后的同步——本设计选择自主维护，嵌入的副本是冻结快照，后续更新由本仓库维护者按需手动同步

两个工具的具体缺口：

| 缺什么 | writing-skills | skill-creator |
|---|---|---|
| 量化 eval + benchmark | ❌ 无 | ✅ 有（scripts/ + eval-viewer/） |
| Description 自动优化 | ❌ 无（只有手写 CSO 理论） | ✅ 有（run_loop.py） |
| TDD 铁律（先看失败再写） | ✅ 有 | ❌ 无（先写再测） |
| Anti-rationalization 体系 | ✅ 有（persuasion-principles + red flags） | ❌ 无 |
| SkillOpt 迭代纪律 | ❌ 无 | ❌ 无 |
| Packaging（.skill 文件） | ❌ 无 | ✅ 有 |
| Blind comparison | ❌ 无 | ✅ 有 |

## 目标

产出一个 nocode-evolve 插件内置的 skill `skill-writing`，融合三方优势，同时保持独立发布为 marketplace `.skill` 的可能性：

1. **writing-skills 的 TDD 方法论**：先跑 baseline 看 agent 怎么失败，再写 skill
2. **skill-creator 的 eval 基础设施**：量化 benchmark、eval-viewer、description optimizer、packager
3. **SkillOpt 的迭代纪律**：train/validation split、validation gate、bounded edits、aggregate reflect

成功标准：
- 用户只装一个 skill 就能完成从构思到发布的完整 skill 创建流程
- TDD 铁律对所有 skill 类型强制——Phase 3 RED baseline 不可跳过，不因"参考型 skill 太简单"而绕过
- 每轮迭代有 validation gate 防退步
- 有/无 `claude` CLI 都能用（有 CLI 走脚本自动化，无 CLI 降级到 subagent）

### MVP 与后续迭代

**MVP（首版交付）**：SKILL.md 八阶段流程 + README.md + skill-creator 工具链搬入 + writing-skills 辅助文档搬入 + vendor 配置。目标：能跑通完整流程。

**后续迭代**（不在本次 scope）：
- Description optimization 自动化调优
- Blind comparison 集成
- 独立 marketplace `.skill` 打包发布

## 架构

### 来源 pin

| 来源 | 仓库 / 路径 | 版本 / commit | 许可证 |
|---|---|---|---|
| **skill-creator** | `claude-plugins-official` marketplace，Anthropic 官方 | sha `82f22ec4f0a73aa2564036ffc28a1da00c707e0c` | Apache 2.0（允许再分发） |
| **writing-skills** | `vendor/superpowers/skills/writing-skills/`，obra/superpowers | v5.1.0，commit `e4a2375c` | MIT |
| **SkillOpt** | microsoft/SkillOpt (GitHub) | 纪律概念引用，不搬代码 | — |

skill-creator 从已安装的 marketplace 插件路径 `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/` 直接复制到本仓库。Apache 2.0 许可允许再分发，保留 `LICENSE.txt` 即满足合规要求。

### 流程图

```
                    ┌──────────────────┐
                    │ Phase 1          │
                    │ Capture Intent   │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Phase 2          │
                    │ Interview &      │
                    │ Research         │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Phase 3          │
                    │ RED — Baseline   │
                    │ (所有 skill 类型  │
                    │  强制，不可跳过)  │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Phase 4          │
                    │ GREEN — Write    │
                    │ SKILL.md         │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ Phase 5          │
                    │ Eval — Run &     │
                    │ Review           │
                    └────────┬─────────┘
                             ↓
               ┌─────────────────────────────┐
               │ Phase 6                     │
               │ REFACTOR — Iterate          │
               │ (SkillOpt 四纪律)           │
               │                             │
               │ 6a. Aggregate Reflect       │
               │ 6b. Bounded Edits (≤3处)    │
               │ 6c. Validation Gate         │
               │     (held-out 不退步才接受) │
               │ 6d. 循环终止判断            │
               └──────────┬──────────────────┘
                          │
                  ┌───────┴───────┐
                  │ 验证集退步？  │
                  └───┬───────┬───┘
                   是 │       │ 否
                      ↓       ↓
               reject 回退   接受改动
               回 Phase 6a   ↓
                    ┌──────────────────┐
                    │ 收敛了？         │
                    └───┬──────────┬───┘
                     否 │          │ 是
                        ↓          ↓
                  回 Phase 5  ┌──────────────────┐
                              │ Phase 7          │
                              │ Description      │
                              │ Optimization     │
                              └────────┬─────────┘
                                       ↓
                              ┌──────────────────┐
                              │ Phase 8          │
                              │ Package          │
                              └──────────────────┘
```

### 目录结构图

```
skills/
└── skill-writing/
    ├── SKILL.md                           ← 主文档：八阶段流程 + 写作指南 + TDD 内化
    ├── README.md                          ← 导读：内容组织 / 快速上手 / 依赖说明
    │
    ├── skill-creator/                     ← 原 skill-creator 工具链（从 marketplace 复制）
    │   ├── LICENSE.txt                       Apache 2.0 许可证
    │   ├── scripts/
    │   │   ├── run_eval.py                   eval runner（调 claude -p）
    │   │   ├── run_loop.py                   description 优化循环
    │   │   ├── aggregate_benchmark.py        benchmark 聚合
    │   │   ├── improve_description.py        description 改进
    │   │   ├── generate_report.py            报告生成
    │   │   ├── package_skill.py              .skill 打包
    │   │   ├── quick_validate.py             快速校验
    │   │   └── utils.py                      公共工具
    │   ├── agents/
    │   │   ├── grader.md                     eval 评分 subagent
    │   │   ├── comparator.md                 blind A/B 比较 subagent
    │   │   └── analyzer.md                   benchmark 分析 subagent
    │   ├── eval-viewer/
    │   │   ├── generate_review.py            HTML viewer 生成
    │   │   └── viewer.html                   viewer 模板
    │   ├── assets/
    │   │   └── eval_review.html              eval set 审阅 HTML 模板
    │   └── references/
    │       └── schemas.md                    JSON schema 定义
    │
    └── writing-skills/                    ← 原 writing-skills 辅助文档（重组搬入）
        ├── anthropic-best-practices.md       Anthropic 官方 skill 写作指南
        ├── persuasion-principles.md          心理学原理（anti-rationalization）
        ├── testing-skills-with-subagents.md  subagent 压力测试方法
        ├── graphviz-conventions.dot          flowchart 样式规范
        ├── render-graphs.js                  flowchart 渲染脚本（graphviz-conventions 依赖）
        └── examples/
            └── CLAUDE_MD_TESTING.md          测试示例
```

writing-skills 原始布局是扁平的（所有文件直接在根目录），搬入时重组到 `skill-writing/writing-skills/` 子目录下。原 `SKILL.md`（655 行 TDD 方法论核心）的内容内化到新 skill 的 SKILL.md 八阶段流程中（Phase 3 RED + Phase 4 GREEN + anti-rationalization 体系），不再作为独立文件保留。

### 文本总结

整体架构是"一个 SKILL.md 主文档串联两套工具链"。主文档定义八阶段流程（Capture → Interview → RED → GREEN → Eval → Refactor → Description → Package），是用户唯一需要读的入口。TDD 知识（原依赖 `superpowers:test-driven-development`）内化到主文档的 Phase 3/4 中，无外部依赖。两个子目录 `skill-creator/` 和 `writing-skills/` 提供脚本和参考文档，主文档通过相对路径引用。README.md 做导读。

两套写作哲学的冲突调和：skill-creator 主张"解释 why 而非堆 MUST"，writing-skills 的 anti-rationalization 走权威强制路线。融合规则：**纪律型 skill 用 anti-rationalization（堵漏洞表 + red flags + 显式反驳），功能型 skill 用 explain-why 风格**。SKILL.md 在 Phase 4 写作指南中按 skill 类型给出不同写作风格指导。

核心约束：TDD 铁律对所有 skill 类型强制，SkillOpt validation gate 是硬 gate。

## 实现

### 影响

```
skills/
└── skill-writing/                                (NEW)  全新 skill 目录
    ├── SKILL.md                                  (NEW)  ① 八阶段流程主文档（含内化 TDD）
    ├── README.md                                 (NEW)  ② 导读文档
    ├── skill-creator/                            (NEW)  ③ 从 marketplace 插件复制
    │   ├── LICENSE.txt                                  Apache 2.0 许可证
    │   ├── scripts/                                     7 个 Python 脚本 + __init__.py + utils.py
    │   ├── agents/                                      3 个 subagent 指令
    │   ├── eval-viewer/                                 HTML viewer 生成器 + 模板
    │   ├── assets/                                      eval review HTML 模板
    │   └── references/                                  JSON schema 定义
    └── writing-skills/                           (NEW)  ④ 从 vendor/superpowers 重组搬入
        ├── anthropic-best-practices.md                  (1150 行)
        ├── persuasion-principles.md                     (187 行)
        ├── testing-skills-with-subagents.md             (384 行)
        ├── graphviz-conventions.dot
        ├── render-graphs.js                             ⑤ flowchart 渲染脚本（原版含，不可遗漏）
        └── examples/CLAUDE_MD_TESTING.md                (189 行)

vendor/superpowers/vendor-integration.json        (改)  ⑥ writing-skills action 改为 extract-to-skill
.claude-plugin/plugin.json                        (改)  ⑦ bump minor version（新增 skill）
```

**vendor-sync 策略**：不能用 `skip`（会删 `skills/writing-skills/` 但不会生成新位置的副本，违反"不要手动 cp/rm vendor skill"约束）。新增 vendor-integration action `extract-to-skill`：把 vendor 源文件同步到指定 skill 子目录（类似 `extract-references` 但目标是 skill 内部）。vendor-sync.mjs 需扩展支持此 action。在扩展完成前，首版用手动复制 + 在 vendor-integration.json 注释说明来源 pin，commit 前 `vendor-sync.mjs --check` 会 warn 但不阻断。

**迁移期触发冲突处理**：新 skill `skill-writing` 与被替代的 `writing-skills`（vendor）、`skill-creator`（marketplace）三者名称近似。迁移步骤：
1. 新 skill 落地后，vendor-integration 中 writing-skills 标为新 action（不再同步到 `skills/writing-skills/`）
2. 用户手动卸载 marketplace 的 skill-creator 插件
3. 新 skill 的 description 在 Phase 7 优化时明确包含"replaces writing-skills and skill-creator"，帮助 Claude 不误触旧 skill

### 业务流

本设计的"业务流"是 SKILL.md 八阶段流程中每个阶段的具体行为。

**BF1 — Capture Intent（理解用户想做什么 skill）**

```
function captureIntent(conversation):
    // 检查当前对话是否已有工作流可提取（用户说"把这个变成 skill"）
    if conversation.contains(workflow):
        extract(tools_used, step_sequence, corrections, io_formats)  // 从对话历史提取
        present_to_user_for_confirmation()                           // 确认提取结果
    // 无论是否从对话提取，都要回答 4 个核心问题
    ask("这个 skill 让 Claude 能做什么？")                            // 功能定义
    ask("什么时候应该触发？")                                         // 触发条件
    ask("期望的输出格式？")                                           // 输出约束
    // test cases 不在此决定——Phase 3 RED baseline 对所有 skill 类型强制
    determine_skill_type(intent)                                      // 纪律型 / 技巧型 / 模式型 / 参考型
    //   类型决定 Phase 3 的测试设计策略和 Phase 4 的写作风格
    return intent, skill_type
```

**BF2 — Interview & Research（深挖边界）**

```
function interviewAndResearch(intent, skill_type):
    ask_about(edge_cases, io_formats, example_files, success_criteria, deps)  // 逐个澄清
    check_available_mcps()                                                     // 看有没有能辅助调研的 MCP
    if mcps_useful:
        research_in_parallel_via_subagents()                                   // 有就并行调研
    // 等这步搞清楚了再往下走——不允许带着模糊边界进 Phase 3
    return refined_intent
```

**BF3 — RED Baseline（先看 agent 怎么失败——所有 skill 类型强制）**

```
function runBaseline(refined_intent, skill_type):
    // 按 skill 类型设计测试（来自 writing-skills 分类）
    // 所有类型都跑 baseline，不因"参考型太简单"跳过
    scenarios = design_pressure_scenarios(skill_type)
    //   纪律型：组合多种压力（时间 + 沉没成本 + 权威），≥3 个 scenario
    //   技巧型：应用场景 + 变体 + 信息缺失，≥3 个 scenario
    //   模式型：识别 + 应用 + 反例，≥3 个 scenario
    //   参考型：检索 + 应用 + 覆盖度，≥2 个 scenario
    // 最少 scenario 数保证 eval set split 后验证集 ≥ 3 条（见 BF5 eval set 规模约束）
    for each scenario in scenarios:
        result = spawn_subagent(scenario, skill=NONE)                // 不带 skill 跑
        record(result.choices, result.rationalizations, result.violations)  // 原文记录
    save_baseline_to_workspace()                                     // 保存到 workspace
    // 铁律：没看 agent 怎么失败，就不知道 skill 该教什么
    return baseline_results
```

**BF4 — GREEN Write SKILL.md（针对 baseline 失败写最小 skill）**

```
function writeSkill(baseline_results, refined_intent, skill_type):
    // 结构：frontmatter + Overview + 核心内容
    write_frontmatter(name, description)
    //   description 只写触发条件，不写流程摘要（CSO 原则）
    //   来源：writing-skills 发现 description 摘要流程会让 Claude 走捷径跳过正文
    write_overview(core_principle)
    // 写作风格按 skill 类型分
    if skill_type == DISCIPLINE:
        // anti-rationalization 路线：堵漏洞表 + red flags + 显式反驳
        // 参考 writing-skills/persuasion-principles.md
        for each rationalization in baseline_results.rationalizations:
            write_explicit_counter(rationalization)                   // 每条 rationalization 写显式反驳
        write_red_flags_table(baseline_results.rationalizations)     // 汇总成 red flags 表
    else:
        // explain-why 路线：解释重要性而非堆 MUST
        // 来自 skill-creator 的写作哲学
        write_with_reasoning(baseline_results.failures)              // 每个失败模式解释 why
    // Progressive Disclosure：SKILL.md < 500 行，超出拆到 references/
    // 最小化：只解决 baseline 暴露的问题
    return skill_path
```

**BF5 — Eval Run & Review（量化验证）**

```
function runEval(skill_path, baseline_results, refined_intent):
    // 5a. 创建 eval set + train/validation split
    // eval set 规模约束：最少 8 条（split 后训练集 ≥5、验证集 ≥3）
    //   来源：验证集 <3 条时 pass_rate 粒度太粗（33%/67%/100%），gate 判断是噪声
    eval_set = create_eval_prompts(refined_intent, baseline_results.scenarios)
    //   纪律型：baseline 的 pressure scenario 直接复用 + 补充新的
    //   功能型：写真实用户会说的话（具体、有细节、有场景）
    assert len(eval_set) >= 8                                         // 硬约束：最少 8 条
    train_set, validation_set = split(eval_set, ratio=0.6)           // SkillOpt 纪律 1
    assert len(validation_set) >= 3                                   // 硬约束：验证集 ≥3 条
    save_to("evals/evals.json")                                       // 含 split 标记

    // 5b. 并行跑 with-skill + baseline
    if cli_available("claude"):                                       // 检测 claude CLI
        run_with_scripts("skill-creator/scripts/run_eval.py")        // 自动化路径
    else:
        // 降级路径：subagent 手动跑
        // 最低可接受流程：每条 eval prompt 跑 1 次 with-skill + 1 次 baseline
        //   结果存 workspace/iteration-N/eval-ID/{with_skill,without_skill}/
        //   eval 完后手动填写 assertions 评分（pass/fail per assertion）
        run_with_subagents(eval_set, skill_path)                     // 回复明说"CLI 不可用，降级到 subagent"

    // 5c. 跑的同时起草 assertions
    draft_assertions(eval_set)                                        // 不等跑完就开始
    //   纪律型 skill 的断言重点：agent 是否在压力下仍合规
    //   主观输出（写作风格等）不强加断言，留给人工判断

    // 5d. Grade + Benchmark + Viewer
    grade(results, "skill-creator/agents/grader.md")
    aggregate("skill-creator/scripts/aggregate_benchmark.py")
    // score 定义：pass_rate = 通过的 assertion 数 / 总 assertion 数（per eval case）
    //   聚合分数 = 所有 case 的平均 pass_rate
    launch_viewer("skill-creator/eval-viewer/generate_review.py")    // HTML viewer
    // 重要：viewer 只展示训练集的结果给用户反馈
    //   验证集结果不在 viewer 中展示——保持 held-out 独立性
    //   验证集只用于 Phase 6 的 validation gate 判断
    feedback = read("feedback.json")                                  // 用户反馈（仅训练集）
    return feedback, train_set, validation_set, current_score
    //   current_score = 验证集上的聚合 pass_rate（首轮基准）
```

**BF6 — REFACTOR Iterate（SkillOpt 四纪律驱动迭代）**

```
function iterate(feedback, skill_path, train_set, validation_set, previous_score):
    // previous_score: 上一轮（或首轮）在 validation_set 上的聚合 pass_rate
    //   首轮由 BF5 返回；后续每轮 gate 通过后更新

    // 6a. Aggregate Reflect（SkillOpt 纪律 4）
    patterns = aggregate_across_cases(feedback)                       // 跨 case 归纳通用 pattern
    //   不为单个 case 定制修改——防 overfit
    //   纪律型 skill：还要从 transcript 提取新的 rationalization
    new_rationalizations = extract_from_transcripts(feedback.transcripts)

    // 6b. Bounded Edits（SkillOpt 纪律 3）
    edits = propose_edits(patterns, new_rationalizations)
    if len(edits) > 3:
        edits = prioritize_and_clip(edits, max=3)                    // 每轮最多 3 处 add/delete/replace
    apply(edits, skill_path)

    // 6c. Validation Gate（SkillOpt 纪律 2）
    new_score = run_on(validation_set, skill_path)                   // 在 held-out 40% 上重跑
    //   new_score = 验证集聚合 pass_rate（同 BF5 定义）
    //   reject 后不复用同一 feedback——回 Phase 5 重新跑 eval 拿新 feedback
    if new_score < previous_score:
        revert(edits)                                                 // 验证集退步 → reject 回退
        log("validation gate rejected: score {new_score} < {previous_score}")
        return REJECTED, previous_score                               // 回到 6a 换策略

    // 6d. 循环终止条件
    //   收敛定义：验证集 pass_rate 连续 2 轮变化 ≤ 验证集条数的倒数
    //   例：验证集 4 条 → 粒度 25% → 阈值 25%；10 条 → 10%；20 条 → 5%
    //   这样阈值自动适配样本粒度，不会出现小样本永远达不到 1% 的问题
    convergence_threshold = 1.0 / len(validation_set)
    if user_says_happy OR feedback_all_empty OR (abs(new_score - previous_score) <= convergence_threshold for 2 rounds):
        return CONVERGED, new_score
    else:
        return CONTINUE, new_score                                    // 回 Phase 5 重跑 eval
```

**BF7 — Description Optimization（优化触发准确率）**

```
function optimizeDescription(skill_path):
    // 生成 20 条 trigger eval（should-trigger + should-not-trigger）
    trigger_eval = generate_trigger_queries(20)                       // 8-10 should + 8-10 should-not
    //   should-trigger：不同措辞的同一意图，含用户不点名 skill 但明显需要的 case
    //   should-not-trigger：近似但不该触发的 case（关键词重叠但意图不同）
    present_for_review(trigger_eval, "skill-creator/assets/eval_review.html")
    approved_eval = read_user_export()                                // 用户审完导出

    if cli_available("claude"):
        result = run("skill-creator/scripts/run_loop.py", approved_eval, skill_path)
        //   60/40 split, 每轮跑 3 次取稳定触发率, 最多 5 轮
        best_description = result.best_description                    // run_loop 返回最优 description
    else:
        // 降级路径：手动测几轮
        // 每轮：修改 description → 手动测 5 条 should-trigger + 5 条 should-not → 统计触发率
        best_description = manual_test_rounds(approved_eval, skill_path)
    update_frontmatter_description(best_description)
```

**BF8 — Package（打包发布）**

```
function packageSkill(skill_path):
    run("skill-creator/scripts/package_skill.py", skill_path)        // 打包 .skill 文件
    //   需要 Python 3；不可用时告知用户手动 zip skill 目录
    present_skill_file_to_user()                                      // 告知用户文件路径
```

### 交叉引用矩阵

| Q（方案选型） | 影响 BF | 异常表行 | 测试 case |
|---|---|---|---|
| Q1（TDD 先行） | BF3, BF4 | BF3 subagent 失败 | case 3.1, 3.2 |
| Q2（SkillOpt 四纪律硬约束） | BF6 | BF6 连续 reject、overfit | case 6.1, 6.2, 6.3 |
| Q3（skill-creator 原样搬入） | BF5, BF7, BF8 | BF5 CLI 不可用、viewer 无浏览器 | case 5.1, 5.2 |
| Q4（TDD 内化） | BF3, BF4 | — | case 3.1 |
| Q5（CLI 降级） | BF5, BF7 | BF5 CLI 不可用、BF7 run_loop 不可用 | case 5.1, 5.2 |
| Q6（写作哲学调和） | BF4 | — | case 4.1, 4.2 |

### 异常与降级路径

| BF | 场景 | 触发 | 处理 | 上抛 or 吞 |
|---|---|---|---|---|
| BF3 | subagent 跑 baseline 失败 | subagent 超时或报错 | 重试 1 次；仍失败则报告用户，建议手动描述 baseline 行为 | 上抛（用户决定是否继续） |
| BF5 | `claude` CLI 不可用 | `which claude` 失败 | 降级到 subagent 手动跑 eval；回复明说"CLI 不可用，降级到 subagent" | 吞（降级路径） |
| BF5 | eval-viewer 无法打开浏览器 | headless 环境 | 用 `--static` 导出独立 HTML 文件 | 吞（降级路径） |
| BF5 | eval set 不足 8 条 | create_eval_prompts 产出不够 | 补充 prompt 直到 ≥8 条，不允许少于 8 条继续 | 吞（内部补足） |
| BF5 | Python 不可用 | eval 脚本无法运行 | 降级到 subagent 手动跑，跳过脚本自动化 | 吞（降级路径） |
| BF6 | validation gate 连续 reject 3 轮 | 每轮改动都让验证集退步 | 停下来问用户补约束（"你更在意 X 还是 Y？"） | 上抛（需要用户输入） |
| BF6 | 训练集分数提升但验证集退步 | overfit 到训练 case | reject 改动，换攻击角度重新 aggregate | 吞（内部重试） |
| BF7 | `run_loop.py` 依赖 `claude -p` | CLI 不可用 | 手动测几轮或跳过整个 Phase 7 | 吞（降级路径） |
| BF8 | `package_skill.py` 需要 Python | Python 不可用 | 告知用户手动打包（zip skill 目录） | 上抛（用户操作） |
| 搬入 | skill-creator 脚本内部相对路径失效 | 脚本从 marketplace 路径搬到 skill 子目录 | 搬入后逐个脚本测试 import 路径，修正 `__init__.py` 和相对 import | 吞（搬入时修正） |
| 搬入 | package 产物不被 marketplace 接受 | .skill 格式/元数据不符 marketplace 要求 | 后续迭代处理（MVP 不含独立发布） | 延后 |

### 单测设计

本设计产出的主体是 skill 文档，但搬入过程涉及脚本路径改写和 vendor 配置，这些可以测试。

**BF1 — Capture Intent**

- case 1.1：Given 对话中有工作流（用户说"把这个变成 skill"），When captureIntent，Then 提取 tools_used/step_sequence 非空并展示确认
- case 1.2：Given 对话中无工作流，When captureIntent，Then 逐个问 4 个核心问题

**BF3 — RED Baseline**

- case 3.1：Given 一个纪律型 skill 需求，When 跑不带 skill 的 subagent，Then 记录到 rationalization 列表非空
- case 3.2：Given 一个参考型 skill 需求，When 跑不带 skill 的 subagent，Then 记录到信息检索失败或不完整

**BF4 — GREEN Write**

- case 4.1：Given 纪律型 skill + baseline rationalizations，When writeSkill，Then 产出含 red flags 表 + 显式反驳
- case 4.2：Given 功能型 skill + baseline failures，When writeSkill，Then 产出用 explain-why 风格、无 MUST 堆砌

**BF5 — Eval**

- case 5.1：Given 有 `claude` CLI，When 跑 eval，Then 使用 `run_eval.py` 脚本路径
- case 5.2：Given 无 `claude` CLI，When 跑 eval，Then 降级到 subagent 路径并明说降级
- case 5.3：Given eval set 只有 6 条，When split，Then 报错要求补充到 ≥8 条

**BF6 — Validation Gate**

- case 6.1：Given 改动让验证集 pass_rate 提升，When 过 gate，Then 接受改动，更新 previous_score
- case 6.2：Given 改动让验证集 pass_rate 下降，When 过 gate，Then reject 改动并回退
- case 6.3：Given 连续 3 轮 reject，When 再次进入 gate，Then 停下来问用户补约束

**BF7 — Description Optimization**

- case 7.1：Given 有 CLI，When optimizeDescription，Then 调 run_loop.py 并更新 frontmatter
- case 7.2：Given 无 CLI，When optimizeDescription，Then 走手动测试轮

**BF8 — Package**

- case 8.1：Given Python 可用，When packageSkill，Then 产出 .skill 文件
- case 8.2：Given Python 不可用，When packageSkill，Then 告知用户手动 zip

**搬入验证**

- case 搬入.1：Given skill-creator 脚本搬入后，When `python -c "from scripts import run_eval"`，Then import 成功
- case 搬入.2：Given vendor-integration 更新后，When `node scripts/vendor-sync.mjs --check`，Then 不报 writing-skills 漂移

## 方案选型

### Q1: 两个 skill 的方法论冲突（先写再测 vs 先测再写）怎么处理？

**选项**: A（TDD 先行：先 RED 再 GREEN）vs B（灵活切换：默认 TDD 但允许跳过）vs C（按 skill 类型分）
**定**: 选 A。因 writing-skills 的实测发现，不看 baseline 写出的 skill 系统性地漏掉 agent 实际会用的 rationalization；B 的"允许跳过"在实践中变成"总是跳过"。→ 影响 BF3, BF4

### Q2: SkillOpt 迭代纪律以什么强度融入？

**选项**: A（四纪律全部硬约束）vs B（可选严格模式）vs C（gate 硬约束其余软约束）
**定**: 选 A。因 B 的"可选严格模式"在纪律型 skill 上会被 agent 合理化跳过——正是 anti-rationalization 要堵的 loophole；C 只保 gate 但放开 bounded edits 容易一次大改引入不可控退步。四纪律成本（每轮多跑一次验证集）远低于回退重做的成本。→ 影响 BF6

### Q3: skill-creator 的 Python 工具链怎么处理？

**选项**: A（从 marketplace 复制到 skill-writing/skill-creator/）vs B（搬入但精简）vs C（不搬，运行时引用）
**定**: 选 A。因 B 精简需要逐脚本判断哪些可删（7 个脚本 + 3 个 agent 相互引用），判断成本 > 搬入成本（总共 ~2600 行）；C 依赖用户同时装两个插件，违反"一个 skill 搞定"的目标。→ 影响 BF5, BF7, BF8

### Q4: writing-skills 对 superpowers:test-driven-development 的外部依赖怎么处理？

**选项**: A（内化 TDD 知识）vs B（保留软依赖）vs C（保留硬依赖）
**定**: 选 A。因 C 要求用户同时装 superpowers 插件（新用户门槛高）；B 的"如果装了更好"在实践中变成"没装也凑合"，TDD 纪律退化。内化的成本是 SKILL.md 多 ~100 行，可接受。→ 影响 BF3, BF4

### Q5: 无 `claude` CLI 时怎么办？

**选项**: A（原样保留，文档说明跳过）vs B（有 CLI 走脚本，无 CLI 降级到 subagent）
**定**: 选 B。因 A 让无 CLI 用户完全无法量化验证——eval 是融合版的核心新能力，不能因环境限制整个丢掉。降级路径的 subagent 手动跑虽然慢，但覆盖率 100%（每条 eval 都能跑到）。→ 影响 BF5, BF7

### Q6: 两套写作哲学冲突（explain-why vs anti-rationalization MUST）怎么调和？

**选项**: A（统一用 explain-why）vs B（统一用 anti-rationalization）vs C（按 skill 类型分）
**定**: 选 C。因 A 对纪律型 skill 太软（agent 会把"为什么重要"理解成"可以灵活处理"）；B 对功能型 skill 太硬（MUST 堆砌让 reference 型 skill 读不下去）。按类型分的判据清晰：纪律型 = 有"违反/合规"之分的 skill，其余 = 功能型。→ 影响 BF4

## 其他

### 发布与版本

- **首版载体**：nocode-evolve 插件内置 skill（落在 `skills/skill-writing/`，随插件升版本走 CLAUDE.md 规则 2）
- **独立 marketplace 发布**：后续迭代考虑，MVP 不含
- **依赖**：Python 3（eval 脚本）、`claude` CLI（可选，有则自动化、无则降级）
- **许可证**：skill-creator 的 Apache 2.0 `LICENSE.txt` 保留在 `skill-creator/` 子目录内
- **版本号**：本次改动涉及 `skills/` 目录新增，按 CLAUDE.md 规则 2 bump `.claude-plugin/plugin.json` minor 版本

### 后续工作

1. 实现 SKILL.md 主文档（八阶段完整内容 + TDD 内化 + 写作风格按类型分）
2. 实现 README.md 导读（内容组织 / 依赖说明 / 快速上手 / 与 writing-skills 和 skill-creator 的关系）
3. 从 marketplace 路径复制 skill-creator 工具链到 `skills/skill-writing/skill-creator/`，逐脚本测试 import 路径并修正
4. 从 `vendor/superpowers/skills/writing-skills/` 重组搬入辅助文档到 `skills/skill-writing/writing-skills/`（含 render-graphs.js）
5. 修改 `vendor/superpowers/vendor-integration.json`（新 action 或注释说明）
6. Bump `.claude-plugin/plugin.json` minor 版本
7. 卸载 marketplace 的 skill-creator 插件（用户操作）
8. （后续）扩展 vendor-sync.mjs 支持 `extract-to-skill` action

## Review Log

### Review 1 — 2026-06-26

**Reviewers**: GP (general-purpose Claude subagent) + Codex (OpenAI 跨模型)

#### GP Report

**Critical:**
- C1: skill-creator 没有 source pin，实施第一步就卡住
- C2: TDD 铁律 vs BF1"参考型 test cases 可选"自相矛盾

**Warning:**
- W1: validation gate eval set 最小规模未定义，1% 阈值与小样本冲突
- W2: 三个 skill 撞名，迁移期触发冲突
- W3: render-graphs.js 被丢掉，writing-skills SKILL.md 去向未交代
- W4: "原样搬入"与实际重组矛盾
- W5: 两套写作哲学冲突未调和
- W6: LICENSE.txt 不在目录结构里，发布载体未定

**Suggestion:** S1 Q2 否决理由; S2 vendor-sync 维护含义; S3 SKILL.md/README.md 骨架
**Open Questions:** Q1 skill-creator 源; Q2 许可证; Q3 发布载体
**Self-Audit:** SA1 搬入无米下锅; SA2 eval set 规模未定义

#### Codex Report

**Critical:**
- C1: skill-creator 来源与集成路径缺失（与 GP C1 同根）
- C2: vendor-sync 方案与仓库约束冲突
- C3: validation gate 定义不完整（previous_score/score 计算/held-out 独立性）

**Warning:**
- W1: 方案选型否决理由不量化（与 GP S1 同根）
- W2: 异常表覆盖不足
- W3: 单测设计不足（缺 BF1/2/4/7/8）
- W4: BF 伪代码数据流断点（intent 未传入、previous_score 未定义）
- W5: 范围偏大，缺 MVP 边界
- W6: AI Writing Patterns（强判断先行、证据后置）

**Suggestion:** S1 来源清单; S2 vendor 策略; S3 交叉引用矩阵; S4 eval artifact schema; S5 plugin 约束
**Open Questions:** Q1 skill-creator 源码; Q2 发布载体; Q3 迁移/alias; Q4 validation set 可见性; Q5 无 CLI 最低流程
**Self-Audit:** SA1-SA5 只读审查，卡在 skill-creator 来源 + vendor-sync + validation gate 契约

**用户决定**: 全修

**本轮修订**：
- GP-C1 / Codex-C1：新增「来源 pin」节，标明 skill-creator 来源（marketplace sha `82f22ec4`，Apache 2.0）、writing-skills 来源（superpowers v5.1.0）
- GP-C2：删除 BF1 中"参考型可选"，改为所有类型强制 Phase 3 RED baseline；更新成功标准措辞
- Codex-C2：影响节新增 vendor-sync 策略说明（新增 `extract-to-skill` action，首版手动复制 + 注释 pin）
- Codex-C3 / GP-W1：BF5 定义 score = pass_rate、eval set 最少 8 条（验证集 ≥3）；BF6 定义 previous_score 来源、收敛阈值自适应样本粒度（1/N）；明确 viewer 只展示训练集
- GP-W2：新增迁移期触发冲突处理步骤
- GP-W3：目录结构补 render-graphs.js；说明 writing-skills SKILL.md 内容内化去向
- GP-W4：措辞"原样搬入"改为"重组搬入"
- GP-W5：文本总结新增写作哲学调和规则 + 新增 Q6 方案选型
- GP-W6 / Codex-Q2：目录结构补 LICENSE.txt；发布节明确首版载体为 nocode-evolve 内置 + bump plugin.json
- Codex-W2：异常表补 5 行（eval set 不足、Python 不可用、脚本路径失效、package 产物不符）
- Codex-W3：单测设计补 BF1/BF4/BF7/BF8 + 搬入验证 case
- Codex-W4：BF 伪代码修正数据流（intent → refined_intent 传参、previous_score 显式传参、best_description 显式赋值）
- Codex-W5：新增 MVP 与后续迭代节
- Codex-W6 / GP-S1：Q1-Q5 否决理由补量化论证
- GP-S2：背景附带问题补充维护含义说明
- Codex-S3：新增交叉引用矩阵
- Codex-S4：BF5/BF6 内定义 eval artifact schema（score 定义、split 标记、feedback scope）
- Codex-S5：发布节补 plugin.json 版本约束

**Open Questions 答复**：
- GP-Q1 / Codex-Q1：skill-creator 源自 Anthropic 官方 marketplace，Apache 2.0 许可，已在「来源 pin」节标明
- GP-Q2：Apache 2.0 允许再分发，合规
- GP-Q3 / Codex-Q2：首版为 nocode-evolve 内置 skill，独立 marketplace 发布留后续迭代
- Codex-Q3：writing-skills 的 vendor-sync skip 后 `skills/writing-skills/` 被清理；已有 rule 引用在实现阶段逐个更新
- Codex-Q4：validation set 不在 viewer 中展示，保持 held-out 独立性（已写入 BF5）
- Codex-Q5：最低流程已写入 BF5 降级路径注释
