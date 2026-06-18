# rule-plan

primary_route: plan
acceptable_alternates: []
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: ["skill-plan", "produce-task-list"]
  forbidden_action_ids: ["skill-define", "skill-build", "write-code"]

# action-id 词表:
#   skill-plan / produce-task-list / draw-dependency-graph / vertical-slice
#   skill-define(反) / skill-build(反) / write-code(反) / skill-design(无关)

## positive

- 写个计划
- 拆一下任务
- 怎么实现这个
- plan it out
- 拆解一下这个需求
- 实现方案拆成步骤
- 帮我规划一下实现顺序

## negative

- [other-rule-primary] 澄清一下需求                    # → define
- [other-rule-primary] 写个设计文档                      # → design
- [other-rule-primary] 开始写代码                        # → build
- [near-miss]          这个计划写得怎么样                # → review / red-blue-deep
- [explicit-exclusion] 看一下现在的 task 列表            # → 纯查询
