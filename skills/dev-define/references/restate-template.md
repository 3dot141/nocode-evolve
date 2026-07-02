# Restate 模板

Define 阶段的标准化产出格式。用户确认此 restate 后 Define 才过 Gate。

## 标准 Restate（Standard / Full 场景）

```markdown
## Define Restate

**Outcome**: [最终产出什么——具体产物，不是抽象目标]

**User**: [谁受益——角色/身份]

**Why Now**: [什么变了导致现在要做——触发条件]

**Success Criteria** (可量化):
- [ ] SC-1: [具体可测条件 1]
- [ ] SC-2: [具体可测条件 2]
- [ ] SC-3: [具体可测条件 3]

**路径清单** [从 PRD 搬入，或现场生成]:

使用路径:
- {领域}.P{N}: ... [CONFIRMED/ASSUMED/TBD]

跨领域路径:
- 跨域.{N}: ...

系统路径:
- 系统.{N}: ...

约束:
- 约束.{N}: ...

（路径格式详见 `{NOCODE_SKILL_REF}/path-conventions.md`）

**路径 ↔ SC 绑定**:
| 路径 | 绑定 SC |
|---|---|
| {领域}.P1 | SC-{N} |
| ... | ... |

**Constraint**: [约束条件——技术/时间/资源/兼容性]

**Out of Scope** (不做什么 + 理由):
- [排除项 1]: [理由]
- [排除项 2]: [理由]

**Assumptions** (显式列出):
1. [假设 1]（已验证 / 推断 / 待确认）
2. [假设 2]（已验证 / 推断 / 待确认）

**Boundaries**:
- Always: [必须遵守的约束]
- Ask First: [需要用户确认才能做的事]
- Never: [绝对不做的事]

**Quality Bar** (怎样算高质量):
- [ ] [可检验的质量条件 1]
- [ ] [可检验的质量条件 2]
- [ ] [可检验的质量条件 3]

**Collaboration Pact** (如何协作):
- Agent 做: [agent 负责什么]
- 用户提供: [需要用户给什么信息/反馈]
- 检查点: [中间在哪些节点同步]
- 协作指令: [穷尽探索 / 信心验证循环 / 无]

**Scenario**: Full / Standard / Fix / Mini

**探索胶囊（附录，Step 2 产出；下游按 scanBase 判断复用/重扫——Full 场景 Design Step 1a，Standard 场景 Plan Step 1）**:
- scanBase: [扫描时 `git rev-parse --short HEAD` 的值]
- findings:
  - [claim] — confidence: [high/medium/low] — sources: [`path:line` 或 URL] — evidence: [关键证据]
  - ...
- openQuestions: [探索没搞清楚的点，没有则写 无]
```

## Mini Restate（Mini 场景）

```markdown
## Define Mini-Goal

**做什么**: [一句话]
**验收标准**: [一句话]
**不做什么**: [一句话]

**Scenario**: Mini
```

## Fix Restate（Fix 场景）

```markdown
## Define Fix

**Bug 描述**: [一句话]
**重现步骤**:
1. [步骤]
2. [步骤]

**预期行为**: [应该怎样]
**实际行为**: [实际怎样]
**影响范围**: [哪些功能/用户受影响]

**Scenario**: Fix
```
