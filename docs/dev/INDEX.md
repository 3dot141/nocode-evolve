# 工程设计文档索引

> `docs/dev/{username}/{yymmdd}-{serial}-{topic}/` 保存同一 topic 的设计、计划与配套资源。
> 本索引跟踪仍需区分 current / superseded / historical 的关键设计。

## Current

| 路径 | 主题 | 状态 |
|---|---|---|
| `3dot141/260723-01-codex-restart-script/codex-restart-script-design.md` | codex-restart 状态检查、proxy 告警与 daemon-only fire-and-forget 重启脚本 | **implemented** |
| `3dot141/260723-03-native-platform-block-packaging/native-platform-block-packaging-design.md` | 原生平台块 + 静态打包 | **approved / implementation pending** |
| `3dot141/260603-02-strategic-review-v3.4.0/strategic-review-v3.4.0.md` | v3.4.0 战略级架构改进 | **draft / 落地中** |
| `3dot141/260602-02-worktree-setup-script/worktree-setup-script-design.md` | worktree-setup 与同级扁平 worktree | **active** |

## Superseded

| 路径 | 主题 | 被谁取代 |
|---|---|---|
| `3dot141/260720-02-codex-semantic-compatibility/codex-semantic-compatibility-design.md` | 双运行时语义兼容 | 被 `3dot141/260723-03-native-platform-block-packaging/native-platform-block-packaging-design.md` 取代 |
| `3dot141/260720-01-claude-codex-dual-runtime/claude-codex-dual-runtime-design.md` | Claude/Codex 双平台插件架构 | 被 `3dot141/260720-02-codex-semantic-compatibility/codex-semantic-compatibility-design.md` 取代 |
| `3dot141/260602-01-skillify-route/skillify-route-design.md` | skillify-route v3.0.0 | 被 `3dot141/260603-01-pilot-catalog-rearch/pilot-catalog-rearch.md` 取代 |
| `3dot141/260603-01-pilot-catalog-rearch/pilot-catalog-rearch.md` | pilot-catalog v3.3.0 | 被 `3dot141/260603-02-strategic-review-v3.4.0/strategic-review-v3.4.0.md` 部分修正 |

## Historical

| 路径 | 主题 | 备注 |
|---|---|---|
| `3dot141/260526-02-rule-trigger-eval/rule-trigger-eval-design.md` | rule-eval 框架 | 已实施的历史背景 |

## 配套计划

| 路径 | 配对设计 | 状态 |
|---|---|---|
| `3dot141/260720-01-claude-codex-dual-runtime/claude-codex-dual-runtime-plan.md` | 同目录 design | **superseded** |
| `3dot141/260602-01-skillify-route/skillify-route-plan.md` | 同目录 design | **superseded** |

## 规则

- 新增 design / plan：同一 topic 放同一目录，必要时更新 Current。
- 设计被取代：移动索引条目到 Superseded 并点名替代设计。
- 已实施且只保留背景价值：移动索引条目到 Historical。
- 不删除历史设计；状态变化只更新索引。
