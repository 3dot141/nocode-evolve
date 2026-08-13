本文所说“结构化决策”在回合末写出完整问题与 2–3 个互斥选项，等待用户下一条消息。

> 本文写“结构化决策”时，必须使用当前平台原生决策工具，传入完整问题与 2–3 个互斥选项；确认内容超过 10 行时先单独展示，下一回合再确认。

# /projecthub write：子目录文档写入

为项目子目录写入/更新 AGENTS.md（agent 工作约束）和 README.md（人类可读文档）。

**被 `/distill` 调用**（distill 路由 `docs:subdir` 出口时传入候选）。也可用户直接 `/projecthub write <dir>` 独立写入。

## 入参

### 被 distill 调用时

distill 传入 `arguments.payload.candidates[]` 结构化候选；不得读取扁平顶层字段：
```
{ summary, target_dir, target_file, body }
  target_dir   目标子目录路径 (相对项目根)
  target_file  agents | readme | both
  body         要写入的内容片段
```

### 独立调用时

`/projecthub write <dir-path> [agents|readme|both]`
- `<dir-path>`：目标目录（相对项目根或绝对路径）
- 第二参数：写入哪个文件，默认 `both`

无参数时提示用法。

## AGENTS.md 内容规范

子目录 AGENTS.md 是给 agent 看的工作约束。

```markdown
# <dir-name>/ — <一句话定位>

<该目录的核心职责，2-3 句话>

## 约束

- <在这个目录工作时必须遵守的规则>
- <禁止做的事情>
- <特殊工作流要求>

## 结构

<关键文件/子目录说明，只列有意义的>

## 相关

- <与其他目录的依赖关系>
```

**写法原则：**
- 只写 agent 需要知道的约束，不写人类背景知识
- 约束必须具体可执行（"不要手改生成物" 好，"注意代码质量" 差）
- 引用具体文件路径
- 保持简短，单个 AGENTS.md 不超过 80 行

## README.md 内容规范

子目录 README.md 是给人看的文档。

```markdown
# <dir-name>

<该目录是什么，做什么用>

## 目录结构

<文件/子目录说明>

## 使用方式

<怎么用 / 怎么扩展 / 怎么修改>

## 注意事项

<人类需要知道的背景信息>
```

## 执行流程

### Step 1: 分析目录

1. 确认目标目录存在（不存在 → 报错停止）
2. `ls -la` 列出目录内容
3. 读关键文件（package.json / index.* / 入口文件 / 配置文件）
4. 已有 AGENTS.md 或 README.md → Read 全文
5. 理解目录职责、与上下游的关系

### Step 2: 生成/更新内容

**新建（目标文件不存在）**：
- 基于 Step 1 分析，按上方内容规范生成
- 生成后展示，使用结构化决策确认再写入

**更新（目标文件已存在）**：

```
已有内容是否仍准确？
     │
     ├─ 准确 + 有新内容补充 ──→ 融合新内容到合适位置（不末尾 paste）
     │
     ├─ 部分过时 ──→ 更新过时部分 + 融合新内容
     │
     └─ 大部分过时 ──→ 重写（展示新旧对比，使用结构化决策确认）
```

### Step 3: 写入

用户确认后写入文件。

被 distill 调用时，body 已包含内容 → 仍需 Step 1 分析确认 body 与目录实际状态一致，不盲写。

### Step 4: 报告

```
projecthub write 完成：
  + module-a/AGENTS.md (新建, 28 行)
  + module-a/README.md (更新, +12 行)
```

## 反模式

- 不末尾 paste——融合到合适章节
- 不写空泛约束——"保持代码整洁" 等于没写
- 不照搬 .agents-personal 内容——两者受众不同（共享约束 vs 个人知识）
- 不在 AGENTS.md 写人类背景故事——agent 不需要 "本目录创建于 2024 年"
