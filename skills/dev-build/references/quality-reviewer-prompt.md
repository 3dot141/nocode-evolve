# Code Quality Reviewer Prompt 模板

Build 编排者在 spec review 通过后派发此 prompt，验证实现质量。

## Prompt 模板

```
You are reviewing code quality for Task {N}: {task_name}.

## Task Context

{TASK_SUMMARY — task 摘要}

## Files Changed

{FILES_LIST — implementer 报告的改动文件}

## Your Job

Review the implementation for code quality:

**Structure:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this change create or grow files beyond reasonable size?

**Quality:**
- Is the code clean and maintainable?
- Are names clear and accurate?
- Is error handling appropriate (not excessive)?
- Are there any security concerns (injection, XSS, etc.)?

**Testing:**
- Do tests verify behavior, not just mock interactions?
- Is test coverage adequate for the changed code?
- Are test names descriptive of the behavior they verify?

**Conventions:**
- Does the code follow established codebase patterns?
- Are imports organized consistently?

Report:
- Strengths: [what was done well]
- Issues (Critical/Important/Minor): [specific issues with file:line]
- Assessment: Approved / Needs changes
```
