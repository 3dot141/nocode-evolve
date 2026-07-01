---
description: .agents-personal/ 的自主维护（stale 检测 / prune / merge / promote / archive），独立命令
argument-hint: (无参数)
---

# /personal-dream：.agents-personal/ 自主维护

检查 `.agents-personal/` 与代码实际状态的偏差，提议清理动作。用户确认后执行。

独立于 `/distill`——distill 管写入，dream 管维护。dream 可以定期跑（`/schedule`）或随时手动跑。

## 执行流程

### Phase 1: Scan（提取候选动作，接入增量判断）

**Step 0 — baseline 增量判断**：先调用：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs" --json
```

（若 `.agents-personal/.git` 不存在，这一步会顺带触发 `ensureNestedRepo`——首次建仓或检测旧 bare repo 触发迁移。）

然后调用：

```bash
node -e "
import('${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs').then(async ({ resolvePersonalDir }) => {
  const { diffSinceBaseline } = await import('${CLAUDE_PLUGIN_ROOT}/scripts/dream-baseline.mjs');
  const { snapshot } = await import('${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs');
  const personalDir = resolvePersonalDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const gitDir = personalDir + '/.git';
  const result = diffSinceBaseline(gitDir, personalDir, 'refs/dream/last-baseline', {
    prepareFn: () => snapshot(personalDir),
    excludePaths: ['wiki/status.md'],
  });
  console.log(JSON.stringify({ changedFiles: result }));
});
"
```

按输出 `{ changedFiles: string[] | null }` 分支：

| `changedFiles` | 处理 |
|---|---|
| `null`（首次运行，或 baseline 不可达降级） | 走全量：对 `wiki/draft/` + `wiki/pages/` 每一页做深度检查（下方原有流程不变）；Phase 3 结束后调 `advanceBaseline`（见 Phase 3 收尾） |
| `[]`（有 baseline，diff 为空） | **秒回**：直接输出 `wiki 状态良好，无需维护动作。`，命令结束，不进入 Phase 2/3，也不调 `personal-lint` |
| 非空数组 | 只对 `changedFiles` 里列出的 wiki 页做深度检查；额外执行下方**跨域.3 — related 路径变化检测**；结果与 `changedFiles` 覆盖的页面合并成本轮候选范围 |

`changedFiles` 非 `null` 时才继续调 `Skill(nocode-evolve:personal-lint)` 获取健康状态，然后对**候选范围**（而不是 `wiki/draft/` + `wiki/pages/` 全部）做深度检查：

对候选范围每页：
1. 读 frontmatter（created、last_updated、maturity、related、sources）
2. 检查 `related` 里的代码路径 → 该路径是否仍存在（`test -e <path>`）
3. 抽样 Read 关键 related 文件，比对页面描述 vs 代码现状（是否已大幅变化）
4. 检查与其他页面的主题重叠度（title + tags + description 相似性）

**跨域.3 — related 路径变化检测**：对**未出现在** `changedFiles` 里的 wiki 页（即 wiki 页本身没变），仍按上面第 2 步的 stale 检测逻辑（`test -e <related路径>`）检查其 frontmatter `related:` 列出的代码路径是否有变化或不存在。命中的页面也并入本轮深度检查候选，即使它自己没有被 git diff 出来。

生成候选动作：

| 动作 | 条件 | 执行内容 |
|---|---|---|
| **prune** | draft/ >30 天 stub，从未被整合（sources 仍为 1） | 删除 draft 文件 |
| **stale** | related 代码路径已大幅变化或部分不存在 | 页面顶部加 `⚠ stale` 标记 + 列出失效路径 |
| **merge** | 两个页面主题高度重叠（title/tags/description 相似度高） | 两页合一（融合内容 + 更新引用） |
| **promote** | draft/ 已丰富（2+ sources、有交叉引用）但未提升到 pages/ | 调 personal-distill 的 promote 流程 |
| **archive** | related 代码路径全部不存在（重构已删除整个模块） | maturity → superseded，或删除（用户选） |
| **ok** | 无需动作 | 不出现在表格里 |

同时检查 rules/：
- rules/ 文件引用的代码路径是否仍存在
- AGENTS.md 触发条目是否仍有效

### Phase 2: Propose（呈现 + 用户确认）

输出动作表格，用 AskUserQuestion 多选让用户勾选：

```
personal-dream 维护建议：

| # | 页面 | 动作 | 理由 |
|---|---|---|---|
| 1 | draft/260512-old-toggle.md | prune | stub, 35 天未整合 |
| 2 | pages/ddd-domain-repo.md | stale | related 路径 3/5 已不存在 |
| 3 | draft/260518-prompt-injection.md | promote | 2 sources, 有交叉引用 |
| 4 | pages/auth-v1.md + pages/auth-v2-prep.md | merge | 主题高度重叠 |

勾选要执行的编号（可多选）：
```

0 候选时："wiki 状态良好，无需维护动作。" + 附 personal-lint 报告。

### Phase 3: Execute（执行选中动作）

按用户勾选逐个执行：

- **prune**：删除 draft 文件。`.agents-personal/` 删除护栏生效——需二次确认（回显路径 + 原因 + 影响）
- **stale**：在页面 body 顶部（title 下方）加 `> ⚠ stale: related 路径 X, Y 已不存在（dream 260626 标注）`。maturity 不改
- **merge**：Read 两页 → 融合内容到保留页 → 删除被合并页（走删除护栏） → 更新引用
- **promote**：调 personal-distill 的 promote 流程（draft → pages，删除 draft 原文件）
- **archive**：AskUserQuestion 二选——标 superseded 保留 / 删除。标 superseded 不走删除护栏，删除走

**Baseline 前移**（只要执行到了这一步——即 Phase 1 判定为"首次运行"或"有变化"，不是"秒回"提前退出——处理完就前移，不区分是首次全量还是增量有变化）：

```bash
node -e "
import('${CLAUDE_PLUGIN_ROOT}/scripts/dream-baseline.mjs').then(async ({ advanceBaseline }) => {
  const { resolvePersonalDir } = await import('${CLAUDE_PLUGIN_ROOT}/scripts/personal-snapshot.mjs');
  const personalDir = resolvePersonalDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  advanceBaseline(personalDir + '/.git', 'refs/dream/last-baseline', ${HAD_FAILURES});
});
"
```

`${HAD_FAILURES}`：本轮 Phase 3 执行的候选里，若存在**系统性失败**（如文件写入报错、删除护栏确认中途异常取消）→ `true`（baseline 不前移，这些文件下次仍会出现在 diff 里）；用户在 Phase 2 显式勾选"跳过"某候选是正常决策，不算失败 → 其余情况均传 `false`（baseline 前移）。

全部完成后：
1. 更新 `wiki/index.md`
2. 追加 `wiki/log.md`（每条动作一行记录）

### 完成报告

```
personal-dream 完成：
  ✓ prune: draft/260512-old-toggle.md（已删除）
  ✓ stale: pages/ddd-domain-repo.md（已标注 ⚠ stale）
  ✓ promote: draft/260518-prompt-injection.md → pages/prompt-injection.md
  ✗ 跳过: #4 merge（用户未勾选）
  📋 index.md 已更新, log.md 已追加 3 条

ℹ 健康检查：0 error / 0 warn
  → 结论: .agents-personal/ 状态健康 ✓
```

## 和其他 personal-* 命令的关系

| 命令 | dream 怎么用它 |
|---|---|
| personal-lint | Phase 1 开头调，获取健康基线 |
| personal-distill | promote 动作委派给 distill 的 promote 流程 |
| personal-recall | 不调用 |
| personal-snapshot | Phase 1 Step 0 调用（`--json` 触发 ensureNestedRepo/迁移 + 作为 `diffSinceBaseline` 的 `prepareFn` 落定 working tree），SessionStart 也仍会自动跑 |

## 不要

- **不自动执行任何删除** — prune/merge/archive 的删除操作都需用户勾选 + 删除护栏二次确认
- **不改 maturity 到 active** — dream 只标 stale / superseded / 触发 promote（promote 后 maturity=draft），升到 active 是用户主动决策
- **不编造代码现状** — related 路径检查用 `test -e`，不凭记忆判断文件是否存在
