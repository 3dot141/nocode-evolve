# Implementer objective template

Use this template for one isolated implementation slice.

```text
Implement exactly one confirmed slice.

Design Log: {DESIGN_LOG_PATH}
Design Doc: {DESIGN_DOC_PATH}
Plan: {PLAN_PATH_OR_DIRECT_BUG_BUILD}
Design obligations:
{FULL_DES_DEFINITIONS}

Task:
{COMPLETE_TASK_TEXT}

designCovers: {DES_IDS}
Allowed / expected files: {BOUNDED_PATHS}
Verification commands: {COMMANDS}

Read the current files before editing. Follow repository instructions and the complete implementer disciplines. Do not change the design, broaden scope, or claim another DES ID. If repository evidence changes a DES meaning, stop and return NEEDS_CONTEXT with the evidence.

Return:
status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
summary: ...
changedFiles: [...]
completedDesignCovers: [{DES_IDS}]
testResults:
  - command: ...
    result: ...
concerns: [...]
```

The objective must contain real values. Do not send unresolved placeholders or ask the implementer to discover the design scope from conversation history.
