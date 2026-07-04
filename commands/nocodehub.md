---
description: nocode 插件自维护聚合入口（hub），分发到 3 个子动作（write/dream/status）
argument-hint: <sub-action> [args]
---

# /nocodehub：插件自维护聚合入口

统一入口，聚合插件自身（rules/skills/manifest/commands）的维护动作。每个子动作也可以直接用独立命令调用。

## 与 personalhub / projecthub 的区别

| | personalhub | projecthub | nocodehub |
|---|---|---|---|
| 管什么 | `.agents-personal/`（私有知识库） | 项目子目录的 AGENTS.md + README.md | nocode 插件自身（rules/skills/manifest/commands） |
| 入仓 | gitignored | 版本控制，共享 | 版本控制，共享（插件仓库本身） |
| 受众 | 仅当前用户的 agent | 所有协作者的 agent + 人类 | nocode 插件的维护者 |
| 文件 | wiki/ + rules/ + AGENTS.md | 各子目录的 AGENTS.md + README.md | commands/rules/skills/manifest.json |

## 用法

`/nocodehub <sub-action> [args]`

## 子动作路由

| 子动作 | 做什么 | 转发到 | 独立命令 |
|---|---|---|---|
| `write` | 新增/优化 plugin rule 或 skill | `Skill(nocode:plugin-distill)` | `/plugin-distill` |
| `dream` | 插件仓库自维护巡检（客观漂移+边界符合性） | `Skill(nocode:plugin-dream)` | `/plugin-dream` |
| `status` | 概览当前插件健康状态 | 内联执行（见下方） | — |

## 执行

### 解析子动作

从 `$ARGUMENTS` 取第一个词作为子动作，剩余部分作为子动作的参数传递。

无参数或不识别的子动作 → 输出用法表格：

```
/nocodehub <sub-action>

  write    新增/优化 plugin rule 或 skill
  dream    插件仓库自维护巡检
  status   概览插件当前健康状态
```

### write / dream

调对应的 `Skill()`，把剩余参数传进去。

### status

内联执行，输出插件当前状态概览：

1. 读 `.claude-plugin/plugin.json` 的 `version`（精确）
2. 统计 `rules/rule-*.md` 文件数（精确，rule 数）
3. 统计 `skills/*/SKILL.md` 数量（精确，skill 数）
4. 跑 `node scripts/vendor-sync.mjs --check`（展示级，人工核验）
5. 跑 `node --test 'hooks/*.test.mjs'`（展示级，测试通过/失败数）
6. 跑 `node scripts/compile.rule.js --check` + `node scripts/compile.hooks.js --check`（展示级，漂移状态）

输出格式：

```
📦 nocode 插件状态

  版本:    5.1.2
  rule 数: 25
  skill 数: 38
  vendor 同步: ✓ 一致
  测试:    ✓ 60/60 通过
  漂移:    ✓ 零漂移

  → 结论: 状态健康
```

（vendor 同步/测试/漂移三项若有异常，建议跑 `/nocodehub dream` 巡检具体问题。）
