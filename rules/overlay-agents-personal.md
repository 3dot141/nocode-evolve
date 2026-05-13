# 项目本地 `.agents-personal/` 使用约定

`<project>/.agents-personal/` 是项目本地放给 agent 的资源目录，目前两类子内容：

- `wiki/` —— **历史记忆**：设计决策、术语、踩坑记录。被动检索，可能被新决策 superseded。
- `AGENTS.md` + `rules/` —— **当前指令**：触发条件 + 操作细节。主动按触发匹配读取。

两类资源结构上同模式（主索引 + 子内容池），但**语义不同**：wiki 是事实记录，rules 是工作指令——不要把 wiki 当指令执行，也不要把 rules 当可质疑的历史。

---

## §1 wiki/ —— 历史记忆

由用户跑 `/project-wiki-distill` 维护。

### 强制基线：每个新会话至少扫一眼 INDEX

新会话开始、**首次响应用户实质性问题前**，强制执行：

```
ls <project>/.agents-personal/wiki/
  ├─ 目录不存在 / 没有 INDEX.md → 跳过，按通常方式工作
  └─ 存在 INDEX.md             → Read INDEX.md（仅 INDEX，不进 pages）
```

要点：

- 这是**兜底动作**，不再依赖「用户问题是否暗示项目背景」之类的触发判断
- INDEX 在同一会话内只需读一次；后续轮次命中 cache 不要重复 `ls` / `Read`
- 读完 INDEX 不必在回答里逐条复述——但若 INDEX 里的某条 description 显著和当前任务相关，**必须**在回答里点名引用，避免「读了等于没读」

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
- 试图自己写 wiki——沉淀走 `/project-wiki-distill`，AI 主动写 wiki 容易过度

### 关于沉淀

如果你发现本会话产生了**值得沉淀**的项目级知识（新设计决策、新约定、新踩过的坑），主动建议用户跑 `/project-wiki-distill`，但不要替用户决定。

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

- **新会话开始扫 AGENTS.md**：和 wiki/INDEX.md 同一时机（首次响应实质性问题前），同会话只读一次
- **rules/<topic>.md 按需**：当前任务匹配某条触发条件 → Read 对应 rule 文件 → 按其指令执行
- 命中即引用：和 wiki 一样，读了就要在回答里反映出来（不必复述全文，但要表明依据来自哪条 rule）

### 不要

- 在 AGENTS.md 里写命令模板 / 长事实表——挪到对应 rule
- 触发条件用「可能 / 也许 / 看情况」——含糊触发等于没触发
- 把 rules/<topic>.md 当历史记录质疑——它是当前指令，要执行；要改请用户改文件
- 自己往 `.agents-personal/AGENTS.md` 或 `rules/` 里写东西——同 wiki，沉淀由用户决定（可建议、不替代）

### 关于沉淀

如果本会话产生了**值得沉淀**的项目级指令（新约定、新命令、新踩坑后的标准做法），主动建议用户写进 `.agents-personal/rules/<topic>.md` 并在 AGENTS.md 加一行触发条件。如果只是一次性背景，建议走 wiki 而非 rules。
