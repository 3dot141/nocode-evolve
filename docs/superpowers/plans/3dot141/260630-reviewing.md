# reviewing 框架 Implementation Plan

**Goal**: 建通用 review 框架 skill `reviewing`(7步骨架+方法库+findings契约),把 14 处现有 review 改造为引入框架,4 agent 转 method card。
**Architecture**: 框架走 reference(C1 被细则 Read 套骨架),不进 manifest。findings 统一契约。ref↔caller 成对改造。
**Design Doc**: `docs/superpowers/specs/3dot141/260630-reviewing-design.md`(approved)
**Test Objectives**: TO-1~8(见设计文档 §7);核心是 TO-2/TO-4 "行为不退化"回归 + TO-7 插件一致性
**Execution**: workflow-parallel

> 说明:本计划是**插件 markdown skill 改造**为主,无传统单测 TDD。每 task 验证 = ① 内容自检(维度/契约完整)② 行为不退化对照(改造前后维度清单一致)③ 批5 统一跑 `generate --check` + `node --test 'hooks/*.test.mjs'` + `vendor-sync --check`。

## 依赖图

```
批0 框架(T0.1-T0.4)  ← 所有后续批的依赖,纯新增零风险
      │
      ↓
批1 试金石(T1.1)     ← dev-review 引入框架,验证框架契约成立
      │ (契约成立才推广;不成立在此返工,面最小)
      ├──────────────┬──────────────┐
      ↓              ↓              ↓
批2 四件套+调用方   批3 其余嵌入式   批4 agent转card
(T2.1-T2.4 并行)   (T3.1-T3.4 并行) (T4.1-T4.4 并行)
      └──────────────┴──────────────┘
                     ↓
              批5 收尾(T5.1)  ← generate/测试/vendor/版本
```

无环。批0 底层最先。批1 是 risk-first 试金石(框架契约最不确定,排最前暴露)。批2/3/4 仅依赖批0+批1,三批互相独立可并行。

## Checkpoints

- **CP1**(批0+批1 后):框架建好 + 框架契约**双形态验证**——dev-review(清单型→C/W/S findings,T1.1)+ red-blue-adversarial card(对抗型→verdict+缓解,验证 findings-contract 的 verdict 层能表达"倾向+缓解"不被 C/W/S 压扁)。**两形态都成立才推广**(rollback 边界:契约不成立只回退框架,不波及现有 review)
- **CP2**(批2+3+4 后):14 处改造完成 → 行为不退化回归(逐处对照维度清单)
- **CP3**(批5 后):全测试 + 一致性 + 版本号

---

## 批0:建框架(纯新增,无依赖)

### T0.1 — 框架入口 SKILL.md
- **Files**: `skills/reviewing/SKILL.md` (Create)
- **covers**: SC-1
- **内容**(← 设计文档 §4.2 七步骨架 + §4.1 总图):frontmatter(name: reviewing,description 动名词技艺风,触发"做 review 时的通用方法论底座")+ 7 步流程概述 + 引入说明(细则 C1 Read skeleton)+ 指向 references/reviewing/
- **验证**: SKILL.md frontmatter 合法;7 步齐;Step 编号整数(规则5)
- **Sizing**: S

### T0.2 — 流程骨架 skeleton.md
- **Files**: `skills/references/reviewing/skeleton.md` (Create)
- **covers**: SC-1, SC-5(入口.P1)
- **内容**(← 设计文档 §4.5 skeleton 内部结构 + §4.2 七步 + §4.3 方法选择表):① 分档判据表(轻/重信号)② 7 步流程详解 ③ 方法选择表(对象→方法,含 db/architect 接线)④ 公共能力 how-to(CLAIM 剥离 / codex 经 rule-codex-review 派 / Evidence Gate / Doubt Theater / 分档)
- **验证**: 四部分齐;方法选择表覆盖 §4.3 全部对象;公共能力 how-to 引 rule-codex-review
- **Sizing**: M

### T0.3 — findings 契约 findings-contract.md
- **Files**: `skills/references/reviewing/findings-contract.md` (Create)
- **covers**: SC-5(findings 契约,TO-5)
- **内容**(← 设计文档 §4.4):finding schema(id/severity/kind/axis/location/evidence/finding/fix/source)+ verdict 层 + 5→3 映射表 + 三约束(security High 上提 / Q-SA 作 kind / Evidence Gate)。Q/SA 定义引 reviewer-template
- **验证**: schema 字段齐;映射表覆盖 5 种来源;三约束在
- **Sizing**: M

### T0.4 — 6 个基础方法 card
- **Files**: `skills/references/reviewing/methods/{red-blue-adversarial,checklist,perspective-based,error-mechanism,self-review,threat-modeling}.md` (Create ×6)
- **covers**: SC-1, SC-4(red-blue 吸收)
- **内容**(← 设计文档 §4.3 card 结构 + §4.4 红蓝接口 + 方法库表):每 card = 维度表/思路 + 输出契约(findings) + 派发策略(是否 subagent/codex/档位)。red-blue-adversarial 含 light/heavy 档位 + 吸收 red-blue-deep 的四步(从 skills/red-blue-deep/SKILL.md 提炼,不照抄)
- **验证**: 6 card 齐;每 card 三部分;red-blue card 含档位 + codex 降级
- **Sizing**: M(6 文件但同构,作一个 task)
- **依赖**: 弱依赖 T0.3(card 输出契约引 findings-contract)

> T0.1-T0.4 可并行写(markdown 交叉引用,写完互链)。建议 T0.3→T0.2/T0.4(契约先)但非硬依赖。

---

## 批1:试金石(依赖批0)

### T1.1 — dev-review 引入框架
- **Files**: `skills/dev-review/SKILL.md` (Modify)
- **covers**: SC-2(梳理.P1), TO-1(入口), TO-2(行为不退化)
- **内容**(← 设计文档 §5.2 A组 dev-review 行):五轴变领域维度;选[checklist+red-blue 异源交叉];Spec 轴路径覆盖作附加维度;findings 套统一契约;安全/架构轴 guide→card 单源(selectMethods 选 card,不再 Read 旧 guide)。在 SKILL.md 顶部加"引入 reviewing 框架(Read skeleton)"
- **验证(行为不退化)**: 改造前五轴(正确性/可读性/架构/安全/性能)+ Spec 轴路径覆盖**全部维度仍在**;Critical 不可 override 仍在;findings 结构兼容统一契约
- **Sizing**: M
- **关键**: 这是框架契约试金石。若引入框架后发现五轴塞不进统一骨架,或 findings 契约表达不了 dev-review 的 action 语义 → 框架契约有问题,回批0 修(返工面最小)

---

## 批2:四件套+调用方(依赖批0+批1,T2.* 互相独立可并行)

### T2.1 — define-review + dev-define 成对
- **Files**: `skills/references/define-review.md` (Modify), `skills/dev-define/SKILL.md` (Modify Step 7a)
- **covers**: SC-2(梳理.P1), TO-2
- **内容**(← §5.2 A组 + §5.3 批2):define-review 抽共享骨架到框架,只留 restate 领域维度(7维);dev-define Step 7a 改为 Read 框架 skeleton + 选方法
- **验证**: define-review 7 维度仍在;Claude蓝军+Codex红军 CLAIM 剥离仍在(经框架公共能力);dev-define 7a 引用路径正确
- **Sizing**: S

### T2.2 — design-review + dev-design 成对
- **Files**: `skills/references/design-review.md` (Modify), `skills/dev-design/SKILL.md` (Modify Step 9)
- **covers**: SC-2, TO-2
- **内容**: 同 T2.1 模式,design-review 留设计 10 维度;dev-design Step 9 改 Read 骨架
- **验证**: 设计 10 维度 + 六轴 + 内部一致性核对仍在
- **Sizing**: S

### T2.3 — prd-review + pd-prd 成对
- **Files**: `skills/references/prd-review.md` (Modify), `skills/pd-prd/SKILL.md` (Modify Step 7a)
- **covers**: SC-2, TO-2
- **内容**: prd-review 留 PRD 8 维度;pd-prd 7a 改 Read 骨架
- **验证**: PRD 维度仍在
- **Sizing**: S

### T2.4 — vis-review + pd-vd 成对(+ 接回)
- **Files**: `skills/references/vis-review.md` (Modify), `skills/pd-vd/SKILL.md` (Modify Step 5e)
- **covers**: SC-2, SC-6(缺口.P1 vis 接回), TO-2, TO-3
- **内容**(← §5.2 + §5.3 批2 vis 接回):vis-review 留视觉 9 维度 + 引框架;**pd-vd Step 5e 改为引用 vis-review(接回孤儿)**,不再只用 red-blue+五维自审
- **验证**: 视觉 9 维度仍在;**pd-vd 5e 确实引用 vis-review(SC-6 接回验证,grep 命中)**
- **Sizing**: S

---

## 批3:其余嵌入式(依赖批0+批1,T3.* 互相独立可并行)

### T3.1 — dev-design-refine Review 引框架
- **Files**: `skills/dev-design-refine/SKILL.md` (Modify Review 节)
- **covers**: SC-2, TO-2
- **内容**: Review 节(reviewer-template 五档)改为引框架;reviewer-template 的 Q/SA 由 findings-contract 引用(单源)
- **验证**: C/W/S/Q/SA 五档语义仍在(Q/SA 经 findings-contract kind)
- **Sizing**: S

### T3.2 — dev-build per-task 引框架
- **Files**: `skills/dev-build/SKILL.md` (Modify per-task review 节)
- **covers**: SC-2, TO-2
- **内容**: per-task 的 spec/quality review 引框架;`{approved,issues}` 保留为 verdict 层(契约已含)
- **验证**: approved gate 仍在;spec/quality 两阶段仍在
- **Sizing**: S

### T3.3 — brainstorming self-review 引框架
- **Files**: `skills/brainstorming/SKILL.md` (Modify self-review 节)
- **covers**: SC-2, TO-2
- **内容**: Spec self-review 引框架的 self-review 方法
- **验证**: placeholder/矛盾/歧义/scope 检查仍在
- **Sizing**: S

### T3.4 — red-blue-deep 薄壳 + reviewer-template 对齐
- **Files**: `skills/red-blue-deep/SKILL.md` (Modify→薄壳), `skills/dev-design-refine/references/reviewer-template.md` (Modify)
- **covers**: SC-4(red-blue 吸收), SC-5, TO-8
- **内容**(← §5.2 特殊 + §5.3 批3):red-blue-deep SKILL.md 改薄壳,委派 `methods/red-blue-adversarial.md`(card 单源),**保留独立 skill 入口**;reviewer-template 五档与 findings-contract 对齐
- **验证(TO-8 关键)**: red-blue-deep 仍可被现有调用方调起——`Skill(nocode-evolve:red-blue-deep)` 入口在;dev-plan 两轮(本计划自己也在用!)、pd-vd、devflow 调用不断;light/heavy 档位 + codex 降级正常
- **Sizing**: M
- **关键**: 薄壳后必须确保 red-blue-deep 对外行为不变(本 devflow 自己依赖它)

---

## 批4:agent 转 method card(依赖批0+批1,T4.* 互相独立可并行,major)

### T4.1 — security-reviewer → security-method.md
- **Files**: `skills/references/reviewing/methods/security-method.md` (Create), `agents/security-reviewer.md` (删/薄壳)
- **covers**: SC-3(改造.A1), TO-4
- **内容**(← §5.2 C组):剥 frontmatter + 写死示例(Solana/Supabase 段落降级 example);**保留 OWASP Top10 清单 + 漏洞模式**;换花括号占位符 `{DIFF}` + 统一 findings 契约
- **验证(TO-4)**: OWASP Top10 清单**全部保留**(grep 对照改造前);threat-modeling 方法可引它
- **Sizing**: M

### T4.2 — database-reviewer → database-method.md(+接线)
- **Files**: `skills/references/reviewing/methods/database-method.md` (Create), `agents/database-reviewer.md` (删/薄壳)
- **covers**: SC-3, SC-6(db 接线), TO-4
- **内容**: 保留 SQL 反模式/索引/RLS/并发清单;**接线 = 确认 skeleton 方法选择表含"SQL/migration→database-method"**(T0.2 已写,此处验证)
- **验证**: SQL 反模式清单保留;skeleton 选择表命中 database-method
- **Sizing**: M

### T4.3 — code-reviewer → code-quality-method.md
- **Files**: `skills/references/reviewing/methods/code-quality-method.md` (Create), `agents/code-reviewer.md` (删/薄壳)
- **covers**: SC-3, TO-4
- **内容**: 保留安全/质量/性能/最佳实践清单;换占位符 + 契约
- **验证**: 清单保留
- **Sizing**: M

### T4.4 — architect → architecture-method.md(+接线)
- **Files**: `skills/references/reviewing/methods/architecture-method.md` (Create), `agents/architect.md` (删/薄壳)
- **covers**: SC-3, SC-6(architect 接线), TO-4
- **内容**: 保留架构原则/Trade-Off/Red Flags;**接线 = skeleton 选择表含"架构决策→architecture-method"**
- **验证**: 架构原则保留;skeleton 选择表命中
- **Sizing**: M

> 薄壳决策:默认删 agent 的 subagent 注册,留 method card;若保留 `@agent` 直触需求则留薄壳指向 card(dev-build 证明泛型 agent+prompt 足够 `dev-build/SKILL.md:130`)。本计划默认**删 agent,留 method card**(消除双轨)。

---

## 批5:收尾(依赖所有批)

### T5.1 — 一致性 + 版本 + 测试
- **Files**: `.claude-plugin/plugin.json` (Modify version), 可能 `hooks/generate.test.mjs`(若动 manifest)
- **covers**: SC-7(约束.1), TO-6, TO-7
- **内容**(← §8 落地约束):本设计框架走 reference **不进 manifest**(无需 generate);升 `.claude-plugin/plugin.json` **major** 版本;跑 `node hooks/generate.mjs --check`(应无漂移,因没动 manifest)、`node --test 'hooks/*.test.mjs'`(38 过)、`node scripts/vendor-sync.mjs --check`(一致)
- **前置核实(批4 删 agent 的副作用)**: `grep -rn "code-reviewer\|security-reviewer\|database-reviewer\|architect" rules/ model/ skills/ .claude-plugin/` —— 若被 manifest/catalog/其他 skill 引用,同步改(改 manifest 则跑 generate);若仅 agents/ 自身命中,删除安全
- **验证(TO-7)**: generate --check 无漂移 + hooks 38 测试过 + vendor-sync 一致 + 版本 major + agent 引用核实清零
- **Sizing**: S

---

## Plan Validation

**需求覆盖(8b)**: SC-1→T0.*;SC-2→T1.1/T2.*/T3.*;SC-3→T4.*;SC-4→T0.4/T3.4;SC-5→T0.3/T1.1;SC-6→T2.4/T4.2/T4.4;SC-7→T5.1 ✅ 全覆盖

**路径覆盖(8c)**:
| 路径 | task |
|---|---|
| 入口.P1 | T0.2, T1.1 |
| 梳理.P1 | T1.1, T2.*, T3.* |
| 缺口.P1 | T2.4, T4.2, T4.4 |
| 改造.A1 | T4.* |
| 系统.1 | T1.1, T3.4 |
| 约束.1 | T5.1 |
✅ 无漏路径

**可验证(8d)**: 每 task 有验证(内容自检 + 行为不退化对照 + 批5 统一命令)✅

**无环(8e)**: 批0→批1→{批2,3,4}→批5,无环 ✅

## Red-Blue 自审(codex 未登录,降级单路 Claude 红军,已明说)

红军批 plan 骨架,2 点成立已落实:
1. **批1 试金石只验清单型契约不够**:框架契约最难的是对抗型(red-blue 产出 verdict+缓解,非 findings 列表)。只在 dev-review(清单型)验证,对抗型契约问题拖到批3 暴露,返工面大。→ 落实:CP1 扩为双形态验证。
2. **删 agent 可能影响 manifest/catalog 引用**:批4 删 4 agent,需核实是否被引用。→ 落实:T5.1 加 grep 核实步骤。

其余批判(行为不退化靠维度对照已在各 task 验证项加了"关键约束"对照;批2/3/4 文件集不重叠可并行;红蓝 card 提炼需完整已在 T0.4 标)已覆盖,不另调整。

## 执行模式

`workflow-parallel`:批0 内 T0.* 并行;批1 单 task;批2/3/4 共 12 task 全并行(仅依赖批0+批1);批5 单 task。worktree 隔离避免文件冲突(各 task 文件集不重叠,见 Files)。
