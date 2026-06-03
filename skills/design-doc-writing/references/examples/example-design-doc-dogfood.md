---
type: design-doc
topic: design-doc-writing skill 从"问题驱动"重构为"维度驱动 + 方案选型集中"
date: 260520
author: 3dot141
status: implemented
last_updated: 260520
---

# Design Doc: design-doc-writing skill 维度驱动重构

> 这是 example, dogfood 本次 skill 重构本身. 演示新骨架在真实场景下的写法——读者学结构时直接对照本文件即可.

## 背景

**核心问题**: 上一版"问题驱动"骨架 (架构.问题拆解 + 实现.逻辑 X 三件套) 把"设计决策"与"实施细节"耦合在一个轴上, **读者读完一份 doc 找特定信息要满文件跳**——想看所有异常要逐个翻"逻辑 X.异常子节"、想看测试设计根本没节、想看部署也没节. 具体表现:

- reviewer 看异常表要 N 次 page scroll, 没办法一眼看全 (单测同理)
- 单测设计在原 skill 里被推给 plan, 但**设计阶段不定测试边界, plan 阶段定就晚了**——经常出现 "代码写完才发现某个 case 设计时没考虑"
- 部署策略 (灰度 / 回滚 / 监控) 在原 skill 里也推给 plan, 但**部署是设计决策, 不是实施细节**——灰度比例选 1% 还是 10% 是设计层 trade-off

**附带问题** (本 doc 一并解): 时序图缺失导致跨服务/异步场景的协作关系靠纯文字描述; 关键类图缺失导致 OOP 重构的静态结构得 reviewer 自己脑补.

不解决的代价: 设计文档对 reviewer "不友好"——同类信息分散; 对 plan 阶段"不充分"——测试/部署边界没定就开工.

## 目标

- 实现节同类信息**集中可扫**——异常一表、单测一节、reviewer 不跳节
- **单测设计 + 部署策略提进 design-doc**, 颗粒度精确定义与 plan / ops doc 的分界
- **方案选型独立成节**, 用 Q→选项→定 三行模板沉淀**设计过程**, 与"问题拆解"轴解耦
- 新增**时序图 + 类图**作为可选视觉工具

## 架构

### 架构图

无——本 doc 是 skill 内部文档结构调整, 无运行时组件交互. 架构层关注点是**文档骨架职责切分**.

### 流程图

writer 视角调用本 skill 的工作流 (与上版相同, 仅"读 reference"那步加载新骨架文件):

```
判断 doc-type (PRD/RFC/Design Doc/ADR)
       ↓
Read references/doc-types/<type>.md
       ↓
Read references/examples/example-<type>-*.md
       ↓
写初稿 (按新骨架: 背景→目标→架构→实现→方案选型→其他)
       ↓
spawn design-doc-reviewer subagent
       ↓
Report 原样呈现 → 用户逐条确认
       ↓
据用户决定修订 + 追加 Review Log
       ↓
(内部环节) references/rendering 渲染 HTML
```

### 时序图

无——单方文件改动, 无多角色异步交互.

### 文本总结

整体架构: design-doc 顶层骨架变为 6 节线性 (背景 / 目标 / 架构 / 实现 / 方案选型 / 其他). 与上版的"问题驱动"差异:

- 上版「架构.问题拆解 + 实现.逻辑 X 三件套」**按业务逻辑**切节, 信息分散
- 新版「实现 5 子节按维度切」(影响 / 接口设计 / 业务流 / 异常 / 单测设计) + 「方案选型独立沟通记录」, 信息按维度集中
- 业务流统一用 BF1/BF2 编号, 异常表、单测节通过 BF 编号交叉引用——维度独立但可追溯

下一节展开各 doc-type reference / SKILL.md / examples / reviewer-template 的具体改动.

## 实现

### 影响

```
nocode-evolve/
├── skills/design-doc-writing/
│   ├── SKILL.md                                   (改)  ① 《选 doc-type》骨架速记行更新为 6 节
│   │                                                    ② 《写作准则 #5》原"架构问题↔实现逻辑 1:1 映射"改为
│   │                                                       "方案选型↔业务流 BF 编号交叉引用"
│   │                                                    ③ 《实现的边界》节扩为 design-doc vs plan vs ops doc
│   │                                                       三层边界, 加单测设计、部署的归属
│   │                                                    ④ 《架构图 / 流程图》节扩名加时序图, 加三种图分工
│   │                                                    ⑤ 《影响文件节硬格式》改名《影响节硬格式》
│   │                                                    ⑥ 《看 examples 学结构》「问题数不要硬凑」改为
│   │                                                       「方案选型数量不要硬凑」
│   ├── references/
│   │   ├── doc-types/
│   │   │   └── design-doc.md                      (改)  全文按新骨架重写——核心改动文件
│   │   ├── examples/
│   │   │   ├── example-design-doc-dogfood.md      (改)  按新骨架重写——即本文件
│   │   │   └── example-design-doc-business.md     (改)  按新骨架重写
│   │   └── reviewer-template.md                   (改)  《核心审查》维度增删:
│   │                                                    ① 删除"架构问题↔实现逻辑 1:1 映射"维度
│   │                                                    ② 新增"方案选型 Q→选项→定 三行格式"维度
│   │                                                    ③ 新增"单测设计覆盖业务流主路径+异常"维度
│   │                                                    ④ 新增"部署节策略性 (灰度/回滚/监控)"维度
├── rules/
│   └── rule-superpowers-brainstorming.md          (改)  若涉及 design-doc 骨架描述, 同步新骨架
└── .claude-plugin/
    └── plugin.json                                (改)  version major 升 (破坏性骨架变更)
```

### 接口设计

各文档 reference / skill 文件的对外契约:

- **`design-doc.md` 对外契约**: doc-type 骨架定义文件, writer Read 后按此骨架写. 新骨架硬约束 6 顶层节 + 实现节 5 子节固定顺序 (影响→接口设计→业务流→异常→单测设计) + 业务流 BF 编号.
- **`SKILL.md` 对外契约**: 跨 doc-type 写作准则 + 工作流. 《写作准则》共 8 条, 编号 1-8 稳定 (#5 内容变了但编号保留).
- **`reviewer-template.md` 对外契约**: 单文件模板, reviewer subagent 接收 `{DOC_PATH}` 替换后 prompt; 核心审查维度 N 条 (新增 3 删 1, 净 N=原 N+2).

类图: 本次重构无新增类协作 (是文档结构改动), 不画.

### 业务流

**BF1 — design-doc.md 全文重写**

```
function rewriteDesignDocReference():                   // 主入口: 重写 design-doc 骨架定义
    backup("references/doc-types/design-doc.md")        // 旧版作 git history 留底, 不单独 backup
    skeleton = buildNewSkeleton([                       // 6 顶层节 + 实现 5 子节
        "背景", "目标", "架构", "实现",
        "方案选型", "其他"
    ])
    for each impl_subsection in [                       // 实现节 5 子节固定顺序
        "影响", "接口设计", "业务流",
        "异常与失败模式", "单测设计"
    ]:
        skeleton.addImplSubsection(impl_subsection)

    writeHardConstraints(skeleton, [                    // 关键约束条款写到文件开头
        "BF 编号机制",                                    // 业务流统一编号, 异常/单测交叉引用
        "Given/When/Then 三行/case",                     // 单测设计颗粒度
        "Q→选项→定 三行模板",                            // 方案选型紧凑形式
        "部署节策略性"                                    // 与 ops doc 边界
    ])
    writeWritingDiscipline(skeleton, 10)                // 末尾 10 条写作纪律 checklist
    write("references/doc-types/design-doc.md", skeleton)
```

**BF2 — SKILL.md 多节同步**

```
function syncSkillMd():                                  // 主入口: 串行 Edit 多处 SKILL.md
    skill = read("SKILL.md")
    // 7 处 Edit, 必须串行避免 old_string 冲突
    edit(skill, "选 doc-type 骨架速记", newSkeletonLine)        // 1
    edit(skill, "写作准则 #3 例子", "架构总结 → 文本总结")        // 2
    edit(skill, "写作准则 #5 整条", "方案选型↔业务流 BF 交叉引用") // 3 关键改动
    edit(skill, "Review Log 示例", "用新术语 BF/文本总结/影响")  // 4
    edit(skill, "实现的边界", "扩为三层 design-doc/plan/ops doc") // 5 关键改动
    edit(skill, "影响文件节硬格式", "改名 影响节硬格式")           // 6
    edit(skill, "架构图/流程图", "加时序图 + 三种图分工")          // 7 关键改动
    edit(skill, "问题数不要硬凑", "方案选型数量不要硬凑")          // 8

    verifyNoStaleTerms(skill, ["问题拆解", "逻辑 X",            // grep 检查残留旧术语
                                "架构总结", "影响文件", "关键契约"])
                                                            // 命中允许例外 (如 RFC 节里"问题拆解"仍存在)
```

**BF3 — example 重写 + reviewer 同步**

```
function rewriteExamplesAndReviewer():                  // 主入口: 重写 example + 同步 reviewer
    for each example in ["dogfood", "business"]:
        topic = pickTopic(example)                      // dogfood=本次重构, business=ContextCo SSO+MFA
        skeleton = readNewSkeleton()
        content = writeFullExample(topic, skeleton)     // 不省章节, 每节有内容
        annotateAtTop(content, "dogfood: " + topic)
        write("references/examples/example-design-doc-" + example + ".md", content)

    reviewer = read("references/reviewer-template.md")
    removeDimension(reviewer, "架构问题↔实现逻辑 1:1 映射")  // 旧维度过时, 删
    addDimension(reviewer, "方案选型 Q→选项→定 三行格式")    // 新维度
    addDimension(reviewer, "单测设计覆盖业务流主路径+异常")
    addDimension(reviewer, "部署节策略性 (灰度/回滚/监控)")
    write("references/reviewer-template.md", reviewer)
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | 旧 design doc 用旧骨架被读到 | 历史 doc 走 reviewer 流程 | reviewer 按新维度评, 允许 writer 在 Review Log 标 `legacy structure, 不迁移` | reviewer 上抛 |
| BF2 | Edit old_string 冲突 | SKILL.md 某处旧字符串与多处匹配 | 提供更长上下文使 unique, 或拆成多个 Edit | writer 即修 |
| BF2 | 旧术语残留 | grep 命中"问题拆解" / "逻辑 X" | RFC 节正常用"问题拆解", 不动; 其他位置必改 | writer 手判 |
| BF3 | example 与 reference 骨架不一致 | reference 改了 example 没跟 | reviewer 检查 example 是否符合自家 reference; 不符上 Critical | reviewer 上抛 |
| BF3 | reviewer 维度数文档残留旧值 | overlay 或 rule 描述里写"6 维度" | sanity grep 整仓库, 同步成新值 | writer 手判 |

### 单测设计

**BF1 — design-doc.md 全文重写**

- **case 1.1 主路径**: 6 顶层节 + 5 实现子节齐全
  - Given: 旧 design-doc.md 存在 (问题驱动骨架)
  - When: rewriteDesignDocReference 执行
  - Then: 新文件含「背景/目标/架构/实现/方案选型/其他」6 顶层节, 实现节子节顺序为「影响/接口设计/业务流/异常与失败模式/单测设计」

- **case 1.2 硬约束写入**: BF 编号机制存在
  - Given: 新 design-doc.md 已写
  - When: grep "BF1" / "BF 编号"
  - Then: 至少在《关键约束》《写作纪律》两节出现

- **case 1.3 异常 - 写入失败**
  - Given: 文件权限只读
  - When: Write 调用
  - Then: 工具报 error, BF1 不完成, task 1 保持 in_progress

**BF2 — SKILL.md 多节同步**

- **case 2.1 主路径**: 7 处 Edit 全部成功
  - Given: SKILL.md 原文存在所有 7 处 old_string
  - When: 7 次 Edit 串行
  - Then: 7 处全部替换, grep 旧术语只剩 RFC 节里的 "问题拆解" (允许例外)

- **case 2.2 异常 - old_string 不唯一**
  - Given: 某处 old_string 在文件中出现 ≥2 次
  - When: Edit 调用
  - Then: 工具报 "old_string is not unique" error, writer 提供更长上下文重试

**BF3 — example 重写 + reviewer 同步**

- **case 3.1 主路径**: 两份 example 按新骨架写完
  - Given: 新 design-doc.md 定义骨架已就绪
  - When: rewriteExamplesAndReviewer 执行
  - Then: 两份 example 头部 frontmatter `status: implemented`, 各节齐全无 `...省略...`, 顶部注明 dogfood 主题

- **case 3.2 reviewer 维度同步**
  - Given: reviewer-template.md 旧维度数 N
  - When: 删 1 加 3 同步
  - Then: 新维度数 N+2, 旧"1:1 映射"维度不出现

## 方案选型

### Q1: 「方案选型」节是替换「架构.问题拆解」还是平行存在?

**选项**: 替换 (删问题拆解, 改沟通记录) vs 平行 (两者都留, 拆解谈结论、选型谈过程) vs 嵌入 (选型回到问题里, 不独立顶层)
**定**: 替换. 因平行会让 reviewer 困惑 (同一决策为何两节都讲?), 嵌入回到上版老问题 (信息分散). 沟通记录形式 (Q→选项→定 三行) 既紧凑又保留设计 evidence. → 影响 BF1.

### Q2: 「实现」节内部按维度拆还是按业务逻辑拆?

**选项**: 按维度 (影响/接口/业务流/异常/单测 各自一节) vs 按逻辑 X (每条逻辑下三件套 业务流+契约+异常, 同上版)
**定**: 按维度. 因 reviewer 看异常表/单测要"一眼看全"; 维度拆同类信息集中, 业务流之间用 BF 编号交叉引用补可追溯性, 损失小于收益. → 影响 BF1, BF3.

### Q3: 「实现.单测设计」颗粒度到哪?

**选项**: 测试策略段落 (一段话讲层次) vs 按业务流列 case (Given/When/Then 三行/case) vs 详细到 test 代码骨架 (test class + describe/it 嵌套)
**定**: 按业务流列 case. 因策略段落太虚 reviewer 没法 challenge, 代码骨架越界 plan 工作. Given/When/Then 三行刚好让 reviewer 验证测试边界已定 + 不写代码. → 影响 BF1 单测设计节示例.

### Q4: 「其他.部署」节强度?

**选项**: 不进 design-doc (推给 ops doc) vs 进 design-doc 只写策略 (灰度/回滚/监控) vs 进 design-doc 写完整 runbook
**定**: 只写策略. 因灰度比例 / 回滚条件是**设计层 trade-off**, 不是实施细节, 必须 reviewer 在 design 阶段 challenge. 详细命令留给 ops doc. → 影响 BF1 部署节硬约束.

### Q5: 旧 design doc 是否需要 migration 工具?

**选项**: 写 migration 脚本 (旧"逻辑 X 三件套" → 新"BF + 维度集中") vs 不 migrate (旧文档加 `legacy structure` 标记继续用)
**定**: 不 migrate. 因 design doc 是 living document 但**历史 doc 价值在审计**, 强行迁移破坏 git history; 反而新 doc 用新骨架, 旧 doc 标 legacy. → 影响 BF3 异常表第 1 行.

## 其他

### 部署

无运行时部署. 本次改动是 Claude Code 插件源码文件修改, 通过 `plugin.json` version 升级 (major) 触发用户端 plugin marketplace 更新:

- **灰度策略**: 无——插件直接拉 git, 用户主动 update; 不分批
- **回滚预案**: 用户端 `nocode-evolve` 卸载或 git checkout 上一版 tag; 主仓 git revert + 再升 version (patch)
- **监控指标**: 无 metric——插件无运行时. 通过 GitHub issue / 用户反馈监控

---

> 本 example 演示结束. 真实 design doc 在此处追加 `## Review Log` 节 (含 reviewer Report + 用户决定 + 修订摘要), example 不带 Review Log 以保持骨架清晰.
