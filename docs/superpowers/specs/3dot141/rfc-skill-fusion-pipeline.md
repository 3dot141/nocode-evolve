# RFC: Skill Fusion Pipeline — 8 阶段工程生命周期

> 状态: Draft v3 (Doubt-driven reviewed) | 作者: 3dot141 | 日期: 260616

## 背景

nocode-evolve 当前 dev-workflow 有 13 个阶段，skill 层大量直接引用 superpowers（executing-plans / TDD / writing-plans 等）。经过与 addyosmani/agent-skills（60k stars）的逐节点对比分析，发现：

1. **superpowers 的单节点约束力更强**（Iron Law / HARD-GATE），但管线有断层——实现阶段缺增量纪律，评审阶段缺实质内容
2. **agent-skills 的管线更完整**（覆盖从需求到安全到简化的全链路），但每个节点约束力偏软
3. 两者架构哲学不同：superpowers 设计为可被覆盖的基座，agent-skills 是自包含闭环

**目标**：融合两者优势——agent-skills 的管线完整度 + superpowers 的单节点硬度，形成 nocode-evolve 自有的 8 阶段工程生命周期。同时将 `dev-workflow` 改名为 `devflow`，更简洁。

## 成功标准

- 8 阶段覆盖从需求澄清到代码合入的完整链路，无断层
- **场景化路由**：devflow 根据任务类型选择不同场景（Full/Standard/Fix/Mini），每个场景有自己的阶段子集和决策树
- 每个阶段有明确的 Gate、skill 工作流、anti-rationalization
- 新 skill 遵循 progressive disclosure（SKILL.md < 500 行，细节放 references/）
- 与现有 rule/catalog/hook 体系无冲突，manifest 单源生成链不断
- 所有 skill 间调用关系有降级路径（normal / fallback / degraded evidence 三列）
- 设计文档支持 HTML 渲染输出（参考 plannotator/effective-html）

## 不做什么

- 不替换 superpowers 插件本体——它仍是基座，新 skill 在需要时内部调用它
- 不为前端/性能/安全写独立 skill——这些作为 Review 阶段的检查维度融入
- 不写 eval 基础设施——本 RFC 聚焦设计，eval 后续迭代

---

## 8 阶段总览

```
1. Define → 2. Env → 3. Design → 4. Plan
→ 5. Build → 6. Verify → 7. Review → 8. Land
```

| # | 阶段 | Skill | Rule | Companion | PreToolUse Hook | Gate |
|---|---|---|---|---|---|---|
| 1 | **Define** | `nocode-evolve:define` 新写 | `rule-define` 新写 | — | — | 目标+方案收敛，用户显式确认 + 场景分类 |
| 2 | **Env** | `superpowers:using-git-worktrees` 复用 | `rule-git-worktree` 复用 | — | — | Gate Base + worktree 已建并进入 |
| 3 | **Design** | `nocode-evolve:design-doc-writing` 增强 | `rule-design` 新写 + `rule-superpowers-brainstorming` 兼容别名(仅 brainstorming→设计文档路径触发) | codex 交叉评审 | — | 评审通过 + 用户 approve |
| 4 | **Plan** | `nocode-evolve:plan` 新写 | `rule-plan` 新写 | — | — | 计划已产出 + 所有 task ≤ M + 用户确认 |
| 5 | **Build** | `nocode-evolve:build` 新写 | `rule-build` 新写 | — | — | 所有 task 完成 + 测试通过 + build 通过 |
| 6 | **Verify** | `nocode-evolve:verify` 新写 | `rule-verify` 新写 | — | — | 全部验证证据收集 + 验收标准逐条通过 |
| 7 | **Review** | `nocode-evolve:code-review` 新写 | `rule-codex-review` 复用 | codex 交叉评审 | — | Critical 全 fix（blocker 类不可 override）+ 用户 approve |
| 8 | **Land** | `superpowers:finishing-a-development-branch` 复用 | `rule-finishing-branch` 复用 | — | force push / PR 拦截等现有规则 | composite sub-gates |

> **表头说明**：Hook 列仅列真实 PreToolUse hook；codex 交叉评审是 rule + companion script，列在 Companion 列。

### 场景化路由（devflow 核心设计）

devflow 不是每个任务走完 8 个阶段。**入口是场景分类，不同场景走不同阶段子集和决策树**：

```
devflow 入口
  │
  Step 1: 任务分类（Define 内判断）
  │
  ├─ Scenario: Full（需要设计/架构/重构/选型）
  │   Define → Env → Design → Plan → Build → Verify → Review → Land
  │   全部 8 阶段
  │
  ├─ Scenario: Standard（多文件/多步，但不需要设计文档）
  │   Define → Env → Plan → Build → Verify → Review → Land
  │   跳 Design（7 阶段）
  │
  ├─ Scenario: Fix（Bug 修复）
  │   Define(复现) → Env → [Debug横切→] Build(修复+测试) → Verify → Review → Land
  │   Define 侧重复现步骤，Build 前先走 Debug 定位根因（6-7 阶段）
  │
  └─ Scenario: Mini（单步/明确/单文件）
      Define(mini-goal) → Build-lite → Verify-lite → Land-lite
      不开 worktree，不写计划，不走 Design/Review
      仍有 TDD 和验证，只是轻量版（3 阶段）
```

**场景判定信号**（在 Define Step 1 判断）：

| 信号 | 场景 |
|---|---|
| 跨文件 + 需要架构决策/选型/设计文档 | **Full** |
| 跨文件 + 实现路径明确 | **Standard** |
| 用户报 bug / 测试失败 / 行为异常 | **Fix** |
| 单文件 / 单步 / 改个变量名 / 修个文案 | **Mini** |
| 用户显式说"整个/整体/全流程" | **Full** |
| 用户显式说"简单改一下" | **Mini** |

### 完整状态机（含回流路径）

```
Define ──→ Env ──→ Design ──→ Plan ──→ Build ──→ Verify ──→ Review ──→ Land
                                         │         │          │
                                         │         │          ├─ fix 改了代码
                                         │         │          │   → 回 Build(修复 slice)
                                         │         │          │   → 回 Verify(重新取证)
                                         │         │          │   → 再 Review
                                         │         │          │
                                         │         ├─ 验收未通过
                                         │         │   → 回 Build(补实现)
                                         │         │   → 重新 Verify
                                         │         │
                                         ├─ 测试失败/卡住
                                         │   → Debug 横切(定位根因)
                                         │   → 回 Build(修复)
                                         │
                                         └─ 发现设计有问题
                                             → 回 Design(修改设计)
                                             → 重新 Plan → Build → Verify
```

**关键回流规则**：Review 中的 fix 一旦导致代码变更，**必须回 Verify 拿新鲜证据**后才能重新进入 Review Gate。不允许"改了代码直接 approve"。

### Manifest Bucket 归属

| Bucket | Rule |
|---|---|
| `workflow` (新增) | `rule-define`, `rule-plan`, `rule-build`, `rule-verify` |
| `design` (现有) | `rule-design` (新写) |
| `git-lifecycle` (现有) | 不变 |
| `review` (现有) | 不变 |
| `memory` (现有) | 不变 |
| `feishu` (现有) | 不变 |

catalog header 的"粗桶数"从 generate.mjs 读 manifest，不需要硬编码。

| Bucket | Rule |
|---|---|
| `workflow` (新增) | `rule-define`, `rule-plan`, `rule-build` |
| `design` (现有) | `rule-design` (新写，替代 superpowers-brainstorming 的路由) |
| `git-lifecycle` (现有) | 不变 |
| `review` (现有) | 不变 |
| `memory` (现有) | 不变 |
| `feishu` (现有) | 不变 |

catalog header 的"粗桶数"从 generate.mjs 读 manifest，不需要硬编码。

---

## 各阶段详细设计

### 阶段 1: Define

**定位**：从模糊任务到明确目标+方案的收敛循环。

**新写/复用方案**：新写 `nocode-evolve:define`，内部按需调用 `superpowers:brainstorming`。

**融合来源**：

| 来源 | 吸收什么 |
|---|---|
| agent-skills `interview-me` | 一次一问 + 附带猜测 + 置信度 + 95% 停止条件 + "want vs should want" 识别 |
| agent-skills `spec-driven-development` | 可量化成功标准 + 假设显式列出 + Boundaries (Always/Ask/Never) |
| 现有 devflow Goal 阶段 | 成果物定义 + 验收标准 + 不做什么 + 边界条件 + 产出流向 |
| superpowers `brainstorming` | 多方案权衡 + 设计探索（作为子调用复用，不重写） |

**内部流程**：

```
Step 1: 任务规模判断
  · 轻（单步/明确）→ 3 行 mini-goal 直接过 Gate → 退出 devflow，直接执行
  · 重（多步/模糊）→ 进完整 Define 循环

Step 2: Goal — 需求澄清 + 目标定义
  · 一次一问，附猜测 + 置信度（interview-me 模式）
  · 识别 "want vs should want"（用户说"最佳实践"时追问真实需求）
  · 产出结构化 restate:
    Outcome / User / Why Now / Success Criteria / Constraint / Out of Scope
  · 显式列出假设
  · 用户显式确认（不接受"随你"/"都行"）

Step 3: 方案路径判断
  · 实现路径显而易见 → 跳 Brainstorm，Goal 收敛，退出
  · 需要设计探索 → 进 Step 4

Step 4: Brainstorm — 方案探索
  · 调用方式: Skill(superpowers:brainstorming)
  · 输入: Step 2 确认的 Goal restate
  · 不可用时降级: agent 自行列出 2-3 方案 + 权衡矩阵，明说"brainstorming skill 不可用，自行探索"

Step 5: Confirm — 方案是否改变目标？
  · 是 → 回 Step 2 修正 Goal（带上方案探索发现的新约束）
  · 否 → 收敛，退出循环
```

**Gate**：用户显式确认 restate + 方案选定（如有）。

**文件结构**：

```
skills/define/
├── SKILL.md          (< 500 行，核心流程)
└── references/
    └── restate-template.md   (结构化 restate 模板)
```

**独立触发（Rule）**：用户说"澄清需求 / 做什么 / 目标是什么 / interview me" → 触发 `rule-define` → Read skill。

---

### 阶段 2: Env

**方案**：完全复用现有 `superpowers:using-git-worktrees` + `rule-git-worktree` + Gate Base。无改动。

---

### 阶段 3: Design

**方案**：增强现有 `nocode-evolve:design-doc-writing`，不新写 skill。

**改动点**：

| 改什么 | 来源 | 具体变更 |
|---|---|---|
| review 提示词 | agent-skills `doubt-driven` | adversarial framing："find issues" 不是 "evaluate" |
| review 检查维度 | agent-skills `code-review-and-quality` 五轴适配 | 可行性 / 清晰度 / 一致性 / 安全影响 / 可扩展性 |
| findings 格式 | agent-skills 严重度分级 | 统一 Findings Schema（见下方） |
| review 前置检查 | agent-skills `source-driven` | 设计文档引用的代码点必须是 Read 过的 |
| HTML 渲染输出 | plannotator/effective-html | 设计文档支持导出为 effective-html 风格的自包含 HTML（见下方专节） |

**Rule 处理**：

- **新写 `rule-design`**：触发条件覆盖"写设计文档 / PRD / RFC / Design Doc / ADR / 重构方案 / 技术 spec"，Read `rule-design.md`
- **保留 `rule-superpowers-brainstorming`** 作为兼容别名：触发条件保持不变（"即将执行 superpowers:brainstorming skill"），action 改为"同时 Read rule-design.md"
- 原因：现有 design-doc-writing 的入口依赖 brainstorming step 5 的路由，改名会断掉这条路径（Codex Critical #2）

**统一 Findings Schema**（Design + Review 共用）：

```
每条 finding:
  - id: C1 / W1 / S1 / Q1 / A1
  - type: Critical / Warning / Suggestion / OpenQuestion / SelfAudit
  - axis: 维度 (feasibility / clarity / consistency / security / scalability)
         或代码维度 (correctness / readability / architecture / security / performance)
  - evidence: 具体代码/文档位置 + 问题描述
  - fix: 建议的修复方式
  - action: fix / skip / defer / answer (用户决定)

Gate 规则:
  - Critical: 必须 fix，或用户 explicitly accept with rationale
  - Warning: 用户决定 fix/skip/defer
  - Suggestion: 记录，不阻塞
  - OpenQuestion: 必须 answer 才过 Gate
  - SelfAudit: 必须处理（fix 或 acknowledge）
```

> OpenQuestion / SelfAudit 保留了现有 design-doc-writing 的 Q/SA gate 语义（Codex Critical #3）。

**共享 reference**：`references/findings-schema.md` 被 design-doc-writing 和 code-review 两个 skill 引用。

---

### 阶段 3 附: Design Doc HTML 渲染

**来源**：[plannotator/effective-html](https://github.com/plannotator/effective-html) — 生成 effective-html 风格的自包含 HTML 文档（SVG 图表 + 高质量排版）。

**集成方式**：

在 `design-doc-writing` 的 write → review 循环之后，增加可选的 render 步骤：

```
Write → Review (loop) → [用户确认] → Render HTML (可选)
```

- **触发**：用户说"渲染 / render / 生成 HTML / 导出"，或 Design 阶段 Gate 通过后 agent 主动建议
- **做法**：调用 `plannotator/effective-html` 的 `html` 或 `html-plan` skill 将 markdown 设计文档转为 self-contained HTML
- **输出**：`docs/superpowers/specs/{username}/` 下的 `.html` 文件，可直接浏览器打开
- **依赖**：需要安装 effective-html skill（`npx skills add plannotator/effective-html`）；未安装时跳过 render 并告知用户

**文件改动**：在 `design-doc-writing/SKILL.md` 末尾增加 "Render" 可选步骤 + 在 `references/` 增加 `html-render-guide.md`。

---

### 阶段 4: Plan

**定位**：把确认的 Goal 拆成可执行的任务序列。

**新写/复用方案**：新写 `nocode-evolve:plan`。内部参考 superpowers writing-plans 的硬约束模式。

**融合来源**：

| 来源 | 吸收什么 |
|---|---|
| superpowers `writing-plans` | 每步贴真实代码/命令/预期输出 + 禁占位符 + 2-5 分钟粒度 + HARD-GATE |
| agent-skills `planning-and-task-breakdown` | 垂直切片优先 + XS/S/M/L/XL sizing + 每 2-3 task 插 checkpoint + 依赖图 |

**Task 模板**：

```markdown
## Task [N]: [标题] [Size: S]

**描述**: 一段话说明做什么。

**验收标准**:
- [ ] 具体可测条件
- [ ] 具体可测条件

**验证命令**:
- `npm test -- --grep "xxx"`
- `npm run build`

**文件**: src/a.ts, tests/a.test.ts (≤ 5 个)

**依赖**: Task N-1 (或 None)
```

**核心约束**：
- **sizing 统一阈值**：每 task ≤ 5 文件（与 Build Scope Lock 一致）。L (5-8 文件) 标记为"建议再拆"，XL (> 8) 必须再拆。Plan Gate 和 Build Scope Lock 用同一个阈值，不再出现 Plan 通过但 Build 卡死的情况（Codex Warning #4）
- 垂直切片优先（端到端可交付 > 横切同层）
- 每 2-3 task 插 checkpoint（全部测试 + build + 用户 review）
- Rollback-friendly：每 task 可独立回滚
- 禁占位符：每步贴真实代码和命令

**Gate**：计划已产出 + 无 XL task + 用户确认。

**文件结构**：

```
skills/plan/
├── SKILL.md          (< 500 行)
└── references/
    └── task-template.md
```

---

### 阶段 5: Build

**定位**：按计划增量实现，每个 slice 闭环。遇 bug 触发 Debug 横切。

**新写/复用方案**：新写 `nocode-evolve:build`。

**集成的 Skill（完整清单，详见 skill-integration-map.md §5）**：

| 集成 Skill | 来源 | 集成方式 | 降级（不可用时） |
|---|---|---|---|
| `incremental-implementation` | agent-skills | **核心循环吸收** | — (已内联) |
| `test-driven-development` | superpowers | **子调用**: `Skill(superpowers:test-driven-development)` | 内联 Iron Law 核心（Red-Green-Refactor + "无失败测试不写代码"），明说 fallback |
| `test-driven-development` | agent-skills | **知识补充**: 测试金字塔+Test Sizes → references/ | — |
| `executing-plans` | superpowers | **模式吸收**: 按计划执行+遇阻停手 | — (已内联) |
| `subagent-driven-development` | superpowers | **子调用**: `Skill(superpowers:subagent-driven-development)` | 改为串行逐 task 执行，明说 fallback |
| `source-driven-development` | agent-skills | **核心流程吸收**: Read before implement+官方文档+来源标注 | 文档不可达→标 UNVERIFIED+用本地源码/lockfile |
| `frontend-ui-engineering` | agent-skills | **领域 reference**: `references/frontend-guide.md` | — |
| `api-and-interface-design` | agent-skills | **领域 reference**: 实现时参考 API 契约 | — |

**Slice 循环**：

```
for each task in plan:

  5a. Scope Lock
      · 取 task，确认 ≤ 5 文件 + 有验收标准
      · Source check: Read 涉及的代码/文档，标注来源 [Read path:line] / [Doc URL] / [推断]
      · 框架代码查官方文档确认（source-driven）
        · 文档不可达时降级: 标 UNVERIFIED + 用本地源码/lockfile/已有 docs
      · Simplicity check: 最简实现，不超前设计
      · 有 UI 变更时加载 references/frontend-guide.md
      · 有 API 变更时参考 Design 阶段的 API 契约

  5b. Test First (调 superpowers:test-driven-development)
      · Iron Law: 无失败测试不写生产代码
      · 写失败测试 → 确认红
      · 测试层级选择: unit > integration > e2e（测试金字塔，默认 unit）
      · 测试失败 3 次修不好 → 触发 Debug 横切（见下方 Debug 节）

  5c. Implement + Green
      · 最少代码让测试通过
      · Refactor（行为不变，降复杂度）
      · Scope Discipline: 不碰计划外代码
      · Feature flags for incomplete features
      · Safe defaults (新功能默认关闭)

  5d. Verify & Commit
      · test pass + build pass + no regression
      · 描述性 commit（what + why）
      · → 回到 5a 取下一个 task

  异常路径:
    · 测试失败 → 尝试修复 → 3 次失败 → Debug 横切
    · build 失败 → 排查 → Debug 横切
    · 卡住/不确定 → Doubt-Driven 横切（spawn 独立 reviewer）
```

**Gate**：所有 task 完成 + 全部测试通过 + build 通过。

**文件结构**：

```
skills/build/
├── SKILL.md                    (< 500 行，核心循环)
└── references/
    ├── scope-checklist.md      (scope lock 检查清单)
    ├── source-driven-guide.md  (来源标注规范 + 离线降级规则)
    ├── frontend-guide.md       (前端领域: 组件架构/无障碍/设计系统)
    └── test-pyramid-guide.md   (测试金字塔 + Test Sizes S/M/L)
```

---

### 阶段 6: Verify

**定位**：证明"功能真的能用"，不只是"测试通过"。Build 验证的是每个 slice 的单测，Verify 验证的是整体功能 + 用户体验。

**新写/复用方案**：新写 `nocode-evolve:verify`。

**集成的 Skill（完整清单，详见 skill-integration-map.md §6）**：

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `verification-before-completion` | superpowers | **核心流程吸收**: Iron Law(无证据不宣称完成)+Gate 五步+"跳步=撒谎"+8 条反借口 |
| `browser-testing-with-devtools` | agent-skills | **UI 测试**: 给 agent 浏览器做 e2e+截图取证+DevTools 检查 |
| `performance-optimization` | agent-skills | **可选度量**: 有性能需求时 Lighthouse/profiling/benchmark |
| `web-performance-auditor` | agent-skills | **可选 persona**: 专家级 Web 性能审计 |
| `/verify` skill | nocode-evolve 现有 | **复用**: 运行 app 观察行为 |
| `agent-browser` skill | nocode-evolve 现有 | **复用**: 浏览器自动化 |

**子流程**：

```
6a. Evidence Collection（来自 superpowers verification-before-completion）
    · Iron Law: 无新鲜证据不得宣称完成
    · 跑完整测试套件（不只是 slice 单测，是全部）
    · Build 成功
    · 输出干净（无 error/warning）
    · 每项证据记录: 命令 + 输出 + 通过/失败

6b. Integration Test
    · 跨模块集成测试
    · 数据流端到端验证
    · API 契约验证（请求/响应 schema 匹配 Design 阶段定义）

6c. E2E / Browser Test (有 UI 变更时)
    · 启动 dev server（调 /run skill 或手动）
    · 调 agent-browser / browser-testing-with-devtools
    · 走 golden path（从 Define 的验收标准推导）
    · 走边界 case（从 Define 的边界条件推导）
    · 截图/录屏作为证据
    · 无障碍检查（有 UI 时）
    · 无 UI → 跳过本步

6d. Performance Check (有性能需求时)
    · measure-first: 跑 benchmark / Lighthouse / profiling
    · Core Web Vitals: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
    · 对比 baseline（有历史数据时）
    · 无性能需求 → 跳过本步

6e. Manual Verification Checklist
    · 从 Define 的验收标准逐条核对
    · 每条标注: ✅ 通过(证据) / ❌ 未通过(原因)
    · 未通过 → 回 Build 修复 → 重新 Verify

异常路径:
  · 集成测试失败 → Debug 横切
  · E2E 失败 → Debug 横切（含 browser DevTools 诊断）
  · 性能未达标 → Debug 横切（profiling → 定位瓶颈）
  · 验收标准未满足 → 回 Build 补实现
```

**Gate**：
- 全部测试通过（unit + integration + e2e）
- Build 成功
- 验收标准逐条通过（有证据）
- 性能达标（如有要求）
- 无 "跳步=撒谎"——每项必须有新鲜证据

**文件结构**：

```
skills/verify/
├── SKILL.md                    (< 500 行，核心流程)
└── references/
    ├── evidence-template.md    (证据收集模板)
    ├── e2e-guide.md            (e2e + browser 测试指南)
    └── performance-guide.md    (性能度量指南 + Core Web Vitals 阈值)
```

---

### 横切: Debug

**定位**：Build 或 Verify 遇阻时的系统化调试流程。不是一个阶段，是任何时候可触发的横切能力。

**集成的 Skill（完整清单）**：

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `systematic-debugging` | superpowers | **子调用复用**: Iron Law(无根因不修)+4 阶段(根因调查→模式分析→假设验证→实现)+3 次失败强制升级 |
| `debugging-and-error-recovery` | agent-skills | **模式补充**: 6 步线性流(复现→定位→精简→修根因→防回归→端到端验证)+显式退出 checklist |
| `browser-testing-with-devtools` | agent-skills | **UI 调试**: DevTools 检查+网络/性能/控制台面板 |

**触发条件**：
- Build 中测试失败 3 次修不好
- Build 中 build 失败
- Verify 中集成测试/e2e/性能测试失败
- 用户报告 bug
- Agent 自己发现异常行为

**流程**（融合 superpowers Iron Law + agent-skills 6 步流）：

```
D1. 复现
    · 写出重现步骤（不是"大概知道怎么触发"）
    · 如果无法复现 → 加日志/断点，收集更多信息

D2. 定位
    · 最小化复现（剥离无关代码/数据）
    · 二分法定位（git bisect / 逐步注释）
    · UI bug → 用 browser DevTools (Network/Console/Performance 面板)

D3. 根因分析 (Iron Law: 无根因不修)
    · 找到 root cause，不是表面症状
    · 3 次尝试失败 → 停手，质疑架构假设，上报用户
    · 记录: "根因是 X，因为 Y 证据表明 Z"

D4. 写失败测试 (TDD 集成)
    · 先写测试复现 bug → 确认红
    · 这个测试 = 回归防护

D5. 修复
    · 最小改动修 root cause
    · 不顺手"改善"周边代码

D6. 验证
    · 新测试通过（红→绿）
    · 全部已有测试通过
    · Build 通过
    · 端到端复现路径不再触发

退出 checklist (融合 agent-skills):
  - [ ] 根因已确认（不是猜测）
  - [ ] 有回归测试
  - [ ] 全部测试通过
  - [ ] Build 通过
  - [ ] 端到端复现不再触发
  - [ ] 没有引入新问题
```

**不写成独立 skill 的原因**：Debug 是横切的，不是阶段性的。在 Build 和 Verify 的 SKILL.md 中引用 `superpowers:systematic-debugging`，加上 Debug 的触发条件和退出 checklist 作为 reference。

**文件**：`references/debug-protocol.md`（横切 reference，被 build 和 verify 引用）

---

### 阶段 7: Review

**定位**：多维度评审 + 代码简化 + 安全加固 + 统一 findings schema + 反馈纪律。

**新写/复用方案**：新写 `nocode-evolve:code-review`。复用 `rule-codex-review` 触发 codex 交叉评审。

**集成的 Skill（完整清单，详见 skill-integration-map.md §7）**：

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `code-review-and-quality` | agent-skills | **五轴框架**: 正确性/可读性/架构/安全/性能 + change sizing ~100 行 + 严重度标签 + Dead code hygiene + Dependency discipline |
| `code-simplification` | agent-skills | **简化 pass**: Chesterton's Fence + Rule of 500 + Preserve behavior exactly + 降复杂度不改行为 |
| `security-and-hardening` | agent-skills | **安全轴展开**: OWASP Top 10 + 三层边界(Always/Ask/Never) + STRIDE threat model + AI/LLM 安全 + Supply chain hygiene |
| `performance-optimization` | agent-skills | **性能轴展开**: N+1 检查 + unbounded 查询 + missing pagination + 不必要重渲染 |
| `receiving-code-review` | superpowers | **反馈纪律吸收**: 禁语表 + unclear→停 + YAGNI check + push-back 协议 |
| `requesting-code-review` | superpowers | **dispatch 模式**: 发起 review 的流程（SHA 范围 + reviewer template） |
| codex 交叉评审 | nocode-evolve 现有 | **复用**: Claude 自评 + Codex 独立评 + 合并呈现 |

**子流程**：

```
7a. Five-Axis Self-Review
    · 正确性: 逻辑/边界/错误处理/off-by-one/race condition
    · 可读性: 命名/结构/复杂度/是否能不看作者解释就看懂
    · 架构: 职责划分/依赖方向/循环依赖/抽象层级
    · 安全: OWASP Top 10 + 三层边界 + AI/LLM 安全
      - Always: 验证外部输入/参数化查询/encode 输出/HTTPS/hash 密码
      - Ask first: 新增 auth flow/存新类 PII/改 CORS/加文件上传
      - Never: commit secrets/log 敏感数据/信任客户端验证/eval 用户输入
    · 性能: N+1 查询/unbounded fetch/missing pagination/不必要同步/重渲染

7b. Simplification Pass (code-simplification 完整吸收)
    · Chesterton's Fence: 删代码/改结构前先理解为什么存在（check git blame）
    · Rule of 500: 函数 > 50 行/文件 > 500 行 → 拆分
    · Dead code hygiene: 识别 → 列出 → 问用户 → 再删
    · Preserve behavior exactly: 简化不改行为，所有测试不修改就通过
    · 不碰 scope 外代码: 只简化本次变更涉及的代码
    · 三条原则: 理解 → 识别机会 → 增量应用（每次一个简化，跑测试）

7c. Codex Cross-Review (rule-codex-review)
    · 独立模型交叉评审
    · adversarial 提示词："find issues，assume author is overconfident"
    · Claude 自评 + Codex 独立评 → 合并（交集=高置信，对称差=盲点）

7d. Findings Triage (统一 schema — 引用 references/findings-schema.md)
    · 使用全流程统一的 Findings Schema (C/W/S/Q/A)
    · 每条: id + type + axis + severity + evidence + fix
    · Change sizing 检查: > 300 行建议 split，> 1000 行必须 split
    · Dependency discipline: 新依赖必须回答 5 个问题（已有方案？大小？维护？CVE？License？）
    · 用户逐条决定 action (fix / skip / defer / accept with rationale)

7e. Feedback Discipline (收到外部 review 时)
    · 禁语表: 不说 "Great catch" / "Absolutely right" / "Thanks for..."
    · unclear → 全部停，不做部分实现（项目可能关联）
    · YAGNI check: grep 看是否真的用了，没用就不加
    · push-back 协议: 技术正确 > 社交舒适
    · 来自外部 reviewer 的建议先验证再实现（check against codebase reality）
    · 详见 references/feedback-discipline.md
```

**Gate**：Critical 全 fix（或用户 explicitly accept with rationale，记录在 Review Log）+ 用户 approve。

**文件结构**：

```
skills/code-review/
├── SKILL.md                     (< 500 行，核心流程)
└── references/
    ├── five-axis-guide.md       (各维度详细检查点 + 代码示例)
    ├── simplification-guide.md  (Chesterton's Fence + Rule of 500 + 语言示例)
    ├── security-checklist.md    (OWASP + 三层边界 + STRIDE + AI/LLM + Supply chain)
    ├── performance-checklist.md (N+1 + pagination + re-render + bundle + profiling)
    └── feedback-discipline.md   (禁语表 + push-back + YAGNI + 外部 review 处理)
```

---

### 阶段 7: Land

**定位**：从代码完成到合入主干的完整收尾流程。

**方案**：复用现有 `superpowers:finishing-a-development-branch` + `rule-finishing-branch` + Gate 体系 + PreToolUse hooks。

**Land 是 composite 子流程**（Codex Critical #1 修复——保留现有 5 个子步骤的 sub-gate）：

| Sub-step | 调用 | Sub-gate |
|---|---|---|
| 7a. Create PR | `rule-finishing-branch` option 2 | Gate Title-Body + push 成功 + PR 已创建 |
| 7b. Add Reviewers | `rule-finishing-branch` pr-flow | reviewer 已添加（或用户跳过） |
| 7c. Poll & Merge | ScheduleWakeup 轮询 → merge | canMerge=true + merge 成功 |
| 7d. Task Transition | `rule-feishu-transition` | 飞书 issue 流转（或用户跳过） |
| 7e. Cleanup | `rule-finishing-branch` Gate Worktree-Cleanup → ExitWorktree | worktree 清理完成 |

**Gate（composite）**：7a-7e 全部完成。每个 sub-step 有独立的 sub-gate。

---

## devflow 联动修改

> `dev-workflow` 改名为 `devflow`——更简洁顺畅。skill name 从 `nocode-evolve:dev-workflow` 改为 `nocode-evolve:devflow`。

### 保留的 Workflow 协议

以下核心协议从现有 dev-workflow **原样保留**（Codex Warning #7 修复）：

1. **TaskCreate**：进入 devflow 时为当前+后续阶段各建一条 task（7 阶段版本）
2. **TaskUpdate**：推进阶段前必须点名 Gate 证据 → completed → 下一阶段 in_progress
3. **Gate 证据强制**："大概过了"不算证据，必须引用 Gate 条件 + 满足它的具体事实
4. **Step 1 放行**：简单任务直接退出 devflow，不强加流程

**TaskCreate 示例（7 阶段）**：

```
TaskCreate(subject: "阶段 1: Define",
           description: "调用: nocode-evolve:define / Gate: 目标+方案收敛，用户显式确认")
TaskCreate(subject: "阶段 2: Env",
           description: "调用: Gate Base → superpowers:using-git-worktrees / 进入前 Read: rule-git-worktree / Gate: worktree 已建并进入")
TaskCreate(subject: "阶段 3: Design",
           description: "调用: nocode-evolve:design-doc-writing / 进入前 Read: rule-design / Gate: 评审通过 + 用户 approve")
... (阶段 4-7 同构)
```

### 阶段总览表

| # | 阶段 | 调用 | 进入前 Read | Gate |
|---|---|---|---|---|
| 1 | **Define** | `nocode-evolve:define` | (skill 内含流程) | 目标+方案收敛，用户显式确认 |
| 2 | **Env** | Gate Base → `superpowers:using-git-worktrees` → EnterWorktree | `rule-git-worktree` | worktree 已建并进入 |
| 3 | **Design** | `nocode-evolve:design-doc-writing` | `rule-design` | 评审通过 + 用户 approve |
| 4 | **Plan** | `nocode-evolve:plan` | (skill 内含流程) | 计划已产出 + 无 L/XL task + 用户确认 |
| 5 | **Build** | `nocode-evolve:build` | (skill 内含流程) | 所有 task 完成 + 测试通过 + build 通过 |
| 6 | **Review** | `nocode-evolve:code-review` | `rule-codex-review` | Critical 全 fix（或 accept with rationale）+ 用户 approve |
| 7 | **Land** | `rule-finishing-branch` → 7a-7e composite | `rule-finishing-branch` | composite sub-gates 全部完成 |

### 横切能力（任意阶段可调）

| 能力 | 调用 | 说明 |
|---|---|---|
| 评估 / 拍板 | `nocode-evolve:red-blue-deep` | 需要判断 / 权衡时随时调 |
| Git freshness | `rule-git-freshness` | 设计 / 搜索 / 多文件 Read 前自动触发 |
| Git 只读合并 | `rule-git-inspection` | ≥2 git 只读命令 && 串 |

### 阶段跳转规则

- **Define → Env**：Goal 收敛 + 不需要设计文档时
- **Define → Env → Design**：Goal 收敛 + 需要设计文档时
- **Design → Plan**：设计评审通过后
- **跳过**：用户显式说"跳过阶段 N"
- **回退**：用户说"回到阶段 N"

---

## 改动清单

### 新写文件

| 文件 | 说明 |
|---|---|
| **skills/define/** | |
| `skills/define/SKILL.md` | Define 阶段 skill（底子: interview-me） |
| `skills/define/references/restate-template.md` | 结构化 restate 模板 |
| **skills/plan/** | |
| `skills/plan/SKILL.md` | Plan 阶段 skill（底子: writing-plans） |
| `skills/plan/references/task-template.md` | Task 模板 |
| **skills/build/** | |
| `skills/build/SKILL.md` | Build 阶段 skill（双底子: TDD + incremental） |
| `skills/build/references/scope-checklist.md` | Scope Lock 检查清单 |
| `skills/build/references/source-driven-guide.md` | 来源标注规范 + 离线降级 |
| `skills/build/references/frontend-guide.md` | 前端领域指南 |
| `skills/build/references/test-pyramid-guide.md` | 测试金字塔 + Test Sizes |
| **skills/verify/** | |
| `skills/verify/SKILL.md` | Verify 阶段 skill（底子: verification-before-completion） |
| `skills/verify/references/evidence-template.md` | 证据收集模板 |
| `skills/verify/references/e2e-guide.md` | e2e + browser 测试指南 |
| `skills/verify/references/performance-guide.md` | 性能度量指南 |
| **skills/code-review/** | |
| `skills/code-review/SKILL.md` | Review 阶段 skill（底子: code-review-and-quality） |
| `skills/code-review/references/five-axis-guide.md` | 五轴详细检查点 |
| `skills/code-review/references/simplification-guide.md` | Chesterton's Fence + Rule of 500 |
| `skills/code-review/references/security-checklist.md` | OWASP + 三层边界 + AI/LLM |
| `skills/code-review/references/performance-checklist.md` | N+1 + pagination + profiling |
| `skills/code-review/references/feedback-discipline.md` | 禁语表 + push-back + YAGNI |
| **共享 references/** | |
| `references/findings-schema.md` | 统一 Findings Schema (C/W/S/Q/A)（Design + Review 共用） |
| `references/debug-protocol.md` | Debug 横切流程 + 退出 checklist（Build + Verify 引用） |
| **rules/** | |
| `rules/rule-define.md` | Define 独立触发 |
| `rules/rule-plan.md` | Plan 独立触发 |
| `rules/rule-build.md` | Build 独立触发 |
| `rules/rule-verify.md` | Verify 独立触发 |
| `rules/rule-design.md` | Design 独立触发 |

### 改写文件

| 文件 | 变更 |
|---|---|
| `skills/dev-workflow/` → `skills/devflow/` | 改名 + 13 阶段 → 8 阶段 + 场景化路由重写 |
| `skills/design-doc-writing/SKILL.md` | review 增强(adversarial+五轴+统一 schema) + 轻量 threat model + API 契约 reference + HTML render + 引用 findings-schema |
| `skills/design-doc-writing/references/api-design-guide.md` | 新增: API 契约设计指南(Hyrum's Law/contract-first) |
| `skills/design-doc-writing/references/html-render-guide.md` | 新增: effective-html 渲染指南 |
| `rules/rule-superpowers-brainstorming.md` | 保留为兼容别名，触发范围缩窄(仅 brainstorming→设计文档路径)，action 改为"同时 Read rule-design" |
| `rules/manifest.json` | 加 workflow bucket + 5 条新 rule + 改 1 条 |
| `model/agent-about.md` | 加 context-engineering 长会话管理行为 |
| `model/agent-catalog-*.md` | 由 generate.mjs 自动重生成 |

### 不动文件

- superpowers 插件本体
- `rule-git-worktree` / `rule-finishing-branch` / `rule-codex-review` / `rule-feishu-transition`
- `rule-git-freshness` / `rule-git-inspection` / `rule-push-summary`
- hooks/pretooluse-guard.mjs（generate 自动更新 pretooluse-rules.json）
- `model/agent-karpathy.md` / `model/agent-personal.md`

### 生成与验证

```bash
node hooks/generate.mjs          # 重生成 catalog 分片 + pretooluse-rules
node --test 'hooks/*.test.mjs'   # 验证生成物一致性
```

### 版本升级

`.claude-plugin/plugin.json` minor bump（新增 5 个 skill + 5 个 rule + devflow 重写）。

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Gate 膨胀侵蚀权威 | 用户频繁跳过 gate | 轻量任务 Define Step 1 快速放行，不强加全流程 |
| 双套方法论混用 | agent 选择性遵守 | 新 skill 内部调用 superpowers 而非复制；降级有明确 fallback |
| superpowers 上游更新断裂 | overlay 悄悄失效 | 用 skill name 调用不 hardcode 路径；降级 fallback 兜底 |
| SKILL.md 超 500 行 | token 占用大 | 细节放 references/；design-doc-writing 已 410 行，增强内容必须放 references/ |
| 硬措辞 ≠ 硬执行 | agent 跳过 Iron Law 无 hook 拦截 | 短期靠 skill 指令 + anti-rationalization；长期探索 PreToolUse 检测 |
| effective-html 未安装 | render 步骤失败 | 未安装时跳过 + 告知用户安装方式 |
| rule-superpowers-brainstorming 改名断路由 | brainstorming→设计文档路径断 | 保留原文件为兼容别名，不删除 |
| Plan 和 Build 的 sizing 阈值不一致 | Plan 通过但 Build 卡死 | 统一为 ≤5 文件 |

---

## Codex Review 修复追踪

| Codex Finding | Severity | 修复方式 |
|---|---|---|
| C1: Land 阶段"完全复用"与现有 9-13 阶段冲突 | Critical | Land 定义为 composite sub-flow，保留 5 个 sub-gate |
| C2: rule-superpowers-brainstorming 改名断路由 | Critical | 保留原文件为兼容别名 |
| C3: Findings Schema 丢了 OpenQuestion/SelfAudit | Critical | Schema 扩展为 C/W/S/Q/A 五类 |
| W4: Plan XL>8 vs Build ≤5 阈值不一致 | Warning | 统一为 ≤5 文件 |
| W5: 新 rule 无 bucket 归属 | Warning | 新增 `workflow` bucket |
| W6: 内部调用 superpowers 无具体步骤/降级 | Warning | Build 增加子调用规范表 |
| W7: dev-workflow 核心协议未声明保留 | Warning | 增加"保留的 Workflow 协议"节 |
| W8: 简单任务快速路径三种矛盾表述 | Warning | 统一为 Define Step 1 判定轻量→直接执行退出 devflow |
| W9: source-driven 无离线降级 | Warning | Build 增加"文档不可达→标 UNVERIFIED + 本地源"降级 |
| S10: Hook 列混用 | Suggestion | 表头拆为 Companion + PreToolUse Hook 两列 |
| S11: Critical 是否允许 override | Suggestion | Gate 改为"fix 或 explicitly accept with rationale" |
| S12: design-doc-writing 超 500 行 | Suggestion | 增强内容放 references/ |

---

## Skill 改造策略 — 以最强底子改造补充

每个新 skill 以最强的已有 skill 为底子改造，不从零写。继承经过验证的模式，降低遗漏风险。

### 改造方法论

```
1. 复制底子 skill 作为起点
2. 裁剪不适合 nocode-evolve 的部分（过度领域特定 / 与我们现有机制冲突）
3. 补充缺失的能力（从融合来源列表）
4. 加 anti-rationalization（合并两边的借口-反驳表，去重）
5. 加 nocode-evolve 特有集成点（子调用 / 降级 / Gate / 触发条件）
6. 控制 SKILL.md < 500 行，细节放 references/
```

### 5 个 Skill 的底子选择

| 新 Skill | 底子 | 选择理由 | 裁剪什么 | 补充什么 |
|---|---|---|---|---|
| **define** | agent-skills `interview-me` | 需求澄清流程最完整：一次一问+置信度+95%停止+"want vs should want"+restate 模板 | 裁: Claude.ai/Cowork 特定段落、与 idea-refine 的衔接（我们用 brainstorming 替代） | 补: spec-driven 的可量化成功标准+Boundaries / 我们 Goal 的交付物+验收+边界+不做什么 / brainstorming 子调用+降级 / 场景分类路由（Full/Standard/Fix/Mini） |
| **plan** | superpowers `writing-plans` | **可执行硬约束最强**：每步贴真实代码/命令/预期输出+禁占位符+2-5分钟粒度+HARD-GATE。Plan 的核心价值是可执行性，拆分能力可以从 agent-skills 补，但硬约束无法后补 | 裁: 与 executing-plans/finishing-branch 的衔接指引（我们有 devflow 统一编排） | 补: agent-skills planning-and-task-breakdown 的垂直切片+sizing(统一 ≤5 文件)+checkpoint+依赖图+plan 模板 / rollback-friendly 约束 |
| **build** | **双底子拼接**: superpowers `test-driven-development` (TDD 约束壳) + agent-skills `incremental-implementation` (slice 循环壳) | TDD 是硬门（test-first 不可妥协），incremental 提供 scope/simplicity/rollback 外壳。拼接方式：incremental 的 slice 循环结构为骨架，每个 slice 内部走 TDD 的 test→implement→refactor 顺序（不是 incremental 原始的 implement→test） | 裁: incremental 的 implement-first 示例全改为 test-first / TDD 的独立使用指引（已融入循环） | 补: source-driven / subagent 并行路径 / Debug 横切 / frontend-guide + test-pyramid-guide references |
| **verify** | superpowers `verification-before-completion` | 证据门最硬：Iron Law+"跳步=撒谎"+Gate 五步+8条反借口 | 裁: 无（整体保留，它已经很精炼） | 补: agent-skills browser-testing（e2e+DevTools） / performance-optimization（度量+Lighthouse） / integration test 环节 / 与 Define 验收标准的闭环对照 / Debug 横切 / evidence + e2e + performance references |
| **code-review** | agent-skills `code-review-and-quality` | 五轴框架+change sizing+severity+review 流程最完整 | 裁: GitHub thread 回复指导（我们有 bkt/gh 工具链） | 补: code-simplification 整段（Chesterton's Fence+Rule of 500+dead code） / security-and-hardening 整段（OWASP+三层+STRIDE+AI/LLM） / performance review 轴 / superpowers receiving 反馈纪律 / codex 交叉评审 / 统一 Findings Schema (C/W/S/Q/A) |

### 共享 References（跨 skill 引用）

| Reference | 被谁引用 | 说明 |
|---|---|---|
| `references/findings-schema.md` | design-doc-writing, code-review | 统一 Findings Schema (C/W/S/Q/A) |
| `references/debug-protocol.md` | build, verify | Debug 横切流程 + 退出 checklist |
| `references/anti-rationalization-common.md` | 所有新 skill | 通用借口-反驳表（从两边合并去重） |

---

## 决策记录（原开放问题，已决定）

| # | 问题 | 决定 | 理由 |
|---|---|---|---|
| D1 | Define 内部 Brainstorm 子调用 | 调用复用 `superpowers:brainstorming`。brainstorming 返回后 Define 进入 Confirm 步骤，检查方案是否改变 Goal。传递方式：brainstorming 的输出（选定方案+权衡结论）作为 Confirm 的输入文本 | 复用 > 重写；brainstorming 的深度探索不需要重造 |
| D2 | Findings Schema 共享位置 | 放插件根目录 `references/findings-schema.md`，被 design-doc-writing 和 code-review 两个 skill 引用 | 避免重复定义，统一修改入口 |
| D3 | Build TDD 复用方式 | **双底子拼接**：incremental 提供 slice 循环骨架，TDD 提供每个 slice 内部的 test-first 约束。SKILL.md 内联 Iron Law 核心（3 条规则 + Red-Green-Refactor），详细反借口表放 references/。正常路径仍子调用 superpowers TDD skill | TDD 是硬门不可妥协，slice 外壳是结构不可缺，双底子各负其责 |
| D4 | effective-html 安装依赖 | 可选，不强制。未安装时跳过 render 步骤 + 告知安装方式 | 渲染是锦上添花，不阻塞设计流程 |
| D5 | 底子裁剪策略 | 每个 skill 做 line budget：核心流程/gates/fallbacks 必须在 SKILL.md（≤ 300 行），checklist/示例/领域细节进 references/（不限行数）。改造时逐个确认 | progressive disclosure 是 skill-creator 的核心原则 |
| D6 | Build 底子选择 | **双底子拼接**（superpowers TDD + agent-skills incremental） | Codex C9 指出 incremental 是 implement-first 与 TDD test-first 冲突，双底子各取所长 |
| D7 | Plan 底子选择 | superpowers `writing-plans`（硬约束底子） | 可执行性 > 拆分方法论；拆分能力从 agent-skills 补充 |
| D8 | 简单任务流程 | Mini-flow: Define(mini-goal) → Build-lite → Verify-lite → Land-lite | 覆盖断层修复——简单任务仍有测试/验证/commit，只是轻量版 |
| D9 | 安全检查前移 | 轻量 threat model → Design 阶段；输入/权限/secret 检查 → Build Scope Lock；Review 做最终审计 | Codex W20：等 Review 才做安全太晚 |
| D10 | commit 策略 | Build 每 slice commit / Review fix 新 commit（不 amend） / Land 阶段由 finishing-branch 决定最终策略（squash/merge 用户选） | 与现有 git-worktree + finishing-branch 规则一致 |
