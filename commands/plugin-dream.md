---
description: 插件仓库自维护巡检——客观漂移(4项) + 边界符合性(19项)两层检测，候选清单+用户勾选+执行修复
argument-hint: (无参数)
---

# /plugin-dream：插件仓库自维护巡检

检查 nocode-evolve 插件仓库自身（rules/skills/commands/manifest）与预期状态的偏差，提议修复动作，用户确认后执行。独立于 `/plugin-distill`——distill 管写入，dream 管巡检维护。

## 执行流程

### Phase 1: Scan（两层检测）

#### Layer 1 — 客观漂移（机械可测，跑现成命令）

| 检测 | 命令/判据 | 修复类型 |
|---|---|---|
| 生成物漂移 | `node hooks/generate.mjs --check`，exit 1 = 漂移 | 自动：重跑 `node hooks/generate.mjs` |
| vendor 漂移 | `node scripts/vendor-sync.mjs --check`，exit 1 = 不一致 | 自动：重跑 `node scripts/vendor-sync.mjs` |
| manifest 失效路径 | 遍历 `rules/manifest.json` 的 `read` 字段，排除空串/括号说明串（如 `(skill, 无 rule 文件)`）/非 `/rules/` 路径（如指向 `model/` 的），归一化 `${CLAUDE_PLUGIN_ROOT}/` 前缀后 `test -e` | 护栏：补文件或删条目（二次确认） |
| 孤儿 rule | `ls rules/*.md` 归一化路径 ∖ manifest `read` 字段归一化后的登记集合（两侧路径归一化必须一致，否则会把全部 rule 误判孤儿） | 护栏：登记进 manifest 或删除（二次确认） |

#### Layer 2 — 边界符合性（语义，按对象类型分组读文件判断；单文件级判据，不跨文件推理，保证结论可复现）

**rule 对象**（逐个 `rules/rule-*.md` + 对应 manifest 条目）：

| 检测 | 判什么 |
|---|---|
| 重复/重叠 | 跟其他 rule 的触发/职责是否重叠——该融合没融合（distill 融合优先原则） |
| 触发质量 | `trigger_desc` 是否具体可自判命中，不是"需要时读"这类空话 |
| 触发负例 | `trigger_desc`/`triggers` 有没有负例划边界 |
| summary 时效 | manifest `summary` 是否仍准确反映 rule 文件当前内容 |
| 字段完整 | `id/bucket/trigger_desc/read/summary` 齐全，`bucket` 在 `buckets` 定义内 |
| read 路径规范 | 仅对 rule 文件型 `read` 检查——用 `${CLAUDE_PLUGIN_ROOT}` 前缀；空 `read`/括号说明串/`model/` 路径不算违规，跳过 |
| 模式边界 | 是当前指令，文件名不含日期、不含历史叙述 |

**skill 对象**（逐个 `skills/*/SKILL.md`；深度判断——是否符合原理/调用正确/专业性——委托 `nocode-evolve:skill-writing` 做只读评估，本命令不重新发明判据）：

| 检测 | 判什么 |
|---|---|
| 符合原理 | 单一职责、有 Enter/Exit Gate、刚性/弹性标注 |
| 调用正确 | 委派/handoff 链成立，引用的 skill/命令存在不悬空 |
| 专业/非空壳 | 内容非敷衍占位 |
| description 触发准确 | `Use when` + 反例（Not for）齐全 |
| Step 编号规范 | 整数或字母后缀，禁分数编号（CLAUDE.md 规则5） |
| workflow 防跳步登记 | workflow 类 skill 是否登记在 `rules/manifest.json` 的 `workflow_skills` |
| 引用路径有效 | `{NOCODE_SKILL_REF}`/references/rule 文件引用不悬空 |
| 硬交接完整 | workflow skill 末步有 handoff 调下一阶段 |

**command 对象**（逐个 `commands/*.md`）：命名惯例（`*hub`/`*flow`/`xx-yy`）/ 模式边界（hub 只转发不写业务逻辑）。

**通用**（跨对象）：版本联动（改了插件加载文件但 `plugin.json` 没升）/ 内容 stale（引用路径或机制已变没跟着更新）。

> 语义检测规模提示：本仓 skill 数量较多，逐 skill 跑满 8 项判断成本不低——可按对象类型分组跑（先 rule 组，再 skill 组），或用户指定范围（如"只查 rule"/"只查 skill"）缩小单次扫描面，不强制全量。

### Phase 2: Propose（呈现候选 + 用户确认）

汇总 Layer1 + Layer2 全部候选，表格呈现：

```
| # | 对象 | 检测 | 动作 | 理由 |
|---|---|---|---|---|
| 1 | rules/rule-foo.md | O3 manifest失效路径 | 补文件/删条目 | read 指向的文件已不存在 |
| 2 | skills/bar/SKILL.md | S4 description触发不准 | 建议优化(委托skill-writing) | description 缺 Use when |
```

`AskUserQuestion` 多选让用户勾选要执行的编号。0 候选 → 报"状态良好"。

### Phase 3: Execute（按类型分派）

- **自动类**（O1/O2）：直接重跑对应命令
- **护栏类**（O3/O4，涉及删除）：回显路径 + 原因 + 影响，二次确认后执行
- **建议式**（Layer2 全部）：不自动改——rule 类委托 `Skill(nocode-evolve:plugin-distill)`，skill 类委托 `Skill(nocode-evolve:skill-writing)`，由用户在委托流程里最终拍板

### 完成报告

```
plugin-dream 完成：
  ✓ O1: generate 重新生成 catalog 分片（漂移已修复）
  ✓ O3: rules/rule-foo.md 的失效路径已补 → path/to/target.md
  → 委托: skills/bar/SKILL.md description 优化，转 Skill(skill-writing)
  ✗ 跳过: #4（用户未勾选）

ℹ 状态：0 error / 1 warn（含未处理的 Layer2 建议）
```

## 和 SessionStart 自动 sanity check 的关系

`hooks/inject-rules.sh` 已在 SessionStart 跑 `generate.mjs --check`，但只 warn 不阻断、不修复。`/plugin-dream` 是开发者主动触发的交互式扫描 + 提议修复 + 可执行，两者互补不重复。

## 不要

- 不自动执行任何删除——O3/O4 的删除类动作走护栏二次确认
- 不对 Layer2 语义类问题自作主张改文件——只提议、委托对应写入命令，不越权
- 不跨文件推理下结论——每项 Layer2 检测限单文件级判据，保证结论可复现
