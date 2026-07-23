---
type: design-doc
topic: 把 rule/command 统一成 skill 体系，新增 nocode-evolve:route 路由入口，触发改由 skill 承载
date: 260602
author: 3dot141
status: approved
last_updated: 260602
---

# Design Doc: skillify-route — 规则与命令统一成 skill 体系

## 背景

**核心问题（主因）：触发机制脆弱。** 现在「插件级规则该不该在某个任务点生效」靠两条软通道：

1. SessionStart 把 `model/agent-catalog.md`（路由表）**常驻注入** context，指望 agent 响应任务前自己扫表、命中后 `Read` 对应 `rules/rule-*.md`。
2. UserPromptSubmit hook（`trigger-resurface.mjs` + `triggers.json`）拿正则匹配用户消息，命中追加一行提醒。

第 1 条出过事：2.9.1 之前 `inject-rules.sh model` 把 4 个 model 文件合并成**一个** hook command 输出，合计 **12391 字符**（= `agent-about.md` 2925 + `agent-karpathy.md` 2558 + `agent-personal.md` 2340 + `agent-catalog.md` 4568，`wc -m` 实测，不含 project 段），超过 hook `additionalContext` 的 10000 字符 per-command 截断阈值（外部前提，见文末《外部前提》），整坨被存盘、context 里只留前 2KB preview——排在末尾的 `agent-catalog.md` 路由表**实际没进 context**，第 1 层防御静默失效。**该截断已于 2.9.1 拆成每文件一 command 止血**（现状 `hooks/hooks.json` 已是 5 个独立 segment），所以 12391 是「合并时」的旧字符数、不是当前注入量。但止血只解决了「截断」，没解决根：catalog 进了 context 不等于 agent 每个任务点都去扫它，深度负载下「知道却没在那刻行动」仍会发生——触发可靠性始终赌在「agent 自觉扫常驻表」上。

**辅因（本 doc 一并解，但不是动机核心）：**

- **机制割裂**：`commands/`（distill / sow / task / rule-eval，用户打 `/x` 触发）与 `skills/`（bkt / design-doc-* / red-blue-deep / signoz-cli，description 自动触发）是两套写法，认知不统一。实际上 Claude Code 已把 command 合并进 skill——同一套机制两种文件形态（见《外部前提》）。
- **常驻成本随增长逼近阈值**：catalog 4568 字符占常驻注入近四成（4568/12391 = 37%），每加一条 rule 就更逼近 10000 阈值，止血只是把它推远一点。

**不解决的代价**：规则触发率始终赌在「agent 自觉扫常驻表」上，无法收敛成一个确定动作；commands 与 skills 长期分裂，新增能力要先决定「写 command 还是 skill」。

## 目标

把目标拆成**动作收敛**（确定的）与**触发率提升**（概率的，多通道叠加）两件事——这是对 review C5「目标 vs 实现自洽」的回应：三重触发本质仍是软的，不宣称 100% 命中，但显著优于单通道。

- **动作收敛（确定）**：agent 从「自己判断该 `Read` 6 个 `rule-*.md` 里的哪个」收敛为「调一个 `nocode-evolve:route` skill 拿路由表」。一旦 route 加载，后续「读哪条 rule」是查一张表的确定动作，不再是分散的 6 选 1 软判断。
- **触发率提升（概率，可量化）**：route 被加载靠三重通道叠加（常驻精简提示 → skill description 自动触发 → agent/用户主动 `Skill()`），把加载率从「单通道软匹配」**显著抬高**——不是保证 100%，残余漏触发由 PreToolUse 硬拦截对关键命令（`bkt PUT` / 裸 curl）兜底。改造前后用 `rule-eval` 跑 route-recall 量化对比（见《部署》go/no-go）。
- **常驻注入字符数下降**：从 12391 降到约 **7700**（见下方预算表），且不再有任一 command 逼近 10000 阈值。
- **command 全部 skill 化**：distill / sow / task / rule-eval 迁成 `skills/<name>/SKILL.md`；操作型加 `disable-model-invocation: true`，只手动 `/调`、不被 harness 自动触发，且其 description 不占常驻 context。
- **触发层做减法不裸奔**：UserPromptSubmit 正则层（`trigger-resurface.mjs` + `triggers.json`）退役；`PreToolUse` 硬拦截层**原样保留**——skill 是软加载，拦不住 Bash 命令执行。

### 常驻注入预算（改造后，回应 review Q2）

| 段（SessionStart command） | 改造前字符 | 改造后字符 | 说明 |
|---|---|---|---|
| `agent-about.md`（+ §3 删除护栏） | 2925 | ~3706 | 吸收原 agent-personal §3（781 字符，安全护栏须常驻） |
| `agent-karpathy.md` | 2558 | 2558 | 不变 |
| `agent-catalog.md`（精简版） | 4568 | ~1400 | 仅 4 桶触发摘要 + 「调 route」，rule 细节下沉到 route 正文 |
| `agent-personal.md` | 2340 | 0 | §1/§2（1291 字符）挪进 route 正文②段；§3 挪进 about |
| **插件常驻合计** | **12391** | **~7664** | 降 ~38%；最大单段 about ~3706，远低于 10000 |
| `project`（项目 `.agents-personal/AGENTS.md`） | 运行时 | 运行时 | 不计入插件常驻，保留常驻（见方案选型 Q7） |

route 正文（约 4568 路由 + 1291 项目本地 + behavior 内联）是**按需加载**，不计入常驻。

## 架构

### 架构图

改造前后的「注入 + 触发」结构对比（组件 ≤ 7）：

```
                     改造前                                      改造后
─────────────────────────────────────────────────────────────────────────────────
SessionStart   ┌─ about / karpathy / personal       SessionStart  ┌─ about(+§3护栏) / karpathy
(常驻)         ├─ catalog.md  全路由表 4568 字符     (常驻)        └─ catalog.md  精简~1400: 粗桶+「调 route」
               └─ project AGENTS.md                                   (合计 ~7664, 无段逼近 10000)
                                                                          │ 提示「调 route」
UserPromptSubmit  triggers.json 正则 → 提醒 Read     skills/route/SKILL.md  ◄── 三重触发
                                                       正文 ① 完整 rule 路由(→ rules/rule-*.md)
PreToolUse        pretooluse-rules.json 硬拦截              ② 项目本地: .agents-personal wiki/AGENTS 检索(原 personal §1/§2)
                                                            ③ behavior 型(git-inspection/freshness) 内联

rules/rule-*.md   catalog 指向, 按需 Read            rules/rule-*.md   route 指向, 按需 Read (不变)
commands/*.md     /x 触发                            skills/{distill,sow,task,rule-eval}/  /x 触发(skill)
                                                       PreToolUse 硬拦截              (原样保留)
                                                       UserPromptSubmit + triggers   (退役删除)
```

### 流程图

route 加载的判定（回应 review S3，用判定表替代纯流程图，暴露兜底边界）：

| 当前状态 | route 已在 context? | 触发通道命中 | 动作 |
|---|---|---|---|
| 非工程任务（纯事实/闲聊） | — | — | 不加载 route（**设计允许**，本就不需要） |
| 工程任务，route 未加载 | 否 | 第1重：agent 读到 catalog 精简提示 | 主动 `Skill(route)` → 加载 ✓ |
| 工程任务，route 未加载 | 否 | 第2重：harness description 匹配任务 | 自动加载 ✓ |
| 工程任务，route 未加载 | 否 | 第3重：agent 自觉「不确定有无规则」 | 主动 `Skill(route)` → 加载 ✓ |
| 工程任务，route 未加载 | 否 | **三重全未命中**（低概率） | route 不加载；PreToolUse 对关键命令仍硬拦截兜底（**残余风险，可接受**） |
| 任意 | 是 | — | 不重复加载（加载一次语义，见《外部前提》） |

### 时序图

无——无多角色异步交互；加载链是单向判定（见流程图判定表）。

### 文本总结

整体架构为：**一个常驻「精简路由 + 入口提示」+ 一个按需加载的 `route` 路由 skill + 不变的 rule 内容文件 + 保留的 PreToolUse 硬拦截**。关键组件分工——`model/agent-catalog.md`（精简版 ~1400 字符）只承担「粗桶触发词 + 指向 route」，是第 1 重触发兼常驻提示；`skills/route/SKILL.md` 承载完整路由（插件 rule 路由 + 项目本地资源检索约定 + behavior 型规则内联），是 agent 拿到「该读哪条 rule」的单一权威；`rules/rule-*.md` 不动，仍是按需 `Read` 的内容载体；`hooks/pretooluse-guard.mjs` + `pretooluse-rules.json` 不动，继续做命令级硬拦截。三者通过 `rules/manifest.json` 单源生成保持一致：manifest 同时渲染「精简 catalog」「route 正文的 rule 路由段」「pretooluse 规则」。核心约束：route 的三重触发互为兜底（任一通道命中即加载，且只加载一次），但**不宣称必中**——残余漏触发是设计接受的代价，由 PreToolUse 对关键命令兜底；安全护栏类规则（删除 `.agents-personal` 二次确认）**不能**进 route（加载有延迟），必须留常驻 `agent-about.md`。

## 实现

### 影响

```
nocode-evolve/
├── skills/
│   ├── route/                                  (NEW) 统一路由入口 skill
│   │   └── SKILL.md                            (NEW) ① frontmatter: 完整 description(见接口设计), 不加 disable-model-invocation
│   │                                                 ② 正文 = 生成区(rule 路由表, marker 圈定) + 手写区(项目本地§1/§2 + behavior 内联)
│   ├── distill/SKILL.md                        (NEW) ← commands/distill.md 迁入 + disable-model-invocation: true
│   │                                                 + rewrite 旧引用(见 BF3): catalog 三步联动→route, commands/sow→skills/sow
│   ├── sow/
│   │   ├── SKILL.md                            (NEW) ← commands/sow.md 迁入 + disable-model-invocation: true
│   │   │                                             + 脚本调用路径 commands/sow-reference/→${CLAUDE_PLUGIN_ROOT}/skills/sow/sow-reference/
│   │   └── sow-reference/                      (NEW) ← commands/sow-reference/ 整目录挪入 (supporting file)
│   ├── task/SKILL.md                           (NEW) ← commands/task.md 迁入 + disable-model-invocation: true
│   └── rule-eval/SKILL.md                      (NEW) ← commands/rule-eval.md 迁入 + disable-model-invocation: true; eval 对象 catalog→route(见 BF5)
├── commands/                                   (删) 整目录移除——4 文件 + sow-reference 已迁入 skills/
├── model/
│   ├── agent-catalog.md                        (改) 精简为「4 粗桶触发词 + 命中调 nocode-evolve:route」, 删每条 rule 细节(下沉 route 生成区)
│   ├── agent-personal.md                       (删) §1/§2 挪进 route 正文②段; §3(含末尾 $USER_VAULT_PATH 护栏)挪进 agent-about.md
│   ├── agent-about.md                          (改) 吸收原 agent-personal §3 完整删除护栏(含 vault 护栏段, 安全 gate 须常驻)
│   └── agent-karpathy.md                        —    (不变)
├── hooks/
│   ├── hooks.json                              (改) ① 删 model-personal segment ② 删整个 UserPromptSubmit 块
│   ├── inject-rules.sh                         (改) ① 删 model-personal 分支 ② model-catalog 段注入精简版
│   │                                                 ③ sanity 孤儿检查 grep 目标从 agent-catalog.md 改 skills/route/SKILL.md (现 :64-73)
│   ├── trigger-resurface.mjs                   (删) UserPromptSubmit 退役
│   ├── triggers.json                           (删) 生成物退役
│   ├── generate.mjs                            (改) 大改(见接口设计/BF4): 删 genTriggers; 改 targets(); 重写 genCatalog→genCatalogSlim;
│   │                                                 新增 genRouteTable + patchGeneratedRegion(marker 区间替换, 现 renderAll :75-80 是整文件覆盖, 无此能力)
│   ├── generate.test.mjs                       (改) 删 triggers 断言; 加 catalogSlim/routeRegion/patchGeneratedRegion 断言
│   ├── pretooluse-guard.mjs                     —    (不变)
│   └── pretooluse-rules.json                    —    (不变, 仍由 manifest 生成)
├── rules/
│   ├── manifest.json                            —    (结构不变, 见接口设计 W3) buckets/rules/triggers/pretooluse 字段全留; 仅 triggers 渲染目标变(进 route 正文, 不再写 triggers.json)
│   └── rule-*.md                                —    (不变) route 指向, 按需 Read
└── .claude-plugin/
    └── plugin.json                             (改) version → 3.0.0 (major: 路径迁移 + catalog 语义反转 + hook 退役)
```

### 接口设计

纯插件源码改造，无对外 API / 无 DB。本节列四个内部契约。

#### `skills/route/SKILL.md` frontmatter 契约（回应 review C3）

完整 description（不再占位符；控制在 ~220 字符，远低于官方 1536 截断；不加 `disable-model-invocation`——route 要自动触发）：

```yaml
---
name: route
description: 工程任务规则路由入口。开始任何 git 生命周期(提 PR/push/合并/收尾/worktree)、代码评审/独立验证、设计文档/PRD/RFC/方案选型、会话沉淀类任务前加载，给出插件级规则路由表 + 项目本地资源(.agents-personal wiki/rules)检索约定。不用于：纯只读查询、纯事实问答、与工程规则无关的对话。
---
```

- **正例触发**：「帮我提个 PR」「这个方案选 A 还是 B」「写个 RFC」「review 一下改动」「沉淀这次会话」
- **负例（不触发）**：「这个函数干嘛的」「git log 看一下」「今天几号」
- **长度预算**：description ≤ ~220 字符（官方 1536 截断内）；正文无硬上限（按需加载，不占常驻）。

#### `model/agent-catalog.md`（精简版）契约

整文件由 manifest 生成。内容收缩为：每个粗桶一行触发摘要 + 统一尾句「命中任一桶 → `Skill(nocode-evolve:route)` 拿完整路由」。不再含单条 rule 的 `读`/`摘要`/`guard`（下沉到 route 正文生成区）。目标体量 ~1400 字符。

#### `hooks/generate.mjs` 生成物映射（改后，回应 review W1/W3）

| 源（manifest 字段，**结构不变**） | 目标 | 变化 |
|---|---|---|
| buckets | `model/agent-catalog.md` | `genCatalog` → `genCatalogSlim`：由「全路由表」改为「精简桶表 + 调 route」 |
| buckets + rules | `skills/route/SKILL.md` 生成区 | **新增 `genRouteTable`**：渲染完整 rule 路由进 marker；**`patchGeneratedRegion` 为新增能力**（现 `renderAll` 整文件覆盖，要新写 marker 解析 + 区间替换） |
| rules[].pretooluse | `hooks/pretooluse-rules.json` | `genPretooluse` 不变 |
| rules[].triggers | ~~`hooks/triggers.json`~~ | **退役**：`genTriggers` 删除，`targets()` 数组移除该项；triggers 字段改由 `genRouteTable` 渲染进 route 正文 |

> **W3 澄清**：manifest **schema 本身不变**——buckets / rules / triggers / pretooluse 字段全保留，旧文档无兼容问题。变的只是 `generate.mjs` 的渲染目标映射。

#### `patchGeneratedRegion` 失败契约（回应 review S1）

| 情况 | 行为 |
|---|---|
| route SKILL.md 不存在 | `--check` 报漂移 + exit 1；写模式报错中止（不创建空壳） |
| marker（`<!-- BEGIN/END generated: rule-routes -->`）缺失 | 报错中止 + 提示补 marker；不静默整文件覆盖（避免吞掉手写区） |
| marker 重复（同名 BEGIN/END 出现 >1 次） | 报错中止 |
| 手写区（marker 外）被改 | 不影响——`patchGeneratedRegion` 只替换 marker 内，`--check` 只比对 marker 区间 |

> 注：`disable-model-invocation: true` 是插件内**首次使用**该 frontmatter 字段（现 5 个 skill 全靠 description 触发，零使用）；落地前确认当前 Claude Code 版本支持（见《外部前提》）。

### 业务流

**BF1 — SessionStart 注入（精简后，每文件一 command）**

```
function injectRulesSh(segment):                          // hooks/inject-rules.sh, 每 segment 一个 hook command
    file = segFile(segment)                               // segment→文件映射; model-personal 分支已删
    if segment not in [model-about, model-karpathy,       // 合法 segment 收敛到 3 个 model + project
                       model-catalog, project]:
        exit 1 with "unknown segment"                     // 防 hooks.json 写错段名
    if segment == "model-about":                          // sanity check 仍挂第一个 model 段跑一次
        runGenerateCheck()                                // generate.mjs --check: 生成物与 manifest 漂移则 warn
        warnOrphanModelFiles()                            // model/*.md 没对应 segment → warn(personal 已删, 不在桶不报)
        warnRulesNotInRoute()                             // grep 目标从 agent-catalog.md 改 skills/route/SKILL.md(现 :64-73 是 grep catalog)
    content = injectHeader(file) + sed_expand(file)       // 加 <!-- source --> 注释 + 展开 ${CLAUDE_PLUGIN_ROOT}
    emitJson(content)                                     // {hookSpecificOutput:{additionalContext: content}}
                                                          // 各段独立 < 10000 字符: catalog 精简到 ~1400 更安全
```

**BF2 — route skill 加载（三重触发，加载一次；回应 C5——诚实标注每重是软的）**

```
function loadRoute(taskContext):                          // 描述 harness/agent 的加载语义, 非确定算法
    if routeAlreadyInContext():                           // skill 加载后正文常驻(见《外部前提》)
        return                                            // 「加载一次」: 不重复
    if not isEngineeringTask(taskContext):                // 纯事实/闲聊
        return                                            // 设计允许不加载——本就不需要 route
    // 以下三重均为「软」通道, 任一命中即加载; 全未命中是接受的残余风险
    if agentReadsCatalogHint(taskContext):                // 第1重: 常驻 catalog 精简提示驱动主动调
        invokeSkill("nocode-evolve:route"); return
    if harnessMatchesDescription(taskContext):            // 第2重: harness 按 route description 软匹配
        autoLoadSkill("nocode-evolve:route"); return
    if agentUncertainAboutRules(taskContext):             // 第3重: agent 自觉不确定 → 主动兜底调
        invokeSkill("nocode-evolve:route"); return
    // 三重全未命中: route 未加载; 关键命令仍由 PreToolUse 硬拦截(BF 外, 独立 hook)兜底
```

**BF3 — command → skill 迁移（每个 command 一次；回应 C1/C2/W1）**

```
function migrateCommandToSkill(cmd):                      // cmd ∈ {distill, sow, task, rule-eval}
    body = read("commands/" + cmd + ".md")                // 原 command 正文 + frontmatter
    frontmatter = parseFrontmatter(body)                  // description / argument-hint
    frontmatter.disable_model_invocation = true           // 操作型: 仅手动 /调, 不自动触发, description 不占常驻
    // C1 订正: 4 command 全用 $ARGUMENTS 单字符串, 无 $1/$2 位置参数(已核实 commands/*.md)
    //   → $ARGUMENTS 在 skill 下语义一致(见《外部前提》), 原样保留, 不做索引重写
    rewriteLegacyRefs(body):                              // C2/W1: 迁移后会失效的旧引用, 逐一 rewrite
        if cmd == "sow":
            replace("commands/sow-reference/script.py",   // sow.md:107 硬编码相对路径(用户 cwd 跑不通)
                    "${CLAUDE_PLUGIN_ROOT}/skills/sow/sow-reference/script.py")  // 锚定插件根
            move("commands/sow-reference", "skills/sow/sow-reference")          // 整目录挪为 supporting file
        if cmd == "distill":
            replace("model/agent-catalog.md 三步联动",     // distill.md:31 rules:plugin 出口落地步骤
                    "skills/route/SKILL.md 生成区 + catalog slim")
            replace("commands/sow.md 引用",                // distill.md:146 指向 sow command
                    "skills/sow")
            replace("报告 catalog 更新",                   // distill.md:209 仍报 catalog
                    "报告 route 生成区更新")
    write("skills/" + cmd + "/SKILL.md", frontmatter + body)
```

**BF4 — generate.mjs 单源生成（改后；回应 W1）**

```
function renderAll(manifest):                             // hooks/generate.mjs, 删 genTriggers
    write("model/agent-catalog.md", genCatalogSlim(m))    // 重写: 桶摘要 + 调 route, 删 rule 细节
    patchGeneratedRegion("skills/route/SKILL.md",         // 新增能力: 只改 marker 区间, 手写区不动
        "rule-routes", genRouteTable(m))                  // 新增: 渲染完整 rule 路由(原 catalog 细节 + triggers 字段)
    write("hooks/pretooluse-rules.json", genPretooluse(m))// 不变
    // targets() 移除 triggers.json 项; 不再 write hooks/triggers.json
function check():                                         // --check 模式
    drift = []
    for target in [catalogSlim, routeRegion, pretooluse]: // route 只比对 marker 区间(见 patchGeneratedRegion 契约)
        if current(target) != rendered(target): drift.add(target)
    return drift                                          // 非空则 exit 1(SessionStart 只 warn 不阻断)
```

**BF5 — rule-eval 迁移 + 适配新触发结构（回应 C4/SA3：迁移与 eval 改造同一 PR，先迁后改）**

```
function migrateAndAdaptRuleEval():                       // 同一 PR 内两步, 顺序固定
    migrateCommandToSkill("rule-eval")                    // 步骤1: 先按 BF3 迁成 skill + disable-model-invocation
    // 步骤2: eval 对象从 catalog 规则改为 route 路由
    routeTable = readRouteGeneratedRegion()               // 从 route 正文生成区取路由定义(替代原读 catalog)
    cases = loadEvalCases(ruleId)                          // 复用原 eval case 集(eval/cases/*.md)
    if routeTable.markerMissing:                           // route 生成区 marker 缺失
        throw "route 生成区未找到, 先跑 generate.mjs"       // 上抛, 提示先生成
    metrics = runRouteRecall(cases, routeTable)           // route-recall + 混淆矩阵 + intent-signal 算法不变
    report(metrics)                                        // 报告格式不变, 数据来源 catalog→route
```

**BF6 — 删 commands/ 与 hook 退役的 verify（一次性收尾；回应 C2/W2）**

```
function verifyCleanup():                                  // 改造收尾自检
    assert not exists("commands/")                         // 整目录已删
    assert not exists("hooks/trigger-resurface.mjs")       // UserPromptSubmit 脚本删
    assert not exists("hooks/triggers.json")               // 生成物删
    assert hooksJson.UserPromptSubmit is None              // hooks.json 不再注册 UserPromptSubmit
    assert hooksJson.PreToolUse is not None                // 硬拦截仍在
    for cmd in [distill, sow, task, rule-eval]:
        assert exists("skills/" + cmd + "/SKILL.md")
        assert frontmatter(skills/cmd).disable_model_invocation == true
    // C2/W1: 旧引用残留检查——迁移后不该再有指向旧体系的路径
    assert grep("commands/sow-reference", "skills/") == empty   // sow 脚本路径已锚定插件根
    assert grep("commands/", "skills/") == empty                // 无残留 commands/ 引用
    assert grep_inject_rules_grep_target() == "skills/route/SKILL.md"  // W2: 孤儿检查 grep 目标已改
    runNodeTest("hooks/*.test.mjs")                        // 生成器/guard 测试全绿
    runGenerateCheck()                                     // 生成物与 manifest 零漂移
```

### 异常与失败模式

| BF | 异常 | 触发场景 | 处理方式 | 上抛 or 吞 |
|---|---|---|---|---|
| BF1 | catalog 精简后某 segment 仍超 10000 字符 | 未来 rule 暴增 | sanity 增字符数预警；超则进一步拆 segment | warn（不阻断 session） |
| BF2 | 三重全未命中，route 没加载 | 纯非工程任务 / 极端深度负载 | 设计接受：非工程任务本不需 route；工程任务低概率漏触发由 PreToolUse 对关键命令兜底 | 吞（acceptable degradation） |
| BF3 | sow 脚本调用路径迁移后失效 | `commands/sow-reference/script.py` 没锚定插件根 | rewriteLegacyRefs 改为 `${CLAUDE_PLUGIN_ROOT}/skills/sow/sow-reference/`；BF6 verify 检查 | writer 即修 |
| BF3 | distill 仍引用旧 catalog 三步联动 / commands/sow | rewriteLegacyRefs 漏改 | BF6 `grep("commands/", "skills/")` 残留检查 | writer 即修 |
| BF4 | route 手写区被 generate 误覆盖 | marker 边界写错 | `patchGeneratedRegion` 失败契约（marker 缺失/重复报错中止） | 脚本即报 |
| BF5 | rule-eval 读不到 route 生成区 | route SKILL.md marker 缺失 | eval 上抛「先跑 generate.mjs」 | eval 上抛 |

### 单测设计

**BF1 — SessionStart 注入**

- **case 1.1 主路径**：`inject-rules.sh model-catalog` 输出合法 JSON，`additionalContext` < 10000 字符，内容为精简版 catalog
  - Given：manifest 与生成物一致，CLAUDE_PLUGIN_ROOT 已设
  - When：执行 model-catalog 段
  - Then：JSON 合法，字符数 < 10000
- **case 1.2 model-personal 段已删**
  - Given：hooks.json 不再列 model-personal
  - When：`inject-rules.sh model-personal`
  - Then：报 unknown segment + exit 1

**BF2 — route 加载（回应 C4：补主路径 + 全未命中）**

- **case 2.1 已加载跳过**
  - Given：route 正文已在 context
  - When：再次进入工程任务
  - Then：不重复加载（`routeAlreadyInContext` 返回 true）
- **case 2.2 三重之一命中加载**
  - Given：route 未加载，工程任务，第 1 重提示被 agent 读到
  - When：loadRoute
  - Then：`Skill(route)` 被调，route 正文进 context
- **case 2.3 三重全未命中（接受降级）**
  - Given：route 未加载，工程任务，三重通道均未命中
  - When：loadRoute
  - Then：route 不加载（吞）；不报错；PreToolUse 对关键命令仍独立生效

**BF3 — command → skill 迁移（回应 C1：删参数索引 case）**

- **case 3.1 主路径 + disable-model-invocation**
  - Given：`commands/{distill,sow,task,rule-eval}.md` 存在
  - When：迁移执行
  - Then：`skills/<x>/SKILL.md` 存在且 frontmatter 含 `disable-model-invocation: true`
- **case 3.2 $ARGUMENTS 原样保留（不做索引重写）**
  - Given：command 正文含 `$ARGUMENTS`
  - When：迁移
  - Then：`$ARGUMENTS` 原样保留，无 `$0/$1` 改写
- **case 3.3 sow 脚本路径锚定插件根**
  - Given：`commands/sow.md` 调 `commands/sow-reference/script.py`
  - When：sow 迁移
  - Then：`skills/sow/sow-reference/` 存在，SKILL.md 内调用路径为 `${CLAUDE_PLUGIN_ROOT}/skills/sow/sow-reference/script.py`
- **case 3.4 distill 旧引用全 rewrite**
  - Given：distill.md 含 catalog 三步联动 / commands/sow 引用
  - When：迁移
  - Then：`grep("commands/", skills/distill/SKILL.md)` 为空，catalog 引用改为 route 生成区

**BF4 — generate.mjs（回应 W1）**

- **case 4.1 主路径**：catalog slim + route marker 区间 + pretooluse；不产出 triggers.json
- **case 4.2 手写区保护**：重新生成后 route marker 区间被替换，②③ 手写区原样保留
- **case 4.3 marker 缺失报错**：route SKILL.md 无 marker → `patchGeneratedRegion` 报错中止，不整文件覆盖
- **case 4.4 --check 漂移**：手改 route 生成区 → `--check` 报漂移 + exit 1

**BF5 — rule-eval（回应 C4）**

- **case 5.1 主路径**：迁成 skill 后读 route 生成区跑 route-recall，报告格式不变
- **case 5.2 marker 缺失上抛**：route 生成区 marker 缺失 → eval 报「先跑 generate.mjs」

**BF6 — 退役收尾**

- **case 6.1 hook 退役**：hooks.json 无 UserPromptSubmit、PreToolUse 仍在；`trigger-resurface.mjs`/`triggers.json` 不存在
- **case 6.2 全测试绿 + 零残留**：`node --test 'hooks/*.test.mjs'` pass，`generate.mjs --check` 零漂移，`grep("commands/", skills/)` 空

## 方案选型

### Q1: 「融合成一个 skill」是全文焊入还是路由调度？
**选项**：全文焊入（6 条 rule 正文塞一个 SKILL.md）vs 路由调度（正文=路由表，指向保留的 rule 文件）
**定**：路由调度。因 skill 触发即全文加载，全文焊入会让任一触发词命中就灌入 ~40KB（含完全无关的 git-worktree 20KB），与压缩目标对撞，且 description 涵盖一切反而降低触发精度。→ 影响 BF2、接口设计 route 契约。

### Q2: catalog 删还是精简？
**选项**：删（路由全交 route skill description）vs 精简保留（粗桶 + 指向 route，常驻）
**定**：精简保留（用户拍板）。因常驻一份「粗桶 + 调 route」提示正是第 1 重触发，删了就只剩 description 软匹配——回到失效过的第 1 层老路。精简后 catalog ~1400 字符、与 route 正文经 manifest 单源不重复维护。→ 影响 BF1、BF4。

### Q3: 触发通道——纯 skill 还是多通道？
**选项**：纯 skill 触发（description + PreToolUse，正则退役）vs 只搬内容+触发精简（常驻提示 + skill + 主动调，正则退役）vs 全保留
**定**：只搬内容+触发精简。因纯 skill 把确定的正则降级为软匹配且 behavior 型 rule 根本无关键词可匹配；全保留则 triggers.json 仍要与 manifest 同步是冗余。三重触发已覆盖正则层的活。**注**：三重均为软通道，目标是「显著提高加载率」非「保证必中」（见目标节 + BF2）。→ 影响 BF2、BF6。

### Q4: 操作型 command 转 skill 后怎么防自动误触发？
**选项**：description 写保守（「仅用户显式要求时」）vs frontmatter `disable-model-invocation: true`
**定**：`disable-model-invocation: true`。因 description 保守只是次优兜底、harness 仍可能误判；该字段确定性禁止自动触发，还把 description 移出常驻 context 省 token。distill/sow/task/rule-eval 都有副作用，全加。**注**：插件内首次使用该字段，落地前确认 Claude Code 版本支持（见《外部前提》）。→ 影响 BF3。

### Q5: behavior 型 rule（git-inspection / git-freshness）怎么办？
**选项**：各成 skill vs 内联进 route 正文 vs 直接删
**定**：内联进 route 正文③段。因它们无用户关键词，skill description 无从触发；但内容短（1.4K/3.2K），随 route 加载一次即生效，比单独做触发不到的 skill 强。→ 影响接口设计 route 正文③、BF2。

### Q6: 安全护栏（删 `.agents-personal` 二次确认，原 agent-personal §3）放哪？
**选项**：随 §1/§2 一起进 route vs 留常驻（挪进 agent-about）
**定**：留常驻。因护栏是「即将 rm/mv 前必须先确认」的安全 gate，route 加载有延迟（甚至非工程任务不加载），护栏一旦延迟生效就可能误删不可恢复内容。安全规则必须常驻。**注**：§3 末尾含 `$USER_VAULT_PATH` vault 护栏段（781 字符整段），挪 about 时不得遗漏（review S2）。→ 影响 model/agent-about.md、agent-personal.md 拆分、预算表。

### Q7: route 正文「项目本地」段与 SessionStart 的 project 段（注入项目 `.agents-personal/AGENTS.md`）关系？
**选项**：project 段也收进 route vs project 段保留常驻、route 只放「使用约定方法论」
**定**：project 段保留常驻、route 放方法论。因项目路由表（具体项目的 AGENTS.md）是项目特定内容、体量小且本就该开局可见；route 正文②段放的是「怎么用 wiki/AGENTS/rules」的通用约定（原 agent-personal §1/§2，1291 字符）。两者不重复。→ 影响 BF1（project 段不变）、route 正文②。

## 外部前提（Claude Code harness 行为，本仓无从验证；回应 review Q1）

本设计依赖以下 Claude Code 官方行为，已由 claude-code-guide 查证官方文档，落地前应对当前版本复核：

| 前提 | 来源 | 用在 |
|---|---|---|
| hook `additionalContext` per-command 截断阈值 = 10000 **字符**（非字节/token），保存到文件 + 2KB preview，硬编码不可配 | `code.claude.com/docs/en/hooks`（line 692, 769） | 背景主因、目标预算、BF1 |
| 多个 SessionStart command 的输出各自独立判阈值（per-value） | `code.claude.com/docs/en/hooks`（line 769，"if a value exceeds"） | BF1 拆 segment 的前提 |
| command 已合并进 skill；`commands/x.md` 与 `skills/x/SKILL.md` 都生成 `/x`，同名时 skill 优先 | `code.claude.com/docs/en/skills` | 辅因、BF3 |
| `disable-model-invocation: true`：禁止自动触发、保留 `/调`、description 移出常驻 context | `code.claude.com/docs/en/skills`（Control who invokes a skill） | Q4、BF3 |
| skill 支持 `$ARGUMENTS`（全部参数）；`$N` 是 `$ARGUMENTS[N]` 简写、**0-based** | `code.claude.com/docs/en/skills`（Pass arguments） | C1 订正、BF3 |
| skill 加载后正文进 context、会话内不重复加载；description 自动触发与主动 `Skill()` 共享同一份已加载正文 | `code.claude.com/docs/en/skills`（推断，文档未逐字声明「不重复」——落地观测确认） | 目标「加载一次」、BF2 |

> 最后一条标「推断」：文档明确 skill 触发即加载正文，但「会话内绝不重复加载」是合理推断而非逐字声明，合并前在本 worktree 实测观测确认。

## 其他

### 部署

无运行时部署。本次是 Claude Code 插件源码改造，通过 `plugin.json` version 升级触发用户端 marketplace（git 直读）更新：

- **灰度策略**：无——用户主动 `update`，不分批。
- **go/no-go（回应 review W4）**：合并前在本 worktree 跑两组 `rule-eval` route-recall——
  - **基线**：改造前 catalog 触发率（用现有 `eval/cases/*.md`）
  - **改造后**：route 加载 + 路由命中率（同 case 集）
  - **go 条件**：改造后 route-recall **不低于**基线 route-recall（容差 -2%）；**no-go**：低于基线 → 查 route description 触发词覆盖，调 description 重测。最低样本：复用现有全量 case 集，不抽样。
- **回滚预案**：破坏性变更（commands 路径迁移 + catalog 语义反转 + hook 退役）→ version 升 **major 3.0.0**；回滚走 git revert 整个 merge commit + version 再升一个 patch。用户端 `git checkout` 上一 tag。
- **监控指标**：无 metric（插件无运行时）。触发率回归用 `rule-eval`（BF5 适配后）跑 route-recall 量化，替代「凭感觉」。

## Review Log

### Review 1 — 260602（双路交叉：general-purpose subagent + codex 跨模型）

<!-- 两路 Report 合并，标「高置信」= 双方都提；详见会话记录。摘要如下 -->

**Critical**：C1 [高置信] BF3 `$1→$0` 参数重写错（command 用 `$ARGUMENTS` 无位置参数，已核实）；C2 [高置信] command 迁移旧路径残留（sow.md:107 脚本相对路径、distill 指向 catalog）；C3 [codex] route description 仅占位符；C4 [codex] 单测覆盖缺失（BF2/BF5/BF4 异常）；C5 [codex] 目标「单一确定动作」与 BF2 三路软触发/异常吞不自洽。
**Warning**：W1 [高置信] generate.mjs 改动面低估（genTriggers 删/genCatalog 重写/patchGeneratedRegion 新增能力）；W2 [gp] inject-rules.sh 孤儿检查 grep 目标 catalog→route；W3 [codex] manifest schema 变更未定义；W4 [codex] 部署量化无 go/no-go；W5 [gp] 背景 12391 表述（历史 vs 当前）。
**Suggestion**：S1 [高置信] patchGeneratedRegion 失败契约 + disable-model-invocation 首次使用注明；S2 [gp] §3 vault 护栏别漏；S3 [codex] BF2 判定表。
**Open Questions**：Q1 [高置信] harness 外部事实需标来源；Q2 [codex] ~6000 预算无拆分。

**用户决定**：全修 C1-C5、W1-W5；答 Q1（补《外部前提》节 + 官方来源）、Q2（补预算拆分表）；吸收 S1-S3。

**本轮修订**：
- C1：BF3 删 `rewriteArgIndices`，改注「`$ARGUMENTS` 原样保留、无索引重写」；异常表删 `$N` 行；单测 case 3.2 改为「$ARGUMENTS 原样保留」。
- C2：BF3 新增 `rewriteLegacyRefs`（sow 脚本路径锚定插件根、distill catalog/sow 引用 rewrite）；异常表 + BF6 + 单测 case 3.3/3.4 补残留检查。
- C3：接口设计补 route 完整 description 文本 + 正/负例 + 长度预算。
- C4：单测补 BF2（case 2.1-2.3 含主路径 + 全未命中）、BF5（case 5.1-5.2）、BF4 marker 缺失 case。
- C5：目标节重写为「动作收敛（确定）+ 触发率提升（概率，多通道叠加，不宣称必中）」；BF2 标注每重为软通道 + 全未命中为接受降级；文本总结同步。
- W1：影响树 generate.mjs 详列改动；接口设计生成物映射补 genTriggers 删除 + patchGeneratedRegion 新增能力；BF4 重写。
- W2：影响树 inject-rules.sh 补 grep 目标改点；BF1/BF6 同步。
- W3：接口设计澄清「manifest schema 不变，仅渲染目标变」。
- W4：部署节补 go/no-go 阈值（route-recall 不低于基线，容差 -2%）。
- W5：背景标明 12391 是 2.9.1 修复前合并时字符数、非当前注入量。
- S1：接口设计补 patchGeneratedRegion 失败契约表 + disable-model-invocation 首次使用注。
- S2：Q6 注明 §3 含 `$USER_VAULT_PATH` 护栏整段挪入。
- S3：流程图改为加载判定表。
- Q1：新增《外部前提》节，6 条 harness 行为 + 官方文档来源，末条标「推断」待实测。
- Q2：目标节补常驻注入预算拆分表（改后 ~7664）。
