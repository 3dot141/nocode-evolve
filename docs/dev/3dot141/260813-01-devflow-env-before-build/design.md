---
type: feat
status: confirmed
sourceLog: ./design.log.md
artifacts:
  design: ./design.md
---

# Devflow Build 前 Env 与任务文档迁移

## Panorama

目标：Design 与 Plan 在当前工作区形成稳定任务文档；任何首次进入 Build 的路径都先经过 Env，在目标 worktree 复制完整任务目录后才允许实现。

```text
new engineering task
        |
        v
dev-design ------------------------------+
        |                                |
        | feat/refactor or planned bug   | direct bug repair
        v                                |
      Plan                               |
        |                                |
        +---------------+----------------+
                        v
                 Handoff: Env                         [DES-001]
                        |
                        v
          nocode:using-git-worktrees                  [DES-002]
          detect/create/reuse -> enter -> setup
                        |
                        v
          copy complete task directory                [DES-003]
          same repository-relative path
              | identical -> reuse
              | divergent -> stop
                        |
                        v
                 Handoff: Build                       [DES-001]
                        |
                        v
                 nocode:dev-build
```

参与者是 devflow、dev-design、dev-plan、using-git-worktrees 与 dev-build。范围只覆盖 Build 入口工作区和任务产物交接；不恢复旧八阶段看板，不改变 Debug、Verify、Review、Land 的领域方法，也不自动升级插件版本。

## 1. Source, Goal, Scope, Preserve

### DES-001 — Env gates every first Build entry

- kind: behavior
- statement: devflow 支持 `Env` Handoff target；Plan 完成或 direct Bug repair 准备 Build 时必须先进入 Env，Env 成功后才把同一任务 Handoff 更新为 Build 并调用 dev-build。
- sourceDecisionIds: DEC-002, DEC-004, DEC-006

### DES-002 — Reuse the existing worktree owner

- kind: contract
- statement: Env 不新建独立实现 Skill，而是把 exact Log、源 checkout 与 task directory 交给 `nocode:using-git-worktrees`；该 Skill 继续拥有 worktree 检测、创建/复用、进入和项目 setup。
- sourceDecisionIds: DEC-004, DEC-007

### DES-003 — Carry the complete task directory

- kind: data
- statement: 当 Env 切换到不同 worktree 时，把 exact Log 所在整个 task directory 复制到目标的相同仓库相对路径；目标不存在时复制、内容一致时复用、内容分叉时停止，目标副本随后成为唯一活动任务文档。
- sourceDecisionIds: DEC-003, DEC-005

### DES-004 — Preserve thin routing and platform contracts

- kind: preserve
- statement: 保持 `bug | feat | refactor` 分类、Handoff 权威、DES 追踪、平台原生 Skill 调用、平级 worktree 路径、用户可明确选择原地工作以及插件版本由用户决定的现有契约。
- sourceDecisionIds: DEC-005, DEC-007

### Scope

- 为 devflow 增加 Env target 和 Env -> Build 转换。
- 让 dev-plan 在确认后先 Handoff Env，而不是直接调用 Build。
- 让 direct Bug repair 先 Handoff Env。
- 扩展 using-git-worktrees 的 task directory 迁移输入与安全语义。
- 增加工作流契约测试与 benchmark case，重新生成平台发布物。

### Non-scope

- 不把 Env 放到 Design、Plan 或 Debug 前。
- 不恢复 Full / Standard / Fix / Mini 或八阶段 dashboard。
- 不把 task docs 放进 worktree setup 脚本的通用 env/config 探测。
- 不改变 Verify/Review 回流语义；已在 task worktree 时复用现有 Env。
- 不自动升级 `plugin/metadata.json` 版本。

## 2. Current Flow and Problem Evidence

当前 `skills/devflow/SKILL.md` 的 Handoff table 没有 Env；`skills/dev-plan/SKILL.md` 确认后直接调用 dev-build；`skills/dev-design/references/handoff.md` 允许单切片 Bug repair 直接 Build。因此 Design/Plan 生成的未提交文档留在源 checkout，而 Build 既可能没有隔离 workspace，也可能在新 worktree 中看不到这些任务产物。

内部可比方案是仓库已有的 `using-git-worktrees`：它已经负责平台原生 worktree 创建与进入。选择扩展其输入契约，避免另造一个重复 worktree owner。

## 3. Selected Solution and Alternatives

选择“显式 Env Handoff target + 复用 using-git-worktrees + 整目录安全复制”。

- 对比“在 Design 前建 Env”：会让需求/设计阶段承担无必要的 workspace 成本，且不符合最终用户决定。
- 对比“dev-build 内隐式建 Env”：时点虽接近，但 Handoff 不可观察，Plan 与 direct Bug 两条入口容易形成不同语义。
- 对比“恢复旧八阶段 devflow”：复制阶段细节，违反薄路由约束。
- 对比“只复制 design.md”：会遗漏 process Log、Plan、render 和后续同目录产物。

## 4. End-to-End Flows and Recovery

### Planned feature/refactor/bug

```text
dev-design --Handoff Plan--> dev-plan
dev-plan --confirmed Plan + Handoff Env--> devflow               [DES-001]
devflow --exact Log + task dir--> using-git-worktrees            [DES-002]
worktree ready --copy/reuse task dir--> target checkout           [DES-003]
target Log --Handoff Build--> dev-build                           [DES-001]
```

### Direct Bug repair

```text
dev-design --confirmed one-slice repair--> Handoff Env            [DES-001]
Env --worktree + task docs--> Handoff Build -> dev-build
```

### Failure and recovery

- Worktree creation/entry失败：保留 Handoff Env，不进入 Build。
- 用户明确选择原地工作：using-git-worktrees 完成当前 workspace setup；task directory 无需复制，Env 可转 Build。
- 目标 task directory 不存在：复制整个源目录。
- 目标目录与源目录一致：复用目标目录。
- 目标目录存在且内容不同：停止并展示冲突，不覆盖、不合并、不进入 Build。
- Verify/Review 返回 Build：当前已经位于 task worktree，检测到现有隔离后复用，不重复迁移。

## 5. Rules and State

```text
Handoff.To = Plan
  -> Plan confirmed
  -> Handoff.To = Env

Handoff.To = Env
  -> workspace ready + task docs ready
  -> append stage-transition evidence
  -> Handoff.To = Build

Handoff.To = Build
  -> dev-build Enter Gate
```

Env 不是设计 Decision owner，也不修改 DES 含义；它只更新导航 Handoff 和 process Event。跨 checkout 后仓库相对 task path 不变，绝对 checkout 前缀切换到目标 worktree；后续只写目标副本。

## 6. Boundaries and Contracts

### Env routing contract `[DES-001, DES-002]`

- Entry: current Log `Handoff.To: Env`。
- Input: exact source Log path、task directory 的仓库相对路径、DES scope、Plan path（存在时）、Preserve 与 Open。
- Owner: devflow。
- Collaborator: `nocode:using-git-worktrees`。
- Success: target workspace active、task docs ready、target Log Handoff 改为 Build。
- Error: Handoff 保持 Env并报告证据；不得调用 dev-build。

### Task artifact transfer contract `[DES-003]`

- Source: Env 调用前 exact Log 所在 task directory。
- Destination: `<target-worktree>/<same-repository-relative-task-dir>`。
- Transfer unit: 整个目录。
- Idempotency: absent -> copy；identical -> no-op；divergent -> stop。
- Authority after success: destination copy。
- Cleanup: Land 随 worktree 生命周期处理，不在 Env 删除源副本。

## 7. Realization View — Build 前隔离与上下文连续性

- Source Decisions: `DEC-002`, `DEC-003`, `DEC-004`, `DEC-005`, `DEC-006`, `DEC-007`
- Joint DES set: `DES-001`, `DES-002`, `DES-003`, `DES-004`
- Joint outcome: 每条首次 Build 路径都在目标 workspace 中获得完整且不冲突的设计/计划上下文。
- Depends on / enables: enables dev-build；depends on confirmed Design and optional confirmed Plan。

### DES collaboration

| DES | Responsibility | Requires | Provides | Independent proof |
|---|---|---|---|---|
| DES-001 | Build 前路由 Gate | current Handoff | Env -> Build transition | workflow contract test |
| DES-002 | worktree 生命周期 | exact task input | active workspace | skill source assertions |
| DES-003 | 任务文档连续性 | source and target roots | target exact Log | absent/identical/divergent cases |
| DES-004 | 不破坏现有架构 | current invariants | compatibility boundary | existing full suites + package check |

### Interface implementation

#### Handoff route — `Env` `[DES-001]`

- Defined at: `skills/devflow/SKILL.md` Handoff table and Build-boundary instructions。
- Producers: `skills/dev-plan/SKILL.md` confirmed Plan；`skills/dev-design/references/handoff.md` direct Bug repair。
- Consumer: devflow。
- Output: `Handoff.To: Build` plus stage-transition Event after workspace and artifact success。

#### Worktree task input — exact task directory `[DES-002, DES-003]`

- Defined at: `skills/using-git-worktrees/SKILL.md`。
- Input: source project root、target worktree root、repository-relative task directory。
- Output: destination directory status `copied | reused-identical | conflict` and target exact Log path。
- Guard: no divergent overwrite；no task path outside source repository。

### Impacted files in this realization view

```text
skills/
├── devflow/SKILL.md                         (MODIFY) [DES-001, DES-002]
├── dev-design/references/handoff.md         (MODIFY) [DES-001]
├── dev-plan/SKILL.md                        (MODIFY) [DES-001]
├── dev-build/SKILL.md                       (MODIFY) [DES-001, DES-004]
└── using-git-worktrees/SKILL.md             (MODIFY) [DES-002, DES-003, DES-004]
hooks/
└── workflow-consumers.test.mjs              (MODIFY) [DES-001, DES-002, DES-003, DES-004]
benchmark/cases/devflow/
└── devflow-ext-cases.json                   (MODIFY) [DES-001, DES-003]
docs/dev/
├── INDEX.md                                 (MODIFY) [DES-004]
└── 3dot141/260813-01-devflow-env-before-build/
    ├── design.log.md                        (NEW) [DES-004]
    └── design.md                            (NEW) [DES-004]
plugins/{claude,codex,qoder,pi}/nocode/       (GENERATED) [DES-004]
```

### Integrated proof

- Contract assertions prove Plan/direct Bug produce Env rather than Build, devflow routes Env through using-git-worktrees, and Build requires completed Env transition。
- Artifact-transfer examples prove whole-directory copy and divergent-target stop semantics。
- Focused hook tests, full hook suite, vendor check and platform package check prove preservation。

## 8. Consolidated Impacted-files Index

| File | Change | DES IDs | Change point |
|---|---|---|---|
| `skills/devflow/SKILL.md` | MODIFY | DES-001, DES-002 | add Env routing and success transition |
| `skills/dev-design/references/handoff.md` | MODIFY | DES-001 | direct Bug repair targets Env |
| `skills/dev-plan/SKILL.md` | MODIFY | DES-001 | confirmed Plan hands off Env via devflow |
| `skills/dev-build/SKILL.md` | MODIFY | DES-001, DES-004 | require completed Env boundary |
| `skills/using-git-worktrees/SKILL.md` | MODIFY | DES-002, DES-003, DES-004 | accept and safely carry task directory |
| `hooks/workflow-consumers.test.mjs` | MODIFY | DES-001–DES-004 | executable workflow contracts |
| `benchmark/cases/devflow/devflow-ext-cases.json` | MODIFY | DES-001, DES-003 | Env routing evaluation case |
| `docs/dev/INDEX.md` | MODIFY | DES-004 | register active design |
| platform plugin trees | GENERATED | DES-004 | package from source, never hand-edit |

## 9. Cross-cutting Concerns

- Safety: never overwrite divergent task documents; preserve source checkout.
- Security: transfer only the explicit repository-contained task directory, not generic ignored env candidates.
- Compatibility: preserve all platform-native Skill invocation blocks.
- Observability: stage-transition Event records source/target workspace and artifact result without creating a new Registry.
- Idempotency: existing isolated worktree and identical task directory are successful no-ops.

## 10. Release, Migration, Rollback, Cleanup

- No plugin version change unless the user separately requests one.
- Run `node scripts/package.platform.mjs` because runtime Skill sources change; commit source and generated outputs together.
- Existing active tasks with Build Handoff need one Env transition before new Build work; already-isolated tasks reuse their current worktree.
- Rollback is reverting the source commit and regenerated platform outputs; no persistent data migration.
- Land retains responsibility for final worktree cleanup.

## 11. Acceptance and Verification Objectives

1. A confirmed Plan no longer calls dev-build directly; it persists/returns Env routing.
2. A direct Bug repair targets Env before Build.
3. devflow recognizes Env, invokes using-git-worktrees, and only transitions to Build after workspace plus docs success.
4. Whole task directory is carried to the same relative location; divergent target content blocks overwrite.
5. dev-build rejects a first Build entry lacking completed Env evidence.
6. Existing classification, DES, platform, worktree path, vendor sync, packaging and test contracts remain green.

## 12. DEC / DES Coverage

| Decision ID | Design disposition | DES IDs / n/a reason |
|---|---|---|
| DEC-001 | required | DES-001 |
| DEC-002 | required | DES-001 |
| DEC-003 | required | DES-003 |
| DEC-004 | required | DES-001, DES-002 |
| DEC-005 | required | DES-003, DES-004 |
| DEC-006 | required | DES-001 |
| DEC-007 | required | DES-002, DES-004 |
