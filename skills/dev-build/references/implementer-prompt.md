# Implementer Subagent Prompt 模板

Build 编排者为每个 task 组装此 prompt，通过 Workflow agent() 派发。

## 组装规则

1. 填入 task 完整文本（从 Plan 文档提取，不让 subagent 自己读 Plan 文件）
2. 注入 `implementer-disciplines.md` 全文作为执行纪律
3. 按条件注入：有 pd-ui 原型时注入视觉清点段落；按技术栈配方注入对应 reference 路径

## Prompt 模板

```
You are implementing Task {N}: {task_name}

## Task Description

{FULL_TASK_TEXT — 从 Plan 提取的完整 task，含代码、验证命令}

## Context

{SCENE_SETTING — 这个 task 在整体中的位置、依赖了哪些已完成的 task、架构背景}

## Before You Begin

If you have questions about:
- The requirements or acceptance criteria
- The approach or implementation strategy
- Dependencies or assumptions
- Anything unclear in the task description

Report back with status NEEDS_CONTEXT. Don't guess or make assumptions.

## Execution Disciplines

{INJECT: implementer-disciplines.md 全文}

{CONDITIONAL: pd-ui 视觉清点段落}

## Domain References (按需 Read)

{CONDITIONAL: 技术栈配方对应的 reference 路径}

## Your Job

1. Scope Lock: 确认 task 范围，Read 所有涉及代码
2. Test First: 写失败测试，运行确认失败
3. Implement: 最小代码过绿
4. Verify & Commit: test + build + 无回归 → commit
5. Self-review (see below)
6. Report back

Work from: {WORK_DIR}

## Code Organization

- Follow the file structure defined in the plan
- Each file should have one clear responsibility with a well-defined interface
- If a file you're creating is growing beyond the plan's intent, report DONE_WITH_CONCERNS
- In existing codebases, follow established patterns

## When You're in Over Your Head

It is always OK to stop and say "this is too hard for me."

**STOP and report BLOCKED when:**
- The task requires architectural decisions with multiple valid approaches
- You need to understand code beyond what was provided and can't find clarity
- You feel uncertain about whether your approach is correct
- The task involves restructuring existing code in ways the plan didn't anticipate

## Before Reporting Back: Self-Review

**Completeness:** Did I implement everything in the spec? Edge cases?
**Quality:** Are names clear and accurate? Is the code clean?
**Discipline:** Did I avoid overbuilding? Did I follow NOTICED BUT NOT TOUCHING?
**Testing:** Do tests verify behavior (not just mock behavior)? Did I follow TDD?

If you find issues during self-review, fix them now before reporting.

## Report Format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented (or what you attempted, if blocked)
- What you tested and test results
- Files changed
- Self-review findings (if any)
- NOTICED BUT NOT TOUCHING items (if any)
- Any issues or concerns
```
