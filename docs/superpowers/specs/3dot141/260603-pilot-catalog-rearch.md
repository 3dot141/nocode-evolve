---
type: design-doc
topic: catalog 分片承载完整路由(常驻) + 删 route + pilot 手动入口 + design-doc 融合 render
date: 260603
author: 3dot141
status: draft
last_updated: 260603
---

# Design: pilot-catalog 重构

> 轻量 spec(用户授权降档,不走 design-doc-writing 全流程)。决策已在 brainstorm 钉死,本文把实现要点固定下来。

## 背景与决策(第一性结论)

**核心**:把"两类知识"分到两个机制,解开 route 一直以来的职责混淆。

- **规则知识(reactive)**:"X 情况遵守 Y"。原 skillify-route 用「精简 catalog 常驻 + 完整路由按需 route(软触发)」。**改为:完整路由直接常驻**(catalog 分片防 10000 截断),route 删除。取舍:用可靠性(常驻必在、无软触发漏)换一点 context;完整路由仅 4447 字符,可控。
- **编排知识(proactive)**:"工程任务生命周期/下一步"。**新建 pilot 手动入口 skill**(`disable-model-invocation`),用户主动 `/调` 进入,给流程导航 + 下一步建议,用户拍板。用户主动 = 触发 100% 可靠、零打断、天然灵活。

## 目标

1. 完整规则路由**常驻**(catalog 分片,每片 < 10000 字符),删 route 软触发中转层。
2. 新建 `pilot` 手动入口 skill:用户主动调,给编排导航(生命周期 + 下一步建议),不重复规则路由。
3. `design-doc-rendering` 并入 `design-doc-writing`(render 作为工作流环节),减一个 skill + 触发面。
4. manifest 单源、PreToolUse 硬拦截保留不变。

## 实现

### 影响

```
nocode-evolve/
├── hooks/
│   ├── generate.mjs        (改) 删 genCatalogSlim/genRouteTable/patchGeneratedRegion/ROUTE_SKILL;
│   │                            新增 genCatalogSharded(完整路由按桶累加, 超 SHARD_LIMIT 切片);
│   │                            targets() 出 agent-catalog-1.md.. ; renderAll/check 适配多片
│   ├── generate.test.mjs   (改) 删 route 区/patchGeneratedRegion 断言; 加 sharding 断言
│   ├── inject-rules.sh      (改) seg_file 删 model-catalog, 加 model-catalog-1/2/3; 删 route grep;
│   │                            孤儿检查 grep 目标 catalog 分片; MODEL_SEGMENTS 更新
│   └── hooks.json           (改) SessionStart segment: model-catalog → model-catalog-1/2/3 (预留 3 片)
├── model/
│   ├── agent-catalog.md     (删) → 由 agent-catalog-1.md.. 取代 (生成物)
│   └── agent-about.md       (改) "调 route" 引用 → 删(路由已常驻在 catalog) 或指 catalog
├── skills/
│   ├── route/               (删) 整个删除
│   ├── pilot/SKILL.md       (NEW) disable-model-invocation; 编排导航 + 协议
│   ├── design-doc-writing/  (改) 吸收 rendering 作为 render 环节; 引用更新
│   └── design-doc-rendering/(删) 内容并入 design-doc-writing/references/
├── commands/distill.md      (改) "调 route"/route 引用 → catalog 或 pilot
├── .claude/commands/rule-eval.md (改, 本地) 读 route 生成区 → 读 catalog 分片
└── .claude-plugin/plugin.json (改) version → 3.2.0 (minor: 结构调整+新skill+删skill, /调用名不破坏)
```

### BF1 — generate.mjs catalog 分片

```
const SHARD_LIMIT = 9000;                                  // 留 JSON 包裹 + 中文余量, < 10000 阈值
function genCatalogSharded(m):                             // 替代 genCatalogSlim + genRouteTable
    header = catalog 读取时机说明(命中桶→读对应 rule; 完整路由常驻)
    buckets_md = renderBucketBody(m)                       // 复用现有: 完整路由(桶+每rule 触发/读/摘要/guard)
    full = header + buckets_md
    shards = splitByBucket(full, SHARD_LIMIT)              // 按桶边界累加, 超 LIMIT 开新片; 不切断单条 rule
    return shards.map((text,i) => ({file:`model/agent-catalog-${i+1}.md`, text}))
                                                           // 当前 4447+header < 9000 → 1 片(agent-catalog-1.md)
function targets(m):                                       // 整文件比对产物
    return [...genCatalogSharded(m), {pretooluse-rules.json}]   // 不再有 route 区/slim
function check(m):                                         // 比对所有 catalog 分片 + pretooluse
    // 额外: 检测 model/ 下是否有过期的 agent-catalog-N.md (分片数变少时清理), drift 报告
```

### BF2 — inject-rules.sh + hooks.json 多片 segment

```
seg_file:  model-catalog-1 → model/agent-catalog-1.md
           model-catalog-2 → model/agent-catalog-2.md
           model-catalog-3 → model/agent-catalog-3.md   (预留, 不存在则静默退出)
           model-about/karpathy/project 不变; model-catalog(单) 删
MODEL_SEGMENTS = "model-about model-karpathy model-catalog-1 model-catalog-2 model-catalog-3"
孤儿检查: rules/rule-*.md 是否被任一 agent-catalog-*.md 引用(grep across 分片)
hooks.json SessionStart: about / karpathy / catalog-1 / catalog-2 / catalog-3 / project
           (catalog-2/3 当前无文件 → inject-rules 既有 "[ -f ] || exit 0" 静默)
```

### BF3 — pilot skill(编排导航,手动入口)

`skills/pilot/SKILL.md`:

```yaml
---
name: pilot
description: 工程任务流程领航(手动入口)。用户主动 /调 进入,给"当前阶段判断 + 下一步建议 + 备选",用户拍板。
disable-model-invocation: true
---
```

正文结构:
```markdown
# nocode-evolve:pilot — 工程任务流程领航(你主动进入)

## 协议(被调起时按此走)
1. 先判「这任务要不要流程建议」: 简单/明确单步(改名/小修) → 直接回"这步直接做即可", 退出, 不强吐方案。
2. 复杂/多步/不确定 → 据下方生命周期地图判当前阶段(看会话已做了什么)。
3. 输出: 「当前在 X 阶段(依据:…) → 建议下一步 Y(对应 skill/rule, 理由) → 备选 Z」。
4. 停下来让用户拍板, 不自动执行。

## 生命周期地图(软序, 地图非轨道; 按情境跳/回退/并行)
| 阶段 | 对应 skill/rule | 何时进 / 产出 |
|---|---|---|
| 0 理解/设计 | superpowers:brainstorming, design-doc-writing; rule: git-freshness(就地设计前 fetch) | 需求不清/要设计文档 |
| 1 隔离环境 | superpowers:using-git-worktrees; rule: git-worktree | 要动代码/新分支 |
| 2 实现 | superpowers:test-driven-development, subagent-driven | 设计已定 |
| 3 验证/评审 | superpowers:requesting-code-review; rule: codex-review | 实现完, 提交前 |
| 4 收尾/沉淀 | rule: finishing-branch, push-summary | 评审过, 要合并/总结 |
| ⟳ 横切(任意阶段) | rule: git-inspection(多步git), red-blue-deep(评估拍板); skill: red-blue-deep | 随时 |

> 规则细节不在此重复——常驻 catalog 已有完整路由; 需要时读对应 rules/rule-*.md。
```

### BF4 — design-doc-rendering 并入 design-doc-writing

- `skills/design-doc-rendering/` 内容(SKILL.md 正文 + references/presets 等)挪入 `skills/design-doc-writing/references/rendering/`。
- `design-doc-writing/SKILL.md` 的工作流 render 步骤:从「链式调 design-doc-rendering skill」改为「读 `references/rendering/` 按其指引渲染 HTML」。
- 删 `skills/design-doc-rendering/` 目录。
- `rules/rule-superpowers-brainstorming.md` 引用 `design-doc-rendering` → 改为 design-doc-writing 内的 render 环节。

### BF5 — route 删除 + 引用迁移

| 引用处 | 改法 |
|---|---|
| `skills/route/` | 整目录删 |
| `model/agent-catalog.md` | 被 catalog 分片取代(本就生成物) |
| `model/agent-about.md` | "调 route" 提示 → 删(路由已常驻 catalog,agent 直接看到) |
| `commands/distill.md` | route 引用 → "catalog 分片 / 改 manifest 重新生成" |
| `.claude/commands/rule-eval.md`(本地) | "读 route 生成区" → "读 model/agent-catalog-*.md 完整路由" |
| `hooks/generate.mjs` / `.test.mjs` | route 区逻辑删(见 BF1) |
| `hooks/inject-rules.sh` | route grep 删(见 BF2) |

## 异常与失败模式

| BF | 风险 | 处理 |
|---|---|---|
| BF1 | 单桶本身 > SHARD_LIMIT | 极少(最大桶远 < 9000);真超则 splitByBucket 内对该桶再按 rule 切 + warn |
| BF2 | catalog 分片数 > 预留 segment 数(3) | generate --check 报"分片超预留, 加 hooks.json segment"; 3 片≈27000 字符路由, 远超当前需求 |
| BF2 | 分片数变少, 残留旧 agent-catalog-N.md | check 检测残留 + 提示删 |
| BF3 | pilot 被自动触发 | disable-model-invocation 保证只手动; 测 frontmatter |
| BF4 | rendering 内部链接迁移后失效 | 挪 references/rendering/ 后核相对链接可达 |

## 单测设计

- **BF1**: genCatalogSharded 当前 manifest → 1 片(agent-catalog-1.md), 内容含完整路由(每 rule 触发/读); 构造超长 manifest → 切多片, 不切断单 rule; --check 零漂移
- **BF2**: inject-rules.sh model-catalog-1 输出合法 JSON < 10000 字符; model-catalog-2(无文件)静默退出 exit 0; 未知 segment exit 1
- **BF5**: 全仓无 `skills/route` / `nocode-evolve:route` 残留(grep 空, 文档/spec 除外); node --test 全绿; --check 零漂移

## 方案选型

### Q1: 完整路由 常驻 vs 按需(route)?
**选项**: 常驻分片(必在,无软触发漏,多占 context) vs 按需 route(省 context,软触发可能漏)
**定**: 常驻分片。路由仅 4447 字符,常驻可控;可靠性 > 省这点 context;删 route 触发链更短。→ BF1/BF5

### Q2: 分片数 动态 vs 固定预留?
**选项**: hooks.json 动态(做不到,segment 静态) vs 固定预留 N 片(generate 出 ≤N, 空片静默)
**定**: 固定预留 3 片。兼容 segment 静态 + 留增长空间(27000 字符);超 3 片由 check 报警。→ BF2

### Q3: pilot 触发?
**选项**: 自动(软触发, 怕打断/吐方案) vs 手动入口(disable-model-invocation)
**定**: 手动入口。用户主动调 = 100% 可靠 + 零打断 + 灵活;协议首条"先判要不要建议"再防过度。→ BF3

## 其他

### 部署
插件 git 分发。version **minor 3.2.0**(结构调整 + 新 pilot skill + 删 route/rendering skill;但 `/nocode-evolve:distill` 等 /调用名不破坏,distill/sow/task 不动)。回滚 git revert merge commit。
