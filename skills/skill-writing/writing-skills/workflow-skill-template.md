# Workflow Skill Template

Full templates for workflow skills — referenced from SKILL.md Phase 4. A workflow skill is any skill whose body is multi-step sequential execution with ordering-critical or side-effecting operations, regardless of skill type (Discipline, Technique, Pattern, or Reference).

Workflow skill SKILL.md must include all three elements below.

## 1. Step 0: TaskCreate

First thing on entry, create all tasks at once. Each task has Sub-steps + Gate:

```markdown
## Step 0: TaskCreate

**First thing on entry** — create all tasks at once:

Task 1: [step name] (Step 1)
  Sub-steps: [specific sub-steps]
  Gate: [pass criteria]

Task 2: [step name] (Step 2)
  Sub-steps: [specific sub-steps]
  Gate: [pass criteria]

...

Mark each task done as it completes.
```

## 2. Enter Gate + Exit Gate for every Step

```markdown
### Step N: [step name]

**Enter Gate:**
- [ ] Previous Step Exit Gate passed
- [ ] [prerequisites for this step]

[step content]

**Exit Gate:**
- [ ] [objective completion criteria]
- [ ] [verifiable artifact]
```

## 3. Global Exit Gate

Summary of all Step Exit Gates:

```markdown
## Exit Gate (Global)

- [ ] [Step 1 key artifact]
- [ ] [Step 2 key artifact]
- [ ] ...
```

## Gate writing principles

- Gate conditions must be objectively verifiable (yes/no, pass/fail, number meets threshold) — no subjective words ("good enough", "mostly done")
- Enter Gate prevents skipping — cannot enter if prior step hasn't passed
- Exit Gate prevents premature advancement — cannot mark done without evidence of output
- Use checkbox `- [ ]` format for item-by-item verification
