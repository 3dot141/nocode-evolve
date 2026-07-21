# 设计文档索引

> 本目录 (`docs/superpowers/specs/`) 与配套 `docs/superpowers/plans/` 保存设计 spec 与实施 plan. 文档随插件迭代,本 INDEX 标每份文档当前状态 (current / superseded / historical), 防止 agent 顺手读到过时设计当 source of truth.

文档命名约定 (见 `model/agent-about.md` 全局约定): `docs/superpowers/specs/{username}/yymmdd-<topic>-design.md`. 时间格式 `yymmdd`.

## Current (当前生效的设计)

| 路径 | 主题 | 状态 |
|---|---|---|
| `3dot141/260720-codex-semantic-compatibility-design.md` | 双运行时语义兼容：using-nocode 领域 references、统一 Open Design、workflow 与 session 隔离 | **implemented / automated verification complete / client smoke pending** |
| `3dot141/260603-strategic-review-v3.4.0.md` | v3.4.0 双路 audit + 红蓝军推演后的战略级架构改进 spec (Batch 1 P0 = v3.5.0 落地依据; Batch 2/3 未实施) | **draft / 落地中** |
| `3dot141/260602-worktree-setup-script-design.md` | worktree-setup.mjs (新建分支走 worktree, 落 `<project>-<branch_flat>/`, setup verb 补 env/IDE/node_modules + symlink) | **active** (主仓 git-worktree 增强已实施) |

## Superseded (被新设计取代)

| 路径 | 主题 | 被谁取代 |
|---|---|---|
| `3dot141/260720-claude-codex-dual-runtime-design.md` | Claude Code / Codex 双平台插件架构：通用语义内核 + 平台适配器 + 编译期双产物 | 被 `260720-codex-semantic-compatibility-design.md` 取代 — 旧实现只验证生成结构，未覆盖 Claude Design、Artifact、Workflow 等语义依赖与真实客户端验收 |
| `3dot141/260602-skillify-route-design.md` | v3.0.0 skillify-route 设计 (route skill 按需中转 + manifest 单源) | 被 `260603-pilot-catalog-rearch.md` 取代 — pilot-catalog 重构推翻 route 软触发, 改为 catalog 分片常驻 |
| `3dot141/260603-pilot-catalog-rearch.md` | v3.3.0 pilot-catalog 重构 (catalog 分片常驻 + pilot 手动入口 + design-doc-rendering 并入) | 被 `260603-strategic-review-v3.4.0.md` 部分修正 — 战略级 review 指出 catalog 常驻 ≠ 必触发 (本质仍是软触发), Batch 1 加 Step 0 扫桶硬指令 + pilot 主动建议改良 |

## Historical (历史背景, 已实施)

| 路径 | 主题 | 备注 |
|---|---|---|
| `docs/plans/3dot141/260526-rule-trigger-eval-design.md` | rule-eval 框架 (route-recall + intent-signal + 混淆矩阵, 仓库本地 dev 工具) | 旧 `docs/plans/` 路径 (无 `superpowers` 前缀), 不迁移; v1 框架已实施在 `.claude/commands/rule-eval.md` |

## Plans (配套实施计划)

实施计划落 `docs/superpowers/plans/{username}/`:

| 路径 | 配对的 spec | 状态 |
|---|---|---|
| `3dot141/260720-codex-semantic-compatibility.md` | `260720-codex-semantic-compatibility-design.md` | **superseded** — 私有 entrypoint/provider-attempt 方案被轻量 using-nocode 设计取代，最终实现未按该 plan 执行 |
| `3dot141/260720-claude-codex-dual-runtime.md` | `260720-claude-codex-dual-runtime-design.md` (superseded) | **superseded** — `689cc25` 仅为 draft implementation，等待新设计配套 plan |
| `3dot141/260602-skillify-route.md` | `260602-skillify-route-design.md` (superseded) | **superseded** — skillify-route v3.0.0 已被 pilot-catalog v3.3.0 取代 |

## 规则

- **写新 spec / plan 后**: 本 INDEX 加一行 (current 表), 标 draft / approved / implemented / archived 状态.
- **spec 被新 spec 取代**: 旧 spec 从 current 表移到 superseded 表, 在「被谁取代」列点名新 spec.
- **spec 已实施 + 不再做参考依据**: 移到 historical 表, 备注怎么落地的.
- **DO NOT 删历史 spec**: 删除 = 丢上下文; 标 superseded / historical 即可. (与 `.agents-personal/` 删除护栏同源原则: 历史决策的参考价值由用户判断, 不替用户拍板删.)
