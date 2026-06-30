# 方法卡：red-blue-adversarial（红蓝对抗）

> reviewing 框架方法库 · 评审方法之一。**适合**：方案 / 决策 / 架构选型 / 多方案僵持 / 重构方向——「该不该 / 选哪个 / 行不行」类评判。**不适合**：逐项缺陷核查（用 checklist）、固定维度遍历。
>
> 本卡是红蓝对抗能力的**单源**。`skills/red-blue-deep/SKILL.md` 是委派本卡的薄壳（保留独立 skill 入口供用户直触）。

red-blue-adversarial 不是「列 pros/cons」，而是**让独立的红军真攻击蓝军的方案**。核心三件：① 先拆第一性原理，别在错命题上辩论；② 红军交给隔离 reviewer，不自己演（自己攻自己手下留情）；③ CLAIM 剥离，不把倾向喂给 reviewer。

## 一、维度 / 思路

### 档位判定（必先做这一步）

| 信号（任一命中） | 档位 |
|---|---|
| 不可逆 / 跨模块 / 涉及选型 / 架构 / 重构 / 多方案僵持 / 用户显式说「深度评估 / 红蓝军 / 第一性原理 / 仔细想」 | **heavy** |
| 决策可逆 + 影响单文件 + 易回滚（命名、文案、单点小改、风格偏好） | **light** |

模糊时按「能否 5 分钟内回滚」判：能 → light，不能 → heavy。

**「多方案僵持」**：两个及以上互斥方案各有强支撑、无法判断哪个更好（如「前后端分离 vs 全栈 SSR」「PostgreSQL vs MongoDB 当主存储」）。

**边界示例**：改对外 API 字段名（已发布 client 会破）→ heavy；升主依赖大版本 → heavy；升 lint/formatter 工具依赖 → light；改 commit message → light；调内部函数命名 → light。

### light 档：一句表态

**一句表态 + 一句关键理由**，不展开蓝/红/结论，**不派 subagent、不调 codex**。

> 「变量名 `user_id` 怎么样」→「比 `uid` 好——后者太泛，全局搜会撞一堆无关引用。」

反例：为命名问题走完整三段红蓝军 = 折磨用户。

### heavy 档：完整四步

**前置 Gate — sequential-thinking 必开**：进 Step 1 前必须先调 `Skill(sequential-thinking)` 或 `mcp__sequential-thinking__sequentialthinking` 开结构化思考 session。**不开不能往下走**——硬 gate，不是建议。作用：多分支推演、中途回退重拆（发现 Step 1 拆错了基础假设回去重拆）、试折中分支不丢主线。

降级：sequential-thinking 不可用 → 明说「无结构化思考辅助下进行」→ **仍进 Step 1（降级不阻断）**。

**Step 1 — 第一性原理拆解**：剥到最基础的假设——这个决定要满足的**根本需求**是什么？哪些是真约束，哪些是历史包袱 / 沿用习惯？把伪需求剔掉。拆完才进蓝/红军，否则在错误命题上辩论。
> 例（会话要不要上 Redis）：根本需求 = 跨进程共享会话 + 进程崩溃不丢登录态；真约束 = (a) 多进程共享 (b) 不丢登录态；历史包袱 = 「大家都用 Redis」是惯例不是约束；伪需求剔掉 = 高性能（QPS 实际很低）、持久化（重登即可）。→ 真问题是「跨进程共享 + 短期可靠 KV」，候选 = Redis / sticky+内存 / Memcached / 数据库表，Redis 只是其一。

**Step 2 — 蓝军（主 agent，防守提议方案）**：列提议方案的优势 / 适用场景 / 隐含好处。必须落到具体场景（「X 时候有用」），不能空对空（「灵活性更好」）。

**Step 3 — 独立审查**：蓝军由主 agent 做，红军和全面审查交给**隔离上下文的独立 reviewer**（自攻自手下留情，且只从攻击角度看易遗漏盲区）。每路 reviewer 输出四维：优势（可能发现蓝军遗漏的好处）/ 弱点和隐藏代价（落到「实现时遇到 X」「N 月后出现 Y」，不要「理论上可能」）/ 盲区（提议者没想到的维度）/ 替代方案。
- **CLAIM 剥离**：只传方案 + 约束 + Step 1 真约束，**不传蓝军分析和你的倾向**（传了 reviewer 会锚定你的分析失去独立性）。
- **合并三路**（主 agent 蓝军 + subagent + codex）：三路交集 = 高置信；对称差（只一路提到）= 盲区，逐条判是否成立；成立的盲区纳入 Step 4。

**Step 4 — 结论**：格式「**倾向 A —— 因为 [关键蓝军论点]；但承认 [独立审查关键发现] 是真问题，[如何缓解]**」。Step 3 成立的盲区必须在结论体现，合并完不能丢。**不要「看情况 / 都有道理 / 你怎么想」——这是逃避。**

### Doubt Theater 检测
独立审查返回的弱点盲区全是「理论上可能」无具体场景 = 走过场。两个选择：换审查角度重跑（技术↔运维 / 性能↔安全 / 短期↔长期）；或承认无有效反驳，结论直接采纳蓝军。不要为「也得说点什么」把站不住的发现当真。

### 三轮收敛上限
sequential-thinking 允许回退重拆，最多 3 轮。第 3 轮仍不收敛 = 缺用户输入，停下问用户补约束（「你更在意 X 还是 Y？」），不要空转。

## 二、输出契约

产出 `findings[] + verdict`，映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- **light**：不强制结构化 findings——一句表态即可。如调用方要求结构化，记一条 `kind=normal` 的 suggestion 承载理由。
- **heavy**：独立审查的每条成立发现 → 一条 finding。
  - `axis` = `优势` / `弱点` / `盲区` / `替代方案`
  - `severity` = 按影响：阻塞性硬伤 critical / 应缓解的真代价 warning / 可选优化 suggestion
  - `source` = `蓝军` / `红军(Codex)` / `subagent`（合并去重用：三路交集标高置信）
  - 弱点类 finding 若是代码/事实声明，受 Evidence Gate 约束（缺 location 的 critical 降级 `kind=open-question`）
- **verdict**：`{ approved, counts, recommendation }`，其中 `recommendation` = Step 4 结论原文（倾向 + 关键理由 + 真问题 + 缓解）。**verdict 是 red-blue 的主产物**——findings 是支撑，结论的「倾向 + 缓解」不能被 C/W/S 列表压扁。

## 三、派发策略

| 档位 | 派 subagent | 调 codex | sequential-thinking |
|---|---|---|---|
| light | 否 | 否 | 否 |
| heavy | **是**（general-purpose，独立 review）| **是**（并行双跑）| **必开（硬 gate）** |

**heavy 独立审查并行双跑**（参照 `rule-codex-review` 场景四）：
1. Subagent（`Agent` general-purpose）：传方案 + 约束 + Step 1 真约束，做完整独立 review
2. Codex：同样输入，独立 review

```bash
node "${CLAUDE_PLUGIN_ROOT}/vendor/codex/scripts/codex-companion.mjs" task \
  "只读。独立审查以下方案，列出：1.优势（落到具体场景）2.弱点和隐藏代价（『实现时遇到 X』『N 月后 Y』，不要『理论上可能』）3.盲区 4.替代方案
   <方案 + 约束 + 真约束>"
```

**降级**：
- codex 不可用 → **仅 subagent 单跑 + 明说**「codex 不可用，仅 subagent 独立审查」→ 合并两路（不阻断）
- sequential-thinking 不可用 → 明说后仍进 Step 1（见上）

**反例**：轻档强走重档（噪音）/ 重档降轻档（架构一句话表态 = 失职）/ 跳过第一性原理（在错假设上辩论）/ 只蓝军独白跳过独立审查（销售）/ 主 agent 自演红军（手下留情）/ 独立审查传了倾向（reviewer 被锚定）/ 发现了盲区结论没体现（做了等于没做）。
