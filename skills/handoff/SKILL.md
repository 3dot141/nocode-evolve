---
name: handoff
description: Use when the session is getting long, context is approaching limits, or the user wants to continue in a new session. Use when the user says "handoff / 交接 / 传递给下一个会话 / 续接". Not for permanent archiving (that's /distill).
---

# handoff — 会话续接

把当前会话压缩成一段结构化文字，用户粘贴到新会话就能续接。不写文件，直接输出给用户。

和 /distill 的区别：distill 是永久归档（写 wiki/rules），handoff 是临时传递（给下一会话开局用）。和 /compact 的区别：compact 在**同一会话**内摘要（continue），handoff **fork 到新会话**（fork）。

**何时 handoff**：逼近 smart zone 上限（~120k token），或会话质量开始退化（重复问题 / 忘记之前决策 / 推理变浅）。不要在退化状态硬撑——handoff 的成本远低于在退化上下文里犯错。

## Checklist (TaskCreate)

1. **扫描会话状态** — 当前在哪个阶段、做了什么、没做什么
2. **压缩输出** — 按模板生成 handoff 文档
3. **交给用户** — 输出文本，用户粘贴到新会话

## 非本 skill 请求 + 降级

- "永久存档/以后别的项目也能用" → 引导 `/distill`，不走 handoff
- "总结一下干了啥" → 会话摘要，不必走 handoff 模板
- "不用交接直接继续" → 同会话继续，不触发 handoff
- **内容不足降级**：刚聊两句无实质状态 → 坦白说"几乎没有可交接的内容"，给一句话摘要而非硬凑模板

## 协议

### Step 1: 扫描会话状态

扫当前会话：
- 在 devflow 哪个阶段？（Define/Design/Plan/Build/Verify/Review/Land）
- 哪些 task 已完成？哪些还在进行？
- 关键决策有哪些？（restate、方案选择、测试目标）
- 有没有未解决的问题或被搁置的事项？

### Step 2: 压缩输出

```markdown
## Handoff

**项目**: [项目名/路径]
**分支**: [当前分支]
**阶段**: [devflow 阶段]
**进度**: [已完成 N/M task]

### 已完成
- [具体做了什么，含关键 commit hash]

### 进行中
- [当前正在做什么，卡在哪里]

### 未完成
- [剩下什么没做]

### 关键决策
- [restate 摘要 / 方案选择 / 测试目标]

### 关键文件
- [正在改的文件路径列表]

### 注意事项
- [踩坑 / 已知风险 / 被搁置的问题]

### Suggested Skills
- [下一会话应该用什么 skill 继续，如 nocode-evolve:dev-build / nocode-evolve:dev-verify]
```

**压缩原则（按 context hierarchy 取舍）**：
- **引用而非复制**：高持久层内容（restate/设计文档/计划）写路径让下游 Read，不复制全文。只 inline 低持久层内容（当前进度/卡点/临时决策）
- 关键决策只写结论，不写推导过程
- 敏感信息（token / 密码 / 内部 URL）不放
- **默认直接输出文本**，用户复制到新会话。超长时可落 OS temp dir，但不写 repo——handoff 是临时传递物
- 目标：下一个 agent 读完 30 秒内知道从哪里续接

### Step 3: 交给用户

直接输出文本。用户复制粘贴到新会话的第一条消息。不写到文件——handoff 是临时传递物，不需要持久化。
