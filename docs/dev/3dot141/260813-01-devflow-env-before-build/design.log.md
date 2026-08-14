# Header
- task: devflow 在 Build 前创建 Env 并迁移任务文档
- status: active
- type: feat
- currentNode: review
- createdAt: 2026-08-13
- artifacts:
  - log: ./design.log.md
  - design: ./design.md

# Decisions

## DEC-001
- kind: classification
- status: confirmed
- statement: 本任务新增 devflow 的 Build 前 Env 路由与文档迁移能力，分类为 feat。
- sourceEntries: [Event 1]
- evidence: 用户首次要求加入该行为；当前 `skills/devflow/SKILL.md` 不包含 Env Handoff target，也没有 Build 前 worktree 路由。
- designDisposition: required
- relations: 无

## DEC-002
- kind: flow
- status: confirmed
- statement: Env 的唯一创建时点是 Build 之前；Design 与需要的 Plan 在原工作区完成，Debug 也不因本任务前移到 Env。
- sourceEntries: [Round 1]
- evidence: 用户先指定 Design 之后，最终明确修正为“在 build 之前”。
- designDisposition: required
- relations: enables DEC-003, DEC-004

## DEC-003
- kind: artifact-handoff
- status: confirmed
- statement: Env 进入不同 worktree 后，把当前任务的整个 `docs/dev/{username}/{task}/` 目录复制到目标 worktree 的相同仓库相对路径，再由目标副本继续 Build 及后续流程。
- sourceEntries: [Round 1]
- evidence: 用户明确要求“将之前的文档 cp 过去”；任务稳定产物均位于同一 task directory。
- designDisposition: required
- relations: dependsOn DEC-002

### 正文

- 复制范围：`design.log.md`、`design.md`、Plan、可选 render 以及同目录内其它任务产物。
- 路径身份：跨 checkout 保持同一仓库相对路径；切入 worktree 后，目标绝对路径成为后续传递的 exact Log path。
- 复制而非移动：原工作区保留历史副本；Build 之后只写目标 worktree 副本，避免双写。

## DEC-004
- kind: routing
- status: confirmed
- statement: Env 是 devflow 的轻量 Handoff target，不恢复八阶段驾驶舱；它调用 `nocode:using-git-worktrees`，成功后把同一 Log 的 Handoff 更新为 Build 并调用 `nocode:dev-build`。
- sourceEntries: [Round 1]
- evidence: `skills/devflow/SKILL.md` 当前以 Handoff target 路由；`skills/using-git-worktrees/SKILL.md` 已拥有 worktree 创建、进入和 setup 职责。
- designDisposition: required
- relations: dependsOn DEC-002; enables DEC-005

## DEC-005
- kind: safety
- status: confirmed
- statement: 文档迁移不得静默覆盖分叉内容：目标目录不存在时复制，内容一致时复用，内容不一致时停止并报告；Env 未完成时不得进入 Build。
- sourceEntries: [Round 1]
- evidence: 当前仓库约束要求保护用户改动；worktree 可能是新建、复用或已包含旧任务目录。
- designDisposition: required
- relations: dependsOn DEC-003, DEC-004

## DEC-006
- kind: compatibility
- status: confirmed
- statement: Plan 完成后必须把 Handoff 指向 Env 并回到 devflow；单切片 Bug repair 原本直达 Build 的路径也改为先到 Env；Verify/Review 回流到已建立的 Build workspace 时复用现有 Env。
- sourceEntries: [Round 1]
- evidence: `skills/dev-plan/SKILL.md` 当前直接调用 dev-build；`skills/dev-design/references/handoff.md` 当前允许 Bug repair 直达 Build。
- designDisposition: required
- relations: dependsOn DEC-004

## DEC-007
- kind: preserve
- status: confirmed
- statement: 保持 devflow 薄路由、三类型分类、DES 追踪、平台原生 Skill 调用、worktree 平级路径和版本号由用户决定等现有契约。
- sourceEntries: [Round 1]
- evidence: `skills/devflow/SKILL.md` invariants、`skills/using-git-worktrees/SKILL.md` 路径契约及仓库 `AGENTS.md`。
- designDisposition: required
- relations: constrains DEC-004, DEC-006

# Decision Tree

| node | status | sourceDecisionIds | dependsOn | note |
|---|---|---|---|---|
| F0 outcome/type | confirmed | DEC-001 | — | 新增可观察工作流能力 |
| F1 actors/permissions | confirmed | DEC-004 | F0 | 主体为 devflow、stage Skills 与执行 agent；不新增用户权限 |
| F2 current flow/problem | confirmed | DEC-002, DEC-006 | F0 | 当前 Plan / direct Bug 可直接进入 Build，Env 缺席 |
| F3 comparable solutions | n/a | DEC-004 | F2 | 内部已有 `using-git-worktrees`，无需外部竞品研究 |
| F4 scope/preserve | confirmed | DEC-002, DEC-007 | F2 | 只增加 Build 前边界，不恢复重驾驶舱 |
| F5 language/ownership | confirmed | DEC-003, DEC-004 | F4 | Env=Build 前工作区准备；task directory=任务产物单元 |
| F6 user-flow tree | confirmed | DEC-002, DEC-003, DEC-006 | F5 | Plan 路径、direct Bug 路径、复用路径均闭合 |
| F7 rules/boundaries | confirmed | DEC-005 | F6 | 不覆盖分叉文档，Env 未完成不 Build |
| F8 system/recovery | confirmed | DEC-003, DEC-004, DEC-005 | F7 | 创建/复用、复制/一致/冲突、成功转 Build |
| F9 qualities/risks | confirmed | DEC-005, DEC-007 | F8 | 数据保护、路径身份、平台兼容 |
| F10 system fit | confirmed | DEC-004, DEC-006 | F8 | 复用现有 devflow Handoff 与 worktree skill |
| F11 alternatives | confirmed | DEC-004 | F10 | 选择显式 Env target；拒绝恢复八阶段或把复制散落到 Build |
| F12 contracts/data flow | confirmed | DEC-003, DEC-004, DEC-006 | F11 | Log/Handoff/task directory 输入输出明确 |
| F13 release/migration | confirmed | DEC-005, DEC-007 | F12 | 无数据迁移；需双平台打包和契约测试 |
| F14 closure | confirmed | DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007 | F13 | 所有 flow 均映射到实现和验证义务 |

# Terms

## Env
- status: confirmed
- definition: Build 前的隔离工作区准备边界；由 devflow 编排，具体 worktree 行为由 `nocode:using-git-worktrees` 执行。
- included: 检测/创建/进入 worktree、项目 setup、任务文档迁移、成功后路由 Build。
- excluded: Design、Plan、Debug、Build 实现本身；八阶段看板。
- source: Round 1 / DEC-002 / DEC-004

## task directory
- status: confirmed
- definition: exact `design.log.md` 所在的 `docs/dev/{username}/{yymmdd}-{serial}-{topic}/` 整个目录。
- included: Log、Design、Plan、render 及同目录任务产物。
- excluded: 其它任务目录和仓库外文件。
- source: Round 1 / DEC-003

# Handoff

From: Verify
To: Review
ConfirmedBy: Round 2
Reason: DES-001 至 DES-004 均已有 fresh verification evidence；Review 修复及复验见 Event 9 至 Event 15。
Read:
  design: ./design.md
  plan: ./devflow-env-before-build-plan.md
  designIds: [DES-001, DES-002, DES-003, DES-004]
Preserve: [DES-004]
Open: []

# Log

## Event 1 — classification
- source: 用户请求与仓库现状
- detail: 当前行为没有违反本次请求前已经成立的权威预期；用户要求新增 Build 前 Env 与文档迁移，分类为 feat，拒绝 bug 与 refactor。
- decisionImpact: [DEC-001]

## Round 1 — F0/F2/F4 — closed

### Background / Evidence

当前 devflow 只路由 Debug、Plan、Build、Verify、Review、Land 与 dev-design；Plan 会直接调用 Build。旧版 Env 已在薄路由重构中移除。用户连续修正目标时点，最终确定为 Build 之前，并要求把此前文档复制进新环境。

### Question

Env 应在 Design 前、Design 后，还是 Build 前创建；进入新 worktree 后如何承接此前文档？

### Agent Recommendation + Reason

推荐在 Build 前创建，并复制整个 task directory 到相同仓库相对路径。这样 Design 与 Plan 不被隔离环境打断，Build 又始终在独立 workspace 中消费完整的设计/计划上下文。

### User Answer

“需要加入，在 design 前”随后修正为“在 design 之后，然后将之前的文档 cp 过去”，最终再次明确：“在 build 之前”。最终有效决定是 Env 在 Build 之前，并复制此前任务文档。

### Decision Changes

形成 DEC-002、DEC-003；结合仓库现有 Handoff 与 worktree 职责形成 DEC-004 至 DEC-007。

### Term Changes

确认 Env 与 task directory 的本任务含义。

### Flow Impact

`Design -> Plan? -> Env -> Build`；direct Bug repair 也走 `Design -> Env -> Build`。

### Next Node

F14 closure；仓库证据已闭合其余节点。

## Round 2 — confirmation — closed

### Background / Evidence

`design.md` 已从 DEC-001 至 DEC-007 生成，并完成 Feat 双向闭合、DEC/DES 映射、接口与影响文件检查。

### Question

是否确认该完整设计基线，并按 `Plan/direct Bug -> Env -> 文档迁移 -> Build` 实施？

### Agent Recommendation + Reason

建议确认。该方案把 Env 固定在唯一 Build 边界，复用现有 worktree skill，同时避免恢复旧八阶段编排或丢失 Design/Plan 文档。

### User Answer

用户明确回复：“确认”。

### Decision Changes

无。确认授权完整设计基线及其 Plan Handoff，不创建新的设计 Decision。

### Term Changes

无。

### Flow Impact

设计状态转为 confirmed，Handoff 到 Plan；Plan 完成后进入 Env。

### Next Node

Plan。

## Event 2 — stage-transition
- source: Handoff confirmed by Round 2
- detail: dev-design -> Plan
- decisionImpact: none

## Event 3 — plan-confirmation
- source: 用户消息 2026-08-14“这里不需要创建 env，开始 build 吧。”
- detail: 用户确认 implementation Plan，并授权开始 Build。
- decisionImpact: none

## Event 4 — stage-transition
- source: 用户对本次 workspace 的明确 in-place 授权
- detail: Plan -> Env(in-place; no worktree; task directory already active) -> Build
- decisionImpact: none

## Event 5 — returned-evidence
- source: dev-build executing protocol
- detail: |
    Task 1 completedDesignCovers=[DES-001, DES-002, DES-004]; changed shared Handoff protocol, devflow Env route, and workflow tests.
    Task 2 completedDesignCovers=[DES-001, DES-004]; changed Plan/direct-Bug producers, Build Env Gate, dev-design trunk, and contract tests.
    Task 3 completedDesignCovers=[DES-002, DES-003, DES-004]; added whole-task-directory absent/identical/divergent transfer contract to using-git-worktrees.
    Task 4 completedDesignCovers=[DES-001, DES-003, DES-004]; added benchmark cases, refreshed Claude representative hashes, and generated Claude/Codex/Qoder/Pi artifacts.
    Evidence: test-first red run failed 5 new assertions; focused green run passed 57 tests; full `node --test 'hooks/*.test.mjs'` passed 252/252; `node scripts/vendor-sync.mjs --check`, `node scripts/package.platform.mjs --check`, `git diff --check`, and placeholder scan passed.
- decisionImpact: none

## Event 6 — stage-transition
- source: Build completed with Event 5 evidence
- detail: Build -> Verify
- decisionImpact: none

## Event 7 — returned-evidence
- source: dev-verify evidence matrix
- detail: |
    | DES ID | result | evidence |
    |---|---|---|
    | DES-001 | pass | workflow-consumers、design-traceability、dev-design-contract 聚焦测试通过；完整 hooks suite 252/252 通过。 |
    | DES-002 | pass | using-git-worktrees 的 Env/taskArtifacts 契约通过聚焦测试；四平台生成物与源码同步检查通过。 |
    | DES-003 | pass | 整目录 absent/identical/divergent 三态契约与冲突停止基准已覆盖；benchmark JSON 解析通过。 |
    | DES-004 | pass | 完整 hooks suite 252/252、vendor-sync --check、package.platform --check、git diff --check 均通过；插件版本未修改。 |
    No blockers, waivers, or residual design obligations.
- decisionImpact: none

## Event 8 — stage-transition
- source: Verify completed with Event 7 evidence
- detail: Verify -> Review
- decisionImpact: none

## Event 9 — review-finding
- source: dev-review five-axis self-review
- detail: |
    R-C1 (Critical, correctness/security): `using-git-worktrees` 的既有 task-worktree、detached、normal-checkout in-place 分支会直接跳到 Step 3，绕过新加的 Step 2c taskArtifacts 校验；sandbox 创建失败还会自动退回原工作区，未取得 Env 所要求的显式授权。该合并级问题可能让 Build 在未验证 exact Log、甚至用户未同意的 workspace 中继续。
    Structural remedy: 为所有原地路径定义一个统一 continuation rule；Env 必须先走 Step 2c，standalone 才可直接 Step 3；sandbox fallback 对 Env 必须重新取得显式确认。
- decisionImpact: none

## Event 10 — stage-transition
- source: Critical finding R-C1 requires repair
- detail: Review -> Build
- decisionImpact: none

## Event 11 — returned-evidence
- source: dev-build review repair
- detail: |
    先在 `hooks/workflow-consumers.test.mjs` 增加原地 continuation 与 sandbox explicit-confirmation 契约；focused test 21/22 失败，证明缺口存在。随后在 `skills/using-git-worktrees/SKILL.md` 增加统一 in-place continuation rule，修正三类原地分支和 sandbox fallback；focused test 22/22 通过，并重新生成四平台发布物。
- decisionImpact: none

## Event 12 — stage-transition
- source: R-C1 repair completed
- detail: Build -> Verify
- decisionImpact: none

## Event 13 — returned-evidence
- source: dev-verify after review repair
- detail: |
    Full `node --test 'hooks/*.test.mjs'` passed 252/252. `node scripts/vendor-sync.mjs --check`, `node scripts/package.platform.mjs --check`, `git diff --check`, benchmark JSON parsing, and plugin-version check all passed; version remains 0.10.3.
- decisionImpact: none

## Event 14 — stage-transition
- source: post-repair Verify completed
- detail: Verify -> Review
- decisionImpact: none

## Event 15 — review-verdict
- source: dev-review five-axis self-review after repair
- detail: |
    Correctness ✅ producers, Env success/failure, exact-Log authority, in-place paths, and Build Gate are consistent.
    Readability ✅ the shared in-place continuation rule avoids repeated branch semantics and names all artifact fields explicitly.
    Architecture ✅ devflow stays a thin router; using-git-worktrees remains the sole workspace owner; source and four generated platform consumers are synchronized.
    Security ✅ repository containment, divergent no-overwrite, explicit in-place authorization, and failure-stop semantics are present; no dependency or secret surface was added.
    Performance ✅ one bounded task-directory comparison/copy occurs only at Env; identical trees are a no-write reuse.
    Simplification ✅ no dead code or behavior-preserving simplification remains in the changed surface.
    Independent cross-review skipped (default self-review; user did not request escalation).
    Verdict: approved; Critical 1 resolved, Warning 0, Suggestion 0.
- decisionImpact: none
