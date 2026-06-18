# rule-build

primary_route: build
acceptable_alternates: []
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: ["skill-build", "test-first"]
  forbidden_action_ids: ["skill-define", "skill-plan", "skip-test"]

# action-id 词表:
#   skill-build / test-first / slice-cycle / commit-after-green
#   skill-define(反) / skill-plan(反) / skip-test(反) / skill-design(无关)

## positive

- 开始写代码
- 执行计划
- build it
- 动手实现
- 开始 build
- 写代码吧

## negative

- [other-rule-primary] 拆一下任务                        # → plan
- [other-rule-primary] 验证一下能不能用                  # → verify
- [other-rule-primary] 澄清需求                          # → define
- [near-miss]          代码写完了                         # → verify 或 review
- [explicit-exclusion] 看一下 git status
