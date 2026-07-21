---
name: _nocode-provider-codex-control
description: Private Workflow provider for codex-control.
user-invocable: false
---

# codex-control

Map `workflow.skill.invoke` to Codex Skill invocation, `workflow.plan.create/update` to `update_plan`, and `workflow.decision.request` to `request_user_input`. Use one turn-end question only when structured input is unavailable. Return the native result directly after sanitizing provider-private details.
