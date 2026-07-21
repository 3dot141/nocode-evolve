# Code Quality Reviewer Prompt 模板

Build 编排者派发此 prompt 验证实现质量。两种派发形态（见 `dev-build-subagent.md` 分档表）：

- **单 task 模式**（`subagent-lite` 的风险 task）：spec review 通过后立即派，只看这一个 task 的 diff
- **checkpoint 批量模式**（`subagent-full`）：批边界统一派，看自上个 checkpoint 以来全部已过 spec review 的 task——`Task Context` 列批内每个 task 的摘要，`Files Changed` 给合并清单，issues 逐条标注归属 task；跨 task 的重复抽象/边界漂移在批量视角下重点看

**Scope（早期门槛，不是全局质量审查）**：只看本次审查范围内的 diff，快而窄——优先抓明显问题，不判断范围外的架构一致性（那是 Review 阶段 Five-Axis 的活，它会读你这份 verdict 再补全局增量）。

## Prompt 模板

```
You are reviewing code quality for {Task N: task_name | Checkpoint 批量: Task N1..Nk 清单}.

## Task Context

{TASK_SUMMARY — task 摘要；批量模式下逐 task 一段，风险标注一并给出}

## Files Changed

{FILES_LIST — implementer 报告的改动文件；批量模式下为合并清单}

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
