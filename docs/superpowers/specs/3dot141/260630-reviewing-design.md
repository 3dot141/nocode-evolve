# 设计文档:reviewing — 通用 review 框架 + 评审方法库

> 场景:混合 feat(新框架 skill `reviewing`)+ refactor(14 处现有 review 改造为引入框架)
> doc-type:design-doc · 状态:`approved`
> 设计输入:`scratchpad/reviewing-design-input.md`(restate 锁定版 + 四路探索 + L2 技术核对,全部带 file:line)

---

## 1. 背景

仓库里有 **21 个 review 机制**,但它们是各自长出来的:每个 review 都重新发明一遍"维度清单 → 自评 → 独立交叉 → findings → 分级 → 收口"。后果是三类问题:

**核心痛点:同一套 review 范式被抄了十几遍,且抄走样了。**
- `define/design/prd/vis-review` 四件套是**同构的固定套路**(维度清单自评 + Codex 红军 + C/W/S),却各写一份 `[Agent A: skills/references/*-review.md]`
- 分级体系**分裂成 5 种**:C/W/S(`dev-review/SKILL.md:123`)、C/W/S/Q/SA(`reviewer-template.md:15`)、Critical/High/Medium/Low(`security-reviewer.md:357`)、CRITICAL/HIGH/MEDIUM(`database-reviewer.md`)、`{approved,issues}`(`dev-build/SKILL.md:115`)

**辅助痛点:**
- **重叠**:代码 review 三重(dev-review / code-reviewer agent / 内置 `/code-review`)、安全四处
- **缺口**:`vis-review.md` 是孤儿(全仓无人引用);database-reviewer / architect 无触发接线;agent 与 skill 双轨未打通 `[Agent A]`

**本设计**:抽出那个反复出现的 review 范式,做成一个**框架 skill `reviewing`**(通用流程 + 评审方法库 + 统一 findings 契约),把现有 14 处 review 改造为**引入框架**。不改各 review 的领域判断逻辑,只统一它们的"做法"。

> 命名 `reviewing`:动名词技艺风,与 `brainstorming`/`debugging`/`receiving-code-review` 一脉。与 `dev-review`(开发流的具体 review 阶段)区分——`reviewing` 是被各专项引入的方法论底座。

## 2. 调研

### 2.1 代码现状 `[四路探索,均 Read 真实代码]`
- 真正独立可调的 review 只有 7 个(dev-review/red-blue-deep/receiving-code-review 三 skill + code/security/database/architect 四 agent),其余是嵌入式环节 `[Agent A]`
- **形态实测**:纯对抗只有 red-blue-deep,纯清单是 4 个 agent,**绝大多数是"混合"**(清单自评+Codex 异源攻击)→ "骨架型/细则型"二分不成立,真分类轴是**评审对象**
- review 自动路由脆弱:"review 一下"正则在 dev-review/codex-review 间完全重叠,靠 trigger_desc 文字消歧 `[Agent C: manifest.json:110,420]`
- 无 review 路由 ADR,框架边界首次显式固化 `[Agent C]`

### 2.2 派发与引入机制 `[L2 核对]`
- `dev-build` 派 review 用"泛型 subagent + prompt 注入 + JSON schema",reviewer 身份由 **prompt 决定**,非 agent 定义(`dev-build/SKILL.md:130`)
- `reviewer-prompt.md` 是纯 prompt 模板(无 frontmatter + 花括号占位符 + 维度二级标题 + 输出契约)
- 引入机制三种并存:A(`{NOCODE_SKILL_REF}` reference Read,`hooks/inject-rules.sh:56`)、B(dispatch template 塞 Task,`reviewer-template.md:1-3`)、C(Skill 调用)
- CLAIM 剥离 + codex 降级是四件套 + red-blue 共用套路(`design-review.md:9`)→ 应上提框架级

### 2.3 业界方法论 `[deep-research,23 条 3-0 确证]`
- **视角分工(PBR)> 通用清单**:checklist 不比 ad-hoc 强,主要是新手脚手架价值
- **独立性是一等变量**:多 agent 若同基座模型可能假独立,异源(codex)才真独立
- review 要**分档触发**(Fagan 贵→选择性);review ≠ 替代测试;安全/架构 review 前移设计阶段
- ⚠️ caveat:多数研究基于人类团队,"知识传递/团队感知"价值在 AI agent 场景打折

### 2.4 已有决策
- `.agents-personal/wiki/` 无 review page;`docs/` 无 review 路由 ADR——本设计是首次固化

## 3. 方案选择

### Q1: reviewhub 聚合入口 vs review 框架?→ 决定整个形态

经多轮收敛(用户拍板):**否决 reviewhub 聚合入口**(门面只是把现有 review 摆一起,没解决"范式被抄十几遍"的核心问题),改做 **review 框架**——统一 review 的**做法**,各专项引入。

### Q2: 评审"方法"怎么处理?→ 决定方法库存在

红蓝对抗只是**一种**评审方法,有适合(方案/决策)和不适合(逐项缺陷核查)的场景。框架不强制单一方法,提供一个**评审方法库**,细则按对象+场景选用。(用户关键修正)

### Q3: 框架做多厚?→ 决定范围

**全量**:建框架 + 14 处 review 全改造为引入框架 + 4 agent 转 subagent+prompt。(用户拍板,授权全自主落地)

### Q4: 框架载体形态?→ 决定引入方式

**框架 skill**(`skills/reviewing/SKILL.md` + `references/` 方法 cards)。引入接口 **C1 主**(框架作 reference 被细则 Read 套骨架,零新机制)+ **C2**(dispatch template 派 subagent)。**不进 manifest**(做底座不抢触发)。

## 4. 框架架构设计(feat)

### 4.1 总图:四层结构 + 细则引入

```
┌───────────────────────────────────────────────────────────────┐
│                    reviewing 框架 (skill)                        │
│                                                                 │
│  ① 通用流程骨架 (7 步)        ② 评审方法库 (cards)               │
│  ┌─────────────────────┐     ┌──────────────────────────────┐   │
│  │ 1 分档              │     │ red-blue-adversarial         │   │
│  │ 2 对象界定+gate     │     │ checklist                    │   │
│  │ 3 评审维度 ←注入点  │────▶│ perspective-based (PBR)      │   │
│  │ 4 执行(选方法)─────┼─────│ error-mechanism (HECR)       │   │
│  │ 5 独立交叉          │     │ self-review                  │   │
│  │ 6 findings+分级     │     │ threat-modeling              │   │
│  │ 7 收口/triage       │     └──────────────────────────────┘   │
│  └─────────┬───────────┘                                        │
│            │            ③ 公共能力 (框架级,不让方法各写)         │
│            │            CLAIM剥离 · codex降级 · Evidence Gate    │
│            │            Doubt Theater检测 · 分档判定             │
│            ↓                                                     │
│  ④ 统一 findings 契约 {id,severity,kind,axis,location,...}      │
└────────────┬────────────────────────────────────────────────────┘
             │ 引入 (C1: Read 骨架 / C2: dispatch template)
   ┌─────────┼─────────┬─────────────┬──────────────┐
   ↓         ↓         ↓             ↓              ↓
 dev-review  四件套   嵌入式 step   4 agent转的    用户直触
 (五轴)     references (7处)        method cards   (red-blue等)
   每个细则 = 引入框架 + 选方法 + 填第3步领域维度
```

**为什么这么分**:流程骨架(怎么走一遍 review)、方法库(用什么打法)、公共能力(独立性/降级等横切关注点)、findings 契约(产出长什么样)——四者沿**变更边界**切开。改一个方法不动骨架;加一个细则不动方法;findings schema 是所有人共享的单源。

### 4.2 框架域:通用流程骨架(7 步)

| # | 步骤 | 说明 | 抽自 |
|---|---|---|---|
| 1 | **分档** | 轻档/重档,按对象风险定深度(框架公共前置) | red-blue 档位 `SKILL.md:10` |
| 2 | **对象界定 + 进入 gate** | 评什么、范围、前置条件 | dev-review Enter Gate |
| 3 | **评审维度**(细则注入点) | 框架不规定具体维度,细则填 | 四件套维度表 |
| 4 | **执行(选方法)** | 从方法库选 1+ 种执行 | — |
| 5 | **独立交叉** | 框架公共能力:CLAIM 剥离 + codex 派发 + 独立性档位声明 | red-blue Step3 `SKILL.md:88` |
| 6 | **findings 统一 schema + 分级** | 统一结构 + C/W/S + kind | §4.4 |
| 7 | **收口 / triage / 拍板** | Critical 必修,呈现拍板 | dev-review triage |

### 4.3 方法库域:方法 card + 选择判据

每个方法 = 一份 card(`skills/references/reviewing/methods/<method>.md`),含:**维度表 + 输出契约 + 派发策略**(是否派 subagent / 是否调 codex / 档位)。

**方法选择判据**(BF1 的 `selectMethods` 按此表 + 档位选,→ 解决"哪个细则用哪个方法",也是 SC-6"db/architect 接线"的落点):

| 评审对象 | 默认方法 | 备选 | 独立性 |
|---|---|---|---|
| 代码 diff | checklist(领域维度)+ red-blue(异源交叉) | error-mechanism | 异源 |
| 方案/决策/架构选型 | red-blue-adversarial | perspective-based | 异源 |
| 设计文档 | checklist(领域维度)+ red-blue(异源交叉) | — | 异源 |
| 安全(外部输入/认证/敏感数据) | threat-modeling + checklist(security-method card OWASP) | — | 异源 |
| 数据库(SQL/schema/migration) | checklist(database-method card) | — | 同模型/异源 |
| 架构决策 | checklist(architecture-method card)+ red-blue | — | 异源 |
| 需求/PRD/restate | checklist(领域维度)+ red-blue | — | 异源 |
| 轻档/低风险 | self-review | — | 无 |

判据两维:**对象类型**定主方法,**档位**(轻→self-review;重→加异源交叉)定深度。db/architect 的"接线"(SC-6)就在这张表——dev-review 审到 SQL/migration 或架构决策时,selectMethods 据此选 database-method/architecture-method card,**不需要 manifest 路由**(见 §8)。

**红蓝对抗方法**(由 red-blue-deep 吸收,带档位参数):
```
method: red-blue-adversarial
  inputs:  { target, constraints, depth: light|heavy, claim_stripping: true }
  light:   一句表态 + 关键理由 (不派 subagent)
  heavy:   gate(sequential-thinking 必开) → 第一性原理 → 蓝军(主agent)
           → 独立审查(subagent + codex 并行, CLAIM 剥离) → 合并三路 → 结论
  output:  findings[] (映射 C/W/S) + verdict
  degrade: codex 不可用 → 单 subagent + 明说;sequential-thinking 不可用 → 降级不阻断
```

### 4.4 findings 统一契约(数据契约层)

```
finding {
  id        : "C1"/"W1"/"S1"/"Q1"/"SA1"            // 档位字母 + 序号
  severity  : critical | warning | suggestion       // 统一 3 档
  kind      : normal | open-question | self-audit    // 正交于 severity,承载 Q/SA
  axis      : 评审维度名 (由方法库的方法定义)
  location  : "file:line" | "[章节锚点]"
  evidence  : 代码/原文摘录 (Evidence Gate:代码事实声明必填 location)
  finding   : 问题描述
  fix       : 可操作修法 (Structural Remedy 优先)
  source    : 蓝军 | 红军(Codex) | subagent | 方法名   // 去重合并用
}
verdict { approved: boolean, counts:{critical,warning,suggestion}, recommendation }
```

**5 种 → 统一 C/W/S 映射表**:

| 统一档 | dev-review | reviewer-template | security 4档 | database | dev-build |
|---|---|---|---|---|---|
| **Critical**(阻塞) | Critical | C | **Critical+High** | CRITICAL | approved:false + `[missing]/[empty-shell]/[design-mismatch]` |
| **Warning**(应修) | Warning | W | Medium | HIGH/MEDIUM | `[cross-task]` + Important |
| **Suggestion**(记录) | Suggestion | S | Low | 反模式提示 | `[extra]` + Minor |
| **正交 kind** | — | Q/SA | — | — | — |

**三条关键约束**(→ 影响 BF1):
- security 的 **High 上提 Critical**(`security-reviewer.md:392` High = "Fix Before Production",语义近阻塞),4→3 压缩时上提不下沉
- **Q/SA 是 kind 不是 severity**(`reviewer-template.md:64-71`),压进 C/W/S 会丢"待核实/新人卡点"语义
- **Evidence Gate 入 schema**:代码事实类 finding 上 Critical/Warning 必须有 location,否则降级 `kind=open-question`——防"猜测式指控"

### 4.5 关键业务流

**BF1:细则引入框架并执行一次 review(C1 路径)**
```
// 细则(如 dev-review)在自己 SKILL.md 里走这条流程
function runReview(target, domainAxes):                  // domainAxes = 细则填的领域维度
  framework = Read("{NOCODE_SKILL_REF}/reviewing/skeleton.md")  // ① C1: Read 框架骨架
  depth = framework.classify(target)                     // ② 步骤1 分档(公共能力)
  gate(target)                                           // ③ 步骤2 对象界定+进入gate
  methods = selectMethods(target, domainAxes)            // ④ 步骤4 选方法(按对象+场景)
  rawFindings = []
  for m in methods:                                      // ⑤ 逐方法执行
    card = Read("{NOCODE_SKILL_REF}/reviewing/methods/" + m + ".md")
    if card.needsSubagent:                               //   红蓝heavy/PBR 等要独立交叉
      // 步骤5 公共能力:CLAIM 剥离后派 subagent + codex(经 rule-codex-review 单一通道)
      rawFindings += dispatchIndependent(card, target, claimStripped=true)
    else:
      rawFindings += selfApply(card, target, domainAxes) //   自评/清单 直接套维度
  findings = normalize(rawFindings)                      // ⑥ 步骤6 统一 schema + 映射 C/W/S
  findings = evidenceGate(findings)                      //   缺 location 的 critical→kind=open-question
  return triage(findings)                                // ⑦ 步骤7 收口:Critical 必修 + verdict
```

**BF2:findings 分级映射(normalize 的核心,→ 实现 §4.4 映射表)**
```
function normalize(raw):
  for f in raw:
    f.severity = MAP[f.source_scheme][f.raw_level]       // 查映射表
    if f.source_scheme == "security" and f.raw_level == "High":
      f.severity = "critical"                            // High 上提 Critical(不下沉)
    if f.raw_level in ("Q","SA"):                         // reviewer-template 的两档
      f.kind = (f.raw_level == "Q") ? "open-question" : "self-audit"  // 转 kind 不丢语义
      f.severity = f.severity || "suggestion"            // kind 正交,severity 另算
  return dedup(raw, by=[location, axis])                  // 同位置同维度去重(交集=高置信)
```

> **BF1/BF2 是逻辑表达,不是可执行体**:`skeleton.md` 是 markdown,细则 Read 它后**照判据自己做**分档/选方法,不是调函数。`skeleton.md` 内部结构:① 分档判据表(轻/重信号)② 7 步流程说明 ③ §4.3 方法选择表 ④ 公共能力 how-to(CLAIM 剥离怎么剥、codex 经 `rule-codex-review` 怎么派、Evidence Gate 怎么判 location 缺失)。BF 里 `classify`/`selectMethods` 对应 ①③,`dispatchIndependent`/`evidenceGate` 对应 ④。

## 5. 改造设计(refactor)

### 5.1 改造总览:14 处 Before/After

```
        Before (各自重造)                    After (引入 reviewing)

 dev-review: 五轴+codex+C/W/S 全内联        引入框架, 五轴=领域维度,
 四件套: 各 copy 一份红蓝骨架        ──▶    选[清单+异源交叉]
 4 agent: 545-655行自包含黑盒               四件套: 只留领域维度,骨架共享
 嵌入step: 各调各的reference                4 agent → method cards
 5种分级各行其是                            嵌入step: Read框架骨架
                                           findings 统一契约
```

### 5.2 三组改造模式

> **"14 处"明细**(区分两类避免双重计数):**review 逻辑单元**(8)= dev-review + 四件套 reference(4)+ dev-design-refine reviewer-template + dev-build per-task + brainstorming self-review;**调用点 SKILL.md**(4,改 Read 方式)= dev-define 7a / dev-design Step9 / pd-prd 7a / pd-vd 5e;**agent**(4)= code/security/database/architect。reference = review 逻辑、SKILL.md = 调用点,二者不混入同一计数。

**A 组 — 核心(C1 机制,最易,作框架试金石)**
| 处 | 改造 |
|---|---|
| `dev-review` | 五轴变领域维度,选[清单+异源交叉];Spec 轴路径覆盖作附加维度;findings 套统一契约。**安全/架构轴**:现有 inline guide(`security-guide.md`/`architecture-principles.md`,`dev-review/SKILL.md:41-43`)与新 security-method/architecture-method card 统一为 **card 单源**——guide 领域清单并入对应 card,改造后 selectMethods 选 card,不再 Read 旧 guide(消除重叠) |
| `define/design/prd/vis-review` 四件套 | 抽共享骨架到框架,各留领域维度;**vis-review 接回 pd-vd**(SC-6) |

**B 组 — 嵌入式 step(改为 Read 框架骨架)**
- dev-define 7a、dev-design Step 9、pd-prd 7a、pd-vd 5e、dev-design-refine Review、dev-build per-task、brainstorming self-review

**C 组 — 4 agent → subagent+prompt(改造.A1,major)**
```
        Before                              After
 agents/security-reviewer.md          references/methods/security-method.md
 ┌────────────────────────┐           ┌────────────────────────┐
 │ frontmatter(name/tools)│  ──剥──▶   │ (无 frontmatter)        │
 │ OWASP Top10 全展开 ✓保留│           │ OWASP 清单 (保留) ✓     │
 │ Solana/Supabase 示例   │  ──剥──▶   │ (示例降级为可选)        │
 │ 自由 markdown 报告格式 │  ──换──▶   │ 统一 findings 契约 +    │
 │ 自己 git diff 找上下文 │  ──换──▶   │ {DIFF}占位符 caller注入 │
 └────────────────────────┘           └────────────────────────┘
```
- 4 个 agent 同此模式;给 database/architect 补触发接线(SC-6)
- 是否保留具名 agent 壳:默认删 subagent 注册,只留 prompt reference(dev-build 证明泛型 agent+prompt 注入足够 `SKILL.md:130`);若有 `@code-reviewer` 直触需求保留薄壳

**特殊**:`red-blue-deep` 吸收为方法库 card(保留独立 skill 入口供用户直触);`dev-verify`/`receiving-code-review` **不动**。

### 5.3 迁移顺序(分批,每批可回滚)

> 核心原则(pre-mortem #1):框架契约先在最易的试金石验证再推广。**reference 与其调用 SKILL.md 成对同批**(避免 ref 已改 caller 未改的跨批中间态)。每批改完跑回归证明行为不退化。

```
批次 0: 建框架       skills/reviewing/ + references/reviewing/ + findings 契约
         ↓ (纯新增,零风险,不动现有)
批次 1: 试金石        dev-review(自包含)     ← 验证框架契约是否成立
         ↓ (若框架假设不成立在此暴露,返工面最小)
批次 2: 四件套+调用方  define/design/prd/vis-review.md + 各调用 SKILL.md 成对
         ↓ (dev-define/dev-design/pd-prd/pd-vd 同批;vis 顺带接回 pd-vd)
批次 3: 其余嵌入式    dev-design-refine + dev-build per-task + brainstorming
                     + red-blue-deep 吸收(SKILL.md 改薄壳委派 card)+ reviewer-template 对齐
         ↓
批次 4: agent 转换    4 agent → method cards(major;含 db/architect 的 selectMethods 接线)
         ↓
批次 5: 收尾         generate --check / hooks 测试 / vendor-sync / 升 major 版本
```

**回滚**:每批独立 commit,出问题 revert 该批;批次 0 纯新增不影响现有 review,是安全基线;批 2 起 reference↔caller 成对改,无跨批中间态。

## 6. 文件影响汇总

```
skills/reviewing/
  └── SKILL.md                          (NEW)  批0 — 框架入口:7步骨架+引入说明
skills/references/reviewing/
  ├── skeleton.md                       (NEW)  批0 — C1 被Read的流程骨架
  ├── findings-contract.md              (NEW)  批0 — 统一 schema + 映射表
  └── methods/
      ├── red-blue-adversarial.md       (NEW)  批0 — 吸收 red-blue-deep
      ├── checklist.md                  (NEW)  批0
      ├── perspective-based.md          (NEW)  批0
      ├── error-mechanism.md            (NEW)  批0
      ├── self-review.md                (NEW)  批0
      ├── threat-modeling.md            (NEW)  批0
      ├── security-method.md            (NEW)  批4 — 转自 agents/security-reviewer.md
      ├── database-method.md            (NEW)  批4 — 转自 agents/database-reviewer.md
      ├── code-quality-method.md        (NEW)  批4 — 转自 agents/code-reviewer.md
      └── architecture-method.md        (NEW)  批4 — 转自 agents/architect.md

skills/dev-review/SKILL.md              (改)   批1 — 引入框架,五轴=领域维度
skills/references/
  ├── define-review.md                  (改)   批2 — 留领域维度,骨架引框架
  ├── design-review.md                  (改)   批2
  ├── prd-review.md                     (改)   批2
  └── vis-review.md                     (改)   批2 — 引框架 + 接回 pd-vd
skills/dev-design-refine/references/
  └── reviewer-template.md              (改)   批3 — 五档与 findings-contract 对齐(Q/SA 单源,真实路径)
skills/dev-define/SKILL.md              (改)   批2 — 7a 改 Read 框架骨架(与 define-review 成对)
skills/dev-design/SKILL.md             (改)   批2 — Step9 同上(与 design-review 成对)
skills/pd-prd/SKILL.md                 (改)   批2 — 7a 同上(与 prd-review 成对)
skills/pd-vd/SKILL.md                  (改)   批2 — 5e 同上 + 接 vis-review(与 vis-review 成对)
skills/dev-design-refine/SKILL.md      (改)   批3 — Review 引框架
skills/dev-build/SKILL.md              (改)   批3 — per-task 验证引框架
skills/brainstorming/SKILL.md          (改)   批3 — self-review 引框架
skills/red-blue-deep/SKILL.md          (改/薄壳) 批3 — 薄壳委派 red-blue-adversarial.md(card 单源,留独立入口)
agents/code-reviewer.md                (删/薄壳) 批4
agents/security-reviewer.md            (删/薄壳) 批4
agents/database-reviewer.md            (删/薄壳) 批4
agents/architect.md                    (删/薄壳) 批4
.claude-plugin/plugin.json             (改)   批5 — 升 major 版本
```

合计:**13 NEW + 18 改(含 red-blue/reviewer-template,4 个为薄壳)+ 4 删/薄壳**(分 6 批,reference↔caller 成对同批)

## 7. 验证策略(TO 表)

| TO | 覆盖路径 | SC | 层级 | 说明 |
|---|---|---|---|---|
| TO-1 | 入口.P1 | SC-1,5 | 集成 | 细则引入框架(C1 Read 骨架+选方法),产出统一 findings |
| TO-2 | 梳理.P1 | SC-2 | **回归** | 14 处改造后各 review **行为不退化**(逐个对照改造前维度) |
| TO-3 | 缺口.P1 | SC-6 | 功能 | vis 接回 pd-vd + db/architect 补触发接线 |
| TO-4 | 改造.A1 | SC-3 | 回归 | 4 agent 转 reference 后领域清单保留(OWASP/SQL/架构原则在) |
| TO-5 | findings 契约 | SC-5 | 单测 | schema 校验 + 5→3 映射正确(security High→Critical,Q/SA→kind) |
| TO-6 | 系统.1 | SC-1 | 集成 | 框架被 devflow Review/dev-review 引用调起 |
| TO-7 | 约束.1 | SC-7 | 集成 | generate --check 无漂移 + hooks 38 测试过 + vendor-sync 一致 |
| TO-8 | red-blue 吸收 | SC-4 | 集成 | red-blue 作方法被调,light/heavy 档位 + codex 降级正常 |

**回归基线**(重构核心):改造前先录每个 review 的"输入→维度覆盖"快照作黄金样本,改造后跑同输入比对——维度漏了 = 行为退化,不许合并。

**不测项**:业界方法(PBR/HECR)的"检出力提升"不做实证测量(无对照实验环境)——风险低,标注。

## 8. 落地约束

- **manifest 单源**:框架本身走 reference(C1),**不进 manifest**。db/architect 的"触发接线"(SC-6)**不靠 manifest 路由**,而靠 dev-review 等细则的 `selectMethods` 按评审对象(SQL/migration → database-method;架构决策 → architecture-method)选对应 card(见 §4.3 选择表)——"补接线"= 在 selectMethods 判据加这两个对象→card 映射,不改 manifest/generate。日后若要框架/某 card 作用户直触入口(C3)才加 review 桶 rule。
- **版本**:**major**(agent 转 reference + findings 契约统一 = 破坏性),与改动同 commit。
- **测试**:`node --test 'hooks/*.test.mjs'`;改 manifest schema 要同步 `hooks/generate.test.mjs`。
- **vendor-sync**:commit 前 `node scripts/vendor-sync.mjs --check`。
- **Step 编号**:新 SKILL.md 用整数/字母后缀,禁分数编号。
- **commit**:完成后建 commit(含版本号),不自动 push。

## 9. Pre-mortem(top 3 + 缓解)

| # | 死因 | 缓解 |
|---|---|---|
| 1 | 框架抽象错位 → 全量返工(某专项不适合统一 schema) | 框架契约**先在批1 的 dev-review+四件套验证**(试金石);设计明确"框架适用边界";返工面最小 |
| 2 | agent 转 reference 能力退化(误剥 OWASP/SQL 清单) | 只剥 frontmatter+写死示例,**保留领域清单**;TO-4 回归守护 |
| 3 | findings 映射失真(5→3 丢 Q/SA/High 语义) | kind 正交字段承载 Q/SA;High 上提 Critical;verdict 保留 boolean;TO-5 守护 |
| 4 | ref↔caller 跨批中间态(reference 改了调用方没改) | reference 与调用 SKILL.md **成对同批**(§5.3 批2),无跨批中间态 |
| 5 | red-blue-deep 双源(SKILL.md 与 card 内容重复) | SKILL.md 改**薄壳委派** card,card 是单源(§6) |

## Review Log

### Round 1(独立 general-purpose subagent;codex 未登录,降级单路并明说)

**Verdict**: Changes needed → 全自主逐条处置(用户授权)。核心机制(C1 引入、BF1/BF2、7 SC 全落点、TO 全覆盖)经核实成立。

| # | 级别 | 处置 |
|---|---|---|
| C1 | Critical | ✅ fix — §4.3 选择表 + §8 澄清:db/architect 接线靠 selectMethods 按对象选 card,不进 manifest |
| W1 | Warning | ✅ fix — §4.3 方法 card 路径补 `reviewing/` 段 |
| W2 | Warning | ✅ fix — §6 补 `red-blue-deep/SKILL.md`(改/薄壳),card 单源 |
| W3 | Warning | ✅ fix — §6 补 `reviewer-template.md`(改),Q/SA 定义被 findings-contract 引用 |
| W4 | Warning | ✅ fix — §4.3 补方法选择表(对象→方法判据) |
| W5 | Warning | ✅ fix — §5.2 补"14 处"明细(reference/SKILL.md/agent 三类不混计) |
| W6 | Warning | ✅ fix — §5.3 批次重排,ref↔caller 成对同批 |
| S1 | Suggestion | ✅ fix — §4.1 标题改"四层" |
| S2 | Suggestion | ✅ fix — §9 pre-mortem 补 #4 #5 |
| Q1 | Open Question | ✅ answer — dev-build tag 来源确为 `spec-reviewer-prompt.md:98`(SKILL.md:115 只有 `{approved,issues}`);非阻塞,标注于此 |
| SA1 | Self-Audit | ✅ fix — §5.2 dev-review 行交代 guide→card 单源(消除安全/架构两套并存) |
| SA2 | Self-Audit | ✅ fix — §4.5 补 skeleton.md 内部结构说明(BF 是逻辑非可执行体) |

12 条全处置(11 fix + 1 answer),无 skip。状态 `in-review` → `approved`。
