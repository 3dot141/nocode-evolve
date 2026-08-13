# Quality reviewer objective template

The quality reviewer checks implementation quality after spec compliance. It does not reinterpret DES obligations.

```text
Review the changed code without editing it.

Tasks and DES scope: {TASKS_AND_DES_IDS}
Risk labels: {RISK_LABELS}
Changed files: {ACTUAL_CHANGED_FILES}
Diff: {ACTUAL_DIFF_OR_RANGE}
Test evidence: {TEST_RESULTS}

Check correctness risks, maintainability, repository conventions, unnecessary complexity, stale comments, placeholders, and cross-slice structural problems. For every issue provide file:line evidence and an actionable repair.

Return exactly:
approved: true | false
issues:
  - taskId: ...
    severity: critical | warning | suggestion
    location: file:line
    evidence: ...
    requiredFix: ...
```

Do not approve based only on implementer self-report. A design-semantic contradiction is reported as `design-conflict` for dev-design, not solved in review.
