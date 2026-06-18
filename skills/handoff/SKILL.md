---
name: handoff
description: Use when the session is getting long, context is approaching limits, or the user wants to continue in a new session. Use when the user says "handoff / 交接 / 传递给下一个会话 / 续接". Not for permanent archiving (that's /distill).
---

# handoff — 会话续接

把当前会话压缩成一段结构化文字，用户粘贴到新会话就能续接。不写文件，直接输出给用户。

和 /distill 的区别：distill 是永久归档（写 wiki/rules），handoff 是临时传递（给下一会话开局用）。

## Checklist (TaskCreate)

1. **扫描会话状态** — 当前在哪个阶段、做了什么、没做什么
2. **压缩输出** — 按模板生成 handoff 文档
3. **交给用户** — 输出文本，用户粘贴到新会话

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
- [下一会话应该用什么 skill 继续，如 nocode-evolve:build / nocode-evolve:verify]
```

**压缩原则**：
- **引用而非复制**：不重复已有文档（restate/设计文档/计划）的内容，写路径让下游 agent 自己 Read
- 关键决策只写结论，不写推导过程
- 敏感信息（token / 密码 / 内部 URL）不放
- **写 OS temp dir，不写 repo**——handoff 是临时传递物，不需要入版本控制
- 目标：下一个 agent 读完 30 秒内知道从哪里续接

### Step 3: 交给用户

直接输出文本。用户复制粘贴到新会话的第一条消息。不写到文件——handoff 是临时传递物，不需要持久化。
