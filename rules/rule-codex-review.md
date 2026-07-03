# codex 交接 — 红蓝红军 / review 收尾 / 委派救援

把本机 Codex 当**独立模型**接进三类场景:跨模型攻击 / review,避开同源自评的盲区(自己 review 自己看不出自己的假设错)。

引擎已 vendor 在 `vendor/codex/`(来源 / 升级见 `vendor/codex/UPGRADE.md`),不经任何门控。

## 调用方式(统一入口)

**不预先探活**——任一场景触发时直接把 `review`/`adversarial-review`/`task` 这条实际命令派给 subagent 执行,不在主 agent context 里直接 Bash 跑,也不先跑一次 `setup --json` 探测。省掉探活往返;命令报错才降级,不提前判断。

原因:

- codex 的原始输出(尤其 `task`/`adversarial-review`)可能很长,直接 Bash 会把它整段堆进主 agent context;subagent 只把结果带回来,主 agent 只收干净的产出。
- 四个场景统一走 `Agent()` 派发,不再一个场景直接 Bash、一个场景 subagent 两套写法;报错后的 fallback(场景 1/4 改派 Subagent / design-doc-reviewer,场景 2/3 自己做)同样统一处理,不再多一层探活判断。

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

**subagent 返回后判断**:
- **成功** → 拿到 codex 原始输出,按各场景后续处理。
- **报错**(如 "Codex CLI is not installed" / 未登录 / 超时等)→ **降级**,按各场景 fallback 做法处理,并明说「codex 调用失败,fallback 至 X」。本规则不让 codex 成为硬依赖。

`<verb>`:`review`(缺陷) / `adversarial-review`(挑方案,可带 focus text) / `task`(通用,默认只读,加 `--write` 才改代码)。改动大或任务重 → 在 subagent 的 prompt 里让它自己用 `run_in_background: true` 起、`Monitor`/`BashOutput` 等到完成再返回,不要把这层轮询甩回主 agent。

## 场景 1:红蓝重档·独立审查默认交给 Codex

**触发**:`red-blue-deep` 判为**重档**、走到 Step 3 独立审查环节。**轻档不触发**(命名 / 文案 / 单点小改不拉 codex)。

**做法**:不自己演红军,独立审查**默认单路直接交给 Codex**(不预先探活,不与 Subagent 并行双跑)——按「调用方式」直接派一个 `Agent()` 去 Bash 跑 Codex:

```
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
       <被评估的提议 + 约束条件 + 真约束>
       <Context Capsule(中立事实包): 已拍板决策 / 被否决方案及原因 / 非目标 / 硬约束与预算>
       以上 Capsule 是全部已知事实约束; 你依赖但未提供的上下文, 相应判断标为 open-question, 不要当缺陷硬指控。"
  `
})
```

> **Context Capsule 打包**(单源定义: `skills/reviewing/references/skeleton.md` §4.1): 只装**事实**——用户拍过板的决策、被否决方案及其原因、非目标、成本/时延/依赖预算; **不装**蓝军分析与倾向(装了就把独立路诱导成确认路)。会话里否决过的方案不打包, Codex 会当新建议重提——那是噪音不是发现。

- **调用成功** → 拿到 Codex 独立审查结果,继续走下面合并。
- **调用报错**(未装 / 未登录 / 超时等) → **fallback 改派 Subagent 单跑**,明说「codex 调用失败,fallback 至 subagent 独立审查」:

```
Agent({ subagent_type: "general-purpose", description: "独立审查(Subagent 红军,codex fallback)", prompt: "<CLAIM 剥离后的方案+约束+维度清单>" })
```

> 用 `task` 不用 `adversarial-review`:红蓝多是**设计 / 选型决策**,未必有 git diff;`adversarial-review` 针对代码改动。若该决策恰好对应一段具体改动,可改用 `adversarial-review --wait`。

独立审查结果(Codex 或 fallback 后的 Subagent,二选一非双跑)与主 agent 蓝军合并两路,折进 Step 4 结论。

## 场景 2:代码 review 收尾

**触发**:完成分支 / 显式 review 请求(「review 一下 / 看这次改动有没有问题 / 帮我审一遍」)。与 `dev-finish-branch` 衔接——PR 前可加一道独立 Codex review。

**做法**:
- 找缺陷 → `review`;挑方案 / 设计假设 → `adversarial-review`(可在末尾追 focus text 指定关注点)。
- 范围:默认当前 working-tree;对分支用 `--base <ref>`(review `<base>...HEAD`)。
- 直接套「调用方式」的统一派发模板派 subagent 执行,不预先探活,`<verb 命令>` 换成对应命令,不在主 agent 直接 Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" review --wait
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" adversarial-review --wait --base main 这次重构的并发安全
```

- **调用报错** → 降级为我自己看这次改动,明说「codex 调用失败,fallback 自己 review」。

review 结果**原样转述给用户**,不替他改 issue(除非他要)。改动大 → 让 subagent 自己 `run_in_background: true` 起、等完成再返回。

**护栏**:琐碎 / 单文件 / 纯格式改动我自己看就行,不必拉 Codex;codex 留给实质改动(多文件 / 涉及并发 · 安全 · 架构 / 用户显式要「让 codex 审」)。

## 场景 3:委派 / 救援

**触发**:我卡住 / 想要第二实现或独立诊断 / 要把一段成块的实现甩出去。

**做法**:
- 只诊断不改 → `task`(默认只读);要 Codex 动代码 → `task --write`。
- 续上次 Codex 工作 → 加 `--resume`;强制新开 → `--fresh`。
- 直接套「调用方式」的统一派发模板派 subagent 执行,不预先探活,`<verb 命令>` 换成对应命令,不在主 agent 直接 Bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task --write "<任务描述>"
```

- **调用报错** → 降级为我自己诊断 / 实现,明说「codex 调用失败,fallback 自己做」。

**边界**:简单活我自己干完,别什么都甩 codex(委派有启动 + 额度成本)。

## 场景 4:设计文档独立审稿

**触发**:`dev-design-refine` 工作流走到 review 环节(见 `rule-superpowers-brainstorming.md` step 5 第 3 步)且分档为**重档**(skeleton §1 自动判:跨模块 / 含架构·选型决策 → 重档;琐碎 / 文案 / 拿不准 → 轻档,不拉 codex)。命中重档后要降档,只认用户显式否定词。

**做法**:独立审稿**默认单路直接交给 Codex**(不预先探活,不与 Claude `design-doc-reviewer` 并行双跑)——按「调用方式」直接派一个 `Agent()` 去 Bash 跑 Codex 审稿:

```
Agent({
  subagent_type: "general-purpose",
  description: "设计文档审稿(Codex)",
  prompt: `
    Bash 执行下面命令并等待完成,把 codex 原始输出原样返回:

    node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task \
      "只读,不要改任何文件。按下面 reviewer 准则审查这份设计文档,输出分级 Review Report
       (Critical / Warning / Suggestion,带编号 C1/W1/S1):
       准则:<design-doc-review.md 设计维度 + reviewer-discipline.md reviewer 纪律>
       文档:<doc 路径或全文>
       Capsule:<Context Capsule(中立事实包): 已拍板决策 / 被否决方案及原因 / 非目标 / 硬约束与预算>
       以上 Capsule 是全部已知事实约束; 依赖但未提供的上下文, 相应 finding 标 Q 档(open-question), 不硬上 Critical/Warning。"
  `
})
```

> Capsule 打包规则同场景 1(单源 `skills/reviewing/references/skeleton.md` §4.1): 剥结论、留事实。
>
> **Delta review**: 同一文档同一轮 review 循环内, 修完 findings **不重跑本场景**——主 agent 核对 fix 落实即可; 结构性变更(章节增删 / 方案改向 / 接口重定义)或用户显式要求才重跑(判据单源: `skills/reviewing/references/methods/dual-review.md` §三)。

- **调用成功** → 拿到 Codex 审稿结果,继续走下面 Review Report 处理。
- **调用报错**(未装 / 未登录 / 超时等) → **fallback 改派 Claude `design-doc-reviewer` (general-purpose) subagent 单跑**,明说「codex 调用失败,fallback 至 design-doc-reviewer 独立审稿」:

```
Agent({ subagent_type: "general-purpose", description: "设计文档审稿(Claude design-doc-reviewer,codex fallback)", prompt: "<design-doc-review.md 维度 + reviewer-discipline.md 纪律 + 文档全文>" })
```

Review Report(Codex 或 fallback 后的 design-doc-reviewer,二选一非双跑)后续处理(逐条勾选 fix/skip、追加 `## Review Log`)按 design-doc 工作流原样走。

## 不要

- 轻档红蓝 / 简单任务也拉 codex —— 噪音 + 烧额度。
- 先跑一次 `setup --json` 探活再决定调不调 —— 本规则已改为不预先探活,直接派 subagent 跑真正命令,报错才降级,别多加一层探测往返。
- 在主 agent 里直接 Bash 跑 `review`/`adversarial-review`/`task` —— 必须派 subagent 执行,原始输出别堆进主 agent context;场景 1/4 默认单路交给 Codex,不再需要与 Subagent 同一条消息并行发出。
- codex 调用成功时还额外并派一路 Subagent 跟它同跑 —— 场景 1/4 已改为默认单路,Subagent 只在 codex 调用报错时才作为 fallback 派发,不是常态双跑。
- codex 报错后不判断就当成功继续往下走 —— 必须读 subagent 返回内容确认是否报错,报错就按场景降级,不能假装 codex 跑通了。
- codex 不可用时静默卡住或假装调了 —— 必须降级自做 + 明说 fallback。
- 改 `vendor/codex/` 里的文件 —— 那是上游镜像,改了 re-sync 会冲突;接口要变只改本规则。
- hardcode 插件 cache 路径 / version 目录 —— 一律走 `${CLAUDE_PLUGIN_ROOT}/vendor/codex/...`。
