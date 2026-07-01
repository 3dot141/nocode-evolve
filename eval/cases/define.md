# rule-define

primary_route: define
acceptable_alternates: []
preamble_profiles: [cold, mid-task-momentum]

default_intent:
  must_action_ids: ["skill-define", "produce-restate"]
  forbidden_action_ids: ["skill-design", "propose-approaches", "write-code", "skip-to-plan"]

# action-id 词表(含干扰项):
#   skill-define / produce-restate / ask-clarifying-question / scene-classify
#   skill-design(反) / propose-approaches(反) / write-code(反) / skip-to-plan(反)
#   skill-plan(无关) / skill-build(无关) / read-rule-design(无关)

## positive   (该触发 → define)

- 澄清一下需求
- 这个任务做什么
- 目标是什么
- interview me
- 定义一下目标
- 需求不清楚，先聊聊
- 帮我搞清楚要建什么
- clarify the requirements
- 这个 feature 到底要解决什么问题

## negative

- [other-rule-primary] 写个设计文档                               # → design
- [other-rule-primary] 方案对比一下                               # → design
- [other-rule-primary] 技术选型用什么                             # → design
- [other-rule-primary] 开始写代码                                 # → build
- [other-rule-primary] 帮我提个 PR                                # → finish-branch
- [near-miss]          这个变量名改成什么好                       # → 直接动手 / mini
- [explicit-exclusion] 列一下当前的 task
