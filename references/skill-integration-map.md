# Skill Integration Map — 完整映射

> 本文件是 RFC 的附件，列出 agent-skills (24) + superpowers (14) 全部 skill 到 8 阶段的映射。确保无遗漏。
>
> **last_verified: 260625** — 上次核验上游 skill 清单的日期。超过 90 天未更新时 sanity check 会 warn"上游可能已漂移"。核验方式：对照 Claude Code 最新 superpowers + agent-skills 列表，确认映射仍准确。

## agent-skills 24 个 Skill 映射

| # | agent-skills Skill | 归属阶段 | 集成方式 | 说明 |
|---|---|---|---|---|
| 1 | `interview-me` | **Define** | 核心流程吸收 | 一次一问+猜测+置信度，融入 define skill |
| 2 | `spec-driven-development` | **Define** | 模式吸收 | 可量化成功标准+假设列出+Boundaries，融入 define skill |
| 3 | `planning-and-task-breakdown` | **Plan** | 核心流程吸收 | 垂直切片+sizing+checkpoint，融入 plan skill |
| 4 | `incremental-implementation` | **Build** | 核心流程吸收 | Scope Lock+改完即验+Simplicity First，融入 build skill |
| 5 | `test-driven-development` | **Build** | 知识补充 | 测试金字塔+Test Sizes，补充到 build references/ |
| 6 | `frontend-ui-engineering` | **Build** | 领域 reference | 组件架构/无障碍/设计系统，`build/references/frontend-guide.md` |
| 7 | `api-and-interface-design` | **Design** + **Build** | 领域 reference | Hyrum's Law/contract-first/One Version Rule，`design-doc-writing/references/api-design-guide.md` |
| 8 | `documentation-and-adrs` | **Design** | 模式补充 | ADR 模板已在 design-doc-writing，补充"实现中每个架构决策记 ADR" |
| 9 | `source-driven-development` | **Build** (横切) | 核心流程吸收 | Read before implement+标注来源+UNVERIFIED，融入 build skill |
| 10 | `doubt-driven-development` | **横切** | 独立能力 | 非平凡决策 spawn 独立 reviewer，任何阶段可触发 |
| 11 | `debugging-and-error-recovery` | **横切 Debug** | 融合吸收 | 6 步线性流+退出 checklist，与 superpowers debugging 融合 |
| 12 | `browser-testing-with-devtools` | **Verify** | 能力集成 | 给 agent 浏览器做 UI 测试/e2e，融入 verify skill |
| 13 | `code-review-and-quality` | **Review** | 核心框架吸收 | 五轴+change sizing+严重度标签，融入 code-review skill |
| 14 | `code-simplification` | **Review** | 子流程吸收 | Chesterton's Fence+Rule of 500+dead code，融入 code-review skill 的 simplification pass |
| 15 | `security-and-hardening` | **Review** | 子流程吸收 | OWASP+三层边界+STRIDE+AI/LLM 安全，融入 code-review skill 的安全轴 |
| 16 | `performance-optimization` | **Verify** + **Review** | 双阶段集成 | Verify 做度量/profiling，Review 做 review 轴检查 |
| 17 | `git-workflow-and-branching` | **Land** | 已覆盖 | trunk-based 等已由 dev-finish-branch 覆盖 |
| 18 | `ci-cd-and-automation` | **Land** | 不吸收 | 各项目 CI 差异大，通用 skill 用处有限 |
| 19 | `shipping-and-launch` | **Land** | 已覆盖 | dev-finish-branch + Gate 体系已更强 |
| 20 | `migrations-and-deprecation` | **Design** | 低优先级 reference | 迁移策略，`design-doc-writing/references/migration-guide.md`（后续添加） |
| 21 | `context-engineering` | **横切** | 行为规则 | 长会话管理+何时建议新会话，加入 `model/agent-about.md` |
| 22 | `web-performance-auditor` | **Verify** | 可选 agent persona | 有性能需求时在 Verify 阶段调用 |
| 23 | `using-agent-skills` | N/A | 不吸收 | meta-skill，我们的 devflow 替代 |
| 24 | `code-modernization` | N/A | 不吸收 | 不相关 |

## superpowers 14 个 Skill 映射

| # | superpowers Skill | 归属阶段 | 集成方式 |
|---|---|---|---|
| 1 | `brainstorming` | **Define** | 子调用复用 |
| 2 | `writing-plans` | **Plan** | 硬约束模式吸收 |
| 3 | `executing-plans` | **Build** | 计划执行模式吸收 |
| 4 | `test-driven-development` | **Build** | 子调用复用（Iron Law） |
| 5 | `subagent-driven-development` | **Build** | 子调用复用（并行路径） |
| 6 | `systematic-debugging` | **横切 Debug** | 子调用复用（Iron Law: 无根因不修） |
| 7 | `verification-before-completion` | **Verify** | 核心流程吸收（证据门 + "跳步=撒谎"） |
| 8 | `finishing-a-development-branch` | **Land** | 直接复用 |
| 9 | `requesting-code-review` | **Review** | 模式吸收（dispatch reviewer） |
| 10 | `receiving-code-review` | **Review** | 核心模式吸收（禁语表+push-back） |
| 11 | `using-git-worktrees` | **Env** | 直接复用 |
| 12 | `using-superpowers` | N/A | meta-skill，devflow 替代 |
| 13 | `dispatching-parallel-agents` | **Build** | 可选模式 |
| 14 | `writing-skills` | N/A | skill 编写工具，不进 devflow |

## 各阶段集成的 Skill 完整清单

### 1. Define

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `interview-me` | agent-skills | **核心吸收**: 一次一问+猜测+置信度+95%停止条件+"want vs should want" |
| `spec-driven-development` | agent-skills | **模式吸收**: 可量化成功标准+假设列出+Boundaries(Always/Ask/Never) |
| `brainstorming` | superpowers | **子调用复用**: `Skill(nocode-evolve:brainstorming)`，方案探索时调用 |

### 2. Env

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `using-git-worktrees` | superpowers | **直接复用**: 现有 skill + rule-git-worktree overlay |

### 3. Design

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `doubt-driven-development` | agent-skills | **review 提示词**: adversarial framing |
| `code-review-and-quality` | agent-skills | **六轴适配设计 review**: 可行性/清晰度/架构合理性/安全/性能/可扩展性（v3.39: Architecture+Performance 从收窄还原为独立轴） |
| `source-driven-development` | agent-skills | **前置检查**: 设计文档引用的代码必须 Read 过 |
| `api-and-interface-design` | agent-skills | **领域 reference**: API 契约设计指南(Hyrum's Law/contract-first/One Version Rule) |
| `documentation-and-adrs` | agent-skills | **ADR 流程补充**: 每个架构决策记 ADR |
| effective-html | plannotator | **渲染输出**: 设计文档导出 self-contained HTML |

### 4. Plan

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `writing-plans` | superpowers | **硬约束吸收**: 每步贴代码/禁占位符/2-5分钟粒度/HARD-GATE |
| `planning-and-task-breakdown` | agent-skills | **方法论吸收**: 垂直切片+XS-XL sizing+checkpoint+依赖图 |

### 5. Build

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `incremental-implementation` | agent-skills | **核心循环吸收**: Scope Lock+改完即验+Simplicity First+Scope Discipline+Feature flags+Safe defaults+Rollback-friendly |
| `test-driven-development` | superpowers | **子调用复用**: Iron Law+Red-Green-Refactor（降级: 核心约束内联） |
| `test-driven-development` | agent-skills | **知识补充**: 测试金字塔+Test Sizes(S/M/L) → `references/` |
| `executing-plans` | superpowers | **模式吸收**: 按计划执行+遇阻停手 |
| `subagent-driven-development` | superpowers | **子调用复用**: 并行派发（可选路径） |
| `dispatching-parallel-agents` | superpowers | **可选模式**: 多 agent 并行 |
| `source-driven-development` | agent-skills | **核心流程吸收**: Read before implement+官方文档确认+来源标注+UNVERIFIED |
| `frontend-ui-engineering` | agent-skills | **领域 reference**: `references/frontend-guide.md` |
| `api-and-interface-design` | agent-skills | **领域 reference**: 实现时参考 API 契约 |

### 6. Verify

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `verification-before-completion` | superpowers | **核心流程吸收**: Iron Law(无证据不宣称完成)+Gate 五步+"跳步=撒谎" |
| `browser-testing-with-devtools` | agent-skills | **UI 测试能力**: 给 agent 浏览器做 e2e+截图取证 |
| `performance-optimization` | agent-skills | **可选度量**: 有性能需求时 Lighthouse/profiling/benchmark |
| `web-performance-auditor` | agent-skills | **可选 agent persona**: 专家级 Web 性能审计 |
| `/verify` skill | nocode-evolve 现有 | **复用**: 运行 app 观察行为 |
| `agent-browser` skill | nocode-evolve 现有 | **复用**: 浏览器自动化 |

### 7. Review

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `code-review-and-quality` | agent-skills | **五轴框架**: 正确性/可读性/架构/安全/性能 |
| `code-simplification` | agent-skills | **简化 pass**: Chesterton's Fence+Rule of 500+dead code hygiene+preserve behavior |
| `security-and-hardening` | agent-skills | **安全轴展开**: OWASP Top 10+三层边界(Always/Ask/Never)+STRIDE+AI/LLM 安全 |
| `performance-optimization` | agent-skills | **性能轴展开**: review 级检查(N+1/unbounded/missing pagination) |
| `receiving-code-review` | superpowers | **反馈纪律吸收**: 禁语表+unclear→停+YAGNI check+push-back 协议 |
| `requesting-code-review` | superpowers | **dispatch 模式**: 发起 review 的模式 |
| codex 交叉评审 | nocode-evolve 现有 | **复用**: Claude 自评+Codex 独立评+合并呈现 |

### 8. Land

| 集成 Skill | 来源 | 集成方式 |
|---|---|---|
| `finishing-a-development-branch` | superpowers | **已吸收**: 拆为独立 skill `dev-finish-branch`(v4.0.0) + Gate 体系，vendor skill 标 skip |
| `git-workflow-and-branching` | agent-skills | **已覆盖**: trunk-based 等由 dev-finish-branch 覆盖 |

### 横切能力

| 能力 | 集成 Skill | 触发时机 |
|---|---|---|
| **Red-Blue-Deep** | `nocode-evolve:red-blue-deep` | 评估/拍板类提问 |
| **Doubt-Driven** | agent-skills `doubt-driven-development` | 非平凡决策（Build/Design/Plan 中） |
| **Debug** | superpowers `systematic-debugging` + agent-skills `debugging-and-error-recovery` | Build/Verify 遇阻（测试失败/行为异常/卡住） |
| **Context Engineering** | agent-skills `context-engineering` | 长会话管理（主动建议开新会话/distill） |
| **Source-Driven** | agent-skills `source-driven-development` | 框架代码实现时（Build 主要，Design 也用） |
| **Git Freshness** | `rule-git-freshness` | 设计/搜索前 |
| **Git Inspection** | `rule-git-inspection` | ≥2 git 只读命令 |
