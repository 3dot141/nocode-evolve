# skills/references/

被 `{NOCODE_SKILL_REF}` 占位符引用的共享领域指南库。多个 skill 按需 `Read` 这里的文件，避免每个 skill 各写一份重复的领域知识。本目录不是 skill，没有独立触发能力。

## 指南清单

| 文件 | 定位 | 典型消费方 |
|---|---|---|
| `api-design-guide.md` | API / 接口设计（REST、GraphQL、模块边界、组件 props），核心是"让正确的事容易做、错误的事难做" | dev-design、dev-review |
| `architecture-principles.md` | 架构原则：deep modules、Hyrum's Law、简单性判据、命名原则、code smell 检测 | dev-design、dev-review |
| `claude-design-hub.md` | Claude Design 三套接口（`/design` 命令 / claude-design skill / MCP）的分工说明 | pd-vd、dev-design-render、claude-design |
| `define-review.md` | restate 产出的需求定义评审领域维度（"四件套"之一，引入 reviewing 框架） | dev-define |
| `design-review.md` | 技术设计文档评审领域维度（"四件套"之一，引入 reviewing 框架） | dev-design、dev-design-refine |
| `frontend-guide.md` | 前端 / UI 工程指南：组件架构、可访问性、避免"AI 美学" | dev-build、dev-review、pd-vd |
| `migration-guide.md` | 迁移与废弃纪律：代码是负债，拆比造更少组织擅长 | dev-design、dev-review |
| `observability-guide.md` | 可观测性指南：先定义"working"再埋点，埋点与功能同批写 | dev-build、dev-design |
| `path-conventions.md` | 路径与 ID 体系约定（PRD/Define/Design/Plan/Review/Verify 产出物共用格式） | 大多数产出文档类 skill |
| `performance-guide.md` | 性能指南：先测量再优化，只优化被测量证实的瓶颈 | dev-review、dev-build |
| `prd-review.md` | PRD 评审领域维度（"四件套"之一，引入 reviewing 框架） | pd-prd |
| `security-guide.md` | 安全指南：外部输入默认敌对、secret 神圣、授权检查强制 | dev-review、dev-build |
| `testing-guide.md` | 测试指南：先写失败测试再实现，测试是证据不是"看起来对" | dev-build、dev-review |
| `ui-taste-model.md` | 无设计参考（无 pd-vd 产出/截图/Figma）时的视觉方向选型表 | pd-vd |
| `vis-review.md` | 交互视觉设计评审领域维度（"四件套"之一，引入 reviewing 框架） | pd-vd |

## `reviewing/` 子树

`reviewing` skill 的方法论底座实体文件都在这里（skill 本身只是入口壳）：

```
reviewing/
├── skeleton.md              # 通用 review 7 步流程骨架
├── findings-contract.md     # findings 统一数据契约
└── methods/                 # 评审方法库（11 张方法卡）
    ├── architecture-method.md
    ├── checklist.md
    ├── code-quality-method.md
    ├── database-method.md
    ├── dual-review.md
    ├── error-mechanism.md
    ├── perspective-based.md
    ├── red-blue-adversarial.md
    ├── security-method.md
    ├── self-review.md
    └── threat-modeling.md
```

- **`skeleton.md`**：7 步流程（分档 → 对象界定 → 评审维度 → 执行 → 独立交叉 → findings 分级 → 收口），管"怎么走一遍"。各专项 review（`dev-review` / 四件套 / `dev-build` per-task / `brainstorming` self-review 等）在自己 SKILL.md 里 `Read` 本文件，只在第 3 步填自己的领域维度，不重造流程。
- **`findings-contract.md`**：finding / verdict 的统一 schema（`id` / `severity` / `kind` / `axis` / `location` / `evidence` / `finding` / `fix` / `source`）+ 5→3 分级映射 + Evidence Gate，把仓库历史上长出的 5 种不同分级体系统一成一套，管"产出长什么样"。
- **`methods/*.md`**：管"用什么打法"。由 skeleton 第 4 步 `selectMethods` 按评审对象和档位挑选，例：审 SQL/schema/migration 加选 `database-method.md`，审架构决策加选 `architecture-method.md`，需要异源交叉时用 `dual-review.md`，评估类问题走 `red-blue-adversarial.md`（`red-blue-deep` skill 的方法实现单源就在这里）。
