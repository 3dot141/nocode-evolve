# 方法卡：code-quality-method（代码质量清单：正确性四维 + 清理三维）

> reviewing 框架方法库 · 评审方法之一（清单载体）。**适合**：代码 diff 的**通用质量 + 可维护性 + 安全 + 性能**逐项核查——「写完/改完代码后立刻审一遍」的兜底清单。**不适合**：纯方案/决策评审（用 `red-blue-adversarial`）、深度威胁建模（用 `threat-modeling`）。
>
> 本卡由 `agents/code-reviewer.md` 转出，后经场景/视角/方法重构（见 skeleton §3）**拆成两个视角的维度表**：**正确性维度**（这里有没有 bug/硬伤）供"代码质量"场景的正确性视角使用，**清理维度**（这里能不能写得更好）供该场景的清理视角使用——两者回答不同的问题，不再揉进一张表逐项核查。与 `security-method` 的分工：本卡正确性维度是**通用兜底**（安全只到「高发硬伤」层），涉及外部输入/认证/敏感数据的专项深审切 `security-method`（OWASP Top10 全量）。
>
> **caller 用法**：`Read` 本卡 + `Read references/skeleton.md`（套通用流程）+ `Read references/findings-contract.md`（套 findings 契约）；把待审 diff 注入下方 `{DIFF}` 占位符。流程步骤（场景识别 / 分档 / 执行 / Verify / 收口）走骨架，本卡只提供「领域维度」（骨架步骤 1 的场景识别输入）。

---

## 待审对象（caller 注入）

```
{DIFF}
```

> 无注入时退化为「自取上下文」：`git diff` 看最近改动 → 聚焦改动文件 → 逐项核查。

---

## 一、正确性维度（回答"这里有没有 bug/硬伤"）

逐项核查，每项判 ✅ 通过 / ⚠️ 疑点 / ❌ 问题，不默默跳过。给修法时带具体改前/改后示例。

### 1.1 总览审查清单（先扫一遍）

- 错误处理到位
- 无暴露的 secret / API key
- 实现了输入校验
- 测试覆盖良好
- 核查了引入库的 License（合规性缺陷，不是优化项）

### 1.2 安全（原生 CRITICAL）

> 安全硬伤层——逐项命中即近阻塞。深度安全审（OWASP 全量 / 信任边界）切 `security-method` + `threat-modeling`（属"安全"场景，不属本卡）。

- 硬编码凭据（API key / 密码 / token）
- SQL 注入风险（查询里字符串拼接）
- XSS 漏洞（未转义的用户输入）
- 缺失输入校验
- 不安全依赖（过期 / 已知漏洞）
- 路径穿越风险（用户可控的文件路径）
- CSRF 漏洞
- 认证绕过

### 1.3 正确性缺陷（原生 HIGH）

- 缺失错误处理（try/catch）
- 新代码缺测试
- 可访问性问题（缺 ARIA label、对比度差——未满足是缺陷，不是"锦上添花"的优化）

## 二、清理维度（回答"这里能不能写得更好"，不是找 bug——对应 Claude Code cleanup 角度 reuse/simplification/efficiency/altitude/conventions 的调研启发，见前置调研 §2.2）

清理维度的问题**默认不阻塞合并**（无 critical，只有 warning/suggestion），是"顺手做会更好"，跟正确性维度"必须修"的性质不同。

### 2.1 复用与简化

- 无重复代码
- 代码简洁、可读
- 超大函数（>50 行）
- 超大文件（>800 行）
- 深层嵌套（>4 层）
- 可变（mutation）模式
- 残留 `console.log`

### 2.2 效率

- 低效算法（能 O(n log n) 却写成 O(n²)）
- React 中不必要的重渲染
- 缺失 memoization
- 过大的 bundle 体积
- 未优化的图片
- 缺失缓存
- N+1 查询

### 2.3 风格一致性

- 代码/注释里用 emoji
- TODO/FIXME 无对应 ticket
- 公开 API 缺 JSDoc
- 命名差（`x` / `tmp` / `data`）
- 无解释的魔法数字
- 格式不一致

## 三、项目专项清单（按项目裁剪——非通用维度，正确性/清理均可能涉及）

> 以下为可选示例，**已降级为可选**——caller 据所在项目的 `CLAUDE.md` / skill 文件补充对应专项，否则跳过。

<details>
<summary>项目专项核查（可选）</summary>

- 遵循 MANY SMALL FILES 原则（典型 200-400 行）
- 代码库无 emoji
- 用不可变模式（spread 操作符）
- 校验数据库 RLS 策略
- 检查 AI 集成的错误处理
- 校验缓存的 fallback 行为

</details>

---

## 四、输出契约

套 `findings-contract.md` 的 schema，`axis` = 具体子项（`安全` / `正确性` / `复用与简化` / `效率` / `风格一致性`，或 `SQL 注入` / `超大函数` 等），`fix` 带改前/改后对照（Structural Remedy 优先），形如：

```
[CRITICAL] 硬编码 API key
File: src/api/client.ts:42
Issue: API key 写死在源码里
Fix: 移到环境变量

const apiKey = "sk-abc123";          // ❌ Bad
const apiKey = process.env.API_KEY;  // ✓ Good
```

- **正确性维度**分级：原生 CRITICAL（安全组）+ HIGH（正确性缺陷组）→ 统一映射见 findings-contract §3，本卡审批判据里 HIGH 即阻塞，上提不下沉，两者都进 `severity=critical`。
- **清理维度**分级：全部子项统一进 `severity=warning`（明显影响可维护性）或 `severity=suggestion`（零散 nit），**不产生 critical**——清理项不阻塞合并。
- 受 Evidence Gate 约束：代码事实类 critical/warning 缺 `location` → 降 `kind=open-question`。
- `verdict.approved`：无 critical → true；仅 warning → true（recommendation 标「可谨慎合并」）；有 critical → false（recommendation 给「N Critical 必修后可合并」）。Critical 必修不可 override（清理维度不产生 critical，不影响 approved 判定）。

---

> **场景 / 视角 / 派发 / 档位 / 升档 / CLAIM 剥离 / codex 降级见 skeleton §1–§3、§4.0–§4.2，本卡不复述。** 本卡的正确性维度供"代码质量"场景的正确性视角使用（与 `checklist` 泛指的领域维度、`error-mechanism`、`regression-check`、`cross-file-impact` 一起可叠加执行，见 skeleton §3 场景表「代码 diff/代码质量」行）；清理维度供该场景的清理视角使用。subagent+codex 双审档下按 §4.0 双执行位执行，仅单路命中的候选按 §4.7 Verify 走独立验证；碰安全敏感面（外部输入 / 认证 / 敏感数据）时叠加"安全"场景的 `security-method`（OWASP 全量）+ `threat-modeling`。
