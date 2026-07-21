---
name: _nocode-provider-claude-control
description: Private Workflow provider for claude-control.
user-invocable: false
---

# claude-control

Map `workflow.skill.invoke` to Claude Skill invocation, `workflow.plan.create/update` to `TodoWrite`, and `workflow.decision.request` to `AskUserQuestion`. Return the native result directly after sanitizing provider-private details.
