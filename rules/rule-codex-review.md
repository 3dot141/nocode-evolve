# codex 交接 — 红蓝红军 / review 收尾 / 委派救援

把本机 Codex 当**独立模型**接进三类场景:跨模型攻击 / review,避开同源自评的盲区(自己 review 自己看不出自己的假设错)。

引擎已 vendor 在 `vendor/codex/`(来源 / 升级见 `vendor/codex/UPGRADE.md`),不经任何门控。

## 调用方式(统一入口)

探活和真正跑 review 分两层,**探活主 agent 直接 Bash,真正调用派 subagent 执行**——不要在主 agent context 里直接 Bash 跑 `review`/`adversarial-review`/`task`。

**Step 1 — 探活(主 agent 直接 Bash)**,任一场景触发时先跑一次,决定走 codex 还是降级:

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" setup --json
```

`.ready == true` → 走 codex;否则(未装 / 未登录 / 报错)→ **降级:我自己做,并明说「codex 不可用,fallback 自做」**。本规则不让 codex 成为硬依赖。探活本身输出小、跑得快,留在主 agent 直接做。

**Step 2 — 真正调用(派 subagent 执行,不直接 Bash)**:探活通过后,把 `review`/`adversarial-review`/`task` 这条实际命令交给一个 subagent 去跑,不在主 agent 里自己 Bash。原因:

- codex 的原始输出(尤其 `task`/`adversarial-review`)可能很长,直接 Bash 会把它整段堆进主 agent context;subagent 只把结果带回来,主 agent 只收干净的产出。
- 场景 1/4 需要 Codex 那路与「Subagent 独立审查」那路**真并行**——两个 `Agent()` 调用放进**同一条消息**里发出才会同时跑;混用「`Agent()` + Bash `run_in_background`」两套并行机制,彼此不感知,还要主 agent 手动轮询 Bash 任务,反而更慢更啰嗦。
- 四个场景统一走 `Agent()` 派发,不再一个场景直接 Bash、一个场景 subagent 两套写法。

统一派发模板(`<verb 命令>` 按各场景替换):

```
Agent({
  subagent_type: "general-purpose",
  description: "<按场景填,如 'Codex 独立审查' / 'Codex review 收尾'>",
  prompt: `
    Bash 直接执行下面命令并等待完成,把 codex 的完整输出原样返回给我——
    不要总结/删减/改写,下游要拿原始内容跟其他审查路合并:

    <verb 命令>

    命令报错或超时 → 把错误信息原样返回,不要自己猜测或替 codex 下结论。
  `
})
```

`<verb>`:`review`(缺陷) / `adversarial-review`(挑方案,可带 focus text) / `task`(通用,默认只读,加 `--write` 才改代码)。改动大或任务重 → 在 subagent 的 prompt 里让它自己用 `run_in_background: true` 起、`Monitor`/`BashOutput` 等到完成再返回,不要把这层轮询甩回主 agent。

## 场景 1:红蓝重档·独立审查交给 Codex

**触发**:`red-blue-deep` 判为**重档**、走到 Step 3 独立审查环节。**轻档不触发**(命名 / 文案 / 单点小改不拉 codex)。

**做法**:不自己演红军,把完整独立审查交给 Codex(与 Subagent 并行双跑,见 red-blue-deep Step 3)——两路都是 `Agent()` 调用,**同一条消息里一起发出**才是真并行:

```
// 同一条回复里一次性发出两个 Agent() 调用
Agent({ subagent_type: "general-purpose", description: "独立审查(Subagent 红军)", prompt: "<CLAIM 剥离后的方案+约束+维度清单>" })
Agent({
  subagent_type: "general-purpose",
  description: "独立审查(Codex 红军)",
  prompt: `
    Bash 执行下面命令并等待完成,把 codex 原始输出原样返回:

    node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task \
      "只读,不要改任何代码。独立审查以下方案,列出:
       1. 优势(落到具体场景)
       2. 弱点和隐藏代价(「实现时会遇到 X」/「N 个月后 Y」,不要「理论上可能」)
       3. 盲区(提议者可能没想到的维度)
       4. 替代方案
       <被评估的提议 + 约束条件 + 真约束>"
  `
})
```

> 用 `task` 不用 `adversarial-review`:红蓝多是**设计 / 选型决策**,未必有 git diff;`adversarial-review` 针对代码改动。若该决策恰好对应一段具体改动,可改用 `adversarial-review --wait`。

Codex 审查结果与 Subagent 审查结果合并三路(主 agent 蓝军 + subagent + codex),折进 Step 4 结论。

## 场景 2:代码 review 收尾

**触发**:完成分支 / 显式 review 请求(「review 一下 / 看这次改动有没有问题 / 帮我审一遍」)。与 `dev-finish-branch` 衔接——PR 前可加一道独立 Codex review。

**做法**:
- 找缺陷 → `review`;挑方案 / 设计假设 → `adversarial-review`(可在末尾追 focus text 指定关注点)。
- 范围:默认当前 working-tree;对分支用 `--base <ref>`(review `<base>...HEAD`)。
- 探活通过后套「调用方式」的统一派发模板,`<verb 命令>` 换成对应命令,不在主 agent 直接 Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" review --wait
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" adversarial-review --wait --base main 这次重构的并发安全
```

review 结果**原样转述给用户**,不替他改 issue(除非他要)。改动大 → 让 subagent 自己 `run_in_background: true` 起、等完成再返回。

**护栏**:琐碎 / 单文件 / 纯格式改动我自己看就行,不必拉 Codex;codex 留给实质改动(多文件 / 涉及并发 · 安全 · 架构 / 用户显式要「让 codex 审」)。

## 场景 3:委派 / 救援

**触发**:我卡住 / 想要第二实现或独立诊断 / 要把一段成块的实现甩出去。

**做法**:
- 只诊断不改 → `task`(默认只读);要 Codex 动代码 → `task --write`。
- 续上次 Codex 工作 → 加 `--resume`;强制新开 → `--fresh`。
- 探活通过后套「调用方式」的统一派发模板,`<verb 命令>` 换成对应命令,不在主 agent 直接 Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task --write "<任务描述>"
```

**边界**:简单活我自己干完,别什么都甩 codex(委派有启动 + 额度成本)。

## 场景 4:设计文档独立审稿

**触发**:`dev-design-refine` 工作流走到 review 环节(见 `rule-superpowers-brainstorming.md` step 5 第 3 步)——**默认即触发**(交叉验证已是默认,不再限"重档")。仅琐碎 / 文案改动用户显式降档时才跳过。

**做法**:Codex 跨模型审稿与 Claude `design-doc-reviewer` (general-purpose) subagent **并行双跑**,合并两路 Report(交集=高置信、对称差=盲点)——两路都是 `Agent()` 调用,**同一条消息里一起发出**才是真并行:

```
// 同一条回复里一次性发出两个 Agent() 调用
Agent({ subagent_type: "general-purpose", description: "设计文档审稿(Claude design-doc-reviewer)", prompt: "<reviewer-template.md 准则 + 文档全文>" })
Agent({
  subagent_type: "general-purpose",
  description: "设计文档审稿(Codex)",
  prompt: `
    Bash 执行下面命令并等待完成,把 codex 原始输出原样返回:

    node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task \
      "只读,不要改任何文件。按下面 reviewer 准则审查这份设计文档,输出分级 Review Report
       (Critical / Warning / Suggestion,带编号 C1/W1/S1):
       准则:<reviewer-template.md 内容>
       文档:<doc 路径或全文>"
  `
})
```

Review Report 后续处理(逐条勾选 fix/skip、追加 `## Review Log`)按 design-doc 工作流原样走。codex 不可用 → 降级为仅 `design-doc-reviewer` (general-purpose) subagent 单跑,并明说 fallback。

## 不要

- 轻档红蓝 / 简单任务也拉 codex —— 噪音 + 烧额度。
- 跳过 `setup --json` 探测就硬调 —— codex 没装 / 没登录会直接报错,必须先探后降级。
- 探活通过后在主 agent 里直接 Bash 跑 `review`/`adversarial-review`/`task` —— 必须派 subagent 执行,原始输出别堆进主 agent context;需要跟 Subagent 独立审查并行的场景(1/4),两个 `Agent()` 调用要放同一条消息发出,不要一个 Bash `run_in_background` 一个 `Agent()` 混着来。
- codex 不可用时静默卡住或假装调了 —— 必须降级自做 + 明说 fallback。
- 改 `vendor/codex/` 里的文件 —— 那是上游镜像,改了 re-sync 会冲突;接口要变只改本规则。
- hardcode 插件 cache 路径 / version 目录 —— 一律走 `${CLAUDE_PLUGIN_ROOT}/vendor/codex/...`。
