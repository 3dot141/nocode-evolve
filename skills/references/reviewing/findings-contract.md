# findings 统一契约（数据契约层）

> **本文件是 `reviewing` 框架的 findings 单源**。所有引入框架的细则（dev-review / 四件套 / 嵌入式 step / method card）产出的 review 结论都套这套结构。
> 被 `skeleton.md`（框架骨架）的步骤 6/7 Read，也可被任一 method card 直接引用。
> 设计依据：`docs/superpowers/specs/3dot141/260630-reviewing-design.md` §4.4。

仓库里历史上长出 **5 种分级体系**（C/W/S、C/W/S/Q/SA、Critical/High/Medium/Low、CRITICAL/HIGH/MEDIUM、`{approved,issues}`），各 review 各报各的。本契约把它们统一为**一个 finding schema + 一张映射表**——细则只管按自己领域产 finding，分级语义由这里收口。

---

## 1. finding schema

每条 finding 是一个对象，字段如下：

```
finding {
  id        : "C1" / "W1" / "S1" / "Q1" / "SA1"        // 档位字母 + 序号，供用户引用（"修 C1、答 Q1、跳 S2"）
  severity  : critical | warning | suggestion          // 统一 3 档（阻塞 / 应修 / 记录）
  kind      : normal | open-question | self-audit       // 正交于 severity，承载 Q/SA 语义
  axis      : "<评审维度名>"                            // 由方法库的方法定义（如"正确性""安全""restate 完整性"）
  location  : "file:line" | "[章节锚点]"                // Evidence Gate：代码事实声明必填（见 §4 约束③）
  evidence  : "<代码/原文摘录>"                          // finding 的事实依据，让作者 1 跳验证
  finding   : "<问题描述>"                              // 这是什么问题
  fix       : "<可操作修法>"                            // Structural Remedy 优先（见下）
  source    : 蓝军 | 红军(Codex) | subagent | <方法名>   // 来源标记，去重合并 + 独立性追溯用
}
```

**字段说明（易错处）**：

- **`id`**：字母段 = 该 finding 的档位（`C`=critical / `W`=warning / `S`=suggestion / `Q`=open-question / `SA`=self-audit），序号在该字母内自增。注意 `id` 字母与 `severity`/`kind` 不是同一个字段——`Q1`/`SA1` 用 `id` 字母表达"这是 kind"，`severity` 另算（见 §4 约束②）。
- **`severity` 只有 3 档**。任何来源的原生分级先经 §3 映射表压到这 3 档，不在 finding 里保留 `High`/`HIGH`/`Medium` 等原生词。
- **`kind` 正交**：`normal` 是普通 finding；`open-question`（待核实事实）和 `self-audit`（自审卡点）是两类特殊性质，**与严重度独立**——一条 open-question 也可以有 `severity: suggestion`。
- **`axis`**：评审维度名，由所选 method 的维度表给出。同 `location` + 同 `axis` 是去重键（多来源命中同一处同一维度 = 高置信交集）。
- **`fix` — Structural Remedy 优先**：能从结构上消除问题（改设计 / 删一类用法 / 加约束让错误不可表达）的修法，优先于打补丁式的局部修补。例：与其"在 3 个调用点各加一次 null 检查"，不如"让该字段不可为 null"。
- **`source`**：合并多路结论时标来源。蓝军（主 agent 自评）、红军(Codex)（异源攻击）、subagent（独立 general-purpose）、或方法名（如 `threat-modeling`）。同一 finding 被多源命中 → 合并并保留全部 source（置信度更高）。

---

## 2. verdict 层

findings 列表之上是一个 verdict，收口整次 review 的结论：

```
verdict {
  approved       : boolean                              // 是否放行（有未处置 Critical → false）
  counts         : { critical: N, warning: N, suggestion: N }   // 各档计数
  recommendation : "<一句话总结 + 拍板建议>"             // 如"3 Critical 必修后可合并"
}
```

**verdict 与 severity 的关系**：

- `approved` 默认由 Critical 决定——存在未处置的 `severity: critical` → `approved: false`。Warning/Suggestion 不阻塞放行。
- `counts` 只统计 `severity`，不统计 `kind`；open-question / self-audit 按其 severity 计入对应档。
- **对抗型 review（red-blue-adversarial）也用这套 verdict**：它产出的"倾向 + 关键缓解"落在 `recommendation`，"是否成立/是否阻塞"落在 `approved`——不被 C/W/S 列表压扁（verdict 层专门承载"判断"而非"缺陷清单"）。

---

## 3. 5 种 → 统一 C/W/S 映射表

各来源的原生分级 → 统一 `severity`（`normalize` 据此压档）：

| 统一档 | dev-review | reviewer-template | security（4 档） | database | dev-build |
|---|---|---|---|---|---|
| **Critical**（阻塞，必修） | Critical | C | **Critical + High** | CRITICAL | `approved:false` + tag `[missing]` / `[empty-shell]` / `[design-mismatch]` |
| **Warning**（应修） | Warning | W | Medium | HIGH / MEDIUM | tag `[cross-task]` + Important |
| **Suggestion**（记录） | Suggestion | S | Low | 反模式提示 | tag `[extra]` + Minor |
| **正交 kind** | — | Q → open-question / SA → self-audit | — | — | — |

**读表说明**：

- **dev-review**：原生即 C/W/S，1:1 直通。
- **reviewer-template**：C/W/S 直通到 severity；**Q/SA 不进 severity**，转成 `kind`（见 §4 约束②）。
- **security 4 档压 3 档**：`Critical` 和 `High` **都**映射到统一 `Critical`（约束①，上提不下沉）；`Medium`→Warning；`Low`→Suggestion。
- **database**：`CRITICAL`→Critical；`HIGH`/`MEDIUM`→Warning；零散反模式提示→Suggestion。
- **dev-build**：以 `approved` 布尔 + tag 表达——`approved:false` 配 `[missing]`/`[empty-shell]`/`[design-mismatch]` 是阻塞类（Critical）；`[cross-task]`/Important 是应修类（Warning）；`[extra]`/Minor 是记录类（Suggestion）。dev-build 的 `approved` 直接喂 verdict 层的 `approved`，tag 进对应 finding 的 severity。

---

## 4. 三条关键约束

压档时必须遵守，否则会丢语义：

### ① security 的 High 上提 Critical（不下沉）

security 原生 4 档（Critical/High/Medium/Low）压成 3 档时，`High` 上提到统一 `Critical`，**不下沉到 Warning**。

依据：`agents/security-reviewer.md` 里 `High` 的语义是 "Fix Before Production"——近似阻塞。4→3 压缩若把 High 下沉成 Warning，会让"上线前必修的安全问题"被当成"可选修"，是安全语义损失。故 `Critical + High → Critical`。

### ② Q/SA 是 kind 不是 severity

`reviewer-template` 的 **Open Questions（Q）** 和 **Self-Audit（SA）** 是 finding 的**性质**，不是严重度。压进 C/W/S 会丢失它们各自的语义：

- **Q（open-question）= 待核实的事实疑问**：reviewer 无法自证（代码不在本仓 / 跨多仓 / 引用外部 SDK / 是尚未实现的代码），需作者确认或贴 `path:line` 反驳。压成 Suggestion 会丢"这需要作者回答"的语义。
- **SA（self-audit）= 自审卡点**："假设我是不熟悉项目的工程师，能否上手？卡在哪？" SA 常是隐藏的 Critical（"实施第一行就被卡住"），与 C/W/S 平级参与用户决策。压成普通 finding 会丢"这是换位视角发现的盲区"语义。

处理方式：Q/SA 转 `kind`（`open-question` / `self-audit`），`severity` 另算（按其实际阻塞程度定 C/W/S，默认 suggestion）。`id` 仍用 `Q`/`SA` 字母段供用户引用。

> **Q/SA 的完整定义与判据是单源**：见 `skills/dev-design-refine/references/reviewer-template.md` 的《降级路径：Open Questions》（Q 档触发与降级）与《Self-Audit（第二遍）》（SA 编号与"与 Cx 同根"去重）。本契约只声明"Q/SA 转 kind 不进 severity"的映射规则，不复述其定义——改判据去那份文件，本文件随之对齐。

### ③ Evidence Gate 入 schema：代码事实类缺 location 降 open-question

涉及**代码事实声明**的 finding（路径/签名/字段/类型/调用关系/当前实现行为/数值常量/历史决策一致性），要上 `Critical`/`Warning` **必须**带 `location`（`file:line`，证明 reviewer 真 Read 过代码）。

**缺 `location` 的代码事实类 finding，不许硬上 Critical/Warning**——降级为 `kind=open-question`（让作者确认或反驳），`severity` 落到 suggestion 档。这是 schema 级的硬约束，防"猜测式指控"让作者陷入证伪式返工。

例：
- ✅ `{id:"C2", severity:"critical", kind:"normal", location:"pkg/auth/session.go:42", evidence:"实际签名 CreateSession(ctx, uid)", finding:"文档少了 ctx 参数"}` —— 有 location，保留 Critical。
- ❌ → ✅ 降级：`{... finding:"CreateSession 可能需要 ctx 参数吧？"}` 无 location → 不许上 Critical，转 `{id:"Q1", severity:"suggestion", kind:"open-question", finding:"文档列了 CreateSession，本地未核实签名——请作者确认或贴 path:line"}`。

> Evidence Gate 的完整触发清单与判据同样以 `skills/dev-design-refine/references/reviewer-template.md` 的《Evidence Gate（代码事实依据）》为单源——本约束只把"缺 location → 降 open-question"固化进 schema。

---

## 5. 给细则的引入清单

引入框架的细则在 review 收口时（skeleton 步骤 6/7）按此契约产出：

1. 每条问题套 finding schema，`id` 用字母段 + 序号。
2. 原生分级经 §3 映射表压到 `severity`（3 档）；security High 记得上提 Critical（约束①）。
3. Q/SA 走 `kind`，不压进 severity（约束②）。
4. 代码事实类 finding 跑 Evidence Gate——缺 location 降 open-question（约束③）。
5. 顶上加 verdict（`approved` + `counts` + `recommendation`）。
