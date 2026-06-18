# rule-verify

primary_route: verify
acceptable_alternates: []
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: ["skill-verify", "collect-evidence"]
  forbidden_action_ids: ["skill-build", "claim-done-without-evidence"]

# action-id 词表:
#   skill-verify / collect-evidence / run-tests / acceptance-check
#   skill-build(反) / claim-done-without-evidence(反) / skill-plan(无关)

## positive

- 验证一下
- 跑一下看看
- 确认能用
- verify
- 端到端测试一下
- 测一下整体

## negative

- [other-rule-primary] 开始写代码                        # → build
- [other-rule-primary] review 一下                       # → code-review
- [other-rule-primary] 帮我提个 PR                       # → finishing-branch
- [near-miss]          测试过了吗                         # → 纯查询
- [explicit-exclusion] 看一下测试覆盖率
