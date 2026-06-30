# 方法卡：code-quality-method（代码质量四维清单：安全 / 质量 / 性能 / 最佳实践）

> reviewing 框架方法库 · 评审方法之一（清单载体）。**适合**：代码 diff 的**通用质量 + 可维护性 + 安全 + 性能**逐项核查——「写完/改完代码后立刻审一遍」的兜底清单。**不适合**：纯方案/决策评审（用 `red-blue-adversarial`）、深度威胁建模（用 `threat-modeling`）。
>
> 本卡由 `agents/code-reviewer.md` 转出：剥 frontmatter + 写死示例，**完整保留 安全 / 代码质量 / 性能 / 最佳实践四组清单 + 审查清单 + 审批判据**。与 `security-method` 的分工：本卡是**通用四维兜底**（安全只到「高发硬伤」层），涉及外部输入/认证/敏感数据的专项深审切 `security-method`（OWASP Top10 全量）。
>
> **caller 用法**：`Read` 本卡 + `Read {NOCODE_SKILL_REF}/reviewing/skeleton.md`（套通用流程）+ `Read {NOCODE_SKILL_REF}/reviewing/findings-contract.md`（套 findings 契约）；把待审 diff 注入下方 `{DIFF}` 占位符。流程步骤（分档 / 独立交叉 / 分级 / 收口）走骨架，本卡只提供「领域维度」（骨架第 3 步）。

---

## 待审对象（caller 注入）

```
{DIFF}
```

> 无注入时退化为「自取上下文」：`git diff` 看最近改动 → 聚焦改动文件 → 逐项核查。

---

## 一、维度 / 思路

代码质量 review 的领域维度 = **总览审查清单 + 四组分级清单（安全 / 质量 / 性能 / 最佳实践）**。逐项核查，每项判 ✅ 通过 / ⚠️ 疑点 / ❌ 问题，不默默跳过。给修法时带具体改前/改后示例。

### 1.1 总览审查清单（先扫一遍）

- 代码简洁、可读
- 函数与变量命名得当
- 无重复代码
- 错误处理到位
- 无暴露的 secret / API key
- 实现了输入校验
- 测试覆盖良好
- 考虑了性能
- 分析了算法时间复杂度
- 核查了引入库的 License

### 1.2 安全（原生 CRITICAL）

> 安全硬伤层——逐项命中即近阻塞。深度安全审（OWASP 全量 / 信任边界）切 `security-method` + `threat-modeling`。

- 硬编码凭据（API key / 密码 / token）
- SQL 注入风险（查询里字符串拼接）
- XSS 漏洞（未转义的用户输入）
- 缺失输入校验
- 不安全依赖（过期 / 已知漏洞）
- 路径穿越风险（用户可控的文件路径）
- CSRF 漏洞
- 认证绕过

### 1.3 代码质量（原生 HIGH）

- 超大函数（>50 行）
- 超大文件（>800 行）
- 深层嵌套（>4 层）
- 缺失错误处理（try/catch）
- 残留 `console.log`
- 可变（mutation）模式
- 新代码缺测试

### 1.4 性能（原生 MEDIUM）

- 低效算法（能 O(n log n) 却写成 O(n²)）
- React 中不必要的重渲染
- 缺失 memoization
- 过大的 bundle 体积
- 未优化的图片
- 缺失缓存
- N+1 查询

### 1.5 最佳实践（原生 MEDIUM）

- 代码/注释里用 emoji
- TODO/FIXME 无对应 ticket
- 公开 API 缺 JSDoc
- 可访问性问题（缺 ARIA label、对比度差）
- 命名差（`x` / `tmp` / `data`）
- 无解释的魔法数字
- 格式不一致

### 1.6 项目专项清单（按项目裁剪——非通用维度）

> 以下为可选示例，**已降级为可选**——caller 据所在项目的 `CLAUDE.md` / skill 文件补充对应专项，否则跳过。不属于通用四维。

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

## 二、输出契约

产出 `findings[]`，映射 `{NOCODE_SKILL_REF}/reviewing/findings-contract.md`：

- 每条 finding：`axis` = 四维之一或具体子项（`安全` / `代码质量` / `性能` / `最佳实践`，或 `SQL 注入` / `超大函数` 等）；`location` = `file:line`；`evidence` = 问题代码摘录；`fix` = 具体修法，**带改前/改后对照**（Structural Remedy 优先），形如：

```
[CRITICAL] 硬编码 API key
File: src/api/client.ts:42
Issue: API key 写死在源码里
Fix: 移到环境变量

const apiKey = "sk-abc123";          // ❌ Bad
const apiKey = process.env.API_KEY;  // ✓ Good
```

- **四维原生分级 → 统一 C/W/S 映射**（与 findings-contract §3 同源）：
  - 原生 **CRITICAL（安全组）+ HIGH（质量组）→ 统一 `critical`**（阻塞，必修）。依据：本卡审批判据「Approve 要求无 CRITICAL **且**无 HIGH」「Block 触发于 CRITICAL **或** HIGH」——HIGH 在原语义里即阻塞，故上提 critical 不下沉。
  - 原生 **MEDIUM（性能 / 最佳实践组）→ 统一 `warning`**（应修）。
  - 零散 nit / 风格建议 → 统一 `suggestion`（记录）。
- 受 **Evidence Gate** 约束：代码事实类 finding（具体行/签名/调用）上 critical/warning 必须有 `location` + evidence，否则降 `kind=open-question`（让作者去核，防猜测式指控）。
- **verdict 映射审批判据**（原生 Approve / Warning / Block → `verdict.approved`）：
  - ✅ **Approve**：无 critical（无原生 CRITICAL/HIGH）→ `approved=true`。
  - ⚠️ **Warning**：仅 warning（仅 MEDIUM）→ `approved=true`，recommendation 标「可谨慎合并」。
  - ❌ **Block**：存在 critical（原生 CRITICAL/HIGH）→ `approved=false`，recommendation 给「N Critical 必修后可合并」。
  - `counts` 按 §一 各维计入对应档；Critical 必修不可 override（fix 后回 Build→Verify→再 Review）。

---

## 三、派发策略

| 模式 | 派 subagent | 调 codex | 说明 |
|---|---|---|---|
| **自评清单**（轻档 / 单文件可逆小改） | 否 | 否 | 主 agent 直接套四维清单逐项核查，self-review 一遍 |
| **异源交叉**（重档：不可逆 / 跨模块 / 碰外部输入·认证·敏感数据） | **是** | **是** | 重档时 subagent + codex 独立跑四维清单，**CLAIM 剥离**（只传 diff + 维度清单，不传已发现结论），异源更易发现单模型盲区 |

档位按 skeleton §1 分档判据定（代码 diff 默认方法集 = `checklist`（本卡）+ `red-blue-adversarial` 异源交叉，§4.3 选择表「代码 diff」行）。codex 不可用 → 单 subagent + 明说降级，独立性声明标「同模型（降级）」。碰安全敏感面时叠加 `security-method`（OWASP 全量）+ `threat-modeling`。
