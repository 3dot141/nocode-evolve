---
description: 插件仓库自维护巡检——客观漂移(4项) + 边界符合性(20项)两层检测，候选清单+用户勾选+执行修复
argument-hint: (无参数)
---

# /plugin-dream：插件仓库自维护巡检

检查 nocode 插件仓库自身（rules/skills/commands/manifest）与预期状态的偏差，提议修复动作，用户确认后执行。独立于 `/plugin-distill`——distill 管写入，dream 管巡检维护。

## 执行流程

### Phase 0: 增量范围判断（Baseline Diff）

先于 Phase 1 的任何检测，用 `scripts/plugin-dream-baseline.mjs` 判断本次要跑多大范围：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-dream-baseline.mjs" "${CLAUDE_PLUGIN_ROOT}"
```

解析输出 JSON（`{ action: "diff", diff: null | { commitDiff, dirtyFiles }, changed: boolean }`），按以下分支处理：

| `diff` | `changed` | 处理 |
|---|---|---|
| `null`（首次运行，或 baseline 指向的 commit 因 rebase 等原因不可达） | `true` | 走全量：Phase 1 Layer1 + Layer2 都对全部对象跑；本轮 Phase 3 执行完毕后进入 **Phase 4**，调用 `setBaseline` 记录本次 HEAD 为新 baseline |
| 非 `null` 且 `commitDiff`/`dirtyFiles` 均为空 | `false` | **秒回**，不进入 Phase 1，直接输出：`✓ plugin-dream：自上次检查以来 rules/skills/commands/hooks/scripts/rules/manifest.json/.claude-plugin/plugin.json 无变化，无需维护`，命令结束 |
| 非 `null` 且 `commitDiff`/`dirtyFiles` 至少一个非空 | `true` | 合并 `commitDiff ∪ dirtyFiles` 得到"变更文件集合"，继续 Phase 1；Layer2 只对该集合覆盖到的 rule/skill/command 对象跑检测；本轮 Phase 3 执行完毕后**同样进入 Phase 4**，调用 `setBaseline` 把 baseline 推进到本次 HEAD（处理过一轮变化后必须前移，不止首次运行才前移，否则 diff 范围只会越滚越大，秒回永久失效）|

> 这一步不可跳过——即使用户在参数里指定了范围（如"只查 rule"），也先跑本判断决定 Layer2 的候选文件集合是"全部 rule"还是"变更文件集合 ∩ rule"。

### Phase 1: Scan（两层检测）

#### Layer 1 — 客观漂移（机械可测，跑现成命令；不受 Phase 0 增量范围影响，每次都全量跑——generate.mjs --check/vendor-sync.mjs --check 本身足够快，不需要增量优化）

| 检测 | 命令/判据 | 修复类型 |
|---|---|---|
| 生成物漂移 | `node hooks/generate.mjs --check`，exit 1 = 漂移 | 自动：重跑 `node hooks/generate.mjs` |
| vendor 漂移 | `node scripts/vendor-sync.mjs --check`，exit 1 = 不一致 | 自动：重跑 `node scripts/vendor-sync.mjs` |
| manifest 失效路径 | 遍历 `rules/manifest.json` 的 `read` 字段，排除空串/括号说明串（如 `(skill, 无 rule 文件)`）/非 `/rules/` 路径（如指向 `model/` 的），归一化 `${CLAUDE_PLUGIN_ROOT}/` 前缀后 `test -e` | 护栏：补文件或删条目（二次确认） |
| 孤儿 rule | `ls rules/*.md` 归一化路径 ∖ manifest `read` 字段归一化后的登记集合（两侧路径归一化必须一致，否则会把全部 rule 误判孤儿） | 护栏：登记进 manifest 或删除（二次确认） |

#### Layer 2 — 边界符合性（语义，按对象类型分组读文件判断；单文件级判据，不跨文件推理，保证结论可复现）

> **扫描范围**：若 Phase 0 判定为"首次运行/降级"，以下每类对象全量扫描；若判定为"有变化"，每类对象只扫描 Phase 0 产出的"变更文件集合"里出现的那些 `rules/*.md` / `skills/*/SKILL.md` / `commands/*.md`（一个对象文件本身或其 manifest 条目出现在变更集合即算命中），其余对象本轮跳过。

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

**skill 对象**（逐个 `skills/*/SKILL.md`；深度判断——是否符合原理/调用正确/专业性——委托 `nocode:skill-writing` 做只读评估，本命令不重新发明判据）：

| 检测 | 判什么 |
|---|---|
| 符合原理 | 单一职责、有 Enter/Exit Gate、刚性/弹性标注 |
| 调用正确 | 委派/handoff 链成立，引用的 skill/命令存在不悬空 |
| 专业/非空壳 | 内容非敷衍占位 |
| description 触发准确 | `Use when` + 反例（Not for）齐全 |
| Step 编号规范 | 整数或字母后缀，禁分数编号（CLAUDE.md 规则5） |
| 引用路径有效 | `{NOCODE_SKILL_REF}`/references/rule 文件引用不悬空 |
| 硬交接完整 | workflow skill 末步有 handoff 调下一阶段 |
| 自闭环边界 | SKILL.md 正文/私有 `references/` 是否直接指路 `rules/rule-*.md`、`model/agent-*.md`、`hooks/`、非自身 `scripts/` 等插件内部实现文件（自身/共享 `references/` 除外，`CLAUDE.md` 规则6） |

**command 对象**（逐个 `commands/*.md`）：命名惯例（`*hub`/`*flow`/`xx-yy`）/ 模式边界（hub 只转发不写业务逻辑）。

**通用**（跨对象）：版本联动（改了插件加载文件但 `plugin.json` 没升）/ 内容 stale（引用路径或机制已变没跟着更新）。

> 语义检测规模提示：本仓 skill 数量较多，逐 skill 跑满 9 项判断成本不低——可按对象类型分组跑（先 rule 组，再 skill 组），或用户指定范围（如"只查 rule"/"只查 skill"）缩小单次扫描面，不强制全量。

### Phase 2: Propose（呈现候选 + 用户确认）

汇总 Layer1 + Layer2 全部候选，表格呈现：

```
| # | 对象 | 检测 | 动作 | 理由 |
|---|---|---|---|---|
| 1 | rules/rule-foo.md | O3 manifest失效路径 | 补文件/删条目 | read 指向的文件已不存在 |
| 2 | skills/bar/SKILL.md | S4 description触发不准 | 建议优化(委托skill-writing) | description 缺 Use when |
```

`AskUserQuestion` 多选让用户勾选要执行的编号（每个 option 自带「编号 + 检测项 + 建议动作」，不依赖上方表格渲染——工具调用间文本可能被吞）。0 候选 → 报"状态良好"。

### Phase 3: Execute（按类型分派）

- **自动类**（O1/O2）：直接重跑对应命令
- **护栏类**（O3/O4，涉及删除）：回显路径 + 原因 + 影响，二次确认后执行
- **建议式**（Layer2 全部）：不自动改——rule 类委托 `Skill(nocode:plugin-distill)`，skill 类委托 `Skill(nocode:skill-writing)`，由用户在委托流程里最终拍板

### Phase 4: 记录 Baseline（首次运行/降级、以及处理完变化之后都执行）

只要没有在 Phase 0 判定"秒回"提前结束（即走到了这里，不论是"首次运行/降级"全量跑完，还是"有变化"处理完毕），本步骤都要执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-dream-baseline.mjs" --set "${CLAUDE_PLUGIN_ROOT}"
```

`setBaseline` 把 baseline 推进到当前 HEAD——这样下次 `/plugin-dream` 才能拿"这次处理完的点"作为新起点做增量判断；只有 Phase 0 判定"秒回"（无任何变化）时才跳过本步骤，因为那种情况根本不会执行到 Phase 1-3。

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
