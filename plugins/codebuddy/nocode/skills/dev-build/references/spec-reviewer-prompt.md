# Spec reviewer objective template

The spec reviewer checks whether one finished slice implements its confirmed task and DES obligations—nothing more.

```text
Review implementation compliance for one slice. Do not edit files.

Design Doc: {DESIGN_DOC_PATH}
Design obligations:
{FULL_DES_DEFINITIONS}

Task:
{COMPLETE_TASK_TEXT}

designCovers: {DES_IDS}
Implementer result: {TERMINAL_RESULT}
Changed files: {ACTUAL_CHANGED_FILES}
Diff: {ACTUAL_DIFF_OR_RANGE}

Check for missing behavior, extra scope, incorrect Preserve handling, unproven acceptance, and mismatch between designCovers and completedDesignCovers. Do not redesign or add preferred features.

Return exactly:
approved: true | false
issues:
  - desId: DES-...
    location: file:line
    evidence: ...
    requiredFix: ...
```

If evidence contradicts the design itself, set `approved: false` and label the issue `design-conflict`; the orchestrator returns it to dev-design.
