# skills/references/

被 `{NOCODE_SKILL_REF}` 占位符引用的共享领域指南库。多个 skill 按需 `Read` 这里的文件，避免每个 skill 各写一份重复的领域知识。本目录不是 skill，没有独立触发能力。

## 指南清单

| 文件 | 定位 | 典型消费方 |
|---|---|---|
| `api-design-guide.md` | API / 接口设计（REST、GraphQL、模块边界、组件 props），核心是"让正确的事容易做、错误的事难做" | dev-design、dev-review |
| `architecture-principles.md` | 架构原则：deep modules、Hyrum's Law、简单性判据、命名原则、code smell 检测 | dev-design、dev-review |
| `frontend-guide.md` | 前端 / UI 工程指南：组件架构、可访问性、避免"AI 美学" | dev-build、dev-review、pd-vd |
| `ix-vd-contract.md` | IX↔VD 分工契约：状态覆盖 / 行为规格 / 控件四态术语单源 + 判据 + tokens/components/patterns 三层命名 + 禁令 | pd-ix、pd-vd |
| `migration-guide.md` | 迁移与废弃纪律：代码是负债，拆比造更少组织擅长 | dev-design、dev-review |
| `observability-guide.md` | 可观测性指南：先定义"working"再埋点，埋点与功能同批写 | dev-build、dev-design |
| `design-traceability.md` | 工程任务的 LOG → DES 追踪与下游 stage-local coverage 契约 | dev-design、dev-plan、dev-build、dev-verify |
| `grilling-loop.md` | Design 面试原则：任务树、一次一问、事实自查、最佳设计 | dev-design |
| `path-conventions.md` | 产品路径与工程 DEC / DES ID、过程 Log 体系约定 | 大多数产出文档类 skill |
| `performance-guide.md` | 性能指南：先测量再优化，只优化被测量证实的瓶颈 | dev-review、dev-build |
| `security-guide.md` | 安全指南：外部输入默认敌对、secret 神圣、授权检查强制 | dev-review、dev-build |
| `testing-guide.md` | 测试指南：先写失败测试再实现，测试是证据不是"看起来对" | dev-build、dev-review |
| `ui-taste-model.md` | 无设计参考（无 pd-vd 产出/截图/Figma）时的视觉知识分层选型（决策框架/风格包互斥/场景/dataviz） | dev-design / dev-build（pd-vd 走自己的 Step 3a 决策树） |
