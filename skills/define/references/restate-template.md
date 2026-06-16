# Restate 模板

Define 阶段的标准化产出格式。用户确认此 restate 后 Define 才过 Gate。

## 标准 Restate（Standard / Full 场景）

```markdown
## Define Restate

**Outcome**: [最终产出什么——具体产物，不是抽象目标]

**User**: [谁受益——角色/身份]

**Why Now**: [什么变了导致现在要做——触发条件]

**Success Criteria** (可量化):
- [ ] [具体可测条件 1]
- [ ] [具体可测条件 2]
- [ ] [具体可测条件 3]

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

**Scenario**: Full / Standard / Fix / Mini
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
