# 项目本地 `.agents-personal/` 使用约定

`<project>/.agents-personal/` 是项目本地放给 agent 的资源目录，目前两类子内容：

- `wiki/` —— **历史记忆**：设计决策、术语、踩坑记录。被动检索，可能被新决策 superseded。
- `AGENTS.md` + `rules/` —— **当前指令**：触发条件 + 操作细节。主动按触发匹配读取。

两类资源结构上同模式（主索引 + 子内容池），但**语义不同**：wiki 是事实记录，rules 是工作指令——不要把 wiki 当指令执行，也不要把 rules 当可质疑的历史。

---

## §1 wiki/ —— 历史记忆

由用户跑 `/sediment`（统一沉淀分流命令）维护——命令会自动判断该项内容走 wiki 还是 rules 出口。

### 触发：会话开始只做存在性检查，3 条 OR 命中时才 Read INDEX

会话开始时，做一次轻量存在性检查（成本可忽略）：

```
ls <project>/.agents-personal/wiki/
  ├─ 目录不存在 / 没有 INDEX.md → 标记"无 wiki"，全程跳过
  └─ 存在 INDEX.md             → 记下"待读"，但**不**立刻 Read
```

**实际 Read INDEX.md 推迟到下列任一信号命中**（3 条 OR）：

1. 即将调用 `superpowers:brainstorming` 或 `nocode-evolve:design-doc-writing` skill
2. 用户消息含「设计 / 选型 / 方案 / 架构 / 重构 / RFC / 提案」任一关键词
3. 当前任务进行中**升级**为以上之一（如 bug fix 中途发现要做架构决策）→ 此时回头 Read

要点：

- INDEX 在同一会话内只需 Read 一次；命中触发后读完，后续轮次不重复
- 三条 OR 全部不触发的纯执行 / 纯调研 / 纯小修任务，**全程不读 INDEX**——避免无谓占用 context
- 读完 INDEX 不必在回答里逐条复述——但若 INDEX 里的某条 description 显著和当前任务相关，**必须**在回答里点名引用，避免「读了等于没读」
- 设计意图：wiki 内容是「历史设计决策 + 术语 + 踩坑」，只有做设计时才用得到——触发点与内容性质对齐，纯执行任务不付入场费

### 进一步深读 pages（按需）

读完 INDEX 是基线，**深入 pages 仍然按需**。满足任一信号才 Read 具体页：

- 你对这个项目的某个设计 / 约定 / 术语**不确定**
- 用户的问题暗示「这个之前讨论过」
- 你即将做的判断和项目过往决策**可能冲突**
- 用户问「这个项目里 X 怎么处理的」之类历史性问题
- INDEX 里某条 description 明显覆盖了当前任务的关键决策点

命中 → `Read ./pages/<filename>`，并在回答里反映引用关系。

### 不要

- 读了 INDEX / pages 后却不引用——既然查了就要在回答里反映出引用关系
- 无脑把所有 pages 都拉进 context——基线只到 INDEX，pages 仍按需
- 把 wiki 内容当作绝对真理——它是历史记录，可能被新决策 superseded
- 试图自己写 wiki——沉淀走 `/sediment`，AI 主动写 wiki 容易过度

### 关于沉淀

如果你发现本会话产生了**值得沉淀**的项目级知识（新设计决策、新约定、新踩过的坑），主动建议用户跑 `/sediment`——命令会自动识别候选并贴 wiki:project / rules:project 等标签，由用户用短码勾选。不要替用户决定。

---

## §2 AGENTS.md + rules/ —— 当前指令

### 角色分工（写入约束）

`.agents-personal/AGENTS.md` 是**路由表**，**只**列触发条件，不写细节：

```markdown
## 提 PR
**触发**：用户说「提 PR / 提交 PR / 创建 PR / push 完想合并」，或显式贴 Bitbucket create PR 链接。
**读**：rules/pr-create.md
```

`.agents-personal/rules/<topic>.md` 放具体指令：命令模板、事实表、坑、示例。一个 topic 一个文件。

这样做的理由：

- AGENTS.md 总是被读，越短越好——细节挤进来会拖累每次会话的开局
- rules 按触发命中才读，篇幅可以放开
- 触发条件和指令分离 → 修指令不动 AGENTS.md，加新指令不污染老指令

### AGENTS.md 触发条件写法

**够具体到 agent 能自识别**，避免「看情况」「适当时候」这类含糊表达。判断标准：

- 触发条件能用一句"当 X 时"或"用户说 Y 时"陈述
- agent 读完触发条件能直接判 "yes / no"，不需要二次推理
- 多个触发条件之间不互相覆盖（重叠 ok，但要在 rules 里说明优先级）

❌ 反例：「需要的时候读 rules/foo.md」「相关问题查阅 rules/bar.md」
✅ 正例：「用户问 X 的安装 / 配置 / 版本时 → 读 rules/x-setup.md」

### 读取时机

- **新会话开始 Read AGENTS.md**：首次响应实质性问题前 Read 一次，同会话只读一次。AGENTS.md 是路由表（按设计极短、只列触发条件），不读就丢失对 `rules/<topic>.md` 里指令的感知——**和 wiki/INDEX.md 的延迟策略不同**：wiki 是历史记忆可延迟到设计触发时再读，AGENTS.md 是当前指令路由必须实时读
- **rules/<topic>.md 按需**：当前任务匹配某条触发条件 → Read 对应 rule 文件 → 按其指令执行
- 命中即引用：和 wiki 一样，读了就要在回答里反映出来（不必复述全文，但要表明依据来自哪条 rule）

### 不要

- 在 AGENTS.md 里写命令模板 / 长事实表——挪到对应 rule
- 触发条件用「可能 / 也许 / 看情况」——含糊触发等于没触发
- 把 rules/<topic>.md 当历史记录质疑——它是当前指令，要执行；要改请用户改文件
- 自己往 `.agents-personal/AGENTS.md` 或 `rules/` 里写东西——同 wiki，沉淀由用户决定（可建议、不替代）

### 关于沉淀

如果本会话产生了**值得沉淀**的项目级指令（新约定、新命令、新踩坑后的标准做法），主动建议用户跑 `/sediment`——命令会自动给候选贴 `rules:project` 标签，落地时双写 `.agents-personal/rules/<topic>.md` + AGENTS.md 触发条件。如果只是一次性背景，命令会自动判 `wiki:project` 走历史记忆侧。

---

## §3 删除护栏 —— `.agents-personal/` 下任何文档删除前必须用户二次确认

`.agents-personal/` 下的内容（`AGENTS.md` / `rules/*.md` / `wiki/INDEX.md` / `wiki/pages/*.md` 等）是用户花时间沉淀的项目历史记忆 + 当前指令，**不可恢复**（gitignored, 没 git history 兜底）. agent 误删 = 用户工作丢失.

### 触发：即将 rm / mv / 覆盖写 `.agents-personal/` 下任何文件或子目录

具体包括但不限于:

- `Bash` 跑 `rm` / `mv` / `find ... -delete` 涉及 `.agents-personal/` 路径
- `Write` 工具覆盖写 `.agents-personal/` 下已存在文件 (因为 Write 会整文件覆盖)
- `Edit` 工具把 `.agents-personal/` 下文件内容删空 / 大段抹除 (5 行以上删除)
- subagent / Agent dispatch 时, 给 subagent 任务里含上述操作

不触发: `Read` / `cat` / `grep` / `ls` 等纯读取——不会丢内容.

### 标准动作: 停手 → 描述 → 等明确确认

1. **停下来**, 不直接执行
2. **明确告知用户**: 将要删除什么具体文件 / 内容范围, 删除原因是什么, 影响什么 (例: "将删 `wiki/pages/260512-redis-decision.md`, 因为内容跟新决策矛盾, 删后该决策上下文不可恢复")
3. **等用户明确确认**——口头 "ok / 删 / 去吧 / 确认"等都可以, 但**必须**有这一轮回复, 不能 agent 自己脑补"用户应该同意"
4. 用户确认后再执行

### 例外: 用户主动指示删时仍要回显

即使用户主动说"删 `.agents-personal/wiki/pages/<file>`"——视为已确认, 可以直接删, **但要在删之前回显具体路径**:

> "即将 rm `.agents-personal/wiki/pages/260512-redis-decision.md` (2.3KB, 含 Redis 选型决策上下文). 确认?"

回显的目的不是再要一次确认 (用户已说删), 是给用户最后一刻的"等一下别删"窗口. 用户没继续否定就执行.

### 不要

- 不要在 sediment / sow 等沉淀命令里"顺手"清理旧 wiki / 旧 rule——除非命令自己定义了清理动作且用户已 review 过短码勾选
- 不要为了"重新组织" `.agents-personal/` 而批量 mv / rm——结构改动也是删除等价物, 同等待遇
- 不要假设"反正 git mv 不算删除"——`.agents-personal/` 是 gitignored, mv 实质等同于 delete + create
- 不要因为"文件过时 / 跟新决策矛盾"就自己拍板删——历史记忆有"被 superseded 但仍可参考"的价值, 由用户判断该删还是该加 `superseded by ...` 标记保留

### 对 `$USER_WIKI_PATH` 跨项目 advisor 的同等护栏

`/sediment` 的 `wiki:cross-project advisor` 出口写到 `$USER_WIKI_PATH/`——同样是用户的不可恢复知识库, 受同等护栏保护. 本节"`.agents-personal/`"凡处一律推广到 `$USER_WIKI_PATH/`.
