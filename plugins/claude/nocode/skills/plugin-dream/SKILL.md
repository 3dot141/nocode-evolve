---
name: plugin-dream
description: "插件仓库自维护巡检——客观漂移(4项) + 边界符合性(20项)两层检测，候选清单+用户勾选+执行修复"
argument-hint: (无参数)
---

> 本文写“结构化决策”时，必须把当前步骤的完整问题与 2–3 个互斥选项编译为 `Capability(workflow.decision.request, {"question":"<self-contained current-step question>","options":[{"label":"<option-label>","description":"<impact or tradeoff>"}],"allowFreeform":false})`；示例只展示单项形状，真实调用需带齐本步骤列出的选项，不得回退到平台专属提问工具。

# /plugin-dream：插件仓库自维护巡检

检查 nocode 插件仓库自身（rules/skills/commands）与预期状态的偏差，提议修复动作，用户确认后执行。独立于 `/plugin-distill`——distill 管写入，dream 管巡检维护。

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
| 非 `null` 且 `commitDiff`/`dirtyFiles` 均为空 | `false` | **秒回**，不进入 Phase 1，直接输出：`✓ plugin-dream：自上次检查以来业务源码、adapter、compiler、plugin/metadata.json 与 marketplace 无变化，无需维护`，命令结束 |
| 非 `null` 且 `commitDiff`/`dirtyFiles` 至少一个非空 | `true` | 合并 `commitDiff ∪ dirtyFiles` 得到"变更文件集合"，继续 Phase 1；Layer2 只对该集合覆盖到的 rule/skill/command 对象跑检测；本轮 Phase 3 执行完毕后**同样进入 Phase 4**，调用 `setBaseline` 把 baseline 推进到本次 HEAD（处理过一轮变化后必须前移，不止首次运行才前移，否则 diff 范围只会越滚越大，秒回永久失效）|

> 这一步不可跳过——即使用户在参数里指定了范围（如"只查 rule"），也先跑本判断决定 Layer2 的候选文件集合是"全部 rule"还是"变更文件集合 ∩ rule"。

### Phase 1: Scan（两层检测）

#### Layer 1 — 客观漂移（机械可测，跑现成命令；不受 Phase 0 增量范围影响，每次都全量跑——compile.rule.js --check/compile.hooks.js --check/vendor-sync.mjs --check 本身足够快，不需要增量优化）

| 检测 | 命令/判据 | 修复类型 |
|---|---|---|
| rule catalog 生成物漂移 | `node scripts/compile.rule.js --check`，exit 1 = 漂移或某 `rule-*.md` frontmatter 缺字段（脚本直接 throw） | 自动：重跑 `node scripts/compile.rule.js`；frontmatter 报错需先手动补 `name`/`description` |
| PreToolUse 规则生成物漂移 | `node scripts/compile.hooks.js --check`，exit 1 = 漂移 | 自动：重跑 `node scripts/compile.hooks.js` |
| vendor 漂移 | `node scripts/vendor-sync.mjs --check`，exit 1 = 不一致 | 自动：重跑 `node scripts/vendor-sync.mjs` |

> 旧版这里还有「manifest 失效路径」「孤儿 rule」两项检测——frontmatter 单源化（每个 `rule-<id>.md`
> 自带 `name`/`description`/`skip`）后这两类问题已被结构性消除：`compile.rule.js` 直接 glob 全部
> `rule-*.md`，没有独立的"登记"步骤会漏登，文件存在即自动出现在 catalog 里（除非 `skip: true`），
> 字段缺失时脚本本身 throw（体现为上面的生成物漂移报错），不需要额外一层比对检测。

#### Layer 2 — 边界符合性（语义，按对象类型分组读文件判断；单文件级判据，不跨文件推理，保证结论可复现）

> **扫描范围**：若 Phase 0 判定为"首次运行/降级"，以下每类对象全量扫描；若判定为"有变化"，每类对象只扫描 Phase 0 产出的"变更文件集合"里出现的那些 `rules/*.md` / `skills/*/SKILL.md` / `commands/*.md`，其余对象本轮跳过。

**rule 对象**（逐个插件 rule source，frontmatter 自带触发定义）：

| 检测 | 判什么 |
|---|---|
| 重复/重叠 | 跟其他 rule 的触发/职责是否重叠——该融合没融合（distill 融合优先原则） |
| 触发质量 | frontmatter `description` 是否具体可自判命中，不是"需要时读"这类空话 |
| 触发负例 | `description` 有没有「不触发」负例划边界 |
| 字段完整 | frontmatter `name`/`description`/`skip` 齐全，`name` 与文件名 slug (`rule-<name>.md`) 一致 |
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
| 自闭环边界 | SKILL.md 正文/私有 `references/` 是否越过 Skill/Reference 边界直接指路插件内部实现（自身/共享 `references/` 除外，遵守仓库规则6） |

**command 对象**（逐个 `commands/*.md`）：命名惯例（`*hub`/`*flow`/`xx-yy`）/ 模式边界（如 `*flow` 只属 skills 层）。hub 的「只转发」约束不在这里判——见下方「通用」节，它按 `*hub` 命名跨 command/skill 统一施加。

**通用**（跨对象）：版本联动（改了插件加载文件但 `plugin.json` 没升）/ 内容 stale（引用路径或机制已变没跟着更新）/ **hub 模式边界**（按 `*hub` 命名识别，command 与 skill 两种载体统一判：只转发不写业务逻辑——文件内容只能是「解析子动作 → 路由表 → 转发 `Skill()`」或纯只读统计的几行内联，整合判断/校验分支/写入协议都必须留在被转发的 Skill 里。CC 已合并 command≡skill，hub 是载体无关的角色，故此项跨对象判、不因载体漏检——现存 skill 形态 hub：`skills/larkhub/`）。

> 语义检测规模提示：本仓 skill 数量较多，逐 skill 跑满 9 项判断成本不低——可按对象类型分组跑（先 rule 组，再 skill 组），或用户指定范围（如"只查 rule"/"只查 skill"）缩小单次扫描面，不强制全量。

### Phase 2: Propose（呈现候选 + 用户确认）

汇总 Layer1 + Layer2 全部候选，表格呈现：

```
| # | 对象 | 检测 | 动作 | 理由 |
|---|---|---|---|---|
| 1 | plugin rule `foo` | R2 触发质量 | 建议优化(委托plugin-distill) | description 只写"需要时读"，无法自判命中 |
| 2 | skills/bar/SKILL.md | S4 description触发不准 | 建议优化(委托skill-writing) | description 缺 Use when |
```

`结构化决策` 多选让用户勾选要执行的编号（每个 option 自带「编号 + 检测项 + 建议动作」，不依赖上方表格渲染——工具调用间文本可能被吞）。0 候选 → 报"状态良好"。

### Phase 3: Execute（按类型分派）

- **自动类**（Layer1 全部）：直接重跑对应命令
- **建议式**（Layer2 全部）：不自动改——rule 类委托 `Capability(workflow.skill.invoke, {"skill":"plugin-distill","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})`，skill 类委托 `Capability(workflow.skill.invoke, {"skill":"skill-writing","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})`，由用户在委托流程里最终拍板

> Layer1 当前均为自动可修复类型，不涉及删除；若未来新增会造成数据丢失的检测（如涉及删文件/删条目），走护栏原则：回显路径 + 原因 + 影响，二次确认后执行——不要因为当前没有这类项就跳过这条原则。

### Phase 4: 记录 Baseline（首次运行/降级、以及处理完变化之后都执行）

只要没有在 Phase 0 判定"秒回"提前结束（即走到了这里，不论是"首次运行/降级"全量跑完，还是"有变化"处理完毕），本步骤都要执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plugin-dream-baseline.mjs" --set "${CLAUDE_PLUGIN_ROOT}"
```

`setBaseline` 把 baseline 推进到当前 HEAD——这样下次 `/plugin-dream` 才能拿"这次处理完的点"作为新起点做增量判断；只有 Phase 0 判定"秒回"（无任何变化）时才跳过本步骤，因为那种情况根本不会执行到 Phase 1-3。

### 完成报告

```
plugin-dream 完成：
  ✓ compile.rule.js 重新生成 catalog（漂移已修复）
  → 委托: plugin rule `foo` description 优化，转 Capability(workflow.skill.invoke, {"skill":"plugin-distill","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})
  → 委托: skills/bar/SKILL.md description 优化，转 Capability(workflow.skill.invoke, {"skill":"skill-writing","arguments":{"request":"<verbatim-current-request-or-command-arguments>","context":{"stage":"<caller-and-current-stage>","restate":"<confirmed-restate-or-omit>","artifacts":["<relevant-path-or-receipt>"],"constraints":["<confirmed-constraint>"],"planRef":"<current-planRef-or-omit>","decision":"<confirmed-decision-or-omit>"}}})
  ✗ 跳过: #4（用户未勾选）

ℹ 状态：0 error / 1 warn（含未处理的 Layer2 建议）
```

## 和 SessionStart 自动 sanity check 的关系

SessionStart 已自动跑 rule 与 Hook generator 的一致性检查，但只 warn 不阻断、不修复。`/plugin-dream` 是开发者主动触发的交互式扫描 + 提议修复 + 可执行，两者互补不重复。

## 不要

- 不自动执行任何涉及删除的动作——按护栏原则回显路径 + 原因 + 影响，二次确认后才执行
- 不对 Layer2 语义类问题自作主张改文件——只提议、委托对应写入命令，不越权
- 不跨文件推理下结论——每项 Layer2 检测限单文件级判据，保证结论可复现
